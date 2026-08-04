import {
  buildBusinessEngineContract,
  validateBusinessEngineContract,
} from '../../../businessEngine/index.js';
import { projectBusinessAssessmentSnapshot } from '../../bootstrap/businessAssessmentBootstrap.js';
import { createIntelligenceEvent } from '../../intelligenceEvent.js';
import { hashCanonicalJson } from '../../hashing.js';
import { runDurableIntelligenceRuntime } from '../../runtime/durableRuntime.js';
import { runPredictiveInterventionRuntime } from '../../runtime/predictiveInterventionRuntime.js';
import {
  confirmedExtractionToEvents,
  decideExtraction,
  proposeStructuredExtraction,
} from '../../subscriber/confirmation.js';
import { planSubscriberResponse } from '../../subscriber/conversation.js';
import { materializeSubscriberEvent } from '../../subscriber/subscriberCycle.js';
import { deepFreeze } from '../../validation.js';
import {
  createLivingConversationRuntimeV1,
} from './livingConversation/runtime.js';

export const PRIVATE_RUNTIME_INTELLIGENCE_EXECUTION_VERSION =
  'private-runtime-intelligence-execution-v1';
export const PRIVATE_RUNTIME_INTELLIGENCE_OPERATIONS = Object.freeze([
  'BOOTSTRAP',
  'SUBMIT_CONFIRMED_EVIDENCE',
  'RELOAD',
  'CONVERSE',
]);

const frozen = (value) => deepFreeze(structuredClone(value));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = (value, max = 256) => typeof value === 'string'
  && value.trim().length > 0
  && value.length <= max;
const sameScope = (left, right) => [
  'tenant_id',
  'profile_id',
  'business_id',
  'subscriber_id',
].every((key) => left?.[key] === right?.[key]);

function stableExecutionContractValue(value, path = []) {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry, index) => stableExecutionContractValue(entry, [...path, index]));
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().flatMap((key) => {
    if (value[key] === undefined) return [];
    if (path.length === 1
      && path[0] === 'contract_metadata'
      && key === 'assembled_at') return [];
    return [[key, stableExecutionContractValue(value[key], [...path, key])]];
  }));
}

export function privateRuntimeBusinessEngineExecutionContractDigest(contract) {
  return hashCanonicalJson(stableExecutionContractValue(contract));
}

class ExecutionFailure extends Error {
  constructor(stage, component, code, missingDependency = null, requiredRepair = null) {
    super(code);
    this.stage = stage;
    this.component = component;
    this.code = code;
    this.missingDependency = missingDependency;
    this.requiredRepair = requiredRepair;
  }
}

function safeFailure(error) {
  return frozen({
    stage_number: Number.isInteger(error?.stage) ? error.stage : 0,
    component: text(error?.component) ? error.component : 'private_runtime_intelligence_execution',
    reason: text(error?.code) ? error.code : 'PRIVATE_RUNTIME_EXECUTION_FAILED',
    stack: [error?.name || 'Error', error?.component || 'private_runtime_intelligence_execution'],
    missing_dependency: error?.missingDependency || null,
    required_repair: error?.requiredRepair || null,
  });
}

function traceStage(trace, stageNumber, component, status, receipt = null) {
  trace.push({
    stage_number: stageNumber,
    component,
    status,
    receipt: receipt == null ? null : structuredClone(receipt),
  });
}

function liveProvenance({
  scope,
  sourceId,
  sourceHash,
  sourceType,
  capturedAt,
  subscriberSubjectRef,
}) {
  return {
    source_id: sourceId,
    source_type: sourceType,
    source_version: '1.0.0',
    source_location: 'private-runtime://approved-scope',
    source_hash: `sha256:${sourceHash}`,
    source_actor: {
      type: 'ACTOR',
      id: subscriberSubjectRef,
      tenant_id: scope.tenant_id,
    },
    source_system: {
      id: 'more_private_runtime',
      version: PRIVATE_RUNTIME_INTELLIGENCE_EXECUTION_VERSION,
    },
    captured_at: capturedAt,
    parent_source_ids: [],
    confidence: 1,
    notes: 'Private-beta exact-scope deterministic execution.',
  };
}

function baselineMetrics(contract) {
  const current = contract?.current_business_reality?.current;
  if (!current || typeof current !== 'object' || Array.isArray(current)) return [];
  return Object.keys(current).sort().map((metricId) => ({
    metric_id: metricId,
    value: current[metricId]?.value ?? current[metricId],
    unit: current[metricId]?.unit || 'ASSESSMENT_SNAPSHOT',
  }));
}

function createBaselineEvents({
  contract,
  scope,
  assessmentId,
  assessmentHash,
  subscriberSubjectRef,
}) {
  const recordedAt = contract.contract_metadata.generated_at;
  const provenance = liveProvenance({
    scope,
    sourceId: assessmentId,
    sourceHash: assessmentHash,
    sourceType: 'BUSINESS_ASSESSMENT_SNAPSHOT',
    capturedAt: recordedAt,
    subscriberSubjectRef,
  });
  return baselineMetrics(contract).map((metric) => {
    const eventSeed = hashCanonicalJson({
      assessmentId,
      scope,
      metric,
    });
    const payload = {
      metric_id: metric.metric_id,
      value: metric.value,
      unit: metric.unit,
      verification_method: 'ASSESSMENT_SNAPSHOT',
      verification_state: 'USER_ATTESTED',
    };
    const built = createIntelligenceEvent({
      event_id: `evt_private_beta_bootstrap_${eventSeed.slice(0, 24)}`,
      event_type: 'KPI_EVIDENCE_RECORDED',
      schema_version: '1.0.0',
      profile_id: scope.profile_id,
      business_id: scope.business_id,
      organization_id: null,
      subscription_id: null,
      tenant_id: scope.tenant_id,
      authority_type: 'USER_EVIDENCE',
      truth_class: 'OBSERVED_TRUTH',
      source_actor: {
        type: 'ACTOR',
        id: subscriberSubjectRef,
      },
      source_artifact: {
        id: assessmentId,
        version: '1.0.0',
      },
      source_system: {
        id: 'more_business_assessment',
        version: 'business-assessment-snapshot-v1',
      },
      occurred_at: recordedAt,
      observed_at: recordedAt,
      recorded_at: recordedAt,
      effective_at: recordedAt,
      expires_at: null,
      payload,
      idempotency_key: `idem_private_beta_bootstrap_${eventSeed.slice(0, 24)}`,
      confidence: 0.5,
      privacy_classification: 'TENANT_PRIVATE',
      consent_scope: ['assessment'],
      supersedes_event_id: null,
      correction_of_event_id: null,
      causation_event_id: null,
      correlation_id: `corr_private_beta_bootstrap_${eventSeed.slice(0, 24)}`,
      provenance,
      created_by: {
        type: 'ACTOR',
        id: subscriberSubjectRef,
      },
    });
    if (!built.validation.valid) {
      throw new ExecutionFailure(
        5,
        'business_assessment_bootstrap',
        'BOOTSTRAP_EVENT_INVALID',
      );
    }
    return built.event;
  });
}

function runtimeInput({
  binding,
  scope,
  asOfAt,
  storedEvents,
  provenance,
  priorStateVersion = null,
  priorBeliefState = null,
  currentFutureSet = null,
}) {
  return {
    tenant_id: scope.tenant_id,
    profile_id: scope.profile_id,
    business_id: scope.business_id,
    subscription_id: null,
    as_of_at: asOfAt,
    stored_events: storedEvents,
    purpose: 'business_assessment',
    scope: 'assessment',
    consent_record: binding.evidence_consent,
    relationship_authorized: true,
    vertical_operating_policy: binding.vertical_operating_policy,
    market_context_graph: binding.market_context_graph,
    authority_conflict_graph: binding.authority_conflict_graph,
    prior_state_version: priorStateVersion,
    prior_belief_state: priorBeliefState,
    belief_observations: [],
    provenance,
    consent_record_ids: [binding.evidence_consent.consent_id],
    intervention_candidates: binding.intervention_candidates,
    support_by_slot: binding.support_by_slot,
    current_future_set: currentFutureSet,
    scoped_inputs: [scope],
  };
}

function snapshotIntegrity(snapshot) {
  const copy = { ...snapshot };
  delete copy.integrity_hash;
  return hashCanonicalJson(copy);
}

function publicProjection(snapshot, trace) {
  const durable = snapshot.durable_runtime;
  const predictive = snapshot.predictive_runtime;
  return frozen({
    execution_version: PRIVATE_RUNTIME_INTELLIGENCE_EXECUTION_VERSION,
    operation: snapshot.operation,
    state_version: durable.business_engine_state_version.state_version,
    state_version_id: durable.business_engine_state_version.state_version_id,
    previous_state_version_id:
      durable.business_engine_state_version.previous_state_version_id,
    trend: durable.business_engine_state.trend_summary,
    evidence_sources: durable.business_engine_state.evidence_ids,
    explanation_trace: {
      explanation_trace_id: durable.explanation_trace.explanation_trace_id,
      changed_outputs: durable.explanation_trace.changed_outputs,
      unchanged_outputs: durable.explanation_trace.unchanged_outputs,
      missing_evidence: durable.explanation_trace.missing_evidence,
      human_review_required: durable.explanation_trace.human_review_required,
      safe_summary: durable.explanation_trace.safe_summary,
    },
    confidence: durable.confidence_state,
    five_futures: predictive.future_engine.versions.map((future) => ({
      stable_future_identity: future.stable_future_identity,
      slot: future.slot,
      probability: future.probability,
      probability_confidence: future.probability_confidence,
      explanation_trace_ref:
        predictive.future_engine.explanation_trace.explanation_trace_id,
    })),
    one_move: predictive.one_move
      ? {
          one_move_id: predictive.one_move.one_move_id,
          candidate_id: predictive.one_move.candidate_id,
          status: predictive.one_move.status,
          explanation_trace_ref: predictive.one_move.explanation_trace_ref,
        }
      : null,
    persistence: {
      append_only: true,
      immutable_history: true,
      event_sequence: snapshot.event_sequence,
      projection_sequence: snapshot.projection_sequence,
      snapshot_integrity_hash: snapshot.integrity_hash,
    },
    execution_trace: trace,
  });
}

function storedSnapshotTrace(snapshot) {
  return [
    ...(snapshot.execution_trace || []),
    {
      stage_number: 18,
      component: 'version_history',
      status: 'PASSED',
      receipt: {
        projection_sequence: snapshot.projection_sequence,
        integrity_hash: snapshot.integrity_hash,
        immutable_history: true,
      },
    },
  ];
}

async function appendEvents(store, events, trace, stageNumber) {
  let history = await store.readEvents();
  if (!history.ok) {
    throw new ExecutionFailure(stageNumber, 'append_only_product_store', history.code);
  }
  for (const event of events) {
    const appended = await store.appendEvent({
      event,
      idempotencyKey: event.idempotency_key,
      expectedSequence: history.sequence,
    });
    if (!appended.ok) {
      throw new ExecutionFailure(stageNumber, 'append_only_product_store', appended.code);
    }
    history = await store.readEvents();
    if (!history.ok) {
      throw new ExecutionFailure(stageNumber, 'append_only_product_store', history.code);
    }
  }
  traceStage(trace, stageNumber, 'append_only_product_store', 'PASSED', {
    appended_event_count: events.length,
    event_sequence: history.sequence,
  });
  return history;
}

async function latestProjection(store) {
  const latest = await store.readLatestRecord('projection');
  if (!latest.ok) return latest;
  if (!latest.record) return frozen({ ok: true, record: null, sequence: 0 });
  const snapshot = latest.record.value;
  if (!snapshot
    || snapshot.snapshot_version !== 'private-live-product-snapshot-v1'
    || !sha256(snapshot.integrity_hash)
    || snapshot.integrity_hash !== snapshotIntegrity(snapshot)) {
    return frozen({ ok: false, code: 'PROJECTION_HISTORY_CORRUPT' });
  }
  return latest;
}

export function createPrivateRuntimeIntelligenceExecutionV1({
  productStore,
  binding,
  productBindingAttestation,
  conversationProvider = null,
  conversationProviderBinding = null,
  conversationProviderCohortSha256 = null,
  clock = () => new Date().toISOString(),
  contractBuilder = buildBusinessEngineContract,
  contractValidator = validateBusinessEngineContract,
} = {}) {
  if (!productStore?.append_only
    || !productStore?.immutable_history
    || productStore?.destructive_operations !== false
    || !binding
    || !productBindingAttestation) {
    throw new TypeError('authorized private-live product execution dependencies required');
  }
  const livingConversation = createLivingConversationRuntimeV1({
    provider: conversationProvider,
    providerBinding: conversationProviderBinding,
    expectedExactScopeHash: binding.exact_scope_hash,
    approvedProfileCohortSha256: conversationProviderCohortSha256,
  });

  async function persistSnapshot({
    operation,
    contractHash,
    dossierHash,
    assessmentHash,
    eventHistory,
    runtime,
    predictive,
    replayBasis,
    commandRecordId,
    requestFingerprint,
    conversationReceipt,
    trace,
    projectionSequence,
    previousProjectionRecordId,
  }) {
    const generatedAt = runtime.business_engine_state_version.generated_at;
    const snapshot = {
      snapshot_version: 'private-live-product-snapshot-v1',
      operation,
      exact_scope_hash: binding.exact_scope_hash,
      generated_at: generatedAt,
      business_engine_contract_hash: contractHash,
      dossier_hash: dossierHash,
      assessment_hash: assessmentHash,
      event_sequence: eventHistory.sequence,
      projection_sequence: projectionSequence + 1,
      durable_runtime: runtime,
      predictive_runtime: predictive,
      replay_basis: replayBasis,
      command_record_id: commandRecordId,
      request_fingerprint: requestFingerprint,
      conversation_receipt: conversationReceipt,
      execution_trace: structuredClone(trace),
    };
    snapshot.integrity_hash = snapshotIntegrity(snapshot);
    const appended = await productStore.appendRecord({
      kind: 'projection',
      recordId: `projection_${snapshot.integrity_hash}`,
      value: snapshot,
      idempotencyKey: `projection_${snapshot.integrity_hash}`,
      expectedSequence: projectionSequence,
      previousRecordId: previousProjectionRecordId,
    });
    if (!appended.ok) {
      throw new ExecutionFailure(18, 'append_only_projection_store', appended.code);
    }
    traceStage(trace, 18, 'version_history', 'PASSED', {
      projection_sequence: appended.sequence,
      integrity_hash: snapshot.integrity_hash,
      immutable_history: true,
    });
    return frozen({
      ...snapshot,
      projection_sequence: appended.sequence,
    });
  }

  async function reconstruct(snapshot, eventHistory, trace) {
    const input = runtimeInput({
      binding,
      scope: binding.exact_scope,
      asOfAt: snapshot.generated_at,
      storedEvents: eventHistory.events,
      provenance: snapshot.replay_basis.provenance,
      priorStateVersion: snapshot.replay_basis.prior_state_version,
      priorBeliefState: snapshot.replay_basis.prior_belief_state,
      currentFutureSet: snapshot.replay_basis.current_future_set,
    });
    const durable = runDurableIntelligenceRuntime(input);
    if (!durable.ok) {
      throw new ExecutionFailure(20, 'durable_runtime_replay', durable.failure?.code || durable.phase);
    }
    const predictive = runPredictiveInterventionRuntime({
      ...input,
      durable_runtime_result: durable,
    });
    if (!predictive.ok) {
      throw new ExecutionFailure(20, 'predictive_runtime_replay', predictive.failure?.code || predictive.phase);
    }
    const equivalent = durable.runtime_hash === snapshot.durable_runtime.runtime_hash
      && predictive.runtime_hash === snapshot.predictive_runtime.runtime_hash;
    if (!equivalent) {
      throw new ExecutionFailure(20, 'reload_state_recovery', 'REPLAY_DIVERGENCE');
    }
    traceStage(trace, 20, 'reload_state_recovery', 'PASSED', {
      durable_runtime_hash: durable.runtime_hash,
      predictive_runtime_hash: predictive.runtime_hash,
      equivalent: true,
    });
    return { durable, predictive };
  }

  async function execute({
    operation,
    request,
    requestContext,
    authority,
    attachmentSet,
  } = {}) {
    const trace = [];
    try {
      if (!PRIVATE_RUNTIME_INTELLIGENCE_OPERATIONS.includes(operation)) {
        throw new ExecutionFailure(0, 'intelligence_operation', 'INTELLIGENCE_OPERATION_DENIED');
      }
      if (authority?.allowed !== true
        || attachmentSet?.runtime_ready !== true
        || !sameScope(request?.exact_scope, binding.exact_scope)
        || !binding.approved_profile_ids.includes(binding.exact_scope.profile_id)
        || requestContext?.exact_scope_hash !== binding.exact_scope_hash) {
        throw new ExecutionFailure(1, 'private_runtime_authority', 'PRIVATE_RUNTIME_AUTHORITY_DENIED');
      }
      traceStage(trace, 1, 'protected_private_runtime_authority', 'PASSED', {
        authority_fingerprint: authority.authority_fingerprint,
      });
      traceStage(trace, 2, 'approved_profile_id', 'PASSED', {
        exact_scope_hash: binding.exact_scope_hash,
        approved: true,
      });

      const idempotencyRef = requestContext.idempotency_ref;
      if (!text(idempotencyRef, 160)) {
        throw new ExecutionFailure(1, 'request_integrity', 'IDEMPOTENCY_REFERENCE_REQUIRED');
      }
      const commandRecordId = `command_${hashCanonicalJson(idempotencyRef)}`;
      const requestFingerprint = hashCanonicalJson({
        operation,
        exact_scope_hash: binding.exact_scope_hash,
        body: request?.intelligence_input || null,
      });
      const projectionHistory = await productStore.readRecords('projection');
      if (!projectionHistory.ok) {
        throw new ExecutionFailure(18, 'projection_history', projectionHistory.code);
      }
      const priorCommandProjection = projectionHistory.records.find(
        (record) => record.value?.command_record_id === commandRecordId,
      );
      if (priorCommandProjection) {
        if (priorCommandProjection.value.request_fingerprint !== requestFingerprint) {
          throw new ExecutionFailure(1, 'request_integrity', 'IDEMPOTENCY_CONFLICT');
        }
        return frozen({
          ok: true,
          allowed: true,
          status: 200,
          runtime_ready: true,
          projections: publicProjection(
            priorCommandProjection.value,
            storedSnapshotTrace(priorCommandProjection.value),
          ),
          idempotent_replay: true,
        });
      }

      if (operation === 'RELOAD') {
        traceStage(trace, 19, 'application_reload', 'PASSED', {
          process_local_state_used: false,
        });
        const [history, latest] = await Promise.all([
          productStore.readEvents(),
          latestProjection(productStore),
        ]);
        if (!history.ok || !latest.ok || !latest.record) {
          throw new ExecutionFailure(
            20,
            'reload_state_recovery',
            history.code || latest.code || 'PERSISTED_STATE_NOT_FOUND',
          );
        }
        await reconstruct(latest.record.value, history, trace);
        const publicResult = publicProjection(latest.record.value, trace);
        return frozen({
          ok: true,
          allowed: true,
          status: 200,
          runtime_ready: true,
          projections: publicResult,
          idempotent_replay: false,
        });
      }

      const [dossierResult, assessmentResult, priorProjection] = await Promise.all([
        productStore.loadCanonicalDossier(),
        productStore.loadBusinessAssessment(),
        latestProjection(productStore),
      ]);
      if (!dossierResult.ok) {
        throw new ExecutionFailure(3, 'canonical_dossier_loader', dossierResult.code);
      }
      traceStage(trace, 3, 'canonical_dossier_loader', 'PASSED', {
        dossier_hash: dossierResult.dossier_hash,
        exact_profile: true,
      });
      if (!assessmentResult.ok) {
        throw new ExecutionFailure(4, 'business_assessment_loader', assessmentResult.code);
      }
      traceStage(trace, 4, 'business_assessment_loader', 'PASSED', {
        assessment_hash: assessmentResult.assessment_hash,
        assessment_id_hash: hashCanonicalJson(assessmentResult.assessment_id),
      });
      if (!priorProjection.ok) {
        throw new ExecutionFailure(18, 'projection_history', priorProjection.code);
      }

      const contract = contractBuilder(assessmentResult.assessment);
      const contractValidation = contractValidator(contract);
      const contractHash = privateRuntimeBusinessEngineExecutionContractDigest(contract);
      if (!contractValidation.valid
        || contractHash !== binding.business_engine_execution_contract_sha256
        || contract.identity?.profile_id?.toLowerCase() !== binding.exact_scope.profile_id.toLowerCase()) {
        throw new ExecutionFailure(5, 'canonical_business_engine', 'BUSINESS_ENGINE_CONTRACT_MISMATCH');
      }
      const asOfAt = operation === 'BOOTSTRAP'
        ? contract.contract_metadata.generated_at
        : operation === 'CONVERSE'
          ? request.intelligence_input?.requested_at
          : request.intelligence_input?.decided_at;
      if (!text(asOfAt) || !Number.isFinite(Date.parse(asOfAt))) {
        throw new ExecutionFailure(5, 'execution_clock', 'CANONICAL_EXECUTION_TIME_REQUIRED');
      }
      if (operation === 'CONVERSE') {
        const evaluatedAt = clock();
        const evaluatedMs = typeof evaluatedAt === 'number'
          ? evaluatedAt
          : Date.parse(evaluatedAt);
        const requestedMs = Date.parse(asOfAt);
        if (!Number.isFinite(evaluatedMs)
          || requestedMs < evaluatedMs - (5 * 60_000)
          || requestedMs > evaluatedMs + 60_000) {
          throw new ExecutionFailure(
            5,
            'execution_clock',
            'LIVING_CONVERSATION_REQUEST_STALE',
          );
        }
      }
      const provenance = liveProvenance({
        scope: binding.exact_scope,
        sourceId: assessmentResult.assessment_id,
        sourceHash: assessmentResult.assessment_hash,
        sourceType: 'BUSINESS_ASSESSMENT_SNAPSHOT',
        capturedAt: asOfAt,
        subscriberSubjectRef: authority.subscriber_subject_ref,
      });
      const projected = projectBusinessAssessmentSnapshot({
        contract,
        ...binding.exact_scope,
        source_event_id: `evt_ba_snapshot_${assessmentResult.assessment_hash.slice(0, 24)}`,
        evidence_ids: [],
        provenance,
        vertical_operating_policy: binding.vertical_operating_policy,
        consent_record_ids: [binding.evidence_consent.consent_id],
      });
      if (!projected.ok) {
        throw new ExecutionFailure(5, 'business_engine_bootstrap', projected.status);
      }
      traceStage(trace, 5, 'business_engine_bootstrap', 'PASSED', {
        contract_hash: contractHash,
        projection_hash: projected.projection_hash,
      });

      if (operation === 'CONVERSE') {
        if (!priorProjection.record) {
          throw new ExecutionFailure(
            6,
            'living_conversation_context',
            'LIVING_BUSINESS_STATE_REQUIRED',
          );
        }
        const history = await productStore.readEvents();
        if (!history.ok) {
          throw new ExecutionFailure(6, 'living_conversation_context', history.code);
        }
        await reconstruct(priorProjection.record.value, history, trace);
        traceStage(trace, 21, 'living_conversation_context', 'PASSED', {
          exact_scope_hash: binding.exact_scope_hash,
          context_classes: 8,
          raw_dossier_exposed: false,
          raw_assessment_answers_exposed: false,
          transcript_loaded: false,
        });
        const conversation = await livingConversation.converse({
          input: request.intelligence_input,
          exactScope: binding.exact_scope,
          subscriberSubjectRef: authority.subscriber_subject_ref,
          dossier: dossierResult.dossier,
          businessEngineContract: contract,
          snapshot: priorProjection.record.value,
          traceId: requestContext.correlation_ref,
          exactScopeHash: binding.exact_scope_hash,
        });
        if (!conversation.ok) {
          throw new ExecutionFailure(
            22,
            'living_conversation_model',
            conversation.code || 'LIVING_CONVERSATION_FAILED',
          );
        }
        traceStage(trace, 22, 'living_conversation_model', 'PASSED', {
          model_receipt_id: conversation.conversation.model_receipt.receipt_id,
          proposal_count: conversation.conversation.proposed_evidence.length,
          canonical_mutation_performed: false,
          event_appended: false,
          projection_appended: false,
          transcript_persisted: false,
        });
        return frozen({
          ok: true,
          allowed: true,
          status: 200,
          runtime_ready: true,
          projections: publicProjection(priorProjection.record.value, trace),
          conversation: conversation.conversation,
          conversation_receipt: conversation.receipt,
          idempotent_replay: false,
        });
      }

      let events = [];
      if (operation === 'BOOTSTRAP') {
        if (priorProjection.record) {
          traceStage(trace, 19, 'existing_living_state', 'PASSED', {
            projection_sequence: priorProjection.sequence,
          });
          const history = await productStore.readEvents();
          if (!history.ok) {
            throw new ExecutionFailure(20, 'reload_state_recovery', history.code);
          }
          await reconstruct(priorProjection.record.value, history, trace);
          const publicResult = publicProjection(priorProjection.record.value, trace);
          return frozen({
            ok: true,
            allowed: true,
            status: 200,
            runtime_ready: true,
            projections: publicResult,
            idempotent_replay: false,
          });
        }
        events = createBaselineEvents({
          contract,
          scope: binding.exact_scope,
          assessmentId: assessmentResult.assessment_id,
          assessmentHash: assessmentResult.assessment_hash,
          subscriberSubjectRef: authority.subscriber_subject_ref,
        });
      } else {
        const input = request.intelligence_input;
        const conversation = planSubscriberResponse({
          request_id: input?.request_id,
          session_id: input?.session_id,
          turn_id: input?.turn_id,
          ...binding.exact_scope,
          statement: input?.statement,
          privacy_class: 'SUBSCRIBER_VISIBLE',
          intent: input?.intent,
        });
        if (!conversation.ok || conversation.plan.proposed_extraction !== true) {
          throw new ExecutionFailure(10, 'coach_connect_conversation', conversation.code || 'CONFIRMED_EVIDENCE_REQUIRED');
        }
        traceStage(trace, 10, 'coach_connect_conversation', 'PASSED', {
          response_plan_id: conversation.plan.response_plan_id,
          raw_statement_persisted: false,
        });
        traceStage(trace, 11, 'conversation_receipt', 'PASSED', {
          statement_hash: hashCanonicalJson(input.statement),
          transcript_persisted: false,
        });
        const extractedFields = Array.isArray(input?.extracted_fields)
          ? input.extracted_fields.map((field, index) => ({
              field: field.field,
              proposed_value: field.proposed_value,
              unit: field.unit,
              source_ref: `statement_span_${index + 1}`,
              canonical_target: binding.exact_scope,
            }))
          : [];
        const proposalResult = proposeStructuredExtraction({
          ...binding.exact_scope,
          statement_ref: `statement_${hashCanonicalJson(input.statement).slice(0, 24)}`,
          raw_statement: input.statement,
          extracted_fields: extractedFields,
          proposed_effective_at: input.effective_at,
          proposed_recorded_at: input.decided_at,
          extraction_confidence: input.extraction_confidence,
          privacy_classification: 'TENANT_PRIVATE',
        });
        if (!proposalResult.ok) {
          throw new ExecutionFailure(12, 'evidence_extraction', proposalResult.code);
        }
        traceStage(trace, 12, 'evidence_extraction', 'PASSED', {
          proposal_id: proposalResult.proposal.proposal_id,
          field_count: extractedFields.length,
        });
        const decision = decideExtraction(proposalResult.proposal, {
          decision: input.confirmation_status,
          subscriber_edits: input.subscriber_edits || [],
          decided_at: input.decided_at,
        });
        if (!decision.ok || decision.canonical_event_eligible !== true) {
          throw new ExecutionFailure(13, 'evidence_classification', decision.code || 'CONFIRMED_EVIDENCE_REQUIRED');
        }
        const candidates = confirmedExtractionToEvents(
          proposalResult.proposal,
          decision,
        );
        if (!candidates.ok) {
          throw new ExecutionFailure(13, 'evidence_classification', candidates.code);
        }
        traceStage(trace, 13, 'evidence_classification', 'PASSED', {
          decision_id: decision.decision.decision_id,
          event_candidate_count: candidates.events.length,
          authority_type: 'USER_EVIDENCE',
          truth_class: 'OBSERVED_TRUTH',
        });
        events = candidates.events.map((candidate) => {
          const built = materializeSubscriberEvent(candidate, {
            ...binding.exact_scope,
            subscription_id: null,
            confirmation_status: input.confirmation_status,
            extraction_confidence: input.extraction_confidence,
            consent_scope: ['assessment'],
            source_actor: {
              type: 'ACTOR',
              id: authority.subscriber_subject_ref,
            },
            source_system: {
              id: 'more_private_runtime',
              version: PRIVATE_RUNTIME_INTELLIGENCE_EXECUTION_VERSION,
            },
            correlation_id: requestContext.correlation_ref,
            provenance: liveProvenance({
              scope: binding.exact_scope,
              sourceId: candidate.source_proposal_id,
              sourceHash: proposalResult.proposal.proposal_hash,
              sourceType: 'SUBSCRIBER_CONFIRMED_EVIDENCE',
              capturedAt: input.decided_at,
              subscriberSubjectRef: authority.subscriber_subject_ref,
            }),
          });
          if (!built.ok) {
            throw new ExecutionFailure(13, 'evidence_classification', built.code || 'EVENT_INVALID');
          }
          return built.event;
        });
      }

      const eventHistory = await appendEvents(
        productStore,
        events,
        trace,
        operation === 'BOOTSTRAP' ? 5 : 13,
      );
      const replayBasis = {
        provenance,
        prior_state_version:
          priorProjection.record?.value?.durable_runtime?.business_engine_state_version || null,
        prior_belief_state:
          priorProjection.record?.value?.durable_runtime?.belief_state
          || projected.objects.belief_state,
        current_future_set:
          priorProjection.record?.value?.predictive_runtime?.future_engine || null,
      };
      const input = runtimeInput({
        binding,
        scope: binding.exact_scope,
        asOfAt,
        storedEvents: eventHistory.events,
        provenance,
        priorStateVersion: replayBasis.prior_state_version,
        priorBeliefState: replayBasis.prior_belief_state,
        currentFutureSet: replayBasis.current_future_set,
      });
      const durable = runDurableIntelligenceRuntime(input);
      if (!durable.ok) {
        throw new ExecutionFailure(6, 'reality_engine', durable.failure?.code || durable.phase);
      }
      if (operation === 'BOOTSTRAP') {
        traceStage(trace, 6, 'reality_engine', 'PASSED', {
          state_version_id: durable.business_engine_state_version.state_version_id,
          event_replay_hash: durable.event_replay.replay_hash,
        });
        traceStage(trace, 7, 'belief_state', 'PASSED', {
          belief_state_id: durable.belief_state.belief_state_id,
          belief_count: durable.belief_state.beliefs.length,
        });
      } else {
        traceStage(trace, 14, 'governed_synthesis', 'PASSED', {
          synthesis_receipt_hash: durable.synthesis_receipt.receipt_hash,
        });
        traceStage(trace, 15, 'business_engine_state_update', 'PASSED', {
          state_version_id: durable.business_engine_state_version.state_version_id,
        });
      }
      const predictive = runPredictiveInterventionRuntime({
        ...input,
        durable_runtime_result: durable,
      });
      if (!predictive.ok) {
        throw new ExecutionFailure(8, 'five_futures_and_one_move', predictive.failure?.code || predictive.phase);
      }
      const futureReceipt = {
        future_count: predictive.future_engine.versions.length,
        probability_sum: predictive.future_engine.versions
          .reduce((sum, future) => sum + future.probability, 0),
        stable_identity_count: new Set(predictive.future_engine.versions
          .map((future) => future.stable_future_identity)).size,
      };
      const oneMoveReceipt = {
        proposed: predictive.one_move != null,
        human_review_required: predictive.human_review_required,
      };
      if (operation === 'BOOTSTRAP') {
        traceStage(trace, 8, 'five_futures', 'PASSED', futureReceipt);
        traceStage(trace, 9, 'one_move', 'PASSED', oneMoveReceipt);
      } else {
        traceStage(trace, 16, 'five_futures_refresh', 'PASSED', {
          ...futureReceipt,
          future_set_version: predictive.future_engine.future_set_version,
        });
        traceStage(trace, 17, 'one_move_refresh', 'PASSED', oneMoveReceipt);
      }
      const snapshot = await persistSnapshot({
        operation,
        contractHash,
        dossierHash: dossierResult.dossier_hash,
        assessmentHash: assessmentResult.assessment_hash,
        eventHistory,
        runtime: durable,
        predictive,
        replayBasis,
        commandRecordId,
        requestFingerprint,
        conversationReceipt: operation === 'SUBMIT_CONFIRMED_EVIDENCE'
          ? {
              session_ref_hash: hashCanonicalJson(request.intelligence_input.session_id),
              turn_ref_hash: hashCanonicalJson(request.intelligence_input.turn_id),
              statement_hash: hashCanonicalJson(request.intelligence_input.statement),
              raw_statement_persisted: false,
              transcript_persisted: false,
              accepted_event_ids: events.map((event) => event.event_id),
            }
          : null,
        trace,
        projectionSequence: priorProjection.sequence,
        previousProjectionRecordId: priorProjection.record?.record_id || null,
      });
      const publicResult = publicProjection(snapshot, trace);
      return frozen({
        ok: true,
        allowed: true,
        status: 200,
        runtime_ready: true,
        projections: publicResult,
        idempotent_replay: false,
      });
    } catch (error) {
      return frozen({
        ok: false,
        allowed: false,
        status: 503,
        code: error?.code || 'PRIVATE_RUNTIME_EXECUTION_FAILED',
        execution_failure: safeFailure(error),
        execution_trace: trace,
      });
    }
  }

  return Object.freeze({
    execution_version: PRIVATE_RUNTIME_INTELLIGENCE_EXECUTION_VERSION,
    configured: true,
    source_default_off: true,
    private_beta_only: true,
    public_access: false,
    append_only: true,
    immutable_history: true,
    execute,
  });
}

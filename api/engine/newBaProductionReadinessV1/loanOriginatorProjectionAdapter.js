import { validateProgressiveBusinessTwin } from '../../../src/lib/baProgressiveDisclosureV1/projection.js';
import {
  assertLoanOriginatorPrivacyBoundary,
  validateLoanOriginatorTypedEvidence,
} from '../../../src/lib/baVerticalCassettesV1/loanOriginatorEvidence.js';
import { createRealProfileProjectionV2 } from './realProfileProjectionAdapter.js';
import { sha256Stable } from './stable.js';

const QUICK_FACT_FIELDS = Object.freeze({
  'combined-soi-current': Object.freeze(['funded_units_12m']),
  'attributed-contacts-estimate': Object.freeze(['funded_volume_12m']),
  'top-of-mind-current': Object.freeze(['osn_sources']),
  'current-live-contacts': Object.freeze(['crn_meaningful_size']),
  'current-active-pipeline': Object.freeze([
    'funnel_purpose',
    'funnel_window',
    'funnel_cohort_basis',
    'opportunity_count_definition',
    'application_count_definition',
    'purchase_active_transaction',
    'refinance_active_loan',
    'close_fund_count_definition',
  ]),
});

const LOCKED_SURFACES = Object.freeze([
  Object.freeze({
    id: 'business-now',
    title: 'Your Business Now',
    quickFactIds: Object.freeze(['combined-soi-current', 'attributed-contacts-estimate']),
    purpose: 'The current production, business scope, and purpose mix supported by governed evidence.',
  }),
  Object.freeze({
    id: 'business-sources',
    title: 'Where Your Business Comes From',
    quickFactIds: Object.freeze(['top-of-mind-current', 'current-live-contacts']),
    purpose: 'Opportunity Source Network and Customer Relationship Network remain distinct, with source control and attribution preserved.',
  }),
  Object.freeze({
    id: 'business-pipeline',
    title: 'Your Business Pipeline',
    quickFactIds: Object.freeze(['current-active-pipeline']),
    purpose: 'Opportunity, application, qualification, approval, lock, and funded stages retain their stated definitions and cohort windows.',
  }),
  Object.freeze({
    id: 'systems-capacity',
    title: 'Your System & Capacity',
    missionIds: Object.freeze([
      'LO_CORE_08_RELATIONSHIP_SYSTEMS',
      'LO_CORE_09_TEAM_CAPACITY',
      'LO_CORE_10_PLATFORM_CAPABILITY',
      'LO_CORE_12_ACCOUNTABILITY_EXECUTION',
    ]),
    purpose: 'Relationship systems, operating systems, team ownership, platform capability, and sustainable capacity remain separately inspectable.',
  }),
  Object.freeze({
    id: 'business-constraint',
    title: 'What’s Holding You Back',
    missionIds: Object.freeze(['LO_CORE_11_OPERATOR_DIAGNOSIS']),
    purpose: 'The governing constraint is evidence-bound and may remain unresolved when opportunity sufficiency or causal evidence is incomplete.',
  }),
]);

const EPISTEMIC_TONES = Object.freeze({
  REPORTED: 'green',
  CALCULATED: 'teal',
  MODELED_REQUIREMENT: 'blue',
  BENCHMARK: 'blue',
  MODELED_RANGE: 'violet',
  INFERRED: 'violet',
  MIXED_EVIDENCE: 'amber',
  PARTIALLY_REPORTED: 'amber',
  INFERRED_WITH_MISSING_EVIDENCE: 'amber',
  MISSING: 'amber',
  CONTRADICTED: 'coral',
});

function invariant(condition, code) {
  if (condition) return;
  const error = new Error(code);
  error.code = code;
  throw error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function epistemicTone(epistemicClass) {
  return EPISTEMIC_TONES[epistemicClass] || 'amber';
}

function fieldEpistemicClass(field) {
  if (field.question_state !== 'ANSWERED' || field.evidence_class === 'MISSING') return 'MISSING';
  if (field.contradiction_links.length) return 'CONTRADICTED';
  // The richer field class is retained as provenance, but an answered intake
  // field remains a customer report at this public boundary. A customer-supplied
  // derivation, benchmark, model, or scenario must not become a MORE-authored
  // calculation merely because the field contract records that source class.
  return 'REPORTED';
}

function evidenceState(fields, { interpretive = false, forceMissing = false } = {}) {
  invariant(Array.isArray(fields) && fields.length > 0, 'loan_originator_surface_evidence_empty');
  if (forceMissing) {
    return {
      epistemicClass: 'MISSING',
      confidence: 'Not established by an accepted comparable measure or calculation.',
    };
  }
  const classes = fields.map(fieldEpistemicClass);
  if (classes.includes('CONTRADICTED')) {
    return {
      epistemicClass: 'CONTRADICTED',
      confidence: 'Accepted evidence contains an unresolved contradiction.',
    };
  }
  const answeredCount = fields.filter((field) => field.question_state === 'ANSWERED').length;
  if (answeredCount === 0) {
    return {
      epistemicClass: 'MISSING',
      confidence: 'The governed assessment does not establish this surface.',
    };
  }
  if (answeredCount < fields.length) {
    return interpretive
      ? {
        epistemicClass: 'INFERRED_WITH_MISSING_EVIDENCE',
        confidence: 'Evidence-bound interpretation; material supporting evidence remains missing.',
      }
      : {
        epistemicClass: 'PARTIALLY_REPORTED',
        confidence: 'Some supporting measures are customer-reported while others remain unestablished.',
      };
  }
  if (interpretive) {
    return {
      epistemicClass: 'INFERRED',
      confidence: 'Evidence-bound interpretation of the complete governed field set for this surface.',
    };
  }
  const establishedClasses = unique(classes);
  if (establishedClasses.length === 1) {
    const epistemicClass = establishedClasses[0];
    return {
      epistemicClass,
      confidence: epistemicClass === 'REPORTED'
        ? 'Customer-reported with the governed definition, subject scope, and observation window preserved.'
        : 'Classified by the governed field-level evidence contract.',
    };
  }
  return {
    epistemicClass: 'MIXED_EVIDENCE',
    confidence: 'The surface combines multiple governed evidence classes without collapsing their distinctions.',
  };
}

function fieldsForMissions(typedEvidence, missionIds) {
  const accepted = Object.values(typedEvidence.fields)
    .filter((field) => missionIds.includes(field.mission_id))
    .sort((left, right) => left.field_id.localeCompare(right.field_id));
  invariant(accepted.length > 0, 'loan_originator_surface_mission_evidence_missing');
  return accepted;
}

function quickFactEvidence(sourceViewModel, typedEvidence, quickFactId) {
  const expectedFieldIds = QUICK_FACT_FIELDS[quickFactId];
  invariant(expectedFieldIds, `loan_originator_surface_quick_fact_unsupported:${quickFactId}`);
  const matches = (sourceViewModel.quickFacts || []).filter((card) => card.id === quickFactId);
  invariant(matches.length === 1, `loan_originator_surface_quick_fact_invalid:${quickFactId}`);
  const card = matches[0];
  const inspector = sourceViewModel.inspectors?.[card.inspectorId];
  const binding = inspector?.source_binding;
  invariant(binding?.contract_id === 'lo-quick-fact-evidence-binding-v1', `loan_originator_surface_source_binding_missing:${quickFactId}`);
  invariant(binding.profile_id === sourceViewModel.internal?.profile_id
    && binding.assessment_id === sourceViewModel.internal?.assessment_id
    && binding.business_evidence_sha256 === sourceViewModel.internal?.business_evidence_sha256,
  `loan_originator_surface_source_custody_mismatch:${quickFactId}`);
  invariant(Array.isArray(binding.fields)
    && binding.fields.length === expectedFieldIds.length
    && binding.fields.every((entry, index) => entry.field_id === expectedFieldIds[index]),
  `loan_originator_surface_field_binding_mismatch:${quickFactId}`);
  const fields = binding.fields.map((entry) => {
    const field = typedEvidence.fields[entry.field_id];
    invariant(field
      && entry.question_state === field.question_state
      && entry.definition_id === field.definition_id
      && entry.field_sha256 === sha256Stable(field),
    `loan_originator_surface_field_custody_mismatch:${entry.field_id}`);
    return field;
  });
  const forceMissing = binding.result_state === 'NOT_ESTABLISHED' || binding.result_state === 'MISSING';
  invariant(forceMissing || ['CUSTOMER_REPORTED', 'CUSTOMER_REPORTED_GOAL'].includes(binding.result_state),
    `loan_originator_surface_result_state_invalid:${quickFactId}`);
  return {
    card,
    inspectorId: card.inspectorId,
    fieldIds: expectedFieldIds,
    state: evidenceState(fields, { forceMissing }),
  };
}

function mergeEvidenceStates(entries) {
  invariant(entries.length > 0, 'loan_originator_surface_evidence_state_missing');
  const classes = unique(entries.map((entry) => entry.state.epistemicClass));
  if (classes.includes('CONTRADICTED')) {
    return { epistemicClass: 'CONTRADICTED', confidence: 'Accepted evidence contains an unresolved contradiction.' };
  }
  if (classes.length === 1) return entries[0].state;
  if (classes.includes('MISSING') || classes.includes('PARTIALLY_REPORTED')) {
    return {
      epistemicClass: 'PARTIALLY_REPORTED',
      confidence: 'Some supporting measures are customer-reported while others remain unestablished.',
    };
  }
  return {
    epistemicClass: 'MIXED_EVIDENCE',
    confidence: 'The surface combines multiple governed evidence classes without collapsing their distinctions.',
  };
}

function customerSafeText(value) {
  return String(value)
    .replace(/\b[a-f0-9]{64}\b/giu, 'governed record')
    .replace(/\bsource(?:[_ ]?paths?|[_ ]?refs?|[_ ]?future[_ ]?ids?)\b/giu, 'governed source')
    .replace(/\bevidence[_ ]?refs?\b/giu, 'supporting evidence')
    .replace(/\blineage[_ ]?refs?\b/giu, 'supporting history')
    .replace(/\bvertical[_ ]?authority[_ ]?refs?\b/giu, 'industry authority')
    .replace(/\binspector[_ ]?ids?\b/giu, 'evidence view')
    .replace(/\bprofile[_ ]?ids?\b/giu, 'customer record')
    .replace(/\bassessment[_ ]?ids?\b/giu, 'assessment record')
    .replace(/\bchain[^\p{L}\p{N}]of[^\p{L}\p{N}]thought\b/giu, 'supporting rationale');
}

function describeCard(card) {
  return `${customerSafeText(card.label)}: ${customerSafeText(card.value)}. ${customerSafeText(card.qualifier)}.`;
}

function evidenceSummary(epistemicClass) {
  if (epistemicClass === 'MISSING') return 'The saved assessment preserves this result as not established; no value is imputed.';
  if (epistemicClass === 'PARTIALLY_REPORTED') return 'The saved assessment establishes part of this surface and preserves the remaining measurement gap.';
  if (epistemicClass === 'INFERRED_WITH_MISSING_EVIDENCE') return 'The interpretation is supported by accepted evidence, with material missingness kept visible.';
  if (epistemicClass === 'INFERRED') return 'This is an evidence-bound business interpretation, not a directly observed fact.';
  if (epistemicClass === 'CONTRADICTED') return 'The accepted evidence does not currently reconcile; the contradiction remains visible.';
  return 'The evidence class, definition, subject scope, and observation window remain governed by the saved assessment.';
}

function buildSurfaceObject({ objectId, title, description, epistemicClass, confidence }) {
  const tone = epistemicTone(epistemicClass);
  const display = { title, text: description, value: description, tone };
  return deepFreeze({
    object_id: objectId,
    destination: 'where',
    surface: 'loan_originator_box_1_surface',
    display_payload: display,
    epistemic_class: epistemicClass,
    confidence,
    clickable: true,
    drawer_type: 'evidence',
    drawer_payload: [
      { id: 'what-this-is', title: 'What This Is', items: [description] },
      { id: 'source-evidence', title: 'Source / Evidence', items: [evidenceSummary(epistemicClass)] },
      { id: 'confidence', title: 'Confidence', items: [confidence] },
      { id: 'mind-change', title: 'What Would Change It', items: ['Corrected or corroborating evidence with the same definition, period, and subject scope.'] },
    ],
    return_state_id: `where:layer1:${objectId}`,
  });
}

function systemsInterpretation(sourceViewModel, typedEvidence, fields) {
  const domains = sourceViewModel.loanOriginator?.domainInterpretations;
  invariant(domains && Object.keys(domains).sort().join(',') === 'capacity,operations',
    'loan_originator_domain_interpretations_required');
  const missions = {
    operations: ['LO_CORE_08_RELATIONSHIP_SYSTEMS', 'LO_CORE_10_PLATFORM_CAPABILITY'],
    capacity: ['LO_CORE_09_TEAM_CAPACITY', 'LO_CORE_12_ACCOUNTABILITY_EXECUTION'],
  };
  const entries = Object.entries(missions).map(([domain, missionIds]) => {
    const binding = domains[domain];
    const inspector = sourceViewModel.inspectors?.[binding?.inspector_id];
    const { source_binding: ignoredBinding, ...inspectorContent } = inspector || {};
    void ignoredBinding;
    const expectedFields = fieldsForMissions(typedEvidence, missionIds).map(field => ({
      field_id: field.field_id, field_sha256: sha256Stable(field), question_state: field.question_state,
      source_ref: `business_assessment.inputs.typed_evidence.fields.${field.field_id}`,
      value: field.value, definition_id: field.definition_id, period_or_not_temporal: field.period_or_not_temporal,
      subject_scope: field.subject_scope, provenance: field.provenance,
    }));
    invariant(binding?.contract_id === 'lo-domain-interpretation-binding-v1'
      && binding.domain_id === domain
      && binding.profile_id === sourceViewModel.internal?.profile_id
      && binding.assessment_id === sourceViewModel.internal?.assessment_id
      && binding.business_evidence_sha256 === sourceViewModel.internal?.business_evidence_sha256
      && /^[a-f0-9]{64}$/u.test(binding.whole_business_model_sha256 || '')
      && binding.whole_business_model_sha256 === sourceViewModel.internal?.whole_business_model_sha256
      && Array.isArray(binding.fields) && sha256Stable(binding.fields) === sha256Stable(expectedFields)
      && sha256Stable(inspectorContent) === binding.inspector_content_sha256
      && inspector?.source_binding && sha256Stable(inspector.source_binding) === sha256Stable(binding),
    `loan_originator_domain_interpretation_custody_invalid:${domain}`);
    if (binding.state === 'ACCEPTED_CLAIM') {
      invariant(binding.claim?.claim_id && binding.claim.meaning?.trim()
        && binding.claim.evidence_refs?.length
        && !['INSUFFICIENT_EVIDENCE', 'ABSTAINED'].includes(binding.claim.epistemic_class)
        && binding.claim_sha256 === sha256Stable(binding.claim)
        && inspector.level1?.meaning === binding.claim.meaning,
      `loan_originator_domain_interpretation_claim_invalid:${domain}`);
      assertLoanOriginatorPrivacyBoundary({ interpretation: binding.claim.meaning }, {
        path: `loan_originator_domain_interpretation.${domain}`,
        detectUnlabeledNames: true,
      });
    } else {
      invariant(binding.state === 'NOT_ESTABLISHED' && binding.claim === null && binding.claim_sha256 === null,
        `loan_originator_domain_interpretation_absence_invalid:${domain}`);
    }
    return binding;
  });
  const accepted = entries.filter(entry => entry.state === 'ACCEPTED_CLAIM');
  const missing = entries.filter(entry => entry.state === 'NOT_ESTABLISHED');
  const typedState = evidenceState(fields);
  const interpretedState = evidenceState(fields, { interpretive: true });
  const state = accepted.length === 0
    ? {
      ...typedState,
      confidence: `${typedState.confidence} No accepted operations or capacity interpretation is available.`,
    }
    : accepted.some(entry => entry.claim.epistemic_class === 'CONFLICTED') || typedState.epistemicClass === 'CONTRADICTED'
      ? { epistemicClass: 'CONTRADICTED', confidence: 'An accepted interpretation or supporting evidence remains conflicted.' }
      : missing.length || interpretedState.epistemicClass !== 'INFERRED'
        ? { epistemicClass: 'INFERRED_WITH_MISSING_EVIDENCE', confidence: 'An accepted interpretation is available; missing interpretations and business evidence remain explicit.' }
        : interpretedState;
  const interpretation = entries.map(entry => entry.state === 'ACCEPTED_CLAIM'
    ? `${entry.domain_id === 'operations' ? 'Operations' : 'Capacity'}: ${customerSafeText(entry.claim.meaning)}`
    : `${entry.domain_id === 'operations' ? 'Operations' : 'Capacity'} interpretation is not established.`).join(' ');
  const fieldSummary = fields.map(field => {
    const label = field.field_id.replaceAll('_', ' ');
    const period = field.period_or_not_temporal;
    const window = period && typeof period === 'object'
      ? [period.unit, period.start && period.end ? `${period.start} to ${period.end}` : null, period.as_of ? `as of ${period.as_of}` : null].filter(Boolean).join(' · ') || 'observation window not established'
      : typeof period === 'string' ? period.replaceAll('_', ' ').toLowerCase() : 'observation window not established';
    return field.question_state === 'ANSWERED'
      ? `${label}: ${customerSafeText(typeof field.value === 'string' ? field.value : JSON.stringify(field.value))} (customer reported; ${customerSafeText(window)}).`
      : `${label}: ${field.question_state === 'NOT_APPLICABLE' ? 'customer marked not applicable' : 'not supplied'}.`;
  });
  return {
    ...state,
    interpretation,
    fieldSummary,
    bindings: entries,
    sourceAuthority: accepted[0]?.inspector_id || entries[0].inspector_id,
    lineageRefs: entries.map(entry => entry.inspector_id),
  };
}

function buildLockedSurfaceProjection(sourceViewModel) {
  invariant(sourceViewModel?.verticalBinding?.vertical_id === 'loan_originator', 'loan_originator_projection_vertical_binding_invalid');
  const typedEvidence = validateLoanOriginatorTypedEvidence(sourceViewModel?.loanOriginator?.typedEvidence);
  return LOCKED_SURFACES.map((surface, index) => {
    const objectId = `where-reality-${index + 1}`;
    if (surface.quickFactIds) {
      const evidence = surface.quickFactIds.map((quickFactId) => quickFactEvidence(sourceViewModel, typedEvidence, quickFactId));
      const state = mergeEvidenceStates(evidence);
      const description = `${evidence.map(({ card }) => describeCard(card)).join(' ')} ${surface.purpose}`;
      const sourceAuthority = evidence[0].inspectorId;
      const lineageRefs = unique(evidence.map((entry) => entry.inspectorId));
      const evidenceFieldIds = unique(evidence.flatMap((entry) => entry.fieldIds));
      return deepFreeze({
        id: surface.id,
        title: surface.title,
        text: description,
        tone: epistemicTone(state.epistemicClass),
        epistemicClass: state.epistemicClass,
        confidence: state.confidence,
        objectId,
        sourceAuthority,
        lineageRefs,
        evidenceFieldIds,
        object: buildSurfaceObject({ objectId, title: surface.title, description, ...state }),
      });
    }

    const fields = fieldsForMissions(typedEvidence, surface.missionIds);
    const systems = surface.id === 'systems-capacity';
    const domainInterpretation = systems ? systemsInterpretation(sourceViewModel, typedEvidence, fields) : null;
    const state = domainInterpretation || evidenceState(fields, { interpretive: true });
    const lineageRefs = systems
      ? domainInterpretation.lineageRefs
      : unique([sourceViewModel.why?.inspectorId, ...(sourceViewModel.why?.mechanisms || []).map((mechanism) => mechanism.inspectorId)]);
    const sourceAuthority = systems ? domainInterpretation.sourceAuthority : lineageRefs[0];
    invariant(sourceAuthority && sourceViewModel.inspectors?.[sourceAuthority], `loan_originator_surface_interpretation_lineage_missing:${surface.id}`);
    const interpretation = systems
      ? domainInterpretation.interpretation
      : sourceViewModel.why?.summary;
    const fallback = systems
      ? 'Operating-system effectiveness and sustainable capacity are not established.'
      : 'The primary constraint remains unresolved.';
    const description = `${customerSafeText(interpretation || fallback)} ${surface.purpose}`;
    const object = buildSurfaceObject({ objectId, title: surface.title, description, ...state });
    return deepFreeze({
      id: surface.id,
      title: surface.title,
      text: description,
      tone: epistemicTone(state.epistemicClass),
      epistemicClass: state.epistemicClass,
      confidence: state.confidence,
      objectId,
      sourceAuthority,
      lineageRefs,
      evidenceFieldIds: fields.map((field) => field.field_id),
      ...(systems ? { interpretationBindings: domainInterpretation.bindings } : {}),
      object: systems ? { ...object, drawer_payload: [...object.drawer_payload, {
        id: 'reported-facts-and-missingness', title: 'Reported Facts and Missing Evidence', items: domainInterpretation.fieldSummary,
      }] } : object,
    });
  });
}

function applyCustomerSurfaces(customerViewModel, surfaces) {
  invariant(customerViewModel?.destinations?.where && customerViewModel?.layer0?.cards && customerViewModel?.objects,
    'loan_originator_box_1_customer_view_model_invalid');
  const objects = Object.fromEntries(surfaces.map((surface) => [surface.objectId, surface.object]));
  return deepFreeze({
    ...customerViewModel,
    destinations: {
      ...customerViewModel.destinations,
      where: {
        ...customerViewModel.destinations.where,
        realities: surfaces.map((surface) => ({
          id: surface.id,
          title: surface.title,
          text: surface.text,
          tone: surface.tone,
          epistemicClass: surface.epistemicClass,
          confidence: surface.confidence,
          objectId: surface.objectId,
        })),
      },
    },
    objects: { ...customerViewModel.objects, ...objects },
  });
}

function applyInternalTraceSurfaces(internalTrace, surfaces) {
  invariant(internalTrace?.objects && Array.isArray(internalTrace.projection_trace), 'loan_originator_box_1_internal_trace_invalid');
  const surfaceIds = new Set(surfaces.map((surface) => surface.objectId));
  const objects = Object.fromEntries(surfaces.map((surface) => [surface.objectId, {
    ...surface.object,
    source_authority: surface.sourceAuthority,
    lineage_refs: surface.lineageRefs,
    evidence_field_ids: surface.evidenceFieldIds,
    ...(surface.interpretationBindings ? { interpretation_bindings: surface.interpretationBindings } : {}),
  }]));
  const projectionTrace = surfaces.map((surface) => ({
    statement_id: surface.objectId,
    destination: 'where',
    display: `${surface.title} · ${surface.text}`,
    source_authority: surface.sourceAuthority,
    epistemic_class: surface.epistemicClass,
  }));
  return {
    ...internalTrace,
    objects: { ...internalTrace.objects, ...objects },
    projection_trace: [
      ...internalTrace.projection_trace.filter((entry) => !surfaceIds.has(entry.statement_id)),
      ...projectionTrace,
    ],
  };
}

function validateProjectionTraceParity(projection) {
  const customerObjects = projection.customerViewModel.objects;
  const internalObjects = projection.internalTrace.objects;
  const customerIds = Object.keys(customerObjects).sort();
  const internalIds = Object.keys(internalObjects).sort();
  invariant(JSON.stringify(customerIds) === JSON.stringify(internalIds), 'loan_originator_projection_object_trace_set_mismatch');
  customerIds.forEach((objectId) => {
    const customer = customerObjects[objectId];
    const internal = internalObjects[objectId];
    invariant(customer.object_id === objectId
      && internal.object_id === objectId
      && customer.destination === internal.destination
      && customer.surface === internal.surface
      && customer.return_state_id === internal.return_state_id
      && internal.source_authority
      && Array.isArray(internal.lineage_refs),
    `loan_originator_projection_object_trace_mismatch:${objectId}`);
  });
  const statementIds = projection.internalTrace.projection_trace.map((entry) => entry.statement_id);
  invariant(statementIds.length === new Set(statementIds).size
    && JSON.stringify([...statementIds].sort()) === JSON.stringify(internalIds),
  'loan_originator_projection_statement_trace_mismatch');
  return true;
}

function projectionPrivacyCorpus(sourceViewModel) {
  const identity = sourceViewModel?.identity;
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)
    || !Object.hasOwn(identity, 'firstName')) return sourceViewModel;
  const { firstName, ...remainingIdentity } = identity;
  return {
    ...sourceViewModel,
    identity: {
      ...remainingIdentity,
      authorized_profile_display_identity: firstName,
    },
  };
}

function createSealedPrivacyClassificationReceipt(sourceViewModel) {
  const typedEvidence = validateLoanOriginatorTypedEvidence(sourceViewModel?.loanOriginator?.typedEvidence);
  const inspectedCorpus = projectionPrivacyCorpus(sourceViewModel);
  const classification = assertLoanOriginatorPrivacyBoundary(inspectedCorpus, {
    path: 'projection_source_corpus',
    // The governed typed evidence validator above remains strict for unlabeled
    // names. The complete projection source also contains the business owner's
    // authorized display identity, whose value remains in this normalized corpus.
    detectUnlabeledNames: false,
  });
  invariant(classification.status === 'PASS'
    && classification.borrower_pii_used === false
    && classification.regulated_loan_level_identity_used === false,
  'loan_originator_projection_privacy_classification_required');
  const receipt = {
    ...classification,
    classification_scope: 'COMPLETE_OUTWARD_LO_PROJECTION_SOURCE',
    authorized_profile_identity_source_path: 'source_view_model.identity.firstName',
    governed_evidence_sha256: sha256Stable(typedEvidence),
    inspected_corpus_sha256: sha256Stable(inspectedCorpus),
    projection_source_sha256: sha256Stable(sourceViewModel),
  };
  return deepFreeze({ ...receipt, receipt_sha256: sha256Stable(receipt) });
}

export function projectLoanOriginatorBox1OntoCustomerViewModel({ customerViewModel, sourceViewModel } = {}) {
  createSealedPrivacyClassificationReceipt(sourceViewModel);
  return applyCustomerSurfaces(customerViewModel, buildLockedSurfaceProjection(sourceViewModel));
}

export function createLoanOriginatorProjectionV1({ sourceViewModel, bindings }) {
  const privacyClassificationReceipt = createSealedPrivacyClassificationReceipt(sourceViewModel);
  const surfaces = buildLockedSurfaceProjection(sourceViewModel);
  const base = createRealProfileProjectionV2({ sourceViewModel, bindings });
  const customerViewModel = applyCustomerSurfaces(base.customerViewModel, surfaces);
  const traced = applyInternalTraceSurfaces(base.internalTrace, surfaces);
  const projection = {
    ...base,
    contract_id: 'loan-originator-box-1-projection-v1',
    version: '1.0.0',
    customerViewModel,
    internalTrace: {
      ...traced,
      loan_originator_box_1: {
        status: 'PASS',
        exact_surface_missions: LOCKED_SURFACES.map(({ title }) => title),
        surface_epistemic_classes: Object.fromEntries(surfaces.map((surface) => [surface.id, surface.epistemicClass])),
        typed_evidence_field_count: sourceViewModel.loanOriginator.typedEvidence.field_count,
        borrower_pii_used: privacyClassificationReceipt.borrower_pii_used,
        regulated_loan_level_identity_used: privacyClassificationReceipt.regulated_loan_level_identity_used,
        privacy_classification_receipt: privacyClassificationReceipt,
        universal_downstream_replaced: false,
      },
    },
    validation: {
      ...base.validation,
      loan_originator_box_1: 'PASS',
      exact_surface_count: 5,
      no_real_estate_fallback: true,
      universal_downstream_preserved: true,
      final_progressive_projection_revalidated: true,
      customer_internal_trace_parity: true,
    },
  };
  validateProgressiveBusinessTwin(projection);
  validateProjectionTraceParity(projection);
  return deepFreeze(projection);
}

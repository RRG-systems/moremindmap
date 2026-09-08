import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import { createCoachingMutationCandidate } from '../subscriptionV1/afw04/contracts.js';
import {
  createGovernedChangeProposal,
  createConfirmedPersonalRslMutation,
  createLinkedCausalReviewEvent,
  createRelationshipEpisodeEvent,
  derivePrivateLongitudinalScorecard,
  retrieveRelevantPersonalHistory,
} from '../subscriptionV1/index.js';
import {
  createCoachingEpisodeContext,
  validateCoachingEpisodeTransition,
} from '../subscriptionV1/freeGptV2/sessionEpisode.js';
import { validateGovernedChangeProposal } from '../subscriptionV1/afw05/contracts.js';
import {
  buildAthleteConsultSurfaceProjectionV1,
  compileAthleteSharedContextV1,
  createAthleteSharedContextGrantV1,
  createAthleteSharedHumanConfirmationV1,
  createAthleteSharedQuorumDecisionV1,
  revokeAthleteSharedContextGrantV1,
  validateAthleteSharedContextGrantV1,
  validateAthleteSharedHumanConfirmationV1,
  validateAthleteSharedQuorumReceiptV1,
} from './sharedContextAuthorityAdapter.js';
import {
  createAthletePublicationAdapterV1,
  validateAthleteLivingMapPublicationV1,
  validateAthleteDomainAdapterV1,
} from './athleteDomainAdapter.js';
import { generateAthleteS2GuV1 } from './athleteGu.js';
import { InMemoryLivingRelationshipStore } from '../subscriptionV1/afw05/store.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const RUNTIME_SNAPSHOT_CONTRACT = 'athlete_living_consult_runtime_snapshot_v1';
const MAX_RUNTIME_IDEMPOTENCY_RECEIPTS = 32;
const MAX_RUNTIME_SNAPSHOT_BYTES = 4 * 1024 * 1024;
const MAX_CONVERSATION_ENTRIES = 240;
const MAX_CONVERSATION_CONTENT_BYTES = 48 * 1024;
const PAGE_CONTEXT_ROOMS = new Set(['HOME', 'YOU', 'YOUR_SPORT', 'PLAN']);
const utf8Bytes = (value) => new TextEncoder().encode(String(value)).byteLength;

function validConversationContent(value) {
  return typeof value === 'string' && Boolean(value.trim())
    && utf8Bytes(value) <= MAX_CONVERSATION_CONTENT_BYTES
    && utf8Bytes(JSON.stringify(value.trim())) <= MAX_CONVERSATION_CONTENT_BYTES;
}

function normalizePageContext(value) {
  if (!value || typeof value !== 'object' || !PAGE_CONTEXT_ROOMS.has(value.room)) return null;
  const hasSnake = Object.hasOwn(value, 'visible_object_ids');
  const hasCamel = Object.hasOwn(value, 'visibleObjectIds');
  if (hasSnake && hasCamel) return null;
  const ids = hasSnake ? value.visible_object_ids : hasCamel ? value.visibleObjectIds : [];
  if (!Array.isArray(ids) || ids.length > 100 || new Set(ids).size !== ids.length
    || ids.some((entry) => typeof entry !== 'string' || !entry.trim() || utf8Bytes(entry) > 200)) return null;
  return { room: value.room, visible_object_ids: [...ids].sort() };
}

function validRestoredGovernance(snapshot, { adapter, relationship }) {
  const validProposal = (proposal) => {
    if (proposal == null) return true;
    const validation = validateGovernedChangeProposal(proposal);
    return validation.valid
      && proposal.scope_hash === adapter.rsl_scope_hash
      && proposal.target_contract === 'athlete_living_map_v1';
  };
  if (!validProposal(snapshot.pending_proposal) || !validProposal(snapshot.last_proposal)) return false;
  if (snapshot.pending_proposal) {
    const binding = snapshot.pending_authority_binding;
    if (!binding || binding.grant_hash !== snapshot.current_grant.grant_hash
      || binding.permission_version !== snapshot.current_grant.permission_version
      || !/^[a-f0-9]{64}$/u.test(binding.authority_receipt_hash || '')
      || !snapshot.pending_proposal.authority_ref_ids?.includes(binding.authority_receipt_hash)) return false;
  } else if (snapshot.pending_authority_binding != null) {
    return false;
  }
  const confirmationProposal = snapshot.pending_proposal || snapshot.last_proposal;
  if (snapshot.confirmations.length) {
    if (!confirmationProposal
      || new Set(snapshot.confirmations.map((entry) => entry?.actor?.actor_role)).size !== snapshot.confirmations.length
      || snapshot.confirmations.some((confirmation) => !validateAthleteSharedHumanConfirmationV1(confirmation, {
        adapter,
        grant: snapshot.current_grant,
        relationship,
        proposal: confirmationProposal,
      }).valid)) return false;
  }
  if (snapshot.pending_proposal && snapshot.confirmations.length > 1) return false;
  if (!snapshot.last_proposal && snapshot.last_proposal_status != null) return false;
  return snapshot.last_proposal_status == null
    || ['STALE_AUTHORITY', 'REJECTED', 'NO_MATERIAL_CHANGE', 'COMMITTED'].includes(snapshot.last_proposal_status);
}

function hydrateRuntimeSnapshot(snapshot, { adapter, relationship }) {
  if (snapshot == null) return null;
  if (!snapshot || typeof snapshot !== 'object'
    || snapshot.contract_id !== RUNTIME_SNAPSHOT_CONTRACT
    || snapshot.schema_version !== '1.0.0'
    || snapshot.adapter_hash !== adapter.adapter_hash
    || snapshot.relationship_hash !== hashCanonicalJson(relationship)
    || snapshot.relationship_scope_hash !== adapter.rsl_scope_hash
    || !snapshot.current_grant || typeof snapshot.current_grant !== 'object'
    || !Array.isArray(snapshot.conversation) || snapshot.conversation.length > MAX_CONVERSATION_ENTRIES
    || !Array.isArray(snapshot.confirmations) || snapshot.confirmations.length > 8
    || !Array.isArray(snapshot.idempotency) || snapshot.idempotency.length > MAX_RUNTIME_IDEMPOTENCY_RECEIPTS
    || !Number.isInteger(snapshot.permission_version) || snapshot.permission_version < 1
    || !Number.isInteger(snapshot.session_ordinal) || snapshot.session_ordinal < 0
    || !Number.isInteger(snapshot.revision) || snapshot.revision < 0
    || !snapshot.living_store_snapshot || typeof snapshot.living_store_snapshot !== 'object') {
    throw new TypeError('ATHLETE_LIVING_CONSULT_RUNTIME_SNAPSHOT_INVALID');
  }
  const unsigned = clone(snapshot);
  delete unsigned.snapshot_hash;
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > MAX_RUNTIME_SNAPSHOT_BYTES) {
    throw new TypeError('ATHLETE_LIVING_CONSULT_RUNTIME_SNAPSHOT_TOO_LARGE');
  }
  const allowedPhases = new Set(['IDLE', 'STARTED', 'ACTIVE', 'ENDING', 'SESSION_LEARNING_NOTES_READY']);
  if (!allowedPhases.has(snapshot.phase)
    || !/^[a-f0-9]{64}$/u.test(snapshot.runtime_state_hash || '')
    || snapshot.snapshot_hash !== hashCanonicalJson(unsigned)
    || typeof snapshot.first_session_established !== 'boolean'
    || !normalizePageContext(snapshot.page_context)
    || snapshot.conversation.some((entry) => !entry || typeof entry !== 'object'
      || !validConversationContent(entry.content)
      || new TextEncoder().encode(JSON.stringify(entry)).byteLength > 64 * 1024)
    || (snapshot.phase === 'IDLE' ? snapshot.session_id !== null : typeof snapshot.session_id !== 'string')
    || !validateAthleteSharedContextGrantV1(snapshot.current_grant, {
      scope: adapter.domain_scope,
      relationship,
    }).valid
    || !validRestoredGovernance(snapshot, { adapter, relationship })
    || (snapshot.pending_proposal != null && typeof snapshot.pending_proposal !== 'object')
    || (snapshot.pending_authority_binding != null && typeof snapshot.pending_authority_binding !== 'object')
    || snapshot.confirmations.some((entry) => !entry || typeof entry !== 'object')
    || snapshot.idempotency.some((entry) => !entry || !/^[a-f0-9]{64}$/u.test(entry.idempotency_key_hash || '')
      || !/^[a-f0-9]{64}$/u.test(entry.semantic_hash || '') || !/^[a-f0-9]{64}$/u.test(entry.response_hash || '')
      || typeof entry.action !== 'string' || typeof entry.result_code !== 'string'
      || !Number.isInteger(entry.result_revision) || entry.result_revision < 0
      || !/^[a-f0-9]{64}$/u.test(entry.result_state_hash || '') || typeof entry.mutation_performed !== 'boolean')) {
    throw new TypeError('ATHLETE_LIVING_CONSULT_RUNTIME_SNAPSHOT_INVALID');
  }
  return clone(snapshot);
}

function evidenceCertainty(entry) {
  const status = String(entry?.epistemic_status || '').toUpperCase();
  if (status === 'MISSING') return 'MISSING';
  if (status === 'CONTRADICTED') return 'CONTRADICTED';
  if (['MEASURED', 'OBSERVED'].includes(status)) return 'OBSERVED';
  if (['BOUNDED_INFERENCE', 'INFERRED', 'MODELED'].includes(status)) return 'INFERRED';
  return 'UNCERTAIN';
}

function personalRslEvidenceCatalog(sharedObjectCatalog) {
  const byId = new Map();
  for (const entry of sharedObjectCatalog || []) {
    const evidenceDomain = entry?.source_binding?.source_kind === 'ATHLETE_BOS' ? 'ATHLETE_BOS' : 'ATHLETE_APA';
    for (const evidenceId of entry?.evidence_refs || []) {
      if (byId.has(evidenceId)) continue;
      byId.set(evidenceId, {
        evidence_id: evidenceId,
        evidence_domain: evidenceDomain,
        content_hash: hashCanonicalJson({
          evidence_id: evidenceId,
          object_id: entry.object_id,
          source_binding: entry.source_binding,
          source_class: entry.source_class,
          epistemic_status: entry.epistemic_status,
          presentation: entry.presentation,
        }),
        certainty: evidenceCertainty(entry),
      });
    }
  }
  return [...byId.values()];
}
const ROOMS = PAGE_CONTEXT_ROOMS;
const DECISIONS = new Set(['CONFIRM', 'EDIT', 'REJECT']);
const EXPLICIT_CORRECTION = /\b(?:that(?:'s| is) not|not quite|i disagree|you misunderstood|i meant|actually,|no, that)\b/iu;

function fail(code, extra = {}) {
  return deepFreeze({ ok: false, code, ...extra });
}

function iso(value) {
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) throw new TypeError('ATHLETE_LIVING_CONSULT_TIMESTAMP_INVALID');
  return time.toISOString();
}

function ensureNoIdentityShortcut(value) {
  const seen = new WeakSet();
  function inspect(node) {
    if (!node || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    for (const [key, nested] of Object.entries(node)) {
      if (key.includes('business_id')) throw new TypeError('ATHLETE_IDENTITY_SHORTCUT_DENIED');
      inspect(nested);
    }
  }
  inspect(value);
  return value;
}

function proposalProjection(proposal, confirmations = [], terminalStatus = null) {
  if (!proposal) return null;
  return {
    ...clone(proposal),
    confirmations: confirmations.map((entry) => ({
      actor: entry.actor.actor_role,
      role: entry.actor.actor_role,
      confirmation_id: entry.confirmation_id,
      confirmation_hash: entry.confirmation_hash,
    })),
    athlete_confirmed: confirmations.some((entry) => entry.actor.actor_role === 'ATHLETE'),
    instructor_confirmed: confirmations.some((entry) => entry.actor.actor_role === 'INSTRUCTOR'),
    status: terminalStatus || proposal.status,
    committed: terminalStatus === 'COMMITTED',
  };
}

function activeEvents(store, scope, asOfAt) {
  const rslStore = store.buildPersonalRslStore({ scope });
  const replay = rslStore.replay({ scope, effective_as_of: asOfAt, recorded_as_of: asOfAt });
  if (!replay.ok) throw new Error(replay.code);
  return { rslStore, replay, events: replay.state.active_events };
}

function relationshipHistoryProjection(events) {
  return events.map((event) => ({
    event_type: event.event_type,
    happened_at: event.effective_at || event.occurred_at,
    summary: event.semantic_payload?.summary || event.summary || null,
    items: clone(event.semantic_payload?.items || []),
    lineage: clone(event.semantic_payload?.lineage || null),
    source_class: event.source_class || 'RELATIONSHIP_EPISODE_PROVENANCE',
    supersedes_episode_event_id: event.supersedes_episode_event_id || null,
  }));
}

function athleteEpisodeContext({ phase, preferredName, sessionKind }) {
  const base = createCoachingEpisodeContext({
    phase,
    preferred_conversational_name: preferredName,
    preferred_name_authority: 'GOVERNED_SYNTHETIC_ATHLETE_RELATIONSHIP',
    session_kind: sessionKind,
  });
  return {
    ...clone(base),
    start_orientation: [
      'Athlete direction and desired future',
      'Current governed Athlete map',
      'Prior durable shared meaning',
      'Current shared plan and open loops',
      'Relevant Personal RSL attempts and outcomes',
      'Visible authored surface',
      'Current human message',
    ],
    domain: 'ATHLETE',
    athlete_and_instructor_make_shared_decisions: true,
  };
}

function providerUnderstanding({ compiled, publication, history, episodeHistory, scorecard, conversation, pageContext, phase, preferredName, sessionKind }) {
  const shared = compiled?.ok ? compiled.shared_objects : [];
  return ensureNoIdentityShortcut({
    whole_athlete_current_reality: clone(publication.state),
    authorized_shared_context: clone(shared),
    relevant_relationship_history: relationshipHistoryProjection(history),
    relationship_episode_history: relationshipHistoryProjection(episodeHistory).slice(-30),
    longitudinal_relationship: clone(scorecard),
    coaching_session: athleteEpisodeContext({ phase, preferredName, sessionKind }),
    current_conversation: clone(conversation.slice(-24)),
    visible_customer_context: clone(pageContext),
    reasoning_priority: [
      'Current athlete-confirmed and jointly confirmed reality.',
      'Relevant exact-relationship history, attempts, and observed outcomes.',
      'Purpose-relevant coaching principles already authorized for this relationship.',
      'Current outside evidence only when a human question makes it useful.',
    ],
    context_selection: {
      authority_and_privacy_filtered_first: true,
      purpose_and_visible_page_ranked_second: true,
      page_context_changes_relevance_not_authority: true,
      full_authorized_context_remains_available_server_side: true,
    },
    truth_boundaries: {
      source_separation: 'Keep athlete report, instructor observation, qualified record, inference, contradiction, and missingness distinct.',
      private_context: 'Do not expose a private object or even imply that an unshared private object exists.',
      shared_change: 'Model speech is never agreement. A shared change requires explicit athlete and instructor approval of the same state-bound proposal.',
      uncertainty: 'Do not invent facts, performance causes, development outcomes, selection meaning, diagnosis, or prediction.',
      transcript: 'Conversation is ephemeral context, not canonical truth.',
    },
    architecture_boundaries: {
      one_relationship: true,
      one_personal_rsl: true,
      universal_rsl_reads: false,
      universal_promotion: false,
      autonomous_scientific_closed_loop: false,
      synthetic_18_20_only: true,
      semantic_cassette_injected: false,
    },
  });
}

function defaultSessionLearning({ conversation, preferredName, alignmentMessage = null }) {
  const lastHuman = [...conversation].reverse().find((entry) => ['ATHLETE', 'INSTRUCTOR', 'PARTICIPANT'].includes(entry.actor_role));
  const aligned = typeof alignmentMessage === 'string' && alignmentMessage.trim() ? alignmentMessage.trim() : null;
  return {
    contract: 'ATHLETE_LIVING_CONSULT_SESSION_LEARNING_V1',
    status: 'NOTES_READY',
    summary: aligned
      ? `At mutual close, the two humans said: ${aligned}`
      : (lastHuman ? `The session paused after ${lastHuman.actor_role === 'ATHLETE' ? preferredName : lastHuman.actor_role === 'INSTRUCTOR' ? 'the instructor' : 'the two humans'} named what matters now.` : 'The session ended without a new shared conclusion.'),
    what_mattered: aligned || lastHuman?.content || 'No new shared meaning was established.',
    what_changed: 'Only explicitly authorized Athlete-map changes count as changed reality.',
    what_was_learned: 'The conversation remains useful context but is not customer truth by itself.',
    what_was_decided: aligned
      ? `At the noncanonical mutual close, the humans aligned on: ${aligned}`
      : 'See the shared Plan and exact Personal RSL lineage for any jointly approved decision.',
    what_remains_open: 'Any unresolved shared plan remains available next time.',
    pick_up_next_time: 'Return to the current shared plan, attempts, outcomes, and open questions.',
    canonical_mutation_performed: false,
    personal_rsl_mutation_performed: false,
    structural_fixture_fallback: true,
  };
}

export async function createAthleteLivingConsultOneShotRuntimeV1({
  adapter,
  relationship,
  initial_publication,
  source_artifact_bindings,
  shared_object_catalog,
  bos_presentation_artifact,
  bos_authority_object_id,
  apa_customer_view_model,
  apa_source_binding,
  coach_seam = null,
  candidate_extractor = null,
  close_seam = null,
  gu_generator = null,
  preferred_name = 'Mika',
  instructor_name = 'Coach Ellis',
  plan_fixture = null,
  clock = () => new Date().toISOString(),
  store = null,
  runtime_snapshot = null,
}) {
  const adapterValidation = validateAthleteDomainAdapterV1(adapter);
  if (!adapterValidation.valid) throw new TypeError(adapterValidation.errors[0]);
  ensureNoIdentityShortcut({ adapter, relationship, initial_publication });
  if (relationship?.relationship_id !== adapter.domain_scope.relationship_id
    || relationship?.athlete_actor_id !== adapter.domain_scope.subject_id
    || relationship?.synthetic_only !== true) throw new TypeError('ATHLETE_LIVING_CONSULT_RELATIONSHIP_INVALID');
  const restored = hydrateRuntimeSnapshot(runtime_snapshot, { adapter, relationship });
  let publicationAuthorityContext = null;
  const livingStore = store || new InMemoryLivingRelationshipStore(restored?.living_store_snapshot || null, {
    publication_adapter: createAthletePublicationAdapterV1(adapter, {
      authority_context_provider: ({ proposal, decision, authority_receipt }) => {
        if (!publicationAuthorityContext
          || publicationAuthorityContext.proposal_hash !== proposal?.proposal_hash
          || publicationAuthorityContext.decision_hash !== decision?.decision_hash
          || publicationAuthorityContext.receipt_hash !== authority_receipt?.receipt_hash) return null;
        return publicationAuthorityContext;
      },
    }),
  });
  if (!livingStore.readCurrent({ scope: adapter.rsl_scope }).ok) {
    const initialized = await livingStore.initialize({ scope: adapter.rsl_scope, publication: initial_publication });
    if (!initialized.ok) throw new Error(initialized.code);
  }
  const apaObjects = shared_object_catalog.filter((entry) => entry.source_binding?.source_kind !== 'ATHLETE_BOS');
  const bosObjects = shared_object_catalog.filter((entry) => entry.source_binding?.source_kind === 'ATHLETE_BOS');
  const apaBindings = source_artifact_bindings.filter((entry) => entry.source_kind !== 'ATHLETE_BOS');
  const bosBindings = source_artifact_bindings.filter((entry) => entry.source_kind === 'ATHLETE_BOS');
  let permissionVersion = restored?.permission_version || 1;
  let currentGrant = restored?.current_grant || createAthleteSharedContextGrantV1({
    scope: adapter.domain_scope,
    relationship,
    source_artifact_bindings: apaBindings,
    allowed_object_ids: apaObjects.map((entry) => entry.object_id),
    allowed_actions: ['READ_SHARED_CONTEXT', 'PROPOSE_SHARED_PLAN', 'CONFIRM_SHARED_PLAN'],
    granted_at: iso(clock()),
    expires_at: new Date(Date.parse(clock()) + 90 * 86_400_000).toISOString(),
    granted_by: { actor_role: 'ATHLETE', actor_ref: relationship.athlete_actor_id },
    permission_version: permissionVersion,
  });
  let phase = restored?.phase || 'IDLE';
  let sessionId = restored?.session_id || null;
  let sessionOrdinal = restored?.session_ordinal || 0;
  let firstSessionEstablished = restored?.first_session_established || false;
  let pageContext = restored?.page_context || { room: 'HOME', visible_object_ids: [] };
  let conversation = restored?.conversation || [];
  let pendingProposal = restored?.pending_proposal || null;
  let pendingAuthorityBinding = restored?.pending_authority_binding || null;
  let lastProposal = restored?.last_proposal || null;
  let lastProposalStatus = restored?.last_proposal_status || null;
  let confirmations = restored?.confirmations || [];
  let closeDraft = restored?.close_draft || null;
  let latestGu = restored?.latest_gu || null;
  let latestMapDelta = restored?.latest_map_delta || null;
  let latestProviderReceipt = restored?.latest_provider_receipt || null;
  let lastCoachHypothesisEpisodeId = restored?.last_coach_hypothesis_episode_id || null;
  let revision = restored?.revision || 0;
  const idempotency = new Map((restored?.idempotency || []).map((entry) => [entry.idempotency_key_hash, {
    action: entry.action,
    semantic_hash: entry.semantic_hash,
    response: null,
    result_code: entry.result_code,
    result_revision: entry.result_revision,
    result_state_hash: entry.result_state_hash,
    response_hash: entry.response_hash,
    mutation_performed: entry.mutation_performed,
  }]));
  const evidenceCatalog = personalRslEvidenceCatalog(shared_object_catalog);

  function transition(next) {
    const validation = validateCoachingEpisodeTransition(phase, next);
    if (!validation.valid) throw new Error('ATHLETE_SESSION_TRANSITION_INVALID');
    phase = next;
  }

  function invalidatePendingProposalForAuthorityChange() {
    if (!pendingProposal) return null;
    const invalidatedId = pendingProposal.proposal_id;
    lastProposal = pendingProposal;
    lastProposalStatus = 'STALE_AUTHORITY';
    pendingProposal = null;
    pendingAuthorityBinding = null;
    confirmations = [];
    latestMapDelta = null;
    latestGu = null;
    return invalidatedId;
  }

  function currentPublication() {
    const current = livingStore.readCurrent({ scope: adapter.rsl_scope });
    if (!current.ok) throw new Error(current.code);
    return current.publication;
  }

  function compiledContext(at = clock()) {
    return compileAthleteSharedContextV1({
      adapter,
      grant: currentGrant,
      relationship,
      object_catalog: shared_object_catalog,
      as_of_at: iso(at),
      page_context: pageContext,
    });
  }

  function scorecard(at = clock()) {
    const { events } = activeEvents(livingStore, adapter.rsl_scope, iso(at));
    const episodes = livingStore.readRelationshipEpisodes({ scope: adapter.rsl_scope }).records.map((record) => record.event);
    const result = derivePrivateLongitudinalScorecard({
      scope: adapter.rsl_scope,
      active_events: events,
      historical_events: livingStore.readPersonalRsl({ scope: adapter.rsl_scope }).records.map((record) => record.event),
      episode_events: episodes,
      as_of_at: iso(at),
    });
    if (!result.ok) throw new Error(result.code);
    return result.scorecard;
  }

  function assemblePacket({ customerMessage = '', at = clock() } = {}) {
    const publication = currentPublication();
    const compiled = compiledContext(at);
    const { rslStore, events } = activeEvents(livingStore, adapter.rsl_scope, iso(at));
    const history = retrieveRelevantPersonalHistory({
      store: rslStore,
      scope: adapter.rsl_scope,
      purpose: 'ATHLETE_LIVING_CONSULT_SHARED',
      active_lens: pageContext.room === 'YOUR_SPORT' ? 'YOUR_SPORT' : pageContext.room,
      topics: customerMessage.split(/\s+/u).filter(Boolean).slice(0, 12),
      as_of_at: iso(at),
    });
    if (!history.ok) throw new Error(history.code);
    const selectedIds = new Set(history.result.selected_event_ids);
    const selectedHistory = events.filter((event) => selectedIds.has(event.event_id));
    const episodeHistory = livingStore.readRelationshipEpisodes({ scope: adapter.rsl_scope }).records.map((record) => record.event);
    const understanding = providerUnderstanding({
      compiled,
      publication,
      history: selectedHistory,
      episodeHistory,
      scorecard: scorecard(at),
      conversation,
      pageContext,
      phase,
      preferredName: preferred_name,
      sessionKind: sessionOrdinal <= 1 ? 'FIRST_EVER' : 'RETURNING',
    });
    const body = ensureNoIdentityShortcut({
      contract_id: 'athlete_living_consult_whole_understanding_v1',
      schema_version: '1.0.0',
      scope: clone(adapter.rsl_scope),
      session_id: sessionId,
      purpose: 'ATHLETE_LIVING_CONSULT_SHARED',
      active_lens: pageContext.room,
      authority_receipt_hash: compiled?.ok ? compiled.authority_receipt.receipt_hash : null,
      personal_rsl_retrieval_hash: history.result.result_hash,
      provider_understanding: understanding,
      allowed_refs: {
        evidence: compiled?.ok ? compiled.shared_objects.flatMap((entry) => entry.evidence_refs || []) : [],
        authority: compiled?.ok ? [compiled.authority_receipt.receipt_hash] : [],
      },
      provider_projection_contains_private_unshared_existence: false,
      provider_projection_contains_identity_shortcut: false,
      assembled_at: iso(at),
    });
    return deepFreeze({ ...body, packet_hash: hashCanonicalJson(body) });
  }

  function surfaceProjection(at = clock()) {
    const compiled = compiledContext(at);
    if (!compiled.ok) throw new Error(compiled.code);
    const bosAllowed = currentGrant.allowed_object_ids.includes(bos_authority_object_id);
    const projected = buildAthleteConsultSurfaceProjectionV1({
      compiled_context: compiled,
      bos_presentation_artifact: bosAllowed ? bos_presentation_artifact : null,
      bos_authority_object_id: bosAllowed ? bos_authority_object_id : null,
      apa_customer_view_model,
      apa_source_binding,
      projected_at: iso(at),
    });
    if (!projected.ok) throw new Error(projected.code);
    return projected.projection;
  }

  function stateHash() {
    return hashCanonicalJson(ensureNoIdentityShortcut({
      relationship_scope_hash: adapter.rsl_scope_hash,
      phase,
      session_id: sessionId,
      session_ordinal: sessionOrdinal,
      publication_hash: currentPublication().publication_hash,
      page_context: pageContext,
      grant_hash: currentGrant.grant_hash,
      pending_proposal_hash: pendingProposal?.proposal_hash || null,
      confirmation_hashes: confirmations.map((entry) => entry.confirmation_hash).sort(),
      conversation_count: conversation.length,
      revision,
    }));
  }

  function response(extra = {}) {
    const publication = currentPublication();
    const surfaces = surfaceProjection();
    const card = scorecard();
    const proposal = proposalProjection(pendingProposal || lastProposal, confirmations, pendingProposal ? null : lastProposalStatus);
    const coachInspection = coach_seam?.inspect?.() || null;
    const structuralQaOnly = coachInspection?.structural_qa_only === true;
    const body = ensureNoIdentityShortcut({
      ok: true,
      code: 'ATHLETE_LIVING_CONSULT_STATE',
      revision,
      state_hash: stateHash(),
      relationship: {
        domain: 'ATHLETE',
        athlete_relationship_id: adapter.rsl_scope.athlete_relationship_id,
        relationship_id: relationship.relationship_id,
        rsl_scope_hash: adapter.rsl_scope_hash,
        participants: [
          { role: 'ATHLETE', actor_ref: relationship.athlete_actor_id, display_name: preferred_name },
          { role: 'INSTRUCTOR', actor_ref: relationship.instructor_actor_id, display_name: instructor_name },
        ],
        one_relationship: true,
        one_personal_rsl: true,
        synthetic_only: true,
        age_band: '18–20',
      },
      session: {
        session_id: sessionId,
        coaching_episode_phase: phase,
        start_action: firstSessionEstablished ? 'START_SESSION' : 'START_MY_FIRST_SESSION',
        pre_session_state: phase === 'IDLE',
        ordinal: sessionOrdinal,
        relationship_continuous: true,
      },
      page_context: clone(pageContext),
      conversation: clone(conversation),
      surfaces: clone(surfaces.surfaces),
      current_map: publication,
      view_model: clone(apa_customer_view_model),
      pending_proposal: pendingProposal ? proposal : null,
      proposal,
      authority_pending: pendingProposal ? {
        athlete_confirmed: proposal.athlete_confirmed,
        instructor_confirmed: proposal.instructor_confirmed,
        two_human_quorum_required: true,
      } : null,
      map_delta: latestMapDelta ? { ...clone(latestMapDelta), committed: true } : null,
      gu_plan: latestGu,
      scorecard: card,
      open_loops: card.interventions.map((entry) => ({
        intervention_lineage_id: entry.intervention_lineage_id,
        title: entry.decided,
        original_reason: entry.original_reason || null,
        status: entry.open_loop_state,
        due_at: entry.due_at,
      })),
      attempts: card.interventions.flatMap((entry) => entry.actually_tried.map((attempt) => ({ ...attempt, intervention_lineage_id: entry.intervention_lineage_id }))),
      outcomes: card.interventions.flatMap((entry) => entry.what_happened.map((outcome) => ({ ...outcome, intervention_lineage_id: entry.intervention_lineage_id }))),
      intervention_lineage_id: card.interventions.at(-1)?.intervention_lineage_id || null,
      grant: {
        state: currentGrant.state,
        permission_version: currentGrant.permission_version,
        grant_hash: currentGrant.grant_hash,
        bos_shared: currentGrant.allowed_object_ids.includes(bos_authority_object_id),
        expires_at: currentGrant.expires_at,
      },
      receipts: latestProviderReceipt ? [clone(latestProviderReceipt)] : [],
      boundaries: {
        real_youth_data: false,
        real_customer_data: false,
        canonical_customer_mutation: false,
        universal_rsl_reads: false,
        universal_promotion: false,
        autonomous_scientific_closed_loop: false,
        synthetic_demo_conversation_persisted: true,
        real_customer_transcript_persisted: false,
        frontier_coaching_available: Boolean(coach_seam?.coach) && !structuralQaOnly,
        frontier_provider_status: structuralQaOnly
          ? 'STRUCTURAL_QA_NO_FRONTIER'
          : (coach_seam?.coach ? 'CONFIGURED' : 'NOT_CONFIGURED'),
        structural_qa_only: structuralQaOnly,
      },
      ...clone(extra),
    });
    return deepFreeze(body);
  }

  async function renderGu(event, { sessionLearning = null, mapDelta = null } = {}) {
    const packet = assemblePacket();
    const generated = await generateAthleteS2GuV1({
      generate: gu_generator,
      event,
      packet,
      publication: currentPublication(),
      relationship_scope_hash: adapter.rsl_scope_hash,
      scorecard: scorecard(),
      session_learning: sessionLearning,
      map_delta: mapDelta,
    });
    if (!generated.ok) throw new Error(generated.code);
    latestGu = generated.plan;
    return generated;
  }

  async function stageProposal({
    proposal_type,
    summary,
    items,
    reason,
    evidenceRefIds = [],
    authorityRefIds = [],
    createdAt = clock(),
    episodeType = 'MORE_SUGGESTION',
    episodeSummary = null,
  }) {
    const packet = assemblePacket({ customerMessage: summary, at: createdAt });
    const output = {
      proposal: {
        proposal_type,
        target_contract: 'athlete_living_map_v1',
        operation: 'PROPOSE',
        summary,
        items: clone(items),
        reason,
        evidence_ref_ids: clone(evidenceRefIds),
        authority_ref_ids: [...new Set([
          packet.authority_receipt_hash,
          currentGrant.grant_id,
          currentGrant.grant_hash,
          `athlete-permission-version:${currentGrant.permission_version}`,
          ...authorityRefIds.slice(0, 12),
        ])],
        confirmation_required: true,
        generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
      },
    };
    const hidden = createCoachingMutationCandidate({
      session_id: sessionId,
      scope_hash: adapter.rsl_scope_hash,
      state_packet_hash: packet.packet_hash,
      output,
      created_at: iso(createdAt),
    });
    const governed = createGovernedChangeProposal({
      hidden_proposal: hidden,
      scope: adapter.rsl_scope,
      source_state_packet: packet,
      current_publication: currentPublication(),
      created_at: iso(createdAt),
    });
    if (!governed.ok) return governed;
    const suggestion = createRelationshipEpisodeEvent({
      scope: adapter.rsl_scope,
      session_id: sessionId,
      event_type: episodeType,
      summary: episodeSummary || summary,
      occurred_at: iso(createdAt),
      source_content_hash: hidden.proposal_hash,
      proposal_id: governed.proposal.proposal_id,
    });
    if (!suggestion.ok) return suggestion;
    const saved = await livingStore.saveProposal({
      scope: adapter.rsl_scope,
      proposal: governed.proposal,
      saved_at: iso(createdAt),
      relationship_episode_events: [suggestion.event],
    });
    if (!saved.ok) return saved;
    pendingProposal = governed.proposal;
    pendingAuthorityBinding = {
      grant_hash: currentGrant.grant_hash,
      permission_version: currentGrant.permission_version,
      authority_receipt_hash: packet.authority_receipt_hash,
    };
    confirmations = [];
    lastProposalStatus = null;
    latestMapDelta = null;
    latestGu = null;
    return { ok: true, proposal: pendingProposal };
  }

  async function confirmPending({ actorRole, decision = 'CONFIRM', editedItems = [], at = clock(), idempotencyKey, hooks = {} }) {
    if (!pendingProposal) return fail('ATHLETE_SHARED_PROPOSAL_REQUIRED');
    if (!pendingAuthorityBinding
      || pendingAuthorityBinding.grant_hash !== currentGrant.grant_hash
      || pendingAuthorityBinding.permission_version !== currentGrant.permission_version
      || !pendingProposal.authority_ref_ids.includes(pendingAuthorityBinding.authority_receipt_hash)) {
      return fail('ATHLETE_SHARED_PROPOSAL_AUTHORITY_STALE');
    }
    if (!DECISIONS.has(decision) || !['ATHLETE', 'INSTRUCTOR'].includes(actorRole)) return fail('ATHLETE_SHARED_CONFIRMATION_INVALID');
    if (decision === 'EDIT' || editedItems.length) return fail('ATHLETE_SHARED_REVISION_ACTION_REQUIRED');
    if (confirmations.some((entry) => entry.actor.actor_role === actorRole)) return response({ code: 'IDEMPOTENT_REPLAY' });
    const confirmation = createAthleteSharedHumanConfirmationV1({
      adapter,
      grant: currentGrant,
      relationship,
      proposal: pendingProposal,
      actor: {
        actor_role: actorRole,
        actor_ref: actorRole === 'ATHLETE' ? relationship.athlete_actor_id : relationship.instructor_actor_id,
      },
      decision,
      edited_items: editedItems,
      confirmed_at: iso(at),
    });
    if (!confirmation.ok) return confirmation;
    const tentativeConfirmations = [...confirmations, confirmation.confirmation];
    if (tentativeConfirmations.length === 1) {
      const discussion = createRelationshipEpisodeEvent({
        scope: adapter.rsl_scope,
        session_id: sessionId,
        event_type: 'CUSTOMER_DISCUSSION',
        summary: `The ${actorRole === 'ATHLETE' ? 'athlete' : 'instructor'} explicitly reviewed the state-bound shared proposal.`,
        occurred_at: iso(at),
        source_content_hash: confirmation.confirmation.confirmation_hash,
        proposal_id: pendingProposal.proposal_id,
      });
      if (!discussion.ok) return discussion;
      const appendedDiscussion = await livingStore.appendRelationshipEpisodeEvents({ scope: adapter.rsl_scope, events: [discussion.event], appended_at: iso(at) });
      if (!appendedDiscussion.ok) return appendedDiscussion;
      confirmations = tentativeConfirmations;
      revision += 1;
      return response({ code: 'ATHLETE_SHARED_QUORUM_PENDING', mutation_performed: false });
    }
    const quorum = createAthleteSharedQuorumDecisionV1({
      adapter,
      grant: currentGrant,
      relationship,
      proposal: pendingProposal,
      confirmations: tentativeConfirmations,
      decided_at: iso(at),
    });
    if (!quorum.ok) return quorum;
    if (!quorum.mutation_authorized) {
      confirmations = tentativeConfirmations;
      lastProposal = pendingProposal;
      pendingProposal = null;
      pendingAuthorityBinding = null;
      lastProposalStatus = 'REJECTED';
      latestMapDelta = null;
      revision += 1;
      return response({ code: quorum.code, mutation_performed: false });
    }
    const quorumValidation = validateAthleteSharedQuorumReceiptV1(quorum.quorum_receipt, {
      adapter,
      grant: currentGrant,
      proposal: pendingProposal,
      decision: quorum.decision,
      confirmations: tentativeConfirmations,
    });
    if (!quorumValidation.valid) return fail('ATHLETE_SHARED_QUORUM_RECEIPT_INVALID', { errors: quorumValidation.errors });
    const { events } = activeEvents(livingStore, adapter.rsl_scope, iso(at));
    const mutation = createConfirmedPersonalRslMutation({
      proposal: pendingProposal,
      decision: quorum.decision,
      evidence_catalog: evidenceCatalog,
      active_personal_rsl_events: events,
      event_id: `athlete_rsl_${hashCanonicalJson({ proposal: pendingProposal.proposal_hash, decision: quorum.decision.decision_hash }).slice(0, 24)}`,
      recorded_at: iso(at),
    });
    if (!mutation.ok) return mutation;
    let derivedEvents = [];
    if (mutation.event.event_type === 'OUTCOME') {
      const review = createLinkedCausalReviewEvent({
        scope: adapter.rsl_scope,
        active_events: [...events, mutation.event],
        outcome_event: mutation.event,
        event_id: `athlete_causal_review_${hashCanonicalJson({ outcome: mutation.event.content_hash }).slice(0, 24)}`,
        recorded_at: iso(at),
      });
      if (!review.ok) return review;
      derivedEvents = [review.event];
    }
    publicationAuthorityContext = {
      proposal_hash: pendingProposal.proposal_hash,
      decision_hash: quorum.decision.decision_hash,
      receipt_hash: quorum.quorum_receipt.receipt_hash,
      grant: currentGrant,
      relationship,
      confirmations: tentativeConfirmations,
    };
    let committed;
    try {
      committed = await livingStore.commitDecision({
        scope: adapter.rsl_scope,
        proposal: pendingProposal,
        decision: quorum.decision,
        event: mutation.event,
        derived_events: derivedEvents,
        authority_receipt: quorum.quorum_receipt,
        idempotency_key: idempotencyKey,
        committed_at: iso(at),
      });
    } finally {
      publicationAuthorityContext = null;
    }
    if (!committed.ok) {
      if (committed.code === 'ATHLETE_LIVING_MAP_NO_MATERIAL_CHANGE') {
        confirmations = tentativeConfirmations;
        lastProposal = pendingProposal;
        pendingProposal = null;
        pendingAuthorityBinding = null;
        lastProposalStatus = 'NO_MATERIAL_CHANGE';
        latestMapDelta = null;
        revision += 1;
        return response({ code: 'ATHLETE_SHARED_PROPOSAL_NO_MATERIAL_CHANGE_CLOSED', mutation_performed: false, no_material_change: true });
      }
      return committed;
    }
    if (!committed.map_delta_receipt) return fail('ATHLETE_MAP_DELTA_RECEIPT_REQUIRED');
    confirmations = tentativeConfirmations;
    lastProposal = pendingProposal;
    pendingProposal = null;
    const committedProposal = lastProposal;
    pendingAuthorityBinding = null;
    lastProposalStatus = 'COMMITTED';
    latestMapDelta = committed.map_delta_receipt;
    revision += 1;
    if (typeof hooks.onDurableCheckpoint === 'function') {
      await hooks.onDurableCheckpoint({ stage: 'MAP_COMMITTED_BEFORE_GU', snapshot: snapshot() });
    }
    const itemByField = new Map(committedProposal.proposed_items.map((item) => [item.field, item.value]));
    const committedState = currentPublication().state;
    await renderGu('MAP_CHANGE', {
      mapDelta: {
        ...clone(latestMapDelta),
        proposal_context: {
          summary: committedProposal.summary,
          reason: committedProposal.reason,
          source: 'Explicit Athlete and instructor joint agreement',
          observation_window_start: itemByField.get('athlete_plan.observation_window_start') || null,
          observation_window_end: itemByField.get('athlete_plan.observation_window_end') || null,
          falsifier: itemByField.get('athlete_plan.falsifiers') || null,
          residual_disagreement: committedState.athlete_current_reality?.unresolved || null,
          remaining_uncertainty: committedState.athlete_evidence?.highest_value_missing || null,
        },
      },
    });
    return response({
      code: committed.code,
      mutation_performed: true,
      joint_authority_receipt: committed.joint_authority_receipt,
      committed_delta: committed.map_delta_receipt,
    });
  }

  async function execute(action, payload = {}, hooks = {}) {
    const now = iso(clock());
    if (action === 'START_MY_FIRST_SESSION' || action === 'START_SESSION') {
      if (phase !== 'IDLE') return fail('ATHLETE_SESSION_ALREADY_ACTIVE');
      if (action === 'START_MY_FIRST_SESSION' && firstSessionEstablished) return fail('ATHLETE_FIRST_SESSION_ALREADY_ESTABLISHED');
      if (action === 'START_SESSION' && !firstSessionEstablished) return fail('ATHLETE_FIRST_SESSION_REQUIRED');
      transition('STARTED');
      sessionOrdinal += 1;
      sessionId = `athlete_session_${hashCanonicalJson({ scope: adapter.rsl_scope_hash, ordinal: sessionOrdinal, started_at: now }).slice(0, 24)}`;
      revision += 1;
      if (typeof hooks.onDurableCheckpoint === 'function') {
        await hooks.onDurableCheckpoint({ stage: 'SESSION_STARTED_BEFORE_GU', snapshot: snapshot() });
      }
      await renderGu(action === 'START_MY_FIRST_SESSION' ? 'FIRST_SESSION_WELCOME' : 'SESSION_OPENING');
      return response({ code: action === 'START_MY_FIRST_SESSION' ? 'ATHLETE_FIRST_SESSION_STARTED' : 'ATHLETE_SESSION_STARTED', mutation_performed: false });
    }
    if (action === 'SET_PAGE_CONTEXT') {
      const nextPageContext = normalizePageContext(payload);
      if (!nextPageContext) return fail('ATHLETE_PAGE_CONTEXT_INVALID');
      pageContext = nextPageContext;
      revision += 1;
      return response({ code: 'ATHLETE_PAGE_CONTEXT_UPDATED', mutation_performed: false });
    }
    if (action === 'GRANT_BOS') {
      if (currentGrant.allowed_object_ids.includes(bos_authority_object_id)) return response({ code: 'IDEMPOTENT_REPLAY' });
      const invalidatedProposalId = invalidatePendingProposalForAuthorityChange();
      permissionVersion += 1;
      currentGrant = createAthleteSharedContextGrantV1({
        scope: adapter.domain_scope,
        relationship,
        source_artifact_bindings: [...apaBindings, ...bosBindings],
        allowed_object_ids: [...apaObjects, ...bosObjects].map((entry) => entry.object_id),
        allowed_actions: ['READ_SHARED_CONTEXT', 'PROPOSE_SHARED_PLAN', 'CONFIRM_SHARED_PLAN'],
        granted_at: now,
        expires_at: new Date(Date.parse(now) + 90 * 86_400_000).toISOString(),
        granted_by: { actor_role: 'ATHLETE', actor_ref: relationship.athlete_actor_id },
        permission_version: permissionVersion,
      });
      revision += 1;
      return response({ code: 'ATHLETE_PRESENTATION_SAFE_BOS_GRANTED', invalidated_proposal_id: invalidatedProposalId, mutation_performed: false });
    }
    if (action === 'REVOKE_BOS') {
      if (!currentGrant.allowed_object_ids.includes(bos_authority_object_id)) return response({ code: 'IDEMPOTENT_REPLAY' });
      const invalidatedProposalId = invalidatePendingProposalForAuthorityChange();
      const revoked = revokeAthleteSharedContextGrantV1({
        grant: currentGrant,
        actor: { actor_role: 'ATHLETE', actor_ref: relationship.athlete_actor_id },
        expected_permission_version: currentGrant.permission_version,
        revoked_at: now,
      });
      if (!revoked.ok) return revoked;
      permissionVersion = revoked.grant.permission_version + 1;
      currentGrant = createAthleteSharedContextGrantV1({
        scope: adapter.domain_scope,
        relationship,
        source_artifact_bindings: apaBindings,
        allowed_object_ids: apaObjects.map((entry) => entry.object_id),
        allowed_actions: ['READ_SHARED_CONTEXT', 'PROPOSE_SHARED_PLAN', 'CONFIRM_SHARED_PLAN'],
        granted_at: now,
        expires_at: new Date(Date.parse(now) + 90 * 86_400_000).toISOString(),
        granted_by: { actor_role: 'ATHLETE', actor_ref: relationship.athlete_actor_id },
        permission_version: permissionVersion,
      });
      revision += 1;
      return response({ code: 'ATHLETE_PRESENTATION_SAFE_BOS_REVOKED', revoked_grant_hash: revoked.grant.grant_hash, invalidated_proposal_id: invalidatedProposalId, mutation_performed: false });
    }
    if (!['STARTED', 'ACTIVE', 'ENDING'].includes(phase)) return fail('ATHLETE_SUBSTANTIVE_SESSION_REQUIRED');
    if (action === 'TURN') {
      if (!['STARTED', 'ACTIVE'].includes(phase)) return fail('ATHLETE_SESSION_NOT_OPEN_FOR_TURN');
      if (!coach_seam?.coach) return fail('ATHLETE_FRONTIER_NOT_CONFIGURED');
      if (!['ATHLETE', 'INSTRUCTOR', 'PARTICIPANT'].includes(payload.actor_role)
        || !validConversationContent(payload.message)) return fail('ATHLETE_TURN_INVALID');
      if (conversation.length > MAX_CONVERSATION_ENTRIES - 2) return fail('ATHLETE_CONVERSATION_LIMIT_REACHED');
      const priorPageContext = clone(pageContext);
      const priorConversation = conversation;
      if (payload.page_context) {
        const nextPageContext = normalizePageContext(payload.page_context);
        if (!nextPageContext) return fail('ATHLETE_PAGE_CONTEXT_INVALID');
        pageContext = nextPageContext;
      }
      conversation = [...conversation, { actor_role: payload.actor_role, role: payload.actor_role.toLowerCase(), content: payload.message.trim(), occurred_at: now, room: pageContext.room }];
      let packet;
      let coached;
      try {
        packet = assemblePacket({ customerMessage: payload.message, at: now });
        coached = await coach_seam.coach({ packet, customer_message: payload.message.trim(), mutation_performed: false });
      } catch (error) {
        conversation = priorConversation;
        pageContext = priorPageContext;
        throw error;
      }
      if (!coached.ok) {
        conversation = priorConversation;
        pageContext = priorPageContext;
        return coached;
      }
      if (!validConversationContent(coached.customer_message)) {
        conversation = priorConversation;
        pageContext = priorPageContext;
        return fail('ATHLETE_COACHING_MESSAGE_INVALID');
      }
      const episodeEvents = [];
      let correctionEpisodeId = null;
      if (lastCoachHypothesisEpisodeId && EXPLICIT_CORRECTION.test(payload.message.trim())) {
        const correction = createRelationshipEpisodeEvent({
          scope: adapter.rsl_scope,
          session_id: sessionId,
          event_type: 'CUSTOMER_DISCUSSION',
          summary: `The ${payload.actor_role === 'ATHLETE' ? 'athlete' : payload.actor_role === 'INSTRUCTOR' ? 'instructor' : 'shared-session participant'} explicitly corrected the preceding session-bound coaching interpretation. The earlier interpretation remains provenance, not customer truth.`,
          occurred_at: now,
          source_content_hash: hashCanonicalJson({ actor_role: payload.actor_role, content: payload.message.trim() }),
          supersedes_episode_event_id: lastCoachHypothesisEpisodeId,
        });
        if (!correction.ok) {
          conversation = priorConversation;
          pageContext = priorPageContext;
          return correction;
        }
        episodeEvents.push(correction.event);
        correctionEpisodeId = correction.event.episode_event_id;
      }
      const hypothesis = createRelationshipEpisodeEvent({
        scope: adapter.rsl_scope,
        session_id: sessionId,
        event_type: 'MORE_SUGGESTION',
        summary: coached.customer_message.length <= 1200
          ? coached.customer_message
          : `${coached.customer_message.slice(0, 1198)}…`,
        occurred_at: iso(clock()),
        source_content_hash: hashCanonicalJson({ actor_role: 'MORE', content: coached.customer_message }),
        supersedes_episode_event_id: correctionEpisodeId,
      });
      if (!hypothesis.ok) {
        conversation = priorConversation;
        pageContext = priorPageContext;
        return hypothesis;
      }
      episodeEvents.push(hypothesis.event);
      const appendedEpisodes = await livingStore.appendRelationshipEpisodeEvents({
        scope: adapter.rsl_scope,
        events: episodeEvents,
        appended_at: iso(clock()),
      });
      if (!appendedEpisodes.ok) {
        conversation = priorConversation;
        pageContext = priorPageContext;
        return appendedEpisodes;
      }
      lastCoachHypothesisEpisodeId = hypothesis.event.episode_event_id;
      conversation = [...conversation, { actor_role: 'MORE', role: 'coach', content: coached.customer_message, occurred_at: iso(clock()), room: pageContext.room }];
      latestProviderReceipt = coached.receipt || null;
      if (phase === 'STARTED') transition('ACTIVE');
      revision += 1;
      if (typeof hooks.onCoachingReady === 'function') await hooks.onCoachingReady(response({ code: 'ATHLETE_COACHING_READY', customer_message: coached.customer_message, phase: 'COACHING_READY', mutation_performed: false }));
      let candidateStatus = { attempted: false, code: 'ATHLETE_CANDIDATE_EXTRACTION_NOT_CONFIGURED', proposal_staged: false };
      if (candidate_extractor?.extract && !pendingProposal) {
        candidateStatus = { attempted: true, code: 'ATHLETE_CANDIDATE_EXTRACTION_FAILED_CLOSED', proposal_staged: false };
        try {
          const extracted = await candidate_extractor.extract({ packet: assemblePacket({ customerMessage: payload.message }), human_message: payload.message.trim(), coach_message: coached.customer_message });
          candidateStatus = { attempted: true, code: extracted?.code || 'ATHLETE_CANDIDATE_EXTRACTION_FAILED_CLOSED', proposal_staged: false };
          if (extracted?.ok && extracted.candidate) {
            const staged = await stageProposal({
              proposal_type: extracted.candidate.proposal_type,
              summary: extracted.candidate.summary,
              items: extracted.candidate.items,
              reason: extracted.candidate.reason,
              evidenceRefIds: extracted.candidate.evidence_ref_ids,
              authorityRefIds: extracted.candidate.authority_ref_ids,
              episodeType: extracted.candidate.candidate_source === 'MORE_SUGGESTION' ? 'MORE_SUGGESTION' : 'CUSTOMER_DISCUSSION',
              episodeSummary: extracted.candidate.candidate_source === 'MORE_SUGGESTION'
                ? extracted.candidate.summary
                : `A human-authored or co-created Athlete change was preserved as a proposal awaiting both people. ${extracted.candidate.summary}`,
            });
            candidateStatus = staged.ok
              ? { attempted: true, code: 'ATHLETE_DURABLE_CANDIDATE_STAGED_AWAITING_TWO_HUMANS', proposal_staged: true }
              : { attempted: true, code: staged.code || 'ATHLETE_CANDIDATE_STAGE_FAILED_CLOSED', proposal_staged: false };
          }
        } catch {
          // Coaching is already visible and remains ephemeral. Candidate machinery
          // fails closed independently; it may never convert model speech to truth.
          candidateStatus = { attempted: true, code: 'ATHLETE_CANDIDATE_EXTRACTION_FAILED_CLOSED', proposal_staged: false };
        }
      } else if (pendingProposal) {
        candidateStatus = { attempted: false, code: 'ATHLETE_CANDIDATE_EXTRACTION_SKIPPED_PENDING_PROPOSAL', proposal_staged: false };
      }
      await renderGu('COACHING_MOMENT');
      return response({ code: 'ATHLETE_COACHING_TURN_COMPLETE', customer_message: coached.customer_message, phase: 'COMPLETE', mutation_performed: false, candidate_status: candidateStatus });
    }
    if (action === 'PROPOSE_PLAN') {
      if (pendingProposal) return fail('ATHLETE_SHARED_REVISION_ACTION_REQUIRED', { proposal_id: pendingProposal.proposal_id, proposal_hash: pendingProposal.proposal_hash });
      const replacedProposal = pendingProposal;
      const staged = await stageProposal({
        proposal_type: payload.proposal_type || 'COMMITMENT_CANDIDATE',
        summary: payload.summary || plan_fixture?.summary || 'Test one shared cue in four comparable practice moments.',
        items: payload.items || [
          { field: 'athlete_plan.intervention', value: plan_fixture?.intervention || 'Use one agreed cue before four comparable practice sequences.' },
          { field: 'athlete_plan.open_loop_state', value: 'OPEN' },
          { field: 'athlete_plan.due_at', value: new Date(Date.parse(now) + 7 * 86_400_000).toISOString() },
          { field: 'athlete_plan.observation_window_start', value: now },
          { field: 'athlete_plan.observation_window_end', value: new Date(Date.parse(now) + 7 * 86_400_000).toISOString() },
          { field: 'athlete_plan.falsifiers', value: plan_fixture?.falsifier || 'The cue adds confusion, or comparable sequences show no useful signal.' },
        ],
        reason: payload.reason || 'Synthetic structural proof of a bounded Athlete/instructor shared decision.',
      });
      if (!staged.ok) return staged;
      lastProposal = replacedProposal;
      revision += 1;
      return response({
        code: replacedProposal ? 'ATHLETE_SHARED_PLAN_PROPOSAL_REVISED' : 'ATHLETE_SHARED_PLAN_PROPOSAL_STAGED',
        mutation_performed: false,
        structural_fixture_only: !payload.items,
        replaced_proposal_id: replacedProposal?.proposal_id || null,
      });
    }
    if (action === 'REVISE_PROPOSAL') {
      if (!pendingProposal || !['ATHLETE', 'INSTRUCTOR', 'PARTICIPANT'].includes(payload.actor_role)
        || payload.session_id !== sessionId || payload.relationship_id !== relationship.relationship_id
        || payload.expected_proposal_id !== pendingProposal.proposal_id
        || payload.expected_proposal_hash !== pendingProposal.proposal_hash
        || payload.expected_prior_publication_version !== pendingProposal.expected_prior_publication_version
        || payload.expected_prior_publication_hash !== pendingProposal.expected_prior_publication_hash
        || typeof payload.summary !== 'string' || !payload.summary.trim()
        || !Array.isArray(payload.items) || !payload.items.length) {
        return fail('ATHLETE_SHARED_REVISION_BINDING_INVALID');
      }
      const replacedProposal = pendingProposal;
      const staged = await stageProposal({
        proposal_type: payload.proposal_type || replacedProposal.proposal_type,
        summary: payload.summary,
        items: payload.items,
        reason: payload.reason || 'A human revised the still-unconfirmed shared proposal before joint approval.',
        createdAt: now,
        episodeType: 'CUSTOMER_DISCUSSION',
        episodeSummary: `The ${payload.actor_role === 'ATHLETE' ? 'athlete' : payload.actor_role === 'INSTRUCTOR' ? 'instructor' : 'shared-session participant'} revised the pending proposal before joint agreement.`,
      });
      if (!staged.ok) return staged;
      lastProposal = replacedProposal;
      revision += 1;
      return response({
        code: 'ATHLETE_SHARED_PLAN_PROPOSAL_REVISED',
        mutation_performed: false,
        replaced_proposal_id: replacedProposal.proposal_id,
        revised_by: payload.actor_role,
      });
    }
    if (action === 'RECORD_ATTEMPT') {
      if (pendingProposal) return fail('ATHLETE_SHARED_REVISION_OR_RESOLUTION_REQUIRED');
      if (!['ATHLETE', 'INSTRUCTOR'].includes(payload.actor_role) || typeof payload.summary !== 'string' || !payload.summary.trim()) {
        return fail('ATHLETE_ATTEMPT_SOURCE_REQUIRED');
      }
      const staged = await stageProposal({
        proposal_type: 'EVIDENCE_CANDIDATE',
        summary: payload.summary,
        items: [
          { field: 'athlete_evidence.attempt', value: payload.summary },
          { field: 'athlete_evidence.intervention_lineage_id', value: payload.intervention_lineage_id },
          { field: 'athlete_evidence.execution_degree', value: payload.execution_degree },
          { field: 'athlete_evidence.open_loop_state', value: payload.open_loop_state || 'ATTEMPTED' },
        ],
        reason: 'Attach a source-bound execution observation to the exact authorized intervention lineage.',
        episodeType: 'CUSTOMER_DISCUSSION',
        episodeSummary: `The ${payload.actor_role === 'ATHLETE' ? 'athlete' : 'instructor'} reported a possible attempt for joint review. ${payload.summary}`,
      });
      if (!staged.ok) return staged;
      revision += 1;
      return response({ code: 'ATHLETE_ATTEMPT_PROPOSAL_STAGED', mutation_performed: false });
    }
    if (action === 'RECORD_OUTCOME') {
      if (pendingProposal) return fail('ATHLETE_SHARED_REVISION_OR_RESOLUTION_REQUIRED');
      if (!['ATHLETE', 'INSTRUCTOR'].includes(payload.actor_role) || typeof payload.summary !== 'string' || !payload.summary.trim()) {
        return fail('ATHLETE_OUTCOME_SOURCE_REQUIRED');
      }
      const items = [
        { field: 'athlete_evidence.outcome', value: payload.summary },
        { field: 'athlete_evidence.intervention_lineage_id', value: payload.intervention_lineage_id },
        { field: 'athlete_evidence.outcome_classification', value: payload.outcome_classification },
        { field: 'athlete_evidence.open_loop_state', value: payload.open_loop_state || 'UNRESOLVED' },
      ];
      if (payload.confounders?.length) items.push({ field: 'athlete_evidence.confounders', value: JSON.stringify(payload.confounders) });
      if (payload.external_shocks?.length) items.push({ field: 'athlete_evidence.external_shocks', value: JSON.stringify(payload.external_shocks) });
      const staged = await stageProposal({
        proposal_type: 'EVIDENCE_CANDIDATE',
        summary: payload.summary,
        items,
        reason: 'Attach a source-bound outcome observation to the exact executed intervention lineage while preserving uncertainty.',
        episodeType: 'CUSTOMER_DISCUSSION',
        episodeSummary: `The ${payload.actor_role === 'ATHLETE' ? 'athlete' : 'instructor'} reported a possible outcome for joint review. ${payload.summary}`,
      });
      if (!staged.ok) return staged;
      revision += 1;
      return response({ code: 'ATHLETE_OUTCOME_PROPOSAL_STAGED', mutation_performed: false });
    }
    if (action === 'CONFIRM') {
      if (!pendingProposal || payload.session_id !== sessionId || payload.relationship_id !== relationship.relationship_id
        || payload.proposal_id !== pendingProposal.proposal_id || payload.proposal_hash !== pendingProposal.proposal_hash
        || payload.expected_prior_publication_version !== pendingProposal.expected_prior_publication_version
        || payload.expected_prior_publication_hash !== pendingProposal.expected_prior_publication_hash) {
        return fail('ATHLETE_SHARED_CONFIRMATION_BINDING_INVALID');
      }
      return confirmPending({
        actorRole: payload.actor_role,
        decision: payload.decision,
        editedItems: payload.edited_items || [],
        at: now,
        idempotencyKey: payload.idempotency_key,
        hooks,
      });
    }
    if (action === 'REQUEST_CLOSE') {
      if (!['STARTED', 'ACTIVE'].includes(phase)) return fail('ATHLETE_SESSION_CLOSE_INVALID');
      const priorPhase = phase;
      transition('ENDING');
      let close;
      try {
        if (close_seam?.close) close = await close_seam.close({ packet: assemblePacket(), pending_proposal: pendingProposal, mode: 'REQUEST_ALIGNMENT' });
        else close = { ok: true, customer_message: `${preferred_name}, does this capture where the two of you want to pause?`, session_learning: defaultSessionLearning({ conversation, preferredName: preferred_name }), receipt: { provider_called: false, structural_fixture_only: true } };
      } catch {
        phase = priorPhase;
        return fail('ATHLETE_SESSION_CLOSE_PROVIDER_FAILED_CLOSED');
      }
      if (!close.ok) {
        phase = priorPhase;
        return close;
      }
      closeDraft = close;
      latestProviderReceipt = close.receipt || null;
      revision += 1;
      return response({ code: 'ATHLETE_MUTUAL_CLOSE_ALIGNMENT_REQUESTED', customer_message: close.customer_message, close_pending: { summary: close.customer_message, alignment_message: payload.alignment_message || null }, mutation_performed: false });
    }
    if (action === 'CLOSE_SESSION') {
      if (phase !== 'ENDING' || !payload.alignment_message?.trim() || payload.alignment_message.trim().length > 800) return fail('ATHLETE_MUTUAL_CLOSE_ALIGNMENT_REQUIRED');
      let closed;
      if (close_seam?.close) closed = await close_seam.close({ packet: assemblePacket(), pending_proposal: pendingProposal, mode: 'FINALIZE', alignment_message: payload.alignment_message, prior_session_learning: closeDraft?.session_learning || null });
      else closed = { ok: true, customer_message: `${preferred_name}, this is a good place to pause. We will pick it up together next time.`, session_learning: defaultSessionLearning({ conversation, preferredName: preferred_name, alignmentMessage: payload.alignment_message }), receipt: { provider_called: false, structural_fixture_only: true } };
      if (!closed.ok) return closed;
      transition('SESSION_LEARNING_NOTES_READY');
      const mutualAlignment = payload.alignment_message.trim();
      const modelLearning = closed.session_learning || defaultSessionLearning({ conversation, preferredName: preferred_name });
      const learning = deepFreeze({
        ...clone(modelLearning),
        mutual_alignment: mutualAlignment,
        mutual_alignment_authority: 'EXPLICIT_ATHLETE_AND_INSTRUCTOR_CLOSE',
      });
      const alignmentEpisode = createRelationshipEpisodeEvent({
        scope: adapter.rsl_scope,
        session_id: sessionId,
        event_type: 'CUSTOMER_DISCUSSION',
        summary: `At mutual close, the athlete and instructor explicitly aligned: ${mutualAlignment}`,
        occurred_at: now,
        source_content_hash: hashCanonicalJson({
          actor_roles: ['ATHLETE', 'INSTRUCTOR'],
          mutual_alignment: mutualAlignment,
          session_id: sessionId,
        }),
      });
      if (!alignmentEpisode.ok) return alignmentEpisode;
      const episode = createRelationshipEpisodeEvent({
        scope: adapter.rsl_scope,
        session_id: sessionId,
        event_type: 'SESSION_LEARNING',
        summary: learning.summary || learning.what_mattered,
        occurred_at: now,
        source_content_hash: hashCanonicalJson(learning),
      });
      if (!episode.ok) return episode;
      const appended = await livingStore.appendRelationshipEpisodeEvents({
        scope: adapter.rsl_scope,
        events: [alignmentEpisode.event, episode.event],
        appended_at: now,
      });
      if (!appended.ok) return appended;
      if (typeof hooks.onDurableCheckpoint === 'function') {
        await hooks.onDurableCheckpoint({ stage: 'SESSION_LEARNING_COMMITTED_BEFORE_GU', snapshot: snapshot() });
      }
      await renderGu('SESSION_CLOSING', { sessionLearning: learning });
      transition('IDLE');
      firstSessionEstablished = true;
      latestProviderReceipt = closed.receipt || null;
      sessionId = null;
      closeDraft = null;
      pageContext = { room: 'HOME', visible_object_ids: [] };
      revision += 1;
      return response({ code: 'ATHLETE_SESSION_CLOSED_RELATIONSHIP_CONTINUES', customer_message: closed.customer_message, session_learning: learning, mutation_performed: false });
    }
    return fail('ATHLETE_LIVING_CONSULT_ACTION_DENIED');
  }

  async function dispatch(action, payload = {}, hooks = {}) {
    if (action === 'RESET') return fail('ATHLETE_RUNTIME_RESET_NOT_EXPOSED_BY_SHARED_BRAIN');
    if (typeof action !== 'string') return fail('ATHLETE_LIVING_CONSULT_ACTION_REQUIRED');
    const idempotencyKey = payload.idempotency_key;
    const idempotencyKeyHash = idempotencyKey ? hashCanonicalJson({ idempotency_key: idempotencyKey }) : null;
    const semanticPayload = clone(payload);
    delete semanticPayload.idempotency_key;
    const semantic = hashCanonicalJson({ action, payload: semanticPayload });
    if (idempotencyKeyHash && idempotency.has(idempotencyKeyHash)) {
      const prior = idempotency.get(idempotencyKeyHash);
      if (prior.semantic_hash !== semantic) return fail('ATHLETE_IDEMPOTENCY_CONFLICT');
      return prior.response || response({
        code: 'ATHLETE_IDEMPOTENT_REPLAY',
        original_result_code: prior.result_code,
        original_result_revision: prior.result_revision,
        original_result_state_hash: prior.result_state_hash,
        original_response_hash: prior.response_hash,
        original_mutation_performed: prior.mutation_performed,
        mutation_performed: false,
      });
    }
    if (payload.expected_state_hash && payload.expected_state_hash !== stateHash()) return fail('ATHLETE_STALE_STATE_REFUSED', { current_state_hash: stateHash(), current_revision: revision });
    if (payload.expected_revision != null && payload.expected_revision !== revision) return fail('ATHLETE_STALE_STATE_REFUSED', { current_state_hash: stateHash(), current_revision: revision });
    const result = await execute(action, payload, hooks);
    if (idempotencyKeyHash && result.ok) {
      idempotency.set(idempotencyKeyHash, {
        action,
        semantic_hash: semantic,
        response: result,
        result_code: result.code,
        result_revision: result.revision,
        result_state_hash: result.state_hash,
        response_hash: hashCanonicalJson(result),
        mutation_performed: result.mutation_performed === true,
      });
      while (idempotency.size > MAX_RUNTIME_IDEMPOTENCY_RECEIPTS) idempotency.delete(idempotency.keys().next().value);
    }
    return result;
  }

  function snapshot() {
    const body = ensureNoIdentityShortcut({
      contract_id: RUNTIME_SNAPSHOT_CONTRACT,
      schema_version: '1.0.0',
      adapter_hash: adapter.adapter_hash,
      relationship_hash: hashCanonicalJson(relationship),
      relationship_scope_hash: adapter.rsl_scope_hash,
      runtime_state_hash: stateHash(),
      permission_version: permissionVersion,
      current_grant: clone(currentGrant),
      phase,
      session_id: sessionId,
      session_ordinal: sessionOrdinal,
      first_session_established: firstSessionEstablished,
      page_context: clone(pageContext),
      conversation: clone(conversation),
      pending_proposal: clone(pendingProposal),
      pending_authority_binding: clone(pendingAuthorityBinding),
      last_proposal: clone(lastProposal),
      last_proposal_status: lastProposalStatus,
      confirmations: clone(confirmations),
      close_draft: clone(closeDraft),
      latest_gu: clone(latestGu),
      latest_map_delta: clone(latestMapDelta),
      latest_provider_receipt: clone(latestProviderReceipt),
      last_coach_hypothesis_episode_id: lastCoachHypothesisEpisodeId,
      revision,
      idempotency: [...idempotency.entries()].map(([idempotency_key_hash, entry]) => ({
        idempotency_key_hash,
        action: entry.action,
        semantic_hash: entry.semantic_hash,
        result_code: entry.result_code,
        result_revision: entry.result_revision,
        result_state_hash: entry.result_state_hash,
        response_hash: entry.response_hash,
        mutation_performed: entry.mutation_performed,
      })),
      living_store_snapshot: livingStore.snapshot(),
    });
    return deepFreeze({ ...body, snapshot_hash: hashCanonicalJson(body) });
  }

  if (restored) {
    const current = livingStore.readCurrent({ scope: adapter.rsl_scope });
    const publicationValidation = current.ok
      ? validateAthleteLivingMapPublicationV1(current.publication, adapter)
      : { valid: false };
    const episodeValidation = livingStore.verifyRelationshipEpisodes({ scope: adapter.rsl_scope });
    let personalRslValid = true;
    try { livingStore.buildPersonalRslStore({ scope: adapter.rsl_scope }); } catch { personalRslValid = false; }
    const compiled = compiledContext();
    if (!current.ok || !publicationValidation.valid || !episodeValidation.ok || !personalRslValid
      || !compiled.ok || restored.runtime_state_hash !== stateHash()) {
      throw new TypeError('ATHLETE_LIVING_CONSULT_RUNTIME_SNAPSHOT_INTEGRITY_FAILED');
    }
  }

  return Object.freeze({
    bootstrap: () => response({ code: 'ATHLETE_LIVING_CONSULT_BOOTSTRAPPED', mutation_performed: false }),
    dispatch,
    inspect: () => deepFreeze({
      domain: 'ATHLETE',
      synthetic_only: true,
      age_band: '18–20',
      provider: coach_seam?.inspect?.() || { enabled: false, model: 'gpt-5.6-sol', reasoning_effort: 'xhigh', store: false, background: false },
      current_state_hash: stateHash(),
      current_revision: revision,
      personal_rsl: livingStore.inspect({ scope: adapter.rsl_scope }),
      relationship_episode_chain: livingStore.verifyRelationshipEpisodes({ scope: adapter.rsl_scope }),
      serialized_identity_shortcut_present: false,
      universal_rsl_reads: false,
      universal_promotion: false,
      autonomous_scientific_closed_loop: false,
      canonical_customer_mutation: false,
      synthetic_demo_conversation_persisted: true,
      real_customer_transcript_persisted: false,
    }),
    store: livingStore,
    scope: adapter.rsl_scope,
    assemblePacket,
    snapshot,
  });
}

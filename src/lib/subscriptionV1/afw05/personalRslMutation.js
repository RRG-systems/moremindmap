import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { createAuthorityReference, createEvidenceReference } from '../contracts.js';
import { createConfirmedLineageMetadata } from '../lineage.js';
import { createPersonalRslEvent } from '../personalRsl.js';
import { PROPOSAL_EVENT_TYPES } from './constants.js';
import { validateGovernedChangeProposal, validateProposalDecision } from './contracts.js';
import { correctionTargetContext } from './correctionTargets.js';

function evidenceEventType(proposal, effectiveItems) {
  if (proposal.retracts_event_ids.length) return 'RETRACTION';
  if (proposal.proposal_type === 'CORRECTION_CANDIDATE') return 'CORRECTION';
  if (proposal.proposal_type === 'PLAN_CHANGE_CANDIDATE') return 'PLAN_CHANGE';
  if (proposal.proposal_type === 'COMMITMENT_CANDIDATE') {
    return effectiveItems.some((item) => ['commitment.intervention', 'athlete_plan.intervention'].includes(item.field)) ? 'INTERVENTION' : 'COMMITMENT';
  }
  const fields = effectiveItems.map((item) => item.field.toLowerCase());
  if (fields.some((field) => /^(?:evidence|athlete_evidence)\.(?:execution_)?outcome(?:_|$)/u.test(field))) return 'OUTCOME';
  if (fields.some((field) => /^(?:evidence|athlete_evidence)\.(?:attempt|experiment|execution_degree)(?:_|$)/u.test(field))) return 'ATTEMPT';
  if (fields.some((field) => /^(?:evidence|athlete_evidence)\.decision(?:_|$)/u.test(field))) return 'DECISION';
  if (fields.some((field) => /^(?:evidence|athlete_evidence)\.friction(?:_|$)/u.test(field))) return 'FRICTION';
  if (fields.some((field) => /^(?:evidence|athlete_evidence)\.(?:operating_change|changed_reality|state_change)(?:_|$)/u.test(field))) return 'STATE_CHANGE';
  return PROPOSAL_EVENT_TYPES[proposal.proposal_type];
}

export function createConfirmedPersonalRslMutation({ proposal, decision, evidence_catalog = [], active_personal_rsl_events = [], event_id, recorded_at }) {
  const proposalValidation = validateGovernedChangeProposal(proposal);
  const decisionValidation = validateProposalDecision(decision, proposal);
  if (!proposalValidation.valid || !decisionValidation.valid) return deepFreeze({ ok: false, code: 'AFW05_MUTATION_AUTHORITY_INVALID' });
  if (!decision.mutation_authorized) return deepFreeze({ ok: false, code: 'AFW05_CONFIRMATION_REQUIRED' });
  const byId = new Map(evidence_catalog.map((item) => [item.evidence_id, item]));
  const evidenceRefs = [];
  for (const evidenceId of proposal.evidence_ref_ids) {
    const source = byId.get(evidenceId);
    if (!source) return deepFreeze({ ok: false, code: 'AFW05_EVIDENCE_REFERENCE_UNRESOLVED', evidence_id: evidenceId });
    evidenceRefs.push(createEvidenceReference(source));
  }
  const eventType = evidenceEventType(proposal, decision.effective_items);
  if (!eventType) return deepFreeze({ ok: false, code: 'AFW05_PROPOSAL_EVENT_MAPPING_MISSING' });
  if (eventType === 'CORRECTION' && proposal.supersedes_event_ids.some((id) => active_personal_rsl_events.some((event) => event.event_id === id && event.semantic_payload?.lineage))) {
    const binding = correctionTargetContext({ scope: proposal.scope, proposal: { ...proposal, proposed_items: decision.effective_items }, active_events: active_personal_rsl_events });
    if (!binding.ok) return binding;
  }
  const lineage = createConfirmedLineageMetadata({
    proposal,
    decision,
    event_type: eventType,
    effective_items: decision.effective_items,
    active_events: active_personal_rsl_events,
  });
  if (!lineage.ok) return lineage;
  const athleteScope = proposal.scope?.domain === 'ATHLETE';
  const primaryObject = proposal.affected_governed_objects[0];
  return createPersonalRslEvent({
    event_id,
    scope: proposal.scope,
    session_id: proposal.source_session_id,
    event_type: eventType,
    effective_at: decision.decided_at,
    recorded_at,
    source_class: athleteScope ? 'JOINT_HUMAN_AGREEMENT' : 'CUSTOMER_SELF_REPORT',
    actor: decision.actor,
    establishing_authority: createAuthorityReference({
      authority_id: `${athleteScope ? 'athlete_instructor_joint_confirmation' : 'customer_confirmation'}:${decision.decision_id}`,
      authority_version: '1.0.0',
      authority_hash: decision.decision_hash,
    }),
    semantic_payload: {
      proposal_id: proposal.proposal_id,
      proposal_hash: proposal.proposal_hash,
      decision_id: decision.decision_id,
      decision_hash: decision.decision_hash,
      target_contract: proposal.target_contract,
      affected_governed_objects: proposal.affected_governed_objects,
      items: decision.effective_items,
      summary: proposal.summary,
      ...(athleteScope ? { original_reason: proposal.reason } : {}),
      purpose: athleteScope ? 'ATHLETE_LIVING_CONSULT_SHARED'
        : proposal.proposal_type === 'PLAN_CHANGE_CANDIDATE' ? 'FINISH_PLAN_135' : 'WEEKLY_COACHING',
      lens: athleteScope ? (primaryObject === 'CURRENT_REALITY' ? 'YOUR_SPORT' : primaryObject)
        : primaryObject === 'PLAN_135' ? 'PLAN' : primaryObject,
      privacy_classification: 'TENANT_PRIVATE',
      raw_transcript_persisted: false,
      lineage: lineage.lineage,
    },
    evidence_refs: evidenceRefs,
    supersedes_event_ids: proposal.supersedes_event_ids,
    retracts_event_ids: proposal.retracts_event_ids,
    confirmation_event_id: decision.decision_id,
  });
}

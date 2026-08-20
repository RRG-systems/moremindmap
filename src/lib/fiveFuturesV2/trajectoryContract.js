import {
  FUTURE_ROLES,
  PROHIBITED_MODEL_WEIGHT_FIELDS,
  ROLE_PURPOSES,
  SUPPORT_COMPONENTS,
} from './constants.js';

export function buildTrajectoryGenerationMission(context) {
  return Object.freeze({
    mission_id: 'five-futures-v2-trajectory-generation',
    doctrine: [
      'Understand the frozen Whole-Business Model before constructing any trajectory.',
      'Produce exactly the five locked semantic roles in locked order.',
      'Current Course follows actual momentum and may be good or bad.',
      'Emerging Future requires governed evidence that meaningful change is already occurring.',
      'Better Future requires a named causal bridge from current reality through meaningful changes to changed mechanisms.',
      'Bold Future may have low current support but must remain causally plausible and bounded.',
      'Downside Future requires evidence-supported vulnerability or constraint activation without catastrophe theater.',
      'Thin evidence lowers detail and support; it does not remove a role or authorize fabrication.',
      'Whole-Person and team context may modify feasibility only within business-supported trajectories.',
      'Dynamic dependencies may only surface a warrant already present in the WBM.',
      'Return structured meaning, never customer prose, cards, coaching realization, or One Move.',
      'Do not author numerical weights, percentages, probabilities, or component contributions.',
    ],
    role_contract: FUTURE_ROLES.map((future_role) => ({
      future_role,
      purpose: ROLE_PURPOSES[future_role],
    })),
    required_future_fields: [
      'future_role', 'future_id', 'title', 'state_summary', 'business_state_if_realized',
      'governing_mechanisms', 'supporting_evidence_refs', 'counterevidence_refs', 'assumptions',
      'required_changes', 'leading_indicators', 'risks', 'falsifiers',
      'operator_business_interactions', 'team_dependencies', 'dynamic_context_dependencies',
      'certainty_support_classification', 'conditionality', 'support_signals',
    ],
    support_signal_contract: SUPPORT_COMPONENTS.map((component) => ({
      component_id: component.component_id,
      allowed_levels: Object.keys(component.levels),
      instruction: `Select the supported categorical level for ${component.meaning} Do not convert it to a number.`,
    })),
    prohibited_output_fields: PROHIBITED_MODEL_WEIGHT_FIELDS,
    context,
  });
}

export function createTrajectoryGenerationAdapter({ generate }) {
  if (typeof generate !== 'function') throw new TypeError('trajectory_generation_adapter_requires_generate_function');
  return Object.freeze({
    adapter_id: 'five-futures-v2-frontier-trajectory-adapter-v1',
    store: false,
    async generate(context) {
      return generate({ mission: buildTrajectoryGenerationMission(context), store: false });
    },
  });
}

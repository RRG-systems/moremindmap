import {
  CONFIDENCE_STATES,
  DIMENSIONS,
  NEW_BOS_DEPTH_CONTRACT_VERSION,
  ROLE_FIT_STATES,
  SURFACES,
} from '../../../src/lib/newBosPersonalityDnaV1/constants.js';

const text = Object.freeze({ type: 'string', minLength: 1 });

export const NEW_BOS_REASONING_OUTPUT_BUDGET = Object.freeze({
  max_output_tokens: 64_000,
  text_verbosity: 'low',
  array_limits: Object.freeze({
    topology: 6,
    attributes: 8,
    dynamics: 6,
    surface_claims: 18,
    generic_semantic_list: 12,
  }),
});

function object(properties) {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

function array(items, minItems = 0, maxItems = NEW_BOS_REASONING_OUTPUT_BUDGET.array_limits.generic_semantic_list) {
  const schema = { type: 'array', items, minItems };
  schema.maxItems = maxItems;
  return schema;
}

function stringArray(minimum = 0, maximum = NEW_BOS_REASONING_OUTPUT_BUDGET.array_limits.generic_semantic_list) {
  return array(text, minimum, maximum);
}

function referenceArray(evidenceIds, minimum = 0) {
  return array({ type: 'string', enum: evidenceIds }, minimum, Math.max(minimum, evidenceIds.length));
}

function evidenceBound(fields, evidenceIds, minimumRefs = 1) {
  return object({
    ...fields,
    confidence: { type: 'string', enum: CONFIDENCE_STATES },
    evidence_refs: referenceArray(evidenceIds, minimumRefs),
    counterevidence_refs: referenceArray(evidenceIds),
    confounds: stringArray(0, 6),
    falsifier: text,
  });
}

function claim(evidenceIds) {
  return object({
    id: text,
    statement: text,
    evidence_refs: referenceArray(evidenceIds, 1),
    counterevidence_refs: referenceArray(evidenceIds),
    confounds: stringArray(0, 6),
    confidence: { type: 'string', enum: CONFIDENCE_STATES },
    what_would_change_it: text,
  });
}

function energyLayer(evidenceIds) {
  return object({
    status: { type: 'string', enum: CONFIDENCE_STATES },
    summary: text,
    evidence_refs: referenceArray(evidenceIds, 1),
    falsifier: text,
  });
}

export function buildNewBosReasoningSchema(evidenceIds) {
  const refs = [...evidenceIds];
  const claimSchema = claim(refs);
  const surfaceLists = Object.fromEntries(SURFACES.map(({ id }) => [
    id,
    stringArray(1, NEW_BOS_REASONING_OUTPUT_BUDGET.array_limits.surface_claims),
  ]));

  return object({
    topology: array(claimSchema, 4, NEW_BOS_REASONING_OUTPUT_BUDGET.array_limits.topology),
    attributes: array(object({
      id: text,
      statement: text,
      evidence_refs: referenceArray(refs, 1),
      counterevidence_refs: referenceArray(refs),
      confounds: stringArray(0, 6),
      confidence: { type: 'string', enum: CONFIDENCE_STATES },
      what_would_change_it: text,
      subdimensions: object({ availability: text, evidence_band: text }),
    }), 8, NEW_BOS_REASONING_OUTPUT_BUDGET.array_limits.attributes),
    dynamics: array(claimSchema, 4, NEW_BOS_REASONING_OUTPUT_BUDGET.array_limits.dynamics),
    specialized: object({
      version: { type: 'string', const: NEW_BOS_DEPTH_CONTRACT_VERSION },
      recognition: object({
        mechanisms: array(evidenceBound({ label: text, explanation: text }, refs), 3, 4),
        private_calculations: stringArray(2, 6),
        recognizable_moments: stringArray(3, 8),
        tensions: stringArray(1, 4),
      }),
      personality_dna: object({
        coordinate_explanations: array(evidenceBound({
          coordinate_id: { type: 'string', enum: DIMENSIONS.map(({ id }) => id) },
          label: text,
          availability: text,
          interaction: text,
          not_meaning: text,
        }, refs), 8, 8),
        topology_summary: text,
        speed: text,
        temperature: text,
      }),
      operating_engine: object({
        loop: stringArray(3, 6),
        mechanisms: array(evidenceBound({ label: text, explanation: text }, refs), 2, 4),
      }),
      people_experience: object({
        states: array(evidenceBound({ label: text, hypothesis: text }, refs), 2, 4),
        observer_boundary: text,
      }),
      communication: object({
        speed: text,
        temperature: text,
        dimensions: array(evidenceBound({ label: text, continuum: text, interpretation: text }, refs), 2, 8),
      }),
      strengths_vulnerabilities: object({
        mechanisms: array(evidenceBound({
          strength: text,
          immediate_payoff: text,
          reinforcement: text,
          delayed_cost: text,
          conditions: text,
        }, refs), 3, 4),
      }),
      pressure_conflict: object({
        baseline: text,
        pressure_state: text,
        recovery: text,
        transformations: array(evidenceBound({ label: text, baseline: text, pressure_expression: text, recovery: text }, refs), 2, 4),
        conflict_entry: text,
        judgment_effect: text,
        relational_effect: text,
      }),
      work_environment: object({
        demands: array(evidenceBound({ demand: text, natural_fit: text, adaptation_cost: text, sustainability: text }, refs), 2, 4),
        fit_summary: text,
        friction_summary: text,
      }),
      role_seat: object({
        selected_fit: { type: 'string', enum: ROLE_FIT_STATES },
        selected_configuration: text,
        fit_states: array(evidenceBound({ fit_class: text, role_configuration: text, reasoning: text }, refs), 3, 4),
        scaffolding: stringArray(1, 4),
        plural_success_note: text,
        review_trigger: text,
      }),
      leadership: evidenceBound({
        pattern: text,
        transfer_gap: text,
        complementary_team_effect: text,
      }, refs),
      cognition: object({
        boundary: text,
        indicators: array(evidenceBound({
          indicator: text,
          task_demand: text,
          observed_process: text,
          outcome: text,
          correction_transfer: text,
          assistance: text,
        }, refs), 2, 4),
      }),
      energy: object({
        trait: energyLayer(refs),
        state: energyLayer(refs),
        context: energyLayer(refs),
        trajectory: energyLayer(refs),
        activation: text,
        depletion: text,
        resilience: text,
        recovery: text,
      }),
      five_futures: object({
        items: array(evidenceBound({
          future_identity: text,
          label: text,
          condition: text,
          mechanism: text,
          trajectory: text,
          triggers: text,
          indicators: text,
          movers: text,
          horizon: text,
          review_trigger: text,
        }, refs), 5, 5),
      }),
      one_move: evidenceBound({
        target_mechanism: text,
        intervention: text,
        rationale: text,
        strength_preserved: text,
        expected_outcome: text,
        burden: text,
        risk: text,
        reversibility: text,
        observable_result: text,
        horizon: text,
        stop_adjust_condition: text,
        alternatives_considered: stringArray(0, 4),
      }, refs),
      validation: object({
        claims: array(evidenceBound({ human_label: text, claim: text, inference_boundary: text }, refs), 6, 8),
        conflicts: stringArray(0, 4),
        what_would_change_the_map: stringArray(2, 4),
      }),
      operating_identity: object({
        governing_logic: text,
        memorable_use: text,
        not_a_type: text,
        evidence_refs: referenceArray(refs, 1),
        confidence: { type: 'string', enum: CONFIDENCE_STATES },
        falsifier: text,
      }),
      visual_bos: object({
        primary_pattern: text,
        secondary_pattern: text,
        tertiary_pattern: text,
        operating_core: text,
        inputs: stringArray(1, 4),
        outputs: stringArray(1, 4),
        operating_loop: stringArray(3, 6),
        energy_source: text,
        fatigue_source: text,
        central_tension: text,
        transfer_gap: text,
        pressure_shift: text,
        recovery_path: text,
        environment_fit: text,
        environment_risk: text,
        signals: stringArray(3, 6),
      }),
    }),
    sequences: array(object({ id: text, steps: stringArray(3, 6), evidence_refs: referenceArray(refs, 1) }), 1, 2),
    strengths_and_overuse: array(evidenceBound({
      strength: text,
      immediate_payoff: text,
      reinforcement: text,
      delayed_cost: text,
      conditions: text,
    }, refs), 3, 4),
    compensation: array(object({ id: text, statement: text, evidence_refs: referenceArray(refs, 1) }), 0, 2),
    whole_person: object({
      core_explanation: text,
      central_tension: text,
      mechanisms: stringArray(3, 5),
      identity_tensions: stringArray(1, 4),
      goal_conflicts: stringArray(1, 12),
      private_calculations: stringArray(2, 4),
      pressure_and_recovery: text,
      work_and_relationships: text,
      identity_distillation: text,
      evidence_refs: referenceArray(refs, 2),
      confidence: { type: 'string', enum: CONFIDENCE_STATES },
      what_would_change_it: text,
    }),
    abstentions: stringArray(1, 12),
    validation_backlog: stringArray(2, 4),
    surface_claims: object(surfaceLists),
    surface_evidence_refs: object(Object.fromEntries(SURFACES.map(({ id }) => [id, referenceArray(refs, 1)]))),
  });
}

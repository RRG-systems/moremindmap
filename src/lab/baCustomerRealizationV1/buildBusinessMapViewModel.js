const EXPECTED = Object.freeze({
  profileId: 'mm-20260708-dsst020z',
  assessmentId: 'ba-20260714-64ca0783',
  businessId: 'business-ba-20260714-64ca0783',
  wbmStateHash: 'd51d01c4e807a3341e6b76178c8e33a0050d7bb0653b887aaaf0bfc515255eba',
  futuresHash: 'b245bcb9f12ef7e1cd02c6d1433ee733cff51a85a873bb98fe652db05a00d148',
  oneMoveHash: '2e087bc4ea5b56212e7fefa5b00a33bbbb1c13e651351ca956176a017f4f4447',
  lineageHash: '21af9b7c7a687a4f6cc2fd35d5566c18b10f9e72de072600f203331fda6f566a',
  selectedCandidateId: 'patricia-candidate-ownership-transfer-trial-v1',
  selectedMoveTitle: 'End-to-end ownership transfer trial',
  byteHashes: Object.freeze({
    wholeBusinessModel: 'f1d4179850f7901ce9b37f020a24538319ca671b8cc125330143d03aa2b48636',
    fiveFutures: '371adf8cd4f0844cb818331e555cf24f069d72b468c42ea77e6e142efc675de6',
    oneMove: 'c8d846dd03337d19f968dbde1ec4f9560e8bae45258d71957b72608ebc6935aa',
    lineage: 'd1e72d9693f9f8e16f9f3beb95b6f291a3cfabba62c0ccf264a0821987ec48a8',
  }),
  futureRoles: Object.freeze(['current_course', 'emerging_future', 'better_future', 'bold_future', 'downside_future']),
  futureWeights: Object.freeze([27, 15, 20, 12, 26]),
});

const SOURCE = Object.freeze({
  wbm: 'canonical/PATRICIA_WHOLE_BUSINESS_MODEL_V1.json',
  futures: 'canonical/PATRICIA_FIVE_FUTURES_V2.json',
  move: 'canonical/PATRICIA_ONE_MOVE_V2.json',
  lineage: 'canonical/PATRICIA_CANONICAL_TRIPLET_LINEAGE_MANIFEST_V1.json',
});

const DOMAIN_LABELS = Object.freeze({
  demand: 'Demand', goals: 'Goals', relationship: 'Relationship asset', accountability: 'Accountability',
  operations: 'Execution', financial: 'Financial visibility', constraints: 'Constraints', team: 'Team',
  capacity: 'Capacity', market: 'Market context', stage: 'Business stage', conversion: 'Conversion',
  pipeline: 'Pipeline', listing: 'Listing', buyer: 'Buyer', transaction: 'Transaction',
});

const FUTURE_LABELS = Object.freeze({
  current_course: 'Current Course', emerging_future: 'Emerging Future', better_future: 'Better Future',
  bold_future: 'Bold Future', downside_future: 'Downside Future',
});

const FORBIDDEN_CUSTOMER_LANGUAGE = /(?:\bWBM\b|WBM_CONTEXT|\bBOS\b|\bstate hash\b|\bauthority ref(?:erence)?\b|\bprojection eligibility\b|\bassembler\b|\bprovider\b|\bschema\b|\binference packet\b|\bprofile id\b|\bassessment id\b|\bSHA-?256\b)/iu;
const RAW_EVIDENCE_REFERENCE = /ba-\d{8}-[a-z0-9]+-q\d+/iu;

function invariant(condition, code) {
  if (condition) return;
  const error = new Error(code);
  error.code = code;
  throw error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function validateInputs({ wholeBusinessModel: wbm, fiveFutures, oneMove, lineage, sourceFileDigests }) {
  invariant(wbm && fiveFutures && oneMove && lineage, 'BA_REALIZATION_CANONICAL_INPUT_MISSING');
  invariant(sourceFileDigests && Object.entries(EXPECTED.byteHashes).every(([key, hash]) => sourceFileDigests[key] === hash), 'BA_REALIZATION_CANONICAL_FILE_HASH_DRIFT');
  const identity = wbm.assessment_identity;
  invariant(identity?.owner_profile_id === EXPECTED.profileId && identity?.assessment_id === EXPECTED.assessmentId && identity?.business_id === EXPECTED.businessId, 'BA_REALIZATION_WRONG_PATRICIA_IDENTITY');
  invariant(wbm.state_hash === EXPECTED.wbmStateHash, 'BA_REALIZATION_WBM_HASH_DRIFT');
  invariant(fiveFutures.owner_profile_id === EXPECTED.profileId && fiveFutures.business_id === EXPECTED.businessId, 'BA_REALIZATION_FUTURES_IDENTITY_DRIFT');
  invariant(fiveFutures.artifact_hash === EXPECTED.futuresHash && fiveFutures.whole_business_model_binding?.whole_business_model_hash === EXPECTED.wbmStateHash, 'BA_REALIZATION_FUTURES_BINDING_DRIFT');
  invariant(oneMove.owner_profile_id === EXPECTED.profileId && oneMove.business_id === EXPECTED.businessId, 'BA_REALIZATION_ONE_MOVE_IDENTITY_DRIFT');
  invariant(oneMove.artifact_hash === EXPECTED.oneMoveHash && oneMove.whole_business_model_binding?.hash === EXPECTED.wbmStateHash && oneMove.five_futures_binding?.hash === EXPECTED.futuresHash, 'BA_REALIZATION_ONE_MOVE_BINDING_DRIFT');
  invariant(oneMove.title === EXPECTED.selectedMoveTitle && oneMove.provenance?.selected_candidate_id === EXPECTED.selectedCandidateId && oneMove.provenance?.deterministic_selection === true && oneMove.provenance?.frontier_selected_winner === false, 'BA_REALIZATION_ONE_MOVE_SELECTION_DRIFT');
  const roles = fiveFutures.futures?.map((future) => future.future_role) || [];
  const weights = fiveFutures.futures?.map((future) => future.normalized_relative_support_weight) || [];
  invariant(JSON.stringify(roles) === JSON.stringify(EXPECTED.futureRoles), 'BA_REALIZATION_FUTURE_ROLE_DRIFT');
  invariant(JSON.stringify(weights) === JSON.stringify(EXPECTED.futureWeights) && weights.reduce((sum, weight) => sum + weight, 0) === 100, 'BA_REALIZATION_FUTURE_WEIGHT_DRIFT');
  invariant(fiveFutures.support_semantics === 'UNCALIBRATED_RELATIVE_SUPPORT', 'BA_REALIZATION_SUPPORT_SEMANTICS_DRIFT');
  invariant(lineage.profile_id === EXPECTED.profileId && lineage.assessment_id === EXPECTED.assessmentId && lineage.cross_artifact_lineage_hash === EXPECTED.lineageHash, 'BA_REALIZATION_LINEAGE_DRIFT');
  invariant(lineage.artifacts?.whole_business_model_v1?.state_hash === EXPECTED.wbmStateHash && lineage.artifacts?.five_futures_v2?.artifact_hash === EXPECTED.futuresHash && lineage.artifacts?.one_move_v2?.artifact_hash === EXPECTED.oneMoveHash, 'BA_REALIZATION_LINEAGE_BINDING_DRIFT');
  invariant(lineage.legacy_assessment_output_used === false && lineage.team_profiles_bound === false, 'BA_REALIZATION_AUTHORITY_BOUNDARY_DRIFT');
  return deepFreeze({ status: 'PASS', profileId: EXPECTED.profileId, assessmentId: EXPECTED.assessmentId, byteHashes: { ...sourceFileDigests } });
}

function createProjectionRecorder() {
  const entries = [];
  const counts = new Map();
  const record = (surface, sourceArtifact, sourcePath, value) => {
    const key = `${surface}:${sourcePath}`;
    const occurrence = (counts.get(key) || 0) + 1;
    counts.set(key, occurrence);
    entries.push({
      projection_id: `${surface.toLowerCase()}-${String(entries.length + 1).padStart(3, '0')}`,
      surface,
      source_artifact: sourceArtifact,
      source_path: sourcePath,
      occurrence,
      customer_value_type: typeof value,
      customer_value: value,
    });
    return value;
  };
  return { entries, record };
}

function projectArray(record, surface, artifact, basePath, values = [], mapper = (value) => value, leafPath = '') {
  return values.map((value, index) => {
    const projected = mapper(value, index);
    return record(surface, artifact, `${basePath}[${index}]${leafPath}`, projected);
  });
}

function createBusinessMapProjection(input) {
  const validation = validateInputs(input);
  const { wholeBusinessModel: wbm, fiveFutures, oneMove } = input;
  const { entries, record } = createProjectionRecorder();
  const domainState = (id) => wbm.current_business_reality[id];
  const domain = (id, surface = 'NOW') => ({
    id,
    label: DOMAIN_LABELS[id],
    statement: record(surface, SOURCE.wbm, `current_business_reality.${id}.state`, domainState(id).state),
  });
  const leaderMechanismIndex = wbm.causal_model.mechanisms.findIndex((mechanism) => mechanism.mechanism_id === 'patricia-mech-leader-centered-operating-bottleneck-v1');
  invariant(leaderMechanismIndex >= 0, 'BA_REALIZATION_PRIMARY_MECHANISM_MISSING');
  const leaderMechanism = wbm.causal_model.mechanisms[leaderMechanismIndex];

  const futures = fiveFutures.futures.map((future, index) => ({
    role: future.future_role,
    label: FUTURE_LABELS[future.future_role],
    title: record('FUTURES', SOURCE.futures, `futures[${index}].title`, future.title),
    weight: record('FUTURES', SOURCE.futures, `futures[${index}].normalized_relative_support_weight`, future.normalized_relative_support_weight),
    summary: record('FUTURES', SOURCE.futures, `futures[${index}].state_summary`, future.state_summary),
    businessState: record('FUTURES', SOURCE.futures, `futures[${index}].business_state_if_realized`, future.business_state_if_realized),
    conditionality: record('FUTURES', SOURCE.futures, `futures[${index}].conditionality`, future.conditionality),
    changes: projectArray(record, 'FUTURES', SOURCE.futures, `futures[${index}].required_changes`, future.required_changes),
    indicators: projectArray(record, 'FUTURES', SOURCE.futures, `futures[${index}].leading_indicators`, future.leading_indicators),
    risks: projectArray(record, 'FUTURES', SOURCE.futures, `futures[${index}].risks`, future.risks),
    falsifiers: projectArray(record, 'FUTURES', SOURCE.futures, `futures[${index}].falsifiers`, future.falsifiers),
    moveRelationship: record('FUTURES', SOURCE.move, `trajectory_effect_intent[${index}].intent`, oneMove.trajectory_effect_intent[index].intent),
  }));

  const nowDomainIds = ['demand', 'relationship', 'operations', 'financial', 'team', 'capacity'];
  const nowRealities = nowDomainIds.map((id) => domain(id));
  const assets = projectArray(record, 'NOW', SOURCE.wbm, 'assets', wbm.assets.slice(0, 4), (asset) => asset.meaning, '.meaning');
  const vulnerabilities = projectArray(record, 'NOW', SOURCE.wbm, 'vulnerabilities', wbm.vulnerabilities.slice(0, 4), (item) => item.meaning, '.meaning');
  const customerVisibleMissingEvidence = wbm.epistemic_state.missing_evidence
    .map((gap, sourceIndex) => ({ gap, sourceIndex }))
    .filter(({ gap }) => !FORBIDDEN_CUSTOMER_LANGUAGE.test(gap.question));
  const learningGaps = customerVisibleMissingEvidence.map(({ gap, sourceIndex }) => (
    record('NOW', SOURCE.wbm, `epistemic_state.missing_evidence[${sourceIndex}].question`, gap.question)
  ));

  const mechanisms = wbm.causal_model.mechanisms.map((mechanism, index) => ({
    title: record('WHY', SOURCE.wbm, `causal_model.mechanisms[${index}].observed_symptom`, mechanism.observed_symptom),
    mechanism: record('WHY', SOURCE.wbm, `causal_model.mechanisms[${index}].underlying_mechanism`, mechanism.underlying_mechanism),
    chain: projectArray(record, 'WHY', SOURCE.wbm, `causal_model.mechanisms[${index}].causal_chain`, mechanism.causal_chain),
    confounds: projectArray(record, 'WHY', SOURCE.wbm, `causal_model.mechanisms[${index}].confounds`, mechanism.confounds),
    falsifier: record('WHY', SOURCE.wbm, `causal_model.mechanisms[${index}].falsifier`, mechanism.falsifier),
  }));

  const knownClaimCandidates = wbm.domain_states.flatMap((state, domainIndex) => state.claims.map((claim, claimIndex) => ({
    ...claim,
    sourcePath: `domain_states[${domainIndex}].claims[${claimIndex}].meaning`,
  }))).filter((claim) => claim.epistemic_class === 'KNOWN');
  const knownClaimMeanings = unique(knownClaimCandidates.map((claim) => claim.meaning)).slice(0, 8);
  const knownClaims = knownClaimMeanings.map((meaning) => {
    const claim = knownClaimCandidates.find((candidate) => candidate.meaning === meaning);
    return record('EVIDENCE', SOURCE.wbm, claim.sourcePath, meaning);
  });
  const believed = wbm.causal_model.mechanisms.map((mechanism, index) => (
    record('EVIDENCE', SOURCE.wbm, `causal_model.mechanisms[${index}].underlying_mechanism`, mechanism.underlying_mechanism)
  ));
  const stillLearning = customerVisibleMissingEvidence.map(({ gap, sourceIndex }) => (
    record('EVIDENCE', SOURCE.wbm, `epistemic_state.missing_evidence[${sourceIndex}].question`, gap.question)
  ));
  const mindChanges = projectArray(record, 'EVIDENCE', SOURCE.wbm, 'epistemic_state.mind_change_conditions', wbm.epistemic_state.mind_change_conditions);

  const viewModel = {
    identity: {
      firstName: 'Patricia',
      fullName: input.displayName || 'Patricia Gutierrez',
      vertical: 'Real estate',
      title: 'Your Business Map',
      subtitle: 'A clear view of what is happening now, what is driving it, where it can lead, and the move that matters first.',
    },
    orientation: {
      whereYouAre: [domain('relationship', 'ORIENTATION'), domain('demand', 'ORIENTATION'), domain('operations', 'ORIENTATION'), domain('financial', 'ORIENTATION'), domain('capacity', 'ORIENTATION')],
      whatMatters: {
        constraint: record('ORIENTATION', SOURCE.wbm, 'governing_constraint.candidate', wbm.governing_constraint.candidate),
        mechanism: record('ORIENTATION', SOURCE.wbm, `causal_model.mechanisms[${leaderMechanismIndex}].underlying_mechanism`, leaderMechanism.underlying_mechanism),
        move: record('ORIENTATION', SOURCE.move, 'title', oneMove.title),
        leverage: record('ORIENTATION', SOURCE.move, 'intervention', oneMove.intervention),
        proof: record('ORIENTATION', SOURCE.move, 'leading_indicators[0]', oneMove.leading_indicators[0]),
      },
      whereYouAreGoing: fiveFutures.futures.map((future, index) => ({
        role: future.future_role,
        label: FUTURE_LABELS[future.future_role],
        title: record('ORIENTATION', SOURCE.futures, `futures[${index}].title`, future.title),
        weight: record('ORIENTATION', SOURCE.futures, `futures[${index}].normalized_relative_support_weight`, future.normalized_relative_support_weight),
      })),
    },
    lenses: {
      now: {
        id: 'now', label: 'Now', question: 'What is true about my business right now?',
        headline: record('NOW', SOURCE.wbm, 'current_business_reality.goals.state', domainState('goals').state),
        realities: nowRealities, assets, vulnerabilities, learningGaps,
      },
      why: {
        id: 'why', label: 'Why', question: 'Why is my business actually working this way?',
        constraint: record('WHY', SOURCE.wbm, 'governing_constraint.candidate', wbm.governing_constraint.candidate),
        whyStronger: record('WHY', SOURCE.wbm, 'governing_constraint.why_current_candidate_stronger', wbm.governing_constraint.why_current_candidate_stronger),
        alternatives: projectArray(record, 'WHY', SOURCE.wbm, 'governing_constraint.alternatives', wbm.governing_constraint.alternatives, (item) => item.explanation, '.explanation'),
        mechanisms,
        loops: projectArray(record, 'WHY', SOURCE.wbm, 'causal_model.balancing_loops', wbm.causal_model.balancing_loops),
        counterevidence: projectArray(record, 'WHY', SOURCE.wbm, 'epistemic_state.counterevidence', wbm.epistemic_state.counterevidence),
        momentum: record('WHY', SOURCE.wbm, 'momentum.direction', wbm.momentum.direction === 'UNCERTAIN' ? 'Direction of travel is not established yet.' : wbm.momentum.direction),
        causalThread: projectArray(record, 'WHY', SOURCE.wbm, `causal_model.mechanisms[${leaderMechanismIndex}].causal_chain`, leaderMechanism.causal_chain.slice(0, 3)),
      },
      futures: {
        id: 'futures', label: 'Futures', question: 'Where is this heading?',
        explanation: 'These weights show modeled relative support across five conditional paths. They are not forecasts or certainty estimates.',
        futures,
      },
      move: {
        id: 'move', label: 'Move', question: 'What should I do first?',
        title: record('MOVE', SOURCE.move, 'title', oneMove.title),
        intervention: record('MOVE', SOURCE.move, 'intervention', oneMove.intervention),
        whyNow: record('MOVE', SOURCE.move, 'why_now', oneMove.why_now),
        symptomDistinction: record('MOVE', SOURCE.move, 'symptom_distinction', oneMove.symptom_distinction),
        causalChain: projectArray(record, 'MOVE', SOURCE.move, 'causal_chain', oneMove.causal_chain),
        reversibility: record('MOVE', SOURCE.move, 'reversibility_class', oneMove.reversibility_class === 'BOUNDED_TEST' ? 'Bounded test' : oneMove.reversibility_class),
        dependency: record('MOVE', SOURCE.move, 'dependency_burden', oneMove.dependency_burden === 'MODERATE' ? 'Moderate coordination required' : oneMove.dependency_burden),
        logicChain: [
          { label: 'Constraint', value: record('MOVE', SOURCE.wbm, `causal_model.mechanisms[${leaderMechanismIndex}].observed_symptom`, leaderMechanism.observed_symptom) },
          { label: 'Mechanism', value: record('MOVE', SOURCE.wbm, `causal_model.mechanisms[${leaderMechanismIndex}].underlying_mechanism`, leaderMechanism.underlying_mechanism) },
          { label: 'Intervention', value: record('MOVE', SOURCE.move, 'intervention', oneMove.intervention) },
          { label: 'Proof', value: record('MOVE', SOURCE.move, 'success_evidence[0]', oneMove.success_evidence[0]) },
        ],
        proof: projectArray(record, 'MOVE', SOURCE.move, 'leading_indicators', oneMove.leading_indicators),
        success: projectArray(record, 'MOVE', SOURCE.move, 'success_evidence', oneMove.success_evidence),
        failure: projectArray(record, 'MOVE', SOURCE.move, 'failure_evidence', oneMove.failure_evidence),
        observation: record('MOVE', SOURCE.move, 'observation_horizon', oneMove.observation_horizon),
      },
      plan: {
        id: 'plan', label: 'Plan', question: 'What does execution look like from here?',
        prerequisites: projectArray(record, 'PLAN', SOURCE.move, 'prerequisites', oneMove.prerequisites),
        steps: projectArray(record, 'PLAN', SOURCE.move, 'bounded_execution_steps', oneMove.bounded_execution_steps),
        ownerBoundary: record('PLAN', SOURCE.move, 'owner_role', oneMove.owner_role),
        fitAdjustments: projectArray(record, 'PLAN', SOURCE.move, 'whole_person_execution_considerations', oneMove.whole_person_execution_considerations, (item) => item.execution_adjustment, '.execution_adjustment'),
        stopConditions: projectArray(record, 'PLAN', SOURCE.move, 'stop_or_reconsider_conditions', oneMove.stop_or_reconsider_conditions),
        proofTargets: projectArray(record, 'PLAN', SOURCE.move, 'success_evidence', oneMove.success_evidence),
        observation: record('PLAN', SOURCE.move, 'observation_horizon', oneMove.observation_horizon),
        futureOneThreeFive: null,
      },
      evidence: {
        id: 'evidence', label: 'Evidence', question: 'Why should I trust this?',
        known: knownClaims,
        believed,
        stillLearning,
        mindChanges,
      },
    },
    livingMapTransition: {
      title: 'From a frozen map to a living map',
      prompt: 'Your assessment captured your business at this moment. Keep your Business Map alive as the business changes.',
      explanation: 'A living map would carry forward new evidence, observed execution, changing conditions, and the next decision—without withholding anything in this assessment.',
      actionLabel: 'See what a living map means',
    },
  };

  const serialized = JSON.stringify(viewModel);
  invariant(!FORBIDDEN_CUSTOMER_LANGUAGE.test(serialized), 'BA_REALIZATION_TECHNICAL_LANGUAGE_LEAK');
  invariant(!RAW_EVIDENCE_REFERENCE.test(serialized), 'BA_REALIZATION_RAW_EVIDENCE_REFERENCE_LEAK');
  invariant(!/Most Likely Next|Constraint Future|Optimized Future|Transformational Future|Relationship Lake|three-second pause|CRM cadence/iu.test(serialized), 'BA_REALIZATION_LEGACY_INTELLIGENCE_LEAK');
  invariant(!/\bprobabilit(?:y|ies)\b/iu.test(serialized), 'BA_REALIZATION_PROBABILITY_LANGUAGE_LEAK');
  invariant(!/\b(?:Amber|Wally|Tammy|Darren)\b/iu.test(serialized), 'BA_REALIZATION_CROSS_PROFILE_LEAK');

  return deepFreeze({
    viewModel: deepFreeze(viewModel),
    validation,
    projectionTrace: deepFreeze({
      schema: 'more.ba_customer_realization_lab.projection_trace.v1',
      status: 'PASS',
      profile: 'Patricia Gutierrez',
      canonical_sources: SOURCE,
      projected_statement_count: entries.length,
      entries,
      customer_view_model_contains_trace: false,
    }),
  });
}

export function buildBusinessMapViewModel(input) {
  return createBusinessMapProjection(input).viewModel;
}

export function buildBusinessMapProjectionTrace(input) {
  return createBusinessMapProjection(input).projectionTrace;
}

export function buildBusinessMapProjection(input) {
  return createBusinessMapProjection(input);
}

export { EXPECTED as PATRICIA_REALIZATION_AUTHORITY };

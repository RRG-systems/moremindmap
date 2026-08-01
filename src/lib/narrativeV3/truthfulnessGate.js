import {
  CLAIM_CLASSIFICATIONS,
  isSufficientClaim,
} from '../bosTruthfulness/evidenceContract.js';

const INSUFFICIENT = CLAIM_CLASSIFICATIONS.INSUFFICIENT;

function sectionClaims(section, truthfulness) {
  const claimIds = truthfulness?.section_claim_map?.[section] || [];
  return claimIds
    .map((claimId) => truthfulness?.claims_by_id?.[claimId])
    .filter(Boolean);
}

function groundingFromClaims(claims) {
  return [...new Set(claims.flatMap((claim) =>
    (Array.isArray(claim?.provenance) ? claim.provenance : [])
      .map(({ path }) => path)
      .filter(Boolean)
  ))];
}

function confidenceLabel(claim) {
  const band = claim?.confidence?.band || 'very_low';
  return band.replace(/_/g, ' ');
}

function truthfulText(claims) {
  const supported = claims.filter(isSufficientClaim);
  if (supported.length === 0) return INSUFFICIENT;
  return supported
    .map((claim) => `${claim.claim} Confidence: ${confidenceLabel(claim)}.`)
    .join(' ');
}

function common(section, rendering, claims) {
  return {
    ...rendering,
    section,
    claim_contracts: claims,
    truthfulness: {
      version: 'bos_truthfulness_v1',
      claim_ids: claims.map(({ claim_id }) => claim_id),
      sufficient_claim_count: claims.filter(isSufficientClaim).length,
      insufficient_claim_count: claims.filter((claim) => !isSufficientClaim(claim)).length,
    },
    grounding_used: groundingFromClaims(claims),
    groundingUsed: groundingFromClaims(claims),
  };
}

function buildInsufficientFutures() {
  return [
    'Current Trajectory',
    'Optimized Trajectory',
    'Overload Trajectory',
    'Leadership Trajectory',
    'Constraint Trajectory',
  ].map((title) => ({
    title,
    likelihood: 'insufficient_evidence',
    trajectory: INSUFFICIENT,
    organization_experiences: INSUFFICIENT,
  }));
}

function buildTeamExperience(section, rendering, claims) {
  const summary = truthfulText(claims);
  return common(section, {
    ...rendering,
    summary,
    first_impression: { interpretation: summary },
    communication_pattern: { interpretation: summary },
    listening_pattern: { interpretation: summary },
    relational_friction: { interpretation: summary },
    key_signals: [],
    causal_interpretation: summary,
    body: summary,
    key_warning: summary === INSUFFICIENT ? INSUFFICIENT : null,
  }, claims);
}

function buildFiveFutures(section, rendering, claims) {
  const claim = claims[0];
  const supported = isSufficientClaim(claim);
  const futures = supported
    ? rendering?.futures || buildInsufficientFutures()
    : buildInsufficientFutures();
  const summary = supported ? truthfulText(claims) : INSUFFICIENT;
  return common(section, {
    ...rendering,
    summary,
    most_likely: futures[0],
    futures,
    body: summary,
    key_warning: supported ? null : INSUFFICIENT,
  }, claims);
}

function buildRecommendation(section, rendering, claims) {
  const claim = claims[0];
  const supported = isSufficientClaim(claim);
  if (!supported) {
    return common(section, {
      ...rendering,
      headline: INSUFFICIENT,
      futureBottleneck: INSUFFICIENT,
      coreConstraint: INSUFFICIENT,
      highestLeverageLever: INSUFFICIENT,
      lowestValueDrag: INSUFFICIENT,
      roleTruth: INSUFFICIENT,
      interventionType: '',
      intervention: INSUFFICIENT,
      whyThisMatters: INSUFFICIENT,
      whatHappensIfIgnored: INSUFFICIENT,
      first30Days: [],
      proofSignals: [],
      confidence: 'very low',
      evidenceUsed: [],
      body: INSUFFICIENT,
      key_warning: INSUFFICIENT,
    }, claims);
  }

  const evidenceUsed = groundingFromClaims(claims);
  const body = `Hypothesis to Test\n\n${claim.claim}\n\nThis is a testable hypothesis, not a prediction or a proven highest-leverage intervention.`;
  return common(section, {
    ...rendering,
    headline: 'Hypothesis to Test',
    futureBottleneck: INSUFFICIENT,
    coreConstraint: claim.claim,
    highestLeverageLever: INSUFFICIENT,
    lowestValueDrag: INSUFFICIENT,
    roleTruth: INSUFFICIENT,
    interventionType: 'install_accountability',
    intervention: claim.claim,
    whyThisMatters: 'The hypothesis can be evaluated through observed follow-through rather than assumed psychological certainty.',
    whatHappensIfIgnored: INSUFFICIENT,
    first30Days: [
      'Choose one recurring decision or handoff to test.',
      'Write the decision criteria, owner, and review point.',
      'Record observed follow-through before drawing a conclusion.',
    ],
    proofSignals: [
      'The decision criteria were used as written.',
      'Observed follow-through changed or did not change.',
    ],
    confidence: confidenceLabel(claim),
    evidenceUsed,
    body,
    key_warning: 'Hypothesis only; validate with observed behavior.',
  }, claims);
}

function buildFacilitatorNotes(section, rendering, claims) {
  const claim = claims[0];
  const supported = isSufficientClaim(claim);
  const summary = supported ? claim.claim : INSUFFICIENT;
  return common(section, {
    ...rendering,
    summary,
    primary_guidance: summary,
    notes: supported
      ? [{
          label: 'Test the hypothesis',
          guidance: claim.claim,
          rationale: 'Use observed follow-through to confirm, revise, or reject the hypothesis.',
        }]
      : [],
    caution: supported
      ? 'This is a hypothesis to test, not a psychological conclusion.'
      : INSUFFICIENT,
    body: summary,
    key_warning: supported ? null : INSUFFICIENT,
  }, claims);
}

export function buildInsufficientEvidenceSection(section) {
  if (section === 'teamExperience') {
    return buildTeamExperience(section, {}, []);
  }
  if (section === 'fiveFutures') {
    return buildFiveFutures(section, {}, []);
  }
  if (section === 'recommendedNextStep') {
    return buildRecommendation(section, {}, []);
  }
  if (section === 'facilitatorNotes') {
    return buildFacilitatorNotes(section, {}, []);
  }

  return common(section, {
    headline: INSUFFICIENT,
    body: INSUFFICIENT,
    micro_scenario: null,
    key_warning: INSUFFICIENT,
  }, []);
}

function applyTruthfulnessGateInternal(section, rendering, truthfulness) {
  const claims = sectionClaims(section, truthfulness);
  if (claims.length === 0) {
    return buildInsufficientEvidenceSection(section);
  }

  if (section === 'teamExperience') {
    return buildTeamExperience(section, rendering, claims);
  }
  if (section === 'fiveFutures') {
    return buildFiveFutures(section, rendering, claims);
  }
  if (section === 'recommendedNextStep') {
    return buildRecommendation(section, rendering, claims);
  }
  if (section === 'facilitatorNotes') {
    return buildFacilitatorNotes(section, rendering, claims);
  }

  const body = truthfulText(claims);
  return common(section, {
    ...rendering,
    headline: rendering?.headline || section.replace(/([A-Z])/g, ' $1').trim(),
    body,
    micro_scenario: null,
    key_warning: body === INSUFFICIENT ? INSUFFICIENT : null,
  }, claims);
}

export function applyTruthfulnessGate(section, rendering, truthfulness) {
  try {
    return applyTruthfulnessGateInternal(section, rendering, truthfulness);
  } catch (error) {
    console.error(`[BOS TRUTHFULNESS FAIL CLOSED] section: ${section}`, error);
    return buildInsufficientEvidenceSection(section);
  }
}

export default applyTruthfulnessGate;

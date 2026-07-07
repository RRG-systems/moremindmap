/**
 * Dynamic "What Your Scores Reveal" view model from profile data.
 */

import { buildBehavioralDNAInterpretation } from '../behavioralDNAInterpretation.js';
import {
  OPERATING_DIMENSION_ORDER,
  buildOperatingScoreCards,
  classifyOperatingScore,
  getScoreFromProfile,
} from './scoreLabels.js';

const DIMENSION_CUSTOMER_COPY = {
  Vector: {
    whatItMeans: (score, classification) =>
      `Direction is a ${classification} part of how you operate (${score.toFixed(2)}). You tend to stabilize where things should go and create forward motion when work stalls.`,
    howItHelps: 'Strong direction helps in rainmaking, unblocking stalled initiatives, and giving teams a clear next move.',
    howItWorksAgainst:
      'As complexity rises, your pace and certainty can outrun others. Momentum may depend on you personally redirecting the work.',
    bestUse:
      'Use direction where the business needs opportunity creation and visible progress — then pair it with written standards and decision rights.',
  },
  Velocity: {
    whatItMeans: (score, classification) =>
      `Speed is ${classification} in your profile (${score.toFixed(2)}). You tend to move from thought to action once direction forms.`,
    howItHelps:
      'You restart stalled work, change processes when they fail, and keep projects from sitting in limbo.',
    howItWorksAgainst:
      'Under pressure, decisiveness can rise while detail reading drops. Fast commitments may need later correction.',
    bestUse:
      'Channel speed into defined 30-day success targets and accountable owners rather than becoming the recurring restart point.',
  },
  Signal: {
    whatItMeans: (score, classification) =>
      `Human calibration reads as ${classification} (${score.toFixed(2)}). You pick up relational and contextual cues with ${classification === 'moderate' ? 'reasonable' : classification} awareness.`,
    howItHelps:
      'You can read rooms, trust signals, and audience reception — useful in leadership, sales, and people-facing roles.',
    howItWorksAgainst:
      'When speed or direction dominate, interpersonal calibration can be underweighted under load.',
    bestUse:
      'Use signal reading in high-stakes conversations and delegate execution once relational alignment is clear.',
  },
  Fidelity: {
    whatItMeans: (score, classification) =>
      `Precision shows as ${classification} (${score.toFixed(2)}). Detail fidelity is ${classification === 'high' || classification === 'strong' ? 'a real strength' : 'balanced — present when it matters'}.`,
    howItHelps:
      'Accuracy, verification, and clean closure build trust in quality-sensitive work.',
    howItWorksAgainst:
      'Verification instincts can slow release when the environment rewards speed over accuracy.',
    bestUse:
      'Reserve high-fidelity review for decisions where error cost is high; delegate reversible checks elsewhere.',
  },
  Leverage: {
    whatItMeans: (score, classification) =>
      `Scaling judgment is ${classification} (${score.toFixed(2)}). You ${classification === 'low' || classification === 'very low' ? 'may rely more on direct effort than multiplied systems' : 'can spot leverage points with moderate-to-strong awareness'}.`,
    howItHelps:
      'Turning repeated judgment into systems, delegation, or scale creates compounding value.',
    howItWorksAgainst:
      'Manual repetition consumes high-value judgment when leverage patterns are not yet systematized.',
    bestUse:
      'Identify one recurring decision pattern per quarter and convert it into a repeatable playbook or owner.',
  },
  Flex: {
    whatItMeans: (score, classification) =>
      `Adaptability is ${classification} (${score.toFixed(2)}). ${classification === 'moderate' ? 'Flexibility is present but not always your primary mode.' : 'You adjust to terrain with meaningful range.'}`,
    howItHelps:
      'Situational adjustment keeps forward motion alive when plans meet reality.',
    howItWorksAgainst:
      'Adaptation without explicit boundaries can blur ownership and decision clarity.',
    bestUse:
      'Name non-negotiable standards first, then adapt tactics inside those boundaries.',
  },
  Framework: {
    whatItMeans: (score, classification) =>
      `Structure is ${classification} (${score.toFixed(2)}). Process may not be your first instinct — you may prefer to act, adjust, and correct in motion.`,
    howItHelps:
      'You stay adaptable and can change course when repetition fails.',
    howItWorksAgainst:
      'At scale, missing decision frameworks, escalation paths, and accountability systems becomes costly.',
    bestUse:
      'Install external structure — decision guides, escalation rules, named owners — around your momentum.',
  },
  Horizon: {
    whatItMeans: (score, classification) =>
      `Future orientation is ${classification} (${score.toFixed(2)}). Near-term, practical wins ${classification === 'very low' || classification === 'low' ? 'tend to dominate' : 'balance with longer-range planning'}.`,
    howItHelps:
      'Grounded focus on what can move now creates tangible progress people can act on.',
    howItWorksAgainst:
      'Long-horizon systems may lag unless external planning infrastructure carries future sequencing.',
    bestUse:
      'Keep owning near-term direction; pair with operators or written commitments that translate clarity into systems.',
  },
};

function titleCaseDimension(name) {
  if (!name) return 'Unknown';
  return String(name).charAt(0).toUpperCase() + String(name).slice(1).toLowerCase();
}

function buildPatternSummary(availableScores, dna) {
  const sorted = [...availableScores].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 2).map((s) => titleCaseDimension(s.dimension));
  const bottom = [...availableScores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((s) => titleCaseDimension(s.dimension));

  const headline = top.length >= 2 && bottom.length >= 2
    ? `${top.join(' + ')} · Lower ${bottom.join(' + ')}`
    : dna?.primary_engine || 'Operating score pattern';

  const meaning = dna
    ? `${dna.natural_advantage} ${dna.natural_risk}`
    : 'Your scores show which patterns drive how you think, decide, communicate, and lead.';

  return { headline, meaning };
}

export function buildScoreMeaningViewModel({
  canonical = {},
  ranked = [],
  personName = 'You',
}) {
  const data = canonical?.canonical_profile_json || canonical;
  const scoreCards = buildOperatingScoreCards(data, ranked);
  const availableScores = scoreCards.filter((card) => card.available);

  let dna = null;
  try {
    dna = buildBehavioralDNAInterpretation(canonical, ranked);
  } catch {
    dna = null;
  }

  const detailedScores = availableScores.map((card) => {
    const copy = DIMENSION_CUSTOMER_COPY[card.dimension] || DIMENSION_CUSTOMER_COPY.Vector;
    const rationaleEntry = (ranked || []).find(
      (entry) => String(entry?.dimension || '').toLowerCase() === card.dimension.toLowerCase(),
    );
    const rationale = rationaleEntry?.rationale || rationaleEntry?.customer_rationale || null;

    return {
      dimension: card.dimension,
      score: card.score,
      classification: card.classification,
      whatItMeans: rationale
        ? `${copy.whatItMeans(card.score, card.classification)} ${rationale}`
        : copy.whatItMeans(card.score, card.classification),
      howItHelps: copy.howItHelps,
      howItWorksAgainst: copy.howItWorksAgainst,
      bestUse: copy.bestUse,
    };
  });

  const unavailableDimensions = OPERATING_DIMENSION_ORDER.filter(
    (dimension) => getScoreFromProfile(dimension, data, ranked) === null,
  );

  const patternSummary = buildPatternSummary(availableScores, dna);

  return {
    title: 'What Your Scores Reveal',
    subtitle:
      'Your scores are not grades. They show which patterns drive how you think, decide, communicate, and lead.',
    profileName: personName,
    scores: detailedScores,
    patternSummary,
    unavailableDimensions,
  };
}

export default buildScoreMeaningViewModel;
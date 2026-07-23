/** Synthetic BOS score fixture for production-accessible visual labs. */

export const SCORES_REVEAL_META = {
  title: 'What Your Scores Reveal',
  subtitle: 'Synthetic scores are not grades; they exercise the same explanation and layout states.',
  profileName: 'Avery North',
  patternSummary: {
    headline: 'Strong Signal + Measured Velocity · Moderate Framework + Broad Horizon',
    meaning: 'Avery notices context early and moves after the evidence is coherent. The fictional scaling risk is over-analysis during ambiguous handoffs, so the operating design uses short decision windows and visible owners.',
  },
};

export const SYNTHETIC_OPERATING_SCORES = [
  {
    dimension: 'Signal', score: 0.81, classification: 'high',
    whatItMeans: 'Context and relationship cues are noticed quickly, especially when client needs are changing.',
    howItHelps: 'The operator can adapt communication and identify risks before they become visible in lagging metrics.',
    howItWorksAgainst: 'Too many subtle signals can delay commitment when the evidence is mixed.',
    bestUse: 'Pair contextual awareness with a written decision date and a named owner.',
  },
  {
    dimension: 'Fidelity', score: 0.69, classification: 'strong',
    whatItMeans: 'Details are retained well enough to support accurate delivery and thoughtful follow-through.',
    howItHelps: 'Clients experience consistency and fewer dropped commitments.',
    howItWorksAgainst: 'The operator may personally verify work that a clear checklist could safely delegate.',
    bestUse: 'Convert quality judgment into acceptance criteria that another person can run.',
  },
  {
    dimension: 'Framework', score: 0.54, classification: 'moderate',
    whatItMeans: 'Structure is useful when it is compact, visible, and directly connected to current work.',
    howItHelps: 'Simple systems can be adopted without suppressing flexibility.',
    howItWorksAgainst: 'Complex process layers are likely to be bypassed during busy periods.',
    bestUse: 'Keep the operating system to one scorecard, one review rhythm, and explicit escalation rules.',
  },
  {
    dimension: 'Horizon', score: 0.63, classification: 'moderate',
    whatItMeans: 'Near-term choices can be connected to a longer operating model without losing practical focus.',
    howItHelps: 'The operator can sequence capability building while still delivering this quarter.',
    howItWorksAgainst: 'Future options can remain open longer than the business can afford.',
    bestUse: 'Use quarterly decision gates to turn long-range possibilities into bounded experiments.',
  },
];

export const UNAVAILABLE_SCORE_DIMENSIONS = ['Vector', 'Velocity', 'Leverage', 'Flex'];

export const UNIVERSAL_TRANSLATOR_LAB_NOTE =
  'This synthetic lab keeps the translation-control state available for regression review.';

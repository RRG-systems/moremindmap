/** MMB11 lab-only — What Your Scores Reveal for Darren Kirkland (static fixture). */

export const SCORES_REVEAL_META = {
  title: 'What Your Scores Reveal',
  subtitle:
    'Your scores are not grades. They show which patterns drive how you think, decide, communicate, and lead.',
  profileName: 'Darren Kirkland',
  patternSummary: {
    headline: 'High Vector + High Velocity · Low Framework + Low Horizon',
    meaning:
      'Darren naturally creates direction and momentum. He can unblock motion quickly. But as the business grows, the risk is that too much progress depends on him personally clarifying, restarting, or redirecting the work. The goal is not to slow Darren down. The goal is to make his momentum transferable.',
  },
};

export const DARREN_OPERATING_SCORES = [
  {
    dimension: 'Vector',
    score: 0.88,
    classification: 'high',
    whatItMeans:
      'Direction is a dominant part of how you operate. You tend to enter situations with a sense of where things should go, and you stabilize direction for the people around you. When work stalls, you are likely to step in, name the path, and push motion forward rather than wait for consensus.',
    howItHelps:
      'You are built for rainmaking, unblocking stalled initiatives, and giving teams a clear next move. In early-stage growth, founder-led sales, or moments when the business needs decisive forward motion, this score is a real advantage.',
    howItWorksAgainst:
      'As the company adds people, your pace and certainty can outrun their ability to follow. New team members may not know whether to use your model exactly as designed or adapt it. Momentum can become dependent on you personally redirecting the work.',
    bestUse:
      'Use this score where the business needs direction, opportunity creation, and visible progress — then pair it with written standards and decision rights so others can carry the direction without waiting for you.',
  },
  {
    dimension: 'Velocity',
    score: 0.75,
    classification: 'strong',
    whatItMeans:
      'You tend to move from thought to action quickly. Once direction forms, you prefer forward motion over prolonged deliberation. You hyper-focus, get the job done, and use action as a way to reduce frustration when the same ineffective pattern keeps repeating.',
    howItHelps:
      'You restart stalled work, change processes when they are not working, and keep projects from sitting in limbo. In environments that reward practical progress over endless planning, this speed creates real value.',
    howItWorksAgainst:
      'Under pressure, decisiveness rises and you move faster while reading less detail. Fast commitments can later require correction when new information arrives — the cruise decision pattern is an example of speed first, fuller read second.',
    bestUse:
      'Channel velocity into defined 30-day success targets and accountable owners. Speed is most valuable when aimed at a clear outcome others can execute, not when you are the recurring person restarting motion.',
  },
  {
    dimension: 'Framework',
    score: 0.17,
    classification: 'low',
    whatItMeans:
      'This does not mean you cannot use structure. It means structure may not be the first thing your system naturally reaches for when solving problems. You may prefer to act, adjust, and correct in motion rather than build the process layer upfront.',
    howItHelps:
      'You stay adaptable. You are not trapped by rigid process when the situation needs a fresh path. You can change course when repetition is failing and keep the business moving.',
    howItWorksAgainst:
      'At scale, the absence of repeatable decision frameworks, escalation paths, and accountability systems becomes costly. Teams may interpret your model differently, seek permission instead of acting, or stall until you personally unblock them.',
    bestUse:
      'Do not try to become a process-first operator. Install external structure — decision guides, escalation rules, named owners — around your momentum so the business can scale without you being the daily coordination layer.',
  },
  {
    dimension: 'Horizon',
    score: 0.0,
    classification: 'very low',
    whatItMeans:
      'Your system is probably more focused on what is immediate, practical, visible, and actionable than distant future planning. Long-range architecture and multi-year sequencing are less likely to be your natural first move.',
    howItHelps:
      'You stay grounded in what can move now. You are effective when the business needs near-term wins, practical course corrections, and tangible progress that people can see and act on this quarter.',
    howItWorksAgainst:
      'Building a subscription-based or saleable business that operates mostly on its own requires repeatable long-horizon systems — not just your personal unblock. Without external planning infrastructure, growth can outpace operating independence.',
    bestUse:
      'Keep owning near-term direction and rainmaking. Pair yourself with operators, integrators, or written 30-day commitments that translate your immediate clarity into systems others can run without you in every decision.',
  },
];

export const UNAVAILABLE_SCORE_DIMENSIONS = [
  'Signal',
  'Fidelity',
  'Leverage',
  'Flex',
];

export const UNIVERSAL_TRANSLATOR_LAB_NOTE =
  'Universal Translator is not removed in this lab. This test checks whether the main Customer BOS layer can become readable enough that the translator may no longer be needed in the primary BOS experience.';
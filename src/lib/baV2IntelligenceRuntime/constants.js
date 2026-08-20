export const BA_V2_RUNTIME_VERSION = '1.0.0'

export const CONTRACTS = Object.freeze({
  doctrine: 'more-universal-business-doctrine-runtime-v1',
  eToP: 'more-universal-e-to-p-runtime-v1',
  cassette: 'more-real-estate-cassette-v2-runtime',
  lenses: 'more-diagnostic-lens-runtime-v1',
  vbrm: 'more-vertical-business-reality-model-v1',
  adapter: 'more-vbrm-to-wbm-compatibility-adapter-v1',
  twin: 'more-business-twin-v1',
})

export const E_TO_P_DIMENSIONS = Object.freeze([
  'MODELS',
  'SYSTEMS',
  'TOOLS',
  'ACCOUNTABILITY',
  'COACHING',
  'ONGOING_EDUCATION',
])

export const E_TO_P_STATES = Object.freeze([
  'MISSING',
  'ENTREPRENEURIAL',
  'TRANSITIONAL',
  'PURPOSEFUL',
  'CONFLICTED',
  'NOT_APPLICABLE',
])

export const EPISTEMIC_CLASSES = Object.freeze(['KNOWN', 'INFERRED', 'MISSING', 'CONTRADICTED'])
export const CONFIDENCE_LEVELS = Object.freeze(['HIGH', 'MODERATE', 'LOW', 'NOT_APPLICABLE'])

export const TERRITORY_IDS = Object.freeze([
  'RE-T01', 'RE-T02', 'RE-T03', 'RE-T04',
  'RE-T05', 'RE-T06', 'RE-T07', 'RE-T08',
])

export const LENS_IDS = Object.freeze([
  'RE-DL-01', 'RE-DL-02', 'RE-DL-03', 'RE-DL-04', 'RE-DL-05',
  'RE-DL-06', 'RE-DL-07', 'RE-DL-08', 'RE-DL-09', 'RE-DL-10',
])

export const FUTURE_ROLES = Object.freeze([
  'current_course',
  'emerging_future',
  'better_future',
  'bold_future',
  'downside_future',
])

export const TWIN_DESTINATIONS = Object.freeze([
  'YOUR_BUSINESS_NOW',
  'WHATS_DRIVING_IT',
  'WHERE_ITS_HEADING',
  'WHAT_CHANGES_IT',
  'HOW_YOU_EXECUTE_IT',
  'WHY_WE_BELIEVE_IT',
])

export const DOMAIN_TERRITORY_ROUTING = Object.freeze({
  relationship: ['RE-T01'],
  database: ['RE-T01'],
  demand: ['RE-T02'],
  opportunity: ['RE-T02'],
  lead_generation: ['RE-T02'],
  conversion: ['RE-T03'],
  follow_up: ['RE-T03'],
  pipeline: ['RE-T03'],
  listing: ['RE-T04'],
  buyer: ['RE-T04'],
  transaction: ['RE-T04'],
  operations: ['RE-T04'],
  systems: ['RE-T04'],
  delivery: ['RE-T04'],
  accountability: ['RE-T05'],
  execution: ['RE-T05'],
  financial: ['RE-T06'],
  economics: ['RE-T06'],
  capacity: ['RE-T07'],
  team: ['RE-T07'],
  leverage: ['RE-T07'],
  goals: ['RE-T08'],
  stage: ['RE-T08'],
  business_model: ['RE-T08'],
  constraints: ['RE-T05', 'RE-T08'],
  market: ['RE-T02', 'RE-T08'],
})

export const WBM_EPISTEMIC_MAP = Object.freeze({
  KNOWN: 'KNOWN',
  STRONGLY_SUPPORTED: 'INFERRED',
  SUPPORTED_HYPOTHESIS: 'INFERRED',
  TENTATIVE: 'INFERRED',
  INSUFFICIENT_EVIDENCE: 'MISSING',
  ABSTAINED: 'MISSING',
})

export const UNIVERSAL_DOCTRINE = Object.freeze({
  contract_id: CONTRACTS.doctrine,
  contract_version: BA_V2_RUNTIME_VERSION,
  schema_version: '1.0.0',
  purpose: 'Diagnose a governed business as an evidence-bound causal system relative to its stated destination.',
  principles: Object.freeze([
    'Evidence precedes interpretation.',
    'Business claims retain epistemic state, provenance, missingness, contradiction and falsification.',
    'Vertical territories own business meaning; diagnostic lenses determine how that meaning is examined.',
    'Heuristics guide inquiry and never become customer facts.',
    'Whole-Person intelligence changes execution design, never business truth.',
    'Frontier reasoning may synthesize governed meaning; deterministic code owns identity, routing, weights, selection and lineage.',
  ]),
  prohibited_shortcuts: Object.freeze([
    'Q1_AS_DIAGNOSIS',
    'HEURISTIC_AS_FACT',
    'PERSONALITY_AS_BUSINESS_CAUSE',
    'MISSINGNESS_ERASURE',
    'UNSUPPORTED_PROBABILITY',
    'DOWNSTREAM_REGENERATION_OF_ACCEPTED_INTELLIGENCE',
  ]),
})

const clone = (value) => JSON.parse(JSON.stringify(value));

function boundedText(value, max = 1000) {
  return String(value || '').trim().replace(/\s+/gu, ' ').slice(0, max);
}

// Stable, browser-safe synthetic fingerprint. It is never used for tokens,
// authentication, customer identity, or another security decision.
function stableHash(value) {
  const normalize = (input) => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') return Object.fromEntries(Object.keys(input).sort().map((key) => [key, normalize(input[key])]));
    return input;
  };
  const text = JSON.stringify(normalize(value));
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  return seeds.map((seed) => {
    let hash = seed >>> 0;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }).join('').repeat(2);
}

export const RECRUITING_V2_DEMO_CONTRACT = 'recruiting_v2_synthetic_shared_session_v1';
export const RECRUITING_V2_DEMO_BASELINE_VERSION = 'campaign-2g-step1.1.0';
export const RECRUITING_V2_DEMO_RELATIONSHIP_ID = 'synthetic:recruiting-v2:darren-jordan:shared-session';
export const RECRUITING_V2_DEMO_SEQUENCE = Object.freeze([
  'start', 'home', 'you-me', 'you', 'business', 'gap-first', 'jordan-says',
  'noticed', 'gap-revised', 'help', 'plan', 'sees-now', 'decision', 'complete',
]);

const FORBIDDEN = /compatibility score|probability|percent fit|hot[- ]?button|exploit|close them|overcome objection|guarantee|guaranteed leads|personality script/iu;
const SUPPORTED_CAPABILITY_ID = 'synthetic_capability_weekly_opportunity_capacity_review';
const BASELINE_TIME = '2026-08-27T16:00:00.000Z';

function assertion({ id, actor, perspective, text, evidenceRefs, revision = 0 }) {
  return {
    assertion_id: id,
    entered_by: actor,
    asserted_by: actor,
    perspective,
    text,
    evidence_refs: evidenceRefs,
    session_revision: revision,
    synthetic_only: true,
  };
}

export function createRecruitingV2DemoBaseline() {
  const state = {
    contract: RECRUITING_V2_DEMO_CONTRACT,
    baseline_version: RECRUITING_V2_DEMO_BASELINE_VERSION,
    relationship_session_id: RECRUITING_V2_DEMO_RELATIONSHIP_ID,
    label: 'SYNTHETIC DARREN + JORDAN · NO CUSTOMER STATE',
    synthetic_only: true,
    demo_only: true,
    chapter: 'start',
    session_revision: 0,
    started: false,
    completed: false,
    created_at: BASELINE_TIME,
    updated_at: BASELINE_TIME,
    actors: {
      recruiter: { actor_id: 'synthetic:darren-torres', name: 'Darren Torres', role: 'Local leader', synthetic_only: true },
      candidate: { actor_id: 'synthetic:jordan-mitchell', name: 'Jordan Mitchell', role: 'Business owner', synthetic_only: true },
      intelligence: { actor_id: 'more:frontier-shared-session', name: 'MORE', role: 'Shared-session intelligence' },
    },
    canonical_references: {
      candidate_bos: {
        reference_id: 'synthetic:bos:jordan-mitchell:v1',
        authority: 'SYNTHETIC_BOS_REFERENCE',
        summary: 'Jordan trusts decisions he can see. He evaluates carefully because protecting client trust is part of how he works, not because he avoids action.',
        full_profile: [
          'Jordan moves with confidence when the sequence and ownership are visible.',
          'He treats client trust as an operating requirement, not a soft preference.',
          'He is willing to test change when the test is bounded and the reasoning is explicit.',
        ],
        provenance: 'Campaign 2G synthetic Jordan fixture; no canonical customer retrieval.',
      },
      candidate_ba: {
        reference_id: 'synthetic:ba:jordan-mitchell:v1',
        authority: 'SYNTHETIC_BA_REFERENCE',
        summary: 'A trusted $5.2M business is aiming toward $10M without weakening the client experience. Too many decisions still depend on Jordan.',
        selected_future: 'Scale the business while preserving trusted advice and decision quality.',
        five_futures: [
          'Protect the current owner-led model.',
          'Build decision-safe capacity before adding volume.',
          'Add leverage only after work, ownership, and economics are visible.',
        ],
        missing: ['Verified handoff quality', 'Assistant economics', 'Measured owner-time change'],
        provenance: 'Campaign 2G synthetic New BA/Five Futures reference; no canonical customer retrieval.',
      },
    },
    synthetic_darren_capabilities: [
      {
        capability_id: SUPPORTED_CAPABILITY_ID,
        statement: 'Darren can run one weekly opportunity-and-capacity conversation that tests which decisions can move safely.',
        support: 'SUPPORTED',
        source: 'Campaign 2G synthetic Darren capability fixture',
      },
      {
        capability_id: 'synthetic_capability_assistant_design',
        statement: 'Darren may help Jordan explore a first assistant after the role, transferable work, and economics are supported.',
        support: 'CONDITIONAL',
        source: 'Campaign 2G synthetic Darren capability fixture',
      },
      {
        capability_id: 'synthetic_capability_more_leads',
        statement: 'No lead volume, staffing result, growth result, or recruiting outcome is promised.',
        support: 'WITHHELD',
        source: 'Campaign 2G synthetic Darren capability fixture',
      },
    ],
    assertions: [
      assertion({
        id: 'assertion_jordan_goal', actor: 'synthetic:jordan-mitchell', perspective: 'candidate',
        text: 'Grow from $5.2M toward $10M without weakening the client experience.',
        evidenceRefs: ['synthetic:ba:jordan-mitchell:v1'],
      }),
      assertion({
        id: 'assertion_more_first_gap', actor: 'more:frontier-shared-session', perspective: 'MORE',
        text: 'Opportunity flow may not be dependable enough for the desired future.',
        evidenceRefs: ['synthetic:ba:jordan-mitchell:v1'],
      }),
    ],
    hypotheses: [{
      hypothesis_id: 'hypothesis_opportunity_flow_v1',
      statement: 'Opportunity flow may not be dependable enough for the $10M goal.',
      status: 'ACTIVE_PROVISIONAL',
      perspective: 'MORE',
      evidence_refs: ['synthetic:ba:jordan-mitchell:v1'],
      session_revision: 0,
      supersedes: null,
      superseded_by: null,
      supersession_reason: null,
    }],
    working_gap: {
      headline: 'Opportunity flow may be the active constraint.',
      explanation: 'This is MORE’s first thought, not a conclusion. Jordan can change it.',
      status: 'PROVISIONAL',
      perspective: 'MORE',
      evidence_refs: ['hypothesis_opportunity_flow_v1'],
    },
    help: {
      supported: [],
      conditional: ['A first-assistant design may help later, after transferable work and economics are visible.'],
      withheld: ['More leads are not supported as the answer.', 'No staffing, growth, or recruiting outcome is promised.'],
      darren_commitment: '',
      support_refs: [],
    },
    plan: null,
    synthesis: null,
    decision: null,
    learn_next: null,
    frontier_receipts: [],
    interaction_log: [],
    projection_eligibility: {
      eligible: false,
      reason: 'Synthetic Step 1 session never projects into another product.',
      permitted_targets: [],
      cross_product_projection_permitted: false,
    },
    zero_impact: {
      real_invitations: 0,
      emails: 0,
      memberships: 0,
      entitlements: 0,
      canonical_writes: 0,
      customer_retrievals: 0,
      provider_context_contains_real_customer_data: false,
    },
  };
  state.baseline_hash = stableHash(state);
  return Object.freeze(clone(state));
}

export function publicRecruitingV2DemoState(state) {
  validateRecruitingV2DemoState(state);
  return Object.freeze(clone(state));
}

export function validateRecruitingV2DemoState(state) {
  if (state?.contract !== RECRUITING_V2_DEMO_CONTRACT || state?.synthetic_only !== true || state?.demo_only !== true) {
    throw new Error('RECRUITING_V2_DEMO_STATE_INVALID');
  }
  if (state.relationship_session_id !== RECRUITING_V2_DEMO_RELATIONSHIP_ID) throw new Error('RECRUITING_V2_DEMO_RELATIONSHIP_SCOPE_DENIED');
  if (!RECRUITING_V2_DEMO_SEQUENCE.includes(state.chapter)) throw new Error('RECRUITING_V2_DEMO_CHAPTER_INVALID');
  if (state.projection_eligibility?.cross_product_projection_permitted !== false) throw new Error('RECRUITING_V2_DEMO_PROJECTION_DENIED');
  if (Object.values(state.zero_impact || {}).some((value) => typeof value === 'number' && value !== 0)) throw new Error('RECRUITING_V2_DEMO_ZERO_IMPACT_VIOLATED');
  return true;
}

function nextRevision(state, now) {
  const next = clone(state);
  next.session_revision += 1;
  next.updated_at = now.toISOString();
  return next;
}

function log(next, action, actor, payload = {}) {
  next.interaction_log.push({
    interaction_id: `synthetic_interaction_${next.session_revision}_${stableHash({ action, payload }).slice(0, 10)}`,
    action,
    entered_by: actor,
    session_revision: next.session_revision,
    synthetic_only: true,
  });
}

export function buildRecruitingV2FrontierContext(state, meaning) {
  validateRecruitingV2DemoState(state);
  const candidateMeaning = boundedText(meaning, 2000);
  if (candidateMeaning.length < 12) throw new Error('RECRUITING_V2_DEMO_MEANING_REQUIRED');
  return Object.freeze({
    contract: 'recruiting_v2_shared_session_frontier_context_v1',
    synthetic_only: true,
    relationship_session_id_hash: stableHash(state.relationship_session_id),
    session_revision: state.session_revision,
    actors: clone(state.actors),
    candidate_bos: clone(state.canonical_references.candidate_bos),
    candidate_business: clone(state.canonical_references.candidate_ba),
    synthetic_darren_capabilities: clone(state.synthetic_darren_capabilities),
    current_hypotheses: clone(state.hypotheses),
    prior_assertions: clone(state.assertions),
    new_assertion: {
      asserted_by: 'synthetic:jordan-mitchell',
      entered_by: 'synthetic:jordan-mitchell',
      perspective: 'candidate',
      text: candidateMeaning,
    },
    requirements: {
      revise_with_evidence: true,
      preserve_uncertainty: true,
      material_notice_only_when_warranted: true,
      supported_help_must_reference_capability_ids: true,
      no_scores_probabilities_scripts_or_persuasion: true,
    },
  });
}

function requiredText(value, field, max = 2400) {
  const result = boundedText(value, max);
  if (!result) throw new Error(`RECRUITING_V2_DEMO_FRONTIER_${field.toUpperCase()}_REQUIRED`);
  return result;
}

function textList(value, field, max = 8) {
  if (!Array.isArray(value) || value.length > max) throw new Error(`RECRUITING_V2_DEMO_FRONTIER_${field.toUpperCase()}_INVALID`);
  return value.map((item) => requiredText(item, field));
}

export function validateRecruitingV2FrontierOutput(output) {
  if (!output || typeof output !== 'object' || FORBIDDEN.test(JSON.stringify(output))) throw new Error('RECRUITING_V2_DEMO_FRONTIER_OUTPUT_INVALID');
  if (typeof output.material_revision !== 'boolean') throw new Error('RECRUITING_V2_DEMO_FRONTIER_MATERIAL_REVISION_REQUIRED');
  requiredText(output.noticed_title, 'noticed_title');
  requiredText(output.noticed_explanation, 'noticed_explanation');
  requiredText(output.working_gap?.headline, 'gap_headline');
  requiredText(output.working_gap?.explanation, 'gap_explanation');
  if (!['WEAKENED', 'RETAINED', 'WITHDRAWN', 'CHALLENGED'].includes(output.hypothesis_disposition)) throw new Error('RECRUITING_V2_DEMO_FRONTIER_DISPOSITION_INVALID');
  const supported = output.help?.supported;
  if (!Array.isArray(supported) || supported.length > 3) throw new Error('RECRUITING_V2_DEMO_FRONTIER_SUPPORTED_HELP_INVALID');
  for (const item of supported) {
    requiredText(item.statement, 'supported_help');
    if (item.capability_id !== SUPPORTED_CAPABILITY_ID) throw new Error('RECRUITING_V2_DEMO_FRONTIER_HELP_SCOPE_DENIED');
  }
  textList(output.help?.conditional, 'conditional_help', 4);
  textList(output.help?.withheld, 'withheld_help', 4);
  requiredText(output.plan?.name, 'plan_name');
  requiredText(output.plan?.darren, 'plan_darren');
  requiredText(output.plan?.jordan, 'plan_jordan');
  requiredText(output.plan?.watch_together, 'plan_watch');
  textList(output.plan?.still_open, 'plan_open', 6);
  requiredText(output.synthesis?.summary, 'synthesis');
  requiredText(output.synthesis?.what_matters, 'what_matters');
  requiredText(output.synthesis?.what_looks_solvable, 'what_looks_solvable');
  requiredText(output.synthesis?.not_a_promise, 'not_a_promise');
  textList(output.uncertainty, 'uncertainty', 8);
  textList(output.next_evidence, 'next_evidence', 8);
  return true;
}

export function buildRecruitingV2ProviderRequest(context, { model = 'gpt-5.6-sol' } = {}) {
  return {
    model,
    store: false,
    background: false,
    reasoning: { effort: 'high' },
    max_output_tokens: 6000,
    instructions: [
      'Interpret one fully synthetic Darren and Jordan Recruiting shared-session assertion.',
      'Use the whole supplied synthetic session state, not a chapter script.',
      'Revise, weaken, retain, withdraw, or challenge the provisional hypothesis based on the new meaning.',
      'Set material_revision true only when the new assertion materially changes the working understanding.',
      'Supported help must cite only an explicitly SUPPORTED synthetic Darren capability ID.',
      'Keep conditional and withheld help separate. Preserve uncertainty and name the next evidence.',
      'Never score fit, estimate probability, manipulate, script persuasion, or promise outcomes.',
    ].join('\n'),
    input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(context) }] }],
    text: { verbosity: 'low', format: RECRUITING_V2_FRONTIER_SCHEMA },
  };
}

const schemaText = { type: 'string', minLength: 1, maxLength: 2400 };
const schemaTextList = (maxItems = 8) => ({ type: 'array', maxItems, items: schemaText });

export const RECRUITING_V2_FRONTIER_SCHEMA = Object.freeze({
  type: 'json_schema',
  name: 'recruiting_v2_synthetic_shared_session_v1',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['material_revision', 'noticed_title', 'noticed_explanation', 'working_gap', 'hypothesis_disposition', 'help', 'plan', 'synthesis', 'uncertainty', 'next_evidence'],
    properties: {
      material_revision: { type: 'boolean' },
      noticed_title: schemaText,
      noticed_explanation: schemaText,
      working_gap: { type: 'object', additionalProperties: false, required: ['headline', 'explanation'], properties: { headline: schemaText, explanation: schemaText } },
      hypothesis_disposition: { type: 'string', enum: ['WEAKENED', 'RETAINED', 'WITHDRAWN', 'CHALLENGED'] },
      help: {
        type: 'object', additionalProperties: false, required: ['supported', 'conditional', 'withheld'], properties: {
          supported: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['statement', 'capability_id'], properties: { statement: schemaText, capability_id: { type: 'string', enum: [SUPPORTED_CAPABILITY_ID] } } } },
          conditional: schemaTextList(4), withheld: schemaTextList(4),
        },
      },
      plan: { type: 'object', additionalProperties: false, required: ['name', 'darren', 'jordan', 'watch_together', 'still_open'], properties: { name: schemaText, darren: schemaText, jordan: schemaText, watch_together: schemaText, still_open: schemaTextList(6) } },
      synthesis: { type: 'object', additionalProperties: false, required: ['summary', 'what_matters', 'what_looks_solvable', 'not_a_promise'], properties: { summary: schemaText, what_matters: schemaText, what_looks_solvable: schemaText, not_a_promise: schemaText } },
      uncertainty: schemaTextList(8), next_evidence: schemaTextList(8),
    },
  },
});

export function createSyntheticReferenceFrontierOutput(meaning) {
  const normalized = boundedText(meaning, 2000).toLowerCase();
  const namesOpportunityAlreadyExists = /opportunit(?:y|ies).*(exist|there|enough|plenty)|leads?.*(exist|there|enough|plenty)/u.test(normalized);
  const namesHandoffMechanism = /hand[ -]?off|delegate|delegat|client experience|quality|trust|decision/u.test(normalized);
  const material = namesOpportunityAlreadyExists && namesHandoffMechanism;
  if (!material) {
    return {
      material_revision: false,
      noticed_title: 'MORE is keeping the first thought provisional.',
      noticed_explanation: 'Jordan added useful meaning, but it does not yet separate an opportunity constraint from an ownership or capacity constraint.',
      working_gap: { headline: 'The active constraint is still unresolved.', explanation: 'Opportunity flow and decision-safe capacity both remain live possibilities.' },
      hypothesis_disposition: 'RETAINED',
      help: { supported: [], conditional: ['The weekly opportunity-and-capacity review becomes useful after Jordan names what is failing now.'], withheld: ['More leads are not supported as the answer.', 'An assistant is not supported without visible work and economics.'] },
      plan: { name: 'Evidence-first conversation', darren: 'Ask for one recent example of the breakdown.', jordan: 'Name what happened, who owned the decision, and what made the outcome unsafe.', watch_together: 'Whether the pattern points to demand, ownership, or capacity.', still_open: ['The dominant constraint', 'The first credible intervention'] },
      synthesis: { summary: 'The business goal is clear, but the first useful help is not yet earned.', what_matters: 'Protect client trust while making growth possible.', what_looks_solvable: 'The next evidence can identify the mechanism.', not_a_promise: 'No recruiting, staffing, lead, or growth outcome is implied.' },
      uncertainty: ['The dominant constraint remains unresolved.'], next_evidence: ['One recent example of work or a decision that could not move safely.'],
    };
  }
  return {
    material_revision: true,
    noticed_title: 'What Jordan just said changes our understanding of the problem.',
    noticed_explanation: 'The opportunities already exist. Jordan named unsafe handoff—not demand—as the mechanism keeping the business owner-dependent.',
    working_gap: { headline: 'The gap is not more leads. It is decision-safe capacity.', explanation: 'Jordan cannot yet see which work and decisions can move away from him without weakening the client experience.' },
    hypothesis_disposition: 'WEAKENED',
    help: {
      supported: [{ statement: 'Run one weekly opportunity-and-capacity conversation to test which decisions can move safely.', capability_id: SUPPORTED_CAPABILITY_ID }],
      conditional: ['A first assistant may help later, after the role, transferable work, and economics are visible.'],
      withheld: ['More leads do not solve the revised gap.', 'No staffing, growth, or recruiting outcome is promised.'],
    },
    plan: { name: '30-day decision-safe capacity test', darren: 'Run one weekly opportunity-and-capacity conversation.', jordan: 'Choose one recurring decision to test as a safe handoff.', watch_together: 'Client quality, owner time, and whether the handoff stays clear.', still_open: ['Assistant role and economics', 'Whether more volume becomes useful later'] },
    synthesis: { summary: 'There is a supported reason to work together before there is a supported reason to change organizations.', what_matters: 'Protect client trust while reducing owner dependence.', what_looks_solvable: 'One recurring handoff can be tested safely.', not_a_promise: 'No staffing, growth, lead, or recruiting outcome is assumed.' },
    uncertainty: ['Actual handoff quality', 'Assistant economics', 'Measured owner-time change'], next_evidence: ['Can one recurring handoff work without weakening service?'],
  };
}

function applyFrontierInterpretation(state, meaning, frontierResult, receipt, now) {
  validateRecruitingV2FrontierOutput(frontierResult);
  const next = nextRevision(state, now);
  const assertionId = `assertion_jordan_${stableHash({ meaning, revision: next.session_revision }).slice(0, 16)}`;
  next.assertions.push(assertion({
    id: assertionId,
    actor: 'synthetic:jordan-mitchell',
    perspective: 'candidate',
    text: boundedText(meaning, 2000),
    evidenceRefs: ['synthetic:bos:jordan-mitchell:v1', 'synthetic:ba:jordan-mitchell:v1'],
    revision: next.session_revision,
  }));
  const prior = next.hypotheses.find((item) => item.status === 'ACTIVE_PROVISIONAL');
  if (prior) {
    prior.status = frontierResult.hypothesis_disposition === 'RETAINED' ? 'ACTIVE_PROVISIONAL' : frontierResult.hypothesis_disposition;
    prior.supersession_reason = frontierResult.noticed_explanation;
  }
  const hypothesisId = `hypothesis_working_gap_r${next.session_revision}`;
  if (frontierResult.material_revision) {
    if (prior) prior.superseded_by = hypothesisId;
    next.hypotheses.push({
      hypothesis_id: hypothesisId,
      statement: frontierResult.working_gap.headline,
      status: 'ACTIVE_WORKING',
      perspective: 'MORE',
      evidence_refs: [assertionId],
      session_revision: next.session_revision,
      supersedes: prior?.hypothesis_id || null,
      superseded_by: null,
      supersession_reason: frontierResult.noticed_explanation,
    });
  }
  next.working_gap = { ...clone(frontierResult.working_gap), status: frontierResult.material_revision ? 'WORKING_UNDERSTANDING' : 'PROVISIONAL', perspective: 'joint', evidence_refs: [assertionId, hypothesisId] };
  next.help = { ...clone(frontierResult.help), darren_commitment: '', support_refs: frontierResult.help.supported.map((item) => item.capability_id) };
  next.plan = clone(frontierResult.plan);
  next.synthesis = clone(frontierResult.synthesis);
  next.learn_next = clone(frontierResult.next_evidence);
  next.frontier_receipts.push({
    receipt_id: `frontier_receipt_r${next.session_revision}`,
    model: receipt?.model || 'synthetic-reference-frontier',
    store: false,
    request_hash: receipt?.request_hash || null,
    output_hash: stableHash(frontierResult),
    raw_request_persisted: false,
    raw_response_persisted: false,
    real_customer_context: false,
    session_revision: next.session_revision,
  });
  next.chapter = frontierResult.material_revision ? 'noticed' : 'gap-revised';
  log(next, 'SUBMIT_MEANING', 'synthetic:jordan-mitchell', { assertion_id: assertionId, material_revision: frontierResult.material_revision });
  validateRecruitingV2DemoState(next);
  return Object.freeze(next);
}

export async function transitionRecruitingV2Demo(state, action, payload = {}, { provider = null, now = () => new Date() } = {}) {
  validateRecruitingV2DemoState(state);
  if (action === 'RESET_SESSION') return createRecruitingV2DemoBaseline();
  if (action === 'SUBMIT_MEANING') {
    if (typeof provider !== 'function') throw new Error('RECRUITING_V2_DEMO_FRONTIER_PROVIDER_REQUIRED');
    const context = buildRecruitingV2FrontierContext(state, payload.meaning);
    const request = buildRecruitingV2ProviderRequest(context);
    const result = await provider(request, context);
    const output = result?.output || result;
    return applyFrontierInterpretation(state, payload.meaning, output, {
      model: result?.receipt?.model || request.model,
      request_hash: stableHash(request),
    }, now());
  }
  const next = nextRevision(state, now());
  if (action === 'START_SESSION') {
    next.started = true;
    next.chapter = 'home';
    log(next, action, 'synthetic:darren-torres');
  } else if (action === 'ADVANCE') {
    const current = RECRUITING_V2_DEMO_SEQUENCE.indexOf(next.chapter);
    if (current < 0 || current >= RECRUITING_V2_DEMO_SEQUENCE.length - 1) throw new Error('RECRUITING_V2_DEMO_ADVANCE_DENIED');
    let target = RECRUITING_V2_DEMO_SEQUENCE[current + 1];
    if (target === 'noticed' && next.working_gap.status !== 'WORKING_UNDERSTANDING') target = 'gap-revised';
    if (next.chapter === 'jordan-says') throw new Error('RECRUITING_V2_DEMO_MEANING_REQUIRED');
    if (next.chapter === 'help' && !next.help.darren_commitment) throw new Error('RECRUITING_V2_DEMO_COMMITMENT_REQUIRED');
    if (next.chapter === 'decision') throw new Error('RECRUITING_V2_DEMO_DECISION_REQUIRED');
    next.chapter = target;
    log(next, action, 'synthetic:darren-torres', { chapter: target });
  } else if (action === 'SAVE_COMMITMENT') {
    const commitment = requiredText(payload.commitment, 'commitment', 700);
    if (FORBIDDEN.test(commitment) || /provide|give|guarantee|supply/iu.test(commitment) && /leads?|hires?|growth|production/iu.test(commitment)) throw new Error('RECRUITING_V2_DEMO_UNSUPPORTED_COMMITMENT_DENIED');
    if (!next.help.supported.length) throw new Error('RECRUITING_V2_DEMO_SUPPORTED_HELP_REQUIRED');
    next.help.darren_commitment = commitment;
    next.plan.darren = commitment;
    next.chapter = 'plan';
    next.assertions.push(assertion({ id: `assertion_darren_commitment_r${next.session_revision}`, actor: 'synthetic:darren-torres', perspective: 'recruiter', text: commitment, evidenceRefs: next.help.support_refs, revision: next.session_revision }));
    log(next, action, 'synthetic:darren-torres', { supported: true });
  } else if (action === 'CONTINUE_WITHOUT_HELP') {
    if (next.help.supported.length > 0) throw new Error('RECRUITING_V2_DEMO_SUPPORTED_HELP_ACKNOWLEDGEMENT_REQUIRED');
    next.chapter = 'plan';
    log(next, action, 'synthetic:darren-torres', { no_help_outcome: true });
  } else if (action === 'SAVE_DECISION') {
    if (!['ANOTHER_CONVERSATION', 'NOT_ENOUGH_YET', 'NOT_FOR_ME'].includes(payload.choice)) throw new Error('RECRUITING_V2_DEMO_DECISION_INVALID');
    next.decision = {
      choice: payload.choice,
      rationale: boundedText(payload.rationale, 1000) || null,
      asserted_by: 'synthetic:jordan-mitchell',
      perspective: 'candidate',
      session_revision: next.session_revision,
    };
    next.completed = true;
    next.chapter = 'complete';
    log(next, action, 'synthetic:jordan-mitchell', { choice: payload.choice });
  } else {
    throw new Error('RECRUITING_V2_DEMO_ACTION_INVALID');
  }
  validateRecruitingV2DemoState(next);
  return Object.freeze(next);
}

export const RECRUITING_V2_DEMO_INVARIANTS = Object.freeze({
  manager_session_required: false,
  manager_membership_read_permitted: false,
  entitlement_consumption_permitted: false,
  real_invitation_or_email_permitted: false,
  canonical_bos_ba_write_permitted: false,
  real_customer_retrieval_permitted: false,
  cross_product_projection_permitted: false,
});

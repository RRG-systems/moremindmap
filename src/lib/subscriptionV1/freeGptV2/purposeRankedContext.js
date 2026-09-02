import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'being', 'business', 'could',
  'from', 'have', 'help', 'into', 'more', 'should', 'that', 'their', 'them', 'they',
  'this', 'through', 'understand', 'what', 'when', 'where', 'which', 'with', 'would',
]);

const SECTION_ORDER_BY_LENS = Object.freeze({
  OVERVIEW: ['whole_business', 'one_move', 'plan', 'possible_futures'],
  WHERE_YOU_ARE: ['whole_business', 'plan', 'one_move', 'possible_futures'],
  FIVE_FUTURES: ['possible_futures', 'whole_business', 'plan', 'one_move'],
  ONE_MOVE: ['one_move', 'whole_business', 'plan', 'possible_futures'],
  PLAN: ['plan', 'one_move', 'whole_business', 'possible_futures'],
  EVIDENCE: ['whole_business', 'possible_futures', 'one_move', 'plan'],
});

const SECTION_TERMS = Object.freeze({
  whole_business: ['business', 'production', 'pipeline', 'revenue', 'capacity', 'constraint', 'cause', 'change', 'goal', 'database', 'relationship'],
  possible_futures: ['future', 'futures', 'trajectory', 'direction', 'downside', 'upside', 'course', 'heading'],
  one_move: ['move', 'leverage', 'bottleneck', 'constraint', 'intervention', 'priority', 'focus'],
  plan: ['plan', 'commitment', 'strategy', 'strategies', 'step', 'steps', 'execute', 'execution', 'goal'],
});

const DOCTRINE_DEFAULTS_BY_LENS = Object.freeze({
  OVERVIEW: ['UK-03', 'UK-08', 'UK-17', 'RE-04'],
  WHERE_YOU_ARE: ['UK-10', 'UK-11', 'UK-12', 'RE-04'],
  FIVE_FUTURES: ['UK-03', 'UK-16', 'UK-17', 'RE-05'],
  ONE_MOVE: ['UK-11', 'UK-15', 'UK-16', 'RE-08'],
  PLAN: ['UK-06', 'UK-07', 'UK-08', 'RE-05'],
  EVIDENCE: ['UK-10', 'UK-17', 'RE-04', 'RE-05'],
});

function tokens(value) {
  return [...new Set(String(value || '').toLowerCase().match(/[a-z][a-z0-9'-]{2,}/gu) || [])]
    .filter((item) => !STOP_WORDS.has(item));
}

function unique(items) {
  return [...new Set(items)];
}

function directlyRelevant(items, queryTokens) {
  if (!queryTokens.length) return [];
  return items.filter((item) => {
    const text = `${item.title || ''} ${item.guidance || ''}`.toLowerCase();
    return queryTokens.some((token) => text.includes(token));
  });
}

function selectDoctrine(doctrine, { purpose, activeLens, topics, customerMessage }) {
  const queryTokens = tokens([purpose, activeLens, ...(topics || []), customerMessage].join(' '));
  const universal = doctrine.layers?.universal_kernel || [];
  const defaults = new Set(DOCTRINE_DEFAULTS_BY_LENS[activeLens] || DOCTRINE_DEFAULTS_BY_LENS.OVERVIEW);
  const always = universal.filter((item) => ['UK-01', 'UK-02'].includes(item.doctrine_id));
  const matchedUniversal = directlyRelevant(universal.filter((item) => !always.includes(item)), queryTokens);
  const defaultUniversal = universal.filter((item) => defaults.has(item.doctrine_id));
  const selectedUniversalIds = unique([...always, ...matchedUniversal, ...defaultUniversal].map((item) => item.doctrine_id)).slice(0, 6);
  const selectedUniversal = selectedUniversalIds.map((id) => universal.find((item) => item.doctrine_id === id)).filter(Boolean);
  const body = {
    doctrine_id: doctrine.doctrine_id,
    doctrine_version: doctrine.doctrine_version,
    doctrine_hash: doctrine.doctrine_hash,
    purpose,
    vertical_id: null,
    layers: { universal_kernel: selectedUniversal, vertical_cassette: [] },
    selected_authority_refs: selectedUniversal.map((item) => item.authority_ref),
    retrieval_reason: 'Authority-filtered doctrine corpus was selected for the current purpose and visible destination. Selection informs frontier understanding and does not choose dialogue, conclusions, or actions.',
    selection_contract: 'SUBSCRIPTION_FLAGSHIP_S1_PURPOSE_RANKED_DOCTRINE_V1',
    full_corpus_available_server_side: true,
    semantic_cassette_injected: false,
  };
  return deepFreeze({ ...body, retrieval_hash: hashCanonicalJson(body) });
}

function selectBusinessSections({ activeLens, purpose, topics, customerMessage }) {
  const queryTokens = tokens([purpose, ...(topics || []), customerMessage].join(' '));
  const direct = Object.entries(SECTION_TERMS)
    .filter(([, terms]) => terms.some((term) => queryTokens.includes(term)))
    .map(([section]) => section);
  const lensOrder = SECTION_ORDER_BY_LENS[activeLens] || SECTION_ORDER_BY_LENS.OVERVIEW;
  return unique([...direct, ...lensOrder, 'whole_business']).slice(0, 3);
}

export function purposeRankPrivateAdvisorContext({
  full_provider_understanding,
  doctrine_retrieval,
  purpose,
  active_lens,
  topics = [],
  customer_message = '',
}) {
  const selectedSections = selectBusinessSections({ activeLens: active_lens, purpose, topics, customerMessage: customer_message });
  const selectedDoctrine = selectDoctrine(doctrine_retrieval, { purpose, activeLens: active_lens, topics, customerMessage: customer_message });
  const selectedBusiness = Object.fromEntries(selectedSections.map((key) => [key, clone(full_provider_understanding[key] || {})]));
  const providerUnderstanding = {
    reasoning_priority: [
      'Current customer-confirmed reality and governed person/business state.',
      'Relevant personal relationship history, attempts, and observed outcomes.',
      'Purpose-relevant DJ coaching doctrine and domain priors.',
      'Eligible external context, kept distinct from customer-governed truth.',
    ],
    whole_person: clone(full_provider_understanding.whole_person || {}),
    living_business_twin: clone(full_provider_understanding.living_business_twin || {}),
    ...selectedBusiness,
    evidence: clone(full_provider_understanding.evidence || {}),
    relevant_coaching_history: clone(full_provider_understanding.relevant_coaching_history || []),
    coaching_intelligence: {
      universal: selectedDoctrine.layers.universal_kernel.map(({ title, guidance }) => ({ title, guidance })),
      vertical: [],
      vertical_context: null,
    },
    current_conversation: clone(full_provider_understanding.current_conversation || []),
    subscription_relationship: clone(full_provider_understanding.subscription_relationship || null),
    coaching_session: clone(full_provider_understanding.coaching_session || null),
    temporal_state: clone(full_provider_understanding.temporal_state || null),
    relationship_continuity: clone(full_provider_understanding.relationship_continuity || null),
    visible_customer_context: clone(full_provider_understanding.visible_customer_context || null),
    governed_external_context: clone(full_provider_understanding.governed_external_context || []),
    truth_boundaries: clone(full_provider_understanding.truth_boundaries || {}),
  };
  const eligibleSections = ['whole_business', 'possible_futures', 'one_move', 'plan'];
  const receiptBody = {
    contract_id: 'subscription_flagship_s1_context_selection_receipt_v1',
    selection_mode: 'AUTHORITY_FILTER_FIRST_PURPOSE_SELECT_SECOND',
    purpose,
    active_lens,
    selected_business_sections: selectedSections,
    omitted_business_sections: eligibleSections.filter((key) => !selectedSections.includes(key)),
    doctrine_eligible_count: doctrine_retrieval.layers?.universal_kernel?.length || 0,
    doctrine_selected_count: selectedDoctrine.selected_authority_refs.length,
    selected_doctrine_ids: selectedDoctrine.layers.universal_kernel.map((item) => item.doctrine_id),
    semantic_cassette_selected_count: 0,
    full_context_characters: JSON.stringify(full_provider_understanding).length,
    selected_context_characters: JSON.stringify(providerUnderstanding).length,
    full_corpus_available_server_side: true,
    deterministic_dialogue_or_conclusion_selected: false,
    fixed_dj_weight: false,
  };
  return deepFreeze({
    provider_understanding: providerUnderstanding,
    doctrine_retrieval: selectedDoctrine,
    receipt: { ...receiptBody, receipt_hash: hashCanonicalJson(receiptBody) },
  });
}

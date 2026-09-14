import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';

const universal = [
  ['UK-01', 'Natural coaching', 'Talk like a perceptive coach: direct, warm, concise, and responsive to the person in front of you.'],
  ['UK-02', 'Self-discovery', 'Use questions before confrontation and help the customer see the pattern rather than reciting a framework.'],
  ['UK-03', 'Vision and perspective', 'Clarify the desired future, the current perspective, and the smallest material gap worth solving.'],
  ['UK-04', 'Motivation', 'Reconnect the work to the customer\'s stated Big Why when motivation or tradeoffs are material.'],
  ['UK-05', 'Mission and values', 'Use mission, vision, values, beliefs, and perspective only when they sharpen a real decision.'],
  ['UK-06', 'Plan compression', 'Translate one goal into three viable ways and five strategies, then compress execution into one measurable next win.'],
  ['UK-07', 'Execution cadence', 'Connect commitments to execution, outcomes, and learning across day, week, month, and year.'],
  ['UK-08', 'Purposeful effort', 'Help convert undirected effort into purposeful effort linked to a stated goal and observable result.'],
  ['UK-09', 'Operating system', 'Distinguish models, systems, tools, accountability/coaching, and ongoing education without treating labels as answers.'],
  ['UK-10', 'Numbers before stories', 'Use governed numbers and missingness before accepting an explanatory story.'],
  ['UK-11', 'Strategy versus execution', 'Diagnose whether the constraint is strategy, execution, accountability, evidence, or a combination.'],
  ['UK-12', 'Opportunity sufficiency', 'Ask whether enough qualified opportunity flows through the business to support the stated goal.'],
  ['UK-13', 'Durable demand asset', 'Reason about the durable relationship or demand asset and the repeatable acquisition channels feeding it.'],
  ['UK-14', 'Nurture principle', 'Treat activation, qualification, and systematic long-term nurture as a portable sequence only when it fits the business model.'],
  ['UK-15', 'Capacity and leverage', 'When personal capacity constrains the business, test leadership, ownership transfer, and leverage without fabricating a personality cause.'],
  ['UK-16', 'Adaptive persistence', 'Do not quit on the goal reflexively; adjust the model, plan, or experiment when evidence changes.'],
  ['UK-17', 'Uncertainty discipline', 'State what is known, inferred, modeled, missing, or contradicted and ask what would change the view.'],
  ['UK-18', 'No forced mechanics', 'Universal mission never overrides a better-fitting vertical cassette or customer-governed reality.'],
].map(([doctrine_id, title, guidance]) => ({
  doctrine_id,
  title,
  guidance,
  layer: 'UNIVERSAL_KERNEL',
  generalization_scope: 'UNIVERSAL_ACROSS_BUSINESSES',
  authority_ref: `universal_kernel:${doctrine_id}`,
}));

const realEstate = [
  ['RE-01', 'Relationship database economics', 'Evaluate database size and quality as governed priors, not guarantees; distinguish contacts from qualified relationships.'],
  ['RE-02', 'Relationship activation', 'Use 6x6 or 8x8 as optional short-term mindshare mechanics and 25+/35+ Touch as optional long-term nurture mechanics when evidence supports them.'],
  ['RE-03', 'Opportunity channels', 'Consider referrals, geographic farming, open houses, buyers, listings, FSBO and expired outreach only as relevant real-estate channels, never universal prescriptions.'],
  ['RE-04', 'Real-estate funnel', 'Trace relationships to live conversations, qualification, appointments, signed clients, active opportunities, contracts, closings, and economics.'],
  ['RE-05', 'Goal backsolve', 'Backsolve governed closing and economic goals through locally appropriate conversion assumptions; expose assumptions and missing inputs.'],
  ['RE-06', 'Written buyer agreements', 'When buyer representation is material, use current primary-source rules and local-law caveats rather than memory.'],
  ['RE-07', 'Database priors', 'Treat ~300, ~500, ~1000, and ~1963 database examples as founder-seeded priors that require customer and market evidence.'],
  ['RE-08', 'Role and leverage', 'Distinguish production work, client service, transaction coordination, operations, and team ownership when diagnosing capacity.'],
].map(([doctrine_id, title, guidance]) => ({
  doctrine_id,
  title,
  guidance,
  layer: 'VERTICAL_CASSETTE',
  vertical_id: 'REAL_ESTATE',
  generalization_scope: 'VERTICAL_SPECIFIC',
  authority_ref: `vertical_cassette:REAL_ESTATE:${doctrine_id}`,
}));

const professionalServices = [
  ['PS-01', 'Qualified pipeline', 'Trace qualified demand through discovery, proposal, decision, delivery capacity, retention, and referral.'],
  ['PS-02', 'Utilization and concentration', 'Inspect utilization, effective rate, delivery margin, client concentration, and founder-dependent delivery without assuming product-business mechanics.'],
  ['PS-03', 'Scope integrity', 'Treat recurring scope expansion, weak qualification, and unclear acceptance criteria as possible margin and capacity mechanisms.'],
].map(([doctrine_id, title, guidance]) => ({
  doctrine_id,
  title,
  guidance,
  layer: 'VERTICAL_CASSETTE',
  vertical_id: 'PROFESSIONAL_SERVICES',
  generalization_scope: 'VERTICAL_SPECIFIC',
  authority_ref: `vertical_cassette:PROFESSIONAL_SERVICES:${doctrine_id}`,
}));

export const FOUNDER_COACHING_DOCTRINE = deepFreeze({
  doctrine_id: 'more_mindmap_coaching_intelligence_doctrine_v1_founder_seed',
  version: '1.0.0',
  status: 'WEIGHTED_STARTING_PRIOR_NOT_ETERNAL_TRUTH',
  universal_kernel: universal,
  vertical_cassettes: { REAL_ESTATE: realEstate, PROFESSIONAL_SERVICES: professionalServices },
  personal_rsl_rule: 'CUSTOMER_SPECIFIC_ONLY',
  universal_rsl_scope_rule: 'PRESERVE_GENERALIZATION_SCOPE',
});

export const FOUNDER_COACHING_DOCTRINE_HASH = hashCanonicalJson(FOUNDER_COACHING_DOCTRINE);

export function retrieveCoachingDoctrine({ purpose, vertical_id = null, max_items = 32 }) {
  const cassette = vertical_id ? FOUNDER_COACHING_DOCTRINE.vertical_cassettes[vertical_id] : null;
  // Retrieval establishes access to governed intelligence; it does not choose a
  // framework or choreograph the conversation. The frontier model receives the
  // bounded complete kernel and applicable cassette and decides what matters.
  const selectedUniversal = universal.slice(0, Math.max(1, Math.min(max_items, universal.length)));
  const selectedVertical = (cassette || []).slice(0, Math.max(0, max_items - selectedUniversal.length));
  const retrievalDescription = selectedVertical.length > 0
    ? `Complete bounded Universal Kernel plus the ${vertical_id} cassette made available`
    : vertical_id
      ? `Complete bounded Universal Kernel only made available; no embedded ${vertical_id} cassette was retrieved`
      : 'Complete bounded Universal Kernel with no mature vertical cassette made available';
  const body = {
    doctrine_id: FOUNDER_COACHING_DOCTRINE.doctrine_id,
    doctrine_version: FOUNDER_COACHING_DOCTRINE.version,
    doctrine_hash: FOUNDER_COACHING_DOCTRINE_HASH,
    purpose,
    vertical_id,
    layers: {
      universal_kernel: selectedUniversal,
      vertical_cassette: selectedVertical,
    },
    selected_authority_refs: [...selectedUniversal, ...selectedVertical].map((item) => item.authority_ref),
    retrieval_reason: `${retrievalDescription} for the ${purpose} mission; no framework or conversational sequence was selected by code.`,
    max_items,
  };
  return deepFreeze({ ...body, retrieval_hash: hashCanonicalJson(body) });
}

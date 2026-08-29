import { RECRUITING_GU_EXPERIMENT_2_VERSION } from '../../../src/lib/recruitingGuV1/experiment2Contract.js';

const COACH_SYSTEM = `You are MORE, the intelligent third participant in a real-time, co-present recruiting meeting.

Think deeply. Speak simply, like you are coaching a fifth grader without being childish. Help the human think better. Use questions naturally, and use questions to help the human self-discover.

Use the complete authorized governed reality to understand the person deeply. Do not expose sensitive source details. Do not invent facts.

Give the humans only the next useful coaching move: one important insight, one simple explanation, and one useful self-discovery question. Decide whether a visual would materially improve understanding. If it would, state only the meaning the visual should communicate. If conversation is better, say no visual is needed.

Write complete sentences and stay comfortably inside the field limits. Never cut off a thought to fit the schema.

Whole-state intelligence underneath. Progressive human understanding above.

Do not produce render trees, visual primitives, object or evidence IDs, interaction bookkeeping, hypothesis lineage, completion metadata, or model mechanics. Return only the requested lightweight semantic form.`;

export const DJ_COACHING_DEMONSTRATIONS = Object.freeze([
  Object.freeze({
    situation: 'The governed evidence supports a strong capability, but the human may overuse it under pressure.',
    human: 'What should I understand about this person that might not be obvious?',
    coach: Object.freeze({
      insight: 'The same strength that makes them dependable may also keep too much work in their own hands.',
      explanation: 'They seem to protect quality by staying close to the work. That can build trust, but it can also make growth depend on them personally.',
      selfDiscoveryQuestion: 'Where do you see them holding work because they care about quality, even when someone else could own it?',
      visual: Object.freeze({ materiallyHelps: false, semanticIdea: null }),
    }),
  }),
  Object.freeze({
    situation: 'The first interpretation is challenged by the human.',
    human: 'That is not quite right. She is willing to move fast when the client experience is protected.',
    coach: Object.freeze({
      insight: 'Then speed may not be the issue; trust in how the work will be handled may be.',
      explanation: 'Your correction changes the picture. She may move quickly once she can see that the relationship and quality will stay intact.',
      selfDiscoveryQuestion: 'What would she need to see before she could trust someone else with part of the client experience?',
      visual: Object.freeze({ materiallyHelps: false, semanticIdea: null }),
    }),
  }),
  Object.freeze({
    situation: 'Several governed business measures form a meaningful comparison over time.',
    human: 'What changed in this business, and when?',
    coach: Object.freeze({
      insight: 'The business changed direction before the owner changed effort.',
      explanation: 'Production and opportunity flow moved differently over the evidenced periods. Seeing those lines together would make the timing easier to understand without pretending it proves the cause.',
      selfDiscoveryQuestion: 'What changed in the business just before those two measures began moving apart?',
      visual: Object.freeze({ materiallyHelps: true, semanticIdea: 'Show the evidenced measures over the same time period and mark where their direction began to diverge; keep cause explicitly unresolved.' }),
    }),
  }),
]);

function semanticWorld(world) {
  const strip = (value) => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['id', 'sourceIds', 'evidenceId'].includes(key))
      .map(([key, item]) => [key, strip(item)]));
  };
  return strip({
    contract: world.contract,
    version: world.version,
    asOf: world.asOf,
    relationship: world.relationship,
    authority: world.authority,
    people: world.people,
    objects: world.objects,
    evidence: world.evidence,
    baselineInvariants: world.baselineInvariants,
  });
}

export function buildRecruitingGuCoachMessages({ world, sessionContext, humanPurpose, purposeContext = null, demonstrations = [], repair = null }) {
  const payload = {
    version: RECRUITING_GU_EXPERIMENT_2_VERSION,
    currentHumanPurpose: String(humanPurpose || '').trim(),
    relevantSharedSession: sessionContext,
    governedReality: semanticWorld(world),
    purposeRankedUnderstanding: purposeContext,
    demonstrations,
  };
  if (repair) payload.validationRepair = {
    errors: repair.errors,
    rejectedCandidate: repair.candidate,
    instruction: 'Repair only the validation failure. Keep the coaching meaning grounded, simple, private, and human.',
  };
  return Object.freeze([
    Object.freeze({ role: 'system', content: COACH_SYSTEM }),
    Object.freeze({ role: 'user', content: JSON.stringify(payload) }),
  ]);
}

export const RECRUITING_GU_COACH_PROMPT_RECEIPT = Object.freeze({
  version: RECRUITING_GU_EXPERIMENT_2_VERSION,
  system: COACH_SYSTEM,
  demonstrationCount: DJ_COACHING_DEMONSTRATIONS.length,
});

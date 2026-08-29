import { stableHash } from '../recruitingV1/contracts.js';
import { createRecruitingV2SyntheticWorld } from '../recruitingV2/syntheticWorld.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

function bounded(value, max = 1800) {
  return String(value || '').trim().replace(/\s+/gu, ' ').slice(0, max);
}

function firstText(value, keys) {
  if (!value || typeof value !== 'object') return '';
  for (const key of keys) {
    const direct = value[key];
    if (typeof direct === 'string' && direct.trim()) return bounded(direct);
  }
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') {
      const found = firstText(child, keys);
      if (found) return found;
    }
  }
  return '';
}

export function createSyntheticRecruitingGuWorld() {
  return createRecruitingV2SyntheticWorld();
}

function words(value) {
  return [...new Set(String(value || '').toLowerCase().match(/[a-z][a-z0-9'-]{2,}/gu) || [])];
}

function relevance(queryWords, value) {
  const serialized = JSON.stringify(value).toLowerCase();
  return queryWords.reduce((score, word) => score + (serialized.includes(word) ? 1 : 0), 0);
}

export function scopeRecruitingGuWorldForRoom(world, room) {
  if (room === 'YOUR_BUSINESS') return world;
  if (room !== 'YOU') throw new Error('RECRUITING_GU_V1_WORLD_ROOM_INVALID');
  const evidence = world.evidence.filter((item) => /bos/u.test(item.id) && !/darren|manager/u.test(item.id));
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const objects = world.objects.filter((item) => item.kind === 'PERSON'
    && !/darren|manager/u.test(item.id)
    && (item.sourceIds || []).some((id) => evidenceIds.has(id)));
  if (!objects.length || !evidence.length) throw new Error('RECRUITING_GU_V1_YOU_BOS_SCOPE_EMPTY');
  return Object.freeze({
    ...world,
    objects: Object.freeze(objects),
    evidence: Object.freeze(evidence),
    roomScope: 'YOU_BOS_ONLY',
  });
}

export function rankRecruitingGuWorldForCompiler(world, semanticMeaning) {
  const query = words(semanticMeaning).filter((item) => item.length > 2);
  const rankedObjects = world.objects
    .map((item, index) => ({ item, index, score: relevance(query, item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const positive = rankedObjects.filter((entry) => entry.score > 0);
  const selectedObjects = (positive.length ? positive : rankedObjects).slice(0, 6).map((entry) => entry.item);
  const requiredEvidence = new Set(selectedObjects.flatMap((item) => item.sourceIds || []));
  const rankedEvidence = world.evidence
    .map((item, index) => ({ item, index, score: relevance(query, item) + (requiredEvidence.has(item.id) ? 10 : 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter((entry) => entry.score > 0)
    .slice(0, 24)
    .map((entry) => entry.item);
  return Object.freeze({
    ...world,
    objects: Object.freeze(selectedObjects),
    evidence: Object.freeze(rankedEvidence),
    compilerSelection: Object.freeze({
      mode: 'SEMANTIC_MEANING_RANKED',
      availableObjects: world.objects.length,
      selectedObjects: selectedObjects.length,
      availableEvidence: world.evidence.length,
      selectedEvidence: rankedEvidence.length,
    }),
  });
}

export function createRecruitingGuWorld({ relationship, candidate, manager, bosArtifact, baViewModel, opportunity = { items: [] }, managerEvidence = [] } = {}) {
  if (!relationship?.relationship_id || !candidate?.profile_id || !manager?.subject_id) throw new Error('RECRUITING_GU_V1_WORLD_BINDING_REQUIRED');
  const profileName = bounded(candidate.name || 'MORE member', 140);
  const bosSummary = firstText(bosArtifact, ['executive_summary', 'summary', 'orientation', 'headline']) || 'A complete governed BOS is available in the YOU room.';
  const businessReality = firstText(baViewModel, ['business_reality', 'current_reality', 'summary', 'headline']) || 'A complete governed Business Twin is available in YOUR BUSINESS.';
  const constraint = firstText(baViewModel, ['governing_constraint', 'constraint', 'primary_constraint']) || 'The governing constraint remains a revisable business hypothesis.';
  const goal = firstText(baViewModel, ['goal', 'desired_future', 'destination']) || 'The desired direction remains governed by the Business Twin evidence.';
  const evidence = [
    { id: 'ev-subject-bos', title: `${profileName} BOS`, statement: bosSummary, source: 'Canonical BOS realization', sourceDate: new Date().toISOString().slice(0, 10), truthClass: 'CANONICAL_READ', confidence: 'KNOWN' },
    { id: 'ev-subject-ba', title: `${profileName} Business Twin`, statement: businessReality, source: 'Canonical BA realization', sourceDate: new Date().toISOString().slice(0, 10), truthClass: 'CANONICAL_READ', confidence: baViewModel ? 'KNOWN' : 'MISSING' },
    { id: 'ev-manager-opportunity', title: 'Local Opportunity authority', statement: bounded(opportunity.items?.map((item) => item.statement).join(' ') || 'No supported local opportunity claim is available.'), source: 'Recruiting V1 Local Opportunity', sourceDate: new Date().toISOString().slice(0, 10), truthClass: 'ENTERPRISE_AUTHORITY', confidence: opportunity.items?.length ? 'KNOWN' : 'OPEN' },
    { id: 'ev-manager-observations', title: 'Manager-supplied evidence', statement: bounded(managerEvidence.map((item) => item.claim).join(' ') || 'No manager observations are recorded.'), source: 'Recruiting V1 manager evidence', sourceDate: new Date().toISOString().slice(0, 10), truthClass: 'MANAGER_SUPPLIED', confidence: managerEvidence.length ? 'REPORTED' : 'OPEN' },
  ];
  const objects = [
    { id: 'obj-subject-person', kind: 'PERSON', title: profileName, role: 'MORE member and business owner', summary: bosSummary, motivation: goal, caution: 'Whole-person evidence can guide the conversation; it does not prove business causation.', sourceIds: ['ev-subject-bos'], truthClass: 'CANONICAL_READ' },
    { id: 'obj-manager-person', kind: 'PERSON', title: bounded(manager.name, 140), role: 'Recruiting manager', summary: 'The manager can offer only the local capabilities supported by Recruiting authority.', motivation: 'Help the two humans determine whether working together is useful.', caution: 'The manager cannot manufacture a candidate gap from local opportunity.', sourceIds: ['ev-manager-opportunity'], truthClass: 'RECRUITING_AUTHORITY' },
    { id: 'obj-business-twin', kind: 'BUSINESS_TWIN', title: `${profileName}'s current business reality`, statement: businessReality, constraint, goal, sourceIds: ['ev-subject-ba'], truthClass: baViewModel ? 'CANONICAL_READ' : 'MISSING' },
    { id: 'obj-relationship', kind: 'RELATIONSHIP', title: 'Could working together improve this business and life?', people: [bounded(manager.name, 140), profileName], status: 'UNRESOLVED', statement: 'Fit exists only when an independently supported need meets a genuinely available capability and both humans want the relationship.', sourceIds: ['ev-subject-bos', 'ev-subject-ba', 'ev-manager-opportunity'], truthClass: 'SESSION_QUESTION' },
    { id: 'obj-local-capabilities', kind: 'LOCAL_OPPORTUNITY', title: 'What is actually supported locally', items: opportunity.items || [], sourceIds: ['ev-manager-opportunity'], truthClass: 'ENTERPRISE_AUTHORITY' },
    { id: 'obj-evidence-gap', kind: 'EVIDENCE_GAP', title: 'What the evidence does not establish', missing: [!baViewModel && 'A complete Business Twin is not yet available.', !managerEvidence.length && 'No manager observations are recorded.'].filter(Boolean), counterevidence: [], mindChange: 'New verified evidence or either human correcting the working hypothesis.', sourceIds: ['ev-subject-ba', 'ev-manager-observations'], truthClass: 'GOVERNED_MISSINGNESS' },
  ];
  const identity = stableHash({ relationship: relationship.relationship_id, profile: candidate.profile_id, bos: bosArtifact?.realization_id || bosArtifact?.profile_id, ba: baViewModel?.version || null, evidence });
  return Object.freeze({
    contract: 'more_recruiting_gu_v1_relationship_read_projection_v1',
    worldId: `recruiting-gu-v1-${identity.slice(0, 20)}`,
    version: `gu-world-${identity.slice(0, 16)}`,
    asOf: new Date().toISOString(), syntheticOnly: false,
    relationship: { id: relationship.relationship_id, recruiter: bounded(manager.name, 140), candidate: profileName, consent: relationship.consent_state, status: relationship.status },
    authority: { canonicalReads: 'Referenced only', localOpportunity: 'Cannot create a candidate gap', sessionAssertions: 'Session-only', modelOutput: 'Revisable hypothesis', mutations: 'Shared Business Session only' },
    people: { manager: { name: bounded(manager.name, 140), role: 'Recruiting manager' }, invitee: { name: profileName, role: 'MORE member' }, more: { name: 'MORE', role: 'Intelligent third participant' } },
    evidence: Object.freeze(evidence), objects: Object.freeze(objects),
    baselineInvariants: { realCustomerData: true, consentBound: true, canonicalMutation: false, localOpportunityMutation: false, externalMutation: false },
  });
}

export function cloneRecruitingGuWorld(world) {
  return clone(world);
}

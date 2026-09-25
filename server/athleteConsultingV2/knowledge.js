import { createHash } from 'node:crypto';
import { BOS_LIBRARY, LIBRARY_MANIFEST_SHA256 } from '../../src/lib/newBosPersonalityDnaV1/libraryRegistry.js';
import { createHashBoundLibraryRetriever } from '../../api/engine/newBosProductionReadinessV1/libraryRetriever.js';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const BY_ID = new Map(BOS_LIBRARY.map((entry) => [entry.id, entry]));
const ALLOWED = new Set([1, 2, 3, 4, 5, 6, 10, 11, 12, 13, 14, 15]);
let verifiedRetriever;
const defaultRetriever = () => (verifiedRetriever ||= createHashBoundLibraryRetriever());

function boundedRelevantSections(block) {
  const parts = block.split('\n\n--- BOUNDED DOCTRINE BLOCK ---\n\n');
  return [parts[0]?.slice(0, 3000), parts[1]?.slice(0, 6000), parts[2]?.slice(0, 6000)]
    .filter(Boolean).join('\n\n--- VERIFIED EXCERPT ---\n\n');
}

// These are whole-person BOS reasoning authorities, not an athlete-sport
// coaching library. Route only the relevant bounded blocks and make the
// absent sport-specific authority explicit in every receipt.
export function selectAthleteKnowledge({ task, view, text = '' }) {
  const query = String(text).toLowerCase();
  const rank = new Map([[14, 100]]); // Evidence/uncertainty governs every interpretation.
  const add = (id, score, pattern) => { if (pattern.test(query)) rank.set(id, Math.max(rank.get(id) || 0, score)); };
  // The available-source list is an honest routing inventory: each included
  // authority has an explicit, applicable path into the bounded top-three set.
  add(1, 85, /\b(eight[ -]?vectors?|personality vectors?|personality dimensions?)\b/u);
  add(3, 85, /\b(higher[ -]?order (?:behavioral )?attributes?|behavioral attributes?)\b/u);
  add(4, 85, /\b(causal (?:behavioral )?dynamics?|behavioral causes?|behavioral triggers?)\b/u);
  add(13, 90, /\b(plans?|steps?|moves?|try|changes?|experiments?)\b/u);
  add(12, 90, /\b(futures?|paths?|scenarios?|trajector(?:y|ies)|could happen)\b/u);
  add(5, 85, /\b(pressure|conflicts?|setbacks?|recover(?:y|ies|ing|ed)?|mindset|stress)\b/u);
  add(6, 85, /\b(communicat|conversation|team|coach)\w*/u);
  add(10, 85, /\b(think|decid|focus|cognitive|learn)\w*/u);
  add(11, 85, /\b(energy|fatigue|rest|pace)\b/u);
  add(2, 80, /\b(pattern|interaction|contradiction)\w*/u);
  add(15, 80, /\b(personality|bos|who i am|know me|whole person)\b/u);
  if (task === 'OPENING') rank.set(15, Math.max(rank.get(15) || 0, 70));
  if (view === 'you') rank.set(15, Math.max(rank.get(15) || 0, 40));
  if (view === 'sport') rank.set(5, Math.max(rank.get(5) || 0, 30));
  if (view === 'plan') rank.set(13, Math.max(rank.get(13) || 0, 30));
  if (rank.size === 1) rank.set(15, 20);
  return [...rank].filter(([id]) => ALLOWED.has(id))
    .sort(([a, sa], [b, sb]) => sb - sa || a - b).slice(0, 3).map(([id]) => id);
}

export async function retrieveAthleteKnowledge({ task, view, text = '', retriever = defaultRetriever() }) {
  const ids = selectAthleteKnowledge({ task, view, text });
  const selected = ids.map((id) => BY_ID.get(id));
  const result = await retriever.retrieve({ manifest_sha256: LIBRARY_MANIFEST_SHA256, authorities: selected });
  if (result.manifest_sha256 !== LIBRARY_MANIFEST_SHA256 || !Array.isArray(result.authorities)
    || result.authorities.length !== selected.length) throw new Error('ATHLETE_KNOWLEDGE_INTEGRITY');
  const blocks = result.authorities.map((entry, index) => {
    const expected = selected[index];
    if (entry.id !== expected.id || entry.sha256 !== expected.sha256 || typeof entry.bounded_block !== 'string') {
      throw new Error('ATHLETE_KNOWLEDGE_INTEGRITY');
    }
    const textBlock = boundedRelevantSections(entry.bounded_block);
    return { id: entry.id, title: entry.title, version: expected.version, sha256: entry.sha256,
      excerpt_sha256: sha256(textBlock), excerpt: textBlock, use: 'GOVERNED_REASONING_REFERENCE_NOT_ATHLETE_FACT' };
  });
  return { context: { library: 'BOS Personality DNA Intelligence Library', manifest_sha256: LIBRARY_MANIFEST_SHA256,
    scope: 'whole_person_reasoning_only', available_authorities: BOS_LIBRARY.filter((entry) => ALLOWED.has(entry.id))
      .map(({ id, title, version, sha256 }) => ({ id, title, version, sha256 })), blocks }, receipt: { manifest_sha256: LIBRARY_MANIFEST_SHA256,
    sources: blocks.map(({ id, version, sha256: source_sha256, excerpt_sha256 }) => ({ id, version, source_sha256, excerpt_sha256 })),
    coverage: 'BOUNDED_BOS_LIBRARY_SUBSET', athlete_sport_coaching_library: 'NOT_AVAILABLE_AS_APPROVED_PINNED_SOURCE' } };
}

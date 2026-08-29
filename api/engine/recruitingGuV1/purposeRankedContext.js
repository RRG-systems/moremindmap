import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReadOnlyCanonicalReader } from '../newBosProductionReadinessV1/canonicalReader.js';
import { adaptCanonicalProfileToNewBosRawEvidence } from '../newBosProductionReadinessV1/canonicalAdapter.js';
import { createReadOnlyBaAuthorityReader } from '../newBaProductionReadinessV1/canonicalReader.js';
import { readNewBaProductionConfig } from '../newBaProductionReadinessV1/config.js';
import { FOUNDER_COACHING_DOCTRINE } from '../../../src/lib/subscriptionV1/afw04/doctrine.js';
import { REAL_ESTATE_INTAKE_QUESTIONS } from '../../../src/lib/baVerticalCassettesV1/realEstateCassette.js';
import { createSyntheticJordanBosArtifact } from '../../../src/recruitingHybridGuV1/syntheticJordanBos.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const REGISTRY_PATH = 'docs/ba-intelligence-authority-library-v1/registries/REAL_ESTATE_CASSETTE_REGISTRY_V1.json';
const STOP_WORDS = new Set(['about', 'after', 'again', 'also', 'because', 'before', 'being', 'business', 'could', 'from', 'have', 'help', 'into', 'looks', 'more', 'person', 'right', 'should', 'that', 'their', 'them', 'they', 'this', 'understand', 'what', 'when', 'where', 'which', 'with', 'would']);

let bibleCorpusPromise;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function tokens(value) {
  return [...new Set(String(value || '').toLowerCase().match(/[a-z][a-z0-9'-]{2,}/gu) || [])]
    .filter((item) => !STOP_WORDS.has(item));
}

function scoreText(queryTokens, value) {
  const haystack = String(value || '').toLowerCase();
  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function semanticArtifact(value) {
  if (Array.isArray(value)) return value.slice(0, 80).map(semanticArtifact);
  if (!value || typeof value !== 'object') return value;
  const renderingOnly = new Set(['surface_packets', 'surface_renderings', 'rendering', 'layout', 'html', 'css', 'image_data', 'image_url']);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !renderingOnly.has(key))
    .map(([key, item]) => [key, semanticArtifact(item)]));
}

function semanticBaArtifact(value) {
  if (!value || typeof value !== 'object') return value;
  const { objects: authoredRenderingObjects, ...semantic } = value;
  return Object.freeze({
    ...semanticArtifact(semantic),
    contextReceipt: Object.freeze({
      omittedAuthoredRenderingObjectsOnly: Boolean(authoredRenderingObjects),
      authoredObjectCount: authoredRenderingObjects ? Object.keys(authoredRenderingObjects).length : 0,
    }),
  });
}

function selectDoctrine(purpose, room) {
  const query = tokens(purpose);
  const universal = FOUNDER_COACHING_DOCTRINE.universal_kernel;
  const fixed = universal.filter((item) => ['UK-01', 'UK-02'].includes(item.doctrine_id));
  const rankedUniversal = universal
    .filter((item) => !fixed.includes(item))
    .map((item) => ({ item, score: scoreText(query, `${item.title} ${item.guidance}`) }))
    .sort((a, b) => b.score - a.score || a.item.doctrine_id.localeCompare(b.item.doctrine_id))
    .filter((entry) => entry.score > 0)
    .slice(0, 3)
    .map((entry) => entry.item);
  const vertical = room === 'YOUR_BUSINESS'
    ? (FOUNDER_COACHING_DOCTRINE.vertical_cassettes.REAL_ESTATE || [])
      .map((item) => ({ item, score: scoreText(query, `${item.title} ${item.guidance}`) }))
      .sort((a, b) => b.score - a.score || a.item.doctrine_id.localeCompare(b.item.doctrine_id))
      .filter((entry) => entry.score > 0)
      .slice(0, 2)
      .map((entry) => entry.item)
    : [];
  return Object.freeze([...fixed, ...rankedUniversal, ...vertical]);
}

async function loadBibleCorpus() {
  if (!bibleCorpusPromise) bibleCorpusPromise = (async () => {
    const registry = JSON.parse(await readFile(path.join(ROOT, REGISTRY_PATH), 'utf8'));
    const corpus = [];
    for (const entry of registry.bibles) {
      const absolute = path.join(ROOT, 'docs/ba-intelligence-authority-library-v1', entry.path);
      const content = await readFile(absolute, 'utf8');
      if (sha256(content) !== entry.sha256) throw new Error(`RECRUITING_GU_V1_CASSETTE_HASH_DRIFT:${entry.authority_id}`);
      corpus.push(Object.freeze({ ...entry, content }));
    }
    return Object.freeze(corpus);
  })();
  return bibleCorpusPromise;
}

function compactBibleContent(content) {
  const sections = String(content || '').split(/\n(?=##\s)/u);
  const selected = sections.filter((section) => /^##\s+(?:1\.|2\.|5\.|7\.|10\.|15\.|17\.|18\.|19\.)/u.test(section));
  return selected.join('\n').slice(0, 6500);
}

async function selectBibles(purpose, room) {
  if (room !== 'YOUR_BUSINESS') return Object.freeze([]);
  const query = tokens(purpose);
  if (!query.length) return Object.freeze([]);
  const corpus = await loadBibleCorpus();
  return Object.freeze(corpus
    .map((entry) => ({
      entry,
      score: (scoreText(query, entry.title) * 4) + scoreText(query, entry.content.slice(0, 2600)),
    }))
    .sort((a, b) => b.score - a.score || a.entry.authority_id.localeCompare(b.entry.authority_id))
    .filter((item) => item.score > 0)
    .slice(0, 2)
    .map(({ entry, score }) => Object.freeze({
      authorityId: entry.authority_id,
      title: entry.title,
      sha256: entry.sha256,
      relevanceScore: score,
      excerpt: compactBibleContent(entry.content),
    })));
}

function bosAnswersFromRaw(raw) {
  return Object.freeze((raw?.questions || []).map((item) => Object.freeze({
    questionId: item.question_id,
    question: item.question_text || item.exact_question || '',
    answer: item.exact_answer == null ? '' : String(item.exact_answer),
    authority: 'AUTHORIZED_FIRST_PARTY_BOS',
    sensitivity: 'INTERNAL_REASONING_ONLY_DO_NOT_QUOTE',
  })).filter((item) => item.answer));
}

function baAnswersFromAuthority(source) {
  const definitions = new Map(REAL_ESTATE_INTAKE_QUESTIONS.map((item) => [item.key, item]));
  return Object.freeze(Object.entries(source?.business_evidence?.answers || {}).map(([key, answer]) => Object.freeze({
    questionId: key,
    question: definitions.get(key)?.title || key,
    answer: String(answer),
    authority: 'AUTHORIZED_FIRST_PARTY_BA',
    sensitivity: 'INTERNAL_REASONING_ONLY_DO_NOT_QUOTE',
  })));
}

function receiptFor(context) {
  const serialized = JSON.stringify(context);
  return Object.freeze({
    contract: context.contract,
    room: context.room,
    selectionMode: context.selectionMode,
    bosAvailable: Boolean(context.governedBos),
    baAvailable: Boolean(context.governedBa),
    bosAnswerCount: context.firstPartyAnswers.bos.length,
    baAnswerCount: context.firstPartyAnswers.ba.length,
    doctrineIds: context.doctrine.map((item) => item.doctrine_id),
    cassetteAuthorityIds: context.realEstateAuthorities.map((item) => item.authorityId),
    contextCharacters: serialized.length,
    contextSha256: sha256(serialized),
    publicRenderingAuthority: false,
    persistenceAuthority: false,
    canonicalMutation: false,
  });
}

async function assemble({ room, purpose, bos, ba, bosAnswers, baAnswers, sourceReceipts }) {
  if (!['YOU', 'YOUR_BUSINESS'].includes(room)) throw new Error('RECRUITING_GU_V1_CONTEXT_ROOM_INVALID');
  const context = Object.freeze({
    contract: 'recruiting-gu-v1-purpose-ranked-context-v1',
    room,
    selectionMode: 'PURPOSE_RANKED_GOVERNED_READ',
    governedBos: semanticArtifact(bos),
    governedBa: room === 'YOUR_BUSINESS' ? semanticBaArtifact(ba) : null,
    firstPartyAnswers: Object.freeze({
      bos: Object.freeze(bosAnswers || []),
      ba: room === 'YOUR_BUSINESS' ? Object.freeze(baAnswers || []) : Object.freeze([]),
    }),
    doctrine: selectDoctrine(purpose, room),
    realEstateAuthorities: await selectBibles(purpose, room),
    sourceReceipts,
    authority: Object.freeze({
      use: 'INTERNAL_REASONING_ONLY',
      rawSensitiveAnswerRendering: false,
      canonicalMutation: false,
      externalMutation: false,
    }),
  });
  return Object.freeze({ context, receipt: receiptFor(context) });
}

export async function createSyntheticPurposeRankedContext({ room, purpose, authoredSurfaces }) {
  const bos = authoredSurfaces?.bos || createSyntheticJordanBosArtifact();
  return assemble({
    room,
    purpose,
    bos,
    ba: authoredSurfaces?.ba || null,
    bosAnswers: bosAnswersFromRaw(bos?.rawEvidence || bos?.raw_evidence || bos),
    baAnswers: [],
    sourceReceipts: Object.freeze({
      bos: 'GOVERNED_SYNTHETIC_BOS',
      ba: room === 'YOUR_BUSINESS' ? 'GOVERNED_SYNTHETIC_BUSINESS_TWIN_NO_SEPARATE_RAW_ANSWER_FIXTURE' : 'NOT_REQUESTED',
    }),
  });
}

export async function createCanonicalPurposeRankedContext({ redis, env, profileId, room, purpose, authoredSurfaces }) {
  const canonicalBos = await createReadOnlyCanonicalReader({ redis }).read(profileId);
  const bosRaw = adaptCanonicalProfileToNewBosRawEvidence({ envelope: canonicalBos.canonical_dossier, expectedProfileId: profileId });
  let baSource = null;
  if (room === 'YOUR_BUSINESS') {
    const config = readNewBaProductionConfig(env);
    baSource = await createReadOnlyBaAuthorityReader({ redis, bosNamespace: config.bosNamespace }).read(profileId);
  }
  return assemble({
    room,
    purpose,
    bos: authoredSurfaces?.bos || null,
    ba: authoredSurfaces?.ba || null,
    bosAnswers: bosAnswersFromRaw(bosRaw),
    baAnswers: baAnswersFromAuthority(baSource),
    sourceReceipts: Object.freeze({
      bos: canonicalBos.retrieval_receipt,
      ba: baSource ? Object.freeze({ source: baSource.source_kind, assessmentId: baSource.assessment_id, readOnly: baSource.business_evidence.read_only === true }) : 'NOT_REQUESTED',
    }),
  });
}

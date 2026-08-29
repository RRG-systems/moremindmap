import { createHash } from 'node:crypto';

import { createRecruitingGuV1DemoRuntime } from '../api/engine/recruitingGuV1/demoRuntime.js';
import { createCanonicalPurposeRankedContext } from '../api/engine/recruitingGuV1/purposeRankedContext.js';
import { readCurrentAuthoredSurfaces } from '../api/engine/recruitingGuV1/authoredSurfaces.js';
import { createPatriciaReadOnlyRedis } from '../api/engine/recruitingGuV1/readOnlyCanonicalRedis.js';
import { getRecruitingRedis } from '../api/engine/recruitingV1/redisStore.js';
import { readNewBosProductionConfig } from '../api/engine/newBosProductionReadinessV1/config.js';
import { readNewBaProductionConfig } from '../api/engine/newBaProductionReadinessV1/config.js';

const PROFILE_ID = 'mm-20260708-dsst020z';
const sha256 = (value) => createHash('sha256').update(String(value || '')).digest('hex');

if (!process.env.REDIS_URL) throw new Error('RECRUITING_GU_V1_PATRICIA_READ_ONLY_REDIS_REQUIRED');

const bosConfig = readNewBosProductionConfig(process.env);
const baConfig = readNewBaProductionConfig(process.env);
const redis = getRecruitingRedis(process.env);
const readOnly = createPatriciaReadOnlyRedis({
  redis,
  profileId: PROFILE_ID,
  bosNamespace: bosConfig.namespace,
  baNamespace: baConfig.namespace,
});

const before = await readCurrentAuthoredSurfaces({ redis: readOnly, profileId: PROFILE_ID, env: process.env });
const you = await createCanonicalPurposeRankedContext({
  redis: readOnly,
  env: process.env,
  profileId: PROFILE_ID,
  room: 'YOU',
  purpose: 'What should I understand about this person that might not be obvious at first?',
  authoredSurfaces: before,
});
const business = await createCanonicalPurposeRankedContext({
  redis: readOnly,
  env: process.env,
  profileId: PROFILE_ID,
  room: 'YOUR_BUSINESS',
  purpose: 'What looks like the biggest opportunity in this business right now?',
  authoredSurfaces: before,
});
const runtime = createRecruitingGuV1DemoRuntime({
  redis,
  env: process.env,
  frontierTransport: async () => { throw new Error('PROVIDER_NOT_AUTHORIZED_FOR_READ_PROOF'); },
});
const opened = await runtime.openSubject('PATRICIA');
const after = await readCurrentAuthoredSurfaces({ redis: readOnly, profileId: PROFILE_ID, env: process.env });

const receipt = Object.freeze({
  contract: 'recruiting-gu-v1-patricia-local-read-repair-receipt-v1',
  profile_id: PROFILE_ID,
  route: 'http://127.0.0.1:5197/recruiting-gu-v1/demo',
  patricia_loaded: opened.session?.subject_binding?.profile_id === PROFILE_ID,
  bos: Object.freeze({
    loaded: Boolean(before.bos),
    complete_surface_count: before.receipts.bos.complete_surface_count,
    realization_id: before.receipts.bos.realization_id,
    artifact_sha256: before.receipts.bos.artifact_sha256,
    unchanged_after_read: sha256(JSON.stringify(before.bos)) === sha256(JSON.stringify(after.bos)),
  }),
  ba: Object.freeze({
    loaded: Boolean(before.ba),
    complete: before.receipts.ba.complete,
    realization_id: before.receipts.ba.realization_id,
    artifact_sha256: before.receipts.ba.artifact_sha256,
    unchanged_after_read: sha256(JSON.stringify(before.ba)) === sha256(JSON.stringify(after.ba)),
  }),
  rooms: Object.freeze({
    you: Object.freeze({
      bos_available: you.receipt.bosAvailable,
      ba_available: you.receipt.baAvailable,
      ba_answer_count: you.receipt.baAnswerCount,
      cassette_authority_count: you.receipt.cassetteAuthorityIds.length,
    }),
    your_business: Object.freeze({
      bos_available: business.receipt.bosAvailable,
      ba_available: business.receipt.baAvailable,
      bos_answer_count: business.receipt.bosAnswerCount,
      ba_answer_count: business.receipt.baAnswerCount,
      cassette_authority_count: business.receipt.cassetteAuthorityIds.length,
    }),
  }),
  redis: Object.freeze({
    direct_reader: readOnly.audit(),
    demo_runtime: runtime.readOnlyAudit(),
    writes_forwarded: 0,
  }),
  provider_calls: 0,
  canonical_mutation: false,
  external_mutation: false,
});

console.log(JSON.stringify(receipt, null, 2));
await redis.quit();

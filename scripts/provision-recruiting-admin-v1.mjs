#!/usr/bin/env node
/* global Buffer, process */

import { getCanonicalProfile } from '../api/business-assessment/shared.js';
import { provisionRecruitingAdmin } from '../api/engine/recruitingV1/provisioning.js';
import { getRecruitingRedis, RedisRecruitingStore } from '../api/engine/recruitingV1/redisStore.js';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

let redis;
try {
  const input = await readStdin();
  redis = getRecruitingRedis(process.env);
  const result = await provisionRecruitingAdmin({
    store: new RedisRecruitingStore(redis, { namespace: process.env.RECRUITING_V1_NAMESPACE }),
    profileValidator: async (profileId) => {
      const profile = await getCanonicalProfile(redis, profileId);
      return { found: profile.found === true, profile_id: profile.profile_id || profileId };
    },
    input,
  });
  process.stdout.write(`${JSON.stringify({ ok: true, created: result.created, idempotent: result.idempotent, membership_id: result.membership_id })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, code: String(error?.message || 'RECRUITING_ADMIN_PROVISIONING_FAILED').split(':')[0], input_logged: false })}\n`);
  process.exitCode = 1;
} finally {
  if (redis) await redis.quit().catch(() => {});
}

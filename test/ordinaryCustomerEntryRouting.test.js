import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildOrdinaryCustomerDestination,
  normalizeOrdinaryCustomerProfileId,
  resolveOrdinaryBaEntry,
  resolveOrdinaryBosEntry,
} from '../src/lib/customerEntry/ordinaryCustomerEntryRouting.js';

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

test('normalizes exact governed Profile IDs without allowlists or aliases', () => {
  assert.equal(normalizeOrdinaryCustomerProfileId(' mm-20260617-ybnwt0ks '), 'MM-20260617-YBNWT0KS');
  assert.equal(normalizeOrdinaryCustomerProfileId('not-a-profile'), null);
});

test('routes a compatible BOS artifact to the public New BOS customer route', async () => {
  let request;
  const result = await resolveOrdinaryBosEntry('MM-20260617-YBNWT0KS', async (...args) => {
    request = args;
    return response(200, { artifact: { artifact_sha256: 'accepted' } });
  });
  assert.equal(result.status, 'current');
  assert.equal(result.destination, '/new-bos?id=MM-20260617-YBNWT0KS');
  assert.equal(request[0], '/api/moremindmap/new-bos?id=MM-20260617-YBNWT0KS');
  assert.deepEqual(request[1], {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  });
});

test('routes a compatible BA artifact and an advancing compatible BA to Business Twin', async () => {
  const ready = await resolveOrdinaryBaEntry('MM-20260617-YBNWT0KS', async () =>
    response(200, { artifact: { artifact_sha256: 'accepted' } }));
  assert.equal(ready.status, 'current');
  assert.equal(ready.destination, '/business-twin?id=MM-20260617-YBNWT0KS');

  const pending = await resolveOrdinaryBaEntry('MM-20260617-YBNWT0KS', async () =>
    response(202, { pending: true, status: 'GENERATION_ADVANCING' }));
  assert.equal(pending.status, 'current');
  assert.equal(pending.pending, true);
});

test('uses legacy only for explicit governed incompatibility or missing current authority', async () => {
  const bos = await resolveOrdinaryBosEntry('MM-20260617-YBNWT0KS', async () =>
    response(409, { safe_code: 'new_bos_modernization_requires_evidence_or_review' }));
  const ba = await resolveOrdinaryBaEntry('MM-20260729-PNY8899B', async () =>
    response(500, { safe_code: 'new_ba_business_assessment_not_found' }));
  assert.equal(bos.status, 'governed_fallback');
  assert.equal(ba.status, 'governed_fallback');
});

test('fails closed instead of silently rendering legacy on unknown runtime or identity defects', async () => {
  const runtime = await resolveOrdinaryBosEntry('MM-20260617-YBNWT0KS', async () =>
    response(500, { safe_code: 'new_bos_route_redis_binding_missing' }));
  const identity = await resolveOrdinaryBaEntry('MM-20260617-YBNWT0KS', async () =>
    response(409, { safe_code: 'new_ba_identity_mismatch' }));
  const network = await resolveOrdinaryBaEntry('MM-20260617-YBNWT0KS', async () => {
    throw new Error('offline');
  });
  assert.equal(runtime.status, 'unavailable');
  assert.equal(identity.status, 'unavailable');
  assert.equal(network.status, 'unavailable');
});

test('public destinations contain no canary, developer, fixture, token, or allowlist state', () => {
  const destinations = [
    buildOrdinaryCustomerDestination('bos', 'MM-20260617-YBNWT0KS'),
    buildOrdinaryCustomerDestination('ba', 'MM-20260617-YBNWT0KS'),
  ];
  for (const destination of destinations) {
    assert.doesNotMatch(destination, /canary|token|fixture|allowlist|preview|developer/iu);
  }
});

test('ordinary entry surfaces prefer the shared current-product resolver before legacy rendering', () => {
  const profile = fs.readFileSync('src/Profile.jsx', 'utf8');
  const ba = fs.readFileSync('src/BusinessAssessment.jsx', 'utf8');
  assert.match(profile, /resolveOrdinaryBosEntry\(data\.profile_id \|\| id\)/u);
  assert.match(profile, /window\.location\.assign\(currentBos\.destination\)/u);
  assert.match(ba, /resolveOrdinaryBaEntry\(routeProfile\)/u);
  assert.match(ba, /window\.location\.assign\(currentBa\.destination\)/u);
  assert.doesNotMatch(profile, /NEW_BOS_CANARY_PROFILE_IDS|x-new-bos-canary-token/u);
  assert.doesNotMatch(ba, /NEW_BA_CANARY_PROFILE_IDS|x-new-ba-canary-token/u);
});


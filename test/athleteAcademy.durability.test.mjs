import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { createRedisRepository } from '../server/athleteAcademyV1/repository.js';
import { createAcademyRedis, createAcademyRuntime } from '../server/athleteAcademyV1/runtime.js';
import { createYouthRegisterAuthorizer, revokeYouthRegisterAssignment } from '../server/athleteAcademyV1/youthRegisterAccess.js';
import { ownedAcademyRedis } from './helpers/ownedAcademyRedis.mjs';

let fixture, client, warm;
async function connected() {
  const connection = new Redis(fixture.url, { maxRetriesPerRequest: 0,
    enableOfflineQueue: false, retryStrategy: () => null });
  connection.on('error', () => {});
  await new Promise((resolve, reject) => {
    connection.once('ready', resolve); connection.once('error', reject);
  });
  client = connection;
  return createRedisRepository({ redis: client, prefix: 'more:athlete-academy:{test-durability}' });
}

test('canonical dossier and immutable report survive an ungraceful Redis process loss', async () => {
  fixture = await ownedAcademyRedis({ durable: true });
  let repo = await connected();
  warm = createAcademyRedis(fixture.url);
  await new Promise((resolve, reject) => { warm.once('ready', resolve); warm.once('error', reject); });
  const runtime = createAcademyRuntime({ env: { ATHLETE_ACADEMY_NAMESPACE: 'more:athlete-academy:{test-durability}' }, redis: warm });
  await repo.transact(['dossier:MM-TEST', 'report:MM-TEST'], () => ({ writes: {
    'dossier:MM-TEST': { revision: 7, mm: 'MM-TEST', report: 'report:MM-TEST' },
    'report:MM-TEST': { synthetic: true, value: 'durability-only-no-personal-data' },
  }, result: true }));
  const immutable = { synthetic: true, original: 'fictional immutable report' };
  await repo.putImmutable('report:MM-TEST:immutable', immutable);
  const at = Date.parse('2026-10-04T19:00:00Z');
  const actor = { id: randomUUID(), verified: true, role: 'guardian', region: 'US-CA',
    dateOfBirth: '1980-01-01', sessionVersion: 1, securityVersion: 1 };
  await repo.putImmutable(`account:${actor.id}`, actor);
  const binding = { actorId: actor.id, assignmentId: randomUUID(), securityVersion: 1,
    startsAt: at - 1, expiresAt: at + 86400000, permission: 'youth_approval_register_read',
    scope: 'california_youth', subjectMms: 'all_registered_california_youth',
    authorityReceipt: 'fictional-durability-authority-v1' };
  const config = { youthRegisterBinding: binding };
  await createYouthRegisterAuthorizer({ repo, config, now: () => at })(actor);
  await revokeYouthRegisterAssignment({ repo, actorId: actor.id, assignmentId: binding.assignmentId,
    authorityReceipt: 'fictional-durability-revocation-v1', at });
  await fixture.stop('SIGKILL');
  client.disconnect();
  await fixture.start();
  repo = await connected();
  assert.equal((await repo.read('dossier:MM-TEST')).revision, 7);
  assert.equal((await repo.read('report:MM-TEST')).value, 'durability-only-no-personal-data');
  assert.deepEqual(await repo.read('report:MM-TEST:immutable'), immutable);
  await assert.rejects(repo.putImmutable('report:MM-TEST:immutable', { synthetic: true, original: 'overwrite' }), /IMMUTABLE_RECORD_CONFLICT/);
  await assert.rejects(createYouthRegisterAuthorizer({ repo, config, now: () => at })(actor), /YOUTH_REGISTER_READ_DENIED/);
  for (let i = 0; i < 100 && warm.status !== 'ready'; i++) await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal((await runtime.repo.read('dossier:MM-TEST')).revision, 7,
    'same warm runtime reconnects after database restart');
  await warm.quit(); await client.quit(); await fixture.stop();
});

test.after(async () => { client?.disconnect(); warm?.disconnect(); await fixture?.stop(); });

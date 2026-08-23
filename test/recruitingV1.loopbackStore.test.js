import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LoopbackJsonRecruitingStore } from '../api/engine/recruitingV1/loopbackJsonStore.js';
import { createEmptyRecruitingState } from '../src/lib/recruitingV1/store.js';

test('synthetic JSON persistence is loopback-only and commits by durable file replacement', async () => {
  assert.throws(() => new LoopbackJsonRecruitingStore({ filePath: '/tmp/denied.json', initialState: {}, host: '0.0.0.0' }), /LOOPBACK_ONLY/);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'recruiting-v1-store-'));
  const filePath = path.join(directory, 'state.json');
  const store = new LoopbackJsonRecruitingStore({ filePath, initialState: createEmptyRecruitingState(), host: '127.0.0.1' });
  await store.transaction((state) => {
    state.audit.push({ event_id: 'synthetic_event', event_type: 'SYNTHETIC_ONLY' });
    return { ok: true };
  });
  assert.equal((await store.read()).audit[0].event_type, 'SYNTHETIC_ONLY');
  assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600);
  await fs.rm(directory, { recursive: true });
});

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { normalizeRecruitingState } from '../../../src/lib/recruitingV1/store.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

function assertLoopback(host) {
  const normalized = String(host || '').trim().toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(normalized)) throw new Error('RECRUITING_SYNTHETIC_JSON_STORE_LOOPBACK_ONLY');
}

export class LoopbackJsonRecruitingStore {
  constructor({ filePath, initialState, host = '127.0.0.1' }) {
    assertLoopback(host);
    if (!path.isAbsolute(filePath || '')) throw new Error('RECRUITING_SYNTHETIC_JSON_STORE_ABSOLUTE_PATH_REQUIRED');
    this.filePath = filePath;
    this.initialState = normalizeRecruitingState(initialState);
    this.queue = Promise.resolve();
  }

  async read() {
    await this.queue;
    try {
      return normalizeRecruitingState(JSON.parse(await fs.readFile(this.filePath, 'utf8')));
    } catch (error) {
      if (error?.code === 'ENOENT') return clone(this.initialState);
      throw new Error('RECRUITING_SYNTHETIC_JSON_STORE_CORRUPT', { cause: error });
    }
  }

  async transaction(operation) {
    let result;
    this.queue = this.queue.then(async () => {
      const state = await this.readUnlocked();
      result = await operation(state);
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
      await fs.rename(temporary, this.filePath);
    });
    await this.queue;
    return clone(result);
  }

  async readUnlocked() {
    try {
      return normalizeRecruitingState(JSON.parse(await fs.readFile(this.filePath, 'utf8')));
    } catch (error) {
      if (error?.code === 'ENOENT') return clone(this.initialState);
      throw new Error('RECRUITING_SYNTHETIC_JSON_STORE_CORRUPT', { cause: error });
    }
  }
}

export const RECRUITING_SYNTHETIC_STORE_CONTRACT = Object.freeze({
  network_scope: 'LOOPBACK_ONLY',
  production_allowed: false,
  atomic_write: 'temporary file then rename',
  contains_real_customer_data: false,
});

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

export const PREFIX = 'more:athlete-academy:{v1}';
export const digest = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export function requireValue(ok, code, status = 422) { if (!ok) throw Object.assign(new Error(code), { code, status }); }
const validKey = (key) => typeof key === 'string' && /^[A-Za-z0-9:_\-.]{1,350}$/.test(key) && !key.split(':').some((part) => ['__proto__', 'constructor', 'prototype'].includes(part));
export const CAS_LUA = `-- ATHLETE_ACADEMY_ATOMIC_CAS_V1
for i=1,#KEYS do
 local prior=redis.call('GET',KEYS[i])
 if (prior or '') ~= ARGV[i] then return 0 end
end
for i=1,#KEYS do
 local next=ARGV[#KEYS+i]
 if next ~= '' then redis.call('SET',KEYS[i],next) end
end
return 1`;

// All documents use one Redis cluster hash slot. No transaction can cross into
// an adult, customer or DarrenDemo namespace; no delete API exists.
export function createRedisRepository({ redis, prefix = PREFIX, maxBytes = 16 * 1024 * 1024, maxRetries = 12 }) {
  requireValue(redis && typeof redis.get === 'function' && typeof redis.eval === 'function', 'ACADEMY_STORAGE_REQUIRED', 503);
  requireValue(prefix === PREFIX || /^more:athlete-academy:\{test-[a-zA-Z0-9-]+\}$/.test(prefix), 'ACADEMY_NAMESPACE_REQUIRED');
  const keyFor = (key) => { requireValue(validKey(key), 'INVALID_STORAGE_KEY'); return `${prefix}:${key}`; };
  const parse = (raw) => {
    if (raw === null || raw === undefined) return null;
    requireValue(typeof raw === 'string' && Buffer.byteLength(raw) <= maxBytes, 'STORAGE_DOCUMENT_INVALID', 503);
    try { return JSON.parse(raw); } catch { throw Object.assign(new Error('STORAGE_DOCUMENT_CORRUPT'), { status: 503 }); }
  };
  const read = async (key) => parse(await redis.get(keyFor(key)));
  async function transact(keys, mutation) {
    requireValue(Array.isArray(keys) && keys.length > 0 && keys.length <= 100 && new Set(keys).size === keys.length, 'INVALID_TRANSACTION_KEYS');
    const physical = keys.map(keyFor);
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const raw = await Promise.all(physical.map((key) => redis.get(key)));
      const snapshot = Object.fromEntries(keys.map((key, i) => [key, parse(raw[i])]));
      const transaction = await mutation(structuredClone(snapshot));
      requireValue(transaction && transaction.writes && Object.keys(transaction.writes).every((key) => keys.includes(key)), 'UNDECLARED_TRANSACTION_WRITE');
      const values = keys.map((key) => {
        if (!Object.hasOwn(transaction.writes, key)) return '';
        requireValue(transaction.writes[key] !== null && transaction.writes[key] !== undefined, 'DESTRUCTIVE_WRITE_FORBIDDEN');
        const serialized = JSON.stringify(transaction.writes[key]);
        requireValue(Buffer.byteLength(serialized) <= maxBytes, 'STORAGE_DOCUMENT_TOO_LARGE', 413);
        return serialized;
      });
      // A failed/unknown acknowledgment is deliberately not rerun here.
      let accepted;
      try { accepted = await redis.eval(CAS_LUA, keys.length, ...physical, ...raw.map((value) => value ?? ''), ...values); }
      catch { throw Object.assign(new Error('STORAGE_OUTCOME_UNKNOWN'), { code: 'STORAGE_OUTCOME_UNKNOWN', status: 503 }); }
      if (Number(accepted) === 1) return structuredClone(transaction.result);
    }
    throw Object.assign(new Error('CONCURRENT_UPDATE_RETRY'), { status: 409 });
  }
  async function putImmutable(key, value) {
    return transact([key], (saved) => {
      if (saved[key] !== null) { requireValue(digest(saved[key]) === digest(value), 'IMMUTABLE_RECORD_CONFLICT', 409); return { writes: {}, result: saved[key] }; }
      return { writes: { [key]: value }, result: value };
    });
  }
  return Object.freeze({ read, transact, putImmutable, prefix });
}

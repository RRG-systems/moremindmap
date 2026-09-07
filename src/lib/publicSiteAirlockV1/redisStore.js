/* global process */
import Redis from 'ioredis';

const CLAIM_PRODUCT_EXECUTION_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  redis.call('SET', KEYS[1], ARGV[1])
  return cjson.encode({code='ACQUIRED', record=cjson.decode(ARGV[1])})
end
local decoded, record = pcall(cjson.decode, raw)
if not decoded or type(record) ~= 'table' then
  return cjson.encode({code='CONFLICT'})
end
if record.contract_version ~= ARGV[2]
  or record.product_key ~= ARGV[3]
  or record.request_sha256 ~= ARGV[4]
  or record.authority_type ~= ARGV[5]
  or record.authority_ref ~= ARGV[6] then
  return cjson.encode({code='CONFLICT'})
end
if record.state == 'COMMITTED' then
  return cjson.encode({code='REPLAY', record=record})
end
if record.state ~= 'CLAIMED' then
  return cjson.encode({code='CONFLICT'})
end
if tonumber(record.lease_until_ms or 0) <= tonumber(ARGV[7]) then
  record.lease_token = ARGV[8]
  record.lease_until_ms = tonumber(ARGV[9])
  record.updated_at = ARGV[10]
  redis.call('SET', KEYS[1], cjson.encode(record))
  return cjson.encode({code='ACQUIRED', record=record, recovered=true})
end
return cjson.encode({code='IN_PROGRESS', record=record})
`;

const COMMIT_PRODUCT_EXECUTION_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return cjson.encode({code='LOST'}) end
local decoded, record = pcall(cjson.decode, raw)
if not decoded or type(record) ~= 'table' then return cjson.encode({code='CONFLICT'}) end
if record.state == 'COMMITTED' then
  return cjson.encode({code='REPLAY', record=record})
end
if record.state ~= 'CLAIMED' or record.lease_token ~= ARGV[1] then
  return cjson.encode({code='LOST'})
end
local mutation = cjson.decode(ARGV[2])
for _, entry in ipairs(mutation.set_values or {}) do
  redis.call('SET', entry.key, entry.value)
end
for _, entry in ipairs(mutation.set_members or {}) do
  redis.call('SADD', entry.key, entry.value)
end
record.state = 'COMMITTED'
record.result = mutation.result
record.lease_token = cjson.null
record.lease_until_ms = 0
record.updated_at = ARGV[3]
redis.call('SET', KEYS[1], cjson.encode(record))
return cjson.encode({code='COMMITTED', record=record})
`;

const RELEASE_PRODUCT_EXECUTION_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local decoded, record = pcall(cjson.decode, raw)
if not decoded or type(record) ~= 'table' then return 0 end
if record.state ~= 'CLAIMED' or record.lease_token ~= ARGV[1] then return 0 end
record.lease_token = cjson.null
record.lease_until_ms = 0
record.updated_at = ARGV[2]
redis.call('SET', KEYS[1], cjson.encode(record))
return 1
`;

const COMMIT_COMPLIMENTARY_REDEMPTION_LUA = `
local receipt = redis.call('GET', KEYS[1])
local grant = redis.call('GET', KEYS[2])
local own_use = redis.call('SISMEMBER', KEYS[3], ARGV[1])
local indexed = 1
if ARGV[5] == '1' then
  indexed = redis.call('SISMEMBER', KEYS[4], ARGV[6])
end
if receipt then
  if receipt == ARGV[4]
    and grant == ARGV[3]
    and own_use == 1
    and indexed == 1 then
    return 'REPLAY'
  end
  return 'CONFLICT'
end
if (grant and grant ~= ARGV[3]) or (own_use == 1 and not grant) then
  return 'CONFLICT'
end
if own_use == 0 and redis.call('SCARD', KEYS[3]) >= tonumber(ARGV[2]) then
  return 'EXHAUSTED'
end
local repairing = grant or own_use == 1
redis.call('SET', KEYS[2], ARGV[3])
redis.call('SADD', KEYS[3], ARGV[1])
if ARGV[5] == '1' then
  redis.call('SADD', KEYS[4], ARGV[6])
end
redis.call('SET', KEYS[1], ARGV[4])
if repairing then return 'REPAIRED' end
return 'CREATED'
`;

export class RedisPublicStore {
  constructor(redis) { this.redis = redis; }
  async get(key) { return this.redis.get(key); }
  async set(key, value) { return this.redis.set(key, value); }
  async setExpiring(key, value, ttlSeconds) {
    return this.redis.set(key, value, 'EX', ttlSeconds);
  }
  async setNx(key, value, ttlSeconds = null) {
    const result = Number.isFinite(ttlSeconds) && ttlSeconds > 0
      ? await this.redis.set(key, value, 'EX', ttlSeconds, 'NX')
      : await this.redis.set(key, value, 'NX');
    return result === 'OK';
  }
  async del(key) { return this.redis.del(key); }
  async compareDel(key, expected) {
    if (typeof this.redis.compareDel === 'function') {
      return this.redis.compareDel(key, expected);
    }
    return this.redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      expected,
    );
  }
  async sadd(key, value) { return this.redis.sadd(key, value); }
  async smembers(key) { return this.redis.smembers(key); }
  async srem(key, value) { return this.redis.srem(key, value); }
  async incr(key) { return this.redis.incr(key); }
  async expire(key, seconds) { return this.redis.expire(key, seconds); }
  async commitComplimentaryRedemption({
    redemptionKey,
    grantKey,
    usageKey,
    profileIndexKey = '',
    redemptionId,
    grantId,
    maxUses,
    serializedGrant,
    serializedJournal,
  }) {
    if (typeof this.redis.commitComplimentaryRedemption === 'function') {
      return this.redis.commitComplimentaryRedemption({
        redemptionKey,
        grantKey,
        usageKey,
        profileIndexKey,
        redemptionId,
        grantId,
        maxUses,
        serializedGrant,
        serializedJournal,
      });
    }
    return this.redis.eval(
      COMMIT_COMPLIMENTARY_REDEMPTION_LUA,
      4,
      redemptionKey,
      grantKey,
      usageKey,
      profileIndexKey || grantKey,
      redemptionId,
      String(maxUses),
      serializedGrant,
      serializedJournal,
      profileIndexKey ? '1' : '0',
      grantId,
    );
  }
  async claimProductExecution({ key, initialRecord, nowMs, leaseToken, leaseUntilMs }) {
    if (typeof this.redis.claimProductExecution === 'function') {
      return this.redis.claimProductExecution({ key, initialRecord, nowMs, leaseToken, leaseUntilMs });
    }
    const raw = await this.redis.eval(
      CLAIM_PRODUCT_EXECUTION_LUA,
      1,
      key,
      JSON.stringify(initialRecord),
      initialRecord.contract_version,
      initialRecord.product_key,
      initialRecord.request_sha256,
      initialRecord.authority_type,
      initialRecord.authority_ref,
      String(nowMs),
      leaseToken,
      String(leaseUntilMs),
      initialRecord.updated_at,
    );
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }
  async commitProductExecution({ key, leaseToken, result, setValues = [], setMembers = [], updatedAt }) {
    if (typeof this.redis.commitProductExecution === 'function') {
      return this.redis.commitProductExecution({ key, leaseToken, result, setValues, setMembers, updatedAt });
    }
    const raw = await this.redis.eval(
      COMMIT_PRODUCT_EXECUTION_LUA,
      1,
      key,
      leaseToken,
      JSON.stringify({ result, set_values: setValues, set_members: setMembers }),
      updatedAt,
    );
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }
  async releaseProductExecution({ key, leaseToken, updatedAt }) {
    if (typeof this.redis.releaseProductExecution === 'function') {
      return this.redis.releaseProductExecution({ key, leaseToken, updatedAt });
    }
    return this.redis.eval(RELEASE_PRODUCT_EXECUTION_LUA, 1, key, leaseToken, updatedAt);
  }
  async close() { return this.redis.quit(); }
}

export function createRedisPublicStore(env = process.env) {
  if (!env.REDIS_URL) throw new Error('redis_configuration_unavailable');
  return new RedisPublicStore(new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: false,
  }));
}

import { hashCanonicalJson } from '../../../hashing.js';
import { validateIntelligenceEvent } from '../../../intelligenceEvent.js';
import { deepFreeze } from '../../../validation.js';

export const PRIVATE_LIVE_PRODUCT_STORE_VERSION = 'private-live-product-store-v1';

const APPEND_SCRIPT = `
-- more-private-live-append-v1
local seq_type = redis.call('TYPE', KEYS[1]).ok
local item_type = redis.call('TYPE', KEYS[2]).ok
local index_type = redis.call('TYPE', KEYS[3]).ok
local idem_type = redis.call('TYPE', KEYS[4]).ok
if (seq_type ~= 'none' and seq_type ~= 'string')
  or (item_type ~= 'none' and item_type ~= 'string')
  or (index_type ~= 'none' and index_type ~= 'list')
  or (idem_type ~= 'none' and idem_type ~= 'string') then
  return {'STORE_TYPE_MISMATCH', '', redis.call('GET', KEYS[1]) or '0'}
end
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local existing = redis.call('GET', KEYS[4])
if existing then
  if existing == ARGV[1] then
    return {'IDEMPOTENT_REPLAY', redis.call('GET', KEYS[2]) or '', tostring(current)}
  end
  return {'IDEMPOTENCY_CONFLICT', '', tostring(current)}
end
if redis.call('EXISTS', KEYS[2]) == 1 then
  return {'IDENTITY_CONFLICT', '', tostring(current)}
end
if current ~= tonumber(ARGV[2]) then
  return {'SEQUENCE_CONFLICT', '', tostring(current)}
end
redis.call('SET', KEYS[2], ARGV[3], 'NX')
redis.call('RPUSH', KEYS[3], KEYS[2])
redis.call('SET', KEYS[1], tostring(current + 1))
redis.call('SET', KEYS[4], ARGV[1], 'NX')
return {'APPENDED', ARGV[3], tostring(current + 1)}
`;

const frozen = (value) => deepFreeze(structuredClone(value));

export async function connectPrivateRuntimeProductStoreClientV1(client) {
  if (client == null || typeof client !== 'object') return false;
  if (client.status === 'ready') return true;
  if (client.status !== 'wait') return false;
  if (typeof client.connect !== 'function') return false;
  try {
    await client.connect();
    return client.status === 'ready';
  } catch {
    return false;
  }
}

const text = (value, max = 256) => typeof value === 'string'
  && value.length > 0
  && value.length <= max;
const parse = (serialized) => {
  if (typeof serialized !== 'string' || serialized.length > 2_000_000) throw new TypeError();
  return JSON.parse(serialized);
};

function validateClient(client) {
  return client
    && ['get', 'mget', 'lrange', 'eval'].every((method) => typeof client[method] === 'function');
}

function canonicalProfileKeys(profileId) {
  const match = String(profileId || '').match(/^mm-(\d{8})-([a-z0-9]{8})$/i);
  if (!match) return [];
  return [
    `vault:profile:mm-${match[1]}-${match[2].toLowerCase()}`,
    `vault:profile:MM-${match[1]}-${match[2].toLowerCase()}`,
  ];
}

function validateWrapper(wrapper, expectedScope, expectedSequence) {
  const eventValidation = validateIntelligenceEvent(wrapper?.event);
  return eventValidation.valid
    && wrapper.store_sequence === expectedSequence
    && wrapper.aggregate_sequence === expectedSequence
    && wrapper.aggregate_key ===
      `${expectedScope.tenant_id}:BUSINESS:${expectedScope.business_id}`
    && wrapper.envelope_hash === hashCanonicalJson({
      event: wrapper.event,
      aggregate_key: wrapper.aggregate_key,
      aggregate_sequence: wrapper.aggregate_sequence,
      store_sequence: wrapper.store_sequence,
    });
}

export function createPrivateLiveProductStoreV1({
  client,
  namespacePrefix,
  exactScope,
  clock = () => new Date().toISOString(),
} = {}) {
  if (!validateClient(client)) throw new TypeError('Redis-compatible product client required');
  if (!text(namespacePrefix, 128) || !exactScope) throw new TypeError('product store scope required');
  const scopeHash = hashCanonicalJson(exactScope);
  const root = `${namespacePrefix}:${scopeHash}`;
  const eventSequenceKey = `${root}:events:sequence`;
  const eventIndexKey = `${root}:events:index`;
  const recordRoot = (kind) => `${root}:records:${kind}`;
  const safeKind = (kind) => typeof kind === 'string' && /^[a-z][a-z0-9_-]{2,63}$/.test(kind);
  const identityKey = (value) => hashCanonicalJson(value);

  async function loadCanonicalDossier() {
    for (const key of canonicalProfileKeys(exactScope.profile_id)) {
      const serialized = await client.get(key);
      if (!serialized) continue;
      const dossier = parse(serialized);
      const profileId = String(
        dossier?.profile_id
          || dossier?.canonical_profile_json?.profile_id
          || dossier?.canonical_dossier?.canonical_profile_json?.profile_id
          || '',
      ).toLowerCase();
      if (profileId !== exactScope.profile_id.toLowerCase()) {
        return frozen({ ok: false, code: 'CANONICAL_DOSSIER_SCOPE_MISMATCH' });
      }
      return frozen({
        ok: true,
        dossier,
        profile_id: exactScope.profile_id,
        source_key_hash: hashCanonicalJson(key),
        dossier_hash: hashCanonicalJson(dossier),
      });
    }
    return frozen({ ok: false, code: 'CANONICAL_DOSSIER_NOT_FOUND' });
  }

  async function loadBusinessAssessment() {
    const profileKey = `business_assessment_by_profile:${exactScope.profile_id.toLowerCase()}`;
    const assessmentId = await client.get(profileKey);
    if (!text(assessmentId, 160)) {
      return frozen({ ok: false, code: 'BUSINESS_ASSESSMENT_NOT_FOUND' });
    }
    const serialized = await client.get(`business_assessment:${assessmentId}`);
    if (!serialized) return frozen({ ok: false, code: 'BUSINESS_ASSESSMENT_NOT_FOUND' });
    const assessment = parse(serialized);
    const ownerProfileId = String(
      assessment?.profile_id
        || assessment?.assessment?.profile_id
        || assessment?.owner_profile_id
        || '',
    ).toLowerCase();
    if (ownerProfileId !== exactScope.profile_id.toLowerCase()) {
      return frozen({ ok: false, code: 'BUSINESS_ASSESSMENT_SCOPE_MISMATCH' });
    }
    return frozen({
      ok: true,
      assessment,
      assessment_id: assessmentId,
      assessment_hash: hashCanonicalJson(assessment),
      source_key_hash: hashCanonicalJson(`business_assessment:${assessmentId}`),
    });
  }

  async function readEvents() {
    const [keys, sequenceValue] = await Promise.all([
      client.lrange(eventIndexKey, 0, -1),
      client.get(eventSequenceKey),
    ]);
    if (!Array.isArray(keys)) return frozen({ ok: false, code: 'EVENT_INDEX_INVALID' });
    const storedSequence = Number(sequenceValue || 0);
    if (!Number.isInteger(storedSequence) || storedSequence !== keys.length) {
      return frozen({ ok: false, code: 'EVENT_SEQUENCE_CORRUPT' });
    }
    if (keys.length === 0) return frozen({ ok: true, events: [], sequence: 0 });
    const serialized = await client.mget(...keys);
    if (!Array.isArray(serialized) || serialized.length !== keys.length) {
      return frozen({ ok: false, code: 'EVENT_HISTORY_INCOMPLETE' });
    }
    try {
      const events = serialized.map((entry, index) => {
        const wrapper = parse(entry);
        if (!validateWrapper(wrapper, exactScope, index + 1)) throw new TypeError();
        return wrapper;
      });
      return frozen({ ok: true, events, sequence: events.length });
    } catch {
      return frozen({ ok: false, code: 'EVENT_HISTORY_CORRUPT' });
    }
  }

  async function appendEvent({
    event,
    idempotencyKey,
    expectedSequence,
  } = {}) {
    const validation = validateIntelligenceEvent(event);
    if (!validation.valid
      || event.tenant_id !== exactScope.tenant_id
      || event.profile_id !== exactScope.profile_id
      || event.business_id !== exactScope.business_id
      || !text(idempotencyKey)
      || !Number.isInteger(expectedSequence)
      || expectedSequence < 0) {
      return frozen({ ok: false, code: 'APPEND_EVENT_INVALID' });
    }
    const sequence = expectedSequence + 1;
    const aggregateKey = `${exactScope.tenant_id}:BUSINESS:${exactScope.business_id}`;
    const wrapper = {
      event,
      aggregate_key: aggregateKey,
      aggregate_sequence: sequence,
      store_sequence: sequence,
      stored_at: clock(),
    };
    wrapper.envelope_hash = hashCanonicalJson({
      event,
      aggregate_key: aggregateKey,
      aggregate_sequence: sequence,
      store_sequence: sequence,
    });
    const eventKey = `${root}:events:item:${identityKey(event.event_id)}`;
    const idemKey = `${root}:events:idem:${identityKey(idempotencyKey)}`;
    const fingerprint = hashCanonicalJson({ event, idempotencyKey });
    const response = await client.eval(
      APPEND_SCRIPT,
      4,
      eventSequenceKey,
      eventKey,
      eventIndexKey,
      idemKey,
      fingerprint,
      String(expectedSequence),
      JSON.stringify(wrapper),
    );
    const status = Array.isArray(response) ? response[0] : null;
    if (status === 'APPENDED' || status === 'IDEMPOTENT_REPLAY') {
      const stored = parse(response[1]);
      return frozen({
        ok: true,
        status,
        event_id: stored.event.event_id,
        sequence: Number(response[2]),
        wrapper: stored,
      });
    }
    return frozen({
      ok: false,
      code: status || 'APPEND_EVENT_FAILED',
      sequence: Number(response?.[2] || 0),
    });
  }

  async function appendRecord({
    kind,
    recordId,
    value,
    idempotencyKey,
    expectedSequence,
    previousRecordId = null,
  } = {}) {
    if (!safeKind(kind)
      || !text(recordId)
      || !text(idempotencyKey)
      || (previousRecordId != null && !text(previousRecordId))
      || !Number.isInteger(expectedSequence)
      || expectedSequence < 0) {
      return frozen({ ok: false, code: 'APPEND_RECORD_INVALID' });
    }
    let valueHash;
    try {
      valueHash = hashCanonicalJson(value);
    } catch {
      return frozen({ ok: false, code: 'APPEND_RECORD_INVALID' });
    }
    const base = recordRoot(kind);
    const itemKey = `${base}:item:${identityKey(recordId)}`;
    const indexKey = `${base}:index`;
    const sequenceKey = `${base}:sequence`;
    const idemKey = `${base}:idem:${identityKey(idempotencyKey)}`;
    const record = {
      record_version: 'private-live-immutable-record-v1',
      kind,
      record_id: recordId,
      sequence: expectedSequence + 1,
      scope_hash: scopeHash,
      recorded_at: clock(),
      value,
      value_hash: valueHash,
      previous_record_id: previousRecordId,
    };
    const fingerprint = hashCanonicalJson({ kind, recordId, valueHash, idempotencyKey });
    const response = await client.eval(
      APPEND_SCRIPT,
      4,
      sequenceKey,
      itemKey,
      indexKey,
      idemKey,
      fingerprint,
      String(expectedSequence),
      JSON.stringify(record),
    );
    const status = Array.isArray(response) ? response[0] : null;
    if (status === 'APPENDED' || status === 'IDEMPOTENT_REPLAY') {
      return frozen({
        ok: true,
        status,
        sequence: Number(response[2]),
        record: parse(response[1]),
      });
    }
    return frozen({
      ok: false,
      code: status || 'APPEND_RECORD_FAILED',
      sequence: Number(response?.[2] || 0),
    });
  }

  async function readRecords(kind) {
    if (!safeKind(kind)) return frozen({ ok: false, code: 'RECORD_KIND_INVALID' });
    const base = recordRoot(kind);
    const [keys, sequenceValue] = await Promise.all([
      client.lrange(`${base}:index`, 0, -1),
      client.get(`${base}:sequence`),
    ]);
    if (!Array.isArray(keys)) return frozen({ ok: false, code: 'RECORD_INDEX_INVALID' });
    const storedSequence = Number(sequenceValue || 0);
    if (!Number.isInteger(storedSequence) || storedSequence !== keys.length) {
      return frozen({ ok: false, code: 'RECORD_SEQUENCE_CORRUPT' });
    }
    if (keys.length === 0) return frozen({ ok: true, records: [], sequence: 0 });
    const serialized = await client.mget(...keys);
    try {
      const records = serialized.map((entry, index) => {
        const record = parse(entry);
        if (record.record_version !== 'private-live-immutable-record-v1'
          || record.kind !== kind
          || record.scope_hash !== scopeHash
          || record.sequence !== index + 1
          || record.previous_record_id !== (index === 0
            ? null
            : parse(serialized[index - 1]).record_id)
          || record.value_hash !== hashCanonicalJson(record.value)) {
          throw new TypeError();
        }
        return record;
      });
      return frozen({ ok: true, records, sequence: records.length });
    } catch {
      return frozen({ ok: false, code: 'RECORD_HISTORY_CORRUPT' });
    }
  }

  async function readLatestRecord(kind) {
    const result = await readRecords(kind);
    return result.ok
      ? frozen({ ...result, record: result.records.at(-1) || null })
      : result;
  }

  return Object.freeze({
    store_version: PRIVATE_LIVE_PRODUCT_STORE_VERSION,
    exact_scope_hash: scopeHash,
    append_only: true,
    immutable_history: true,
    destructive_operations: false,
    loadCanonicalDossier,
    loadBusinessAssessment,
    readEvents,
    appendEvent,
    readRecords,
    readLatestRecord,
    appendRecord,
  });
}

import { randomUUID } from 'node:crypto';
import { FULL_PERSON_QA_CASE_VERTICALS } from './fullPersonQaAccess.js';
import { canonicalJson, hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';

export const SYNTHETIC_QA_CAMPAIGN = 'live-four-synthetics-generation-v1';
export const SYNTHETIC_QA_ALLOCATION = Object.freeze({ total_micro_usd: 20_000_000,
  native_generation_micro_usd: 12_000_000, live_coaching_micro_usd: 8_000_000 });
const PREFIX = `more:subscription:synthetic-qa:provider-budget:${SYNTHETIC_QA_CAMPAIGN}`;
export const SYNTHETIC_QA_BUDGET_KEYS = Object.freeze({ custody: `${PREFIX}:custody`, ledger: `${PREFIX}:ledger` });
const CAS = "if redis.call('GET',KEYS[1]) ~= ARGV[1] then return -1 end if redis.call('GET',KEYS[2]) ~= ARGV[2] then return 0 end redis.call('SET',KEYS[2],ARGV[3]); return 1";
const ATTEMPT_STAGES = new Set(['CONVERSATION', 'CANDIDATE_EXTRACTION', 'NATURAL_AUTHORIZATION', 'SESSION_CLOSE', 'GU']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');

// V1 retains its exact full-grant ledger identity. V2 changes only the reviewed
// stage fields; every other signed field remains immutable for this allowance.
export function syntheticQaBudgetGrantSha256(grant) {
  if (grant.contract !== 'SYNTHETIC_QA_MODEL2_PROVIDER_GRANT_V2') return hashCanonicalJson(grant);
  const budget = Object.fromEntries(Object.entries(grant).filter(([key]) =>
    !['cohort', 'manifest_sha256', 'candidate_sha256'].includes(key)));
  return hashCanonicalJson(budget);
}

// Pure preparation only: this module deliberately has no initialization, reset,
// refill, expiry, or alternate-namespace operation. Future provisioning must
// seal this one allocation and the native allocation under the SAME approval.
export function syntheticQaBudgetCustody(grantSha256, grant) {
  return { contract: 'SYNTHETIC_QA_SHARED_ALLOWANCE_PARTITION_V1', campaign_id: SYNTHETIC_QA_CAMPAIGN,
    grant_sha256: grantSha256, approval_sha256: grant.approval_sha256,
    initialization_id: grant.ledger_initialization_id, ...SYNTHETIC_QA_ALLOCATION,
    ...(grant.contract === 'SYNTHETIC_QA_MODEL2_PROVIDER_GRANT_V2'
      ? { active_grant_sha256: hashCanonicalJson(grant) } : {}),
    native_range_micro_usd: [0, 12_000_000], live_range_micro_usd: [12_000_000, 20_000_000] };
}

export function createSyntheticQaProviderBudget({ redis, grant, grantSha256 }) {
  if (typeof redis?.get !== 'function' || typeof redis?.eval !== 'function') fail('SYNTHETIC_QA_DURABLE_BUDGET_REQUIRED');
  const staged = grant.contract === 'SYNTHETIC_QA_MODEL2_PROVIDER_GRANT_V2';
  const budgetGrantSha256 = syntheticQaBudgetGrantSha256(grant);
  // A reviewed stage transition changes custody only, never ledger history.
  // Old deployments fail this same custody comparison at reserve AND confirm.
  const expectedCustody = canonicalJson(syntheticQaBudgetCustody(budgetGrantSha256, grant));
  function validate(state) {
    const baseKeys = ['id', 'case_id', 'stage', 'wire_sha256', 'operation_id', 'ordinal', 'request_sha256',
      'reserved_micro_usd', 'held_micro_usd', 'status', ...(staged ? ['stage_grant_sha256'] : [])];
    const validAttempt = attempt => {
      if (!attempt || !UUID.test(attempt.id || '') || !(staged ? Object.hasOwn(FULL_PERSON_QA_CASE_VERTICALS, attempt.case_id) : grant.cohort.some(c => c.case_id === attempt.case_id))
        || staged && !SHA256.test(attempt.stage_grant_sha256 || '')
        || !ATTEMPT_STAGES.has(attempt.stage) || !SHA256.test(attempt.wire_sha256 || '')
        || !UUID.test(attempt.operation_id || '') || !Number.isSafeInteger(attempt.ordinal) || attempt.ordinal < 1 || attempt.ordinal > 1024
        || !SHA256.test(attempt.request_sha256 || '')
        || attempt.request_sha256 !== hashCanonicalJson({ requestSha256: attempt.wire_sha256,
          operationId: attempt.operation_id, ordinal: attempt.ordinal })
        || !Number.isSafeInteger(attempt.reserved_micro_usd) || attempt.reserved_micro_usd <= 0
        || attempt.reserved_micro_usd > SYNTHETIC_QA_ALLOCATION.live_coaching_micro_usd
        || !Number.isSafeInteger(attempt.held_micro_usd) || attempt.held_micro_usd < 0
        || attempt.held_micro_usd > attempt.reserved_micro_usd) return false;
      if (attempt.status === 'RESERVED') {
        return exactKeys(attempt, baseKeys) && attempt.held_micro_usd === attempt.reserved_micro_usd;
      }
      if (attempt.status === 'UNRESOLVED') {
        return exactKeys(attempt, [...baseKeys, 'failure_preserved']) && attempt.failure_preserved === true
          && attempt.held_micro_usd === attempt.reserved_micro_usd;
      }
      if (attempt.status !== 'SETTLED' || !exactKeys(attempt, [...baseKeys, 'usage', 'actual_invoice_known'])
        || attempt.actual_invoice_known !== false || !exactKeys(attempt.usage, ['input_tokens', 'output_tokens'])
        || !Number.isSafeInteger(attempt.usage.input_tokens) || attempt.usage.input_tokens < 0
        || !Number.isSafeInteger(attempt.usage.output_tokens) || attempt.usage.output_tokens < 0
        || attempt.held_micro_usd !== attempt.usage.input_tokens * 10 + attempt.usage.output_tokens * 60) return false;
      return true;
    };
    if (!exactKeys(state, ['contract', 'grant_sha256', 'initialization_id', 'revision', 'attempts', 'halted'])
      || state.contract !== 'SYNTHETIC_QA_LIVE_PROVIDER_SPEND_V1' || state.grant_sha256 !== budgetGrantSha256
      || state.initialization_id !== grant.ledger_initialization_id
      || !Number.isSafeInteger(state.revision) || state.revision < 0 || !Array.isArray(state.attempts)
      || typeof state.halted !== 'boolean' || state.attempts.length > 1024
      || state.attempts.some(a => !validAttempt(a))
      || new Set(state.attempts.map(a => a.id)).size !== state.attempts.length
      || new Set(state.attempts.map(a => a.request_sha256)).size !== state.attempts.length
      || new Set(state.attempts.map(a => `${a.operation_id}:${a.ordinal}`)).size !== state.attempts.length
      || state.attempts.reduce((n, a) => n + a.held_micro_usd, 0) > SYNTHETIC_QA_ALLOCATION.live_coaching_micro_usd) {
      fail('SYNTHETIC_QA_BUDGET_CUSTODY_INVALID');
    }
    return state;
  }
  async function transaction(change) {
    // Retry only a failed CAS, never a provider call. Existing Redis CAS idiom;
    // no process-local balance or expiring reservation lock is authoritative.
    for (let n = 0; n < 32; n += 1) {
      const [custody, raw] = await Promise.all([redis.get(SYNTHETIC_QA_BUDGET_KEYS.custody), redis.get(SYNTHETIC_QA_BUDGET_KEYS.ledger)]);
      if (custody !== expectedCustody || !raw) fail('SYNTHETIC_QA_BUDGET_PREINITIALIZED_CUSTODY_REQUIRED');
      let state; try { state = validate(JSON.parse(raw)); } catch { fail('SYNTHETIC_QA_BUDGET_CUSTODY_INVALID'); }
      const result = change(state);
      state.revision += 1; validate(state);
      const saved = await redis.eval(CAS, 2, SYNTHETIC_QA_BUDGET_KEYS.custody, SYNTHETIC_QA_BUDGET_KEYS.ledger,
        expectedCustody, raw, canonicalJson(state));
      if (saved === 1) return result;
      if (saved !== 0) fail('SYNTHETIC_QA_BUDGET_CUSTODY_CHANGED');
    }
    fail('SYNTHETIC_QA_BUDGET_CONTENTION');
  }
  return Object.freeze({
    reserve({ requestSha256, operationId, ordinal, caseId, stage, reservedMicroUsd }) {
      return transaction(state => {
        if (state.halted) fail('SYNTHETIC_QA_PRIOR_FAILURE_REQUIRES_REVIEW');
        if (!SHA256.test(requestSha256 || '') || !UUID.test(operationId || '')
          || !Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 1024
          || !grant.cohort.some(c => c.case_id === caseId) || !ATTEMPT_STAGES.has(stage)) {
          fail('SYNTHETIC_QA_RESERVATION_SCHEMA_INVALID');
        }
        if (state.attempts.some(a => a.wire_sha256 === requestSha256 && a.operation_id !== operationId)) fail('SYNTHETIC_QA_REPLAY_OR_REROLL_DENIED');
        if (state.attempts.length >= 1024 || !Number.isSafeInteger(reservedMicroUsd) || reservedMicroUsd <= 0
          || reservedMicroUsd > SYNTHETIC_QA_ALLOCATION.live_coaching_micro_usd
          || state.attempts.reduce((n, a) => n + a.held_micro_usd, 0) + reservedMicroUsd > SYNTHETIC_QA_ALLOCATION.live_coaching_micro_usd) fail('SYNTHETIC_QA_LIVE_ALLOCATION_EXHAUSTED');
        const id = randomUUID();
        state.attempts.push({ id, case_id: caseId, stage, ...(staged ? { stage_grant_sha256: grantSha256 } : {}), wire_sha256: requestSha256, operation_id: operationId, ordinal,
          request_sha256: hashCanonicalJson({ requestSha256, operationId, ordinal }),
          reserved_micro_usd: reservedMicroUsd, held_micro_usd: reservedMicroUsd, status: 'RESERVED' });
        return id;
      });
    },
    confirm(id) {
      return transaction(state => {
        if (state.halted || !state.attempts.some(a => a.id === id && a.status === 'RESERVED')) fail('SYNTHETIC_QA_DISPATCH_RESERVATION_UNAVAILABLE');
      });
    },
    settle(id, usage, cost) {
      return transaction(state => {
        const attempt = state.attempts.find(a => a.id === id);
        if (!attempt || attempt.status !== 'RESERVED') fail('SYNTHETIC_QA_RESERVATION_NOT_PENDING');
        // A halted accounting state cannot free a pending reservation. Normal
        // provider failures remain held and permit only existing runtime retries.
        if (state.halted || !exactKeys(usage, ['input_tokens', 'output_tokens'])
          || !Number.isSafeInteger(usage.input_tokens) || usage.input_tokens < 0
          || !Number.isSafeInteger(usage.output_tokens) || usage.output_tokens < 0
          || !Number.isSafeInteger(cost) || cost < 0
          || cost !== usage.input_tokens * 10 + usage.output_tokens * 60
          || cost > attempt.reserved_micro_usd) {
          attempt.status = 'UNRESOLVED'; attempt.held_micro_usd = attempt.reserved_micro_usd;
          attempt.failure_preserved = true;
          state.halted = true; return false;
        }
        attempt.usage = usage; attempt.held_micro_usd = cost; attempt.status = 'SETTLED';
        attempt.actual_invoice_known = false;
        return true;
      });
    },
    retain(ids) {
      if (!ids.length) return Promise.resolve();
      return transaction(state => {
        for (const id of ids) {
          const attempt = state.attempts.find(a => a.id === id);
          if (!attempt) fail('SYNTHETIC_QA_RESERVATION_MISSING');
          attempt.status = 'UNRESOLVED'; attempt.failure_preserved = true;
          delete attempt.usage; delete attempt.actual_invoice_known;
          attempt.held_micro_usd = attempt.reserved_micro_usd;
        }
      });
    },
  });
}

import { buildBusinessEngineContract, validateBusinessEngineContract } from '../../../../businessEngine/index.js';
import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  privateRuntimeBusinessEngineExecutionContractDigest,
} from '../intelligenceExecution.js';

export const FIXED_SYNTHETIC_PRODUCT_FIXTURE_VERSION =
  'fixed-synthetic-profile-and-ba-fixture-v1';
export const FIXED_SYNTHETIC_PRODUCT_FIXTURE_CAMPAIGN =
  'CREATE_FIXED_SYNTHETIC_PROFILE_AND_BA_FIXTURE_V1';
export const FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID =
  'mm-20260730-synth001';
export const FIXED_SYNTHETIC_PRODUCT_FIXTURE_ASSESSMENT_ID =
  'ba-20260730-f17e0001';

const FIXTURE_TIMESTAMP = '2026-07-30T00:00:00.000Z';
const SYNTHETIC_SOURCE = 'DETERMINISTIC_NON_CUSTOMER_QUALIFICATION_FIXTURE';
const frozen = (value) => deepFreeze(structuredClone(value));

const fixtureMetadata = Object.freeze({
  synthetic_fixture_version: FIXED_SYNTHETIC_PRODUCT_FIXTURE_VERSION,
  campaign_id: FIXED_SYNTHETIC_PRODUCT_FIXTURE_CAMPAIGN,
  synthetic_source_marker: SYNTHETIC_SOURCE,
  customer_derived: false,
  created_at: FIXTURE_TIMESTAMP,
});

export const FIXED_SYNTHETIC_VAULT_RECORD = frozen({
  profile_id: FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID,
  created_at: FIXTURE_TIMESTAMP,
  assessment_version: 'synthetic-private-beta-v1',
  model: 'deterministic-synthetic-fixture-v1',
  canonical_profile_json: {
    profile_id: FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID,
    synthetic_fixture: true,
    synthetic_fixture_version: FIXED_SYNTHETIC_PRODUCT_FIXTURE_VERSION,
    vector_scores: {},
    metadata: fixtureMetadata,
  },
  vector_scores: {},
  profile_signature: hashCanonicalJson({}).slice(0, 16),
  metadata: {
    ...fixtureMetadata,
    saved_by: FIXED_SYNTHETIC_PRODUCT_FIXTURE_VERSION,
    vault_version: '1.0.0',
  },
});

export const FIXED_SYNTHETIC_BUSINESS_ASSESSMENT = frozen({
  assessment_id: FIXED_SYNTHETIC_PRODUCT_FIXTURE_ASSESSMENT_ID,
  owner_profile_id: FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID,
  assessment_type: 'business_assessment',
  status: 'intelligence_complete',
  created_at: FIXTURE_TIMESTAMP,
  updated_at: FIXTURE_TIMESTAMP,
  version: 'business_assessment_v1_intake',
  inputs: {
    answers: {},
    team_profile_ids: [],
    financial_text: '',
  },
  profile_context: {
    owner_profile_id: FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID,
    owner_profile_type: 'SYNTHETIC_QUALIFICATION',
  },
  output: null,
  metadata: fixtureMetadata,
});

export const FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS = Object.freeze({
  vault_profile:
    `vault:profile:${FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID}`,
  business_assessment_by_profile:
    `business_assessment_by_profile:${FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID}`,
  business_assessment:
    `business_assessment:${FIXED_SYNTHETIC_PRODUCT_FIXTURE_ASSESSMENT_ID}`,
});

const serializedVault = JSON.stringify(FIXED_SYNTHETIC_VAULT_RECORD);
const serializedAssessment = JSON.stringify(FIXED_SYNTHETIC_BUSINESS_ASSESSMENT);

const fixtureContract = buildBusinessEngineContract(
  FIXED_SYNTHETIC_BUSINESS_ASSESSMENT,
);
const fixtureContractValidation = validateBusinessEngineContract(fixtureContract);
if (!fixtureContractValidation.valid
  || fixtureContract.identity?.profile_id
    !== FIXED_SYNTHETIC_PRODUCT_FIXTURE_PROFILE_ID) {
  throw new TypeError('fixed synthetic Business Engine contract invalid');
}

export const FIXED_SYNTHETIC_BUSINESS_ENGINE_CONTRACT_SHA256 =
  privateRuntimeBusinessEngineExecutionContractDigest(fixtureContract);

export const FIXED_SYNTHETIC_PRODUCT_FIXTURE_DIGEST = hashCanonicalJson({
  fixture_version: FIXED_SYNTHETIC_PRODUCT_FIXTURE_VERSION,
  keys: FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS,
  vault_record: FIXED_SYNTHETIC_VAULT_RECORD,
  assessment_record: FIXED_SYNTHETIC_BUSINESS_ASSESSMENT,
  business_engine_contract_sha256:
    FIXED_SYNTHETIC_BUSINESS_ENGINE_CONTRACT_SHA256,
});

const ATOMIC_CREATE_SCRIPT = String.raw`-- fixed-synthetic-profile-and-ba-fixture-v1
for index = 1, 3 do
  local value_type = redis.call('TYPE', KEYS[index]).ok
  if value_type ~= 'none' and value_type ~= 'string' then
    return {'CONFLICT', 'STORE_TYPE_MISMATCH', '0'}
  end
end

local profile = redis.call('GET', KEYS[1])
local mapping = redis.call('GET', KEYS[2])
local assessment = redis.call('GET', KEYS[3])
local present = 0
if profile ~= false then present = present + 1 end
if mapping ~= false then present = present + 1 end
if assessment ~= false then present = present + 1 end

if present == 0 then
  redis.call('SET', KEYS[1], ARGV[1], 'NX')
  redis.call('SET', KEYS[2], ARGV[2], 'NX')
  redis.call('SET', KEYS[3], ARGV[3], 'NX')
  return {'CREATED', '', '3'}
end

if present == 3
  and profile == ARGV[1]
  and mapping == ARGV[2]
  and assessment == ARGV[3] then
  return {'ALREADY_EXISTS_VALID', '', '0'}
end

return {'CONFLICT', 'FIXED_SYNTHETIC_FIXTURE_CONFLICT', '0'}`;

function result({ ok, status, code = null, keysCreated = 0 }) {
  return frozen({
    ok,
    status,
    code,
    fixture_version: FIXED_SYNTHETIC_PRODUCT_FIXTURE_VERSION,
    fixture_digest: FIXED_SYNTHETIC_PRODUCT_FIXTURE_DIGEST,
    vault_record_hash: hashCanonicalJson(FIXED_SYNTHETIC_VAULT_RECORD),
    assessment_record_hash:
      hashCanonicalJson(FIXED_SYNTHETIC_BUSINESS_ASSESSMENT),
    assessment_pointer_hash:
      hashCanonicalJson(FIXED_SYNTHETIC_PRODUCT_FIXTURE_ASSESSMENT_ID),
    business_engine_contract_sha256:
      FIXED_SYNTHETIC_BUSINESS_ENGINE_CONTRACT_SHA256,
    records_created: keysCreated === 3 ? 2 : 0,
    keys_created: keysCreated,
    idempotent: status === 'ALREADY_EXISTS_VALID',
    customer_data: false,
    arbitrary_profile_input: false,
  });
}

export async function createFixedSyntheticProfileAndBaFixtureV1(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some((key) => key !== 'client')) {
    return result({
      ok: false,
      status: 'DENIED',
      code: 'FIXED_SYNTHETIC_FIXTURE_INPUT_REJECTED',
    });
  }
  const { client } = options;
  if (typeof client?.eval !== 'function') {
    return result({
      ok: false,
      status: 'UNAVAILABLE',
      code: 'FIXED_SYNTHETIC_FIXTURE_STORE_UNAVAILABLE',
    });
  }
  let response;
  try {
    response = await client.eval(
      ATOMIC_CREATE_SCRIPT,
      3,
      FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.vault_profile,
      FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.business_assessment_by_profile,
      FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.business_assessment,
      serializedVault,
      FIXED_SYNTHETIC_PRODUCT_FIXTURE_ASSESSMENT_ID,
      serializedAssessment,
    );
  } catch {
    return result({
      ok: false,
      status: 'UNAVAILABLE',
      code: 'FIXED_SYNTHETIC_FIXTURE_STORE_UNAVAILABLE',
    });
  }
  const status = Array.isArray(response) ? response[0] : null;
  const code = Array.isArray(response) ? response[1] : null;
  const keysCreated = Number(Array.isArray(response) ? response[2] : 0);
  if (status === 'CREATED' && keysCreated === 3) {
    return result({ ok: true, status, keysCreated });
  }
  if (status === 'ALREADY_EXISTS_VALID' && keysCreated === 0) {
    return result({ ok: true, status, keysCreated });
  }
  return result({
    ok: false,
    status: 'CONFLICT',
    code: code === 'STORE_TYPE_MISMATCH'
      ? 'FIXED_SYNTHETIC_FIXTURE_CONFLICT'
      : 'FIXED_SYNTHETIC_FIXTURE_CONFLICT',
  });
}

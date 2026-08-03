#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import {
  PRIVATE_LIVE_OPERATIONAL_RUNNER_AUTHORITY_VERSION,
  PRIVATE_LIVE_OPERATIONAL_RUNNER_OPERATIONS,
  PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE,
  validateProviderProofResponseShapeDiagnosticV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/privateLiveOperationalRunner.js';
import {
  PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_IDENTITY_VARIABLE,
  PRIVATE_RUNTIME_LIVE_REFERENCE_VARIABLES,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/configurationAuthority.js';
import {
  PRIVATE_LIVE_PRODUCT_EXECUTION_REFERENCE_VARIABLE,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/productExecutionBinding.js';

export const PRIVATE_BETA_LAUNCH_ORCHESTRATOR_VERSION =
  'private-beta-launch-orchestrator-v1';
export const PRIVATE_BETA_LAUNCH_CHECKPOINT_VERSION =
  'private-beta-launch-checkpoint-v1';
export const PRIVATE_BETA_LAUNCH_CUSTODY_VERSION =
  'private-beta-launch-custody-v1';
export const PRIVATE_BETA_PROTECTED_ATTESTATION_VERSION =
  'private-beta-protected-configuration-attestation-v1';
export const PRIVATE_BETA_SUBDEV1_BINDINGS_VERSION =
  'private-beta-subdev1-protected-bindings-v1';
export const PRIVATE_BETA_LAUNCH_STATUSES = Object.freeze([
  'PENDING',
  'STARTED',
  'PASSED',
  'FAILED',
  'SKIPPED',
]);
export const PRIVATE_BETA_LAUNCH_STAGES = Object.freeze([
  Object.freeze({ id: 'REPOSITORY_VERIFICATION', number: 1 }),
  Object.freeze({ id: 'PROTECTED_CONFIGURATION_VERIFICATION', number: 2 }),
  Object.freeze({ id: 'RUNNER_AUTHORITY_REFRESH', number: 3 }),
  Object.freeze({ id: 'DEPLOYMENT', number: 4 }),
  Object.freeze({ id: 'COMMIT_VERIFICATION', number: 5 }),
  Object.freeze({ id: 'ALIAS_VERIFICATION', number: 6 }),
  Object.freeze({ id: 'SYNTHETIC_FIXTURE_VERIFICATION', number: 7 }),
  Object.freeze({ id: 'VAULT_VERIFICATION', number: 8 }),
  Object.freeze({ id: 'BA_VERIFICATION', number: 9 }),
  Object.freeze({ id: 'PROVIDER_CANARY', number: 10 }),
  Object.freeze({ id: 'PROVIDER_PROOF_STORAGE', number: 11 }),
  Object.freeze({ id: 'RUNTIME_READINESS', number: 12 }),
  Object.freeze({ id: 'CONTROLLED_PRIVATE_BETA_ENABLEMENT', number: 13 }),
]);

const SAFE_RECEIPT_KEY = /^[a-z][a-z0-9_]{1,63}$/;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{2,95}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const HTTPS_ORIGIN = /^https:\/\/[a-z0-9.-]+(?::[0-9]{2,5})?$/u;
const SENSITIVE_KEY = /(authorization|credential|password|secret|token|cookie|connection|string|private_key)/i;
const SENSITIVE_VALUE = /(bearer\s+|redis(?:s)?:\/\/|-----BEGIN [A-Z ]+PRIVATE KEY-----|sk_(?:live|test)_)/i;
const clone = (value) => JSON.parse(JSON.stringify(value));
const digest = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
};
const canonicalJson = (value) => JSON.stringify(canonical(value));
const exactFields = (value, fields) => Boolean(
  value
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value).length === fields.length
  && Object.keys(value).every((field) => fields.includes(field)),
);

const PROTECTED_DOCUMENT_DIGEST_FIELDS = Object.freeze([
  'configuration_authority_packet',
  'remote_security_configuration',
  'qualification_certificate',
  'live_environment_attestation',
  'product_binding_attestation',
  'assertion_configuration',
  'protected_edge_configuration',
  'product_execution_binding',
  'qualified_adapter_source',
]);
const PROTECTED_ATTESTATION_FIELDS = Object.freeze([
  'attestation_version',
  'expected_commit',
  'expected_tree',
  'expected_project',
  'expected_default_off_flags',
  'expected_immutable_deployment_identity',
  'expected_protected_document_digests',
  'expected_namespace',
  'expected_product_store_reference',
  'expected_provider_endpoint_reference',
  'expected_provider_credential_reference',
  'subdev1_binding_set_sha256',
  'expected_optional_ttl_seconds',
  'issued_at',
  'expires_at',
  'attestation_sha256',
]);
const SUBDEV1_BINDING_FIELDS = Object.freeze([
  'binding_version',
  'operator_code',
  'signing_secret',
  'allowed_origins',
  'environment_id',
]);
const REQUIRED_SUBDEV1_VARIABLES = Object.freeze([
  'MORE_SUBDEV1_OPERATOR_CODE',
  'MORE_SUBDEV1_OPERATOR_SIGNING_SECRET',
  'MORE_SUBDEV1_OPERATOR_ALLOWED_ORIGINS',
  'MORE_SUBDEV1_OPERATOR_ENVIRONMENT_ID',
]);
const OPTIONAL_SUBDEV1_TTL_VARIABLE = 'MORE_SUBDEV1_OPERATOR_TTL_SECONDS';

function secureExternalFile(filePath, repositoryRoot, missingCode) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    throw new Error(missingCode);
  }
  const target = path.normalize(filePath);
  if (target.startsWith(`${path.normalize(repositoryRoot)}${path.sep}`)
    || !fs.existsSync(target)) {
    throw new Error(missingCode);
  }
  const metadata = fs.lstatSync(target);
  let targetReal;
  let repositoryReal;
  try {
    targetReal = fs.realpathSync(target);
    repositoryReal = fs.realpathSync(repositoryRoot);
  } catch {
    throw new Error(`${missingCode.replace(/_MISSING$/u, '')}_INVALID`);
  }
  if (!metadata.isFile()
    || metadata.isSymbolicLink()
    || (metadata.mode & 0o777) !== 0o600
    || targetReal === repositoryReal
    || targetReal.startsWith(`${repositoryReal}${path.sep}`)) {
    throw new Error(`${missingCode.replace(/_MISSING$/u, '')}_INVALID`);
  }
  return target;
}

function removeProtectedInput(filePath, repositoryRoot) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return false;
  const target = path.normalize(filePath);
  if (target.startsWith(`${path.normalize(repositoryRoot)}${path.sep}`)) return false;
  try {
    const metadata = fs.lstatSync(target);
    if (metadata.isDirectory()) return false;
    if (!metadata.isSymbolicLink()) {
      const targetReal = fs.realpathSync(target);
      const repositoryReal = fs.realpathSync(repositoryRoot);
      if (targetReal === repositoryReal
        || targetReal.startsWith(`${repositoryReal}${path.sep}`)) return false;
    }
    fs.unlinkSync(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function projectBinding(repositoryRoot) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(path.join(repositoryRoot, '.vercel', 'repo.json'), 'utf8'));
  } catch {
    throw new Error('VERCEL_PROJECT_BINDING_INVALID');
  }
  const candidates = Array.isArray(parsed?.projects)
    ? parsed.projects.filter((entry) => entry?.directory === '.')
    : [];
  if (candidates.length !== 1
    || typeof candidates[0].id !== 'string'
    || typeof candidates[0].name !== 'string'
    || typeof candidates[0].orgId !== 'string') {
    throw new Error('VERCEL_PROJECT_BINDING_INVALID');
  }
  return Object.freeze({
    project_id: candidates[0].id,
    project_name: candidates[0].name,
    team_id: candidates[0].orgId,
  });
}

function parseProtectedEnvironmentMetadata(source) {
  let parsed;
  try {
    parsed = JSON.parse(String(source));
  } catch {
    throw new Error('PROTECTED_CONFIGURATION_METADATA_INVALID');
  }
  if (!Array.isArray(parsed?.envs)) {
    throw new Error('PROTECTED_CONFIGURATION_METADATA_INVALID');
  }
  return parsed.envs.map((entry) => Object.freeze({
    name: entry?.key,
    type: entry?.type,
    targets: Array.isArray(entry?.target) ? [...entry.target] : [],
  }));
}

function protectedMetadataEntry(entries, name) {
  const matches = entries.filter((entry) => entry.name === name);
  if (matches.length !== 1) return null;
  const [entry] = matches;
  if (entry.type !== 'sensitive' || !entry.targets.includes('production')) return null;
  return entry;
}

export function privateBetaSubdev1BindingSetDigestV1(value) {
  return digest(canonicalJson(value));
}

export function validatePrivateBetaSubdev1BindingsV1(value) {
  if (!exactFields(value, SUBDEV1_BINDING_FIELDS)
    || value.binding_version !== PRIVATE_BETA_SUBDEV1_BINDINGS_VERSION
    || typeof value.operator_code !== 'string'
    || value.operator_code.length < 1
    || value.operator_code.length > 128
    || typeof value.signing_secret !== 'string'
    || value.signing_secret.length < 32
    || typeof value.allowed_origins !== 'string'
    || value.allowed_origins.length > 1024
    || typeof value.environment_id !== 'string'
    || !/^[A-Z][A-Z0-9_]{2,95}$/u.test(value.environment_id)) {
    return false;
  }
  const origins = value.allowed_origins.split(',').map((entry) => entry.trim());
  return origins.length >= 1
    && origins.length <= 8
    && origins.every((origin) => HTTPS_ORIGIN.test(origin))
    && new Set(origins).size === origins.length;
}

export function privateBetaProtectedAttestationDigestV1(value) {
  const copy = { ...value };
  delete copy.attestation_sha256;
  return digest(canonicalJson(copy));
}

export function validatePrivateBetaProtectedAttestationV1(value, {
  expectedCommit,
  expectedTree,
  expectedProject,
  nowMs = Date.now(),
} = {}) {
  if (!Number.isFinite(nowMs)
    || !exactFields(value, PROTECTED_ATTESTATION_FIELDS)
    || value.attestation_version !== PRIVATE_BETA_PROTECTED_ATTESTATION_VERSION
    || !GIT_SHA.test(value.expected_commit || '')
    || value.expected_commit !== expectedCommit
    || !GIT_SHA.test(value.expected_tree || '')
    || value.expected_tree !== expectedTree
    || !exactFields(value.expected_project, ['project_id', 'project_name', 'team_id'])
    || value.expected_project.project_id !== expectedProject?.project_id
    || value.expected_project.project_name !== expectedProject?.project_name
    || value.expected_project.team_id !== expectedProject?.team_id
    || !exactFields(value.expected_default_off_flags, [
      'private_runtime_live_enabled',
      'private_runtime_emergency_disabled',
      'subdev1_operator_enabled',
    ])
    || value.expected_default_off_flags.private_runtime_live_enabled !== false
    || value.expected_default_off_flags.private_runtime_emergency_disabled !== false
    || value.expected_default_off_flags.subdev1_operator_enabled !== false
    || !SHA256.test(value.expected_immutable_deployment_identity || '')
    || !exactFields(value.expected_protected_document_digests, PROTECTED_DOCUMENT_DIGEST_FIELDS)
    || !PROTECTED_DOCUMENT_DIGEST_FIELDS.every(
      (field) => SHA256.test(value.expected_protected_document_digests[field] || ''),
    )
    || typeof value.expected_namespace !== 'string'
    || !/^[a-zA-Z0-9:_-]{3,160}$/u.test(value.expected_namespace)
    || value.expected_product_store_reference !== 'MORE_PRIVATE_RUNTIME_PRODUCT_STORE_REDIS_URL'
    || value.expected_provider_endpoint_reference !== 'MORE_PRIVATE_RUNTIME_PROVIDER_ENDPOINT_VALUE'
    || value.expected_provider_credential_reference !== 'MORE_PRIVATE_RUNTIME_PROVIDER_CREDENTIAL_VALUE'
    || !SHA256.test(value.subdev1_binding_set_sha256 || '')
    || (value.expected_optional_ttl_seconds !== null
      && (!Number.isInteger(value.expected_optional_ttl_seconds)
        || value.expected_optional_ttl_seconds < 60
        || value.expected_optional_ttl_seconds > 1800))
    || !Number.isFinite(Date.parse(value.issued_at))
    || !Number.isFinite(Date.parse(value.expires_at))
    || Date.parse(value.expires_at) <= Date.parse(value.issued_at)
    || Date.parse(value.issued_at) > nowMs + 5 * 60 * 1000
    || Date.parse(value.expires_at) <= nowMs
    || Date.parse(value.expires_at) - Date.parse(value.issued_at) > 90 * 60 * 1000
    || !SHA256.test(value.attestation_sha256 || '')
    || value.attestation_sha256 !== privateBetaProtectedAttestationDigestV1(value)) {
    return false;
  }
  return true;
}

export function readPrivateBetaProtectedAttestationV1(filePath, options) {
  const target = secureExternalFile(
    filePath,
    options.repositoryRoot,
    'PROTECTED_ATTESTATION_MISSING',
  );
  let value;
  try {
    value = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    throw new Error('PROTECTED_ATTESTATION_INVALID');
  }
  if (Number.isFinite(Date.parse(value?.expires_at))
    && Date.parse(value.expires_at) <= options.nowMs) {
    throw new Error('PROTECTED_ATTESTATION_EXPIRED');
  }
  const bindingFieldsMatch = value?.expected_commit === options.expectedCommit
    && value?.expected_tree === options.expectedTree
    && canonicalJson(value?.expected_project) === canonicalJson(options.expectedProject);
  if (!bindingFieldsMatch) {
    throw new Error('PROTECTED_ATTESTATION_BINDING_MISMATCH');
  }
  if (!validatePrivateBetaProtectedAttestationV1(value, options)) {
    throw new Error('PROTECTED_ATTESTATION_INVALID');
  }
  return value;
}

export function readPrivateBetaSubdev1BindingsV1(filePath, { repositoryRoot } = {}) {
  const target = secureExternalFile(
    filePath,
    repositoryRoot,
    'SUBDEV1_PROTECTED_BINDINGS_MISSING',
  );
  let value;
  try {
    value = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    throw new Error('SUBDEV1_PROTECTED_BINDINGS_INVALID');
  }
  if (!validatePrivateBetaSubdev1BindingsV1(value)) {
    throw new Error('SUBDEV1_PROTECTED_BINDINGS_INVALID');
  }
  return value;
}

function assertAbsoluteStatePath(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw new Error('CHECKPOINT_PATH_MUST_BE_ABSOLUTE');
  }
  return path.normalize(value);
}

function safeReceiptValue(value, depth = 0) {
  if (depth > 6) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isSafeInteger(value);
  if (typeof value === 'string') {
    return value.length <= 256 && !SENSITIVE_VALUE.test(value);
  }
  if (Array.isArray(value)) {
    return value.length <= 32 && value.every((entry) => safeReceiptValue(entry, depth + 1));
  }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    return false;
  }
  const entries = Object.entries(value);
  return entries.length <= 48 && entries.every(([key, entry]) => (
    SAFE_RECEIPT_KEY.test(key)
      && !SENSITIVE_KEY.test(key)
      && safeReceiptValue(entry, depth + 1)
  ));
}

export function validatePrivacySafeLaunchReceiptV1(value) {
  return Boolean(value
    && typeof value === 'object'
    && !Array.isArray(value)
    && safeReceiptValue(value));
}

function stageRecord(stage) {
  return {
    stage_number: stage.number,
    stage_id: stage.id,
    status: 'PENDING',
    stop_code: null,
    attempt_count: 0,
    started_at: null,
    completed_at: null,
    receipt: null,
    status_history: ['PENDING'],
  };
}

export function createPrivateBetaLaunchCheckpointV1({
  runId,
  sourceCommit,
  mode = 'execute',
  now = '2000-01-01T00:00:00.000Z',
} = {}) {
  if (typeof runId !== 'string' || !/^[a-z0-9_-]{8,80}$/.test(runId)) {
    throw new Error('RUN_ID_INVALID');
  }
  if (!GIT_SHA.test(sourceCommit || '')) throw new Error('SOURCE_COMMIT_INVALID');
  if (!['execute', 'dry-run'].includes(mode)) throw new Error('MODE_INVALID');
  return {
    checkpoint_version: PRIVATE_BETA_LAUNCH_CHECKPOINT_VERSION,
    orchestrator_version: PRIVATE_BETA_LAUNCH_ORCHESTRATOR_VERSION,
    run_id: runId,
    mode,
    source_commit: sourceCommit,
    created_at: now,
    updated_at: now,
    final_status: 'IN_PROGRESS',
    final_stop_code: null,
    stages: PRIVATE_BETA_LAUNCH_STAGES.map(stageRecord),
  };
}

export function validatePrivateBetaLaunchCheckpointV1(value) {
  return Boolean(value
    && value.checkpoint_version === PRIVATE_BETA_LAUNCH_CHECKPOINT_VERSION
    && value.orchestrator_version === PRIVATE_BETA_LAUNCH_ORCHESTRATOR_VERSION
    && typeof value.run_id === 'string'
    && ['execute', 'dry-run'].includes(value.mode)
    && GIT_SHA.test(value.source_commit || '')
    && Array.isArray(value.stages)
    && value.stages.length === PRIVATE_BETA_LAUNCH_STAGES.length
    && value.stages.every((record, index) => (
      record.stage_id === PRIVATE_BETA_LAUNCH_STAGES[index].id
      && record.stage_number === PRIVATE_BETA_LAUNCH_STAGES[index].number
      && PRIVATE_BETA_LAUNCH_STATUSES.includes(record.status)
      && Number.isInteger(record.attempt_count)
      && record.attempt_count >= 0
      && Array.isArray(record.status_history)
      && record.status_history.length >= 1
      && record.status_history.every((status) => PRIVATE_BETA_LAUNCH_STATUSES.includes(status))
      && record.status_history.at(-1) === record.status
      && (record.stop_code === null || SAFE_CODE.test(record.stop_code))
      && (record.receipt === null || validatePrivacySafeLaunchReceiptV1(record.receipt))
    )));
}

export function writePrivateBetaLaunchCheckpointV1(filePath, checkpoint) {
  const target = assertAbsoluteStatePath(filePath);
  if (!validatePrivateBetaLaunchCheckpointV1(checkpoint)) {
    throw new Error('CHECKPOINT_INVALID');
  }
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(checkpoint, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, target);
  fs.chmodSync(target, 0o600);
}

export function readPrivateBetaLaunchCheckpointV1(filePath) {
  const target = assertAbsoluteStatePath(filePath);
  const metadata = fs.lstatSync(target);
  if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0) {
    throw new Error('CHECKPOINT_FILE_SECURITY_INVALID');
  }
  const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (!validatePrivateBetaLaunchCheckpointV1(parsed)) {
    throw new Error('CHECKPOINT_INVALID');
  }
  return parsed;
}

export function writePrivateBetaLaunchCustodyV1(filePath, {
  runnerAuthorization,
  immutableDeployment,
  sourceCommit,
  expiresAtMs,
} = {}) {
  const target = assertAbsoluteStatePath(filePath);
  if (typeof runnerAuthorization !== 'string'
    || runnerAuthorization.length < 32
    || !SHA256.test(immutableDeployment || '')
    || !GIT_SHA.test(sourceCommit || '')
    || !Number.isSafeInteger(expiresAtMs)) {
    throw new Error('RUNNER_CUSTODY_INVALID');
  }
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify({
    custody_version: PRIVATE_BETA_LAUNCH_CUSTODY_VERSION,
    runner_authorization: runnerAuthorization,
    immutable_deployment: immutableDeployment,
    source_commit: sourceCommit,
    expires_at_ms: expiresAtMs,
  })}\n`, { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, target);
  fs.chmodSync(target, 0o600);
}

export function readPrivateBetaLaunchCustodyV1(filePath, {
  nowMs = Date.now(),
  expectedCommit = null,
} = {}) {
  const target = assertAbsoluteStatePath(filePath);
  const metadata = fs.lstatSync(target);
  if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0) {
    throw new Error('RUNNER_CUSTODY_FILE_SECURITY_INVALID');
  }
  const custody = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (custody?.custody_version !== PRIVATE_BETA_LAUNCH_CUSTODY_VERSION
    || typeof custody.runner_authorization !== 'string'
    || custody.runner_authorization.length < 32
    || !SHA256.test(custody.immutable_deployment || '')
    || !GIT_SHA.test(custody.source_commit || '')
    || (expectedCommit !== null && custody.source_commit !== expectedCommit)
    || !Number.isSafeInteger(custody.expires_at_ms)) {
    throw new Error('RUNNER_CUSTODY_INVALID');
  }
  if (custody.expires_at_ms <= nowMs) throw new Error('RUNNER_CUSTODY_EXPIRED');
  return custody;
}

function previouslyPassed(record) {
  return record.status === 'PASSED'
    || (record.status === 'SKIPPED' && record.stop_code === 'RESUME_PRIOR_PASS');
}

export function resetPrivateBetaLaunchCheckpointFromStageV1(
  checkpoint,
  stageId,
  { stopCode = 'RESUME_UPSTREAM_AUTHORITY_REFRESH_REQUIRED' } = {},
) {
  if (!validatePrivateBetaLaunchCheckpointV1(checkpoint)) throw new Error('CHECKPOINT_INVALID');
  const start = PRIVATE_BETA_LAUNCH_STAGES.findIndex((stage) => stage.id === stageId);
  if (start < 0 || !SAFE_CODE.test(stopCode)) throw new Error('RESUME_STAGE_INVALID');
  const value = clone(checkpoint);
  for (let index = start; index < value.stages.length; index += 1) {
    const record = value.stages[index];
    record.status = 'PENDING';
    record.status_history.push('PENDING');
    record.stop_code = stopCode;
    record.started_at = null;
    record.completed_at = null;
    record.receipt = null;
  }
  value.final_status = 'IN_PROGRESS';
  value.final_stop_code = null;
  return value;
}

function applyResult(record, result, completedAt) {
  if (!result || typeof result !== 'object') throw new Error('STAGE_RESULT_INVALID');
  if (result.ok === true) {
    if (!validatePrivacySafeLaunchReceiptV1(result.receipt || {})) {
      throw new Error('STAGE_RECEIPT_NOT_PRIVACY_SAFE');
    }
    record.status = 'PASSED';
    record.status_history.push('PASSED');
    record.stop_code = null;
    record.receipt = clone(result.receipt || {});
  } else {
    if (!SAFE_CODE.test(result.stop_code || '')) throw new Error('STAGE_STOP_CODE_INVALID');
    if (result.receipt != null && !validatePrivacySafeLaunchReceiptV1(result.receipt)) {
      throw new Error('STAGE_RECEIPT_NOT_PRIVACY_SAFE');
    }
    record.status = 'FAILED';
    record.status_history.push('FAILED');
    record.stop_code = result.stop_code;
    record.receipt = result.receipt == null ? null : clone(result.receipt);
  }
  record.completed_at = completedAt;
}

export async function runPrivateBetaLaunchOrchestratorV1({
  driver,
  checkpointPath,
  checkpoint = null,
  sourceCommit,
  runId = `launch_${digest(String(Date.now())).slice(0, 16)}`,
  mode = 'execute',
  resume = false,
  failureStage = null,
  clock = () => new Date().toISOString(),
} = {}) {
  if (!driver || typeof driver !== 'object') throw new Error('DRIVER_REQUIRED');
  const target = assertAbsoluteStatePath(checkpointPath);
  let state = checkpoint
    ? clone(checkpoint)
    : resume && fs.existsSync(target)
      ? readPrivateBetaLaunchCheckpointV1(target)
      : createPrivateBetaLaunchCheckpointV1({
        runId,
        sourceCommit,
        mode,
        now: clock(),
      });
  if (!validatePrivateBetaLaunchCheckpointV1(state)) throw new Error('CHECKPOINT_INVALID');
  if (state.source_commit !== sourceCommit || state.mode !== mode) {
    throw new Error('CHECKPOINT_CONTEXT_MISMATCH');
  }

  let failed = false;
  for (let index = 0; index < PRIVATE_BETA_LAUNCH_STAGES.length; index += 1) {
    const stage = PRIVATE_BETA_LAUNCH_STAGES[index];
    const record = state.stages[index];
    if (failed) {
      record.status = 'SKIPPED';
      record.status_history.push('SKIPPED');
      record.stop_code = 'UPSTREAM_STAGE_FAILED';
      record.completed_at = clock();
      state.updated_at = record.completed_at;
      writePrivateBetaLaunchCheckpointV1(target, state);
      continue;
    }
    if (resume && previouslyPassed(record)) {
      record.status = 'SKIPPED';
      record.status_history.push('SKIPPED');
      record.stop_code = 'RESUME_PRIOR_PASS';
      record.completed_at = clock();
      state.updated_at = record.completed_at;
      writePrivateBetaLaunchCheckpointV1(target, state);
      continue;
    }
    if (mode === 'dry-run') {
      record.status = 'STARTED';
      record.status_history.push('STARTED');
      record.stop_code = null;
      record.attempt_count += 1;
      record.started_at = clock();
      record.completed_at = null;
      record.receipt = null;
      state.updated_at = record.started_at;
      writePrivateBetaLaunchCheckpointV1(target, state);
      const result = await driver.runStage(stage, { state: clone(state), mode });
      if (!result?.ok) throw new Error('DRY_RUN_DRIVER_FAILED');
      if (!validatePrivacySafeLaunchReceiptV1(result.receipt || {})) {
        throw new Error('STAGE_RECEIPT_NOT_PRIVACY_SAFE');
      }
      record.status = 'SKIPPED';
      record.status_history.push('SKIPPED');
      record.stop_code = 'DRY_RUN_NO_SIDE_EFFECT';
      record.completed_at = clock();
      record.receipt = clone(result.receipt || {});
      state.updated_at = record.completed_at;
      writePrivateBetaLaunchCheckpointV1(target, state);
      continue;
    }

    record.status = 'STARTED';
    record.status_history.push('STARTED');
    record.stop_code = null;
    record.attempt_count += 1;
    record.started_at = clock();
    record.completed_at = null;
    record.receipt = null;
    state.updated_at = record.started_at;
    writePrivateBetaLaunchCheckpointV1(target, state);

    let result;
    try {
      result = failureStage === stage.id
        ? { ok: false, stop_code: 'INJECTED_STAGE_FAILURE', receipt: { injected: true } }
        : await driver.runStage(stage, { state: clone(state), mode });
      applyResult(record, result, clock());
    } catch {
      record.status = 'FAILED';
      record.status_history.push('FAILED');
      record.stop_code = 'STAGE_EXECUTION_EXCEPTION';
      record.completed_at = clock();
      record.receipt = null;
    }
    state.updated_at = record.completed_at;
    if (record.status === 'FAILED') {
      state.final_status = 'FAILED';
      state.final_stop_code = record.stop_code;
      failed = true;
    }
    writePrivateBetaLaunchCheckpointV1(target, state);
  }
  if (!failed) {
    state.final_status = mode === 'dry-run' ? 'DRY_RUN_COMPLETE' : 'PASSED';
    state.final_stop_code = null;
    state.updated_at = clock();
    writePrivateBetaLaunchCheckpointV1(target, state);
  }
  return clone(state);
}

export function createDeterministicDryRunDriverV1() {
  return Object.freeze({
    async runStage(stage) {
      return {
        ok: true,
        receipt: {
          stage_id: stage.id,
          deterministic: true,
          side_effect_count: 0,
        },
      };
    },
  });
}

function parseDotenv(source) {
  const values = {};
  for (const line of String(source).split(/\r?\n/u)) {
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/\\n/g, '\n');
    }
    values[key] = value;
  }
  return values;
}

async function command(binary, args, { cwd, input = undefined, maxBuffer = 4 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let overflow = false;
    const append = (current, chunk) => {
      const next = `${current}${chunk.toString('utf8')}`;
      if (Buffer.byteLength(next) > maxBuffer) {
        overflow = true;
        child.kill('SIGTERM');
      }
      return next;
    };
    child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (overflow) {
        reject(new Error('COMMAND_OUTPUT_LIMIT_EXCEEDED'));
      } else if (code !== 0) {
        const error = new Error('COMMAND_FAILED');
        error.code = code;
        error.signal = signal;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

function safeDeploymentReference(output) {
  const match = String(output).match(/https:\/\/[a-z0-9-]+\.vercel\.app/iu);
  return match ? match[0] : null;
}

function curlConfig({ url, authorization, body }) {
  const escapedBody = JSON.stringify(JSON.stringify(body));
  return [
    `url = ${JSON.stringify(url)}`,
    'request = "POST"',
    'silent',
    'show-error',
    'connect-timeout = 15',
    'max-time = 45',
    'header = "content-type: application/json"',
    `header = ${JSON.stringify(`x-more-private-live-runner-authorization: ${authorization}`)}`,
    `data = ${escapedBody}`,
    'write-out = "\\n%{http_code}"',
    '',
  ].join('\n');
}

function runnerRequest(operation, requestId) {
  const value = {
    operation,
    request_id: requestId,
    scope: { ...PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE },
  };
  if (operation === 'CREATE_SYNTHETIC_APPROVAL') value.duration_minutes = 90;
  return value;
}

function parseCurlResponse(stdout) {
  const split = String(stdout).lastIndexOf('\n');
  if (split < 0) throw new Error('CURL_HTTP_STATUS_MISSING');
  const status = Number(String(stdout).slice(split + 1).trim());
  const bodyText = String(stdout).slice(0, split);
  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new Error('CURL_RESPONSE_JSON_INVALID');
  }
  return { status, payload };
}

export function createProductionPrivateBetaLaunchDriverV1({
  repositoryRoot,
  expectedCommit,
  custodyPath,
  protectedAttestationPath = null,
  subdev1BindingsPath = null,
  baseUrl = 'https://moremindmap.com',
  projectName = 'moremindmap',
  controlledEnablement = null,
  now = () => Date.now(),
  commandRunner = command,
} = {}) {
  if (!path.isAbsolute(repositoryRoot || '')
    || !path.isAbsolute(custodyPath || '')
    || path.normalize(custodyPath).startsWith(`${path.normalize(repositoryRoot)}${path.sep}`)
    || !GIT_SHA.test(expectedCommit || '')) {
    throw new Error('PRODUCTION_DRIVER_CONFIGURATION_INVALID');
  }
  const endpoint = `${baseUrl.replace(/\/$/u, '')}/api/internal/private-live-operational-runner`;
  const expectedProject = projectBinding(repositoryRoot);
  if (expectedProject.project_name !== projectName) {
    throw new Error('VERCEL_PROJECT_BINDING_MISMATCH');
  }
  const protectedMetadataNames = Object.freeze([
    'MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY',
    'MORE_PRIVATE_RUNTIME_QUALIFIED_ADAPTER_SOURCE_SHA256',
    PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_IDENTITY_VARIABLE,
    ...PRIVATE_RUNTIME_LIVE_REFERENCE_VARIABLES,
    PRIVATE_LIVE_PRODUCT_EXECUTION_REFERENCE_VARIABLE,
    'REDIS_URL',
    'MORE_PRIVATE_RUNTIME_LIVE_ENABLED',
    'MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED',
    'MORE_SUBDEV1_OPERATOR_ENABLED',
  ]);
  const runState = {
    protected: null,
    runnerAuthorization: null,
    deploymentUrl: null,
    fixture: null,
    canary: null,
    readiness: null,
    invocationPrefix: null,
    custodyLoaded: false,
    stage2EnvironmentChangeCount: 0,
  };
  if (fs.existsSync(custodyPath)) {
    const custody = readPrivateBetaLaunchCustodyV1(custodyPath, {
      nowMs: now(),
      expectedCommit,
    });
    runState.runnerAuthorization = custody.runner_authorization;
    runState.custodyLoaded = true;
    runState.protected = {
      immutableDeployment: custody.immutable_deployment,
      requiredCount: 0,
    };
  }

  function persistCustody({ runnerAuthorization, immutableDeployment, expiresAtMs }) {
    writePrivateBetaLaunchCustodyV1(custodyPath, {
      runnerAuthorization,
      immutableDeployment,
      sourceCommit: expectedCommit,
      expiresAtMs,
    });
  }

  async function readProtectedEnvironmentMetadata() {
    const { stdout } = await commandRunner(
      'vercel',
      ['env', 'ls', 'production', '--format', 'json'],
      { cwd: repositoryRoot },
    );
    return parseProtectedEnvironmentMetadata(stdout);
  }

  async function readRunnerAuthorityEnvironment() {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mmm-launch-env-'));
    const environmentPath = path.join(temporaryRoot, 'production.env');
    try {
      await commandRunner('vercel', [
        'env', 'pull', environmentPath, '--environment', 'production', '--yes',
      ], { cwd: repositoryRoot });
      fs.chmodSync(environmentPath, 0o600);
      return parseDotenv(fs.readFileSync(environmentPath, 'utf8'));
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }

  async function writeMissingSubdev1Bindings(entries, attestation) {
    const missing = REQUIRED_SUBDEV1_VARIABLES.filter(
      (name) => !protectedMetadataEntry(entries, name),
    );
    if (missing.length === 0) {
      return {
        outcome: 'SUBDEV1_REQUIRED_BINDINGS_PRESENT',
        environmentChangeCount: 0,
      };
    }
    if (missing.length !== REQUIRED_SUBDEV1_VARIABLES.length) {
      throw new Error('SUBDEV1_REQUIRED_BINDINGS_PARTIAL');
    }
    const values = readPrivateBetaSubdev1BindingsV1(subdev1BindingsPath, { repositoryRoot });
    if (privateBetaSubdev1BindingSetDigestV1(values) !== attestation.subdev1_binding_set_sha256) {
      throw new Error('PROTECTED_ATTESTATION_BINDING_MISMATCH');
    }
    const writes = [
      ['MORE_SUBDEV1_OPERATOR_CODE', values.operator_code],
      ['MORE_SUBDEV1_OPERATOR_SIGNING_SECRET', values.signing_secret],
      ['MORE_SUBDEV1_OPERATOR_ALLOWED_ORIGINS', values.allowed_origins],
      ['MORE_SUBDEV1_OPERATOR_ENVIRONMENT_ID', values.environment_id],
    ];
    if (writes.length !== 4
      || writes.some(([name]) => !REQUIRED_SUBDEV1_VARIABLES.includes(name))
      || attestation.expected_default_off_flags.private_runtime_live_enabled !== false
      || attestation.expected_default_off_flags.private_runtime_emergency_disabled !== false
      || attestation.expected_default_off_flags.subdev1_operator_enabled !== false) {
      throw new Error('SUBDEV1_ENVIRONMENT_WRITE_BOUNDARY_INVALID');
    }
    for (const [name, value] of writes) {
      if (runState.stage2EnvironmentChangeCount >= 4) {
        throw new Error('SUBDEV1_ENVIRONMENT_WRITE_BOUNDARY_INVALID');
      }
      try {
        await commandRunner('vercel', [
          'env', 'add', name, 'production', '--sensitive', '--force', '--yes',
        ], { cwd: repositoryRoot, input: `${value}\n` });
      } catch {
        throw new Error('SUBDEV1_REQUIRED_BINDINGS_WRITE_FAILED');
      }
      runState.stage2EnvironmentChangeCount += 1;
    }
    if (runState.stage2EnvironmentChangeCount !== 4) {
      throw new Error('SUBDEV1_ENVIRONMENT_WRITE_BOUNDARY_INVALID');
    }
    const verified = await readProtectedEnvironmentMetadata();
    if (!REQUIRED_SUBDEV1_VARIABLES.every(
      (name) => Boolean(protectedMetadataEntry(verified, name)),
    )) {
      throw new Error('SUBDEV1_REQUIRED_BINDINGS_WRITE_NOT_VERIFIED');
    }
    return {
      outcome: 'SUBDEV1_REQUIRED_BINDINGS_PRESENT',
      environmentChangeCount: 4,
    };
  }

  async function invokeRunner(operation, suffix) {
    if (!runState.runnerAuthorization) throw new Error('RUNNER_AUTHORIZATION_NOT_AVAILABLE');
    if (!runState.invocationPrefix) throw new Error('RUNNER_INVOCATION_PREFIX_NOT_AVAILABLE');
    const { stdout } = await commandRunner('curl', ['--config', '-'], {
      cwd: repositoryRoot,
      input: curlConfig({
        url: endpoint,
        authorization: runState.runnerAuthorization,
        body: runnerRequest(operation, `${runState.invocationPrefix}_${suffix}`),
      }),
    });
    return parseCurlResponse(stdout);
  }

  return Object.freeze({
    async runStage(stage, context = {}) {
      const attempt = context.state?.stages?.find(
        (entry) => entry.stage_id === stage.id,
      )?.attempt_count;
      if (typeof context.state?.run_id === 'string' && Number.isInteger(attempt)) {
        runState.invocationPrefix = `orchestrator_${digest(context.state.run_id).slice(0, 16)}_${attempt}`;
      }
      const priorReceipt = (stageId) => context.state?.stages?.find(
        (entry) => entry.stage_id === stageId,
      )?.receipt || null;
      switch (stage.id) {
        case 'REPOSITORY_VERIFICATION': {
          const [{ stdout: head }, { stdout: status }, { stdout: index }] = await Promise.all([
            commandRunner('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot }),
            commandRunner('git', ['status', '--short'], { cwd: repositoryRoot }),
            commandRunner('git', ['diff', '--cached', '--name-only'], { cwd: repositoryRoot }),
          ]);
          if (head.trim() !== expectedCommit) {
            return { ok: false, stop_code: 'REPOSITORY_COMMIT_MISMATCH' };
          }
          if (index.trim()) return { ok: false, stop_code: 'REPOSITORY_INDEX_NOT_EMPTY' };
          if (status.trim()) return { ok: false, stop_code: 'REPOSITORY_NOT_CLEAN' };
          return {
            ok: true,
            receipt: {
              commit_sha: head.trim(),
              worktree_change_count: 0,
              index_empty: true,
            },
          };
        }
        case 'PROTECTED_CONFIGURATION_VERIFICATION': {
          let attestation = null;
          try {
            const [{ stdout: tree }, entries] = await Promise.all([
              commandRunner('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repositoryRoot }),
              readProtectedEnvironmentMetadata(),
            ]);
            const missing = protectedMetadataNames.filter(
              (name) => !protectedMetadataEntry(entries, name),
            );
            if (missing.length) {
              return {
                ok: false,
                stop_code: 'PROTECTED_CONFIGURATION_METADATA_MISSING',
                receipt: { missing_reference_count: missing.length },
              };
            }
            attestation = readPrivateBetaProtectedAttestationV1(protectedAttestationPath, {
              repositoryRoot,
              expectedCommit,
              expectedTree: tree.trim(),
              expectedProject,
              nowMs: now(),
            });
            const subdev1Missing = REQUIRED_SUBDEV1_VARIABLES.filter(
              (name) => !protectedMetadataEntry(entries, name),
            );
            if (subdev1Missing.length > 0 && subdev1Missing.length < 4) {
              return {
                ok: false,
                stop_code: 'SUBDEV1_REQUIRED_BINDINGS_PARTIAL',
                receipt: {
                  subdev1_required_binding_result: 'SUBDEV1_REQUIRED_BINDINGS_MISSING',
                  missing_binding_names: subdev1Missing,
                  environment_change_count: 0,
                  attestation_sha256: attestation.attestation_sha256,
                },
              };
            }
            if (subdev1Missing.length === 4 && !subdev1BindingsPath) {
              return {
                ok: false,
                stop_code: 'SUBDEV1_REQUIRED_BINDINGS_MISSING',
                receipt: {
                  subdev1_required_binding_result: 'SUBDEV1_REQUIRED_BINDINGS_MISSING',
                  missing_binding_names: subdev1Missing,
                  environment_change_count: 0,
                  attestation_sha256: attestation.attestation_sha256,
                },
              };
            }
            if (attestation.expected_default_off_flags.private_runtime_live_enabled !== false
              || attestation.expected_default_off_flags.private_runtime_emergency_disabled !== false
              || attestation.expected_default_off_flags.subdev1_operator_enabled !== false) {
              return { ok: false, stop_code: 'DEFAULT_OFF_CONFIGURATION_MISMATCH' };
            }
            const ttlEntries = entries.filter(
              (entry) => entry.name === OPTIONAL_SUBDEV1_TTL_VARIABLE,
            );
            if (ttlEntries.length > 0
              && !protectedMetadataEntry(entries, OPTIONAL_SUBDEV1_TTL_VARIABLE)) {
              return { ok: false, stop_code: 'OPTIONAL_TTL_METADATA_INVALID' };
            }
            const ttlPresent = ttlEntries.length === 1;
            if (ttlPresent && attestation.expected_optional_ttl_seconds === null) {
              return { ok: false, stop_code: 'OPTIONAL_TTL_ATTESTATION_REQUIRED' };
            }
            if (!ttlPresent && attestation.expected_optional_ttl_seconds !== null) {
              return { ok: false, stop_code: 'OPTIONAL_TTL_METADATA_MISSING' };
            }
            const bindingResult = await writeMissingSubdev1Bindings(entries, attestation);
            runState.protected = {
              immutableDeployment: attestation.expected_immutable_deployment_identity,
              requiredCount: protectedMetadataNames.length,
              attestationSha256: attestation.attestation_sha256,
            };
            return {
              ok: true,
              receipt: {
                protected_configuration_metadata_result: 'PROTECTED_CONFIGURATION_METADATA_PRESENT',
                protected_configuration_attestation_result: 'PROTECTED_CONFIGURATION_ATTESTATION_VALID',
                subdev1_required_binding_result: bindingResult.outcome,
                optional_ttl_result: ttlPresent
                  ? 'OPTIONAL_TTL_PRESENT_VALID'
                  : 'OPTIONAL_TTL_ABSENT_ACCEPTED',
                required_reference_count: protectedMetadataNames.length,
                missing_reference_count: 0,
                subdev1_required_reference_count: REQUIRED_SUBDEV1_VARIABLES.length,
                environment_change_count: bindingResult.environmentChangeCount,
                project_context_verified: true,
                runtime_default_off: true,
                operator_default_off: true,
                emergency_disabled: false,
                immutable_deployment_hash: digest(runState.protected.immutableDeployment),
                attestation_sha256: attestation.attestation_sha256,
              },
            };
          } catch (error) {
            return {
              ok: false,
              stop_code: SAFE_CODE.test(error?.message || '')
                ? error.message
                : 'PROTECTED_CONFIGURATION_VALIDATION_FAILED',
              receipt: runState.stage2EnvironmentChangeCount > 0
                ? { environment_change_count: runState.stage2EnvironmentChangeCount }
                : undefined,
            };
          } finally {
            removeProtectedInput(protectedAttestationPath, repositoryRoot);
            removeProtectedInput(subdev1BindingsPath, repositoryRoot);
          }
        }
        case 'RUNNER_AUTHORITY_REFRESH': {
          if (!runState.protected) return { ok: false, stop_code: 'PROTECTED_CONFIGURATION_NOT_VERIFIED' };
          if (runState.custodyLoaded) {
            let current;
            try {
              const values = await readRunnerAuthorityEnvironment();
              current = JSON.parse(values.MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY);
            } catch {
              return { ok: false, stop_code: 'RUNNER_CUSTODY_BINDING_NOT_VERIFIED' };
            }
            if (current?.authority_version !== PRIVATE_LIVE_OPERATIONAL_RUNNER_AUTHORITY_VERSION
              || current.enabled !== true
              || current.deployment_sha256 !== runState.protected.immutableDeployment
              || current.authorization_sha256 !== digest(runState.runnerAuthorization)
              || !Array.isArray(current.allowed_operations)
              || canonicalJson(current.allowed_operations)
                !== canonicalJson(PRIVATE_LIVE_OPERATIONAL_RUNNER_OPERATIONS)
              || !Number.isFinite(Date.parse(current.expires_at))
              || Date.parse(current.expires_at) <= now()) {
              return { ok: false, stop_code: 'RUNNER_CUSTODY_BINDING_MISMATCH' };
            }
            return {
              ok: true,
              receipt: {
                reference_name_hash: digest('MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY'),
                authority_version: current.authority_version,
                expires_at: current.expires_at,
                allowed_operation_count: current.allowed_operations.length,
                environment_change_count: 0,
                custody_reused: true,
              },
            };
          }
          const raw = crypto.randomBytes(32).toString('base64url');
          const issuedAt = now();
          const expiresAtMs = issuedAt + 30 * 60 * 1000;
          const authority = {
            authority_version: PRIVATE_LIVE_OPERATIONAL_RUNNER_AUTHORITY_VERSION,
            enabled: true,
            deployment_sha256: runState.protected.immutableDeployment,
            expires_at: new Date(expiresAtMs).toISOString(),
            allowed_operations: [...PRIVATE_LIVE_OPERATIONAL_RUNNER_OPERATIONS],
            authorization_sha256: digest(raw),
          };
          runState.runnerAuthorization = raw;
          persistCustody({
            runnerAuthorization: raw,
            immutableDeployment: runState.protected.immutableDeployment,
            expiresAtMs,
          });
          try {
            await commandRunner('vercel', [
              'env', 'add', 'MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY',
              'production', '--force', '--yes',
            ], { cwd: repositoryRoot, input: `${JSON.stringify(authority)}\n` });
          } catch {
            return {
              ok: false,
              stop_code: 'RUNNER_AUTHORITY_ENVIRONMENT_UPDATE_FAILED',
              receipt: {
                custody_preserved: true,
                environment_change_count: 0,
              },
            };
          }
          return {
            ok: true,
            receipt: {
              reference_name_hash: digest('MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY'),
              authority_version: authority.authority_version,
              expires_at: authority.expires_at,
              allowed_operation_count: authority.allowed_operations.length,
              environment_change_count: 1,
              custody_reused: false,
            },
          };
        }
        case 'DEPLOYMENT': {
          let stdout;
          let stderr;
          try {
            ({ stdout, stderr } = await commandRunner('vercel', ['--prod', '--yes'], {
              cwd: repositoryRoot,
              maxBuffer: 16 * 1024 * 1024,
            }));
          } catch {
            return { ok: false, stop_code: 'DEPLOYMENT_COMMAND_FAILED' };
          }
          runState.deploymentUrl = safeDeploymentReference(`${stdout}\n${stderr}`);
          if (!runState.deploymentUrl) return { ok: false, stop_code: 'DEPLOYMENT_REFERENCE_NOT_FOUND' };
          return {
            ok: true,
            receipt: {
              deployment_reference_hash: digest(runState.deploymentUrl),
              deployment_reference: runState.deploymentUrl,
              deployment_requested: true,
              source_commit: expectedCommit,
            },
          };
        }
        case 'COMMIT_VERIFICATION': {
          runState.deploymentUrl = runState.deploymentUrl
            || priorReceipt('DEPLOYMENT')?.deployment_reference
            || null;
          let parsed;
          try {
            const { stdout } = await commandRunner(
              'vercel',
              ['ls', projectName, '--format', 'json'],
              { cwd: repositoryRoot },
            );
            parsed = JSON.parse(stdout);
          } catch {
            return { ok: false, stop_code: 'DEPLOYMENT_COMMIT_VERIFICATION_FAILED' };
          }
          const deployments = Array.isArray(parsed) ? parsed : parsed.deployments;
          const deployedHost = runState.deploymentUrl?.replace(/^https:\/\//u, '');
          const match = deployments?.find((entry) => (
            entry?.state === 'READY'
            && entry?.target === 'production'
            && entry?.url === deployedHost
            && (entry?.meta?.gitCommitSha === expectedCommit
              || entry?.meta?.githubCommitSha === expectedCommit)
          ));
          if (!match) return { ok: false, stop_code: 'READY_DEPLOYMENT_COMMIT_NOT_VERIFIED' };
          return {
            ok: true,
            receipt: {
              source_commit: expectedCommit,
              ready: true,
              deployment_id_hash: digest(match.uid || match.id || match.url || 'ready'),
            },
          };
        }
        case 'ALIAS_VERIFICATION': {
          let stdout;
          try {
            ({ stdout } = await commandRunner('curl', ['--config', '-'], {
              cwd: repositoryRoot,
              input: curlConfig({
                url: endpoint,
                authorization: 'invalid-private-live-runner-authorization',
                body: runnerRequest('PROVIDER_HEALTH_CANARY', 'orchestrator_transport_prevalidation'),
              }),
            }));
          } catch {
            return { ok: false, stop_code: 'PUBLIC_ALIAS_TRANSPORT_FAILED' };
          }
          const response = parseCurlResponse(stdout);
          if (response.status !== 404
            || response.payload?.error !== 'feature_unavailable') {
            return { ok: false, stop_code: 'PUBLIC_ALIAS_TRANSPORT_PREVALIDATION_FAILED' };
          }
          return {
            ok: true,
            receipt: {
              alias_hash: digest(baseUrl),
              http_status: response.status,
              fail_closed: true,
              browser_headers_sent: false,
            },
          };
        }
        case 'SYNTHETIC_FIXTURE_VERIFICATION': {
          const response = await invokeRunner('CREATE_FIXED_SYNTHETIC_PRODUCT_FIXTURE', 'fixture');
          if (response.status !== 200
            || response.payload?.ok !== true
            || !['CREATED', 'ALREADY_EXISTS_VALID'].includes(response.payload?.status)) {
            return {
              ok: false,
              stop_code: SAFE_CODE.test(response.payload?.stage_receipt?.stop_code || '')
                ? response.payload.stage_receipt.stop_code
                : 'SYNTHETIC_FIXTURE_VERIFICATION_FAILED',
              receipt: validatePrivacySafeLaunchReceiptV1(response.payload?.stage_receipt)
                ? response.payload.stage_receipt
                : { http_status: response.status },
            };
          }
          runState.fixture = response.payload;
          return {
            ok: true,
            receipt: {
              fixture_status: response.payload.status,
              fixture_digest: response.payload.fixture_digest,
              vault_record_hash: response.payload.vault_record_hash,
              assessment_record_hash: response.payload.assessment_record_hash,
              assessment_pointer_hash: response.payload.assessment_pointer_hash,
              idempotent: response.payload.idempotent === true,
              customer_data: response.payload.customer_data === true,
            },
          };
        }
        case 'VAULT_VERIFICATION': {
          const fixture = runState.fixture || priorReceipt('SYNTHETIC_FIXTURE_VERIFICATION');
          if (!SHA256.test(fixture?.vault_record_hash || '')) {
            return { ok: false, stop_code: 'SYNTHETIC_VAULT_RECEIPT_INVALID' };
          }
          return {
            ok: true,
            receipt: {
              vault_record_hash: fixture.vault_record_hash,
              fixture_profile_exact: true,
              customer_data: false,
            },
          };
        }
        case 'BA_VERIFICATION': {
          const fixture = runState.fixture || priorReceipt('SYNTHETIC_FIXTURE_VERIFICATION');
          if (!SHA256.test(fixture?.assessment_record_hash || '')
            || !SHA256.test(fixture?.assessment_pointer_hash || '')) {
            return { ok: false, stop_code: 'SYNTHETIC_BA_RECEIPT_INVALID' };
          }
          return {
            ok: true,
            receipt: {
              assessment_record_hash: fixture.assessment_record_hash,
              assessment_pointer_hash: fixture.assessment_pointer_hash,
              fixture_profile_exact: true,
              customer_data: false,
            },
          };
        }
        case 'PROVIDER_CANARY': {
          const response = await invokeRunner('PROVIDER_HEALTH_CANARY', 'provider_canary');
          if (response.status !== 200 || response.payload?.ok !== true) {
            const stageReceipt = validatePrivacySafeLaunchReceiptV1(
              response.payload?.stage_receipt,
            )
              ? response.payload.stage_receipt
              : { http_status: response.status };
            const diagnostic = response.payload?.provider_proof_diagnostic;
            return {
              ok: false,
              stop_code: SAFE_CODE.test(response.payload?.stage_receipt?.stop_code || '')
                ? response.payload.stage_receipt.stop_code
                : 'PROVIDER_CANARY_FAILED',
              receipt: validateProviderProofResponseShapeDiagnosticV1(diagnostic)
                ? { ...stageReceipt, provider_proof_diagnostic: diagnostic }
                : stageReceipt,
            };
          }
          if (canonicalJson(response.payload.provider_states)
            !== canonicalJson(['RECOVERING', 'RECOVERING', 'HEALTHY'])) {
            return { ok: false, stop_code: 'PROVIDER_CANARY_SEQUENCE_INVALID' };
          }
          runState.canary = response.payload;
          return {
            ok: true,
            receipt: {
              provider_states: response.payload.provider_states,
              provider_health_call_count: response.payload.provider_states.length,
              proof_receipt_count: response.payload.receipt_hashes?.length || 0,
              proof_storage_succeeded: response.payload.proof_storage_succeeded === true,
              proof_storage_receipt_hash: response.payload.proof_storage_receipt_hash,
            },
          };
        }
        case 'PROVIDER_PROOF_STORAGE': {
          const canary = runState.canary || priorReceipt('PROVIDER_CANARY');
          if (!canary
            || canary.proof_storage_succeeded !== true
            || !SHA256.test(canary.proof_storage_receipt_hash || '')) {
            return { ok: false, stop_code: 'PROVIDER_PROOF_STORAGE_NOT_VERIFIED' };
          }
          return {
            ok: true,
            receipt: {
              proof_storage_succeeded: true,
              proof_receipt_count: 1,
              proof_receipt_hash: canary.proof_storage_receipt_hash,
            },
          };
        }
        case 'RUNTIME_READINESS': {
          const results = [];
          async function readinessCall(operation, suffix) {
            const response = await invokeRunner(operation, suffix);
            if (response.status !== 200 || response.payload?.ok !== true) {
              throw new Error('RUNTIME_READINESS_AUTHORITY_FAILED');
            }
            results.push(response.payload);
            return response.payload;
          }
          try {
            let epoch = await readinessCall('READ_SYNTHETIC_EPOCH', 'readiness_epoch_before');
            if (epoch.epoch === 0) {
              await readinessCall('CREATE_SYNTHETIC_EPOCH_1', 'readiness_epoch_create');
              epoch = await readinessCall('READ_SYNTHETIC_EPOCH', 'readiness_epoch_after');
            }
            if (epoch.epoch !== 1) {
              return { ok: false, stop_code: 'RUNTIME_READINESS_EPOCH_INVALID' };
            }
            let approval = await readinessCall(
              'READ_SYNTHETIC_APPROVAL',
              'readiness_approval_before',
            );
            if (approval.approval_status === 'ABSENT') {
              await readinessCall('CREATE_SYNTHETIC_APPROVAL', 'readiness_approval_create');
              approval = await readinessCall(
                'READ_SYNTHETIC_APPROVAL',
                'readiness_approval_after',
              );
            }
            if (approval.approval_status !== 'ACTIVE') {
              return { ok: false, stop_code: 'RUNTIME_READINESS_APPROVAL_INVALID' };
            }
            runState.readiness = results;
          } catch (error) {
            if (error?.message !== 'RUNTIME_READINESS_AUTHORITY_FAILED') throw error;
            return {
              ok: false,
              stop_code: 'RUNTIME_READINESS_AUTHORITY_FAILED',
              receipt: { completed_operation_count: results.length },
            };
          }
          const finalEpoch = results.findLast((entry) => Number.isInteger(entry.epoch))?.epoch;
          const finalApproval = results.findLast(
            (entry) => entry.approval_status != null,
          )?.approval_status;
          if (finalEpoch !== 1 || finalApproval !== 'ACTIVE') {
            return { ok: false, stop_code: 'RUNTIME_READINESS_STATE_INVALID' };
          }
          return {
            ok: true,
            receipt: {
              completed_operation_count: results.length,
              security_epoch: finalEpoch,
              approval_status: finalApproval,
              exact_scope_hash: results.at(-1).scope_hash,
            },
          };
        }
        case 'CONTROLLED_PRIVATE_BETA_ENABLEMENT': {
          const readiness = runState.readiness || priorReceipt('RUNTIME_READINESS');
          if (typeof controlledEnablement !== 'function') {
            return {
              ok: false,
              stop_code: 'CONTROLLED_ENABLEMENT_AUTHORITY_DRIVER_REQUIRED',
              receipt: {
                runtime_ready: Boolean(readiness),
                public_access: false,
                source_default_off: true,
              },
            };
          }
          const result = await controlledEnablement({
            expectedCommit,
            baseUrl,
            readiness: clone(readiness),
          });
          return result;
        }
        default:
          return { ok: false, stop_code: 'UNKNOWN_LAUNCH_STAGE' };
      }
    },
    clearSecrets({ destroy = false } = {}) {
      runState.runnerAuthorization = null;
      if (destroy && fs.existsSync(custodyPath)) fs.rmSync(custodyPath);
    },
  });
}

function parseArguments(argv) {
  const options = {
    mode: null,
    resume: false,
    checkpointPath: null,
    expectedCommit: null,
    failureStage: null,
    protectedAttestationPath: null,
    subdev1BindingsPath: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') options.mode = 'dry-run';
    else if (argument === '--execute') options.mode = 'execute';
    else if (argument === '--resume') options.resume = true;
    else if (argument === '--checkpoint') options.checkpointPath = argv[++index];
    else if (argument === '--expected-commit') options.expectedCommit = argv[++index];
    else if (argument === '--fail-stage') options.failureStage = argv[++index];
    else if (argument === '--protected-attestation') {
      options.protectedAttestationPath = argv[++index];
    } else if (argument === '--subdev1-bindings') {
      options.subdev1BindingsPath = argv[++index];
    }
    else throw new Error('ARGUMENT_INVALID');
  }
  if (!options.mode || !options.checkpointPath || !options.expectedCommit) {
    throw new Error('ARGUMENTS_REQUIRED');
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const repositoryRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const custodyPath = `${path.resolve(options.checkpointPath)}.custody`;
  let resumeCheckpoint = null;
  if (options.mode === 'execute'
    && options.resume
    && fs.existsSync(path.resolve(options.checkpointPath))) {
    resumeCheckpoint = readPrivateBetaLaunchCheckpointV1(options.checkpointPath);
    const protectedRecord = resumeCheckpoint.stages.find(
      (record) => record.stage_id === 'PROTECTED_CONFIGURATION_VERIFICATION',
    );
    const refreshRecord = resumeCheckpoint.stages.find(
      (record) => record.stage_id === 'RUNNER_AUTHORITY_REFRESH',
    );
    if (previouslyPassed(protectedRecord)
      && !previouslyPassed(refreshRecord)
      && !fs.existsSync(custodyPath)) {
      resumeCheckpoint = resetPrivateBetaLaunchCheckpointFromStageV1(
        resumeCheckpoint,
        'PROTECTED_CONFIGURATION_VERIFICATION',
        { stopCode: 'PROTECTED_ATTESTATION_REISSUE_REQUIRED' },
      );
      writePrivateBetaLaunchCheckpointV1(options.checkpointPath, resumeCheckpoint);
    }
    if (previouslyPassed(refreshRecord)) {
      let resetReason = null;
      if (!fs.existsSync(custodyPath)) {
        resetReason = 'RUNNER_CUSTODY_MISSING';
      } else {
        try {
          readPrivateBetaLaunchCustodyV1(custodyPath, {
            nowMs: Date.now(),
            expectedCommit: options.expectedCommit,
          });
        } catch (error) {
          if (error?.message !== 'RUNNER_CUSTODY_EXPIRED') throw error;
          fs.rmSync(custodyPath);
          resetReason = 'RUNNER_CUSTODY_EXPIRED';
        }
      }
      if (resetReason) {
        resumeCheckpoint = resetPrivateBetaLaunchCheckpointFromStageV1(
          resumeCheckpoint,
          'PROTECTED_CONFIGURATION_VERIFICATION',
          { stopCode: 'PROTECTED_ATTESTATION_REISSUE_REQUIRED' },
        );
        writePrivateBetaLaunchCheckpointV1(options.checkpointPath, resumeCheckpoint);
      }
    }
  }
  const driver = options.mode === 'dry-run'
    ? createDeterministicDryRunDriverV1()
    : createProductionPrivateBetaLaunchDriverV1({
      repositoryRoot,
      expectedCommit: options.expectedCommit,
      custodyPath,
      protectedAttestationPath: options.protectedAttestationPath,
      subdev1BindingsPath: options.subdev1BindingsPath,
    });
  let result;
  try {
    result = await runPrivateBetaLaunchOrchestratorV1({
      driver,
      checkpointPath: options.checkpointPath,
      checkpoint: resumeCheckpoint,
      sourceCommit: options.expectedCommit,
      mode: options.mode,
      resume: options.resume,
      failureStage: options.failureStage,
      runId: options.mode === 'dry-run'
        ? 'deterministic_dry_run_v1'
        : undefined,
      clock: options.mode === 'dry-run'
        ? () => '2000-01-01T00:00:00.000Z'
        : () => new Date().toISOString(),
    });
    process.stdout.write(`${JSON.stringify({
      ok: result.final_status === 'PASSED' || result.final_status === 'DRY_RUN_COMPLETE',
      run_id: result.run_id,
      final_status: result.final_status,
      final_stop_code: result.final_stop_code,
      checkpoint_sha256: digest(canonicalJson(result)),
    }, null, 2)}\n`);
    process.exitCode = result.final_status === 'FAILED' ? 2 : 0;
  } finally {
    driver.clearSecrets?.({ destroy: result?.final_status === 'PASSED' });
  }
}

const invoked = process.argv[1] && path.resolve(process.argv[1])
  === path.resolve(new URL(import.meta.url).pathname);
if (invoked) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      stop_code: SAFE_CODE.test(error?.message || '')
        ? error.message
        : 'ORCHESTRATOR_FATAL_ERROR',
    })}\n`);
    process.exitCode = 1;
  });
}

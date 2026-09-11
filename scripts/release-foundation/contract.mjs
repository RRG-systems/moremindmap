import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const PLAN_SCHEMA = 'more.home-base.release-rehearsal/v1';
export const ENVIRONMENT_SCHEMA = 'more.home-base.private-release-environment/v1';

export const CORE_CHECK_IDS = Object.freeze([
  'exact-custody',
  'authority',
  'identity-isolation',
  'permissions',
  'profile-continuity',
  'durable-save-reopen',
  'protected-product-boundaries',
  'routing-origin-alignment',
  'browser-launch',
  'rendered-browser',
  'provider-operation',
  'email-sink',
  'privacy-security',
  'rollback-compatibility',
]);

const SHA = /^[0-9a-f]{40}$/u;
const DEPLOYMENT = /^dpl_[A-Za-z0-9]+$/u;
const ENVIRONMENT = /^env_[A-Za-z0-9]+$/u;
const FORBIDDEN_KEYS = /^(secret|secret_value|token|password|api_key|access_code|cookie|authorization|plaintext|credential_value)$/iu;
const FORBIDDEN_VALUES = [
  /redis(?:s)?:\/\/[^:@\s]+:[^@\s]+@/iu,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]{12,}\b/u,
  /\bre_[A-Za-z0-9_-]{16,}\b/u,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\bBearer\s+[A-Za-z0-9._~-]{12,}/iu,
];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function sha256(value) {
  const input = typeof value === 'string' || value instanceof Uint8Array ? value : canonicalJson(value);
  return createHash('sha256').update(input).digest('hex');
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function atomicWriteJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, canonicalJson(value), { mode: 0o600 });
  await rename(temporary, path);
}

function scanForSecretMaterial(value, path = '$', issues = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForSecretMaterial(item, `${path}[${index}]`, issues));
    return issues;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.test(key)) issues.push({ phase: 'privacy', code: 'SECRET_FIELD_REFUSED', path: `${path}.${key}` });
      scanForSecretMaterial(item, `${path}.${key}`, issues);
    }
    return issues;
  }
  if (typeof value === 'string' && FORBIDDEN_VALUES.some((pattern) => pattern.test(value))) {
    issues.push({ phase: 'privacy', code: 'SECRET_MATERIAL_REFUSED', path });
  }
  return issues;
}

function issue(issues, phase, code, field, httpStatus = null) {
  issues.push({ phase, code, field, http_status: httpStatus });
}

function expect(issues, condition, phase, code, field) {
  if (!condition) issue(issues, phase, code, field);
}

function checkRequirement(issues, plan, id, required) {
  const check = plan.checks.core.find((item) => item.id === id);
  if (!check) return;
  if (required) expect(issues, check.status === 'pass', 'acceptance', 'REQUIRED_CHECK_NOT_GREEN', `checks.core.${id}`);
  else expect(issues, check.status === 'pass' || (check.status === 'not-required' && Boolean(check.rationale)), 'acceptance', 'OPTIONAL_CHECK_STATUS_INVALID', `checks.core.${id}`);
}

export function validateEnvironmentDefinition(environment) {
  const issues = scanForSecretMaterial(environment);
  expect(issues, environment?.schema === ENVIRONMENT_SCHEMA, 'environment', 'SCHEMA_MISMATCH', 'schema');
  expect(issues, ENVIRONMENT.test(environment?.id || ''), 'environment', 'ENVIRONMENT_ID_INVALID', 'id');
  expect(issues, environment?.name === 'subscription-canary', 'environment', 'PRIVATE_ENVIRONMENT_NAME_MISMATCH', 'name');
  expect(issues, environment?.target === 'preview', 'environment', 'PRODUCTION_TARGET_REFUSED', 'target');
  expect(issues, environment?.production_independent === true, 'environment', 'PRODUCTION_INDEPENDENCE_UNPROVEN', 'production_independent');
  expect(issues, environment?.customer_records === 'isolated-synthetic-only', 'environment', 'CUSTOMER_SCOPE_REFUSED', 'customer_records');
  expect(issues, environment?.binding_strategy === 'metadata-reference-only', 'environment', 'BINDING_STRATEGY_REFUSED', 'binding_strategy');
  expect(issues, environment?.provider_assignments_hidden === true, 'privacy', 'PROVIDER_ASSIGNMENT_DISCLOSURE_REFUSED', 'provider_assignments_hidden');
  expect(issues, environment?.secret_values_stored === false, 'privacy', 'SECRET_STORAGE_REFUSED', 'secret_values_stored');
  expect(issues, environment?.subscription_experimentation_sandbox_preserved === true, 'environment', 'SUBSCRIPTION_SANDBOX_PRESERVATION_REQUIRED', 'subscription_experimentation_sandbox_preserved');
  expect(issues, typeof environment?.stable_host === 'string' && /^[a-z0-9.-]+\.vercel\.app$/u.test(environment.stable_host), 'environment', 'PRIVATE_HOST_INVALID', 'stable_host');
  expect(issues, environment?.allowed_origin === `https://${environment?.stable_host}`, 'environment', 'ROUTING_ORIGIN_MISMATCH', 'allowed_origin');
  expect(issues, Array.isArray(environment?.secure_binding_classes) && environment.secure_binding_classes.length >= 3, 'environment', 'BINDING_CLASS_ATTESTATION_MISSING', 'secure_binding_classes');
  return { ok: issues.length === 0, issues };
}

export function validateReleasePlan(plan, environment) {
  const issues = [...scanForSecretMaterial(plan)];
  const environmentValidation = validateEnvironmentDefinition(environment);
  issues.push(...environmentValidation.issues);

  expect(issues, plan?.schema === PLAN_SCHEMA, 'plan', 'SCHEMA_MISMATCH', 'schema');
  expect(issues, typeof plan?.release_id === 'string' && /^[a-z0-9][a-z0-9-]+$/u.test(plan.release_id), 'plan', 'RELEASE_ID_INVALID', 'release_id');
  expect(issues, typeof plan?.authority?.source === 'string' && plan.authority.source.length > 0, 'authority', 'AUTHORITY_SOURCE_MISSING', 'authority.source');
  expect(issues, plan?.authority?.home_base_owner === true, 'authority', 'HOME_BASE_OWNERSHIP_REQUIRED', 'authority.home_base_owner');
  expect(issues, plan?.authority?.production_mutation_authorized === false, 'authority', 'REHEARSAL_PRODUCTION_AUTHORITY_REFUSED', 'authority.production_mutation_authorized');

  expect(issues, SHA.test(plan?.candidate?.commit || ''), 'custody', 'CANDIDATE_COMMIT_INVALID', 'candidate.commit');
  expect(issues, SHA.test(plan?.candidate?.tree || ''), 'custody', 'CANDIDATE_TREE_INVALID', 'candidate.tree');
  expect(issues, DEPLOYMENT.test(plan?.candidate?.deployment || ''), 'custody', 'CANDIDATE_DEPLOYMENT_INVALID', 'candidate.deployment');
  expect(issues, plan?.candidate?.ready_state === 'READY', 'custody', 'CANDIDATE_NOT_READY', 'candidate.ready_state');
  expect(issues, SHA.test(plan?.baseline?.commit || ''), 'custody', 'BASELINE_COMMIT_INVALID', 'baseline.commit');
  expect(issues, SHA.test(plan?.baseline?.tree || ''), 'custody', 'BASELINE_TREE_INVALID', 'baseline.tree');
  expect(issues, DEPLOYMENT.test(plan?.baseline?.deployment || ''), 'custody', 'BASELINE_DEPLOYMENT_INVALID', 'baseline.deployment');

  expect(issues, plan?.environment?.id === environment?.id, 'environment', 'ENVIRONMENT_ID_DRIFT', 'environment.id');
  expect(issues, plan?.environment?.name === environment?.name, 'environment', 'ENVIRONMENT_NAME_DRIFT', 'environment.name');
  expect(issues, plan?.environment?.target === 'preview', 'environment', 'PRODUCTION_TARGET_REFUSED', 'environment.target');
  expect(issues, plan?.environment?.stable_host === environment?.stable_host, 'environment', 'PRIVATE_HOST_DRIFT', 'environment.stable_host');
  expect(issues, plan?.environment?.allowed_origin === environment?.allowed_origin, 'environment', 'ROUTING_ORIGIN_MISMATCH', 'environment.allowed_origin');
  expect(issues, plan?.environment?.metadata_binding_attested === true, 'environment', 'METADATA_BINDING_ATTESTATION_MISSING', 'environment.metadata_binding_attested');
  expect(issues, plan?.environment?.provider_assignments_hidden === true, 'privacy', 'PROVIDER_ASSIGNMENT_DISCLOSURE_REFUSED', 'environment.provider_assignments_hidden');
  expect(issues, plan?.environment?.secret_values_read === false, 'privacy', 'SECRET_READ_REFUSED', 'environment.secret_values_read');
  expect(issues, plan?.environment?.customer_mutations === 0, 'privacy', 'CUSTOMER_MUTATION_REFUSED', 'environment.customer_mutations');
  expect(issues, plan?.environment?.production_mutations === 0, 'privacy', 'PRODUCTION_MUTATION_REFUSED', 'environment.production_mutations');

  expect(issues, plan?.progress?.canonical_completion && plan?.progress?.authored_completion, 'progress', 'DISTINCT_PROGRESS_MARKERS_REQUIRED', 'progress');
  expect(issues, plan?.progress?.canonical_completion?.phase !== plan?.progress?.authored_completion?.phase, 'progress', 'PROGRESS_PHASES_CONFLATED', 'progress');
  expect(issues, Array.isArray(plan?.operation_auth?.inspect) && plan.operation_auth.inspect.length === 0, 'permissions', 'INSPECT_SCOPE_TOO_BROAD', 'operation_auth.inspect');
  expect(issues, Array.isArray(plan?.operation_auth?.status) && plan.operation_auth.status.length === 0, 'permissions', 'STATUS_SCOPE_TOO_BROAD', 'operation_auth.status');
  expect(
    issues,
    Array.isArray(plan?.operation_auth?.advance)
      && plan.operation_auth.advance.length === 1
      && /^(?:recruit|private-subject)-session$/u.test(plan.operation_auth.advance[0]),
    'permissions',
    'ADVANCE_SCOPE_COUPLED',
    'operation_auth.advance',
  );

  expect(issues, Array.isArray(plan?.checks?.core), 'acceptance', 'CORE_CHECKS_MISSING', 'checks.core');
  const core = Array.isArray(plan?.checks?.core) ? plan.checks.core : [];
  const ids = core.map((item) => item.id);
  expect(issues, new Set(ids).size === ids.length, 'acceptance', 'DUPLICATE_CORE_CHECK', 'checks.core');
  expect(issues, CORE_CHECK_IDS.every((id) => ids.includes(id)) && ids.every((id) => CORE_CHECK_IDS.includes(id)), 'acceptance', 'CORE_CHECK_SET_MISMATCH', 'checks.core');
  for (const check of core) {
    expect(issues, ['pass', 'fail', 'not-required'].includes(check.status), 'acceptance', 'CHECK_STATUS_INVALID', `checks.core.${check.id}`);
    expect(issues, typeof check.evidence === 'string' && check.evidence.length > 0, 'acceptance', 'CHECK_EVIDENCE_MISSING', `checks.core.${check.id}`);
    if (check.status === 'fail') issue(issues, 'acceptance', 'CHECK_FAILED', `checks.core.${check.id}`);
  }
  expect(issues, Array.isArray(plan?.checks?.change_specific) && plan.checks.change_specific.length > 0, 'acceptance', 'CHANGE_CHECKS_MISSING', 'checks.change_specific');
  for (const check of plan?.checks?.change_specific || []) {
    expect(issues, typeof check.id === 'string' && check.id.length > 0, 'acceptance', 'CHANGE_CHECK_ID_MISSING', 'checks.change_specific');
    expect(issues, check.status === 'pass', 'acceptance', 'CHANGE_CHECK_NOT_GREEN', `checks.change_specific.${check.id}`);
    expect(issues, typeof check.evidence === 'string' && check.evidence.length > 0, 'acceptance', 'CHECK_EVIDENCE_MISSING', `checks.change_specific.${check.id}`);
  }

  const requirements = plan?.requirements || {};
  checkRequirement(issues, plan, 'rendered-browser', requirements.browser === true);
  checkRequirement(issues, plan, 'browser-launch', requirements.browser === true);
  checkRequirement(issues, plan, 'provider-operation', requirements.provider === true);
  checkRequirement(issues, plan, 'email-sink', requirements.email === true);
  checkRequirement(issues, plan, 'durable-save-reopen', requirements.persistence === true);

  const rollback = plan?.rollback;
  expect(issues, rollback?.strategy === 'compatibility-aware', 'rollback', 'ROLLBACK_STRATEGY_INVALID', 'rollback.strategy');
  expect(issues, Number.isInteger(rollback?.maximum_inflight_seconds) && rollback.maximum_inflight_seconds >= 0, 'rollback', 'MAX_INFLIGHT_INVALID', 'rollback.maximum_inflight_seconds');
  const stepTypes = Array.isArray(rollback?.steps) ? rollback.steps.map((step) => step.type) : [];
  if (rollback?.requires_quarantine === true) {
    expect(issues, rollback.direct_switch_allowed === false, 'rollback', 'DIRECT_ROLLBACK_MUST_BE_REFUSED', 'rollback.direct_switch_allowed');
    expect(issues, JSON.stringify(stepTypes) === JSON.stringify(['quarantine', 'drain', 'switch', 'verify']), 'rollback', 'QUARANTINE_ROLLBACK_ORDER_INVALID', 'rollback.steps');
    const drain = rollback.steps?.find((step) => step.type === 'drain');
    expect(issues, Number.isInteger(drain?.seconds) && drain.seconds >= rollback.maximum_inflight_seconds, 'rollback', 'ROLLBACK_DRAIN_TOO_SHORT', 'rollback.steps.drain');
  } else {
    expect(issues, rollback?.direct_switch_allowed === true, 'rollback', 'COMPATIBLE_DIRECT_ROLLBACK_REQUIRED', 'rollback.direct_switch_allowed');
    expect(issues, JSON.stringify(stepTypes) === JSON.stringify(['verify-target', 'switch', 'verify']), 'rollback', 'DIRECT_ROLLBACK_ORDER_INVALID', 'rollback.steps');
  }
  for (const step of rollback?.steps || []) {
    expect(issues, step.target !== 'production', 'rollback', 'PRODUCTION_ROLLBACK_TARGET_REFUSED', 'rollback.steps');
  }

  expect(issues, Array.isArray(plan?.manual_steps), 'plan', 'MANUAL_STEPS_MISSING', 'manual_steps');
  expect(issues, Array.isArray(plan?.limitations), 'plan', 'LIMITATIONS_MISSING', 'limitations');

  return {
    ok: issues.length === 0,
    issues,
    plan_sha256: sha256(plan),
    environment_sha256: sha256(environment),
    summary: {
      core_checks: core.length,
      change_specific_checks: plan?.checks?.change_specific?.length || 0,
      required_runtime_checks: Object.entries(requirements).filter(([, required]) => required === true).map(([name]) => name).sort(),
    },
  };
}

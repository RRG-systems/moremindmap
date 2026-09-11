#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  atomicWriteJson,
  readJson,
  sha256,
  validateReleasePlan,
} from './contract.mjs';

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`ARGUMENT_REFUSED:${key}`);
    if (key === '--resume' || key === '--exercise-rollback') values[key.slice(2)] = true;
    else values[key.slice(2)] = argv[++index];
  }
  return values;
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function transition(state, phase, details = {}) {
  state.phase = phase;
  state.history.push({ sequence: state.history.length + 1, phase, ...details });
}

function publicCustody(plan) {
  return {
    release_id: plan.release_id,
    candidate: plan.candidate,
    baseline: plan.baseline,
    environment: {
      id: plan.environment.id,
      name: plan.environment.name,
      target: plan.environment.target,
      deployment: plan.candidate.deployment,
      stable_host: plan.environment.stable_host,
      allowed_origin: plan.environment.allowed_origin,
      metadata_binding_attested: plan.environment.metadata_binding_attested,
      provider_assignments_hidden: true,
      secret_values_read: false,
    },
  };
}

const args = parseArgs(process.argv.slice(2));
const planPath = resolve(args.plan || '');
const environmentPath = resolve(args.environment || 'docs/runbooks/release-foundation/PRIVATE_ENVIRONMENT.json');
const statePath = resolve(args.state || '');
const receiptPath = resolve(args.receipt || '');
if (!args.plan || !args.state || !args.receipt) throw new Error('USAGE: --plan PATH --state PATH --receipt PATH [--resume] [--exercise-rollback] [--stop-after validated]');

const started = Date.now();
const [plan, environment] = await Promise.all([readJson(planPath), readJson(environmentPath)]);
const toolSha256 = sha256(Buffer.concat(await Promise.all([
  readFile(new URL('./contract.mjs', import.meta.url)),
  readFile(new URL(import.meta.url)),
])));
const validation = validateReleasePlan(plan, environment);
const custody = publicCustody(plan);
let state;

if (await exists(statePath)) {
  state = await readJson(statePath);
  if (!args.resume) throw new Error('STATE_EXISTS_USE_RESUME');
  if (state.release_id !== plan.release_id || state.plan_sha256 !== validation.plan_sha256 || state.environment_sha256 !== validation.environment_sha256 || state.tool_sha256 !== toolSha256) {
    throw new Error('RESUME_CUSTODY_DRIFT');
  }
  if (state.phase === 'complete') {
    state.resume_count += 1;
    state.history.push({ sequence: state.history.length + 1, phase: 'complete', idempotent_resume: true });
    await atomicWriteJson(statePath, state);
    const receipt = {
      schema: 'more.home-base.release-rehearsal-receipt/v1',
      run_id: state.run_id,
      tool_version: state.tool_version,
      tool_sha256: state.tool_sha256,
      verdict: 'PRIVATE_REHEARSAL_GREEN',
      idempotent_resume: true,
      ...custody,
      plan_sha256: validation.plan_sha256,
      environment_sha256: validation.environment_sha256,
      provider_calls_replayed_not_repeated: true,
      external_mutations: 0,
      production_mutations: 0,
      customer_mutations: 0,
      secret_values_read: false,
    };
    await atomicWriteJson(receiptPath, receipt);
    console.log(JSON.stringify({ verdict: receipt.verdict, release_id: plan.release_id, idempotent_resume: true }));
    process.exit(0);
  }
  state.resume_count += 1;
  transition(state, 'resumed', { from_durable_state: true });
} else {
  if (args.resume) throw new Error('RESUME_STATE_MISSING');
  state = {
    schema: 'more.home-base.release-rehearsal-state/v1',
    run_id: randomUUID(),
    release_id: plan.release_id,
    started_at: new Date(started).toISOString(),
    tool_version: 'home-base-release-foundation-v1',
    tool_sha256: toolSha256,
    plan_sha256: validation.plan_sha256,
    environment_sha256: validation.environment_sha256,
    custody,
    phase: 'prepared',
    resume_count: 0,
    external_mutations: 0,
    production_mutations: 0,
    customer_mutations: 0,
    provider_calls_replayed_not_repeated: true,
    history: [{ sequence: 1, phase: 'prepared' }],
  };
}

if (!validation.ok) {
  transition(state, 'promotion-blocked', { issue_count: validation.issues.length });
  await atomicWriteJson(statePath, state);
  const receipt = {
    schema: 'more.home-base.release-rehearsal-receipt/v1',
    run_id: state.run_id,
    tool_version: state.tool_version,
    tool_sha256: state.tool_sha256,
    verdict: 'PROMOTION_BLOCKED',
    duration_ms: Date.now() - started,
    ...custody,
    plan_sha256: validation.plan_sha256,
    environment_sha256: validation.environment_sha256,
    diagnostics: validation.issues,
    activation_attempted: false,
    external_mutations: 0,
    production_mutations: 0,
    customer_mutations: 0,
    secret_values_read: false,
  };
  await atomicWriteJson(receiptPath, receipt);
  console.log(JSON.stringify({ verdict: receipt.verdict, phase: state.phase, diagnostics: receipt.diagnostics }));
  process.exitCode = 2;
} else {
  if (state.phase === 'resumed') transition(state, 'validated', { replayed_exact_plan: true });
  else if (state.phase === 'prepared') transition(state, 'validated', { replayed_exact_plan: true });

  if (args['stop-after'] === 'validated') {
    await atomicWriteJson(statePath, state);
    const receipt = {
      schema: 'more.home-base.release-rehearsal-receipt/v1',
      run_id: state.run_id,
      tool_version: state.tool_version,
      tool_sha256: state.tool_sha256,
      verdict: 'PAUSED_AFTER_VALIDATION',
      duration_ms: Date.now() - started,
      ...custody,
      plan_sha256: validation.plan_sha256,
      environment_sha256: validation.environment_sha256,
      durable_resume_required: true,
      external_mutations: 0,
      production_mutations: 0,
      customer_mutations: 0,
      secret_values_read: false,
    };
    await atomicWriteJson(receiptPath, receipt);
    console.log(JSON.stringify({ verdict: receipt.verdict, state: statePath }));
  } else {
    transition(state, 'private-candidate-selected', { deployment: plan.candidate.deployment });
    transition(state, 'private-runtime-verified', {
      checks_sha256: sha256(plan.checks),
      prior_provider_evidence_replayed: plan.requirements.provider === true,
      prior_email_evidence_replayed: plan.requirements.email === true,
    });
    if (args['exercise-rollback']) {
      for (const step of plan.rollback.steps) {
        transition(state, `rollback-${step.type}`, {
          target_role: step.target_role || null,
          seconds: step.seconds ?? null,
          evidence_replay_only: true,
        });
      }
      transition(state, 'private-rollback-verified', {
        requires_quarantine: plan.rollback.requires_quarantine,
        direct_switch_allowed: plan.rollback.direct_switch_allowed,
      });
    }
    transition(state, 'complete');
    state.completed_at = new Date().toISOString();
    await atomicWriteJson(statePath, state);
    const receipt = {
      schema: 'more.home-base.release-rehearsal-receipt/v1',
      run_id: state.run_id,
      tool_version: state.tool_version,
      tool_sha256: state.tool_sha256,
      verdict: 'PRIVATE_REHEARSAL_GREEN',
      duration_ms: Date.now() - started,
      total_duration_ms: Date.now() - Date.parse(state.started_at),
      ...custody,
      plan_sha256: validation.plan_sha256,
      environment_sha256: validation.environment_sha256,
      core_check_count: validation.summary.core_checks,
      change_specific_check_count: validation.summary.change_specific_checks,
      required_runtime_checks: validation.summary.required_runtime_checks,
      restart_recovery_proven: state.resume_count > 0,
      rollback_exercised: args['exercise-rollback'] === true,
      rollback_requires_quarantine: plan.rollback.requires_quarantine,
      manual_step_count: plan.manual_steps.length,
      limitations: plan.limitations,
      evidence_mode: 'saved-private-receipt-replay',
      provider_calls_replayed_not_repeated: true,
      external_mutations: 0,
      production_mutations: 0,
      customer_mutations: 0,
      secret_values_read: false,
    };
    await atomicWriteJson(receiptPath, receipt);
    console.log(JSON.stringify({ verdict: receipt.verdict, release_id: plan.release_id, resume_count: state.resume_count, rollback_exercised: receipt.rollback_exercised }));
  }
}

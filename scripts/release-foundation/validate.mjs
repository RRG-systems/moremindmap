#!/usr/bin/env node
import { resolve } from 'node:path';
import { readJson, validateReleasePlan } from './contract.mjs';

function value(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const planPath = value('--plan');
const environmentPath = value('--environment', 'docs/runbooks/release-foundation/PRIVATE_ENVIRONMENT.json');
if (!planPath) throw new Error('USAGE: --plan PATH [--environment PATH]');
const [plan, environment] = await Promise.all([
  readJson(resolve(planPath)),
  readJson(resolve(environmentPath)),
]);
const result = validateReleasePlan(plan, environment);
console.log(JSON.stringify({
  verdict: result.ok ? 'RELEASE_PLAN_GREEN' : 'PROMOTION_BLOCKED',
  plan_sha256: result.plan_sha256,
  environment_sha256: result.environment_sha256,
  summary: result.summary,
  diagnostics: result.issues,
}));
if (!result.ok) process.exitCode = 2;

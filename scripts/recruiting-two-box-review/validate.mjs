import { spawn } from 'node:child_process';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = process.cwd();
const output = resolve(root, 'docs/recruiting-two-box-consulting-v1/validation');
await mkdir(output, { recursive: true });
const env = { PATH: '/opt/homebrew/bin:/usr/bin:/bin', NODE_ENV: 'test' };
async function run(name, command, args) {
  const started = new Date().toISOString();
  const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (data) => { stdout += data; });
  child.stderr.on('data', (data) => { stderr += data; });
  const code = await new Promise((done) => child.on('close', done));
  await writeFile(resolve(output, `${name}.log`), stdout + '\nSTDERR:\n' + stderr);
  const result = { name, command, args, exit_code: code, started_at: started, finished_at: new Date().toISOString() };
  console.log(JSON.stringify(result));
  return result;
}
const files = (await readdir(resolve(root, 'test'))).filter((f) => f.endsWith('.test.js') && (
  /^(recruiting|consultingPlan|subscriptionV1\.|leadershipDemo\.)/.test(f)
  || ['cassetteFoundationV1.test.js', 'bosIntakeDurability.test.js', 'newBaResponsiveRendering.test.js', 'newBaEvidenceSufficiency.test.js', 'newBaPatriciaRetrievalRepair.test.js', 'p0DiagnosticContainment.test.js', 'athleteConsultingToolPrepromotion.test.js', 'moreAthletePublicLeadershipGatePatchV1.test.js', 'moreAthletePublicSiteFounderV1.test.js', 'mmmPublicSiteProviderGatesV1.test.js'].includes(f)
)).sort().map((f) => `test/${f}`);
const results = [];
results.push(await run('protected-tests', process.execPath, ['--test', '--test-concurrency=4', ...files]));
results.push(await run('full-app-build-envfile-disabled', process.execPath, ['scripts/recruiting-two-box-review/build.mjs']));
results.push(await run('changed-source-and-tooling-lint', process.execPath, ['scripts/recruiting-two-box-review/lint.mjs']));
results.push(await run('diff-check', '/usr/bin/git', ['diff', '--check']));
await writeFile(resolve(output, 'summary.json'), JSON.stringify({ synthetic_only: true, environment_files_disabled_for_build: true, no_inherited_credentials: true, results }, null, 2));
process.exitCode = results.every((item) => item.exit_code === 0) ? 0 : 1;

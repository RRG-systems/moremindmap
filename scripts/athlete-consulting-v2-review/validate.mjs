// Scoped, repeatable validation only. No environment/credential-file loading,
// deployment, provider calls, review-server control, or Product source edits.
import { createHash } from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, openSync, writeSync, closeSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks, createRequire, syncBuiltinESMExports } from 'node:module';
import process from 'node:process';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const self = fileURLToPath(new URL('./validate.mjs', import.meta.url));
const query = new URL(import.meta.url).searchParams;
const require = createRequire(import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
// Deliberately do not copy process.env or read any environment file.
const childEnvironment = { LANG: 'C', TZ: 'UTC', CI: '1' };
const git = args => execFileSync('/usr/bin/git', args, { cwd: root, env: childEnvironment, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });

if (query.has('offline')) {
  let attempts = 0;
  const deny = () => { attempts += 1; throw Error('ATHLETE_V2_VALIDATION_NETWORK_DENIED'); };
  globalThis.fetch = deny;
  net.Socket.prototype.connect = deny;
  net.connect = deny;
  net.createConnection = deny;
  tls.connect = deny;
  http.request = deny;
  http.get = deny;
  https.request = deny;
  https.get = deny;
  syncBuiltinESMExports();
  const outDir = query.get('buildOut');
  if (outDir) {
    const approvedRoot = resolve(root, 'docs/athlete-consulting-v2-release/validation') + '/';
    if (!resolve(outDir).startsWith(approvedRoot)) throw Error('BUILD_OUTPUT_SCOPE_INVALID');
    const buildEntry = new URL('./build.mjs', import.meta.url).href;
    const actualVite = pathToFileURL(require.resolve('vite')).href;
    const wrapper = `import {build as actualBuild} from ${JSON.stringify(actualVite)}; export const build = options => actualBuild({...options, build:{...options.build, outDir:${JSON.stringify(outDir)}}});`;
    registerHooks({ resolve(specifier, context, nextResolve) {
      if (specifier === 'vite' && context.parentURL === buildEntry) return { url: `data:text/javascript,${encodeURIComponent(wrapper)}`, shortCircuit: true };
      return nextResolve(specifier, context);
    } });
  }
  process.on('exit', () => {
    console.log(JSON.stringify({ validation_network_guard: true, outbound_attempts: attempts, build_outdir_only_override: outDir || null }));
    if (attempts) process.exitCode = 1;
  });
} else if (process.argv[2] === '--lint') {
  const { ESLint } = await import('eslint');
  const { default: globals } = await import('globals');
  const { default: js } = await import('@eslint/js');
  const files = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  if (!files.length) throw Error('EMPTY_LINT_SELECTION');
  const nodeGlobals = { ...globals.node };
  // JS source already imports process or explicitly declares it with a global
  // directive. Adding it as a built-in too creates a runner-only redeclaration.
  delete nodeGlobals.process;
  const eslint = new ESLint({ cwd: root, overrideConfig: [
    { files: ['**/*.{js,jsx,mjs}'], languageOptions: { globals: { ...globals.browser, ...nodeGlobals } } },
    { files: ['**/*.mjs'], languageOptions: { globals: globals.node }, rules: { ...js.configs.recommended.rules, 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }] } },
  ] });
  const results = await eslint.lintFiles(files);
  const formatter = await eslint.loadFormatter('json');
  console.log(formatter.format(results));
  const errors = results.reduce((n, x) => n + x.errorCount + x.fatalErrorCount, 0);
  console.log(JSON.stringify({ lint_files: files.length, errors, warnings: results.reduce((n, x) => n + x.warningCount, 0) }));
  if (errors) process.exitCode = 1;
} else if (process.argv[2] === '--syntax') {
  const files = JSON.parse(readFileSync(process.argv[3], 'utf8')).filter(file => /\.(js|mjs)$/.test(file));
  if (!files.length) throw Error('EMPTY_SYNTAX_SELECTION');
  let failures = 0;
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { cwd: root, env: childEnvironment, encoding: 'utf8' });
    console.log(JSON.stringify({ file, exit_code: result.status }));
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) failures += 1;
  }
  console.log(JSON.stringify({ syntax_files: files.length, failures }));
  if (failures) process.exitCode = 1;
} else {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = resolve(root, 'docs/athlete-consulting-v2-release/validation', stamp);
  mkdirSync(directory, { recursive: true });
  const save = (name, value) => writeFileSync(join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  const priorRuns = [];
  for (const entry of readdirSync(resolve(directory, '..')).sort()) {
    if (entry === stamp) continue;
    try {
      const priorPath = resolve(directory, '..', entry, 'SUMMARY.json');
      const bytes = readFileSync(priorPath), prior = JSON.parse(bytes);
      priorRuns.push({ directory: relative(root, resolve(directory, '..', entry)), summary_sha256: sha(bytes), pass: prior.pass, failed_phases: prior.phases.filter(phase => phase.exit_code !== 0).map(phase => phase.name) });
    } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
  }
  save('PRIOR_VALIDATION_RUNS.json', { runs: priorRuns, note: 'Earlier failed evidence is retained unchanged. The first scoped lint attempt duplicated source-declared process as an ambient built-in; only the validation globals configuration was corrected, with no Product or test assertion edits.' });
  const changed = () => [...new Set([
    ...git(['diff', '--name-only', 'HEAD']).trim().split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard']).trim().split('\n'),
  ])].filter(Boolean).filter(file => !file.startsWith('docs/athlete-consulting-v2-release/')).sort();
  const sourceManifest = () => changed().map(file => { const bytes = readFileSync(resolve(root, file)); return { file, bytes: bytes.length, sha256: sha(bytes) }; });
  const before = sourceManifest();
  save('SOURCE_BEFORE.json', before);
  const lintFiles = before.map(item => item.file).filter(file => /\.(js|jsx|mjs)$/.test(file));
  save('LINT_FILES.json', lintFiles);
  const custody = { at: new Date().toISOString(), worktree: root, branch: git(['branch', '--show-current']).trim(), head: git(['rev-parse', 'HEAD']).trim(), tree: git(['rev-parse', 'HEAD^{tree}']).trim(), status: git(['status', '--short']) };
  save('CUSTODY.json', custody);
  save('PRESERVED_FIRST_FAILURES.json', {
    original_protected_run: { tests: 107, pass: 102, fail: 5, failure: 'EPERM while Vite bundled repository config under Home Base node_modules/.vite-temp through dependency symlink', evidence: 'Original parent tool receipts retained; this is a provenance note, not a recreated raw log.' },
    prior_isolated_ui_rerun: { tests: 10, pass: 10, fail: 0, duration_ms: 1188.108459, outbound_attempts: 0, test_unchanged: true },
    original_coach_custody_failure: 'First pre-crash run was 16/17 because the imported mission lacked its frozen trailing blank line; root restored the byte and retained the unchanged test.',
    validation_artifact_permission_check: { at: '2026-09-15T22:19:28.287Z', outcome: 'EPERM creating the candidate validation output directory under the initial sandbox; no test or build ran; a narrowly scoped escalation was requested.' },
    distinction: 'Legacy V1 tests are rollback/preservation proof, not Nia/Sofia V2 or browser/provider proof.',
  });

  const lockDirectory = '/Users/rrg/.codex/.chatgpt-projects/g-p-6996ab388f80819194f3951033f470fc/research/athlete-consulting-v2-release-2026-09-15';
  const lockBytes = readFileSync(join(lockDirectory, 'FOUNDER_LOCK.json'));
  const lock = JSON.parse(lockBytes);
  const lockedFiles = lock.files.map(item => {
    const bytes = readFileSync(join(lockDirectory, 'source', item.file));
    return { ...item, actual_bytes: bytes.length, actual_sha256: sha(bytes), pass: item.bytes === bytes.length && item.sha256 === sha(bytes) };
  });
  const visualFiles = ['src/bos-design.js', 'src/style.css', ...['BusinessTwinApp.jsx', 'ReportPage.jsx', 'projection.js', 'design.js', 'athlete.css', 'base.css', 'youth.css'].map(file => 'src/approved-apa/' + file)];
  const parity = [...visualFiles, 'engine/model2-mission.js'].map(file => {
    const candidate = file.startsWith('engine/') ? 'server/athleteConsultingV2/' + file.slice(7) : 'src/athleteConsultingV2/' + file.slice(4);
    const expected = lock.files.find(item => item.file === file);
    const bytes = readFileSync(resolve(root, candidate));
    return { source: file, candidate, expected_sha256: expected.sha256, actual_sha256: sha(bytes), pass: sha(bytes) === expected.sha256, category: file.startsWith('engine/') ? 'mission' : 'visual' };
  });
  const artifacts = ['nia', 'sofia'].map(slug => {
    const a = readFileSync(join(lockDirectory, 'source/data', slug + '.json'));
    const b = readFileSync(resolve(root, 'server/athleteConsultingV2/fixtures', slug + '.json'));
    const original = JSON.parse(a), candidate = JSON.parse(b);
    const report = type => {
      const { artifact_sha256, ...body } = candidate[type];
      return { claimed_sha256: artifact_sha256, recomputed_sha256: sha(JSON.stringify(body)), source_sha256: original[type].artifact_sha256, pass: artifact_sha256 === sha(JSON.stringify(body)) && artifact_sha256 === original[type].artifact_sha256 };
    };
    return { slug, mm: candidate.person.mm, synthetic: candidate.person.synthetic, parsed_content_equal: JSON.stringify(original) === JSON.stringify(candidate), raw_json_bytes_equal: a.equals(b), candidate_only_appended_lf: b.equals(Buffer.concat([a, Buffer.from('\n')])), bos: report('bos'), apa: report('apa') };
  });
  const zipSha = sha(readFileSync(join(lockDirectory, 'ATHLETE_CONSULTING_TOOL_V2_FOUNDER_LOCK.zip')));
  const lockProof = {
    lock_sha256: sha(lockBytes), expected_lock_sha256: '45aebfae7c3971277eaf3f9424703a2a7464d9ef5e865dbbf486ae4673da5ae9',
    zip_sha256: zipSha, expected_zip_sha256: '69d9e531f852eadfb9c9803664a80974e8693cf86f31f7e758a339fbbf722013',
    files: lockedFiles, visual_and_mission_parity: parity, report_artifacts: artifacts,
    note: 'Nine protected visual files plus the frozen mission are byte-checked separately. Candidate fixture raw JSON byte parity is not asserted: appended LF is recorded; parsed contents and report artifact identity must match.',
  };
  lockProof.pass = lockedFiles.length === 89 && lockedFiles.every(item => item.pass) && parity.every(item => item.pass)
    && artifacts.every(item => item.synthetic === true && item.parsed_content_equal && item.bos.pass && item.apa.pass)
    && lockProof.lock_sha256 === lockProof.expected_lock_sha256 && zipSha === lockProof.expected_zip_sha256;
  save('FROZEN_SOURCE_PROOF.json', lockProof);

  const phases = [];
  async function run(name, executable, args, extra = {}) {
    console.log(JSON.stringify({ phase: name, state: 'running' }));
    const started = Date.now(), stdoutPath = join(directory, name + '.stdout.log'), stderrPath = join(directory, name + '.stderr.log');
    const stdout = openSync(stdoutPath, 'wx'), stderr = openSync(stderrPath, 'wx');
    const child = spawn(executable, args, { cwd: root, env: childEnvironment, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => writeSync(stdout, chunk));
    child.stderr.on('data', chunk => writeSync(stderr, chunk));
    const result = await new Promise(resolveResult => {
      child.on('error', error => resolveResult({ exit_code: null, error: error.code || 'SPAWN_FAILED' }));
      child.on('close', (code, signal) => resolveResult({ exit_code: code, signal }));
    });
    closeSync(stdout); closeSync(stderr);
    const out = readFileSync(stdoutPath), err = readFileSync(stderrPath), text = out.toString();
    const counts = Object.fromEntries(['tests', 'pass', 'fail', 'skipped'].map(key => [key, Number(text.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))?.[1] || 0)]));
    const receipt = { name, executable, args, cwd: root, child_environment_keys: Object.keys(childEnvironment), inherited_environment: false, started_at: new Date(started).toISOString(), duration_ms: Date.now() - started, ...result, counts, stdout_sha256: sha(out), stderr_sha256: sha(err), ...extra };
    phases.push(receipt); save(name + '.receipt.json', receipt);
    console.log(JSON.stringify({ phase: name, exit_code: result.exit_code, duration_ms: receipt.duration_ms, counts }));
  }
  const offline = pathToFileURL(self); offline.searchParams.set('offline', '1');
  const focused = ['Coach', 'Store', 'Handler', 'Transport'].map(name => 'test/athleteConsultingV2' + name + '.test.js');
  const protectedFiles = [
    'test/leadershipDemo.launcher.test.js',
    ...['durable', 'server', 'runtime', 'adapters'].map(name => 'test/athleteLivingConsultOneShotV1.' + name + '.test.js'),
    'test/athleteConsultingToolPrepromotion.test.js',
    ...['darrenDemoUxCleanup', 'demoSubjectAuthority', 'internal-dev-production'].map(name => 'test/subscriptionV1.' + name + '.test.js'),
    'test/recruitingGuV1.demoResetCsrf.test.js', 'test/releaseFoundation.test.js',
  ];
  await run('01-focused', process.execPath, ['--import', offline.href, '--test', '--test-reporter=tap', '--test-concurrency=1', ...focused], { expected_tests: 47 });
  await run('02-protected', process.execPath, ['--import', offline.href, '--test', '--test-reporter=tap', '--test-concurrency=1', ...protectedFiles], { expected_tests: 97 });
  await run('03-v1-ui-isolated', process.execPath, ['--import', './scripts/athlete-consulting-v2-review/isolated-v1-ui-preload.mjs', '--test', '--test-reporter=tap', '--test-concurrency=1', 'test/athleteLivingConsultOneShotV1.ui.test.js'], { expected_tests: 10, unchanged_assertions: true });
  await run('04-scoped-lint', process.execPath, ['--import', offline.href, self, '--lint', join(directory, 'LINT_FILES.json')], { explicit_nonempty_file_count: lintFiles.length, globals: 'browser + Node; mjs recommended rules included; no Product lint cleanup' });
  await run('05-syntax', process.execPath, ['--import', offline.href, self, '--syntax', join(directory, 'LINT_FILES.json')]);
  const buildPreload = new URL(offline); buildPreload.searchParams.set('buildOut', join(directory, 'build-dist'));
  await run('06-build', process.execPath, ['--import', buildPreload.href, 'scripts/athlete-consulting-v2-review/build.mjs'], { build_delta: 'Only outDir changes to this validation run/build-dist; existing no-env build.mjs and all input/options preserved. Active review dist untouched.' });
  await run('07-diff-check', '/usr/bin/git', ['diff', '--check']);
  const after = sourceManifest(); save('SOURCE_AFTER.json', after);
  const sourceUnchanged = JSON.stringify(before) === JSON.stringify(after);
  const summary = { at: new Date().toISOString(), directory, custody, lock_pass: lockProof.pass, locked_files: lockedFiles.length, visual_byte_parity: parity.filter(item => item.category === 'visual' && item.pass).length, mission_byte_parity: parity.find(item => item.category === 'mission').pass, source_unchanged_during_validation: sourceUnchanged, phases, pass: lockProof.pass && sourceUnchanged && phases.every(item => item.exit_code === 0 && (!item.expected_tests || item.counts.tests === item.expected_tests)), limits: ['No fresh provider, hosted Redis, deployment, or browser proof is claimed.', 'Original 102/107 EPERM failure retained as a separate historical receipt note.', 'Home Base must reconcile current source/runtime and prove external binding, private routing and rollback.'] };
  save('SUMMARY.json', summary);
  const manifest = [];
  function walk(directoryPath) { for (const name of readdirSync(directoryPath).sort()) { const path = join(directoryPath, name); if (statSync(path).isDirectory()) walk(path); else { const bytes = readFileSync(path); manifest.push({ file: relative(directory, path), bytes: bytes.length, sha256: sha(bytes) }); } } }
  walk(directory);
  save('MANIFEST.json', { files: manifest });
  console.log(JSON.stringify({ directory, pass: summary.pass, source_unchanged: sourceUnchanged, summary_sha256: sha(readFileSync(join(directory, 'SUMMARY.json'))), manifest_sha256: sha(readFileSync(join(directory, 'MANIFEST.json'))) }));
  if (!summary.pass) process.exitCode = 1;
}

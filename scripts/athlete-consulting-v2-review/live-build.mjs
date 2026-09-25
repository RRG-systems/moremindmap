// No-env build custody for the private, loopback-only live-model review.
// This is not a Vercel deployment and never starts Vite's Production API proxy.
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '../..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
if (git('status', '--porcelain')) throw new Error('ATHLETE_QA_SOURCE_NOT_SEALED');
const head = git('rev-parse', 'HEAD');
const tree = git('rev-parse', 'HEAD^{tree}');
const build = spawnSync(process.execPath,
  ['scripts/athlete-consulting-v2-review/build.mjs'], {
    cwd: root,
    env: { PATH: process.env.PATH || '/usr/bin:/bin', LANG: 'C', CI: '1' },
    stdio: 'inherit',
  });
if (build.status !== 0) throw new Error('ATHLETE_QA_BUILD_FAILED');
if (git('status', '--porcelain') || git('rev-parse', 'HEAD') !== head
  || git('rev-parse', 'HEAD^{tree}') !== tree) throw new Error('ATHLETE_QA_SOURCE_CHANGED');

const dist = resolve(root, 'dist');
const pages = ['index.html', 'athlete-consulting-tool/demo/workspace.html',
  'athlete-consulting-tool/demo/apa-reading.html'];
const assets = readdirSync(resolve(dist, 'assets')).filter(name => /^[A-Za-z0-9_.-]+$/u.test(name))
  .map(name => `assets/${name}`).sort();
const files = Object.fromEntries([...pages, ...assets].map(file => [file,
  digest(readFileSync(resolve(dist, file)))]));
const manifest = { schema: 'more.athlete.flagship.loopback-build/v1',
  head, tree, built_at: new Date().toISOString(), files };
writeFileSync(resolve(dist, '.athlete-qa-build.json'), JSON.stringify(manifest) + '\n',
  { flag: 'w', mode: 0o600 });
process.stdout.write(JSON.stringify({ head, tree, build_files: Object.keys(files).length,
  manifest_sha256: digest(readFileSync(resolve(dist, '.athlete-qa-build.json'))) }) + '\n');

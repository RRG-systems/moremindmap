import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const base = '63da55d72fc5e6b082114ffd70584902d15c36f3'
const destination = '/Users/rrg/.codex/.chatgpt-projects/g-p-6996ab388f80819194f3951033f470fc/research/athlete-consulting-v2-release-2026-09-15/recovery-checkpoints'
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
const sha = value => createHash('sha256').update(value).digest('hex')
const label = process.argv[2] || 'checkpoint'
if (!/^[a-z0-9-]+$/.test(label)) throw Error('INVALID_LABEL')
if (git(['merge-base', base, 'HEAD']).trim() !== base) throw Error('BASE_CHANGED')
const files = [...new Set([...git(['diff', '--name-only', base]).trim().split('\n'), ...git(['ls-files', '--others', '--exclude-standard']).trim().split('\n')])].filter(Boolean).sort()
const allowed = /^(api\/engine\/leadershipDemo\/authority\.js|api\/internal\/(athlete-living-consult-one-shot-v1|leadership-demo-entry)\.js|src\/main\.jsx|src\/LeadershipDemo\.jsx|vite\.config\.js|athlete-consulting-tool\/|docs\/athlete-consulting-v2-release\/|scripts\/athlete-consulting-v2-review\/|server\/athleteConsultingV2\/|src\/athleteConsultingV2\/|test\/athleteConsultingV2)/
if (files.some(file => !allowed.test(file))) throw Error('UNEXPECTED_CHANGED_FILE')
let patch = git(['diff', '--binary', base])
for (const file of git(['ls-files', '--others', '--exclude-standard']).trim().split('\n').filter(Boolean)) {
  try { patch += git(['diff', '--no-index', '--binary', '--', '/dev/null', file]) }
  catch (error) { if (error.status !== 1) throw error; patch += error.stdout }
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const directory = resolve(destination, stamp + '-' + label)
if (existsSync(directory)) throw Error('CHECKPOINT_ALREADY_EXISTS')
mkdirSync(directory, { recursive: true })
const manifest = { label, created_at: new Date().toISOString(), base, head: git(['rev-parse', 'HEAD']).trim(), tree: git(['rev-parse', 'HEAD^{tree}']).trim(), branch: git(['branch', '--show-current']).trim(), worktree: root, patch_sha256: sha(patch), files: files.map(file => { const body = readFileSync(resolve(root, file)); return { file, bytes: body.length, sha256: sha(body) } }), status: 'Checkpoint only, not a release-readiness verdict. No deployment, push or provider calls.' }
writeFileSync(resolve(directory, 'CANDIDATE.patch'), patch, { flag: 'wx' })
writeFileSync(resolve(directory, 'CHECKPOINT.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
writeFileSync(resolve(directory, 'RECOVERY.md'), '# V2 durable recovery checkpoint\n\nBase: ' + base + '\n\nApply CANDIDATE.patch only to a clean checkout of this exact base. Verify CHECKPOINT.json file hashes after applying. The patch contains all scoped tracked and untracked source at this checkpoint. Read the governing BA_DESIGN_RELEASE_PREP.md and candidate docs/athlete-consulting-v2-release/RESUME_CUSTODY.md before resuming. No ready-for-release claim.\n', { flag: 'wx' })
git(['apply', '--check', '--reverse', resolve(directory, 'CANDIDATE.patch')])
console.log(JSON.stringify({ directory, patch_sha256: manifest.patch_sha256, files: files.length, reverse_apply_check: true }))

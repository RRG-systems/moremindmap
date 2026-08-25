import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync(new URL('../src/recruitingV1/RecruitingV1App.jsx', import.meta.url), 'utf8')
const adminSource = readFileSync(new URL('../src/recruitingV1/RecruitingMasterControl.jsx', import.meta.url), 'utf8')
const shellSource = readFileSync(new URL('../src/recruitingV1/RecruitingExperienceShell.jsx', import.meta.url), 'utf8')
const cssSource = readFileSync(new URL('../src/recruitingV1/recruitingV1.css', import.meta.url), 'utf8')

test('manager Layer 00 is the frozen six-destination Candidate Journey Map', () => {
  for (const label of [
    'Recruiting Home',
    'Invite & Readiness',
    'Local Opportunity',
    'What You Know',
    'Recruiting Intelligence',
    'Meeting & Brief',
  ]) {
    assert.match(appSource, new RegExp(`'${label.replace('&', '\\&')}'`))
  }

  assert.doesNotMatch(appSource, /<DirectionARail/)
  assert.match(appSource, /<JourneyMap/)
  assert.match(shellSource, /variant = 'manager'/)
})

test('Admin Layer 00 is the frozen four-destination Governance Map', () => {
  for (const label of ['Manager Accounts', 'Add a Manager', 'Access & Usage', 'Recruiting Workspace']) {
    assert.match(adminSource, new RegExp(`title: '${label.replace('&', '\\&')}'`))
  }

  assert.match(adminSource, /variant="admin"/)
  assert.match(adminSource, /Every manager you govern, clear from the first glance\./)
})

test('Layer 02 is keyboard dismissible and returns focus', () => {
  assert.match(shellSource, /event\.key === 'Escape'/)
  assert.match(shellSource, /previous\?\.focus\?\.\(\)/)
  assert.match(shellSource, /role="dialog"/)
  assert.match(shellSource, /aria-modal="true"/)
})

test('Business Gap Intelligence remains a reserved inactive insertion point', () => {
  assert.match(appSource, /Business Gap Intelligence V1\.1/)
  assert.match(appSource, /Not active in V1/)
  assert.doesNotMatch(appSource, /GENERATE_BUSINESS_GAP/)
})

test('iPad uses a bounded journey-map edge reveal', () => {
  assert.match(cssSource, /\.campaign-map-scroller\s*\{[^}]*overflow-x:\s*auto/s)
  assert.match(cssSource, /\.campaign-map-admin \.campaign-map-cards\s*\{[^}]*min-width:\s*1236px/s)
  assert.match(cssSource, /\.campaign-map-manager \.campaign-map-cards\s*\{[^}]*min-width:\s*1560px/s)
})

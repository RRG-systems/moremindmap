import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const athlete = await readFile(new URL('../src/AthletePublicSiteV1.jsx', import.meta.url), 'utf8')
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
const publicSite = await readFile(new URL('../src/PublicSiteV21.jsx', import.meta.url), 'utf8')
const portal = await readFile(new URL('../src/LeadershipPortal.jsx', import.meta.url), 'utf8')
const demo = await readFile(new URL('../src/LeadershipDemo.jsx', import.meta.url), 'utf8')
const entry = await readFile(new URL('../api/internal/leadership-demo-entry.js', import.meta.url), 'utf8')

test('Athlete and MMM entrances target the same shared Leadership gate route', () => {
  assert.match(publicSite, /href="\/leadership"/u)
  assert.match(athlete, /const SHARED_LEADERSHIP_GATE_PATH = '\/leadership'/u)
  assert.equal((athlete.match(/to=\{SHARED_LEADERSHIP_GATE_PATH\}/gu) || []).length, 2)
  assert.equal((athlete.match(/data-shared-leadership-gate="true"/gu) || []).length, 2)
  assert.match(main, /<Route path="\/leadership" element=\{<LeadershipPortal \/>\} \/>/u)
})

test('desktop and responsive menu placements share one special-pill treatment', () => {
  assert.match(athlete, /hidden lg:flex[^"]*whitespace-nowrap/u)
  assert.equal((athlete.match(/MORE ATHLETE LEADERSHIP/gu) || []).length, 2)
  assert.match(athlete, /const LEADERSHIP_PILL = 'rounded-full border border-orange-400\/35/u)
  assert.match(athlete, /id="athlete-mobile-navigation"[\s\S]*to=\{SHARED_LEADERSHIP_GATE_PATH\}/u)
})

test('shared portal retains its existing protected entry and redirect contract', () => {
  assert.match(portal, /fetch\('\/api\/internal\/leadership-demo-entry'/u)
  assert.match(portal, /x-leadership-demo-entry-csrf/u)
  assert.match(portal, /demoResult\.redirect_to === '\/leadership-demo'/u)
  assert.match(main, /<Route path="\/leadership-demo" element=\{<LeadershipDemo \/>\} \/>/u)
  assert.match(demo, /Darren’s demo area/u)
  assert.match(entry, /redirect_to: '\/leadership-demo'/u)
})

test('integration creates no Athlete auth, direct demo, BOS, APA, or payment wiring', () => {
  assert.doesNotMatch(athlete, /access.?code|\/api\/|fetch\(|Stripe|entitlement|Redis|Athlete BOS|APA|<form|<input/u)
  assert.doesNotMatch(athlete, /to=\{?['"]\/leadership-demo/u)
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { nonsecretRuntimeAttestation } from '../src/lib/publicSiteAirlockV1/security.js'
import { resolveProductionAthleteDestination } from '../src/publicSiteV21Config.js'

const component = await readFile(new URL('../src/AthletePublicSiteV1.jsx', import.meta.url), 'utf8')
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
const productionEnv = await readFile(new URL('../.env.production', import.meta.url), 'utf8')

const requiredCopy = [
  'MORE ATHLETE',
  'SEE THE WHOLE ATHLETE.',
  'Understand who you are. See where your performance is now. Decide what comes next.',
  'EXPLORE MORE ATHLETE',
  'HOW IT WORKS',
  'KNOW YOURSELF',
  'See how you think, communicate, respond to pressure, recover, and operate—on and beyond the field of play.',
  'YOUR SPORT',
  'See what is happening in your performance now, what appears to matter most, and what the evidence actually supports.',
  'YOUR PLAN COMES ALIVE',
  'Athlete, coach, and MORE work from one living understanding of what matters now, what to try next, and what happens after.',
  'ONE ATHLETE. ONE LIVING UNDERSTANDING.',
  'MORE connects those realities without pretending they are the same thing.',
  'WHAT HAPPENS NEXT BECOMES PART OF THE UNDERSTANDING.',
]

test('registers the bounded Athlete public preview only at /athlete', () => {
  assert.match(main, /import AthletePublicSiteV1 from '\.\/AthletePublicSiteV1\.jsx'/u)
  assert.ok(main.includes('<Route path="/athlete" element={<AthletePublicSiteV1 />} />'))
  assert.equal((main.match(/path="\/athlete"/gu) || []).length, 1)
})

test('contains the complete Founder-authorized content contract', () => {
  for (const copy of requiredCopy) assert.ok(component.includes(copy), `missing copy: ${copy}`)
  assert.equal((component.match(/<PathCard/gu) || []).length, 3)
  assert.match(component, /title="YOUR SPORT"[\s\S]*?featured[\s\S]*?accent=\{accent\}/u)
})

test('uses only the authorized Production-safe preview wording', () => {
  assert.equal((component.match(/MORE ATHLETE PREVIEW/gu) || []).length, 3)
  assert.equal((component.match(/LOCAL FOUNDER PROTOTYPE/gu) || []).length, 0)
  assert.match(component, /aria-label="Return to the top of MORE ATHLETE"/u)
  assert.doesNotMatch(component, /local MORE ATHLETE prototype/u)
})

test('keeps every journey action inside a truthful non-Product preview dialog', () => {
  assert.match(component, /not connected to a live assessment, account, or payment flow/u)
  assert.match(component, /No Athlete data, score, prediction, or roster decision is being created/u)
  assert.match(component, /not connected to DarrenDemo or a live coaching session/u)
  assert.equal((component.match(/onAction=\{\(\) => setActiveJourney\('/gu) || []).length, 3)

  const forbiddenProductWiring = [
    'href="/profile',
    'href="/business-assessment',
    'href="/subscription',
    'href="/success',
    'href="/payment',
    'fetch(',
    '/api/',
    '<form',
    '<input',
    'Stripe',
    'entitlement',
    'Redis',
  ]
  for (const wiring of forbiddenProductWiring) {
    assert.ok(!component.includes(wiring), `forbidden Product wiring: ${wiring}`)
  }
})

test('binds the client destination and nonsecret server attestation to the same route', () => {
  assert.match(productionEnv, /^VITE_PUBLIC_ATHLETE_DESTINATION=\/athlete$/mu)
  assert.match(productionEnv, /^PUBLIC_ATHLETE_DESTINATION=\/athlete$/mu)
  assert.equal((productionEnv.match(/^VITE_PUBLIC_ATHLETE_DESTINATION=/gmu) || []).length, 1)
  assert.equal((productionEnv.match(/^PUBLIC_ATHLETE_DESTINATION=/gmu) || []).length, 1)
  assert.equal(resolveProductionAthleteDestination('/athlete'), '/athlete')
  assert.equal(nonsecretRuntimeAttestation({ PUBLIC_ATHLETE_DESTINATION: '/athlete' }).public_athlete_destination_state, 'configured')
})

test('preserves the monochrome default and bounds the optional accent comparison', () => {
  assert.match(component, /new URLSearchParams\(search\)\.get\('variant'\) === 'accent'/u)
  assert.match(component, /athlete-accent-eyebrow/u)
  assert.match(component, /athlete-accent-card/u)
  assert.doesNotMatch(component, /<img\b/u)
  assert.doesNotMatch(component, /url\(['"]?https?:/u)
})

test('includes responsive, keyboard, focus, motion, and SVG isolation safeguards', () => {
  assert.match(component, /lg:hidden/u)
  assert.match(component, /hidden lg:flex/u)
  assert.match(component, /focus-visible:ring-2/u)
  assert.match(component, /prefers-reduced-motion: reduce/u)
  assert.match(component, /useId\(\)\.replace/u)
  assert.match(component, /if \(event\.key === 'Escape'\) setActiveJourney\(null\)/u)
  assert.match(component, /aria-modal="true"/u)
})

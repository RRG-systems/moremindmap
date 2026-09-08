import { DEFAULT_ATHLETE_APA_QUESTIONS, FICTIONAL_NORTHSTAR_QUESTIONS } from './questions.js'
import { ATHLETE_APA_CASSETTE_INTERFACE, normalizeCassetteFixture, validateCassette } from './contract.js'

const createCassette = (definition) => {
  const cassette = { interface: ATHLETE_APA_CASSETTE_INTERFACE, ...definition }
  cassette.normalize = (fixture) => normalizeCassetteFixture(cassette, fixture)
  return Object.freeze(validateCassette(cassette))
}

export const DEFAULT_MORE_ATHLETE_CASSETTE = createCassette({
  id: 'more-athlete-default-v1',
  version: '1.0.0-synthetic',
  label: 'MORE Athlete Performance',
  fictional: false,
  questions: DEFAULT_ATHLETE_APA_QUESTIONS,
  box1Vocabulary: {
    eyebrow: 'Where You Are',
    title: 'Your current performance reality.',
    description: 'What the athlete reports, what the instructor observes, what both agree, and what remains open.',
    assetLabel: 'What is working',
    gapLabel: 'What is not settled',
  },
})

export const FICTIONAL_NORTHSTAR_CASSETTE = createCassette({
  id: 'fictional-northstar-v1',
  version: '1.0.0-portability-proof',
  label: 'Fictional Northstar Conditions Lab',
  fictional: true,
  questions: FICTIONAL_NORTHSTAR_QUESTIONS,
  box1Vocabulary: {
    eyebrow: 'Current Conditions',
    title: 'Conditions, signals, and responses.',
    description: 'A fictional alternate language layer over the same governed current-reality contract.',
    assetLabel: 'Helpful conditions',
    gapLabel: 'Signals still open',
  },
})

export const ATHLETE_APA_CASSETTES = Object.freeze({
  [DEFAULT_MORE_ATHLETE_CASSETTE.id]: DEFAULT_MORE_ATHLETE_CASSETTE,
  [FICTIONAL_NORTHSTAR_CASSETTE.id]: FICTIONAL_NORTHSTAR_CASSETTE,
})

export function getAthleteApaCassette(id) {
  const cassette = ATHLETE_APA_CASSETTES[id]
  if (!cassette) throw new Error('ATHLETE_APA_CASSETTE_NOT_REGISTERED')
  return cassette
}

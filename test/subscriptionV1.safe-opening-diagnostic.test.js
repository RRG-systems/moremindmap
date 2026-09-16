import assert from 'node:assert/strict'
import test from 'node:test'
import { openingSafeStopMessage } from '../src/subscriptionV1/safeOpeningDiagnostic.js'

const call = (code, syntheticQaConversation = true) => openingSafeStopMessage({
  durableConversation: true,
  syntheticQaConversation,
  failure: { code },
})

test('synthetic QA opening displays only a bounded server error code', () => {
  assert.match(call('SYNTHETIC_QA_CANDIDATE_BYTES_CHANGED'), /QA diagnostic: SYNTHETIC_QA_CANDIDATE_BYTES_CHANGED\.$/u)
  assert.match(call('SUBSCRIPTION_V1_SYNTHETIC_QA_PROVIDER_BUDGET_NOT_AUTHORIZED'), /QA diagnostic: SUBSCRIPTION_V1_SYNTHETIC_QA_PROVIDER_BUDGET_NOT_AUTHORIZED\.$/u)
  assert.match(call('ENOENT'), /QA diagnostic: ENOENT\.$/u)
})

test('synthetic QA opening rejects raw, mixed-case, and oversized error details', () => {
  for (const code of ['secret=value', 'OPENAI_API_KEY', 'MM-PRIVATE', 'SYNTHETIC_QA_' + 'A'.repeat(97), null]) {
    assert.match(call(code), /QA diagnostic: UNCLASSIFIED\.$/u)
    assert.equal(call(code).includes(String(code)), false)
  }
})

test('paid and demo opening messages remain unchanged', () => {
  const paid = call('SYNTHETIC_QA_CANDIDATE_BYTES_CHANGED', false)
  assert.equal(paid, 'We could not confirm the session opening. Reload to check your session before trying again.')
  assert.doesNotMatch(paid, /QA diagnostic/u)
  assert.equal(openingSafeStopMessage({ durableConversation: false, syntheticQaConversation: false, failure: { code: 'ENOENT' } }),
    'The session did not start because the required opening view could not be established safely. Nothing was changed or consumed.')
})

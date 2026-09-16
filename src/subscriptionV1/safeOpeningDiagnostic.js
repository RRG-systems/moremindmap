const SAFE_SYNTHETIC_OPENING_CODE = /^(?:SYNTHETIC_QA_[A-Z0-9_]{1,96}|SUBSCRIPTION_[A-Z0-9_]{1,96}|ENOENT)$/u

export function openingSafeStopMessage({ durableConversation, syntheticQaConversation, failure } = {}) {
  const message = durableConversation
    ? 'We could not confirm the session opening. Reload to check your session before trying again.'
    : 'The session did not start because the required opening view could not be established safely. Nothing was changed or consumed.'
  if (!syntheticQaConversation) return message
  const code = typeof failure?.code === 'string' && SAFE_SYNTHETIC_OPENING_CODE.test(failure.code)
    ? failure.code : 'UNCLASSIFIED'
  return `${message} QA diagnostic: ${code}.`
}

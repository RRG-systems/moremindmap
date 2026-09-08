import OpenAI from 'openai'
import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js'

const MODEL = 'gpt-5.6-sol'
const REASONING = 'xhigh'
const CONTRACT = 'athlete-living-consult-frontier-request-v1'
const FORBIDDEN_CONTEXT_KEY = /^(?:privateBosContext|rslEvents|sourceBindings|rawAnswers?|raw[_-]?answer|transcript|conversationHistory|guardianDetails?|homeResponsibilities?|excludedPrivateObjectCount|privateObjectCount|sourceArtifactIdentity|sourceArtifactSha256|sourceStateHash|currentRealityHash|bosArtifactIdentity)$/iu
const REAL_IDENTIFIER = /\bMM-\d{8}-[A-Z0-9]{8}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/iu

function assertSafeJointContext(context) {
  if (context?.contract !== 'athlete-consult-joint-projection-v1') {
    throw new TypeError('ATHLETE_LIVING_CONSULT_JOINT_CONTEXT_REQUIRED')
  }
  if (context?.syntheticOnly !== true || context?.writable !== false) {
    throw new TypeError('ATHLETE_LIVING_CONSULT_SYNTHETIC_READ_ONLY_CONTEXT_REQUIRED')
  }
  const serialized = JSON.stringify(context)
  const inspectKeys = (value) => {
    if (!value || typeof value !== 'object') return false
    if (Array.isArray(value)) return value.some(inspectKeys)
    return Object.entries(value).some(([key, child]) => FORBIDDEN_CONTEXT_KEY.test(key) || inspectKeys(child))
  }
  if (inspectKeys(context)) throw new TypeError('ATHLETE_LIVING_CONSULT_PRIVATE_CONTEXT_REFUSED')
  if (REAL_IDENTIFIER.test(serialized)) throw new TypeError('ATHLETE_LIVING_CONSULT_REAL_IDENTIFIER_REFUSED')
  return context
}

export function buildAthleteLivingConsultFrontierRequest({ jointContext, message, allowWebResearch = false }) {
  const context = assertSafeJointContext(jointContext)
  if (typeof message !== 'string' || !message.trim() || message.length > 4_000 || REAL_IDENTIFIER.test(message)) {
    throw new TypeError('ATHLETE_LIVING_CONSULT_MESSAGE_REFUSED')
  }
  const system = [
    'You are MORE inside a shared fictional Athlete development session with Mara and Coach Rowan.',
    'The human instructor remains the coach. Help the two humans think and make useful progress without taking their authority.',
    'Use only the supplied governed joint projection and, when enabled, current public web evidence. Do not infer private BOS material or reveal that excluded material exists.',
    'Preserve who said what. A suggestion, discussion, agreement, attempt, outcome, and causal conclusion are different states.',
    'Do not invent facts, scores, rankings, medical direction, selection judgments, or personality-to-performance causes.',
    'Think deeply and speak simply. Offer one useful idea and one natural question. Do not expose system mechanics.',
    'You may notice a possible evidence or map-change candidate, but your output has no mutation or authorization authority.',
  ].join('\n')
  return {
    model: MODEL,
    reasoning: { effort: REASONING },
    store: false,
    background: false,
    tools: allowWebResearch ? [{ type: 'web_search' }] : [],
    tool_choice: allowWebResearch ? 'auto' : 'none',
    input: [
      { role: 'system', content: system },
      { role: 'user', content: `GOVERNED JOINT STATE\n${JSON.stringify(context)}\n\nCURRENT HUMAN MESSAGE\n${message.trim()}` },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'athlete_living_consult_turn',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['customerMessage', 'candidate'],
          properties: {
            customerMessage: { type: 'string', minLength: 1, maxLength: 1_200 },
            candidate: {
              anyOf: [
                { type: 'null' },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['kind', 'statement', 'sourceActor', 'epistemicStatus'],
                  properties: {
                    kind: { type: 'string', enum: ['NEW_EVIDENCE', 'POSSIBLE_MAP_CHANGE', 'OPEN_LOOP'] },
                    statement: { type: 'string', minLength: 1, maxLength: 500 },
                    sourceActor: { type: 'string', enum: ['athlete', 'instructor', 'joint', 'unresolved'] },
                    epistemicStatus: { type: 'string', enum: ['REPORTED', 'OBSERVED', 'AGREED', 'UNRESOLVED', 'MISSING'] },
                  },
                },
              ],
            },
          },
        },
      },
    },
  }
}

function outputText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) return response.output_text
  return (response?.output || [])
    .filter((item) => item?.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((item) => item?.type === 'output_text')
    .map((item) => item.text)
    .join('')
}

export function createAthleteLivingConsultFrontierTransport({ apiKey, timeoutMs = 180_000 } = {}) {
  if (!apiKey) throw new TypeError('ATHLETE_LIVING_CONSULT_OPENAI_API_KEY_REQUIRED')
  const client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 })
  return async function runTurn(input) {
    const request = buildAthleteLivingConsultFrontierRequest(input)
    const started = Date.now()
    const response = await client.responses.create(request, { signal: AbortSignal.timeout(timeoutMs) })
    if (response.status !== 'completed') throw new Error('ATHLETE_LIVING_CONSULT_FRONTIER_INCOMPLETE')
    const raw = outputText(response)
    let output
    try { output = JSON.parse(raw) } catch { throw new Error('ATHLETE_LIVING_CONSULT_FRONTIER_OUTPUT_INVALID') }
    if (!output?.customerMessage || REAL_IDENTIFIER.test(JSON.stringify(output))) {
      throw new Error('ATHLETE_LIVING_CONSULT_FRONTIER_OUTPUT_REFUSED')
    }
    return {
      output,
      receipt: {
        contract: CONTRACT,
        provider: 'openai-responses',
        model: MODEL,
        reasoning: REASONING,
        store: false,
        background: false,
        requestHash: hashCanonicalJson(request),
        responseIdHash: hashCanonicalJson(response.id),
        latencyMs: Date.now() - started,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        rawRequestPersisted: false,
        rawResponsePersisted: false,
        mutationAuthority: false,
      },
    }
  }
}

export const ATHLETE_LIVING_CONSULT_FRONTIER_POLICY = Object.freeze({
  model: MODEL,
  reasoning: REASONING,
  store: false,
  background: false,
  conversationTool: 'web_search',
  mutationAuthority: false,
  realCustomerData: false,
  cassette: null,
})

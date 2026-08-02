import {
  BOS_CUSTOMER_INTELLIGENCE_MODEL,
  BOS_CUSTOMER_INTELLIGENCE_VERSION,
  INSUFFICIENT_EVIDENCE,
} from './contracts.js';

const stringOrNull = { anyOf: [{ type: 'string' }, { type: 'null' }] };

export const LAYER3_TRANSLATION_JSON_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['version', 'source_hash', 'translations'],
  properties: {
    version: { type: 'string', const: BOS_CUSTOMER_INTELLIGENCE_VERSION },
    source_hash: { type: 'string' },
    translations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'surface_id',
          'claim_ids',
          'status',
          'customer_copy',
          'semantic_contracts',
        ],
        properties: {
          surface_id: { type: 'string' },
          claim_ids: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['translated', 'abstained'] },
          customer_copy: {
            type: 'object',
            additionalProperties: false,
            required: [
              'headline',
              'explanation',
              'recognizable_pattern',
              'evidence_boundary',
              'practical_use',
            ],
            properties: {
              headline: { type: 'string' },
              explanation: { type: 'string' },
              recognizable_pattern: { type: 'string' },
              evidence_boundary: { type: 'string' },
              practical_use: { type: 'string' },
            },
          },
          semantic_contracts: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'claim_id',
                'claim',
                'classification',
                'confidence_score',
                'confidence_band',
                'confidence_calibrated',
                'confidence_basis',
                'sufficiency_status',
                'abstained',
                'abstention_reason',
              ],
              properties: {
                claim_id: { type: 'string' },
                claim: { type: 'string' },
                classification: { type: 'string' },
                confidence_score: { type: 'number' },
                confidence_band: { type: 'string' },
                confidence_calibrated: { type: 'boolean' },
                confidence_basis: { type: 'string' },
                sufficiency_status: { type: 'string', enum: ['sufficient', 'insufficient'] },
                abstained: { type: 'boolean' },
                abstention_reason: stringOrNull,
              },
            },
          },
        },
      },
    },
  },
});

export const LAYER3_TRANSLATION_SYSTEM_PROMPT = `You are the MORE MindMap BOS Customer Intelligence Translator.

Layer 3 is translation only. It is never a measurement or psychological inference layer.

Your only authority is the supplied deterministic Layer 2 semantic packet. Translate supported psychological operating-style claims into plain, recognizable language. Do not infer, diagnose, score, rank, predict, recommend, or create new psychological truth.

Hard rules:
- Copy source_hash, surface_id, claim_ids, and semantic_contracts exactly.
- Never change claim text, classification, evidence sufficiency, confidence band, confidence calibration, or abstention.
- If a surface has no sufficient claim, set status to "abstained", headline and explanation to "${INSUFFICIENT_EVIDENCE}", and recognizable_pattern to an empty string.
- Never invent a lived event, team reaction, motive, strength, risk, future, outcome, quotation, number, or timeline.
- Use "You may notice" for recognizable_pattern. It must remain a tentative invitation to self-check, not a factual assertion.
- Use "Use this as" or "Treat this as" for practical_use.
- State the evidence boundary plainly. For supported content, explicitly say it is not proof, does not establish an outcome, is uncalibrated, or is a hypothesis.
- Do not repeat profile identity or raw answer content; neither is supplied.
- Favor faithful, psychologically recognizable language over elegant or impressive language.
- Return only JSON matching the supplied schema.`;

export function buildLayer3TranslationRequest(packet) {
  return {
    model: BOS_CUSTOMER_INTELLIGENCE_MODEL,
    reasoning: { effort: 'none' },
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: LAYER3_TRANSLATION_SYSTEM_PROMPT }],
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: JSON.stringify(packet) }],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'bos_customer_intelligence_translation',
        strict: true,
        schema: LAYER3_TRANSLATION_JSON_SCHEMA,
      },
    },
    max_output_tokens: 12000,
  };
}

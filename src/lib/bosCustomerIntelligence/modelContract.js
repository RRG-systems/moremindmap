import {
  BOS_CUSTOMER_INTELLIGENCE_MODEL,
  BOS_CUSTOMER_INTELLIGENCE_VERSION,
  CUSTOMER_COPY_BLOCK_KINDS,
  TRANSLATION_FORMATS,
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
          'format',
          'customer_copy',
          'semantic_contracts',
        ],
        properties: {
          surface_id: { type: 'string' },
          claim_ids: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['translated', 'abstained'] },
          format: { type: 'string', enum: Object.values(TRANSLATION_FORMATS) },
          customer_copy: {
            type: 'object',
            additionalProperties: false,
            required: ['headline', 'blocks'],
            properties: {
              headline: { type: 'string' },
              blocks: {
                type: 'array',
                minItems: 1,
                maxItems: 3,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['kind', 'text'],
                  properties: {
                    kind: { type: 'string', enum: CUSTOMER_COPY_BLOCK_KINDS },
                    text: { type: 'string' },
                  },
                },
              },
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
- Use the exact format requested by translation_guidance.output_format.
- Customer copy contains a short headline and one to three typed blocks. Use only the block kinds allowed by translation_guidance.allowed_block_kinds.
- If a surface has no sufficient claim, set status to "abstained", use format "abstention_summary", and return exactly one "limitation" block. Explain naturally what the assessment cannot establish; do not print the phrase "Insufficient Evidence".
- Never invent a lived event, team reaction, motive, strength, risk, future, outcome, quotation, number, or timeline.
- Never use the certainty tokens always, never, inevitably, definitely, certainly, guarantee, prove, or will in customer_copy, even inside a negated sentence. Prefer "does not establish," "not proof," and "may."
- Do not use canned sentence stems. Vary sentence structure across surfaces while remaining tentative.
- Do not use internal implementation language in customer_copy, including Layer 1, topology score, contributing answer signals, evidence contract, uncalibrated assessment, semantic packet, validator, or provenance path.
- Use recognition cues only as bounded translation guidance. They are not additional claims and must not be strengthened.
- A score surface should explain the tendency in ordinary life and invite self-observation. Do not narrate score provenance.
- A One Move surface should present one concrete test and one observation target. Label the uncertainty once.
- A visual surface should summarize only the supported score pattern and include at most one plain-language limitation.
- Do not repeat the same sentence or disclaimer across surfaces. Each customer-copy block must add distinct value.
- Keep uncertainty honest through tentative wording or a single limitation block where the format calls for it; do not attach a compliance disclaimer to every supported score.
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

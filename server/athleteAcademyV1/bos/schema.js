const string = { type: 'string' };
const refs = { type: 'array', minItems: 1, items: string };
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const array = items => ({ type: 'array', items });

// The model must supply provenance for every visual, just as for the chapter routes.
// Semantic validation still resolves each ID against this person's actual evidence.
export const SYNTHESIS_SCHEMA = object({
  whole_person_model: string,
  portrait_thread: string,
  signature_insights: array(object({ title: string, meaning: string, claim_ids: refs })),
  chapter_routes: array(object({ id: string, angle: string, new_value: string, claim_ids: refs })),
  strength_visual: array(object({ strength: string, helps: string, overuse: string, reset: string, claim_ids: refs })),
  pressure_visual: object({ trigger: string, interpretation: string, response: string, recovery: string, claim_ids: refs }),
});

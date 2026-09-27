// A navigation hint is bounded independently of account/report authority.
const SECTIONS = Object.freeze({ home: ['home'], you: ['you', 'map', 'portrait', 'why', 'answers',
  'identity', 'mind', 'communication', 'connection', 'effort', 'pressure', 'strengths', 'thriving'],
sport: ['sport', 'where', 'futures', 'move', 'plan', 'evidence'], plan: ['plan', 'current', 'proposed'] });
const READINGS = new Set(['current', 'original', 'preview', 'historical', 'unverified']);
const OBJECTS = new Set(['domain-sport', 'domain-training', 'domain-mindset', 'domain-school',
  'future-current_course', 'future-emerging_future', 'future-better_future', 'future-bold_future',
  'future-downside_future', 'move', 'connection', 'sources', 'agreement', 'version']);
export function validatedViewContext(view, context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)
    || !SECTIONS[view]?.includes(context.section)) return null;
  if (view !== 'sport') return Object.keys(context).length === 1 ? { section: context.section } : null;
  if (!Object.keys(context).every(key => ['section', 'reading', 'objectId'].includes(key))
    || context.reading !== undefined && !READINGS.has(context.reading)
    || context.objectId !== undefined && !OBJECTS.has(context.objectId)) return null;
  return structuredClone(context);
}

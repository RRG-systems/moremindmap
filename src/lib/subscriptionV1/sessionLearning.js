// These are bounded closing notes, never the session transcript or canonical truth.
export const SESSION_LEARNING_FIELDS = Object.freeze([
  'what_mattered',
  'what_changed',
  'what_was_learned',
  'what_was_decided',
  'what_remains_open',
  'durable_governed_meaning',
  'pick_up_next_time',
]);

export function validateSessionLearningMeaning(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === SESSION_LEARNING_FIELDS.length
    && SESSION_LEARNING_FIELDS.every((field) => typeof value[field] === 'string'
      && value[field].trim() && value[field].length <= 1200);
}

export function summarizeSessionLearning(learning) {
  if (!validateSessionLearningMeaning(learning)) throw new TypeError('RELATIONSHIP_EPISODE_SESSION_LEARNING_INVALID');
  const labels = SESSION_LEARNING_FIELDS.map((field) => `${field.replaceAll('_', ' ')}: `);
  const fieldBudget = Math.floor((1200 - labels.join('').length - (labels.length - 1)) / labels.length);
  // The typed payload retains every complete field. This legacy summary gives
  // every field space and marks abbreviations instead of dropping the final ones.
  return SESSION_LEARNING_FIELDS.map((field, index) => {
    const value = learning[field].trim();
    return `${labels[index]}${value.length > fieldBudget ? `${value.slice(0, fieldBudget - 1)}…` : value}`;
  }).join('\n');
}

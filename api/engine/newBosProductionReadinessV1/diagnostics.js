const ALLOWED_EVENT_TYPES = Object.freeze([
  'request_authorized',
  'compatibility_classified',
  'current_fast_path',
  'rebuild_started',
  'rebuild_succeeded',
  'rebuild_failed',
  'validation_failed',
  'artifact_persisted',
  'pointer_advanced',
  'pointer_rollback',
  'provider_disabled',
]);

function sanitize(value) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (/\bsk-[a-z0-9_-]{8,}\b/iu.test(value) || /Bearer\s+\S+/iu.test(value)) return '[REDACTED]';
    return value.slice(0, 300);
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitize);
  if (typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(?:raw|request|response|answer|prose|api.?key|token|secret)/iu.test(key))
    .map(([key, item]) => [key, sanitize(item)])));
  return null;
}

export function createNewBosLaunchDiagnostics({ clock = () => new Date().toISOString() } = {}) {
  const events = [];
  return Object.freeze({
    record(eventType, fields = {}) {
      if (!ALLOWED_EVENT_TYPES.includes(eventType)) throw new Error('new_bos_diagnostics_event_type_invalid');
      events.push(Object.freeze({ event_type: eventType, observed_at: clock(), ...sanitize(fields) }));
    },
    snapshot() {
      return Object.freeze([...events]);
    },
  });
}

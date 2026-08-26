const ALLOWED = new Set([
  'request_authorized', 'compatibility_classified', 'current_fast_path', 'rebuild_started', 'rebuild_succeeded',
  'rebuild_failed', 'artifact_persisted', 'pointer_advanced', 'pointer_rollback', 'provider_disabled',
  'privacy_rejected', 'validation_failed',
  'generation_stage_accepted', 'compatible_prior_fast_path',
  'background_pending', 'pointer_self_healed', 'terminal_checkpoint_retired',
  'corrupt_derived_recovered',
]);

function sanitize(value) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (/\bsk-[a-z0-9_-]{8,}\b|Bearer\s+\S+/iu.test(value)) return '[REDACTED]';
    return value.slice(0, 300);
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitize);
  if (typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(?:raw|request|response|answer|prose|api.?key|token|secret|email|phone|name)/iu.test(key))
    .map(([key, child]) => [key, sanitize(child)])));
  return null;
}

export function createNewBaDiagnostics({ clock = () => new Date().toISOString() } = {}) {
  const events = [];
  return Object.freeze({
    record(type, fields = {}) {
      if (!ALLOWED.has(type)) throw new Error('new_ba_diagnostics_event_type_invalid');
      events.push(Object.freeze({ event_type: type, observed_at: clock(), ...sanitize(fields) }));
    },
    snapshot() { return Object.freeze([...events]); },
  });
}

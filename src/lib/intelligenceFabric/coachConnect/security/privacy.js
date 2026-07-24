import { deepFreeze } from '../../validation.js';
import { LIVE_SESSION_SECURITY_PRIVACY_CLASSES } from './constants.js';

const FIELD_POLICIES = deepFreeze({
  projection: [
    'projection_id',
    'business_engine_id',
    'previous_version',
    'new_version',
    'changed_sections',
    'reason_for_change',
    'refreshed_at',
    'refresh_status',
    'privacy_class',
    'policy_version',
  ],
  transcript: [
    'transcript_id',
    'session_id',
    'status',
    'segments',
    'speaker_attribution',
    'source_timestamps',
    'confidence',
    'redaction_state',
    'privacy_class',
    'policy_version',
    'created_at',
    'finalized_at',
    'version',
  ],
  artifact: [
    'artifact_id',
    'session_id',
    'source_transcript_id',
    'artifact_type',
    'lifecycle_state',
    'source_spans',
    'speaker_id',
    'confidence',
    'direct_statement',
    'content_reference',
    'conflicts',
    'privacy_class',
    'policy_version',
    'canonical_authority',
    'version',
  ],
  entitlement: [
    'access_type',
    'status',
    'source',
    'temporary',
    'expires_at',
    'billing_evidence',
    'stripe_subscription_created',
    'admin_authority',
    'coach_authority',
    'operator_authority',
    'canonical_mutation_authority',
  ],
  capability_status: [
    'allowed',
    'access_type',
    'status',
    'temporary',
    'expires_at',
  ],
  audit: [
    'schema_version',
    'event_id',
    'event_type',
    'decision',
    'failure_code',
    'occurred_at',
    'correlation_id',
    'actor_ref',
    'session_ref',
    'scope_ref',
    'resource_ref',
    'policy_version',
    'details',
  ],
  retention: [
    'plan_id',
    'record_type',
    'status',
    'due_at',
    'evaluated_at',
    'policy_status',
    'logical_deletion_only',
    'physical_deletion_supported',
    'limitations',
  ],
});

const FORBIDDEN_RESPONSE_KEYS = new Set([
  'raw_transcript',
  'provider_payload',
  'raw_payload',
  'private_source_content',
  'access_code',
  'capability',
  'capability_token',
  'raw_token',
  'session_token',
  'csrf_token',
  'cookie',
  'authorization',
  'signing_secret',
  'pepper',
  'password',
  'secret',
  'stack',
]);

const TRANSITIONS = deepFreeze({
  SUBSCRIBER_PRIVATE: ['SUBSCRIBER_PRIVATE', 'COACH_SHARED', 'RESTRICTED_SENSITIVE', 'REDACTED', 'LEARNING_INELIGIBLE', 'LEARNING_CANDIDATE'],
  COACH_SHARED: ['COACH_SHARED', 'BUSINESS_ENGINE_ELIGIBLE', 'RESTRICTED_SENSITIVE', 'REDACTED', 'LEARNING_INELIGIBLE', 'LEARNING_CANDIDATE'],
  BUSINESS_ENGINE_ELIGIBLE: ['BUSINESS_ENGINE_ELIGIBLE', 'RESTRICTED_SENSITIVE', 'REDACTED', 'LEARNING_INELIGIBLE', 'LEARNING_CANDIDATE'],
  RESTRICTED_SENSITIVE: ['RESTRICTED_SENSITIVE', 'REDACTED', 'LEARNING_INELIGIBLE'],
  REDACTED: ['REDACTED', 'LEARNING_INELIGIBLE', 'LEARNING_CANDIDATE'],
  LEARNING_INELIGIBLE: ['LEARNING_INELIGIBLE', 'REDACTED'],
  LEARNING_CANDIDATE: ['LEARNING_CANDIDATE', 'LEARNING_INELIGIBLE', 'REDACTED'],
});

function findForbiddenPath(value, path = '$', seen = new Set()) {
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return `${path}.[circular]`;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_RESPONSE_KEYS.has(key.toLowerCase()) && child != null) return `${path}.${key}`;
    const nested = findForbiddenPath(child, `${path}.${key}`, seen);
    if (nested) return nested;
  }
  seen.delete(value);
  return null;
}

export function validateCoachConnectPrivacyTransition({
  from,
  to,
  purpose,
  authorized = false,
  consent_granted = false,
  human_reviewed = false,
}) {
  if (!LIVE_SESSION_SECURITY_PRIVACY_CLASSES.includes(from)
    || !LIVE_SESSION_SECURITY_PRIVACY_CLASSES.includes(to)
    || !TRANSITIONS[from]?.includes(to)) {
    return deepFreeze({ allowed: false, code: 'REDACTION_FAILED' });
  }
  if (from === to) return deepFreeze({ allowed: true, code: null });
  if (!authorized) return deepFreeze({ allowed: false, code: 'AUTHORIZATION_DENIED' });
  if (to === 'COACH_SHARED' && (purpose !== 'COACH_SHARING' || !consent_granted)) return deepFreeze({ allowed: false, code: 'CONSENT_MISSING' });
  if (to === 'BUSINESS_ENGINE_ELIGIBLE' && (purpose !== 'BUSINESS_ENGINE_EVALUATION' || !consent_granted || !human_reviewed)) return deepFreeze({ allowed: false, code: 'CONSENT_MISSING' });
  if (to === 'LEARNING_CANDIDATE' && (purpose !== 'FUTURE_LEARNING' || !consent_granted || !human_reviewed)) return deepFreeze({ allowed: false, code: 'CONSENT_MISSING' });
  return deepFreeze({ allowed: true, code: null });
}

export function shapePrivacyResponse(resource_type, value) {
  const allowed = FIELD_POLICIES[resource_type];
  if (!allowed || !value || typeof value !== 'object') return deepFreeze({ ok: false, code: 'REDACTION_FAILED' });
  const output = Object.fromEntries(allowed.filter((key) => Object.hasOwn(value, key)).map((key) => [key, structuredClone(value[key])]));
  const forbidden_path = findForbiddenPath(output);
  if (forbidden_path) return deepFreeze({ ok: false, code: 'REDACTION_FAILED', forbidden_path });
  return deepFreeze({
    ok: true,
    value: output,
    redaction_trace: {
      policy_version: 'coach-connect-field-policy-v1',
      retained_fields: Object.keys(output).sort(),
      removed_fields: Object.keys(value).filter((key) => !allowed.includes(key)).sort(),
    },
  });
}

export function verifyPrivacySafeValue(value) {
  const forbidden_path = findForbiddenPath(value);
  return deepFreeze(forbidden_path ? { safe: false, code: 'REDACTION_FAILED', forbidden_path } : { safe: true, code: null });
}

export const PRIVACY_FIELD_POLICIES = FIELD_POLICIES;

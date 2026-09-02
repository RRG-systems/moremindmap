export const SYNTHETIC_DEMO_SUBJECT_KEY = 're-mid';
export const PATRICIA_DEMO_SUBJECT_KEY = 'patricia-demo-s2';
export const PATRICIA_DEMO_RELATIONSHIP_KEY = 'rel_d3a0c0a3d3a0c0a3d3a0';

export const SUBSCRIPTION_DEMO_SUBJECT_IDS = Object.freeze(['synthetic', 'patricia-demo']);

const RELATIONSHIP_KEY_PATTERN = /^rel_[a-f0-9]{20}$/u;

export function hasDarrenDemoSubjectAuthority(capability) {
  return capability?.contract === 'subscription_v1_internal_capability_v2'
    && capability.authority_source === 'LEADERSHIP_DEMO'
    && capability.demo_subject_switching === true
    && typeof capability.launcher_scope_id === 'string'
    && capability.launcher_scope_id.startsWith('leadership_demo_')
    && SUBSCRIPTION_DEMO_SUBJECT_IDS.every((subject) => capability.allowed_demo_subjects?.includes(subject));
}

export function resolveSubscriptionDemoSubject({ selection, capability }) {
  if (!SUBSCRIPTION_DEMO_SUBJECT_IDS.includes(selection)) {
    return { ok: false, code: 'SUBSCRIPTION_DEMO_SUBJECT_UNSUPPORTED' };
  }
  const syntheticRelationshipKey = capability?.synthetic_relationship_key || capability?.relationship_key;
  if (!RELATIONSHIP_KEY_PATTERN.test(String(syntheticRelationshipKey || ''))) {
    return { ok: false, code: 'SUBSCRIPTION_DEMO_SYNTHETIC_SCOPE_INVALID' };
  }
  if (selection === 'synthetic') {
    return {
      ok: true,
      selection,
      subject_key: SYNTHETIC_DEMO_SUBJECT_KEY,
      relationship_key: syntheticRelationshipKey,
      demo_copy_only: false,
    };
  }
  if (!hasDarrenDemoSubjectAuthority(capability)) {
    return { ok: false, code: 'SUBSCRIPTION_DEMO_SUBJECT_AUTHORITY_DENIED' };
  }
  return {
    ok: true,
    selection,
    subject_key: PATRICIA_DEMO_SUBJECT_KEY,
    relationship_key: PATRICIA_DEMO_RELATIONSHIP_KEY,
    demo_copy_only: true,
  };
}

export function validateSubscriptionDemoCapability(capability) {
  if (!capability || capability.synthetic_only !== true) {
    return { ok: false, code: 'SUBSCRIPTION_DEMO_CAPABILITY_INVALID' };
  }
  if (!capability.contract) {
    return capability.subject_key === SYNTHETIC_DEMO_SUBJECT_KEY
      ? { ok: true, selection: 'synthetic', legacy: true }
      : { ok: false, code: 'SUBSCRIPTION_DEMO_CAPABILITY_INVALID' };
  }
  if (capability.contract !== 'subscription_v1_internal_capability_v2') {
    return { ok: false, code: 'SUBSCRIPTION_DEMO_CAPABILITY_INVALID' };
  }
  const selection = String(capability.demo_subject_id || '');
  const resolved = resolveSubscriptionDemoSubject({ selection, capability });
  if (!resolved.ok
    || resolved.subject_key !== capability.subject_key
    || resolved.relationship_key !== capability.relationship_key) {
    return { ok: false, code: 'SUBSCRIPTION_DEMO_CAPABILITY_SCOPE_MISMATCH' };
  }
  if (!capability.demo_subject_switching && selection !== 'synthetic') {
    return { ok: false, code: 'SUBSCRIPTION_DEMO_CAPABILITY_SCOPE_MISMATCH' };
  }
  return { ok: true, selection, legacy: false };
}

import { createHash } from 'node:crypto';
import { hasDarrenDemoAuthority, validateSubscriptionDemoCapability } from '../subscriptionS2/demoSubjectAuthority.js';

export const BLIND_EXPERIMENT_VERSION = 'subscription-frontier-blind-v1';
export const BLIND_LABELS = Object.freeze(['MODEL 1', 'MODEL 2']);
const issuedScopes = new WeakSet();
const digest = (x) => createHash('sha256').update(x).digest('hex');

export function assertBlindRoot(auth, now = Date.now()) {
  const cap = auth?.capability;
  if (auth?.ok !== true || !hasDarrenDemoAuthority(cap) || !validateSubscriptionDemoCapability(cap).ok
    || cap.demo_subject_id !== 'synthetic' || cap.subject_key !== 're-mid'
    || cap.relationship_key !== cap.synthetic_relationship_key || !/^rel_[a-f0-9]{20}$/u.test(cap.relationship_key)
    || !/^[a-f0-9]{64}$/u.test(auth.capability_hash || '')
    || !Number.isFinite(Date.parse(cap.expires_at)) || Date.parse(cap.expires_at) <= now) {
    throw new Error('BLIND_DEMO_AUTHORITY_DENIED');
  }
  return cap;
}

export function blindRelationship(auth, selection) {
  const cap = assertBlindRoot(auth);
  if (!['1', '2'].includes(selection)) throw new Error('BLIND_DEMO_SELECTION_DENIED');
  return `rel_${digest(`${BLIND_EXPERIMENT_VERSION}:${cap.synthetic_relationship_key}:${selection}`).slice(0, 20)}`;
}

export function issueBlindScope(auth, selection) {
  const relationship_key = blindRelationship(auth, selection);
  const scope = Object.freeze({ contract: BLIND_EXPERIMENT_VERSION, selection,
    relationship_key, subject_key: 're-mid', synthetic_only: true,
    root_relationship_key: auth.capability.synthetic_relationship_key,
    expires_at: auth.capability.expires_at });
  issuedScopes.add(scope);
  return scope;
}

export function assertBlindScope(scope) {
  if (!issuedScopes.has(scope) || scope.synthetic_only !== true || scope.subject_key !== 're-mid'
    || Date.parse(scope.expires_at) <= Date.now()) throw new Error('BLIND_DEMO_PROVIDER_SCOPE_DENIED');
  return scope;
}

export function scopedBlindAuth(auth, scope) {
  assertBlindScope(scope);
  if (auth.capability.synthetic_relationship_key !== scope.root_relationship_key) throw new Error('BLIND_DEMO_ROOT_MISMATCH');
  return { ...auth, capability_hash: digest(`${auth.capability_hash}:${scope.relationship_key}`),
    capability: { ...auth.capability, relationship_key: scope.relationship_key, synthetic_relationship_key: scope.relationship_key } };
}

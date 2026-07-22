import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';

export const CANONICAL_FUTURE_SLOTS = Object.freeze(['CURRENT', 'MOST_LIKELY_NEXT', 'ALTERNATIVE_1', 'ALTERNATIVE_2', 'ALTERNATIVE_3']);

const scoped = (input) => ({ tenant_id: input.tenant_id, business_id: input.business_id, profile_id: input.profile_id });
const stableId = (scope, slot) => `future_${hashCanonicalJson({ ...scope, slot }).slice(0, 24)}`;
const versionId = (identity, version, content) => `${identity}_v${version}_${hashCanonicalJson(content).slice(0, 12)}`;

export function createFutureIdentitySet(input) {
  if (!input?.tenant_id || !input.business_id || !input.profile_id) return deepFreeze({ ok: false, code: 'SUBJECT_SCOPE_REQUIRED' });
  const scope = scoped(input);
  return deepFreeze({ ok: true, identities: CANONICAL_FUTURE_SLOTS.map((slot) => ({ slot,
    stable_future_identity: stableId(scope, slot), ...scope, identity_created_at: input.as_of_at })) });
}

export function versionFutureSet({ identities, definitions, prior_versions = [], as_of_at }) {
  if (!Array.isArray(identities) || identities.length !== 5 || !Array.isArray(definitions) || definitions.length !== 5) return deepFreeze({ ok: false, code: 'EXACTLY_FIVE_FUTURES_REQUIRED' });
  const identityMap = new Map(identities.map((item) => [item.slot, item]));
  if (identityMap.size !== 5 || definitions.some((item) => !identityMap.has(item.slot))) return deepFreeze({ ok: false, code: 'CANONICAL_SLOT_MISMATCH' });
  const priorByIdentity = new Map(prior_versions.map((item) => [item.stable_future_identity, item]));
  const versions = definitions.map((definition) => {
    const identity = identityMap.get(definition.slot);
    const prior = priorByIdentity.get(identity.stable_future_identity);
    if (prior && (prior.tenant_id !== identity.tenant_id || prior.business_id !== identity.business_id || prior.profile_id !== identity.profile_id)) throw new Error('CROSS_TENANT_OR_SUBJECT_VERSION_DENIED');
    const content = { ...definition }; delete content.version; delete content.future_state_id;
    const priorContent = prior ? { ...prior } : null;
    if (priorContent) for (const key of ['future_state_id', 'version', 'previous_version_id', 'created_at', 'updated_at']) delete priorContent[key];
    const unchanged = prior && hashCanonicalJson(priorContent) === hashCanonicalJson({ ...content, ...identity });
    if (unchanged) return prior;
    const version = prior ? prior.version + 1 : 1;
    const base = { ...content, ...identity, version, previous_version_id: prior?.future_state_id || null,
      created_at: prior?.created_at || as_of_at, updated_at: as_of_at };
    return { ...base, future_state_id: versionId(identity.stable_future_identity, version, base) };
  });
  return deepFreeze({ ok: true, versions, active_versions: versions.filter((item) => item.status !== 'ARCHIVED'), history: [...prior_versions, ...versions.filter((item) => !prior_versions.some((old) => old.future_state_id === item.future_state_id))] });
}

export function validateCanonicalFutureSet(versions) {
  const active = (versions || []).filter((item) => !['ARCHIVED', 'SUSPENDED'].includes(item.status));
  const errors = [];
  if (active.length !== 5) errors.push({ code: 'EXACTLY_FIVE_ACTIVE_FUTURES_REQUIRED', actual: active.length });
  if (new Set(active.map((item) => item.stable_future_identity)).size !== active.length) errors.push({ code: 'DUPLICATE_FUTURE_IDENTITY' });
  if (new Set(active.map((item) => `${item.tenant_id}:${item.business_id}:${item.profile_id}`)).size > 1) errors.push({ code: 'CROSS_TENANT_OR_SUBJECT_SET_DENIED' });
  return deepFreeze({ valid: errors.length === 0, errors });
}

export function archiveFutureVersion(prior, { as_of_at, reason }) {
  const version = prior.version + 1;
  const base = { ...prior, version, status: 'ARCHIVED', archive_reason: reason, previous_version_id: prior.future_state_id, updated_at: as_of_at };
  return deepFreeze({ ...base, future_state_id: versionId(prior.stable_future_identity, version, base) });
}

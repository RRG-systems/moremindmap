import crypto from 'node:crypto';
import { deepFreeze } from '../../../validation.js';

export const REMOTE_SHARED_SECURITY_KEY_PREFIX = 'more:cc:security:v2';

export const REMOTE_SHARED_SECURITY_KEY_FAMILIES = deepFreeze([
  'subject:external',
  'subject:scope',
  'session:token',
  'session:ref',
  'session:subject',
  'approval',
  'entitlement:token',
  'entitlement:ref',
  'entitlement:session',
  'csrf',
  'csrf:session',
  'replay',
  'rate',
  'epoch:scope',
  'epoch:environment',
  'audit',
  'audit:unique',
  'command:result',
  'adapter:ownership',
  'adapter:canary',
  'adapter:recovery',
]);

const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const safePart = (value, max = 160) => typeof value === 'string'
  && value.length > 0
  && value.length <= max
  && /^[a-zA-Z0-9:_-]+$/.test(value);

export function createQualificationDigestFunction(secretMaterial) {
  if (typeof secretMaterial !== 'string' || secretMaterial.length < 32) {
    throw new TypeError('qualification digest material must be an injected server-side secret');
  }
  return (domain, value) => crypto.createHmac('sha256', secretMaterial)
    .update(`${domain}\0${value}`, 'utf8')
    .digest('hex');
}

export function createRemoteSharedSecurityKeyspace({
  namespace_digest,
  digest,
  prefix = REMOTE_SHARED_SECURITY_KEY_PREFIX,
} = {}) {
  if (!sha256(namespace_digest)
    || typeof digest !== 'function'
    || prefix !== REMOTE_SHARED_SECURITY_KEY_PREFIX) {
    throw new TypeError('remote shared security keyspace configuration is invalid');
  }

  const root = `${prefix}:{${namespace_digest}}`;

  function opaque(domain, value) {
    if (typeof value !== 'string' || value.length < 1 || value.length > 1024) {
      throw new TypeError('remote shared security key input is invalid');
    }
    const result = digest(domain, value);
    if (!sha256(result)) throw new TypeError('remote shared security keyed digest is invalid');
    return result;
  }

  function key(family, value = null, domain = family) {
    if (!REMOTE_SHARED_SECURITY_KEY_FAMILIES.includes(family)) {
      throw new TypeError('remote shared security key family is invalid');
    }
    if (value === null) return `${root}:${family}`;
    return `${root}:${family}:${opaque(domain, value)}`;
  }

  return deepFreeze({
    prefix,
    namespace_digest,
    hash_tag: `{${namespace_digest}}`,
    ownership: key('adapter:ownership'),
    audit: key('audit'),
    environment_epoch: key('epoch:environment'),
    externalSubject: (externalSubjectRef) => key(
      'subject:external',
      externalSubjectRef,
      'identity',
    ),
    exactScope: (exactScopeHash) => key('subject:scope', exactScopeHash, 'scope'),
    sessionToken: (sessionTokenHash) => key('session:token', sessionTokenHash, 'token'),
    sessionRef: (sessionRef) => key('session:ref', sessionRef, 'session_ref'),
    subjectSessions: (subjectRef) => key('session:subject', subjectRef, 'subject_ref'),
    approval: (subjectRef, exactScopeHash) => key(
      'approval',
      `${subjectRef}\0${exactScopeHash}`,
      'approval',
    ),
    entitlementToken: (entitlementTokenHash) => key(
      'entitlement:token',
      entitlementTokenHash,
      'token',
    ),
    entitlementRef: (entitlementRef) => key(
      'entitlement:ref',
      entitlementRef,
      'entitlement_ref',
    ),
    sessionEntitlements: (sessionRef) => key(
      'entitlement:session',
      sessionRef,
      'session_ref',
    ),
    csrf: (csrfProofHash) => key('csrf', csrfProofHash, 'csrf'),
    sessionCsrf: (sessionRef) => key('csrf:session', sessionRef, 'session_ref'),
    replay: (idempotencyKeyHash) => key('replay', idempotencyKeyHash, 'idempotency'),
    commandResult: (idempotencyKeyHash) => key(
      'command:result',
      idempotencyKeyHash,
      'idempotency',
    ),
    rateLimit: (policyId, dimensionHash, windowId) => {
      if (!safePart(policyId) || !safePart(windowId)) {
        throw new TypeError('remote shared security rate key is invalid');
      }
      return key('rate', `${policyId}\0${dimensionHash}\0${windowId}`, 'rate');
    },
    scopeEpoch: (exactScopeHash) => key('epoch:scope', exactScopeHash, 'scope'),
    auditUnique: (auditIdHash) => key('audit:unique', auditIdHash, 'audit'),
    canary: (nonceDigest) => key('adapter:canary', nonceDigest, 'canary'),
    recovery: (generation) => key('adapter:recovery', String(generation), 'recovery'),
  });
}

export function remoteSharedSecurityKeysShareOneSlot(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return false;
  const tags = keys.map((key) => key.match(/\{([^{}]+)\}/)?.[1] || null);
  return tags[0] != null && tags.every((tag) => tag === tags[0]);
}

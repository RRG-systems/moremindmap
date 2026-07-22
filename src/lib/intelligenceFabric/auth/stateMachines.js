import { deepFreeze } from '../validation.js';

const transition = (machine, current, action, code) => {
  const next = machine[current]?.[action];
  return deepFreeze(next ? { ok: true, previous: current, current: next, action } : { ok: false, code, previous: current, action });
};

const ACCOUNT = Object.freeze({ ACTIVE: { SUSPEND: 'SUSPENDED', REVOKE: 'REVOKED', LOCK: 'LOCKED' },
  SUSPENDED: { RESTORE: 'ACTIVE', REVOKE: 'REVOKED' }, LOCKED: { UNLOCK: 'ACTIVE', REVOKE: 'REVOKED' }, REVOKED: {} });
const VERIFICATION = Object.freeze({ UNVERIFIED: { BEGIN: 'PENDING' }, PENDING: { COMPLETE: 'VERIFIED', FAIL: 'FAILED' }, FAILED: { RETRY: 'PENDING' }, VERIFIED: {} });
const SESSION = Object.freeze({ ACTIVE: { EXPIRE: 'EXPIRED', ROTATE: 'ROTATED', REVOKE: 'REVOKED', INVALIDATE: 'INVALID' }, EXPIRED: {}, REVOKED: {}, ROTATED: {}, INVALID: {} });
const ACCEPTANCE = Object.freeze({ PENDING_AUTH: { AUTHENTICATE: 'AUTHENTICATED', EXPIRE: 'EXPIRED', REVOKE: 'REVOKED' },
  AUTHENTICATED: { RESUME: 'RESUMED', ACCOUNT_SWITCH: 'REVOKED', EXPIRE: 'EXPIRED', REVOKE: 'REVOKED' },
  RESUMED: { CONSUME: 'CONSUMED', EXPIRE: 'EXPIRED', REVOKE: 'REVOKED' }, EXPIRED: {}, REVOKED: {}, CONSUMED: {} });

export const transitionCoachAccount = (state, action) => transition(ACCOUNT, state, action, 'INVALID_ACCOUNT_TRANSITION');
export const transitionCoachVerification = (state, action) => transition(VERIFICATION, state, action, 'INVALID_VERIFICATION_TRANSITION');
export const transitionCoachSession = (state, action) => transition(SESSION, state, action, 'INVALID_SESSION_TRANSITION');
export const transitionAcceptanceContext = (state, action) => transition(ACCEPTANCE, state, action, 'INVALID_ACCEPTANCE_TRANSITION');

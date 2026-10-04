import { ageOn } from './config.js';
import { digest, requireValue } from './repository.js';

export const YOUTH_REGISTER_PERMISSION = 'youth_approval_register_read';
export const YOUTH_REGISTER_SCOPE = 'california_youth';
export const ALL_REGISTERED_YOUTH = 'all_registered_california_youth';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const mmPattern = /^MM-\d{8}-[A-F0-9]{8}$/;
const deny = () => requireValue(false, 'YOUTH_REGISTER_READ_DENIED', 403);
export const youthStaffGrantKey = actorId => {
  requireValue(uuid.test(actorId || ''), 'YOUTH_REGISTER_ASSIGNMENT_INVALID', 503);
  return `youth-staff-grant:${actorId}`;
};

// NEW: trusted deployment metadata, not a password, public signup role or demo
// capability. No HTTP action can create, replace or revoke this assignment.
export function parseYouthRegisterBinding(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  requireValue(typeof raw === 'string' && raw.length <= 16000, 'YOUTH_REGISTER_BINDING_INVALID', 503);
  let binding;
  try { binding = JSON.parse(raw); } catch { requireValue(false, 'YOUTH_REGISTER_BINDING_INVALID', 503); }
  const fields = ['actorId', 'assignmentId', 'securityVersion', 'startsAt', 'expiresAt', 'permission', 'scope', 'subjectMms', 'authorityReceipt'];
  requireValue(binding && !Array.isArray(binding) && Object.keys(binding).length === fields.length
    && fields.every(k => Object.hasOwn(binding, k)) && uuid.test(binding.actorId || '') && uuid.test(binding.assignmentId || '')
    && Number.isSafeInteger(binding.securityVersion) && binding.securityVersion >= 1
    && Number.isSafeInteger(binding.startsAt) && Number.isSafeInteger(binding.expiresAt)
    && binding.startsAt >= 0 && binding.expiresAt > binding.startsAt && binding.expiresAt - binding.startsAt <= 90 * 86400000
    && binding.permission === YOUTH_REGISTER_PERMISSION && binding.scope === YOUTH_REGISTER_SCOPE
    && (binding.subjectMms === ALL_REGISTERED_YOUTH || (Array.isArray(binding.subjectMms) && binding.subjectMms.length >= 1
      && binding.subjectMms.length <= 100 && new Set(binding.subjectMms).size === binding.subjectMms.length
      && binding.subjectMms.every(mm => mmPattern.test(mm))))
    && typeof binding.authorityReceipt === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:._/-]{7,199}$/.test(binding.authorityReceipt),
  'YOUTH_REGISTER_BINDING_INVALID', 503);
  return Object.freeze(structuredClone(binding));
}

export function createYouthRegisterAuthorizer({ repo, config, now = Date.now }) {
  requireValue(repo?.transact && config, 'YOUTH_REGISTER_STORAGE_REQUIRED', 503);
  return async function authorizeYouthRegister(principal) {
    const binding = config.youthRegisterBinding, at = now();
    if (!binding || !principal || principal.verified !== true || principal.id !== binding.actorId
      || binding.startsAt > at || binding.expiresAt <= at) return deny();
    const accountKey = `account:${binding.actorId}`, grantKey = youthStaffGrantKey(binding.actorId), termsHash = digest(binding);
    // Account and durable revocation state are rechecked in one CAS snapshot.
    // No youth index, dossier, report or transcript is read during authorization.
    return repo.transact([accountKey, grantKey], snapshot => {
      const account = snapshot[accountKey];
      requireValue(account?.id === binding.actorId && account.verified === true && account.region === 'US-CA'
        && ['guardian', 'participant'].includes(account.role) && account.sessionVersion === principal.sessionVersion
        && account.securityVersion === binding.securityVersion && ageOn(account.dateOfBirth, at) >= 18,
      'YOUTH_REGISTER_READ_DENIED', 403);
      const saved = snapshot[grantKey] || { schemaVersion: 1, actorId: binding.actorId, assignments: [] };
      requireValue(saved.schemaVersion === 1 && saved.actorId === binding.actorId && Array.isArray(saved.assignments)
        && saved.assignments.length <= 128, 'YOUTH_REGISTER_ASSIGNMENT_INVALID', 503);
      let assignment = saved.assignments.find(a => a.assignmentId === binding.assignmentId);
      const writes = {};
      if (assignment) {
        requireValue(assignment.termsHash === termsHash && assignment.status === 'active'
          && saved.currentAssignmentId === binding.assignmentId, 'YOUTH_REGISTER_READ_DENIED', 403);
      } else {
        requireValue(saved.assignments.length < 128, 'YOUTH_REGISTER_ASSIGNMENT_INVALID', 503);
        // A never-used older deployment must not replace a newer assignment
        // merely because its ID is absent from history. New binding epochs are
        // strictly increasing, even after revocation or deployment rollback.
        requireValue(saved.assignments.every(prior => Number.isSafeInteger(prior.terms?.startsAt)
          && binding.startsAt > prior.terms.startsAt), 'YOUTH_REGISTER_READ_DENIED', 403);
        for (const prior of saved.assignments) if (prior.status === 'active') {
          prior.status = 'replaced'; prior.replacedAt = at; prior.replacedBy = binding.assignmentId;
        }
        assignment = { assignmentId: binding.assignmentId, termsHash, terms: structuredClone(binding), status: 'active', boundAt: at };
        saved.assignments.push(assignment); saved.currentAssignmentId = binding.assignmentId; writes[grantKey] = saved;
      }
      return { writes, result: { authenticated: true, actorId: account.id, permission: YOUTH_REGISTER_PERMISSION,
        current: true, scope: YOUTH_REGISTER_SCOPE, syntheticOnly: false, assignmentId: assignment.assignmentId,
        subjectMms: structuredClone(binding.subjectMms), expiresAt: binding.expiresAt } };
    });
  };
}

// Trusted server-side operations only. A revoked assignment ID is never
// reactivated by an older deployment, a browser request or a retried read.
export async function revokeYouthRegisterAssignment({ repo, actorId, assignmentId, authorityReceipt, at = Date.now() }) {
  requireValue(uuid.test(assignmentId || '') && typeof authorityReceipt === 'string'
    && /^[a-zA-Z0-9][a-zA-Z0-9:._/-]{7,199}$/.test(authorityReceipt) && Number.isSafeInteger(at),
  'YOUTH_REGISTER_ASSIGNMENT_INVALID', 503);
  const key = youthStaffGrantKey(actorId);
  return repo.transact([key], snapshot => {
    const saved = snapshot[key], assignment = saved?.assignments?.find(a => a.assignmentId === assignmentId);
    requireValue(saved?.schemaVersion === 1 && saved.actorId === actorId && assignment, 'YOUTH_REGISTER_ASSIGNMENT_UNAVAILABLE', 404);
    if (assignment.status === 'revoked') return { writes: {}, result: { revoked: true } };
    assignment.status = 'revoked'; assignment.revokedAt = at; assignment.revocationAuthorityReceipt = authorityReceipt;
    return { writes: { [key]: saved }, result: { revoked: true } };
  });
}

import { ageOn } from './config.js';
import { digest, requireValue } from './repository.js';
import { ALL_REGISTERED_YOUTH } from './youthRegisterAccess.js';

export const YOUTH_REGISTER_INDEX = 'youth-approval-register:v1:index';
export const YOUTH_REGISTER_CONTRACT = 'athlete_youth_approval_register_v1';
export const APPROVAL_BASIS = 'authenticated_email_confirmed_adult_self_attestation';
const relationships = new Set(['parent', 'legal_guardian', 'other_guardian']);
const band = age => age < 13 ? 'out_of_scope' : age < 17 ? '13-16' : age === 17 ? '17' : 'adult';
const optionalText = value => typeof value === 'string' && value.trim() ? value.trim() : null;

// This index contains references only. Facts/history live in the existing dossier.
export function indexYouth(index, mm) {
  requireValue(typeof mm === 'string' && /^MM-\d{8}-[A-F0-9]{8}$/.test(mm), 'YOUTH_REGISTER_SUBJECT_INVALID', 503);
  requireValue(!index || (index.schemaVersion === 1 && Array.isArray(index.mms)), 'YOUTH_REGISTER_INDEX_INVALID', 503);
  return { schemaVersion: 1, mms: [...new Set([...(index?.mms || []), mm])] };
}

export function registerYouth(dossier, at) {
  const age = ageOn(dossier.person.dateOfBirth, at);
  if (age < 13 || age >= 18 || dossier.person.region && dossier.person.region !== 'US-CA') return false;
  if (!dossier.youthApprovalRegister) dossier.youthApprovalRegister = {
    schemaVersion: 1, registeredAt: dossier.createdAt ?? null,
    ageBandAtRegistration: Number.isFinite(dossier.createdAt) ? band(ageOn(dossier.person.dateOfBirth, dossier.createdAt)) : null, approvals: [],
  };
  requireValue(dossier.youthApprovalRegister.schemaVersion === 1 && Array.isArray(dossier.youthApprovalRegister.approvals), 'YOUTH_REGISTER_RECORD_INVALID', 503);
  return true;
}

export function recordGuardianApproval(dossier, adult, command, at) {
  requireValue(adult?.verified === true && ['guardian', 'participant'].includes(adult.role)
    && adult.region === 'US-CA' && ageOn(adult.dateOfBirth, at) >= 18
    && dossier.ownerId !== adult.id, 'AUTHENTICATED_ADULT_APPROVAL_REQUIRED', 403);
  requireValue(registerYouth(dossier, at), 'YOUTH_REGISTER_SUBJECT_INVALID', 403);
  requireValue(dossier.participation.guardianId === adult.id
    && dossier.participation.guardianPolicyVersion === command.policyVersion
    && command.accepted === true, 'YOUTH_REGISTER_APPROVAL_MISMATCH', 403);
  requireValue(command.guardianRelationship === undefined || relationships.has(command.guardianRelationship), 'GUARDIAN_RELATIONSHIP_INVALID');
  const approvals = dossier.youthApprovalRegister.approvals;
  const approvalId = digest({ mm: dossier.mm, adultId: adult.id, requestId: command.requestId });
  requireValue(!approvals.some(x => x.approvalId === approvalId), 'YOUTH_REGISTER_DUPLICATE_EVENT', 409);
  for (const prior of approvals) if (prior.status === 'approved') {
    prior.status = 'replaced'; prior.replacedAt = at; prior.replacedByApprovalId = approvalId;
  }
  approvals.push({ approvalId, adultId: adult.id, adultName: optionalText(adult.displayName),
    adultEmail: optionalText(adult.email), accountRole: adult.role,
    claimedRelationship: command.guardianRelationship ?? null,
    approvedAt: at, policyVersion: command.policyVersion, status: 'approved',
    basis: APPROVAL_BASIS, emailConfirmed: true,
    ageEvidence: 'self_attested_date_of_birth', relationshipEvidence: 'self_attested',
    independentlyVerified: false });
  return approvalId;
}

export function recordApprovalWithdrawal(dossier, actorId, at) {
  for (const approval of dossier.youthApprovalRegister?.approvals || []) if (approval.status === 'approved') {
    approval.status = 'withdrawn'; approval.withdrawnAt = at; approval.withdrawnBy = actorId;
  }
}

function view(dossier, at, config) {
  const record = dossier.youthApprovalRegister;
  const currentAgeBand = band(ageOn(dossier.person.dateOfBirth, at));
  const current = record.approvals.findLast(x => x.status === 'approved') || null;
  const requiredPolicy = config.reviewedYouthPolicyVersion || (config.syntheticPreview ? config.reviewedPolicyVersion || 'candidate-review-v1' : null);
  const policyCurrent = Boolean(config.realYouthEnabled && requiredPolicy && current?.policyVersion === requiredPolicy
    && dossier.participation.policyVersion === requiredPolicy);
  const approvalCurrent = Boolean(currentAgeBand !== 'adult' && currentAgeBand !== 'out_of_scope' && policyCurrent
    && current && current.adultId === dossier.participation.guardianId
    && current.policyVersion === dossier.participation.guardianPolicyVersion
    && dossier.participation.status === 'authorized' && dossier.participation.athleteAccepted === true);
  return { athleteId: dossier.ownerId ?? null, mm: dossier.mm, athleteName: optionalText(dossier.person.name),
    academies: (dossier.memberships || []).filter(m => m.status === 'active').map(m => ({ institutionId: m.institutionId, status: m.status })),
    ageBandAtRegistration: record.ageBandAtRegistration, currentAgeBand, registeredAt: record.registeredAt,
    participationStatus: dossier.participation.status, approvalCurrent, policyCurrent,
    approvalStatus: currentAgeBand === 'adult' ? 'aged_out' : dossier.participation.status === 'withdrawn' ? 'withdrawn'
      : approvalCurrent ? 'approved_self_attested' : current ? 'approval_not_current' : 'approval_missing',
    independentlyVerified: false, approvals: record.approvals.map(a => ({
      approvalId: a.approvalId, adultId: a.adultId ?? null, adultName: a.adultName ?? null, adultEmail: a.adultEmail ?? null,
      accountRole: a.accountRole ?? null, claimedRelationship: a.claimedRelationship ?? null,
      approvedAt: a.approvedAt ?? null, policyVersion: a.policyVersion ?? null, status: a.status,
      basis: a.basis, emailConfirmed: a.emailConfirmed === true, ageEvidence: a.ageEvidence,
      relationshipEvidence: a.relationshipEvidence, independentlyVerified: false,
      ...(a.withdrawnAt !== undefined ? { withdrawnAt: a.withdrawnAt, withdrawnBy: a.withdrawnBy } : {}),
      ...(a.replacedAt !== undefined ? { replacedAt: a.replacedAt, replacedByApprovalId: a.replacedByApprovalId } : {}),
    })),
    missingFields: [!dossier.ownerId && 'athleteId', !optionalText(dossier.person.name) && 'athleteName',
      !dossier.memberships?.some(m => m.status === 'active') && 'academy',
      current && !current.adultName && 'adultName', current && !current.adultEmail && 'adultEmail',
      current && !current.claimedRelationship && 'claimedRelationship'].filter(Boolean) };
}

// Server-only read contract behind the existing Academy session/CSRF route.
// A demo capability is never a grant to real youth.
export function createYouthApprovalRegisterReader({ repo, config, authorize, now = Date.now }) {
  requireValue(typeof authorize === 'function', 'YOUTH_REGISTER_AUTHORIZER_REQUIRED', 503);
  requireValue(config && typeof config.realYouthEnabled === 'boolean', 'YOUTH_REGISTER_CONFIG_REQUIRED', 503);
  return async function readYouthApprovalRegister(principal, query = {}) {
    const grant = await authorize(principal);
    requireValue(grant?.authenticated === true && typeof grant.actorId === 'string' && grant.actorId.length > 0
      && grant.permission === 'youth_approval_register_read' && grant.current === true
      && grant.scope === 'california_youth' && grant.syntheticOnly === false, 'YOUTH_REGISTER_READ_DENIED', 403);
    requireValue(Object.keys(query).every(k => ['offset', 'limit'].includes(k)), 'YOUTH_REGISTER_QUERY_INVALID');
    const offset = query.offset ?? 0, limit = query.limit ?? 25;
    requireValue(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(limit) && limit >= 1 && limit <= 50, 'YOUTH_REGISTER_QUERY_INVALID');
    requireValue(grant.subjectMms === ALL_REGISTERED_YOUTH
      || (Array.isArray(grant.subjectMms) && grant.subjectMms.length > 0
        && grant.subjectMms.every(mm => /^MM-\d{8}-[A-F0-9]{8}$/.test(mm))), 'YOUTH_REGISTER_READ_DENIED', 403);
    const index = await repo.read(YOUTH_REGISTER_INDEX);
    requireValue(!index || (index.schemaVersion === 1 && Array.isArray(index.mms)), 'YOUTH_REGISTER_INDEX_INVALID', 503);
    const indexed = index?.mms || [];
    const references = Array.isArray(grant.subjectMms) ? indexed.filter(mm => grant.subjectMms.includes(mm)) : indexed;
    const rows = [], at = now();
    for (const mm of references.slice(offset, offset + limit)) {
      requireValue(/^MM-\d{8}-[A-F0-9]{8}$/.test(mm), 'YOUTH_REGISTER_INDEX_INVALID', 503);
      const d = await repo.read(`dossier:${mm}`);
      requireValue(d?.mm === mm && d.youthApprovalRegister?.schemaVersion === 1
        && Array.isArray(d.youthApprovalRegister.approvals), 'YOUTH_REGISTER_RECORD_UNAVAILABLE', 503);
      rows.push(view(d, at, config));
    }
    // A grant revoked/expired/replaced during a read cannot authorize its output.
    requireValue(digest(await authorize(principal)) === digest(grant), 'YOUTH_REGISTER_READ_DENIED', 403);
    return { contract: YOUTH_REGISTER_CONTRACT, asOf: at, source: 'canonical_academy_dossiers',
      coverage: 'new_registrations_and_authenticated_approval_events_only', historicalCoverageVerified: false,
      rows, indexedCount: references.length, nextOffset: offset + limit < references.length ? offset + limit : null };
  };
}

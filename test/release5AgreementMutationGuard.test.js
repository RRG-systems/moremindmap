import assert from 'node:assert/strict';
import test from 'node:test';

import {
  __testRelease5AgreementMutationGuard as validateAgreementMutation,
} from '../api/internal/release5-canary-controller.js';
import { stableHash } from '../src/lib/recruitingV1/contracts.js';
import { createEmptyRecruitingState } from '../src/lib/recruitingV1/store.js';

const NOW = '2026-09-10T14:00:00.000Z';
const STANDARD_PROFILE_ID = 'mm-20990909-r5mgr001';
const SUBJECT_PROFILE_ID = 'mm-20990909-r5rec001';
const ASSESSMENT_ID = 'ba-20990909-deadbeef';
const ENTERPRISE_ID = 'release5-canary-standard';
const MEMBERSHIP_ID = 'membership_release5_standard_exact';
const MANAGER_SUBJECT_ID = 'manager_release5_standard_exact';
const INVITATION_ID = 'invitation_release5_synthetic_exact';
const CANDIDATE_ID = 'candidate_release5_synthetic_exact';
const RELATIONSHIP_ID = 'relationship_release5_synthetic_exact';
const SESSION_ID = 'gu_session_release5_synthetic_exact';
const ADMIN_EMAIL = 'delivered+release5-admin@resend.dev';
const MANAGER_EMAIL = 'delivered+release5-standard@resend.dev';
const PERSON_EMAIL = 'delivered+release5-recruit@resend.dev';
const RETRY_NOW = '2026-09-10T14:05:00.000Z';
const SCOPE_ERROR = /RELEASE5_RECRUITING_STATE_IDENTITY_SCOPE_INVALID/u;

function acceptedPlanLineage() {
  const plan = {
    title: 'Release 5 synthetic shared plan',
    summary: 'The manager and candidate agreed to one bounded synthetic follow-through.',
    commitments: [{
      owner: 'Release 5 Standard Manager',
      commitment: 'Hold one synthetic evidence review.',
      timing: 'Within one test cycle',
      intendedOutcome: 'Verify exact agreement-delivery continuity.',
    }],
    unresolved: [],
  };
  const proposal = {
    proposal_id: 'proposal-0001',
    version: 1,
    status: 'ACCEPTED',
    based_on_revision: 1,
    supersedes_proposal_id: null,
    proposal: structuredClone(plan),
    created_at: NOW,
  };
  const snapshotHash = stableHash(plan);
  const acceptanceId = `plan-acceptance-${stableHash({
    session_id: SESSION_ID,
    proposal_id: proposal.proposal_id,
    version: proposal.version,
    snapshot_hash: snapshotHash,
  }).slice(0, 24)}`;
  const accepted = {
    contract: 'more_consulting_accepted_plan_snapshot_v1',
    acceptance_id: acceptanceId,
    session_id: SESSION_ID,
    proposal_id: proposal.proposal_id,
    version: proposal.version,
    accepted_by: 'MANAGER',
    accepted_at: NOW,
    snapshot_hash: snapshotHash,
    plan,
  };
  const decision = {
    decision_id: 'decision-0001',
    decision: 'YES',
    proposal_id: proposal.proposal_id,
    actor: 'MANAGER',
    at_revision: 2,
    decided_at: NOW,
    acceptance_id: acceptanceId,
  };
  return { accepted, proposal, decision };
}

function agreementFixture({ personState = 'DELIVERED', managerState = 'DELIVERED' } = {}) {
  const membership = {
    membership_id: MEMBERSHIP_ID,
    manager_subject_id: MANAGER_SUBJECT_ID,
    manager_profile_id: STANDARD_PROFILE_ID,
    manager_name: 'Release 5 Standard Manager',
    manager_email: MANAGER_EMAIL,
    enterprise_id: ENTERPRISE_ID,
    enterprise_name: 'Release 5 Canary Standard',
    status: 'ACTIVE',
    setup_state: 'COMPLETE',
    entitlement_mode: '5_per_month',
    admin_roles: [],
    recruiting_governance: { all_enterprises: false, enterprise_ids: [ENTERPRISE_ID] },
  };
  const state = createEmptyRecruitingState([membership]);
  const { accepted, proposal, decision } = acceptedPlanLineage();
  const acceptanceId = accepted.acceptance_id;
  const deliveries = [
    { role: 'PERSON', state: personState, recipient: PERSON_EMAIL, outboxId: 'outbox_release5_person_exact' },
    { role: 'MANAGER', state: managerState, recipient: MANAGER_EMAIL, outboxId: 'outbox_release5_manager_exact' },
  ];
  const deliveredCount = deliveries.filter((item) => item.state === 'DELIVERED').length;
  const failedCount = deliveries.filter((item) => item.state === 'FAILED').length;

  state.invitations[INVITATION_ID] = {
    invitation_id: INVITATION_ID,
    candidate_id: CANDIDATE_ID,
    membership_id: MEMBERSHIP_ID,
    manager_subject_id: MANAGER_SUBJECT_ID,
    enterprise_id: ENTERPRISE_ID,
    recruit_name: 'Release 5 Synthetic Recruit',
    recruit_email: PERSON_EMAIL,
    purpose: 'Synthetic Release 5 Recruiting two-box canary proof only.',
    idempotency_key: 'release5-canary-recruit-20260909-v1',
    state: 'ACCEPTED',
    accepted_at: NOW,
    revoked_at: null,
    delivery_state: 'DELIVERED',
    consent: {
      version: 'recruiting_v1_consent_2026_08',
      purpose: 'RECRUITING_INTELLIGENCE',
      accepted_at: NOW,
    },
    bos_profile_id: SUBJECT_PROFILE_ID.toUpperCase(),
    ba_assessment_id: ASSESSMENT_ID,
    ba_readiness: 'BA_INTELLIGENCE_READY',
  };
  state.consultation_relationships[RELATIONSHIP_ID] = {
    relationship_id: RELATIONSHIP_ID,
    status: 'ACTIVE',
    membership_id: MEMBERSHIP_ID,
    manager_subject_id: MANAGER_SUBJECT_ID,
    enterprise_id: ENTERPRISE_ID,
    profile_id: SUBJECT_PROFILE_ID,
    candidate_id: CANDIDATE_ID,
    owner_name: 'Release 5 Synthetic Recruit',
    consent_state: 'RECRUITING_INVITATION_ACCEPTED',
    source: 'RECRUITING_V1_ACCEPTED_INVITATION',
    authorized_at: NOW,
    canonical_write_authority: false,
  };
  state.shared_business_sessions[SESSION_ID] = {
    contract: 'more_recruiting_gu_v1_shared_business_session_v1',
    session_id: SESSION_ID,
    relationship_id: RELATIONSHIP_ID,
    manager_binding: {
      subject_id: MANAGER_SUBJECT_ID,
      membership_id: MEMBERSHIP_ID,
      enterprise_id: ENTERPRISE_ID,
      name: 'Release 5 Standard Manager',
      entitlement_mode: '5_per_month',
    },
    subject_binding: {
      profile_id: SUBJECT_PROFILE_ID,
      candidate_id: CANDIDATE_ID,
      consultation_request_id: null,
      name: 'Release 5 Synthetic Recruit',
    },
    status: 'COMPLETED',
    completed_at: NOW,
    synthetic_only: false,
    current_proposal_id: proposal.proposal_id,
    proposals: [proposal],
    decisions: [decision],
    accepted_plan_snapshot: accepted,
    agreement_delivery: {
      contract: 'more_consulting_agreed_plan_delivery_v1',
      acceptance_id: acceptanceId,
      status: deliveredCount === 2 ? 'DELIVERED' : failedCount === 2 ? 'FAILED' : 'PARTIAL_FAILURE',
      recipients: deliveries.map((item) => ({
        recipient_role: item.role,
        idempotency_key: stableHash({
          acceptance_id: acceptanceId,
          recipient_role: item.role,
          snapshot_hash: accepted.snapshot_hash,
        }),
        state: item.state,
        synthetic: false,
        recipient_masked: item.role === 'PERSON' ? 'de***@resend.dev' : 'de***@resend.dev',
        outbox_id: item.outboxId,
        provider_receipt: item.state === 'DELIVERED'
          ? `resend:release5-${item.role.toLowerCase()}-receipt`
          : 'resend_transport_failure',
        attempted_at: NOW,
      })),
    },
    invariants: {
      external_mutation: deliveredCount > 0,
      canonical_mutation: false,
      recruiting_v1_mutation: false,
      model_output_is_canonical: false,
    },
  };

  for (const delivery of deliveries) {
    const role = delivery.role.toLowerCase();
    const idempotencyKey = stableHash({
      acceptance_id: acceptanceId,
      recipient_role: delivery.role,
      snapshot_hash: accepted.snapshot_hash,
    });
    const providerReceipt = delivery.state === 'DELIVERED'
      ? `resend:release5-${role}-receipt`
      : 'resend_transport_failure';
    state.outbox[delivery.outboxId] = {
      outbox_id: delivery.outboxId,
      idempotency_key: idempotencyKey,
      kind: 'CONSULTING_AGREED_PLAN',
      recipient: delivery.recipient,
      membership_id: MEMBERSHIP_ID,
      enterprise_id: ENTERPRISE_ID,
      invitation_id: INVITATION_ID,
      invitation_token_generation: 1,
      payload: {
        acceptance_id: acceptanceId,
        recipient_role: delivery.role,
        recipient_name: delivery.role === 'PERSON'
          ? 'Release 5 Synthetic Recruit'
          : 'Release 5 Standard Manager',
        manager_name: 'Release 5 Standard Manager',
        person_name: 'Release 5 Synthetic Recruit',
        accepted_plan_snapshot: structuredClone(accepted),
      },
      token_capsule: null,
      state: delivery.state,
      attempts: 1,
      created_at: NOW,
      updated_at: NOW,
      provider_receipt: providerReceipt,
    };
  }
  return state;
}

function validate(state) {
  return validateAgreementMutation(state, {
    profileId: SUBJECT_PROFILE_ID,
    assessmentId: ASSESSMENT_ID,
  });
}

function assertScopeRejected(state) {
  assert.throws(() => validate(state), SCOPE_ERROR);
}

function setManagerRetryState(state, retryState, { includeAudit = true, auditAt = RETRY_NOW } = {}) {
  const session = state.shared_business_sessions[SESSION_ID];
  const recipient = session.agreement_delivery.recipients
    .find((item) => item.recipient_role === 'MANAGER');
  const outbox = state.outbox[recipient.outbox_id];
  outbox.state = retryState;
  outbox.updated_at = RETRY_NOW;
  if (retryState === 'SENDING') outbox.delivery_started_at = RETRY_NOW;
  if (retryState === 'DELIVERED') {
    outbox.attempts = 2;
    outbox.delivery_started_at = RETRY_NOW;
    outbox.provider_receipt = 'resend:release5-manager-retry-receipt';
  }
  if (retryState === 'FAILED') {
    outbox.attempts = 2;
    outbox.delivery_started_at = RETRY_NOW;
    outbox.provider_receipt = 'resend_status_503_service_unavailable';
  }
  if (includeAudit) {
    state.audit.push({
      event_id: 'audit_release5_manager_retry_exact',
      event_type: 'CONSULTING_AGREED_PLAN_RETRY_AUTHORIZED',
      occurred_at: auditAt,
      outbox_id: outbox.outbox_id,
      acceptance_id: session.accepted_plan_snapshot.acceptance_id,
      recipient_role: recipient.recipient_role,
    });
  }
  return state;
}

test('Release 5 agreement guard accepts only the exact two-delivery completed agreement', () => {
  assert.deepEqual(validate(agreementFixture()), {
    sessionId: SESSION_ID,
    agreementComplete: true,
  });
});

test('Release 5 agreement guard recognizes one delivered and one failed as retryable, not complete', () => {
  const state = agreementFixture({ managerState: 'FAILED' });
  assert.deepEqual(validate(state), {
    sessionId: SESSION_ID,
    agreementComplete: false,
  });
  assert.equal(state.shared_business_sessions[SESSION_ID].invariants.external_mutation, true);
  assert.equal(state.shared_business_sessions[SESSION_ID].agreement_delivery.status, 'PARTIAL_FAILURE');
});

test('Release 5 agreement guard accepts all-failed no-egress state as resumable, not complete', () => {
  const state = agreementFixture({ personState: 'FAILED', managerState: 'FAILED' });
  assert.deepEqual(validate(state), {
    sessionId: SESSION_ID,
    agreementComplete: false,
  });
  assert.equal(state.shared_business_sessions[SESSION_ID].invariants.external_mutation, false);
  assert.equal(state.shared_business_sessions[SESSION_ID].agreement_delivery.status, 'FAILED');
});

test('Release 5 agreement guard requires external mutation to equal observed delivery egress', () => {
  for (const state of [
    agreementFixture(),
    agreementFixture({ managerState: 'FAILED' }),
  ]) {
    state.shared_business_sessions[SESSION_ID].invariants.external_mutation = false;
    assertScopeRejected(state);
  }
});

test('Release 5 agreement guard requires actual accepted proposal and YES-decision lineage', () => {
  const state = agreementFixture();
  const session = state.shared_business_sessions[SESSION_ID];
  session.current_proposal_id = null;
  session.proposals = [];
  session.decisions = [];
  assert.equal(stableHash(session.accepted_plan_snapshot.plan), session.accepted_plan_snapshot.snapshot_hash);
  assertScopeRejected(state);
});

test('Release 5 agreement guard accepts audited retry transitions but never marks partial delivery complete', () => {
  for (const retryState of ['PENDING', 'SENDING', 'DELIVERED', 'FAILED']) {
    const authorized = setManagerRetryState(
      agreementFixture({ managerState: 'FAILED' }),
      retryState,
    );
    assert.deepEqual(validate(authorized), {
      sessionId: SESSION_ID,
      agreementComplete: false,
    }, `${retryState} with exact retry audit`);

    const unauthorized = setManagerRetryState(
      agreementFixture({ managerState: 'FAILED' }),
      retryState,
      { includeAudit: false },
    );
    assert.throws(() => validate(unauthorized), SCOPE_ERROR, `${retryState} without retry audit`);
  }
});

test('Release 5 agreement guard rejects a stale retry audit predating the recorded failed attempt', () => {
  const state = setManagerRetryState(
    agreementFixture({ managerState: 'FAILED' }),
    'PENDING',
    { auditAt: '2026-09-10T13:59:59.000Z' },
  );
  assertScopeRejected(state);
});

test('Release 5 agreement guard rejects external mutation with no validated session or at any wrong path', () => {
  const noSession = agreementFixture();
  delete noSession.shared_business_sessions[SESSION_ID];
  noSession.audit.push({ external_mutation: true });
  assertScopeRejected(noSession);

  const validSessionWrongPath = agreementFixture();
  validSessionWrongPath.audit.push({ external_mutation: true });
  assertScopeRejected(validSessionWrongPath);
});

test('Release 5 agreement guard rejects multiple flagged sessions and key/session mismatch', () => {
  const multiple = agreementFixture();
  const duplicate = structuredClone(multiple.shared_business_sessions[SESSION_ID]);
  duplicate.session_id = 'gu_session_release5_second_flagged';
  duplicate.accepted_plan_snapshot.session_id = duplicate.session_id;
  multiple.shared_business_sessions[duplicate.session_id] = duplicate;
  assertScopeRejected(multiple);

  const keyMismatch = agreementFixture();
  keyMismatch.shared_business_sessions.gu_session_wrong_key = keyMismatch.shared_business_sessions[SESSION_ID];
  delete keyMismatch.shared_business_sessions[SESSION_ID];
  assertScopeRejected(keyMismatch);
});

test('Release 5 agreement guard rejects binding, snapshot, role, delivery, and outbox defects', () => {
  const cases = [
    ['manager membership binding', (state) => {
      state.shared_business_sessions[SESSION_ID].manager_binding.membership_id = 'membership_wrong';
    }],
    ['candidate binding', (state) => {
      state.shared_business_sessions[SESSION_ID].subject_binding.candidate_id = 'candidate_wrong';
    }],
    ['profile binding', (state) => {
      state.shared_business_sessions[SESSION_ID].subject_binding.profile_id = 'mm-20990909-wrong001';
    }],
    ['relationship binding', (state) => {
      state.shared_business_sessions[SESSION_ID].relationship_id = 'relationship_wrong';
    }],
    ['invitation binding', (state) => {
      state.invitations[INVITATION_ID].candidate_id = 'candidate_wrong';
    }],
    ['invitation manager subject', (state) => {
      state.invitations[INVITATION_ID].manager_subject_id = 'manager_wrong';
    }],
    ['invitation enterprise', (state) => {
      state.invitations[INVITATION_ID].enterprise_id = 'release5-canary-admin';
    }],
    ['accepted snapshot hash', (state) => {
      state.shared_business_sessions[SESSION_ID].accepted_plan_snapshot.plan.summary = 'Drifted after acceptance.';
    }],
    ['accepted snapshot session', (state) => {
      state.shared_business_sessions[SESSION_ID].accepted_plan_snapshot.session_id = 'gu_session_wrong';
    }],
    ['duplicate accepted proposal id', (state) => {
      const session = state.shared_business_sessions[SESSION_ID];
      session.proposals.push(structuredClone(session.proposals[0]));
    }],
    ['agreement acceptance id', (state) => {
      state.shared_business_sessions[SESSION_ID].agreement_delivery.acceptance_id = 'plan-acceptance-wrong';
    }],
    ['recipient roles', (state) => {
      state.shared_business_sessions[SESSION_ID].agreement_delivery.recipients[1].recipient_role = 'PERSON';
    }],
    ['recipient idempotency', (state) => {
      state.shared_business_sessions[SESSION_ID].agreement_delivery.recipients[0].idempotency_key = 'wrong-idempotency';
    }],
    ['outbox idempotency', (state) => {
      state.outbox.outbox_release5_person_exact.idempotency_key = 'wrong-idempotency';
    }],
    ['missing outbox', (state) => {
      delete state.outbox.outbox_release5_person_exact;
    }],
    ['outbox state', (state) => {
      state.outbox.outbox_release5_person_exact.state = 'FAILED';
    }],
    ['wrong approved recipient', (state) => {
      state.outbox.outbox_release5_person_exact.recipient = ADMIN_EMAIL;
    }],
    ['outbox accepted snapshot', (state) => {
      state.outbox.outbox_release5_person_exact.payload.accepted_plan_snapshot.plan.summary = 'Outbox drift.';
    }],
    ['outbox and recipient receipt mismatch', (state) => {
      state.outbox.outbox_release5_person_exact.provider_receipt = 'resend:wrong-receipt';
    }],
    ['non-Resend delivered receipt', (state) => {
      const recipient = state.shared_business_sessions[SESSION_ID].agreement_delivery.recipients[0];
      recipient.provider_receipt = 'mail-provider:release5-person-receipt';
      state.outbox.outbox_release5_person_exact.provider_receipt = recipient.provider_receipt;
    }],
    ['extra agreement outbox', (state) => {
      const extra = structuredClone(state.outbox.outbox_release5_person_exact);
      extra.outbox_id = 'outbox_release5_unlinked_extra';
      state.outbox[extra.outbox_id] = extra;
    }],
    ['canonical mutation invariant', (state) => {
      state.shared_business_sessions[SESSION_ID].invariants.canonical_mutation = true;
    }],
    ['Recruiting mutation invariant', (state) => {
      state.shared_business_sessions[SESSION_ID].invariants.recruiting_v1_mutation = true;
    }],
    ['model canonicality invariant', (state) => {
      state.shared_business_sessions[SESSION_ID].invariants.model_output_is_canonical = true;
    }],
  ];

  for (const [label, corrupt] of cases) {
    assert.throws(() => {
      const state = agreementFixture();
      corrupt(state);
      validate(state);
    }, SCOPE_ERROR, label);
  }
});

test('Release 5 partial-delivery evidence cannot claim final agreement completion', () => {
  const state = agreementFixture({ managerState: 'FAILED' });
  state.shared_business_sessions[SESSION_ID].agreement_delivery.status = 'DELIVERED';
  assertScopeRejected(state);
});

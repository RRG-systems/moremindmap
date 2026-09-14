import assert from 'node:assert/strict';
import test from 'node:test';

import { NEW_BA_COMPLETENESS_STATUS } from '../api/engine/newBaProductionReadinessV1/completeness.js';
import { NEW_BA_LAUNCH_SAFE_ENVELOPE_VERSION } from '../api/engine/newBaProductionReadinessV1/launchSafeRealizationStore.js';
import {
  PAID_SUBSCRIBER_COMPLETENESS_POLICY,
  isPaidSubscriberCompletenessAccepted,
} from '../api/engine/subscriptionV1/paidSubscriberCustody.js';

const OPEN_PLAN_VALIDATION = Object.freeze({
  status: NEW_BA_COMPLETENESS_STATUS.VALID_ANALYSIS_WITH_OPEN_PLAN,
  plan_state: 'LO_OPEN_DRAFT',
  plan_customer_commitment: false,
  customer_plan_status: 'OPEN_NOT_CUSTOMER_AGREED',
  customer_plan_complete: false,
  storage_eligible: true,
});

const OPEN_PLAN_RECORD = Object.freeze({
  envelope_version: NEW_BA_LAUNCH_SAFE_ENVELOPE_VERSION,
  artifact: Object.freeze({
    cassette_binding: Object.freeze({ vertical_id: 'loan_originator' }),
    business_reality: Object.freeze({
      assessment_identity: Object.freeze({ vertical: 'loan_originator' }),
    }),
    lineage: Object.freeze({ vertical_id: 'loan_originator' }),
    customer_view_model: Object.freeze({
      vertical: Object.freeze({ vertical_id: 'loan_originator' }),
    }),
    plan_135: Object.freeze({ plan_state: 'LO_OPEN_DRAFT' }),
  }),
  completeness: OPEN_PLAN_VALIDATION,
});

function accepted(validation, record, policy) {
  return isPaidSubscriberCompletenessAccepted({ validation, record, policy });
}

test('fully complete BA remains accepted by the default paid-subscriber policy', () => {
  const validation = { status: NEW_BA_COMPLETENESS_STATUS.COMPLETE };
  assert.equal(accepted(validation, { completeness: validation }), true);
  assert.equal(accepted(validation, { artifact: {}, completeness: validation }), true);
});

test('LO open plan is denied by default and admitted only by an exact paid or synthetic LO policy', () => {
  assert.equal(accepted(OPEN_PLAN_VALIDATION, OPEN_PLAN_RECORD), false);
  assert.equal(accepted(OPEN_PLAN_VALIDATION, OPEN_PLAN_RECORD, 'ALLOW_OPEN_PLAN'), false);
  assert.equal(accepted(
    OPEN_PLAN_VALIDATION,
    OPEN_PLAN_RECORD,
    PAID_SUBSCRIBER_COMPLETENESS_POLICY.CANONICAL_PAID_LO_OPEN_PLAN,
  ), true);
  assert.equal(accepted(
    OPEN_PLAN_VALIDATION,
    OPEN_PLAN_RECORD,
    PAID_SUBSCRIBER_COMPLETENESS_POLICY.SYNTHETIC_QA_RELEASE_4_LO_OPEN_PLAN,
  ), true);
});

test('both narrow LO policies reject incomplete custody and customer-commitment inflation', () => {
  const mutations = [
    ({ record }) => { delete record.envelope_version; },
    ({ validation }) => { validation.plan_state = 'PASS'; },
    ({ validation }) => { validation.plan_customer_commitment = true; },
    ({ validation }) => { validation.customer_plan_status = 'CUSTOMER_AGREED'; },
    ({ validation }) => { validation.customer_plan_complete = true; },
    ({ validation }) => { validation.storage_eligible = false; },
    ({ record }) => { record.completeness.status = NEW_BA_COMPLETENESS_STATUS.COMPLETE; },
    ({ record }) => { record.completeness.plan_customer_commitment = true; },
    ({ record }) => { record.artifact.cassette_binding.vertical_id = 'real_estate'; },
    ({ record }) => { record.artifact.business_reality.assessment_identity.vertical = 'real_estate'; },
    ({ record }) => { record.artifact.lineage.vertical_id = 'real_estate'; },
    ({ record }) => { record.artifact.customer_view_model.vertical.vertical_id = 'real_estate'; },
    ({ record }) => { record.artifact.plan_135.plan_state = 'PASS'; },
  ];
  for (const policy of [
    PAID_SUBSCRIBER_COMPLETENESS_POLICY.CANONICAL_PAID_LO_OPEN_PLAN,
    PAID_SUBSCRIBER_COMPLETENESS_POLICY.SYNTHETIC_QA_RELEASE_4_LO_OPEN_PLAN,
  ]) {
    for (const mutate of mutations) {
      const validation = structuredClone(OPEN_PLAN_VALIDATION);
      const record = structuredClone(OPEN_PLAN_RECORD);
      mutate({ validation, record });
      assert.equal(accepted(validation, record, policy), false);
    }
    assert.equal(accepted(OPEN_PLAN_VALIDATION, { ...OPEN_PLAN_RECORD, artifact: null }, policy), false);
  }
});

import { validatePersistedVerticalBinding } from '../../business-assessment/verticalBinding.js';
import { normalizeGovernedAssessmentRecord } from '../newBaProductionReadinessV1/canonicalReader.js';
import {
  assertScopedLoanOriginatorGenerationContext,
  createScopedLoanOriginatorGenerationContext,
} from '../newBaProductionReadinessV1/scopedLoanOriginatorGeneration.js';

let scopedLoanOriginatorContext;

function unsupported() {
  throw new Error('subscription_assessment_vertical_authority_unsupported');
}

function loanOriginatorContext() {
  scopedLoanOriginatorContext ||= createScopedLoanOriginatorGenerationContext();
  assertScopedLoanOriginatorGenerationContext(scopedLoanOriginatorContext);
  return scopedLoanOriginatorContext;
}

/**
 * Resolve the exact cassette authority used by Subscription without widening
 * the public Business Assessment registry. Legacy records with no persisted
 * binding retain the existing Real Estate compatibility path.
 */
export function subscriptionAssessmentAuthorityOptions(assessment = {}) {
  const binding = assessment?.vertical_binding;
  if (binding == null) return Object.freeze({});
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) unsupported();
  if (binding.vertical_id === 'real_estate') return Object.freeze({});
  if (binding.vertical_id !== 'loan_originator') unsupported();
  return loanOriginatorContext();
}

export function validateSubscriptionAssessmentVerticalBinding(binding) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    throw new Error('subscription_assessment_vertical_authority_required');
  }
  const options = subscriptionAssessmentAuthorityOptions({ vertical_binding: binding });
  return validatePersistedVerticalBinding(binding, options.cassetteRegistry
    ? { registry: options.cassetteRegistry }
    : undefined);
}

export function normalizeSubscriptionGovernedAssessment(assessment, expectedProfileId) {
  const options = subscriptionAssessmentAuthorityOptions(assessment);
  const governedEvidence = normalizeGovernedAssessmentRecord(
    assessment,
    expectedProfileId,
    options,
  );
  const verticalBinding = validateSubscriptionAssessmentVerticalBinding(
    governedEvidence.vertical_binding,
  );
  return Object.freeze({ governedEvidence, verticalBinding });
}

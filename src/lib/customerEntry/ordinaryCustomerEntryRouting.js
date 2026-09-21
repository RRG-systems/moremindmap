const PROFILE_ID_PATTERN = /^MM-\d{8}-[A-Z0-9]{8}$/;

const BOS_GOVERNED_FALLBACK_CODES = new Set([
  'new_bos_canonical_profile_not_found',
  'new_bos_modernization_requires_evidence_or_review',
  'public_product_current_artifact_unavailable',
]);

const BA_GOVERNED_FALLBACK_CODES = new Set([
  'new_ba_business_assessment_not_found',
  'new_ba_compatible_bos_authority_missing',
  'new_ba_modernization_requires_evidence_or_review',
  'public_product_current_artifact_unavailable',
]);

export const ORDINARY_CUSTOMER_ENTRY_UNAVAILABLE_MESSAGE =
  'Your current MORE MindMap experience could not be resolved right now. Please try again shortly.';

export function normalizeOrdinaryCustomerProfileId(value) {
  const profileId = String(value || '').trim().toUpperCase();
  return PROFILE_ID_PATTERN.test(profileId) ? profileId : null;
}

export function buildOrdinaryCustomerDestination(product, profileId) {
  const normalized = normalizeOrdinaryCustomerProfileId(profileId);
  if (!normalized) throw new Error('ordinary_customer_profile_id_invalid');
  if (product === 'bos') return `/new-bos?id=${encodeURIComponent(normalized)}`;
  if (product === 'ba') return `/business-twin?id=${encodeURIComponent(normalized)}`;
  throw new Error('ordinary_customer_product_invalid');
}

function safeCode(payload) {
  return String(payload?.safe_code || '').split(':')[0];
}

async function resolveCurrentProduct({
  product,
  profileId,
  fetchImpl = globalThis.fetch,
}) {
  const normalized = normalizeOrdinaryCustomerProfileId(profileId);
  if (!normalized) {
    return Object.freeze({ status: 'invalid', product, profileId: null, safeCode: 'profile_id_invalid' });
  }
  if (typeof fetchImpl !== 'function') throw new Error('ordinary_customer_fetch_required');

  const endpoint = product === 'bos' ? 'new-bos' : 'new-ba';
  const governedFallbackCodes = product === 'bos'
    ? BOS_GOVERNED_FALLBACK_CODES
    : BA_GOVERNED_FALLBACK_CODES;

  try {
    const response = await fetchImpl(
      `/api/moremindmap/${endpoint}?id=${encodeURIComponent(normalized)}`,
      {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      },
    );
    const payload = await response.json().catch(() => ({}));
    const code = safeCode(payload);
    const pending = response.status === 202 && payload?.pending === true;

    if ((response.ok && payload?.artifact) || pending) {
      return Object.freeze({
        status: 'current',
        product,
        profileId: normalized,
        destination: buildOrdinaryCustomerDestination(product, normalized),
        pending,
      });
    }

    if (governedFallbackCodes.has(code)) {
      return Object.freeze({
        status: 'governed_fallback',
        product,
        profileId: normalized,
        safeCode: code,
      });
    }

    return Object.freeze({
      status: 'unavailable',
      product,
      profileId: normalized,
      safeCode: code || `http_${response.status}`,
    });
  } catch {
    return Object.freeze({
      status: 'unavailable',
      product,
      profileId: normalized,
      safeCode: 'network_or_parse_failure',
    });
  }
}

export function resolveOrdinaryBosEntry(profileId, fetchImpl) {
  return resolveCurrentProduct({ product: 'bos', profileId, fetchImpl });
}

export function resolveOrdinaryBaEntry(profileId, fetchImpl) {
  return resolveCurrentProduct({ product: 'ba', profileId, fetchImpl });
}

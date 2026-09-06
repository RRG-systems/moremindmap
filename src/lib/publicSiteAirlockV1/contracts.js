import crypto from 'node:crypto';

export const PUBLIC_PRODUCT_CONTRACT_VERSION = 'mmm-public-product-v1';
export const PUBLIC_ACCESS_CONTRACT_VERSION = 'mmm-public-access-v1';
export const PUBLIC_INQUIRY_CONTRACT_VERSION = 'mmm-public-inquiry-v1';

export const PUBLIC_PRODUCTS = Object.freeze({
  behavior_operating_system: Object.freeze({
    product_key: 'behavior_operating_system',
    public_name: 'Build Your MindMap',
    price_minor: 14900,
    currency: 'usd',
    cadence: 'one_time',
    access_type: 'behavior_operating_system',
    destination: '/profile',
    prerequisite: 'none',
  }),
  business_assessment: Object.freeze({
    product_key: 'business_assessment',
    public_name: 'Assess Your Business',
    price_minor: 4900,
    currency: 'usd',
    cadence: 'one_time',
    access_type: 'business_assessment',
    destination: '/business-assessment',
    prerequisite: 'completed_bos_and_customer_confirmed_vertical',
  }),
  more_monthly_intelligence: Object.freeze({
    product_key: 'more_monthly_intelligence',
    public_name: 'Keep Your Map Alive',
    price_minor: 3895,
    currency: 'usd',
    cadence: 'monthly',
    access_type: 'more_monthly_intelligence',
    destination: null,
    prerequisite: 'completed_bos_and_business_assessment',
    launch_state: 'gated_until_authenticated_subscriber_destination_is_proven',
  }),
});

export const PUBLIC_PRODUCT_CATALOG = Object.freeze({
  version: PUBLIC_PRODUCT_CONTRACT_VERSION,
  products: PUBLIC_PRODUCTS,
});

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export const PUBLIC_PRODUCT_CATALOG_SHA256 = sha256(canonicalJson(PUBLIC_PRODUCT_CATALOG));

export function boundedText(value, max = 180) {
  return String(value || '').trim().slice(0, max);
}

export function normalizeEmail(value) {
  const email = boundedText(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return '';
  return email;
}

export function normalizeProfileId(value) {
  const id = boundedText(value, 40).toLowerCase();
  return /^mm-\d{8}-[a-z0-9]{8}$/u.test(id) ? id : '';
}

export function normalizeVerticalSelection(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    vertical_id: boundedText(value.vertical_id, 80),
    confirmation: boundedText(value.confirmation, 80),
  };
}

export function productForKey(productKey) {
  return PUBLIC_PRODUCTS[boundedText(productKey, 80)] || null;
}

export function publicCatalogProjection({ checkoutEnabled = false, subscriptionEnabled = false } = {}) {
  return {
    version: PUBLIC_PRODUCT_CONTRACT_VERSION,
    sha256: PUBLIC_PRODUCT_CATALOG_SHA256,
    products: Object.values(PUBLIC_PRODUCTS).map((product) => ({
      product_key: product.product_key,
      public_name: product.public_name,
      price_minor: product.price_minor,
      currency: product.currency,
      cadence: product.cadence,
      checkout_state: product.product_key === 'more_monthly_intelligence'
        ? (subscriptionEnabled ? 'enabled' : 'gated')
        : (checkoutEnabled ? 'enabled' : 'gated'),
    })),
  };
}

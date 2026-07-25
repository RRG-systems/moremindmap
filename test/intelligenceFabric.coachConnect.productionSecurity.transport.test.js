import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRatifiedTransportEnvironmentPolicy,
  createRatifiedTrustedProxyPolicy,
  DEFAULT_PRODUCTION_SECURITY_FLAGS,
  evaluateSyntheticHstsPolicy,
  resolveTrustedClientAddress,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

const proxyPolicy = createRatifiedTrustedProxyPolicy({
  environment_id: 'production-synthetic',
  exact_project_reference: 'project-synthetic',
}).policy;
const transportPolicy = createRatifiedTransportEnvironmentPolicy({
  environment_id: 'production-synthetic',
  exact_host_allowlist: ['app.synthetic.example'],
}).policy;
const privacyKey = 'synthetic-privacy-key-at-least-thirty-two-bytes';

function verifiedAddress() {
  return resolveTrustedClientAddress({
    policy: proxyPolicy,
    connection_metadata: {
      platform_attested: true,
      source: 'VERCEL_EDGE',
      project_reference: 'project-synthetic',
      upstream_proxy_present: false,
      client_address_chain: ['203.0.113.10'],
    },
    platform_contract_verified: true,
    privacy_hmac_key: privacyKey,
    proof_class: 'SYNTHETIC_DEPLOYMENT_SHAPED',
  });
}

const activeFlags = {
  ...DEFAULT_PRODUCTION_SECURITY_FLAGS,
  foundation_enabled: true,
  transport_policy_enabled: true,
  emergency_disabled: false,
};

function productionShapedRequest(overrides = {}) {
  return {
    actual_production_traffic: false,
    proof_class: 'SYNTHETIC_DEPLOYMENT_SHAPED',
    environment_id: 'production-synthetic',
    environment_class: 'PRODUCTION',
    host: 'app.synthetic.example',
    https_termination_verified: true,
    protocol: 'https',
    ...overrides,
  };
}

test('unattested forwarded headers and ambiguous chains are never trusted', () => {
  const spoofed = resolveTrustedClientAddress({
    policy: proxyPolicy,
    connection_metadata: { platform_attested: false },
    forwarded_headers: { 'x-forwarded-for': '198.51.100.12' },
    privacy_hmac_key: privacyKey,
  });
  assert.equal(spoofed.resolution, 'AMBIGUOUS');
  assert.equal(spoofed.reason_code, 'UNTRUSTED_FORWARDED_HEADER');
  const ambiguous = resolveTrustedClientAddress({
    policy: proxyPolicy,
    connection_metadata: {
      platform_attested: true,
      source: 'VERCEL_EDGE',
      project_reference: 'project-synthetic',
      upstream_proxy_present: false,
      client_address_chain: ['203.0.113.10', '203.0.113.11'],
    },
    platform_contract_verified: true,
    privacy_hmac_key: privacyKey,
  });
  assert.equal(ambiguous.resolution, 'AMBIGUOUS');
  assert.equal(ambiguous.privacy_safe_network_bucket, null);
});

test('verified synthetic network resolution emits only a privacy-safe bucket', () => {
  const resolved = verifiedAddress();
  assert.equal(resolved.resolution, 'VERIFIED');
  assert.equal(resolved.raw_address_included, false);
  assert.equal(resolved.authorization_input, false);
  assert.equal(resolved.live_deployment_certified, false);
  assert.match(resolved.privacy_safe_network_bucket, /^PUBLIC:[a-f0-9]{24}$/);
  assert.doesNotMatch(JSON.stringify(resolved), /203\.0\.113\.10/);
});

test('HSTS is default-off and exists only for the exact synthetic deployment-shaped case', () => {
  assert.equal(evaluateSyntheticHstsPolicy({
    policy: transportPolicy,
    request_context: productionShapedRequest(),
    client_address_resolution: verifiedAddress(),
    flags: DEFAULT_PRODUCTION_SECURITY_FLAGS,
  }).emit, false);
  const expected = new Map([
    ['CANARY', 'max-age=300'],
    ['OBSERVED', 'max-age=86400'],
    ['TARGET', 'max-age=31536000'],
  ]);
  for (const [stage, header] of expected) {
    const decision = evaluateSyntheticHstsPolicy({
      policy: transportPolicy,
      request_context: productionShapedRequest(),
      client_address_resolution: verifiedAddress(),
      flags: activeFlags,
      stage,
    });
    assert.equal(decision.emit, true);
    assert.equal(decision.header_value, header);
    assert.equal(decision.include_subdomains, false);
    assert.equal(decision.preload, false);
    assert.equal(decision.deployment_action, false);
    assert.equal(decision.production_header_emitted, false);
  }
});

test('HSTS is absent for preview local HTTP wrong host production traffic or proxy ambiguity', () => {
  const cases = [
    productionShapedRequest({ environment_class: 'PREVIEW' }),
    productionShapedRequest({ environment_class: 'LOCAL' }),
    productionShapedRequest({ protocol: 'http', https_termination_verified: false }),
    productionShapedRequest({ host: 'attacker.synthetic.example' }),
    productionShapedRequest({ actual_production_traffic: true }),
  ];
  for (const requestContext of cases) {
    assert.equal(evaluateSyntheticHstsPolicy({
      policy: transportPolicy,
      request_context: requestContext,
      client_address_resolution: verifiedAddress(),
      flags: activeFlags,
    }).emit, false);
  }
  assert.equal(evaluateSyntheticHstsPolicy({
    policy: transportPolicy,
    request_context: productionShapedRequest(),
    client_address_resolution: { ...verifiedAddress(), resolution: 'AMBIGUOUS' },
    flags: activeFlags,
  }).emit, false);
});

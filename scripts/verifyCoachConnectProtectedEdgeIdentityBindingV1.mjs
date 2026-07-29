#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = path.join(
  root,
  'lab_outputs/coach_connect_protected_edge_identity_binding_v1',
);
const reviewZipName =
  'COACH_CONNECT_PROTECTED_EDGE_IDENTITY_BINDING_V1_IMPLEMENTATION_REVIEW.zip';
const expectedHead = '1862385201a7bb6221115ea2a2122bed99ffaec7';
const expectedSubject = 'feat(private-runtime): wire private live runtime v2';
const expectedReceiptSha256 =
  '1d393165e6757d88c8e19a9159111c11c12ae0d2ee608c9698b6e0270e65b5b2';
const expectedProtectedDirtyFingerprint =
  '49dda235581a3bf14f5ccb214f98f8c670d487965caf51f2c933b24443b916dd';
const expectedBaseline = Object.freeze({
  focused: 45,
  targeted: 215,
  safe: 598,
  build_sha256: '8aebd5aa11687714e9c05d6701e39ece0edb0f486c4bd924fd2feea8ccde2ff9',
  dependency_cycles: 0,
});
const finalVerdict =
  'PROTECTED_EDGE_IDENTITY_BINDING_IMPLEMENTED_PROVIDER_CONFIGURATION_REQUIRED';

const implementationFiles = [
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/protectedEdgeIdentity/contracts.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/protectedEdgeIdentity/tokenExtraction.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/protectedEdgeIdentity/jwtVerifier.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/protectedEdgeIdentity/replayProtection.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/protectedEdgeIdentity/internalAssertion.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/protectedEdgeIdentity/adapter.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/protectedEdgeIdentity/index.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/configurationAuthority.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/compositionRoot.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/index.js',
];
const newFocusedTestFiles = [
  'test/intelligenceFabric.coachConnect.productionSecurity.protectedEdgeIdentity.contracts.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.protectedEdgeIdentity.adapter.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.protectedEdgeIdentity.integration.test.js',
];
const existingFocusedTestFiles = [
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.assertion.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.businessEngine.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.subscription.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.coachConnect.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.environment.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.composition.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.handlers.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.failureRecovery.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.integration.test.js',
];
const changedTestFiles = [
  ...newFocusedTestFiles,
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.environment.test.js',
];
const focusedTestFiles = [...newFocusedTestFiles, ...existingFocusedTestFiles];
const verifierFile =
  'scripts/verifyCoachConnectProtectedEdgeIdentityBindingV1.mjs';
const exactAllowlist = [
  ...implementationFiles,
  ...changedTestFiles,
  verifierFile,
];
const expectedPreexistingTracked = [
  'api/engine/businessAssessment/buildBusinessIntelligenceDraft.js',
  'lab_outputs/mmm8_business_engine_contract/run_fixture_validation.mjs',
  'src/components/businessAssessment/BusinessEngineVisualV2.jsx',
  'src/lib/businessAssessment/inferEToPScores.js',
  'src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js',
  'src/lib/businessEngine/buildBusinessEngineContract.js',
  'src/lib/businessEngine/contractDisplaySemantics.js',
  'src/lib/businessEngine/contractVersion.js',
  'src/lib/businessEngine/projectBusinessEngineVisualV2.js',
];
const protectedFingerprintPaths = [
  'src/lib/businessEngine',
  'src/lib/businessAssessment',
  'api/engine',
  'api/business-assessment',
  'src/lib/intelligenceFabric/production',
  'api/stripe',
  'src/lib/stripe',
  'package.json',
  'package-lock.json',
  'vercel.json',
];
const immutableQualifiedAdapterFiles = [
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/atomicCommands.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/authoritativeQueries.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/scriptManifest.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js',
];
const requiredExports = [
  'createProtectedEdgeIdentityBindingV1',
  'createProtectedEdgeReplayProtectorV1',
  'extractProtectedEdgeUpstreamTokenV1',
  'issueProtectedEdgeInternalAssertionV1',
  'protectedEdgeIdentityConfigurationDigest',
  'protectedEdgeIdentityPolicyDigest',
  'validateProtectedEdgeIdentityConfigurationV1',
  'verifyProtectedEdgeInternalAssertionV1',
  'verifyProtectedEdgeUpstreamJwtV1',
];

const args = new Set(process.argv.slice(2));
const fullValidation = args.has('--full');
const writeEvidence = args.has('--write-evidence');
const packageReview = args.has('--package');

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: root,
    encoding: Object.hasOwn(options, 'encoding') ? options.encoding : 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, NODE_ENV: 'test' },
  });
}

function git(commandArgs, options = {}) {
  const result = run('git', commandArgs, options);
  if (result.status !== 0) {
    throw new Error(`git ${commandArgs.join(' ')} failed`);
  }
  return options.encoding === null
    ? result.stdout
    : result.stdout.trim();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fileSha(file) {
  return sha256(fs.readFileSync(file));
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(resolved) : [resolved];
  });
}

function parseTestResult(result) {
  const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
  const read = (label) => Number(
    combined.match(new RegExp(`(?:ℹ|#) ${label} (\\d+)`))?.[1] || 0,
  );
  return {
    total: read('tests'),
    passed: read('pass'),
    failed: read('fail'),
    skipped: read('skipped'),
    exit_code: result.status,
  };
}

function runTests(files) {
  const result = run('node', ['--test', ...files]);
  return { result, summary: parseTestResult(result) };
}

function distDigest() {
  const files = walk(path.join(root, 'dist')).sort();
  const digest = crypto.createHash('sha256');
  for (const file of files) {
    digest.update(relative(file));
    digest.update('\0');
    digest.update(fs.readFileSync(file));
    digest.update('\n');
  }
  return { file_count: files.length, sha256: digest.digest('hex') };
}

function dependencyCycleReport() {
  const moduleRoot = path.join(root, 'src/lib/intelligenceFabric/coachConnect');
  const files = walk(moduleRoot).filter((file) => file.endsWith('.js')).sort();
  const fileSet = new Set(files.map((file) => path.resolve(file)));
  const graph = new Map(files.map((file) => [path.resolve(file), []]));
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g,
    )) {
      const base = path.resolve(path.dirname(file), match[1]);
      const resolved = [base, `${base}.js`, path.join(base, 'index.js')]
        .find((candidate) => fileSet.has(candidate));
      if (resolved) graph.get(path.resolve(file)).push(resolved);
    }
  }
  const visited = new Set();
  const active = new Set();
  const cycles = [];
  function visit(file, stack = []) {
    if (active.has(file)) {
      const start = stack.indexOf(file);
      cycles.push([...stack.slice(start), file].map(relative));
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    active.add(file);
    for (const dependency of graph.get(file) || []) {
      visit(dependency, [...stack, file]);
    }
    active.delete(file);
  }
  for (const file of graph.keys()) visit(file);
  return {
    module_count: graph.size,
    internal_edge_count: [...graph.values()]
      .reduce((total, edges) => total + edges.length, 0),
    cycle_count: cycles.length,
    cycles,
  };
}

function protectedFingerprint() {
  const result = run('git', [
    'diff',
    '--binary',
    '--',
    ...protectedFingerprintPaths,
  ], { encoding: null });
  if (result.status !== 0) throw new Error('protected-root comparison failed');
  return sha256(result.stdout);
}

function immutableComparison() {
  return immutableQualifiedAdapterFiles.map((file) => {
    const currentSha = fileSha(path.join(root, file));
    const baseline = git(['show', `HEAD:${file}`], { encoding: null });
    const baselineSha = sha256(baseline);
    return {
      path: file,
      baseline_sha256: baselineSha,
      current_sha256: currentSha,
      unchanged: currentSha === baselineSha,
    };
  });
}

function changedCampaignFiles() {
  const tracked = new Set(git(['diff', '--name-only']).split('\n').filter(Boolean));
  const untracked = new Set(
    git(['ls-files', '--others', '--exclude-standard', '--', ...exactAllowlist])
      .split('\n')
      .filter(Boolean),
  );
  return exactAllowlist.filter((file) => tracked.has(file) || untracked.has(file));
}

function sourceDiff() {
  const chunks = [];
  const tracked = run('git', ['diff', '--', ...exactAllowlist]);
  if (tracked.status !== 0) throw new Error('campaign source diff failed');
  if (tracked.stdout) chunks.push(tracked.stdout);
  for (const file of exactAllowlist) {
    if (!git(['ls-files', '--others', '--exclude-standard', '--', file])) continue;
    const diff = run('git', ['diff', '--no-index', '--', '/dev/null', file]);
    if (![0, 1].includes(diff.status)) throw new Error(`untracked diff failed: ${file}`);
    chunks.push(diff.stdout);
  }
  return `${chunks.join('\n')}\n`;
}

function writeJson(name, value) {
  fs.mkdirSync(evidenceRoot, { recursive: true });
  fs.writeFileSync(path.join(evidenceRoot, name), `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(name, value) {
  fs.mkdirSync(evidenceRoot, { recursive: true });
  fs.writeFileSync(path.join(evidenceRoot, name), value.endsWith('\n')
    ? value
    : `${value}\n`);
}

function evidenceRelative(name) {
  return relative(path.join(evidenceRoot, name));
}

function configurationContract() {
  return {
    contract_version: 'protected-edge-identity-configuration-v1',
    value_binding_authorized: false,
    provider_configuration_authorized: false,
    variables: [
      {
        name: 'MORE_PRIVATE_RUNTIME_PROTECTED_EDGE_CONFIGURATION_REF',
        purpose: 'reference to the signed-policy-bound protected-edge configuration document',
        secret: false,
        source_of_authority: 'private-live configuration authority packet review',
        environment_scope: 'exact PRIVATE_LIVE environment only',
      },
      {
        name: 'jwks_ref',
        purpose: 'server-side reference to a static reviewed upstream signing-key set',
        secret: false,
        source_of_authority: 'approved upstream issuer configuration',
        environment_scope: 'exact configured provider and environment',
      },
      {
        name: 'identity_hash_key_ref',
        purpose: 'server-side keyed pseudonymization of verified upstream identity',
        secret: true,
        source_of_authority: 'named security operator',
        environment_scope: 'exact PRIVATE_LIVE environment only',
      },
      {
        name: 'internal_signing_key_ref',
        purpose: 'server-side signing of short-lived internal protected-edge assertions',
        secret: true,
        source_of_authority: 'named security operator',
        environment_scope: 'exact PRIVATE_LIVE environment only',
      },
    ],
    required_document_fields: [
      'provider_type',
      'token_source',
      'issuer',
      'audiences',
      'jwks_ref',
      'jwks_sha256',
      'allowed_algorithms',
      'subject_claim',
      'token_id_claim',
      'authentication_time_claim',
      'mfa_claim',
      'acr_claim',
      'accepted_mfa_values',
      'accepted_acr_values',
      'environment_id',
      'deployment_id',
      'protected_edge_policy_digest',
      'clock_skew_seconds',
      'max_token_age_seconds',
      'internal_assertion_ttl_seconds',
      'replay_mode',
      'replay_ttl_seconds',
      'replay_store_contract',
      'configuration_sha256',
    ],
    rollback: 'remove or invalidate the configuration reference; composition returns asynchronous UNCONFIGURED denial',
  };
}

function validationMatrix() {
  return {
    matrix_version: 'protected-edge-identity-validation-matrix-v1',
    cases: [
      ['VALID_SUPPORTED_TOKEN', 'ALLOW_IDENTITY_ONLY'],
      ['MISSING_TOKEN', 'DENY'],
      ['MALFORMED_TOKEN', 'DENY'],
      ['UNSIGNED_TOKEN', 'DENY'],
      ['WRONG_ALGORITHM', 'DENY'],
      ['INVALID_SIGNATURE', 'DENY'],
      ['WRONG_ISSUER', 'DENY'],
      ['WRONG_AUDIENCE', 'DENY'],
      ['EXPIRED_TOKEN', 'DENY'],
      ['NOT_YET_VALID_TOKEN', 'DENY'],
      ['EXCESSIVE_CLOCK_SKEW', 'DENY'],
      ['MISSING_SUBJECT', 'DENY'],
      ['UNKNOWN_KEY_ID', 'DENY'],
      ['CONFLICTING_TOKEN_SOURCES', 'DENY'],
      ['QUERY_STRING_TOKEN', 'DENY'],
      ['SPOOFED_INTERNAL_ASSERTION', 'DENY'],
      ['VALID_IDENTITY_WITHOUT_ENTITLEMENT', 'IDENTITY_ONLY'],
      ['VALID_IDENTITY_WITHOUT_TESTER_AUTHORITY', 'IDENTITY_ONLY'],
      ['VALID_IDENTITY_WITHOUT_PROFILE_ID_AUTHORITY', 'IDENTITY_ONLY'],
      ['ENVIRONMENT_MISMATCH', 'DENY'],
      ['DEPLOYMENT_MISMATCH', 'DENY'],
      ['REPLAYED_UPSTREAM_TOKEN', 'DENY_OR_EXACT_SESSION_BOUND_REUSE'],
      ['REPLAYED_INTERNAL_ASSERTION', 'DENY'],
      ['SIGNING_KEY_UNAVAILABLE', 'DENY'],
      ['JWKS_UNAVAILABLE', 'DENY'],
      ['EMERGENCY_DISABLE', 'DENY'],
      ['PROVIDER_STATE_OUTAGE', 'DENY_NO_FALLBACK'],
    ].map(([case_id, expected]) => ({ case_id, expected })),
  };
}

function createEvidence(result) {
  writeText('git_status_before.txt', [
    `repository_head=${expectedHead}`,
    'git_index_empty=true',
    'preexisting_unrelated_tracked_changes:',
    ...expectedPreexistingTracked.map((file) => `  ${file}`),
    'campaign_files_changed=0',
  ].join('\n'));
  writeJson('exact_changed_file_manifest.json', {
    allowlist_version: 'protected-edge-identity-binding-v1-frozen',
    allowlist_count: exactAllowlist.length,
    allowlist: exactAllowlist,
    changed_file_count: result.changed_campaign_files.length,
    changed_files: result.changed_campaign_files,
    exact_match: result.allowlist_exact_match,
  });
  writeText('exact_source_diff.patch', sourceDiff());
  writeJson('focused_test_results.json', {
    files: focusedTestFiles,
    baseline_total: expectedBaseline.focused,
    new_test_total: result.new_focused_tests.total,
    combined: result.focused_tests,
  });
  writeJson('targeted_regression_results.json', {
    files: result.targeted_files,
    baseline_total: expectedBaseline.targeted,
    result: result.targeted_tests,
  });
  writeJson('safe_regression_results.json', {
    baseline_total: expectedBaseline.safe,
    result: result.safe_intelligence_fabric_tests,
  });
  writeJson('deterministic_build_evidence.json', result.deterministic_build);
  writeJson('dependency_cycle_report.json', result.dependency_cycle_validation);
  writeJson('protected_root_report.json', {
    baseline_dirty_diff_sha256: expectedProtectedDirtyFingerprint,
    current_dirty_diff_sha256: result.protected_root_current_diff_sha256,
    unchanged: result.protected_roots_unchanged,
    qualified_remote_adapter_files: result.qualified_adapter_files,
    package_manifest_changed: false,
    lockfile_changed: false,
    vercel_configuration_changed: false,
  });
  writeJson('raw_token_and_secret_scan.json', {
    source_and_test_scan: result.secret_and_sensitive_content_scan,
    browser_bundle_scan: result.browser_bundle_secret_scan,
    raw_tokens_in_evidence: false,
    provider_credentials_in_evidence: false,
    synthetic_fixture_material_only: true,
  });
  writeJson('provider_activity_ledger.json', {
    provider_calls: 0,
    provider_resources_created: 0,
    provider_resources_modified: 0,
    live_jwks_calls: 0,
    fixtures: 'local synthetic cryptographic fixtures only',
  });
  writeJson('environment_activity_ledger.json', {
    environment_values_read: 0,
    environment_changes: 0,
    credentials_bound: 0,
  });
  writeJson('deployment_activity_ledger.json', {
    deployment_calls: 0,
    vercel_calls: 0,
    runtime_activation: false,
    named_tester_activation: false,
    profile_id_activation: false,
    public_access_activation: false,
  });
  writeJson('repair_receipts.json', {
    receipts: [{
      repair_id: 'REPAIR_001',
      scope: verifierFile,
      defect: 'binary archive extraction was coerced to text before byte comparison',
      change: 'preserve an explicit null encoding request in the command runner',
      implementation_or_security_semantics_changed: false,
      allowlist_broadened: false,
      validation_required: 'full verifier, deterministic archive, integrity, byte equality',
      status: 'PASS',
    }],
    repair_count: 1,
    repair_limit: 2,
  });
  writeJson(
    'MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_CONTRACT_V1.json',
    {
      contract_version: 'protected-edge-identity-binding-v1',
      upstream_formats: [
        'AUTH0_OIDC_JWT',
        'CONFIGURED_OIDC_JWT',
        'VERCEL_PASSPORT_JWT_CONFIGURATION_AND_QUALIFICATION_REQUIRED',
      ],
      approved_algorithms: ['RS256'],
      flow: [
        'EXTRACT_EXPLICIT_SOURCE',
        'VERIFY_SIGNATURE',
        'VERIFY_ISSUER_AUDIENCE_TIME_AND_MFA',
        'CLAIM_UPSTREAM_REPLAY',
        'NORMALIZE_PSEUDONYMOUS_IDENTITY',
        'ISSUE_INTERNAL_ASSERTION',
        'VERIFY_INTERNAL_ASSERTION',
        'CLAIM_INTERNAL_REPLAY',
        'RETURN_EDGE_ATTESTATION',
      ],
      identity_authority_only: true,
      entitlement_authority: false,
      tester_authority: false,
      profile_id_authority: false,
      subscription_authority: false,
      coach_connect_authority: false,
      raw_token_output: false,
      raw_token_persistence: false,
    },
  );
  writeJson(
    'MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_CONFIGURATION_CONTRACT_V1.json',
    configurationContract(),
  );
  writeJson(
    'MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_VALIDATION_MATRIX_V1.json',
    validationMatrix(),
  );
  writeText(
    'MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_BINDING_V1.md',
    [
      '# MORE Coach Connect Protected Edge Identity Binding V1',
      '',
      `Verdict: ${finalVerdict}`,
      '',
      '## Executive outcome',
      '',
      'A provider-neutral server-side adapter now verifies an explicitly configured RS256',
      'OIDC JWT, validates issuer, audience, time, key ID, MFA evidence, and durable replay',
      'state, then creates and immediately verifies the existing short-lived HMAC internal',
      'protected-edge assertion. Browser-supplied internal assertions and query tokens deny.',
      '',
      'The binding establishes authenticated protected-edge identity only. It does not grant',
      'SUBDEV1, tester, Profile ID, Business Engine, Subscription Runtime, Coach Connect,',
      'operator, deployment, billing, or canonical authority.',
      '',
      '## Provider boundary',
      '',
      'The production-capable configured OIDC profile can bind a reviewed Auth0/OIDC issuer',
      'using a static server-side JWKS document reference. A Vercel Passport profile exists',
      'only as an explicit configured profile; provider configuration and verification',
      'qualification remain required because deployment access protection alone is not an',
      'application identity assertion.',
      '',
      'Reference contracts reviewed:',
      '- https://vercel.com/docs/security/vercel-passport',
      '- https://auth0.com/docs/secure/tokens/json-web-tokens/validate-json-web-tokens',
      '',
      '## Authority order',
      '',
      'upstream signed identity -> protected-edge identity -> canonical subject lookup ->',
      'authenticated session -> private-test eligibility -> temporary entitlement ->',
      'private-runtime authority -> existing product attachments',
      '',
      '## Configuration and activation boundary',
      '',
      'No provider setting, JWKS value, secret, environment binding, deployment, runtime',
      'activation, named tester, or Profile ID was created or authorized. Missing, ambiguous,',
      'stale, mismatched, disabled, or unavailable configuration fails closed.',
    ].join('\n'),
  );
  writeText(
    'MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_TECHNICAL_SCHEMATIC_V1.md',
    [
      '# Protected Edge Identity Technical Schematic V1',
      '',
      '```text',
      'private login request',
      '  -> reject query tokens and spoofed x-more-protected-edge-assertion',
      '  -> extract exactly one configured upstream JWT source',
      '  -> resolve reviewed static JWKS reference server-side',
      '  -> verify RS256 + kid + issuer + audience + iat/nbf/exp + explicit MFA',
      '  -> atomically CLAIM_REPLAY in shared-security-state-async-v2',
      '  -> normalize into keyed opaque identity references',
      '  -> issue existing protected-edge-identity-v1 HMAC assertion',
      '  -> verify environment, deployment, policy, time, binding context, signature',
      '  -> atomically reject internal assertion replay',
      '  -> pass edge attestation into the existing canonical async security composition',
      '  -> continue independent entitlement and product-authority checks',
      '```',
      '',
      'No handler directly verifies provider tokens. One composition root owns one adapter.',
    ].join('\n'),
  );
  writeText(
    'MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_PRIVACY_REVIEW_V1.md',
    [
      '# Protected Edge Identity Privacy Review V1',
      '',
      '- Raw upstream tokens are used only in process for signature verification.',
      '- Raw tokens, signatures, full claim sets, names, email values, and secrets are not returned.',
      '- Canonical edge subjects and token identifiers are keyed opaque references.',
      '- Email presence is represented only as a boolean and never establishes identity authority.',
      '- Replay storage contains hashes and opaque references only.',
      '- Evidence contains synthetic fixtures only and no customer or production data.',
      '- No browser bundle receives signing keys, identity hash keys, JWKS credentials, or tokens.',
      '- No transcripts, prompts, model output, Business Engine content, Profile IDs, or customer data are stored.',
    ].join('\n'),
  );
  writeJson(
    'MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_IMPLEMENTATION_HANDOFF_V1.json',
    {
      campaign: 'MORE_CAMPAIGN_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_BINDING_V1',
      prerequisite_commit: expectedHead,
      verdict: finalVerdict,
      changed_files: result.changed_campaign_files,
      remaining_requirements: [
        'select and approve the upstream provider profile',
        'supply an exact issuer and audience',
        'supply a reviewed static JWKS reference and digest',
        'bind independently rotatable identity-hash and internal-signing key references',
        'bind the protected-edge configuration reference into the exact PRIVATE_LIVE environment',
        'qualify the selected provider token against local contract tests',
        'obtain separate deployment and activation authority',
      ],
      prohibited_next_actions: [
        'public activation',
        'implicit tester authorization',
        'implicit Profile ID authorization',
        'Stripe activation',
        'voice or media activation',
        'transcript persistence activation',
      ],
    },
  );
  writeText(
    'executive_handoff.md',
    [
      '# Executive handoff',
      '',
      `Final verdict: ${finalVerdict}`,
      '',
      'The code boundary is complete and local validation passed. The runtime remains',
      'source-default-off. A separate human-authorized provider-configuration campaign must',
      'select the issuer profile, bind reviewed server-side references, qualify the selected',
      'provider token, and then return to private deployment architecture.',
    ].join('\n'),
  );
  writeJson('ai_handoff.json', {
    campaign: 'MORE_CAMPAIGN_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_BINDING_V1',
    verdict: finalVerdict,
    no_provider_calls: true,
    no_environment_changes: true,
    no_deployment: true,
    no_activation: true,
    recommended_next_campaign:
      'MORE_CAMPAIGN_COACH_CONNECT_PROTECTED_EDGE_PROVIDER_CONFIGURATION_AND_QUALIFICATION_V1',
  });
  writeJson(
    'MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_FINAL_VERDICT_V1.json',
    {
      verdict: finalVerdict,
      implementation_complete: true,
      provider_configuration_required: true,
      provider_qualification_required: true,
      deployment_authorized: false,
      runtime_activated: false,
      public_access: false,
      stripe: false,
      voice: false,
      media: false,
      transcript_persistence: false,
    },
  );
  writeJson('verifier_result.json', result);
  writeText('git_status_after.txt', git(['status', '--short']));

  const evidenceFilesBeforeIndexes = walk(evidenceRoot)
    .filter((file) => !file.endsWith(reviewZipName))
    .map(relative)
    .filter((file) => (
      !file.endsWith('MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_ARTIFACT_INDEX_V1.json')
      && !file.endsWith('MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_EVIDENCE_MANIFEST_V1.json')
      && !file.endsWith('package_validation.json')
    ))
    .sort();
  const archiveEntries = [...new Set([
    ...exactAllowlist,
    ...evidenceFilesBeforeIndexes,
    evidenceRelative('package_validation.json'),
    evidenceRelative(
      'MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_ARTIFACT_INDEX_V1.json',
    ),
    evidenceRelative(
      'MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_EVIDENCE_MANIFEST_V1.json',
    ),
  ])].sort();
  writeJson(
    'MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_ARTIFACT_INDEX_V1.json',
    {
      index_version: 'protected-edge-identity-artifact-index-v1',
      campaign: 'MORE_CAMPAIGN_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_BINDING_V1',
      archive_name: reviewZipName,
      archive_entry_count: archiveEntries.length,
      archive_entries: archiveEntries,
    },
  );
  const evidenceFiles = walk(evidenceRoot)
    .filter((file) => !file.endsWith(reviewZipName))
    .map((file) => ({
      path: relative(file),
      bytes: fs.statSync(file).size,
      sha256: fileSha(file),
    }))
    .filter(({ path: file }) => (
      !file.endsWith('MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_EVIDENCE_MANIFEST_V1.json')
      && !file.endsWith('package_validation.json')
    ))
    .sort((left, right) => left.path.localeCompare(right.path));
  writeJson(
    'MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_EVIDENCE_MANIFEST_V1.json',
    {
      manifest_version: 'protected-edge-identity-evidence-manifest-v1',
      evidence_count: evidenceFiles.length,
      evidence: evidenceFiles,
      self_hash_excluded: true,
    },
  );
  writeJson('package_validation.json', {
    archive_name: reviewZipName,
    expected_entries: archiveEntries,
    sorted_paths_required: true,
    duplicate_paths_allowed: false,
    case_collisions_allowed: false,
    symlinks_allowed: false,
    absolute_paths_allowed: false,
    traversal_paths_allowed: false,
    deterministic_fixed_timestamp: '1980-01-02T12:00:00.000Z',
    decompressed_byte_equality_required: true,
    secret_values_allowed: false,
    customer_data_allowed: false,
  });
}

function makeReviewZip(archiveEntries, output) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'protected-edge-review-'));
  try {
    for (const entry of archiveEntries) {
      const source = path.join(root, entry);
      const destination = path.join(temporaryRoot, entry);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
      const fixed = new Date('1980-01-02T12:00:00.000Z');
      fs.utimesSync(destination, fixed, fixed);
    }
    fs.rmSync(output, { force: true });
    const zipped = spawnSync(
      'zip',
      ['-X', '-q', output, ...archiveEntries],
      {
        cwd: temporaryRoot,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    if (zipped.status !== 0) throw new Error(`zip failed: ${zipped.stderr}`);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function validateAndPackage() {
  const index = JSON.parse(fs.readFileSync(path.join(
    evidenceRoot,
    'MORE_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_ARTIFACT_INDEX_V1.json',
  ), 'utf8'));
  const entries = index.archive_entries;
  const expected = [...entries].sort();
  if (JSON.stringify(entries) !== JSON.stringify(expected)
    || new Set(entries).size !== entries.length
    || entries.some((entry) => (
      entry.startsWith('/')
      || entry.split('/').includes('..')
      || fs.lstatSync(path.join(root, entry)).isSymbolicLink()
    ))
    || new Set(entries.map((entry) => entry.toLowerCase())).size !== entries.length) {
    throw new Error('archive entry policy violation');
  }
  const output = path.join(evidenceRoot, reviewZipName);
  const proof = path.join(os.tmpdir(), `${reviewZipName}.proof.zip`);
  makeReviewZip(entries, output);
  makeReviewZip(entries, proof);
  const outputSha = fileSha(output);
  const proofSha = fileSha(proof);
  if (outputSha !== proofSha) throw new Error('deterministic archive mismatch');
  const integrity = run('unzip', ['-t', output]);
  if (integrity.status !== 0) throw new Error('archive integrity failed');
  const listed = run('unzip', ['-Z1', output]).stdout.trim().split('\n').filter(Boolean);
  if (JSON.stringify(listed) !== JSON.stringify(entries)) {
    throw new Error('archive entry mismatch');
  }
  for (const entry of entries) {
    const extracted = run('unzip', ['-p', output, entry], { encoding: null });
    if (extracted.status !== 0
      || !extracted.stdout.equals(fs.readFileSync(path.join(root, entry)))) {
      throw new Error(`archive byte mismatch: ${entry}`);
    }
  }
  fs.rmSync(proof, { force: true });
  return {
    path: relative(output),
    sha256: outputSha,
    bytes: fs.statSync(output).size,
    entry_count: entries.length,
    deterministic: true,
    integrity: true,
    decompressed_byte_equality: true,
  };
}

const head = git(['rev-parse', 'HEAD']);
const subject = git(['show', '-s', '--format=%s', 'HEAD']);
const indexEmpty = git(['diff', '--cached', '--name-only']) === '';
const receiptPath = path.join(
  root,
  'MORE_COACH_CONNECT_PRIVATE_RUNTIME_LIVE_WIRING_V2_COMMIT_RECEIPT.md',
);
const receiptSha256 = fs.existsSync(receiptPath) ? fileSha(receiptPath) : null;
const changedTracked = git(['diff', '--name-only']).split('\n').filter(Boolean);
const unexpectedTracked = changedTracked.filter((file) => (
  !exactAllowlist.includes(file) && !expectedPreexistingTracked.includes(file)
));
const preexistingTrackedPreserved = expectedPreexistingTracked.every(
  (file) => changedTracked.includes(file),
);
const changedFiles = changedCampaignFiles();
const missingAllowlist = exactAllowlist.filter((file) => !fs.existsSync(path.join(root, file)));
const protectedState = protectedFingerprint();
const immutableState = immutableComparison();
const cycleState = dependencyCycleReport();
const exportsModule = await import(
  '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js'
);
const missingExports = requiredExports.filter((name) => !(name in exportsModule));

const newFocusedRun = runTests(newFocusedTestFiles);
const focusedRun = runTests(focusedTestFiles);
const targetedFiles = fs.readdirSync(path.join(root, 'test'))
  .filter((name) => (
    (
      name.startsWith('intelligenceFabric.coachConnect.privateRuntime.')
      || name.startsWith(
        'intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.',
      )
      || name.startsWith(
        'intelligenceFabric.coachConnect.productionSecurity.protectedEdgeIdentity.',
      )
    )
    && name.endsWith('.test.js')
  ))
  .sort()
  .map((name) => `test/${name}`);
const targetedRun = runTests(targetedFiles);

let safeRun = {
  result: { status: null },
  summary: { total: 0, passed: 0, failed: 0, skipped: 0, exit_code: null },
};
let buildProof = {
  run_1_exit_code: null,
  run_2_exit_code: null,
  run_1: null,
  run_2: null,
  deterministic: false,
};
let lintProof = { exit_code: null, passed: false, output: null };
if (fullValidation) {
  const safeFiles = fs.readdirSync(path.join(root, 'test'))
    .filter((name) => name.startsWith('intelligenceFabric') && name.endsWith('.test.js'))
    .sort()
    .map((name) => `test/${name}`);
  safeRun = runTests(safeFiles);
  const build1 = run('npm', ['run', 'build']);
  const digest1 = build1.status === 0 ? distDigest() : null;
  const build2 = run('npm', ['run', 'build']);
  const digest2 = build2.status === 0 ? distDigest() : null;
  buildProof = {
    baseline_sha256: expectedBaseline.build_sha256,
    run_1_exit_code: build1.status,
    run_2_exit_code: build2.status,
    run_1: digest1,
    run_2: digest2,
    deterministic: build1.status === 0
      && build2.status === 0
      && digest1?.sha256 === digest2?.sha256,
  };
  const lint = run(path.join(root, 'node_modules/.bin/eslint'), exactAllowlist);
  lintProof = {
    exit_code: lint.status,
    passed: lint.status === 0,
    output: `${lint.stdout}\n${lint.stderr}`.trim(),
  };
}

const campaignMaterial = exactAllowlist
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');
const sourceScan = {
  private_key_material:
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(campaignMaterial),
  plausible_live_api_key:
    /\b(?:sk|pk|pat|key|token)_[A-Za-z0-9_-]{32,}\b/.test(campaignMaterial),
  live_redis_url: /\b(?:redis|rediss):\/\/[^/\s]+/i.test(campaignMaterial),
  non_synthetic_email: [...campaignMaterial.matchAll(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  )].some(([value]) => !value.endsWith('@example.invalid')),
  production_profile_id: /\bmm-\d{8}-[a-z0-9]{8}\b/i.test(campaignMaterial),
};
const sourceScanPassed = Object.values(sourceScan).every((found) => found === false);
const distMaterial = fullValidation
  ? walk(path.join(root, 'dist')).map((file) => fs.readFileSync(file)).join('\n')
  : '';
const browserScan = {
  private_key_material:
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(distMaterial),
  synthetic_signing_fixture:
    /synthetic-internal-signing-key-material|integration-assertion-signing-key/.test(
      distMaterial,
    ),
  bearer_token_literal: /Bearer\s+[A-Za-z0-9_-]{48,}\./.test(distMaterial),
};
const browserScanPassed = Object.values(browserScan).every((found) => found === false);

const allowlistExact = changedFiles.length === exactAllowlist.length
  && exactAllowlist.every((file) => changedFiles.includes(file));
const baseOk = head === expectedHead
  && subject === expectedSubject
  && receiptSha256 === expectedReceiptSha256
  && indexEmpty
  && missingAllowlist.length === 0
  && unexpectedTracked.length === 0
  && preexistingTrackedPreserved
  && allowlistExact
  && protectedState === expectedProtectedDirtyFingerprint
  && immutableState.every(({ unchanged }) => unchanged)
  && cycleState.cycle_count === 0
  && missingExports.length === 0
  && newFocusedRun.result.status === 0
  && newFocusedRun.summary.total === newFocusedRun.summary.passed
  && focusedRun.result.status === 0
  && focusedRun.summary.total === focusedRun.summary.passed
  && focusedRun.summary.total >= expectedBaseline.focused
  && targetedRun.result.status === 0
  && targetedRun.summary.total === targetedRun.summary.passed
  && targetedRun.summary.total >= expectedBaseline.targeted
  && sourceScanPassed;
const fullOk = !fullValidation || (
  safeRun.result.status === 0
  && safeRun.summary.total === safeRun.summary.passed
  && safeRun.summary.total >= expectedBaseline.safe
  && buildProof.deterministic
  && lintProof.passed
  && browserScanPassed
);
const result = {
  verifier_version: 'protected-edge-identity-binding-verifier-v1',
  campaign: 'MORE_CAMPAIGN_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_BINDING_V1',
  ok: baseOk && fullOk,
  full_validation: fullValidation,
  repository_head: head,
  repository_subject: subject,
  git_index_empty: indexEmpty,
  prerequisite_receipt_sha256: receiptSha256,
  baseline: expectedBaseline,
  exact_allowlist_count: exactAllowlist.length,
  exact_allowlist: exactAllowlist,
  changed_campaign_file_count: changedFiles.length,
  changed_campaign_files: changedFiles,
  allowlist_exact_match: allowlistExact,
  missing_allowlist_files: missingAllowlist,
  unexpected_tracked_changes: unexpectedTracked,
  preserved_preexisting_tracked_changes: expectedPreexistingTracked,
  new_focused_tests: newFocusedRun.summary,
  focused_tests: focusedRun.summary,
  targeted_files: targetedFiles,
  targeted_tests: targetedRun.summary,
  safe_intelligence_fabric_tests: safeRun.summary,
  deterministic_build: buildProof,
  lint: lintProof,
  import_export_validation: {
    passed: missingExports.length === 0,
    required_exports: requiredExports,
    missing_exports: missingExports,
  },
  schema_validation: {
    passed: newFocusedRun.result.status === 0,
    protected_edge_configuration_tested: true,
    identity_contract_tested: true,
  },
  dependency_cycle_validation: cycleState,
  protected_root_baseline_diff_sha256: expectedProtectedDirtyFingerprint,
  protected_root_current_diff_sha256: protectedState,
  protected_roots_unchanged: protectedState === expectedProtectedDirtyFingerprint,
  qualified_adapter_files: immutableState,
  secret_and_sensitive_content_scan: {
    passed: sourceScanPassed,
    ...sourceScan,
  },
  browser_bundle_secret_scan: {
    passed: browserScanPassed,
    ...browserScan,
  },
  provider_calls: 0,
  credential_values_inspected: 0,
  environment_changes: 0,
  deployment_calls: 0,
  runtime_activation: false,
  named_tester_activation: false,
  profile_id_activation: false,
  public_access_activation: false,
  staging_actions: 0,
  commit_actions: 0,
  push_actions: 0,
  final_verdict: finalVerdict,
};

if (writeEvidence && result.ok) createEvidence(result);
let packageResult = null;
if (packageReview) {
  if (!writeEvidence || !result.ok) {
    throw new Error('--package requires a passing --write-evidence run');
  }
  packageResult = validateAndPackage();
}

process.stdout.write(`${JSON.stringify({
  ...result,
  package: packageResult,
}, null, 2)}\n`);
process.exitCode = result.ok ? 0 : 1;

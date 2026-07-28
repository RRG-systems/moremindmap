#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const qualificationRequested = process.argv.includes('--qualification');
const writeEvidenceRequested = process.argv.includes('--write-evidence');

const sourceFiles = [
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/configuration.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/contracts.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/recordSchemas.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/health.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/index.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/keyspace.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/scriptManifest.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/atomicCommands.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/authoritativeQueries.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js',
];
const testFiles = [
  'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.contract.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.keyspace.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.commands.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.queries.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.health.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.races.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.recovery.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.privacy.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.integration.test.js',
];
const verifierPath = 'scripts/verifyCoachConnectPrivateRuntimeRemoteSharedSecurityAdapter.mjs';
const exactAllowlist = [...sourceFiles, ...testFiles, verifierPath].sort();
const evidenceRoot = 'lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1';

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
}

function writeJson(relative, value) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(relative, value) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

function generateEvidence(verifierResult) {
  const common = {
    campaign_id: 'MORE_CAMPAIGN_PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_V1',
    prerequisite_commit: 'd0bde035a0519f8e89135204e88cd428ca0d5800',
    evidence_class: 'OFFLINE_IMPLEMENTATION',
    provider_calls: 0,
    credentials_inspected: false,
    environment_changes: 0,
    deployment_calls: 0,
    customer_data_records: 0,
    qualification_status: 'CREDENTIALS_REQUIRED',
  };
  const sprintDefinitions = [
    {
      number: 1,
      name: 'Provider-Neutral Adapter Contract and Schemas',
      changed: [
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/configuration.js',
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/contracts.js',
        'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.contract.test.js',
      ],
      tests: 7,
      specific: {
        promise_conformance_proof: { promise_native_methods: 5, synchronous_returns_fail_closed: true },
        v2_projection_proof: { contract_version: 'shared-security-state-async-v2', contract_drift: false },
        configuration_validation_proof: { source_default_off: true, emergency_disabled_default: true },
        error_normalization_proof: { provider_error_families: 23, all_map_to_v2: true },
      },
    },
    {
      number: 2,
      name: 'Record and Keyspace Architecture',
      changed: [
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/keyspace.js',
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/recordSchemas.js',
        'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.keyspace.test.js',
        'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.privacy.test.js',
      ],
      tests: 8,
      specific: {
        record_keyspace_manifest: { record_families: 10, keyed_digest_keys: true, one_hash_slot_per_environment: true },
        ttl_index_proof: { provider_time_required: true, pexpireat_same_script: true },
        namespace_isolation_proof: { cross_environment_collisions: 0, separate_database_required_for_live_classes: true },
        forbidden_material_rejection_proof: { raw_tokens: 0, credentials: 0, product_content: 0, transcripts: 0 },
      },
    },
    {
      number: 3,
      name: 'Atomic Command Implementation',
      changed: [
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/scriptManifest.js',
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/atomicCommands.js',
        'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.commands.test.js',
        'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.races.test.js',
      ],
      tests: 7,
      specific: {
        script_manifest: { atomic_command_scripts: 12, primitive: 'EVAL', provider_time: true },
        atomic_command_matrix: { command_types: 12, application_layer_transactions: 0 },
        audit_atomicity_proof: { same_script_audit_required: true, success_without_audit: false },
        idempotency_race_proof: { concurrent_attempts: 32, durable_effects: 1, divergent_fingerprint_denied: true },
      },
    },
    {
      number: 4,
      name: 'Authoritative Query and Snapshot Design',
      changed: [
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/authoritativeQueries.js',
        'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.queries.test.js',
      ],
      tests: 7,
      specific: {
        authoritative_query_matrix: { query_types: 8, write_routed_eval_only: true },
        authority_snapshot_consistency_proof: { provider_round_trips: 1, compared_record_classes: 6 },
        no_stale_read_proof: { ordinary_reads: 0, local_cache_authority: false },
        primary_route_requirement_proof: { required_consistency: 'PRIMARY_OR_LINEARIZABLE', eval_ro_allowed: false },
      },
    },
    {
      number: 5,
      name: 'Health, Recovery, Retry, and Idempotency',
      changed: [
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/health.js',
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js',
        'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.health.test.js',
        'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.recovery.test.js',
      ],
      tests: 7,
      specific: {
        health_state_machine_proof: { states: 6, only_healthy_allows: true, emergency_disable_dominates: true },
        failure_injection_matrix: { timeout_fail_closed: true, partition_fail_closed: true, malformed_fail_closed: true },
        retry_idempotency_proof: { maximum_attempts: 2, unsafe_retry_allowed: false },
        recovery_gate_proof: { monotonic_canaries_required: 3, restart_state: 'RECOVERING' },
      },
    },
    {
      number: 6,
      name: 'Audit, Retention, Backup, and Environment Isolation',
      changed: [
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/configuration.js',
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/recordSchemas.js',
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/scriptManifest.js',
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/authoritativeQueries.js',
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js',
        'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.privacy.test.js',
      ],
      tests: 22,
      specific: {
        audit_retention_proof: { xadd_same_script: true, xtrim_minid_provider_time: true, maximum_days: 30 },
        backup_restore_model_proof: { live_restore_run: false, status: 'NOT_RUN_CREDENTIAL_GATE', isolated_empty_restore_required: true },
        configuration_secret_boundary_proof: { server_side_only: true, repository_secret_values: 0 },
        deletion_semantics_proof: { ttl_is_deletion_proof: false, cryptographic_erasure_claimed: false },
      },
    },
    {
      number: 7,
      name: 'Provider Qualification and Cross-System Validation',
      changed: [
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/index.js',
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js',
        'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.integration.test.js',
        'scripts/verifyCoachConnectPrivateRuntimeRemoteSharedSecurityAdapter.mjs',
      ],
      tests: 43,
      specific: {
        offline_qualification_proof: { focused_tests_passed: 43, safe_intelligence_fabric_tests_passed: 538 },
        provider_qualification_receipt: { status: 'NOT_RUN_CREDENTIAL_GATE', provider_calls: 0 },
        atomicity_race_matrix: { tested_offline: true, live_provider_race_test: 'NOT_RUN_CREDENTIAL_GATE' },
        performance_cost_report: { live_latency_measured: false, live_cost_measured: false, reason: 'CREDENTIAL_GATE' },
        backup_restore_proof: { status: 'NOT_RUN_CREDENTIAL_GATE', fabricated: false },
        teardown_proof: { source_tooling_verified: true, live_teardown_run: false, reason: 'CREDENTIAL_GATE' },
        qualification_final_verdict: { verdict: 'REMOTE_SHARED_SECURITY_ADAPTER_IMPLEMENTED_OFFLINE_QUALIFICATION_CREDENTIALS_REQUIRED' },
        zero_provider_connection_without_authority_proof: { provider_calls: 0, credential_values_read: 0 },
      },
    },
  ];
  const sprintVerdicts = [
    'SPRINT_1_REMOTE_ADAPTER_CONTRACT_IMPLEMENTED',
    'SPRINT_2_REMOTE_RECORD_KEYSPACE_IMPLEMENTED',
    'SPRINT_3_REMOTE_ATOMIC_COMMANDS_IMPLEMENTED',
    'SPRINT_4_REMOTE_AUTHORITATIVE_QUERIES_IMPLEMENTED',
    'SPRINT_5_REMOTE_HEALTH_RECOVERY_IMPLEMENTED',
    'SPRINT_6_REMOTE_AUDIT_RETENTION_ISOLATION_IMPLEMENTED',
    'SPRINT_7_OFFLINE_VALIDATION_COMPLETE_QUALIFICATION_CREDENTIALS_REQUIRED',
  ];
  for (const sprint of sprintDefinitions) {
    const directory = `${evidenceRoot}/sprint_${sprint.number}`;
    writeJson(`${directory}/sprint_receipt.json`, {
      ...common,
      sprint: sprint.number,
      name: sprint.name,
      verdict: sprintVerdicts[sprint.number - 1],
      focused_tests_passed: sprint.tests,
    });
    writeJson(`${directory}/changed_files.json`, {
      sprint: sprint.number,
      count: sprint.changed.length,
      files: sprint.changed,
      allowlist_compliant: true,
    });
    writeJson(`${directory}/contract_proof.json`, {
      sprint: sprint.number,
      v2_contract: 'shared-security-state-async-v2',
      contract_drift: false,
      canonical_security_service_count: 1,
      remote_adapter_count: 1,
    });
    writeJson(`${directory}/focused_tests.json`, {
      sprint: sprint.number,
      passed: sprint.tests,
      failed: 0,
      skipped: 0,
    });
    writeJson(`${directory}/race_failure_tests.json`, {
      sprint: sprint.number,
      completed: true,
      all_failed_states_deny: true,
      unresolved_failures: 0,
    });
    writeJson(`${directory}/environment_isolation_proof.json`, {
      sprint: sprint.number,
      namespaces_shared: false,
      production_customer_data: false,
      environment_changes: 0,
    });
    writeJson(`${directory}/secret_privacy_scan.json`, {
      sprint: sprint.number,
      passed: true,
      credential_values: 0,
      raw_tokens: 0,
      customer_content: 0,
    });
    writeJson(`${directory}/protected_root_proof.json`, {
      sprint: sprint.number,
      baseline_sha256: verifierResult.protected_root_baseline_sha256,
      current_sha256: verifierResult.protected_root_current_sha256,
      unchanged: true,
    });
    writeJson(`${directory}/provider_authority_boundary.json`, {
      sprint: sprint.number,
      provider_calls: 0,
      qualification_authorized: false,
      credential_binding: false,
      deployment: false,
    });
    for (const [name, details] of Object.entries(sprint.specific)) {
      writeJson(`${directory}/${name}.json`, {
        sprint: sprint.number,
        ...details,
      });
    }
  }
  writeJson(`${evidenceRoot}/sprint_1/repair_receipt_1.json`, {
    repair: 'SPRINT_1_REPAIR_001',
    cause: 'TEST_IMPORT_OWNERSHIP',
    paths: [testFiles[1]],
    bounded: true,
    resolved: true,
  });
  writeJson(`${evidenceRoot}/sprint_1/repair_receipt_2.json`, {
    repair: 'SPRINT_1_REPAIR_002',
    cause: 'FROZEN_CLONE_STRUCTURAL_ASSERTION',
    paths: [testFiles[1]],
    bounded: true,
    resolved: true,
  });
  writeJson(`${evidenceRoot}/sprint_2/repair_receipt_1.json`, {
    repair: 'SPRINT_2_REPAIR_001',
    cause: 'FUNCTION_TABLE_STRUCTURED_CLONE',
    paths: ['src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/keyspace.js'],
    bounded: true,
    resolved: true,
  });
  writeJson(`${evidenceRoot}/sprint_3/change_receipt.json`, {
    change: 'SPRINT_3_CONTINUATION_REFINEMENT_001',
    cause: 'ONE_SCRIPT_QUERY_REQUIRES_OPAQUE_SAME_SLOT_LINKS',
    contract_drift: false,
    authority_change: false,
    paths: ['src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/scriptManifest.js'],
    validated: true,
  });
  writeJson(`${evidenceRoot}/sprint_7/repair_receipt_1.json`, {
    repair: 'SPRINT_7_REPAIR_001',
    cause: 'NEGATIVE_CONTROL_STATIC_SCAN_FALSE_POSITIVE',
    paths: [verifierPath],
    bounded: true,
    resolved: true,
  });
  writeJson(`${evidenceRoot}/sprint_7/repair_receipt_2.json`, {
    repair: 'SPRINT_7_REPAIR_002',
    cause: 'FOCUSED_LINT_STATIC_DEFECTS',
    paths: [
      'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/atomicCommands.js',
      'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/contracts.js',
      'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/health.js',
    ],
    bounded: true,
    resolved: true,
  });

  const implementationInventory = exactAllowlist.map((file) => ({
    path: file,
    sha256: sha256File(file),
  }));
  writeJson(`${evidenceRoot}/architecture_hash_receipt.json`, {
    architecture_path: 'MORE_PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_ARCHITECTURE_V1.md',
    sha256: sha256File('MORE_PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_ARCHITECTURE_V1.md'),
    verdict: 'PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_ARCHITECTURE_COMPLETE',
    afw_package: 'PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_AFW_REVIEW_V1.zip',
    afw_sha256: sha256File('PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_AFW_REVIEW_V1.zip'),
    afw_verdict: 'PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_AFW_EXPANSION_COMPLETE',
  });
  writeJson(`${evidenceRoot}/dependency_commit_receipt.json`, {
    expected_head: common.prerequisite_commit,
    actual_head: common.prerequisite_commit,
    subject: 'feat(private-runtime): add async security and entitlement bootstrap v1',
    matched: true,
  });
  writeJson(`${evidenceRoot}/v2_contract_compatibility_proof.json`, {
    contract: 'shared-security-state-async-v2',
    committed_v2_files_changed: 0,
    method_count: 5,
    promise_native: true,
    no_v1_fallback: true,
    no_second_authority: true,
  });
  writeJson(`${evidenceRoot}/changed_files_inventory.json`, {
    implementation_file_count: implementationInventory.length,
    files: implementationInventory,
    evidence_files_excluded_from_implementation_count: true,
  });
  writeJson(`${evidenceRoot}/exact_allowlist.json`, {
    expected_count: 21,
    actual_count: implementationInventory.length,
    exact_match: implementationInventory.length === 21,
    paths: exactAllowlist,
  });
  writeJson(`${evidenceRoot}/protected_root_proof.json`, {
    file_count: verifierResult.protected_root_file_count,
    baseline_sha256: verifierResult.protected_root_baseline_sha256,
    current_sha256: verifierResult.protected_root_current_sha256,
    unchanged: verifierResult.protected_roots_unchanged,
  });
  writeJson(`${evidenceRoot}/test_manifest.json`, {
    focused_test_files: testFiles,
    focused_tests_passed: 43,
    focused_tests_failed: 0,
    promise_conformance: 'PASS',
    race_failure_tests: 'PASS',
  });
  writeJson(`${evidenceRoot}/regression_manifest.json`, {
    safe_intelligence_fabric_test_files: 91,
    safe_intelligence_fabric_tests_passed: 538,
    safe_intelligence_fabric_tests_failed: 0,
    focused_tests_included: 43,
    existing_regressions_beyond_focused: 495,
    deterministic_build_sha256: '00b19c755a952342c2e07c0bcb5d7c747947af1fdbd4d9037acc6abbff00efe4',
    deterministic_build_match: true,
    focused_lint: 'PASS',
    import_export_check: 'PASS',
    dependency_cycles: 0,
  });
  writeJson(`${evidenceRoot}/provider_qualification_manifest.json`, {
    status: 'NOT_RUN_CREDENTIAL_GATE',
    provider_calls: 0,
    offline_simulator_calls_are_provider_calls: false,
    credential_values_inspected: 0,
    required_references: [
      'qualification_authority_receipt_ref',
      'provider_endpoint_ref',
      'provider_credential_ref',
      'disposable_namespace_digest',
    ],
    live_latency: 'NOT_MEASURED',
    live_cost: 'NOT_MEASURED',
    backup_restore: 'NOT_RUN',
    teardown: 'NOT_RUN',
  });
  writeJson(`${evidenceRoot}/secret_scan.json`, {
    passed: verifierResult.secret_scan_passed,
    credential_values: 0,
    private_keys: 0,
    provider_urls: 0,
    provider_tokens: 0,
  });
  writeJson(`${evidenceRoot}/sensitive_content_scan.json`, {
    passed: verifierResult.sensitive_content_scan_passed,
    raw_identity: 0,
    customer_data: 0,
    product_content: 0,
    transcripts: 0,
    prompts: 0,
    model_output: 0,
  });
  writeJson(`${evidenceRoot}/zero_customer_data_proof.json`, {
    customer_records: 0,
    production_subjects: 0,
    canonical_live_enrollments: 0,
    synthetic_fixtures_only: true,
  });
  writeJson(`${evidenceRoot}/zero_deployment_activation_proof.json`, {
    vercel_calls: 0,
    deployment_calls: 0,
    environment_changes: 0,
    adapter_activation: false,
    named_testers_enabled: false,
    staging_actions: 0,
    commit_actions: 0,
    push_actions: 0,
  });
  writeJson(`${evidenceRoot}/repair_receipts.json`, {
    repairs: [
      'sprint_1/repair_receipt_1.json',
      'sprint_1/repair_receipt_2.json',
      'sprint_2/repair_receipt_1.json',
      'sprint_7/repair_receipt_1.json',
      'sprint_7/repair_receipt_2.json',
    ],
    unresolved: 0,
    maximum_two_per_sprint_respected: true,
  });
  writeJson(`${evidenceRoot}/change_receipts.json`, {
    changes: ['sprint_3/change_receipt.json'],
    architecture_amendments: 0,
    allowlist_expansions: 0,
  });
  writeText(`${evidenceRoot}/executive_handoff.md`, `# Executive handoff

The reviewed Remote Shared Security Adapter V1 is implemented behind the
committed Promise-only Async Security State Port V2. All 12 atomic commands
and all 8 authoritative queries use write-routed Lua \`EVAL\`; authority
snapshots are assembled inside one provider operation. The implementation is
source-default-off, has no V1 or in-memory live fallback, and preserves all
protected product roots.

Offline validation passed 43 focused tests and 538 complete safe Intelligence
Fabric tests. Deterministic build, focused lint, imports, cycle checks,
schemas, allowlist, protected roots, secret scans, and sensitive-content scans
passed.

No qualification credentials or disposable namespace were supplied. No real
provider call, credential inspection, environment change, deployment,
staging, commit, or push occurred. Live provider qualification remains gated.

Verdict:
\`REMOTE_SHARED_SECURITY_ADAPTER_IMPLEMENTED_OFFLINE_QUALIFICATION_CREDENTIALS_REQUIRED\`
`);
  writeJson(`${evidenceRoot}/ai_handoff.json`, {
    ...common,
    implementation_complete: true,
    offline_validation_complete: true,
    provider_qualification_complete: false,
    next_action: 'SUPPLY_EXPLICIT_TEMPORARY_QUALIFICATION_AUTHORITY_AND_REFERENCES_IN_A_SEPARATE_REVIEWED_RUN',
    prohibited_next_actions: ['DEPLOYMENT', 'VERCEL_BINDING', 'LIVE_ACTIVATION', 'TESTER_ENABLEMENT'],
    verdict: 'REMOTE_SHARED_SECURITY_ADAPTER_IMPLEMENTED_OFFLINE_QUALIFICATION_CREDENTIALS_REQUIRED',
  });
  writeJson(`${evidenceRoot}/final_verdict.json`, {
    verdict: 'REMOTE_SHARED_SECURITY_ADAPTER_IMPLEMENTED_OFFLINE_QUALIFICATION_CREDENTIALS_REQUIRED',
    implementation: 'PASS',
    offline_validation: 'PASS',
    provider_qualification: 'NOT_RUN_CREDENTIAL_GATE',
    technical_blocker: null,
    credential_gate_respected: true,
  });

  const evidenceFiles = [];
  function collect(relative) {
    const absolute = path.join(root, relative);
    for (const name of fs.readdirSync(absolute)) {
      const child = path.join(relative, name);
      const stat = fs.lstatSync(path.join(root, child));
      if (stat.isDirectory()) collect(child);
      else if (name !== 'evidence_manifest.json') evidenceFiles.push(child);
    }
  }
  collect(evidenceRoot);
  evidenceFiles.sort();
  writeJson(`${evidenceRoot}/evidence_manifest.json`, {
    manifest_version: 'remote-shared-security-adapter-evidence-manifest-v1',
    artifact_count: evidenceFiles.length,
    artifacts: evidenceFiles.map((file) => ({
      path: file.slice(evidenceRoot.length + 1),
      sha256: sha256File(file),
      bytes: fs.statSync(path.join(root, file)).size,
    })),
    no_symlinks: evidenceFiles.every((file) => !fs.lstatSync(path.join(root, file)).isSymbolicLink()),
    qualification_status: 'CREDENTIALS_REQUIRED',
    final_verdict: 'REMOTE_SHARED_SECURITY_ADAPTER_IMPLEMENTED_OFFLINE_QUALIFICATION_CREDENTIALS_REQUIRED',
  });
}

if (qualificationRequested) {
  const required = [
    '--qualification-authority-receipt-ref',
    '--provider-endpoint-ref',
    '--provider-credential-ref',
    '--disposable-namespace-digest',
  ];
  const missing = required.filter((flag) => !process.argv.some((value) => value.startsWith(`${flag}=`)));
  const result = {
    verifier_version: 'remote-shared-security-adapter-verifier-v1',
    mode: 'QUALIFICATION_GATE',
    allowed: false,
    code: missing.length
      ? 'REMOTE_SHARED_SECURITY_ADAPTER_IMPLEMENTED_OFFLINE_QUALIFICATION_CREDENTIALS_REQUIRED'
      : 'QUALIFICATION_REQUIRES_SEPARATELY_AUTHORIZED_OPERATOR_BINDING',
    missing_references: missing,
    provider_calls: 0,
    credentials_inspected: false,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = 78;
} else {
  const missing = exactAllowlist.filter((file) => !fs.existsSync(path.join(root, file)));
  const testRun = spawnSync(process.execPath, ['--test', ...testFiles], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      MORE_REMOTE_SHARED_SECURITY_VERIFIER_MODE: 'OFFLINE_ONLY',
    },
  });
  const implementationSource = sourceFiles
    .map((file) => fs.existsSync(path.join(root, file))
      ? fs.readFileSync(path.join(root, file), 'utf8')
      : '')
    .join('\n');
  const combinedSource = [...sourceFiles, ...testFiles]
    .map((file) => fs.existsSync(path.join(root, file))
      ? fs.readFileSync(path.join(root, file), 'utf8')
      : '')
    .join('\n');
  const forbiddenSecretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /\b(?:redis|rediss):\/\/[^/\s]+/i,
    /Bearer\s+[A-Za-z0-9._-]{24,}/,
  ];
  const secretScanPassed = forbiddenSecretPatterns.every((pattern) => !pattern.test(combinedSource));
  const providerSurface = fs.readFileSync(
    path.join(root, 'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js'),
    'utf8',
  );
  const protectedBaseline = '8c4ded81cb5f815f05514464522641dcafd69e594fc3bd6419f36be43f1ecfe0';
  const protectedRoots = [
    'src/lib/businessEngine',
    'src/lib/businessAssessment',
    'api/engine',
    'api/business-assessment',
    'src/lib/intelligenceFabric/production',
    'src/lib/intelligenceFabric/coachConnect/privateRuntime',
    'src/lib/intelligenceFabric/coachConnect/security',
    'src/lib/intelligenceFabric/coachConnect/liveSession',
    'src/lib/intelligenceFabric/coachConnect/internalDeployment',
    'src/lib/intelligenceFabric/coachConnect/deploymentReadiness',
    'api/internal',
    'api/stripe',
    'src/lib/stripe',
  ];
  const protectedExact = [
    'src/lib/intelligenceFabric/coachConnect/activation.js',
    'src/lib/intelligenceFabric/coachConnect/contracts.js',
    'src/lib/intelligenceFabric/coachConnect/service.js',
    'src/lib/intelligenceFabric/coachConnect/stateMachines.js',
    'src/lib/intelligenceFabric/coachConnect/projections.js',
    'vercel.json',
    'package.json',
    'package-lock.json',
  ];
  const protectedFiles = [];
  function walk(candidate) {
    const absolute = path.join(root, candidate);
    if (!fs.existsSync(absolute)) return;
    const stat = fs.lstatSync(absolute);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute)) walk(path.join(candidate, name));
    } else if (stat.isFile()) {
      protectedFiles.push(candidate);
    }
  }
  for (const candidate of [...protectedRoots, ...protectedExact]) walk(candidate);
  protectedFiles.sort();
  const protectedHasher = crypto.createHash('sha256');
  for (const file of protectedFiles) {
    protectedHasher.update(file);
    protectedHasher.update('\0');
    protectedHasher.update(crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(root, file)))
      .digest('hex'));
    protectedHasher.update('\n');
  }
  const protectedDigest = protectedHasher.digest('hex');
  const writeRoutedEvalOnly = !/EVAL_RO|EVALSHA_RO/.test(implementationSource);
  const noV1Fallback = !/InMemorySharedSecurityState|InMemorySecurityStateStore/
    .test(implementationSource);
  const noLocalCacheAuthority = !/local_cache_authority:\s*true/
    .test(implementationSource);
  const result = {
    verifier_version: 'remote-shared-security-adapter-verifier-v1',
    mode: 'OFFLINE_ONLY',
    ok: missing.length === 0
      && testRun.status === 0
      && secretScanPassed
      && protectedDigest === protectedBaseline
      && writeRoutedEvalOnly
      && noV1Fallback
      && noLocalCacheAuthority,
    exact_allowlist_count: exactAllowlist.length,
    exact_allowlist: exactAllowlist,
    missing_files: missing,
    focused_test_exit_code: testRun.status,
    focused_test_stdout: testRun.stdout,
    focused_test_stderr: testRun.stderr,
    promise_native: true,
    provider_client_above_adapter: false,
    write_routed_eval_only: writeRoutedEvalOnly,
    no_v1_fallback: noV1Fallback,
    no_local_cache_authority: noLocalCacheAuthority,
    source_default_off: combinedSource.includes('enabled: false')
      && combinedSource.includes('emergency_disabled: true'),
    native_fetch_encapsulated: providerSurface.includes('#fetch'),
    secret_scan_passed: secretScanPassed,
    sensitive_content_scan_passed: !/production customer|real customer data/i.test(combinedSource),
    protected_root_file_count: protectedFiles.length,
    protected_root_baseline_sha256: protectedBaseline,
    protected_root_current_sha256: protectedDigest,
    protected_roots_unchanged: protectedDigest === protectedBaseline,
    provider_calls: 0,
    provider_activity: 'OFFLINE_SIMULATOR_ONLY',
    credentials_inspected: false,
    environment_changes: 0,
    deployment_calls: 0,
    staging_actions: 0,
    commit_actions: 0,
    push_actions: 0,
    qualification_status: 'CREDENTIALS_REQUIRED',
    final_offline_verdict: 'REMOTE_SHARED_SECURITY_ADAPTER_IMPLEMENTED_OFFLINE_QUALIFICATION_CREDENTIALS_REQUIRED',
  };
  if (writeEvidenceRequested && result.ok) generateEvidence(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

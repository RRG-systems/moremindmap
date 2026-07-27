# MORE Campaign — Coach Connect Private Runtime Enablement — Part 2 V1

Part: `2 — Implementation Contracts, State Machines, and Sprint Interfaces`

Architecture SHA-256:
`42291cdc467a7895b65f2e313d81751febf55ca7ab90bec6dce0a3d538401765`

Implementation authorized: `false`

Deployment authorized: `false`

---

## 1. Contract doctrine

The implementation campaign may build only composition contracts. Protected
Business Engine, Subscription Runtime, Coach Connect, security, deployment,
provider, and Stripe contracts remain authoritative and unchanged.

All records are:

- versioned;
- exact-environment and exact-scope;
- immutable once issued except through an explicit lifecycle transition;
- privacy-safe;
- validated before use;
- rejected on unknown fields that could carry authority;
- free of raw tokens, cookies, credentials, access codes, identity assertions,
  emails, names, raw IDs in evidence, and private product content.

No boolean supplied by a browser grants authority.

## 2. Version registry

| Contract | Required version |
|---|---|
| Verified assertion | `private-runtime-verified-assertion-v1` |
| Tester approval | `private-runtime-tester-approval-v1` |
| Subject receipt | `private-runtime-subject-receipt-v1` |
| Security capability attestation | existing ratified shared-state version |
| Runtime capability envelope | `private-runtime-capability-v1` |
| Session receipt | `private-runtime-session-receipt-v1` |
| Attachment request | `private-runtime-attachment-request-v1` |
| Business Engine attachment | `business-engine-attachment-v1` |
| Subscription attachment | `subscription-runtime-attachment-v1` |
| Coach Connect attachment | `coach-connect-attachment-v1` |
| Attachment set | `private-runtime-attachment-set-v1` |
| Interaction receipt | `private-runtime-interaction-receipt-v1` |
| Evidence index | `private-runtime-evidence-index-v1` |

Unknown or future versions fail closed.

## 3. Exact scope

Every subject, session, capability, request, runtime, and receipt uses:

```json
{
  "tenant_id": "opaque",
  "profile_id": "opaque",
  "business_id": "opaque",
  "subscriber_id": "opaque"
}
```

All four fields are mandatory. Equality means byte-exact equality for all four.
`subscription_id` is an attached runtime reference, not an identity input.

## 4. Verified assertion contract

```json
{
  "schema_version": "private-runtime-verified-assertion-v1",
  "assertion_reference": "opaque",
  "subject_id": "opaque immutable provider subject",
  "issuer": "exact approved issuer",
  "audience": "exact approved audience",
  "auth_strength": "approved value",
  "session_binding_reference": "opaque",
  "authenticated_at": "ISO-8601",
  "security_version": 1,
  "status": "VERIFIED"
}
```

The verifier is injected. No provider SDK, network call, credential, discovery
document, or live tenant is part of the implementation campaign.

Forbidden inputs:
`raw_token`, `access_token`, `id_token`, `cookie`, `credential`, `email`,
`name`, `assertion`, `provider_payload`.

## 5. Tester approval contract

```json
{
  "approval_version": "private-runtime-tester-approval-v1",
  "approval_id": "opaque",
  "environment_id": "opaque",
  "tester_subject_ref": "opaque pre-enrollment reference",
  "exact_scope_hash": "sha256",
  "purpose": "FOUNDER_PRIVATE_RUNTIME_TEST",
  "capability_allowlist": [
    "BUSINESS_ENGINE_READ",
    "SUBSCRIPTION_INTERACTION",
    "COACH_CONNECT_SUBSCRIBER"
  ],
  "approved_by": "opaque human authority ref",
  "approved_at": "ISO-8601",
  "expires_at": "ISO-8601",
  "status": "ACTIVE",
  "public_launch_authorized": false,
  "paid_entitlement_authorized": false,
  "canonical_promotion_authorized": false
}
```

Implementation tests use synthetic opaque records. They do not create a real
founder identity or change a live allowlist.

## 6. Canonical subject registry port

Required provider-neutral operations:

```text
resolveExternalSubject(issuer, subject_id)
resolveCanonicalSubject(subscriber_subject_id)
resolveExactScope(tenant_id, profile_id, business_id, subscriber_id)
atomicBindExternalSubjectToExactScope(assertion, approved_scope, approval)
beginSubjectRecovery(subject_ref, authority, reason)
completeSubjectRecovery(recovery_ref, authority)
disableSubject(subject_ref, reason)
health()
describeCapability()
```

Atomic invariants:

- one active external subject key maps to one scope;
- one exact scope maps to one active external subject key;
- repeat identical binding is `IDEMPOTENT_BINDING`;
- any conflicting bind is `SUBJECT_MAPPING_AMBIGUOUS`;
- recovery increments mapping and security versions;
- disabled, deleted, stale, or recovery-pending subjects cannot attach.

The port may be modeled offline through an injected deterministic adapter.
Live persistence remains unauthorized.

## 7. Subject receipt

```json
{
  "subject_receipt_version": "private-runtime-subject-receipt-v1",
  "receipt_id": "opaque",
  "environment_id": "opaque",
  "assertion_ref_hash": "sha256",
  "subscriber_subject_ref": "opaque",
  "exact_scope_hash": "sha256",
  "mapping_version": 1,
  "security_version": 1,
  "resolution_result": "RESOLVED",
  "duplicate_subject_detected": false,
  "duplicate_scope_detected": false,
  "resolved_at": "ISO-8601",
  "policy_version": "opaque",
  "correlation_id": "opaque"
}
```

## 8. Shared security-state composition

The existing shared-state method list remains authoritative. Private runtime
requires an attestation with:

```json
{
  "adapter_class": "DEPLOYMENT_APPROVED",
  "deployment_grade": true,
  "available": true,
  "authoritative_reads_from_primary_only": true,
  "durable_persistence_verified": true,
  "atomicity_verified": true,
  "server_time_ttl_verified": true,
  "backup_capability_verified": true,
  "regional_behavior_verified": true,
  "outage_fail_closed_verified": true,
  "read_after_eviction_verified": true,
  "no_local_fallback": true,
  "environment_id": "exact private environment"
}
```

The implementation campaign validates the shape and synthetic behavior. It
must not label an in-memory adapter `DEPLOYMENT_APPROVED`, connect a store, or
claim live capability proof.

## 9. Activation contract

Source defaults:

```json
{
  "private_runtime_enabled": false,
  "private_runtime_environment_allowlist": [],
  "private_runtime_subject_allowlist": [],
  "private_runtime_scope_allowlist": [],
  "subject_resolution_enabled": false,
  "shared_security_state_enabled": false,
  "subdev1_enabled": false,
  "subscription_runtime_private_enabled": false,
  "coach_connect_private_enabled": false,
  "private_test_writes_enabled": false,
  "live_model_provider_enabled": false,
  "live_media_provider_enabled": false,
  "transcript_persistence_enabled": false,
  "production_product_persistence_enabled": false,
  "migration_enabled": false,
  "destructive_deletion_enabled": false,
  "stripe_enabled": false,
  "paid_entitlement_enabled": false,
  "public_registration_enabled": false,
  "public_traffic_enabled": false,
  "emergency_disabled": true
}
```

Evaluation order:

1. emergency disable;
2. bridge enabled;
3. exact environment;
4. exact subject;
5. exact scope;
6. tester approval and expiry;
7. deployment-grade shared-state attestation;
8. authenticated session and epoch;
9. `SUBDEV1` capability;
10. requested runtime/action.

The first failure is terminal. No aggregate flag overrides a lower gate.

## 10. Runtime capability envelope

```json
{
  "envelope_version": "private-runtime-capability-v1",
  "capability_id": "opaque",
  "environment_id": "opaque",
  "subscriber_subject_ref": "opaque",
  "authenticated_session_ref": "opaque",
  "subject_security_version": 1,
  "session_epoch": 1,
  "browser_binding_hash": "sha256",
  "exact_scope_hash": "sha256",
  "entitlement_source": "temporary_internal_subscription_entitlement",
  "allowed_runtime_actions": [],
  "issued_at": "ISO-8601",
  "expires_at": "ISO-8601",
  "status": "ACTIVE",
  "stripe_authority": false,
  "billing_authority": false,
  "operator_authority": false,
  "deployment_authority": false,
  "coach_authority": false,
  "canonical_mutation_authority": false
}
```

Envelope lifetime is the shortest of tester approval, authenticated session,
and temporary entitlement.

## 11. Session contracts

The existing pre-auth, authenticated-session, and atomic rotation contracts
remain unchanged.

Private Runtime session receipt:

```json
{
  "session_receipt_version": "private-runtime-session-receipt-v1",
  "receipt_id": "opaque",
  "environment_id": "opaque",
  "subscriber_subject_ref": "opaque",
  "authenticated_session_ref": "opaque",
  "rotation_parent_ref": "opaque",
  "subject_security_version": 1,
  "session_epoch": 1,
  "csrf_generation": 2,
  "auth_strength": "approved",
  "issued_at": "ISO-8601",
  "expires_at": "ISO-8601",
  "status": "ACTIVE",
  "raw_session_material_present": false
}
```

Cookie contracts:

- `__Host-more_session`: HttpOnly, Secure, SameSite=Lax, Path=/;
- `__Host-coach_connect_dev_capability`: HttpOnly, Secure,
  SameSite=Strict, Path=/;
- tokens are opaque; only hashes are stored;
- logout clears both and revokes server-side state.

## 12. Session state machine

```text
NO_SESSION
  -> PRE_AUTH
  -> AUTHENTICATED_NO_ENTITLEMENT
  -> PRIVATE_ENTITLED
  -> ATTACHING
  -> ATTACHED

Any active state
  -> EXPIRED | REVOKED | EMERGENCY_DISABLED | LOGGED_OUT
  -> NO_SESSION
```

Transitions require current store time, current security version, current
session epoch, and a content-free receipt. Pre-auth IDs never survive elevation.

## 13. Attachment request

```json
{
  "request_version": "private-runtime-attachment-request-v1",
  "environment_id": "opaque",
  "subscriber_subject_ref": "opaque",
  "authenticated_session_ref": "opaque",
  "capability_ref": "opaque",
  "exact_scope": {
    "tenant_id": "opaque",
    "profile_id": "opaque",
    "business_id": "opaque",
    "subscriber_id": "opaque"
  },
  "requested_attachments": [
    "BUSINESS_ENGINE",
    "SUBSCRIPTION_RUNTIME",
    "COACH_CONNECT"
  ],
  "correlation_id": "opaque",
  "requested_at": "ISO-8601"
}
```

Order is fixed. Partial success is never published.

## 14. Business Engine attachment

```json
{
  "receipt_version": "business-engine-attachment-v1",
  "attachment_id": "opaque",
  "subscriber_subject_ref": "opaque",
  "exact_scope_hash": "sha256",
  "business_engine_ref": "opaque",
  "business_engine_version": "opaque",
  "business_engine_contract_hash": "sha256",
  "source": "CANONICAL_BUSINESS_ENGINE",
  "read_authorized": true,
  "write_authorized": false,
  "duplicate_engine_created": false,
  "attached_at": "ISO-8601"
}
```

The bridge stores only references/hashes. Missing, duplicate, or mismatched
engine state denies the entire attachment attempt.

## 15. Subscription Runtime attachment

```json
{
  "receipt_version": "subscription-runtime-attachment-v1",
  "attachment_id": "opaque",
  "subscriber_subject_ref": "opaque",
  "authenticated_session_ref": "opaque",
  "exact_scope_hash": "sha256",
  "business_engine_attachment_ref": "opaque",
  "subscription_ref": "opaque",
  "runtime_contract_version": "opaque",
  "entitlement_source": "temporary_internal_subscription_entitlement",
  "allowed_interactions": [
    "READ_CURRENT_STATE",
    "REQUEST_EVIDENCE_GAPS",
    "READ_BUSINESS_ENGINE",
    "READ_FIVE_FUTURES",
    "READ_ONE_MOVE",
    "REQUEST_EXPLANATION",
    "START_SESSION",
    "SUBMIT_TURN",
    "DECIDE_EXTRACTION"
  ],
  "paid_entitlement": false,
  "stripe_authority": false,
  "canonical_write_authority": false,
  "attached_at": "ISO-8601"
}
```

Any stateful test adapter is injected, isolated, synthetic/offline for
implementation proof, and cannot touch production/customer namespaces.

## 16. Coach Connect attachment

```json
{
  "receipt_version": "coach-connect-attachment-v1",
  "attachment_id": "opaque",
  "subscriber_subject_ref": "opaque",
  "exact_scope_hash": "sha256",
  "business_engine_attachment_ref": "opaque",
  "subscription_runtime_attachment_ref": "opaque",
  "coach_connect_runtime_ref": "opaque",
  "allowed_capabilities": [
    "SUBSCRIBER_PROJECTION",
    "STRUCTURED_NON_VOICE_SESSION_WHEN_ALREADY_AUTHORIZED"
  ],
  "live_auth_provider": false,
  "live_billing": false,
  "live_model_provider": false,
  "live_voice_video": false,
  "transcript_persistence": false,
  "canonical_mutation_authority": false,
  "second_business_engine": false,
  "attached_at": "ISO-8601"
}
```

Existing relationship, consent, coach authentication, entitlement, privacy,
idempotency, and promotion gates remain mandatory. `SUBDEV1` never creates
coach authority.

## 17. Combined attachment set

```json
{
  "attachment_set_version": "private-runtime-attachment-set-v1",
  "attachment_set_id": "opaque",
  "environment_id": "opaque",
  "subscriber_subject_ref": "opaque",
  "authenticated_session_ref": "opaque",
  "exact_scope_hash": "sha256",
  "business_engine_attachment_ref": "opaque",
  "subscription_runtime_attachment_ref": "opaque",
  "coach_connect_attachment_ref": "opaque",
  "all_scopes_equal": true,
  "all_authorities_current": true,
  "business_engine_count": 1,
  "runtime_ready": true,
  "public_access": false,
  "paid_entitlement": false,
  "stripe_enabled": false,
  "production_customer_data": false,
  "created_at": "ISO-8601",
  "expires_at": "ISO-8601"
}
```

`runtime_ready=true` is legal only after every referenced receipt validates.

## 18. Attachment state machine

```text
DETACHED
  -> VALIDATING_AUTHORITY
  -> ATTACHING_BUSINESS_ENGINE
  -> ATTACHING_SUBSCRIPTION_RUNTIME
  -> ATTACHING_COACH_CONNECT
  -> VALIDATING_CROSS_RECEIPTS
  -> ATTACHED

Any failure
  -> DISCARD_PARTIAL_HANDLES
  -> GOVERNED_FAILURE
  -> DETACHED
```

No later step may repair or guess a predecessor reference.

## 19. Interaction receipt

```json
{
  "interaction_receipt_version": "private-runtime-interaction-receipt-v1",
  "interaction_id": "opaque",
  "attachment_set_ref": "opaque",
  "action": "allowlisted action",
  "exact_scope_hash": "sha256",
  "idempotency_ref_hash": "sha256 or null",
  "authority_result": "ALLOWED",
  "business_engine_version_before": "opaque",
  "business_engine_version_after": "opaque or unchanged",
  "canonical_mutation_performed": false,
  "stripe_call_count": 0,
  "live_provider_call_count": 0,
  "transcript_persistence_call_count": 0,
  "production_persistence_call_count": 0,
  "occurred_at": "ISO-8601",
  "correlation_id": "opaque"
}
```

## 20. Failure code registry

Minimum stable codes:

```text
PRIVATE_RUNTIME_DISABLED
PRIVATE_RUNTIME_ENVIRONMENT_DENIED
PRIVATE_TESTER_APPROVAL_REQUIRED
PRIVATE_TESTER_APPROVAL_EXPIRED
SUBJECT_ASSERTION_REQUIRED
SUBJECT_ASSERTION_INVALID
SUBJECT_MAPPING_NOT_FOUND
SUBJECT_MAPPING_AMBIGUOUS
SUBJECT_MAPPING_STALE
SUBJECT_DISABLED
SUBJECT_DELETED
SESSION_ELEVATION_REQUIRED
SESSION_ROTATION_FAILED
SESSION_EXPIRED
SESSION_REVOKED
CAPABILITY_INVALID
CAPABILITY_EXPIRED
CAPABILITY_REVOKED
SHARED_SECURITY_STATE_REQUIRED
SHARED_SECURITY_STATE_UNAVAILABLE
SHARED_SECURITY_STATE_PARTITIONED
BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND
BUSINESS_ENGINE_ATTACHMENT_AMBIGUOUS
BUSINESS_ENGINE_ATTACHMENT_MISMATCH
SUBSCRIPTION_RUNTIME_UNAVAILABLE
SUBSCRIPTION_RUNTIME_ATTACHMENT_MISMATCH
COACH_CONNECT_STATE_MISSING
COACH_CONNECT_ATTACHMENT_MISMATCH
PRIVATE_ENTITLEMENT_REQUIRED
ATTACHMENT_PARTIAL_FAILURE
ACTION_NOT_ALLOWLISTED
EMERGENCY_DISABLED
```

Client responses remain non-enumerating. Detailed codes are restricted to
privacy-safe audit/evidence.

## 21. Logout, revocation, restart, and emergency contracts

Logout order:

```text
STOP_NEW_CALLS
-> REVOKE_SUBDEV1_CAPABILITY
-> REVOKE_AUTHENTICATED_SESSION
-> INVALIDATE_CSRF_AND_EPOCH
-> CLEAR_COOKIES
-> DETACH_RUNTIME_HANDLES
-> EMIT_RECEIPT
```

Restart:

```text
NEW_PROCESS
-> VALIDATE_SHARED_STATE_CAPABILITY
-> REVALIDATE_SESSION
-> RESOLVE_SUBJECT
-> REVALIDATE_APPROVAL_AND_CAPABILITY
-> REBUILD_ATTACHMENTS
-> READY_OR_GOVERNED_FAILURE
```

Emergency disable:

```text
ASSERT_GLOBAL_DISABLE
-> ADVANCE_ENVIRONMENT_SECURITY_EPOCH
-> DENY_NEW_ELEVATION_AND_ATTACHMENT
-> STALE_ACTIVE_ENVELOPES
-> STOP_NEW_MUTATIONS
-> PRESERVE_CANONICAL_ENGINE
-> EMIT_PRIVACY_SAFE_RECEIPT
```

## 22. Evidence contract

Permitted:

- opaque references;
- hashes;
- versions;
- reason codes;
- timestamps;
- boolean gate states;
- zero external-call counts;
- aggregate test results.

Prohibited:

- names, emails, raw subject/coach/Profile IDs;
- tokens, cookies, assertions, secrets, access codes, bypass values;
- raw URLs/IPs;
- Business Engine content;
- conversations, coach notes, transcripts, media/model context;
- production/customer data or provider exports.

## 23. Sprint-local outputs

Each sprint must emit under
`lab_outputs/coach_connect_private_runtime_enablement_v1/sprint_N/`:

```text
sprint_receipt.json
changed_files.json
test_results.json
contract_proof.json
negative_proof.json
secret_scan.json
protected_root_proof.json
repair_receipts.json
```

Sprint-specific AFWs may add narrowly named proof files.

## 24. Part verdict

`PRIVATE_RUNTIME_ENABLEMENT_PART_2_AFW_READY`

The contracts and state machines are implementation-ready only after separate
implementation authorization. They authorize no provider, persistence,
deployment, Stripe, or production action.

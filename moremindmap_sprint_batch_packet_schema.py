"""MORE MindMap Sprint Batch Packet Schema, report-only.

This module defines pure validation helpers for future governed sprint batch
packets. It does not execute batches, create routes, call networks, read
environment variables, or mutate production state.
"""

import copy
import datetime
import hashlib
import json
import sys
from typing import Any, Dict, List


SCHEMA_VERSION = "moremindmap_sprint_batch_packet_schema_v1"
EXPECTED_VERDICT = "MOREMINDMAP_SPRINT_BATCH_PACKET_SCHEMA_IMPLEMENTED_WITH_LIMITS"
EXPECTED_CLASSIFICATION = "MOREMINDMAP_SPRINT_BATCH_PACKET_SCHEMA_DEFINED_WITH_LIMITS"
HIGHEST_ALLOWED_READINESS = "READY_FOR_HUMAN_REVIEW_OF_MOREMINDMAP_SPRINT_BATCH_PACKET_SCHEMA"

REQUIRED_FIELDS = [
    "schema_version",
    "batch_id",
    "batch_name",
    "batch_class",
    "product_area",
    "goal",
    "sprint_ids",
    "sprint_count",
    "max_sprint_count",
    "allowed_files",
    "forbidden_files",
    "allowed_behavior",
    "forbidden_behavior",
    "stop_conditions",
    "max_repair_attempts",
    "human_approval_required",
    "production_deploy_allowed",
    "production_deploy_requires_human_approval",
    "verification_required",
    "closure_report_required",
    "local_build_required",
    "route_verification_required",
    "retrieval_verification_required",
    "artifact_save_retrieve_verification_required",
    "raw_json_debug_check_required",
    "banned_placeholder_check_required",
    "source_label_integrity_check_required",
    "payment_state_check_required_if_payment_touched",
    "subscription_state_check_required_if_subscription_touched",
    "outcome_ledger_check_required_if_outcome_touched",
    "no_partial_artifact_exposure",
    "no_validation_downgrade",
    "no_fake_success",
    "no_frontend_only_success",
    "highest_allowed_readiness",
    "report_only",
    "schema_only",
]

VALID_BATCH_CLASSES = [
    "REPORT_ONLY_SCHEMA_BATCH",
    "TRACE_ONLY_BATCH",
    "LOW_RISK_DOCS_BATCH",
    "LOW_RISK_FRONTEND_COPY_BATCH",
    "LOW_RISK_BACKEND_TRACE_BATCH",
    "CONTROLLED_PRODUCT_BUILD_BATCH",
    "PAYMENT_PLUMBING_BATCH_CANDIDATE",
    "NOTIFICATION_PLUMBING_BATCH_CANDIDATE",
    "SUBSCRIPTION_ARCHITECTURE_BATCH_CANDIDATE",
    "OUTCOME_LEDGER_BATCH_CANDIDATE",
    "RECRUITING_INTELLIGENCE_BATCH_CANDIDATE",
]

REQUIRED_STOP_CONDITIONS = [
    "BUILD_FAILED",
    "ROUTE_FAILED",
    "RETRIEVAL_FAILED",
    "SAVED_ARTIFACT_MISSING",
    "FRONTEND_CLAIMS_UNSAVED_ARTIFACT",
    "RAW_JSON_OR_DEBUG_OUTPUT_VISIBLE",
    "FAKE_PROFILE_COMPANY_OR_HEADSHOT_VISIBLE",
    "PLACEHOLDER_CONTENT_LEAK",
    "PAYMENT_STATE_AMBIGUOUS",
    "WEBHOOK_VERIFICATION_FAILED",
    "SUBSCRIPTION_USAGE_STATE_AMBIGUOUS",
    "OUTCOME_LEDGER_WRITE_FAILED",
    "GENERATION_CORRUPTS_SAVED_DRAFT",
    "EXECUTIVE_DIAGNOSTIC_FAILURE_WITHOUT_DIAGNOSTICS",
    "FIVE_FUTURES_FAILURE_WITHOUT_DIAGNOSTICS",
    "ONE_MOVE_FAILURE_WITHOUT_DIAGNOSTICS",
    "FILE_OUTSIDE_ALLOWLIST_TOUCHED",
    "PRODUCTION_VERIFICATION_INCOMPLETE",
    "USER_VISIBLE_FEATURE_NOT_RETRIEVABLE_AFTER_SAVE",
]

REQUIRED_FORBIDDEN_BEHAVIOR = [
    "LOWER_VALIDATION_GATES",
    "FAKE_SAVED_ARTIFACT",
    "EXPOSE_PARTIAL_INTELLIGENCE",
    "FRONTEND_ONLY_SUCCESS",
    "DEPLOY_WITHOUT_HUMAN_APPROVAL",
    "MODIFY_FILES_OUTSIDE_ALLOWLIST",
    "HIDE_FAILURE_DIAGNOSTICS",
    "CLAIM_PRODUCTION_SUCCESS_WITHOUT_PRODUCTION_CHECK",
    "CREATE_RUNTIME_LOOP",
    "CREATE_CODEX_AUTOMATION",
    "CREATE_ACTIVE_AGENTS",
    "CREATE_UNAPPROVED_ROUTES",
    "CREATE_UNAPPROVED_UI",
    "CREATE_UNAPPROVED_PAYMENT_BEHAVIOR",
    "CREATE_UNAPPROVED_SUBSCRIPTION_BEHAVIOR",
    "CREATE_UNAPPROVED_OUTCOME_LEDGER_BEHAVIOR",
]

REQUIRED_TRUE_FIELDS = [
    "human_approval_required",
    "production_deploy_requires_human_approval",
    "verification_required",
    "closure_report_required",
    "raw_json_debug_check_required",
    "no_partial_artifact_exposure",
    "no_validation_downgrade",
    "no_fake_success",
    "no_frontend_only_success",
    "report_only",
    "schema_only",
]

RUNTIME_AUTHORIZING_ALLOWED_BEHAVIOR = [
    "CREATE_RUNTIME_LOOP",
    "CREATE_CODEX_AUTOMATION",
    "CREATE_ACTIVE_AGENTS",
    "DEPLOY_WITHOUT_HUMAN_APPROVAL",
    "CREATE_UNAPPROVED_ROUTES",
    "CREATE_UNAPPROVED_UI",
    "CREATE_UNAPPROVED_PAYMENT_BEHAVIOR",
    "CREATE_UNAPPROVED_SUBSCRIPTION_BEHAVIOR",
    "CREATE_UNAPPROVED_OUTCOME_LEDGER_BEHAVIOR",
]

PAYMENT_PRODUCT_AREAS = ["payment", "stripe", "payments"]
SUBSCRIPTION_PRODUCT_AREAS = ["subscription", "subscriptions"]
OUTCOME_LEDGER_PRODUCT_AREAS = ["outcome_ledger", "outcome-ledger", "outcome ledger"]


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def stable_hash(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def normalized_strings(value: Any) -> List[str]:
    return [str(item).strip() for item in as_list(value)]


def product_area_is(packet: Dict[str, Any], candidates: List[str]) -> bool:
    value = str(packet.get("product_area", "")).strip().lower()
    return value in candidates


def batch_class_contains(packet: Dict[str, Any], token: str) -> bool:
    return token in str(packet.get("batch_class", "")).upper()


def validate_batch_packet(packet: Dict[str, Any]) -> Dict[str, Any]:
    errors: List[str] = []

    if not isinstance(packet, dict):
        return {"valid": False, "errors": ["packet must be an object"]}

    expected = set(REQUIRED_FIELDS)
    actual = set(packet.keys())
    missing = sorted(expected - actual)
    unknown = sorted(actual - expected)
    if missing:
        errors.append("missing required fields: " + ", ".join(missing))
    if unknown:
        errors.append("unknown fields present: " + ", ".join(unknown))

    if packet.get("schema_version") != SCHEMA_VERSION:
        errors.append("schema_version must equal " + SCHEMA_VERSION)
    if not packet.get("batch_id"):
        errors.append("batch_id missing")
    if not packet.get("batch_name"):
        errors.append("batch_name missing")
    if not packet.get("product_area"):
        errors.append("product_area missing")
    if not packet.get("goal"):
        errors.append("goal missing")
    if packet.get("batch_class") not in VALID_BATCH_CLASSES:
        errors.append("batch_class is not recognized")
    if packet.get("highest_allowed_readiness") != HIGHEST_ALLOWED_READINESS:
        errors.append("highest_allowed_readiness is not allowed")

    for field in REQUIRED_TRUE_FIELDS:
        if packet.get(field) is not True:
            errors.append(field + " must be true")

    if packet.get("production_deploy_allowed") is True and packet.get("production_deploy_requires_human_approval") is not True:
        errors.append("production_deploy_allowed requires production_deploy_requires_human_approval")

    sprint_ids = as_list(packet.get("sprint_ids"))
    if not sprint_ids:
        errors.append("sprint_ids must be non-empty")
    if packet.get("sprint_count") != len(sprint_ids):
        errors.append("sprint_count must match sprint_ids length")
    if not isinstance(packet.get("max_sprint_count"), int):
        errors.append("max_sprint_count must be an integer")
    elif isinstance(packet.get("sprint_count"), int) and packet["sprint_count"] > packet["max_sprint_count"]:
        errors.append("sprint_count cannot exceed max_sprint_count")

    if not as_list(packet.get("allowed_files")):
        errors.append("allowed_files must be non-empty")
    if not isinstance(packet.get("forbidden_files"), list):
        errors.append("forbidden_files must be a list")

    if not isinstance(packet.get("max_repair_attempts"), int):
        errors.append("max_repair_attempts must be an integer")
    elif packet["max_repair_attempts"] > 2:
        errors.append("max_repair_attempts cannot exceed 2")

    stop_conditions = set(normalized_strings(packet.get("stop_conditions")))
    missing_stops = sorted(set(REQUIRED_STOP_CONDITIONS) - stop_conditions)
    if missing_stops:
        errors.append("missing required stop conditions: " + ", ".join(missing_stops))

    forbidden_behavior = set(normalized_strings(packet.get("forbidden_behavior")))
    missing_forbidden = sorted(set(REQUIRED_FORBIDDEN_BEHAVIOR) - forbidden_behavior)
    if missing_forbidden:
        errors.append("missing required forbidden behavior: " + ", ".join(missing_forbidden))

    allowed_behavior = set(normalized_strings(packet.get("allowed_behavior")))
    unsafe_allowed = sorted(set(RUNTIME_AUTHORIZING_ALLOWED_BEHAVIOR) & allowed_behavior)
    if unsafe_allowed:
        errors.append("allowed_behavior contains unsafe runtime/deploy authority: " + ", ".join(unsafe_allowed))

    if (batch_class_contains(packet, "PAYMENT") or product_area_is(packet, PAYMENT_PRODUCT_AREAS)) and packet.get("payment_state_check_required_if_payment_touched") is not True:
        errors.append("payment batches require payment state checks")
    if (batch_class_contains(packet, "SUBSCRIPTION") or product_area_is(packet, SUBSCRIPTION_PRODUCT_AREAS)) and packet.get("subscription_state_check_required_if_subscription_touched") is not True:
        errors.append("subscription batches require subscription state checks")
    if (batch_class_contains(packet, "OUTCOME_LEDGER") or product_area_is(packet, OUTCOME_LEDGER_PRODUCT_AREAS)) and packet.get("outcome_ledger_check_required_if_outcome_touched") is not True:
        errors.append("outcome ledger batches require outcome ledger checks")

    sensitive_area = (
        product_area_is(packet, PAYMENT_PRODUCT_AREAS)
        or product_area_is(packet, SUBSCRIPTION_PRODUCT_AREAS)
        or product_area_is(packet, OUTCOME_LEDGER_PRODUCT_AREAS)
    )
    if sensitive_area and not as_list(packet.get("forbidden_files")):
        errors.append("payment/subscription/outcome ledger product areas require forbidden_files")

    return {
        "valid": not errors,
        "errors": errors,
        "schema_version": packet.get("schema_version"),
        "batch_id": packet.get("batch_id"),
        "packet_hash": stable_hash(packet) if isinstance(packet, dict) else None,
    }


def build_valid_fixture() -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "batch_id": "MM-DL-2-SCHEMA-FIXTURE",
        "batch_name": "Report-only sprint batch packet schema fixture",
        "batch_class": "REPORT_ONLY_SCHEMA_BATCH",
        "product_area": "development_loop_doctrine",
        "goal": "Define the report-only sprint batch packet schema.",
        "sprint_ids": ["MM-DL-2"],
        "sprint_count": 1,
        "max_sprint_count": 1,
        "allowed_files": [
            "moremindmap_sprint_batch_packet_schema.py",
            "MOREMINDMAP_SPRINT_BATCH_PACKET_SCHEMA_REPORT_ONLY.md",
            "runtime_traces/moremindmap_sprint_batch_packet_schema_02.json",
            "runtime_traces/moremindmap_sprint_batch_packet_schema_selftest_02.json",
        ],
        "forbidden_files": [
            "src/**",
            "api/**",
            "package.json",
            "vercel.json",
        ],
        "allowed_behavior": [
            "DEFINE_REPORT_ONLY_SCHEMA",
            "RUN_LOCAL_SCHEMA_SELFTEST",
            "WRITE_TRACE_ARTIFACTS",
        ],
        "forbidden_behavior": list(REQUIRED_FORBIDDEN_BEHAVIOR),
        "stop_conditions": list(REQUIRED_STOP_CONDITIONS),
        "max_repair_attempts": 2,
        "human_approval_required": True,
        "production_deploy_allowed": False,
        "production_deploy_requires_human_approval": True,
        "verification_required": True,
        "closure_report_required": True,
        "local_build_required": True,
        "route_verification_required": True,
        "retrieval_verification_required": True,
        "artifact_save_retrieve_verification_required": True,
        "raw_json_debug_check_required": True,
        "banned_placeholder_check_required": True,
        "source_label_integrity_check_required": True,
        "payment_state_check_required_if_payment_touched": True,
        "subscription_state_check_required_if_subscription_touched": True,
        "outcome_ledger_check_required_if_outcome_touched": True,
        "no_partial_artifact_exposure": True,
        "no_validation_downgrade": True,
        "no_fake_success": True,
        "no_frontend_only_success": True,
        "highest_allowed_readiness": HIGHEST_ALLOWED_READINESS,
        "report_only": True,
        "schema_only": True,
    }


def mutated_fixture(name: str, mutation: Dict[str, Any]) -> Dict[str, Any]:
    fixture = build_valid_fixture()
    fixture["batch_id"] = "INVALID-" + name
    if mutation.get("__delete__"):
        for field in mutation["__delete__"]:
            fixture.pop(field, None)
    for key, value in mutation.items():
        if key != "__delete__":
            fixture[key] = value
    return fixture


def build_invalid_fixtures() -> Dict[str, Dict[str, Any]]:
    return {
        "human_approval_required_false": mutated_fixture("human_approval_required_false", {"human_approval_required": False}),
        "production_deploy_requires_human_approval_false": mutated_fixture("production_deploy_requires_human_approval_false", {"production_deploy_requires_human_approval": False}),
        "verification_required_false": mutated_fixture("verification_required_false", {"verification_required": False}),
        "closure_report_required_false": mutated_fixture("closure_report_required_false", {"closure_report_required": False}),
        "no_partial_artifact_exposure_false": mutated_fixture("no_partial_artifact_exposure_false", {"no_partial_artifact_exposure": False}),
        "no_validation_downgrade_false": mutated_fixture("no_validation_downgrade_false", {"no_validation_downgrade": False}),
        "no_fake_success_false": mutated_fixture("no_fake_success_false", {"no_fake_success": False}),
        "no_frontend_only_success_false": mutated_fixture("no_frontend_only_success_false", {"no_frontend_only_success": False}),
        "report_only_false": mutated_fixture("report_only_false", {"report_only": False}),
        "schema_only_false": mutated_fixture("schema_only_false", {"schema_only": False}),
        "highest_allowed_readiness_wrong": mutated_fixture("highest_allowed_readiness_wrong", {"highest_allowed_readiness": "READY_FOR_AUTOMATED_BATCH_EXECUTION"}),
        "missing_stop_build_failed": mutated_fixture("missing_stop_build_failed", {"stop_conditions": [item for item in REQUIRED_STOP_CONDITIONS if item != "BUILD_FAILED"]}),
        "missing_stop_retrieval_failed": mutated_fixture("missing_stop_retrieval_failed", {"stop_conditions": [item for item in REQUIRED_STOP_CONDITIONS if item != "RETRIEVAL_FAILED"]}),
        "missing_stop_saved_artifact_missing": mutated_fixture("missing_stop_saved_artifact_missing", {"stop_conditions": [item for item in REQUIRED_STOP_CONDITIONS if item != "SAVED_ARTIFACT_MISSING"]}),
        "missing_stop_frontend_claims_unsaved_artifact": mutated_fixture("missing_stop_frontend_claims_unsaved_artifact", {"stop_conditions": [item for item in REQUIRED_STOP_CONDITIONS if item != "FRONTEND_CLAIMS_UNSAVED_ARTIFACT"]}),
        "missing_forbidden_lower_validation_gates": mutated_fixture("missing_forbidden_lower_validation_gates", {"forbidden_behavior": [item for item in REQUIRED_FORBIDDEN_BEHAVIOR if item != "LOWER_VALIDATION_GATES"]}),
        "missing_forbidden_fake_saved_artifact": mutated_fixture("missing_forbidden_fake_saved_artifact", {"forbidden_behavior": [item for item in REQUIRED_FORBIDDEN_BEHAVIOR if item != "FAKE_SAVED_ARTIFACT"]}),
        "missing_forbidden_expose_partial_intelligence": mutated_fixture("missing_forbidden_expose_partial_intelligence", {"forbidden_behavior": [item for item in REQUIRED_FORBIDDEN_BEHAVIOR if item != "EXPOSE_PARTIAL_INTELLIGENCE"]}),
        "missing_forbidden_deploy_without_human_approval": mutated_fixture("missing_forbidden_deploy_without_human_approval", {"forbidden_behavior": [item for item in REQUIRED_FORBIDDEN_BEHAVIOR if item != "DEPLOY_WITHOUT_HUMAN_APPROVAL"]}),
        "allowed_files_empty": mutated_fixture("allowed_files_empty", {"allowed_files": []}),
        "sprint_ids_empty": mutated_fixture("sprint_ids_empty", {"sprint_ids": [], "sprint_count": 0}),
        "sprint_count_mismatch": mutated_fixture("sprint_count_mismatch", {"sprint_count": 2}),
        "sprint_count_greater_than_max": mutated_fixture("sprint_count_greater_than_max", {"sprint_ids": ["MM-DL-2", "MM-DL-3"], "sprint_count": 2, "max_sprint_count": 1}),
        "max_repair_attempts_too_high": mutated_fixture("max_repair_attempts_too_high", {"max_repair_attempts": 3}),
        "deploy_allowed_without_deploy_human_approval": mutated_fixture("deploy_allowed_without_deploy_human_approval", {"production_deploy_allowed": True, "production_deploy_requires_human_approval": False}),
        "payment_batch_without_payment_check": mutated_fixture("payment_batch_without_payment_check", {"batch_class": "PAYMENT_PLUMBING_BATCH_CANDIDATE", "product_area": "payment", "payment_state_check_required_if_payment_touched": False}),
        "subscription_batch_without_subscription_check": mutated_fixture("subscription_batch_without_subscription_check", {"batch_class": "SUBSCRIPTION_ARCHITECTURE_BATCH_CANDIDATE", "product_area": "subscription", "subscription_state_check_required_if_subscription_touched": False}),
        "outcome_batch_without_outcome_check": mutated_fixture("outcome_batch_without_outcome_check", {"batch_class": "OUTCOME_LEDGER_BATCH_CANDIDATE", "product_area": "outcome_ledger", "outcome_ledger_check_required_if_outcome_touched": False}),
        "allowed_behavior_runtime_loop": mutated_fixture("allowed_behavior_runtime_loop", {"allowed_behavior": ["CREATE_RUNTIME_LOOP"]}),
        "allowed_behavior_codex_automation": mutated_fixture("allowed_behavior_codex_automation", {"allowed_behavior": ["CREATE_CODEX_AUTOMATION"]}),
        "allowed_behavior_active_agents": mutated_fixture("allowed_behavior_active_agents", {"allowed_behavior": ["CREATE_ACTIVE_AGENTS"]}),
        "unknown_field_present": mutated_fixture("unknown_field_present", {"unexpected_runtime_authority": True}),
        "allowed_behavior_deploy_without_approval": mutated_fixture("allowed_behavior_deploy_without_approval", {"allowed_behavior": ["DEPLOY_WITHOUT_HUMAN_APPROVAL"]}),
        "payment_area_forbidden_files_missing": mutated_fixture("payment_area_forbidden_files_missing", {"product_area": "payment", "batch_class": "PAYMENT_PLUMBING_BATCH_CANDIDATE", "forbidden_files": []}),
        "product_area_missing": mutated_fixture("product_area_missing", {"product_area": ""}),
        "goal_missing": mutated_fixture("goal_missing", {"goal": ""}),
        "batch_id_missing": mutated_fixture("batch_id_missing", {"batch_id": ""}),
        "schema_version_missing": mutated_fixture("schema_version_missing", {"schema_version": ""}),
        "closure_report_required_false_duplicate": mutated_fixture("closure_report_required_false_duplicate", {"closure_report_required": False}),
        "raw_json_debug_check_required_false": mutated_fixture("raw_json_debug_check_required_false", {"raw_json_debug_check_required": False}),
    }


def run_self_test() -> Dict[str, Any]:
    valid_fixture = build_valid_fixture()
    valid_result = validate_batch_packet(valid_fixture)
    invalid_results = {
        name: validate_batch_packet(fixture)
        for name, fixture in build_invalid_fixtures().items()
    }
    valid_records_passed = 1 if valid_result["valid"] else 0
    invalid_records_failed_closed = sum(1 for result in invalid_results.values() if not result["valid"])
    invalid_failures = [
        name
        for name, result in invalid_results.items()
        if result["valid"]
    ]
    status = "passed" if valid_result["valid"] and not invalid_failures else "failed"
    return {
        "sprint": "MM-DL-2",
        "status": status,
        "verdict": EXPECTED_VERDICT if status == "passed" else "MOREMINDMAP_SPRINT_BATCH_PACKET_SCHEMA_SELFTEST_FAILED",
        "classification": EXPECTED_CLASSIFICATION,
        "schema_version": SCHEMA_VERSION,
        "valid_records_passed": valid_records_passed,
        "invalid_records_failed_closed": invalid_records_failed_closed,
        "invalid_records_total": len(invalid_results),
        "invalid_failures": invalid_failures,
        "valid_fixture_hash": stable_hash(valid_fixture),
        "invalid_fixture_hashes": {
            name: result["packet_hash"]
            for name, result in invalid_results.items()
        },
        "safety_flags": {
            "report_only": True,
            "schema_only": True,
            "no_runtime": True,
            "no_batch_execution": True,
            "no_codex_automation": True,
            "no_active_agents": True,
            "no_routes": True,
            "no_ui": True,
            "no_stripe_changes": True,
            "no_formspree_changes": True,
            "no_subscription_changes": True,
            "no_outcome_ledger_changes": True,
            "no_assessment_generation_changes": True,
            "no_deployment": True,
        },
        "generated_at": now_iso(),
    }


def write_self_test_trace(summary: Dict[str, Any]) -> None:
    with open("runtime_traces/moremindmap_sprint_batch_packet_schema_selftest_02.json", "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, sort_keys=True)
        handle.write("\n")


def main(argv: List[str]) -> int:
    if "--self-test" not in argv:
        print("usage: python3 moremindmap_sprint_batch_packet_schema.py --self-test")
        return 2
    summary = run_self_test()
    write_self_test_trace(summary)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0 if summary["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

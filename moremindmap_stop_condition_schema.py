"""MORE MindMap Stop Condition Schema, report-only.

This module defines pure validation helpers for future stop condition records.
It does not enforce stops at runtime, execute batches, create routes, call
networks, read environment variables, or mutate production state.
"""

import copy
import datetime
import hashlib
import json
import sys
from typing import Any, Dict, List


SCHEMA_VERSION = "moremindmap_stop_condition_schema_v1"
EXPECTED_VERDICT = "MOREMINDMAP_STOP_CONDITION_SCHEMA_IMPLEMENTED_WITH_LIMITS"
EXPECTED_CLASSIFICATION = "MOREMINDMAP_STOP_CONDITION_SCHEMA_DEFINED_WITH_LIMITS"
HIGHEST_ALLOWED_READINESS = "READY_FOR_HUMAN_REVIEW_OF_MOREMINDMAP_STOP_CONDITION_SCHEMA"

REQUIRED_FIELDS = [
    "schema_version",
    "stop_id",
    "stop_code",
    "stop_class",
    "severity",
    "product_area",
    "trigger_condition",
    "detection_method",
    "required_evidence",
    "blocks_current_sprint",
    "blocks_next_sprint",
    "blocks_commit",
    "blocks_deploy",
    "blocks_user_visibility",
    "blocks_batch_continuation",
    "allows_automatic_repair",
    "max_repair_attempts_allowed",
    "human_review_required",
    "repair_packet_required",
    "product_reality_review_required",
    "builder_result_required",
    "source_batch_packet_ref_required",
    "stop_reason_summary",
    "recommended_disposition",
    "forbidden_recommendations",
    "highest_allowed_readiness",
    "report_only",
    "schema_only",
]

VALID_STOP_CLASSES = [
    "PRODUCT_REALITY_STOP",
    "ARTIFACT_TRUTH_STOP",
    "RETRIEVAL_TRUTH_STOP",
    "CONTROLLED_FAILURE_STOP",
    "RAW_JSON_DEBUG_STOP",
    "PLACEHOLDER_LEAK_STOP",
    "SOURCE_LABEL_TRUTH_STOP",
    "PAYMENT_TRUTH_STOP",
    "SUBSCRIPTION_TRUTH_STOP",
    "OUTCOME_LEDGER_TRUTH_STOP",
    "DESIGN_TRUST_STOP",
    "PRODUCTION_VERIFICATION_STOP",
    "FILE_SCOPE_STOP",
    "BUILD_VERIFICATION_STOP",
    "ROUTE_VERIFICATION_STOP",
    "RUNTIME_ERROR_STOP",
    "HUMAN_APPROVAL_STOP",
    "BLOCKED_WITH_REASON_STOP",
]

VALID_SEVERITIES = ["RED", "AMBER", "MECHANICAL", "INFO"]

REQUIRED_RED_STOP_CODES = [
    "FRONTEND_CLAIMS_UNSAVED_ARTIFACT",
    "SAVED_ARTIFACT_MISSING",
    "RETRIEVAL_FAILED",
    "PARTIAL_ARTIFACT_EXPOSED",
    "RAW_JSON_OR_DEBUG_OUTPUT_VISIBLE",
    "FAKE_PROFILE_COMPANY_OR_HEADSHOT_VISIBLE",
    "PLACEHOLDER_CONTENT_LEAK",
    "MODEL_ESTIMATE_PRESENTED_AS_USER_PROVIDED",
    "INSUFFICIENT_DATA_HIDDEN",
    "SOURCE_LABELS_DOWNGRADED_OR_MISSING",
    "EXECUTIVE_DIAGNOSTIC_FAILURE_WITHOUT_DIAGNOSTICS",
    "FIVE_FUTURES_FAILURE_WITHOUT_DIAGNOSTICS",
    "ONE_MOVE_FAILURE_WITHOUT_DIAGNOSTICS",
    "GENERATION_CORRUPTS_SAVED_DRAFT",
    "PAYMENT_STATE_AMBIGUOUS",
    "WEBHOOK_VERIFICATION_FAILED",
    "SUBSCRIPTION_USAGE_STATE_AMBIGUOUS",
    "OUTCOME_LEDGER_WRITE_FAILED",
    "PRODUCTION_VERIFICATION_INCOMPLETE",
    "DEPLOY_WITHOUT_HUMAN_APPROVAL",
    "FILE_OUTSIDE_ALLOWLIST_TOUCHED",
    "VALIDATION_GATE_LOWERED",
    "FAKE_SUCCESS_CLAIMED",
    "DECORATIVE_INTELLIGENCE_APPROVED",
    "FRONTEND_ONLY_SUCCESS_APPROVED",
    "USER_VISIBLE_FEATURE_NOT_RETRIEVABLE_AFTER_SAVE",
]

REQUIRED_AMBER_STOP_CODES = [
    "MOBILE_LAYOUT_NOT_VERIFIED",
    "DESKTOP_LAYOUT_NOT_VERIFIED",
    "SCREENSHOT_REVIEW_MISSING",
    "DESIGN_GRADE_BELOW_A",
    "TRUST_GRADE_BELOW_A",
    "PRODUCT_REALITY_GRADE_BELOW_A",
    "NON_BLOCKING_COPY_ISSUE",
    "ROUTE_CHECK_INCOMPLETE",
    "BUILD_WARNING_UNREVIEWED",
    "PRODUCTION_ROUTE_CHECK_NOT_RUN",
]

REQUIRED_MECHANICAL_STOP_CODES = [
    "JSON_TRACE_INVALID",
    "SELF_TEST_FAILED",
    "PY_COMPILE_FAILED",
    "GIT_DIFF_CHECK_FAILED",
    "NPM_BUILD_FAILED",
    "IMPORT_TIME_BEHAVIOR_CHECK_FAILED",
    "CAPABILITY_SCAN_FAILED",
    "FOOTPRINT_CHECK_FAILED",
    "MISSING_REQUIRED_REPORT_FIELD",
    "ENUM_TYPO",
    "INVALID_FIXTURE_DID_NOT_FAIL_CLOSED",
]

FORBIDDEN_RECOMMENDATIONS = [
    "READY_FOR_STRIPE_BATCH",
    "READY_FOR_AUTOMATED_BATCH_EXECUTION",
    "READY_FOR_COMMIT_REVIEW",
    "READY_FOR_DEPLOY_REVIEW",
    "READY_FOR_PRODUCTION_DEPLOY_WITHOUT_HUMAN_APPROVAL",
    "READY_FOR_USER_VISIBILITY",
    "READY_FOR_SUBSCRIPTION_RELEASE",
    "READY_FOR_OUTCOME_LEDGER_RELEASE",
]

VALID_DISPOSITIONS = [
    "STOP_AND_REPAIR",
    "STOP_AND_REQUEST_HUMAN_REVIEW",
    "BLOCKED_WITH_REASON",
    "CREATE_REPAIR_PACKET",
    "CREATE_PRODUCT_REALITY_REVIEW",
    "ARCHIVE_AND_REPLAN",
    "HUMAN_REVIEW_REQUIRED",
]

CONTINUATION_DISPOSITIONS = [
    "READY_FOR_COMMIT_REVIEW",
    "READY_FOR_DEPLOY_REVIEW",
    "READY_FOR_NEXT_SPRINT",
    "READY_FOR_USER_VISIBILITY",
]


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def stable_hash(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def non_empty(value: Any) -> bool:
    return value is not None and value != "" and value != []


def validate_stop_condition_record(record: Dict[str, Any]) -> Dict[str, Any]:
    errors: List[str] = []
    if not isinstance(record, dict):
        return {"valid": False, "errors": ["record must be an object"]}

    expected = set(REQUIRED_FIELDS)
    actual = set(record.keys())
    missing = sorted(expected - actual)
    unknown = sorted(actual - expected)
    if missing:
        errors.append("missing required fields: " + ", ".join(missing))
    if unknown:
        errors.append("unknown fields present: " + ", ".join(unknown))

    if record.get("schema_version") != SCHEMA_VERSION:
        errors.append("schema_version must equal " + SCHEMA_VERSION)
    for field in ["stop_id", "stop_code", "stop_class", "severity", "product_area", "trigger_condition", "detection_method", "required_evidence", "stop_reason_summary"]:
        if not non_empty(record.get(field)):
            errors.append(field + " missing")
    if record.get("stop_class") not in VALID_STOP_CLASSES:
        errors.append("stop_class is not recognized")
    if record.get("severity") not in VALID_SEVERITIES:
        errors.append("severity is not recognized")
    if record.get("highest_allowed_readiness") != HIGHEST_ALLOWED_READINESS:
        errors.append("highest_allowed_readiness is not allowed")
    if record.get("report_only") is not True:
        errors.append("report_only must be true")
    if record.get("schema_only") is not True:
        errors.append("schema_only must be true")

    disposition = record.get("recommended_disposition")
    if not non_empty(disposition):
        errors.append("recommended_disposition missing")
    elif disposition not in VALID_DISPOSITIONS:
        errors.append("recommended_disposition is not allowed")
    if disposition in CONTINUATION_DISPOSITIONS:
        errors.append("recommended_disposition must not authorize continuation")

    forbidden = set(str(item) for item in as_list(record.get("forbidden_recommendations")))
    missing_forbidden = sorted(set(FORBIDDEN_RECOMMENDATIONS) - forbidden)
    if missing_forbidden:
        errors.append("missing forbidden recommendations: " + ", ".join(missing_forbidden))
    if record.get("stop_code") in FORBIDDEN_RECOMMENDATIONS:
        errors.append("stop_code cannot be a readiness recommendation")

    severity = record.get("severity")
    if severity == "RED":
        required_true = [
            "blocks_current_sprint",
            "blocks_next_sprint",
            "blocks_commit",
            "blocks_deploy",
            "blocks_batch_continuation",
            "human_review_required",
            "repair_packet_required",
            "product_reality_review_required",
        ]
        for field in required_true:
            if record.get(field) is not True:
                errors.append("RED stop requires " + field)
        if record.get("allows_automatic_repair") is not False:
            errors.append("RED stop cannot allow automatic repair")
        if record.get("max_repair_attempts_allowed") != 0:
            errors.append("RED stop max_repair_attempts_allowed must be 0")

    if severity == "MECHANICAL":
        if not isinstance(record.get("max_repair_attempts_allowed"), int) or record.get("max_repair_attempts_allowed") > 2:
            errors.append("MECHANICAL stop max_repair_attempts_allowed must be <= 2")
        if record.get("human_review_required") is not True:
            errors.append("MECHANICAL stop still requires human review before commit or deploy")

    red_expected = {
        "FRONTEND_CLAIMS_UNSAVED_ARTIFACT",
        "SAVED_ARTIFACT_MISSING",
        "RETRIEVAL_FAILED",
        "PARTIAL_ARTIFACT_EXPOSED",
        "RAW_JSON_OR_DEBUG_OUTPUT_VISIBLE",
        "FAKE_PROFILE_COMPANY_OR_HEADSHOT_VISIBLE",
        "PLACEHOLDER_CONTENT_LEAK",
        "MODEL_ESTIMATE_PRESENTED_AS_USER_PROVIDED",
        "INSUFFICIENT_DATA_HIDDEN",
        "SOURCE_LABELS_DOWNGRADED_OR_MISSING",
        "EXECUTIVE_DIAGNOSTIC_FAILURE_WITHOUT_DIAGNOSTICS",
        "FIVE_FUTURES_FAILURE_WITHOUT_DIAGNOSTICS",
        "ONE_MOVE_FAILURE_WITHOUT_DIAGNOSTICS",
        "GENERATION_CORRUPTS_SAVED_DRAFT",
        "PAYMENT_STATE_AMBIGUOUS",
        "WEBHOOK_VERIFICATION_FAILED",
        "SUBSCRIPTION_USAGE_STATE_AMBIGUOUS",
        "OUTCOME_LEDGER_WRITE_FAILED",
        "PRODUCTION_VERIFICATION_INCOMPLETE",
        "DEPLOY_WITHOUT_HUMAN_APPROVAL",
        "FILE_OUTSIDE_ALLOWLIST_TOUCHED",
        "VALIDATION_GATE_LOWERED",
        "FAKE_SUCCESS_CLAIMED",
        "DECORATIVE_INTELLIGENCE_APPROVED",
        "FRONTEND_ONLY_SUCCESS_APPROVED",
        "USER_VISIBLE_FEATURE_NOT_RETRIEVABLE_AFTER_SAVE",
    }
    if record.get("stop_code") in red_expected and severity != "RED":
        errors.append(record.get("stop_code") + " must be severity RED")

    if record.get("stop_code") in {"RETRIEVAL_FAILED", "USER_VISIBLE_FEATURE_NOT_RETRIEVABLE_AFTER_SAVE"} and record.get("blocks_user_visibility") is not True:
        errors.append("retrieval failure must block user visibility")
    if record.get("stop_code") == "PARTIAL_ARTIFACT_EXPOSED" and record.get("blocks_batch_continuation") is not True:
        errors.append("partial artifact exposure must block continuation")
    if record.get("stop_code") == "FILE_OUTSIDE_ALLOWLIST_TOUCHED" and record.get("blocks_commit") is not True:
        errors.append("file outside allowlist must block commit")
    if record.get("stop_code") == "PRODUCTION_VERIFICATION_INCOMPLETE" and record.get("blocks_deploy") is not True:
        errors.append("production verification incomplete must block deploy")
    if record.get("stop_code") == "DEPLOY_WITHOUT_HUMAN_APPROVAL" and record.get("blocks_deploy") is not True:
        errors.append("deploy without approval must block deploy")
    if record.get("stop_code") in {"RAW_JSON_OR_DEBUG_OUTPUT_VISIBLE", "PLACEHOLDER_CONTENT_LEAK", "PAYMENT_STATE_AMBIGUOUS", "SUBSCRIPTION_USAGE_STATE_AMBIGUOUS", "OUTCOME_LEDGER_WRITE_FAILED"} and record.get("blocks_deploy") is not True:
        errors.append(record.get("stop_code") + " must block deploy")
    if record.get("stop_code") in {"FRONTEND_CLAIMS_UNSAVED_ARTIFACT", "SAVED_ARTIFACT_MISSING"} and record.get("stop_class") != "ARTIFACT_TRUTH_STOP":
        errors.append("artifact truth stop must use ARTIFACT_TRUTH_STOP")
    if record.get("stop_class") == "ARTIFACT_TRUTH_STOP" and record.get("product_reality_review_required") is not True:
        errors.append("artifact truth stop requires product reality review")

    law_text = " ".join(str(item) for item in [
        record.get("trigger_condition", ""),
        record.get("required_evidence", ""),
        record.get("stop_reason_summary", ""),
    ]).upper()
    if "NO_PRETTY_DEMOS" not in law_text:
        errors.append("no-pretty-demo law omitted")

    return {
        "valid": not errors,
        "errors": errors,
        "schema_version": record.get("schema_version"),
        "stop_id": record.get("stop_id"),
        "packet_hash": stable_hash(record) if isinstance(record, dict) else None,
    }


def build_valid_red_fixture() -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "stop_id": "STOP-FRONTEND-CLAIMS-UNSAVED-ARTIFACT",
        "stop_code": "FRONTEND_CLAIMS_UNSAVED_ARTIFACT",
        "stop_class": "ARTIFACT_TRUTH_STOP",
        "severity": "RED",
        "product_area": "product_reality",
        "trigger_condition": "Frontend claims an artifact exists before backend save. NO_PRETTY_DEMOS.",
        "detection_method": "Compare frontend readiness claim to saved backend artifact state.",
        "required_evidence": "Backend artifact id, retrieval response, and UI claim evidence. NO_PRETTY_DEMOS.",
        "blocks_current_sprint": True,
        "blocks_next_sprint": True,
        "blocks_commit": True,
        "blocks_deploy": True,
        "blocks_user_visibility": True,
        "blocks_batch_continuation": True,
        "allows_automatic_repair": False,
        "max_repair_attempts_allowed": 0,
        "human_review_required": True,
        "repair_packet_required": True,
        "product_reality_review_required": True,
        "builder_result_required": True,
        "source_batch_packet_ref_required": True,
        "stop_reason_summary": "Stop protects product reality. NO_PRETTY_DEMOS.",
        "recommended_disposition": "STOP_AND_REQUEST_HUMAN_REVIEW",
        "forbidden_recommendations": list(FORBIDDEN_RECOMMENDATIONS),
        "highest_allowed_readiness": HIGHEST_ALLOWED_READINESS,
        "report_only": True,
        "schema_only": True,
    }


def build_valid_mechanical_fixture() -> Dict[str, Any]:
    fixture = copy.deepcopy(build_valid_red_fixture())
    fixture.update({
        "stop_id": "STOP-JSON-TRACE-INVALID",
        "stop_code": "JSON_TRACE_INVALID",
        "stop_class": "BUILD_VERIFICATION_STOP",
        "severity": "MECHANICAL",
        "trigger_condition": "JSON trace failed validation. NO_PRETTY_DEMOS.",
        "detection_method": "Run json.tool validation.",
        "required_evidence": "JSON parse error and corrected trace check. NO_PRETTY_DEMOS.",
        "blocks_next_sprint": False,
        "blocks_deploy": True,
        "blocks_user_visibility": False,
        "allows_automatic_repair": True,
        "max_repair_attempts_allowed": 2,
        "repair_packet_required": False,
        "product_reality_review_required": False,
        "recommended_disposition": "STOP_AND_REPAIR",
    })
    return fixture


def mutated_fixture(name: str, mutation: Dict[str, Any]) -> Dict[str, Any]:
    fixture = copy.deepcopy(build_valid_red_fixture())
    fixture["stop_id"] = "INVALID-" + name
    if mutation.get("__delete__"):
        for field in mutation["__delete__"]:
            fixture.pop(field, None)
    for key, value in mutation.items():
        if key != "__delete__":
            fixture[key] = value
    return fixture


def build_invalid_fixtures() -> Dict[str, Dict[str, Any]]:
    return {
        "report_only_false": mutated_fixture("report_only_false", {"report_only": False}),
        "schema_only_false": mutated_fixture("schema_only_false", {"schema_only": False}),
        "highest_allowed_readiness_wrong": mutated_fixture("highest_allowed_readiness_wrong", {"highest_allowed_readiness": "READY_FOR_AUTOMATED_BATCH_EXECUTION"}),
        "unknown_field_present": mutated_fixture("unknown_field_present", {"unexpected_runtime_authority": True}),
        "red_allows_automatic_repair": mutated_fixture("red_allows_automatic_repair", {"allows_automatic_repair": True}),
        "red_repair_attempts_gt_zero": mutated_fixture("red_repair_attempts_gt_zero", {"max_repair_attempts_allowed": 1}),
        "red_not_block_current": mutated_fixture("red_not_block_current", {"blocks_current_sprint": False}),
        "red_not_block_next": mutated_fixture("red_not_block_next", {"blocks_next_sprint": False}),
        "red_not_block_commit": mutated_fixture("red_not_block_commit", {"blocks_commit": False}),
        "red_not_block_deploy": mutated_fixture("red_not_block_deploy", {"blocks_deploy": False}),
        "red_not_block_batch": mutated_fixture("red_not_block_batch", {"blocks_batch_continuation": False}),
        "red_no_human_review": mutated_fixture("red_no_human_review", {"human_review_required": False}),
        "red_no_repair_packet": mutated_fixture("red_no_repair_packet", {"repair_packet_required": False}),
        "red_no_product_reality_review": mutated_fixture("red_no_product_reality_review", {"product_reality_review_required": False}),
        "mechanical_repair_attempts_gt_two": mutated_fixture("mechanical_repair_attempts_gt_two", {"severity": "MECHANICAL", "stop_code": "JSON_TRACE_INVALID", "stop_class": "BUILD_VERIFICATION_STOP", "max_repair_attempts_allowed": 3}),
        "stop_code_ready_for_stripe": mutated_fixture("stop_code_ready_for_stripe", {"stop_code": "READY_FOR_STRIPE_BATCH"}),
        "missing_forbidden_ready_for_stripe": mutated_fixture("missing_forbidden_ready_for_stripe", {"forbidden_recommendations": [item for item in FORBIDDEN_RECOMMENDATIONS if item != "READY_FOR_STRIPE_BATCH"]}),
        "missing_forbidden_automation": mutated_fixture("missing_forbidden_automation", {"forbidden_recommendations": [item for item in FORBIDDEN_RECOMMENDATIONS if item != "READY_FOR_AUTOMATED_BATCH_EXECUTION"]}),
        "missing_forbidden_deploy_review": mutated_fixture("missing_forbidden_deploy_review", {"forbidden_recommendations": [item for item in FORBIDDEN_RECOMMENDATIONS if item != "READY_FOR_DEPLOY_REVIEW"]}),
        "frontend_unsaved_not_red": mutated_fixture("frontend_unsaved_not_red", {"severity": "AMBER"}),
        "retrieval_failed_allows_visibility": mutated_fixture("retrieval_failed_allows_visibility", {"stop_code": "RETRIEVAL_FAILED", "stop_class": "RETRIEVAL_TRUTH_STOP", "blocks_user_visibility": False}),
        "raw_json_does_not_block_deploy": mutated_fixture("raw_json_does_not_block_deploy", {"stop_code": "RAW_JSON_OR_DEBUG_OUTPUT_VISIBLE", "stop_class": "RAW_JSON_DEBUG_STOP", "blocks_deploy": False}),
        "placeholder_not_red": mutated_fixture("placeholder_not_red", {"stop_code": "PLACEHOLDER_CONTENT_LEAK", "stop_class": "PLACEHOLDER_LEAK_STOP", "severity": "AMBER"}),
        "payment_ambiguous_not_block_deploy": mutated_fixture("payment_ambiguous_not_block_deploy", {"stop_code": "PAYMENT_STATE_AMBIGUOUS", "stop_class": "PAYMENT_TRUTH_STOP", "blocks_deploy": False}),
        "subscription_ambiguous_not_block_deploy": mutated_fixture("subscription_ambiguous_not_block_deploy", {"stop_code": "SUBSCRIPTION_USAGE_STATE_AMBIGUOUS", "stop_class": "SUBSCRIPTION_TRUTH_STOP", "blocks_deploy": False}),
        "outcome_write_not_block_deploy": mutated_fixture("outcome_write_not_block_deploy", {"stop_code": "OUTCOME_LEDGER_WRITE_FAILED", "stop_class": "OUTCOME_LEDGER_TRUTH_STOP", "blocks_deploy": False}),
        "validation_gate_lowered_not_red": mutated_fixture("validation_gate_lowered_not_red", {"stop_code": "VALIDATION_GATE_LOWERED", "stop_class": "PRODUCT_REALITY_STOP", "severity": "AMBER"}),
        "fake_success_not_red": mutated_fixture("fake_success_not_red", {"stop_code": "FAKE_SUCCESS_CLAIMED", "stop_class": "PRODUCT_REALITY_STOP", "severity": "AMBER"}),
        "source_labels_missing_not_red": mutated_fixture("source_labels_missing_not_red", {"stop_code": "SOURCE_LABELS_DOWNGRADED_OR_MISSING", "stop_class": "SOURCE_LABEL_TRUTH_STOP", "severity": "AMBER"}),
        "missing_required_evidence": mutated_fixture("missing_required_evidence", {"required_evidence": ""}),
        "missing_detection_method": mutated_fixture("missing_detection_method", {"detection_method": ""}),
        "missing_disposition": mutated_fixture("missing_disposition", {"recommended_disposition": ""}),
        "retrieval_allows_visibility": mutated_fixture("retrieval_allows_visibility", {"stop_code": "USER_VISIBLE_FEATURE_NOT_RETRIEVABLE_AFTER_SAVE", "stop_class": "RETRIEVAL_TRUTH_STOP", "blocks_user_visibility": False}),
        "partial_allows_continuation": mutated_fixture("partial_allows_continuation", {"stop_code": "PARTIAL_ARTIFACT_EXPOSED", "stop_class": "ARTIFACT_TRUTH_STOP", "blocks_batch_continuation": False}),
        "file_outside_allows_commit": mutated_fixture("file_outside_allows_commit", {"stop_code": "FILE_OUTSIDE_ALLOWLIST_TOUCHED", "stop_class": "FILE_SCOPE_STOP", "blocks_commit": False}),
        "prod_incomplete_allows_deploy": mutated_fixture("prod_incomplete_allows_deploy", {"stop_code": "PRODUCTION_VERIFICATION_INCOMPLETE", "stop_class": "PRODUCTION_VERIFICATION_STOP", "blocks_deploy": False}),
        "deploy_without_approval_allows_deploy": mutated_fixture("deploy_without_approval_allows_deploy", {"stop_code": "DEPLOY_WITHOUT_HUMAN_APPROVAL", "stop_class": "HUMAN_APPROVAL_STOP", "blocks_deploy": False}),
        "mechanical_repair_for_red": mutated_fixture("mechanical_repair_for_red", {"allows_automatic_repair": True}),
        "artifact_truth_no_product_review": mutated_fixture("artifact_truth_no_product_review", {"stop_class": "ARTIFACT_TRUTH_STOP", "product_reality_review_required": False}),
        "no_pretty_demo_law_omitted": mutated_fixture("no_pretty_demo_law_omitted", {"trigger_condition": "Frontend claims artifact before save.", "required_evidence": "Backend artifact id.", "stop_reason_summary": "Stop protects product reality."}),
    }


def run_self_test() -> Dict[str, Any]:
    valid_records = [build_valid_red_fixture(), build_valid_mechanical_fixture()]
    valid_results = [validate_stop_condition_record(record) for record in valid_records]
    invalid_results = {name: validate_stop_condition_record(fixture) for name, fixture in build_invalid_fixtures().items()}
    invalid_failures = [name for name, result in invalid_results.items() if result["valid"]]
    valid_count = sum(1 for result in valid_results if result["valid"])
    status = "passed" if valid_count == len(valid_records) and not invalid_failures else "failed"
    return {
        "sprint": "MM-DL-5",
        "status": status,
        "verdict": EXPECTED_VERDICT if status == "passed" else "MOREMINDMAP_STOP_CONDITION_SCHEMA_SELFTEST_FAILED",
        "classification": EXPECTED_CLASSIFICATION,
        "schema_version": SCHEMA_VERSION,
        "valid_records_passed": valid_count,
        "valid_records_total": len(valid_records),
        "invalid_records_failed_closed": sum(1 for result in invalid_results.values() if not result["valid"]),
        "invalid_records_total": len(invalid_results),
        "invalid_failures": invalid_failures,
        "valid_fixture_hashes": [stable_hash(record) for record in valid_records],
        "invalid_fixture_hashes": {name: result["packet_hash"] for name, result in invalid_results.items()},
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
    with open("runtime_traces/moremindmap_stop_condition_schema_selftest_05.json", "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, sort_keys=True)
        handle.write("\n")


def main(argv: List[str]) -> int:
    if "--self-test" not in argv:
        print("usage: python3 moremindmap_stop_condition_schema.py --self-test")
        return 2
    summary = run_self_test()
    write_self_test_trace(summary)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0 if summary["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

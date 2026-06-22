"""MORE MindMap Product Reality Review Packet Schema, report-only.

This module defines pure validation helpers for future product reality review
packets. It does not execute batches, create routes, call networks, read
environment variables, or mutate production state.
"""

import copy
import datetime
import hashlib
import json
import sys
from typing import Any, Dict, List


SCHEMA_VERSION = "moremindmap_product_reality_review_packet_schema_v1"
EXPECTED_VERDICT = "MOREMINDMAP_PRODUCT_REALITY_REVIEW_PACKET_SCHEMA_IMPLEMENTED_WITH_LIMITS"
EXPECTED_CLASSIFICATION = "MOREMINDMAP_PRODUCT_REALITY_REVIEW_PACKET_SCHEMA_DEFINED_WITH_LIMITS"
HIGHEST_ALLOWED_READINESS = "READY_FOR_HUMAN_REVIEW_OF_MOREMINDMAP_PRODUCT_REALITY_REVIEW_PACKET_SCHEMA"

REQUIRED_FIELDS = [
    "schema_version",
    "review_id",
    "review_class",
    "batch_id",
    "sprint_id",
    "source_batch_packet_ref",
    "source_builder_result_ref",
    "source_builder_result_digest",
    "reviewer_name",
    "review_summary",
    "product_area",
    "user_visible_surface_changed",
    "backend_behavior_changed",
    "frontend_behavior_changed",
    "api_behavior_changed",
    "payment_behavior_changed",
    "subscription_behavior_changed",
    "outcome_ledger_behavior_changed",
    "assessment_generation_changed",
    "artifact_generation_changed",
    "production_deploy_reviewed",
    "production_url",
    "local_build_result",
    "route_verification",
    "retrieval_verification",
    "artifact_save_verification",
    "artifact_retrieve_verification",
    "controlled_failure_verification",
    "raw_json_debug_verification",
    "banned_placeholder_verification",
    "source_label_integrity_verification",
    "payment_state_verification",
    "subscription_state_verification",
    "outcome_ledger_verification",
    "mobile_visual_review",
    "desktop_visual_review",
    "screenshot_review",
    "design_grade",
    "trust_grade",
    "product_reality_grade",
    "failure_modes_found",
    "unresolved_risks",
    "required_repairs",
    "stop_conditions_triggered",
    "approval_status",
    "recommendation",
    "highest_allowed_readiness",
    "report_only",
    "schema_only",
]

VALID_REVIEW_CLASSES = [
    "REPORT_ONLY_PRODUCT_REALITY_REVIEW",
    "DESIGN_REVIEW_PACKET",
    "ROUTE_RETRIEVAL_REVIEW_PACKET",
    "ARTIFACT_TRUTH_REVIEW_PACKET",
    "PAYMENT_REALITY_REVIEW_PACKET",
    "SUBSCRIPTION_REALITY_REVIEW_PACKET",
    "OUTCOME_LEDGER_REALITY_REVIEW_PACKET",
    "PRODUCTION_DEPLOYMENT_REVIEW_PACKET",
    "BLOCKED_PRODUCT_REALITY_REVIEW",
]

VALID_GRADES = ["A_PLUS", "A", "B", "C", "FAIL", "NOT_REVIEWED", "NOT_APPLICABLE"]
VALID_APPROVAL_STATUS = [
    "APPROVED_WITH_LIMITS",
    "BLOCKED_WITH_REASON",
    "NEEDS_REPAIR",
    "NEEDS_HUMAN_REVIEW",
    "NOT_APPROVED",
]
VALID_RECOMMENDATIONS = [
    "HUMAN_REVIEW_REQUIRED",
    "READY_FOR_REPAIR_PACKET",
    "BLOCKED_WITH_REASON",
    "READY_FOR_COMMIT_REVIEW",
    "READY_FOR_DEPLOY_REVIEW",
]
FORBIDDEN_RECOMMENDATIONS = [
    "READY_FOR_STRIPE_BATCH",
    "READY_FOR_AUTOMATED_BATCH_EXECUTION",
    "READY_FOR_PRODUCTION_DEPLOY_WITHOUT_HUMAN_APPROVAL",
]

PRODUCT_REALITY_LAW = [
    "NO_PRETTY_DEMOS",
    "EVERYTHING_MUST_BE_REAL",
    "EVERYTHING_MUST_WORK",
    "EVERY_SAVED_ARTIFACT_RETRIEVABLE",
    "FAILED_LAYERS_PRESERVE_STATE",
    "GENERATION_FAILURES_RETURN_CONTROLLED_DIAGNOSTICS",
    "VISIBLE_CLAIMS_SOURCE_BACKED_OR_MISSING_DATA_ADMITTED",
    "NO_FAKE_CONFIDENCE",
    "NO_DECORATIVE_INTELLIGENCE",
    "NO_FRONTEND_ILLUSION_HIDING_BACKEND_WEAKNESS",
]

REQUIRED_VERIFICATION_FIELDS = ["required", "status", "passed", "evidence", "notes"]


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def stable_hash(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def non_empty(value: Any) -> bool:
    return value is not None and value != "" and value != []


def verification_passed(value: Any) -> bool:
    return isinstance(value, dict) and value.get("required") is True and value.get("passed") is True


def verification_present(value: Any) -> bool:
    return isinstance(value, dict) and all(field in value for field in REQUIRED_VERIFICATION_FIELDS)


def make_check(name: str, passed: bool = True, required: bool = True, evidence: str = "Report-only evidence.") -> Dict[str, Any]:
    return {
        "required": required,
        "status": "passed" if passed else "failed",
        "passed": passed,
        "evidence": evidence,
        "notes": name + " verification object."
    }


def validate_review_packet(packet: Dict[str, Any]) -> Dict[str, Any]:
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
    for field in ["review_id", "batch_id", "sprint_id", "source_batch_packet_ref", "source_builder_result_ref", "source_builder_result_digest", "reviewer_name", "review_summary", "product_area"]:
        if not non_empty(packet.get(field)):
            errors.append(field + " missing")

    if packet.get("review_class") not in VALID_REVIEW_CLASSES:
        errors.append("review_class is not recognized")
    if packet.get("highest_allowed_readiness") != HIGHEST_ALLOWED_READINESS:
        errors.append("highest_allowed_readiness is not allowed")
    if packet.get("report_only") is not True:
        errors.append("report_only must be true")
    if packet.get("schema_only") is not True:
        errors.append("schema_only must be true")

    for field in ["design_grade", "trust_grade", "product_reality_grade"]:
        if packet.get(field) not in VALID_GRADES:
            errors.append(field + " is not recognized")
    if packet.get("approval_status") not in VALID_APPROVAL_STATUS:
        errors.append("approval_status is not recognized")
    if packet.get("approval_status") != "NEEDS_HUMAN_REVIEW":
        errors.append("MM-DL-4 fixture approval_status must be NEEDS_HUMAN_REVIEW")

    if packet.get("recommendation") in FORBIDDEN_RECOMMENDATIONS:
        errors.append("recommendation is forbidden")
    if packet.get("recommendation") not in VALID_RECOMMENDATIONS:
        errors.append("recommendation is not recognized")
    if packet.get("recommendation") != "HUMAN_REVIEW_REQUIRED":
        errors.append("MM-DL-4 fixture recommendation must be HUMAN_REVIEW_REQUIRED")

    verification_fields = [
        "local_build_result",
        "route_verification",
        "retrieval_verification",
        "artifact_save_verification",
        "artifact_retrieve_verification",
        "controlled_failure_verification",
        "raw_json_debug_verification",
        "banned_placeholder_verification",
        "source_label_integrity_verification",
        "payment_state_verification",
        "subscription_state_verification",
        "outcome_ledger_verification",
        "mobile_visual_review",
        "desktop_visual_review",
        "screenshot_review",
    ]
    for field in verification_fields:
        if not verification_present(packet.get(field)):
            errors.append(field + " must include required/status/passed/evidence/notes")

    required_truth_checks = [
        "artifact_save_verification",
        "artifact_retrieve_verification",
        "controlled_failure_verification",
        "raw_json_debug_verification",
        "banned_placeholder_verification",
        "source_label_integrity_verification",
    ]
    for field in required_truth_checks:
        if not verification_passed(packet.get(field)):
            errors.append(field + " must be required and passed")

    if packet.get("payment_behavior_changed") is True and not verification_passed(packet.get("payment_state_verification")):
        errors.append("payment behavior changes require payment_state_verification passed")
    if packet.get("subscription_behavior_changed") is True and not verification_passed(packet.get("subscription_state_verification")):
        errors.append("subscription behavior changes require subscription_state_verification passed")
    if packet.get("outcome_ledger_behavior_changed") is True and not verification_passed(packet.get("outcome_ledger_verification")):
        errors.append("outcome ledger behavior changes require outcome_ledger_verification passed")
    if packet.get("user_visible_surface_changed") is True and not verification_passed(packet.get("screenshot_review")):
        errors.append("user visible surface changes require screenshot_review passed")
    if packet.get("user_visible_surface_changed") is True and not verification_passed(packet.get("mobile_visual_review")):
        errors.append("user visible surface changes require mobile_visual_review passed")
    if packet.get("user_visible_surface_changed") is True and not verification_passed(packet.get("desktop_visual_review")):
        errors.append("user visible surface changes require desktop_visual_review passed")
    if packet.get("production_deploy_reviewed") is True and not non_empty(packet.get("production_url")):
        errors.append("production_deploy_reviewed requires production_url")

    if packet.get("backend_behavior_changed") is True or packet.get("assessment_generation_changed") is True or packet.get("artifact_generation_changed") is True:
        if not verification_passed(packet.get("controlled_failure_verification")):
            errors.append("backend/generation changes require controlled failure verification")

    failure_modes = as_list(packet.get("failure_modes_found"))
    unresolved = as_list(packet.get("unresolved_risks"))
    repairs = as_list(packet.get("required_repairs"))
    stops = as_list(packet.get("stop_conditions_triggered"))

    if packet.get("approval_status") == "APPROVED_WITH_LIMITS":
        failed = [field for field in verification_fields if isinstance(packet.get(field), dict) and packet[field].get("required") is True and packet[field].get("passed") is False]
        if failed:
            errors.append("approval_status cannot be approved while required verification failed")
    if isinstance(packet.get("artifact_retrieve_verification"), dict) and packet["artifact_retrieve_verification"].get("passed") is False and packet.get("approval_status") == "APPROVED_WITH_LIMITS":
        errors.append("artifact retrieval failure cannot be approved")

    if isinstance(packet.get("artifact_save_verification"), dict):
        evidence = str(packet["artifact_save_verification"].get("evidence", "")).lower()
        if "frontend claims success while backend artifact missing" in evidence:
            errors.append("frontend success cannot outrun backend artifact save")
    if any("frontend claims success while backend artifact missing" in str(item).lower() for item in failure_modes):
        errors.append("frontend success cannot outrun backend artifact save")

    if failure_modes and not any("failure" in str(item).lower() or "diagnostic" in str(item).lower() for item in as_list(packet.get("required_repairs")) + as_list(packet.get("unresolved_risks"))):
        errors.append("failure diagnostics missing when failure occurred")

    if packet.get("design_grade") == "A_PLUS" and unresolved:
        errors.append("design grade A_PLUS cannot have unresolved risks")
    if packet.get("product_reality_grade") == "A_PLUS" and isinstance(packet.get("artifact_retrieve_verification"), dict) and packet["artifact_retrieve_verification"].get("passed") is False:
        errors.append("product reality grade A_PLUS cannot have failed retrieval")
    if packet.get("trust_grade") == "A_PLUS" and isinstance(packet.get("banned_placeholder_verification"), dict) and packet["banned_placeholder_verification"].get("passed") is False:
        errors.append("trust grade A_PLUS cannot have placeholder leak")

    source_evidence = str(packet.get("source_label_integrity_verification", {}).get("evidence", "")).lower() if isinstance(packet.get("source_label_integrity_verification"), dict) else ""
    if "downgraded" in source_evidence or "missing" in source_evidence:
        errors.append("source labels cannot be downgraded or missing")
    if "model estimate presented as user-provided" in source_evidence:
        errors.append("model estimate cannot be presented as user-provided")
    if "insufficient data hidden" in source_evidence:
        errors.append("insufficient data cannot be hidden")

    joined_failures = " ".join(str(item).lower() for item in failure_modes + unresolved + repairs)
    if "partial artifact exposed" in joined_failures:
        errors.append("partial artifact cannot be exposed")
    if "fake confidence allowed" in joined_failures:
        errors.append("fake confidence cannot be allowed")
    if "decorative intelligence approved" in joined_failures:
        errors.append("decorative intelligence cannot be approved")
    if "frontend-only success approved" in joined_failures:
        errors.append("frontend-only success cannot be approved")

    if stops and packet.get("recommendation") == "READY_FOR_COMMIT_REVIEW":
        errors.append("triggered stop conditions cannot recommend commit review")
    if any("runtime error" in str(item).lower() for item in failure_modes) and packet.get("recommendation") == "READY_FOR_DEPLOY_REVIEW":
        errors.append("runtime errors cannot recommend deploy review")
    if "production verification incomplete" in joined_failures and packet.get("recommendation") == "READY_FOR_DEPLOY_REVIEW":
        errors.append("production verification incomplete cannot recommend deploy review")
    if "payment webhook unverified" in joined_failures and packet.get("recommendation") == "READY_FOR_DEPLOY_REVIEW":
        errors.append("payment webhook unverified cannot recommend deploy review")
    if "subscription state ambiguous" in joined_failures and packet.get("recommendation") == "READY_FOR_DEPLOY_REVIEW":
        errors.append("subscription ambiguity cannot recommend deploy review")
    if "outcome ledger write unverified" in joined_failures and packet.get("recommendation") == "READY_FOR_DEPLOY_REVIEW":
        errors.append("outcome ledger write unverified cannot recommend deploy review")

    law_text = " ".join(str(item) for item in as_list(packet.get("required_repairs")) + as_list(packet.get("unresolved_risks")) + [packet.get("review_summary", "")]).upper()
    if "NO_PRETTY_DEMOS" not in law_text:
        errors.append("no-pretty-demo law omitted")

    return {
        "valid": not errors,
        "errors": errors,
        "schema_version": packet.get("schema_version"),
        "review_id": packet.get("review_id"),
        "packet_hash": stable_hash(packet) if isinstance(packet, dict) else None,
    }


def build_valid_fixture() -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "review_id": "MM-DL-4-REVIEW-FIXTURE",
        "review_class": "REPORT_ONLY_PRODUCT_REALITY_REVIEW",
        "batch_id": "MM-DL-4",
        "sprint_id": "MM-DL-4",
        "source_batch_packet_ref": "runtime_traces/moremindmap_sprint_batch_packet_schema_02.json",
        "source_builder_result_ref": "runtime_traces/moremindmap_codex_builder_result_packet_schema_03.json",
        "source_builder_result_digest": "56e9493",
        "reviewer_name": "Product Reality Reviewer",
        "review_summary": "Report-only schema review preserving NO_PRETTY_DEMOS product law.",
        "product_area": "development_loop_doctrine",
        "user_visible_surface_changed": False,
        "backend_behavior_changed": False,
        "frontend_behavior_changed": False,
        "api_behavior_changed": False,
        "payment_behavior_changed": False,
        "subscription_behavior_changed": False,
        "outcome_ledger_behavior_changed": False,
        "assessment_generation_changed": False,
        "artifact_generation_changed": False,
        "production_deploy_reviewed": False,
        "production_url": "",
        "local_build_result": make_check("local_build_result"),
        "route_verification": make_check("route_verification", evidence="No route changes."),
        "retrieval_verification": make_check("retrieval_verification", evidence="No retrieval behavior changed."),
        "artifact_save_verification": make_check("artifact_save_verification", evidence="No product artifact save behavior changed."),
        "artifact_retrieve_verification": make_check("artifact_retrieve_verification", evidence="No product artifact retrieval behavior changed."),
        "controlled_failure_verification": make_check("controlled_failure_verification", evidence="No generation path changed."),
        "raw_json_debug_verification": make_check("raw_json_debug_verification", evidence="No raw JSON/debug surface added."),
        "banned_placeholder_verification": make_check("banned_placeholder_verification", evidence="No placeholder product content added."),
        "source_label_integrity_verification": make_check("source_label_integrity_verification", evidence="Source labels unchanged and honest."),
        "payment_state_verification": make_check("payment_state_verification", required=False, evidence="No payment behavior changed."),
        "subscription_state_verification": make_check("subscription_state_verification", required=False, evidence="No subscription behavior changed."),
        "outcome_ledger_verification": make_check("outcome_ledger_verification", required=False, evidence="No Outcome Ledger behavior changed."),
        "mobile_visual_review": make_check("mobile_visual_review", required=False, evidence="No user-visible surface changed."),
        "desktop_visual_review": make_check("desktop_visual_review", required=False, evidence="No user-visible surface changed."),
        "screenshot_review": make_check("screenshot_review", required=False, evidence="No user-visible surface changed."),
        "design_grade": "NOT_APPLICABLE",
        "trust_grade": "A",
        "product_reality_grade": "A",
        "failure_modes_found": [],
        "unresolved_risks": ["NO_PRETTY_DEMOS law remains binding for future review packets."],
        "required_repairs": [],
        "stop_conditions_triggered": [],
        "approval_status": "NEEDS_HUMAN_REVIEW",
        "recommendation": "HUMAN_REVIEW_REQUIRED",
        "highest_allowed_readiness": HIGHEST_ALLOWED_READINESS,
        "report_only": True,
        "schema_only": True,
    }


def mutated_fixture(name: str, mutation: Dict[str, Any]) -> Dict[str, Any]:
    fixture = copy.deepcopy(build_valid_fixture())
    fixture["review_id"] = "INVALID-" + name
    if mutation.get("__delete__"):
        for field in mutation["__delete__"]:
            fixture.pop(field, None)
    for key, value in mutation.items():
        if key != "__delete__":
            fixture[key] = value
    return fixture


def build_invalid_fixtures() -> Dict[str, Dict[str, Any]]:
    failed = make_check("failed", passed=False)
    missing = {}
    return {
        "report_only_false": mutated_fixture("report_only_false", {"report_only": False}),
        "schema_only_false": mutated_fixture("schema_only_false", {"schema_only": False}),
        "highest_allowed_readiness_wrong": mutated_fixture("highest_allowed_readiness_wrong", {"highest_allowed_readiness": "READY_FOR_AUTOMATED_BATCH_EXECUTION"}),
        "recommendation_ready_for_stripe": mutated_fixture("recommendation_ready_for_stripe", {"recommendation": "READY_FOR_STRIPE_BATCH"}),
        "recommendation_ready_for_automation": mutated_fixture("recommendation_ready_for_automation", {"recommendation": "READY_FOR_AUTOMATED_BATCH_EXECUTION"}),
        "recommendation_ready_for_deploy_without_human": mutated_fixture("recommendation_ready_for_deploy_without_human", {"recommendation": "READY_FOR_PRODUCTION_DEPLOY_WITHOUT_HUMAN_APPROVAL"}),
        "approved_with_failed_verification": mutated_fixture("approved_with_failed_verification", {"approval_status": "APPROVED_WITH_LIMITS", "artifact_save_verification": failed}),
        "artifact_retrieve_failed_but_approved": mutated_fixture("artifact_retrieve_failed_but_approved", {"approval_status": "APPROVED_WITH_LIMITS", "artifact_retrieve_verification": failed}),
        "frontend_claims_unsaved_artifact": mutated_fixture("frontend_claims_unsaved_artifact", {"failure_modes_found": ["frontend claims success while backend artifact missing"], "required_repairs": ["failure diagnostic required"]}),
        "raw_json_debug_check_missing": mutated_fixture("raw_json_debug_check_missing", {"raw_json_debug_verification": missing}),
        "banned_placeholder_check_missing": mutated_fixture("banned_placeholder_check_missing", {"banned_placeholder_verification": missing}),
        "source_label_integrity_check_missing": mutated_fixture("source_label_integrity_check_missing", {"source_label_integrity_verification": missing}),
        "payment_changed_payment_check_missing": mutated_fixture("payment_changed_payment_check_missing", {"payment_behavior_changed": True, "payment_state_verification": failed}),
        "subscription_changed_subscription_check_missing": mutated_fixture("subscription_changed_subscription_check_missing", {"subscription_behavior_changed": True, "subscription_state_verification": failed}),
        "outcome_changed_outcome_check_missing": mutated_fixture("outcome_changed_outcome_check_missing", {"outcome_ledger_behavior_changed": True, "outcome_ledger_verification": failed}),
        "surface_changed_screenshot_missing": mutated_fixture("surface_changed_screenshot_missing", {"user_visible_surface_changed": True, "screenshot_review": failed}),
        "surface_changed_mobile_missing": mutated_fixture("surface_changed_mobile_missing", {"user_visible_surface_changed": True, "mobile_visual_review": failed}),
        "surface_changed_desktop_missing": mutated_fixture("surface_changed_desktop_missing", {"user_visible_surface_changed": True, "desktop_visual_review": failed}),
        "production_reviewed_url_missing": mutated_fixture("production_reviewed_url_missing", {"production_deploy_reviewed": True, "production_url": ""}),
        "production_deploy_approved_without_human_review": mutated_fixture("production_deploy_approved_without_human_review", {"approval_status": "APPROVED_WITH_LIMITS"}),
        "controlled_failure_missing_after_generation_change": mutated_fixture("controlled_failure_missing_after_generation_change", {"artifact_generation_changed": True, "controlled_failure_verification": failed}),
        "failure_diagnostics_missing_when_failure_occurred": mutated_fixture("failure_diagnostics_missing_when_failure_occurred", {"failure_modes_found": ["generation failure occurred"], "required_repairs": [], "unresolved_risks": []}),
        "design_aplus_with_unresolved_risks": mutated_fixture("design_aplus_with_unresolved_risks", {"design_grade": "A_PLUS", "unresolved_risks": ["NO_PRETTY_DEMOS unresolved visual risk"]}),
        "product_reality_aplus_failed_retrieval": mutated_fixture("product_reality_aplus_failed_retrieval", {"product_reality_grade": "A_PLUS", "artifact_retrieve_verification": failed}),
        "trust_aplus_placeholder_leak": mutated_fixture("trust_aplus_placeholder_leak", {"trust_grade": "A_PLUS", "banned_placeholder_verification": failed}),
        "source_labels_downgraded": mutated_fixture("source_labels_downgraded", {"source_label_integrity_verification": make_check("source_label_integrity_verification", evidence="source labels downgraded")}),
        "model_estimate_as_user_provided": mutated_fixture("model_estimate_as_user_provided", {"source_label_integrity_verification": make_check("source_label_integrity_verification", evidence="model estimate presented as user-provided")}),
        "insufficient_data_hidden": mutated_fixture("insufficient_data_hidden", {"source_label_integrity_verification": make_check("source_label_integrity_verification", evidence="insufficient data hidden")}),
        "partial_artifact_exposed": mutated_fixture("partial_artifact_exposed", {"failure_modes_found": ["partial artifact exposed"], "required_repairs": ["failure diagnostic required"]}),
        "unknown_field_present": mutated_fixture("unknown_field_present", {"unexpected_runtime_authority": True}),
        "stop_conditions_commit_ready": mutated_fixture("stop_conditions_commit_ready", {"stop_conditions_triggered": ["BUILD_FAILED"], "recommendation": "READY_FOR_COMMIT_REVIEW"}),
        "runtime_errors_deploy_ready": mutated_fixture("runtime_errors_deploy_ready", {"failure_modes_found": ["runtime error visible"], "recommendation": "READY_FOR_DEPLOY_REVIEW", "required_repairs": ["failure diagnostic required"]}),
        "production_incomplete_deploy_ready": mutated_fixture("production_incomplete_deploy_ready", {"failure_modes_found": ["production verification incomplete"], "recommendation": "READY_FOR_DEPLOY_REVIEW", "required_repairs": ["failure diagnostic required"]}),
        "payment_webhook_unverified_deploy_ready": mutated_fixture("payment_webhook_unverified_deploy_ready", {"failure_modes_found": ["payment webhook unverified"], "recommendation": "READY_FOR_DEPLOY_REVIEW", "required_repairs": ["failure diagnostic required"]}),
        "subscription_ambiguous_deploy_ready": mutated_fixture("subscription_ambiguous_deploy_ready", {"failure_modes_found": ["subscription state ambiguous"], "recommendation": "READY_FOR_DEPLOY_REVIEW", "required_repairs": ["failure diagnostic required"]}),
        "outcome_write_unverified_deploy_ready": mutated_fixture("outcome_write_unverified_deploy_ready", {"failure_modes_found": ["outcome ledger write unverified"], "recommendation": "READY_FOR_DEPLOY_REVIEW", "required_repairs": ["failure diagnostic required"]}),
        "fake_confidence_allowed": mutated_fixture("fake_confidence_allowed", {"failure_modes_found": ["fake confidence allowed"], "required_repairs": ["failure diagnostic required"]}),
        "decorative_intelligence_approved": mutated_fixture("decorative_intelligence_approved", {"failure_modes_found": ["decorative intelligence approved"], "required_repairs": ["failure diagnostic required"]}),
        "frontend_only_success_approved": mutated_fixture("frontend_only_success_approved", {"failure_modes_found": ["frontend-only success approved"], "required_repairs": ["failure diagnostic required"]}),
        "no_pretty_demo_law_omitted": mutated_fixture("no_pretty_demo_law_omitted", {"review_summary": "Report-only schema review.", "unresolved_risks": [], "required_repairs": []}),
    }


def run_self_test() -> Dict[str, Any]:
    valid_fixture = build_valid_fixture()
    valid_result = validate_review_packet(valid_fixture)
    invalid_results = {
        name: validate_review_packet(fixture)
        for name, fixture in build_invalid_fixtures().items()
    }
    invalid_failures = [name for name, result in invalid_results.items() if result["valid"]]
    status = "passed" if valid_result["valid"] and not invalid_failures else "failed"
    return {
        "sprint": "MM-DL-4",
        "status": status,
        "verdict": EXPECTED_VERDICT if status == "passed" else "MOREMINDMAP_PRODUCT_REALITY_REVIEW_PACKET_SCHEMA_SELFTEST_FAILED",
        "classification": EXPECTED_CLASSIFICATION,
        "schema_version": SCHEMA_VERSION,
        "valid_records_passed": 1 if valid_result["valid"] else 0,
        "invalid_records_failed_closed": sum(1 for result in invalid_results.values() if not result["valid"]),
        "invalid_records_total": len(invalid_results),
        "invalid_failures": invalid_failures,
        "valid_fixture_hash": stable_hash(valid_fixture),
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
    with open("runtime_traces/moremindmap_product_reality_review_packet_schema_selftest_04.json", "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, sort_keys=True)
        handle.write("\n")


def main(argv: List[str]) -> int:
    if "--self-test" not in argv:
        print("usage: python3 moremindmap_product_reality_review_packet_schema.py --self-test")
        return 2
    summary = run_self_test()
    write_self_test_trace(summary)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0 if summary["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

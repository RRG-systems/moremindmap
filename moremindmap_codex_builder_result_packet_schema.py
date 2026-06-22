"""MORE MindMap Codex Builder Result Packet Schema, report-only.

This module defines pure validation helpers for future Codex builder result
packets. It does not execute batches, create routes, call networks, read
environment variables, or mutate production state.
"""

import copy
import datetime
import hashlib
import json
import sys
from typing import Any, Dict, List


SCHEMA_VERSION = "moremindmap_codex_builder_result_packet_schema_v1"
EXPECTED_VERDICT = "MOREMINDMAP_CODEX_BUILDER_RESULT_PACKET_SCHEMA_IMPLEMENTED_WITH_LIMITS"
EXPECTED_CLASSIFICATION = "MOREMINDMAP_CODEX_BUILDER_RESULT_PACKET_SCHEMA_DEFINED_WITH_LIMITS"
HIGHEST_ALLOWED_READINESS = "READY_FOR_HUMAN_REVIEW_OF_MOREMINDMAP_CODEX_BUILDER_RESULT_PACKET_SCHEMA"

REQUIRED_FIELDS = [
    "schema_version",
    "result_id",
    "result_class",
    "batch_id",
    "sprint_id",
    "source_batch_packet_ref",
    "source_batch_packet_digest",
    "builder_name",
    "task_summary",
    "files_changed",
    "files_created",
    "files_modified",
    "files_deleted",
    "allowed_files",
    "forbidden_files",
    "touched_files_outside_allowlist",
    "code_changed",
    "docs_changed",
    "schema_changed",
    "tests_run",
    "verification_commands",
    "verification_results",
    "build_result",
    "route_checks",
    "retrieval_checks",
    "artifact_save_retrieve_checks",
    "raw_json_debug_check",
    "banned_placeholder_check",
    "source_label_integrity_check",
    "payment_state_check",
    "subscription_state_check",
    "outcome_ledger_check",
    "production_deploy_run",
    "production_deploy_allowed",
    "production_deploy_approved_by_human",
    "production_url",
    "runtime_errors",
    "failure_diagnostics",
    "unresolved_risks",
    "stop_conditions_triggered",
    "repair_attempts_used",
    "final_git_status",
    "recommendation",
    "highest_allowed_readiness",
    "report_only",
    "schema_only",
]

VALID_RESULT_CLASSES = [
    "REPORT_ONLY_SCHEMA_RESULT",
    "TRACE_ONLY_RESULT",
    "LOW_RISK_DOCS_RESULT",
    "LOW_RISK_FRONTEND_COPY_RESULT",
    "LOW_RISK_BACKEND_TRACE_RESULT",
    "CONTROLLED_PRODUCT_BUILD_RESULT",
    "PAYMENT_PLUMBING_RESULT_CANDIDATE",
    "NOTIFICATION_PLUMBING_RESULT_CANDIDATE",
    "SUBSCRIPTION_ARCHITECTURE_RESULT_CANDIDATE",
    "OUTCOME_LEDGER_RESULT_CANDIDATE",
    "RECRUITING_INTELLIGENCE_RESULT_CANDIDATE",
    "BLOCKED_WITH_REASON",
]

RECOMMENDATION_VALUES = [
    "HUMAN_REVIEW_REQUIRED",
    "BLOCKED_WITH_REASON",
    "READY_FOR_COMMIT_REVIEW",
    "READY_FOR_DEPLOY_REVIEW",
    "READY_FOR_REPAIR_PACKET",
]

FORBIDDEN_RECOMMENDATIONS = [
    "READY_FOR_STRIPE_BATCH",
    "READY_FOR_AUTOMATED_BATCH_EXECUTION",
    "READY_FOR_PRODUCTION_DEPLOY_WITHOUT_HUMAN_APPROVAL",
]

REQUIRED_VERIFICATION_CHECKS = [
    "self_test",
    "json_validation",
    "py_compile_if_python_changed",
    "import_time_behavior_if_python_changed",
    "capability_scan_if_python_changed",
    "git_diff_check",
    "npm_build",
    "footprint_check",
]

REQUIRED_SAFETY_CHECK_FIELDS = [
    "raw_json_debug_check",
    "banned_placeholder_check",
    "source_label_integrity_check",
]

PAYMENT_TERMS = ["payment", "stripe"]
SUBSCRIPTION_TERMS = ["subscription"]
OUTCOME_TERMS = ["outcome_ledger", "outcome-ledger", "outcome ledger"]


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def stable_hash(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def non_empty(value: Any) -> bool:
    return value is not None and value != "" and value != []


def check_passed(check: Any) -> bool:
    return isinstance(check, dict) and check.get("required") is True and check.get("passed") is True


def verification_names(packet: Dict[str, Any]) -> List[str]:
    names: List[str] = []
    for item in as_list(packet.get("verification_results")):
        if isinstance(item, dict):
            names.append(str(item.get("command", "")))
    return names


def file_terms_touched(packet: Dict[str, Any], terms: List[str]) -> bool:
    values = [
        str(item).lower()
        for field in ["files_changed", "files_created", "files_modified", "files_deleted"]
        for item in as_list(packet.get(field))
    ]
    joined = " ".join(values)
    return any(term in joined for term in terms)


def validate_verification_result_shape(packet: Dict[str, Any], errors: List[str]) -> None:
    for index, item in enumerate(as_list(packet.get("verification_results"))):
        if not isinstance(item, dict):
            errors.append("verification_results item is not an object at index " + str(index))
            continue
        for field in ["command", "status", "summary", "required", "passed", "notes"]:
            if field not in item:
                errors.append("verification result missing " + field + " at index " + str(index))


def validate_builder_result_packet(packet: Dict[str, Any]) -> Dict[str, Any]:
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
    for field in ["result_id", "batch_id", "sprint_id", "source_batch_packet_ref", "source_batch_packet_digest", "builder_name", "task_summary"]:
        if not non_empty(packet.get(field)):
            errors.append(field + " missing")

    if packet.get("result_class") not in VALID_RESULT_CLASSES:
        errors.append("result_class is not recognized")
    if "RUNTIME" in str(packet.get("result_class", "")).upper():
        errors.append("result_class must not authorize runtime loop")
    if "AUTOMATION" in str(packet.get("result_class", "")).upper():
        errors.append("result_class must not authorize Codex automation")
    if "ACTIVE_AGENT" in str(packet.get("result_class", "")).upper() or "AGENT" in str(packet.get("result_class", "")).upper():
        errors.append("result_class must not authorize active agents")

    if packet.get("highest_allowed_readiness") != HIGHEST_ALLOWED_READINESS:
        errors.append("highest_allowed_readiness is not allowed")
    if packet.get("report_only") is not True:
        errors.append("report_only must be true")
    if packet.get("schema_only") is not True:
        errors.append("schema_only must be true")
    if packet.get("production_deploy_run") is not False:
        errors.append("production_deploy_run must be false for MM-DL-3 fixtures")
    if packet.get("production_deploy_allowed") is not False:
        errors.append("production_deploy_allowed must be false for MM-DL-3 fixtures")
    if packet.get("production_deploy_approved_by_human") is not False:
        errors.append("production_deploy_approved_by_human must be false for MM-DL-3 fixtures")
    if non_empty(packet.get("production_url")) and packet.get("production_deploy_run") is not True:
        errors.append("production_url cannot be present when deploy did not run")

    if as_list(packet.get("touched_files_outside_allowlist")):
        errors.append("touched_files_outside_allowlist must be empty")
    if as_list(packet.get("files_deleted")):
        errors.append("files_deleted must be empty")
    if not as_list(packet.get("files_changed")):
        errors.append("files_changed must be non-empty")
    if not isinstance(packet.get("repair_attempts_used"), int) or packet.get("repair_attempts_used") > 2:
        errors.append("repair_attempts_used must be an integer <= 2")

    if packet.get("recommendation") in FORBIDDEN_RECOMMENDATIONS:
        errors.append("recommendation is forbidden")
    if packet.get("recommendation") not in RECOMMENDATION_VALUES:
        errors.append("recommendation is not recognized")
    if packet.get("recommendation") != "HUMAN_REVIEW_REQUIRED":
        errors.append("MM-DL-3 fixture recommendation must be HUMAN_REVIEW_REQUIRED")

    for field in ["verification_commands", "verification_results", "final_git_status", "failure_diagnostics"]:
        if not non_empty(packet.get(field)):
            errors.append(field + " missing")
    if not isinstance(packet.get("build_result"), dict) or not packet.get("build_result"):
        errors.append("build_result missing")

    validate_verification_result_shape(packet, errors)
    names = set(verification_names(packet))
    for check_name in REQUIRED_VERIFICATION_CHECKS:
        if check_name not in names:
            errors.append("missing verification check: " + check_name)

    for field in REQUIRED_SAFETY_CHECK_FIELDS:
        if not check_passed(packet.get(field)):
            errors.append(field + " must be present, required, and passed")

    if packet.get("code_changed") is True and not as_list(packet.get("tests_run")):
        errors.append("code_changed requires tests_run")
    if any(str(path).endswith(".py") for path in as_list(packet.get("files_changed"))):
        if "py_compile_if_python_changed" not in names:
            errors.append("Python changes require py_compile verification")
        if "capability_scan_if_python_changed" not in names:
            errors.append("Python changes require capability scan verification")

    if "npm_build" not in names:
        errors.append("npm build verification missing")
    if "git_diff_check" not in names:
        errors.append("git diff check missing")
    if "footprint_check" not in names:
        errors.append("footprint check missing")

    if file_terms_touched(packet, PAYMENT_TERMS) and not check_passed(packet.get("payment_state_check")):
        errors.append("payment files touched require payment_state_check passed")
    if file_terms_touched(packet, SUBSCRIPTION_TERMS) and not check_passed(packet.get("subscription_state_check")):
        errors.append("subscription files touched require subscription_state_check passed")
    if file_terms_touched(packet, OUTCOME_TERMS) and not check_passed(packet.get("outcome_ledger_check")):
        errors.append("outcome ledger files touched require outcome_ledger_check passed")

    if isinstance(packet.get("build_result"), dict) and packet["build_result"].get("passed") is False and packet.get("recommendation") == "READY_FOR_COMMIT_REVIEW":
        errors.append("failed build cannot recommend commit review")
    if as_list(packet.get("stop_conditions_triggered")) and packet.get("recommendation") == "READY_FOR_COMMIT_REVIEW":
        errors.append("triggered stop conditions cannot recommend commit review")
    if as_list(packet.get("runtime_errors")) and packet.get("recommendation") == "READY_FOR_COMMIT_REVIEW":
        errors.append("runtime errors cannot recommend commit review")

    return {
        "valid": not errors,
        "errors": errors,
        "schema_version": packet.get("schema_version"),
        "result_id": packet.get("result_id"),
        "packet_hash": stable_hash(packet) if isinstance(packet, dict) else None,
    }


def verification_result(command: str, summary: str = "passed") -> Dict[str, Any]:
    return {
        "command": command,
        "status": "passed",
        "summary": summary,
        "required": True,
        "passed": True,
        "notes": "Report-only schema verification."
    }


def safety_check(name: str) -> Dict[str, Any]:
    return {
        "command": name,
        "status": "passed",
        "summary": name + " passed",
        "required": True,
        "passed": True,
        "notes": "No product runtime behavior changed."
    }


def build_valid_fixture() -> Dict[str, Any]:
    files = [
        "moremindmap_codex_builder_result_packet_schema.py",
        "MOREMINDMAP_CODEX_BUILDER_RESULT_PACKET_SCHEMA_REPORT_ONLY.md",
        "runtime_traces/moremindmap_codex_builder_result_packet_schema_03.json",
        "runtime_traces/moremindmap_codex_builder_result_packet_schema_selftest_03.json",
    ]
    checks = [
        verification_result("self_test"),
        verification_result("json_validation"),
        verification_result("py_compile_if_python_changed"),
        verification_result("import_time_behavior_if_python_changed"),
        verification_result("capability_scan_if_python_changed"),
        verification_result("git_diff_check"),
        verification_result("npm_build"),
        verification_result("footprint_check"),
    ]
    return {
        "schema_version": SCHEMA_VERSION,
        "result_id": "MM-DL-3-RESULT-FIXTURE",
        "result_class": "REPORT_ONLY_SCHEMA_RESULT",
        "batch_id": "MM-DL-3",
        "sprint_id": "MM-DL-3",
        "source_batch_packet_ref": "runtime_traces/moremindmap_sprint_batch_packet_schema_02.json",
        "source_batch_packet_digest": "4cc547e",
        "builder_name": "Codex Builder",
        "task_summary": "Define report-only Codex Builder Result Packet Schema.",
        "files_changed": files,
        "files_created": files,
        "files_modified": [],
        "files_deleted": [],
        "allowed_files": files,
        "forbidden_files": ["src/**", "api/**", "package.json", "vercel.json"],
        "touched_files_outside_allowlist": [],
        "code_changed": True,
        "docs_changed": True,
        "schema_changed": True,
        "tests_run": ["python3 moremindmap_codex_builder_result_packet_schema.py --self-test"],
        "verification_commands": [item["command"] for item in checks],
        "verification_results": checks,
        "build_result": {"command": "npm run build", "status": "passed", "passed": True, "summary": "Build passed with existing Vite chunk warning."},
        "route_checks": [],
        "retrieval_checks": [],
        "artifact_save_retrieve_checks": [],
        "raw_json_debug_check": safety_check("raw_json_debug_check"),
        "banned_placeholder_check": safety_check("banned_placeholder_check"),
        "source_label_integrity_check": safety_check("source_label_integrity_check"),
        "payment_state_check": {"required": False, "passed": True, "status": "not_applicable", "summary": "No payment files touched.", "command": "payment_state_check", "notes": "Not applicable."},
        "subscription_state_check": {"required": False, "passed": True, "status": "not_applicable", "summary": "No subscription files touched.", "command": "subscription_state_check", "notes": "Not applicable."},
        "outcome_ledger_check": {"required": False, "passed": True, "status": "not_applicable", "summary": "No outcome ledger files touched.", "command": "outcome_ledger_check", "notes": "Not applicable."},
        "production_deploy_run": False,
        "production_deploy_allowed": False,
        "production_deploy_approved_by_human": False,
        "production_url": "",
        "runtime_errors": [],
        "failure_diagnostics": [
            {
                "status": "none",
                "summary": "No failures reported by this report-only schema fixture."
            }
        ],
        "unresolved_risks": [],
        "stop_conditions_triggered": [],
        "repair_attempts_used": 0,
        "final_git_status": "MM-DL-3 artifacts only",
        "recommendation": "HUMAN_REVIEW_REQUIRED",
        "highest_allowed_readiness": HIGHEST_ALLOWED_READINESS,
        "report_only": True,
        "schema_only": True,
    }


def mutated_fixture(name: str, mutation: Dict[str, Any]) -> Dict[str, Any]:
    fixture = copy.deepcopy(build_valid_fixture())
    fixture["result_id"] = "INVALID-" + name
    if mutation.get("__delete__"):
        for field in mutation["__delete__"]:
            fixture.pop(field, None)
    for key, value in mutation.items():
        if key != "__delete__":
            fixture[key] = value
    return fixture


def without_verification(command: str) -> List[Dict[str, Any]]:
    return [
        item for item in build_valid_fixture()["verification_results"]
        if item["command"] != command
    ]


def build_invalid_fixtures() -> Dict[str, Dict[str, Any]]:
    return {
        "report_only_false": mutated_fixture("report_only_false", {"report_only": False}),
        "schema_only_false": mutated_fixture("schema_only_false", {"schema_only": False}),
        "production_deploy_run_true": mutated_fixture("production_deploy_run_true", {"production_deploy_run": True}),
        "production_deploy_allowed_true": mutated_fixture("production_deploy_allowed_true", {"production_deploy_allowed": True}),
        "production_deploy_approved_by_human_true": mutated_fixture("production_deploy_approved_by_human_true", {"production_deploy_approved_by_human": True}),
        "outside_allowlist_non_empty": mutated_fixture("outside_allowlist_non_empty", {"touched_files_outside_allowlist": ["src/App.jsx"]}),
        "files_deleted_non_empty": mutated_fixture("files_deleted_non_empty", {"files_deleted": ["src/old.js"]}),
        "repair_attempts_too_high": mutated_fixture("repair_attempts_too_high", {"repair_attempts_used": 3}),
        "highest_allowed_readiness_wrong": mutated_fixture("highest_allowed_readiness_wrong", {"highest_allowed_readiness": "READY_FOR_AUTOMATED_BATCH_EXECUTION"}),
        "recommendation_ready_for_stripe": mutated_fixture("recommendation_ready_for_stripe", {"recommendation": "READY_FOR_STRIPE_BATCH"}),
        "recommendation_ready_for_automation": mutated_fixture("recommendation_ready_for_automation", {"recommendation": "READY_FOR_AUTOMATED_BATCH_EXECUTION"}),
        "recommendation_ready_for_deploy_without_human": mutated_fixture("recommendation_ready_for_deploy_without_human", {"recommendation": "READY_FOR_PRODUCTION_DEPLOY_WITHOUT_HUMAN_APPROVAL"}),
        "missing_source_batch_packet_ref": mutated_fixture("missing_source_batch_packet_ref", {"source_batch_packet_ref": ""}),
        "missing_source_batch_packet_digest": mutated_fixture("missing_source_batch_packet_digest", {"source_batch_packet_digest": ""}),
        "missing_files_changed": mutated_fixture("missing_files_changed", {"files_changed": []}),
        "missing_verification_commands": mutated_fixture("missing_verification_commands", {"verification_commands": []}),
        "missing_verification_results": mutated_fixture("missing_verification_results", {"verification_results": []}),
        "missing_build_result": mutated_fixture("missing_build_result", {"build_result": {}}),
        "missing_final_git_status": mutated_fixture("missing_final_git_status", {"final_git_status": ""}),
        "missing_failure_diagnostics": mutated_fixture("missing_failure_diagnostics", {"failure_diagnostics": ""}),
        "payment_result_missing_payment_check": mutated_fixture("payment_result_missing_payment_check", {"files_changed": ["api/stripe-checkout.js"], "payment_state_check": {"required": True, "passed": False, "status": "failed", "summary": "missing", "command": "payment_state_check", "notes": ""}}),
        "subscription_result_missing_subscription_check": mutated_fixture("subscription_result_missing_subscription_check", {"files_changed": ["api/subscription.js"], "subscription_state_check": {"required": True, "passed": False, "status": "failed", "summary": "missing", "command": "subscription_state_check", "notes": ""}}),
        "outcome_result_missing_outcome_check": mutated_fixture("outcome_result_missing_outcome_check", {"files_changed": ["api/outcome_ledger.js"], "outcome_ledger_check": {"required": True, "passed": False, "status": "failed", "summary": "missing", "command": "outcome_ledger_check", "notes": ""}}),
        "missing_raw_json_debug_check": mutated_fixture("missing_raw_json_debug_check", {"raw_json_debug_check": {}}),
        "missing_banned_placeholder_check": mutated_fixture("missing_banned_placeholder_check", {"banned_placeholder_check": {}}),
        "missing_source_label_integrity_check": mutated_fixture("missing_source_label_integrity_check", {"source_label_integrity_check": {}}),
        "failed_build_ready_for_commit": mutated_fixture("failed_build_ready_for_commit", {"build_result": {"passed": False}, "recommendation": "READY_FOR_COMMIT_REVIEW"}),
        "stop_condition_ready_for_commit": mutated_fixture("stop_condition_ready_for_commit", {"stop_conditions_triggered": ["BUILD_FAILED"], "recommendation": "READY_FOR_COMMIT_REVIEW"}),
        "runtime_errors_ready_for_commit": mutated_fixture("runtime_errors_ready_for_commit", {"runtime_errors": ["TypeError"], "recommendation": "READY_FOR_COMMIT_REVIEW"}),
        "unknown_field_present": mutated_fixture("unknown_field_present", {"unexpected_runtime_authority": True}),
        "result_class_runtime_loop": mutated_fixture("result_class_runtime_loop", {"result_class": "RUNTIME_LOOP_RESULT"}),
        "result_class_codex_automation": mutated_fixture("result_class_codex_automation", {"result_class": "CODEX_AUTOMATION_RESULT"}),
        "result_class_active_agents": mutated_fixture("result_class_active_agents", {"result_class": "ACTIVE_AGENTS_RESULT"}),
        "production_url_present_without_deploy": mutated_fixture("production_url_present_without_deploy", {"production_url": "https://moremindmap.com"}),
        "code_changed_without_tests": mutated_fixture("code_changed_without_tests", {"code_changed": True, "tests_run": []}),
        "python_changed_without_py_compile": mutated_fixture("python_changed_without_py_compile", {"verification_results": without_verification("py_compile_if_python_changed")}),
        "python_changed_without_capability_scan": mutated_fixture("python_changed_without_capability_scan", {"verification_results": without_verification("capability_scan_if_python_changed")}),
        "npm_build_missing": mutated_fixture("npm_build_missing", {"verification_results": without_verification("npm_build")}),
        "git_diff_check_missing": mutated_fixture("git_diff_check_missing", {"verification_results": without_verification("git_diff_check")}),
        "footprint_check_missing": mutated_fixture("footprint_check_missing", {"verification_results": without_verification("footprint_check")}),
    }


def run_self_test() -> Dict[str, Any]:
    valid_fixture = build_valid_fixture()
    valid_result = validate_builder_result_packet(valid_fixture)
    invalid_results = {
        name: validate_builder_result_packet(fixture)
        for name, fixture in build_invalid_fixtures().items()
    }
    invalid_failures = [name for name, result in invalid_results.items() if result["valid"]]
    status = "passed" if valid_result["valid"] and not invalid_failures else "failed"
    return {
        "sprint": "MM-DL-3",
        "status": status,
        "verdict": EXPECTED_VERDICT if status == "passed" else "MOREMINDMAP_CODEX_BUILDER_RESULT_PACKET_SCHEMA_SELFTEST_FAILED",
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
    with open("runtime_traces/moremindmap_codex_builder_result_packet_schema_selftest_03.json", "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, sort_keys=True)
        handle.write("\n")


def main(argv: List[str]) -> int:
    if "--self-test" not in argv:
        print("usage: python3 moremindmap_codex_builder_result_packet_schema.py --self-test")
        return 2
    summary = run_self_test()
    write_self_test_trace(summary)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0 if summary["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

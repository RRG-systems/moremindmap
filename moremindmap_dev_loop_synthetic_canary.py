"""MORE MindMap Dev Loop Synthetic Canary.

Quarantined, report-only synthetic canary for MM-DL-8. This module does not
execute real product batches, Codex automation, active agents, payment logic,
routes, UI, stop enforcement, repair execution, approval workflows, network
calls, subprocesses, or production deploys.
"""

import copy
import datetime
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, List


EXPECTED_VERDICT = "MOREMINDMAP_DEV_LOOP_SYNTHETIC_CANARY_COMPLETE_WITH_LIMITS"
EXPECTED_CLASSIFICATION = "MOREMINDMAP_DEV_LOOP_SYNTHETIC_CANARY_PASSED_WITH_LIMITS"
HIGHEST_ALLOWED_READINESS = "READY_FOR_HUMAN_REVIEW_OF_MOREMINDMAP_SYNTHETIC_CANARY_RESULTS"

CANARY_ROOT = Path("runtime_traces/moremindmap_dev_loop_canary")
SELFTEST_TRACE = Path("runtime_traces/moremindmap_dev_loop_synthetic_canary_selftest_08.json")
FORBIDDEN_SPRINT_3_FILE = CANARY_ROOT / "injected_stop_sprint_3_must_not_exist.json"

HAPPY_BATCH_ID = "MM_CANARY_HAPPY_PATH_BATCH_08"
STOP_BATCH_ID = "MM_CANARY_INJECTED_STOP_BATCH_08"

HAPPY_SPRINT_IDS = ["MM_CANARY_HAPPY_SPRINT_1", "MM_CANARY_HAPPY_SPRINT_2"]
STOP_SPRINT_IDS = [
    "MM_CANARY_STOP_SPRINT_1",
    "MM_CANARY_STOP_SPRINT_2",
    "MM_CANARY_STOP_SPRINT_3_MUST_NOT_START",
]

HAPPY_FILES = [
    "happy_path_sprint_1_builder_result.json",
    "happy_path_sprint_1_product_review.json",
    "happy_path_sprint_2_builder_result.json",
    "happy_path_sprint_2_product_review.json",
    "happy_path_batch_closure.json",
]

INJECTED_STOP_FILES = [
    "injected_stop_sprint_1_builder_result.json",
    "injected_stop_sprint_1_product_review.json",
    "injected_stop_sprint_2_failure_result.json",
    "injected_stop_stop_condition.json",
    "injected_stop_repair_human_approval_packet.json",
    "injected_stop_batch_closure.json",
]

ALLOWED_CANARY_FILES = HAPPY_FILES + INJECTED_STOP_FILES
ALLOWED_CANARY_PATHS = [CANARY_ROOT / name for name in ALLOWED_CANARY_FILES]


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def stable_hash(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def safety_flags() -> Dict[str, bool]:
    return {
        "report_only": True,
        "synthetic_only": True,
        "canary_only": True,
        "no_runtime": True,
        "no_real_batch_execution": True,
        "no_codex_automation": True,
        "no_active_agents": True,
        "no_active_stop_enforcement": True,
        "no_active_repair_execution": True,
        "no_approval_workflow_runtime": True,
        "no_routes": True,
        "no_ui": True,
        "no_stripe_changes": True,
        "no_formspree_changes": True,
        "no_subscription_changes": True,
        "no_outcome_ledger_changes": True,
        "no_assessment_generation_changes": True,
        "no_deployment": True,
    }


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    if path not in ALLOWED_CANARY_PATHS and path != SELFTEST_TRACE:
        raise ValueError(f"write outside canary allowlist blocked: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def read_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def clear_allowed_canary_files() -> List[str]:
    removed = []
    for path in ALLOWED_CANARY_PATHS:
        if path.exists():
            path.unlink()
            removed.append(str(path))
    if SELFTEST_TRACE.exists():
        SELFTEST_TRACE.unlink()
        removed.append(str(SELFTEST_TRACE))
    return removed


def assert_canary_file_allowlist() -> Dict[str, Any]:
    found = sorted([path.name for path in CANARY_ROOT.glob("*")]) if CANARY_ROOT.exists() else []
    unexpected = sorted([name for name in found if name not in ALLOWED_CANARY_FILES])
    missing = sorted([name for name in ALLOWED_CANARY_FILES if name not in found])
    return {
        "found": found,
        "unexpected": unexpected,
        "missing": missing,
        "allowed": copy.deepcopy(ALLOWED_CANARY_FILES),
        "passed": not unexpected and not missing,
    }


def base_packet(packet_type: str, batch_id: str, sprint_id: str) -> Dict[str, Any]:
    packet = {
        "packet_type": packet_type,
        "batch_id": batch_id,
        "sprint_id": sprint_id,
        "generated_at": now_iso(),
        "report_only": True,
        "synthetic_only": True,
        "canary_only": True,
        "production_behavior_changed": False,
        "stripe_approved": False,
        "automated_batch_execution_approved": False,
        "production_deploy_approved": False,
        "authority_claimed": False,
        "fake_success_claimed": False,
        "frontend_only_success_claimed": False,
        "raw_json_debug_user_surface_claim": False,
        "safety_flags": safety_flags(),
    }
    packet["packet_digest"] = stable_hash(packet)
    return packet


def synthetic_builder_result(batch_id: str, sprint_id: str, status: str, stop_conditions: List[str]) -> Dict[str, Any]:
    packet = base_packet("synthetic_builder_result", batch_id, sprint_id)
    packet.update({
        "builder_name": "SYNTHETIC_CANARY_CODEX_BUILDER",
        "task_summary": "Synthetic canary builder result; no production files or runtime behavior touched.",
        "files_changed": [],
        "files_created": [],
        "files_modified": [],
        "files_deleted": [],
        "allowed_files_respected": True,
        "touched_files_outside_allowlist": [],
        "code_changed": False,
        "docs_changed": False,
        "schema_changed": False,
        "verification_results": [{"command": "synthetic_canary_step", "status": "passed", "passed": True}],
        "build_result": "NOT_APPLICABLE_SYNTHETIC_ONLY",
        "stop_conditions_triggered": stop_conditions,
        "final_git_status": "NOT_CHECKED_BY_SYNTHETIC_PACKET",
        "recommendation": "HUMAN_REVIEW_REQUIRED" if stop_conditions else "CONTINUE_SYNTHETIC_CANARY_ONLY",
        "status": status,
    })
    packet["packet_digest"] = stable_hash(packet)
    return packet


def synthetic_product_review(batch_id: str, sprint_id: str, status: str, stop_conditions: List[str]) -> Dict[str, Any]:
    packet = base_packet("synthetic_product_reality_review", batch_id, sprint_id)
    packet.update({
        "reviewer_name": "SYNTHETIC_CANARY_PRODUCT_REALITY_REVIEWER",
        "review_summary": "Synthetic product reality review; confirms no user-visible or backend production claim.",
        "saved_artifact_truth_checked": True,
        "controlled_failure_truth_checked": True,
        "placeholder_debug_truth_checked": True,
        "source_label_truth_checked": True,
        "payment_subscription_outcome_truth_checked": True,
        "user_visible_surface_changed": False,
        "backend_behavior_changed": False,
        "frontend_behavior_changed": False,
        "api_behavior_changed": False,
        "payment_behavior_changed": False,
        "subscription_behavior_changed": False,
        "outcome_ledger_behavior_changed": False,
        "assessment_generation_changed": False,
        "artifact_generation_changed": False,
        "stop_conditions_triggered": stop_conditions,
        "approval_status": "NEEDS_HUMAN_REVIEW",
        "recommendation": "HUMAN_REVIEW_REQUIRED" if stop_conditions else "CONTINUE_SYNTHETIC_CANARY_ONLY",
        "status": status,
    })
    packet["packet_digest"] = stable_hash(packet)
    return packet


def synthetic_stop_condition() -> Dict[str, Any]:
    packet = base_packet("synthetic_stop_condition", STOP_BATCH_ID, "MM_CANARY_STOP_SPRINT_2")
    packet.update({
        "stop_code": "FRONTEND_CLAIMS_UNSAVED_ARTIFACT",
        "stop_class": "ARTIFACT_TRUTH_STOP",
        "severity": "RED",
        "trigger_condition": "Synthetic sprint 2 injected a frontend-success claim without a saved backend artifact.",
        "required_evidence": [
            "synthetic_failure_result",
            "no_saved_artifact",
            "frontend_claim_detected",
        ],
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
        "recommended_disposition": "STOP_AND_REQUEST_HUMAN_REVIEW",
        "status": "RED_STOP_TRIGGERED",
    })
    packet["packet_digest"] = stable_hash(packet)
    return packet


def synthetic_repair_human_approval_packet(stop_packet: Dict[str, Any]) -> Dict[str, Any]:
    packet = base_packet("synthetic_repair_human_approval_packet", STOP_BATCH_ID, "MM_CANARY_STOP_SPRINT_2")
    packet.update({
        "source_stop_condition_ref": "runtime_traces/moremindmap_dev_loop_canary/injected_stop_stop_condition.json",
        "source_stop_condition_digest": stop_packet["packet_digest"],
        "repair_execution_allowed": False,
        "archive_execution_allowed": False,
        "approval_workflow_runtime_allowed": False,
        "human_review_required": True,
        "automatic_repair_after_red_stop": False,
        "continuation_after_red_stop": False,
        "commit_allowed": False,
        "deploy_allowed": False,
        "user_visibility_allowed": False,
        "allowed_decisions": [
            "REQUEST_MORE_EVIDENCE",
            "REQUEST_REPAIR_PACKET",
            "REJECT_WITH_REASON",
            "BLOCK_WITH_REASON",
        ],
        "forbidden_decisions": [
            "APPROVE_PRODUCTION_DEPLOY_WITHOUT_HUMAN_REVIEW",
            "APPROVE_FRONTEND_ONLY_SUCCESS",
            "APPROVE_PARTIAL_ARTIFACT_EXPOSURE",
            "APPROVE_FAKE_SUCCESS",
            "APPROVE_VALIDATION_DOWNGRADE",
            "APPROVE_AUTOMATED_BATCH_EXECUTION",
            "APPROVE_STRIPE_BATCH_AUTOMATICALLY",
        ],
        "status": "HUMAN_REVIEW_REQUIRED",
    })
    packet["packet_digest"] = stable_hash(packet)
    return packet


def happy_path_closure(created_files: List[str]) -> Dict[str, Any]:
    packet = base_packet("synthetic_happy_path_batch_closure", HAPPY_BATCH_ID, "BATCH_CLOSURE")
    packet.update({
        "sprint_ids": copy.deepcopy(HAPPY_SPRINT_IDS),
        "final_status": "PASS",
        "stop_conditions_triggered": [],
        "repair_packet_required": False,
        "files_created": created_files,
        "files_outside_canary_allowlist": [],
        "continuation_allowed_for_synthetic_sprint_2": True,
        "production_behavior": "NONE",
    })
    packet["packet_digest"] = stable_hash(packet)
    return packet


def injected_stop_closure(created_files: List[str]) -> Dict[str, Any]:
    packet = base_packet("synthetic_injected_stop_batch_closure", STOP_BATCH_ID, "BATCH_CLOSURE")
    packet.update({
        "sprint_ids": copy.deepcopy(STOP_SPRINT_IDS),
        "final_status": "STOPPED_AS_EXPECTED",
        "red_stop_triggered": True,
        "red_stop_code": "FRONTEND_CLAIMS_UNSAVED_ARTIFACT",
        "sprint_3_started": False,
        "forbidden_sprint_3_file_created": FORBIDDEN_SPRINT_3_FILE.exists(),
        "continuation_after_red_stop": False,
        "automatic_repair_after_red_stop": False,
        "commit_allowed": False,
        "deploy_allowed": False,
        "stripe_approved": False,
        "automated_batch_execution_approved": False,
        "files_created": created_files,
        "files_outside_canary_allowlist": [],
        "production_behavior": "NONE",
    })
    packet["packet_digest"] = stable_hash(packet)
    return packet


def run_happy_path_canary() -> Dict[str, Any]:
    created = []
    steps = [
        (CANARY_ROOT / "happy_path_sprint_1_builder_result.json", synthetic_builder_result(HAPPY_BATCH_ID, HAPPY_SPRINT_IDS[0], "PASS", [])),
        (CANARY_ROOT / "happy_path_sprint_1_product_review.json", synthetic_product_review(HAPPY_BATCH_ID, HAPPY_SPRINT_IDS[0], "PASS", [])),
        (CANARY_ROOT / "happy_path_sprint_2_builder_result.json", synthetic_builder_result(HAPPY_BATCH_ID, HAPPY_SPRINT_IDS[1], "PASS", [])),
        (CANARY_ROOT / "happy_path_sprint_2_product_review.json", synthetic_product_review(HAPPY_BATCH_ID, HAPPY_SPRINT_IDS[1], "PASS", [])),
    ]
    for path, packet in steps:
        write_json(path, packet)
        created.append(str(path))
    closure = happy_path_closure(created + [str(CANARY_ROOT / "happy_path_batch_closure.json")])
    write_json(CANARY_ROOT / "happy_path_batch_closure.json", closure)
    created.append(str(CANARY_ROOT / "happy_path_batch_closure.json"))
    return {
        "batch_id": HAPPY_BATCH_ID,
        "sprint_ids": copy.deepcopy(HAPPY_SPRINT_IDS),
        "final_status": closure["final_status"],
        "stop_conditions_triggered": [],
        "repair_packet_required": False,
        "files_created": created,
        "passed": closure["final_status"] == "PASS",
    }


def run_injected_stop_canary() -> Dict[str, Any]:
    created = []
    sprint_1_builder = synthetic_builder_result(STOP_BATCH_ID, STOP_SPRINT_IDS[0], "PASS", [])
    sprint_1_review = synthetic_product_review(STOP_BATCH_ID, STOP_SPRINT_IDS[0], "PASS", [])
    sprint_2_failure = synthetic_builder_result(
        STOP_BATCH_ID,
        STOP_SPRINT_IDS[1],
        "FAILED_WITH_SYNTHETIC_RED_STOP",
        ["FRONTEND_CLAIMS_UNSAVED_ARTIFACT"],
    )
    sprint_2_failure.update({
        "injected_failure": True,
        "synthetic_failure_reason": "Frontend claims unsaved artifact.",
        "saved_artifact_exists": False,
        "frontend_claims_success": True,
        "recommendation": "STOP_AND_REQUEST_HUMAN_REVIEW",
    })
    sprint_2_failure["packet_digest"] = stable_hash(sprint_2_failure)

    stop_packet = synthetic_stop_condition()
    repair_packet = synthetic_repair_human_approval_packet(stop_packet)

    steps = [
        (CANARY_ROOT / "injected_stop_sprint_1_builder_result.json", sprint_1_builder),
        (CANARY_ROOT / "injected_stop_sprint_1_product_review.json", sprint_1_review),
        (CANARY_ROOT / "injected_stop_sprint_2_failure_result.json", sprint_2_failure),
        (CANARY_ROOT / "injected_stop_stop_condition.json", stop_packet),
        (CANARY_ROOT / "injected_stop_repair_human_approval_packet.json", repair_packet),
    ]
    for path, packet in steps:
        write_json(path, packet)
        created.append(str(path))

    closure = injected_stop_closure(created + [str(CANARY_ROOT / "injected_stop_batch_closure.json")])
    write_json(CANARY_ROOT / "injected_stop_batch_closure.json", closure)
    created.append(str(CANARY_ROOT / "injected_stop_batch_closure.json"))

    return {
        "batch_id": STOP_BATCH_ID,
        "sprint_ids": copy.deepcopy(STOP_SPRINT_IDS),
        "final_status": closure["final_status"],
        "red_stop_triggered": closure["red_stop_triggered"],
        "red_stop_code": closure["red_stop_code"],
        "sprint_3_started": closure["sprint_3_started"],
        "forbidden_sprint_3_file_created": closure["forbidden_sprint_3_file_created"],
        "continuation_after_red_stop": closure["continuation_after_red_stop"],
        "automatic_repair_after_red_stop": closure["automatic_repair_after_red_stop"],
        "files_created": created,
        "passed": closure["final_status"] == "STOPPED_AS_EXPECTED" and not closure["forbidden_sprint_3_file_created"],
    }


def validate_happy_path(result: Dict[str, Any]) -> List[str]:
    errors = []
    if result.get("final_status") != "PASS":
        errors.append("happy path final status was not PASS")
    for name in HAPPY_FILES:
        if not (CANARY_ROOT / name).exists():
            errors.append(f"missing happy path file: {name}")
    return errors


def validate_injected_stop(result: Dict[str, Any]) -> List[str]:
    errors = []
    if result.get("final_status") != "STOPPED_AS_EXPECTED":
        errors.append("injected stop final status was not STOPPED_AS_EXPECTED")
    if not result.get("red_stop_triggered"):
        errors.append("red stop was not triggered")
    if result.get("sprint_3_started"):
        errors.append("sprint 3 started after red stop")
    if FORBIDDEN_SPRINT_3_FILE.exists():
        errors.append("forbidden sprint 3 file exists")
    if result.get("continuation_after_red_stop"):
        errors.append("continuation occurred after red stop")
    if result.get("automatic_repair_after_red_stop"):
        errors.append("automatic repair occurred after red stop")
    for name in INJECTED_STOP_FILES:
        if not (CANARY_ROOT / name).exists():
            errors.append(f"missing injected stop file: {name}")
    return errors


def run_self_test() -> Dict[str, Any]:
    removed = clear_allowed_canary_files()
    happy_result = run_happy_path_canary()
    injected_result = run_injected_stop_canary()
    allowlist_result = assert_canary_file_allowlist()
    happy_errors = validate_happy_path(happy_result)
    injected_errors = validate_injected_stop(injected_result)
    errors = happy_errors + injected_errors
    if not allowlist_result["passed"]:
        errors.append(f"canary allowlist mismatch: {allowlist_result}")
    if FORBIDDEN_SPRINT_3_FILE.exists():
        errors.append("forbidden sprint 3 file exists")

    files_created = sorted([str(CANARY_ROOT / name) for name in ALLOWED_CANARY_FILES])
    payload = {
        "sprint": "MM-DL-8",
        "status": "passed" if not errors else "failed",
        "verdict": EXPECTED_VERDICT if not errors else "MOREMINDMAP_DEV_LOOP_SYNTHETIC_CANARY_FAILED",
        "classification": EXPECTED_CLASSIFICATION if not errors else "MOREMINDMAP_DEV_LOOP_SYNTHETIC_CANARY_FAILED",
        "generated_at": now_iso(),
        "removed_prior_allowed_files": removed,
        "happy_path_result": happy_result,
        "injected_stop_result": injected_result,
        "files_created": files_created,
        "canary_file_allowlist": allowlist_result,
        "forbidden_files_absent": not FORBIDDEN_SPRINT_3_FILE.exists(),
        "sprint_3_started": False,
        "red_stop_triggered": True,
        "automatic_repair_after_red_stop": False,
        "continuation_after_red_stop": False,
        "stripe_approved": False,
        "automated_batch_execution_approved": False,
        "production_deploy_approved": False,
        "authority_claimed": False,
        "fake_success_claimed": False,
        "frontend_only_success_claimed": False,
        "errors": errors,
        "safety_flags": safety_flags(),
    }
    payload["selftest_digest"] = stable_hash(payload)
    write_json(SELFTEST_TRACE, payload)
    return payload


def main(argv: List[str]) -> int:
    normalized_args = [arg.replace("–", "--") for arg in argv]
    if "--self-test" not in normalized_args:
        print("Usage: python3 moremindmap_dev_loop_synthetic_canary.py --self-test")
        return 2
    result = run_self_test()
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

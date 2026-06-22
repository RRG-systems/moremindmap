"""MORE MindMap Repair / Archive / Human Approval Packet Schema.

Report-only schema helpers for future governed development batches. This file
does not execute repairs, rollbacks, archive writes, approval workflows,
network calls, route handlers, workers, queues, or production deploys.
"""

import copy
import datetime
import hashlib
import json
import sys
from typing import Any, Dict, List


SCHEMA_VERSION = "moremindmap_repair_archive_human_approval_packet_schema_v1"
EXPECTED_VERDICT = "MOREMINDMAP_REPAIR_ARCHIVE_HUMAN_APPROVAL_PACKET_SCHEMA_IMPLEMENTED_WITH_LIMITS"
EXPECTED_CLASSIFICATION = "MOREMINDMAP_REPAIR_ARCHIVE_HUMAN_APPROVAL_PACKET_SCHEMA_DEFINED_WITH_LIMITS"
HIGHEST_ALLOWED_READINESS = "READY_FOR_HUMAN_REVIEW_OF_MOREMINDMAP_REPAIR_ARCHIVE_APPROVAL_SCHEMA"

FORBIDDEN_RECOMMENDATIONS = [
    "READY_FOR_STRIPE_BATCH",
    "READY_FOR_AUTOMATED_BATCH_EXECUTION",
    "READY_FOR_PRODUCTION_DEPLOY_WITHOUT_HUMAN_APPROVAL",
    "READY_FOR_USER_VISIBILITY",
    "READY_FOR_SUBSCRIPTION_RELEASE",
    "READY_FOR_OUTCOME_LEDGER_RELEASE",
    "READY_FOR_FRONTEND_ONLY_SUCCESS",
    "READY_FOR_PARTIAL_ARTIFACT_EXPOSURE",
    "READY_FOR_VALIDATION_DOWNGRADE",
]

FORBIDDEN_DECISIONS = [
    "APPROVE_PRODUCTION_DEPLOY_WITHOUT_HUMAN_REVIEW",
    "APPROVE_FRONTEND_ONLY_SUCCESS",
    "APPROVE_PARTIAL_ARTIFACT_EXPOSURE",
    "APPROVE_FAKE_SUCCESS",
    "APPROVE_VALIDATION_DOWNGRADE",
    "APPROVE_UNVERIFIED_PAYMENT_STATE",
    "APPROVE_UNVERIFIED_SUBSCRIPTION_STATE",
    "APPROVE_UNVERIFIED_OUTCOME_LEDGER",
    "APPROVE_AUTOMATED_BATCH_EXECUTION",
    "APPROVE_STRIPE_BATCH_AUTOMATICALLY",
]

REPAIR_FIELDS = [
    "schema_version", "repair_id", "packet_class", "source_stop_condition_ref",
    "source_stop_condition_digest", "source_builder_result_ref",
    "source_product_reality_review_ref", "batch_id", "sprint_id",
    "repair_class", "repair_reason", "failed_verification_area",
    "affected_files", "allowed_repair_files", "forbidden_repair_files",
    "proposed_repair_summary", "repair_scope", "repair_attempt_number",
    "max_repair_attempts_allowed", "red_stop_repair_prohibited",
    "human_review_required", "product_reality_review_required_after_repair",
    "verification_required_after_repair", "production_deploy_allowed",
    "production_deploy_requires_human_approval", "forbidden_recommendations",
    "highest_allowed_readiness", "report_only", "schema_only",
]

ARCHIVE_FIELDS = [
    "schema_version", "archive_id", "packet_class", "source_stop_condition_ref",
    "source_builder_result_ref", "source_product_reality_review_ref",
    "batch_id", "sprint_id", "archive_class", "archive_reason",
    "artifacts_to_archive", "artifacts_not_to_archive", "archive_scope",
    "preserve_user_records", "preserve_saved_artifacts",
    "preserve_retrievable_outputs", "archive_execution_allowed",
    "archive_persistence_allowed", "human_review_required",
    "forbidden_recommendations", "highest_allowed_readiness", "report_only",
    "schema_only",
]

APPROVAL_FIELDS = [
    "schema_version", "approval_request_id", "packet_class",
    "source_batch_packet_ref", "source_builder_result_ref",
    "source_product_reality_review_ref", "source_stop_condition_ref",
    "request_class", "approval_question", "requested_decision",
    "allowed_decisions", "forbidden_decisions", "approval_scope",
    "production_deploy_requested", "production_deploy_requires_human_approval",
    "repair_requested", "archive_requested", "continuation_requested",
    "user_visibility_requested", "evidence_summary", "unresolved_risks",
    "required_verifications_before_approval", "approval_effect",
    "authority_effect", "production_truth_effect", "highest_allowed_readiness",
    "report_only", "schema_only",
]

ENVELOPE_FIELDS = [
    "schema_version", "envelope_id", "envelope_class", "batch_id",
    "sprint_id", "repair_packet", "archive_packet",
    "human_approval_request_packet", "envelope_summary",
    "stop_condition_refs", "builder_result_refs", "product_reality_review_refs",
    "recommended_disposition", "continuation_allowed", "commit_allowed",
    "deploy_allowed", "user_visibility_allowed",
    "partial_artifact_exposure_allowed", "validation_downgrade_allowed",
    "fake_success_allowed", "frontend_only_success_allowed",
    "human_review_required", "highest_allowed_readiness", "report_only",
    "schema_only",
]

VALID_REPAIR_CLASSES = [
    "MECHANICAL_SCHEMA_REPAIR", "DOC_TRACE_REPAIR", "JSON_TRACE_REPAIR",
    "BUILD_VERIFICATION_REPAIR", "ROUTE_VERIFICATION_REPAIR",
    "RETRIEVAL_VERIFICATION_REPAIR", "PRODUCT_REALITY_REPAIR_PLAN",
    "PAYMENT_STATE_REPAIR_PLAN", "SUBSCRIPTION_STATE_REPAIR_PLAN",
    "OUTCOME_LEDGER_REPAIR_PLAN", "DESIGN_REPAIR_PLAN",
    "BLOCKED_REPAIR_REQUIRES_HUMAN",
]
VALID_ARCHIVE_CLASSES = [
    "ARCHIVE_FAILED_SPRINT_PLAN", "ARCHIVE_FAILED_BATCH_PLAN",
    "ARCHIVE_INVALID_RESULT_PACKET", "ARCHIVE_INVALID_REVIEW_PACKET",
    "ARCHIVE_SUPERSEDED_TRACE", "ARCHIVE_WITH_HUMAN_REVIEW_ONLY",
]
VALID_REQUEST_CLASSES = [
    "HUMAN_REVIEW_REQUEST", "REPAIR_APPROVAL_REQUEST",
    "ARCHIVE_APPROVAL_REQUEST", "DEPLOY_APPROVAL_REQUEST",
    "CONTINUATION_APPROVAL_REQUEST", "USER_VISIBILITY_APPROVAL_REQUEST",
    "BLOCKED_DECISION_REQUEST",
]
VALID_ALLOWED_DECISIONS = [
    "APPROVE_REPAIR_WITH_LIMITS", "APPROVE_ARCHIVE_WITH_LIMITS",
    "APPROVE_COMMIT_REVIEW_WITH_LIMITS",
    "APPROVE_DEPLOY_REVIEW_WITH_LIMITS",
    "APPROVE_CONTINUATION_WITH_LIMITS", "REQUEST_MORE_EVIDENCE",
    "REQUEST_REPAIR_PACKET", "REQUEST_PRODUCT_REALITY_REVIEW",
    "REJECT_WITH_REASON", "BLOCK_WITH_REASON",
]
VALID_ENVELOPE_CLASSES = [
    "REPAIR_ARCHIVE_HUMAN_APPROVAL_ENVELOPE",
    "BLOCKED_WITH_REASON_ENVELOPE",
    "HUMAN_REVIEW_REQUIRED_ENVELOPE",
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


def base_errors(packet: Dict[str, Any], required: List[str]) -> List[str]:
    errors: List[str] = []
    if not isinstance(packet, dict):
        return ["packet must be an object"]
    missing = sorted(set(required) - set(packet.keys()))
    unknown = sorted(set(packet.keys()) - set(required))
    if missing:
        errors.append("missing required fields: " + ", ".join(missing))
    if unknown:
        errors.append("unknown fields present: " + ", ".join(unknown))
    if packet.get("schema_version") != SCHEMA_VERSION:
        errors.append("schema_version must equal " + SCHEMA_VERSION)
    if packet.get("highest_allowed_readiness") != HIGHEST_ALLOWED_READINESS:
        errors.append("highest_allowed_readiness is not allowed")
    if packet.get("report_only") is not True:
        errors.append("report_only must be true")
    if packet.get("schema_only") is not True:
        errors.append("schema_only must be true")
    return errors


def forbidden_recs_ok(packet: Dict[str, Any]) -> List[str]:
    present = set(str(item) for item in as_list(packet.get("forbidden_recommendations")))
    missing = sorted(set(FORBIDDEN_RECOMMENDATIONS) - present)
    return ["missing forbidden recommendations: " + ", ".join(missing)] if missing else []


def validate_repair_packet(packet: Dict[str, Any]) -> Dict[str, Any]:
    errors = base_errors(packet, REPAIR_FIELDS)
    errors += forbidden_recs_ok(packet)
    for field in ["repair_id", "packet_class", "source_stop_condition_ref", "source_stop_condition_digest", "source_builder_result_ref", "source_product_reality_review_ref", "batch_id", "sprint_id", "repair_reason", "failed_verification_area", "proposed_repair_summary", "repair_scope"]:
        if not non_empty(packet.get(field)):
            errors.append(field + " missing")
    if packet.get("repair_class") not in VALID_REPAIR_CLASSES:
        errors.append("repair_class is not recognized")
    if packet.get("human_review_required") is not True:
        errors.append("human_review_required must be true")
    if packet.get("production_deploy_allowed") is not False:
        errors.append("production_deploy_allowed must be false for MM-DL-6")
    if packet.get("production_deploy_requires_human_approval") is not True:
        errors.append("production_deploy_requires_human_approval must be true")
    max_attempts = packet.get("max_repair_attempts_allowed")
    attempt = packet.get("repair_attempt_number")
    if not isinstance(max_attempts, int) or max_attempts > 2:
        errors.append("max_repair_attempts_allowed must be <= 2")
    if not isinstance(attempt, int) or (isinstance(max_attempts, int) and attempt > max_attempts):
        errors.append("repair_attempt_number must be <= max_repair_attempts_allowed")
    if packet.get("red_stop_repair_prohibited") is not True:
        errors.append("red_stop_repair_prohibited must be true for red source stops")
    return {"valid": not errors, "errors": errors, "packet_hash": stable_hash(packet)}


def validate_archive_packet(packet: Dict[str, Any]) -> Dict[str, Any]:
    errors = base_errors(packet, ARCHIVE_FIELDS)
    errors += forbidden_recs_ok(packet)
    for field in ["archive_id", "packet_class", "source_stop_condition_ref", "source_builder_result_ref", "source_product_reality_review_ref", "batch_id", "sprint_id", "archive_reason", "archive_scope"]:
        if not non_empty(packet.get(field)):
            errors.append(field + " missing")
    if packet.get("archive_class") not in VALID_ARCHIVE_CLASSES:
        errors.append("archive_class is not recognized")
    for field in ["preserve_user_records", "preserve_saved_artifacts", "preserve_retrievable_outputs", "human_review_required"]:
        if packet.get(field) is not True:
            errors.append(field + " must be true")
    for field in ["archive_execution_allowed", "archive_persistence_allowed"]:
        if packet.get(field) is not False:
            errors.append(field + " must be false")
    return {"valid": not errors, "errors": errors, "packet_hash": stable_hash(packet)}


def validate_human_approval_request_packet(packet: Dict[str, Any]) -> Dict[str, Any]:
    errors = base_errors(packet, APPROVAL_FIELDS)
    for field in ["approval_request_id", "packet_class", "source_batch_packet_ref", "source_builder_result_ref", "source_product_reality_review_ref", "source_stop_condition_ref", "approval_question", "requested_decision", "approval_scope", "evidence_summary"]:
        if not non_empty(packet.get(field)):
            errors.append(field + " missing")
    if packet.get("request_class") not in VALID_REQUEST_CLASSES:
        errors.append("request_class is not recognized")
    if packet.get("production_deploy_requires_human_approval") is not True:
        errors.append("production_deploy_requires_human_approval must be true")
    if packet.get("approval_effect") != "REPORT_ONLY_DECISION_REQUEST":
        errors.append("approval_effect must be REPORT_ONLY_DECISION_REQUEST")
    if packet.get("authority_effect") != "NONE":
        errors.append("authority_effect must be NONE")
    if packet.get("production_truth_effect") != "NONE":
        errors.append("production_truth_effect must be NONE")
    allowed = set(str(item) for item in as_list(packet.get("allowed_decisions")))
    if not allowed or not allowed.issubset(set(VALID_ALLOWED_DECISIONS)):
        errors.append("allowed_decisions contains invalid decisions")
    forbidden = set(str(item) for item in as_list(packet.get("forbidden_decisions")))
    missing = sorted(set(FORBIDDEN_DECISIONS) - forbidden)
    if missing:
        errors.append("missing forbidden decisions: " + ", ".join(missing))
    unsafe_allowed = sorted(set(FORBIDDEN_DECISIONS) & allowed)
    if unsafe_allowed:
        errors.append("allowed_decisions contains forbidden decisions: " + ", ".join(unsafe_allowed))
    return {"valid": not errors, "errors": errors, "packet_hash": stable_hash(packet)}


def validate_envelope(packet: Dict[str, Any]) -> Dict[str, Any]:
    errors = base_errors(packet, ENVELOPE_FIELDS)
    for field in ["envelope_id", "batch_id", "sprint_id", "envelope_summary", "recommended_disposition"]:
        if not non_empty(packet.get(field)):
            errors.append(field + " missing")
    if packet.get("envelope_class") not in VALID_ENVELOPE_CLASSES:
        errors.append("envelope_class is not recognized")
    for field in ["continuation_allowed", "commit_allowed", "deploy_allowed", "user_visibility_allowed", "partial_artifact_exposure_allowed", "validation_downgrade_allowed", "fake_success_allowed", "frontend_only_success_allowed"]:
        if packet.get(field) is not False:
            errors.append(field + " must be false")
    if packet.get("human_review_required") is not True:
        errors.append("human_review_required must be true")
    if not as_list(packet.get("stop_condition_refs")):
        errors.append("stop_condition_refs missing")
    if not as_list(packet.get("builder_result_refs")):
        errors.append("builder_result_refs missing")
    if not as_list(packet.get("product_reality_review_refs")):
        errors.append("product_reality_review_refs missing")
    if not isinstance(packet.get("repair_packet"), dict) or not validate_repair_packet(packet["repair_packet"])["valid"]:
        errors.append("repair_packet invalid")
    if not isinstance(packet.get("archive_packet"), dict) or not validate_archive_packet(packet["archive_packet"])["valid"]:
        errors.append("archive_packet invalid")
    if not isinstance(packet.get("human_approval_request_packet"), dict) or not validate_human_approval_request_packet(packet["human_approval_request_packet"])["valid"]:
        errors.append("human_approval_request_packet invalid")
    return {"valid": not errors, "errors": errors, "packet_hash": stable_hash(packet)}


def valid_repair_packet() -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION, "repair_id": "REPAIR-MM-DL-6-FIXTURE",
        "packet_class": "REPAIR_PACKET", "source_stop_condition_ref": "runtime_traces/moremindmap_stop_condition_schema_05.json",
        "source_stop_condition_digest": "f181167", "source_builder_result_ref": "runtime_traces/moremindmap_codex_builder_result_packet_schema_03.json",
        "source_product_reality_review_ref": "runtime_traces/moremindmap_product_reality_review_packet_schema_04.json",
        "batch_id": "MM-DL-6", "sprint_id": "MM-DL-6", "repair_class": "BLOCKED_REPAIR_REQUIRES_HUMAN",
        "repair_reason": "Report-only repair packet schema fixture.", "failed_verification_area": "stop_condition_schema",
        "affected_files": [], "allowed_repair_files": ["report_only_schema_artifacts"], "forbidden_repair_files": ["src/**", "api/**"],
        "proposed_repair_summary": "No active repair execution. Human review required.", "repair_scope": "REPORT_ONLY",
        "repair_attempt_number": 0, "max_repair_attempts_allowed": 0, "red_stop_repair_prohibited": True,
        "human_review_required": True, "product_reality_review_required_after_repair": True,
        "verification_required_after_repair": True, "production_deploy_allowed": False,
        "production_deploy_requires_human_approval": True, "forbidden_recommendations": list(FORBIDDEN_RECOMMENDATIONS),
        "highest_allowed_readiness": HIGHEST_ALLOWED_READINESS, "report_only": True, "schema_only": True,
    }


def valid_archive_packet() -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION, "archive_id": "ARCHIVE-MM-DL-6-FIXTURE",
        "packet_class": "ARCHIVE_PACKET", "source_stop_condition_ref": "runtime_traces/moremindmap_stop_condition_schema_05.json",
        "source_builder_result_ref": "runtime_traces/moremindmap_codex_builder_result_packet_schema_03.json",
        "source_product_reality_review_ref": "runtime_traces/moremindmap_product_reality_review_packet_schema_04.json",
        "batch_id": "MM-DL-6", "sprint_id": "MM-DL-6", "archive_class": "ARCHIVE_WITH_HUMAN_REVIEW_ONLY",
        "archive_reason": "Report-only archive schema fixture.", "artifacts_to_archive": [],
        "artifacts_not_to_archive": ["user_records", "saved_artifacts", "retrievable_outputs"],
        "archive_scope": "REPORT_ONLY_NO_PERSISTENCE", "preserve_user_records": True,
        "preserve_saved_artifacts": True, "preserve_retrievable_outputs": True,
        "archive_execution_allowed": False, "archive_persistence_allowed": False,
        "human_review_required": True, "forbidden_recommendations": list(FORBIDDEN_RECOMMENDATIONS),
        "highest_allowed_readiness": HIGHEST_ALLOWED_READINESS, "report_only": True, "schema_only": True,
    }


def valid_approval_packet() -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION, "approval_request_id": "APPROVAL-MM-DL-6-FIXTURE",
        "packet_class": "HUMAN_APPROVAL_REQUEST_PACKET", "source_batch_packet_ref": "runtime_traces/moremindmap_sprint_batch_packet_schema_02.json",
        "source_builder_result_ref": "runtime_traces/moremindmap_codex_builder_result_packet_schema_03.json",
        "source_product_reality_review_ref": "runtime_traces/moremindmap_product_reality_review_packet_schema_04.json",
        "source_stop_condition_ref": "runtime_traces/moremindmap_stop_condition_schema_05.json",
        "request_class": "HUMAN_REVIEW_REQUEST", "approval_question": "Should MM-DL-6 schema proceed to human review?",
        "requested_decision": "REQUEST_MORE_EVIDENCE", "allowed_decisions": ["REQUEST_MORE_EVIDENCE", "REQUEST_REPAIR_PACKET", "REQUEST_PRODUCT_REALITY_REVIEW", "REJECT_WITH_REASON", "BLOCK_WITH_REASON"],
        "forbidden_decisions": list(FORBIDDEN_DECISIONS), "approval_scope": "REPORT_ONLY",
        "production_deploy_requested": False, "production_deploy_requires_human_approval": True,
        "repair_requested": False, "archive_requested": False, "continuation_requested": False,
        "user_visibility_requested": False, "evidence_summary": "Report-only decision request.",
        "unresolved_risks": [], "required_verifications_before_approval": ["self_test", "json_validation", "capability_scan"],
        "approval_effect": "REPORT_ONLY_DECISION_REQUEST", "authority_effect": "NONE",
        "production_truth_effect": "NONE", "highest_allowed_readiness": HIGHEST_ALLOWED_READINESS,
        "report_only": True, "schema_only": True,
    }


def valid_envelope() -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION, "envelope_id": "ENVELOPE-MM-DL-6-FIXTURE",
        "envelope_class": "HUMAN_REVIEW_REQUIRED_ENVELOPE", "batch_id": "MM-DL-6",
        "sprint_id": "MM-DL-6", "repair_packet": valid_repair_packet(),
        "archive_packet": valid_archive_packet(), "human_approval_request_packet": valid_approval_packet(),
        "envelope_summary": "Report-only repair/archive/human approval schema envelope.",
        "stop_condition_refs": ["runtime_traces/moremindmap_stop_condition_schema_05.json"],
        "builder_result_refs": ["runtime_traces/moremindmap_codex_builder_result_packet_schema_03.json"],
        "product_reality_review_refs": ["runtime_traces/moremindmap_product_reality_review_packet_schema_04.json"],
        "recommended_disposition": "HUMAN_REVIEW_REQUIRED", "continuation_allowed": False,
        "commit_allowed": False, "deploy_allowed": False, "user_visibility_allowed": False,
        "partial_artifact_exposure_allowed": False, "validation_downgrade_allowed": False,
        "fake_success_allowed": False, "frontend_only_success_allowed": False,
        "human_review_required": True, "highest_allowed_readiness": HIGHEST_ALLOWED_READINESS,
        "report_only": True, "schema_only": True,
    }


def mutate(packet: Dict[str, Any], name: str, changes: Dict[str, Any]) -> Dict[str, Any]:
    out = copy.deepcopy(packet)
    for key, value in changes.items():
        out[key] = value
    if "repair_id" in out:
        out["repair_id"] = "INVALID-" + name
    if "archive_id" in out:
        out["archive_id"] = "INVALID-" + name
    if "approval_request_id" in out:
        out["approval_request_id"] = "INVALID-" + name
    if "envelope_id" in out:
        out["envelope_id"] = "INVALID-" + name
    return out


def invalid_fixtures() -> Dict[str, Dict[str, Any]]:
    r, a, h, e = valid_repair_packet(), valid_archive_packet(), valid_approval_packet(), valid_envelope()
    return {
        "repair_report_only_false": mutate(r, "repair_report_only_false", {"report_only": False}),
        "repair_schema_only_false": mutate(r, "repair_schema_only_false", {"schema_only": False}),
        "repair_human_review_false": mutate(r, "repair_human_review_false", {"human_review_required": False}),
        "repair_deploy_allowed_true": mutate(r, "repair_deploy_allowed_true", {"production_deploy_allowed": True}),
        "repair_deploy_human_false": mutate(r, "repair_deploy_human_false", {"production_deploy_requires_human_approval": False}),
        "repair_max_attempts_gt_two": mutate(r, "repair_max_attempts_gt_two", {"max_repair_attempts_allowed": 3}),
        "repair_attempt_gt_max": mutate(r, "repair_attempt_gt_max", {"repair_attempt_number": 2, "max_repair_attempts_allowed": 1}),
        "repair_red_stop_not_prohibited": mutate(r, "repair_red_stop_not_prohibited", {"red_stop_repair_prohibited": False}),
        "repair_missing_forbidden_recommendation": mutate(r, "repair_missing_forbidden_recommendation", {"forbidden_recommendations": FORBIDDEN_RECOMMENDATIONS[1:]}),
        "repair_readiness_wrong": mutate(r, "repair_readiness_wrong", {"highest_allowed_readiness": "READY_FOR_AUTOMATED_BATCH_EXECUTION"}),
        "archive_execution_allowed": mutate(a, "archive_execution_allowed", {"archive_execution_allowed": True}),
        "archive_persistence_allowed": mutate(a, "archive_persistence_allowed", {"archive_persistence_allowed": True}),
        "archive_preserve_user_records_false": mutate(a, "archive_preserve_user_records_false", {"preserve_user_records": False}),
        "archive_preserve_saved_artifacts_false": mutate(a, "archive_preserve_saved_artifacts_false", {"preserve_saved_artifacts": False}),
        "archive_preserve_retrievable_false": mutate(a, "archive_preserve_retrievable_false", {"preserve_retrievable_outputs": False}),
        "archive_human_review_false": mutate(a, "archive_human_review_false", {"human_review_required": False}),
        "approval_deploy_human_false": mutate(h, "approval_deploy_human_false", {"production_deploy_requires_human_approval": False}),
        "approval_authority_effect_not_none": mutate(h, "approval_authority_effect_not_none", {"authority_effect": "GRANTS_AUTHORITY"}),
        "approval_production_truth_effect_not_none": mutate(h, "approval_production_truth_effect_not_none", {"production_truth_effect": "APPROVES_TRUTH"}),
        "approval_missing_forbidden_decision": mutate(h, "approval_missing_forbidden_decision", {"forbidden_decisions": FORBIDDEN_DECISIONS[1:]}),
        "approval_allows_frontend_only": mutate(h, "approval_allows_frontend_only", {"allowed_decisions": ["APPROVE_FRONTEND_ONLY_SUCCESS"]}),
        "approval_allows_validation_downgrade": mutate(h, "approval_allows_validation_downgrade", {"allowed_decisions": ["APPROVE_VALIDATION_DOWNGRADE"]}),
        "approval_allows_stripe_auto": mutate(h, "approval_allows_stripe_auto", {"allowed_decisions": ["APPROVE_STRIPE_BATCH_AUTOMATICALLY"]}),
        "envelope_continuation_allowed": mutate(e, "envelope_continuation_allowed", {"continuation_allowed": True}),
        "envelope_commit_allowed": mutate(e, "envelope_commit_allowed", {"commit_allowed": True}),
        "envelope_deploy_allowed": mutate(e, "envelope_deploy_allowed", {"deploy_allowed": True}),
        "envelope_user_visibility_allowed": mutate(e, "envelope_user_visibility_allowed", {"user_visibility_allowed": True}),
        "envelope_partial_allowed": mutate(e, "envelope_partial_allowed", {"partial_artifact_exposure_allowed": True}),
        "envelope_validation_downgrade_allowed": mutate(e, "envelope_validation_downgrade_allowed", {"validation_downgrade_allowed": True}),
        "envelope_fake_success_allowed": mutate(e, "envelope_fake_success_allowed", {"fake_success_allowed": True}),
        "envelope_frontend_only_allowed": mutate(e, "envelope_frontend_only_allowed", {"frontend_only_success_allowed": True}),
        "envelope_human_review_false": mutate(e, "envelope_human_review_false", {"human_review_required": False}),
        "envelope_readiness_wrong": mutate(e, "envelope_readiness_wrong", {"highest_allowed_readiness": "READY_FOR_AUTOMATED_BATCH_EXECUTION"}),
        "repair_unknown_field": mutate(r, "repair_unknown_field", {"unknown_field": True}),
        "archive_unknown_field": mutate(a, "archive_unknown_field", {"unknown_field": True}),
        "approval_unknown_field": mutate(h, "approval_unknown_field", {"unknown_field": True}),
        "envelope_unknown_field": mutate(e, "envelope_unknown_field", {"unknown_field": True}),
        "missing_source_stop_condition_ref": mutate(r, "missing_source_stop_condition_ref", {"source_stop_condition_ref": ""}),
        "missing_builder_result_ref": mutate(r, "missing_builder_result_ref", {"source_builder_result_ref": ""}),
        "missing_product_reality_review_ref": mutate(r, "missing_product_reality_review_ref", {"source_product_reality_review_ref": ""}),
    }


def run_self_test() -> Dict[str, Any]:
    valid_packets = [valid_repair_packet(), valid_archive_packet(), valid_approval_packet(), valid_envelope()]
    valid_results = [
        validate_repair_packet(valid_packets[0]),
        validate_archive_packet(valid_packets[1]),
        validate_human_approval_request_packet(valid_packets[2]),
        validate_envelope(valid_packets[3]),
    ]
    validators = {
        "repair": validate_repair_packet,
        "archive": validate_archive_packet,
        "approval": validate_human_approval_request_packet,
        "envelope": validate_envelope,
    }
    invalid_results: Dict[str, Dict[str, Any]] = {}
    for name, packet in invalid_fixtures().items():
        if name.startswith("archive_"):
            invalid_results[name] = validators["archive"](packet)
        elif name.startswith("approval_"):
            invalid_results[name] = validators["approval"](packet)
        elif name.startswith("envelope_"):
            invalid_results[name] = validators["envelope"](packet)
        else:
            invalid_results[name] = validators["repair"](packet)
    invalid_failures = [name for name, result in invalid_results.items() if result["valid"]]
    valid_count = sum(1 for result in valid_results if result["valid"])
    status = "passed" if valid_count == len(valid_packets) and not invalid_failures else "failed"
    return {
        "sprint": "MM-DL-6",
        "status": status,
        "verdict": EXPECTED_VERDICT if status == "passed" else "MOREMINDMAP_REPAIR_ARCHIVE_HUMAN_APPROVAL_PACKET_SCHEMA_SELFTEST_FAILED",
        "classification": EXPECTED_CLASSIFICATION,
        "schema_version": SCHEMA_VERSION,
        "valid_records_passed": valid_count,
        "valid_records_total": len(valid_packets),
        "invalid_records_failed_closed": sum(1 for result in invalid_results.values() if not result["valid"]),
        "invalid_records_total": len(invalid_results),
        "invalid_failures": invalid_failures,
        "valid_fixture_hashes": [stable_hash(packet) for packet in valid_packets],
        "invalid_fixture_hashes": {name: result["packet_hash"] for name, result in invalid_results.items()},
        "safety_flags": {
            "report_only": True, "schema_only": True, "no_runtime": True,
            "no_batch_execution": True, "no_codex_automation": True,
            "no_active_agents": True, "no_routes": True, "no_ui": True,
            "no_stripe_changes": True, "no_formspree_changes": True,
            "no_subscription_changes": True, "no_outcome_ledger_changes": True,
            "no_assessment_generation_changes": True, "no_active_repair_execution": True,
            "no_rollback_execution": True, "no_archive_persistence": True,
            "no_approval_workflow_runtime": True, "no_deployment": True,
        },
        "generated_at": now_iso(),
    }


def write_self_test_trace(summary: Dict[str, Any]) -> None:
    with open("runtime_traces/moremindmap_repair_archive_human_approval_packet_schema_selftest_06.json", "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, sort_keys=True)
        handle.write("\n")


def main(argv: List[str]) -> int:
    if "--self-test" not in argv:
        print("usage: python3 moremindmap_repair_archive_human_approval_packet_schema.py --self-test")
        return 2
    summary = run_self_test()
    write_self_test_trace(summary)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0 if summary["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

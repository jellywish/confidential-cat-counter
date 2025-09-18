import json
import os
import hashlib
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class PolicyDecision:
    action: str  # "allow" | "deny" | "redact"
    reasons: List[str]
    rule_ids: List[str]
    redacted_output: Optional[Dict[str, Any]] = None


def _default_policy_bundle() -> Dict[str, Any]:
    # Conservative defaults for Phase 1.5-light
    return {
        "version": "1.0",
        "max_response_size": 2048,
        "forbidden_patterns": ["image/", "data:", "/9j/", "iVBOR"],
        "min_confidence": 0.0,
        "max_cats": 20,
    }


def _sha256_hexdigest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_policy_bundle() -> Tuple[Dict[str, Any], str]:
    """Load policy bundle JSON and return bundle + sha256 digest string."""
    path = os.getenv("POLICY_BUNDLE_PATH", "")
    if path and os.path.exists(path):
        with open(path, "rb") as f:
            content = f.read()
        try:
            bundle = json.loads(content.decode("utf-8"))
        except json.JSONDecodeError:
            bundle = _default_policy_bundle()
            content = json.dumps(bundle, separators=(",", ":")).encode("utf-8")
        return bundle, _sha256_hexdigest(content)
    else:
        bundle = _default_policy_bundle()
        content = json.dumps(bundle, separators=(",", ":")).encode("utf-8")
        return bundle, _sha256_hexdigest(content)


def evaluate_input_policy(job_data: Dict[str, Any], bundle: Dict[str, Any]) -> PolicyDecision:
    # For Phase 1.5-light, keep input policy simple; deny only on egregious metadata
    reasons: List[str] = []
    rule_ids: List[str] = []

    # Example rule: basic size ceiling if provided
    size = job_data.get("size")
    if isinstance(size, int) and size > 25 * 1024 * 1024:  # 25MB
        reasons.append("file_too_large")
        rule_ids.append("in.max_upload_size")
        return PolicyDecision(action="deny", reasons=reasons, rule_ids=rule_ids)

    return PolicyDecision(action="allow", reasons=reasons, rule_ids=rule_ids)


def _redact_output(output: Dict[str, Any], bundle: Dict[str, Any]) -> Dict[str, Any]:
    # Our output schema is already minimal; ensure bounded sizes and strip unknown fields
    redacted: Dict[str, Any] = {}
    for key in ("cats", "confidence", "processing_time", "model"):
        if key in output:
            redacted[key] = output[key]
    return redacted


def evaluate_output_policy(output: Dict[str, Any], bundle: Dict[str, Any]) -> PolicyDecision:
    reasons: List[str] = []
    rule_ids: List[str] = []

    # Enforce fixed schema and size
    serialized = json.dumps(output, separators=(",", ":")).encode("utf-8")
    if len(serialized) > int(bundle.get("max_response_size", 2048)):
        reasons.append("response_too_large")
        rule_ids.append("out.size")
        redacted = _redact_output(output, bundle)
        return PolicyDecision(action="redact", reasons=reasons, rule_ids=rule_ids, redacted_output=redacted)

    # Enforce forbidden patterns guard-rail on string fields
    forbidden = bundle.get("forbidden_patterns", [])
    for key, value in output.items():
        if isinstance(value, str):
            if any(pat in value for pat in forbidden):
                reasons.append("forbidden_pattern")
                rule_ids.append("out.forbidden_pattern")
                redacted = _redact_output(output, bundle)
                return PolicyDecision(action="redact", reasons=reasons, rule_ids=rule_ids, redacted_output=redacted)

    # Optional semantic checks
    if isinstance(output.get("cats"), int) and output["cats"] > int(bundle.get("max_cats", 20)):
        reasons.append("cats_exceed_limit")
        rule_ids.append("out.cats_limit")
        redacted = _redact_output(output, bundle)
        return PolicyDecision(action="redact", reasons=reasons, rule_ids=rule_ids, redacted_output=redacted)

    return PolicyDecision(action="allow", reasons=reasons, rule_ids=rule_ids)


def decision_to_dict(decision: PolicyDecision) -> Dict[str, Any]:
    d: Dict[str, Any] = {
        "action": decision.action,
        "reasons": decision.reasons,
        "rule_ids": decision.rule_ids,
    }
    if decision.redacted_output is not None:
        d["redacted_output"] = decision.redacted_output
    return d



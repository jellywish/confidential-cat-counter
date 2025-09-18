import json
import os
import json
import hashlib
from policy import _default_policy_bundle, evaluate_input_policy, evaluate_output_policy, load_policy_bundle


def test_input_policy_allows_small_file():
    bundle = _default_policy_bundle()
    job = {"size": 1024 * 1024}  # 1MB
    d = evaluate_input_policy(job, bundle)
    assert d.action == "allow"


def test_input_policy_denies_large_file():
    bundle = _default_policy_bundle()
    job = {"size": 30 * 1024 * 1024}  # 30MB
    d = evaluate_input_policy(job, bundle)
    assert d.action == "deny"


def test_output_policy_allows_normal_payload():
    bundle = _default_policy_bundle()
    out = {"cats": 1, "confidence": 0.9, "processing_time": "1.0s", "model": "mock"}
    d = evaluate_output_policy(out, bundle)
    assert d.action == "allow"


def test_output_policy_redacts_large_payload():
    bundle = _default_policy_bundle()
    big_str = "X" * (bundle["max_response_size"] + 100)
    out = {"cats": 1, "confidence": 0.9, "processing_time": big_str, "model": "mock"}
    d = evaluate_output_policy(out, bundle)
    assert d.action == "redact"
    assert set(d.redacted_output.keys()) == {"cats", "confidence", "processing_time", "model"}


def test_output_policy_redacts_forbidden_pattern():
    bundle = _default_policy_bundle()
    out = {"cats": 0, "confidence": 0.1, "processing_time": "ok", "model": "data:image/png;base64,AAAA"}
    d = evaluate_output_policy(out, bundle)
    assert d.action == "redact"


def test_policy_signature_verification(tmp_path):
    # Write a small policy file
    policy = _default_policy_bundle()
    p = tmp_path / "policy.json"
    content = json.dumps(policy, separators=(",", ":")).encode("utf-8")
    p.write_bytes(content)

    # Correct signature
    key = "dev-policy-key"
    sig = hashlib.sha256(key.encode("utf-8") + content).hexdigest()
    # Our verification does HMAC(key, content), not concat; compute correct HMAC
    import hmac
    sig = hmac.new(key.encode("utf-8"), content, hashlib.sha256).hexdigest()

    os.environ["POLICY_BUNDLE_PATH"] = str(p)
    os.environ["POLICY_BUNDLE_HMAC_KEY"] = key
    os.environ["POLICY_BUNDLE_SIGNATURE"] = sig
    bundle, digest = load_policy_bundle()
    assert bundle["version"] == policy["version"]

    # Tamper signature
    os.environ["POLICY_BUNDLE_SIGNATURE"] = "deadbeef"
    try:
        load_policy_bundle()
        assert False, "Expected signature verification failure"
    except ValueError:
        pass


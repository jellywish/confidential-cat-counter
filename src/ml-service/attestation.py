import os
import time
import uuid
from dataclasses import dataclass
from typing import Dict, Any, Tuple


@dataclass
class AttestationEvidence:
    image_digest: str
    policy_digest: str
    simulated: bool
    timestamp: int
    nonce: str


class AttestationVerifier:
    def verify(self, evidence: AttestationEvidence) -> Tuple[bool, str]:
        raise NotImplementedError


class DevAttestationVerifier(AttestationVerifier):
    def __init__(self, expected_policy_digest: str) -> None:
        self.expected_policy_digest = expected_policy_digest

    def verify(self, evidence: AttestationEvidence) -> Tuple[bool, str]:
        if not evidence.simulated:
            return False, "non-simulated evidence in dev verifier"
        if evidence.policy_digest != self.expected_policy_digest:
            return False, "policy digest mismatch"
        return True, "ok"


class KeyReleaseClient:
    def request_data_key(self, evidence: AttestationEvidence) -> Dict[str, Any]:
        raise NotImplementedError


class DevKeyReleaseClient(KeyReleaseClient):
    def request_data_key(self, evidence: AttestationEvidence) -> Dict[str, Any]:
        # Always returns a deterministic dev key material and id
        return {
            "key_id": "DEV-LOCAL-KEY",
            "wrapped_key": "DEV_WRAPPED_KEY_PLACEHOLDER",
            "algorithm": "AES-256-GCM",
        }


def build_dev_evidence(policy_digest: str) -> AttestationEvidence:
    return AttestationEvidence(
        image_digest=os.getenv("IMAGE_DIGEST", "dev-local"),
        policy_digest=policy_digest,
        simulated=os.getenv("SIMULATED_ATTESTATION", "true").lower() == "true",
        timestamp=int(time.time()),
        nonce=str(uuid.uuid4()),
    )



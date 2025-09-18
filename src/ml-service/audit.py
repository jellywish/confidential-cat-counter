import hmac
import hashlib
import json
import os
import time
from typing import Any, Dict

_SEQ = 0


def _get_audit_key() -> bytes:
    key = os.getenv("AUDIT_HMAC_KEY", "dev-local-hmac-key")
    return key.encode("utf-8")


def sign_record(record: Dict[str, Any]) -> str:
    body = json.dumps(record, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return hmac.new(_get_audit_key(), body, hashlib.sha256).hexdigest()


def emit_audit(event: str, data: Dict[str, Any]) -> Dict[str, Any]:
    global _SEQ
    _SEQ += 1
    # Enrich with common fields
    enriched = {
        "event": event,
        "timestamp": int(time.time()),
        "simulated": os.getenv("SIMULATED_ATTESTATION", "true").lower() == "true",
        "sequence": _SEQ,
        **data,
    }
    enriched["signature"] = sign_record(enriched)
    # Phase 1.5-light: print to stdout; Phase 2: ship to append-only sink
    print(json.dumps({"audit": enriched}, separators=(",", ":")))
    return enriched



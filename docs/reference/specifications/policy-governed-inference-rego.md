# Policy‑Governed Inference with Rego (Inside‑Out Design)

Goal: Provide a technical guarantee that specified classes of data can never egress from the attestable software environment by enforcing declarative, auditable policies at pre‑ and post‑inference boundaries and through a single egress guard.

## 1. Non‑Goals and Scope
- Non‑goal: Full formal verification of the entire system (roadmap item). We will, however, keep the guard small and testable.
- Scope: Server‑side policy enforcement inside `ml-service`; client‑side TOU remains as is.

## 2. Architecture (Inside‑Out)
- Pre‑inference hook: `evaluate_input_policy(image_path: str, context: dict) -> Decision`
- Post‑inference hook: `evaluate_output_policy(result: dict, context: dict) -> Decision`
- Egress guard: wraps all responses and enforces `Decision` outcomes (allow | deny | redact) and writes structured audit logs.
- Policy engine: Rego via OPA (embedded or subprocess) with policies stored under `src/ml-service/policy/`.
- Policy context: JSON document including request metadata (size/type), model info, and proposed output schema.

### Decision contract
```json
{
  "effect": "allow|deny|redact",
  "reason": "string",
  "redactions": { "fields": ["confidence", "boxes[*].embedding"] }
}
```

## 3. Minimal Changes to Codebase
- `src/ml-service/app.py`
  - Add: `evaluate_input_policy()` call before reading/processing file
  - Add: `evaluate_output_policy()` call before returning results
  - Add: `egress_guard(decision, result)` to enforce allow/deny/redact
  - Add: structured audit logger (JSON lines) for decisions at both hooks
- `src/ml-service/policy/`
  - `bundles/` Rego policies
  - `tests/` Rego unit tests (`opa test`)
  - `schemas/` JSON schema for `result` and `context`
- `src/ml-service/policy/engine.py`
  - Load Rego bundle; evaluate queries; normalize into `Decision`

## 4. Rego Policy Layout
- `input.rego` (pre‑inference)
```rego
package ccc.input

# context: {
#   file: { size_bytes, detected_type },
#   request: { ip_hash, user_agent },
#   limits: { max_size_mb },
# }

allow[decision] {
  not too_large
  allowed_type
  decision := {"effect": "allow", "reason": "ok"}
}

too_large {
  input.file.size_bytes > input.limits.max_size_mb * 1024 * 1024
}

allowed_type {
  input.file.detected_type in {"image/jpeg","image/png","image/gif"}
}
```

- `output.rego` (post‑inference)
```rego
package ccc.output

# result: { cats, confidence, boxes, model, processing_time }

default effect := {"effect": "allow", "reason": "ok"}

raw_embeddings := some b; input.result.boxes[b].embedding != null

deny[decision] {
  raw_embeddings
  decision := {"effect": "deny", "reason": "raw_embeddings_blocked"}
}

redact[decision] {
  input.result.confidence < 0.5
  decision := {"effect": "redact", "reason": "low_confidence", "redactions": {"fields": ["confidence"]}}
}

allow[decision] {
  not raw_embeddings
  input.result.confidence >= 0.5
  decision := {"effect": "allow", "reason": "ok"}
}
```

Evaluation order: `deny` > `redact` > `allow` (first hit wins).

## 5. Egress Guard Behavior
- allow: return `result` unchanged
- redact: remove/mask `redactions.fields` before return
- deny: return HTTP 403 with `{ code: "EGRESS_DENIED", reason }`
- log JSON: `{ ts, hook: "input|output", effect, reason, policy_version, request_id, job_id, context_digest }`

## 6. Structured Audit Logs
- Location: `data/results/audit.log` (JSONL)
- Use a stable hash of `context`/`result` to avoid PII while enabling traceability

## 7. Unit and Policy Tests
- Python unit tests: mock engine → assert egress behavior
- Rego tests: `opa test` for allow/deny/redact paths
- Integration test: upload → inference → guard → logs

## 8. Configuration and Distribution
- Env: `POLICY_ENABLED=true`, `POLICY_BUNDLE_PATH`, `POLICY_VERSION`
- CI: `opa fmt/check/test`; attach policy bundle digest to releases

## 9. Attestation & Guarantees (Roadmap)
- Package guard + policy bundle into enclave; attestation includes their digests
- Keys released only if quote matches approved digest set
- Claim: given attested measurement M and policy P, outputs that violate P cannot egress

## 10. Migration Path
- Phase 1: hooks, engine, guard, logs, tests, sample policies
- Phase 2: OPA‑WASM/embedded; DP budgets + k‑anonymity
- Phase 3: Nitro enclave + attestation‑gated decrypt; formal guard invariants

## 11. Open Questions
- DP budget ledger placement
- Policy hot‑reload vs restart
- Expose verifiable policy version (headers vs signed receipt)



## Can the operator access user data? A clear-eyed analysis

Status: Phase 1 (local-only) — operator-resistant confidentiality is NOT provided. This analysis documents where confidentiality breaks today and what work is required to provide technical guarantees in Phase 2.

### Scope and definitions
- Operator: Any person with control of the runtime environment (host OS, Docker, Kubernetes, cloud account) who can read process memory, logs, disks, or network traffic at the infrastructure boundary.
- Property evaluated: “Operator cannot access plaintext user data or model outputs beyond policy-governed disclosures.”

### Summary
- Today’s local reference encrypts in the browser, but decryption and inference run in a regular container. Anyone with host/registry access can read plaintext in memory, on disk, or in logs. Therefore, the operator-nonaccess property is not met.
- We do have building blocks toward this property: client-side encryption, policy hooks, and an egress guard design. To achieve the property, we must add attestation-gated decryption inside a confidential runtime and enforce post-inference egress policy with auditable decisions.

### Threat model (operator capabilities)
1. Snapshot process memory of `ml-service` container/VM.
2. Read writable volumes (e.g., `uploads/`, `results/`).
3. Intercept inter-container traffic or attach debuggers.
4. Read application/infra logs and metrics.
5. Modify binaries or configuration prior to launch.

### Where confidentiality breaks today (Phase 1)
- Decryption location: Plaintext exists in the `ml-service` process memory to perform inference.
- Storage: Uploaded files and intermediate artifacts can exist on disk inside the container’s filesystem; an operator can copy the layer or bind mount.
- Logs: Any verbose logging/misbuilt dependencies could echo filenames, sizes, or even traces of content.
- Keys: Symmetric content keys are derived/handled inside the container; an operator with root could extract them from memory.

Conclusion: A root-capable operator can access plaintext. No cryptographic boundary prevents it in Phase 1.

### What is required to provide the operator‑nonaccess property (Phase 2+)
1. Attestation-gated decryption
   - Run the inference service inside a confidential computing TEE (e.g., AWS Nitro Enclaves, AMD SEV-SNP, Intel TDX).
   - Use a remote KMS/unsealer that releases the data key only after verifying a signed attestation (PCR/measurement) of the runtime and policy bundle.
   - Keys never exist outside the enclave boundary; decryption/inference occur exclusively inside the TEE.

2. Egress guard with declarative policy
   - Pre-policy (input): Validate file types, enforce content constraints before decryption/inference.
   - Post-policy (output): Decide allow/deny/redact on inference outputs and any metadata. Encode rules in Rego; decisions returned as {allow|deny|redact}+justification.
   - Structured audit logs: Signed, append-only records linking request → measurement → policy version → decision → digest of outputs.

3. Supply-chain and runtime integrity
   - Build provenance (SLSA), image signing/verification, and policy bundle signing.
   - Minimal, reproducible image for the attested component.

4. Network and storage controls
   - No host-mounted writable volumes inside the TEE. Use in-enclave tmpfs or encrypted scratch.
   - Strict egress from the attested boundary; the guard is the only exfiltration path.

### Concrete design alignment with this repo
- Hooks: Implement `evaluate_input_policy()` and `evaluate_output_policy()` in `ml-service` as first-class pre/post gates.
- Policy engine: Load Rego bundles at startup; pin hashes in the attestation measurement.
- Key release: Introduce `key-release-service` that validates the enclave attestation document and releases a one-time data key (or decrypts content directly) to the enclave only.
- Artifacts: Move to “inside-out” control—outputs exit the enclave only after `allow` or are redacted according to policy.

### Evidence and tests to support the guarantee
- Attestation test: CI produces a measurement; runtime attestation must match expected PCR/measurement set.
- Policy test: Golden-policy tests for allow/deny/redact scenarios.
- Egress test: Attempt to exfiltrate disallowed content (e.g., raw images) and assert deny.
- Memory/disk test: No plaintext written outside the enclave; fail build if code writes outside controlled paths.

### Residual risks and disclosures
- Operator with cloud admin could deny service or roll out altered images. Mitigation: policy/KMS will refuse key release for unknown measurements; availability, not confidentiality, is affected.
- Side-channels: TEE side-channel classes are out of scope for Phase 2 MVP; document assumptions and review vendor guidance.

### Phase plan
- Phase 1 (current): Educational local reference. No operator resistance. Clear disclaimers in README.
- Phase 2: Add attested runtime + key release + policy egress guard + audit. Deliver repeatable demos and tests above.
- Phase 3: Formalize specs (non-interference for egress), SBOM/provenance, and third‑party attestation verification.

### Acceptance criteria for “operator cannot access data”
1. Keys are released only after successful attestation verifying code+policy measurements.
2. Plaintext data and outputs exist only inside the attested boundary.
3. The only sanctioned egress path is mediated by policy with signed, immutable audit.
4. Regression tests prove deny/redact behaviors for disallowed content.

### References
- AWS Nitro Enclaves: Key release via KMS attestation.
- OPA/Rego: Declarative policy for pre/post decisions and auditing patterns.

This document should be read together with `docs/reference/specifications/policy-governed-inference-rego.md` and the Phase 2 design notes.


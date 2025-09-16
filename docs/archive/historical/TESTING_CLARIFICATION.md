# Security Guarantees vs Testing

## Two Different Approaches

### 1. Testing (Development Confidence)
**What our tests do:**
- Generate synthetic test images with known patterns
- Check that those patterns don't appear in logs/storage/memory
- Verify job isolation between test cases

**Value:** Catches implementation regressions and obvious mistakes.

**Limitation:** Cannot prove user data is safe - we'd need to know user data content to test for it.

### 2. Attested Policy + Egress Guard (Security Guarantee)
**How this provides real guarantees:**
- **Attested policy manifest**: Immutable rules baked into measured image
- **KMS gating**: Keys only released if PCRs + policy hash match
- **Constrained egress guard**: All outputs filtered through tiny component with strict schema
- **Model as data**: ONNX weights loaded with allowlist ops, no custom code

**What this guarantees:** Raw photos cannot be exported - no code path exists to do so.

**What this doesn't guarantee:** Perfect prevention of covert channels via small outputs (mitigated with size caps + rate limits).

## Implementation Strategy

**Phase 1-2:** Testing for development confidence  
**Phase 3+:** Attested policy + egress guard for security guarantees

Testing validates implementation correctness. Attestation + policy provides cryptographic guarantees.

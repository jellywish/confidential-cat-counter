# Attestation Integration Strategy: CCC Project

**Author**: Spencer Janyk  
**Date**: January 2025  
**Purpose**: Comprehensive strategy for addressing attestation integration complexity

---

## Executive Summary

**Problem**: Attestation integration is the highest technical risk that could cause complete system failure  
**Solution**: Layered development approach with simulation, verification, and reproducible builds  
**Key Insight**: **Start with attestation simulation, progress to real enclaves with known-good patterns**

---

## Core Attestation Challenge

### **Why Attestation Integration is High-Risk**

**Complex Multi-Component System:**
```
User Request → KMS Key Policy → Attestation Document → PCR Validation → Key Release → Data Decryption
```

**Single Point of Failure:**
- One wrong PCR measurement = complete system breakdown
- KMS policy misconfiguration = unable to decrypt any data
- Attestation verification bug = security vulnerability

**Debugging Difficulty:**
- Attestation failures often have cryptic error messages
- PCR values change with any code/configuration modification
- Limited debugging capabilities inside enclaves

---

## Layered Attestation Development Strategy

### **Phase 1: Attestation Simulation (Local Development)**
**Goal**: Understand attestation flow without enclave complexity

```python
# Mock attestation for local development
class MockAttestationProvider:
    def generate_attestation_document(self):
        return {
            "module_id": "mock-i-1234567890abcdef0-enc-1234567890abcdef",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "digest": "SHA384",
            "pcrs": {
                "0": "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
                "1": "111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
                "2": "222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222"
            },
            "certificate": "mock-certificate-data",
            "cabundle": ["mock-ca-bundle"],
            "public_key": "mock-public-key",
            "user_data": None,
            "nonce": None
        }
```

### **Phase 2: Static Attestation Testing (Known PCRs)**
**Goal**: Test KMS integration with pre-calculated PCR values

```bash
# Build deterministic EIF and capture PCRs
nitro-cli build-enclave --docker-uri my-enclave:latest --output-file enclave.eif
nitro-cli describe-eif --eif-path enclave.eif

# Output: PCR0, PCR1, PCR2 values for KMS policy
```

**Key Pattern**: **Build once, test many times with same PCR values**

### **Phase 3: Reproducible Build Pipeline**
**Goal**: Ensure consistent PCR measurements across environments

```yaml
# Dockerfile for deterministic builds
FROM public.ecr.aws/amazonlinux/amazonlinux:2023

# Pin all package versions for reproducibility
RUN yum install -y \
    python3-3.9.16 \
    python3-pip-21.3.1 \
    && yum clean all

# Fixed timestamps for reproducible builds
ENV SOURCE_DATE_EPOCH=1640995200

# Copy application code
COPY --chown=1000:1000 src/ /app/
WORKDIR /app

# Install exact dependency versions
COPY requirements.lock .
RUN pip install -r requirements.lock

# Fixed entrypoint
ENTRYPOINT ["python3", "main.py"]
```

---

## Reproducible Builds & Attested Releases

### **The "Attested Builds" Concept You're Getting At**

**Exactly Right**: We need to publish the **exact PCR measurements** that correspond to our release artifacts so users can:
1. **Verify they're running the correct enclave code**
2. **Configure their KMS policies** with known-good PCR values
3. **Reproduce the exact same build** from source

### **Implementation Strategy**

**1. Deterministic Build Process**
```bash
# Build script that produces identical EIFs
#!/bin/bash
set -e

export SOURCE_DATE_EPOCH=1640995200  # Fixed timestamp
export DOCKER_BUILDKIT=1

# Build with reproducible settings
docker build \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  --platform linux/x86_64 \
  -t ccc-enclave:${VERSION} \
  .

# Generate EIF
nitro-cli build-enclave \
  --docker-uri ccc-enclave:${VERSION} \
  --output-file ccc-enclave-${VERSION}.eif

# Extract and publish PCR measurements
nitro-cli describe-eif --eif-path ccc-enclave-${VERSION}.eif > pcr-measurements-${VERSION}.json
```

**2. Release Artifacts Structure**
```
releases/
├── v1.0.0/
│   ├── ccc-enclave-v1.0.0.eif          # Enclave Image File
│   ├── pcr-measurements-v1.0.0.json    # PCR values for KMS policies
│   ├── kms-policy-template-v1.0.0.json # Pre-configured KMS policy
│   ├── Dockerfile.reproduce             # Exact build instructions
│   └── build-manifest.json              # Build environment details
```

**3. PCR Measurements File Format**
```json
{
  "version": "v1.0.0",
  "build_timestamp": "2025-01-15T10:30:00Z",
  "measurements": {
    "PCR0": "a1b2c3d4e5f6789....",  # Image SHA384
    "PCR1": "b2c3d4e5f6789a....",  # Kernel+ramdisk
    "PCR2": "c3d4e5f6789ab2...."   # Application
  },
  "kms_policy_conditions": {
    "kms:RecipientAttestation:ImageSha384": "a1b2c3d4e5f6789....",
    "kms:RecipientAttestation:PCR1": "b2c3d4e5f6789a....",
    "kms:RecipientAttestation:PCR2": "c3d4e5f6789ab2...."
  },
  "verification": {
    "docker_image_digest": "sha256:...",
    "build_environment": "amazonlinux:2023",
    "nitro_cli_version": "1.2.2"
  }
}
```

**4. User Deployment Flow**
```bash
# User downloads release
wget https://github.com/spencer/ccc/releases/v1.0.0/ccc-enclave-v1.0.0.eif
wget https://github.com/spencer/ccc/releases/v1.0.0/pcr-measurements-v1.0.0.json

# Configure KMS policy with published PCR values
aws kms put-key-policy \
  --key-id $KMS_KEY_ID \
  --policy file://kms-policy-template-v1.0.0.json

# Deploy enclave with confidence
nitro-cli run-enclave \
  --eif-path ccc-enclave-v1.0.0.eif \
  --memory 1024 \
  --cpu-count 2
```

---

## AWS Workshop Best Practices

### **Key Findings from AWS Nitro Enclaves Workshop**

**Repository**: `aws-samples/aws-nitro-enclaves-workshop`

**Best Practice 1: Start Simple**
```python
# Begin with minimal enclave that just returns "hello world"
# Add complexity incrementally: networking → encryption → attestation
```

**Best Practice 2: Attestation-First Development**
```python
# Always verify attestation document structure before adding business logic
attestation_doc = get_attestation_document()
verify_attestation_structure(attestation_doc)
log_pcr_values(attestation_doc)  # For debugging
```

**Best Practice 3: Graceful Degradation**
```python
# Handle attestation failures gracefully
try:
    kms_key = get_kms_key_with_attestation(attestation_doc)
except AttestationError as e:
    log_error(f"Attestation failed: {e}")
    # Use development key or fail gracefully
    if is_development_environment():
        kms_key = get_development_key()
    else:
        raise
```

**Best Practice 4: Comprehensive Logging**
```python
# Log everything about attestation for debugging
logger.info(f"PCR0 (Image): {attestation['pcrs']['0']}")
logger.info(f"PCR1 (Kernel): {attestation['pcrs']['1']}")
logger.info(f"PCR2 (App): {attestation['pcrs']['2']}")
logger.info(f"Module ID: {attestation['module_id']}")
```

---

## KMS Policy Development

### **Robust KMS Policies with Proper Validation**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Enable decrypt for verified enclaves only",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT:role/EnclaveRole"
      },
      "Action": "kms:Decrypt",
      "Resource": "*",
      "Condition": {
        "StringEqualsIgnoreCase": {
          "kms:RecipientAttestation:ImageSha384": "EXPECTED_PCR0_VALUE",
          "kms:RecipientAttestation:PCR1": "EXPECTED_PCR1_VALUE",
          "kms:RecipientAttestation:PCR2": "EXPECTED_PCR2_VALUE"
        }
      }
    }
  ]
}
```

**Critical Patterns:**
- **Multiple PCR validation** (not just PCR0)
- **Exact SHA384 matching** for image integrity
- **Role-based access** with attestation conditions

---

## Specific Mitigation Strategies

### **Risk 1: PCR Value Changes**
**Problem**: Code changes invalidate PCR measurements
**Solution**: **PCR pinning with version management**

```bash
# Version-specific PCR tracking
cat > pcr-expectations.json << EOF
{
  "v1.0.0": {"PCR0": "abc123...", "PCR1": "def456...", "PCR2": "ghi789..."},
  "v1.0.1": {"PCR0": "bcd234...", "PCR1": "efg567...", "PCR2": "hij890..."}
}
EOF
```

### **Risk 2: KMS Policy Complexity**
**Problem**: Complex conditional logic in KMS policies
**Solution**: **Template-based policy generation**

```python
# KMS policy template generator
def generate_kms_policy(pcr_measurements, account_id, role_name):
    return {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"AWS": f"arn:aws:iam::{account_id}:role/{role_name}"},
            "Action": "kms:Decrypt",
            "Resource": "*",
            "Condition": {
                "StringEqualsIgnoreCase": {
                    f"kms:RecipientAttestation:ImageSha384": pcr_measurements["PCR0"],
                    f"kms:RecipientAttestation:PCR1": pcr_measurements["PCR1"],
                    f"kms:RecipientAttestation:PCR2": pcr_measurements["PCR2"]
                }
            }
        }]
    }
```

### **Risk 3: Cross-Environment Differences**
**Problem**: Different PCR values between dev/staging/production
**Solution**: **Environment-specific attestation validation**

```python
# Environment-aware attestation
def get_expected_pcrs(environment):
    pcr_config = {
        "development": load_pcr_config("dev-pcrs.json"),
        "staging": load_pcr_config("staging-pcrs.json"),
        "production": load_pcr_config("prod-pcrs.json")
    }
    return pcr_config[environment]
```

---

## Implementation Timeline

### **Phase 1 (Week 1-2): Attestation Foundation**
- [ ] Set up mock attestation provider
- [ ] Create attestation document parsing logic
- [ ] Build basic KMS integration with mock attestation

### **Phase 2 (Week 3-4): Reproducible Builds**
- [ ] Implement deterministic Docker builds
- [ ] Create PCR measurement extraction pipeline
- [ ] Set up release artifact generation

### **Phase 3 (Week 5-6): Real Enclave Integration**
- [ ] Deploy first real enclave with attestation
- [ ] Verify KMS policy with real PCR values
- [ ] Test cross-environment PCR consistency

### **Phase 4 (Week 7-8): Production Hardening**
- [ ] Implement comprehensive attestation error handling
- [ ] Add attestation monitoring and alerting
- [ ] Create attestation debugging guides

---

## Success Criteria

**Attestation Integration Complete When:**
- ✅ **Reproducible builds** generate identical PCR values
- ✅ **KMS policies work** with published PCR measurements
- ✅ **Cross-environment deployment** uses consistent attestation
- ✅ **Comprehensive error handling** for attestation failures
- ✅ **Clear debugging guides** for attestation issues

**Key Deliverable**: **Published release artifacts** with verified PCR measurements that anyone can use to deploy the system with working attestation.

---

## Resources & References

**AWS Documentation:**
- [AWS Nitro Enclaves Developer Guide](https://docs.aws.amazon.com/enclaves/)
- [KMS Key Policies with Attestation](https://docs.aws.amazon.com/kms/latest/developerguide/policy-conditions.html#conditions-nitro-enclaves)

**AWS Workshop:**
- [aws-samples/aws-nitro-enclaves-workshop](https://github.com/aws-samples/aws-nitro-enclaves-workshop)

**Research Papers:**
- [Nitriding: A Tool Kit for Building Scalable, Networked, Secure Enclaves](https://arxiv.org/abs/2206.04123)

**AWS re:Invent Sessions:**
- CMP324: "Protect Sensitive Data in Use with AWS Confidential Compute" (2024)
- CMP403: "Enabling Multi-Party Analysis of Sensitive Data Using AWS Nitro Enclaves" (2022)
- CMP301: "Dive Deep into the AWS Nitro System" (2024)
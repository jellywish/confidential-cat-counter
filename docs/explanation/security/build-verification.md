# Build Verification & Deployment Integrity

**Purpose**: Enable customers and operators to cryptographically verify that deployed enclaves correspond to expected source code and maintain integrity guarantees.

---

## Overview

The CCC Project provides **cryptographic build verification** that allows:

1. **Customers** - Verify their data will only be processed by expected enclave code
2. **Operators** - Verify deployed artifacts match source control
3. **Auditors** - Independently verify system integrity claims

**Core Principle**: *"Don't trust, verify"* - all deployments are cryptographically verifiable.

## Reproducible Builds Checklist

### **Phase 1-5: Deterministic Container Builds**
```bash
# Ensure reproducible builds from Day 1
export SOURCE_DATE_EPOCH=1640995200  # Fixed timestamp
export DOCKER_BUILDKIT=1

# Deterministic Dockerfile patterns
FROM node:18.17.0-alpine@sha256:abc123...  # Pin with digest
RUN npm ci --only=production             # Lockfile, no cache
COPY --chown=app:app . /app             # Consistent ownership
```

### **Phase 6+: Nitro Enclave Reproducible Builds**
```bash
# 1. Reproducible EIF generation
nitro-cli build-enclave \
  --docker-uri your-repo/ccc-ml:v1.0.0 \
  --output-file ccc-enclave-v1.0.0.eif

# 2. Extract and publish PCR measurements
nitro-cli describe-eif --eif-path ccc-enclave-v1.0.0.eif > pcr-measurements.json

# 3. Verify reproducibility
sha384sum ccc-enclave-v1.0.0.eif  # Should match published hash
```

### **PCR Publishing Workflow**
```yaml
# releases/v1.0.0/attestation-data.json
{
  "version": "1.0.0",
  "build_date": "2024-01-15T10:00:00Z",
  "git_commit": "abc123def456...",
  "measurements": {
    "PCR0": "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f",
    "PCR1": "313233343536373839404142434445464748495051525354555657585960616263646566676869707172737475767778",
    "PCR2": "797a7b7c7d7e7f808182838485868788899091929394959697989a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeaf"
  },
  "image_sha384": "b0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedf",
  "kms_policy_template": "kms-policy-v1.0.0.json"
}
```

### **Verification Script**
```bash
#!/bin/bash
# scripts/verify-build.sh
VERSION=${1:-latest}

echo "🔍 Verifying build reproducibility for version $VERSION"

# 1. Rebuild from source
docker build --build-arg SOURCE_DATE_EPOCH=1640995200 -t ccc-ml:verify .

# 2. Compare image hashes
EXPECTED=$(cat releases/$VERSION/attestation-data.json | jq -r '.image_sha384')
ACTUAL=$(docker inspect ccc-ml:verify | jq -r '.[0].RepoDigests[0]' | cut -d'@' -f2)

if [ "$EXPECTED" = "$ACTUAL" ]; then
  echo "✅ Build verification passed"
else
  echo "❌ Build verification failed"
  exit 1
fi
```

---

## Build Artifact Chain of Trust

### **1. Source Code Verification**

**Git Commit Signing:**
```bash
# All commits are signed with project maintainer keys
git log --show-signature

# Verify specific release tag
git tag -v v1.0.0
```

**Reproducible Source:**
- All source code publicly available
- Deterministic build process from source
- Cryptographic commit signatures

### **2. Build Process Verification** 

**Reproducible Builds:**
```bash
# Deterministic Docker build
export SOURCE_DATE_EPOCH=1640995200
docker build --build-arg SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH \
  --platform linux/x86_64 -t ccc-enclave:v1.0.0 .

# Generate identical EIF from source
nitro-cli build-enclave --docker-uri ccc-enclave:v1.0.0 \
  --output-file ccc-enclave-v1.0.0.eif
```

**Build Artifact Signatures:**
```json
{
  "version": "v1.0.0",
  "git_commit": "abc123...",
  "build_timestamp": "2025-01-15T10:30:00Z",
  "artifacts": {
    "enclave_eif": {
      "filename": "ccc-enclave-v1.0.0.eif",
      "sha256": "def456...",
      "pgp_signature": "-----BEGIN PGP SIGNATURE-----..."
    },
    "pcr_measurements": {
      "filename": "pcr-measurements-v1.0.0.json", 
      "sha256": "ghi789...",
      "pgp_signature": "-----BEGIN PGP SIGNATURE-----..."
    }
  },
  "verification_command": "make verify-build-v1.0.0"
}
```

### **3. PCR Measurement Publication**

**Published PCR Values:**
```json
{
  "version": "v1.0.0", 
  "measurements": {
    "PCR0": "a1b2c3d4e5f6789....",  
    "PCR1": "b2c3d4e5f6789a....",  
    "PCR2": "c3d4e5f6789ab2...."   
  },
  "kms_policy_template": {
    "conditions": {
      "kms:RecipientAttestation:ImageSha384": "a1b2c3d4e5f6789....",
      "kms:RecipientAttestation:PCR1": "b2c3d4e5f6789a....",
      "kms:RecipientAttestation:PCR2": "c3d4e5f6789ab2...."
    }
  }
}
```

**PCR Signature Chain:**
- PCR measurements signed with build key
- KMS policies reference exact PCR values
- Customer keys only decrypt for verified enclaves

---

## Customer Verification Workflow

### **1. Pre-Deployment Verification**

**Verify Build Integrity:**
```bash
# Download release artifacts
wget https://github.com/spencer/ccc/releases/v1.0.0/ccc-enclave-v1.0.0.eif
wget https://github.com/spencer/ccc/releases/v1.0.0/pcr-measurements-v1.0.0.json
wget https://github.com/spencer/ccc/releases/v1.0.0/build-manifest-v1.0.0.json

# Verify signatures
gpg --verify build-manifest-v1.0.0.json.sig build-manifest-v1.0.0.json
gpg --verify pcr-measurements-v1.0.0.json.sig pcr-measurements-v1.0.0.json

# Verify EIF matches expected PCRs
nitro-cli describe-eif --eif-path ccc-enclave-v1.0.0.eif | \
  jq '.Measurements' > actual-pcrs.json

diff <(jq '.measurements' pcr-measurements-v1.0.0.json) actual-pcrs.json
```

**Reproducible Build Verification:**
```bash
# Reproduce build from source (optional)
git clone https://github.com/spencer/ccc.git
cd ccc && git checkout v1.0.0
make verify-reproducible-build  # Produces identical EIF
```

### **2. KMS Policy Configuration**

**Attestation-Gated Key Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EnclaveDecryptionOnly",
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::ACCOUNT:role/EnclaveRole"},
      "Action": "kms:Decrypt",
      "Resource": "*",
      "Condition": {
        "StringEqualsIgnoreCase": {
          "kms:RecipientAttestation:ImageSha384": "PUBLISHED_PCR0_VALUE",
          "kms:RecipientAttestation:PCR1": "PUBLISHED_PCR1_VALUE", 
          "kms:RecipientAttestation:PCR2": "PUBLISHED_PCR2_VALUE"
        }
      }
    }
  ]
}
```

**Policy Deployment:**
```bash
# Configure KMS key with published PCR values
export PCR0=$(jq -r '.measurements.PCR0' pcr-measurements-v1.0.0.json)
export PCR1=$(jq -r '.measurements.PCR1' pcr-measurements-v1.0.0.json)  
export PCR2=$(jq -r '.measurements.PCR2' pcr-measurements-v1.0.0.json)

# Generate policy from template
envsubst < kms-policy-template.json > kms-policy.json

# Apply to KMS key
aws kms put-key-policy --key-id $KMS_KEY_ID --policy file://kms-policy.json
```

### **3. Runtime Verification**

**Enclave Deployment Verification:**
```bash
# Deploy enclave with verified EIF
nitro-cli run-enclave --eif-path ccc-enclave-v1.0.0.eif \
  --memory 1024 --cpu-count 2

# Verify running enclave matches expected measurements
nitro-cli describe-enclaves | jq '.[] | .Measurements'

# Test KMS integration with attestation
curl -X POST https://your-deployment.com/api/health \
  -H "Content-Type: application/json" \
  -d '{"test_kms": true}'
```

**Continuous Verification:**
```bash
# Periodic attestation verification
*/15 * * * * /usr/local/bin/verify-enclave-attestation.sh
```

---

## Operator Verification Workflow

### **1. Deployment Pipeline Verification**

**CI/CD Verification Points:**
```yaml
# .github/workflows/verify-and-deploy.yml
name: Verify and Deploy

on:
  push:
    tags: ['v*']

jobs:
  verify-build:
    runs-on: ubuntu-latest
    steps:
    - name: Verify Git Signatures
      run: git verify-commit HEAD
      
    - name: Verify Reproducible Build
      run: make verify-reproducible-build
      
    - name: Sign Artifacts
      run: make sign-release-artifacts
      
    - name: Publish Verification Data
      run: make publish-verification-data
```

**Deployment Verification:**
```bash
# Pre-deployment checks
make verify-eif-signatures
make verify-pcr-consistency  
make verify-kms-policies

# Post-deployment verification
make verify-enclave-attestation
make verify-kms-integration
make run-integrity-tests
```

### **2. Infrastructure Verification**

**Terraform State Verification:**
```bash
# Verify infrastructure matches expected state
terraform plan -detailed-exitcode  # Exit code 2 = changes detected

# Verify enclave instance configuration
terraform show | jq '.values.root_module.resources[] | 
  select(.type == "aws_instance" and .values.enclave_options != null)'
```

**Runtime Infrastructure Checks:**
```bash
# Verify enclave-capable instances
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" | \
  jq '.Reservations[].Instances[] | select(.EnclaveOptions.Enabled == true)'

# Verify KMS key policies
aws kms get-key-policy --key-id $KMS_KEY_ID --policy-name default | \
  jq '.Policy | fromjson'
```

---

## Auditor Verification Workflow

### **1. Independent Build Verification**

**Source Code Audit:**
```bash
# Clone and verify source
git clone https://github.com/spencer/ccc.git
cd ccc && git checkout v1.0.0

# Verify all commits are signed
git log --show-signature --oneline

# Review security-critical code
find . -name "*.py" -o -name "*.rs" -o -name "*.js" | \
  xargs grep -l "encrypt\|decrypt\|key\|attestation"
```

**Independent Build:**
```bash
# Reproduce build in clean environment
docker run --rm -v $(pwd):/src -w /src amazonlinux:2023 \
  bash -c "make clean && make build-eif"

# Verify identical EIF produced
shasum -a 256 ccc-enclave-v1.0.0.eif
```

### **2. Security Audit**

**Code Review Checklist:**
- [ ] No hardcoded keys or secrets
- [ ] Proper input validation and sanitization
- [ ] Secure key management practices
- [ ] Attestation verification logic
- [ ] Error handling doesn't leak data

**Cryptographic Review:**
- [ ] Encryption algorithms and parameters
- [ ] Key derivation and management
- [ ] Attestation document validation
- [ ] PCR measurement calculation

**Infrastructure Review:**
- [ ] KMS key policies and permissions
- [ ] Enclave configuration and isolation
- [ ] Network access controls
- [ ] Logging and monitoring setup

---

## Verification Automation

### **1. Automated Verification Tools**

**Build Verification Script:**
```bash
#!/bin/bash
# verify-release.sh
set -e

VERSION=$1
echo "Verifying release $VERSION..."

# Download artifacts
wget -q https://github.com/spencer/ccc/releases/$VERSION/ccc-enclave-$VERSION.eif
wget -q https://github.com/spencer/ccc/releases/$VERSION/pcr-measurements-$VERSION.json
wget -q https://github.com/spencer/ccc/releases/$VERSION/build-manifest-$VERSION.json

# Verify signatures
gpg --quiet --verify build-manifest-$VERSION.json.sig || exit 1
gpg --quiet --verify pcr-measurements-$VERSION.json.sig || exit 1

# Verify EIF matches PCRs
nitro-cli describe-eif --eif-path ccc-enclave-$VERSION.eif | \
  jq '.Measurements.PCR0' > actual-pcr0

jq -r '.measurements.PCR0' pcr-measurements-$VERSION.json > expected-pcr0

if ! diff -q actual-pcr0 expected-pcr0; then
  echo "ERROR: PCR0 mismatch!"
  exit 1
fi

echo "✅ Release $VERSION verification passed"
```

**Continuous Monitoring:**
```bash
#!/bin/bash
# monitor-enclave-integrity.sh
# Run as cron job: */5 * * * *

EXPECTED_PCR0=$(cat /etc/ccc/expected-pcr0.txt)
ACTUAL_PCR0=$(nitro-cli describe-enclaves | jq -r '.[0].Measurements.PCR0')

if [ "$EXPECTED_PCR0" != "$ACTUAL_PCR0" ]; then
  echo "ALERT: Enclave PCR mismatch detected!"
  echo "Expected: $EXPECTED_PCR0"
  echo "Actual: $ACTUAL_PCR0"
  # Send alert to monitoring system
  exit 1
fi
```

### **2. Integration with Monitoring**

**Verification Metrics:**
```yaml
# Prometheus metrics
ccc_build_verification_status{version="v1.0.0"} 1
ccc_enclave_pcr_match{expected_pcr="abc123"} 1  
ccc_kms_policy_validation{key_id="key-123"} 1
ccc_attestation_verification_success_rate 0.999
```

**Alerting Rules:**
```yaml
groups:
- name: ccc-integrity
  rules:
  - alert: EnclaveIntegrityFailure
    expr: ccc_enclave_pcr_match == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Enclave PCR measurement mismatch"
```

---

## Security Considerations

### **1. Key Management**

**Build Signing Keys:**
- Hardware security module (HSM) for signing keys
- Multi-party key ceremonies for key generation
- Regular key rotation and revocation procedures

**Customer Key Protection:**
- KMS keys with attestation-based policies
- Principle of least privilege for key access
- Audit logging for all key operations

### **2. Supply Chain Security**

**Build Environment:**
- Reproducible build infrastructure
- Isolated build environments
- Comprehensive dependency verification

**Distribution Security:**
- Signed release artifacts
- Secure distribution channels  
- Integrity verification at download

---

## Getting Started

### **Quick Verification**

```bash
# Verify latest release
curl -sSL https://raw.githubusercontent.com/spencer/ccc/main/scripts/verify-release.sh | \
  bash -s v1.0.0

# Configure KMS with verified PCRs
make configure-kms-policy VERSION=v1.0.0

# Deploy with verification
make deploy-verified VERSION=v1.0.0
```

### **Integration Example**

```python
# Python client with verification
from ccc_client import CCCClient, verify_enclave_integrity

client = CCCClient()

# Verify enclave before sending data
if verify_enclave_integrity(expected_version="v1.0.0"):
    result = client.process_image(image_data)
else:
    raise SecurityError("Enclave verification failed")
```

---

This verification framework ensures that **customers can cryptographically verify** that their data will only be processed by expected, unmodified enclave code, providing mathematical guarantees about system integrity.

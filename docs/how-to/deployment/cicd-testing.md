# CI/CD Strategy for Confidential Computing: CCC Project

**Author**: Spencer Janyk  
**Date**: January 2025  
**Purpose**: CI/CD strategy for testing and deploying Nitro Enclave applications

---

## Executive Summary

Testing and deploying confidential computing applications presents unique challenges since **you cannot run Nitro Enclaves in standard CI/CD environments** like GitHub Actions. This document outlines a tiered testing strategy that enables comprehensive validation without requiring enclave hardware for every test.

## Core Challenge

**Problem**: Nitro Enclaves require specific EC2 instance types with enclave support
- GitHub Actions runners don't support Nitro Enclaves
- Traditional CI/CD environments can't test enclave-specific functionality
- Real enclave testing is expensive and slow

**Solution**: **Mock-First Development** with selective real enclave validation

---

## CI/CD Testing Strategy

### Tier 1: Standard CI/CD (GitHub Actions)
**Environment**: GitHub Actions runners  
**Duration**: 5-10 minutes  
**Frequency**: Every commit  

```yaml
# .github/workflows/ci.yml
name: Standard CI
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Unit Tests
        run: |
          make test-unit
          make test-crypto-functions
          make test-api-endpoints
  
  integration-mock:
    runs-on: ubuntu-latest
    steps:
      - name: Integration Tests (Mock Enclave)
        run: |
          make test-integration-mock  # Uses Docker container as "mock enclave"
          make test-encryption-roundtrip
          make test-message-queue-flow
  
  security-static:
    runs-on: ubuntu-latest
    steps:
      - name: Static Security Analysis
        run: |
          make security-scan
          make dependency-audit
          make secret-detection
```

**Tests at This Level:**
- ✅ Unit tests for all components
- ✅ Integration tests with mock enclave (Docker container)
- ✅ Encryption/decryption round-trip testing
- ✅ API endpoint validation
- ✅ Static security analysis
- ✅ Property-based confidentiality testing (using mock data)

### Tier 2: Cloud Integration Testing (AWS CodeBuild)
**Environment**: AWS CodeBuild with enclave-capable EC2  
**Duration**: 15-30 minutes  
**Frequency**: Nightly builds, pre-release  

```yaml
# buildspec.yml for AWS CodeBuild
version: 0.2
phases:
  pre_build:
    commands:
      - echo Checking enclave support
      - lscpu | grep -i enclave || echo "No enclave support detected"
  
  build:
    commands:
      - echo Build started on `date`
      - make build-eif  # Build Enclave Image File
      - make test-enclave-basic  # Basic enclave functionality
      
  post_build:
    commands:
      - make test-attestation  # Test real attestation flow
      - make test-kms-integration  # Test KMS with attestation
```

**Tests at This Level:**
- ✅ Real Nitro Enclave startup and shutdown
- ✅ Attestation document generation and verification
- ✅ KMS integration with attestation-gated keys
- ✅ VSOCK communication testing
- ✅ Enclave resource limits and error handling

### Tier 3: Production-Like Validation (Manual/Scheduled)
**Environment**: Production AWS account  
**Duration**: 45-60 minutes  
**Frequency**: Weekly, before releases  

```bash
# Manual validation script
make test-production-like
```

**Tests at This Level:**
- ✅ End-to-end workflow with real users
- ✅ Performance testing under load
- ✅ Cross-region deployment validation
- ✅ Disaster recovery procedures
- ✅ Security penetration testing

---

## Mock Enclave Strategy

### Mock Enclave Implementation
```python
# tests/mock_enclave.py
class MockNitroEnclave:
    """Simulates Nitro Enclave behavior for testing"""
    
    def __init__(self):
        self.is_running = False
        self.memory_mb = 512
        self.attestation_enabled = True
    
    def start(self):
        """Simulate enclave startup"""
        if self.memory_mb < 64:
            raise EnclaveStartupError("Insufficient memory")
        self.is_running = True
        return MockAttestationDocument()
    
    def process_encrypted_data(self, encrypted_data):
        """Simulate encrypted data processing"""
        if not self.is_running:
            raise EnclaveNotRunningError()
        
        # Simulate decryption and ML inference
        decrypted = mock_decrypt(encrypted_data)
        result = mock_ml_inference(decrypted)
        return mock_encrypt(result)
    
    def generate_attestation_document(self):
        """Generate mock attestation for testing"""
        return {
            "module_id": "mock-module-123",
            "pcrs": {"0": "mock-pcr-0", "1": "mock-pcr-1"},
            "timestamp": datetime.utcnow().isoformat(),
            "public_key": "mock-public-key"
        }
```

### Docker-Based Mock Environment
```dockerfile
# Dockerfile.mock-enclave
FROM python:3.9-slim

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy mock enclave code
COPY src/mock_enclave/ /app/mock_enclave/
COPY src/ml_service/ /app/ml_service/

# Simulate enclave isolation (limited networking, memory)
RUN adduser --disabled-password --gecos '' enclaveuser
USER enclaveuser

WORKDIR /app
CMD ["python", "-m", "mock_enclave.main"]
```

---

## Deployment Pipeline

### Development Deployment
```bash
# Local development deployment
terraform apply -var-file="environments/local.tfvars"
# Uses Docker Compose with mock enclaves
```

### Staging Deployment
```bash
# Staging environment with real enclaves
terraform apply -var-file="environments/staging.tfvars"
# Real AWS Nitro Enclaves, staging KMS keys
```

### Production Deployment
```bash
# Production deployment (manual approval required)
terraform plan -var-file="environments/production.tfvars"
# Manual review and approval
terraform apply -var-file="environments/production.tfvars"
```

---

## Testing Framework Organization

### Test Directory Structure
```
tests/
├── unit/                    # Standard unit tests
│   ├── test_crypto.py
│   ├── test_api.py
│   └── test_ml_service.py
├── integration/             # Integration tests
│   ├── mock_enclave/        # Tests using mock enclave
│   │   ├── test_workflow.py
│   │   └── test_encryption_flow.py
│   └── real_enclave/        # Tests requiring real enclave
│       ├── test_attestation.py
│       └── test_kms_integration.py
├── e2e/                     # End-to-end tests
│   ├── test_user_workflow.py
│   └── test_performance.py
└── security/                # Security-specific tests
    ├── test_confidentiality.py
    └── test_side_channels.py
```

### Test Execution Strategy
```bash
# Fast feedback loop (runs in GitHub Actions)
make test-fast                # Unit + integration with mocks (5 minutes)

# Comprehensive testing (runs in AWS CodeBuild)
make test-comprehensive       # Includes real enclave tests (30 minutes)

# Full validation (manual/scheduled)
make test-production-ready    # Complete end-to-end validation (60 minutes)
```

---

## Specific CI/CD Challenges & Solutions

### Challenge 1: Enclave Image File (EIF) Building
**Problem**: Building EIF files requires specific tools and setup
**Solution**: Use AWS CodeBuild with pre-configured enclave tools

```yaml
# AWS CodeBuild environment
image: aws/codebuild/amazonlinux2-x86_64-standard:3.0
environment:
  privileged-mode: true  # Required for Docker builds
  
install:
  runtime-versions:
    docker: 19
  commands:
    - curl -O https://github.com/aws/aws-nitro-enclaves-cli/releases/download/v1.2.2/aws-nitro-enclaves-cli-1.2.2.x86_64.rpm
    - sudo yum install -y ./aws-nitro-enclaves-cli-1.2.2.x86_64.rpm
```

### Challenge 2: Secret Management in CI/CD
**Problem**: Encryption keys and certificates needed for testing
**Solution**: Use AWS Secrets Manager with IAM roles

```yaml
# GitHub Actions secret management
env:
  AWS_ROLE_ARN: ${{ secrets.AWS_ROLE_ARN }}
  KMS_TEST_KEY_ID: ${{ secrets.KMS_TEST_KEY_ID }}

steps:
  - name: Configure AWS credentials
    uses: aws-actions/configure-aws-credentials@v1
    with:
      role-to-assume: ${{ env.AWS_ROLE_ARN }}
      aws-region: us-west-2
```

### Challenge 3: Testing Attestation Flows
**Problem**: Attestation requires real hardware and complex setup
**Solution**: Layered testing approach

```python
# Layered attestation testing
def test_attestation_parsing():
    """Unit test: Can we parse attestation documents?"""
    mock_doc = create_mock_attestation()
    result = parse_attestation_document(mock_doc)
    assert result.is_valid()

def test_attestation_verification():
    """Integration test: Can we verify mock attestations?"""
    mock_doc = create_realistic_mock_attestation()
    result = verify_attestation_with_mock_kms(mock_doc)
    assert result.verification_status == "valid"

def test_real_attestation():
    """Real enclave test: Generate and verify real attestation"""
    # Only runs in AWS CodeBuild with real enclaves
    if not has_enclave_support():
        pytest.skip("Requires real enclave support")
    
    enclave = start_test_enclave()
    doc = enclave.generate_attestation_document()
    result = verify_attestation_with_real_kms(doc)
    assert result.verification_status == "valid"
```

---

## Performance Testing Strategy

### Automated Performance Benchmarks
```bash
# Performance testing integrated into CI/CD
make perf-benchmark-encryption   # Measure encryption performance
make perf-benchmark-ml           # Measure ML inference speed
make perf-benchmark-e2e          # End-to-end latency testing
```

### Performance Regression Detection
```python
# Performance regression testing
def test_encryption_performance():
    """Ensure encryption performance doesn't regress"""
    start_time = time.time()
    encrypt_large_image(10_000_000)  # 10MB image
    duration = time.time() - start_time
    
    # Fail if encryption takes longer than baseline + 20%
    assert duration < BASELINE_ENCRYPTION_TIME * 1.2
```

---

## Security Testing Integration

### Automated Security Scanning
```bash
# Security testing in CI/CD pipeline
make security-scan-dependencies  # Check for vulnerable dependencies
make security-scan-secrets       # Detect hardcoded secrets
make security-scan-containers    # Container security scanning
make security-test-confidentiality  # Property-based confidentiality tests
```

### Penetration Testing Schedule
- **Weekly**: Automated security scans
- **Monthly**: Manual penetration testing
- **Quarterly**: Third-party security audit

---

## Monitoring & Observability

### CI/CD Pipeline Monitoring
```bash
# Pipeline health monitoring
make monitor-test-coverage       # Ensure >80% code coverage
make monitor-test-duration       # Alert if tests take too long
make monitor-deployment-success  # Track deployment success rates
```

### Enclave-Specific Monitoring
```python
# Enclave health monitoring in production
def monitor_enclave_health():
    """Monitor enclave health metrics"""
    metrics = {
        "enclave_startup_time": measure_startup_time(),
        "attestation_success_rate": get_attestation_success_rate(),
        "memory_usage": get_enclave_memory_usage(),
        "processing_latency": get_processing_latency()
    }
    send_metrics_to_cloudwatch(metrics)
```

---

## Summary: Tiered Testing Approach

| Test Level | Environment | Duration | Frequency | Coverage |
|------------|-------------|----------|-----------|----------|
| **Tier 1** | GitHub Actions | 5-10 min | Every commit | Unit + Mock Integration |
| **Tier 2** | AWS CodeBuild | 15-30 min | Nightly | Real Enclave + AWS Services |
| **Tier 3** | Production-like | 45-60 min | Weekly | End-to-End + Performance |

**Key Insight**: **Mock-first development** enables rapid iteration while **selective real enclave testing** ensures production readiness. This approach balances development velocity with confidence in enclave-specific functionality.

**Critical Success Factor**: The mock enclave must be **behaviorally equivalent** to real enclaves for all testable scenarios, while clearly identifying the boundaries where real enclave testing is required.

# Technical Design Document: Confidential Cat Counter Project

> Document status: End‑State High‑Level Design (HLD)
>
> Current implementation phase: see Phase 1 (Local‑only) Technical Design – docs/reference/specifications/phase1-local-design.md

## 1. Executive Summary

The **Confidential Cat Counter Project (CCC Project)** is a reference architecture demonstrating privacy-preserving machine learning inference using Trusted Execution Environments. This project teaches confidential computing patterns through a practical, runnable implementation.

**Target Audience:**
- Security Engineers learning confidential computing patterns
- ML Engineers exploring privacy-preserving inference
- Solution Architects designing TEE-based systems

**Key Design Principles:**
- **Educational First**: Clear patterns that teach core concepts
- **Incremental Learning**: Each phase introduces new confidential computing capabilities
- **Production Patterns**: Enterprise-ready architectural patterns
- **Community Accessible**: Simple setup with Terraform Infrastructure as Code

**Note**: For detailed architectural analysis and decision trade-offs, see `docs/archive/` - this document focuses on implementation guidance.

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │───▶│  Message Queue  │───▶│   ML Service    │───▶│   Key Service   │
│   (Browser)     │    │   (Redis/SQS)   │    │   (TEE/Enclave) │    │   (KMS/Local)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │                        │
        ▼                        ▼                        ▼                        ▼
   Upload encrypted      Queue processing         Secure inference        Key management
   images + metadata     requests/responses       within TEE boundary     & attestation
```

### 2.2 Component Breakdown

#### **Web Client Container**
- **Technology**: Node.js + Express + vanilla JavaScript
- **Encryption**: AWS Encryption SDK for JavaScript (battle-tested, enterprise-grade)
- **Responsibilities**: File upload UI, client-side encryption, result polling, **TOU enforcement**
- **Communication**: HTTP REST API + WebSocket (if supported) to Message Queue
- **Security**: Pre-encryption validation, rate limiting, pattern detection
- **Key Management**: Demonstrates local → KMS → attestation-gated progression

#### **Message Queue Service**
- **Technology Options**: 
  - **Local**: Redis (development)
  - **Cloud**: AWS SQS + SNS (production)
- **Responsibilities**: Decouple upload from processing, handle async communication, **audit logging**
- **Pattern**: Follow [Google's Confidential Match](https://github.com/google-ads-confidential-computing/conf-data-processing-architecture-reference-sample) message-driven architecture

#### **2.2.1 Queue Semantics & Idempotency**
```yaml
Message Deduplication:
  - Job ID as deduplication key
  - Redis: SET with NX flag for atomic job claims
  - SQS: ContentBasedDeduplication enabled

Visibility Timeout:
  - Development (Redis): 300 seconds
  - Production (SQS): 600 seconds (10 minutes)
  - Rule: Set to 2x expected processing time to prevent duplicate processing

Retry Behavior:
  - Max retries: 3 attempts
  - Exponential backoff: 2^attempt seconds
  - Failed jobs logged for analysis (no payload data)
```

#### **ML Processing Service (TEE)**
- **Technology**: Python + ONNX Runtime + FastAPI
- **Performance Option**: gRPC for high-throughput deployments (Phase 7+)
- **Responsibilities**: Image processing, cat detection, secure computation
- **Security**: Runs within TEE boundary (local mock → AWS Nitro → Intel TDX)
- **TOU Enforcement**: Metadata-based monitoring, resource limits, usage pattern detection

#### **Key Management Service**
- **Technology**: AWS Encryption SDK + KMS (or local keys)
- **Responsibilities**: Key derivation, attestation verification, encryption/decryption
- **Multi-cloud**: Terraform-managed deployment across AWS KMS, Azure Key Vault

#### **Infrastructure Layer** ⭐ **NEW**
- **Technology**: Terraform with multi-cloud modules
- **Responsibilities**: Infrastructure as Code, consistent deployments, cost optimization
- **Deployment Options**: Local Docker, AWS Nitro Enclaves, Azure Confidential VMs
- **Cost Management**: Auto-scaling, spot instances, cold start optimization

#### **Observability Layer** ⭐ **NEW**  
- **Technology**: Structured logging + Prometheus metrics (simple, effective)
- **Responsibilities**: Monitoring without compromising confidentiality
- **Capabilities**: Performance metrics, attestation health, encrypted audit trails
- **Innovation**: Confidentiality-preserving observability patterns for enterprise reference

#### **2.2.2 Safe Logging Schema**
```yaml
# ALLOWED - Safe for logs
metadata:
  job_id: uuid
  status: enum[queued, processing, completed, failed]
  timestamp: iso8601
  processing_time: float
  model_version: string
  error_type: enum[timeout, invalid_format, ml_error]

# BANNED - Never logged
sensitive_data:
  image_bytes: NEVER
  file_contents: NEVER
  encryption_keys: NEVER
  user_payloads: NEVER
  base64_data: NEVER (if >100 chars)

# Audit trail without exposure
audit_safe:
  image_size_bytes: integer
  mime_type: string
  cats_detected: integer
  confidence_score: float
```

#### **TOU Enforcement Layer** ⭐ **NEW**
- **Technology**: JavaScript (client) + Python (server)
- **Responsibilities**: Policy enforcement while preserving confidentiality
- **Approach**: Metadata-based validation, pattern detection, audit logging
- **Educational Value**: Demonstrates confidential computing vs. monitoring tension

## 3. Result Retrieval Architecture

### 3.1 Options Analysis

#### **Option A: Message Queue + Polling (RECOMMENDED)**
```
Upload → Queue → Process → Result Queue → Poll for Results
```
- **Pros**: Simple, reliable, follows Google's pattern, enclave-friendly
- **Cons**: Higher latency than WebSocket
- **Implementation**: Redis pub/sub locally, SQS/SNS in AWS

#### **Option B: WebSocket Real-time**
```
Upload → Queue → Process → WebSocket Push → Real-time Update
```
- **Pros**: Real-time updates, better UX
- **Cons**: Complex with enclaves, connection management overhead
- **Status**: **DEFERRED** - WebSocket support in Nitro Enclaves is limited

#### **Option C: Synchronous Processing**
```
Upload → Direct Process → Immediate Response
```
- **Pros**: Simplest implementation
- **Cons**: Poor UX for slow inference, no scalability
- **Status**: **REJECTED** - Not suitable for ML workloads

### 3.2 Selected Approach: Message Queue + Polling

Following the [Google Confidential Match pattern](https://github.com/google-ads-confidential-computing/confidential-match), we'll use:

1. **Upload Queue**: Encrypted image + metadata
2. **Processing**: ML service consumes from queue
3. **Result Queue**: Encrypted results with job ID
4. **Client Polling**: Check for results every 2-5 seconds

## 4. Model Selection & Integration

### 4.1 Requirements
- **Functionality**: Count cats in images (simple object detection)
- **Performance**: < 10 seconds per image on CPU
- **Size**: < 100MB model file
- **Format**: ONNX for cross-platform compatibility

### 4.2 Model Options

#### **Option A: YOLOv5s with COCO Classes (RECOMMENDED)**
- **Model**: `yolov5s.onnx` (~14MB)
- **Classes**: Includes 'cat' class from COCO dataset
- **Performance**: ~2-3 seconds on CPU
- **Accuracy**: >85% cat detection on common images

#### **Option B: MobileNet-SSD**
- **Model**: `mobilenet_ssd.onnx` (~10MB)
- **Performance**: ~1-2 seconds on CPU
- **Accuracy**: ~80% cat detection

#### **Option C: Custom Trained Model**
- **Status**: **REJECTED** - Overengineering for proof of concept

### 4.3 Selected Model: YOLOv5s
Best balance of accuracy, speed, and simplicity for demonstration purposes.

## 5. Container Orchestration Strategy

### 5.1 Requirements
- **Cost**: Minimize infrastructure costs
- **Simplicity**: Easy local development
- **Scalability**: Support single-user workload

### 5.2 Options Analysis

#### **Option A: Docker Compose (RECOMMENDED)**
- **Local**: `docker-compose up` for development
- **Cloud**: Single EC2 instance with Docker Compose
- **Pros**: Simplest deployment, lowest cost (~$10-20/month)
- **Cons**: No auto-scaling, single point of failure

#### **Option B: AWS ECS Fargate**
- **Pros**: Managed container service, better scalability
- **Cons**: Higher cost (~$30-50/month), more complexity
- **Status**: **DEFERRED** - Can migrate later if needed

#### **Option C: Kubernetes (EKS)**
- **Status**: **REJECTED** - Massive overkill for single-user demo

### 5.3 Selected Approach: Docker Compose
- **Development**: Local Docker Compose
- **Production**: Single EC2 t3.medium with Docker Compose
- **Migration Path**: Can move to ECS when scaling needed

## 6. Development Phases

This HLD describes the end‑state system. Implementation proceeds in phases. Each phase has its own technical design that captures the current state and near‑term decisions.

Phase designs:
- Phase 1 (Local‑only) – docs/reference/specifications/phase1-local-design.md
- Rego Policy Design (inside‑out policy hooks) – docs/reference/specifications/policy-governed-inference-rego.md

### Development Environment Tiers

**Critical for developer adoption**: Fast iteration cycles for confidential computing development.

```yaml
environments:
  local:
    description: "Fast iteration with mocked confidential computing"
    deployment_time: "30 seconds"
    tee: "docker-container-mock"
    crypto: "local-test-keys"
    attestation: "mock-always-valid"
    command: "terraform apply -var-file='environments/local.tfvars'"
    
  integration:
    description: "Real crypto, simulated TEE environment"
    deployment_time: "2-3 minutes"
    tee: "docker-enclave-simulator"
    crypto: "aws-kms-dev-keys"
    attestation: "simulated-nitro-quote"
    command: "terraform apply -var-file='environments/integration.tfvars'"
    
  staging:
    description: "Real Nitro Enclave, staging data"
    deployment_time: "8-10 minutes"
    tee: "aws-nitro-enclave"
    crypto: "aws-kms-staging"
    attestation: "real-nitro-attestation"
    command: "terraform apply -var-file='environments/staging.tfvars'"
```

### Phase 1: Local Docker Foundation (Week 1)
**Goal**: Basic ML inference pipeline with fast development cycle

**📋 [Detailed Implementation Plan](PHASE1_IMPLEMENTATION.md)**

**Deliverables**:
- **Docker Compose infrastructure** for 30-second iteration cycle  
- **Fast development commands**: `make dev-setup`, `make local-demo`, `make test-confidentiality`
```bash
# 30-second iteration cycle
make dev-setup
curl -F "image=@cat.jpg" http://localhost:3000/upload
# Returns: {"jobId": "abc123", "status": "queued"}

curl http://localhost:3000/results/abc123
# Returns: {"status": "completed", "cats": 2, "confidence": 0.95}
```

**Components**:
- Web service (Node.js + Express) with browser UI
- Redis message queue for async processing
- ML service (Python + FastAPI + YOLOv5s ONNX)
- Local file storage with volume mounts

**Testing**:
- Unit tests for each service
- Integration test: full upload → process → result flow
- **Property-based confidentiality testing**: Automated verification that no plaintext data leaks
- Performance validation (<15s end-to-end)
- Sample cat images for validation

**Confidentiality Testing Framework**:
```python
from hypothesis import given, strategies as st

@given(sensitive_image_data=st.binary(min_size=1024, max_size=10*1024*1024))
def test_no_plaintext_leakage(sensitive_image_data):
    # Process data through entire system
    logs = capture_all_system_logs()
    memory_dumps = capture_processing_memory()
    network_traffic = capture_network_requests()
    
    # Core property: Sensitive data never appears in observable outputs
    assert sensitive_image_data not in logs
    assert not contains_image_patterns(memory_dumps, sensitive_image_data)
    assert not contains_plaintext_data(network_traffic, sensitive_image_data)

@given(user_data=st.text(min_size=10))
def test_encryption_properties(user_data):
    encrypted = encrypt_data(user_data)
    
    # Properties of proper encryption
    assert user_data not in encrypted
    assert len(encrypted) > len(user_data)  # Ciphertext expansion
    assert decrypt_data(encrypted) == user_data  # Roundtrip works
```

### Phase 2: Client-Side Encryption + TOU Enforcement (Week 2)
**Goal**: Add AWS Encryption SDK with local keys + Terms of Use enforcement

**Deliverables**:
- **Browser-based encryption using AWS Encryption SDK** (enterprise-grade, battle-tested)
- **Terraform-managed local key generation** and state management
- Encrypted image upload and result decryption
- **Metadata-based TOU enforcement layer**
- **Confidentiality-preserving observability** with structured logging + metrics
- **Property-based confidentiality testing** framework

**Security Model**:
- Client generates RSA keypair in browser (or WebCrypto API)
- Images encrypted with AES-256, key encrypted with RSA public key
- ML service decrypts with local private key (mock attestation)

**TOU Enforcement Features**:
- File size, format, and dimension validation (pre-encryption)
- Rate limiting and usage pattern detection
- Audit logging for policy violations with differential privacy
- Educational demonstration of confidential computing vs. monitoring tension

**Infrastructure Updates**:
- **Terraform modules for fast local development** (30-second deployment)
- **Development environment tiers**: local → integration → staging progression
- **Automated confidentiality testing**: Property-based tests verify no data leakage
- **Key management evolution path**: Local keys → KMS → attestation-gated progression

**Testing Innovation**:
This phase introduces **property-based confidentiality testing** - a novel approach to automatically verify that confidential computing systems don't leak sensitive data. This testing framework becomes a reusable pattern for any confidential ML system.

**Reference Architecture Value**:
This phase demonstrates how to implement appropriate safeguards in confidential computing systems while preserving data confidentiality - a critical pattern for enterprise adoption.

### Phase 3: Cloud Storage Integration (Week 3)
**Goal**: Replace local storage with S3

**Deliverables**:
- S3 bucket for encrypted images and results
- Presigned URLs for secure upload/download
- IAM roles and policies

### Phase 4: AWS Deployment (Week 4)
**Goal**: Deploy to EC2 with Terraform-managed infrastructure

**Deliverables**:
- **Terraform-managed AWS deployment** with EC2, VPC, and security groups
- AWS SQS/SNS for message queuing with cost optimization
- **OpenTelemetry monitoring** with CloudWatch integration
- **Infrastructure as Code** patterns for reproducible deployments
- **Cost optimization** with auto-scaling and spot instance support

**Infrastructure Patterns**:
```bash
# Single command deployment
terraform apply -var-file="environments/aws-dev.tfvars"

# Cost-optimized development
terraform apply -var="instance_type=t3.medium" -var="use_spot_instances=true"
```

### Phase 5: KMS Integration (Week 5)
**Goal**: Replace local keys with AWS KMS

**Deliverables**:
- KMS Customer Managed Key (CMK)
- Key policy with basic access controls
- Encryption context for tenant isolation

### Phase 6: Nitro Enclave Integration (Week 6)
**Goal**: Move ML processing to Nitro Enclave with multi-cloud preparation

**Deliverables**:
- **Enclave Image File (EIF)** with ML service via Terraform
- **Attestation document verification** with formal verification patterns
- **KMS key policy gated by attestation** across cloud providers
- **VSOCK communication** between parent and enclave
- **Azure Confidential Computing** deployment preparation
- **Next-generation TEE support**: Intel TDX readiness assessment

**Multi-Cloud Architecture**:
```hcl
# Terraform supports multiple confidential computing platforms
module "confidential_ml" {
  source = "./modules/confidential-computing"
  
  platform = var.target_platform  # "nitro" | "azure-cv" | "intel-tdx"
  attestation_required = true
}
```

### Phase 7: Production Hardening (Week 7)
**Goal**: Security, monitoring, and operational readiness

**Deliverables**:
- Security audit and penetration testing
- Performance optimization based on real metrics
- Failure mode analysis and incident response procedures
- Operational runbooks and monitoring dashboards

*Note: Detailed specifications for production monitoring, incident response, and performance tuning will be developed during implementation as separate operational guides.*

### Phase 8: Advanced Features (Optional)
**Goal**: Stretch goals and enhancements

**Deliverables**:
- Browser demo with advanced UI
- Formal verification specifications
- SDK for integration
- CI/CD pipeline

## 7. Testing & Performance Strategy

### 7.1 Testing Framework
- **Unit Testing**: >80% code coverage, component isolation
- **Integration Testing**: Message flows, encryption round-trips, error handling
- **Property-Based Confidentiality Testing**: Automated verification of no plaintext leakage
- **End-to-End Testing**: Complete workflow validation, performance benchmarks

### 7.2 Performance Requirements
```yaml
Latency Targets:
  file_encryption: "< 5s for 10MB image (P95)"
  ml_inference: "< 8s per image (P95)" 
  end_to_end: "< 15s total (P95)"

Throughput Targets:
  phase_1: "1 concurrent user"
  phase_4: "10 concurrent users"
  phase_6: "50 concurrent users"
```

### 7.3 Testing Infrastructure
```bash
# Local development
make test-unit                 # Component tests
make test-integration-mock     # Mock enclave testing
make perf-benchmark           # Performance baselines

# Cloud validation  
make test-aws-integration     # Real AWS services
make test-enclave            # Nitro Enclave validation
```

*For implementation patterns and strategies, see `docs/NITRO_ENCLAVES_PATTERNS.md`, `docs/ENCRYPTION_SDK_PATTERNS.md`, `docs/DOCKER_ATTESTATION_PATTERNS.md`, and `docs/CICD_STRATEGY.md`.*

## 8. Security Architecture & Risk Analysis

### 8.1 Threat Model
- **Adversary**: Malicious operator with root access to infrastructure
- **Assets**: User images, ML inference results, user identity
- **Goals**: Data confidentiality, integrity, and privacy
- **New Threat**: Policy violations and abuse within confidential system

### 8.2 Security Controls
- **Client-side Encryption**: Images encrypted before leaving browser
- **TEE Processing**: ML inference within trusted execution environment
- **Attestation**: Verify enclave integrity before key release
- **Minimal TCB**: Reduce trusted computing base size
- **TOU Enforcement**: Policy compliance without compromising confidentiality

### 8.3 Attested Policy Manifest and Egress Guard

**Pre-boot rule, post-boot model guarantee**: Users verify policy before trusting system, operator cannot change rules after deployment.

**Policy Manifest** (baked into measured image):
```json
{
  "version": "1.0",
  "allowed_outputs": ["application/json"],
  "max_response_size": 2048,
  "forbidden_patterns": ["image/", "data:", "/9j/", "iVBOR"],
  "rate_limits": {"per_minute": 10, "per_hour": 100},
  "allowed_onnx_ops": ["Conv", "Relu", "MatMul", "Softmax"]
}
```

**Egress Guard Architecture**:
- **Separate process/enclave**: Minimal TCB in memory-safe language
- **Fixed output schema**: JSON with counts/confidence only
- **Content filtering**: Block image magic bytes, base64-like blobs
- **Size enforcement**: <2KB per response, prevent bulk exfiltration
- **No bypass paths**: ML runtime cannot communicate externally

**KMS Integration**: 
```json
{
  "kms_policy_condition": {
    "kms:RecipientAttestation:ImageSha384": "${ENCLAVE_IMAGE_SHA384}",
    "kms:RecipientAttestation:PolicyHash": "${POLICY_MANIFEST_HASH}"
  }
}
```

**Model as Data Constraints**:
- ONNX weights loaded with allowlist of operations
- No custom ops, dynamic code, or plugin loading
- Disable dlopen/runtime code generation
- Model cannot add I/O or bypass egress guard

**Client Verification Flow**:
1. Client checks attestation including policy manifest hash
2. Client encrypts model to enclave's public key  
3. Operator cannot alter policy without changing measurement
4. Key release only occurs for verified policy + enclave combination

### 8.4 Key Management
- **Development**: Local RSA keys for rapid iteration
- **Production**: AWS KMS with attestation-based key policies
- **Rotation**: Automated key rotation every 90 days

#### **8.4.1 Encryption Schema**
```yaml
Algorithm: AES-256-GCM (via AWS Encryption SDK)
Envelope: AWS Encryption SDK standard format
Key Derivation: Customer Managed Key (CMK) in KMS
Encryption Context:
  purpose: "ml-inference"
  model_version: "yolov5s-v1.0"
  content_type: "image/jpeg"
  tenant: "demo"
Format: Base64-encoded ciphertext with embedded metadata
```

#### **8.4.2 KMS Policy for Nitro Enclaves**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::ACCOUNT:role/NitroEnclaveRole"},
      "Action": "kms:Decrypt",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:EncryptionContext:purpose": "ml-inference",
          "kms:RecipientAttestation:ImageSha384": "${ENCLAVE_IMAGE_SHA384}",
          "kms:RecipientAttestation:PCR0": "${PCR0_MEASUREMENT}",
          "kms:RecipientAttestation:PCR1": "${PCR1_MEASUREMENT}",
          "kms:RecipientAttestation:PCR2": "${PCR2_MEASUREMENT}"
        }
      }
    }
  ]
}
```

*Note: PCR measurements are published in `releases/` directory with each enclave build. See [BUILD_VERIFICATION.md](BUILD_VERIFICATION.md) for reproducible build process.*

### 8.4 Technical Risk Assessment

#### **High-Risk Areas**

**Nitro Enclave Development Complexity (HIGH)**
- **Risk**: Team inexperience with enclave development, debugging challenges
- **Impact**: Delayed development, potential security vulnerabilities
- **Mitigation**: Mock-first development approach, extensive documentation, external expertise

**Attestation Integration Complexity (HIGH)**
- **Risk**: KMS policy misconfiguration, attestation verification failures
- **Impact**: System unable to decrypt data, complete functionality breakdown
- **Mitigation**: Comprehensive testing strategy, attestation simulation, expert review

**Browser Encryption Performance (MEDIUM)**
- **Risk**: Poor performance on mobile devices, browser compatibility issues
- **Impact**: Poor user experience, limited device support
- **Mitigation**: Performance benchmarking, browser compatibility matrix, progressive enhancement

#### **Medium-Risk Areas**

**AWS Encryption SDK Integration (MEDIUM)**
- **Risk**: Bundle size impact, older browser support
- **Impact**: Slow page loads, reduced browser compatibility
- **Mitigation**: Bundle optimization, polyfill strategies, graceful degradation

**Message Queue Reliability (MEDIUM)**
- **Risk**: Lost messages, ordering issues, Redis memory limits
- **Impact**: Lost processing requests, inconsistent results
- **Mitigation**: Message persistence, idempotency patterns, monitoring

**Terraform Multi-Cloud Complexity (LOW)**
- **Risk**: Maintenance burden for multiple cloud providers
- **Impact**: Increased development complexity, testing overhead
- **Mitigation**: Start AWS-only, add Azure after AWS is proven stable

### 8.5 Terms of Use Enforcement Architecture

**Core Innovation**: Demonstrates how to enforce policies without compromising confidentiality through metadata-based monitoring.

**Key Pattern**: Three-layer enforcement approach:
1. **Client-side validation**: File size, format, rate limiting (pre-encryption)
2. **Metadata monitoring**: Upload patterns, resource usage (server-side)
3. **Pattern detection**: Automated behavior, abuse indicators (analytics)

**Implementation**: Policy DSL with formal verification ensures private enforcement logic stays within public policy bounds.

**Educational Value**: Shows novel solution to "confidentiality vs. monitoring dilemma" - a fundamental challenge in confidential computing.

*For detailed implementation examples and formal verification approach, see `docs/archive/TOU_ENFORCEMENT_ANALYSIS.md` and `docs/archive/FORMAL_VERIFICATION_ANALYSIS.md`.*

## 9. Project Risk Summary

### 9.1 Critical Implementation Risks

**🚨 MISSING GAME**: **Attestation Integration Complexity**
- **Gap**: KMS attestation policies are complex, PCR management is error-prone
- **Impact**: Complete system failure if attestation doesn't work
- **Mitigation**: **Layered attestation development** with simulation → reproducible builds → published PCR measurements

**⚠️ HIGH RISK**: **Nitro Enclave Development Experience**
- **Gap**: None of us have built Nitro Enclaves before
- **Impact**: Could derail entire project if enclave integration fails
- **Mitigation**: Start with mock enclaves, use AWS workshop patterns, get expert consultation

**✅ MANAGEABLE**: **Browser Encryption Performance**
- **Gap**: AWS Encryption SDK performance in browsers not validated
- **Impact**: Implementers can optimize with WASM or alternative libraries
- **Mitigation**: Let implementers choose optimal crypto approach for their use case

*For proven implementation patterns, see `docs/NITRO_ENCLAVES_PATTERNS.md`, `docs/ENCRYPTION_SDK_PATTERNS.md`, and `docs/DOCKER_ATTESTATION_PATTERNS.md`. For historical risk analysis, see `docs/archive/IMPLEMENTATION_RISKS_ANALYSIS.md`.*

## 10. Expected Failure Modes

### 10.1 Enclave-Specific Failures

**Enclave Startup Failures**
- **Cause**: Insufficient memory allocation, attestation initialization errors
- **Symptoms**: Container starts but enclave fails to initialize
- **Recovery**: Automatic retry with increased memory allocation
- **Prevention**: Resource validation during deployment

**Attestation Document Generation Failures**
- **Cause**: PCR measurement inconsistencies, clock synchronization issues
- **Symptoms**: KMS key requests fail, unable to decrypt data
- **Recovery**: Enclave restart, attestation cache invalidation
- **Prevention**: Attestation health monitoring, time synchronization

**VSOCK Communication Failures**
- **Cause**: Network configuration, port conflicts, buffer overflows
- **Symptoms**: Parent-enclave communication timeout, data corruption
- **Recovery**: Connection reset, message replay
- **Prevention**: Connection health checks, message validation

### 10.2 Browser & Client Failures

**Encryption Performance Degradation**
- **Cause**: Large file uploads, insufficient browser memory
- **Symptoms**: Browser freezing, out-of-memory errors, slow encryption
- **Recovery**: File size limits, chunked processing
- **Prevention**: Progressive upload, memory monitoring

**Browser Compatibility Issues**
- **Cause**: Older browser versions, missing WebCrypto API support
- **Symptoms**: Encryption failures, JavaScript errors
- **Recovery**: Graceful degradation, fallback mechanisms
- **Prevention**: Browser compatibility matrix, feature detection

**Network Interruption During Upload**
- **Cause**: Mobile connectivity issues, network timeouts
- **Symptoms**: Partial uploads, corrupted encrypted data
- **Recovery**: Upload resumption, integrity verification
- **Prevention**: Checksum validation, retry mechanisms

### 10.3 Infrastructure Failures

**KMS Service Unavailability**
- **Cause**: AWS service outages, network partitions
- **Symptoms**: Unable to decrypt data, key requests timeout
- **Recovery**: Retry with exponential backoff, cached key fallback
- **Prevention**: Multi-region KMS setup, key caching strategy

**Message Queue Overflow**
- **Cause**: High request volume, slow processing, Redis memory limits
- **Symptoms**: Dropped messages, processing delays
- **Recovery**: Queue drainage, capacity scaling
- **Prevention**: Queue monitoring, auto-scaling policies

**S3 Storage Failures**
- **Cause**: Service outages, permission issues, storage quota limits
- **Symptoms**: Upload failures, retrieval errors
- **Recovery**: Retry with different regions, local storage fallback
- **Prevention**: Multi-region replication, quota monitoring

### 10.4 Security Failure Scenarios

**Side-Channel Information Leakage**
- **Cause**: Timing attacks, memory access patterns
- **Symptoms**: Statistical analysis reveals data patterns
- **Recovery**: Algorithm hardening, constant-time operations
- **Prevention**: Security audits, timing analysis

**Key Rotation During Active Processing**
- **Cause**: Scheduled key rotation, compromise response
- **Symptoms**: Unable to decrypt in-flight requests
- **Recovery**: Graceful key transition, dual-key support
- **Prevention**: Rotation scheduling, key versioning

**Attestation Bypass Attempts**
- **Cause**: Malicious enclave images, attestation spoofing
- **Symptoms**: Invalid attestation documents accepted
- **Recovery**: Attestation validation hardening, enclave restart
- **Prevention**: Strict PCR validation, image signing

## 11. Operational Considerations

### 11.1 Cost Optimization (Reference Architecture)
- **Development**: $0 (local Docker Compose)
- **Demo Deployment**: Single EC2 t3.medium (~$30/month)
- **Learning Labs**: Spin up for workshops, tear down after
- **Total Demo Cost**: $40-60/month when running, $0 when idle
- **Cost Model**: Optimized for learning and demonstration, not production scale

### 11.2 Monitoring & Alerting
- **Metrics**: Request latency, processing time, error rates
- **Logs**: Structured logging with CloudWatch
- **Alerts**: High error rate, service unavailability

### 11.3 Disaster Recovery
- **Data**: S3 cross-region replication
- **Infrastructure**: Terraform for infrastructure as code
- **Recovery Time**: < 1 hour for full service restoration

## 12. Key Technical Decisions

### 12.1 Core Technology Stack

**Infrastructure**: Terraform for multi-cloud deployments (local, AWS, Azure)  
**Client Encryption**: AWS Encryption SDK for JavaScript (enterprise-grade, battle-tested)  
**Backend Services**: Python (ML) + Rust (crypto) for optimal balance of accessibility and performance  
**Message Queue**: Redis (local) → AWS SQS (production) with abstract interface  
**API Pattern**: REST over gRPC (simpler for reference architecture)  
**UI Framework**: Vanilla JavaScript (focus on crypto patterns, not UI complexity)  

### 12.2 Architecture Scope

**Single-User Focus**: Avoids multi-tenancy complexity to emphasize core confidential computing patterns  
**Reference vs Production**: Educational mission prioritized over operational optimization  
**Current TEE Platforms**: AWS Nitro + Azure Confidential VMs (proven, accessible)  
**Development Approach**: Inside-out progression from Docker to production enclaves  

### 12.3 Key Innovations

**Automated Confidentiality Testing**: Property-based testing framework verifies no plaintext leakage  
**TOU Enforcement**: Metadata-based policy enforcement with formal verification  
**Fast Development Tiers**: 30-second local → 2-3 minute integration → 8-10 minute staging cycles  
**Infrastructure as Code**: Complete Terraform deployment patterns  

*For detailed analysis of alternatives considered and comprehensive trade-off discussions, see `docs/archive/` - particularly `RECALIBRATED_RECOMMENDATIONS.md` and `UNDER_DISCOUNTED_CONSIDERATIONS.md`.*

### 12.4 Technology Stack Summary

**Final Technology Decisions**:
```yaml
Frontend:
  - Vanilla JavaScript + Web Components
  - AWS Encryption SDK for JavaScript
  - Optional WebAssembly for performance (Phase 3+)
  - WebCrypto API integration for hardware acceleration
  - Simple CSS (no framework)

Backend:
  - Python + FastAPI (ML service)
  - Rust + AWS Encryption SDK (crypto service)  
  - Redis → SQS (message queue migration)
  - Optional gRPC for high-performance deployments (Phase 7+)

Infrastructure:
  - Terraform for all deployments (local, AWS, Azure)
  - Docker Compose → ECS/AKS (migration path via Terraform)
  - Single EC2 → Multi-AZ → Auto-scaling (scaling path)
  - Local keys → KMS/Key Vault → Nitro/Confidential VMs (security evolution)
  - Cost optimization: Spot instances, auto-scaling, cold start optimization

Observability:
  - OpenTelemetry with differential privacy
  - CloudWatch/Azure Monitor integration
  - Confidentiality-preserving metrics and tracing
  - Property-based confidentiality testing

TEE Platforms:
  - Phase 1-4: Docker mock + AWS Nitro Enclaves
  - Phase 5-6: Azure Confidential VMs + Intel TDX preparation
  - Phase 7+: AMD SEV-SNP, ARM CCA for edge deployment

ML Stack:
  - YOLOv5s ONNX model
  - CPU inference (Phase 1-5)  
  - Optional GPU (Phase 6+ if needed)
  - Model performance optimization and caching
```

### 12.5 Success Metrics (Reference Architecture)
- **Educational Value**: Clear documentation of confidential computing patterns with Terraform IaC
- **Reproducibility**: Anyone can run `terraform apply -var="deployment=local"` and see working system
- **Security Demonstration**: Provably zero plaintext data exposure to operators with formal verification
- **Architecture Quality**: Production-ready patterns suitable for enterprise adoption across clouds
- **Community Impact**: Becomes go-to reference for confidential ML architectures
- **TOU Innovation**: Demonstrates novel approaches to AI safety in confidential computing
- **Industry Relevance**: Solves real enterprise challenge of policy enforcement vs. privacy
- **Operational Excellence**: OpenTelemetry observability without compromising confidentiality
- **Cost Efficiency**: Demonstrates cost optimization patterns for expensive TEE infrastructure
- **Developer Experience**: Fast development cycle with comprehensive testing framework

---

## Appendix A: Reference Architectures

This design draws inspiration from:
- [Google's Confidential Match](https://github.com/google-ads-confidential-computing/conf-data-processing-architecture-reference-sample) - Message queue patterns
- AWS Nitro Enclaves documentation - TEE integration
- [Confidential Computing Consortium](https://confidentialcomputing.io/) - Security best practices
- OpenAI Moderation API patterns - Content policy enforcement
- Azure AI Content Safety - Enterprise TOU implementation
- Industry TOU enforcement patterns - Production system safeguards

## Appendix B: Alternative Architectures Considered

### B.1 Serverless Architecture (Lambda + Step Functions)
**Rejected**: Lambda cold starts problematic for ML workloads, limited enclave support

### B.2 Event-Driven Microservices
**Rejected**: Over-engineering for single-user demonstration

### B.3 GraphQL API
**Rejected**: REST API sufficient for current requirements, simpler to implement and test

### B.4 TOU Enforcement Alternatives Considered

#### **External Content Moderation APIs**
**Rejected**: Breaks confidentiality by sending data to third parties
- OpenAI Moderation API requires plaintext content
- Azure AI Content Safety needs unencrypted images
- Google Perspective API incompatible with TEE processing

#### **In-TEE Content Analysis**
**Deferred to Phase 7**: High complexity for reference architecture
- Would require additional ONNX models for content classification
- 2x processing overhead for dual model inference
- Overcomplicates educational focus

#### **Break-Glass with Full Content Access**
**Deferred to Phase 7**: Advanced enterprise feature
- Requires sophisticated access controls and audit systems
- May compromise confidentiality guarantees
- Better suited for production systems than reference architecture

#### **Zero Enforcement (Pure Confidentiality)**
**Rejected**: Unrealistic for production systems
- Ignores real-world abuse prevention requirements
- Reduces enterprise applicability of reference architecture
- Misses opportunity to demonstrate innovative solutions

**Selected Approach**: Metadata-based enforcement provides optimal balance of confidentiality preservation, implementation simplicity, and real-world applicability.

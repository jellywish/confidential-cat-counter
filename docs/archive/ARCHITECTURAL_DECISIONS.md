# Architectural Decisions: CCC Project

**Author**: Spencer Janyk  
**Date**: January 2025  
**Purpose**: Summary of key architectural decisions made during design phase

---

## Core Technology Decisions

### **✅ Infrastructure: Terraform**
- **Decision**: Use Terraform for all deployments (local, AWS, Azure)
- **Rationale**: Multi-cloud support, Infrastructure as Code, community accessibility
- **Alternative Considered**: AWS CDK (rejected: vendor lock-in, limits multi-cloud goals)

### **✅ Client Encryption: AWS Encryption SDK for JavaScript**
- **Decision**: Use AWS Encryption SDK for browser-based encryption
- **Rationale**: Battle-tested, enterprise-grade, demonstrates real key management patterns
- **Alternatives Considered**: WebCrypto API, WebAssembly (rejected: complexity without educational value)

### **✅ Backend Stack: Python + Rust Split**
- **Decision**: Python (ML service) + Rust (crypto service)
- **Rationale**: Balances accessibility (Python) with performance (Rust)
- **Alternative Considered**: All Rust (rejected: higher contributor barrier)

### **✅ Observability: Structured Logging + Simple Metrics**
- **Decision**: Use structured logging + Prometheus metrics
- **Rationale**: Simple, effective, demonstrates confidentiality-preserving monitoring
- **Alternative Considered**: OpenTelemetry (rejected: over-complex for reference architecture)

### **✅ API Design: REST over gRPC**
- **Decision**: HTTP REST APIs for all communication
- **Rationale**: Simpler for reference architecture, broader accessibility
- **Alternative Considered**: gRPC (deferred to Phase 7+ for performance scenarios)

---

## Architecture Scope Decisions

### **✅ Single-User Focus**
- **Decision**: Design for single user, not multi-tenancy
- **Rationale**: Educational clarity, focuses on confidential computing patterns vs operational complexity
- **Alternative Considered**: Multi-tenant architecture (rejected: adds complexity without educational value)

### **✅ Reference Architecture vs Production Service**
- **Decision**: Build as reference architecture for learning and adaptation
- **Rationale**: Educational mission, enables broader community impact
- **Alternative Considered**: Production service (rejected: operational complexity distracts from core patterns)

### **✅ Current TEE Platforms**
- **Decision**: Focus on AWS Nitro Enclaves + Azure Confidential VMs
- **Rationale**: Proven, widely accessible, sufficient for demonstrating patterns
- **Alternatives Considered**: Intel TDX, AMD SEV-SNP (rejected: bleeding-edge, limited accessibility)

---

## Feature Inclusion Decisions

### **✅ INCLUDED: Automated Confidentiality Testing**
- **Decision**: Property-based testing framework to verify no plaintext leakage
- **Rationale**: Novel contribution, core to confidential computing guarantees
- **Implementation**: Hypothesis-based testing in Phase 1

### **✅ INCLUDED: Fast Development Tiers**
- **Decision**: local (30s) → integration (2-3min) → staging (8-10min) environments
- **Rationale**: Critical for developer adoption, solves "confidential computing is hard to develop" problem
- **Implementation**: Terraform environment configurations

### **✅ INCLUDED: TOU Enforcement with Formal Verification**
- **Decision**: Metadata-based policy enforcement with public spec + private implementation
- **Rationale**: Solves confidentiality vs monitoring dilemma, demonstrates innovation
- **Implementation**: Phase 2 policy DSL with verification bridge

### **❌ EXCLUDED: Auto-scaling Optimization**
- **Decision**: No auto-scaling patterns in reference architecture
- **Rationale**: Operational concern, not architectural pattern; distracts from core educational value
- **Alternative**: Document as production consideration

### **❌ EXCLUDED: Compliance Documentation**
- **Decision**: Focus on technical innovation vs regulatory compliance
- **Rationale**: Target technical audience (developers, security engineers) not compliance bureaucrats
- **Alternative**: Technical monitoring patterns that could support compliance if needed

### **❌ EXCLUDED: Multi-Tenancy Patterns**
- **Decision**: Single-user architecture only
- **Rationale**: Adds complexity without demonstrating core confidential computing concepts
- **Alternative**: Patterns are extensible to multi-tenant scenarios

---

## Development Process Decisions

### **✅ Inside-Out Development**
- **Decision**: Docker → Encryption → Cloud → KMS → Enclave progression
- **Rationale**: Each phase delivers testable functionality, incremental learning
- **Phases**: 6 phases from local containers to production Nitro Enclaves

### **✅ Property-Based Testing Strategy**
- **Decision**: Automated verification of confidentiality properties
- **Rationale**: Ensures reference architecture actually works as promised
- **Implementation**: Hypothesis testing framework with privacy guarantees

### **✅ Terraform-First Infrastructure**
- **Decision**: All environments managed through Terraform
- **Rationale**: Consistent deployment patterns, Infrastructure as Code education
- **Implementation**: Environment-specific tfvars files

---

## Archive References

For detailed analysis and trade-off discussions that informed these decisions:

- **`docs/archive/CDK_VS_TERRAFORM_ANALYSIS.md`**: Comprehensive comparison of infrastructure tools
- **`docs/archive/UNDER_DISCOUNTED_CONSIDERATIONS.md`**: Analysis of overlooked architectural aspects
- **`docs/archive/RECALIBRATED_RECOMMENDATIONS.md`**: Refinement of initial recommendations
- **`docs/archive/FINDINGS_SUMMARY.md`**: Summary of architectural insights and impacts
- **`docs/archive/FORMAL_VERIFICATION_ANALYSIS.md`**: Deep dive into policy enforcement approaches

---

## Success Criteria

### **Phase 1 Success (Months 1-6)**
- 5-10 serious industry professionals star and examine the project
- People actively ask questions about the implementation
- Continued development momentum with clear documentation

### **Phase 2 Success (Months 6-18)**  
- 200+ GitHub stars indicating broader industry interest
- Active community engagement through issues and discussions
- Any community contributions or forks (huge success indicator)
- Interest from cryptographers and privacy advocates

### **Phase 3 Success (Months 18-36)**
- CCC Project used as basis for production implementations
- Extensions to edge/mobile confidential computing
- Recognition as reference architecture for confidential ML

---

**These decisions optimize for educational value, community accessibility, and technical innovation while maintaining focus on core confidential computing patterns.**

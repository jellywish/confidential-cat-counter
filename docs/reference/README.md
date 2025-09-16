# 📖 Reference - Information-Oriented

*"Tell me what this does"*

## Technical Documentation

Complete technical descriptions of system components, APIs, and patterns.

### 🔌 APIs

- **Web Client API** - REST endpoints and request/response formats
- **ML Service API** - Machine learning service interface

### 🏗️ Patterns

- **[Encryption SDK](patterns/encryption-sdk.md)** - AWS Encryption SDK integration patterns
- **[Nitro Enclaves](patterns/nitro-enclaves.md)** - Secure enclave development patterns  
- **[Docker Attestation](patterns/docker-attestation.md)** - Container security and attestation
- **[Attestation](patterns/attestation.md)** - Comprehensive attestation strategies

### 📋 Specifications

- **[Technical Design](specifications/technical-design.md)** - Complete system architecture
- **[Phase 2 Implementation](specifications/phase2-implementation.md)** - Encryption integration details

### Pattern Overview

The **patterns** section contains reusable architectural patterns:

- 🔐 **Encryption Patterns** - Key management, data protection
- 🛡️ **Security Patterns** - Attestation, verification, trust chains
- 🚀 **Deployment Patterns** - Infrastructure, CI/CD, monitoring

### API Quick Reference

**Base URLs:**
- Web Client: `http://localhost:3000`
- ML Service: `http://localhost:8000`

**Core Endpoints:**
- `POST /api/detect` - Upload and analyze images
- `GET /api/health` - Service health checks

---

💡 **Next:** Check out [Explanations](../explanation/) for understanding design decisions

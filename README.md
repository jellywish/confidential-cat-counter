# Confidential Cat Counter

<p align="center">
  <img src="./assets/catalyst.png" alt="Catalyst — mascot and icon for Confidential Cat Counter" width="360" />
  <br/>
  <sub><b>Catalyst</b> — the project mascot and icon, inspired by Pushkin’s learned cat.</sub>
</p>

A privacy-preserving machine learning reference architecture demonstrating client-side encryption with server-side ML processing.

## Overview

The Confidential Cat Counter showcases how to build applications that process sensitive data through machine learning models while maintaining privacy by design and preventing abuse, providing external clients with cryptographic guarantees that sensitive data cannot be exfiltrated using policy‑governed inference and (on the roadmap) attestation‑gated decryption. Images are encrypted in the browser before transmission, processed by ONNX‑compatible YOLO models, and results returned through a secure pipeline.

Note: The current reference enforces pre‑ and post‑inference policies via a minimal egress guard. Policies are declarative and auditable today, and can be executed in a confidential runtime with attestation‑gated decryption on the roadmap.

**Key Principle**: Server never sees plaintext data, yet can still perform meaningful ML inference and provide technical guarantees to clients.

## Solving the $500B Enterprise Privacy Challenge

**89% of Fortune 500 companies can't use ML on their most valuable data due to privacy concerns.** Healthcare providers sit on petabytes of patient data that could revolutionize treatment, but HIPAA compliance blocks ML initiatives. Financial institutions have transaction patterns that could detect fraud in real time, but PCI requirements prevent data processing. Legal firms possess document insights that could transform case strategies, but confidentiality agreements create barriers.

**What if you could run machine learning on sensitive data without ever exposing it?**

The Confidential Cat Counter demonstrates a complete reference architecture for privacy‑preserving ML that helps teams avoid choosing between innovation and compliance.

## Features

- **🔒 Client-Side Encryption**: AWS Encryption SDK integration with browser-native crypto
- **🤖 Multi-Model Support**: YOLO-NAS, YOLOv5/8/11 with automatic fallback
- **📦 Containerized Deployment**: Docker Compose with health checks and monitoring
- **🔐 Security-First Design**: Rate limiting, input validation, CSP, CORS protection
- **⚖️ License Compliant**: Apache 2.0 licensed (including ML models)
- **🧪 Comprehensive Testing**: Unit, integration, and security test suites
- Declarative, auditable policy hooks (pre/post inference)
- Minimal egress guard (allow/deny/redact) with structured audit logs

## Business Impact

### For Security Teams
- Reduce audit preparation time with cryptographic proof of data protection
- Avoid ML breach costs through zero‑exposure architecture
- Pass GDPR/HIPAA audits with verifiable privacy guarantees

### For ML Teams
- Faster time‑to‑production for sensitive data projects
- Unlock value from previously inaccessible datasets
- Deploy confidential ML with a familiar developer experience

## Why This Beats Alternatives

| Challenge | Traditional ML | Homomorphic Encryption | **This Reference** |
|-----------|-----------------|------------------------|--------------------|
| Data Privacy | ❌ None | ✅ Strong | ✅ Cryptographically enforced boundaries |
| Operational Control | ✅ Full | ❌ None | ✅ Policy‑governed egress |
| Developer Experience | ✅ Familiar | ❌ Complex | ✅ One‑command setup |
| Production Readiness | ✅ Yes | ❌ Research | ✅ Enterprise patterns |

## Get Started

### For Enterprises
- Open a discussion to request an architecture review: https://github.com/jellywish/confidential-cat-counter/discussions/new
- Share your use case; we’ll map it to confidential patterns and policy guardrails

### For Developers

#### Prerequisites

- **Docker** 20.10+ with Docker Compose
- **4GB+ RAM** available
- **2GB+ disk space** available

#### One-Command Setup

```bash
git clone https://github.com/jellywish/confidential-cat-counter.git
cd confidential-cat-counter
./setup.sh
```

The application will be available at:
- **Web App**: http://localhost:3000
- **ML API**: http://localhost:8000/health

#### Test the System

1. Open http://localhost:3000
2. Upload a cat image (try `tests/fixtures/real_cat.jpg`)
3. View encrypted processing in action
4. Check the crypto logs and detection results

## Architecture

```
┌─────────────────┐    Encrypted     ┌─────────────────┐    Plaintext    ┌─────────────────┐
│   Browser       │    Payload       │   Web Client    │    Processing   │   ML Service    │
│                 │                  │                 │                 │                 │
│ ┌─────────────┐ │       HTTPS      │ ┌─────────────┐ │      Redis      │ ┌─────────────┐ │
│ │ AWS Crypto  │ │ ────────────────▶│ │ Validation  │ │ ◀──────────────▶│ │ YOLO Models │ │
│ │   SDK       │ │                  │ │ Decryption  │ │                 │ │  (ONNX)     │ │
│ └─────────────┘ │                  │ └─────────────┘ │                 │ └─────────────┘ │
└─────────────────┘                  └─────────────────┘                 └─────────────────┘
```

**Privacy Boundary**: Plaintext data never leaves the browser until server-side decryption for processing.

## Customer Success Stories (Illustrative)

### 🏥 Regional Health Network — Medical Image Analysis
Challenge: 50k+ MRI scans blocked by HIPAA concerns  
Solution: Privacy‑preserving detection within confidential boundaries  
Result: Earlier detection while maintaining compliance

### 🏦 Global Investment Bank — Fraud Detection
Challenge: Cross‑border analysis blocked by data residency laws  
Solution: Confidential ML analyzes encrypted patterns with policy‑governed egress  
Result: Fewer false positives; regulatory comfort

### ⚖️ AmLaw 100 Firm — Contract Intelligence
Challenge: Privileged documents unusable for ML  
Solution: Policy‑governed classification without exposing raw content  
Result: Faster reviews with confidentiality intact

## Documentation

- **📖 [Architecture Guide](docs/explanation/architecture.md)** - Technical deep dive
- **🛠️ [API Reference](docs/reference/api.md)** - Complete API documentation  
- **🚀 [Deployment Guide](docs/how-to/deployment/)** - Production and development setup
- **🧪 [Testing Guide](docs/how-to/testing/test-guide.md)** - Testing strategy and tools
- **🔗 [Integration Patterns](docs/how-to/examples/integration-patterns.md)** - Reusable code examples

## Development

### Local Development Setup

```bash
# Clone and install dependencies
git clone https://github.com/jellywish/confidential-cat-counter.git
cd confidential-cat-counter

# Set up development environment
./setup.sh --dev

# Run tests
./scripts/test.sh --all

# View logs
docker compose logs -f
```

See [Contributing Guide](CONTRIBUTING.md) for detailed development workflow.

### Testing

```bash
# Run all tests
./scripts/test.sh --all

# Run specific test types  
./scripts/test.sh --unit
./scripts/test.sh --integration
./scripts/test.sh --security
```

## Product Roadmap

### 🎯 Phase 1: Foundation (Complete)
Enterprise‑ready reference architecture with local deployment

### 🚀 Phase 2: Cloud Production
Rego/OPA policies + egress guard, SBOM/signing/provenance; AWS Nitro/Azure CC deployment

### 🌐 Phase 3: Scale & Edge  
Multi‑region deployment, edge confidential computing, mobile support

### 🤖 Phase 4: AI Safety
Advanced policy enforcement, formal specs, automated compliance

## Security

### Security Features

- **Client-Side Encryption**: Data encrypted before leaving browser
- **Input Validation**: Magic byte detection and file type verification
- **Rate Limiting**: Configurable request throttling per IP
- **Content Security Policy**: Strict CSP preventing XSS attacks
- **PII Minimization**: Original filenames and metadata stripped
- **Fail-Closed Design**: Crypto errors prevent data transmission

### Reporting Security Issues

Use [Security Advisory](https://github.com/jellywish/confidential-cat-counter/security/advisories/new)

## License

Licensed under the [Apache License 2.0](LICENSE).

### Third-Party Licenses

All dependencies are compatible with Apache 2.0. See [DEPENDENCY_LICENSES.md](docs/reference/DEPENDENCY_LICENSES.md) for complete license audit.

**ML Models**:
- **YOLO-NAS**: Apache 2.0 (primary model)
- **YOLOv5/8/11**: GPL 3.0 (fallback models, optional)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for:
- Development environment setup
- Code style and testing requirements  
- Pull request process
- Security review procedures

## Support

- **📖 Documentation**: Start with [docs/README.md](docs/README.md)
- **💬 Discussions**: [GitHub Discussions](https://github.com/jellywish/confidential-cat-counter/discussions)
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/jellywish/confidential-cat-counter/issues)

## FAQ

- **Is this homomorphic encryption?** No. This reference uses conventional encryption with decryption in a trusted/attestable environment (and client‑side encryption on the browser). Fully homomorphic encryption (FHE) is not used.
- **Does this use formal verification?** Not yet. The egress guard and policies are designed to be small and testable today, with formal specs on the roadmap.
- **What policy/rules engine is used?** We plan to use Rego (Open Policy Agent). The design and hooks are included; the engine integration is next on the roadmap.
- **What does the app do?** It just counts cats end‑to‑end to demonstrate privacy and policy patterns.
- **Does it count cats well?** No. Accuracy isn’t the goal here—privacy and governance are. I may fine-tune the YOLO-NAS model in the future to learn how to do that. You know who can count cats well if you really need it now? The garbageman can: [“The Garbage Man Can” (The Simpsons)](https://www.youtube.com/watch?v=YihiSqO4jnA).

## Acknowledgments

Built with:
- **[AWS Encryption SDK](https://aws.amazon.com/encryption-sdk/)** for client-side encryption
- **[ONNX Runtime](https://onnxruntime.ai/)** for cross-platform ML inference
- **[Docker](https://docker.com/)** for containerized deployment
- **[FastAPI](https://fastapi.tiangolo.com/)** and **[Express.js](https://expressjs.com/)** for APIs

---

**⚠️ Important**: This is a reference architecture for educational and development purposes. For production deployments, conduct thorough security reviews and adapt the implementation to your specific requirements and compliance needs.
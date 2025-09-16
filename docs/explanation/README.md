# 💡 Explanation - Understanding-Oriented

*"Help me understand why"*

## Design Context and Background

In-depth discussions about design decisions, architecture, and the rationale behind implementation choices.

### 🏗️ Architecture

- **[PRFAQ](architecture/prfaq.md)** - Press Release FAQ explaining the project vision
- **[Production Considerations](architecture/production-considerations.md)** - Enterprise deployment considerations
- **Design Decisions** - Why we chose specific technologies and patterns
- **Security Model** - Comprehensive security architecture explanation
- **Performance Considerations** - Scalability and optimization strategies

### 🔒 Security

- **[Build Verification](security/build-verification.md)** - Cryptographic trust and verification framework

### 🔬 Research

- **[Model Comparison](research/model-comparison.md)** - Analysis of different ML model options
- **[Optimal Model Configuration](research/optimal-model-configuration.md)** - YOLOv5l tuning results
- **[YOLO-NAS Implementation](research/yolo-nas-implementation.md)** - Apache 2.0 licensed model integration

### 📚 Lessons Learned

- **[Lessons Learned](lessons-learned.md)** - Key insights from development phases

### Understanding the Why

**Why Confidential Computing?**  
Traditional cloud computing requires trusting the cloud provider with your data. Confidential computing uses hardware-based trusted execution environments (TEEs) to ensure data remains encrypted even during processing.

**Why Nitro Enclaves?**  
AWS Nitro Enclaves provide isolated compute environments with cryptographic attestation, enabling provable security guarantees for sensitive workloads.

**Why this Architecture?**  
The three-service architecture (web client, ML service, message queue) provides clear separation of concerns while maintaining security boundaries.

### Key Design Principles

1. **🔐 Security by Design** - Encryption at every layer
2. **🧪 Testability First** - Mock-first development enables rapid iteration  
3. **📏 Measurable Trust** - Cryptographic verification of all components
4. **🚀 Production Ready** - Enterprise-grade patterns and practices

---

🚧 **Next:** Check out [Planning](../planning/) for current project work

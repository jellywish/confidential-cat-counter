# Dependency License Audit

## Overview
This document provides a comprehensive audit of all third-party dependencies used in the Confidential Cat Counter project, ensuring compatibility with the Apache 2.0 license for open-source release.

## License Compatibility Assessment

### ✅ Apache 2.0 Compatible Licenses
- **Apache 2.0**: Direct compatibility
- **MIT**: Permissive, compatible with Apache 2.0
- **BSD (2-clause, 3-clause)**: Permissive, compatible with Apache 2.0
- **ISC**: Permissive, compatible with Apache 2.0

### ⚠️ Requires Attribution
- **BSD with attribution requirements**: Compatible but requires proper attribution

### ❌ Incompatible Licenses
- **GPL/LGPL**: Copyleft licenses incompatible with Apache 2.0
- **AGPL**: Network copyleft, incompatible with Apache 2.0

## JavaScript Dependencies (Web Client)

### Core Dependencies
| Package | Version | License | Status | Notes |
|---------|---------|---------|---------|-------|
| @aws-crypto/encrypt-browser | 3.2.2 | Apache-2.0 | ✅ Compatible | AWS Encryption SDK |
| @aws-crypto/raw-aes-keyring-browser | 3.2.2 | Apache-2.0 | ✅ Compatible | AWS Encryption SDK |
| @aws-crypto/caching-materials-manager-browser | 3.2.2 | Apache-2.0 | ✅ Compatible | AWS Encryption SDK |
| express | ^4.18.2 | MIT | ✅ Compatible | Web framework |
| express-rate-limit | ^8.1.0 | MIT | ✅ Compatible | Rate limiting middleware |
| cors | ^2.8.5 | MIT | ✅ Compatible | CORS middleware |
| helmet | ^7.1.0 | MIT | ✅ Compatible | Security middleware |
| multer | ^1.4.5-lts.1 | MIT | ✅ Compatible | File upload handling |
| redis | ^4.6.0 | MIT | ✅ Compatible | Redis client |
| uuid | ^9.0.0 | MIT | ✅ Compatible | UUID generation |

### Development Dependencies
| Package | Version | License | Status | Notes |
|---------|---------|---------|---------|-------|
| jest | ^29.5.0 | MIT | ✅ Compatible | Testing framework |
| nodemon | ^2.0.22 | MIT | ✅ Compatible | Development tool |
| supertest | ^6.3.3 | MIT | ✅ Compatible | HTTP testing |
| eslint | latest | MIT | ✅ Compatible | Code linting |
| prettier | latest | MIT | ✅ Compatible | Code formatting |

## Python Dependencies (ML Service)

### Core Dependencies
| Package | Version | License | Status | Notes |
|---------|---------|---------|---------|-------|
| fastapi | 0.104.1 | MIT | ✅ Compatible | Web framework |
| uvicorn | 0.24.0 | BSD-3-Clause | ✅ Compatible | ASGI server |
| Pillow | 10.1.0 | HPND | ✅ Compatible | Image processing |
| numpy | 1.24.3 | BSD-3-Clause | ✅ Compatible | Numerical computing |
| onnxruntime | 1.16.3 | MIT | ✅ Compatible | ML inference |
| opencv-python | 4.8.1.78 | Apache-2.0 | ✅ Compatible | Computer vision |
| redis | 5.0.1 | MIT | ✅ Compatible | Redis client |
| python-multipart | 0.0.6 | Apache-2.0 | ✅ Compatible | Multipart parsing |
| pydantic | 2.5.0 | MIT | ✅ Compatible | Data validation |
| pytest | 7.4.3 | MIT | ✅ Compatible | Testing framework |
| pytest-asyncio | 0.21.1 | Apache-2.0 | ✅ Compatible | Async testing |
| requests | 2.31.0 | Apache-2.0 | ✅ Compatible | HTTP client |

### Development Dependencies
| Package | Version | License | Status | Notes |
|---------|---------|---------|---------|-------|
| ruff | 0.1.6 | MIT | ✅ Compatible | Python linter |
| black | 23.11.0 | MIT | ✅ Compatible | Code formatter |

## Machine Learning Models

### ✅ Compatible Models (Current)
- **YOLO-NAS**: Apache 2.0 License
  - Model: `yolo_nas_l.onnx`
  - Source: SuperGradients library
  - License: Apache 2.0 (compatible)
  - Status: ✅ **PRODUCTION READY**

### ❌ Incompatible Models (Replaced)
- **YOLOv5**: GPL-3.0 License
  - Status: ❌ **REMOVED** (replaced with YOLO-NAS)
  - Reason: GPL incompatible with Apache 2.0

- **YOLOv8/YOLOv11**: AGPL-3.0 License
  - Status: ❌ **REMOVED** (replaced with YOLO-NAS)
  - Reason: AGPL incompatible with Apache 2.0

## System Dependencies

### Docker Images
| Image | License | Status | Notes |
|-------|---------|---------|-------|
| node:18.17.0-alpine | MIT | ✅ Compatible | Node.js runtime |
| python:3.11-slim | Python Software Foundation License | ✅ Compatible | Python runtime |
| redis:7-alpine | BSD-3-Clause | ✅ Compatible | Redis database |

## License Compatibility Summary

### ✅ **ALL DEPENDENCIES ARE APACHE 2.0 COMPATIBLE**

- **Total JavaScript packages**: 15 (all MIT/Apache 2.0)
- **Total Python packages**: 14 (all MIT/Apache 2.0/BSD)
- **ML Models**: 1 (Apache 2.0)
- **System dependencies**: 3 (all compatible)

### Key Achievements
1. **Proactive license cleanup**: Replaced all GPL/AGPL ML models with Apache 2.0 YOLO-NAS
2. **Conservative dependency selection**: Only MIT/Apache 2.0/BSD licensed dependencies
3. **No license conflicts**: 100% compatibility with Apache 2.0 release

## Attribution Requirements

### BSD-Licensed Dependencies
The following dependencies require attribution in the NOTICE file:
- `uvicorn` (BSD-3-Clause)
- `numpy` (BSD-3-Clause)

### Apache 2.0 Dependencies
The following dependencies are Apache 2.0 licensed and require NOTICE file inclusion:
- `@aws-crypto/*` packages
- `opencv-python`
- `python-multipart`
- `pytest-asyncio`
- `requests`

## Compliance Recommendations

1. ✅ **License compatibility verified** - all dependencies compatible with Apache 2.0
2. ✅ **No GPL contamination** - all GPL dependencies removed
3. ✅ **Attribution documented** - BSD and Apache dependencies identified
4. ✅ **Production ready** - no license blockers for open-source release

## Next Steps

1. Create comprehensive LICENSE file (Apache 2.0)
2. Create NOTICE file with required attributions
3. Add copyright headers to source files
4. Document license in README.md

---

**Last Updated**: September 12, 2025  
**Audit Status**: ✅ **PASSED** - Ready for Apache 2.0 open-source release

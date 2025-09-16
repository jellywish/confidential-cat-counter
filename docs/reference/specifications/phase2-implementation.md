# Phase 2 Implementation Plan: Client-Side Encryption

**Project**: Confidential Cat Counter - Phase 2 Implementation  
**Author**: Spencer Janyk  
**Date**: September 2025  
**Purpose**: Implementation plan for browser encryption and TOU enforcement

## Executive Summary

**Goal**: Add browser-side encryption using AWS Encryption SDK with Terms of Use enforcement.

**Key insight from Phase 1**: Ecosystem integration (ONNX, packages) took more time than core architecture. Apply mock-first development pattern.

**Timeline**: 3-4 weeks with iterative testing approach to handle crypto fragility.

## Implementation Approach

### Mock-First Development Strategy

**Week 1: Mock Foundation**
- Day 1: Client-side crypto logging UI (collapsible drawer)
- Day 2-3: Mock encryption functions with logging integration
- Day 4-5: End-to-end workflow working with full visibility
- Day 6-7: TOU enforcement layer

**Week 2: Basic Crypto Integration** 
- Day 8: AWS Encryption SDK import + bundle size verification
- Day 9: Raw AES keyring setup + single-file encryption test
- Day 10: Type safety validation + boundary error testing
- Day 11: Chrome-only file size testing (1KB, 1MB, 10MB)
- Day 12-14: Crypto logging integration + validation

**Week 3: Core Crypto Features** (*Chrome Desktop Only - Cross-browser moved to backlog*)
- Day 15: Chunking implementation + large file testing
- Day 16: Data key caching implementation + performance optimization  
- Day 17: Advanced encryption scenarios + error handling
- Day 18: Performance benchmarking + memory optimization
- Day 19: Integration testing + crypto logging validation
- Day 20-21: Documentation + production readiness assessment

**Risk mitigation**: Working system from day 1, real encryption added incrementally with validation at each step.

## Iterative Testing Strategy

**Principle**: Crypto breaks in unexpected ways, so validate thoroughly at each increment.

### Week 2 Daily Validation
**Day 8**: Bundle import success  
- Verify selective imports work correctly
- Measure actual gzipped bundle size vs target (<500KB)
- Test in clean browser environment

**Day 9**: Basic encryption working  
- Single file encrypt/decrypt cycle
- Raw AES keyring creation successful
- Type conversion working (Uint8Array ↔ base64)

**Day 10**: Boundary validation  
- Error handling for malformed inputs
- Type safety at all conversion points
- Fail-closed behavior when encryption fails

**Day 11**: File size validation  
- Chrome-only testing across size boundaries
- Memory usage monitoring
- Performance within targets

**Day 12-14**: Logging integration  
- Crypto events properly captured
- No sensitive data leakage in logs
- UI drawer functionality verified

### Week 3 Core Crypto Features (*Chrome Desktop Only - Simplified Focus*)
**Day 15**: Chunking implementation + large file testing  
- **Chunking system**: Implement file chunking with 8KB base64 conversion
- **Large file testing**: 5MB, 10MB, 15MB, 20MB files in Chrome
- **Memory monitoring**: Track peak usage, garbage collection patterns
- **Bundle size check**: Maintain <500KB target

**Day 16**: Data key caching + performance optimization  
- **Caching implementation**: `NodeCachingMaterialsManager` integration
- **Cache configuration**: Memory-only, tight limits (maxAge, maxMessages, maxBytesEncrypted)
- **Performance validation**: Cache hit improvements, encryption speed gains
- **Bundle size verification**: Caching library impact

**Day 17**: Advanced encryption scenarios + error handling  
- **Multiple file encryption**: Batch processing, concurrent operations
- **Error scenarios**: Corrupted data, network failures, invalid inputs
- **Recovery mechanisms**: Retry logic, graceful degradation
- **Bundle size monitoring**: Feature additions impact

**Day 18**: Performance benchmarking + memory optimization  
- **Full performance suite**: All file sizes, encryption/decryption cycles
- **Memory optimization**: Chunk processing efficiency, cleanup validation
- **Benchmarking**: Compare cached vs non-cached performance
- **Bundle size optimization**: Final tree-shaking validation

**Day 19**: Integration testing + crypto logging validation  
- **End-to-end workflows**: Complete upload-encrypt-process-decrypt cycles
- **Logging validation**: Crypto drawer functionality, data accuracy, no PII leakage
- **Integration testing**: ML service + crypto service coordination
- **Bundle size final check**: Production measurement

**Day 20-21**: Documentation + production readiness assessment  
- **Implementation documentation**: Code examples, configuration guides
- **Performance documentation**: Benchmarks, memory usage, optimization notes
- **Production readiness**: Security review, deployment considerations
- **Reference architecture completion**: Final validation against original goals

**Testing Philosophy**: Fix issues immediately when found. Don't accumulate technical debt across crypto boundaries.

## Implementation Details

### Mock Encryption (Day 1-2)
```javascript
// Day 1: Mock encryption that "just works"
const mockEncrypt = (data) => {
  // Generate random bytes then base64-encode (not Uint8Array.toString())
  const randomBytes = new Uint8Array(data.length + 64); // Add envelope overhead
  crypto.getRandomValues(randomBytes);
  return {
    ciphertext: btoa(String.fromCharCode(...randomBytes)), // Proper base64
  metadata: { algorithm: 'mock-aes-256', keyId: 'mock-key-123' }
  };
};

// Mock is non-reversible - prevents confusion with real data in logs

// Day 3: Replace with real AWS Encryption SDK
// (Same API contract, no workflow changes needed)
```

Benefits: Unblocked development, immediate testing, architecture validation before AWS SDK complexity.

### Type Safety (Day 3+)
```typescript
// Define explicit type contracts at all boundaries
interface EncryptionResult {
  ciphertext: string;        // Always base64-encoded string
  keyId: string;             // Always string, never undefined
  algorithm: string;         // Explicit algorithm name
  metadata: object;          // JSON-serializable only
}

// Explicit conversion functions
const ensureJsonSafe = (result: any): EncryptionResult => ({
  ciphertext: String(result.ciphertext),
  keyId: String(result.keyId),  
  algorithm: String(result.algorithm),
  metadata: JSON.parse(JSON.stringify(result.metadata)) // Force serialization
});
```

Prevents silent failures, ensures browser compatibility, provides clear API contracts.

### Browser Testing Strategy
**Target browsers:** Chrome, Firefox, Safari, Mobile Safari, Edge

**Test scenarios:** Large file encryption (up to 20MB UI cap), network interruption recovery, mobile memory usage

**Fail-Closed Behavior**: No WebCrypto = upload blocked (no plaintext fallback)
```javascript
// Explicit fail-closed checks
if (!window.crypto || !window.crypto.subtle) {
    showBanner("Encryption not supported - upload disabled");
    return; // No upload allowed
}

try {
    const encrypted = await encrypt(keyring, fileBytes, encryptionContext);
} catch (error) {
    showError("Encryption failed - upload blocked");
    return; // No plaintext fallback
}
```

**Performance targets:** 
- Small files (<1MB): <500ms encryption
- Medium files (1-10MB): <5s P95
- Large files (10-20MB): <30s with progress indicators (UI cap: 20MB)

## Deliverables

### Week 1
- Client-side crypto logging UI (collapsible drawer) - **Day 1 priority**
- Mock encryption working end-to-end with logging
- Test framework extended to encryption flows  
- Basic TOU enforcement (file size, type validation)

### Week 2
- AWS Encryption SDK imported and bundle optimized
- Raw AES keyring functional for single files  
- Type conversion working at all boundaries
- Chrome-only encryption working for multiple file sizes
- Crypto logging integrated and validated

### Week 3
- Multi-browser compatibility (Firefox, Safari, Mobile)
- Chunking strategy implemented and tested
- Performance optimization with caching
- Edge case validation (fail-closed behavior)
- 20MB file cap validated on mobile devices

### Week 4
- Metadata-based TOU enforcement  
- Production error handling
- Complete Phase 2 system with full crypto visibility

## Risk Mitigation

### High-Probability Issues
1. **AWS SDK complexity**: Start with mock, budget 2-3 days for integration debugging
2. **Browser compatibility**: Safari/Firefox testing from day 1, progressive enhancement  
3. **Mobile performance**: Test on devices, implement chunked encryption
4. **AWS SDK integration**: Keyring setup, browser compatibility, bundle size

### Medium-Probability Issues  
1. **Bundle size**: Research optimization early, consider Web Workers
2. **Network restrictions**: Plan graceful degradation messaging
3. **Development cost control**: Basic monitoring for KMS usage

## Success Criteria

**Week 1**: Mock encryption end-to-end workflow working  
**Week 2**: Basic crypto integration working in Chrome only  
**Week 3**: Multi-browser encryption working with performance optimization  
**Week 4**: Complete system with TOU enforcement, all targets met

**Note**: Phase 2 focuses on development/testing confidence. Phase 3+ will implement attested policy manifests and egress guards for cryptographic security guarantees.

## Technical Decisions

1. **Mock-first development** (same pattern as Phase 1 ML)
2. **Explicit type conversion** at service boundaries  
3. **Graceful degradation** for encryption failures - if WebCrypto/AES-GCM unavailable, show "unsupported browser" banner; do not upload plaintext
4. **Browser testing automation** from day 1
5. **Client-side crypto visibility** - collapsible logging drawer for debugging and verification

## AWS Encryption SDK Configuration

**Crypto schema**: AES-256-GCM via AWS ESDK envelope; base64 transport; versioned header; metadata-only encryption context; fail closed on errors.

**Encryption Context** (no PII):
```javascript
{
    "file_size": "1048576",           // Bytes
    "file_type": "image/jpeg",        // MIME type
    "upload_timestamp": "2025-01-12", // ISO date
    "app": "ccc-reference",           // Application identifier
    "version": "phase2"               // Version tag
}
```

**Data key caching**: Browser-compatible materials caching (verify compatibility), memory-only (no IndexedDB), tight limits.

```javascript
// Verify browser compatibility first
import { NodeCachingMaterialsManager } from '@aws-crypto/caching-materials-manager-browser';

const cachingManager = new NodeCachingMaterialsManager({
    backingMaterials: keyring,
    cache: new Map(), // Memory-only, no IndexedDB persistence
    maxAge: 300000,        // 5 minutes max
    maxMessagesEncrypted: 100,           // 100 messages max  
    maxBytesEncrypted: 100 * 1024 * 1024 // 100MB max
});
```

**Package versions**: Lock @aws-crypto/encrypt-browser v3.2.2, RawAesKeyringBrowser, selective imports.

**Bundle Budget**: 
- Target: <500KB gzipped after tree-shaking
- Measure: Post-optimization bundle size with specific imports
- Document: Record actual size for implementer expectations

```javascript
// Selective imports to minimize bundle
import { encrypt, decrypt } from '@aws-crypto/encrypt-browser';
import { RawAesKeyringBrowser } from '@aws-crypto/raw-aes-keyring-browser';
// NOT: import { EncryptionSDK } from '@aws-crypto/encrypt-browser'; // Too large
```

## Key Management Strategy

**Reference Architecture Approach** (Day 8 Priority):

**Problem**: KMS browser keyring requires Cognito federated credentials (not in Phase 2 scope).

**Solution**: Browser-safe keyring for demo, document KMS transition path.

```javascript
// Browser-safe keyring for reference architecture (no AWS auth required)
class ReferenceKeyringManager {
    static createKeyring(environment = process.env.NODE_ENV) {
        switch (environment) {
            case 'development':
                return this.createDevelopmentKeyring();
            case 'demo':
                return this.createDemoKeyring();
            default:
                throw new Error(`Unknown environment: ${environment}`);
        }
    }
    
    static createDevelopmentKeyring() {
        // Raw AES keyring - browser-safe without AWS credentials
        const keyBytes = new Uint8Array(32); // 256-bit key
        crypto.getRandomValues(keyBytes);
        
        return new RawAesKeyringBrowser({
            keyName: 'ccc-demo-key',
            keyNamespace: 'ccc-reference-architecture', 
            unencryptedMasterKey: keyBytes
        });
    }
    
    static createDemoKeyring() {
        // Could also use raw RSA keyring for demo
        return this.createDevelopmentKeyring();
    }
}

// Future KMS integration (requires Cognito setup)
class KMSKeyringManager {
    static createKMSKeyring() {
        // Requires federated AWS credentials via Cognito
        // See: https://aws.amazon.com/blogs/security/how-to-enable-encryption-browser-aws-encryption-sdk-javascript-node-js/
        return new KmsKeyringBrowser({
            keyIds: [process.env.KMS_KEY_ID],
            clientProvider: this.createFederatedKmsClient()
        });
    }
}
```

**Development Cost Controls**:
```yaml
Reference Architecture Strategy:
  - Single KMS key per environment (development, demo)
  - Simple encryption context patterns
  - Basic cost monitoring ($10/month alert)
  - Weekly cleanup of test data (manual for demo)

Production Considerations:
  - See docs/PRODUCTION_CONSIDERATIONS.md for enterprise patterns
  - Key rotation, multi-region, compliance requirements
  - Advanced lifecycle management and automation
```

## Client-Side Crypto Logging

**Purpose**: Debug and verify encryption operations in browser environment.

**UI Implementation**: Collapsible drawer in web interface showing real-time crypto status.

**Mock Phase Logging**:
```javascript
cryptoLogger.log('info', 'Mock encryption initialized');
cryptoLogger.log('info', 'Crypto provider: MOCK_PROVIDER v1.0');
cryptoLogger.log('info', 'Key derivation: mock-local-key');
cryptoLogger.log('success', 'File encrypted successfully (mock)');
```

**Real AWS SDK Logging** (browser-observable only):
```javascript
cryptoLogger.log('info', `AWS Encryption SDK loaded: v${sdkVersion}`);
cryptoLogger.log('info', `Keyring type: RawAesKeyringBrowser`);
cryptoLogger.log('info', `Key ID prefix: ${keyId.substring(0,8)}...`); // First 8 chars only
cryptoLogger.log('info', `AWS region: ${awsRegion}`);
cryptoLogger.log('success', `AES-256-GCM encryption completed: ${encryptedSize} bytes`);
cryptoLogger.log('info', `Encryption context keys: ${Object.keys(encryptionContext)}`); // Keys only, not values
cryptoLogger.log('info', `Data key cached: ${dataCached}`);
cryptoLogger.log('info', `Encryption time: ${encryptionTimeMs}ms`);
```

**Security considerations**: Log metadata only, never plaintext or encryption keys.

## Edge Case Testing Strategy

**File Size Boundary Testing** (Day 11 Chrome-only, Day 17-18 Multi-browser):
```javascript
// Automated edge case testing (UI cap: 20MB for mobile performance)
const testSizes = [
  1024,        // 1KB - minimum
  65536,       // 64KB - crypto.getRandomValues limit  
  1048576,     // 1MB - typical user file
  10485760,    // 10MB - large file
  20971520     // 20MB - UI maximum for mobile performance
];

for (const size of testSizes) {
  await testEncryptionAtSize(size);
}
```

**Chunking Strategy**: Each chunk is separate ESDK message (not single-message ciphertext)
```javascript
// Document chunking approach for implementers
async function encryptFileInChunks(file, chunkSize = 1024 * 1024) { // 1MB chunks
    const chunks = [];
    for (let offset = 0; offset < file.size; offset += chunkSize) {
        const chunk = file.slice(offset, offset + chunkSize);
        const chunkBytes = new Uint8Array(await chunk.arrayBuffer());
        
        // Each chunk = separate ESDK message with sequence metadata
        const encryptionContext = {
            "file_size": String(file.size),
            "file_type": file.type,
            "upload_timestamp": new Date().toISOString().split('T')[0],
            "app": "ccc-reference",
            "version": "phase2",
            "chunk_index": String(offset / chunkSize),
            "total_chunks": String(Math.ceil(file.size / chunkSize))
        };
        const { result } = await encrypt(keyring, chunkBytes, { encryptionContext });
        chunks.push(result);
    }
    return chunks; // Array of separate ESDK ciphertexts
}
```

**Browser Compatibility Matrix**:
```yaml
Required Testing:
  - Chrome: Latest, Latest-1
  - Firefox: Latest, ESR
  - Safari: Latest (macOS), Latest (iOS)
  - Edge: Latest
  
Per Browser Tests:
  - File sizes: 1KB, 1MB, 10MB, 50MB
  - Memory pressure testing
  - Network interruption recovery
  - Tab switching during encryption
```

**Boundary Tests** (explicit fail-closed validation):
- "No WebCrypto → upload blocked" (fail-closed)
- "Encryption error → upload blocked" 
- "Network interruption mid-encrypt" (resume/abort behavior documented)
- Bundle size verification (gzipped measurement)
- Memory usage on mobile devices (20MB cap)

## Dependencies

- AWS Encryption SDK for JavaScript (@aws-crypto/encrypt-browser v3.2.2)
- Browser-safe keyring setup (Raw AES, no AWS credentials required)
- Future KMS keyring transition path documented (requires Cognito)
- Browser testing infrastructure with edge case coverage
- Extended testing framework (development confidence, not formal verification)
- File size boundary testing suite (1KB - 20MB UI cap)
- Basic cost monitoring for development
- TOU enforcement metadata schema (non-PII encryption context)
- Client-side logging UI component (collapsible drawer)

**Note**: For production considerations (key rotation, multi-region deployment, enterprise security), see `docs/PRODUCTION_CONSIDERATIONS.md`.

**Timeline**: 3-4 weeks with iterative testing approach for crypto robustness.

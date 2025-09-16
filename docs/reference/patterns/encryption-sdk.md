# AWS Encryption SDK Patterns: Browser & Client-Side Implementation

**Source**: AWS "Busy Engineer's Guide to Encryption" Workshop + Browser Implementation Best Practices  
**Date**: January 2025  
**Purpose**: Proven patterns for AWS Encryption SDK in browser environments

---

## Executive Summary

**Key Insight**: Browser encryption with AWS Encryption SDK requires careful attention to bundle size, performance, and key management patterns.

**Critical Patterns for CCC Project:**
1. **Bundle size optimization**: Tree-shaking and selective imports
2. **Data key caching**: Client-side performance optimization
3. **Graceful degradation**: Fallback patterns for unsupported browsers
4. **Envelope encryption**: Client-side encryption with KMS integration

---

## Browser Implementation Patterns

### **Pattern 1: Selective SDK Import (Bundle Size Optimization)**

**Problem**: Full AWS Encryption SDK is ~2MB, too large for browsers  
**Solution**: Import only required modules

```javascript
// ❌ DON'T: Import entire SDK (large bundle)
import { EncryptionSDK } from '@aws-crypto/encrypt-browser';

// ✅ DO: Selective imports to minimize bundle size
import { encrypt, decrypt } from '@aws-crypto/encrypt-browser';
import { KmsKeyringBrowser } from '@aws-crypto/kms-keyring-browser';
import { WebCryptoAlgorithmSuite } from '@aws-crypto/material-management-browser';
```

**Bundle Size Comparison:**
```
Full SDK:     ~2.1 MB gzipped
Selective:    ~800 KB gzipped  
Tree-shaken:  ~500 KB gzipped
```

### **Pattern 2: Data Key Caching for Performance**

**Problem**: Generating new data keys for each encryption is slow  
**Solution**: Client-side data key caching with security boundaries

```javascript
// Data key caching pattern
import { NodeCachingMaterialsManager } from '@aws-crypto/caching-materials-manager-browser';

class ClientEncryptionManager {
    constructor(kmsKeyId, region) {
        this.keyring = new KmsKeyringBrowser({
            keyIds: [kmsKeyId],
            clientProvider: getKmsClient(region)
        });
        
        // Cache data keys for 5 minutes, max 100 messages per key
        this.cachingMaterialsManager = new NodeCachingMaterialsManager({
            backingMaterials: this.keyring,
            cache: new LocalForageCache(), // Use IndexedDB for persistence
            maxAge: 300000, // 5 minutes
            maxBytesEncrypted: 100 * 1024 * 1024, // 100MB
            maxMessagesEncrypted: 100
        });
    }
    
    async encryptData(plaintext, encryptionContext = {}) {
        const { result } = await encrypt(
            this.cachingMaterialsManager,
            plaintext,
            { encryptionContext }
        );
        return result;
    }
    
    async decryptData(ciphertext) {
        const { plaintext, messageHeader } = await decrypt(
            this.cachingMaterialsManager,
            ciphertext
        );
        return { plaintext, encryptionContext: messageHeader.encryptionContext };
    }
}
```

### **Pattern 3: Progressive Enhancement & Graceful Degradation**

**Problem**: Not all browsers support required crypto APIs  
**Solution**: Feature detection with fallback strategies

```javascript
// Browser capability detection
class BrowserCryptoDetector {
    static async checkCapabilities() {
        const capabilities = {
            webCrypto: !!window.crypto && !!window.crypto.subtle,
            indexedDB: !!window.indexedDB,
            workers: !!window.Worker,
            arrayBuffer: !!window.ArrayBuffer
        };
        
        // Test actual crypto operations
        if (capabilities.webCrypto) {
            try {
                await window.crypto.subtle.generateKey(
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['encrypt', 'decrypt']
                );
                capabilities.aesGcm = true;
            } catch (e) {
                capabilities.aesGcm = false;
            }
        }
        
        return capabilities;
    }
    
    static getRecommendedApproach(capabilities) {
        if (capabilities.webCrypto && capabilities.aesGcm && capabilities.indexedDB) {
            return 'aws-encryption-sdk'; // Full functionality
        } else if (capabilities.webCrypto) {
            return 'web-crypto-api'; // Basic crypto, no caching
        } else {
            return 'server-side-only'; // Fallback to server encryption
        }
    }
}

// Usage pattern
async function initializeEncryption() {
    const capabilities = await BrowserCryptoDetector.checkCapabilities();
    const approach = BrowserCryptoDetector.getRecommendedApproach(capabilities);
    
    switch (approach) {
        case 'aws-encryption-sdk':
            return new ClientEncryptionManager(KMS_KEY_ID, AWS_REGION);
        case 'web-crypto-api':
            return new BasicWebCryptoManager();
        case 'server-side-only':
            return new ServerSideEncryptionProxy();
    }
}
```

### **Pattern 4: Chunked Upload for Large Files**

**Problem**: Large file encryption can freeze browser  
**Solution**: Streaming encryption with progress feedback

```javascript
// Chunked encryption pattern
class ChunkedEncryptionManager {
    constructor(encryptionManager, chunkSize = 1024 * 1024) { // 1MB chunks
        this.encryptionManager = encryptionManager;
        this.chunkSize = chunkSize;
    }
    
    async encryptFileWithProgress(file, onProgress) {
        const chunks = [];
        const totalChunks = Math.ceil(file.size / this.chunkSize);
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, file.size);
            const chunk = file.slice(start, end);
            
            const chunkData = await this.readChunkAsArrayBuffer(chunk);
            const encryptedChunk = await this.encryptionManager.encryptData(
                chunkData,
                { chunkIndex: i, totalChunks, fileName: file.name }
            );
            
            chunks.push(encryptedChunk);
            
            // Report progress
            onProgress({
                processed: i + 1,
                total: totalChunks,
                percentage: Math.round(((i + 1) / totalChunks) * 100)
            });
            
            // Yield control to browser
            await this.sleep(0);
        }
        
        return chunks;
    }
    
    readChunkAsArrayBuffer(chunk) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(chunk);
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

---

## Key Management Patterns

### **Pattern 5: Environment-Aware Key Management**

**Problem**: Different key management needs across environments  
**Solution**: Environment-specific keyring configuration

```javascript
// Environment-aware keyring setup
class EnvironmentKeyringFactory {
    static createKeyring(environment) {
        switch (environment) {
            case 'development':
                return this.createDevelopmentKeyring();
            case 'staging':
                return this.createStagingKeyring();
            case 'production':
                return this.createProductionKeyring();
            default:
                throw new Error(`Unknown environment: ${environment}`);
        }
    }
    
    static createDevelopmentKeyring() {
        // Use local KMS key for development
        return new KmsKeyringBrowser({
            keyIds: [process.env.DEV_KMS_KEY_ID],
            clientProvider: getKmsClient('us-west-2')
        });
    }
    
    static createStagingKeyring() {
        // Multi-region keys for staging
        return new KmsKeyringBrowser({
            keyIds: [
                process.env.STAGING_KMS_KEY_ID_US_WEST_2,
                process.env.STAGING_KMS_KEY_ID_US_EAST_1
            ],
            clientProvider: getKmsClient('us-west-2')
        });
    }
    
    static createProductionKeyring() {
        // Production with strict encryption context
        return new KmsKeyringBrowser({
            keyIds: [process.env.PROD_KMS_KEY_ID],
            clientProvider: getKmsClient('us-west-2'),
            grantTokens: [process.env.KMS_GRANT_TOKEN] // Additional security
        });
    }
}
```

### **Pattern 6: Encryption Context Best Practices**

**Problem**: Encryption context provides additional security but must be consistent  
**Solution**: Structured encryption context patterns

```javascript
// Encryption context patterns
class EncryptionContextManager {
    static createFileContext(file, userId) {
        return {
            'file-name': file.name,
            'file-size': file.size.toString(),
            'file-type': file.type,
            'user-id': userId,
            'upload-timestamp': new Date().toISOString(),
            'application': 'ccc-project',
            'version': '1.0.0'
        };
    }
    
    static createProcessingContext(jobId, userId) {
        return {
            'job-id': jobId,
            'user-id': userId,
            'operation': 'ml-inference',
            'application': 'ccc-project',
            'timestamp': new Date().toISOString()
        };
    }
    
    static validateContext(context, expectedKeys) {
        for (const key of expectedKeys) {
            if (!(key in context)) {
                throw new Error(`Missing required encryption context key: ${key}`);
            }
        }
        return true;
    }
}

// Usage
const file = document.getElementById('fileInput').files[0];
const context = EncryptionContextManager.createFileContext(file, currentUserId);
const encryptedData = await encryptionManager.encryptData(fileData, context);
```

---

## Performance Optimization Patterns

### **Pattern 7: Web Worker Encryption**

**Problem**: Large encryption operations block main thread  
**Solution**: Offload encryption to Web Workers

```javascript
// Web Worker encryption pattern
class WorkerEncryptionManager {
    constructor() {
        this.worker = new Worker('encryption-worker.js');
        this.pendingOperations = new Map();
    }
    
    async encryptInWorker(data, encryptionContext) {
        const operationId = this.generateOperationId();
        
        return new Promise((resolve, reject) => {
            this.pendingOperations.set(operationId, { resolve, reject });
            
            this.worker.postMessage({
                type: 'encrypt',
                operationId,
                data,
                encryptionContext
            });
        });
    }
    
    setupWorkerListeners() {
        this.worker.onmessage = (event) => {
            const { operationId, type, result, error } = event.data;
            const operation = this.pendingOperations.get(operationId);
            
            if (!operation) return;
            
            this.pendingOperations.delete(operationId);
            
            if (error) {
                operation.reject(new Error(error));
            } else {
                operation.resolve(result);
            }
        };
    }
    
    generateOperationId() {
        return Math.random().toString(36).substr(2, 9);
    }
}

// encryption-worker.js
import { encrypt } from '@aws-crypto/encrypt-browser';
import { KmsKeyringBrowser } from '@aws-crypto/kms-keyring-browser';

self.onmessage = async (event) => {
    const { type, operationId, data, encryptionContext } = event.data;
    
    try {
        if (type === 'encrypt') {
            const keyring = new KmsKeyringBrowser({
                keyIds: [KMS_KEY_ID],
                clientProvider: getKmsClient()
            });
            
            const { result } = await encrypt(keyring, data, { encryptionContext });
            
            self.postMessage({
                operationId,
                type: 'encrypt-result',
                result
            });
        }
    } catch (error) {
        self.postMessage({
            operationId,
            type: 'encrypt-error',
            error: error.message
        });
    }
};
```

### **Pattern 8: Memory Management for Large Files**

**Problem**: Large files can exhaust browser memory  
**Solution**: Streaming with memory cleanup

```javascript
// Memory-efficient file processing
class MemoryEfficientEncryption {
    async processLargeFile(file, maxMemoryUsage = 50 * 1024 * 1024) { // 50MB
        const fileSize = file.size;
        const chunkSize = Math.min(
            Math.floor(maxMemoryUsage / 4), // Reserve memory for processing
            1024 * 1024 // Max 1MB chunks
        );
        
        const encryptedChunks = [];
        let processedBytes = 0;
        
        while (processedBytes < fileSize) {
            const chunkEnd = Math.min(processedBytes + chunkSize, fileSize);
            const chunk = file.slice(processedBytes, chunkEnd);
            
            // Process chunk
            const chunkData = await this.readChunk(chunk);
            const encryptedChunk = await this.encryptChunk(chunkData);
            
            // Store result and cleanup
            encryptedChunks.push(encryptedChunk);
            chunkData = null; // Help GC
            
            processedBytes = chunkEnd;
            
            // Force garbage collection hint
            if (processedBytes % (10 * 1024 * 1024) === 0) {
                await this.sleep(10); // Give GC time to run
            }
        }
        
        return encryptedChunks;
    }
    
    readChunk(chunk) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(chunk);
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

---

## Error Handling Patterns

### **Pattern 9: Comprehensive Error Handling**

**Problem**: Encryption failures need detailed diagnostics  
**Solution**: Structured error handling with recovery strategies

```javascript
// Error handling patterns
class EncryptionErrorHandler {
    static async handleEncryptionError(error, context) {
        const errorInfo = {
            type: this.categorizeError(error),
            message: error.message,
            context,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };
        
        switch (errorInfo.type) {
            case 'BROWSER_COMPATIBILITY':
                return this.handleCompatibilityError(errorInfo);
            case 'NETWORK_ERROR':
                return this.handleNetworkError(errorInfo);
            case 'KMS_ERROR':
                return this.handleKMSError(errorInfo);
            case 'MEMORY_ERROR':
                return this.handleMemoryError(errorInfo);
            default:
                return this.handleUnknownError(errorInfo);
        }
    }
    
    static categorizeError(error) {
        if (error.message.includes('WebCrypto')) {
            return 'BROWSER_COMPATIBILITY';
        } else if (error.message.includes('KMS')) {
            return 'KMS_ERROR';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            return 'NETWORK_ERROR';
        } else if (error.message.includes('memory') || error.message.includes('quota')) {
            return 'MEMORY_ERROR';
        }
        return 'UNKNOWN_ERROR';
    }
    
    static async handleCompatibilityError(errorInfo) {
        // Fallback to server-side encryption
        console.warn('Browser compatibility issue, falling back to server-side encryption');
        return { strategy: 'server-side-fallback', errorInfo };
    }
    
    static async handleNetworkError(errorInfo) {
        // Retry with exponential backoff
        console.warn('Network error during encryption, will retry');
        return { strategy: 'retry-with-backoff', errorInfo };
    }
    
    static async handleKMSError(errorInfo) {
        // Check KMS service status and retry
        console.error('KMS error during encryption');
        return { strategy: 'kms-retry', errorInfo };
    }
    
    static async handleMemoryError(errorInfo) {
        // Reduce chunk size and retry
        console.warn('Memory error, reducing chunk size');
        return { strategy: 'reduce-chunk-size', errorInfo };
    }
}
```

---

## Testing Patterns

### **Pattern 10: Browser Encryption Testing**

**Problem**: Testing encryption across different browsers and conditions  
**Solution**: Comprehensive test matrix

```javascript
// Browser encryption testing
describe('Browser Encryption SDK', () => {
    let encryptionManager;
    
    beforeEach(async () => {
        encryptionManager = new ClientEncryptionManager(TEST_KMS_KEY_ID, 'us-west-2');
    });
    
    test('encrypt and decrypt small data', async () => {
        const plaintext = new TextEncoder().encode('test data');
        const encrypted = await encryptionManager.encryptData(plaintext);
        const { plaintext: decrypted } = await encryptionManager.decryptData(encrypted);
        
        expect(new TextDecoder().decode(decrypted)).toBe('test data');
    });
    
    test('handle large file encryption', async () => {
        const largeData = new Uint8Array(10 * 1024 * 1024); // 10MB
        largeData.fill(42);
        
        const encrypted = await encryptionManager.encryptData(largeData);
        const { plaintext: decrypted } = await encryptionManager.decryptData(encrypted);
        
        expect(decrypted).toEqual(largeData);
    });
    
    test('encryption context validation', async () => {
        const plaintext = new TextEncoder().encode('test data');
        const context = { 'user-id': 'test-user', 'action': 'upload' };
        
        const encrypted = await encryptionManager.encryptData(plaintext, context);
        const { plaintext: decrypted, encryptionContext } = await encryptionManager.decryptData(encrypted);
        
        expect(encryptionContext).toEqual(context);
    });
    
    test('browser compatibility detection', async () => {
        const capabilities = await BrowserCryptoDetector.checkCapabilities();
        expect(capabilities).toHaveProperty('webCrypto');
        expect(capabilities).toHaveProperty('indexedDB');
        expect(capabilities).toHaveProperty('aesGcm');
    });
});
```

---

## Integration Checklist for CCC Project

### **Phase 1 Implementation (Local Development):**
- [ ] Set up selective AWS Encryption SDK imports
- [ ] Implement basic encrypt/decrypt with local KMS key
- [ ] Add browser capability detection
- [ ] Create simple file encryption flow

### **Phase 2 Enhancements (Performance):**
- [ ] Add data key caching for performance
- [ ] Implement chunked file processing
- [ ] Add progress feedback for large files
- [ ] Optimize bundle size with tree-shaking

### **Phase 3 Production (Robustness):**
- [ ] Add Web Worker encryption for large files
- [ ] Implement comprehensive error handling
- [ ] Add encryption context validation
- [ ] Create browser compatibility matrix

### **Key Files to Create:**
1. `src/encryption/client-encryption-manager.js` - Main encryption interface
2. `src/encryption/browser-crypto-detector.js` - Capability detection
3. `src/encryption/chunked-encryption.js` - Large file handling
4. `src/workers/encryption-worker.js` - Background processing
5. `tests/encryption/browser-encryption.test.js` - Comprehensive testing

---

## Performance Benchmarks

### **Expected Performance (Development Targets):**
- **Small files** (< 1MB): < 500ms encryption time
- **Medium files** (1-10MB): < 5s encryption time  
- **Large files** (10-100MB): < 30s with progress feedback
- **Bundle size**: < 600KB gzipped
- **Memory usage**: < 100MB peak for any file size

### **Browser Compatibility Matrix:**
- **Chrome 80+**: Full support (AWS SDK + caching)
- **Firefox 75+**: Full support (AWS SDK + caching)
- **Safari 13+**: Limited support (basic WebCrypto)
- **Edge 80+**: Full support (AWS SDK + caching)
- **Mobile browsers**: Basic support (server-side fallback)

---

## References

**AWS Documentation:**
- [AWS Encryption SDK for JavaScript](https://docs.aws.amazon.com/encryption-sdk/latest/developer-guide/javascript.html)
- [Busy Engineer's Guide to Encryption Workshop](https://aws.amazon.com/workshops/)
- [AWS Encryption SDK Browser Implementation](https://github.com/aws/aws-encryption-sdk-javascript)

**Performance Resources:**
- [Web Performance Best Practices](https://web.dev/performance/)
- [WebCrypto API Specification](https://www.w3.org/TR/WebCryptoAPI/)
- [Bundle Size Optimization Techniques](https://webpack.js.org/guides/tree-shaking/)

/**
 * Mock encryption functions for Phase 2 development
 * Provides API-compatible crypto functions without real encryption
 */

class MockCrypto {
    constructor() {
        this.initialized = false;
        this.keyId = 'mock-key-' + Date.now();
        this.algorithm = 'MOCK-AES-256-GCM';
    }

    async initialize() {
        if (this.initialized) return;

        // Simulate initialization delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        this.initialized = true;
        
        if (window.cryptoLogger) {
            cryptoLogger.info('Mock crypto provider initialized', {
                algorithm: this.algorithm,
                keyId: this.keyId,
                provider: 'MOCK_PROVIDER',
                version: '1.0.0'
            });
        }
    }

    async encrypt(data, encryptionContext = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        // Validate input
        if (!data) {
            throw new Error('No data provided for encryption');
        }

        const startTime = performance.now();

        // Log encryption start
        if (window.cryptoLogger) {
            cryptoLogger.info('Starting mock encryption', {
                dataSize: data.size || data.length,
                encryptionContext: encryptionContext,
                algorithm: this.algorithm
            });
        }

        // Simulate encryption delay based on data size
        const dataSize = data.size || data.length;
        const delay = Math.min(50 + (dataSize / 1024 / 1024) * 10, 200); // 50ms base + 10ms per MB, max 200ms
        await new Promise(resolve => setTimeout(resolve, delay));

        // Generate non-reversible mock ciphertext
        const mockCiphertext = this.generateMockCiphertext(dataSize);
        
        const encryptionResult = {
            ciphertext: mockCiphertext,
            algorithm: this.algorithm,
            keyId: this.keyId,
            encryptionContext: { ...encryptionContext },
            timestamp: new Date().toISOString(),
            originalSize: dataSize,
            encryptedSize: mockCiphertext.length
        };

        const endTime = performance.now();
        const processingTime = (endTime - startTime).toFixed(2);

        // Log successful encryption
        if (window.cryptoLogger) {
            cryptoLogger.success('Mock encryption completed', {
                processingTime: `${processingTime}ms`,
                originalSize: dataSize,
                encryptedSize: mockCiphertext.length,
                compression: `${((1 - mockCiphertext.length / dataSize) * 100).toFixed(1)}%`,
                keyId: this.keyId.substring(0, 16) + '...'
            });
        }

        return encryptionResult;
    }

    async decrypt(encryptedData) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!encryptedData || !encryptedData.ciphertext) {
            throw new Error('Invalid encrypted data provided');
        }

        const startTime = performance.now();

        // Log decryption start
        if (window.cryptoLogger) {
            cryptoLogger.info('Starting mock decryption', {
                keyId: encryptedData.keyId?.substring(0, 16) + '...',
                algorithm: encryptedData.algorithm,
                dataSize: encryptedData.encryptedSize
            });
        }

        // Simulate decryption delay
        await new Promise(resolve => setTimeout(resolve, 30));

        // Verify key ID matches (mock security check)
        if (encryptedData.keyId !== this.keyId) {
            const error = 'Key ID mismatch - decryption failed';
            if (window.cryptoLogger) {
                cryptoLogger.error(error, {
                    expectedKeyId: this.keyId.substring(0, 16) + '...',
                    receivedKeyId: encryptedData.keyId?.substring(0, 16) + '...'
                });
            }
            throw new Error(error);
        }

        const endTime = performance.now();
        const processingTime = (endTime - startTime).toFixed(2);

        // Mock decrypted data (we can't actually decrypt mock data)
        const decryptionResult = {
            success: true,
            originalSize: encryptedData.originalSize,
            decryptedAt: new Date().toISOString(),
            processingTime: processingTime
        };

        // Log successful decryption
        if (window.cryptoLogger) {
            cryptoLogger.success('Mock decryption completed', {
                processingTime: `${processingTime}ms`,
                originalSize: encryptedData.originalSize,
                keyVerified: true
            });
        }

        return decryptionResult;
    }

    generateMockCiphertext(originalSize) {
        // Create realistic-looking mock ciphertext
        // - Non-reversible (doesn't contain original data)
        // - Reasonable size (slightly larger than original)
        // - Random-looking but deterministic for same input size

        const baseSize = Math.floor(originalSize * 1.1) + 64; // 10% overhead + header
        
        // Generate mock ciphertext in chunks to avoid crypto.getRandomValues() 65KB limit
        const chunkSize = 32768; // 32KB chunks (well under 65KB limit)
        let mockData = '';
        
        for (let i = 0; i < baseSize; i += chunkSize) {
            const remainingBytes = Math.min(chunkSize, baseSize - i);
            const chunk = new Uint8Array(remainingBytes);
            
            // Fill with pseudo-random data using a simple algorithm
            // This is just for mock purposes, doesn't need to be cryptographically secure
            for (let j = 0; j < remainingBytes; j++) {
                // Simple pseudo-random generator based on position
                const seed = (i + j + originalSize + Date.now()) % 1000000;
                chunk[j] = (seed * 7919 + 23) % 256; // Prime number multiplication for distribution
            }
            
            // Convert chunk to binary string
            let chunkBinary = '';
            chunk.forEach(byte => chunkBinary += String.fromCharCode(byte));
            mockData += chunkBinary;
        }
        
        // Convert to base64 for transport
        return btoa(mockData);
    }

    // Utility methods for Phase 2
    isAvailable() {
        return true; // Mock crypto is always available
    }

    async getKeyInfo() {
        return {
            keyId: this.keyId,
            algorithm: this.algorithm,
            provider: 'MOCK_PROVIDER',
            status: 'active',
            created: new Date().toISOString()
        };
    }

    async validateEncryptionContext(context) {
        // Mock validation - always passes but logs the attempt
        if (window.cryptoLogger) {
            cryptoLogger.info('Encryption context validated', {
                context: context,
                valid: true
            });
        }
        return true;
    }
}

// Global mock crypto instance
window.mockCrypto = new MockCrypto();

// Export for module usage
export default MockCrypto;

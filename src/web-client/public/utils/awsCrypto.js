/**
 * AWS Encryption SDK integration for Phase 2
 * Uses selective imports to minimize bundle size
 */

// Selective imports to minimize bundle (per Phase 2 plan)
import { encrypt, decrypt } from '@aws-crypto/encrypt-browser';
import { RawAesKeyringBrowser } from '@aws-crypto/raw-aes-keyring-browser';

class AWSCrypto {
    constructor() {
        this.initialized = false;
        this.keyring = null;
        this.keyName = 'ccc-demo-key';
        this.keyNamespace = 'ccc-reference-architecture';
        this.algorithm = 'AES-256-GCM';
        this.environment = 'development';
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Generate 256-bit key for Raw AES keyring (browser-safe, no AWS auth required)
            const keyBytes = new Uint8Array(32);
            crypto.getRandomValues(keyBytes);

            this.keyring = new RawAesKeyringBrowser({
                keyName: this.keyName,
                keyNamespace: this.keyNamespace,
                unencryptedMasterKey: keyBytes
            });

            this.initialized = true;

            if (window.cryptoLogger) {
                cryptoLogger.info('AWS Encryption SDK initialized', {
                    keyringType: 'RawAesKeyringBrowser',
                    keyNamespace: this.keyNamespace,
                    environment: this.environment,
                    version: '3.2.2'
                });
            }

        } catch (error) {
            if (window.cryptoLogger) {
                cryptoLogger.error('AWS Encryption SDK initialization failed', {
                    error: error.message,
                    keyringType: 'RawAesKeyringBrowser'
                });
            }
            throw error;
        }
    }

    // PE Recommendation: Chunked base64 conversion to avoid stack overflow on large files
    arrayToBase64Chunked(uint8Array) {
        const chunkSize = 8192; // 8KB chunks to stay well under call stack limits
        let binaryString = '';
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.slice(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        return btoa(binaryString);
    }

    // PE Recommendation: Chunked base64 to array conversion for decryption
    base64ToArrayChunked(base64String) {
        const binaryString = atob(base64String);
        const chunkSize = 8192;
        const uint8Array = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i += chunkSize) {
            const endIndex = Math.min(i + chunkSize, binaryString.length);
            for (let j = i; j < endIndex; j++) {
                uint8Array[j] = binaryString.charCodeAt(j);
            }
        }
        
        return uint8Array;
    }

    // PE Recommendation: Encryption context allowlist to prevent PII and logging issues
    static ALLOWED_CONTEXT_KEYS = [
        'purpose',
        'content_type', 
        'upload_timestamp',
        'environment',
        'version',
        'file_size',
        'file_type',
        'app',
        'demo_mode',
        'upload_id'
    ];

    validateEncryptionContext(context) {
        const validatedContext = {};
        
        for (const [key, value] of Object.entries(context)) {
            // Only allow pre-approved context keys
            if (AWSCrypto.ALLOWED_CONTEXT_KEYS.includes(key)) {
                // Ensure values are strings and don't contain PII patterns
                const stringValue = String(value);
                if (this.containsPII(stringValue)) {
                    if (window.cryptoLogger) {
                        cryptoLogger.warn('PII detected in encryption context - value sanitized', {
                            key: key,
                            valueSample: stringValue.substring(0, 10) + '...'
                        });
                    }
                    // Skip PII values rather than encrypt them in context
                    continue;
                }
                validatedContext[key] = stringValue;
            } else {
                if (window.cryptoLogger) {
                    cryptoLogger.warn('Unauthorized encryption context key blocked', {
                        key: key,
                        allowedKeys: AWSCrypto.ALLOWED_CONTEXT_KEYS
                    });
                }
            }
        }
        
        return validatedContext;
    }

    containsPII(value) {
        const piiPatterns = [
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
            /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
            /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card pattern
            /\b[A-Za-z]+\s+[A-Za-z]+\b/ // Name patterns (firstname lastname)
        ];
        
        return piiPatterns.some(pattern => pattern.test(value));
    }

    async encrypt(data, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        // Validate WebCrypto availability (fail-closed)
        if (!window.crypto || !window.crypto.subtle) {
            const error = 'WebCrypto API not available - encryption blocked';
            if (window.cryptoLogger) {
                cryptoLogger.error(error, {
                    webCrypto: !!window.crypto,
                    subtle: !!window.crypto?.subtle
                });
            }
            throw new Error(error);
        }

        const startTime = performance.now();

        // Prepare base encryption context (no PII)
        const rawContext = {
            file_size: String(data.size || data.length),
            file_type: options.fileType || 'application/octet-stream',
            upload_timestamp: new Date().toISOString(),
            app: 'ccc-reference',
            version: 'phase2',
            demo_mode: 'local_only',
            purpose: options.purpose || 'ml-processing',
            ...options.encryptionContext
        };

        // PE Recommendation: Validate encryption context with allowlist
        const encryptionContext = this.validateEncryptionContext(rawContext);

        if (window.cryptoLogger) {
            cryptoLogger.info('Starting AWS encryption', {
                dataSize: data.size || data.length,
                encryptionContextKeys: Object.keys(encryptionContext),
                keyringType: 'RawAesKeyringBrowser'
            });
        }

        try {
            // Convert input to Uint8Array if needed
            let dataBytes;
            if (data instanceof Uint8Array) {
                dataBytes = data;
            } else if (data instanceof File || data instanceof Blob) {
                dataBytes = new Uint8Array(await data.arrayBuffer());
            } else if (typeof data === 'string') {
                dataBytes = new TextEncoder().encode(data);
            } else {
                throw new Error('Unsupported data type for encryption');
            }

            // Perform encryption
            const { result } = await encrypt(this.keyring, dataBytes, { encryptionContext });

            const endTime = performance.now();
            const processingTime = (endTime - startTime).toFixed(2);

            // PE Recommendation: Fix base64 chunking for large files (avoid stack overflow)
            const ciphertext = this.arrayToBase64Chunked(result);

            const encryptionResult = {
                ciphertext: ciphertext,
                algorithm: this.algorithm,
                keyId: this.keyName,
                encryptionContext: encryptionContext,
                timestamp: new Date().toISOString(),
                originalSize: dataBytes.length,
                encryptedSize: ciphertext.length,
                processingTime: processingTime
            };

            if (window.cryptoLogger) {
                cryptoLogger.success('AWS encryption completed', {
                    processingTime: `${processingTime}ms`,
                    originalSize: dataBytes.length,
                    encryptedSize: ciphertext.length,
                    keyIdPrefix: this.keyName.substring(0, 8) + '...',
                    encryptionContextKeys: Object.keys(encryptionContext)
                });
            }

            return encryptionResult;

        } catch (error) {
            const endTime = performance.now();
            const processingTime = (endTime - startTime).toFixed(2);

            if (window.cryptoLogger) {
                cryptoLogger.error('AWS encryption failed', {
                    error: error.message,
                    processingTime: `${processingTime}ms`,
                    dataSize: data.size || data.length
                });
            }
            throw error;
        }
    }

    async decrypt(encryptedData) {
        if (!this.initialized) {
            await this.initialize();
        }

        // Validate WebCrypto availability (fail-closed)
        if (!window.crypto || !window.crypto.subtle) {
            const error = 'WebCrypto API not available - decryption blocked';
            if (window.cryptoLogger) {
                cryptoLogger.error(error);
            }
            throw new Error(error);
        }

        const startTime = performance.now();

        try {
            // Convert base64 back to Uint8Array
            const ciphertextBytes = new Uint8Array(
                atob(encryptedData.ciphertext)
                    .split('')
                    .map(char => char.charCodeAt(0))
            );

            if (window.cryptoLogger) {
                cryptoLogger.info('Starting AWS decryption', {
                    keyIdPrefix: encryptedData.keyId?.substring(0, 8) + '...',
                    algorithm: encryptedData.algorithm,
                    dataSize: encryptedData.encryptedSize
                });
            }

            // Perform decryption
            const { plaintext } = await decrypt(this.keyring, ciphertextBytes);

            const endTime = performance.now();
            const processingTime = (endTime - startTime).toFixed(2);

            const decryptionResult = {
                success: true,
                data: plaintext,
                originalSize: encryptedData.originalSize,
                decryptedAt: new Date().toISOString(),
                processingTime: processingTime
            };

            if (window.cryptoLogger) {
                cryptoLogger.success('AWS decryption completed', {
                    processingTime: `${processingTime}ms`,
                    originalSize: encryptedData.originalSize,
                    algorithm: encryptedData.algorithm
                });
            }

            return decryptionResult;

        } catch (error) {
            const endTime = performance.now();
            const processingTime = (endTime - startTime).toFixed(2);

            if (window.cryptoLogger) {
                cryptoLogger.error('AWS decryption failed', {
                    error: error.message,
                    processingTime: `${processingTime}ms`,
                    encryptedSize: encryptedData.encryptedSize
                });
            }
            throw error;
        }
    }

    // Utility methods
    isAvailable() {
        return !!(window.crypto && window.crypto.subtle);
    }

    async getKeyInfo() {
        return {
            keyId: this.keyName,
            algorithm: this.algorithm,
            keyNamespace: this.keyNamespace,
            provider: 'AWS_ENCRYPTION_SDK',
            status: this.initialized ? 'active' : 'uninitialized',
            webCryptoAvailable: this.isAvailable()
        };
    }

    async validateEncryptionContext(context) {
        // Validate encryption context for PII leakage
        const piiFields = ['filename', 'name', 'username', 'email', 'ip', 'path'];
        const contextKeys = Object.keys(context).map(k => k.toLowerCase());
        
        const piiFound = piiFields.some(field => 
            contextKeys.some(key => key.includes(field))
        );

        if (piiFound) {
            const error = 'PII detected in encryption context';
            if (window.cryptoLogger) {
                cryptoLogger.error(error, {
                    contextKeys: Object.keys(context),
                    piiCheck: 'failed'
                });
            }
            throw new Error(error);
        }

        if (window.cryptoLogger) {
            cryptoLogger.info('Encryption context validated', {
                contextKeys: Object.keys(context),
                piiCheck: 'passed'
            });
        }

        return true;
    }
}

// Global AWS crypto instance
window.awsCrypto = new AWSCrypto();

// Export for module usage
export default AWSCrypto;

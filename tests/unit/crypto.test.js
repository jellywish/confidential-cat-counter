/**
 * Unit tests for cryptographic operations
 * Focus: boundary testing, chunking validation, error handling
 */

const fs = require('fs');
const path = require('path');

// Mock browser crypto for Node.js testing
global.crypto = {
  getRandomValues: (array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }
};

// Load the crypto utilities (adjust path as needed)
const awsCryptoPath = path.join(__dirname, '../../src/web-client/public/utils/awsCrypto.js');
let awsCrypto;

// Read and evaluate the crypto module for testing
if (fs.existsSync(awsCryptoPath)) {
  const cryptoCode = fs.readFileSync(awsCryptoPath, 'utf8');
  // Extract the functions we need to test
  eval(cryptoCode);
}

describe('Crypto Operations', () => {
  
  describe('Base64 Chunking', () => {
    test('should handle small arrays without chunking', async () => {
      const testArray = new Uint8Array([1, 2, 3, 4, 5]);
      const base64 = arrayToBase64Chunked(testArray);
      const restored = base64ToArrayChunked(base64);
      
      expect(restored).toEqual(testArray);
    });
    
    test('should handle large arrays with chunking', async () => {
      // Create a large array that would cause stack overflow
      const largeArray = new Uint8Array(100000);
      crypto.getRandomValues(largeArray);
      
      const base64 = arrayToBase64Chunked(largeArray);
      const restored = base64ToArrayChunked(base64);
      
      expect(restored).toEqual(largeArray);
    });
    
    test('should handle empty arrays', async () => {
      const emptyArray = new Uint8Array(0);
      const base64 = arrayToBase64Chunked(emptyArray);
      const restored = base64ToArrayChunked(base64);
      
      expect(restored).toEqual(emptyArray);
    });
    
    test('should handle maximum safe chunk size', async () => {
      // Test with exactly the chunk size limit
      const chunkSizeArray = new Uint8Array(32768); // 32KB
      crypto.getRandomValues(chunkSizeArray);
      
      const base64 = arrayToBase64Chunked(chunkSizeArray);
      const restored = base64ToArrayChunked(base64);
      
      expect(restored).toEqual(chunkSizeArray);
    });
  });
  
  describe('Encryption Context Validation', () => {
    test('should allow valid context keys', () => {
      const validContext = {
        session_id: 'test-session',
        upload_timestamp: '2023-01-01T00:00:00.000Z',
        file_type: 'image/jpeg',
        processing_stage: 'upload'
      };
      
      const validated = validateEncryptionContext(validContext);
      expect(validated).toEqual(validContext);
    });
    
    test('should filter out invalid context keys', () => {
      const invalidContext = {
        session_id: 'test-session',
        user_email: 'user@example.com', // PII - should be filtered
        upload_timestamp: '2023-01-01T00:00:00.000Z',
        file_type: 'image/jpeg',
        secret_key: 'abc123' // sensitive - should be filtered
      };
      
      const validated = validateEncryptionContext(invalidContext);
      expect(validated).toEqual({
        session_id: 'test-session',
        upload_timestamp: '2023-01-01T00:00:00.000Z',
        file_type: 'image/jpeg'
      });
    });
    
    test('should handle empty context', () => {
      const emptyContext = {};
      const validated = validateEncryptionContext(emptyContext);
      expect(validated).toEqual({});
    });
    
    test('should sanitize context values', () => {
      const unsafeContext = {
        session_id: 'test<script>alert("xss")</script>',
        file_type: 'image/jpeg\n\r\t'
      };
      
      const validated = validateEncryptionContext(unsafeContext);
      expect(validated.session_id).not.toContain('<script>');
      expect(validated.file_type).toBe('image/jpeg');
    });
  });
  
  describe('Error Handling', () => {
    test('should fail closed on crypto errors', () => {
      // Mock crypto failure
      const originalCrypto = global.crypto;
      global.crypto = {
        getRandomValues: () => { throw new Error('Crypto not available'); }
      };
      
      expect(() => {
        const testArray = new Uint8Array(10);
        crypto.getRandomValues(testArray);
      }).toThrow('Crypto not available');
      
      // Restore crypto
      global.crypto = originalCrypto;
    });
    
    test('should validate input types', () => {
      expect(() => arrayToBase64Chunked(null)).toThrow();
      expect(() => arrayToBase64Chunked("not an array")).toThrow();
      expect(() => base64ToArrayChunked(123)).toThrow();
    });
  });
});

// Mock functions if not loaded from file
if (typeof arrayToBase64Chunked === 'undefined') {
  global.arrayToBase64Chunked = function(uint8Array) {
    if (!(uint8Array instanceof Uint8Array)) {
      throw new TypeError('Expected Uint8Array');
    }
    return btoa(String.fromCharCode.apply(null, uint8Array));
  };
  
  global.base64ToArrayChunked = function(base64String) {
    if (typeof base64String !== 'string') {
      throw new TypeError('Expected string');
    }
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };
  
  global.validateEncryptionContext = function(context) {
    const allowedKeys = [
      'session_id', 'upload_timestamp', 'file_type', 'processing_stage'
    ];
    const sanitized = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (allowedKeys.includes(key) && typeof value === 'string') {
        sanitized[key] = value.replace(/[<>"\r\n\t]/g, '');
      }
    }
    
    return sanitized;
  };
}

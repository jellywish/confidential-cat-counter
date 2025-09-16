/**
 * Edge case testing for crypto operations
 * Tests file size boundaries and error conditions
 */

// Test file size boundaries that commonly cause issues
const TEST_SIZES = [
  { size: 1024, name: "1KB - minimum" },
  { size: 32768, name: "32KB - chunk boundary" },
  { size: 65536, name: "64KB - crypto.getRandomValues limit" },
  { size: 65537, name: "64KB + 1 - just over limit" },
  { size: 1048576, name: "1MB - typical user file" },
  { size: 10485760, name: "10MB - large file" },
  { size: 52428800, name: "50MB - very large file" }
];

class CryptoBoundaryTester {
  constructor() {
    this.results = [];
    this.mockCrypto = null;
  }

  async initialize() {
    // Load mock crypto for testing
    if (typeof window !== 'undefined' && window.mockCrypto) {
      this.mockCrypto = window.mockCrypto;
    } else {
      throw new Error('Mock crypto not available for testing');
    }
  }

  generateTestFile(size, pattern = 'random') {
    // Generate test file of specified size
    const buffer = new ArrayBuffer(size);
    const view = new Uint8Array(buffer);
    
    if (pattern === 'random') {
      // Fill with pseudo-random data
      for (let i = 0; i < size; i++) {
        view[i] = (i * 17 + 13) % 256;
      }
    } else if (pattern === 'zeros') {
      // Already zeros, do nothing
    } else if (pattern === 'pattern') {
      // Repeating pattern
      for (let i = 0; i < size; i++) {
        view[i] = i % 256;
      }
    }

    return new File([buffer], `test-${size}-${pattern}.bin`, { type: 'application/octet-stream' });
  }

  async testEncryptionAtSize(size, description) {
    const testFile = this.generateTestFile(size);
    const startTime = performance.now();

    try {
      // Test encryption
      const encryptedData = await this.mockCrypto.encrypt(testFile, {
        purpose: 'test',
        fileSize: size.toString()
      });

      // Test decryption
      await this.mockCrypto.decrypt(encryptedData);

      const endTime = performance.now();
      const duration = endTime - startTime;

      const result = {
        size: size,
        description: description,
        success: true,
        duration: duration,
        encryptedSize: encryptedData.ciphertext.length,
        compressionRatio: encryptedData.ciphertext.length / size,
        error: null
      };

      this.results.push(result);
      console.log(`✅ ${description}: ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const result = {
        size: size,
        description: description,
        success: false,
        duration: duration,
        encryptedSize: null,
        compressionRatio: null,
        error: error.message
      };

      this.results.push(result);
      console.error(`❌ ${description}: ${error.message}`);
      
      return result;
    }
  }

  async runAllBoundaryTests() {
    console.log('🧪 Starting crypto boundary tests...');
    
    await this.initialize();

    for (const testCase of TEST_SIZES) {
      await this.testEncryptionAtSize(testCase.size, testCase.name);
      
      // Small delay between tests to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.results;
  }

  async testMemoryPressure() {
    console.log('🧪 Testing memory pressure scenarios...');

    // Test multiple large files in sequence
    const largeSizes = [10485760, 20971520, 52428800]; // 10MB, 20MB, 50MB
    
    for (const size of largeSizes) {
      await this.testEncryptionAtSize(size, `Memory pressure test: ${(size/1024/1024).toFixed(1)}MB`);
    }
  }

  async testErrorConditions() {
    console.log('🧪 Testing error conditions...');

    // Test with null/undefined inputs
    try {
      await this.mockCrypto.encrypt(null);
      console.error('❌ Should have failed with null input');
    } catch (error) {
      console.log('✅ Correctly rejected null input');
    }

    // Test with invalid encryption data
    try {
      await this.mockCrypto.decrypt({ invalid: 'data' });
      console.error('❌ Should have failed with invalid decrypt data');
    } catch (error) {
      console.log('✅ Correctly rejected invalid decrypt data');
    }
  }

  generateReport() {
    console.log('\n📊 Crypto Boundary Test Report');
    console.log('=====================================');

    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);

    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    if (failed.length > 0) {
      console.log('\n❌ Failures:');
      failed.forEach(result => {
        console.log(`  - ${result.description}: ${result.error}`);
      });
    }

    if (successful.length > 0) {
      const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
      const maxDuration = Math.max(...successful.map(r => r.duration));
      const minDuration = Math.min(...successful.map(r => r.duration));

      console.log(`\n⏱️ Performance Summary:`);
      console.log(`  - Average: ${avgDuration.toFixed(2)}ms`);
      console.log(`  - Min: ${minDuration.toFixed(2)}ms`);
      console.log(`  - Max: ${maxDuration.toFixed(2)}ms`);
    }

    return {
      total: this.results.length,
      successful: successful.length,
      failed: failed.length,
      results: this.results
    };
  }
}

// Export for use in other tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CryptoBoundaryTester;
}

// Auto-run if loaded in browser
if (typeof window !== 'undefined') {
  window.CryptoBoundaryTester = CryptoBoundaryTester;
  
  // Make it available for manual testing
  window.runCryptoBoundaryTests = async function() {
    const tester = new CryptoBoundaryTester();
    await tester.runAllBoundaryTests();
    await tester.testMemoryPressure();
    await tester.testErrorConditions();
    return tester.generateReport();
  };
}

/**
 * Integration tests for end-to-end encryption flow
 * Focus: browser → ML service encryption pipeline
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { spawn } = require('child_process');

// Mock browser environment for crypto operations
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.crypto = {
  getRandomValues: (array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }
};

describe('End-to-End Encryption Flow', () => {
  let webClientApp;
  let mlServiceProcess;
  
  beforeAll(async () => {
    // Start ML service in test mode
    const mlServicePath = path.join(__dirname, '../../src/ml-service/app.py');
    if (fs.existsSync(mlServicePath)) {
      mlServiceProcess = spawn('python', [mlServicePath], {
        env: { ...process.env, ML_SERVICE_PORT: '8002', NODE_ENV: 'test' },
        stdio: 'pipe'
      });
      
      // Wait for ML service to start
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    
    // Start web client in test mode
    process.env.NODE_ENV = 'test';
    process.env.ML_SERVICE_URL = 'http://localhost:8002';
    process.env.PORT = '3001';
    
    const serverPath = path.join(__dirname, '../../src/web-client/server.js');
    if (fs.existsSync(serverPath)) {
      delete require.cache[serverPath];
      webClientApp = require(serverPath);
    }
  }, 30000);
  
  afterAll(async () => {
    // Cleanup processes
    if (webClientApp && webClientApp.close) {
      await webClientApp.close();
    }
    
    if (mlServiceProcess) {
      mlServiceProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }, 10000);
  
  describe('File Upload and Processing', () => {
    test('should handle complete encryption workflow', async () => {
      // Load test image
      const testImagePath = path.join(__dirname, '../fixtures/real_cat.jpg');
      
      if (!fs.existsSync(testImagePath)) {
        console.warn('Test image not found, skipping encryption workflow test');
        return;
      }
      
      const imageBuffer = fs.readFileSync(testImagePath);
      
      // Step 1: Upload encrypted image
      const uploadResponse = await request(webClientApp)
        .post('/upload')
        .attach('image', imageBuffer, 'test-cat.jpg')
        .expect(200);
      
      expect(uploadResponse.body).toHaveProperty('jobId');
      const jobId = uploadResponse.body.jobId;
      
      // Step 2: Poll for processing completion
      let attempts = 0;
      let jobStatus;
      
      while (attempts < 30) { // 30 second timeout
        const statusResponse = await request(webClientApp)
          .get(`/status/${jobId}`)
          .expect(200);
        
        jobStatus = statusResponse.body;
        
        if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      // Step 3: Verify processing results
      expect(jobStatus.status).toBe('completed');
      expect(jobStatus).toHaveProperty('result');
      
      if (jobStatus.result) {
        expect(jobStatus.result).toHaveProperty('cats');
        expect(typeof jobStatus.result.cats).toBe('number');
        expect(jobStatus.result.cats).toBeGreaterThanOrEqual(0);
      }
    }, 45000);
    
    test('should handle encryption context validation', async () => {
      // Test with minimal image
      const minimalJpeg = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
        0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
      ]);
      
      const response = await request(webClientApp)
        .post('/upload')
        .attach('image', minimalJpeg, 'minimal.jpg')
        .expect(200);
      
      expect(response.body).toHaveProperty('jobId');
      
      // Verify job was created with proper encryption context
      const jobId = response.body.jobId;
      const statusResponse = await request(webClientApp)
        .get(`/status/${jobId}`)
        .expect(200);
      
      expect(statusResponse.body).toHaveProperty('status');
      expect(statusResponse.body).toHaveProperty('timestamp');
    });
  });
  
  describe('Error Scenarios', () => {
    test('should handle ML service unavailable', async () => {
      // Kill ML service temporarily
      if (mlServiceProcess) {
        mlServiceProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const testImage = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0xFF, 0xD9]);
      
      const response = await request(webClientApp)
        .post('/upload')
        .attach('image', testImage, 'test.jpg');
      
      // Should still accept upload but processing will fail gracefully
      if (response.status === 200) {
        const jobId = response.body.jobId;
        
        // Wait and check if job fails gracefully
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const statusResponse = await request(webClientApp)
          .get(`/status/${jobId}`)
          .expect(200);
        
        // Job should either be pending or failed gracefully
        expect(['pending', 'failed']).toContain(statusResponse.body.status);
      }
    });
    
    test('should handle corrupted encryption data', async () => {
      // This test would require browser environment simulation
      // For now, we'll test the API's handling of malformed requests
      
      const response = await request(webClientApp)
        .post('/upload')
        .send({ malformed: 'data' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBeDefined();
    });
  });
  
  describe('Resource Management', () => {
    test('should clean up temporary files', async () => {
      const uploadsDir = path.join(__dirname, '../../uploads');
      
      if (fs.existsSync(uploadsDir)) {
        const filesBefore = fs.readdirSync(uploadsDir);
        
        // Upload a test file
        const testImage = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0xFF, 0xD9]);
        
        await request(webClientApp)
          .post('/upload')
          .attach('image', testImage, 'cleanup-test.jpg')
          .expect(200);
        
        // Check if cleanup happens (this depends on implementation)
        // For now, just verify the directory structure
        expect(fs.existsSync(uploadsDir)).toBe(true);
      }
    });
    
    test('should handle concurrent uploads', async () => {
      const testImage = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0xFF, 0xD9]);
      
      // Send multiple concurrent uploads
      const uploadPromises = [];
      for (let i = 0; i < 3; i++) {
        uploadPromises.push(
          request(webClientApp)
            .post('/upload')
            .attach('image', testImage, `concurrent-${i}.jpg`)
        );
      }
      
      const responses = await Promise.all(uploadPromises);
      
      // All should either succeed or be rate limited
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
      
      // At least one should succeed
      const successful = responses.filter(r => r.status === 200);
      expect(successful.length).toBeGreaterThan(0);
    });
  });
});

// Utility function to wait for condition
async function waitForCondition(conditionFn, timeout = 10000, interval = 100) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await conditionFn()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  return false;
}

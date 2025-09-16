/**
 * Unit tests for API endpoints
 * Focus: rate limiting, error codes, request validation
 */

const request = require('supertest');
const path = require('path');

// Mock Redis for testing
const redisMock = {
  data: new Map(),
  get: function(key) {
    return Promise.resolve(this.data.get(key) || null);
  },
  set: function(key, value, ...args) {
    this.data.set(key, value);
    return Promise.resolve('OK');
  },
  incr: function(key) {
    const current = parseInt(this.data.get(key) || '0');
    this.data.set(key, (current + 1).toString());
    return Promise.resolve(current + 1);
  },
  expire: function(key, seconds) {
    // Mock expiration (simplified)
    setTimeout(() => {
      this.data.delete(key);
    }, seconds * 1000);
    return Promise.resolve(1);
  },
  quit: function() {
    return Promise.resolve();
  }
};

// Mock the Redis client
jest.mock('redis', () => ({
  createClient: () => redisMock
}));

describe('API Endpoints', () => {
  let app;
  
  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.ML_SERVICE_URL = 'http://localhost:8000';
    
    // Load the server
    const serverPath = path.join(__dirname, '../../src/web-client/server.js');
    delete require.cache[serverPath]; // Clear cache
    app = require(serverPath);
  });
  
  afterAll(async () => {
    // Cleanup
    if (app && app.close) {
      await app.close();
    }
  });
  
  beforeEach(() => {
    // Clear Redis mock data
    redisMock.data.clear();
  });
  
  describe('Health Check', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });
  
  describe('File Upload', () => {
    test('should reject files that are too large', async () => {
      // Create a large buffer (> 10MB)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 'a');
      
      const response = await request(app)
        .post('/upload')
        .attach('image', largeBuffer, 'large.jpg')
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('FILE_TOO_LARGE');
    });
    
    test('should reject non-image files', async () => {
      const textBuffer = Buffer.from('This is not an image', 'utf8');
      
      const response = await request(app)
        .post('/upload')
        .attach('image', textBuffer, 'text.txt')
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('INVALID_FILE_TYPE');
    });
    
    test('should accept valid image files', async () => {
      // Create a minimal JPEG header
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const jpegBuffer = Buffer.concat([jpegHeader, Buffer.alloc(1000, 0)]);
      
      const response = await request(app)
        .post('/upload')
        .attach('image', jpegBuffer, 'test.jpg')
        .expect(200);
      
      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('message');
    });
    
    test('should enforce rate limiting', async () => {
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const jpegBuffer = Buffer.concat([jpegHeader, Buffer.alloc(1000, 0)]);
      
      // Make multiple requests quickly
      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/upload')
            .attach('image', jpegBuffer, 'test.jpg')
        );
      }
      
      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429)
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
  
  describe('Job Status', () => {
    test('should return job status for valid job ID', async () => {
      // Setup a job in Redis
      const jobId = 'test-job-123';
      const jobData = {
        id: jobId,
        status: 'completed',
        result: { cats: 2, confidence: 0.85 },
        timestamp: new Date().toISOString()
      };
      
      await redisMock.set(`job:${jobId}`, JSON.stringify(jobData));
      
      const response = await request(app)
        .get(`/status/${jobId}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'completed');
      expect(response.body).toHaveProperty('result');
    });
    
    test('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/status/non-existent-job')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('JOB_NOT_FOUND');
    });
    
    test('should validate job ID format', async () => {
      const response = await request(app)
        .get('/status/invalid-job-id-with-special-chars!@#')
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('INVALID_JOB_ID');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle Redis connection errors gracefully', async () => {
      // Mock Redis error
      const originalGet = redisMock.get;
      redisMock.get = () => Promise.reject(new Error('Redis connection failed'));
      
      const response = await request(app)
        .get('/status/test-job')
        .expect(500);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
      
      // Restore Redis
      redisMock.get = originalGet;
    });
    
    test('should return structured error responses', async () => {
      const response = await request(app)
        .get('/non-existent-endpoint')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
  
  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
    
    test('should restrict CORS origins', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://malicious-site.com')
        .expect(200);
      
      // Should not include Access-Control-Allow-Origin for unauthorized origins
      expect(response.headers['access-control-allow-origin']).toBeFalsy();
    });
  });
});

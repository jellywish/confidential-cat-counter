/*
 * Copyright 2025 Spencer (Confidential Cat Counter Contributors)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const express = require('express');
const multer = require('multer');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { validateImageFile, createValidationErrorResponse } = require('./utils/uploadValidator');

const app = express();
const PORT = process.env.PORT || 3000;

// Service configuration
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const WEB_CLIENT_URL = process.env.WEB_CLIENT_URL || `http://localhost:${PORT}`;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [WEB_CLIENT_URL, 'http://localhost:3000'];

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", ML_SERVICE_URL], // Allow ML service connection
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// PE Recommendation: Rate limiting for abuse prevention
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Generous limit: 100 uploads per 15 minutes per IP
  message: {
    error: 'Too many upload attempts',
    message: 'Please wait before uploading more images. Limit: 100 uploads per 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for upload', { 
      ip: req.ip, 
      userAgent: req.get('User-Agent'),
      path: req.path 
    });
    res.status(429).json({
      error: 'Too many upload attempts',
      message: 'Please wait before uploading more images. Limit: 100 uploads per 15 minutes.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    });
  }
});

// Redis client setup
const redis_client = redis.createClient({ 
  url: process.env.REDIS_URL || 'redis://localhost:6379' 
});

redis_client.on('error', (err) => {
  logger.redis('error', err);
});

redis_client.on('connect', () => {
  logger.redis('connected');
});

// Connect to Redis
redis_client.connect().catch(err => logger.error('Failed to connect to Redis', { error: err.message }));

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Basic image type validation
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'web-client',
    timestamp: new Date().toISOString(),
    redis_connected: redis_client.isReady
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload endpoint with rate limiting
app.post('/upload', uploadLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // PE Recommendation: Magic-byte validation for upload security
    const validationResult = await validateImageFile(
      req.file.path, 
      req.file.mimetype
    );

    if (!validationResult.isValid) {
      // Clean up invalid file
      const fs = require('fs').promises;
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        logger.warn('Failed to cleanup invalid file', { path: req.file.path, error: unlinkError.message });
      }

      const errorResponse = createValidationErrorResponse(validationResult, logger);
      return res.status(errorResponse.status).json(errorResponse.response);
    }

    // Log security flags if any (but allow valid files with warnings)
    if (validationResult.securityFlags.length > 0) {
      logger.info('Upload security flags detected but file valid', {
        detectedType: validationResult.detectedType,
        claimedType: validationResult.claimedType,
        securityFlags: validationResult.securityFlags
      });
    }

    const jobId = uuidv4();
    const jobData = {
      id: jobId,
      // Stored filename on disk for worker to read from shared volume
      filename: req.file.filename,
      // Friendly name for UI display only
      displayName: req.file.originalname || req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      detectedType: validationResult.detectedType, // Add detected type for audit
      status: 'queued',
      timestamp: new Date().toISOString()
    };

    // Queue job for processing
    await redis_client.lPush('ml-jobs', JSON.stringify(jobData));
    
    // Store job status
    await redis_client.setEx(`job:${jobId}`, 3600, JSON.stringify(jobData));
    
    logger.job('queued', jobId, { filename: req.file.originalname, size: req.file.size });
    
    res.json({ 
      jobId, 
      status: 'queued',
      message: 'Image uploaded successfully'
    });

  } catch (error) {
    logger.error('Upload failed', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      error: 'Upload failed',
      message: error.message 
    });
  }
});

// Results endpoint
app.get('/results/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobData = await redis_client.get(`job:${jobId}`);
    
    if (!jobData) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const job = JSON.parse(jobData);
    res.json(job);

  } catch (error) {
    logger.error('Results retrieval failed', { jobId: req.params.jobId, error: error.message });
    res.status(500).json({ 
      error: 'Failed to retrieve results',
      message: error.message 
    });
  }
});

// Queue status endpoint (for debugging)
app.get('/queue/status', async (req, res) => {
  try {
    const queueLength = await redis_client.lLen('ml-jobs');
    const completedJobs = await redis_client.keys('job:*');
    
    res.json({
      queue_length: queueLength,
      total_jobs: completedJobs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Queue status check failed', { error: error.message });
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  // Handle multer errors
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large', 
        message: 'Please select an image smaller than 10MB',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        error: 'Invalid file', 
        message: 'Please select a valid image file',
        code: 'INVALID_FILE_TYPE'
      });
    }
  }
  
  // Handle Redis connection errors
  if (error.message && error.message.includes('Redis')) {
    logger.error('Redis connection error', { error: error.message });
    return res.status(503).json({ 
      error: 'Service temporarily unavailable', 
      message: 'Please try again in a moment',
      code: 'SERVICE_UNAVAILABLE'
    });
  }
  
  logger.error('Unexpected server error', { error: error.message, stack: error.stack });
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'An unexpected error occurred. Please try again.',
    code: 'INTERNAL_ERROR'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.shutdown('Received SIGTERM, shutting down gracefully');
  await redis_client.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.shutdown('Received SIGINT, shutting down gracefully');
  await redis_client.quit();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.startup('Web client running', PORT);
});

module.exports = app;

# Integration Patterns and Examples

This guide demonstrates how to integrate the Confidential Cat Counter architecture patterns into your own applications.

## Overview

The Confidential Cat Counter demonstrates several reusable patterns for privacy-preserving machine learning:

1. **Client-Side Encryption Pattern**
2. **Queue-Based ML Processing Pattern** 
3. **Secure File Upload Pattern**
4. **Fail-Closed Security Pattern**
5. **Multi-Model Inference Pattern**

## Client-Side Encryption Pattern

### Basic Implementation

```javascript
// crypto-client.js - Reusable encryption client
class PrivacyPreservingClient {
  constructor(options = {}) {
    this.keyring = options.keyring || this.createKeyring();
    this.allowedContextKeys = options.allowedContextKeys || [
      'session_id', 'timestamp', 'data_type', 'processing_stage'
    ];
  }

  createKeyring() {
    // Use AWS Encryption SDK RawAesKeyringBrowser
    const keyringBrowser = require('@aws-crypto/client-browser');
    const keyNamespace = 'my-app';
    const keyName = 'data-key';
    
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    
    return new keyringBrowser.RawAesKeyringBrowser({
      keyNamespace,
      keyName,
      wrappingKey: keyBytes,
      unwrapDataKey: false
    });
  }

  validateEncryptionContext(context) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (this.allowedContextKeys.includes(key) && typeof value === 'string') {
        // Sanitize the value
        sanitized[key] = value.replace(/[<>"\r\n\t]/g, '');
      }
    }
    
    return sanitized;
  }

  async encryptData(data, context = {}) {
    try {
      // Validate context
      const validContext = this.validateEncryptionContext(context);
      
      // Add default context
      validContext.timestamp = new Date().toISOString();
      validContext.session_id = validContext.session_id || this.generateSessionId();
      
      // Convert data to Uint8Array if needed
      const dataBytes = data instanceof Uint8Array 
        ? data 
        : new TextEncoder().encode(JSON.stringify(data));
      
      // Encrypt using AWS Encryption SDK
      const { encrypt } = require('@aws-crypto/client-browser');
      const { result } = await encrypt(this.keyring, dataBytes, {
        encryptionContext: validContext
      });
      
      return this.arrayToBase64Chunked(result);
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  async decryptData(encryptedData, expectedContext = {}) {
    try {
      const dataBytes = this.base64ToArrayChunked(encryptedData);
      
      const { decrypt } = require('@aws-crypto/client-browser');
      const { plaintext, messageHeader } = await decrypt(this.keyring, dataBytes);
      
      // Verify encryption context
      const context = messageHeader.encryptionContext;
      for (const [key, expectedValue] of Object.entries(expectedContext)) {
        if (context[key] !== expectedValue) {
          throw new Error(`Context mismatch for ${key}`);
        }
      }
      
      return plaintext;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Base64 chunking to handle large data without stack overflow
  arrayToBase64Chunked(uint8Array, chunkSize = 32768) {
    const chunks = [];
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      chunks.push(btoa(String.fromCharCode.apply(null, chunk)));
    }
    return chunks.join('');
  }

  base64ToArrayChunked(base64String, chunkSize = 32768) {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, binaryString.length);
      for (let j = i; j < end; j++) {
        bytes[j] = binaryString.charCodeAt(j);
      }
    }
    
    return bytes;
  }
}

// Usage example
const client = new PrivacyPreservingClient();

// Encrypt sensitive data
const sensitiveData = { name: "John Doe", email: "john@example.com" };
const encryptedData = await client.encryptData(sensitiveData, {
  data_type: "user_profile",
  processing_stage: "initial"
});

// Send encrypted data to server
fetch('/api/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ encrypted: encryptedData })
});
```

### File Upload Encryption

```javascript
// file-upload-crypto.js
class SecureFileUploader extends PrivacyPreservingClient {
  async uploadEncryptedFile(file, options = {}) {
    try {
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      const fileBytes = new Uint8Array(arrayBuffer);
      
      // Create encryption context
      const context = {
        file_type: file.type,
        upload_timestamp: new Date().toISOString(),
        processing_stage: 'upload',
        ...options.context
      };
      
      // Encrypt file data
      const encryptedData = await this.encryptData(fileBytes, context);
      
      // Create upload payload
      const payload = {
        encrypted_data: encryptedData,
        metadata: {
          size: file.size,
          name: options.preserveFilename ? file.name : 'encrypted_file',
          type: file.type
        }
      };
      
      // Upload to server
      const response = await fetch(options.endpoint || '/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      throw new Error(`Secure upload failed: ${error.message}`);
    }
  }
}

// Usage
const uploader = new SecureFileUploader();
const fileInput = document.getElementById('file-input');

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const result = await uploader.uploadEncryptedFile(file, {
      endpoint: '/api/secure-upload',
      preserveFilename: false, // PII minimization
      context: {
        user_session: 'session_123',
        upload_purpose: 'analysis'
      }
    });
    
    console.log('Upload successful:', result.jobId);
  } catch (error) {
    console.error('Upload failed:', error);
  }
});
```

## Queue-Based ML Processing Pattern

### Server-Side Processing Queue

```python
# ml_processor.py - Reusable ML processing pattern
import asyncio
import json
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass
import redis.asyncio as redis

@dataclass
class ProcessingJob:
    id: str
    data: bytes
    context: Dict[str, Any]
    status: str = "pending"
    result: Optional[Dict] = None
    error: Optional[str] = None
    created_at: str = ""
    completed_at: Optional[str] = None

class MLProcessingQueue:
    def __init__(self, redis_url: str, queue_name: str = "ml-jobs"):
        self.redis_url = redis_url
        self.queue_name = queue_name
        self.redis_client = None
        self.processors = {}
        
    async def connect(self):
        """Connect to Redis"""
        self.redis_client = redis.from_url(self.redis_url)
        await self.redis_client.ping()
        
    async def register_processor(self, data_type: str, processor_func):
        """Register a processing function for a data type"""
        self.processors[data_type] = processor_func
        
    async def enqueue_job(self, job: ProcessingJob) -> str:
        """Add job to processing queue"""
        job_data = {
            "id": job.id,
            "data": job.data.hex(),  # Store as hex string
            "context": job.context,
            "status": job.status,
            "created_at": job.created_at
        }
        
        # Add to queue
        await self.redis_client.lpush(self.queue_name, json.dumps(job_data))
        
        # Store job status
        await self.redis_client.setex(
            f"job:{job.id}", 
            3600,  # 1 hour TTL
            json.dumps(job_data)
        )
        
        return job.id
        
    async def process_jobs(self):
        """Main processing loop"""
        while True:
            try:
                # Block and wait for job
                job_data = await self.redis_client.brpop(self.queue_name, timeout=1)
                
                if job_data:
                    await self._process_single_job(job_data[1])
                    
            except Exception as e:
                logging.error(f"Processing error: {e}")
                await asyncio.sleep(1)
                
    async def _process_single_job(self, job_json: bytes):
        """Process a single job"""
        try:
            job_data = json.loads(job_json)
            job_id = job_data["id"]
            
            # Update status to processing
            job_data["status"] = "processing"
            await self.redis_client.setex(
                f"job:{job_id}", 
                3600, 
                json.dumps(job_data)
            )
            
            # Get processor for data type
            data_type = job_data["context"].get("data_type", "default")
            processor = self.processors.get(data_type)
            
            if not processor:
                raise ValueError(f"No processor for data type: {data_type}")
                
            # Reconstruct job
            job = ProcessingJob(
                id=job_id,
                data=bytes.fromhex(job_data["data"]),
                context=job_data["context"],
                status="processing",
                created_at=job_data["created_at"]
            )
            
            # Process the job
            result = await processor(job)
            
            # Update with result
            job_data["status"] = "completed"
            job_data["result"] = result
            job_data["completed_at"] = datetime.now(timezone.utc).isoformat()
            
            await self.redis_client.setex(
                f"job:{job_id}", 
                3600, 
                json.dumps(job_data)
            )
            
        except Exception as e:
            # Mark job as failed
            job_data["status"] = "failed"
            job_data["error"] = str(e)
            
            await self.redis_client.setex(
                f"job:{job_id}", 
                3600, 
                json.dumps(job_data)
            )
            
            logging.error(f"Job {job_id} failed: {e}")

# Usage example
async def image_processor(job: ProcessingJob) -> Dict[str, Any]:
    """Example image processing function"""
    try:
        # Decrypt the data
        from crypto_utils import decrypt_data
        plaintext_data = await decrypt_data(job.data, job.context)
        
        # Process with ML model
        from ml_models import YOLODetector
        detector = YOLODetector()
        results = detector.detect(plaintext_data)
        
        return {
            "detections": len(results),
            "confidence": max([r.confidence for r in results], default=0),
            "processing_time": "0.156s"
        }
        
    except Exception as e:
        raise ProcessingError(f"Image processing failed: {e}")

# Set up the queue
queue = MLProcessingQueue("redis://localhost:6379")
await queue.connect()
await queue.register_processor("image", image_processor)

# Start processing
await queue.process_jobs()
```

## Secure File Upload Pattern

### Input Validation and Magic Byte Detection

```javascript
// secure-upload-validator.js
class SecureUploadValidator {
  constructor(options = {}) {
    this.allowedTypes = options.allowedTypes || [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp'
    ];
    this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB
    this.magicBytes = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'image/webp': [0x52, 0x49, 0x46, 0x46] // RIFF header
    };
  }

  async validateFile(file) {
    const result = {
      isValid: false,
      errors: [],
      warnings: [],
      detectedType: null,
      claimedType: file.type
    };

    // Size validation
    if (file.size > this.maxSize) {
      result.errors.push(`File too large: ${file.size} bytes (max: ${this.maxSize})`);
    }

    // Type validation
    if (!this.allowedTypes.includes(file.type)) {
      result.errors.push(`File type not allowed: ${file.type}`);
    }

    // Magic byte validation
    try {
      const header = await this.readFileHeader(file, 16);
      const detectedType = this.detectFileType(header);
      
      result.detectedType = detectedType;
      
      if (!detectedType) {
        result.errors.push('File type could not be determined from content');
      } else if (detectedType !== file.type) {
        result.warnings.push(`Type mismatch: claimed ${file.type}, detected ${detectedType}`);
      }
    } catch (error) {
      result.errors.push(`Could not read file header: ${error.message}`);
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  async readFileHeader(file, bytes = 16) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file.slice(0, bytes));
    });
  }

  detectFileType(header) {
    for (const [mimeType, signature] of Object.entries(this.magicBytes)) {
      if (this.matchesSignature(header, signature)) {
        return mimeType;
      }
    }
    return null;
  }

  matchesSignature(header, signature) {
    if (header.length < signature.length) return false;
    
    for (let i = 0; i < signature.length; i++) {
      if (header[i] !== signature[i]) return false;
    }
    return true;
  }
}

// Usage in upload form
const validator = new SecureUploadValidator({
  allowedTypes: ['image/jpeg', 'image/png'],
  maxSize: 5 * 1024 * 1024 // 5MB
});

document.getElementById('file-input').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const validation = await validator.validateFile(file);
  
  if (validation.isValid) {
    console.log('File validation passed');
    if (validation.warnings.length > 0) {
      console.warn('Validation warnings:', validation.warnings);
    }
    // Proceed with upload
  } else {
    console.error('File validation failed:', validation.errors);
    // Show error to user
  }
});
```

### Rate Limiting Pattern

```javascript
// rate-limiter.js - Express middleware
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.max = options.max || 100; // requests per window
    this.message = options.message || 'Too many requests';
    this.keyGenerator = options.keyGenerator || ((req) => req.ip);
    this.store = new Map(); // Use Redis in production
  }

  middleware() {
    return (req, res, next) => {
      const key = this.keyGenerator(req);
      const now = Date.now();
      const windowStart = now - this.windowMs;

      // Clean old entries
      this.cleanupExpired(windowStart);

      // Get current count
      const requests = this.store.get(key) || [];
      const recentRequests = requests.filter(time => time > windowStart);

      if (recentRequests.length >= this.max) {
        return res.status(429).json({
          error: this.message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(this.windowMs / 1000),
          limit: this.max,
          windowMs: this.windowMs
        });
      }

      // Add current request
      recentRequests.push(now);
      this.store.set(key, recentRequests);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': this.max,
        'X-RateLimit-Remaining': this.max - recentRequests.length,
        'X-RateLimit-Reset': new Date(now + this.windowMs).toISOString()
      });

      next();
    };
  }

  cleanupExpired(windowStart) {
    for (const [key, requests] of this.store.entries()) {
      const filtered = requests.filter(time => time > windowStart);
      if (filtered.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, filtered);
      }
    }
  }
}

// Usage
const uploadLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per 15 minutes per IP
  message: 'Too many uploads, please try again later'
});

app.post('/upload', uploadLimiter.middleware(), (req, res) => {
  // Handle upload
});
```

## Multi-Model Inference Pattern

### Model Manager with Fallback

```python
# model_manager.py
from typing import List, Dict, Any, Optional
import onnxruntime as ort
import numpy as np
import logging

class ModelManager:
    def __init__(self, model_configs: List[Dict[str, Any]]):
        self.model_configs = model_configs
        self.loaded_models = {}
        self.model_metadata = {}
        
    async def load_models(self):
        """Load models in priority order"""
        for config in self.model_configs:
            try:
                session = ort.InferenceSession(config['path'])
                
                self.loaded_models[config['name']] = {
                    'session': session,
                    'config': config
                }
                
                self.model_metadata[config['name']] = {
                    'input_shape': session.get_inputs()[0].shape,
                    'input_name': session.get_inputs()[0].name,
                    'input_type': session.get_inputs()[0].type,
                    'output_names': [out.name for out in session.get_outputs()],
                    'license': config.get('license', 'Unknown'),
                    'version': config.get('version', '1.0.0')
                }
                
                logging.info(f"Loaded model: {config['name']}")
                
            except Exception as e:
                logging.warning(f"Failed to load {config['name']}: {e}")
                
        if not self.loaded_models:
            raise RuntimeError("No models could be loaded")
            
    def get_primary_model(self) -> Optional[str]:
        """Get the primary (first successfully loaded) model"""
        return next(iter(self.loaded_models.keys())) if self.loaded_models else None
        
    def get_available_models(self) -> List[str]:
        """Get list of available model names"""
        return list(self.loaded_models.keys())
        
    async def infer(self, input_data: np.ndarray, model_name: Optional[str] = None) -> Dict[str, Any]:
        """Run inference with automatic fallback"""
        target_models = [model_name] if model_name else list(self.loaded_models.keys())
        
        last_error = None
        
        for model_name in target_models:
            if model_name not in self.loaded_models:
                continue
                
            try:
                model_info = self.loaded_models[model_name]
                session = model_info['session']
                config = model_info['config']
                
                # Prepare input based on model requirements
                prepared_input = self._prepare_input(input_data, model_name)
                input_name = self.model_metadata[model_name]['input_name']
                
                # Run inference
                outputs = session.run(None, {input_name: prepared_input})
                
                # Post-process based on model type
                result = self._post_process(outputs, model_name)
                
                return {
                    'model_used': model_name,
                    'result': result,
                    'metadata': {
                        'model_version': config.get('version', '1.0.0'),
                        'license': config.get('license', 'Unknown'),
                        'input_shape': list(prepared_input.shape),
                        'confidence_threshold': config.get('confidence_threshold', 0.5)
                    }
                }
                
            except Exception as e:
                last_error = e
                logging.warning(f"Inference failed with {model_name}: {e}")
                continue
                
        raise RuntimeError(f"All models failed. Last error: {last_error}")
        
    def _prepare_input(self, input_data: np.ndarray, model_name: str) -> np.ndarray:
        """Prepare input data for specific model"""
        config = self.loaded_models[model_name]['config']
        
        # Handle different input data types
        if 'yolov5' in model_name.lower():
            return input_data.astype(np.float16)
        else:  # YOLOv8, YOLOv11, YOLO-NAS
            return input_data.astype(np.float32)
            
    def _post_process(self, outputs: List[np.ndarray], model_name: str) -> Dict[str, Any]:
        """Post-process model outputs"""
        config = self.loaded_models[model_name]['config']
        confidence_threshold = config.get('confidence_threshold', 0.5)
        
        if 'yolo-nas' in model_name.lower():
            return self._post_process_yolo_nas(outputs, confidence_threshold)
        else:
            return self._post_process_standard_yolo(outputs, confidence_threshold)
            
    def _post_process_yolo_nas(self, outputs: List[np.ndarray], threshold: float) -> Dict[str, Any]:
        """Post-process YOLO-NAS outputs"""
        # YOLO-NAS typically has two outputs: boxes and scores
        if len(outputs) >= 2:
            boxes = outputs[0]  # Shape: (1, N, 4)
            scores = outputs[1]  # Shape: (1, N, num_classes)
            
            # Get cat class (assuming index 0 or specific index)
            cat_scores = scores[0, :, 0]  # Assuming cat is class 0
            valid_detections = cat_scores > threshold
            
            cat_count = np.sum(valid_detections)
            max_confidence = np.max(cat_scores) if len(cat_scores) > 0 else 0.0
            
            return {
                'cats': int(cat_count),
                'confidence': float(max_confidence),
                'detections': valid_detections.sum()
            }
        else:
            return {'cats': 0, 'confidence': 0.0, 'detections': 0}
            
    def _post_process_standard_yolo(self, outputs: List[np.ndarray], threshold: float) -> Dict[str, Any]:
        """Post-process standard YOLO outputs"""
        output = outputs[0]  # Shape: (1, N, 85) for COCO models
        
        # Extract confidence scores for cat class (typically index 15)
        cat_class_index = 15  # COCO dataset cat class
        
        if output.shape[-1] > cat_class_index + 5:  # 4 bbox + 1 obj_conf + classes
            confidences = output[0, :, 4] * output[0, :, 5 + cat_class_index]
            valid_detections = confidences > threshold
            
            cat_count = np.sum(valid_detections)
            max_confidence = np.max(confidences) if len(confidences) > 0 else 0.0
            
            return {
                'cats': int(cat_count),
                'confidence': float(max_confidence),
                'detections': valid_detections.sum()
            }
        else:
            return {'cats': 0, 'confidence': 0.0, 'detections': 0}

# Usage
model_configs = [
    {
        'name': 'yolo-nas',
        'path': 'models/yolo-nas.onnx',
        'license': 'Apache-2.0',
        'version': '1.0.0',
        'confidence_threshold': 0.5
    },
    {
        'name': 'yolov5l',
        'path': 'models/yolov5l.onnx',
        'license': 'GPL-3.0',  # Note: GPL license
        'version': '6.0.0',
        'confidence_threshold': 0.5
    }
]

manager = ModelManager(model_configs)
await manager.load_models()

# Run inference with automatic fallback
result = await manager.infer(input_image)
print(f"Result: {result['result']} (using {result['model_used']})")
```

## Testing Patterns

### Property-Based Confidentiality Testing

```javascript
// confidentiality-tests.js
describe('Confidentiality Properties', () => {
  test('encrypted data should never contain plaintext', async () => {
    const sensitiveTexts = [
      'user@email.com',
      'John Doe',
      'secret-password',
      'SSN: 123-45-6789'
    ];
    
    for (const sensitiveText of sensitiveTexts) {
      const encrypted = await encryptData(sensitiveText);
      
      // Property: Encrypted data should not contain plaintext
      expect(encrypted).not.toContain(sensitiveText);
      expect(encrypted.toLowerCase()).not.toContain(sensitiveText.toLowerCase());
      
      // Property: Base64 encoding should not reveal patterns
      const decoded = atob(encrypted);
      expect(decoded).not.toContain(sensitiveText);
    }
  });
  
  test('encryption context should filter PII', () => {
    const contexts = [
      { user_email: 'user@example.com', session_id: 'safe' },
      { credit_card: '4111-1111-1111-1111', upload_timestamp: '2023-01-01' },
      { social_security: '123-45-6789', file_type: 'image/jpeg' }
    ];
    
    for (const context of contexts) {
      const filtered = validateEncryptionContext(context);
      
      // Property: No PII should survive filtering
      const filteredString = JSON.stringify(filtered);
      expect(filteredString).not.toMatch(/@/);  // No email
      expect(filteredString).not.toMatch(/\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}/);  // No credit card
      expect(filteredString).not.toMatch(/\d{3}[- ]\d{2}[- ]\d{4}/);  // No SSN
    }
  });
});
```

This documentation provides reusable patterns that developers can adapt for their own privacy-preserving ML applications, following the architectural principles demonstrated in the Confidential Cat Counter.

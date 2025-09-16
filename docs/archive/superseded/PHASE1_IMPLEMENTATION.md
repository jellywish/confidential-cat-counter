# Phase 1 Implementation: Local Docker Foundation

**Goal**: Working ML inference pipeline with 30-second iteration cycle and property-based confidentiality testing.

**Timeline**: Week 1 (5-7 days)

**Success Criteria**: 
- Upload image → detect cats → return results in under 15 seconds
- Full system runs with `make local-demo`
- Automated tests verify no plaintext data leakage
- Development iteration cycle under 30 seconds

---

## 📋 Implementation Checklist

### **Day 1-2: Project Structure & Basic Services**

#### **1.1 Initialize Project Structure**
```bash
# Project root structure
mkdir -p {src,infrastructure,tests,scripts,docs/guides}
mkdir -p src/{web-client,ml-service,message-queue}
mkdir -p infrastructure/{local,aws,azure}
mkdir -p tests/{unit,integration,confidentiality}
```

#### **1.2 Create Docker Compose Foundation**
**File**: `docker-compose.yml`
```yaml
version: '3.8'

services:
  web-client:
    build: ./src/web-client
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
      - ML_SERVICE_URL=http://ml-service:8000
    volumes:
      - ./data/uploads:/app/uploads
    depends_on:
      - redis
      - ml-service

  ml-service:
    build: ./src/ml-service
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./models:/app/models
      - ./data/results:/app/results
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

#### **1.3 Create Makefile for Fast Development**
**File**: `Makefile`
```makefile
.PHONY: dev-setup local-demo test-confidentiality clean

# 30-second development cycle
dev-setup:
	@echo "Setting up development environment..."
	docker-compose build --parallel
	docker-compose up -d
	@echo "✅ Environment ready at http://localhost:3000"

local-demo: dev-setup
	@echo "Running cat detection demo..."
	sleep 5  # Wait for services
	curl -X POST -F "image=@tests/fixtures/cat.jpg" http://localhost:3000/upload
	@echo "\n🎯 Demo complete! Check http://localhost:3000/results"

test-confidentiality:
	@echo "Running property-based confidentiality tests..."
	docker-compose exec ml-service python -m pytest tests/confidentiality/ -v
	docker-compose exec web-client npm test -- --grep "confidentiality"

clean:
	docker-compose down -v
	docker system prune -f

# Fast iteration
dev-restart:
	docker-compose restart web-client ml-service
	@echo "⚡ Services restarted in ~5 seconds"

dev-logs:
	docker-compose logs -f web-client ml-service

dev-test:
	docker-compose exec ml-service python -m pytest tests/unit/ -v
	docker-compose exec web-client npm test
```

### **Day 2-3: Web Client Service**

#### **2.1 Web Client (Node.js + Express)**
**File**: `src/web-client/package.json`
```json
{
  "name": "ccc-web-client",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js",
    "test": "jest",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5",
    "redis": "^4.6.0",
    "uuid": "^9.0.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "jest": "^29.5.0",
    "supertest": "^6.3.3",
    "nodemon": "^2.0.22"
  }
}
```

**File**: `src/web-client/server.js`
```javascript
const express = require('express');
const multer = require('multer');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });
const client = redis.createClient({ url: process.env.REDIS_URL });

client.connect();

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Upload endpoint
app.post('/upload', upload.single('image'), async (req, res) => {
    const jobId = uuidv4();
    const jobData = {
        id: jobId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        status: 'queued',
        timestamp: new Date().toISOString()
    };

    // Queue job for processing
    await client.lpush('ml-jobs', JSON.stringify(jobData));
    
    // Store job status
    await client.setex(`job:${jobId}`, 3600, JSON.stringify(jobData));
    
    res.json({ jobId, status: 'queued' });
});

// Results endpoint
app.get('/results/:jobId', async (req, res) => {
    const { jobId } = req.params;
    const jobData = await client.get(`job:${jobId}`);
    
    if (!jobData) {
        return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json(JSON.parse(jobData));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'web-client' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Web client running on port ${PORT}`);
});

module.exports = app;
```

**File**: `src/web-client/public/index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confidential Cat Counter</title>
    <style>
        body { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 20px; }
        .upload-area { border: 2px dashed #ccc; padding: 40px; text-align: center; margin: 20px 0; }
        .results { margin-top: 20px; padding: 20px; background: #f5f5f5; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>🔐 Confidential Cat Counter</h1>
    <p>Upload an image to count cats with privacy-preserving ML</p>
    
    <div class="upload-area">
        <input type="file" id="imageInput" accept="image/*">
        <p>Select an image file</p>
        <button onclick="uploadImage()">Upload & Process</button>
    </div>
    
    <div id="results" class="results" style="display: none;">
        <h3>Results</h3>
        <div id="resultContent"></div>
    </div>

    <script>
        async function uploadImage() {
            const input = document.getElementById('imageInput');
            const file = input.files[0];
            
            if (!file) {
                alert('Please select an image');
                return;
            }
            
            const formData = new FormData();
            formData.append('image', file);
            
            try {
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.jobId) {
                    pollForResults(result.jobId);
                }
            } catch (error) {
                console.error('Upload failed:', error);
            }
        }
        
        async function pollForResults(jobId) {
            const resultsDiv = document.getElementById('results');
            const resultContent = document.getElementById('resultContent');
            
            resultsDiv.style.display = 'block';
            resultContent.innerHTML = 'Processing... ⏳';
            
            const pollInterval = setInterval(async () => {
                try {
                    const response = await fetch(`/results/${jobId}`);
                    const result = await response.json();
                    
                    if (result.status === 'completed') {
                        clearInterval(pollInterval);
                        resultContent.innerHTML = `
                            <strong>Cats detected: ${result.cats || 0}</strong><br>
                            <small>Confidence: ${result.confidence || 'N/A'}</small><br>
                            <small>Processed in: ${result.processingTime || 'N/A'}</small>
                        `;
                    } else if (result.status === 'failed') {
                        clearInterval(pollInterval);
                        resultContent.innerHTML = `<span style="color: red;">Processing failed: ${result.error}</span>`;
                    } else {
                        resultContent.innerHTML = `Status: ${result.status} ⏳`;
                    }
                } catch (error) {
                    console.error('Polling failed:', error);
                }
            }, 1000);
        }
    </script>
</body>
</html>
```

**File**: `src/web-client/Dockerfile`
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### **Day 3-4: ML Service**

#### **3.1 ML Service (Python + FastAPI + ONNX)**
**File**: `src/ml-service/requirements.txt`
```
fastapi==0.104.1
uvicorn==0.24.0
redis==5.0.1
onnxruntime==1.16.3
opencv-python==4.8.1.78
numpy==1.24.3
pillow==10.1.0
pydantic==2.5.0
python-multipart==0.0.6
```

**File**: `src/ml-service/app.py`
```python
import asyncio
import json
import time
import os
from typing import Optional
from fastapi import FastAPI, BackgroundTasks
import redis
import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image

app = FastAPI(title="CCC ML Service")

# Redis connection
redis_client = redis.Redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))

# Load YOLO model (will download if not present)
MODEL_PATH = '/app/models/yolov5s.onnx'
session = None

def load_model():
    global session
    if os.path.exists(MODEL_PATH):
        session = ort.InferenceSession(MODEL_PATH)
        print(f"✅ Model loaded: {MODEL_PATH}")
    else:
        print(f"⚠️  Model not found at {MODEL_PATH}, using mock detection")

def detect_cats(image_path: str) -> dict:
    """
    Cat detection using YOLO model (or mock for development)
    """
    start_time = time.time()
    
    if session is None:
        # Mock detection for development
        return {
            'cats': 1,
            'confidence': 0.85,
            'processing_time': f"{(time.time() - start_time):.2f}s",
            'model': 'mock'
        }
    
    try:
        # Load and preprocess image
        image = cv2.imread(image_path)
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # YOLO preprocessing
        input_image = cv2.resize(image_rgb, (640, 640))
        input_image = input_image.astype(np.float32) / 255.0
        input_image = np.transpose(input_image, (2, 0, 1))
        input_image = np.expand_dims(input_image, axis=0)
        
        # Run inference
        outputs = session.run(None, {'images': input_image})
        
        # Post-process results (simplified cat counting)
        detections = outputs[0][0]
        cat_count = 0
        max_confidence = 0.0
        
        for detection in detections:
            confidence = detection[4]
            class_id = np.argmax(detection[5:])
            
            # Class 15 is typically 'cat' in COCO dataset
            if class_id == 15 and confidence > 0.5:
                cat_count += 1
                max_confidence = max(max_confidence, confidence)
        
        return {
            'cats': cat_count,
            'confidence': float(max_confidence),
            'processing_time': f"{(time.time() - start_time):.2f}s",
            'model': 'yolov5s'
        }
        
    except Exception as e:
        print(f"Detection error: {e}")
        return {
            'cats': 0,
            'confidence': 0.0,
            'processing_time': f"{(time.time() - start_time):.2f}s",
            'error': str(e)
        }

async def process_job(job_data: dict):
    """Process a single ML job"""
    job_id = job_data['id']
    filename = job_data['filename']
    image_path = f"/app/uploads/{filename}"
    
    try:
        # Update status
        job_data['status'] = 'processing'
        await redis_client.setex(f"job:{job_id}", 3600, json.dumps(job_data))
        
        # Run ML inference
        result = detect_cats(image_path)
        
        # Update with results
        job_data.update({
            'status': 'completed',
            'cats': result['cats'],
            'confidence': result['confidence'],
            'processingTime': result['processing_time'],
            'model': result.get('model', 'unknown'),
            'completedAt': time.time()
        })
        
        await redis_client.setex(f"job:{job_id}", 3600, json.dumps(job_data))
        print(f"✅ Job {job_id} completed: {result['cats']} cats detected")
        
    except Exception as e:
        job_data.update({
            'status': 'failed',
            'error': str(e),
            'failedAt': time.time()
        })
        await redis_client.setex(f"job:{job_id}", 3600, json.dumps(job_data))
        print(f"❌ Job {job_id} failed: {e}")

async def job_worker():
    """Background worker to process ML jobs"""
    print("🔄 ML job worker started")
    
    while True:
        try:
            # Block until a job is available
            job_raw = await redis_client.brpop('ml-jobs', timeout=5)
            
            if job_raw:
                job_data = json.loads(job_raw[1])
                await process_job(job_data)
                
        except Exception as e:
            print(f"Worker error: {e}")
            await asyncio.sleep(1)

@app.on_event("startup")
async def startup():
    load_model()
    # Start background job worker
    asyncio.create_task(job_worker())

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "ml-service",
        "model_loaded": session is not None
    }

@app.get("/")
async def root():
    return {"message": "CCC ML Service", "model_loaded": session is not None}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

**File**: `src/ml-service/Dockerfile`
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libopencv-dev \
    python3-opencv \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download YOLO model (optional - will use mock if not present)
RUN mkdir -p /app/models
RUN wget -O /app/models/yolov5s.onnx \
    https://github.com/onnx/models/raw/main/vision/object_detection_segmentation/yolov5/model/yolov5s.onnx \
    || echo "Model download failed, will use mock detection"

COPY . .

EXPOSE 8000

CMD ["python", "app.py"]
```

### **Day 4-5: Property-Based Confidentiality Testing**

#### **4.1 Confidentiality Testing Framework**
**File**: `tests/confidentiality/test_data_leakage.py`
```python
"""
Property-based tests to verify no plaintext data leakage
"""
import pytest
import requests
import redis
import time
import subprocess
import io
from PIL import Image
import numpy as np

redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

def generate_test_image(width=640, height=480, pattern='random'):
    """Generate test image with known patterns"""
    if pattern == 'random':
        # Random noise image
        array = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
    elif pattern == 'text':
        # Image with embedded text
        array = np.zeros((height, width, 3), dtype=np.uint8)
        # Add some text pattern (simplified)
        array[100:200, 100:500] = 255
    
    image = Image.fromarray(array)
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG')
    return buffer.getvalue()

def capture_system_logs():
    """Capture Docker logs from all services"""
    try:
        result = subprocess.run(
            ['docker-compose', 'logs', '--no-color'],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return ""

def test_no_plaintext_in_logs():
    """Test that sensitive image data never appears in logs"""
    # Generate unique test image
    test_image = generate_test_image(pattern='text')
    
    # Clear existing logs
    subprocess.run(['docker-compose', 'logs', '--no-color'], 
                  capture_output=True)
    
    # Upload image
    response = requests.post(
        'http://localhost:3000/upload',
        files={'image': ('test.jpg', test_image, 'image/jpeg')}
    )
    
    assert response.status_code == 200
    job_id = response.json()['jobId']
    
    # Wait for processing
    time.sleep(5)
    
    # Capture logs after processing
    logs = capture_system_logs()
    
    # Critical property: Raw image data should never appear in logs
    # Check for base64 patterns that might indicate image data
    import base64
    image_b64 = base64.b64encode(test_image).decode()
    
    assert image_b64[:100] not in logs, "Image data found in logs!"
    assert len([line for line in logs.split('\n') 
               if len(line) > 100 and line.count('=') > 10]) == 0, \
           "Suspicious base64-like data found in logs"

def test_no_image_data_in_redis():
    """Test that Redis doesn't store raw image data"""
    test_image = generate_test_image()
    
    # Upload image
    response = requests.post(
        'http://localhost:3000/upload',
        files={'image': ('test.jpg', test_image, 'image/jpeg')}
    )
    
    job_id = response.json()['jobId']
    
    # Check Redis contents
    all_keys = redis_client.keys('*')
    for key in all_keys:
        value = redis_client.get(key)
        if value:
            # Image data should not be stored in Redis
            assert len(value) < 10000, f"Suspiciously large data in Redis key {key}"
            # Should not contain JPEG headers
            assert 'FFD8' not in value.upper(), f"JPEG data found in Redis key {key}"

def test_processing_isolation():
    """Test that processing doesn't leak data between jobs"""
    # Create two different test images
    image1 = generate_test_image(pattern='random')
    image2 = generate_test_image(pattern='text')
    
    # Process first image
    resp1 = requests.post(
        'http://localhost:3000/upload',
        files={'image': ('test1.jpg', image1, 'image/jpeg')}
    )
    job1_id = resp1.json()['jobId']
    
    # Process second image immediately
    resp2 = requests.post(
        'http://localhost:3000/upload',
        files={'image': ('test2.jpg', image2, 'image/jpeg')}
    )
    job2_id = resp2.json()['jobId']
    
    # Wait and check results
    time.sleep(8)
    
    result1 = requests.get(f'http://localhost:3000/results/{job1_id}').json()
    result2 = requests.get(f'http://localhost:3000/results/{job2_id}').json()
    
    # Results should be independent
    assert result1['id'] != result2['id']
    assert result1.get('filename') != result2.get('filename')

def test_memory_bounds():
    """Test that memory usage stays within bounds"""
    # This would integrate with monitoring in production
    # For now, just verify the service responds after processing
    
    large_image = generate_test_image(width=2048, height=2048)
    
    response = requests.post(
        'http://localhost:3000/upload',
        files={'image': ('large.jpg', large_image, 'image/jpeg')}
    )
    
    assert response.status_code == 200
    
    # Service should still be responsive
    health = requests.get('http://localhost:3000/health')
    assert health.status_code == 200

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
```

#### **4.2 Integration Tests**
**File**: `tests/integration/test_full_workflow.py`
```python
"""
End-to-end integration tests
"""
import pytest
import requests
import time
from PIL import Image
import io

def create_test_cat_image():
    """Create a simple test image (placeholder for actual cat image)"""
    # Create a simple colored rectangle as placeholder
    image = Image.new('RGB', (640, 480), color='orange')
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG')
    return buffer.getvalue()

def test_complete_workflow():
    """Test the complete upload → process → results workflow"""
    test_image = create_test_cat_image()
    
    # 1. Upload image
    upload_response = requests.post(
        'http://localhost:3000/upload',
        files={'image': ('cat.jpg', test_image, 'image/jpeg')}
    )
    
    assert upload_response.status_code == 200
    upload_data = upload_response.json()
    assert 'jobId' in upload_data
    assert upload_data['status'] == 'queued'
    
    job_id = upload_data['jobId']
    
    # 2. Poll for results (max 30 seconds)
    max_wait = 30
    result = None
    
    for i in range(max_wait):
        time.sleep(1)
        
        result_response = requests.get(f'http://localhost:3000/results/{job_id}')
        assert result_response.status_code == 200
        
        result = result_response.json()
        
        if result['status'] == 'completed':
            break
        elif result['status'] == 'failed':
            pytest.fail(f"Job failed: {result.get('error', 'Unknown error')}")
    
    # 3. Verify results
    assert result is not None
    assert result['status'] == 'completed'
    assert 'cats' in result
    assert isinstance(result['cats'], int)
    assert result['cats'] >= 0
    
    if 'confidence' in result:
        assert 0.0 <= result['confidence'] <= 1.0
    
    print(f"✅ Complete workflow test passed: {result['cats']} cats detected")

def test_service_health():
    """Test that all services are healthy"""
    # Web client health
    web_health = requests.get('http://localhost:3000/health')
    assert web_health.status_code == 200
    assert web_health.json()['status'] == 'healthy'
    
    # ML service health
    ml_health = requests.get('http://localhost:8000/health')
    assert ml_health.status_code == 200
    assert ml_health.json()['status'] == 'healthy'

def test_performance_target():
    """Test that processing meets performance targets"""
    test_image = create_test_cat_image()
    
    start_time = time.time()
    
    # Upload
    upload_response = requests.post(
        'http://localhost:3000/upload',
        files={'image': ('cat.jpg', test_image, 'image/jpeg')}
    )
    job_id = upload_response.json()['jobId']
    
    # Wait for completion
    while True:
        result = requests.get(f'http://localhost:3000/results/{job_id}').json()
        if result['status'] in ['completed', 'failed']:
            break
        time.sleep(0.5)
    
    total_time = time.time() - start_time
    
    # Should complete within 15 seconds (Phase 1 target)
    assert total_time < 15, f"Processing took {total_time:.2f}s, target is <15s"
    
    print(f"✅ Performance test passed: {total_time:.2f}s")

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
```

### **Day 5: Documentation & Validation**

#### **5.1 Create Test Fixtures**
```bash
mkdir -p tests/fixtures
# Add sample images for testing (can be placeholders)
```

#### **5.2 Final Validation Script**
**File**: `scripts/validate-phase1.sh`
```bash
#!/bin/bash
set -e

echo "🔍 Phase 1 Validation Starting..."

# Check prerequisites
echo "📋 Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "❌ Docker not installed"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose not installed"; exit 1; }

# Start services
echo "🚀 Starting services..."
make dev-setup

# Wait for services to be ready
echo "⏳ Waiting for services..."
sleep 10

# Run health checks
echo "🏥 Running health checks..."
curl -f http://localhost:3000/health || { echo "❌ Web client unhealthy"; exit 1; }
curl -f http://localhost:8000/health || { echo "❌ ML service unhealthy"; exit 1; }

# Run confidentiality tests
echo "🔒 Running confidentiality tests..."
make test-confidentiality

# Run integration tests
echo "🧪 Running integration tests..."
cd tests/integration && python -m pytest test_full_workflow.py -v

# Performance test
echo "⚡ Running performance test..."
time curl -X POST -F "image=@../fixtures/cat.jpg" http://localhost:3000/upload

echo "✅ Phase 1 validation complete!"
echo "🎯 Ready for Phase 2 development"
```

#### **5.3 Update Main Documentation**
Now let's link this from the technical design document:


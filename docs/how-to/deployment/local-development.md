# Local Development Guide

This guide covers setting up a local development environment for the Confidential Cat Counter.

## Prerequisites

### Required Software

- **Docker Desktop** (4.0+) with Docker Compose
- **Node.js** (18.0+ or 20.0+)
- **Python** (3.9+ or 3.11+)
- **Git** for version control

### Optional Tools

- **Redis CLI** for database debugging
- **Postman** or **curl** for API testing
- **VS Code** with recommended extensions
- **Conda** for Python environment management

## Quick Start

### Automated Setup

```bash
# Clone the repository
git clone https://github.com/jellywish/confidential-cat-counter.git
cd confidential-cat-counter

# Run the setup script
./setup.sh

# The application will be available at:
# - Web Client: http://localhost:3000
# - ML Service: http://localhost:8000
# - Redis: localhost:6379
```

### Manual Setup

If you prefer manual setup or need to customize the installation:

```bash
# 1. Start Redis
docker run -d --name dev-redis -p 6379:6379 redis:7-alpine

# 2. Install and start ML Service
cd src/ml-service
pip install -r requirements.txt
python app.py

# 3. Install and start Web Client (in new terminal)
cd src/web-client
npm install
npm run dev

# 4. Open browser to http://localhost:3000
```

## Development Environment Configuration

### Environment Variables

**Web Client (.env.development):**
```bash
# Create src/web-client/.env.development
NODE_ENV=development
PORT=3000
REDIS_URL=redis://localhost:6379
ML_SERVICE_URL=http://localhost:8000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
LOG_LEVEL=debug
UPLOAD_DIR=./uploads
```

**ML Service (.env.development):**
```bash
# Create src/ml-service/.env.development
HOST=127.0.0.1
PORT=8000
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
CONFIDENCE_THRESHOLD=0.5
MODEL_PRIORITY=yolo-nas,yolov5l,yolov11m,yolov8m,yolov5s
```

### VS Code Configuration

**Recommended Extensions (.vscode/extensions.json):**
```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.flake8",
    "ms-python.black-formatter",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-azuretools.vscode-docker",
    "redhat.vscode-yaml"
  ]
}
```

**Workspace Settings (.vscode/settings.json):**
```json
{
  "python.defaultInterpreterPath": "./src/ml-service/venv/bin/python",
  "python.formatting.provider": "black",
  "python.linting.enabled": true,
  "python.linting.flake8Enabled": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.dockerfile": "dockerfile",
    "docker-compose*.yml": "dockercompose"
  }
}
```

**Debug Configuration (.vscode/launch.json):**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Web Client",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/web-client/server.js",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "*"
      },
      "cwd": "${workspaceFolder}/src/web-client"
    },
    {
      "name": "Debug ML Service",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/src/ml-service/app.py",
      "env": {
        "PYTHONPATH": "${workspaceFolder}/src/ml-service"
      },
      "cwd": "${workspaceFolder}/src/ml-service",
      "console": "integratedTerminal"
    }
  ]
}
```

## Development Workflow

### Code Changes and Hot Reload

**Web Client (Node.js):**
```bash
cd src/web-client

# Development server with hot reload
npm run dev

# The server will automatically restart when files change
# Browser will need manual refresh (no frontend framework)
```

**ML Service (Python):**
```bash
cd src/ml-service

# Development server with auto-reload
uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# Or use the development script
python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### File Watching and Live Updates

**Web Client File Watcher:**
```bash
# Watch for changes and restart automatically
npm install -g nodemon

# Run with nodemon
nodemon server.js

# Or use the existing npm script
npm run dev  # Uses nodemon internally
```

**ML Service File Watcher:**
```bash
# Install watchdog for Python file watching
pip install watchdog

# Use uvicorn's built-in reload
uvicorn app:app --reload
```

### Testing During Development

**Unit Tests:**
```bash
# Run unit tests with watch mode
cd src/web-client
npm run test:watch

# Run specific test files
npm test -- crypto.test.js
npm test -- api.test.js
```

**Integration Tests:**
```bash
# Start all services first
docker-compose up -d

# Run integration tests
./scripts/test.sh --integration

# Or run specific integration tests
cd src/web-client
npm test -- --testPathPattern=tests/integration
```

**Manual API Testing:**
```bash
# Test health endpoints
curl http://localhost:3000/health
curl http://localhost:8000/health

# Test file upload
curl -X POST http://localhost:3000/upload \
  -F "image=@tests/fixtures/real_cat.jpg"

# Test job status (replace with actual job ID)
curl http://localhost:3000/status/job_1234567890_abc123
```

## Debugging

### Debugging the Web Client

**Node.js Debugging:**
```bash
# Start with Node.js inspector
node --inspect server.js

# Or with nodemon
nodemon --inspect server.js

# Connect with Chrome DevTools at chrome://inspect
```

**Express.js Debug Logging:**
```bash
# Enable Express debug logs
DEBUG=express:* npm run dev

# Enable application debug logs
DEBUG=app:* npm run dev

# Enable all debug logs
DEBUG=* npm run dev
```

### Debugging the ML Service

**Python Debugging:**
```python
# Add breakpoints in code
import pdb; pdb.set_trace()

# Or use the newer breakpoint() function (Python 3.7+)
breakpoint()

# Run with Python debugger
python -m pdb app.py
```

**FastAPI Debug Mode:**
```bash
# Enable debug mode and detailed error messages
uvicorn app:app --reload --debug --host 0.0.0.0 --port 8000
```

### Debugging Redis

**Redis CLI Commands:**
```bash
# Connect to Redis
redis-cli

# Monitor all commands
redis-cli monitor

# Check queue status
redis-cli llen ml-jobs

# View job data
redis-cli lrange ml-jobs 0 -1

# Check specific job
redis-cli get "job:your-job-id"

# Clear all data (development only!)
redis-cli flushall
```

### Container Debugging

**Docker Container Inspection:**
```bash
# View container logs
docker logs ccc-web-client -f
docker logs ccc-ml-service -f
docker logs ccc-redis -f

# Execute commands in running containers
docker exec -it ccc-web-client /bin/bash
docker exec -it ccc-ml-service /bin/bash
docker exec -it ccc-redis redis-cli

# Inspect container configuration
docker inspect ccc-web-client
```

## Database Management

### Redis Development Commands

**Queue Management:**
```bash
# Check queue length
redis-cli llen ml-jobs

# View pending jobs
redis-cli lrange ml-jobs 0 10

# Clear the queue (development only)
redis-cli del ml-jobs

# View all job statuses
redis-cli keys "job:*"

# Remove specific job
redis-cli del "job:specific-job-id"
```

**Development Data Seeding:**
```bash
# Seed test jobs (if needed for testing)
redis-cli lpush ml-jobs '{"id":"test-job-1","status":"pending","filename":"test.jpg"}'

# Set job status
redis-cli set "job:test-job-1" '{"id":"test-job-1","status":"completed","result":{"cats":2}}'
```

## Model Development

### Adding New Models

**Download and Test Models:**
```bash
cd src/ml-service

# Create models directory
mkdir -p models

# Download a new model (example)
wget https://example.com/new-model.onnx -O models/new-model.onnx

# Test model loading
python -c "
import onnxruntime as ort
session = ort.InferenceSession('models/new-model.onnx')
print('Model loaded successfully')
print('Input shape:', session.get_inputs()[0].shape)
print('Output shape:', session.get_outputs()[0].shape)
"
```

**Update Model Loading Code:**
```python
# In app.py, update load_models() function
def load_models():
    model_paths = [
        'models/new-model.onnx',  # Add your new model
        'models/yolo-nas.onnx',
        'models/yolov5l.onnx',
        # ... existing models
    ]
    # ... rest of loading logic
```

### Model Performance Testing

**Benchmark Script:**
```python
# benchmark_models.py
import time
import numpy as np
from app import model_session, preprocess_image

def benchmark_model(image_path, iterations=10):
    """Benchmark model inference time."""
    # Load and preprocess image
    image = preprocess_image(image_path)
    
    # Warm up
    for _ in range(3):
        model_session.run(['output'], {'images': image})
    
    # Benchmark
    start_time = time.time()
    for _ in range(iterations):
        result = model_session.run(['output'], {'images': image})
    end_time = time.time()
    
    avg_time = (end_time - start_time) / iterations
    print(f"Average inference time: {avg_time:.4f} seconds")
    return avg_time

# Run benchmark
if __name__ == "__main__":
    benchmark_model("tests/fixtures/real_cat.jpg")
```

## Frontend Development

### Browser Development Tools

**Crypto Debugging:**
```javascript
// Add to browser console for debugging encryption
window.debugCrypto = true;

// Monitor encryption operations
window.addEventListener('crypto-operation', (event) => {
    console.log('Crypto operation:', event.detail);
});

// Test encryption manually
async function testEncryption() {
    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    const encrypted = await encryptData(testData);
    console.log('Encrypted length:', encrypted.length);
    
    const decrypted = await decryptData(encrypted);
    console.log('Decrypted matches:', 
        testData.every((val, i) => val === decrypted[i]));
}
```

**Performance Monitoring:**
```javascript
// Monitor upload performance
function monitorUpload(file) {
    const startTime = performance.now();
    
    uploadFile(file).then(() => {
        const endTime = performance.now();
        console.log(`Upload took ${endTime - startTime} milliseconds`);
    });
}

// Monitor memory usage
function checkMemoryUsage() {
    if (performance.memory) {
        console.log('Memory usage:', {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB',
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
        });
    }
}
```

### CSS/UI Development

**Live CSS Reload:**
```html
<!-- Add to index.html for development -->
<script>
if (location.hostname === 'localhost') {
    // Simple CSS live reload
    setInterval(() => {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        links.forEach(link => {
            const href = link.href.split('?')[0];
            link.href = href + '?t=' + Date.now();
        });
    }, 1000);
}
</script>
```

## Common Development Issues

### Port Conflicts

```bash
# Check what's using a port
lsof -i :3000
lsof -i :8000
lsof -i :6379

# Kill processes using ports
sudo kill -9 $(lsof -t -i:3000)

# Use different ports
PORT=3001 npm run dev
uvicorn app:app --port 8002
```

### Docker Issues

```bash
# Clean up Docker resources
docker system prune -f

# Remove all containers and images
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
docker rmi $(docker images -q)

# Reset Docker Desktop (Mac/Windows)
# Docker Desktop -> Troubleshoot -> Reset to factory defaults
```

### Model Loading Issues

```bash
# Check Python environment
which python
pip list | grep onnx

# Reinstall ONNX runtime
pip uninstall onnxruntime
pip install onnxruntime

# For GPU support (if available)
pip install onnxruntime-gpu

# Check model file integrity
file models/yolo-nas.onnx
ls -la models/
```

### Redis Connection Issues

```bash
# Check Redis is running
redis-cli ping

# Start Redis manually
redis-server

# Check Redis logs
docker logs ccc-redis

# Reset Redis data (development only)
redis-cli flushall
```

## Performance Optimization

### Development Performance Tips

**Node.js Optimization:**
```bash
# Use Node.js 20+ for better performance
node --version

# Increase memory limit for large files
node --max-old-space-size=4096 server.js

# Enable worker threads for CPU-intensive tasks
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

**Python Optimization:**
```bash
# Use Python 3.11+ for better performance
python --version

# Install performance monitoring
pip install memory-profiler line-profiler

# Profile memory usage
python -m memory_profiler app.py

# Profile line-by-line performance
kernprof -l -v app.py
```

### Resource Monitoring

**System Monitoring:**
```bash
# Monitor system resources
htop           # CPU and memory usage
iotop          # Disk I/O
nethogs        # Network usage by process

# Monitor Docker resources
docker stats

# Monitor specific containers
docker stats ccc-web-client ccc-ml-service ccc-redis
```

## Contributing to Development

### Pre-commit Hooks

```bash
# Install pre-commit hooks
npm install -g pre-commit

# Set up hooks
cd src/web-client
npx husky install
npx husky add .husky/pre-commit "npm test"
npx husky add .husky/pre-commit "npm run lint"
npx husky add .husky/pre-commit "npm run format:check"
```

### Code Quality

```bash
# Run linting
cd src/web-client
npm run lint
npm run format:check

# Auto-fix issues
npm run lint:fix
npm run format

# Run all quality checks
npm run test
npm run security:audit
```

This local development guide provides a comprehensive foundation for setting up and working with the Confidential Cat Counter in a development environment.

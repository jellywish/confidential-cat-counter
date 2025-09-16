# API Reference

This document provides comprehensive documentation for all API endpoints in the Confidential Cat Counter system.

## Overview

The system consists of two main services:
- **Web Client API** (Port 3000): Handles file uploads, job management, and serves the web interface
- **ML Service API** (Port 8001): Processes machine learning inference requests

## Web Client API

Base URL: `http://localhost:3000`

### Authentication

Currently, no authentication is required for the demo. In production, implement proper authentication and authorization.

### Rate Limiting

All upload endpoints are rate-limited to 100 requests per 15 minutes per IP address.

### Content Security Policy

Strict CSP is enforced. External scripts and inline event handlers are blocked.

---

### Endpoints

#### `GET /health`

Health check endpoint for service monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "uptime": 3600.5,
  "version": "1.0.0",
  "service": "web-client"
}
```

**Status Codes:**
- `200 OK` - Service is healthy
- `503 Service Unavailable` - Service is degraded or unhealthy

---

#### `POST /upload`

Upload an encrypted image file for processing.

**Content-Type:** `multipart/form-data`

**Parameters:**
- `image` (file, required) - Image file (JPEG, PNG, GIF, WebP, BMP)
  - Maximum size: 10MB
  - Validated using magic byte detection

**Request Example:**
```bash
curl -X POST http://localhost:3000/upload \
  -F "image=@cat-photo.jpg" \
  -H "Content-Type: multipart/form-data"
```

**Response (Success):**
```json
{
  "jobId": "job_1701944200000_abc123",
  "message": "Image uploaded successfully and queued for processing",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "estimatedProcessingTime": "2-5 seconds"
}
```

**Response (Error):**
```json
{
  "error": "File too large",
  "code": "FILE_TOO_LARGE",
  "message": "File size exceeds 10MB limit",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "details": {
    "maxSize": "10MB",
    "receivedSize": "15MB"
  }
}
```

**Status Codes:**
- `200 OK` - Upload successful
- `400 Bad Request` - Invalid file or request
- `413 Payload Too Large` - File exceeds size limit
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

**Error Codes:**
- `FILE_TOO_LARGE` - File exceeds 10MB limit
- `INVALID_FILE_TYPE` - File type not supported or magic bytes don't match
- `MISSING_FILE` - No file provided in request
- `PROCESSING_ERROR` - Error during file processing
- `SERVICE_UNAVAILABLE` - ML service or Redis unavailable

---

#### `GET /status/{jobId}`

Check the processing status of an uploaded image.

**Parameters:**
- `jobId` (string, required) - Job ID returned from upload

**Request Example:**
```bash
curl http://localhost:3000/status/job_1701944200000_abc123
```

**Response (Processing):**
```json
{
  "jobId": "job_1701944200000_abc123",
  "status": "processing",
  "timestamp": "2023-12-07T10:30:15.000Z",
  "estimatedCompletion": "2023-12-07T10:30:20.000Z"
}
```

**Response (Completed):**
```json
{
  "jobId": "job_1701944200000_abc123",
  "status": "completed",
  "timestamp": "2023-12-07T10:30:18.000Z",
  "result": {
    "cats": 2,
    "confidence": 0.87,
    "processingTime": "0.156s",
    "model": "yolo-nas",
    "detections": [
      {
        "class": "cat",
        "confidence": 0.92,
        "bbox": [120, 80, 200, 160]
      },
      {
        "class": "cat", 
        "confidence": 0.82,
        "bbox": [300, 150, 380, 230]
      }
    ]
  }
}
```

**Response (Failed):**
```json
{
  "jobId": "job_1701944200000_abc123",
  "status": "failed",
  "timestamp": "2023-12-07T10:30:18.000Z",
  "error": "Model inference failed",
  "details": "ONNX Runtime error: Invalid input dimensions"
}
```

**Status Codes:**
- `200 OK` - Job status retrieved successfully
- `404 Not Found` - Job ID not found
- `400 Bad Request` - Invalid job ID format
- `500 Internal Server Error` - Server error

**Error Codes:**
- `JOB_NOT_FOUND` - Job ID does not exist
- `INVALID_JOB_ID` - Job ID format is invalid
- `SERVICE_UNAVAILABLE` - Redis unavailable

**Job Statuses:**
- `pending` - Job is queued for processing
- `processing` - Job is currently being processed
- `completed` - Job finished successfully
- `failed` - Job failed during processing

---

#### `GET /`

Serves the main web interface.

**Response:** HTML page with the cat counter application

---

#### `GET /static/*`

Serves static assets (CSS, JavaScript, images).

**Response:** Static file content with appropriate MIME types

---

## ML Service API

Base URL: `http://localhost:8000`

### Model Information

The ML service supports multiple YOLO models with automatic fallback:
1. **YOLO-NAS** (Primary, Apache 2.0 licensed)
2. **YOLOv5l** (Fallback)
3. **YOLOv11m** (Fallback) 
4. **YOLOv8m** (Fallback)
5. **YOLOv5s** (Fallback)

### Endpoints

#### `GET /health`

Health check endpoint with model status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "uptime": 7200.3,
  "version": "1.0.0",
  "service": "ml-service",
  "models": {
    "loaded": ["yolo-nas", "yolov5l"],
    "active": "yolo-nas",
    "totalModels": 2
  },
  "system": {
    "memory": "2.1GB / 8GB",
    "cpu": "15%",
    "gpu": "available"
  }
}
```

**Status Codes:**
- `200 OK` - Service is healthy
- `503 Service Unavailable` - Service is degraded

---

#### `GET /queue-status`

Get current job queue information.

**Response:**
```json
{
  "timestamp": "2023-12-07T10:30:00.000Z",
  "queue": {
    "pending": 3,
    "processing": 1,
    "completed": 157,
    "failed": 2
  },
  "performance": {
    "averageProcessingTime": "0.145s",
    "throughput": "6.8 jobs/minute",
    "successRate": "98.7%"
  }
}
```

---

#### `POST /process` (Internal)

Process an image for object detection. This endpoint is typically called internally by the job queue system.

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "jobId": "job_1701944200000_abc123",
  "imageData": "base64-encoded-image-data",
  "imageFormat": "jpeg",
  "parameters": {
    "confidenceThreshold": 0.5,
    "model": "yolo-nas"
  }
}
```

**Response (Success):**
```json
{
  "jobId": "job_1701944200000_abc123",
  "status": "completed",
  "result": {
    "cats": 2,
    "confidence": 0.87,
    "processingTime": "0.156s",
    "model": "yolo-nas",
    "imageSize": [640, 480],
    "detections": [
      {
        "class": "cat",
        "confidence": 0.92,
        "bbox": [120, 80, 200, 160],
        "area": 6400
      }
    ]
  },
  "metadata": {
    "modelVersion": "yolo-nas-1.0",
    "preprocessingTime": "0.012s",
    "inferenceTime": "0.134s",
    "postprocessingTime": "0.010s"
  }
}
```

**Status Codes:**
- `200 OK` - Processing completed successfully
- `400 Bad Request` - Invalid request format
- `422 Unprocessable Entity` - Invalid image data
- `500 Internal Server Error` - Processing error

---

## Error Handling

### Standard Error Response Format

All APIs use a consistent error response format:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "message": "Detailed explanation of the error",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "requestId": "req_abc123def456",
  "details": {
    "field": "additional context",
    "suggestion": "how to fix the error"
  }
}
```

### Common Error Codes

#### Web Client Errors
- `FILE_TOO_LARGE` - File exceeds 10MB limit
- `INVALID_FILE_TYPE` - Unsupported file format
- `MISSING_FILE` - No file in upload request
- `JOB_NOT_FOUND` - Job ID doesn't exist
- `INVALID_JOB_ID` - Malformed job ID
- `SERVICE_UNAVAILABLE` - Dependent service unavailable
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Unexpected server error

#### ML Service Errors
- `MODEL_NOT_LOADED` - Requested model not available
- `INVALID_IMAGE_DATA` - Corrupted or invalid image
- `PROCESSING_TIMEOUT` - Inference took too long
- `INSUFFICIENT_MEMORY` - Not enough memory for processing
- `INVALID_PARAMETERS` - Bad processing parameters

### HTTP Status Code Usage

- `200 OK` - Successful operation
- `400 Bad Request` - Client error (invalid input)
- `404 Not Found` - Resource not found
- `413 Payload Too Large` - File too large
- `422 Unprocessable Entity` - Valid format but invalid content
- `429 Too Many Requests` - Rate limited
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service temporarily unavailable

## Security Considerations

### Input Validation

All endpoints validate inputs:
- **File Type**: Magic byte detection, not just MIME type
- **File Size**: Enforced limits prevent DoS attacks
- **Request Format**: Schema validation for all JSON inputs
- **Parameter Ranges**: Numeric parameters have defined ranges

### Rate Limiting

Upload endpoints are rate-limited:
- **Limit**: 100 requests per 15 minutes per IP
- **Headers**: Rate limit status included in responses
- **Bypass**: No bypass mechanism in demo (implement for production)

### Content Security Policy

- **Script Sources**: Only self-hosted scripts allowed
- **Object Sources**: No objects or embeds permitted
- **Connect Sources**: Limited to ML service endpoint

### CORS Policy

- **Development**: Localhost origins allowed
- **Production**: Configure `ALLOWED_ORIGINS` environment variable

## Performance Characteristics

### Typical Response Times

- **Health Check**: < 10ms
- **File Upload**: 100ms - 2s (network dependent)
- **Status Check**: < 50ms
- **ML Processing**: 130ms - 170ms

### Throughput Limits

- **Upload Rate**: Limited by rate limiting (100/15min)
- **Processing Rate**: ~6-8 jobs/minute per ML service instance
- **Concurrent Jobs**: Limited by available memory

### Scaling Considerations

- **Horizontal Scaling**: Add more ML service instances
- **Load Balancing**: Distribute across multiple web client instances
- **Queue Management**: Redis handles job distribution
- **Resource Monitoring**: Watch memory and CPU usage

## Examples

### Complete Upload and Processing Flow

```bash
# 1. Upload an image
RESPONSE=$(curl -s -X POST http://localhost:3000/upload \
  -F "image=@test-cat.jpg")

# Extract job ID
JOB_ID=$(echo $RESPONSE | jq -r '.jobId')

# 2. Poll for completion
while true; do
  STATUS=$(curl -s "http://localhost:3000/status/$JOB_ID")
  STATE=$(echo $STATUS | jq -r '.status')
  
  if [ "$STATE" = "completed" ] || [ "$STATE" = "failed" ]; then
    echo "Final result:"
    echo $STATUS | jq '.'
    break
  fi
  
  echo "Status: $STATE"
  sleep 1
done
```

### Error Handling Example

```javascript
async function uploadWithErrorHandling(file) {
  try {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      switch (result.code) {
        case 'FILE_TOO_LARGE':
          alert('File is too large. Please choose a smaller image.');
          break;
        case 'INVALID_FILE_TYPE':
          alert('Please upload a valid image file (JPEG, PNG, GIF, WebP, BMP).');
          break;
        case 'RATE_LIMIT_EXCEEDED':
          alert('Too many uploads. Please wait before trying again.');
          break;
        default:
          alert('Upload failed: ' + result.message);
      }
      return null;
    }
    
    return result.jobId;
  } catch (error) {
    console.error('Upload error:', error);
    alert('Network error. Please check your connection.');
    return null;
  }
}
```

## OpenAPI Specification

For automated API documentation and client generation, see the OpenAPI specification file at `docs/reference/openapi.yaml` (to be created separately if needed).

## Testing the API

### Unit Tests
```bash
# Run API unit tests
cd src/web-client
npm test -- --testPathPattern=tests/unit/api.test.js
```

### Integration Tests
```bash
# Run full integration tests
./scripts/test.sh --integration
```

### Manual Testing
```bash
# Test health endpoints
curl http://localhost:3000/health
curl http://localhost:8000/health

# Test file upload
curl -X POST http://localhost:3000/upload \
  -F "image=@tests/fixtures/real_cat.jpg"
```

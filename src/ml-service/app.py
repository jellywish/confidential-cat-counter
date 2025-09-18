import asyncio
import json
import time
import os
import logging
from typing import Optional, Dict, Any
from pathlib import Path
from datetime import datetime, timezone

import redis.asyncio as redis
from policy import load_policy_bundle, evaluate_input_policy, evaluate_output_policy, decision_to_dict
from audit import emit_audit
import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CCC ML Service",
    description="Confidential Cat Counter ML Processing Service",
    version="1.0.0"
)

# Global variables
redis_client = None
model_session = None
current_model_path = None
policy_bundle = None
policy_digest = None

class JobStatus(BaseModel):
    id: str
    status: str
    timestamp: str
    error: Optional[str] = None

class ProcessingResult(BaseModel):
    cats: int
    confidence: float
    processing_time: str
    model: str

async def get_redis_client():
    """Get Redis client with connection retry logic"""
    global redis_client
    if redis_client is None:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        redis_client = redis.from_url(redis_url, decode_responses=True)
        
        # Test connection
        try:
            await redis_client.ping()
            logger.info(f"✅ Connected to Redis at {redis_url}")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis: {e}")
            raise
    
    return redis_client

def load_onnx_model():
    """Load YOLO model if available, otherwise use mock"""
    global model_session, current_model_path
    
    # Try models in order of PERFORMANCE & LICENSING
    model_paths = [
        "/app/models/yolo_nas_l.onnx",   # 🚀 BEST: State-of-the-art + Apache 2.0 license
        "/app/models/yolov5l.onnx",      # Good detection but GPL-3.0 license
        "/app/models/yolo11m.onnx",      # Too conservative despite high mAP
        "/app/models/yolov8m.onnx",      # Too conservative
        "/app/models/yolov5s.onnx"       # Fallback
    ]
    current_model_path = None
    for path in model_paths:
        if os.path.exists(path):
            current_model_path = path
            break
    
    if current_model_path and os.path.exists(current_model_path):
        try:
            import onnxruntime as ort
            model_session = ort.InferenceSession(current_model_path)
            model_name = os.path.basename(current_model_path).replace('.onnx', '')
            logger.info(f"✅ ONNX model loaded: {current_model_path} ({model_name})")
            return True
        except Exception as e:
            logger.warning(f"⚠️  Failed to load ONNX model: {e}")
    else:
        logger.info(f"⚠️  No suitable model found, using mock detection")
    
    return False

def detect_cats_mock(image_path: str) -> Dict[str, Any]:
    """Mock cat detection for development"""
    start_time = time.time()
    
    # Simulate processing time
    time.sleep(1.0 + np.random.random() * 2.0)  # 1-3 seconds
    
    # Mock detection logic based on filename or random
    filename = os.path.basename(image_path).lower()
    
    if 'cat' in filename:
        cats = np.random.randint(1, 4)  # 1-3 cats
        confidence = 0.85 + np.random.random() * 0.1  # 0.85-0.95
    elif 'dog' in filename:
        cats = 0
        confidence = 0.9
    else:
        # Random detection
        cats = np.random.choice([0, 0, 0, 1, 1, 2])  # Bias toward 0-1 cats
        confidence = 0.6 + np.random.random() * 0.3  # 0.6-0.9
    
    processing_time = time.time() - start_time
    
    return {
        'cats': cats,
        'confidence': confidence,
        'processing_time': f"{processing_time:.2f}s",
        'model': 'mock'
    }

def detect_cats_onnx(image_path: str) -> Dict[str, Any]:
    """Real cat detection using YOLO ONNX model"""
    start_time = time.time()
    
    try:
        # Load and preprocess image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Could not load image: {image_path}")
            
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # YOLO preprocessing - resize to 640x640
        input_image = cv2.resize(image_rgb, (640, 640))
        input_image = input_image.astype(np.float32) / 255.0
        input_image = np.transpose(input_image, (2, 0, 1))  # HWC to CHW
        input_image = np.expand_dims(input_image, axis=0)   # Add batch dimension
        
        # Adaptive data type and input name based on model
        model_name = os.path.basename(current_model_path).replace('.onnx', '') if current_model_path else 'unknown'
        if 'yolov5' in model_name:
            # YOLOv5 models expect float16 and 'images' input
            input_image = input_image.astype(np.float16)
            input_name = 'images'
        elif 'yolo_nas' in model_name:
            # YOLO-NAS expects float32 and 'input' input
            input_image = input_image.astype(np.float32)
            input_name = 'input'
        else:
            # YOLOv8, YOLOv11 models expect float32 and 'images' input
            input_image = input_image.astype(np.float32)
            input_name = 'images'
        
        # Run inference with correct input name
        outputs = model_session.run(None, {input_name: input_image})
        
        # Post-process results with model-specific handling
        if 'yolo_nas' in model_name:
            # YOLO-NAS has two outputs: [boxes, class_probs]
            # outputs[0]: (1, 8400, 4) - bounding boxes [x, y, w, h]
            # outputs[1]: (1, 8400, 80) - class probabilities for 80 COCO classes
            boxes = outputs[0][0]      # Shape: (8400, 4)
            class_probs = outputs[1][0] # Shape: (8400, 80)
            
            cat_count = 0
            max_confidence = 0.0
            
            # Class 15 is 'cat' in COCO dataset
            cat_class_probs = class_probs[:, 15]  # Get cat probabilities for all detections
            
            # Apply confidence threshold for cat detection
            cat_threshold = 0.1  # Start with low threshold to see what we get
            
            # Debug: Check the top cat confidence scores
            top_cat_confidences = np.sort(cat_class_probs)[::-1][:10]  # Top 10
            logger.info(f"🔍 Top 10 cat confidences: {top_cat_confidences}")
            
            for i, cat_confidence in enumerate(cat_class_probs):
                if cat_confidence > cat_threshold:
                    # Get the bounding box for this detection
                    box = boxes[i]
                    x, y, w, h = box
                    
                    # Basic filtering: ensure reasonable box size (not too small/large)
                    if w > 10 and h > 10 and w < 600 and h < 600:
                        cat_count += 1
                        max_confidence = max(max_confidence, cat_confidence)
                        logger.info(f"🐱 Cat #{cat_count}: confidence={cat_confidence:.3f}, box=[{x:.1f},{y:.1f},{w:.1f},{h:.1f}]")
            
            logger.info(f"🐱 YOLO-NAS detected {cat_count} cats with max confidence {max_confidence:.3f}")
        else:
            # Standard YOLO format: [x, y, w, h, confidence, class_probs...]
            detections = outputs[0][0]  # Shape: [25200, 85] for YOLOv5s
            cat_count = 0
            max_confidence = 0.0
            
            for detection in detections:
                # detection format: [x, y, w, h, confidence, class_probs...]
                obj_confidence = detection[4]
                
                if obj_confidence > 0.7:  # Very high threshold for precision
                    class_probs = detection[5:]
                    class_id = np.argmax(class_probs)
                    class_confidence = class_probs[class_id]
                    final_confidence = obj_confidence * class_confidence
                    
                    # Class 15 is 'cat' in COCO dataset
                    if class_id == 15 and final_confidence > 0.75:
                        cat_count += 1
                        max_confidence = max(max_confidence, final_confidence)
        
        processing_time = time.time() - start_time
        
        # Determine model name from loaded model path
        model_name = 'unknown-onnx'
        if current_model_path:
            model_name = os.path.basename(current_model_path).replace('.onnx', '') + '-onnx'
        
        return {
            'cats': cat_count,
            'confidence': float(max_confidence),
            'processing_time': f"{processing_time:.2f}s",
            'model': model_name
        }
        
    except Exception as e:
        logger.error(f"ONNX detection error: {e}")
        # Fallback to mock
        return detect_cats_mock(image_path)

def detect_cats(image_path: str) -> Dict[str, Any]:
    """Main cat detection function"""
    if model_session is not None:
        return detect_cats_onnx(image_path)
    else:
        return detect_cats_mock(image_path)

async def process_job(job_data: Dict[str, Any]) -> None:
    """Process a single ML job"""
    job_id = job_data['id']
    filename = job_data['filename']
    image_path = f"/app/uploads/{filename}"
    
    redis_client = await get_redis_client()
    
    try:
        # PE Recommendation: Idempotency check to prevent duplicate processing
        job_key = f"job:{job_id}"
        existing_job = await redis_client.get(job_key)
        if existing_job:
            existing_data = json.loads(existing_job)
            if existing_data.get('status') in ['processing', 'completed']:
                logger.info(f"⚠️  Job {job_id} already {existing_data['status']} - skipping duplicate")
                return  # Skip processing duplicate job
        
        logger.info(f"🔄 Processing job {job_id}: {filename} ({job_data.get('size', 'unknown')} bytes)")
        
        # Update status to processing
        job_data['status'] = 'processing'
        job_data['processing_started'] = time.time()
        await redis_client.setex(job_key, 3600, json.dumps(job_data))
        
        # Input policy evaluation
        input_decision = evaluate_input_policy(job_data, policy_bundle)
        emit_audit("input_policy_decision", {
            "job_id": job_id,
            "decision": decision_to_dict(input_decision),
            "policy_digest": policy_digest,
        })
        if input_decision.action == 'deny':
            raise PermissionError(f"Input policy denied: {input_decision.reasons}")

        # Check if image file exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        # Run ML inference
        result = detect_cats(image_path)

        # Normalize result to JSON-serializable primitives before policy evaluation
        try:
            if 'cats' in result and hasattr(result['cats'], 'item'):
                result['cats'] = int(result['cats'])
            if 'confidence' in result and hasattr(result['confidence'], 'item'):
                result['confidence'] = float(result['confidence'])
        except Exception:
            # Best-effort normalization; continue to policy evaluation
            pass
        
        # Output policy evaluation
        output_decision = evaluate_output_policy(result, policy_bundle)
        emit_audit("output_policy_decision", {
            "job_id": job_id,
            "decision": decision_to_dict(output_decision),
            "policy_digest": policy_digest,
        })
        if output_decision.action == 'deny':
            raise PermissionError(f"Output policy denied: {output_decision.reasons}")
        elif output_decision.action == 'redact' and output_decision.redacted_output is not None:
            result = output_decision.redacted_output

        # Update job with results (convert numpy types to Python types)
        job_data.update({
            'status': 'completed',
            'cats': int(result['cats']) if hasattr(result.get('cats'), 'item') else int(result.get('cats', 0)),
            'confidence': float(result['confidence']) if hasattr(result.get('confidence'), 'item') else float(result.get('confidence', 0.0)),
            'processingTime': result['processing_time'],
            'model': result['model'],
            'completedAt': time.time()
        })
        
        await redis_client.setex(f"job:{job_id}", 3600, json.dumps(job_data))
        logger.info(f"✅ Job {job_id} completed: {result['cats']} cats detected in {result['processing_time']}")
        
    except Exception as e:
        logger.error(f"❌ Job {job_id} failed: {e}")
        
        job_data.update({
            'status': 'failed',
            'error': str(e),
            'failedAt': time.time()
        })
        
        await redis_client.setex(f"job:{job_id}", 3600, json.dumps(job_data))

async def job_worker():
    """Background worker to process ML jobs from Redis queue"""
    logger.info("🔄 ML job worker starting...")
    
    redis_client = await get_redis_client()
    
    while True:
        try:
            # Blocking pop from Redis queue (5 second timeout)
            result = await redis_client.brpop(['ml-jobs'], timeout=5)
            
            if result:
                queue_name, job_raw = result
                job_data = json.loads(job_raw)
                await process_job(job_data)
            
        except Exception as e:
            logger.error(f"Worker error: {e}")
            await asyncio.sleep(1)  # Prevent tight error loops

@app.on_event("startup")
async def startup():
    """Initialize the application"""
    logger.info("🚀 Starting ML service...")
    
    # Load ML model
    load_onnx_model()
    
    # Test Redis connection
    await get_redis_client()
    
    # Load policy bundle
    global policy_bundle, policy_digest
    policy_bundle, policy_digest = load_policy_bundle()

    # Start background job worker
    asyncio.create_task(job_worker())
    
    logger.info("✅ ML service ready")

@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    global redis_client
    if redis_client:
        await redis_client.close()
    logger.info("🛑 ML service stopped")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "CCC ML Service",
        "version": "1.0.0",
        "model_loaded": model_session is not None
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    try:
        redis_client = await get_redis_client()
        await redis_client.ping()
        redis_healthy = True
    except:
        redis_healthy = False
    
    return {
        "status": "healthy",
        "service": "ml-service",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model_loaded": model_session is not None,
        "redis_connected": redis_healthy,
        "policy_digest": policy_digest
    }

@app.get("/queue/status")
async def queue_status():
    """Get queue status for debugging"""
    try:
        redis_client = await get_redis_client()
        queue_length = await redis_client.llen('ml-jobs')
        
        return {
            "queue_length": queue_length,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "worker_status": "running"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Queue status error: {e}")

@app.post("/process")
async def process_image_direct():
    """Direct processing endpoint for testing"""
    # This could be used for direct testing without the queue
    return {"message": "Direct processing not implemented in Phase 1"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

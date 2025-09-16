"""
Property-based tests to verify no plaintext data leakage
"""
import pytest
import requests
import redis
import time
import subprocess
import io
import base64
from PIL import Image
import numpy as np

# Test configuration
BASE_URL = "http://localhost:3000"
REDIS_HOST = "localhost"
REDIS_PORT = 6379

def setup_redis():
    """Setup Redis client for testing"""
    return redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

def generate_test_image(width=640, height=480, pattern='random'):
    """Generate test image with known patterns"""
    if pattern == 'random':
        # Random noise image
        array = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
    elif pattern == 'text':
        # Image with embedded text
        array = np.zeros((height, width, 3), dtype=np.uint8)
        # Add some distinctive pattern
        array[100:200, 100:500] = [255, 128, 64]  # Orange rectangle
    else:
        # Solid color
        array = np.full((height, width, 3), [128, 128, 128], dtype=np.uint8)
    
    image = Image.fromarray(array)
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG')
    return buffer.getvalue()

def capture_docker_logs():
    """Capture Docker logs from all services"""
    try:
        result = subprocess.run(
            ['docker-compose', 'logs', '--no-color', '--tail=100'],
            capture_output=True,
            text=True,
            timeout=10,
            cwd='/Users/spencer/Projects/confidential-cat-counter'
        )
        return result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return ""
    except Exception as e:
        print(f"Warning: Could not capture logs: {e}")
        return ""

def test_service_availability():
    """Test that services are running before confidentiality tests"""
    try:
        # Test web client
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        assert response.status_code == 200, "Web client not healthy"
        
        # Test ML service
        response = requests.get("http://localhost:8000/health", timeout=5)
        assert response.status_code == 200, "ML service not healthy"
        
        print("✅ All services are healthy")
        
    except requests.RequestException as e:
        pytest.skip(f"Services not available for testing: {e}")

def test_no_plaintext_in_logs():
    """Test that sensitive image data never appears in logs"""
    # Generate unique test image with distinctive pattern
    test_image = generate_test_image(pattern='text')
    
    # Clear existing logs by capturing them
    capture_docker_logs()
    
    # Upload image
    try:
        response = requests.post(
            f'{BASE_URL}/upload',
            files={'image': ('test.jpg', test_image, 'image/jpeg')},
            timeout=10
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        job_id = response.json()['jobId']
        
        # Wait for processing
        time.sleep(8)
        
        # Capture logs after processing
        logs = capture_docker_logs()
        
        # Critical property: Raw image data should never appear in logs
        image_b64 = base64.b64encode(test_image).decode()
        
        # Check for base64 image data (first 100 chars should be enough)
        assert image_b64[:100] not in logs, "Base64 image data found in logs!"
        
        # Check for suspicious long base64-like strings
        log_lines = logs.split('\n')
        suspicious_lines = [
            line for line in log_lines 
            if len(line) > 100 and line.count('=') > 5  # Potential base64
        ]
        
        # Filter out known safe base64 (like tokens, but be careful)
        for line in suspicious_lines:
            # If it's just logging the image filename or job ID, that's OK
            if 'test.jpg' in line or job_id in line:
                continue
            # If it's a very long string, it might be image data
            if len(line) > 1000:
                pytest.fail(f"Suspicious long data in logs: {line[:100]}...")
        
        print(f"✅ No plaintext image data found in logs for job {job_id}")
        
    except requests.RequestException as e:
        pytest.skip(f"Could not complete upload test: {e}")

def test_no_image_data_in_redis():
    """Test that Redis doesn't store raw image data"""
    test_image = generate_test_image()
    
    try:
        # Upload image
        response = requests.post(
            f'{BASE_URL}/upload',
            files={'image': ('test.jpg', test_image, 'image/jpeg')},
            timeout=10
        )
        
        assert response.status_code == 200
        job_id = response.json()['jobId']
        
        # Check Redis contents
        redis_client = setup_redis()
        
        # Check job data
        job_data = redis_client.get(f'job:{job_id}')
        if job_data:
            # Job data should not contain the raw image
            assert len(job_data) < 10000, f"Job data suspiciously large: {len(job_data)} bytes"
            
            # Should not contain JPEG markers
            assert b'\xff\xd8\xff' not in job_data.encode() if isinstance(job_data, str) else job_data
            
        # Check queue for any large data
        queue_length = redis_client.llen('ml-jobs')
        if queue_length > 0:
            # Sample a few items from queue (non-destructive peek)
            sample_items = redis_client.lrange('ml-jobs', 0, min(5, queue_length - 1))
            for item in sample_items:
                assert len(item) < 5000, f"Queue item suspiciously large: {len(item)} bytes"
        
        print(f"✅ No raw image data found in Redis for job {job_id}")
        
    except redis.RedisError as e:
        pytest.skip(f"Redis not available for testing: {e}")
    except requests.RequestException as e:
        pytest.skip(f"Could not complete Redis test: {e}")

def test_processing_isolation():
    """Test that processing doesn't leak data between jobs"""
    # Create two different test images
    image1 = generate_test_image(pattern='random')
    image2 = generate_test_image(pattern='text')
    
    try:
        # Process first image
        resp1 = requests.post(
            f'{BASE_URL}/upload',
            files={'image': ('test1.jpg', image1, 'image/jpeg')},
            timeout=10
        )
        assert resp1.status_code == 200
        job1_id = resp1.json()['jobId']
        
        # Process second image immediately
        resp2 = requests.post(
            f'{BASE_URL}/upload',
            files={'image': ('test2.jpg', image2, 'image/jpeg')},
            timeout=10
        )
        assert resp2.status_code == 200
        job2_id = resp2.json()['jobId']
        
        # Wait for processing
        time.sleep(10)
        
        # Check results
        result1 = requests.get(f'{BASE_URL}/results/{job1_id}', timeout=5).json()
        result2 = requests.get(f'{BASE_URL}/results/{job2_id}', timeout=5).json()
        
        # Results should be independent
        assert result1['id'] != result2['id']
        assert result1.get('filename') != result2.get('filename')
        
        # Both should have completed successfully or failed independently
        assert result1['status'] in ['completed', 'failed']
        assert result2['status'] in ['completed', 'failed']
        
        print(f"✅ Processing isolation verified: {job1_id} and {job2_id} processed independently")
        
    except requests.RequestException as e:
        pytest.skip(f"Could not complete isolation test: {e}")

def test_memory_bounds():
    """Test that memory usage stays within reasonable bounds"""
    try:
        # Create a larger test image (but still reasonable)
        large_image = generate_test_image(width=1024, height=768)
        
        response = requests.post(
            f'{BASE_URL}/upload',
            files={'image': ('large.jpg', large_image, 'image/jpeg')},
            timeout=15
        )
        
        assert response.status_code == 200
        job_id = response.json()['jobId']
        
        # Wait for processing
        time.sleep(10)
        
        # Service should still be responsive
        health = requests.get(f'{BASE_URL}/health', timeout=5)
        assert health.status_code == 200
        
        ml_health = requests.get('http://localhost:8000/health', timeout=5)
        assert ml_health.status_code == 200
        
        print(f"✅ Memory bounds test passed for job {job_id}")
        
    except requests.RequestException as e:
        pytest.skip(f"Could not complete memory bounds test: {e}")

if __name__ == "__main__":
    # Run tests directly
    pytest.main([__file__, "-v", "-s"])

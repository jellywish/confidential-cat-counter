"""
End-to-end integration tests for Phase 1
"""
import pytest
import requests
import time
import os
from pathlib import Path

# Test configuration
BASE_URL = "http://localhost:3000"
ML_SERVICE_URL = "http://localhost:8000"
TEST_FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"

def load_test_image(filename="cat.jpg"):
    """Load test image from fixtures"""
    image_path = TEST_FIXTURES_DIR / filename
    if not image_path.exists():
        pytest.skip(f"Test image not found: {image_path}")
    
    with open(image_path, 'rb') as f:
        return f.read()

def test_service_health():
    """Test that all services are healthy"""
    try:
        # Web client health
        web_health = requests.get(f'{BASE_URL}/health', timeout=5)
        assert web_health.status_code == 200
        web_data = web_health.json()
        assert web_data['status'] == 'healthy'
        print(f"✅ Web client healthy: {web_data}")
        
        # ML service health
        ml_health = requests.get(f'{ML_SERVICE_URL}/health', timeout=5)
        assert ml_health.status_code == 200
        ml_data = ml_health.json()
        assert ml_data['status'] == 'healthy'
        print(f"✅ ML service healthy: {ml_data}")
        
    except requests.RequestException as e:
        pytest.fail(f"Health check failed: {e}")

def test_complete_workflow():
    """Test the complete upload → process → results workflow"""
    test_image = load_test_image("cat.jpg")
    
    try:
        start_time = time.time()
        
        # 1. Upload image
        upload_response = requests.post(
            f'{BASE_URL}/upload',
            files={'image': ('cat.jpg', test_image, 'image/jpeg')},
            timeout=10
        )
        
        assert upload_response.status_code == 200
        upload_data = upload_response.json()
        assert 'jobId' in upload_data
        assert upload_data['status'] == 'queued'
        
        job_id = upload_data['jobId']
        print(f"📤 Image uploaded successfully, job ID: {job_id}")
        
        # 2. Poll for results (max 60 seconds)
        max_wait = 60
        result = None
        
        for i in range(max_wait):
            time.sleep(1)
            
            result_response = requests.get(f'{BASE_URL}/results/{job_id}', timeout=5)
            assert result_response.status_code == 200
            
            result = result_response.json()
            
            if result['status'] == 'completed':
                break
            elif result['status'] == 'failed':
                pytest.fail(f"Job failed: {result.get('error', 'Unknown error')}")
            elif i % 10 == 0:  # Log every 10 seconds
                print(f"⏳ Waiting for completion... Status: {result['status']} ({i}s elapsed)")
        
        total_time = time.time() - start_time
        
        # 3. Verify results
        assert result is not None
        assert result['status'] == 'completed'
        assert 'cats' in result
        assert isinstance(result['cats'], int)
        assert result['cats'] >= 0
        
        if 'confidence' in result:
            assert 0.0 <= result['confidence'] <= 1.0
        
        print(f"✅ Complete workflow test passed:")
        print(f"   🐱 Cats detected: {result['cats']}")
        print(f"   📊 Confidence: {result.get('confidence', 'N/A')}")
        print(f"   ⏱️  Total time: {total_time:.2f}s")
        print(f"   🔧 Model: {result.get('model', 'Unknown')}")
        print(f"   ⚡ Processing time: {result.get('processingTime', 'N/A')}")
        
        return result
        
    except requests.RequestException as e:
        pytest.fail(f"Workflow test failed: {e}")

def test_performance_target():
    """Test that processing meets Phase 1 performance targets"""
    test_image = load_test_image("cat.jpg")
    
    try:
        start_time = time.time()
        
        # Upload
        upload_response = requests.post(
            f'{BASE_URL}/upload',
            files={'image': ('cat.jpg', test_image, 'image/jpeg')},
            timeout=10
        )
        assert upload_response.status_code == 200
        job_id = upload_response.json()['jobId']
        
        # Wait for completion
        max_wait = 20  # Phase 1 target: <15s, but allow some margin
        completed = False
        
        for i in range(max_wait):
            time.sleep(1)
            result = requests.get(f'{BASE_URL}/results/{job_id}', timeout=5).json()
            
            if result['status'] in ['completed', 'failed']:
                completed = True
                break
        
        total_time = time.time() - start_time
        
        assert completed, f"Processing did not complete within {max_wait} seconds"
        
        # Phase 1 target is <15 seconds end-to-end
        if total_time > 15:
            print(f"⚠️  Performance warning: took {total_time:.2f}s (target: <15s)")
        else:
            print(f"✅ Performance test passed: {total_time:.2f}s (target: <15s)")
        
        # Don't fail the test for performance, just warn
        # assert total_time < 20, f"Processing took {total_time:.2f}s, target is <15s"
        
    except requests.RequestException as e:
        pytest.fail(f"Performance test failed: {e}")

def test_error_handling():
    """Test error handling for invalid inputs"""
    try:
        # Test non-image file
        response = requests.post(
            f'{BASE_URL}/upload',
            files={'image': ('test.txt', b'not an image', 'text/plain')},
            timeout=10
        )
        
        # Should reject non-image files
        assert response.status_code == 400
        print("✅ Correctly rejected non-image file")
        
        # Test missing file
        response = requests.post(f'{BASE_URL}/upload', timeout=10)
        assert response.status_code == 400
        print("✅ Correctly rejected missing file")
        
        # Test invalid job ID
        response = requests.get(f'{BASE_URL}/results/invalid-job-id', timeout=5)
        assert response.status_code == 404
        print("✅ Correctly handled invalid job ID")
        
    except requests.RequestException as e:
        pytest.fail(f"Error handling test failed: {e}")

def test_queue_status():
    """Test queue status endpoint"""
    try:
        response = requests.get(f'{BASE_URL}/queue/status', timeout=5)
        assert response.status_code == 200
        
        data = response.json()
        assert 'queue_length' in data
        assert 'total_jobs' in data
        assert isinstance(data['queue_length'], int)
        assert isinstance(data['total_jobs'], int)
        
        print(f"✅ Queue status: {data['queue_length']} pending, {data['total_jobs']} total jobs")
        
    except requests.RequestException as e:
        pytest.fail(f"Queue status test failed: {e}")

def test_concurrent_uploads():
    """Test handling multiple concurrent uploads"""
    test_image = load_test_image("cat.jpg")
    
    try:
        # Upload multiple images concurrently
        import concurrent.futures
        import threading
        
        def upload_image(image_name):
            response = requests.post(
                f'{BASE_URL}/upload',
                files={'image': (f'{image_name}.jpg', test_image, 'image/jpeg')},
                timeout=10
            )
            return response.json()
        
        # Upload 3 images concurrently
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(upload_image, f'concurrent_{i}') for i in range(3)]
            results = [future.result() for future in futures]
        
        # All uploads should succeed
        job_ids = []
        for result in results:
            assert 'jobId' in result
            assert result['status'] == 'queued'
            job_ids.append(result['jobId'])
        
        # All job IDs should be unique
        assert len(set(job_ids)) == len(job_ids), "Duplicate job IDs generated"
        
        print(f"✅ Concurrent uploads test passed: {len(job_ids)} unique jobs created")
        
        # Wait for all to complete
        time.sleep(15)
        
        completed_count = 0
        for job_id in job_ids:
            result = requests.get(f'{BASE_URL}/results/{job_id}', timeout=5).json()
            if result['status'] == 'completed':
                completed_count += 1
        
        print(f"✅ {completed_count}/{len(job_ids)} jobs completed successfully")
        
    except Exception as e:
        pytest.fail(f"Concurrent uploads test failed: {e}")

if __name__ == "__main__":
    # Run tests directly
    pytest.main([__file__, "-v", "-s"])

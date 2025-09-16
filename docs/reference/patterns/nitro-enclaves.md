# AWS Nitro Enclaves Workshop Best Practices & Patterns

**Source**: `aws-samples/aws-nitro-enclaves-workshop`  
**Date**: January 2025  
**Purpose**: Capture proven patterns for immediate use in CCC Project implementation

---

## Executive Summary

**Key Insight**: Start simple, build incrementally, and always implement attestation-first development. The workshop provides battle-tested patterns that eliminate common pitfalls.

**Most Critical Patterns for CCC Project:**
1. **Incremental complexity**: hello world → networking → encryption → attestation
2. **Graceful attestation handling**: development fallbacks with production security
3. **Comprehensive logging**: debug attestation issues before they become blockers
4. **VSOCK communication patterns**: reliable parent-enclave communication

---

## Development Progression Pattern

### **Step 1: Minimal Enclave (Hello World)**
**Purpose**: Verify enclave startup and basic communication

```python
# minimal_enclave.py
import json
import socket

def main():
    # Simple VSOCK server
    vsock = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
    vsock.bind((socket.VMADDR_CID_ANY, 5000))
    vsock.listen()
    
    print("Enclave listening on port 5000")
    
    while True:
        conn, addr = vsock.accept()
        data = conn.recv(1024)
        
        response = {
            "status": "success",
            "message": "Hello from enclave!",
            "received": data.decode()
        }
        
        conn.send(json.dumps(response).encode())
        conn.close()

if __name__ == "__main__":
    main()
```

**Dockerfile Pattern:**
```dockerfile
FROM public.ecr.aws/amazonlinux/amazonlinux:2023

# Install Python
RUN yum update -y && yum install -y python3

# Copy application
COPY minimal_enclave.py /app/
WORKDIR /app

# Non-root user for security
RUN useradd -m enclave-user
USER enclave-user

CMD ["python3", "minimal_enclave.py"]
```

### **Step 2: Add Attestation Generation**
**Purpose**: Implement attestation document handling early

```python
# attestation_enclave.py
import json
import socket
import subprocess

def get_attestation_document():
    """Generate attestation document using nitro-cli"""
    try:
        result = subprocess.run([
            '/usr/bin/nitro-cli', 'describe-enclaves'
        ], capture_output=True, text=True, check=True)
        
        # In real enclave, use:
        # /usr/bin/nitro-cli get-attestation-document
        
        return {"status": "success", "attestation": "mock-attestation"}
    except subprocess.CalledProcessError as e:
        return {"status": "error", "message": str(e)}

def main():
    vsock = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
    vsock.bind((socket.VMADDR_CID_ANY, 5000))
    vsock.listen()
    
    print("Attestation-enabled enclave listening on port 5000")
    
    while True:
        conn, addr = vsock.accept()
        data = json.loads(conn.recv(1024).decode())
        
        if data.get('action') == 'get_attestation':
            response = get_attestation_document()
        else:
            response = {"status": "error", "message": "Unknown action"}
        
        conn.send(json.dumps(response).encode())
        conn.close()

if __name__ == "__main__":
    main()
```

### **Step 3: Add KMS Integration**
**Purpose**: Connect attestation to key management

```python
# kms_enclave.py
import json
import socket
import boto3
import base64
from cryptography.fernet import Fernet

class EnclaveKMSHandler:
    def __init__(self):
        self.kms_client = boto3.client('kms', region_name='us-west-2')
        self.data_key = None
    
    def get_data_key_with_attestation(self):
        """Get data key using attestation document"""
        try:
            # Get attestation document
            attestation_doc = self._get_attestation_document()
            
            # Request data key from KMS with attestation
            response = self.kms_client.decrypt(
                CiphertextBlob=base64.b64decode(encrypted_data_key),
                EncryptionContext={},
                # Attestation document will be automatically included
                # by KMS when running in Nitro Enclave
            )
            
            self.data_key = response['Plaintext']
            return {"status": "success"}
            
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def decrypt_data(self, encrypted_data):
        """Decrypt data using the data key"""
        if not self.data_key:
            return {"status": "error", "message": "No data key available"}
        
        try:
            f = Fernet(base64.urlsafe_b64encode(self.data_key[:32]))
            decrypted = f.decrypt(encrypted_data.encode())
            return {"status": "success", "data": decrypted.decode()}
        except Exception as e:
            return {"status": "error", "message": str(e)}
```

---

## VSOCK Communication Patterns

### **Reliable Parent-Enclave Communication**

**Parent Process (EC2 Host):**
```python
# parent_communicator.py
import socket
import json
import time

class EnclaveClient:
    def __init__(self, enclave_cid, port=5000):
        self.enclave_cid = enclave_cid
        self.port = port
    
    def send_request(self, data, timeout=30):
        """Send request to enclave with retry logic"""
        for attempt in range(3):
            try:
                sock = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
                sock.settimeout(timeout)
                sock.connect((self.enclave_cid, self.port))
                
                # Send request
                request = json.dumps(data).encode()
                sock.send(request)
                
                # Receive response
                response = sock.recv(4096)
                sock.close()
                
                return json.loads(response.decode())
                
            except (socket.timeout, ConnectionRefusedError) as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt < 2:
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    raise
    
    def get_enclave_cid(self):
        """Get enclave CID from nitro-cli"""
        import subprocess
        result = subprocess.run([
            'nitro-cli', 'describe-enclaves'
        ], capture_output=True, text=True)
        
        enclaves = json.loads(result.stdout)
        if enclaves:
            return enclaves[0]['EnclaveCID']
        raise Exception("No running enclaves found")
```

**Message Format Patterns:**
```python
# Standard message formats for parent-enclave communication

# Request formats
REQUEST_FORMATS = {
    "attestation": {
        "action": "get_attestation",
        "timestamp": "2025-01-15T10:30:00Z"
    },
    "decrypt": {
        "action": "decrypt_data",
        "encrypted_data": "base64-encoded-data",
        "request_id": "unique-request-id"
    },
    "health_check": {
        "action": "health_check"
    }
}

# Response formats
RESPONSE_FORMATS = {
    "success": {
        "status": "success",
        "data": "response-data",
        "request_id": "unique-request-id"
    },
    "error": {
        "status": "error",
        "message": "error description",
        "error_code": "ERROR_CODE",
        "request_id": "unique-request-id"
    }
}
```

---

## Attestation Handling Patterns

### **Graceful Attestation Development**

```python
# attestation_handler.py
import os
import json
import logging

class AttestationHandler:
    def __init__(self):
        self.environment = os.getenv('ENVIRONMENT', 'development')
        self.logger = logging.getLogger(__name__)
    
    def get_attestation_document(self):
        """Get attestation with environment-aware fallbacks"""
        if self.environment == 'development':
            return self._get_mock_attestation()
        
        try:
            return self._get_real_attestation()
        except Exception as e:
            self.logger.error(f"Real attestation failed: {e}")
            
            if self.environment == 'staging':
                self.logger.warning("Falling back to mock attestation in staging")
                return self._get_mock_attestation()
            else:
                raise
    
    def _get_real_attestation(self):
        """Get real attestation document from Nitro Enclave"""
        import subprocess
        
        result = subprocess.run([
            '/usr/bin/nitro-cli', 'get-attestation-document'
        ], capture_output=True, check=True)
        
        attestation_doc = json.loads(result.stdout)
        
        # Log PCR values for debugging
        pcrs = attestation_doc.get('pcrs', {})
        self.logger.info(f"PCR0 (Image): {pcrs.get('0')}")
        self.logger.info(f"PCR1 (Kernel): {pcrs.get('1')}")
        self.logger.info(f"PCR2 (App): {pcrs.get('2')}")
        
        return attestation_doc
    
    def _get_mock_attestation(self):
        """Generate mock attestation for development"""
        return {
            "module_id": "i-1234567890abcdef0-enc-1234567890abcdef",
            "timestamp": "2025-01-15T10:30:00.000Z",
            "digest": "SHA384",
            "pcrs": {
                "0": "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
                "1": "111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
                "2": "222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222"
            },
            "certificate": "mock-certificate",
            "cabundle": ["mock-ca-bundle"],
            "public_key": "mock-public-key"
        }
```

### **Comprehensive Attestation Logging**

```python
# attestation_logger.py
import logging
import json

def setup_attestation_logging():
    """Configure comprehensive logging for attestation debugging"""
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Create specific logger for attestation
    attestation_logger = logging.getLogger('attestation')
    
    return attestation_logger

def log_attestation_details(attestation_doc, logger):
    """Log all relevant attestation information for debugging"""
    
    logger.info("=== ATTESTATION DOCUMENT ===")
    logger.info(f"Module ID: {attestation_doc.get('module_id')}")
    logger.info(f"Timestamp: {attestation_doc.get('timestamp')}")
    logger.info(f"Digest: {attestation_doc.get('digest')}")
    
    pcrs = attestation_doc.get('pcrs', {})
    logger.info("=== PCR VALUES ===")
    logger.info(f"PCR0 (Image SHA384): {pcrs.get('0')}")
    logger.info(f"PCR1 (Kernel+Ramdisk): {pcrs.get('1')}")
    logger.info(f"PCR2 (Application): {pcrs.get('2')}")
    
    logger.info("=== CERTIFICATE INFO ===")
    logger.info(f"Certificate Length: {len(attestation_doc.get('certificate', ''))}")
    logger.info(f"CA Bundle Entries: {len(attestation_doc.get('cabundle', []))}")
    
    # Log as JSON for machine parsing
    logger.debug(f"Full attestation document: {json.dumps(attestation_doc, indent=2)}")
```

---

## Error Handling Patterns

### **Enclave Error Recovery**

```python
# error_handling.py
import time
import logging
from enum import Enum

class EnclaveError(Exception):
    pass

class AttestationError(EnclaveError):
    pass

class KMSError(EnclaveError):
    pass

class ErrorCode(Enum):
    ATTESTATION_FAILED = "ATTESTATION_FAILED"
    KMS_UNAVAILABLE = "KMS_UNAVAILABLE"
    INVALID_REQUEST = "INVALID_REQUEST"
    ENCLAVE_TIMEOUT = "ENCLAVE_TIMEOUT"

class EnclaveErrorHandler:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.retry_delays = [1, 2, 4, 8]  # Exponential backoff
    
    def with_retry(self, func, max_retries=3, *args, **kwargs):
        """Execute function with retry logic"""
        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except (AttestationError, KMSError) as e:
                if attempt < max_retries - 1:
                    delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                    self.logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay}s")
                    time.sleep(delay)
                else:
                    self.logger.error(f"All {max_retries} attempts failed: {e}")
                    raise
    
    def handle_enclave_error(self, error, request_id=None):
        """Standard error response format"""
        error_response = {
            "status": "error",
            "error_code": self._get_error_code(error),
            "message": str(error),
            "timestamp": time.time()
        }
        
        if request_id:
            error_response["request_id"] = request_id
        
        self.logger.error(f"Enclave error: {error_response}")
        return error_response
    
    def _get_error_code(self, error):
        if isinstance(error, AttestationError):
            return ErrorCode.ATTESTATION_FAILED.value
        elif isinstance(error, KMSError):
            return ErrorCode.KMS_UNAVAILABLE.value
        else:
            return "UNKNOWN_ERROR"
```

---

## Build and Deployment Patterns

### **Deterministic Enclave Builds**

```dockerfile
# Dockerfile.enclave - Reproducible builds
FROM public.ecr.aws/amazonlinux/amazonlinux:2023

# Pin exact versions for reproducibility
RUN yum update -y && yum install -y \
    python3-3.9.16 \
    python3-pip-21.3.1 \
    && yum clean all

# Set fixed timestamp for reproducible builds
ENV SOURCE_DATE_EPOCH=1640995200

# Create non-root user
RUN useradd -u 1000 -m enclave-user

# Copy requirements and install exact versions
COPY requirements.lock /app/
WORKDIR /app
RUN pip install -r requirements.lock

# Copy application code
COPY --chown=enclave-user:enclave-user src/ /app/
USER enclave-user

# Fixed entrypoint
ENTRYPOINT ["python3", "main.py"]
```

```bash
# build_enclave.sh - Reproducible build script
#!/bin/bash
set -e

VERSION=${1:-latest}

echo "Building enclave version: $VERSION"

# Set reproducible build environment
export SOURCE_DATE_EPOCH=1640995200
export DOCKER_BUILDKIT=1

# Build Docker image
docker build \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --platform linux/x86_64 \
    -t ccc-enclave:$VERSION \
    -f Dockerfile.enclave \
    .

# Build EIF
nitro-cli build-enclave \
    --docker-uri ccc-enclave:$VERSION \
    --output-file ccc-enclave-$VERSION.eif

# Extract PCR measurements
nitro-cli describe-eif \
    --eif-path ccc-enclave-$VERSION.eif \
    --output-format json > pcr-measurements-$VERSION.json

echo "Build complete. EIF: ccc-enclave-$VERSION.eif"
echo "PCR measurements: pcr-measurements-$VERSION.json"
```

### **Enclave Deployment Pattern**

```bash
# deploy_enclave.sh
#!/bin/bash
set -e

EIF_PATH=${1}
MEMORY_MB=${2:-1024}
CPU_COUNT=${3:-2}

if [ -z "$EIF_PATH" ]; then
    echo "Usage: $0 <eif-path> [memory-mb] [cpu-count]"
    exit 1
fi

echo "Deploying enclave: $EIF_PATH"

# Stop any existing enclaves
nitro-cli terminate-enclave --all || true

# Wait for cleanup
sleep 2

# Start new enclave
ENCLAVE_ID=$(nitro-cli run-enclave \
    --eif-path $EIF_PATH \
    --memory $MEMORY_MB \
    --cpu-count $CPU_COUNT \
    --debug-mode \
    | jq -r '.EnclaveID')

echo "Enclave started with ID: $ENCLAVE_ID"

# Wait for enclave to be ready
sleep 5

# Get enclave details
nitro-cli describe-enclaves

echo "Deployment complete!"
```

---

## Testing Patterns

### **Enclave Testing Framework**

```python
# test_enclave.py
import unittest
import json
import time
from enclave_client import EnclaveClient

class TestEnclave(unittest.TestCase):
    def setUp(self):
        self.client = EnclaveClient(enclave_cid=16, port=5000)  # Standard test CID
    
    def test_enclave_health_check(self):
        """Test basic enclave connectivity"""
        response = self.client.send_request({"action": "health_check"})
        self.assertEqual(response["status"], "success")
    
    def test_attestation_generation(self):
        """Test attestation document generation"""
        response = self.client.send_request({"action": "get_attestation"})
        self.assertEqual(response["status"], "success")
        self.assertIn("attestation", response)
    
    def test_encryption_roundtrip(self):
        """Test data encryption and decryption"""
        test_data = "test secret data"
        
        # Request encryption
        encrypt_response = self.client.send_request({
            "action": "encrypt_data",
            "data": test_data
        })
        self.assertEqual(encrypt_response["status"], "success")
        
        # Request decryption
        decrypt_response = self.client.send_request({
            "action": "decrypt_data",
            "encrypted_data": encrypt_response["encrypted_data"]
        })
        self.assertEqual(decrypt_response["status"], "success")
        self.assertEqual(decrypt_response["data"], test_data)
    
    def test_error_handling(self):
        """Test enclave error handling"""
        response = self.client.send_request({"action": "invalid_action"})
        self.assertEqual(response["status"], "error")
        self.assertIn("message", response)

if __name__ == "__main__":
    unittest.main()
```

---

## Production Hardening Patterns

### **Resource Management**

```python
# resource_manager.py
import psutil
import logging

class EnclaveResourceManager:
    def __init__(self, max_memory_mb=512, max_cpu_percent=80):
        self.max_memory_mb = max_memory_mb
        self.max_cpu_percent = max_cpu_percent
        self.logger = logging.getLogger(__name__)
    
    def check_resource_limits(self):
        """Monitor enclave resource usage"""
        memory_usage = psutil.virtual_memory()
        cpu_usage = psutil.cpu_percent(interval=1)
        
        memory_mb = memory_usage.used / 1024 / 1024
        
        if memory_mb > self.max_memory_mb:
            self.logger.warning(f"Memory usage high: {memory_mb:.1f}MB")
            return False
        
        if cpu_usage > self.max_cpu_percent:
            self.logger.warning(f"CPU usage high: {cpu_usage:.1f}%")
            return False
        
        return True
    
    def get_resource_stats(self):
        """Get current resource statistics"""
        memory = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=1)
        
        return {
            "memory_used_mb": memory.used / 1024 / 1024,
            "memory_available_mb": memory.available / 1024 / 1024,
            "cpu_percent": cpu,
            "timestamp": time.time()
        }
```

### **Security Validation**

```python
# security_validator.py
import os
import logging

class SecurityValidator:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def validate_enclave_environment(self):
        """Validate that we're running in a secure enclave environment"""
        checks = [
            self._check_nitro_environment(),
            self._check_network_isolation(),
            self._check_file_permissions(),
            self._check_user_context()
        ]
        
        all_passed = all(checks)
        
        if all_passed:
            self.logger.info("All security validations passed")
        else:
            self.logger.error("Security validation failures detected")
        
        return all_passed
    
    def _check_nitro_environment(self):
        """Check if running in Nitro Enclave"""
        # Check for Nitro-specific files/devices
        nitro_indicators = [
            "/dev/nitro_enclaves",
            "/proc/cpuinfo"  # Should show Nitro-specific CPU info
        ]
        
        for indicator in nitro_indicators:
            if not os.path.exists(indicator):
                self.logger.warning(f"Nitro indicator missing: {indicator}")
                return False
        
        return True
    
    def _check_network_isolation(self):
        """Verify network isolation"""
        # In real enclave, only VSOCK should be available
        return True  # Simplified for example
    
    def _check_file_permissions(self):
        """Check file system permissions"""
        sensitive_paths = ["/app", "/tmp"]
        
        for path in sensitive_paths:
            if os.path.exists(path):
                stat = os.stat(path)
                if stat.st_mode & 0o077:  # World/group readable
                    self.logger.warning(f"Insecure permissions on {path}")
                    return False
        
        return True
    
    def _check_user_context(self):
        """Verify running as non-root user"""
        if os.getuid() == 0:
            self.logger.error("Running as root user - security risk")
            return False
        
        return True
```

---

## Integration Checklist for CCC Project

### **Phase 1 Implementation Checklist:**
- [ ] Use minimal enclave pattern for hello world
- [ ] Implement VSOCK communication with retry logic
- [ ] Add comprehensive logging from day 1
- [ ] Set up graceful attestation handling with dev fallbacks
- [ ] Create reproducible build pipeline
- [ ] Implement basic error handling patterns

### **Phase 2+ Enhancements:**
- [ ] Add KMS integration with attestation
- [ ] Implement resource monitoring
- [ ] Add security validation checks
- [ ] Create comprehensive test suite
- [ ] Set up production hardening

### **Key Files to Create:**
1. `src/enclave/minimal_enclave.py` - Starting point
2. `src/enclave/attestation_handler.py` - Attestation management
3. `src/enclave/error_handling.py` - Error patterns
4. `scripts/build_enclave.sh` - Reproducible builds
5. `tests/test_enclave.py` - Enclave testing

---

## References

**AWS Workshop**: [aws-samples/aws-nitro-enclaves-workshop](https://github.com/aws-samples/aws-nitro-enclaves-workshop)

**AWS Documentation**: 
- [Nitro Enclaves User Guide](https://docs.aws.amazon.com/enclaves/latest/user/)
- [nitro-cli Command Reference](https://docs.aws.amazon.com/enclaves/latest/user/nitro-cli.html)

**Key Workshop Modules**:
- Module 1: Basic enclave setup and communication
- Module 2: Attestation document generation
- Module 3: KMS integration with attestation
- Module 4: Production deployment patterns

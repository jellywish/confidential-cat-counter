# Manual Testing Guide - Code Quality Improvements

## 🧪 **Complete Manual Verification Process**

This guide walks you through testing all the code quality improvements we implemented.

## **Prerequisites**

1. **Start the services**:
```bash
cd /Users/spencer/Projects/confidential-cat-counter
docker-compose up -d
```

2. **Wait for services to be ready** (15-20 seconds):
```bash
# Check all services are healthy
curl http://localhost:3000/health
curl http://localhost:8000/health
```

---

## **🔒 Phase 1: Security Improvements Testing**

### **Test 1A: Content Security Policy (CSP)**
**What we fixed**: Replaced `contentSecurityPolicy: false` with proper security headers

**Test Steps**:
1. Open browser to `http://localhost:3000`
2. Open Developer Tools (F12) → Network tab
3. Refresh the page
4. Click on the main page request
5. Look for **Response Headers**

**✅ Expected Results**:
- Should see `Content-Security-Policy` header in response
- Should NOT see any CSP-related console errors
- Page should load normally with crypto functionality working

### **Test 1B: No Hardcoded Secrets**
**What we verified**: No sensitive credentials in code

**Test Steps**:
1. Search codebase for sensitive patterns:
```bash
# These should return no results in src/ files
grep -r "password\|secret\|AKIA\|sk_\|pk_" src/
```

**✅ Expected Results**:
- No hardcoded passwords, API keys, or credentials found
- Only references in node_modules (which is normal)

---

## **📝 Phase 2: Logging System Testing**

### **Test 2A: Professional Logging in Action**
**What we implemented**: Replaced console.log with structured logging

**Test Steps**:
1. **Check startup logs**:
```bash
docker-compose logs web-client | tail -10
```

2. **Upload a file to trigger job logging**:
```bash
curl -X POST http://localhost:3000/upload -F "image=@tests/fixtures/real_cat.jpg"
```

3. **Check recent logs**:
```bash
docker-compose logs web-client | tail -5
```

**✅ Expected Results**:
- Startup message: `🌐 Web client running` (not raw console.log)
- Job queued message with structured data
- Clean, professional log format
- No cluttered debug messages

### **Test 2B: Configurable Log Levels**
**What we implemented**: Environment-based log configuration

**Test Steps**:
1. **Test with DEBUG level** (current default):
```bash
# Should see detailed logs
docker-compose logs web-client | grep -E "(DEBUG|INFO|WARN|ERROR)"
```

2. **Test production mode**:
```bash
# Set to production and restart
export NODE_ENV=production
export LOG_LEVEL=ERROR
docker-compose restart web-client
sleep 5
curl -X POST http://localhost:3000/upload -F "image=@tests/fixtures/real_cat.jpg"
docker-compose logs web-client | tail -5
```

**✅ Expected Results**:
- Development: More verbose logging
- Production: Cleaner, timestamp-formatted logs
- Only errors show with ERROR level

---

## **🔧 Phase 3: Configuration Management Testing**

### **Test 3A: Environment-Based Service URLs**
**What we implemented**: Dynamic service URLs instead of hardcoded localhost

**Test Steps**:
1. **Check environment variables are working**:
```bash
docker-compose exec web-client printenv | grep -E "(ML_SERVICE_URL|REDIS_URL)"
```

2. **Verify CSP uses dynamic URL**:
```bash
curl -I http://localhost:3000 | grep -i content-security
```

**✅ Expected Results**:
- Environment variables set correctly in container
- CSP header includes `http://ml-service:8000` (not hardcoded localhost)

### **Test 3B: Docker Networking Configuration**
**What we verified**: Services communicate via internal Docker network

**Test Steps**:
1. **Test service communication**:
```bash
# Upload should work (web-client → ml-service communication)
curl -X POST http://localhost:3000/upload -F "image=@tests/fixtures/real_cat.jpg"
```

2. **Check queue communication**:
```bash
# This tests web-client → redis communication
curl http://localhost:3000/queue/status
```

**✅ Expected Results**:
- Upload returns job ID successfully
- Queue status returns job count
- No connection errors in logs

---

## **🛡️ Phase 4: Error Handling Testing**

### **Test 4A: User-Friendly Error Messages**
**What we implemented**: Clear, actionable error messages with codes

**Test Steps**:
1. **Test file size limit**:
```bash
# Create large file and try to upload
dd if=/dev/zero of=/tmp/large_test.jpg bs=1M count=15
curl -X POST http://localhost:3000/upload -F "image=@/tmp/large_test.jpg"
rm /tmp/large_test.jpg
```

2. **Test invalid file upload**:
```bash
curl -X POST http://localhost:3000/upload -F "notanimage=invalid"
```

3. **Test missing file**:
```bash
curl -X POST http://localhost:3000/upload
```

**✅ Expected Results**:
- Large file: `{"error":"File too large","message":"Please select an image smaller than 10MB","code":"FILE_TOO_LARGE"}`
- Invalid upload: Clear error message
- Missing file: `{"error":"No image file provided"}`

### **Test 4B: Error Handling Doesn't Break System**
**What we implemented**: Graceful fallbacks

**Test Steps**:
1. **After triggering errors above, test normal operation**:
```bash
curl -X POST http://localhost:3000/upload -F "image=@tests/fixtures/real_cat.jpg"
```

2. **Check system health**:
```bash
curl http://localhost:3000/health
curl http://localhost:8000/health
```

**✅ Expected Results**:
- Normal uploads still work after errors
- Health checks return 200 OK
- System remains stable

---

## **🎯 Complete End-to-End Workflow Test**

### **Test 5: Full System Integration**
**Test the complete improved system**:

**Test Steps**:
1. **Upload and process an image**:
```bash
# Upload
RESPONSE=$(curl -s -X POST http://localhost:3000/upload -F "image=@tests/fixtures/real_cat.jpg")
echo "Upload Response: $RESPONSE"

# Extract job ID
JOB_ID=$(echo $RESPONSE | grep -o '"jobId":"[^"]*' | cut -d'"' -f4)
echo "Job ID: $JOB_ID"

# Wait a moment for processing
sleep 5

# Check results
curl -s "http://localhost:3000/results/$JOB_ID" | head -3
```

2. **Test the web interface**:
   - Open `http://localhost:3000` in browser
   - Try drag & drop upload
   - Try "Choose Image" button
   - Check for any console errors (F12 → Console)

**✅ Expected Results**:
- Upload returns job ID
- Results show cat detection
- Web interface works smoothly
- No JavaScript console errors
- Professional error messages if something fails

---

## **🎨 Visual/Browser Testing**

### **Test 6: Frontend Experience**
1. **Open `http://localhost:3000`**
2. **Test file upload methods**:
   - Drag and drop an image
   - Click "Choose Image" button
   - Try uploading a too-large file

3. **Check Developer Console (F12)**:
   - Should see no errors
   - Network requests should complete successfully
   - Security headers should be present

**✅ Expected Results**:
- Smooth user experience
- Clear error messages in UI
- No console errors
- Professional appearance maintained

---

## **🔍 Log Monitoring During Testing**

### **Watch Logs in Real-Time**
Run this in a separate terminal to monitor logs during testing:

```bash
# Watch web client logs
docker-compose logs -f web-client

# In another terminal, watch ML service logs
docker-compose logs -f ml-service
```

**✅ Expected Log Quality**:
- Clean, structured log messages
- Appropriate log levels
- No cluttered debug output
- Professional formatting
- Helpful context in error messages

---

## **❌ Common Issues & Solutions**

### **If Services Won't Start**:
```bash
docker-compose down
docker-compose up -d --build
```

### **If Upload Fails**:
- Check file exists: `ls tests/fixtures/real_cat.jpg`
- Check file permissions
- Try a different image file

### **If Logs Look Wrong**:
- Check environment variables in container:
```bash
docker-compose exec web-client printenv | grep LOG
```

### **If Tests Fail**:
- Ensure you're in the correct directory: `/Users/spencer/Projects/confidential-cat-counter`
- Make sure all services are healthy before testing
- Check for any error messages in the logs

---

## **🏆 Success Criteria Summary**

**✅ All tests should show**:
- Security headers present
- Professional logging format
- Environment-based configuration
- User-friendly error messages
- System stability after errors
- Complete end-to-end functionality

**🎉 If all tests pass, the code quality improvements are working perfectly!**

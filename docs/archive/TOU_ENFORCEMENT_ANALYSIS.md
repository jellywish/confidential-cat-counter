# Terms of Use Enforcement in Confidential ML Systems: Analysis & Recommendations

## Current State of the Art in AI TOU Enforcement

### 1. Content Moderation APIs (Industry Standard)
**Available Services:**
- **OpenAI Moderation API**: Text-based content filtering (toxicity, hate speech, violence)
- **Azure AI Content Safety**: Text + image content moderation with custom categories
- **Google Perspective API**: Comment toxicity scoring and harassment detection
- **AWS Rekognition Content Moderation**: Image/video content filtering

**Limitations for Confidential Computing:**
- Requires sending data to external services (breaks confidentiality)
- APIs designed for text/general content, not specialized computer vision tasks
- Latency overhead (additional API calls)

### 2. Input/Output Validation Approaches
**Pattern-Based Filtering:**
```python
# Example: Pre-upload validation
def validate_image_upload(image_metadata):
    # Size limits
    if image_metadata.size > MAX_FILE_SIZE:
        return False, "File too large"
    
    # Format validation  
    if image_metadata.format not in ALLOWED_FORMATS:
        return False, "Invalid format"
    
    # Rate limiting by user/IP
    if check_rate_limit_exceeded(user_id):
        return False, "Rate limit exceeded"
        
    return True, "Valid"
```

**Behavioral Analysis:**
```python
# Example: Usage pattern detection
def detect_abuse_patterns(user_activity):
    patterns = [
        "bulk_upload_pattern",      # Many uploads in short time
        "batch_processing_pattern", # Automated/scripted usage
        "prohibited_content_pattern" # Specific content types
    ]
    
    for pattern in patterns:
        if pattern_detector.matches(user_activity, pattern):
            return True, pattern
    
    return False, None
```

### 3. Guardrails and Safety Layers

**Multi-Layer Defense:**
1. **Pre-processing Guards**: Input validation, format checking, size limits
2. **Processing Guards**: Resource limits, timeout controls, anomaly detection
3. **Post-processing Guards**: Output validation, result filtering

**Example Implementation:**
```rust
pub struct SafetyGuards {
    input_validator: InputValidator,
    abuse_detector: AbuseDetector,
    rate_limiter: RateLimiter,
    content_filter: ContentFilter,
}

impl SafetyGuards {
    pub fn validate_request(&self, request: &InferenceRequest) -> Result<(), SafetyViolation> {
        self.input_validator.validate(&request.image)?;
        self.rate_limiter.check_limits(&request.user_id)?;
        self.abuse_detector.analyze_patterns(&request)?;
        Ok(())
    }
}
```

## Challenges Specific to Confidential Computing

### 1. The Confidentiality vs. Monitoring Dilemma
- **Traditional Approach**: Monitor all content for abuse
- **Confidential Computing**: Content must remain encrypted/opaque to operator
- **Tension**: How to enforce policies without seeing the data?

### 2. Limited Observability
- Can't log actual image content or ML results
- Can only monitor metadata, patterns, and resource usage
- Harder to debug false positives/negatives

### 3. Trust Boundary Considerations
- Abuse detection must happen inside TEE or before encryption
- External APIs break confidentiality guarantees
- Need self-contained safety mechanisms

## Recommended Approaches for Confidential Cat Counter

### Option 1: Metadata-Based TOU Enforcement (RECOMMENDED)
**Approach**: Enforce policies based on observable metadata without accessing content

**Implementation:**
```typescript
interface TOUEnforcement {
  // Rate limiting (observable)
  maxUploadsPerHour: number;
  maxUploadsPerDay: number;
  
  // Resource limits (observable)
  maxFileSizeBytes: number;
  maxProcessingTimeSeconds: number;
  
  // Pattern detection (observable)
  detectBulkUpload: boolean;
  detectAutomatedUsage: boolean;
  
  // Content constraints (enforceable pre-encryption)
  allowedFormats: string[];
  minImageDimensions: [number, number];
  maxImageDimensions: [number, number];
}
```

**Benefits:**
- ✅ Preserves confidentiality
- ✅ Low implementation complexity  
- ✅ High performance (no external API calls)
- ✅ Educational value for reference architecture

**Limitations:**
- ❌ Can't detect actual content violations (e.g., non-cat images)
- ❌ Sophisticated abuse may bypass metadata-only detection

### Option 2: In-TEE Content Analysis (ADVANCED)
**Approach**: Run content moderation inside the trusted execution environment

**Implementation:**
```rust
// Inside the enclave
pub struct InTEEContentModerator {
    prohibited_classifier: ONNXModel,  // Separate ONNX model for content filtering
    cat_detector: ONNXModel,           // Main cat detection model
}

impl InTEEContentModerator {
    pub fn process_image(&self, encrypted_image: &[u8]) -> Result<ProcessingResult, PolicyViolation> {
        // Decrypt inside TEE
        let image = self.decrypt_image(encrypted_image)?;
        
        // Content policy check (inside TEE)
        let content_analysis = self.prohibited_classifier.infer(&image)?;
        if content_analysis.contains_prohibited_content() {
            return Err(PolicyViolation::ProhibitedContent);
        }
        
        // Main processing
        let cat_result = self.cat_detector.infer(&image)?;
        Ok(ProcessingResult { cats_detected: cat_result.count })
    }
}
```

**Benefits:**
- ✅ Preserves confidentiality
- ✅ Can analyze actual content
- ✅ Comprehensive protection

**Limitations:**
- ❌ High implementation complexity
- ❌ Additional model overhead (~2x processing time)
- ❌ May overcomplicate reference architecture

### Option 3: Hybrid Approach with Break-Glass (BALANCED)
**Approach**: Metadata enforcement + operator break-glass for severe violations

**Implementation:**
```typescript
interface HybridTOUEnforcement {
  // Automated enforcement (preserves confidentiality)
  metadataRules: MetadataBasedRules;
  
  // Break-glass mechanism (for severe violations)
  breakGlass: {
    enabled: boolean;
    requiresApproval: string[];  // List of approver user IDs
    auditLog: BreakGlassEvent[];
    
    // What can be accessed during break-glass
    accessLevel: "metadata_only" | "processing_logs" | "full_content";
  };
}

// Break-glass event structure
interface BreakGlassEvent {
  timestamp: string;
  triggerReason: string;
  operatorId: string;
  approvedBy: string[];
  actionsTaken: string[];
  contentAccessed: boolean;
}
```

**Workflow:**
1. **Normal Operation**: Metadata-only enforcement preserves confidentiality
2. **Violation Detection**: Suspicious patterns trigger alerts
3. **Break-Glass Decision**: Human operator decides if investigation needed
4. **Temporary Access**: Limited, audited access to investigate
5. **Remediation**: Take appropriate action, restore normal operation

## Recommendation: Option 1 (Metadata-Based) for Reference Architecture

### Why This Is The Highest-Value Approach

**1. Educational Impact**
- Demonstrates the fundamental tension between confidentiality and monitoring
- Shows how to build effective safeguards within confidential computing constraints
- Teaches practical patterns applicable to real enterprise systems

**2. Implementation Simplicity**
- Adds ~1-2 days of development time (vs weeks for in-TEE content analysis)
- No additional ML models or complex dependencies
- Easy to understand and audit

**3. Real-World Applicability**
- Pattern used by many production confidential computing systems
- Scales to enterprise requirements
- Balances security with performance

**4. Reference Architecture Value**
- Demonstrates best practices without overcomplicating the core demo
- Provides clear extension points for more advanced enforcement
- Maintains focus on confidential computing concepts

### Specific Implementation for Phase 2

**Add TOU Enforcement Layer:**
```javascript
// Client-side enforcement (before encryption)
class TOUEnforcer {
  async validateUpload(file) {
    // File size check
    if (file.size > this.config.maxFileSizeBytes) {
      throw new TOUViolation("File too large");
    }
    
    // Format validation
    if (!this.config.allowedFormats.includes(file.type)) {
      throw new TOUViolation("Invalid file format");
    }
    
    // Rate limiting check
    await this.checkRateLimit();
    
    // Image dimension validation (requires loading image)
    const dimensions = await this.getImageDimensions(file);
    if (!this.isValidDimensions(dimensions)) {
      throw new TOUViolation("Invalid image dimensions");
    }
    
    return true;
  }
}
```

**Server-side monitoring:**
```python
# Usage pattern detection
class UsagePatternDetector:
    def analyze_request(self, user_id: str, request_metadata: dict):
        patterns = self.detect_patterns(user_id, request_metadata)
        
        if "bulk_upload" in patterns:
            self.log_violation(user_id, "Potential bulk processing")
            
        if "automated_behavior" in patterns:
            self.require_human_verification(user_id)
            
        return patterns
```

### Extension Points for Advanced Features

**Future Enhancements** (Phase 7+):
1. **In-TEE Content Analysis**: Add prohibited content detection inside enclave
2. **ML-Based Abuse Detection**: Train models on usage patterns
3. **Federation Integration**: Share abuse patterns across operators (privacy-preserving)
4. **Differential Privacy Analytics**: Aggregate abuse statistics without revealing individuals

## Conclusion

For the Confidential Cat Counter reference architecture, **metadata-based TOU enforcement** provides the best balance of:
- Educational value (demonstrates real-world patterns)
- Implementation simplicity (doesn't derail core goals)
- Practical applicability (used in production systems)
- Extension opportunities (clear path to advanced features)

This approach will make your reference architecture highly valuable for enterprise teams learning to implement confidential computing systems with appropriate safeguards.

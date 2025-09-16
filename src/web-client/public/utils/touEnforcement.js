/**
 * Terms of Use (TOU) Enforcement Module
 * Phase 2 Implementation - Week 4
 * 
 * Metadata-based TOU enforcement that validates encryption context
 * and user compliance before allowing encrypted uploads.
 */

// TOU enforcement policies
const TOU_POLICIES = {
    VERSION: '2.2',
    REQUIRED_ACCEPTANCE: ['demo_understanding'],
    MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    ENCRYPTION_REQUIRED: true,
    MAX_DAILY_UPLOADS: 100
};

// User consent tracking
class TOUConsentManager {
    constructor() {
        this.storageKey = 'ccc_tou_consent';
        this.sessionKey = 'ccc_session_uploads';
        this.initializeConsent();
    }

    initializeConsent() {
        const stored = localStorage.getItem(this.storageKey);
        this.consentData = stored ? JSON.parse(stored) : {
            version: null,
            acceptedPolicies: [],
            timestamp: null,
            ipHash: null,
            userAgent: navigator.userAgent.substring(0, 100) // Truncated for privacy
        };
    }

    // Check if current TOU version is accepted
    isCurrentVersionAccepted() {
        return this.consentData.version === TOU_POLICIES.VERSION &&
               TOU_POLICIES.REQUIRED_ACCEPTANCE.every(policy => 
                   this.consentData.acceptedPolicies.includes(policy)
               );
    }

    // Record user consent
    recordConsent(acceptedPolicies) {
        this.consentData = {
            version: TOU_POLICIES.VERSION,
            acceptedPolicies: acceptedPolicies,
            timestamp: new Date().toISOString(),
            ipHash: this.generateClientHash(),
            userAgent: navigator.userAgent.substring(0, 100)
        };
        
        localStorage.setItem(this.storageKey, JSON.stringify(this.consentData));
        this.logTOUEvent('consent_recorded', { 
            version: TOU_POLICIES.VERSION,
            policies: acceptedPolicies.length 
        });
    }

    // Generate client-side hash for tracking (privacy-preserving)
    generateClientHash() {
        const clientData = `${navigator.userAgent}-${screen.width}x${screen.height}-${new Date().toDateString()}`;
        return btoa(clientData).substring(0, 12); // Short hash for tracking
    }

    // Track daily upload count
    incrementUploadCount() {
        const today = new Date().toISOString().split('T')[0];
        const sessionData = JSON.parse(sessionStorage.getItem(this.sessionKey) || '{}');
        
        if (!sessionData[today]) {
            sessionData[today] = 0;
        }
        
        sessionData[today]++;
        sessionStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
        
        return sessionData[today];
    }

    getDailyUploadCount() {
        const today = new Date().toISOString().split('T')[0];
        const sessionData = JSON.parse(sessionStorage.getItem(this.sessionKey) || '{}');
        return sessionData[today] || 0;
    }

    logTOUEvent(eventType, metadata = {}) {
        if (window.cryptoLogger) {
            window.cryptoLogger.log('INFO', `TOU ${eventType}`, {
                touVersion: TOU_POLICIES.VERSION,
                ...metadata
            });
        }
    }
}

// File validation with TOU compliance
class TOUFileValidator {
    constructor(consentManager) {
        this.consent = consentManager;
    }

    // Comprehensive file validation
    validateFile(file) {
        const errors = [];
        
        // Check TOU acceptance
        if (!this.consent.isCurrentVersionAccepted()) {
            errors.push({
                type: 'TOU_NOT_ACCEPTED',
                message: 'Terms of Use must be accepted before uploading',
                severity: 'BLOCKING'
            });
        }

        // File size validation
        if (file.size > TOU_POLICIES.MAX_FILE_SIZE) {
            errors.push({
                type: 'FILE_TOO_LARGE',
                message: `File size (${this.formatBytes(file.size)}) exceeds maximum allowed (${this.formatBytes(TOU_POLICIES.MAX_FILE_SIZE)})`,
                severity: 'BLOCKING'
            });
        }

        // File type validation
        if (!TOU_POLICIES.ALLOWED_FILE_TYPES.includes(file.type)) {
            errors.push({
                type: 'INVALID_FILE_TYPE',
                message: `File type '${file.type}' is not allowed. Allowed types: ${TOU_POLICIES.ALLOWED_FILE_TYPES.join(', ')}`,
                severity: 'BLOCKING'
            });
        }

        // Daily upload limit
        const dailyCount = this.consent.getDailyUploadCount();
        if (dailyCount >= TOU_POLICIES.MAX_DAILY_UPLOADS) {
            errors.push({
                type: 'DAILY_LIMIT_EXCEEDED',
                message: `Daily upload limit of ${TOU_POLICIES.MAX_DAILY_UPLOADS} files exceeded`,
                severity: 'BLOCKING'
            });
        }

        // File content validation (basic)
        if (file.size === 0) {
            errors.push({
                type: 'EMPTY_FILE',
                message: 'File appears to be empty',
                severity: 'BLOCKING'
            });
        }

        return {
            isValid: errors.filter(e => e.severity === 'BLOCKING').length === 0,
            errors: errors,
            warnings: errors.filter(e => e.severity === 'WARNING')
        };
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}

// TOU-compliant encryption context generator
class TOUEncryptionContext {
    constructor(consentManager) {
        this.consent = consentManager;
    }

    // Generate TOU-compliant encryption context
    generateContext(file, uploadId) {
        const baseContext = {
            // TOU compliance metadata
            tou_version: TOU_POLICIES.VERSION,
            tou_accepted: this.consent.isCurrentVersionAccepted(),
            consent_timestamp: this.consent.consentData.timestamp,
            
            // File metadata (non-PII)
            file_size: String(file.size),
            file_type: file.type,
            upload_timestamp: new Date().toISOString(), // Full ISO8601 timestamp
            
            // Application metadata
            app: 'ccc-reference',
            version: 'phase2',
            upload_id: uploadId,
            
            // Demo system metadata
            demo_mode: "local_only",
            encryption_required: String(TOU_POLICIES.ENCRYPTION_REQUIRED),
            
            // Privacy preserving client info
            client_hash: this.consent.generateClientHash()
        };

        // Validate context for PII
        this.validateContextForPII(baseContext);
        
        return baseContext;
    }

    // Ensure no PII in encryption context
    validateContextForPII(context) {
        const piiPatterns = [
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
            /\d{3}-\d{2}-\d{4}/, // SSN pattern
            /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/, // Credit card pattern
        ];

        const contextString = JSON.stringify(context);
        
        for (const pattern of piiPatterns) {
            if (pattern.test(contextString)) {
                throw new Error('PII detected in encryption context - context rejected');
            }
        }

        // Check for overly specific data
        Object.entries(context).forEach(([key, value]) => {
            if (typeof value === 'string' && value.length > 100) {
                console.warn(`Long value in encryption context: ${key} (${value.length} chars)`);
            }
        });
    }
}

// Main TOU enforcement orchestrator
class TOUEnforcement {
    constructor() {
        this.consent = new TOUConsentManager();
        this.validator = new TOUFileValidator(this.consent);
        this.contextGenerator = new TOUEncryptionContext(this.consent);
        this.initializeUI();
    }

    // Initialize TOU enforcement UI
    initializeUI() {
        this.consent.logTOUEvent('enforcement_initialized', {
            hasConsent: this.consent.isCurrentVersionAccepted(),
            touVersion: TOU_POLICIES.VERSION
        });

        // Check if TOU acceptance is needed
        if (!this.consent.isCurrentVersionAccepted()) {
            this.showTOUModal();
        }
    }

    // Validate file upload with TOU compliance
    async validateUpload(file) {
        const validation = this.validator.validateFile(file);
        
        if (!validation.isValid) {
            this.consent.logTOUEvent('upload_blocked', {
                fileName: 'redacted',
                fileSize: file.size,
                errors: validation.errors.map(e => e.type)
            });
            
            throw new Error(`Upload blocked: ${validation.errors.map(e => e.message).join('; ')}`);
        }

        // Increment upload count
        const uploadCount = this.consent.incrementUploadCount();
        
        this.consent.logTOUEvent('upload_validated', {
            fileSize: file.size,
            fileType: file.type,
            dailyCount: uploadCount
        });

        return validation;
    }

    // Generate TOU-compliant encryption context for upload
    generateUploadContext(file) {
        const uploadId = 'upload_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        return this.contextGenerator.generateContext(file, uploadId);
    }

    // Show TOU acceptance modal
    showTOUModal() {
        const modal = document.createElement('div');
        modal.id = 'touModal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.7); z-index: 1000; display: flex; 
            align-items: center; justify-content: center;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 600px; margin: 20px;">
                <h2>🔐 Demo Terms & Privacy Notice</h2>
                <div style="max-height: 300px; overflow-y: auto; margin: 1rem 0; padding: 1rem; background: #f8fafc; border-radius: 6px;">
                    <h3>Local Demo System</h3>
                    <p>This is a reference architecture demonstration running entirely on your device:</p>
                    <ul>
                        <li>All processing happens locally in your browser or local docker containers</li>
                        <li>No data is transmitted to external servers</li>
                        <li>Files are processed in-memory and not permanently stored</li>
                        <li>Maximum file size: ${this.formatBytes(TOU_POLICIES.MAX_FILE_SIZE)}</li>
                    </ul>
                    
                    <h3>Demo Limitations & Usage</h3>
                    <p>Please note:</p>
                    <ul>
                        <li>This is a proof-of-concept system for demonstration purposes</li>
                        <li>ML results are generated by a mock model for testing, and should not be used for production purposes</li>
                        <li>Only upload appropriate images for cat detection testing</li>
                    </ul>
                    
                    <h3>Technical Details</h3>
                    <p>Version: ${TOU_POLICIES.VERSION} | Mode: Local Demo | Encryption: Client-Side Only</p>
                </div>
                
                <div>
                    <label style="display: block; margin: 1rem 0; font-size: 1.1rem;">
                        <input type="checkbox" id="acceptDemo" style="margin-right: 0.5rem; transform: scale(1.2);"> 
                        I understand this is a local demo system and agree to use it appropriately
                    </label>
                </div>
                
                <div style="margin-top: 1.5rem; text-align: right;">
                    <button id="acceptTOU" style="background: #0ea5e9; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; margin-left: 0.5rem;">
                        Accept & Continue
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Handle acceptance
        document.getElementById('acceptTOU').onclick = () => {
            const demoAccepted = document.getElementById('acceptDemo').checked;
            
            if (demoAccepted) {
                this.consent.recordConsent(['demo_understanding']);
                document.body.removeChild(modal);
                
                this.consent.logTOUEvent('consent_accepted', {
                    acceptedPolicies: 1,
                    touVersion: TOU_POLICIES.VERSION
                });
            } else {
                alert('Please accept the demo terms to continue.');
            }
        };
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // Get current TOU status for debugging
    getStatus() {
        return {
            consentValid: this.consent.isCurrentVersionAccepted(),
            touVersion: TOU_POLICIES.VERSION,
            dailyUploads: this.consent.getDailyUploadCount(),
            consentData: this.consent.consentData
        };
    }
}

// Initialize TOU enforcement
window.touEnforcement = new TOUEnforcement();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TOUEnforcement, TOU_POLICIES };
}

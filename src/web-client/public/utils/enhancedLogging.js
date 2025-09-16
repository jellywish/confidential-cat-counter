/**
 * Enhanced logging system for educational crypto operations
 */

class EnhancedCryptoLogger {
    constructor() {
        this.logLevel = localStorage.getItem('cryptoLoggingLevel') || 'detailed';
        this.logContainer = null;
        this.initializeLogger();
    }

    initializeLogger() {
        // Create enhanced log container
        this.logContainer = document.createElement('div');
        this.logContainer.className = 'crypto-log-enhanced';
        this.logContainer.id = 'enhancedCryptoLog';
        this.logContainer.style.display = 'none';
        
        // Add to page
        document.body.appendChild(this.logContainer);
        
        // Add toggle button
        this.addToggleButton();
    }

    addToggleButton() {
        const toggleBtn = document.createElement('button');
        toggleBtn.innerHTML = '🔍 View Crypto Operations';
        toggleBtn.className = 'btn-enhanced';
        toggleBtn.style.position = 'fixed';
        toggleBtn.style.bottom = '20px';
        toggleBtn.style.right = '20px';
        toggleBtn.style.zIndex = '1000';
        
        toggleBtn.addEventListener('click', () => {
            this.toggleLogDisplay();
        });
        
        document.body.appendChild(toggleBtn);
    }

    toggleLogDisplay() {
        const isVisible = this.logContainer.style.display !== 'none';
        this.logContainer.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            this.logContainer.style.position = 'fixed';
            this.logContainer.style.top = '20px';
            this.logContainer.style.right = '20px';
            this.logContainer.style.width = '400px';
            this.logContainer.style.maxHeight = '500px';
            this.logContainer.style.zIndex = '999';
            this.logContainer.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        }
    }

    log(level, operation, details = {}) {
        if (this.logLevel === 'off') return;
        
        const timestamp = new Date().toISOString();
        const logEntry = this.createLogEntry(level, operation, details, timestamp);
        
        this.logContainer.appendChild(logEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
        
        // Keep only last 50 entries
        while (this.logContainer.children.length > 50) {
            this.logContainer.removeChild(this.logContainer.firstChild);
        }
    }

    createLogEntry(level, operation, details, timestamp) {
        const entry = document.createElement('div');
        entry.className = `log-entry ${level}`;
        
        const timeElement = document.createElement('span');
        timeElement.className = 'timestamp';
        timeElement.textContent = new Date(timestamp).toLocaleTimeString();
        
        const operationElement = document.createElement('span');
        operationElement.className = 'operation';
        operationElement.textContent = operation;
        
        entry.appendChild(timeElement);
        entry.appendChild(document.createTextNode(' '));
        entry.appendChild(operationElement);
        
        // Add details based on log level
        if (this.logLevel === 'detailed') {
            this.addDetailedInfo(entry, details);
        } else if (this.logLevel === 'minimal') {
            this.addMinimalInfo(entry, details);
        }
        
        return entry;
    }

    addDetailedInfo(entry, details) {
        if (Object.keys(details).length === 0) return;
        
        const detailsElement = document.createElement('div');
        detailsElement.className = 'details';
        
        for (const [key, value] of Object.entries(details)) {
            const detail = document.createElement('div');
            detail.innerHTML = `<strong>${key}:</strong> ${this.formatValue(value)}`;
            detailsElement.appendChild(detail);
        }
        
        entry.appendChild(detailsElement);
    }

    addMinimalInfo(entry, details) {
        if (details.status) {
            const statusElement = document.createElement('span');
            statusElement.textContent = ` - ${details.status}`;
            statusElement.style.color = details.status === 'success' ? '#10b981' : '#ef4444';
            entry.appendChild(statusElement);
        }
    }

    formatValue(value) {
        if (typeof value === 'string' && value.length > 50) {
            return value.substring(0, 50) + '...';
        }
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }
        return String(value);
    }

    // Educational logging methods
    logEncryptionStart(context) {
        this.log('info', 'ENCRYPTION_START', {
            'Encryption Context': JSON.stringify(context, null, 2),
            'Algorithm': 'AES-256-GCM',
            'Library': 'AWS Encryption SDK',
            'Security': 'Client-side only'
        });
    }

    logEncryptionComplete(encryptedSize, originalSize) {
        this.log('success', 'ENCRYPTION_COMPLETE', {
            'Original Size': `${originalSize} bytes`,
            'Encrypted Size': `${encryptedSize} bytes`,
            'Overhead': `${encryptedSize - originalSize} bytes`,
            'Security': 'Data now safe for transmission'
        });
    }

    logUploadStart(jobId) {
        this.log('info', 'UPLOAD_START', {
            'Job ID': jobId,
            'Data State': 'Encrypted',
            'Server Access': 'Cannot see original data',
            'Protocol': 'HTTPS'
        });
    }

    logDecryptionStart() {
        this.log('warning', 'SERVER_DECRYPTION', {
            'Location': 'Server memory only',
            'Purpose': 'ML processing',
            'Persistence': 'Not stored',
            'Access': 'Temporary for processing'
        });
    }

    logMLProcessing(modelName, confidence) {
        this.log('info', 'ML_PROCESSING', {
            'Model': modelName,
            'License': modelName.includes('yolo-nas') ? 'Apache 2.0' : 'GPL 3.0',
            'Processing': 'On decrypted data',
            'Results': `${confidence} confidence`
        });
    }

    logProcessingComplete(results) {
        this.log('success', 'PROCESSING_COMPLETE', {
            'Cats Detected': results.cats || 0,
            'Confidence': results.confidence || 0,
            'Processing Time': results.processingTime || 'Unknown',
            'Data Cleanup': 'Original data discarded'
        });
    }

    logError(operation, error) {
        this.log('error', `ERROR_${operation}`, {
            'Error Message': error.message,
            'Security': 'Fail-closed behavior',
            'Action': 'Operation halted'
        });
    }

    setLogLevel(level) {
        this.logLevel = level;
        localStorage.setItem('cryptoLoggingLevel', level);
        
        // Clear current logs when changing level
        this.logContainer.innerHTML = '';
        
        this.log('info', 'LOG_LEVEL_CHANGED', {
            'New Level': level,
            'Educational Value': level === 'detailed' ? 'High' : level === 'minimal' ? 'Medium' : 'None'
        });
    }
}

// Initialize enhanced logger
const enhancedLogger = new EnhancedCryptoLogger();

// Export for use in other scripts
window.enhancedCryptoLogger = enhancedLogger;

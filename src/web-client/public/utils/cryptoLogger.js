/**
 * Client-side crypto logging utility
 * Provides visibility into encryption operations for debugging and verification
 */

class CryptoLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000; // Prevent memory bloat
        this.listeners = [];
    }

    log(level, message, metadata = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level, // 'info', 'success', 'warning', 'error'
            message: message,
            metadata: metadata,
            id: Date.now() + Math.random() // Simple unique ID
        };

        this.logs.push(logEntry);
        
        // Keep only recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Notify listeners (UI components)
        this.listeners.forEach(listener => listener(logEntry));

        // Also log to browser console for debugging
        const consoleMessage = `[CRYPTO] ${message}`;
        switch(level) {
            case 'error':
                console.error(consoleMessage, metadata);
                break;
            case 'warning':
                console.warn(consoleMessage, metadata);
                break;
            case 'success':
                console.log(`✅ ${consoleMessage}`, metadata);
                break;
            default:
                console.log(`ℹ️ ${consoleMessage}`, metadata);
        }
    }

    info(message, metadata = {}) {
        this.log('info', message, metadata);
    }

    success(message, metadata = {}) {
        this.log('success', message, metadata);
    }

    warning(message, metadata = {}) {
        this.log('warning', message, metadata);
    }

    error(message, metadata = {}) {
        this.log('error', message, metadata);
    }

    getLogs() {
        return [...this.logs]; // Return copy
    }

    getRecentLogs(count = 50) {
        return this.logs.slice(-count);
    }

    clear() {
        this.logs = [];
        this.listeners.forEach(listener => listener({ type: 'clear' }));
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    // Security: Never log sensitive data
    logSecure(level, message, sanitizedMetadata = {}) {
        // Helper to ensure no sensitive data is logged
        const safeMeta = this.sanitizeMetadata(sanitizedMetadata);
        this.log(level, message, safeMeta);
    }

    sanitizeMetadata(metadata) {
        const sanitized = {};
        for (const [key, value] of Object.entries(metadata)) {
            // Skip potentially sensitive fields
            if (this.isSensitiveField(key)) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'string' && value.length > 100) {
                // Truncate long strings (potential ciphertext/keys)
                sanitized[key] = value.substring(0, 32) + '...';
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    isSensitiveField(fieldName) {
        const sensitiveFields = [
            'key', 'secret', 'token', 'password', 'privateKey',
            'ciphertext', 'plaintext', 'encryptedData', 'decryptedData'
        ];
        return sensitiveFields.some(field => 
            fieldName.toLowerCase().includes(field.toLowerCase())
        );
    }
}

// Global singleton instance
window.cryptoLogger = new CryptoLogger();

// Initialize with startup message
window.cryptoLogger.info('Crypto logger initialized', {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    cryptoSupport: !!window.crypto
});

export default window.cryptoLogger;

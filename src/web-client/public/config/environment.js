/**
 * Environment-based configuration for Confidential Cat Counter
 */

class EnvironmentConfig {
    constructor() {
        this.config = this.loadConfiguration();
        this.initializeConfigPanel();
    }

    loadConfiguration() {
        // Load from localStorage or use defaults
        const savedConfig = localStorage.getItem('ccc-config');
        const defaultConfig = {
            mlModel: 'auto',
            confidenceThreshold: 0.5,
            cryptoLogging: 'detailed',
            uploadTimeout: 30000,
            processingTimeout: 60000,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            serverEndpoint: this.detectServerEndpoint(),
            environment: this.detectEnvironment()
        };

        return savedConfig ? { ...defaultConfig, ...JSON.parse(savedConfig) } : defaultConfig;
    }

    detectEnvironment() {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        } else if (hostname.includes('staging') || hostname.includes('dev')) {
            return 'staging';
        } else {
            return 'production';
        }
    }

    detectServerEndpoint() {
        const environment = this.detectEnvironment();
        
        switch (environment) {
            case 'development':
                return 'http://localhost:8000';
            case 'staging':
                return 'https://staging-ml.your-domain.com';
            case 'production':
                return 'https://ml.your-domain.com';
            default:
                return 'http://localhost:8000';
        }
    }

    initializeConfigPanel() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupConfigPanel());
        } else {
            this.setupConfigPanel();
        }
    }

    setupConfigPanel() {
        // Model selection
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect) {
            modelSelect.value = this.config.mlModel;
            modelSelect.addEventListener('change', (e) => {
                this.updateConfig('mlModel', e.target.value);
            });
        }

        // Confidence threshold
        const confidenceThreshold = document.getElementById('confidenceThreshold');
        const confidenceValue = document.getElementById('confidenceValue');
        if (confidenceThreshold && confidenceValue) {
            confidenceThreshold.value = this.config.confidenceThreshold;
            confidenceValue.textContent = this.config.confidenceThreshold;
            
            confidenceThreshold.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                confidenceValue.textContent = value;
                this.updateConfig('confidenceThreshold', value);
            });
        }

        // Crypto logging
        const cryptoLogging = document.getElementById('cryptoLogging');
        if (cryptoLogging) {
            cryptoLogging.value = this.config.cryptoLogging;
            cryptoLogging.addEventListener('change', (e) => {
                this.updateConfig('cryptoLogging', e.target.value);
                
                // Update enhanced logger if available
                if (window.enhancedCryptoLogger) {
                    window.enhancedCryptoLogger.setLogLevel(e.target.value);
                }
            });
        }

        // Add environment indicator
        this.addEnvironmentIndicator();
    }

    addEnvironmentIndicator() {
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: ${this.config.environment === 'production' ? '#dc2626' : this.config.environment === 'staging' ? '#d97706' : '#059669'};
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
            font-size: 0.75rem;
            font-weight: 600;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        indicator.textContent = `ENV: ${this.config.environment.toUpperCase()}`;
        document.body.appendChild(indicator);
    }

    updateConfig(key, value) {
        this.config[key] = value;
        localStorage.setItem('ccc-config', JSON.stringify(this.config));
        
        // Dispatch configuration change event
        window.dispatchEvent(new CustomEvent('configChanged', {
            detail: { key, value, config: this.config }
        }));
    }

    getConfig(key) {
        return key ? this.config[key] : this.config;
    }

    // Environment-specific settings
    getUploadEndpoint() {
        return this.config.serverEndpoint + '/upload';
    }

    getStatusEndpoint(jobId) {
        return this.config.serverEndpoint + `/status/${jobId}`;
    }

    getHealthEndpoint() {
        return this.config.serverEndpoint + '/health';
    }

    // Feature flags based on environment
    isFeatureEnabled(feature) {
        const features = {
            'detailed-logging': this.config.environment === 'development',
            'debug-mode': this.config.environment === 'development',
            'analytics': this.config.environment === 'production',
            'error-reporting': this.config.environment !== 'development'
        };

        return features[feature] || false;
    }

    // Security settings based on environment
    getSecurityConfig() {
        return {
            enforceHttps: this.config.environment === 'production',
            allowSelfSignedCerts: this.config.environment === 'development',
            enableCSP: true,
            enableCORS: this.config.environment !== 'production',
            rateLimitStrict: this.config.environment === 'production'
        };
    }

    // Crypto settings
    getCryptoConfig() {
        return {
            keyDerivationIterations: this.config.environment === 'development' ? 1000 : 10000,
            enableChunking: true,
            chunkSize: 32768, // 32KB
            encryptionAlgorithm: 'AES-256-GCM',
            contextValidation: 'strict'
        };
    }
}

// Initialize configuration
const environmentConfig = new EnvironmentConfig();

// Export for global use
window.environmentConfig = environmentConfig;

// Log configuration on load
if (environmentConfig.isFeatureEnabled('detailed-logging')) {
    console.log('🔧 Environment Configuration Loaded:', {
        environment: environmentConfig.getConfig('environment'),
        mlModel: environmentConfig.getConfig('mlModel'),
        serverEndpoint: environmentConfig.getConfig('serverEndpoint'),
        features: ['detailed-logging', 'debug-mode', 'analytics', 'error-reporting'].filter(f => 
            environmentConfig.isFeatureEnabled(f)
        )
    });
}

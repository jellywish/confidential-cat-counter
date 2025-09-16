/**
 * Upload validation utilities with magic-byte sniffing
 * PE Recommendation: Add file-type validation beyond mimetype trust
 */

const fs = require('fs').promises;

// Allowed image MIME types and extensions
const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff'
];

const ALLOWED_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif'
];

/**
 * Validate uploaded file using magic-byte sniffing
 * @param {string} filePath - Path to uploaded file
 * @param {string} mimetype - Claimed MIME type
 * @returns {Promise<Object>} Validation result
 */
async function validateImageFile(filePath, mimetype = 'unknown') {
    try {
        // Read first few bytes for magic-byte analysis (simplified approach)
        const buffer = await fs.readFile(filePath);
        const result = {
            isValid: false,
            detectedType: null,
            claimedType: mimetype,
            reason: null,
            securityFlags: []
        };

        // Simple magic-byte detection using built-in Node.js
        const detectedType = detectImageType(buffer);
        
        if (!detectedType) {
            result.reason = 'Could not detect valid image format from file headers';
            result.securityFlags.push('UNKNOWN_FILE_TYPE');
            return result;
        }

        result.detectedType = detectedType;

        // Validate detected type is an allowed image format
        if (!ALLOWED_IMAGE_TYPES.includes(detectedType)) {
            result.reason = `File type ${detectedType} is not an allowed image format`;
            result.securityFlags.push('DISALLOWED_FILE_TYPE');
            return result;
        }

        // Check for MIME type mismatch (potential spoofing)
        if (mimetype && mimetype !== 'unknown' && mimetype !== detectedType) {
            result.securityFlags.push('MIME_TYPE_MISMATCH');
            // Still allow if detected type is valid, but flag for logging
        }

        // Extension validation removed - PE Recommendation: PII minimization
        // originalName (user-provided filename) is no longer stored or processed
        // File type validation relies solely on magic-byte detection

        // Basic size validation (already handled by multer, but double-check)
        const fileSizeBytes = buffer.length;
        const maxSizeBytes = 10 * 1024 * 1024; // 10MB
        
        if (fileSizeBytes > maxSizeBytes) {
            result.reason = `File size ${fileSizeBytes} bytes exceeds maximum ${maxSizeBytes} bytes`;
            result.securityFlags.push('FILE_TOO_LARGE');
            return result;
        }

        if (fileSizeBytes < 100) {
            result.reason = 'File too small to be a valid image';
            result.securityFlags.push('FILE_TOO_SMALL');
            return result;
        }

        // If we get here, file is valid
        result.isValid = true;
        result.reason = 'Valid image file';

        return result;

    } catch (error) {
        return {
            isValid: false,
            detectedType: null,
            claimedType: mimetype,
            reason: `Validation error: ${error.message}`,
            securityFlags: ['VALIDATION_ERROR']
        };
    }
}

/**
 * Enhanced error response for upload validation failures
 * @param {Object} validationResult - Result from validateImageFile
 * @param {Object} logger - Logger instance
 * @returns {Object} HTTP error response
 */
function createValidationErrorResponse(validationResult, logger) {
    // Log security events
    if (validationResult.securityFlags.length > 0) {
        logger.warn('Upload security validation failed', {
            reason: validationResult.reason,
            detectedType: validationResult.detectedType,
            claimedType: validationResult.claimedType,
            securityFlags: validationResult.securityFlags
        });
    }

    // Determine appropriate HTTP status and user message
    let status = 400;
    let userMessage = 'Invalid file. Please select a valid image file.';

    if (validationResult.securityFlags.includes('FILE_TOO_LARGE')) {
        status = 413; // Payload Too Large
        userMessage = 'File is too large. Please select an image smaller than 10MB.';
    } else if (validationResult.securityFlags.includes('DISALLOWED_FILE_TYPE')) {
        userMessage = 'File type not supported. Please select a JPG, PNG, GIF, WebP, BMP, or TIFF image.';
    } else if (validationResult.securityFlags.includes('UNKNOWN_FILE_TYPE')) {
        userMessage = 'File format not recognized. Please select a standard image file.';
    }

    return {
        status,
        response: {
            error: 'Invalid file',
            message: userMessage,
            code: 'FILE_VALIDATION_FAILED',
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * Simple image type detection using magic bytes (built-in Node.js approach)
 * @param {Buffer} buffer - File buffer to analyze
 * @returns {string|null} Detected MIME type or null
 */
function detectImageType(buffer) {
    if (!buffer || buffer.length < 12) return null;
    
    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return 'image/jpeg';
    }
    
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return 'image/png';
    }
    
    // GIF: 47 49 46 38 (GIF8)
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
        return 'image/gif';
    }
    
    // WebP: RIFF ... WEBP
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        return 'image/webp';
    }
    
    // BMP: 42 4D
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
        return 'image/bmp';
    }
    
    return null; // Unknown or unsupported type
}

module.exports = {
    validateImageFile,
    createValidationErrorResponse,
    ALLOWED_IMAGE_TYPES,
    ALLOWED_EXTENSIONS
};

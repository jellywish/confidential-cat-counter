/**
 * Error handling utilities for user-friendly error responses
 * Provides consistent error formatting and user messages
 */

// Error codes and user-friendly messages
const ERROR_MESSAGES = {
  FILE_TOO_LARGE: 'The selected file is too large. Please choose an image smaller than 10MB.',
  INVALID_FILE_TYPE: 'Invalid file type. Please select a valid image file (JPG, PNG, etc.).',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again in a moment.',
  NETWORK_ERROR: 'Network connection failed. Please check your connection and try again.',
  UPLOAD_FAILED: 'Upload failed. Please check your file and try again.',
  PROCESSING_TIMEOUT: 'Image processing is taking longer than expected. Please try again.',
  CRYPTO_ERROR: 'Security operation failed. Please refresh the page and try again.',
  REDIS_ERROR: 'Data storage temporarily unavailable. Please try again shortly.',
  ML_SERVICE_ERROR: 'Image processing service unavailable. Please try again later.',
  QUOTA_EXCEEDED: 'You have exceeded the upload limit. Please try again later.',
  INVALID_REQUEST: 'Invalid request format. Please refresh the page and try again.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again or contact support if the problem persists.'
};

// HTTP status codes for different error types
const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TIMEOUT: 408,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

/**
 * Create a standardized error response
 * @param {string} code - Error code (key from ERROR_MESSAGES)
 * @param {number} status - HTTP status code
 * @param {string} details - Additional technical details for logging
 * @returns {Object} Standardized error response
 */
function createErrorResponse(code, status = HTTP_STATUS.INTERNAL_ERROR, details = null) {
  const message = ERROR_MESSAGES[code] || ERROR_MESSAGES.INTERNAL_ERROR;
  
  const response = {
    error: code.toLowerCase().replace(/_/g, ' '),
    message,
    code,
    timestamp: new Date().toISOString()
  };

  // Include details only in development
  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  }

  return { status, response };
}

/**
 * Handle crypto operation errors with graceful fallbacks
 * @param {Error} error - The crypto error
 * @returns {Object} Error response for crypto failures
 */
function handleCryptoError(error) {
  if (error.message.includes('WebCrypto')) {
    return createErrorResponse('CRYPTO_ERROR', HTTP_STATUS.BAD_REQUEST, 
      'WebCrypto API not available');
  }
  
  if (error.message.includes('key')) {
    return createErrorResponse('CRYPTO_ERROR', HTTP_STATUS.BAD_REQUEST, 
      'Cryptographic key error');
  }
  
  return createErrorResponse('CRYPTO_ERROR', HTTP_STATUS.INTERNAL_ERROR, error.message);
}

/**
 * Handle network/service timeout errors
 * @param {Error} error - The timeout error
 * @returns {Object} Error response for timeouts
 */
function handleTimeoutError(error) {
  if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
    return createErrorResponse('PROCESSING_TIMEOUT', HTTP_STATUS.GATEWAY_TIMEOUT, error.message);
  }
  
  return createErrorResponse('NETWORK_ERROR', HTTP_STATUS.BAD_GATEWAY, error.message);
}

/**
 * Handle Redis connection errors
 * @param {Error} error - The Redis error
 * @returns {Object} Error response for Redis failures
 */
function handleRedisError(error) {
  return createErrorResponse('REDIS_ERROR', HTTP_STATUS.SERVICE_UNAVAILABLE, error.message);
}

/**
 * Handle ML service errors
 * @param {Error} error - The ML service error
 * @returns {Object} Error response for ML service failures
 */
function handleMLServiceError(error) {
  if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
    return createErrorResponse('ML_SERVICE_ERROR', HTTP_STATUS.SERVICE_UNAVAILABLE, error.message);
  }
  
  return createErrorResponse('ML_SERVICE_ERROR', HTTP_STATUS.BAD_GATEWAY, error.message);
}

/**
 * Generic error handler that routes to specific handlers
 * @param {Error} error - The error to handle
 * @param {string} context - Context where error occurred (upload, crypto, etc.)
 * @returns {Object} Appropriate error response
 */
function handleError(error, context = 'general') {
  switch (context) {
    case 'crypto':
      return handleCryptoError(error);
    case 'timeout':
      return handleTimeoutError(error);
    case 'redis':
      return handleRedisError(error);
    case 'ml-service':
      return handleMLServiceError(error);
    default:
      return createErrorResponse('INTERNAL_ERROR', HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
}

module.exports = {
  ERROR_MESSAGES,
  HTTP_STATUS,
  createErrorResponse,
  handleCryptoError,
  handleTimeoutError,
  handleRedisError,
  handleMLServiceError,
  handleError
};

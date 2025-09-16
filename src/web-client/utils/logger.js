/**
 * Production-ready logger with configurable levels
 * Replaces console.log statements for proper production logging
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LOG_LEVEL_NAMES = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

class Logger {
  constructor() {
    // Set log level from environment (default: INFO for production, DEBUG for development)
    const envLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG');
    this.level = LOG_LEVELS[envLevel.toUpperCase()] ?? LOG_LEVELS.INFO;
    
    // Add timestamps in production
    this.useTimestamps = process.env.NODE_ENV === 'production';
  }

  _formatMessage(level, message, extra = {}) {
    const timestamp = this.useTimestamps ? new Date().toISOString() : '';
    const levelName = LOG_LEVEL_NAMES[level];
    
    if (this.useTimestamps) {
      return `[${timestamp}] ${levelName}: ${message}${Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : ''}`;
    } else {
      // Development format (cleaner)
      return `${message}${Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : ''}`;
    }
  }

  _log(level, message, extra = {}) {
    if (level <= this.level) {
      const formattedMessage = this._formatMessage(level, message, extra);
      
      switch (level) {
        case LOG_LEVELS.ERROR:
          console.error(formattedMessage);
          break;
        case LOG_LEVELS.WARN:
          console.warn(formattedMessage);
          break;
        case LOG_LEVELS.INFO:
          console.info(formattedMessage);
          break;
        case LOG_LEVELS.DEBUG:
          console.log(formattedMessage);
          break;
      }
    }
  }

  error(message, extra = {}) {
    this._log(LOG_LEVELS.ERROR, message, extra);
  }

  warn(message, extra = {}) {
    this._log(LOG_LEVELS.WARN, message, extra);
  }

  info(message, extra = {}) {
    this._log(LOG_LEVELS.INFO, message, extra);
  }

  debug(message, extra = {}) {
    this._log(LOG_LEVELS.DEBUG, message, extra);
  }

  // Convenience methods for common scenarios
  startup(message, port) {
    this.info(`🌐 ${message}`, { port, url: `http://localhost:${port}` });
  }

  shutdown(message) {
    this.info(`🛑 ${message}`);
  }

  redis(status, error = null) {
    if (error) {
      this.error('Redis connection error', { error: error.message });
    } else {
      this.info(`✅ Redis ${status}`);
    }
  }

  job(action, jobId, details = {}) {
    this.info(`📤 Job ${action}: ${jobId}`, details);
  }

  request(method, path, status, error = null) {
    if (error) {
      this.error(`${method} ${path} failed`, { status, error: error.message });
    } else {
      this.debug(`${method} ${path}`, { status });
    }
  }
}

// Export singleton instance
module.exports = new Logger();

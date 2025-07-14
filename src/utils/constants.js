/**
 * Application constants and utility functions
 * Node.js 22 Legacy Migration Tool
 */

/**
 * Application constants
 */
export const CONSTANTS = {
  // Application metadata
  APP_NAME: 'Legacy Migration Tool',
  APP_VERSION: '1.0.0',
  NODE_MIN_VERSION: 22,
  
  // API configuration
  DEFAULT_TIMEOUT: 30000,
  DEFAULT_MAX_CONCURRENT_ROOMS: 3,
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_RETRY_DELAY: 1000,
  
  // File handling
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  SUPPORTED_FILE_EXTENSIONS: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.gif'],
  TEMP_DIR: 'tmp',
  
  // Progress tracking
  PROGRESS_UPDATE_INTERVAL: 1000, // 1 second
  
  // Logging
  LOG_LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
  },
  
  // Migration states
  MIGRATION_STATES: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    SKIPPED: 'skipped'
  },
  
  // Error codes
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    API_ERROR: 'API_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    FILE_ERROR: 'FILE_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    PERMISSION_ERROR: 'PERMISSION_ERROR',
    NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
  }
};

/**
 * Utility functions
 */
export class Utils {
  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes - Number of bytes
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted string
   */
  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Format duration to human readable string
   * @param {number} milliseconds - Duration in milliseconds
   * @returns {string} Formatted duration string
   */
  static formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Sanitize filename for file system
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  static sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'unknown';
    }
    
    // Remove or replace invalid characters
    return filename
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars with underscore
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .toLowerCase();
  }

  /**
   * Generate unique identifier
   * @returns {string} Unique identifier
   */
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Deep clone an object
   * @param {any} obj - Object to clone
   * @returns {any} Cloned object
   */
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
      return obj.map(item => Utils.deepClone(item));
    }
    
    if (typeof obj === 'object') {
      const cloned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = Utils.deepClone(obj[key]);
        }
      }
      return cloned;
    }
    
    return obj;
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} Is valid email
   */
  static isValidEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean} Is valid URL
   */
  static isValidUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retry operation with exponential backoff
   * @param {Function} operation - Operation to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise<any>} Operation result
   */
  static async retry(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * delay;
        
        await Utils.sleep(delay + jitter);
      }
    }
    
    throw lastError;
  }

  /**
   * Truncate string to specified length
   * @param {string} str - String to truncate
   * @param {number} length - Maximum length
   * @param {string} suffix - Suffix to add if truncated
   * @returns {string} Truncated string
   */
  static truncate(str, length = 100, suffix = '...') {
    if (!str || typeof str !== 'string') {
      return '';
    }
    
    if (str.length <= length) {
      return str;
    }
    
    return str.substring(0, length - suffix.length) + suffix;
  }

  /**
   * Create a debounced function
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  static debounce(func, delay) {
    let timeoutId;
    
    return function debounced(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Create a throttled function
   * @param {Function} func - Function to throttle
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Throttled function
   */
  static throttle(func, delay) {
    let lastExecution = 0;
    
    return function throttled(...args) {
      const now = Date.now();
      if (now - lastExecution >= delay) {
        lastExecution = now;
        return func.apply(this, args);
      }
    };
  }

  /**
   * Parse JSON safely
   * @param {string} jsonString - JSON string to parse
   * @param {any} defaultValue - Default value if parsing fails
   * @returns {any} Parsed object or default value
   */
  static safeJsonParse(jsonString, defaultValue = null) {
    try {
      return JSON.parse(jsonString);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Check if value is empty (null, undefined, empty string, empty array, empty object)
   * @param {any} value - Value to check
   * @returns {boolean} Is empty
   */
  static isEmpty(value) {
    if (value === null || value === undefined) {
      return true;
    }
    
    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length === 0;
    }
    
    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }
    
    return false;
  }

  /**
   * Get current timestamp in ISO format
   * @returns {string} ISO timestamp
   */
  static getCurrentTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Create a hash from string
   * @param {string} str - String to hash
   * @returns {string} Hash string
   */
  static hash(str) {
    if (!str || typeof str !== 'string') {
      return '';
    }
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  constructor() {
    this.marks = new Map();
    this.measures = new Map();
  }

  /**
   * Start measuring performance
   * @param {string} name - Performance mark name
   */
  mark(name) {
    this.marks.set(name, performance.now());
  }

  /**
   * End measuring and return duration
   * @param {string} name - Performance mark name
   * @returns {number} Duration in milliseconds
   */
  measure(name) {
    const startTime = this.marks.get(name);
    if (!startTime) {
      throw new Error(`Performance mark '${name}' not found`);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.measures.set(name, duration);
    this.marks.delete(name);
    
    return duration;
  }

  /**
   * Get all measurements
   * @returns {Object} All measurements
   */
  getAllMeasures() {
    return Object.fromEntries(this.measures);
  }

  /**
   * Clear all marks and measures
   */
  clear() {
    this.marks.clear();
    this.measures.clear();
  }
}

export default { CONSTANTS, Utils, PerformanceMonitor };

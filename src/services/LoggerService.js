import winston from 'winston';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Logger Service - Centralized logging for the application
 * Uses Winston for structured logging with multiple transports
 */
export class LoggerService {
  static #instance = null;
  static #logger = null;

  /**
   * Get singleton instance of logger service
   */
  static getInstance() {
    if (!LoggerService.#instance) {
      LoggerService.#instance = new LoggerService();
    }
    return LoggerService.#logger;
  }

  constructor() {
    if (LoggerService.#instance) {
      throw new Error('LoggerService is a singleton. Use getInstance() instead.');
    }

    this.createLogger();
  }

  /**
   * Create Winston logger instance
   */
  createLogger() {
    // Ensure logs directory exists
    const logsDir = join(__dirname, '..', '..', 'logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    // Define console format
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;
        
        // Add metadata if present
        if (Object.keys(meta).length > 0) {
          log += ` ${JSON.stringify(meta)}`;
        }
        
        return log;
      })
    );

    // Create logger instance
    LoggerService.#logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports: [
        // Console transport
        new winston.transports.Console({
          format: consoleFormat,
          silent: process.env.NODE_ENV === 'test'
        }),
        
        // File transport for all logs
        new winston.transports.File({
          filename: join(logsDir, 'migration.log'),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        }),
        
        // Separate file for errors
        new winston.transports.File({
          filename: join(logsDir, 'migration-errors.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        })
      ],
      
      // Handle exceptions
      exceptionHandlers: [
        new winston.transports.File({
          filename: join(logsDir, 'migration-exceptions.log')
        })
      ],
      
      // Handle rejections
      rejectionHandlers: [
        new winston.transports.File({
          filename: join(logsDir, 'migration-rejections.log')
        })
      ]
    });

    // Add migration-specific methods
    this.addMigrationMethods();
  }

  /**
   * Add migration-specific logging methods
   */
  addMigrationMethods() {
    // Migration start/end logging
    LoggerService.#logger.migrationStart = (config) => {
      LoggerService.#logger.info('🚀 Migration started', {
        legacyEventName: config.legacyEventName,
        targetEventId: config.targetEventId,
        roomName: config.roomName,
        migrateAllRooms: config.migrateAllRooms,
        dryRun: config.dryRun,
        skipFiles: config.skipFiles
      });
    };

    LoggerService.#logger.migrationEnd = (result, duration) => {
      LoggerService.#logger.info('✅ Migration completed', {
        success: result.success,
        duration: `${duration}ms`,
        statistics: result.statistics,
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      });
    };

    // API request logging
    LoggerService.#logger.apiRequest = (method, url, data = null) => {
      LoggerService.#logger.debug('📡 API Request', {
        method,
        url,
        hasData: !!data,
        dataSize: data ? JSON.stringify(data).length : 0
      });
    };

    LoggerService.#logger.apiResponse = (method, url, status, duration) => {
      LoggerService.#logger.debug('📡 API Response', {
        method,
        url,
        status,
        duration: `${duration}ms`
      });
    };

    LoggerService.#logger.apiError = (method, url, error, duration) => {
      LoggerService.#logger.error('📡 API Error', {
        method,
        url,
        error: error.message,
        duration: `${duration}ms`,
        stack: error.stack
      });
    };

    // File operation logging
    LoggerService.#logger.fileOperation = (operation, fileName, size = null) => {
      LoggerService.#logger.info(`📄 File ${operation}`, {
        fileName,
        size: size ? `${size} bytes` : null
      });
    };

    LoggerService.#logger.fileError = (operation, fileName, error) => {
      LoggerService.#logger.error(`📄 File ${operation} failed`, {
        fileName,
        error: error.message,
        stack: error.stack
      });
    };

    // Progress logging
    LoggerService.#logger.progress = (operation, current, total, item = null) => {
      LoggerService.#logger.info(`⏳ Progress: ${operation}`, {
        current,
        total,
        percentage: Math.round((current / total) * 100),
        item
      });
    };

    // Room processing logging
    LoggerService.#logger.roomStart = (roomName) => {
      LoggerService.#logger.info('🏠 Room processing started', { roomName });
    };

    LoggerService.#logger.roomEnd = (roomName, success, duration) => {
      LoggerService.#logger.info(`🏠 Room processing ${success ? 'completed' : 'failed'}`, {
        roomName,
        duration: `${duration}ms`
      });
    };

    // Session processing logging
    LoggerService.#logger.sessionStart = (sessionTitle) => {
      LoggerService.#logger.info('📅 Session processing started', { sessionTitle });
    };

    LoggerService.#logger.sessionEnd = (sessionTitle, success, duration) => {
      LoggerService.#logger.info(`📅 Session processing ${success ? 'completed' : 'failed'}`, {
        sessionTitle,
        duration: `${duration}ms`
      });
    };

    // User processing logging
    LoggerService.#logger.userStart = (userName) => {
      LoggerService.#logger.info('👤 User processing started', { userName });
    };

    LoggerService.#logger.userEnd = (userName, success, duration) => {
      LoggerService.#logger.info(`👤 User processing ${success ? 'completed' : 'failed'}`, {
        userName,
        duration: `${duration}ms`
      });
    };

    // Configuration logging
    LoggerService.#logger.configLoaded = (summary) => {
      LoggerService.#logger.info('⚙️ Configuration loaded', summary);
    };

    LoggerService.#logger.configError = (error) => {
      LoggerService.#logger.error('⚙️ Configuration error', {
        error: error.message,
        stack: error.stack
      });
    };

    // Performance logging
    LoggerService.#logger.performance = (operation, duration, details = {}) => {
      LoggerService.#logger.info(`⚡ Performance: ${operation}`, {
        duration: `${duration}ms`,
        ...details
      });
    };

    // Memory usage logging
    LoggerService.#logger.memoryUsage = () => {
      const usage = process.memoryUsage();
      LoggerService.#logger.debug('💾 Memory usage', {
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(usage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(usage.rss / 1024 / 1024)}MB`
      });
    };
  }

  /**
   * Create child logger with additional context
   */
  static createChildLogger(context) {
    const logger = LoggerService.getInstance();
    return logger.child(context);
  }

  /**
   * Set log level dynamically
   */
  static setLogLevel(level) {
    const logger = LoggerService.getInstance();
    logger.level = level;
  }

  /**
   * Get current log level
   */
  static getLogLevel() {
    const logger = LoggerService.getInstance();
    return logger.level;
  }

  /**
   * Flush all log transports
   */
  static async flush() {
    const logger = LoggerService.getInstance();
    return new Promise((resolve) => {
      logger.on('finish', resolve);
      logger.end();
    });
  }

  /**
   * Get log file paths
   */
  static getLogFilePaths() {
    const logsDir = join(__dirname, '..', '..', 'logs');
    return {
      main: join(logsDir, 'migration.log'),
      errors: join(logsDir, 'migration-errors.log'),
      exceptions: join(logsDir, 'migration-exceptions.log'),
      rejections: join(logsDir, 'migration-rejections.log')
    };
  }
}

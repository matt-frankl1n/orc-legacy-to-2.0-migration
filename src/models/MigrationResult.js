/**
 * Migration Result Model - Tracks the complete migration process results
 * Provides comprehensive statistics, error tracking, and timing information
 */
export class MigrationResult {
  constructor() {
    this.startTime = new Date();
    this.endTime = null;
    this.success = false;
    this.dryRun = false;
    this.configuration = null;
    
    // Error and warning tracking
    this.errors = [];
    this.warnings = [];
    
    // Migration statistics
    this.statistics = {
      roomsProcessed: 0,
      sessionsCreated: 0,
      subSessionsCreated: 0,
      usersProcessed: 0,
      moderatorsCreated: 0,
      filesUploaded: 0,
      totalFileSizeBytes: 0,
      apiCallsLegacy: 0,
      apiCallsCurrent: 0,
      parallelOperations: 0,
      averageRoomProcessingTime: 0,
      averageSessionProcessingTime: 0,
      averageFileUploadTime: 0
    };
    
    // Performance metrics
    this.performance = {
      totalDuration: 0,
      roomProcessingTimes: [],
      sessionProcessingTimes: [],
      fileUploadTimes: [],
      apiResponseTimes: {
        legacy: [],
        current: []
      },
      memoryUsage: {
        start: process.memoryUsage(),
        peak: process.memoryUsage(),
        end: null
      }
    };
    
    // Progress tracking
    this.progress = {
      currentPhase: 'initialization',
      completedPhases: [],
      currentRoom: null,
      currentSession: null,
      currentFile: null,
      totalOperations: 0,
      completedOperations: 0
    };
  }

  /**
   * Add error to the result
   */
  addError(context, error) {
    const errorEntry = {
      timestamp: new Date(),
      context: context,
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    };
    
    this.errors.push(errorEntry);
    
    // Mark as failed if this is the first error
    if (this.errors.length === 1) {
      this.success = false;
    }
  }

  /**
   * Add warning to the result
   */
  addWarning(context, message, details = null) {
    const warningEntry = {
      timestamp: new Date(),
      context: context,
      message: message,
      details: details
    };
    
    this.warnings.push(warningEntry);
  }

  /**
   * Update progress information
   */
  updateProgress(phase, currentRoom = null, currentSession = null, currentFile = null) {
    this.progress.currentPhase = phase;
    this.progress.currentRoom = currentRoom;
    this.progress.currentSession = currentSession;
    this.progress.currentFile = currentFile;
    
    // Track completed phases
    if (phase && !this.progress.completedPhases.includes(phase)) {
      this.progress.completedPhases.push(phase);
    }
  }

  /**
   * Update statistics
   */
  updateStatistics(key, value) {
    if (this.statistics.hasOwnProperty(key)) {
      this.statistics[key] = value;
    }
  }

  /**
   * Increment statistics counter
   */
  incrementStatistic(key, increment = 1) {
    if (this.statistics.hasOwnProperty(key)) {
      this.statistics[key] += increment;
    }
  }

  /**
   * Add performance timing
   */
  addPerformanceTiming(category, duration, operation = null) {
    if (this.performance[category] && Array.isArray(this.performance[category])) {
      this.performance[category].push({
        duration: duration,
        operation: operation,
        timestamp: new Date()
      });
    }
  }

  /**
   * Update memory usage
   */
  updateMemoryUsage(type = 'current') {
    const usage = process.memoryUsage();
    
    if (type === 'peak') {
      // Update peak memory usage
      const currentRss = usage.rss;
      const peakRss = this.performance.memoryUsage.peak.rss;
      
      if (currentRss > peakRss) {
        this.performance.memoryUsage.peak = usage;
      }
    } else if (type === 'end') {
      this.performance.memoryUsage.end = usage;
    }
  }

  /**
   * Calculate average processing times
   */
  calculateAverages() {
    // Calculate average room processing time
    if (this.performance.roomProcessingTimes.length > 0) {
      const totalRoomTime = this.performance.roomProcessingTimes.reduce((sum, timing) => sum + timing.duration, 0);
      this.statistics.averageRoomProcessingTime = Math.round(totalRoomTime / this.performance.roomProcessingTimes.length);
    }

    // Calculate average session processing time
    if (this.performance.sessionProcessingTimes.length > 0) {
      const totalSessionTime = this.performance.sessionProcessingTimes.reduce((sum, timing) => sum + timing.duration, 0);
      this.statistics.averageSessionProcessingTime = Math.round(totalSessionTime / this.performance.sessionProcessingTimes.length);
    }

    // Calculate average file upload time
    if (this.performance.fileUploadTimes.length > 0) {
      const totalFileTime = this.performance.fileUploadTimes.reduce((sum, timing) => sum + timing.duration, 0);
      this.statistics.averageFileUploadTime = Math.round(totalFileTime / this.performance.fileUploadTimes.length);
    }
  }

  /**
   * Finalize the migration result
   */
  finalize() {
    this.endTime = new Date();
    this.performance.totalDuration = this.getDuration();
    this.updateMemoryUsage('end');
    this.calculateAverages();
    
    // Determine success if not already set
    if (this.success === null) {
      this.success = this.errors.length === 0;
    }
  }

  /**
   * Get migration duration in milliseconds
   */
  getDuration() {
    if (!this.endTime) {
      return Date.now() - this.startTime.getTime();
    }
    return this.endTime.getTime() - this.startTime.getTime();
  }

  /**
   * Get formatted duration string
   */
  getFormattedDuration() {
    const duration = this.getDuration();
    const seconds = Math.floor(duration / 1000);
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
   * Get success rate percentage
   */
  getSuccessRate() {
    const totalOperations = this.statistics.roomsProcessed + 
                          this.statistics.sessionsCreated + 
                          this.statistics.usersProcessed + 
                          this.statistics.filesUploaded;
    
    if (totalOperations === 0) return 0;
    
    // Calculate failed operations based on errors
    const failedOperations = this.errors.length;
    const successfulOperations = totalOperations - failedOperations;
    
    return Math.round((successfulOperations / totalOperations) * 100);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    return {
      totalDuration: this.getFormattedDuration(),
      averageRoomProcessingTime: `${this.statistics.averageRoomProcessingTime}ms`,
      averageSessionProcessingTime: `${this.statistics.averageSessionProcessingTime}ms`,
      averageFileUploadTime: `${this.statistics.averageFileUploadTime}ms`,
      memoryUsage: {
        start: `${Math.round(this.performance.memoryUsage.start.rss / 1024 / 1024)}MB`,
        peak: `${Math.round(this.performance.memoryUsage.peak.rss / 1024 / 1024)}MB`,
        end: this.performance.memoryUsage.end ? `${Math.round(this.performance.memoryUsage.end.rss / 1024 / 1024)}MB` : 'N/A'
      }
    };
  }

  /**
   * Get error summary
   */
  getErrorSummary() {
    const errorsByContext = {};
    
    this.errors.forEach(error => {
      if (!errorsByContext[error.context]) {
        errorsByContext[error.context] = [];
      }
      errorsByContext[error.context].push(error);
    });
    
    return {
      totalErrors: this.errors.length,
      totalWarnings: this.warnings.length,
      errorsByContext: errorsByContext,
      criticalErrors: this.errors.filter(error => error.type === 'Error').length,
      networkErrors: this.errors.filter(error => error.message.includes('Network')).length,
      validationErrors: this.errors.filter(error => error.message.includes('validation')).length
    };
  }

  /**
   * Get migration summary
   */
  getMigrationSummary() {
    return {
      success: this.success,
      dryRun: this.dryRun,
      duration: this.getFormattedDuration(),
      successRate: `${this.getSuccessRate()}%`,
      statistics: this.statistics,
      errors: this.errors.length,
      warnings: this.warnings.length,
      configuration: {
        legacyEventName: this.configuration?.legacyEventName,
        targetEventId: this.configuration?.targetEventId,
        roomName: this.configuration?.roomName,
        migrateAllRooms: this.configuration?.migrateAllRooms,
        skipFiles: this.configuration?.skipFiles
      }
    };
  }

  /**
   * Export result to JSON
   */
  toJSON() {
    return {
      startTime: this.startTime.toISOString(),
      endTime: this.endTime?.toISOString(),
      success: this.success,
      dryRun: this.dryRun,
      duration: this.getDuration(),
      formattedDuration: this.getFormattedDuration(),
      configuration: this.configuration,
      statistics: this.statistics,
      errors: this.errors,
      warnings: this.warnings,
      performance: {
        ...this.performance,
        memoryUsage: {
          start: this.performance.memoryUsage.start,
          peak: this.performance.memoryUsage.peak,
          end: this.performance.memoryUsage.end
        }
      },
      progress: this.progress,
      summary: this.getMigrationSummary(),
      errorSummary: this.getErrorSummary(),
      performanceSummary: this.getPerformanceSummary()
    };
  }

  /**
   * Create result from JSON
   */
  static fromJSON(json) {
    const result = new MigrationResult();
    
    Object.assign(result, {
      startTime: new Date(json.startTime),
      endTime: json.endTime ? new Date(json.endTime) : null,
      success: json.success,
      dryRun: json.dryRun,
      configuration: json.configuration,
      statistics: json.statistics,
      errors: json.errors,
      warnings: json.warnings,
      performance: json.performance,
      progress: json.progress
    });
    
    return result;
  }
}

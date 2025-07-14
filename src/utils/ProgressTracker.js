import cliProgress from 'cli-progress';
import chalk from 'chalk';

/**
 * Progress Tracker - Handles progress tracking and display for migration operations
 * Provides real-time progress bars and status updates
 */
export class ProgressTracker {
  constructor(logger) {
    this.logger = logger;
    this.progressBars = new Map();
    this.currentOperations = new Map();
    
    // Statistics tracking
    this.statistics = {
      totalOperations: 0,
      completedOperations: 0,
      activeOperations: 0,
      startTime: null,
      operationHistory: []
    };
    
    // Create multi-bar container
    this.multiBar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: this.getProgressBarFormat(),
      barCompleteChar: '█',
      barIncompleteChar: '░',
      autopadding: true,
      stopOnComplete: true
    }, cliProgress.Presets.shades_classic);
  }

  /**
   * Get progress bar format string
   */
  getProgressBarFormat() {
    return `{operation} │{bar}│ {percentage}% │ {value}/{total} │ ETA: {eta}s │ {status}`;
  }

  /**
   * Start tracking a new operation
   */
  startOperation(operationName, totalItems, status = 'Starting...') {
    this.logger.info(`📊 Starting progress tracking for: ${operationName}`);
    
    // Update statistics
    this.statistics.totalOperations++;
    this.statistics.activeOperations++;
    
    if (!this.statistics.startTime) {
      this.statistics.startTime = new Date();
    }
    
    // Create progress bar
    const progressBar = this.multiBar.create(totalItems, 0, {
      operation: this.formatOperationName(operationName),
      status: this.formatStatus(status)
    });
    
    // Store progress bar reference
    this.progressBars.set(operationName, progressBar);
    
    // Store operation details
    this.currentOperations.set(operationName, {
      name: operationName,
      totalItems: totalItems,
      completedItems: 0,
      startTime: new Date(),
      endTime: null,
      status: status,
      progressBar: progressBar
    });
    
    return progressBar;
  }

  /**
   * Update progress for an operation
   */
  updateProgress(operationName, completedItems, totalItems = null, status = null) {
    const operation = this.currentOperations.get(operationName);
    
    if (!operation) {
      this.logger.warn(`⚠️  No operation found for progress update: ${operationName}`);
      return;
    }
    
    // Update operation details
    operation.completedItems = completedItems;
    if (totalItems) {
      operation.totalItems = totalItems;
    }
    if (status) {
      operation.status = status;
    }
    
    // Update progress bar
    const progressBar = operation.progressBar;
    if (progressBar) {
      progressBar.update(completedItems, {
        operation: this.formatOperationName(operationName),
        status: this.formatStatus(operation.status)
      });
      
      // Update total if changed
      if (totalItems && totalItems !== progressBar.getTotal()) {
        progressBar.setTotal(totalItems);
      }
    }
    
    // Log progress at intervals
    if (completedItems % 10 === 0 || completedItems === totalItems) {
      const percentage = Math.round((completedItems / operation.totalItems) * 100);
      this.logger.progress(operationName, completedItems, operation.totalItems, `${percentage}%`);
    }
  }

  /**
   * Complete an operation
   */
  completeOperation(operationName, finalStatus = 'Completed') {
    const operation = this.currentOperations.get(operationName);
    
    if (!operation) {
      this.logger.warn(`⚠️  No operation found for completion: ${operationName}`);
      return;
    }
    
    // Update operation details
    operation.endTime = new Date();
    operation.status = finalStatus;
    
    // Update progress bar to completion
    const progressBar = operation.progressBar;
    if (progressBar) {
      progressBar.update(operation.totalItems, {
        operation: this.formatOperationName(operationName),
        status: this.formatStatus(finalStatus)
      });
    }
    
    // Update statistics
    this.statistics.completedOperations++;
    this.statistics.activeOperations--;
    
    // Add to history
    this.statistics.operationHistory.push({
      name: operationName,
      totalItems: operation.totalItems,
      completedItems: operation.completedItems,
      startTime: operation.startTime,
      endTime: operation.endTime,
      duration: operation.endTime - operation.startTime,
      status: finalStatus
    });
    
    // Log completion
    const duration = operation.endTime - operation.startTime;
    this.logger.info(`✅ Operation completed: ${operationName} (${duration}ms)`);
    
    // Clean up
    this.currentOperations.delete(operationName);
    this.progressBars.delete(operationName);
  }

  /**
   * Fail an operation
   */
  failOperation(operationName, error, finalStatus = 'Failed') {
    const operation = this.currentOperations.get(operationName);
    
    if (!operation) {
      this.logger.warn(`⚠️  No operation found for failure: ${operationName}`);
      return;
    }
    
    // Update operation details
    operation.endTime = new Date();
    operation.status = finalStatus;
    operation.error = error;
    
    // Update progress bar
    const progressBar = operation.progressBar;
    if (progressBar) {
      progressBar.update(operation.completedItems, {
        operation: this.formatOperationName(operationName),
        status: this.formatStatus(finalStatus, true)
      });
    }
    
    // Update statistics
    this.statistics.activeOperations--;
    
    // Add to history
    this.statistics.operationHistory.push({
      name: operationName,
      totalItems: operation.totalItems,
      completedItems: operation.completedItems,
      startTime: operation.startTime,
      endTime: operation.endTime,
      duration: operation.endTime - operation.startTime,
      status: finalStatus,
      error: error.message
    });
    
    // Log failure
    const duration = operation.endTime - operation.startTime;
    this.logger.error(`❌ Operation failed: ${operationName} (${duration}ms)`, error);
    
    // Clean up
    this.currentOperations.delete(operationName);
    this.progressBars.delete(operationName);
  }

  /**
   * Update operation status
   */
  updateOperationStatus(operationName, status) {
    const operation = this.currentOperations.get(operationName);
    
    if (!operation) {
      this.logger.warn(`⚠️  No operation found for status update: ${operationName}`);
      return;
    }
    
    operation.status = status;
    
    // Update progress bar
    const progressBar = operation.progressBar;
    if (progressBar) {
      progressBar.update(operation.completedItems, {
        operation: this.formatOperationName(operationName),
        status: this.formatStatus(status)
      });
    }
  }

  /**
   * Format operation name for display
   */
  formatOperationName(name) {
    // Truncate long names and add padding
    const maxLength = 20;
    const truncated = name.length > maxLength ? name.substring(0, maxLength - 3) + '...' : name;
    return truncated.padEnd(maxLength);
  }

  /**
   * Format status for display
   */
  formatStatus(status, isError = false) {
    if (isError) {
      return chalk.red(status);
    }
    
    // Color-code common statuses
    if (status.includes('Completed') || status.includes('Done')) {
      return chalk.green(status);
    } else if (status.includes('Processing') || status.includes('Running')) {
      return chalk.yellow(status);
    } else if (status.includes('Failed') || status.includes('Error')) {
      return chalk.red(status);
    } else {
      return chalk.cyan(status);
    }
  }

  /**
   * Create a simple progress bar for file operations
   */
  createFileProgressBar(fileName, fileSize) {
    const operationName = `File: ${fileName}`;
    return this.startOperation(operationName, fileSize, 'Uploading...');
  }

  /**
   * Update file progress
   */
  updateFileProgress(fileName, bytesTransferred, totalBytes) {
    const operationName = `File: ${fileName}`;
    const percentage = Math.round((bytesTransferred / totalBytes) * 100);
    this.updateProgress(operationName, bytesTransferred, totalBytes, `${percentage}%`);
  }

  /**
   * Complete file progress
   */
  completeFileProgress(fileName) {
    const operationName = `File: ${fileName}`;
    this.completeOperation(operationName, 'Uploaded');
  }

  /**
   * Get active operations
   */
  getActiveOperations() {
    return Array.from(this.currentOperations.values()).map(op => ({
      name: op.name,
      totalItems: op.totalItems,
      completedItems: op.completedItems,
      percentage: Math.round((op.completedItems / op.totalItems) * 100),
      status: op.status,
      duration: Date.now() - op.startTime.getTime()
    }));
  }

  /**
   * Get overall progress
   */
  getOverallProgress() {
    const totalOperations = this.statistics.totalOperations;
    const completedOperations = this.statistics.completedOperations;
    const activeOperations = this.statistics.activeOperations;
    
    return {
      totalOperations: totalOperations,
      completedOperations: completedOperations,
      activeOperations: activeOperations,
      overallPercentage: totalOperations > 0 ? Math.round((completedOperations / totalOperations) * 100) : 0,
      startTime: this.statistics.startTime,
      duration: this.statistics.startTime ? Date.now() - this.statistics.startTime.getTime() : 0
    };
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      activeOperations: this.statistics.activeOperations,
      averageOperationTime: this.getAverageOperationTime(),
      totalDuration: this.getTotalDuration()
    };
  }

  /**
   * Get average operation time
   */
  getAverageOperationTime() {
    if (this.statistics.operationHistory.length === 0) {
      return 0;
    }
    
    const totalTime = this.statistics.operationHistory.reduce((sum, op) => sum + op.duration, 0);
    return Math.round(totalTime / this.statistics.operationHistory.length);
  }

  /**
   * Get total duration
   */
  getTotalDuration() {
    if (!this.statistics.startTime) {
      return 0;
    }
    
    return Date.now() - this.statistics.startTime.getTime();
  }

  /**
   * Stop all progress bars
   */
  stopAll() {
    this.multiBar.stop();
    
    // Clear all operations
    this.currentOperations.clear();
    this.progressBars.clear();
    
    this.logger.info('📊 Progress tracking stopped');
  }

  /**
   * Create a summary of completed operations
   */
  getCompletionSummary() {
    const history = this.statistics.operationHistory;
    const successful = history.filter(op => !op.error);
    const failed = history.filter(op => op.error);
    
    return {
      totalOperations: history.length,
      successfulOperations: successful.length,
      failedOperations: failed.length,
      successRate: history.length > 0 ? Math.round((successful.length / history.length) * 100) : 0,
      totalDuration: this.getTotalDuration(),
      averageOperationTime: this.getAverageOperationTime(),
      operations: history.map(op => ({
        name: op.name,
        duration: op.duration,
        status: op.status,
        itemsProcessed: op.completedItems,
        error: op.error || null
      }))
    };
  }
}

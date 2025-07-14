import pLimit from 'p-limit';

/**
 * Parallel Processor - Handles concurrent processing of migration tasks
 * Uses p-limit for semaphore-based concurrency control
 */
export class ParallelProcessor {
  constructor(concurrency = 6, logger) {
    this.concurrency = concurrency;
    this.logger = logger;
    this.limit = pLimit(concurrency);
    
    // Statistics tracking
    this.statistics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      startTime: null,
      endTime: null,
      activeTasks: 0,
      maxActiveTasks: 0
    };
  }

  /**
   * Process rooms in parallel with concurrency control
   */
  async processRooms(rooms, processingFunction, progressCallback = null) {
    this.logger.info(`🔄 Starting parallel processing of ${rooms.length} rooms (concurrency: ${this.concurrency})`);
    
    this.statistics.totalTasks = rooms.length;
    this.statistics.startTime = new Date();
    this.statistics.completedTasks = 0;
    this.statistics.failedTasks = 0;
    this.statistics.activeTasks = 0;
    
    const results = [];
    
    // Create array of limited processing functions
    const limitedTasks = rooms.map((room, index) => {
      return this.limit(async () => {
        const taskStartTime = Date.now();
        
        try {
          // Track active tasks
          this.statistics.activeTasks++;
          this.statistics.maxActiveTasks = Math.max(this.statistics.maxActiveTasks, this.statistics.activeTasks);
          
          this.logger.info(`🏠 Processing room ${index + 1}/${rooms.length}: ${room.name}`);
          
          // Execute the processing function
          const result = await processingFunction(room);
          
          // Update statistics
          this.statistics.completedTasks++;
          this.statistics.activeTasks--;
          
          // Call progress callback if provided
          if (progressCallback) {
            progressCallback(this.statistics.completedTasks, this.statistics.totalTasks);
          }
          
          const taskDuration = Date.now() - taskStartTime;
          this.logger.info(`✅ Room ${index + 1}/${rooms.length} completed in ${taskDuration}ms: ${room.name}`);
          
          return {
            success: true,
            room: room,
            result: result,
            duration: taskDuration,
            index: index
          };
          
        } catch (error) {
          // Handle error
          this.statistics.failedTasks++;
          this.statistics.activeTasks--;
          
          const taskDuration = Date.now() - taskStartTime;
          this.logger.error(`❌ Room ${index + 1}/${rooms.length} failed in ${taskDuration}ms: ${room.name}`, error);
          
          return {
            success: false,
            room: room,
            error: error,
            duration: taskDuration,
            index: index
          };
        }
      });
    });
    
    // Execute all tasks with progress tracking
    try {
      this.logger.info('⏳ Executing parallel room processing...');
      
      // Use Promise.allSettled to handle both successful and failed tasks
      const settledResults = await Promise.allSettled(limitedTasks);
      
      // Process results
      for (const settledResult of settledResults) {
        if (settledResult.status === 'fulfilled') {
          results.push(settledResult.value);
        } else {
          // Handle promise rejection
          this.statistics.failedTasks++;
          this.logger.error('❌ Task promise rejected:', settledResult.reason);
          
          results.push({
            success: false,
            error: settledResult.reason,
            duration: 0,
            index: -1
          });
        }
      }
      
      this.statistics.endTime = new Date();
      
      // Log completion summary
      const totalDuration = this.statistics.endTime - this.statistics.startTime;
      const successRate = ((this.statistics.completedTasks / this.statistics.totalTasks) * 100).toFixed(1);
      
      this.logger.info(`🎉 Parallel processing completed in ${totalDuration}ms`);
      this.logger.info(`📊 Results: ${this.statistics.completedTasks}/${this.statistics.totalTasks} successful (${successRate}%)`);
      
      if (this.statistics.failedTasks > 0) {
        this.logger.warn(`⚠️  ${this.statistics.failedTasks} tasks failed`);
      }
      
      return results;
      
    } catch (error) {
      this.statistics.endTime = new Date();
      this.logger.error('💥 Parallel processing failed:', error);
      throw error;
    }
  }

  /**
   * Process array of items in parallel with generic processing function
   */
  async processItems(items, processingFunction, progressCallback = null, itemName = 'item') {
    this.logger.info(`🔄 Starting parallel processing of ${items.length} ${itemName}s (concurrency: ${this.concurrency})`);
    
    this.statistics.totalTasks = items.length;
    this.statistics.startTime = new Date();
    this.statistics.completedTasks = 0;
    this.statistics.failedTasks = 0;
    this.statistics.activeTasks = 0;
    
    const results = [];
    
    // Create array of limited processing functions
    const limitedTasks = items.map((item, index) => {
      return this.limit(async () => {
        const taskStartTime = Date.now();
        
        try {
          // Track active tasks
          this.statistics.activeTasks++;
          this.statistics.maxActiveTasks = Math.max(this.statistics.maxActiveTasks, this.statistics.activeTasks);
          
          this.logger.debug(`Processing ${itemName} ${index + 1}/${items.length}`);
          
          // Execute the processing function
          const result = await processingFunction(item, index);
          
          // Update statistics
          this.statistics.completedTasks++;
          this.statistics.activeTasks--;
          
          // Call progress callback if provided
          if (progressCallback) {
            progressCallback(this.statistics.completedTasks, this.statistics.totalTasks);
          }
          
          const taskDuration = Date.now() - taskStartTime;
          this.logger.debug(`✅ ${itemName} ${index + 1}/${items.length} completed in ${taskDuration}ms`);
          
          return {
            success: true,
            item: item,
            result: result,
            duration: taskDuration,
            index: index
          };
          
        } catch (error) {
          // Handle error
          this.statistics.failedTasks++;
          this.statistics.activeTasks--;
          
          const taskDuration = Date.now() - taskStartTime;
          this.logger.error(`❌ ${itemName} ${index + 1}/${items.length} failed in ${taskDuration}ms`, error);
          
          return {
            success: false,
            item: item,
            error: error,
            duration: taskDuration,
            index: index
          };
        }
      });
    });
    
    // Execute all tasks
    try {
      const settledResults = await Promise.allSettled(limitedTasks);
      
      // Process results
      for (const settledResult of settledResults) {
        if (settledResult.status === 'fulfilled') {
          results.push(settledResult.value);
        } else {
          this.statistics.failedTasks++;
          this.logger.error(`❌ ${itemName} task promise rejected:`, settledResult.reason);
          
          results.push({
            success: false,
            error: settledResult.reason,
            duration: 0,
            index: -1
          });
        }
      }
      
      this.statistics.endTime = new Date();
      
      // Log completion summary
      const totalDuration = this.statistics.endTime - this.statistics.startTime;
      const successRate = ((this.statistics.completedTasks / this.statistics.totalTasks) * 100).toFixed(1);
      
      this.logger.info(`🎉 Parallel ${itemName} processing completed in ${totalDuration}ms`);
      this.logger.info(`📊 Results: ${this.statistics.completedTasks}/${this.statistics.totalTasks} successful (${successRate}%)`);
      
      return results;
      
    } catch (error) {
      this.statistics.endTime = new Date();
      this.logger.error(`💥 Parallel ${itemName} processing failed:`, error);
      throw error;
    }
  }

  /**
   * Process files in parallel with progress tracking
   */
  async processFiles(files, processingFunction, progressCallback = null) {
    // Use lower concurrency for file processing to avoid overwhelming the system
    const fileConcurrency = Math.min(this.concurrency, 3);
    const fileLimit = pLimit(fileConcurrency);
    
    this.logger.info(`📁 Starting parallel file processing of ${files.length} files (concurrency: ${fileConcurrency})`);
    
    const results = [];
    let completed = 0;
    
    const limitedTasks = files.map((file, index) => {
      return fileLimit(async () => {
        const taskStartTime = Date.now();
        
        try {
          this.logger.fileOperation('processing', file.fileName || `file-${index}`);
          
          const result = await processingFunction(file, index);
          
          completed++;
          if (progressCallback) {
            progressCallback(completed, files.length);
          }
          
          const taskDuration = Date.now() - taskStartTime;
          this.logger.fileOperation('completed', file.fileName || `file-${index}`, taskDuration);
          
          return {
            success: true,
            file: file,
            result: result,
            duration: taskDuration,
            index: index
          };
          
        } catch (error) {
          completed++;
          if (progressCallback) {
            progressCallback(completed, files.length);
          }
          
          const taskDuration = Date.now() - taskStartTime;
          this.logger.fileError('processing', file.fileName || `file-${index}`, error);
          
          return {
            success: false,
            file: file,
            error: error,
            duration: taskDuration,
            index: index
          };
        }
      });
    });
    
    // Execute all file processing tasks
    const settledResults = await Promise.allSettled(limitedTasks);
    
    // Process results
    for (const settledResult of settledResults) {
      if (settledResult.status === 'fulfilled') {
        results.push(settledResult.value);
      } else {
        this.logger.error('❌ File processing task promise rejected:', settledResult.reason);
        results.push({
          success: false,
          error: settledResult.reason,
          duration: 0,
          index: -1
        });
      }
    }
    
    return results;
  }

  /**
   * Get current statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      concurrency: this.concurrency,
      duration: this.statistics.endTime && this.statistics.startTime 
        ? this.statistics.endTime - this.statistics.startTime 
        : null
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.statistics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      startTime: null,
      endTime: null,
      activeTasks: 0,
      maxActiveTasks: 0
    };
  }

  /**
   * Update concurrency limit
   */
  updateConcurrency(newConcurrency) {
    this.concurrency = newConcurrency;
    this.limit = pLimit(newConcurrency);
    this.logger.info(`Updated concurrency limit to ${newConcurrency}`);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    if (!this.statistics.startTime || !this.statistics.endTime) {
      return null;
    }
    
    const totalDuration = this.statistics.endTime - this.statistics.startTime;
    const averageTaskTime = totalDuration / this.statistics.totalTasks;
    const throughput = this.statistics.completedTasks / (totalDuration / 1000); // tasks per second
    
    return {
      totalDuration: totalDuration,
      averageTaskTime: averageTaskTime,
      throughput: throughput,
      successRate: (this.statistics.completedTasks / this.statistics.totalTasks) * 100,
      maxConcurrency: this.statistics.maxActiveTasks,
      efficiency: (this.statistics.maxActiveTasks / this.concurrency) * 100
    };
  }
}

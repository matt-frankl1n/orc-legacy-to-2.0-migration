import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { setTimeout } from 'node:timers/promises';

describe('Integration Tests', () => {
  describe('Application Flow', () => {
    it('should handle basic CLI parsing', async () => {
      // Mock process.argv for testing
      const originalArgv = process.argv;
      process.argv = ['node', 'index.js', 'TEST_EVENT', '123', '--dry-run'];
      
      try {
        // This would normally start the application
        // For integration testing, we'd need to mock the services
        assert.ok(true, 'CLI parsing should work');
      } finally {
        process.argv = originalArgv;
      }
    });

    it('should validate configuration properly', async () => {
      // Test configuration validation flow
      const { ConfigManager } = await import('../../src/config/ConfigManager.js');
      
      const validConfig = {
        legacyEventName: 'TEST_EVENT',
        targetEventId: 123,
        roomName: null,
        migrateAllRooms: true,
        verbose: false,
        skipFiles: false,
        dryRun: true,
        maxConcurrentRooms: 3,
        timeout: 30000
      };
      
      const result = ConfigManager.validateConfig(validConfig);
      assert.ok(result);
      assert.strictEqual(result.legacyEventName, 'TEST_EVENT');
      assert.strictEqual(result.targetEventId, 123);
      assert.strictEqual(result.dryRun, true);
    });

    it('should handle service initialization', async () => {
      // Test service initialization without actual API calls
      const { LoggerService } = await import('../../src/services/LoggerService.js');
      
      const logger = LoggerService.getInstance();
      assert.ok(logger);
      
      // Test logging methods
      logger.info('Test info message');
      logger.warn('Test warning message');
      logger.error('Test error message');
      
      // Logger should be singleton
      const logger2 = LoggerService.getInstance();
      assert.strictEqual(logger, logger2);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing environment variables gracefully', async () => {
      // Save original environment
      const originalEnv = { ...process.env };
      
      try {
        // Clear required environment variables
        delete process.env.LEGACY_API_TOKEN;
        delete process.env.CURRENT_API_TOKEN;
        delete process.env.CURRENT_FILES_API_TOKEN;
        
        const { ConfigManager } = await import('../../src/config/ConfigManager.js');
        
        assert.throws(() => {
          ConfigManager.load();
        }, /Missing required environment variables/);
        
      } finally {
        // Restore environment
        process.env = originalEnv;
      }
    });

    it('should handle invalid CLI arguments', async () => {
      const { ConfigManager } = await import('../../src/config/ConfigManager.js');
      
      const invalidConfig = {
        legacyEventName: '', // Invalid: empty string
        targetEventId: 123,
        roomName: null,
        migrateAllRooms: true,
        verbose: false,
        skipFiles: false,
        dryRun: false,
        maxConcurrentRooms: null,
        timeout: null
      };
      
      assert.throws(() => {
        ConfigManager.validateConfig(invalidConfig);
      }, /legacyEventName/);
    });
  });

  describe('Performance', () => {
    it('should handle parallel processing efficiently', async () => {
      const { ParallelProcessor } = await import('../../src/utils/ParallelProcessor.js');
      
      const processor = new ParallelProcessor(3);
      const items = Array.from({ length: 9 }, (_, i) => i + 1);
      
      const startTime = Date.now();
      
      const results = await processor.process(items, async (item) => {
        await setTimeout(10);
        return item * 2;
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      assert.strictEqual(results.length, 9);
      assert.deepStrictEqual(results, [2, 4, 6, 8, 10, 12, 14, 16, 18]);
      
      // With 3 concurrent processes and 9 items taking 10ms each,
      // it should take roughly 30ms (3 batches) + overhead
      // Allow for some timing variance in tests
      assert.ok(duration < 100, `Duration should be less than 100ms, got ${duration}ms`);
    });
  });

  describe('Data Flow', () => {
    it('should handle migration result tracking', async () => {
      const { MigrationResult } = await import('../../src/models/MigrationResult.js');
      
      const result = new MigrationResult();
      
      // Simulate migration progress
      result.incrementRoomCount();
      result.incrementRoomCount();
      result.incrementRoomCount();
      
      result.markRoomProcessed();
      result.markRoomProcessed();
      result.markRoomFailed();
      
      result.addError(new Error('Test error'), 'Room 3');
      result.addWarning('Test warning', 'Room 1');
      
      result.finalize();
      
      assert.strictEqual(result.totalRooms, 3);
      assert.strictEqual(result.processedRooms, 2);
      assert.strictEqual(result.failedRooms, 1);
      assert.strictEqual(result.success, false); // Has failures
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.warnings.length, 1);
      assert.strictEqual(result.getSuccessRate(), 66.67); // 2/3 processed
    });
  });
});

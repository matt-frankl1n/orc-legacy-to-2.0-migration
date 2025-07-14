import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { ConfigManager } from '../../src/config/ConfigManager.js';

describe('ConfigManager', () => {
  let originalEnv;

  before(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  after(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validateConfig', () => {
    it('should validate a valid configuration', () => {
      const config = {
        legacyEventName: 'TEST_EVENT',
        targetEventId: 123,
        roomName: null,
        migrateAllRooms: true,
        verbose: false,
        skipFiles: false,
        dryRun: false,
        maxConcurrentRooms: null,
        timeout: null
      };

      const result = ConfigManager.validateConfig(config);
      assert.ok(result);
      assert.strictEqual(result.legacyEventName, 'TEST_EVENT');
      assert.strictEqual(result.targetEventId, 123);
      assert.strictEqual(result.migrateAllRooms, true);
    });

    it('should throw error for invalid event name', () => {
      const config = {
        legacyEventName: '',
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
        ConfigManager.validateConfig(config);
      }, /legacyEventName/);
    });

    it('should throw error for invalid target event ID', () => {
      const config = {
        legacyEventName: 'TEST_EVENT',
        targetEventId: -1,
        roomName: null,
        migrateAllRooms: true,
        verbose: false,
        skipFiles: false,
        dryRun: false,
        maxConcurrentRooms: null,
        timeout: null
      };

      assert.throws(() => {
        ConfigManager.validateConfig(config);
      }, /targetEventId/);
    });

    it('should validate concurrent rooms configuration', () => {
      const config = {
        legacyEventName: 'TEST_EVENT',
        targetEventId: 123,
        roomName: null,
        migrateAllRooms: true,
        verbose: false,
        skipFiles: false,
        dryRun: false,
        maxConcurrentRooms: 5,
        timeout: null
      };

      const result = ConfigManager.validateConfig(config);
      assert.strictEqual(result.maxConcurrentRooms, 5);
    });
  });

  describe('load', () => {
    it('should load configuration with environment variables', () => {
      // Set test environment variables
      process.env.LEGACY_API_TOKEN = 'test-legacy-token';
      process.env.CURRENT_API_TOKEN = 'test-current-token';
      process.env.CURRENT_FILES_API_TOKEN = 'test-files-token';

      const config = ConfigManager.load();
      
      assert.ok(config);
      assert.ok(config.legacyApi);
      assert.ok(config.currentApi);
      assert.ok(config.currentFilesApi);
    });

    it('should handle missing environment variables', () => {
      // Clear environment variables
      delete process.env.LEGACY_API_TOKEN;
      delete process.env.CURRENT_API_TOKEN;
      delete process.env.CURRENT_FILES_API_TOKEN;

      assert.throws(() => {
        ConfigManager.load();
      }, /Missing required environment variables/);
    });
  });
});

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { MigrationResult } from '../../src/models/MigrationResult.js';

describe('MigrationResult', () => {
  let result;

  before(() => {
    result = new MigrationResult();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.totalRooms, 0);
      assert.strictEqual(result.processedRooms, 0);
      assert.strictEqual(result.skippedRooms, 0);
      assert.strictEqual(result.failedRooms, 0);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should have proper structure', () => {
      assert.ok(result.hasOwnProperty('success'));
      assert.ok(result.hasOwnProperty('totalRooms'));
      assert.ok(result.hasOwnProperty('processedRooms'));
      assert.ok(result.hasOwnProperty('skippedRooms'));
      assert.ok(result.hasOwnProperty('failedRooms'));
      assert.ok(result.hasOwnProperty('errors'));
      assert.ok(result.hasOwnProperty('warnings'));
      assert.ok(result.hasOwnProperty('performance'));
    });
  });

  describe('addError', () => {
    it('should add error with proper structure', () => {
      const error = new Error('Test error');
      error.code = 'TEST_ERROR';
      
      result.addError(error, 'TEST_ROOM');
      
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0].message, 'Test error');
      assert.strictEqual(result.errors[0].code, 'TEST_ERROR');
      assert.strictEqual(result.errors[0].room, 'TEST_ROOM');
      assert.ok(result.errors[0].timestamp);
    });

    it('should handle error without room context', () => {
      const error = new Error('Global error');
      result.addError(error);
      
      assert.strictEqual(result.errors.length, 2); // Previous test added one
      assert.strictEqual(result.errors[1].message, 'Global error');
      assert.strictEqual(result.errors[1].room, 'Unknown');
    });
  });

  describe('addWarning', () => {
    it('should add warning with proper structure', () => {
      result.addWarning('Test warning', 'TEST_ROOM');
      
      assert.strictEqual(result.warnings.length, 1);
      assert.strictEqual(result.warnings[0].message, 'Test warning');
      assert.strictEqual(result.warnings[0].room, 'TEST_ROOM');
      assert.ok(result.warnings[0].timestamp);
    });
  });

  describe('incrementRoomCount', () => {
    it('should increment room count', () => {
      result.incrementRoomCount();
      assert.strictEqual(result.totalRooms, 1);
      
      result.incrementRoomCount();
      assert.strictEqual(result.totalRooms, 2);
    });
  });

  describe('markRoomProcessed', () => {
    it('should mark room as processed', () => {
      result.markRoomProcessed();
      assert.strictEqual(result.processedRooms, 1);
    });
  });

  describe('markRoomSkipped', () => {
    it('should mark room as skipped', () => {
      result.markRoomSkipped();
      assert.strictEqual(result.skippedRooms, 1);
    });
  });

  describe('markRoomFailed', () => {
    it('should mark room as failed', () => {
      result.markRoomFailed();
      assert.strictEqual(result.failedRooms, 1);
    });
  });

  describe('finalize', () => {
    it('should finalize with success when no failures', () => {
      const newResult = new MigrationResult();
      newResult.incrementRoomCount();
      newResult.markRoomProcessed();
      
      newResult.finalize();
      
      assert.strictEqual(newResult.success, true);
      assert.ok(newResult.performance.endTime);
      assert.ok(newResult.performance.duration >= 0);
    });

    it('should finalize with failure when rooms failed', () => {
      const newResult = new MigrationResult();
      newResult.incrementRoomCount();
      newResult.markRoomFailed();
      
      newResult.finalize();
      
      assert.strictEqual(newResult.success, false);
    });
  });

  describe('getSuccessRate', () => {
    it('should calculate success rate correctly', () => {
      const newResult = new MigrationResult();
      newResult.incrementRoomCount();
      newResult.incrementRoomCount();
      newResult.markRoomProcessed();
      newResult.markRoomFailed();
      
      const successRate = newResult.getSuccessRate();
      assert.strictEqual(successRate, 50); // 1 processed out of 2 total
    });

    it('should return 0 for no rooms', () => {
      const newResult = new MigrationResult();
      const successRate = newResult.getSuccessRate();
      assert.strictEqual(successRate, 0);
    });
  });
});

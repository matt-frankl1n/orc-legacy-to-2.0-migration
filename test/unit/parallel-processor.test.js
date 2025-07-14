import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { setTimeout } from 'node:timers/promises';
import { ParallelProcessor } from '../../src/utils/ParallelProcessor.js';

describe('ParallelProcessor', () => {
  describe('process', () => {
    it('should process items in parallel with concurrency limit', async () => {
      const processor = new ParallelProcessor(2); // Max 2 concurrent
      const items = [1, 2, 3, 4, 5];
      const processedItems = [];
      const startTimes = [];
      
      const processItem = async (item) => {
        startTimes.push(Date.now());
        await setTimeout(50); // Simulate async work
        processedItems.push(item);
        return item * 2;
      };
      
      const results = await processor.process(items, processItem);
      
      // Should process all items
      assert.strictEqual(results.length, 5);
      assert.deepStrictEqual(results, [2, 4, 6, 8, 10]);
      assert.deepStrictEqual(processedItems.sort(), [1, 2, 3, 4, 5]);
      
      // Check that concurrency was respected
      // With concurrency 2 and 50ms delay, first two should start almost simultaneously
      const timeDiff = startTimes[1] - startTimes[0];
      assert.ok(timeDiff < 25, `Time difference should be less than 25ms, got ${timeDiff}ms`);
    });

    it('should handle empty array', async () => {
      const processor = new ParallelProcessor(2);
      const results = await processor.process([], async (item) => item);
      
      assert.strictEqual(results.length, 0);
    });

    it('should handle single item', async () => {
      const processor = new ParallelProcessor(2);
      const results = await processor.process([1], async (item) => item * 3);
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0], 3);
    });

    it('should handle errors properly', async () => {
      const processor = new ParallelProcessor(2);
      const items = [1, 2, 3];
      
      const processItem = async (item) => {
        if (item === 2) {
          throw new Error('Test error');
        }
        return item * 2;
      };
      
      try {
        await processor.process(items, processItem);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.strictEqual(error.message, 'Test error');
      }
    });

    it('should respect concurrency limit of 1', async () => {
      const processor = new ParallelProcessor(1);
      const items = [1, 2, 3];
      const processOrder = [];
      
      const processItem = async (item) => {
        processOrder.push(`start-${item}`);
        await setTimeout(10);
        processOrder.push(`end-${item}`);
        return item;
      };
      
      await processor.process(items, processItem);
      
      // With concurrency 1, items should be processed sequentially
      assert.deepStrictEqual(processOrder, [
        'start-1', 'end-1',
        'start-2', 'end-2',
        'start-3', 'end-3'
      ]);
    });

    it('should handle high concurrency limit', async () => {
      const processor = new ParallelProcessor(10);
      const items = [1, 2, 3];
      const startTimes = [];
      
      const processItem = async (item) => {
        startTimes.push(Date.now());
        await setTimeout(20);
        return item;
      };
      
      await processor.process(items, processItem);
      
      // All items should start almost simultaneously
      const maxTimeDiff = Math.max(...startTimes) - Math.min(...startTimes);
      assert.ok(maxTimeDiff < 15, `Max time difference should be less than 15ms, got ${maxTimeDiff}ms`);
    });
  });
});

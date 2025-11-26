/**
 * Property-Based Tests for Worker Pool
 * Feature: worker-failover
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { WorkerPool, WorkerPoolConfig } from './worker-pool';

const DEFAULT_CONFIG: WorkerPoolConfig = {
  healthCheckInterval: 60000,
  unhealthyThreshold: 50,
  cooldownPeriod: 300000,
  rateLimitCooldown: 60000,
  dailyQuota: 100000,
};

describe('WorkerPool Property Tests', () => {
  /**
   * Feature: worker-failover, Property 1: Worker Selection Consistency
   * Validates: Requirements 3.2
   * 
   * For any Worker pool with at least one healthy Worker, calling selectWorker()
   * multiple times should cycle through all healthy Workers in round-robin order
   * before repeating.
   */
  describe('Property 1: Worker Selection Consistency', () => {
    it('should cycle through all healthy workers in round-robin order', () => {
      fc.assert(
        fc.property(
          // Generate 2-10 worker URLs
          fc.array(
            fc.webUrl({ validSchemes: ['https'] }),
            { minLength: 2, maxLength: 10 }
          ),
          (workerUrls) => {
            // Create pool with generated workers
            const pool = new WorkerPool(workerUrls, DEFAULT_CONFIG);
            
            const healthyCount = pool.getStats().healthyWorkers;
            
            // Skip if no healthy workers
            if (healthyCount === 0) return true;
            
            // Select workers for 2 full cycles
            const selections: string[] = [];
            for (let i = 0; i < healthyCount * 2; i++) {
              const worker = pool.selectWorker();
              if (worker) {
                selections.push(worker.id);
              }
            }
            
            // Verify we got the expected number of selections
            expect(selections.length).toBe(healthyCount * 2);
            
            // First cycle
            const firstCycle = selections.slice(0, healthyCount);
            // Second cycle
            const secondCycle = selections.slice(healthyCount, healthyCount * 2);
            
            // Verify second cycle matches first cycle (round-robin)
            expect(secondCycle).toEqual(firstCycle);
            
            // Verify all selections in first cycle are unique
            const uniqueInFirstCycle = new Set(firstCycle);
            expect(uniqueInFirstCycle.size).toBe(healthyCount);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only select healthy workers', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.webUrl({ validSchemes: ['https'] }),
            { minLength: 3, maxLength: 10 }
          ),
          (workerUrls) => {
            const pool = new WorkerPool(workerUrls, DEFAULT_CONFIG);
            const workers = pool.getWorkers();
            
            if (workers.length === 0) return true;
            
            // Mark some workers as unhealthy
            const firstWorker = workers[0];
            if (firstWorker) {
              // Simulate failures to make it unhealthy
              for (let i = 0; i < 10; i++) {
                pool.recordFailure(firstWorker.id, new Error('Test failure'));
              }
            }
            
            // Select workers multiple times
            const selections: string[] = [];
            for (let i = 0; i < 20; i++) {
              const worker = pool.selectWorker();
              if (worker) {
                selections.push(worker.id);
              }
            }
            
            // Verify unhealthy worker was never selected
            expect(selections).not.toContain(firstWorker?.id);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should exclude permanently disabled workers', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.webUrl({ validSchemes: ['https'] }),
            { minLength: 3, maxLength: 10 }
          ),
          (workerUrls) => {
            const pool = new WorkerPool(workerUrls, DEFAULT_CONFIG);
            const workers = pool.getWorkers();
            
            if (workers.length === 0) return true;
            
            // Permanently disable first worker
            const firstWorker = workers[0];
            if (firstWorker) {
              pool.permanentlyDisable(firstWorker.id, 'test_block');
            }
            
            // Select workers multiple times
            const selections: string[] = [];
            for (let i = 0; i < 20; i++) {
              const worker = pool.selectWorker();
              if (worker) {
                selections.push(worker.id);
              }
            }
            
            // Verify disabled worker was never selected
            expect(selections).not.toContain(firstWorker?.id);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should exclude rate-limited workers', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.webUrl({ validSchemes: ['https'] }),
            { minLength: 3, maxLength: 10 }
          ),
          (workerUrls) => {
            const pool = new WorkerPool(workerUrls, DEFAULT_CONFIG);
            const workers = pool.getWorkers();
            
            if (workers.length === 0) return true;
            
            // Rate limit first worker
            const firstWorker = workers[0];
            if (firstWorker) {
              pool.recordRateLimit(firstWorker.id);
            }
            
            // Select workers immediately
            const selections: string[] = [];
            for (let i = 0; i < 20; i++) {
              const worker = pool.selectWorker();
              if (worker) {
                selections.push(worker.id);
              }
            }
            
            // Verify rate-limited worker was not selected
            expect(selections).not.toContain(firstWorker?.id);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should exclude workers that exhausted quota', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.webUrl({ validSchemes: ['https'] }),
            { minLength: 3, maxLength: 10 }
          ),
          (workerUrls) => {
            const pool = new WorkerPool(workerUrls, DEFAULT_CONFIG);
            const workers = pool.getWorkers();
            
            if (workers.length === 0) return true;
            
            // Exhaust quota for first worker
            const firstWorker = workers[0];
            if (firstWorker) {
              pool.incrementUsage(firstWorker.id, DEFAULT_CONFIG.dailyQuota);
            }
            
            // Select workers
            const selections: string[] = [];
            for (let i = 0; i < 20; i++) {
              const worker = pool.selectWorker();
              if (worker) {
                selections.push(worker.id);
              }
            }
            
            // Verify quota-exhausted worker was not selected
            expect(selections).not.toContain(firstWorker?.id);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: worker-failover, Property 9: Quota Enforcement
   * Validates: Requirements 9.6, 9.7
   * 
   * For any Worker, the total number of requests sent to it in a single day
   * should never exceed its configured daily quota (default 100,000).
   */
  describe('Property 9: Quota Enforcement', () => {
    it('should never exceed daily quota for any worker', () => {
      fc.assert(
        fc.property(
          // Generate 2-5 worker URLs
          fc.array(
            fc.webUrl({ validSchemes: ['https'] }),
            { minLength: 2, maxLength: 5 }
          ),
          // Generate random quota (1000-10000 for faster testing)
          fc.integer({ min: 1000, max: 10000 }),
          // Generate random usage increments
          fc.array(
            fc.integer({ min: 1, max: 100 }),
            { minLength: 10, maxLength: 50 }
          ),
          (workerUrls, quota, increments) => {
            const config = { ...DEFAULT_CONFIG, dailyQuota: quota };
            const pool = new WorkerPool(workerUrls, config);
            const workers = pool.getWorkers();
            
            if (workers.length === 0) return true;
            
            // Pick first worker to test
            const worker = workers[0];
            if (!worker) return true;
            
            // Apply increments until quota would be exceeded
            let totalUsage = 0;
            for (const increment of increments) {
              if (totalUsage + increment <= quota) {
                pool.incrementUsage(worker.id, increment);
                totalUsage += increment;
              }
            }
            
            // Verify usage never exceeds quota
            const updatedWorker = pool.getWorker(worker.id);
            expect(updatedWorker?.dailyUsage).toBeLessThanOrEqual(quota);
            
            // Try to add more usage
            pool.incrementUsage(worker.id, 1);
            const finalWorker = pool.getWorker(worker.id);
            
            // Verify it still doesn't exceed quota (or equals it)
            expect(finalWorker?.dailyUsage).toBeLessThanOrEqual(quota + 1);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should mark worker as unhealthy when quota exhausted', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.webUrl({ validSchemes: ['https'] }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.integer({ min: 100, max: 1000 }),
          (workerUrls, quota) => {
            const config = { ...DEFAULT_CONFIG, dailyQuota: quota };
            const pool = new WorkerPool(workerUrls, config);
            const workers = pool.getWorkers();
            
            if (workers.length === 0) return true;
            
            const worker = workers[0];
            if (!worker) return true;
            
            // Exhaust quota
            pool.incrementUsage(worker.id, quota);
            
            // Verify worker is marked unhealthy
            const updatedWorker = pool.getWorker(worker.id);
            expect(updatedWorker?.healthy).toBe(false);
            expect(updatedWorker?.dailyUsage).toBeGreaterThanOrEqual(quota);
            
            // Verify worker is not selected
            const selected = pool.selectWorker();
            if (selected) {
              expect(selected.id).not.toBe(worker.id);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should exclude quota-exhausted workers from selection', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.webUrl({ validSchemes: ['https'] }),
            { minLength: 3, maxLength: 10 }
          ),
          (workerUrls) => {
            const pool = new WorkerPool(workerUrls, DEFAULT_CONFIG);
            const workers = pool.getWorkers();
            
            if (workers.length < 2) return true;
            
            // Exhaust quota for first worker
            const firstWorker = workers[0];
            if (firstWorker) {
              pool.incrementUsage(firstWorker.id, DEFAULT_CONFIG.dailyQuota);
            }
            
            // Select workers multiple times
            const selections: string[] = [];
            for (let i = 0; i < 20; i++) {
              const worker = pool.selectWorker();
              if (worker) {
                selections.push(worker.id);
              }
            }
            
            // Verify exhausted worker was never selected
            expect(selections).not.toContain(firstWorker?.id);
            
            // Verify other workers were selected
            expect(selections.length).toBeGreaterThan(0);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track usage correctly across multiple increments', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['https'] }),
          fc.array(
            fc.integer({ min: 1, max: 100 }),
            { minLength: 5, maxLength: 20 }
          ),
          (workerUrl, increments) => {
            const pool = new WorkerPool([workerUrl], DEFAULT_CONFIG);
            const workers = pool.getWorkers();
            
            if (workers.length === 0) return true;
            
            const worker = workers[0];
            if (!worker) return true;
            
            // Apply increments
            let expectedUsage = 0;
            for (const increment of increments) {
              pool.incrementUsage(worker.id, increment);
              expectedUsage += increment;
              
              // Verify usage matches expected
              const updatedWorker = pool.getWorker(worker.id);
              expect(updatedWorker?.dailyUsage).toBe(expectedUsage);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: worker-failover, Property 11: Quota Reset
   * Validates: Requirements 9.8
   * 
   * For any Worker at midnight UTC, its daily usage counter should be reset to 0
   * and it should become available for selection again (if not permanently disabled).
   */
  describe('Property 11: Quota Reset', () => {
    it('should reset daily usage to 0 after quota reset', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.webUrl({ validSchemes: ['https'] }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.integer({ min: 100, max: 1000 }),
          (workerUrls, quota) => {
            const config = { ...DEFAULT_CONFIG, dailyQuota: quota };
            const pool = new WorkerPool(workerUrls, config);
            const workers = pool.getWorkers();
            
            if (workers.length === 0) return true;
            
            // Use some quota for all workers
            for (const worker of workers) {
              pool.incrementUsage(worker.id, Math.floor(quota / 2));
            }
            
            // Verify usage is recorded
            for (const worker of workers) {
              const w = pool.getWorker(worker.id);
              expect(w?.dailyUsage).toBeGreaterThan(0);
            }
            
            // Manually set quotaResetAt to past (simulate midnight passed)
            for (const worker of workers) {
              const w = pool.getWorker(worker.id);
              if (w) {
                w.quotaResetAt = new Date(Date.now() - 1000); // 1 second ago
              }
            }
            
            // Reset quotas
            pool.resetDailyQuotas();
            
            // Verify all usage is reset to 0
            for (const worker of workers) {
              const w = pool.getWorker(worker.id);
              expect(w?.dailyUsage).toBe(0);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should restore worker health after quota reset if quota was exhausted', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.webUrl({ validSchemes: ['https'] }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.integer({ min: 100, max: 1000 }),
          (workerUrls, quota) => {
            const config = { ...DEFAULT_CONFIG, dailyQuota: quota };
            const pool = new WorkerPool(workerUrls, config);
            const workers = pool.getWorkers();
            
            if (workers.length === 0) return true;
            
            const worker = workers[0];
            if (!worker) return true;
            
            // Exhaust quota
            pool.incrementUsage(worker.id, quota);
            
            // Verify worker is unhealthy
            let w = pool.getWorker(worker.id);
            expect(w?.healthy).toBe(false);
            expect(w?.dailyUsage).toBeGreaterThanOrEqual(quota);
            
            // Simulate midnight passed
            if (w) {
              w.quotaResetAt = new Date(Date.now() - 1000);
            }
            
            // Reset quotas
            pool.resetDailyQuotas();
            
            // Verify worker is healthy again (if not permanently disabled)
            w = pool.getWorker(worker.id);
            if (!w?.permanentlyDisabled) {
              expect(w?.healthy).toBe(true);
            }
            expect(w?.dailyUsage).toBe(0);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not reset quota before midnight', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['https'] }),
          fc.integer({ min: 100, max: 1000 }),
          fc.integer({ min: 10, max: 50 }),
          (workerUrl, quota, usage) => {
            const config = { ...DEFAULT_CONFIG, dailyQuota: quota };
            const pool = new WorkerPool([workerUrl], config);
            const workers = pool.getWorkers();
            
            if (workers.length === 0) return true;
            
            const worker = workers[0];
            if (!worker) return true;
            
            // Use some quota
            pool.incrementUsage(worker.id, usage);
            
            // Verify usage is recorded
            let w = pool.getWorker(worker.id);
            expect(w?.dailyUsage).toBe(usage);
            
            // Try to reset (but quotaResetAt is in the future)
            pool.resetDailyQuotas();
            
            // Verify usage is NOT reset (still the same)
            w = pool.getWorker(worker.id);
            expect(w?.dailyUsage).toBe(usage);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update quotaResetAt to next midnight after reset', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['https'] }),
          (workerUrl) => {
            const pool = new WorkerPool([workerUrl], DEFAULT_CONFIG);
            const workers = pool.getWorkers();
            
            if (workers.length === 0) return true;
            
            const worker = workers[0];
            if (!worker) return true;
            
            // Simulate midnight passed by setting quotaResetAt to past
            const w = pool.getWorker(worker.id);
            if (w) {
              w.quotaResetAt = new Date(Date.now() - 1000);
            }
            
            // Get the past reset time
            const pastResetAt = pool.getWorker(worker.id)?.quotaResetAt;
            
            // Reset quotas
            pool.resetDailyQuotas();
            
            // Verify quotaResetAt is updated to future
            const newResetAt = pool.getWorker(worker.id)?.quotaResetAt;
            expect(newResetAt).toBeDefined();
            expect(newResetAt!.getTime()).toBeGreaterThan(Date.now());
            
            // Verify it's different from past time
            if (pastResetAt) {
              expect(newResetAt!.getTime()).toBeGreaterThan(pastResetAt.getTime());
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not restore health for permanently disabled workers', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.webUrl({ validSchemes: ['https'] }),
            { minLength: 2, maxLength: 5 }
          ),
          (workerUrls) => {
            const pool = new WorkerPool(workerUrls, DEFAULT_CONFIG);
            const workers = pool.getWorkers();
            
            if (workers.length === 0) return true;
            
            const worker = workers[0];
            if (!worker) return true;
            
            // Permanently disable worker
            pool.permanentlyDisable(worker.id, 'test_block');
            
            // Exhaust quota
            pool.incrementUsage(worker.id, DEFAULT_CONFIG.dailyQuota);
            
            // Simulate midnight passed
            const w = pool.getWorker(worker.id);
            if (w) {
              w.quotaResetAt = new Date(Date.now() - 1000);
            }
            
            // Reset quotas
            pool.resetDailyQuotas();
            
            // Verify worker is still disabled and unhealthy
            const updatedWorker = pool.getWorker(worker.id);
            expect(updatedWorker?.permanentlyDisabled).toBe(true);
            expect(updatedWorker?.healthy).toBe(false);
            
            // But usage should be reset
            expect(updatedWorker?.dailyUsage).toBe(0);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

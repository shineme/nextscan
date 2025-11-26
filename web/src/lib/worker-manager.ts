/**
 * Worker Manager Service
 * Manages Worker pool independently from scanner service
 */

import { WorkerPool, WorkerPoolConfig, WorkerEndpoint } from './worker-pool';
import { configService } from './config-service';

class WorkerManager {
  private workerPool: WorkerPool | null = null;
  private initialized: boolean = false;

  /**
   * Initialize or get existing worker pool
   */
  getOrCreateWorkerPool(): WorkerPool {
    if (!this.workerPool) {
      // Load configuration
      const workerUrlsStr = configService.get('worker_urls');
      const workerUrls: string[] = workerUrlsStr ? JSON.parse(workerUrlsStr) : [];
      
      const dailyQuota = parseInt(configService.get('worker_daily_quota') || '100000');

      const poolConfig: WorkerPoolConfig = {
        healthCheckInterval: 60000,
        unhealthyThreshold: 90, // 提高到 90%，只有持续失败才标记为不健康
        cooldownPeriod: 300000,
        rateLimitCooldown: 60000,
        dailyQuota,
      };

      this.workerPool = new WorkerPool(workerUrls, poolConfig);
      this.initialized = true;
      
      console.log(`[WorkerManager] Initialized with ${workerUrls.length} workers`);
    }

    return this.workerPool;
  }

  /**
   * Get worker pool (may be null if not initialized)
   */
  getWorkerPool(): WorkerPool | null {
    return this.workerPool;
  }

  /**
   * Check if worker pool is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.workerPool !== null;
  }

  /**
   * Force reload worker pool from configuration
   */
  reload(): void {
    console.log('[WorkerManager] Reloading worker pool');
    this.workerPool = null;
    this.initialized = false;
    this.getOrCreateWorkerPool();
  }

  /**
   * Get all workers
   */
  getWorkers(): WorkerEndpoint[] {
    const pool = this.getOrCreateWorkerPool();
    return pool.getWorkers();
  }

  /**
   * Add a new worker
   */
  addWorker(url: string, dailyQuota?: number): void {
    // First save to config
    const workerUrlsStr = configService.get('worker_urls');
    const workerUrls: string[] = workerUrlsStr ? JSON.parse(workerUrlsStr) : [];
    
    // Check if already exists in config
    if (!workerUrls.includes(url)) {
      workerUrls.push(url);
      configService.set('worker_urls', JSON.stringify(workerUrls));
      console.log(`[WorkerManager] Saved worker to config: ${url}`);
    }
    
    // Then add to pool
    const pool = this.getOrCreateWorkerPool();
    pool.addWorker(url);
    
    // Update quota if specified
    if (dailyQuota) {
      const workers = pool.getWorkers();
      const newWorker = workers.find(w => w.url === url);
      if (newWorker) {
        newWorker.dailyQuota = dailyQuota;
      }
    }
  }

  /**
   * Remove a worker
   */
  removeWorker(workerId: string): void {
    const pool = this.getOrCreateWorkerPool();
    const worker = pool.getWorker(workerId);
    
    if (worker) {
      // Remove from pool
      pool.removeWorker(workerId);
      
      // Remove from config
      const workerUrlsStr = configService.get('worker_urls');
      const workerUrls: string[] = workerUrlsStr ? JSON.parse(workerUrlsStr) : [];
      const updatedUrls = workerUrls.filter(u => u !== worker.url);
      configService.set('worker_urls', JSON.stringify(updatedUrls));
      console.log(`[WorkerManager] Removed worker from config: ${worker.url}`);
    }
  }

  /**
   * Enable a worker
   */
  enableWorker(workerId: string): void {
    const pool = this.getOrCreateWorkerPool();
    pool.enableWorker(workerId);
  }

  /**
   * Disable a worker (temporarily)
   */
  disableWorker(workerId: string): void {
    const pool = this.getOrCreateWorkerPool();
    const worker = pool.getWorker(workerId);
    if (worker) {
      worker.healthy = false;
    }
  }

  /**
   * Get a specific worker
   */
  getWorker(workerId: string): WorkerEndpoint | undefined {
    const pool = this.getOrCreateWorkerPool();
    return pool.getWorker(workerId);
  }

  /**
   * Update worker quota
   */
  updateWorkerQuota(workerId: string, dailyQuota: number): void {
    const pool = this.getOrCreateWorkerPool();
    const worker = pool.getWorker(workerId);
    if (worker) {
      worker.dailyQuota = dailyQuota;
    }
  }

  /**
   * Reset worker quota
   */
  resetWorkerQuota(workerId: string): void {
    const pool = this.getOrCreateWorkerPool();
    const worker = pool.getWorker(workerId);
    if (worker) {
      worker.dailyUsage = 0;
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      worker.quotaResetAt = tomorrow;
    }
  }



  /**
   * Get pool statistics
   */
  getStats() {
    const pool = this.getOrCreateWorkerPool();
    return pool.getStats();
  }
}

// Export singleton instance
export const workerManager = new WorkerManager();

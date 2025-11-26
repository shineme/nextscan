/**
 * Worker Pool Management
 * Manages a collection of Cloudflare Worker endpoints with health monitoring,
 * quota tracking, and intelligent selection strategies.
 */

export interface WorkerEndpoint {
  id: string;
  url: string;
  healthy: boolean;
  lastCheck: Date;
  errorCount: number;
  successCount: number;
  rateLimitedUntil: Date | null;
  consecutiveFailures: number;
  
  // Quota management
  dailyQuota: number; // Default: 100,000
  dailyUsage: number; // Requests made today
  quotaResetAt: Date; // Midnight UTC
  
  // Permanent disable flags
  permanentlyDisabled: boolean;
  disabledReason: string | null; // "blocked" | "not_deployed" | null
}

export interface WorkerPoolConfig {
  healthCheckInterval: number; // milliseconds
  unhealthyThreshold: number; // error rate percentage
  cooldownPeriod: number; // milliseconds
  rateLimitCooldown: number; // milliseconds
  dailyQuota: number; // default quota per worker
}

export interface WorkerPoolStats {
  totalWorkers: number;
  healthyWorkers: number;
  unhealthyWorkers: number;
  disabledWorkers: number;
  rateLimitedWorkers: number;
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
}

export class WorkerPool {
  private workers: WorkerEndpoint[] = [];
  private currentIndex: number = 0;
  private config: WorkerPoolConfig;

  constructor(workerUrls: string[], config: WorkerPoolConfig) {
    this.config = config;
    
    // Initialize workers from URLs
    for (const url of workerUrls) {
      this.addWorker(url);
    }
  }

  /**
   * Get next healthy Worker using round-robin selection
   */
  selectWorker(): WorkerEndpoint | null {
    const availableWorkers = this.workers.filter(w => 
      !w.permanentlyDisabled &&           // Not blocked
      w.healthy &&                        // Healthy
      w.dailyUsage < w.dailyQuota &&      // Has quota remaining
      (!w.rateLimitedUntil || w.rateLimitedUntil < new Date()) // Not rate-limited
    );
    
    if (availableWorkers.length === 0) {
      return null;
    }
    
    // Round-robin selection
    const worker = availableWorkers[this.currentIndex % availableWorkers.length];
    this.currentIndex++;
    
    return worker;
  }

  /**
   * Mark Worker as successful
   */
  recordSuccess(workerId: string): void {
    const worker = this.workers.find(w => w.id === workerId);
    if (!worker) return;
    
    worker.successCount++;
    worker.consecutiveFailures = 0;
    worker.lastCheck = new Date();
    
    // Check if worker should be marked healthy again
    const errorRate = this.getErrorRate(worker);
    if (errorRate < this.config.unhealthyThreshold && !worker.healthy) {
      worker.healthy = true;
      console.log(`[WorkerPool] Worker ${workerId} recovered (error rate: ${errorRate.toFixed(1)}%)`);
    }
  }

  /**
   * Mark Worker as failed
   */
  recordFailure(workerId: string, error: Error): void {
    const worker = this.workers.find(w => w.id === workerId);
    if (!worker) return;
    
    worker.errorCount++;
    worker.consecutiveFailures++;
    worker.lastCheck = new Date();
    
    // 如果总请求数超过 100，重置计数器以允许恢复
    // 这样可以防止早期的错误永久影响 Worker 的健康状态
    const totalRequests = worker.successCount + worker.errorCount;
    if (totalRequests > 100) {
      // 保留最近的统计数据（最后 50 次请求）
      const recentSuccessRatio = worker.successCount / totalRequests;
      worker.successCount = Math.floor(50 * recentSuccessRatio);
      worker.errorCount = 50 - worker.successCount;
      console.log(`[WorkerPool] Reset worker ${workerId} stats (keeping recent ratio)`);
    }
    
    // Check if worker should be marked unhealthy
    const errorRate = this.getErrorRate(worker);
    if (errorRate >= this.config.unhealthyThreshold) {
      worker.healthy = false;
      console.warn(`[WorkerPool] Worker ${workerId} marked unhealthy (error rate: ${errorRate.toFixed(1)}%)`);
    }
  }

  /**
   * Mark Worker as rate-limited
   */
  recordRateLimit(workerId: string): void {
    const worker = this.workers.find(w => w.id === workerId);
    if (!worker) return;
    
    const rateLimitUntil = new Date(Date.now() + this.config.rateLimitCooldown);
    worker.rateLimitedUntil = rateLimitUntil;
    
    console.warn(`[WorkerPool] Worker ${workerId} rate-limited until ${rateLimitUntil.toISOString()}`);
  }

  /**
   * Permanently disable a Worker
   */
  permanentlyDisable(workerId: string, reason: string): void {
    const worker = this.workers.find(w => w.id === workerId);
    if (!worker) return;
    
    worker.permanentlyDisabled = true;
    worker.disabledReason = reason;
    worker.healthy = false;
    
    console.error(`[WorkerPool] Worker ${workerId} permanently disabled: ${reason}`);
  }

  /**
   * Check and reset daily quotas (called at midnight UTC)
   */
  resetDailyQuotas(): void {
    const now = new Date();
    
    for (const worker of this.workers) {
      // Check if it's a new day
      if (now >= worker.quotaResetAt) {
        const previousUsage = worker.dailyUsage;
        worker.dailyUsage = 0;
        worker.quotaResetAt = this.getNextMidnight();
        
        // If worker was unhealthy due to quota, mark as healthy again
        if (previousUsage >= worker.dailyQuota && !worker.permanentlyDisabled) {
          worker.healthy = true;
        }
        
        // Persist reset to database
        try {
          const db = require('./db').default;
          db.prepare('UPDATE workers SET daily_usage = 0, quota_reset_at = ? WHERE id = ?')
            .run(worker.quotaResetAt.toISOString(), worker.id);
        } catch (error) {
          console.error(`[WorkerPool] Failed to reset quota in database:`, error);
        }
        
        console.log(`[WorkerPool] Reset quota for ${worker.id} (previous usage: ${previousUsage})`);
      }
    }
  }

  /**
   * Increment daily usage counter
   */
  incrementUsage(workerId: string, count: number): void {
    const worker = this.workers.find(w => w.id === workerId);
    if (!worker) return;
    
    worker.dailyUsage += count;
    
    // Persist to database
    try {
      const db = require('./db').default;
      
      // 先检查记录是否存在
      const existing = db.prepare('SELECT id FROM workers WHERE id = ?').get(workerId);
      
      if (existing) {
        // 更新现有记录
        const stmt = db.prepare('UPDATE workers SET daily_usage = ?, quota_reset_at = ? WHERE id = ?');
        stmt.run(worker.dailyUsage, worker.quotaResetAt.toISOString(), workerId);
      } else {
        // 创建新记录
        const stmt = db.prepare('INSERT INTO workers (id, url, daily_usage, daily_quota, quota_reset_at) VALUES (?, ?, ?, ?, ?)');
        stmt.run(workerId, worker.url, worker.dailyUsage, worker.dailyQuota, worker.quotaResetAt.toISOString());
      }
      
      console.log(`[WorkerPool] Updated worker ${workerId} usage: ${worker.dailyUsage}/${worker.dailyQuota}`);
    } catch (error) {
      console.error(`[WorkerPool] Failed to update worker usage in database:`, error);
    }
    
    // Check if quota exhausted
    if (worker.dailyUsage >= worker.dailyQuota) {
      console.warn(`[WorkerPool] Worker ${workerId} quota exhausted (${worker.dailyUsage}/${worker.dailyQuota})`);
      worker.healthy = false; // Temporarily mark unhealthy
    }
  }

  /**
   * Check if any Workers are available
   */
  hasHealthyWorkers(): boolean {
    return this.workers.some(w => 
      !w.permanentlyDisabled &&
      w.healthy &&
      w.dailyUsage < w.dailyQuota &&
      (!w.rateLimitedUntil || w.rateLimitedUntil < new Date())
    );
  }

  /**
   * Get pool statistics
   */
  getStats(): WorkerPoolStats {
    const now = new Date();
    
    return {
      totalWorkers: this.workers.length,
      healthyWorkers: this.workers.filter(w => 
        !w.permanentlyDisabled && 
        w.healthy && 
        w.dailyUsage < w.dailyQuota &&
        (!w.rateLimitedUntil || w.rateLimitedUntil < now)
      ).length,
      unhealthyWorkers: this.workers.filter(w => !w.healthy && !w.permanentlyDisabled).length,
      disabledWorkers: this.workers.filter(w => w.permanentlyDisabled).length,
      rateLimitedWorkers: this.workers.filter(w => w.rateLimitedUntil && w.rateLimitedUntil > now).length,
      totalRequests: this.workers.reduce((sum, w) => sum + w.successCount + w.errorCount, 0),
      totalSuccesses: this.workers.reduce((sum, w) => sum + w.successCount, 0),
      totalFailures: this.workers.reduce((sum, w) => sum + w.errorCount, 0),
    };
  }

  /**
   * Manually add a Worker
   */
  addWorker(url: string): void {
    // Validate URL format
    if (!this.isValidWorkerUrl(url)) {
      console.error(`[WorkerPool] Invalid Worker URL: ${url}`);
      return;
    }
    
    // Check if worker already exists
    if (this.workers.some(w => w.url === url)) {
      console.warn(`[WorkerPool] Worker already exists: ${url}`);
      return;
    }
    
    const workerId = this.generateWorkerId(url);
    
    // 从数据库加载使用量
    let dailyUsage = 0;
    let dailyQuota = this.config.dailyQuota;
    let quotaResetAt = this.getNextMidnight();
    
    try {
      const db = require('./db').default;
      const row = db.prepare('SELECT daily_usage, daily_quota, quota_reset_at FROM workers WHERE id = ?').get(workerId) as { 
        daily_usage: number; 
        daily_quota: number;
        quota_reset_at: string;
      } | undefined;
      
      if (row) {
        // 检查是否需要重置配额（新的一天）
        const storedResetAt = row.quota_reset_at ? new Date(row.quota_reset_at) : null;
        const now = new Date();
        
        if (storedResetAt && now >= storedResetAt) {
          // 已经过了重置时间，重置使用量
          dailyUsage = 0;
          quotaResetAt = this.getNextMidnight();
          console.log(`[WorkerPool] Quota reset for worker ${workerId} (new day)`);
          
          // 更新数据库
          db.prepare('UPDATE workers SET daily_usage = 0, quota_reset_at = ? WHERE id = ?')
            .run(quotaResetAt.toISOString(), workerId);
        } else {
          dailyUsage = row.daily_usage || 0;
          dailyQuota = row.daily_quota || this.config.dailyQuota;
          quotaResetAt = storedResetAt || this.getNextMidnight();
        }
        console.log(`[WorkerPool] Loaded worker ${workerId} usage from database: ${dailyUsage}/${dailyQuota}`);
      } else {
        // Worker 不存在于数据库，创建新记录
        db.prepare('INSERT INTO workers (id, url, daily_usage, daily_quota, quota_reset_at) VALUES (?, ?, ?, ?, ?)')
          .run(workerId, url, 0, dailyQuota, quotaResetAt.toISOString());
        console.log(`[WorkerPool] Created new worker record in database: ${workerId}`);
      }
    } catch (error) {
      console.error(`[WorkerPool] Failed to load/save worker from database:`, error);
    }
    
    const worker: WorkerEndpoint = {
      id: workerId,
      url,
      healthy: true,
      lastCheck: new Date(),
      errorCount: 0,
      successCount: 0,
      rateLimitedUntil: null,
      consecutiveFailures: 0,
      dailyQuota,
      dailyUsage,
      quotaResetAt,
      permanentlyDisabled: false,
      disabledReason: null,
    };
    
    this.workers.push(worker);
    console.log(`[WorkerPool] Added worker: ${worker.id} (usage: ${dailyUsage}/${dailyQuota})`);
  }

  /**
   * Manually remove a Worker
   */
  removeWorker(workerId: string): void {
    const index = this.workers.findIndex(w => w.id === workerId);
    if (index === -1) {
      console.warn(`[WorkerPool] Worker not found: ${workerId}`);
      return;
    }
    
    this.workers.splice(index, 1);
    console.log(`[WorkerPool] Removed worker: ${workerId}`);
  }

  /**
   * Get all workers (for status display)
   */
  getWorkers(): WorkerEndpoint[] {
    return [...this.workers];
  }

  /**
   * Get a specific worker by ID
   */
  getWorker(workerId: string): WorkerEndpoint | undefined {
    return this.workers.find(w => w.id === workerId);
  }

  /**
   * Re-enable a permanently disabled worker
   */
  enableWorker(workerId: string): void {
    const worker = this.workers.find(w => w.id === workerId);
    if (!worker) return;
    
    worker.permanentlyDisabled = false;
    worker.disabledReason = null;
    worker.healthy = true;
    worker.errorCount = 0;
    worker.successCount = 0;
    worker.consecutiveFailures = 0;
    
    console.log(`[WorkerPool] Re-enabled worker: ${workerId}`);
  }

  // Private helper methods

  private getErrorRate(worker: WorkerEndpoint): number {
    const total = worker.successCount + worker.errorCount;
    if (total === 0) return 0;
    return (worker.errorCount / total) * 100;
  }

  private getNextMidnight(): Date {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  }

  private generateWorkerId(url: string): string {
    // Extract hostname from URL for a readable ID
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/\./g, '_');
    } catch {
      // Fallback to hash if URL parsing fails
      return `worker_${Math.random().toString(36).substring(2, 9)}`;
    }
  }

  private isValidWorkerUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

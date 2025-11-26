/**
 * Quota Reset Scheduler
 * Automatically resets Worker quotas at midnight UTC daily
 */

import { workerManager } from './worker-manager';

class QuotaScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('[QuotaScheduler] Already running');
      return;
    }

    console.log('[QuotaScheduler] Starting quota reset scheduler');
    
    // Check immediately on start
    this.checkAndResetQuotas();
    
    // Check every hour (3600000 ms)
    this.intervalId = setInterval(() => {
      this.checkAndResetQuotas();
    }, 3600000);
    
    this.isRunning = true;
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    console.log('[QuotaScheduler] Stopped quota reset scheduler');
  }

  /**
   * Check if it's time to reset quotas and do it
   */
  private checkAndResetQuotas(): void {
    try {
      const workerPool = workerManager.getWorkerPool();
      
      if (!workerPool) {
        console.log('[QuotaScheduler] No worker pool initialized');
        return;
      }

      // Reset quotas (WorkerPool handles the midnight UTC check internally)
      workerPool.resetDailyQuotas();
      
      console.log('[QuotaScheduler] Quota reset check completed');
    } catch (error) {
      console.error('[QuotaScheduler] Error during quota reset:', error);
    }
  }

  /**
   * Manually trigger quota reset (for testing or admin purposes)
   */
  manualReset(): void {
    console.log('[QuotaScheduler] Manual quota reset triggered');
    this.checkAndResetQuotas();
  }

  /**
   * Get scheduler status
   */
  getStatus(): { running: boolean; nextCheck: Date | null } {
    const nextCheck = this.isRunning 
      ? new Date(Date.now() + 3600000) // Next hour
      : null;
    
    return {
      running: this.isRunning,
      nextCheck,
    };
  }
}

// Export singleton instance
export const quotaScheduler = new QuotaScheduler();

// Auto-start scheduler when module is loaded (in production)
if (process.env.NODE_ENV === 'production') {
  quotaScheduler.start();
}

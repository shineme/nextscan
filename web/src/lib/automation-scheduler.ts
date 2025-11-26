/**
 * Automation Scheduler
 * Manages automated scanning tasks (incremental and full rescan)
 */

import { configService } from './config-service';
import db from './db';
import logger from './logger-service';

export interface SchedulerConfig {
  incrementalEnabled: boolean;
  incrementalCron: string; // e.g., "0 2 * * *" (daily at 2 AM)
  rescanEnabled: boolean;
  rescanCron: string; // e.g., "0 3 1 */6 *" (every 6 months)
  lastIncrementalRun: string | null;
  lastRescanRun: string | null;
}

class AutomationScheduler {
  private incrementalIntervalId: NodeJS.Timeout | null = null;
  private rescanIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Start the automation scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('[AutomationScheduler] Already running, stopping first...');
      logger.info('automation', 'Scheduler already running, restarting...');
      this.stop();
    }

    console.log('[AutomationScheduler] Starting automation scheduler');
    logger.info('automation', '🚀 Starting automation scheduler');
    
    const config = this.loadConfig();
    
    // Start incremental scanning if enabled
    if (config.incrementalEnabled) {
      this.startIncrementalScanning();
      logger.info('automation', '✅ Incremental scanning enabled');
    }
    
    // Start rescan if enabled
    if (config.rescanEnabled) {
      this.startRescan();
      logger.info('automation', '✅ Full rescan enabled');
    }
    
    this.isRunning = true;
  }

  /**
   * Stop the automation scheduler
   */
  stop(): void {
    if (this.incrementalIntervalId) {
      clearInterval(this.incrementalIntervalId);
      this.incrementalIntervalId = null;
    }
    
    if (this.rescanIntervalId) {
      clearInterval(this.rescanIntervalId);
      this.rescanIntervalId = null;
    }
    
    this.isRunning = false;
    console.log('[AutomationScheduler] Stopped automation scheduler');
  }

  /**
   * Start incremental scanning (daily)
   */
  private startIncrementalScanning(): void {
    console.log('[AutomationScheduler] Starting incremental scanning');
    
    // Check immediately on start
    this.checkAndRunIncremental();
    
    // Check every hour
    this.incrementalIntervalId = setInterval(() => {
      this.checkAndRunIncremental();
    }, 3600000); // 1 hour
  }

  /**
   * Start rescan (every 6 months)
   */
  private startRescan(): void {
    console.log('[AutomationScheduler] Starting rescan scheduler');
    
    // Check immediately on start
    this.checkAndRunRescan();
    
    // Check every day
    this.rescanIntervalId = setInterval(() => {
      this.checkAndRunRescan();
    }, 86400000); // 24 hours
  }

  /**
   * Check if there are any running tasks
   * Also cleans up stale "running" tasks that were interrupted by restart
   */
  private hasRunningTask(): boolean {
    try {
      // First, check for stale "running" tasks (tasks that were running when system stopped)
      // These should be reset to "pending" or marked as failed
      const staleTasksStmt = db.prepare(`
        SELECT id, name, started_at 
        FROM scan_tasks 
        WHERE status = 'running'
      `);
      const staleTasks = staleTasksStmt.all() as Array<{ id: number; name: string; started_at: string }>;
      
      if (staleTasks.length > 0) {
        console.log(`[AutomationScheduler] Found ${staleTasks.length} stale running task(s), resetting...`);
        logger.warn('automation', `Found ${staleTasks.length} stale running task(s)`, {
          details: `Tasks: ${staleTasks.map(t => `#${t.id}`).join(', ')}`
        });
        
        // Reset stale tasks to pending so they can be resumed
        const resetStmt = db.prepare('UPDATE scan_tasks SET status = ? WHERE status = ?');
        resetStmt.run('pending', 'running');
        
        logger.info('automation', `Reset ${staleTasks.length} stale task(s) to pending`);
      }
      
      // Now check for actual pending/running tasks
      const stmt = db.prepare(
        "SELECT COUNT(*) as count FROM scan_tasks WHERE status IN ('pending', 'running')"
      );
      const result = stmt.get() as { count: number };
      return result.count > 0;
    } catch (error) {
      console.error('[AutomationScheduler] Failed to check task status:', error);
      // Fail-open: allow operation if we can't check
      return false;
    }
  }

  /**
   * Check if it's time to run incremental scan
   */
  private async checkAndRunIncremental(): Promise<void> {
    try {
      logger.info('automation', '🔍 Checking if incremental scan should run...');
      const config = this.loadConfig();
      
      if (!config.incrementalEnabled) {
        logger.info('automation', '⏭️ Incremental scanning is disabled, skipping');
        return;
      }

      // Check if a task is already running
      if (this.hasRunningTask()) {
        console.log('[AutomationScheduler] Task already running, skipping incremental scan');
        logger.warn('automation', '⚠️ Task already running, skipping incremental scan');
        return;
      }

      const now = new Date();
      const lastRun = config.lastIncrementalRun 
        ? new Date(config.lastIncrementalRun) 
        : null;

      if (!lastRun) {
        logger.info('automation', '🆕 Never run before, starting incremental scan now...');
      } else {
        const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / 3600000;
        logger.info('automation', `⏰ Last run: ${lastRun.toLocaleString('zh-CN')}, ${hoursSinceLastRun.toFixed(1)} hours ago`);
      }

      // Run if never run before, or if it's been more than 24 hours
      if (!lastRun || (now.getTime() - lastRun.getTime()) > 86400000) {
        console.log('[AutomationScheduler] Running incremental scan');
        logger.info('automation', '▶️ Starting incremental scan...');
        await this.runIncrementalScan();
        
        // Update last run time
        configService.set('automation_last_incremental', now.toISOString());
        logger.success('automation', '✅ Incremental scan completed successfully');
      } else {
        const hoursRemaining = 24 - ((now.getTime() - lastRun.getTime()) / 3600000);
        logger.info('automation', `⏳ Next run in ${hoursRemaining.toFixed(1)} hours`);
      }
    } catch (error) {
      console.error('[AutomationScheduler] Error in incremental scan:', error);
      logger.error('automation', '❌ Error in incremental scan', {
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if it's time to run rescan
   */
  private async checkAndRunRescan(): Promise<void> {
    try {
      const config = this.loadConfig();
      
      if (!config.rescanEnabled) {
        return;
      }

      // Check if a task is already running
      if (this.hasRunningTask()) {
        console.log('[AutomationScheduler] Task already running, skipping rescan');
        return;
      }

      const now = new Date();
      const lastRun = config.lastRescanRun 
        ? new Date(config.lastRescanRun) 
        : null;

      // Run if never run before, or if it's been more than 6 months (180 days)
      if (!lastRun || (now.getTime() - lastRun.getTime()) > 15552000000) {
        console.log('[AutomationScheduler] Running full rescan');
        await this.runRescan();
        
        // Update last run time
        configService.set('automation_last_rescan', now.toISOString());
      }
    } catch (error) {
      console.error('[AutomationScheduler] Error in rescan:', error);
    }
  }

  /**
   * Run incremental scan
   */
  private async runIncrementalScan(): Promise<void> {
    try {
      // Import sync function dynamically to avoid circular dependencies
      const { syncDomains } = await import('./sync-domains');
      
      // 1. Sync domains from CSV
      console.log('[AutomationScheduler] Starting domain sync...');
      logger.info('automation', '📥 Starting domain sync...');
      
      const syncResult = await syncDomains();
      
      if (!syncResult.success) {
        const errorMsg = typeof syncResult === 'object' && syncResult && 'message' in syncResult 
          ? String(syncResult.message) 
          : 'Domain sync failed';
        throw new Error(errorMsg);
      }

      console.log(`[AutomationScheduler] Synced ${syncResult.count} domains`);
      logger.success('automation', `✅ Synced ${syncResult.count.toLocaleString()} domains successfully`);

      // 2. Create incremental scan task
      logger.info('automation', '📝 Creating incremental scan task...');
      
      const taskService = (await import('./task-service')).default;
      const db = (await import('./db')).default;
      
      // Get enabled path templates from database
      const templates = db.prepare('SELECT template FROM path_templates WHERE enabled = 1').all() as Array<{ template: string }>;
      
      let urlTemplate: string;
      if (templates.length > 0) {
        // Use enabled path templates (comma-separated)
        urlTemplate = templates.map(t => t.template).join(',');
        console.log(`[AutomationScheduler] Using ${templates.length} enabled path templates`);
      } else {
        // Fallback to default template if no templates are enabled
        urlTemplate = configService.get('default_url_template') || 'https://{domain}';
        console.log(`[AutomationScheduler] No enabled templates, using default: ${urlTemplate}`);
      }
      
      const concurrency = parseInt(configService.get('default_concurrency') || '10', 10);
      
      const task = taskService.createTask({
        name: `Auto Incremental Scan - ${new Date().toLocaleString('zh-CN')}`,
        target: 'incremental',
        url_template: urlTemplate,
        concurrency: concurrency
      });
      
      logger.success('automation', `✅ Created scan task #${task.id} with ${task.total_urls.toLocaleString()} domains`);
      
      // 3. Start the task automatically
      logger.info('automation', `▶️ Starting scan task #${task.id}...`);
      
      // Import scanner service to start the task
      const scannerService = (await import('./scanner-service')).default;
      
      // Execute scan in background (don't await to avoid blocking)
      scannerService.executeScan(task.id).catch((error) => {
        logger.error('automation', `❌ Scan task #${task.id} failed`, {
          details: error instanceof Error ? error.message : String(error)
        });
      });
      
      logger.success('automation', `✅ Scan task #${task.id} started successfully`);
      console.log('[AutomationScheduler] Incremental scan completed');
    } catch (error) {
      console.error('[AutomationScheduler] Incremental scan failed:', error);
      logger.error('automation', '❌ Incremental scan failed', {
        details: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Run full rescan
   */
  private async runRescan(): Promise<void> {
    try {
      logger.info('automation', '🔄 Starting full rescan...');
      
      const taskService = (await import('./task-service')).default;
      
      // Reset all domain scan status
      logger.info('automation', '🔄 Resetting all domain scan status...');
      const resetCount = taskService.resetAllScanStatus();
      logger.success('automation', `✅ Reset ${resetCount.toLocaleString()} domains`);
      
      const db = (await import('./db')).default;
      
      // Get enabled path templates from database
      const templates = db.prepare('SELECT template FROM path_templates WHERE enabled = 1').all() as Array<{ template: string }>;
      
      let urlTemplate: string;
      if (templates.length > 0) {
        // Use enabled path templates (comma-separated)
        urlTemplate = templates.map(t => t.template).join(',');
        console.log(`[AutomationScheduler] Using ${templates.length} enabled path templates for full rescan`);
      } else {
        // Fallback to default template if no templates are enabled
        urlTemplate = configService.get('default_url_template') || 'https://{domain}';
        console.log(`[AutomationScheduler] No enabled templates, using default: ${urlTemplate}`);
      }
      
      const concurrency = parseInt(configService.get('default_concurrency') || '10', 10);
      
      // Create full rescan task
      const task = taskService.createTask({
        name: `Auto Full Rescan - ${new Date().toLocaleString('zh-CN')}`,
        target: 'full',
        url_template: urlTemplate,
        concurrency: concurrency
      });
      
      logger.success('automation', `✅ Created full rescan task #${task.id} with ${task.total_urls.toLocaleString()} domains`);
      
      // Start the task automatically
      logger.info('automation', `▶️ Starting rescan task #${task.id}...`);
      
      const scannerService = (await import('./scanner-service')).default;
      
      // Execute scan in background (don't await to avoid blocking)
      scannerService.executeScan(task.id).catch((error) => {
        logger.error('automation', `❌ Rescan task #${task.id} failed`, {
          details: error instanceof Error ? error.message : String(error)
        });
      });
      
      logger.success('automation', `✅ Full rescan task #${task.id} started successfully`);
      console.log('[AutomationScheduler] Full rescan completed');
    } catch (error) {
      console.error('[AutomationScheduler] Rescan failed:', error);
      logger.error('automation', '❌ Full rescan failed', {
        details: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Load scheduler configuration
   */
  private loadConfig(): SchedulerConfig {
    return {
      incrementalEnabled: configService.get('automation_incremental_enabled') === 'true',
      incrementalCron: configService.get('automation_incremental_cron') || '0 2 * * *',
      rescanEnabled: configService.get('automation_rescan_enabled') === 'true',
      rescanCron: configService.get('automation_rescan_cron') || '0 3 1 */6 *',
      lastIncrementalRun: configService.get('automation_last_incremental'),
      lastRescanRun: configService.get('automation_last_rescan'),
    };
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    running: boolean;
    config: SchedulerConfig;
  } {
    return {
      running: this.isRunning,
      config: this.loadConfig(),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    if (config.incrementalEnabled !== undefined) {
      configService.set('automation_incremental_enabled', config.incrementalEnabled.toString());
    }
    
    if (config.rescanEnabled !== undefined) {
      configService.set('automation_rescan_enabled', config.rescanEnabled.toString());
    }
    
    if (config.incrementalCron) {
      configService.set('automation_incremental_cron', config.incrementalCron);
    }
    
    if (config.rescanCron) {
      configService.set('automation_rescan_cron', config.rescanCron);
    }

    // Restart scheduler to apply new config
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

// Export singleton instance
export const automationScheduler = new AutomationScheduler();

// Auto-start scheduler in production
if (process.env.NODE_ENV === 'production') {
  automationScheduler.start();
}

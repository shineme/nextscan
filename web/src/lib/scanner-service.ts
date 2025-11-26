import taskRepository from './task-repository';
import taskService from './task-service';
import { PlaceholderEngine } from './placeholder-engine';
import { createConcurrencyController } from './concurrency-controller';
import { ScanResponse } from './http-client';
import db from './db';
import errorHandler, { withRetry } from './error-handler';
import { subdomainDiscovery } from './subdomain-discovery';
import { configService } from './config-service';
import { WorkerPool, WorkerPoolConfig } from './worker-pool';
import { WorkerClient } from './worker-client';
import { WorkerScanStrategy, LocalScanStrategy, ScanStrategy } from './scan-strategy';
import { workerManager } from './worker-manager';
import { quotaScheduler } from './quota-scheduler';
import { automationController } from './automation-controller';
import { logger } from './logger-service';

export class ScannerService {
  private placeholderEngine: PlaceholderEngine;
  private workerClient: WorkerClient | null = null;
  private workerStrategy: WorkerScanStrategy | null = null;
  private localStrategy: LocalScanStrategy | null = null;

  constructor() {
    this.placeholderEngine = new PlaceholderEngine();
    this.initializeWorkerStrategy();
    
    // Start quota reset scheduler
    quotaScheduler.start();
    
    // Auto-resume unfinished tasks (always, not just in production)
    // This prevents the system from getting stuck with orphaned "running" tasks
    this.resumeUnfinishedTasks();
  }
  
  /**
   * Resume unfinished tasks after restart
   */
  private async resumeUnfinishedTasks(): Promise<void> {
    try {
      // Find tasks that were running when the system stopped
      const unfinishedTasks = db.prepare(`
        SELECT id, name, status, scanned_urls, total_urls 
        FROM scan_tasks 
        WHERE status IN ('pending', 'running')
        ORDER BY id ASC
      `).all() as Array<{ id: number; name: string; status: string; scanned_urls: number; total_urls: number }>;
      
      if (unfinishedTasks.length === 0) {
        console.log('[Scanner] No unfinished tasks to resume');
        return;
      }
      
      console.log(`[Scanner] Found ${unfinishedTasks.length} unfinished task(s), resuming...`);
      logger.info('scanner', `Found ${unfinishedTasks.length} unfinished task(s)`, {
        details: `Resuming tasks: ${unfinishedTasks.map(t => `#${t.id}`).join(', ')}`
      });
      
      // Reset status to pending for running tasks (they were interrupted)
      for (const task of unfinishedTasks) {
        if (task.status === 'running') {
          taskRepository.updateTaskStatus(task.id, 'pending');
          console.log(`[Scanner] Reset task #${task.id} from running to pending`);
        }
      }
      
      // Resume each task
      for (const task of unfinishedTasks) {
        const progress = task.total_urls > 0 ? ((task.scanned_urls / task.total_urls) * 100).toFixed(1) : 0;
        console.log(`[Scanner] Resuming task #${task.id}: ${task.name} (${progress}% complete)`);
        logger.info('scanner', `Resuming task #${task.id}: ${task.name}`, {
          task_id: task.id,
          details: `Progress: ${task.scanned_urls}/${task.total_urls} (${progress}%)`
        });
        
        // Execute scan in background
        this.executeScan(task.id).catch((error) => {
          logger.error('scanner', `Failed to resume task #${task.id}`, {
            task_id: task.id,
            details: error instanceof Error ? error.message : String(error)
          });
        });
        
        // Add a small delay between starting tasks to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      logger.success('scanner', `Resumed ${unfinishedTasks.length} unfinished task(s)`);
    } catch (error) {
      console.error('[Scanner] Failed to resume unfinished tasks:', error);
      logger.error('scanner', 'Failed to resume unfinished tasks', {
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Reload Worker configuration without restart
   */
  reloadWorkerConfiguration(): void {
    console.log('[Scanner] Reloading Worker configuration');
    workerManager.reload();
    this.initializeWorkerStrategy();
  }

  /**
   * Initialize Worker strategy from configuration
   */
  private initializeWorkerStrategy(): void {
    try {
      // Check if Worker mode is enabled
      const enableWorkerMode = configService.get('enable_worker_mode') === 'true';
      
      if (!enableWorkerMode) {
        console.log('[Scanner] Worker mode disabled');
        return;
      }

      // Get worker pool from worker manager
      const workerPool = workerManager.getOrCreateWorkerPool();
      
      if (workerPool.getWorkers().length === 0) {
        console.log('[Scanner] No Worker URLs configured');
        return;
      }

      // Load Worker configuration
      const batchSize = parseInt(configService.get('worker_batch_size') || '10');
      const timeout = parseInt(configService.get('worker_timeout') || '60000'); // 默认 60 秒，给 Worker 足够时间

      this.workerClient = new WorkerClient(timeout);
      this.workerStrategy = new WorkerScanStrategy(
        workerPool,
        this.workerClient,
        batchSize,
        timeout
      );

      console.log(`[Scanner] Worker strategy initialized with ${workerPool.getWorkers().length} workers`);
    } catch (error) {
      console.error('[Scanner] Failed to initialize Worker strategy:', error);
    }
  }

  /**
   * Select scanning strategy based on Worker availability
   */
  private selectStrategy(concurrency: number, timeout: number): ScanStrategy {
    // Check if Worker strategy is available and has healthy workers
    const workerPool = workerManager.getWorkerPool();
    
    // Debug: 打印 worker 状态
    if (workerPool) {
      const workers = workerPool.getWorkers();
      console.log(`[Scanner] Worker pool status: ${workers.length} workers`);
      workers.forEach((w, i) => {
        console.log(`[Scanner] Worker ${i + 1}: ${w.url}, healthy=${w.healthy}, disabled=${w.permanentlyDisabled}, usage=${w.dailyUsage}/${w.dailyQuota}`);
      });
      console.log(`[Scanner] hasHealthyWorkers: ${workerPool.hasHealthyWorkers()}`);
    } else {
      console.log('[Scanner] No worker pool available');
    }
    
    if (this.workerStrategy && workerPool?.hasHealthyWorkers()) {
      console.log('[Scanner] Using Worker strategy');
      return this.workerStrategy;
    }

    // Fall back to local strategy
    console.log('[Scanner] Using local strategy (no healthy workers)');
    
    if (!this.localStrategy) {
      this.localStrategy = new LocalScanStrategy(
        createConcurrencyController(concurrency, timeout)
      );
    }
    
    return this.localStrategy;
  }

  /**
   * 执行扫描任务
   * @param taskId 任务ID
   * @param manualStart 是否为手动启动（手动启动时跳过自动化检查）
   */
  async executeScan(taskId: number, manualStart: boolean = false): Promise<void> {
    // Check if automation is enabled (skip for manual starts)
    if (!manualStart && !automationController.shouldRun()) {
      logger.warn('scanner', 'Scan blocked: Automation is disabled');
      throw new Error('Automation is currently disabled');
    }

    const task = taskRepository.getTask(taskId);
    if (!task) {
      logger.error('scanner', `Task ${taskId} not found`);
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== 'pending') {
      logger.warn('scanner', `Task ${taskId} is not in pending status`, { details: `status: ${task.status}` });
      throw new Error(`Task ${taskId} is not in pending status`);
    }

    logger.info('scanner', `Starting scan task ${taskId}: ${task.name}`, { 
      task_id: taskId,
      details: `target: ${task.target}, template: ${task.url_template}` 
    });

    // 更新状态为running (在try外面，确保立即更新)
    taskRepository.updateTaskStatus(taskId, 'running');

    try {

      // 获取目标域名总数（不加载到内存）
      const totalDomains = taskService.getTargetDomains(task.target).length;
      
      logger.info('scanner', `Found ${totalDomains} domains to scan`, { task_id: taskId, details: `target: ${task.target}` });
      console.log(`[Task ${taskId}] Found ${totalDomains} domains to scan`);
      
      if (totalDomains === 0) {
        console.log(`[Task ${taskId}] No domains found, marking as completed`);
        taskRepository.updateTaskStatus(taskId, 'completed');
        return;
      }

      // 解析URL模板(支持多个模板,逗号分隔)
      const templates = task.url_template.split(',').map(t => t.trim()).filter(t => t.length > 0);
      console.log(`[Task ${taskId}] Using ${templates.length} template(s)`);
      
      // 加载模板配置（用于结果过滤）
      const templateConfigsStmt = db.prepare('SELECT * FROM path_templates WHERE enabled = 1');
      const templateConfigs = templateConfigsStmt.all() as Array<{
        id: number;
        template: string;
        expected_content_type: string | null;
        exclude_content_type: number;
        min_size: number;
        max_size: number | null;
      }>;
      console.log(`[Task ${taskId}] Loaded ${templateConfigs.length} template configurations for filtering`);
      
      // 检查是否启用子域名探测
      const enableSubdomainDiscovery = configService.get('enable_subdomain_discovery') === 'true';
      console.log(`[Task ${taskId}] Subdomain discovery: ${enableSubdomainDiscovery ? 'enabled' : 'disabled'}`);
      
      // 选择扫描策略（Worker 或 Local）
      const strategy = this.selectStrategy(task.concurrency, 10000);

      // 分批处理域名，避免内存溢出
      const DOMAIN_BATCH_SIZE = 1000; // 每次处理 1000 个域名
      let totalScanned = 0;
      let totalHits = 0;
      const scannedDomains = new Set<string>();

      console.log(`[Task ${taskId}] Starting batch scan with ${strategy.name} strategy, batch size: ${DOMAIN_BATCH_SIZE}`);
      
      // 分批获取和处理域名
      for (let offset = 0; offset < totalDomains; offset += DOMAIN_BATCH_SIZE) {
        // 获取当前批次的域名
        const batchDomains = this.getDomainsBatch(task.target, offset, DOMAIN_BATCH_SIZE);
        
        console.log(`[Task ${taskId}] Processing batch ${Math.floor(offset / DOMAIN_BATCH_SIZE) + 1}/${Math.ceil(totalDomains / DOMAIN_BATCH_SIZE)}: ${batchDomains.length} domains`);
        
        // 生成当前批次的 URL
        const batchUrls: Array<{ url: string; domain: string; template: string }> = [];
        for (const domain of batchDomains) {
          for (const template of templates) {
            try {
              const url = this.placeholderEngine.replace(template, {
                domain: domain.domain,
                rank: domain.rank,
                csvDate: domain.last_seen_in_csv_at
              });
              batchUrls.push({ url, domain: domain.domain, template });
            } catch (error: any) {
              errorHandler.handleUrlGenerationError(domain.domain, error);
            }
          }
        }
        
        if (batchUrls.length === 0) continue;
        
        // 扫描当前批次
        const urlList = batchUrls.map(u => u.url);
        
        // Debug: 打印前几个 URL
        if (offset === 0) {
          console.log(`[Task ${taskId}] Sample URLs being scanned:`);
          urlList.slice(0, 3).forEach((url, i) => {
            console.log(`  ${i + 1}. ${url}`);
          });
          console.log(`[Task ${taskId}] Sample URL mappings:`);
          batchUrls.slice(0, 3).forEach((mapping, i) => {
            console.log(`  ${i + 1}. URL: ${mapping.url}, Domain: ${mapping.domain}, Template: ${mapping.template}`);
          });
        }
        
        console.log(`[Task ${taskId}] ===== CALLING scanBatch with ${urlList.length} URLs =====`);
        
        // Track which results we've already saved
        let lastSavedCount = 0;
        
        const results = await strategy.scanBatch(urlList, async (progress) => {
          // 更新进度
          const batchScanned = progress.completed;
          const batchHits = progress.results.filter(r => r.status === 200).length;
          
          console.log(`[Task ${taskId}] Batch progress: ${batchScanned}/${batchUrls.length}, Hits: ${batchHits}`);
          
          // 记录每个扫描结果到日志（仅记录最近的几个）
          const recentResults = progress.results.slice(-5); // 只记录最近5个结果
          for (const result of recentResults) {
            // Debug: 打印原始结果
            if (result.status === undefined) {
              console.warn(`[Task ${taskId}] Result with undefined status:`, JSON.stringify(result));
            }
            
            const urlMapping = batchUrls.find(u => u.url === result.url);
            if (urlMapping) {
              const isHit = result.status === 200;
              logger.scanResult(
                taskId,
                urlMapping.domain,
                result.url,
                result.status || 0, // 使用 0 作为默认值
                0, // response time not available in batch
                isHit
              );
            }
          }
          
          // 增量保存新的结果（每次进度更新时）
          const newResults = progress.results.slice(lastSavedCount);
          if (newResults.length > 0) {
            console.log(`[Task ${taskId}] Saving ${newResults.length} new results incrementally...`);
            try {
              await withRetry(
                () => this.saveBatchResults(taskId, newResults, batchUrls, templateConfigs),
                3
              );
              lastSavedCount = progress.results.length;
              console.log(`[Task ${taskId}] Incremental save completed. Total saved: ${lastSavedCount}`);
            } catch (error) {
              console.error(`[Task ${taskId}] Incremental save failed:`, error);
              // 不抛出错误，继续扫描
            }
          }
        });
        
        // 保存当前批次结果（只保存未在增量保存中处理的结果）
        console.log(`[Task ${taskId}] ===== scanBatch RETURNED =====`);
        console.log(`[Task ${taskId}] Batch scan completed, results.length = ${results.length}`);
        console.log(`[Task ${taskId}] Results type: ${typeof results}, isArray: ${Array.isArray(results)}`);
        console.log(`[Task ${taskId}] Already saved incrementally: ${lastSavedCount}`);
        
        if (results.length > 0) {
          const batchHits = results.filter(r => r.status === 200).length;
          const batch404 = results.filter(r => r.status === 404).length;
          const batchErrors = results.filter(r => r.status >= 500 || r.status === 0).length;
          
          console.log(`[Task ${taskId}] Batch stats: Hits=${batchHits}, 404s=${batch404}, Errors=${batchErrors}`);
          
          logger.info('scanner', `Batch ${Math.floor(offset / DOMAIN_BATCH_SIZE) + 1} completed`, {
            task_id: taskId,
            details: `Scanned: ${results.length}, Hits: ${batchHits}, 404s: ${batch404}, Errors: ${batchErrors}`
          });
          
          // 记录一些命中的 URL 示例
          const hitExamples = results.filter(r => r.status === 200).slice(0, 3);
          for (const hit of hitExamples) {
            const urlMapping = batchUrls.find(u => u.url === hit.url);
            if (urlMapping) {
              logger.success('scanner', `Found: ${urlMapping.domain}`, {
                task_id: taskId,
                domain: urlMapping.domain,
                url: hit.url,
                response_code: hit.status,
                details: `Size: ${hit.size} bytes, Type: ${hit.contentType || 'unknown'}`
              });
            }
          }
          
          // 只保存未在增量保存中处理的剩余结果
          const remainingResults = results.slice(lastSavedCount);
          if (remainingResults.length > 0) {
            console.log(`[Task ${taskId}] Saving ${remainingResults.length} remaining results (not saved incrementally)...`);
            try {
              await withRetry(
                () => this.saveBatchResults(taskId, remainingResults, batchUrls, templateConfigs),
                3
              );
              console.log(`[Task ${taskId}] saveBatchResults completed successfully`);
            } catch (error) {
              console.error(`[Task ${taskId}] saveBatchResults failed:`, error);
              throw error;
            }
          } else {
            console.log(`[Task ${taskId}] All results already saved incrementally, skipping final save`);
          }
        } else {
          console.warn(`[Task ${taskId}] No results to save (results.length = 0)`);
        }
        
        // 更新当前批次域名的扫描状态
        for (const domain of batchDomains) {
          scannedDomains.add(domain.domain);
        }
        
        // 批量更新域名状态
        if (scannedDomains.size >= 1000) {
          await withRetry(
            () => this.updateDomainScanStatus(Array.from(scannedDomains)),
            3
          );
          scannedDomains.clear();
        }
        
        // 更新总进度
        totalScanned += results.length;
        totalHits += results.filter(r => r.status === 200).length;
        taskRepository.updateTaskProgress(taskId, totalScanned, totalHits);
        
        const progressPercent = ((totalScanned / (totalDomains * templates.length)) * 100).toFixed(1);
        console.log(`[Task ${taskId}] Overall progress: ${totalScanned}/${totalDomains * templates.length} (${progressPercent}%), Total hits: ${totalHits}`);
        
        logger.info('scanner', `Overall progress: ${progressPercent}%`, {
          task_id: taskId,
          details: `Scanned: ${totalScanned.toLocaleString()}/${(totalDomains * templates.length).toLocaleString()}, Hits: ${totalHits.toLocaleString()}`
        });
      }

      // 更新剩余的域名扫描状态
      if (scannedDomains.size > 0) {
        await withRetry(
          () => this.updateDomainScanStatus(Array.from(scannedDomains)),
          3
        );
      }

      // 更新任务状态为completed
      logger.success('scanner', `Scan completed: ${task.name}`, { 
        task_id: taskId,
        details: `total: ${totalScanned}, hits: ${totalHits}` 
      });
      console.log(`[Task ${taskId}] Scan completed. Total: ${totalScanned}, Hits: ${totalHits}`);
      taskRepository.updateTaskStatus(taskId, 'completed');
      
    } catch (error: any) {
      // 处理致命错误
      errorHandler.handleFatalError(taskId, error);
      taskRepository.updateTaskStatus(taskId, 'failed');
      throw error;
    }
  }

  /**
   * 分批获取域名（避免一次性加载所有域名到内存）
   */
  private getDomainsBatch(
    target: 'incremental' | 'full',
    offset: number,
    limit: number
  ): Array<{ domain: string; rank: number; last_seen_in_csv_at: string }> {
    let query = 'SELECT domain, rank, last_seen_in_csv_at FROM domains';
    
    if (target === 'incremental') {
      query += ' WHERE has_been_scanned = 0';
    }
    
    query += ' ORDER BY rank ASC LIMIT ? OFFSET ?';
    
    const stmt = db.prepare(query);
    return stmt.all(limit, offset) as Array<{ domain: string; rank: number; last_seen_in_csv_at: string }>;
  }

  /**
   * 批量保存扫描结果（带过滤）
   */
  private async saveBatchResults(
    taskId: number,
    results: ScanResponse[],
    urlMapping: Array<{ url: string; domain: string; template: string }>,
    templateConfigs?: Array<{
      template: string;
      expected_content_type: string | null;
      exclude_content_type: number;
      min_size: number;
      max_size: number | null;
    }>
  ): Promise<void> {
    console.log(`[Task ${taskId}] ===== SAVE BATCH RESULTS START =====`);
    console.log(`[Task ${taskId}] Saving ${results.length} results to database`);
    console.log(`[Task ${taskId}] URL mappings count: ${urlMapping.length}`);
    console.log(`[Task ${taskId}] Template configs count: ${templateConfigs?.length || 0}`);
    
    if (results.length > 0) {
      console.log(`[Task ${taskId}] Sample result:`, JSON.stringify(results[0]));
    }
    if (urlMapping.length > 0) {
      console.log(`[Task ${taskId}] Sample URL mapping:`, JSON.stringify(urlMapping[0]));
    }
    
    const insertStmt = db.prepare(`
      INSERT INTO scan_results (task_id, domain, url, status, content_type, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((results: ScanResponse[]) => {
      let savedCount = 0;
      let skippedCount = 0;
      
      console.log(`[Task ${taskId}] Transaction started, processing ${results.length} results...`);
      
      for (const result of results) {
        // 查找对应的域名和模板
        const mapping = urlMapping.find(m => m.url === result.url);
        
        if (!mapping) {
          console.warn(`[Task ${taskId}] No mapping found for URL: ${result.url}`);
          skippedCount++;
          continue;
        }
        
        const domain = mapping.domain;
        const template = mapping.template;

        // 如果有模板配置，对 status=200 的结果进行过滤
        // 其他状态码（404, 403等）也要保存，用于统计和分析
        if (templateConfigs && templateConfigs.length > 0 && result.status === 200) {
          // 查找匹配的模板配置
          const config = templateConfigs.find(c => c.template === template);
          
          if (config) {
            console.log(`[Task ${taskId}] Found matching config for template: ${template}`);
            console.log(`[Task ${taskId}] Config: expected_content_type=${config.expected_content_type}, min_size=${config.min_size}, max_size=${config.max_size}`);
            console.log(`[Task ${taskId}] Result: contentType=${result.contentType}, size=${result.size}`);
            
            // 检查Content-Type
            if (config.expected_content_type && result.contentType) {
              const isExcludeMode = config.exclude_content_type === 1;
              const contentTypeMatches = result.contentType.includes(config.expected_content_type);
              
              if (isExcludeMode) {
                // 排除模式：如果 Content-Type 匹配，则跳过
                if (contentTypeMatches) {
                  console.log(`[Filter] Skipping ${result.url}: Content-Type excluded (excluded: ${config.expected_content_type}, got: ${result.contentType})`);
                  skippedCount++;
                  continue;
                }
              } else {
                // 包含模式：如果 Content-Type 不匹配，则跳过
                if (!contentTypeMatches) {
                  console.log(`[Filter] Skipping ${result.url}: Content-Type mismatch (expected: ${config.expected_content_type}, got: ${result.contentType})`);
                  skippedCount++;
                  continue;
                }
              }
            }
            
            // 检查文件大小（只在大小已知时检查）
            if (result.size !== null) {
              if (result.size < config.min_size) {
                console.log(`[Filter] Skipping ${result.url}: File too small (${result.size} < ${config.min_size})`);
                skippedCount++;
                continue; // 跳过太小的文件
              }
              
              if (config.max_size && result.size > config.max_size) {
                console.log(`[Filter] Skipping ${result.url}: File too large (${result.size} > ${config.max_size})`);
                skippedCount++;
                continue; // 跳过太大的文件
              }
            }
            
            console.log(`[Task ${taskId}] Result passed all filters: ${result.url}`);
          } else {
            console.log(`[Task ${taskId}] No matching config for template: ${template}, saving without filter`);
          }
        }

        // 保存结果（size 可能是 null，表示未知大小）
        try {
          insertStmt.run(
            taskId,
            domain,
            result.url,
            result.status,
            result.contentType,
            result.size !== null ? result.size : 0  // 数据库中用 0 表示未知
          );
          savedCount++;
          
          if (savedCount <= 3) {
            console.log(`[Task ${taskId}] Saved result #${savedCount}: ${domain} - ${result.url} (${result.status})`);
          }
        } catch (error) {
          console.error(`[Task ${taskId}] Failed to insert result:`, error);
          console.error(`[Task ${taskId}] Failed result data:`, { taskId, domain, url: result.url, status: result.status });
        }
      }
      
      console.log(`[Task ${taskId}] Transaction complete: Saved ${savedCount} results, skipped ${skippedCount}`);
    });

    try {
      transaction(results);
      console.log(`[Task ${taskId}] ===== SAVE BATCH RESULTS SUCCESS =====`);
    } catch (error) {
      console.error(`[Task ${taskId}] ===== SAVE BATCH RESULTS FAILED =====`);
      console.error(`[Task ${taskId}] Error:`, error);
      throw error;
    }
  }

  /**
   * 更新域名扫描状态
   */
  private async updateDomainScanStatus(domains: string[]): Promise<void> {
    if (domains.length === 0) return;

    const updateStmt = db.prepare(`
      UPDATE domains SET has_been_scanned = 1 WHERE domain = ?
    `);

    const transaction = db.transaction((domains: string[]) => {
      for (const domain of domains) {
        updateStmt.run(domain);
      }
    });

    transaction(domains);
  }
}

export default new ScannerService();

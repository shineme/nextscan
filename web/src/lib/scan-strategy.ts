/**
 * Scan Strategy Pattern
 * Provides different strategies for scanning URLs (Worker-based or Local)
 */

import { WorkerPool } from './worker-pool';
import { WorkerClient, ScanResponse } from './worker-client';
import { createConcurrencyController } from './concurrency-controller';

export interface BatchProgress {
  completed: number;
  total: number;
  results: ScanResponse[];
}

export interface ScanStrategy {
  name: string;
  
  /**
   * Scan a batch of URLs
   */
  scanBatch(
    urls: string[],
    onProgress?: (progress: BatchProgress) => void | Promise<void>
  ): Promise<ScanResponse[]>;
}

/**
 * Worker-based scanning strategy
 * Uses Cloudflare Workers to perform HTTP requests
 */
export class WorkerScanStrategy implements ScanStrategy {
  name = 'worker';
  
  constructor(
    private workerPool: WorkerPool,
    private workerClient: WorkerClient,
    private batchSize: number = 10,
    private timeout: number = 10000
  ) {}
  
  async scanBatch(
    urls: string[],
    onProgress?: (progress: BatchProgress) => void | Promise<void>
  ): Promise<ScanResponse[]> {
    const results: ScanResponse[] = [];
    const total = urls.length;
    
    // Split URLs into batches
    const batches: string[][] = [];
    for (let i = 0; i < urls.length; i += this.batchSize) {
      batches.push(urls.slice(i, i + this.batchSize));
    }
    
    console.log(`[WorkerStrategy] Scanning ${urls.length} URLs in ${batches.length} batches`);
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchResults = await this.scanBatchWithRetry(batch);
      results.push(...batchResults);
      
      // Report progress
      if (onProgress) {
        await onProgress({
          completed: results.length,
          total,
          results: [...results],
        });
      }
    }
    
    console.log(`[WorkerStrategy] Scan complete, returning ${results.length} results`);
    return results;
  }
  
  /**
   * Scan a batch with automatic retry and failover
   */
  private async scanBatchWithRetry(
    urls: string[],
    maxRetries: number = 3
  ): Promise<ScanResponse[]> {
    let attempt = 0;
    let lastError: Error | null = null;
    
    while (attempt < maxRetries) {
      try {
        const worker = this.workerPool.selectWorker();
        
        if (!worker) {
          // No workers available, fall back to local scanning
          console.log('[WorkerStrategy] No healthy workers available, falling back to local');
          return await this.fallbackToLocal(urls);
        }
        
        console.log(`[WorkerStrategy] Using worker ${worker.id} (${worker.dailyUsage}/${worker.dailyQuota} used)`);
        
        const response = await this.workerClient.sendBatch(
          worker.url,
          urls,
          {
            method: 'head',
            timeout: Math.floor(this.timeout / 1000),
            retry: 2,
          }
        );
        
        // Check for block indicators
        if (this.workerClient.isWorkerBlocked(response)) {
          const reason = this.workerClient.getBlockReason(response);
          console.error(`[WorkerStrategy] Worker ${worker.id} is blocked: ${reason}`);
          this.workerPool.permanentlyDisable(worker.id, reason || 'blocked');
          
          // Don't count as retry, immediately try next worker
          continue;
        }
        
        // Success - record usage and return results
        console.log(`[WorkerStrategy] Worker ${worker.id} succeeded, incrementing usage by ${urls.length}`);
        this.workerPool.recordSuccess(worker.id);
        this.workerPool.incrementUsage(worker.id, urls.length);
        
        return response.results.map(r => this.workerClient.parseToScanResponse(r));
        
      } catch (error) {
        lastError = error as Error;
        attempt++;
        
        console.log(`[WorkerStrategy] Worker request failed (attempt ${attempt}/${maxRetries}):`, error);
        
        const worker = this.workerPool.selectWorker();
        if (worker) {
          // Check if error indicates block
          if (this.workerClient.isWorkerBlocked(error as Error)) {
            const reason = this.workerClient.getBlockReason(error as Error);
            console.error(`[WorkerStrategy] Worker ${worker.id} is blocked: ${reason}`);
            this.workerPool.permanentlyDisable(worker.id, reason || 'blocked');
            
            // Don't count as retry
            attempt--;
            continue;
          }
          
          console.log(`[WorkerStrategy] Recording failure for worker ${worker.id}`);
          this.workerPool.recordFailure(worker.id, error as Error);
        }
        
        if (attempt >= maxRetries) {
          // All retries exhausted, fall back to local
          console.log('[WorkerStrategy] All worker retries failed, using local scanning');
          return await this.fallbackToLocal(urls);
        }
      }
    }
    
    // Should never reach here, but TypeScript needs it
    throw lastError || new Error('Scan failed');
  }
  
  /**
   * Fallback to local scanning when workers fail
   */
  private async fallbackToLocal(urls: string[]): Promise<ScanResponse[]> {
    console.log(`[WorkerStrategy] Falling back to local scanning for ${urls.length} URLs`);
    
    const localStrategy = new LocalScanStrategy(
      createConcurrencyController(50, this.timeout)
    );
    
    const results = await localStrategy.scanBatch(urls);
    console.log(`[WorkerStrategy] Fallback completed, got ${results.length} results`);
    
    return results;
  }
}

/**
 * Local scanning strategy
 * Performs direct HTTP requests from the server
 */
export class LocalScanStrategy implements ScanStrategy {
  name = 'local';
  
  constructor(
    private concurrencyController: ReturnType<typeof createConcurrencyController>
  ) {}
  
  async scanBatch(
    urls: string[],
    onProgress?: (progress: BatchProgress) => void | Promise<void>
  ): Promise<ScanResponse[]> {
    console.log(`[LocalStrategy] Scanning ${urls.length} URLs with local strategy`);
    
    const results = await this.concurrencyController.scanBatch(urls, onProgress);
    
    return results;
  }
}

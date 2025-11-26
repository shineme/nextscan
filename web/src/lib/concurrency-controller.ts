import { fetchWithTimeout, ScanResponse } from './http-client';

export interface ConcurrencyConfig {
  concurrency: number;
  timeout: number;
}

export interface BatchProgress {
  completed: number;
  total: number;
  results: ScanResponse[];
}

/**
 * 并发控制器 - 使用滑动窗口模式
 */
export class ConcurrencyController {
  private concurrency: number;
  private timeout: number;

  constructor(config: ConcurrencyConfig) {
    this.concurrency = config.concurrency;
    this.timeout = config.timeout;
  }

  /**
   * 批量扫描URL,控制并发数
   */
  async scanBatch(
    urls: string[],
    onProgress?: (progress: BatchProgress) => void | Promise<void>
  ): Promise<ScanResponse[]> {
    const results: ScanResponse[] = [];
    const total = urls.length;

    // 使用滑动窗口批处理
    for (let i = 0; i < urls.length; i += this.concurrency) {
      const batch = urls.slice(i, i + this.concurrency);
      
      // 并发执行当前批次
      const batchPromises = batch.map(url => 
        fetchWithTimeout(url, this.timeout)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // 处理结果
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Promise被拒绝,创建错误结果
          results.push({
            url: batch[results.length % batch.length] || '',
            status: -1,
            contentType: 'error',
            size: 0,
            error: result.reason?.message || 'Unknown error'
          });
        }
      }

      // 报告进度
      if (onProgress) {
        await onProgress({
          completed: results.length,
          total,
          results: [...results]
        });
      }
    }

    return results;
  }

  /**
   * 扫描单个URL
   */
  async scanSingle(url: string): Promise<ScanResponse> {
    return fetchWithTimeout(url, this.timeout);
  }
}

/**
 * 创建并发控制器
 */
export function createConcurrencyController(
  concurrency: number = 50,
  timeout: number = 10000
): ConcurrencyController {
  return new ConcurrencyController({ concurrency, timeout });
}

import { ScanResponse } from './http-client';

export class ErrorHandler {
  /**
   * 处理扫描错误
   */
  handleScanError(error: Error, url: string): ScanResponse {
    console.error(`Scan error for ${url}:`, error);
    
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return {
        url,
        status: -1,
        contentType: 'timeout',
        size: 0,
        error: 'Request timeout'
      };
    }
    
    return {
      url,
      status: -1,
      contentType: 'error',
      size: 0,
      error: error.message || 'Unknown error'
    };
  }

  /**
   * 处理URL生成错误
   */
  handleUrlGenerationError(domain: string, error: Error): void {
    console.error(`URL generation failed for domain ${domain}:`, error.message);
  }

  /**
   * 处理致命错误
   */
  handleFatalError(taskId: number, error: Error): void {
    console.error(`Fatal error in task ${taskId}:`, error);
  }

  /**
   * 记录错误日志
   */
  logError(context: string, error: Error, metadata?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ${context}:`, {
      message: error.message,
      stack: error.stack,
      ...metadata
    });
  }
}

/**
 * 数据库操作重试包装器
 */
export async function withRetry<T>(
  operation: () => Promise<T> | T,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.error(`Operation failed (attempt ${attempt + 1}/${maxRetries}):`, error.message);
      
      if (attempt < maxRetries - 1) {
        // 指数退避
        const delay = delayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default new ErrorHandler();

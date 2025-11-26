/**
 * Worker Client
 * Handles communication with Cloudflare Worker API endpoints
 */

export interface WorkerRequest {
  urls: string[];
  method: 'head' | 'get';
  timeout: number;
  retry: number;
  preview?: boolean;
}

export interface WorkerResponse {
  success: boolean;
  total: number;
  results: WorkerResult[];
  timestamp: string;
}

export interface WorkerResult {
  url: string;
  method: string;
  success: boolean;
  status: number;
  statusText?: string;
  ok?: boolean;
  responseTime?: string;
  summary?: {
    contentLength?: string;
    contentLengthBytes?: number;
    contentType?: string;
    supportResume?: boolean;
  };
  error?: string;
  errorType?: string;
  attempts?: number;
}

export interface ScanResponse {
  url: string;
  status: number;
  contentType: string | null;
  size: number | null;  // null 表示未知大小
  responseTime?: number;  // 响应时间（毫秒）
  error?: string;
}

export class WorkerClient {
  private timeout: number;

  constructor(timeout: number = 10000) {
    this.timeout = timeout;
  }

  /**
   * Send batch request to Worker
   */
  async sendBatch(
    workerUrl: string,
    urls: string[],
    options: Partial<WorkerRequest> = {}
  ): Promise<WorkerResponse> {
    const requestBody: WorkerRequest = {
      urls,
      method: options.method || 'head',
      timeout: options.timeout || Math.floor(this.timeout / 1000),
      retry: options.retry || 2,
      preview: options.preview || false,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Worker returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as WorkerResponse;
      
      // Debug: 打印前3个结果的原始数据
      if (data.results && data.results.length > 0) {
        console.log(`[WorkerClient] Received ${data.results.length} results from worker`);
        data.results.slice(0, 3).forEach((r, i) => {
          console.log(`[WorkerClient] Result ${i + 1}: URL=${r.url}, Status=${r.status}, Success=${r.success}, Error=${r.error || 'none'}`);
        });
      }
      
      return data;
    } catch (error) {
      // Check if error indicates worker is blocked
      if (this.isWorkerBlocked(error as Error)) {
        throw error;
      }

      throw new Error(`Worker request failed: ${(error as Error).message}`);
    }
  }

  /**
   * Send single URL request
   */
  async sendSingle(
    workerUrl: string,
    url: string,
    options: Partial<WorkerRequest> = {}
  ): Promise<WorkerResult> {
    const response = await this.sendBatch(workerUrl, [url], options);
    
    if (response.results.length === 0) {
      throw new Error('No results returned from worker');
    }

    return response.results[0];
  }

  /**
   * Check if response indicates Worker is blocked/disabled
   */
  isWorkerBlocked(response: WorkerResponse | Error): boolean {
    if (response instanceof Error) {
      const message = response.message.toLowerCase();
      return message.includes('there is nothing here yet') ||
             message.includes('account has been blocked');
    }

    // Check response body or error messages in results
    if (!response.success) {
      const errorText = JSON.stringify(response).toLowerCase();
      if (errorText.includes('there is nothing here yet') ||
          errorText.includes('account has been blocked')) {
        return true;
      }
    }

    // Check individual result errors
    for (const result of response.results) {
      if (result.error) {
        const errorLower = result.error.toLowerCase();
        if (errorLower.includes('there is nothing here yet') ||
            errorLower.includes('account has been blocked')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Extract block reason from response
   */
  getBlockReason(response: WorkerResponse | Error): string | null {
    const text = response instanceof Error 
      ? response.message 
      : JSON.stringify(response);

    const lower = text.toLowerCase();

    if (lower.includes('there is nothing here yet')) {
      return 'not_deployed';
    }

    if (lower.includes('account has been blocked')) {
      return 'account_blocked';
    }

    return null;
  }

  /**
   * Parse Worker response to ScanResponse format
   */
  parseToScanResponse(result: WorkerResult): ScanResponse {
    // 解析响应时间（从 "1359ms" 格式提取数字）
    let responseTime: number | undefined;
    if (result.responseTime) {
      const match = result.responseTime.match(/(\d+)/);
      if (match) {
        responseTime = parseInt(match[1], 10);
      }
    }
    
    return {
      url: result.url,
      status: result.status,
      contentType: result.summary?.contentType || null,
      // 保持 null 表示未知大小，不要转换为 0
      size: result.summary?.contentLengthBytes !== undefined && result.summary.contentLengthBytes !== null 
        ? result.summary.contentLengthBytes 
        : null,
      responseTime,
      error: result.success ? undefined : result.error,
    };
  }

  /**
   * Health check a Worker endpoint
   */
  async healthCheck(workerUrl: string): Promise<boolean> {
    try {
      // Use a simple test URL
      const testUrl = 'https://www.google.com';
      const result = await this.sendSingle(workerUrl, testUrl, {
        method: 'head',
        timeout: 5,
        retry: 0,
      });

      // Check if worker is blocked
      if (this.isWorkerBlocked({ success: true, total: 1, results: [result], timestamp: new Date().toISOString() })) {
        return false;
      }

      return result.success;
    } catch (error) {
      // Check if error indicates worker is blocked
      if (this.isWorkerBlocked(error as Error)) {
        return false;
      }

      return false;
    }
  }
}

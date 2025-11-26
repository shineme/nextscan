export interface ScanResponse {
  url: string;
  status: number;
  contentType: string | null;
  size: number | null;  // null 表示未知大小
  responseTime?: number;  // 响应时间（毫秒）
  error?: string;
}

/**
 * 带超时的HTTP请求
 */
export async function fetchWithTimeout(
  url: string,
  timeout: number = 10000
): Promise<ScanResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'HEAD', // 使用HEAD请求减少带宽
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'NextScan/1.0'
      },
      cache: 'no-store' // 禁用缓存
    });
    
    clearTimeout(timeoutId);
    
    const duration = Date.now() - startTime;
    
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : null;  // null 表示未知
    
    // 每100个请求输出一次样本日志
    if (Math.random() < 0.01) {
      console.log(`[HTTP] ${url} -> ${response.status} (${duration}ms)`);
    }
    
    return {
      url,
      status: response.status,
      contentType,
      size,
      responseTime: duration
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    const duration = Date.now() - startTime;
    
    // 超时错误
    if (error.name === 'AbortError') {
      if (Math.random() < 0.01) {
        console.log(`[HTTP] ${url} -> TIMEOUT (${duration}ms)`);
      }
      return {
        url,
        status: -1,
        contentType: 'timeout',
        size: 0,
        error: 'Request timeout'
      };
    }
    
    // 网络错误
    if (Math.random() < 0.01) {
      console.log(`[HTTP] ${url} -> ERROR: ${error.message} (${duration}ms)`);
    }
    return {
      url,
      status: -1,
      contentType: 'error',
      size: 0,
      error: error.message || 'Network error'
    };
  }
}

/**
 * 批量扫描URL
 */
export async function scanUrls(
  urls: string[],
  timeout: number = 10000,
  onProgress?: (completed: number, total: number) => void
): Promise<ScanResponse[]> {
  const results: ScanResponse[] = [];
  
  for (let i = 0; i < urls.length; i++) {
    const result = await fetchWithTimeout(urls[i], timeout);
    results.push(result);
    
    if (onProgress) {
      onProgress(i + 1, urls.length);
    }
  }
  
  return results;
}

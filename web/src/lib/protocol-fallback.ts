import { configService } from './config-service';

export interface FetchOptions {
  timeout?: number;
  method?: string;
  headers?: Record<string, string>;
}

export interface FetchResult {
  success: boolean;
  protocol: 'https' | 'http';
  statusCode?: number;
  contentType?: string;
  size?: number;
  error?: string;
}

/**
 * 协议自动降级处理器
 */
export class ProtocolFallback {
  /**
   * 执行带降级的请求
   */
  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const enableFallback = configService.get('enable_protocol_fallback') === 'true';
    const timeout = options.timeout || parseInt(configService.get('request_timeout') || '10', 10) * 1000;

    // 确保URL不包含协议
    let cleanUrl = url.replace(/^https?:\/\//, '');

    // 首先尝试HTTPS
    const httpsResult = await this.tryFetch(`https://${cleanUrl}`, timeout, options);
    
    if (httpsResult.success) {
      return { ...httpsResult, protocol: 'https' };
    }

    // 如果HTTPS失败且启用降级,尝试HTTP
    if (enableFallback) {
      const httpResult = await this.tryFetch(`http://${cleanUrl}`, timeout, options);
      
      if (httpResult.success) {
        return { ...httpResult, protocol: 'http' };
      }
      
      // 两者都失败
      return {
        success: false,
        protocol: 'http',
        error: httpResult.error || 'Both HTTPS and HTTP failed'
      };
    }

    // 降级被禁用,只返回HTTPS结果
    return { ...httpsResult, protocol: 'https' };
  }

  /**
   * 尝试单个协议的请求
   */
  private async tryFetch(
    url: string,
    timeout: number,
    options: FetchOptions
  ): Promise<Omit<FetchResult, 'protocol'>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: options.method || 'HEAD',
        headers: options.headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || undefined;
      const contentLength = response.headers.get('content-length');
      const size = contentLength ? parseInt(contentLength, 10) : undefined;

      return {
        success: response.ok,
        statusCode: response.status,
        contentType,
        size
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout' : error.message
      };
    }
  }
}

// 导出单例
export const protocolFallback = new ProtocolFallback();

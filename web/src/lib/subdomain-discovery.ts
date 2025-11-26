import { configService } from './config-service';
import { protocolFallback } from './protocol-fallback';
import { randomUUID } from 'crypto';

/**
 * 子域名探测服务
 */
export class SubdomainDiscovery {
  /**
   * 生成随机测试子域名
   */
  generateRandomSubdomain(): string {
    return randomUUID().replace(/-/g, '');
  }

  /**
   * 检测泛解析
   * 生成2个随机子域名,如果都返回有效响应,判定为泛解析
   */
  async detectWildcard(domain: string): Promise<boolean> {
    try {
      const testCount = 2;
      const results: boolean[] = [];

      for (let i = 0; i < testCount; i++) {
        const randomSub = this.generateRandomSubdomain();
        const testDomain = `${randomSub}.${domain}`;
        
        const result = await protocolFallback.fetch(testDomain, { timeout: 5000 });
        results.push(result.success && result.statusCode === 200);
      }

      // 如果所有测试都返回成功,判定为泛解析
      return results.every(r => r === true);
    } catch (error) {
      console.error('Wildcard detection failed:', error);
      // 检测失败,假定为非泛解析
      return false;
    }
  }

  /**
   * 发现子域名
   */
  async discoverSubdomains(domain: string): Promise<string[]> {
    const enableDiscovery = configService.get('enable_subdomain_discovery') === 'true';
    
    if (!enableDiscovery) {
      return [];
    }

    // 先检测泛解析
    const isWildcard = await this.detectWildcard(domain);
    
    if (isWildcard) {
      console.log(`Domain ${domain} has wildcard DNS, skipping subdomain discovery`);
      return [];
    }

    // 获取常见子域名列表
    const subdomainsStr = configService.get('common_subdomains') || 'www,api,admin,test,dev,staging';
    const commonSubdomains = subdomainsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

    const discovered: string[] = [];

    // 并发探测子域名
    const promises = commonSubdomains.map(async (sub) => {
      const subdomain = `${sub}.${domain}`;
      try {
        const result = await protocolFallback.fetch(subdomain, { timeout: 5000 });
        if (result.success && result.statusCode === 200) {
          return subdomain;
        }
      } catch (error) {
        // 忽略错误,继续下一个
      }
      return null;
    });

    const results = await Promise.all(promises);
    
    for (const subdomain of results) {
      if (subdomain) {
        discovered.push(subdomain);
      }
    }

    return discovered;
  }

  /**
   * 添加子域名到配置
   */
  addSubdomain(subdomain: string): void {
    const subdomainsStr = configService.get('common_subdomains') || '';
    const subdomains = subdomainsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    if (!subdomains.includes(subdomain)) {
      subdomains.push(subdomain);
      configService.set('common_subdomains', subdomains.join(','));
    }
  }

  /**
   * 删除子域名从配置
   */
  removeSubdomain(subdomain: string): void {
    const subdomainsStr = configService.get('common_subdomains') || '';
    const subdomains = subdomainsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    const filtered = subdomains.filter(s => s !== subdomain);
    configService.set('common_subdomains', filtered.join(','));
  }
}

// 导出单例
export const subdomainDiscovery = new SubdomainDiscovery();

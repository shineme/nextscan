import db from './db';

export interface ScanConfig {
  concurrency: number;
  timeout: number;
  batchSize: number;
}

/**
 * 配置服务
 */
export class ConfigService {
  private cache: Map<string, string> = new Map();

  /**
   * 获取配置值
   */
  private getSetting(key: string, defaultValue: string): string {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key) as { value: string } | undefined;
    
    const value = result?.value || defaultValue;
    this.cache.set(key, value);
    
    return value;
  }

  /**
   * 设置配置值
   */
  setSetting(key: string, value: string): void {
    const stmt = db.prepare(`
      INSERT INTO settings (key, value) 
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    
    stmt.run(key, value);
    this.cache.set(key, value);
  }

  /**
   * 获取扫描配置
   */
  getScanConfig(): ScanConfig {
    return {
      concurrency: parseInt(this.getSetting('scan_concurrency', '50')),
      timeout: parseInt(this.getSetting('scan_timeout', '10000')),
      batchSize: parseInt(this.getSetting('scan_batch_size', '100'))
    };
  }

  /**
   * 更新扫描配置
   */
  updateScanConfig(config: Partial<ScanConfig>): void {
    if (config.concurrency !== undefined) {
      this.setSetting('scan_concurrency', config.concurrency.toString());
    }
    if (config.timeout !== undefined) {
      this.setSetting('scan_timeout', config.timeout.toString());
    }
    if (config.batchSize !== undefined) {
      this.setSetting('scan_batch_size', config.batchSize.toString());
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export default new ConfigService();

import db from './db';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// 默认配置
const DEFAULT_CONFIG: Record<string, string> = {
  csv_url: 'https://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip',
  max_concurrency: '100',
  request_timeout: '10',
  retry_count: '2',
  enable_protocol_fallback: 'true',
  enable_subdomain_discovery: 'false',
  common_subdomains: 'www,api,admin,test,dev,staging',
  path_templates: '1.zip,files.zip,(domain).zip,(root_domain).zip'
};

/**
 * 配置管理服务
 */
export class ConfigService {
  /**
   * 获取单个配置项
   */
  get(key: string): string | null {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      const row = stmt.get(key) as { value: string } | undefined;
      
      if (row) {
        return row.value;
      }
      
      // 返回默认值
      return DEFAULT_CONFIG[key] || null;
    } catch (error) {
      console.error('Failed to get config:', error);
      return DEFAULT_CONFIG[key] || null;
    }
  }

  /**
   * 获取所有配置项
   */
  getAll(): Record<string, string> {
    try {
      const stmt = db.prepare('SELECT key, value FROM settings');
      const rows = stmt.all() as { key: string; value: string }[];
      
      const config: Record<string, string> = { ...DEFAULT_CONFIG };
      
      // 覆盖数据库中的值
      rows.forEach(row => {
        config[row.key] = row.value;
      });
      
      return config;
    } catch (error) {
      console.error('Failed to get all configs:', error);
      return { ...DEFAULT_CONFIG };
    }
  }

  /**
   * 设置单个配置项
   */
  set(key: string, value: string): void {
    // 验证配置值
    const validation = this.validate(key, value);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    const stmt = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
    );
    stmt.run(key, value, value);
  }

  /**
   * 批量设置配置项
   */
  setMany(configs: Record<string, string>): void {
    // 先验证所有配置
    for (const [key, value] of Object.entries(configs)) {
      const validation = this.validate(key, value);
      if (!validation.valid) {
        throw new Error(`${key}: ${validation.error}`);
      }
    }
    
    // 使用事务批量更新
    const updateMany = db.transaction((items: [string, string][]) => {
      const stmt = db.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
      );
      for (const [key, value] of items) {
        stmt.run(key, value, value);
      }
    });
    
    updateMany(Object.entries(configs));
  }

  /**
   * 重置为默认值
   */
  reset(): void {
    const stmt = db.prepare('DELETE FROM settings');
    stmt.run();
    
    // 重新插入默认值
    this.setMany(DEFAULT_CONFIG);
  }

  /**
   * 验证配置值
   */
  validate(key: string, value: string): ValidationResult {
    switch (key) {
      case 'csv_url':
        return this.validateURL(value);
      
      case 'max_concurrency':
        return this.validateRange(value, 1, 1000, 'Max concurrency');
      
      case 'request_timeout':
        return this.validateRange(value, 1, 60, 'Request timeout');
      
      case 'retry_count':
        return this.validateRange(value, 0, 5, 'Retry count');
      
      case 'enable_protocol_fallback':
      case 'enable_subdomain_discovery':
        return this.validateBoolean(value);
      
      case 'common_subdomains':
      case 'path_templates':
        // 逗号分隔的字符串,基本验证
        return { valid: true };
      
      case 'scan_concurrency':
        return this.validateRange(value, 1, 1000, 'Scan concurrency');
      
      case 'scan_timeout':
        return this.validateRange(value, 1000, 60000, 'Scan timeout (ms)');
      
      case 'scan_batch_size':
        return this.validateRange(value, 10, 1000, 'Scan batch size');
      
      default:
        // 未知配置项,允许保存
        return { valid: true };
    }
  }

  /**
   * 验证URL格式
   */
  private validateURL(value: string): ValidationResult {
    try {
      new URL(value);
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  /**
   * 验证数值范围
   */
  private validateRange(value: string, min: number, max: number, name: string): ValidationResult {
    const num = parseInt(value, 10);
    
    if (isNaN(num)) {
      return { valid: false, error: `${name} must be a number` };
    }
    
    if (num < min || num > max) {
      return { valid: false, error: `${name} must be between ${min} and ${max}` };
    }
    
    return { valid: true };
  }

  /**
   * 验证布尔值
   */
  private validateBoolean(value: string): ValidationResult {
    if (value !== 'true' && value !== 'false') {
      return { valid: false, error: 'Value must be "true" or "false"' };
    }
    return { valid: true };
  }
}

// 导出单例
export const configService = new ConfigService();

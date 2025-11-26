/**
 * System Logger Service
 * Provides real-time logging with automatic cleanup
 */

import db from './db';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';
export type LogCategory = 'system' | 'scanner' | 'automation' | 'worker' | 'domain' | 'api';

export interface SystemLog {
  id?: number;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: string;
  task_id?: number;
  domain?: string;
  url?: string;
  response_code?: number;
  response_time?: number;
  created_at?: string;
}

class LoggerService {
  private static instance: LoggerService;
  private readonly MAX_LOGS = 2000;
  private insertStmt = db.prepare(`
    INSERT INTO system_logs (
      timestamp, level, category, message, details, 
      task_id, domain, url, response_code, response_time, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  private cleanupStmt = db.prepare(`
    DELETE FROM system_logs 
    WHERE id NOT IN (
      SELECT id FROM system_logs 
      ORDER BY timestamp DESC 
      LIMIT ?
    )
  `);

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * Log a message to the system
   */
  log(log: Omit<SystemLog, 'id' | 'created_at'>): void {
    try {
      const timestamp = log.timestamp || new Date().toISOString();
      
      this.insertStmt.run(
        timestamp,
        log.level,
        log.category,
        log.message,
        log.details || null,
        log.task_id || null,
        log.domain || null,
        log.url || null,
        log.response_code || null,
        log.response_time || null
      );

      // Auto-cleanup old logs
      this.cleanup();

      // Console log for development
      const consoleMsg = `[${log.category.toUpperCase()}] ${log.message}`;
      switch (log.level) {
        case 'error':
          console.error(consoleMsg, log.details || '');
          break;
        case 'warn':
          console.warn(consoleMsg, log.details || '');
          break;
        case 'success':
          console.log(`✅ ${consoleMsg}`, log.details || '');
          break;
        default:
          console.log(consoleMsg, log.details || '');
      }
    } catch (error) {
      console.error('Failed to log message:', error);
    }
  }

  /**
   * Convenience methods for different log levels
   */
  debug(category: LogCategory, message: string, details?: Partial<SystemLog>): void {
    this.log({ ...details, level: 'debug', category, message, timestamp: new Date().toISOString() });
  }

  info(category: LogCategory, message: string, details?: Partial<SystemLog>): void {
    this.log({ ...details, level: 'info', category, message, timestamp: new Date().toISOString() });
  }

  warn(category: LogCategory, message: string, details?: Partial<SystemLog>): void {
    this.log({ ...details, level: 'warn', category, message, timestamp: new Date().toISOString() });
  }

  error(category: LogCategory, message: string, details?: Partial<SystemLog>): void {
    this.log({ ...details, level: 'error', category, message, timestamp: new Date().toISOString() });
  }

  success(category: LogCategory, message: string, details?: Partial<SystemLog>): void {
    this.log({ ...details, level: 'success', category, message, timestamp: new Date().toISOString() });
  }

  /**
   * Scanner-specific logging methods
   */
  scanStart(taskId: number, domain: string, url: string): void {
    this.info('scanner', `Starting scan: ${domain}`, {
      task_id: taskId,
      domain,
      url
    });
  }

  scanResult(taskId: number, domain: string, url: string, responseCode: number, responseTime: number, found: boolean): void {
    const level = found ? 'success' : 'info';
    const message = found 
      ? `Found result: ${domain} (${responseCode})` 
      : `No result: ${domain} (${responseCode})`;
    
    this.log({
      level,
      category: 'scanner',
      message,
      task_id: taskId,
      domain,
      url,
      response_code: responseCode,
      response_time: responseTime,
      timestamp: new Date().toISOString()
    });
  }

  scanError(taskId: number, domain: string, url: string, error: string): void {
    this.error('scanner', `Scan failed: ${domain}`, {
      task_id: taskId,
      domain,
      url,
      details: error
    });
  }

  /**
   * Get recent logs for display
   */
  getRecentLogs(limit: number = 100, category?: LogCategory): SystemLog[] {
    try {
      const query = category
        ? 'SELECT * FROM system_logs WHERE category = ? ORDER BY timestamp DESC LIMIT ?'
        : 'SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT ?';
      
      const stmt = db.prepare(query);
      const params = category ? [category, limit] : [limit];
      
      return stmt.all(...params) as SystemLog[];
    } catch (error) {
      console.error('Failed to get recent logs:', error);
      return [];
    }
  }

  /**
   * Get logs since a specific timestamp
   */
  getLogsSince(timestamp: string, category?: LogCategory): SystemLog[] {
    try {
      const query = category
        ? 'SELECT * FROM system_logs WHERE category = ? AND timestamp > ? ORDER BY timestamp DESC'
        : 'SELECT * FROM system_logs WHERE timestamp > ? ORDER BY timestamp DESC';
      
      const stmt = db.prepare(query);
      const params = category ? [category, timestamp] : [timestamp];
      
      return stmt.all(...params) as SystemLog[];
    } catch (error) {
      console.error('Failed to get logs since timestamp:', error);
      return [];
    }
  }

  /**
   * Clean up old logs, keeping only the most recent MAX_LOGS entries
   */
  private cleanup(): void {
    try {
      this.cleanupStmt.run(this.MAX_LOGS);
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * Get log statistics
   */
  getStats(): { total: number; byLevel: Record<LogLevel, number>; byCategory: Record<LogCategory, number> } {
    try {
      const totalStmt = db.prepare('SELECT COUNT(*) as count FROM system_logs');
      const total = (totalStmt.get() as { count: number }).count;

      const levelStmt = db.prepare('SELECT level, COUNT(*) as count FROM system_logs GROUP BY level');
      const levelResults = levelStmt.all() as { level: LogLevel; count: number }[];
      const byLevel = levelResults.reduce((acc, { level, count }) => {
        acc[level] = count;
        return acc;
      }, {} as Record<LogLevel, number>);

      const categoryStmt = db.prepare('SELECT category, COUNT(*) as count FROM system_logs GROUP BY category');
      const categoryResults = categoryStmt.all() as { category: LogCategory; count: number }[];
      const byCategory = categoryResults.reduce((acc, { category, count }) => {
        acc[category] = count;
        return acc;
      }, {} as Record<LogCategory, number>);

      return { total, byLevel, byCategory };
    } catch (error) {
      console.error('Failed to get log stats:', error);
      return { 
        total: 0, 
        byLevel: {} as Record<LogLevel, number>, 
        byCategory: {} as Record<LogCategory, number> 
      };
    }
  }
}

// Export singleton instance
export const logger = LoggerService.getInstance();
export default logger;

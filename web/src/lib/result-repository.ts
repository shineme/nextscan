import db from './db';

export interface ScanResult {
  id: number;
  task_id: number;
  domain: string;
  url: string;
  status: number;
  content_type: string | null;
  size: number;
  scanned_at: string;
}

export interface ResultFilters {
  status?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export class ResultRepository {
  /**
   * 批量保存扫描结果(使用事务)
   */
  saveBatchResults(
    taskId: number,
    results: Array<{
      domain: string;
      url: string;
      status: number;
      contentType: string | null;
      size: number;
    }>
  ): void {
    const insertStmt = db.prepare(`
      INSERT INTO scan_results (task_id, domain, url, status, content_type, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((results: any[]) => {
      for (const result of results) {
        insertStmt.run(
          taskId,
          result.domain,
          result.url,
          result.status,
          result.contentType,
          result.size
        );
      }
    });

    transaction(results);
  }

  /**
   * 查询任务的扫描结果
   */
  getTaskResults(taskId: number, filters?: ResultFilters): ScanResult[] {
    let query = 'SELECT * FROM scan_results WHERE task_id = ?';
    const params: any[] = [taskId];

    if (filters?.status !== undefined) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters?.search) {
      query += ' AND (url LIKE ? OR domain LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' ORDER BY scanned_at DESC';

    if (filters?.limit) {
      const offset = ((filters.page || 1) - 1) * filters.limit;
      query += ' LIMIT ? OFFSET ?';
      params.push(filters.limit, offset);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as ScanResult[];
  }

  /**
   * 统计任务结果数量
   */
  countTaskResults(taskId: number, filters?: ResultFilters): number {
    let query = 'SELECT COUNT(*) as count FROM scan_results WHERE task_id = ?';
    const params: any[] = [taskId];

    if (filters?.status !== undefined) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters?.search) {
      query += ' AND (url LIKE ? OR domain LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const stmt = db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  /**
   * 获取单个结果
   */
  getResult(id: number): ScanResult | null {
    const stmt = db.prepare('SELECT * FROM scan_results WHERE id = ?');
    return stmt.get(id) as ScanResult | null;
  }

  /**
   * 删除任务的所有结果
   */
  deleteTaskResults(taskId: number): void {
    const stmt = db.prepare('DELETE FROM scan_results WHERE task_id = ?');
    stmt.run(taskId);
  }

  /**
   * 获取任务的命中数(状态码200)
   */
  getTaskHits(taskId: number): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM scan_results 
      WHERE task_id = ? AND status = 200
    `);
    const result = stmt.get(taskId) as { count: number };
    return result.count;
  }
}

export default new ResultRepository();

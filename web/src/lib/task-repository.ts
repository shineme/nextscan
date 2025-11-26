import db from './db';

export interface Task {
  id: number;
  name: string;
  target: 'incremental' | 'full';
  url_template: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total_urls: number;
  scanned_urls: number;
  hits: number;
  concurrency: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateTaskParams {
  name: string;
  target: 'incremental' | 'full';
  url_template: string;
  concurrency?: number;
}

export interface TaskFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export class TaskRepository {
  /**
   * 创建新任务
   */
  createTask(params: CreateTaskParams): Task {
    const stmt = db.prepare(`
      INSERT INTO scan_tasks (name, target, url_template, concurrency)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      params.name,
      params.target,
      params.url_template,
      params.concurrency || 50
    );
    
    return this.getTask(result.lastInsertRowid as number)!;
  }

  /**
   * 获取单个任务
   */
  getTask(id: number): Task | null {
    const stmt = db.prepare('SELECT * FROM scan_tasks WHERE id = ?');
    return stmt.get(id) as Task | null;
  }

  /**
   * 查询任务列表
   */
  listTasks(filters?: TaskFilters): Task[] {
    let query = 'SELECT * FROM scan_tasks';
    const params: any[] = [];
    
    if (filters?.status) {
      query += ' WHERE status = ?';
      params.push(filters.status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (filters?.limit) {
      const offset = ((filters.page || 1) - 1) * filters.limit;
      query += ' LIMIT ? OFFSET ?';
      params.push(filters.limit, offset);
    }
    
    const stmt = db.prepare(query);
    return stmt.all(...params) as Task[];
  }

  /**
   * 统计任务数量
   */
  countTasks(filters?: TaskFilters): number {
    let query = 'SELECT COUNT(*) as count FROM scan_tasks';
    const params: any[] = [];
    
    if (filters?.status) {
      query += ' WHERE status = ?';
      params.push(filters.status);
    }
    
    const stmt = db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(id: number, status: Task['status']): void {
    const updates: string[] = ['status = ?'];
    const params: any[] = [status];
    
    if (status === 'running') {
      updates.push('started_at = CURRENT_TIMESTAMP');
    } else if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }
    
    const stmt = db.prepare(`
      UPDATE scan_tasks 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    
    params.push(id);
    stmt.run(...params);
  }

  /**
   * 更新任务进度
   */
  updateTaskProgress(id: number, scanned_urls: number, hits: number): void {
    const task = this.getTask(id);
    if (!task) return;
    
    const progress = task.total_urls > 0 
      ? Math.round((scanned_urls / task.total_urls) * 100)
      : 0;
    
    const stmt = db.prepare(`
      UPDATE scan_tasks 
      SET scanned_urls = ?, hits = ?, progress = ?
      WHERE id = ?
    `);
    
    stmt.run(scanned_urls, hits, progress, id);
  }

  /**
   * 设置任务总URL数
   */
  setTotalUrls(id: number, total: number): void {
    const stmt = db.prepare('UPDATE scan_tasks SET total_urls = ? WHERE id = ?');
    stmt.run(total, id);
  }
}

export default new TaskRepository();

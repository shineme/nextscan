import db from './db';
import taskRepository, { CreateTaskParams, Task, TaskFilters } from './task-repository';
import { validateTemplate } from './placeholder-engine';

export interface TaskDetail extends Task {
  progressPercentage: number;
}

export class TaskService {
  /**
   * 创建新任务
   */
  createTask(params: CreateTaskParams): Task {
    // 验证必填字段
    if (!params.name || !params.name.trim()) {
      throw new Error('Task name is required');
    }
    
    if (!params.target || !['incremental', 'full'].includes(params.target)) {
      throw new Error('Invalid target type. Must be "incremental" or "full"');
    }
    
    if (!params.url_template || !params.url_template.trim()) {
      throw new Error('URL template is required');
    }
    
    // 验证URL模板格式
    const validation = validateTemplate(params.url_template);
    if (!validation.valid) {
      throw new Error(`Invalid URL template: ${validation.error}`);
    }
    
    // 验证并发数
    if (params.concurrency !== undefined) {
      if (params.concurrency < 1 || params.concurrency > 1000) {
        throw new Error('Concurrency must be between 1 and 1000');
      }
    }
    
    // 创建任务
    const task = taskRepository.createTask(params);
    
    // 计算目标域名数量
    const targetDomains = this.getTargetDomains(params.target);
    taskRepository.setTotalUrls(task.id, targetDomains.length);
    
    return taskRepository.getTask(task.id)!;
  }

  /**
   * 获取目标域名列表
   */
  getTargetDomains(target: 'incremental' | 'full'): Array<{ domain: string; rank: number; last_seen_in_csv_at: string }> {
    let query = 'SELECT domain, rank, last_seen_in_csv_at FROM domains';
    
    if (target === 'incremental') {
      query += ' WHERE has_been_scanned = 0';
    }
    
    query += ' ORDER BY rank ASC';
    
    const stmt = db.prepare(query);
    return stmt.all() as Array<{ domain: string; rank: number; last_seen_in_csv_at: string }>;
  }

  /**
   * 查询任务列表
   */
  listTasks(filters?: TaskFilters): { tasks: Task[]; total: number; page: number; limit: number } {
    const tasks = taskRepository.listTasks(filters);
    const total = taskRepository.countTasks(filters);
    
    return {
      tasks,
      total,
      page: filters?.page || 1,
      limit: filters?.limit || 20
    };
  }

  /**
   * 获取任务详情
   */
  getTaskDetail(id: number): TaskDetail | null {
    const task = taskRepository.getTask(id);
    if (!task) return null;
    
    const progressPercentage = task.total_urls > 0
      ? Math.round((task.scanned_urls / task.total_urls) * 100)
      : 0;
    
    return {
      ...task,
      progressPercentage
    };
  }

  /**
   * 获取任务
   */
  getTask(id: number): Task | null {
    return taskRepository.getTask(id);
  }

  /**
   * 重置所有域名的扫描状态(用于半年复扫)
   */
  resetAllScanStatus(): number {
    const stmt = db.prepare('UPDATE domains SET has_been_scanned = 0');
    const result = stmt.run();
    return result.changes;
  }
}

export default new TaskService();

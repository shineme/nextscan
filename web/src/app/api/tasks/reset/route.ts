import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * POST /api/tasks/reset - 重置所有任务状态为待处理
 */
export async function POST() {
  try {
    // 重置所有任务状态为 pending，清零进度
    const stmt = db.prepare(`
      UPDATE scan_tasks 
      SET status = 'pending', 
          progress = 0, 
          scanned_urls = 0, 
          hits = 0,
          started_at = NULL,
          completed_at = NULL
      WHERE status IN ('completed', 'failed', 'running')
    `);
    const result = stmt.run();

    // 删除所有扫描结果
    db.prepare('DELETE FROM scan_results').run();

    // 重置域名扫描状态
    db.prepare('UPDATE domains SET has_been_scanned = 0').run();

    return NextResponse.json({
      success: true,
      count: result.changes,
      message: `Reset ${result.changes} tasks to pending status`
    });
  } catch (error: any) {
    console.error('Failed to reset tasks:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to reset tasks'
      },
      { status: 500 }
    );
  }
}

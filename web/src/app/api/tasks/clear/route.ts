import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * DELETE /api/tasks/clear - 清空所有任务
 */
export async function DELETE() {
  try {
    // 获取任务数量
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM scan_tasks');
    const { count } = countStmt.get() as { count: number };

    // 删除所有扫描结果
    db.prepare('DELETE FROM scan_results').run();

    // 删除所有任务
    db.prepare('DELETE FROM scan_tasks').run();

    return NextResponse.json({
      success: true,
      count,
      message: `Cleared ${count} tasks`
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to clear tasks'
      },
      { status: 500 }
    );
  }
}

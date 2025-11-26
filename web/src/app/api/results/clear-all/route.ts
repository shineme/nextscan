import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * DELETE /api/results/clear-all - 清空所有扫描结果
 */
export async function DELETE() {
  try {
    // 删除所有扫描结果
    const stmt = db.prepare('DELETE FROM scan_results');
    const result = stmt.run();

    // 重置所有任务的 hits 计数
    const resetHitsStmt = db.prepare('UPDATE scan_tasks SET hits = 0');
    resetHitsStmt.run();

    return NextResponse.json({
      success: true,
      deletedCount: result.changes,
      message: `Cleared ${result.changes} scan results`
    });
  } catch (error: any) {
    console.error('Failed to clear scan results:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to clear scan results'
      },
      { status: 500 }
    );
  }
}

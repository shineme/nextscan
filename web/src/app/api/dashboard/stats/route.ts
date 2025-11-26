import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET /api/dashboard/stats - 获取Dashboard统计数据
 */
export async function GET() {
  try {
    // 总域名数
    const totalDomainsStmt = db.prepare('SELECT COUNT(*) as count FROM domains');
    const totalDomains = (totalDomainsStmt.get() as { count: number }).count;

    // 今日新增域名数（last_seen_in_csv_at是今天的）
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayNewStmt = db.prepare(`
      SELECT COUNT(*) as count FROM domains 
      WHERE datetime(last_seen_in_csv_at) >= datetime(?)
    `);
    const todayNew = (todayNewStmt.get(todayStart.toISOString()) as { count: number }).count;

    // 活跃任务数（running状态）
    const activeTasksStmt = db.prepare(`
      SELECT COUNT(*) as count FROM scan_tasks WHERE status = 'running'
    `);
    const activeTasks = (activeTasksStmt.get() as { count: number }).count;

    // 风险发现数（status=200的结果数）
    const hitsStmt = db.prepare(`
      SELECT COUNT(*) as count FROM scan_results WHERE status = 200
    `);
    const totalHits = (hitsStmt.get() as { count: number }).count;

    // 过去7天的扫描趋势
    const trendStmt = db.prepare(`
      SELECT 
        DATE(scanned_at) as date,
        COUNT(*) as scans,
        SUM(CASE WHEN status = 200 THEN 1 ELSE 0 END) as hits
      FROM scan_results
      WHERE datetime(scanned_at) >= datetime('now', '-7 days')
      GROUP BY DATE(scanned_at)
      ORDER BY date ASC
    `);
    const trendData = trendStmt.all() as Array<{ date: string; scans: number; hits: number }>;

    // 状态码分布
    const statusDistStmt = db.prepare(`
      SELECT 
        CASE 
          WHEN status = 200 THEN '200 OK'
          WHEN status = 403 THEN '403 Forbidden'
          WHEN status = 404 THEN '404 Not Found'
          WHEN status = -1 THEN 'Timeout/Error'
          ELSE 'Other'
        END as name,
        COUNT(*) as value
      FROM scan_results
      GROUP BY name
      ORDER BY value DESC
    `);
    const statusDist = statusDistStmt.all() as Array<{ name: string; value: number }>;

    // 最近的任务列表
    const recentTasksStmt = db.prepare(`
      SELECT id, name, target, status, progress, total_urls, scanned_urls, hits, created_at
      FROM scan_tasks
      ORDER BY created_at DESC
      LIMIT 5
    `);
    const recentTasks = recentTasksStmt.all();

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalDomains,
          todayNew,
          activeTasks,
          totalHits
        },
        trend: trendData,
        statusDistribution: statusDist,
        recentTasks
      }
    });
  } catch (error: any) {
    console.error('Failed to fetch dashboard stats:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to fetch stats'
      },
      { status: 500 }
    );
  }
}

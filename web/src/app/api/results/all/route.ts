import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET /api/results/all - 查询所有任务的结果
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = `
      SELECT sr.*, st.name as task_name 
      FROM scan_results sr 
      LEFT JOIN scan_tasks st ON sr.task_id = st.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      query += ' AND sr.status = ?';
      params.push(parseInt(status));
    }

    if (search) {
      query += ' AND (sr.url LIKE ? OR sr.domain LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // 计算总数
    const countQuery = query.replace(
      'SELECT sr.*, st.name as task_name FROM scan_results sr LEFT JOIN scan_tasks st ON sr.task_id = st.id',
      'SELECT COUNT(*) as count FROM scan_results sr LEFT JOIN scan_tasks st ON sr.task_id = st.id'
    );
    const countStmt = db.prepare(countQuery);
    const totalResult = countStmt.get(...params) as { count: number } | undefined;
    const total = totalResult?.count || 0;

    // 查询结果
    query += ' ORDER BY sr.scanned_at DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const results = stmt.all(...params);

    return NextResponse.json({
      success: true,
      data: {
        results,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('Failed to fetch all results:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to fetch results'
      },
      { status: 500 }
    );
  }
}

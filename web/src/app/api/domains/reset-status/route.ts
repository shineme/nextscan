import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * POST /api/domains/reset-status - 重置所有域名的扫描状态
 */
export async function POST() {
  try {
    // 重置所有域名的扫描状态
    const stmt = db.prepare('UPDATE domains SET has_been_scanned = 0');
    const result = stmt.run();

    return NextResponse.json({
      success: true,
      count: result.changes,
      message: `Reset scan status for ${result.changes} domains`
    });
  } catch (error: any) {
    console.error('Failed to reset domain status:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to reset domain status'
      },
      { status: 500 }
    );
  }
}

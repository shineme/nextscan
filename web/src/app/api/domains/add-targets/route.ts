import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * POST /api/domains/add-targets - 手动添加扫描目标
 */
export async function POST(request: NextRequest) {
  try {
    const { targets } = await request.json();

    if (!Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid targets array'
        },
        { status: 400 }
      );
    }

    let added = 0;
    let skipped = 0;

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO domains (domain, rank, first_seen_at, last_seen_in_csv_at, has_been_scanned)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
    `);

    const checkStmt = db.prepare('SELECT COUNT(*) as count FROM domains WHERE domain = ?');

    const transaction = db.transaction((targets: string[]) => {
      for (const target of targets) {
        // 简单的域名格式验证
        if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(target)) {
          continue; // 跳过无效格式
        }

        // 检查是否已存在
        const existing = checkStmt.get(target) as { count: number };
        if (existing.count > 0) {
          skipped++;
          continue;
        }

        // 插入新域名 (rank设为999999表示手动添加)
        const result = insertStmt.run(target, 999999);
        if (result.changes > 0) {
          added++;
        }
      }
    });

    transaction(targets);

    return NextResponse.json({
      success: true,
      data: {
        added,
        skipped,
        total: targets.length
      },
      message: `Added ${added} new targets, skipped ${skipped} duplicates`
    });
  } catch (error: any) {
    console.error('Failed to add targets:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to add targets'
      },
      { status: 500 }
    );
  }
}

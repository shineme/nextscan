import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * POST /api/domains/add - 添加域名到扫描列表
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { domains } = body;

        if (!domains || typeof domains !== 'string') {
            return NextResponse.json(
                { success: false, message: '请提供域名列表' },
                { status: 400 }
            );
        }

        // 解析域名列表（支持换行、逗号、空格分隔）
        const domainList = domains
            .split(/[\n,\s]+/)
            .map((d: string) => d.trim().toLowerCase())
            .filter((d: string) => d && d.length > 0)
            // 基本域名格式验证
            .filter((d: string) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i.test(d));

        if (domainList.length === 0) {
            return NextResponse.json(
                { success: false, message: '没有有效的域名' },
                { status: 400 }
            );
        }

        // 去重
        const uniqueDomains = [...new Set(domainList)];

        // 获取当前最大 rank
        const maxRankResult = db.prepare('SELECT MAX(rank) as maxRank FROM domains').get() as { maxRank: number | null };
        let currentRank = (maxRankResult?.maxRank || 0) + 1;

        // 插入域名（忽略已存在的）
        const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO domains (domain, rank, has_been_scanned, first_seen_at)
            VALUES (?, ?, 0, datetime('now'))
        `);

        let addedCount = 0;
        const insertMany = db.transaction((domains: string[]) => {
            for (const domain of domains) {
                const result = insertStmt.run(domain, currentRank);
                if (result.changes > 0) {
                    addedCount++;
                    currentRank++;
                }
            }
        });

        insertMany(uniqueDomains);

        return NextResponse.json({
            success: true,
            message: `成功添加 ${addedCount} 个域名`,
            count: addedCount,
            total: uniqueDomains.length,
            skipped: uniqueDomains.length - addedCount
        });

    } catch (error: any) {
        console.error('Add domains error:', error);
        return NextResponse.json(
            { success: false, message: error.message || '添加域名失败' },
            { status: 500 }
        );
    }
}

import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * DELETE /api/templates/clear-all - 清空所有模板
 */
export async function DELETE() {
    try {
        // 先获取总数
        const countResult = db.prepare('SELECT COUNT(*) as count FROM path_templates').get() as { count: number };
        const totalCount = countResult?.count || 0;

        // 直接删除所有模板
        const result = db.prepare('DELETE FROM path_templates').run();

        return NextResponse.json({
            success: true,
            message: `成功删除 ${result.changes} 个模板`,
            deletedCount: result.changes,
            totalCount
        });
    } catch (error: any) {
        console.error('Clear all templates error:', error);
        return NextResponse.json(
            { success: false, message: error.message || '清空模板失败' },
            { status: 500 }
        );
    }
}

import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const search = searchParams.get('search') || '';
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM domains';
        let countQuery = 'SELECT COUNT(*) as total FROM domains';
        const params: any[] = [];

        if (search) {
            query += ' WHERE domain LIKE ?';
            countQuery += ' WHERE domain LIKE ?';
            params.push(`%${search}%`);
        }

        query += ' ORDER BY rank ASC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const stmt = db.prepare(query);
        // Note: better-sqlite3 params binding for LIMIT/OFFSET needs to be at the end
        // But if we have search param, it comes first.
        // The params array order must match the ? placeholders.

        const domains = stmt.all(...params);

        const countStmt = db.prepare(countQuery);
        const totalResult = countStmt.get(...(search ? [`%${search}%`] : [])) as { total: number };

        return NextResponse.json({
            success: true,
            data: domains,
            pagination: {
                page,
                limit,
                total: totalResult.total,
                totalPages: Math.ceil(totalResult.total / limit)
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

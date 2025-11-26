import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET /api/templates - 获取所有路径模板
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const enabledOnly = searchParams.get('enabled') === 'true';

    let query = 'SELECT * FROM path_templates';
    if (enabledOnly) {
      query += ' WHERE enabled = 1';
    }
    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    const templates = stmt.all();

    return NextResponse.json({
      success: true,
      data: templates
    });
  } catch (error: any) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to fetch templates'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates - 创建新的路径模板
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      template,
      description,
      expected_content_type,
      exclude_content_type = 0,
      min_size,
      max_size,
      enabled = 1
    } = body;

    if (!name || !template) {
      return NextResponse.json(
        {
          success: false,
          message: 'Name and template are required'
        },
        { status: 400 }
      );
    }

    const stmt = db.prepare(`
      INSERT INTO path_templates (name, template, description, expected_content_type, exclude_content_type, min_size, max_size, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name,
      template,
      description || null,
      expected_content_type || null,
      exclude_content_type,
      min_size || 0,
      max_size || null,
      enabled
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        name,
        template
      }
    });
  } catch (error: any) {
    console.error('Failed to create template:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to create template'
      },
      { status: 500 }
    );
  }
}

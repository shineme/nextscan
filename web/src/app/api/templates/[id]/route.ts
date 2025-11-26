import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * PUT /api/templates/[id] - 更新路径模板
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid template ID'
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      name,
      template,
      description,
      expected_content_type,
      exclude_content_type,
      min_size,
      max_size,
      enabled
    } = body;

    const stmt = db.prepare(`
      UPDATE path_templates
      SET name = ?,
          template = ?,
          description = ?,
          expected_content_type = ?,
          exclude_content_type = ?,
          min_size = ?,
          max_size = ?,
          enabled = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(
      name,
      template,
      description || null,
      expected_content_type || null,
      exclude_content_type !== undefined ? exclude_content_type : 0,
      min_size || 0,
      max_size || null,
      enabled !== undefined ? enabled : 1,
      templateId
    );

    if (result.changes === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Template not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template updated successfully'
    });
  } catch (error: any) {
    console.error('Failed to update template:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to update template'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/[id] - 删除路径模板
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid template ID'
        },
        { status: 400 }
      );
    }

    const stmt = db.prepare('DELETE FROM path_templates WHERE id = ?');
    const result = stmt.run(templateId);

    if (result.changes === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Template not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error: any) {
    console.error('Failed to delete template:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to delete template'
      },
      { status: 500 }
    );
  }
}

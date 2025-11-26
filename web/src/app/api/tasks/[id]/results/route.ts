import { NextRequest, NextResponse } from 'next/server';
import resultRepository from '@/lib/result-repository';

/**
 * GET /api/tasks/[id]/results - 查询任务结果
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taskId = parseInt(id);
    
    if (isNaN(taskId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid task ID'
        },
        { status: 400 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const filters = {
      status: status ? parseInt(status) : undefined,
      search: search || undefined,
      page,
      limit
    };
    
    const results = resultRepository.getTaskResults(taskId, filters);
    const total = resultRepository.countTaskResults(taskId, filters);
    
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
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to fetch results'
      },
      { status: 500 }
    );
  }
}

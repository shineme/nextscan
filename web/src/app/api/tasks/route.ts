import { NextRequest, NextResponse } from 'next/server';
import taskService from '@/lib/task-service';

/**
 * POST /api/tasks - 创建新任务
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { name, target, urlTemplate, concurrency } = body;
    
    // 创建任务
    const task = taskService.createTask({
      name,
      target,
      url_template: urlTemplate,
      concurrency
    });
    
    return NextResponse.json({
      success: true,
      data: task,
      message: 'Task created successfully'
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to create task'
      },
      { status: 400 }
    );
  }
}

/**
 * GET /api/tasks - 查询任务列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const result = taskService.listTasks({
      status,
      page,
      limit
    });
    
    return NextResponse.json({
      success: true,
      data: {
        tasks: result.tasks,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit)
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to fetch tasks'
      },
      { status: 500 }
    );
  }
}

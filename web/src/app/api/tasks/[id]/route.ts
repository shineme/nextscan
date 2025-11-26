import { NextRequest, NextResponse } from 'next/server';
import taskService from '@/lib/task-service';

/**
 * GET /api/tasks/[id] - 查询任务详情
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
    
    const task = taskService.getTaskDetail(taskId);
    
    if (!task) {
      return NextResponse.json(
        {
          success: false,
          message: 'Task not found'
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: task
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to fetch task'
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import taskService from '@/lib/task-service';
import scannerService from '@/lib/scanner-service';

/**
 * POST /api/tasks/[id]/start - 启动任务执行
 */
export async function POST(
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
    
    const task = taskService.getTask(taskId);
    
    if (!task) {
      return NextResponse.json(
        {
          success: false,
          message: 'Task not found'
        },
        { status: 404 }
      );
    }
    
    if (task.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          message: `Task is not in pending status (current: ${task.status})`
        },
        { status: 400 }
      );
    }
    
    // 使用setImmediate确保在下一个事件循环中执行，完全不阻塞响应
    // manualStart: true 表示手动启动，跳过自动化检查
    setImmediate(() => {
      scannerService.executeScan(taskId, true).catch(error => {
        console.error(`Task ${taskId} execution failed:`, error);
      });
    });
    
    return NextResponse.json({
      success: true,
      data: {
        taskId,
        status: 'starting'
      },
      message: 'Task started successfully'
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to start task'
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { workerManager } from '@/lib/worker-manager';

/**
 * POST /api/workers/delete
 * Delete a worker from the pool
 */
export async function POST(request: Request) {
  try {
    // Check if request has a body
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { success: false, message: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    // Parse request body with error handling
    let body;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { success: false, message: 'Request body is empty' },
          { status: 400 }
        );
      }
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('[API] JSON parse error:', parseError);
      return NextResponse.json(
        { success: false, message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { workerId } = body;

    if (!workerId) {
      return NextResponse.json(
        { success: false, message: 'Worker ID is required' },
        { status: 400 }
      );
    }

    // Remove worker from pool
    workerManager.removeWorker(workerId);

    console.log(`[API] Deleted worker: ${workerId}`);

    return NextResponse.json({
      success: true,
      message: 'Worker deleted successfully'
    });
  } catch (error: any) {
    console.error('[API] Failed to delete worker:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

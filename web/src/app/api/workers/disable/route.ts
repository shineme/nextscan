import { NextResponse } from 'next/server';
import { workerManager } from '@/lib/worker-manager';

/**
 * POST /api/workers/disable
 * Temporarily disable a worker
 */
export async function POST(request: Request) {
  try {
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

    // Disable the worker
    workerManager.disableWorker(workerId);

    console.log(`[API] Disabled worker: ${workerId}`);

    return NextResponse.json({
      success: true,
      message: 'Worker disabled successfully'
    });
  } catch (error: any) {
    console.error('[API] Failed to disable worker:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

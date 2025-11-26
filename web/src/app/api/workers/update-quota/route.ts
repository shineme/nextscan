import { NextResponse } from 'next/server';
import { workerManager } from '@/lib/worker-manager';

/**
 * POST /api/workers/update-quota
 * Update worker's daily quota
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workerId, dailyQuota } = body;

    if (!workerId) {
      return NextResponse.json(
        { success: false, message: 'Worker ID is required' },
        { status: 400 }
      );
    }

    if (!dailyQuota || dailyQuota < 1000) {
      return NextResponse.json(
        { success: false, message: 'Daily quota must be at least 1000' },
        { status: 400 }
      );
    }

    // Update the worker's quota
    workerManager.updateWorkerQuota(workerId, dailyQuota);

    console.log(`[API] Updated worker ${workerId} quota to ${dailyQuota}`);

    return NextResponse.json({
      success: true,
      message: 'Worker quota updated successfully'
    });
  } catch (error: any) {
    console.error('[API] Failed to update worker quota:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

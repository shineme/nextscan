import { NextResponse } from 'next/server';
import { workerManager } from '@/lib/worker-manager';

/**
 * POST /api/workers/reset
 * Manually reset a Worker's quota
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workerId } = body;

    if (!workerId) {
      return NextResponse.json(
        { success: false, message: 'Worker ID is required' },
        { status: 400 }
      );
    }

    // Reset quota for specific worker
    workerManager.resetWorkerQuota(workerId);

    console.log(`[API] Manually reset quota for worker ${workerId}`);

    return NextResponse.json({
      success: true,
      message: 'Worker quota reset successfully'
    });
  } catch (error: any) {
    console.error('[API] Failed to reset worker quota:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

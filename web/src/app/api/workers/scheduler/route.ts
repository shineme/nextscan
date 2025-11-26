import { NextResponse } from 'next/server';
import { quotaScheduler } from '@/lib/quota-scheduler';

/**
 * GET /api/workers/scheduler
 * Get quota scheduler status
 */
export async function GET() {
  try {
    const status = quotaScheduler.getStatus();

    return NextResponse.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    console.error('[API] Failed to get scheduler status:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workers/scheduler
 * Manually trigger quota reset for all workers
 */
export async function POST() {
  try {
    quotaScheduler.manualReset();

    console.log('[API] Manually triggered quota reset for all workers');

    return NextResponse.json({
      success: true,
      message: 'Quota reset triggered for all workers'
    });
  } catch (error: any) {
    console.error('[API] Failed to trigger quota reset:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

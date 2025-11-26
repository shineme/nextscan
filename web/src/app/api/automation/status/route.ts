import { NextResponse } from 'next/server';
import { automationScheduler } from '@/lib/automation-scheduler';

/**
 * GET /api/automation/status
 * Get automation scheduler status
 */
export async function GET() {
  try {
    const status = automationScheduler.getStatus();

    return NextResponse.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    console.error('[API] Failed to get automation status:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

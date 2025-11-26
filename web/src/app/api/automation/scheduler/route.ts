/**
 * Automation Scheduler Control API
 * GET /api/automation/scheduler - Get scheduler status
 * POST /api/automation/scheduler - Start/stop scheduler
 */

import { NextRequest, NextResponse } from 'next/server';
import { automationScheduler } from '@/lib/automation-scheduler';
import logger from '@/lib/logger-service';

export async function GET() {
  try {
    const status = automationScheduler.getStatus();

    return NextResponse.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Failed to get scheduler status:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to get scheduler status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body; // 'start' or 'stop'

    if (!action || !['start', 'stop'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Invalid action. Must be "start" or "stop"' },
        { status: 400 }
      );
    }

    if (action === 'start') {
      automationScheduler.start();
      logger.info('automation', 'Automation scheduler started');
    } else {
      automationScheduler.stop();
      logger.info('automation', 'Automation scheduler stopped');
    }

    const status = automationScheduler.getStatus();

    return NextResponse.json({
      success: true,
      message: `Scheduler ${action}ed successfully`,
      data: status
    });
  } catch (error) {
    console.error('Failed to control scheduler:', error);
    logger.error('automation', 'Failed to control scheduler', {
      details: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json(
      { success: false, message: 'Failed to control scheduler' },
      { status: 500 }
    );
  }
}

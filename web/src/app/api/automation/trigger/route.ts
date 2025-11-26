/**
 * Manual Automation Trigger API
 * POST /api/automation/trigger - Manually trigger automation tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { automationScheduler } from '@/lib/automation-scheduler';
import { configService } from '@/lib/config-service';
import logger from '@/lib/logger-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body; // 'incremental' or 'rescan'

    if (!type || !['incremental', 'rescan'].includes(type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid type. Must be "incremental" or "rescan"' },
        { status: 400 }
      );
    }

    logger.info('automation', `🎯 Manual trigger requested: ${type}`);

    // Reset the last run time to force immediate execution
    if (type === 'incremental') {
      configService.set('automation_last_incremental', '');
      logger.info('automation', '🔄 Resetting incremental scan timer...');
    } else {
      configService.set('automation_last_rescan', '');
      logger.info('automation', '🔄 Resetting full rescan timer...');
    }

    // Force stop and restart scheduler to trigger immediate check
    logger.info('automation', '⏹️ Stopping scheduler...');
    automationScheduler.stop();
    
    logger.info('automation', '▶️ Restarting scheduler...');
    automationScheduler.start();

    return NextResponse.json({
      success: true,
      message: `${type} scan triggered successfully`,
      type
    });
  } catch (error) {
    console.error('Failed to trigger automation:', error);
    logger.error('automation', 'Failed to trigger automation', {
      details: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json(
      { success: false, message: 'Failed to trigger automation' },
      { status: 500 }
    );
  }
}

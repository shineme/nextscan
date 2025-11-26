import { NextResponse } from 'next/server';
import { automationScheduler } from '@/lib/automation-scheduler';

/**
 * POST /api/automation/toggle
 * Start or stop automation scheduler
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

    const { action } = body;

    if (!action || !['start', 'stop'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Action must be "start" or "stop"' },
        { status: 400 }
      );
    }

    if (action === 'start') {
      automationScheduler.start();
      console.log('[API] Started automation scheduler');
    } else {
      automationScheduler.stop();
      console.log('[API] Stopped automation scheduler');
    }

    return NextResponse.json({
      success: true,
      message: `Automation scheduler ${action}ed successfully`
    });
  } catch (error: any) {
    console.error('[API] Failed to toggle automation:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

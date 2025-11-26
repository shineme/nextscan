import { NextResponse } from 'next/server';
import { automationScheduler } from '@/lib/automation-scheduler';

/**
 * POST /api/automation/config
 * Update automation configuration
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

    const { incrementalEnabled, rescanEnabled } = body;

    // Update configuration
    automationScheduler.updateConfig({
      incrementalEnabled,
      rescanEnabled,
    });

    console.log('[API] Updated automation config:', { incrementalEnabled, rescanEnabled });

    return NextResponse.json({
      success: true,
      message: 'Automation configuration updated successfully'
    });
  } catch (error: any) {
    console.error('[API] Failed to update automation config:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

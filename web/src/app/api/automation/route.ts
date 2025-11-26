import { NextResponse } from 'next/server';
import { automationController } from '@/lib/automation-controller';

/**
 * GET /api/automation
 * Get automation status
 */
export async function GET() {
  try {
    const status = automationController.getStatus();

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('[API] Failed to get automation status:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/automation
 * Control automation (enable/disable/toggle)
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

    if (!action || !['enable', 'disable', 'toggle'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Invalid action. Must be: enable, disable, or toggle' },
        { status: 400 }
      );
    }

    let newState: boolean;

    switch (action) {
      case 'enable':
        automationController.enable();
        newState = true;
        break;
      case 'disable':
        automationController.disable();
        newState = false;
        break;
      case 'toggle':
        newState = automationController.toggle();
        break;
      default:
        throw new Error('Invalid action');
    }

    const status = automationController.getStatus();

    console.log(`[API] Automation ${action}d - new state: ${newState}`);

    return NextResponse.json({
      success: true,
      message: `Automation ${newState ? 'enabled' : 'disabled'}`,
      data: status,
    });
  } catch (error: any) {
    console.error('[API] Failed to control automation:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { initializeApp, isInitialized } from '@/lib/startup';

/**
 * GET /api/init - Initialize application services
 * This endpoint should be called when the application starts
 */
export async function GET() {
  try {
    if (isInitialized()) {
      return NextResponse.json({
        success: true,
        message: 'Application already initialized'
      });
    }

    initializeApp();

    return NextResponse.json({
      success: true,
      message: 'Application initialized successfully'
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Initialization failed'
      },
      { status: 500 }
    );
  }
}

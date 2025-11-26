import { NextResponse } from 'next/server';
import { workerManager } from '@/lib/worker-manager';

/**
 * POST /api/workers/add
 * Add a new worker to the pool
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, dailyQuota = 100000 } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, message: 'Worker URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    if (!url.startsWith('https://')) {
      return NextResponse.json(
        { success: false, message: 'Worker URL must use HTTPS' },
        { status: 400 }
      );
    }

    // Add worker to pool
    workerManager.addWorker(url, dailyQuota);

    console.log(`[API] Added worker: ${url} with quota ${dailyQuota}`);

    return NextResponse.json({
      success: true,
      message: 'Worker added successfully'
    });
  } catch (error: any) {
    console.error('[API] Failed to add worker:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

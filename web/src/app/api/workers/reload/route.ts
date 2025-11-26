import { NextResponse } from 'next/server';
import { workerManager } from '@/lib/worker-manager';
import scannerService from '@/lib/scanner-service';

/**
 * POST /api/workers/reload
 * Reload Worker configuration without restart
 */
export async function POST() {
  try {
    // Reload worker manager
    workerManager.reload();
    
    // Also reload scanner service worker configuration
    (scannerService as any).reloadWorkerConfiguration();

    console.log('[API] Worker configuration reloaded');

    return NextResponse.json({
      success: true,
      message: 'Worker configuration reloaded successfully'
    });
  } catch (error: any) {
    console.error('[API] Failed to reload worker configuration:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

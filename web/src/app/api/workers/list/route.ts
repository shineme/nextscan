import { NextResponse } from 'next/server';
import { workerManager } from '@/lib/worker-manager';

/**
 * GET /api/workers/list
 * Get list of all workers with detailed information
 */
export async function GET() {
  try {
    const workers = workerManager.getWorkers();

    return NextResponse.json({
      success: true,
      data: workers.map((w: any) => ({
        id: w.id,
        url: w.url,
        enabled: !w.permanentlyDisabled, // 如果永久禁用则视为不启用
        healthy: w.healthy,
        dailyQuota: w.dailyQuota,
        dailyUsage: w.dailyUsage,
        quotaResetAt: w.quotaResetAt.toISOString(),
        errorCount: w.errorCount,
        successCount: w.successCount,
        permanentlyDisabled: w.permanentlyDisabled,
        disabledReason: w.disabledReason,
        lastCheck: w.lastCheck
      }))
    });
  } catch (error: any) {
    console.error('[API] Failed to list workers:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

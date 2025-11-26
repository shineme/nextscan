import { NextResponse } from 'next/server';
import { workerManager } from '@/lib/worker-manager';

/**
 * GET /api/workers/status
 * Get Worker pool status and statistics
 */
export async function GET() {
  try {
    // Get workers and stats from worker manager
    const workers = workerManager.getWorkers();
    const stats = workerManager.getStats();

    // Calculate aggregate stats
    const totalRequests = workers.reduce((sum: number, w: any) => sum + w.successCount + w.errorCount, 0);
    const totalSuccesses = workers.reduce((sum: number, w: any) => sum + w.successCount, 0);
    const totalFailures = workers.reduce((sum: number, w: any) => sum + w.errorCount, 0);

    return NextResponse.json({
      success: true,
      data: {
        workers: workers.map((w: any) => ({
          id: w.id,
          url: w.url,
          healthy: w.healthy,
          dailyUsage: w.dailyUsage,
          dailyQuota: w.dailyQuota,
          permanentlyDisabled: w.permanentlyDisabled,
          disabledReason: w.disabledReason,
          errorCount: w.errorCount,
          successCount: w.successCount,
          quotaResetAt: w.quotaResetAt.toISOString(),
        })),
        stats: {
          totalWorkers: stats.totalWorkers,
          healthyWorkers: stats.healthyWorkers,
          unhealthyWorkers: stats.unhealthyWorkers,
          disabledWorkers: stats.disabledWorkers,
          totalRequests,
          totalSuccesses,
          totalFailures,
        }
      }
    });
  } catch (error: any) {
    console.error('[API] Failed to get worker status:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

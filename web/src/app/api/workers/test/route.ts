import { NextResponse } from 'next/server';
import { WorkerClient } from '@/lib/worker-client';

/**
 * POST /api/workers/test
 * Test a Worker endpoint
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workerUrl } = body;

    if (!workerUrl) {
      return NextResponse.json(
        { success: false, message: 'Worker URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(workerUrl);
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid Worker URL format' },
        { status: 400 }
      );
    }

    // Test the worker endpoint
    const workerClient = new WorkerClient(10000);
    
    console.log(`[API] Testing worker endpoint: ${workerUrl}`);
    
    const startTime = Date.now();
    const healthy = await workerClient.healthCheck(workerUrl);
    const responseTime = Date.now() - startTime;

    if (healthy) {
      return NextResponse.json({
        success: true,
        data: {
          healthy: true,
          responseTime,
          message: 'Worker is healthy and responding'
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        data: {
          healthy: false,
          responseTime,
          message: 'Worker health check failed'
        }
      });
    }
  } catch (error: any) {
    console.error('[API] Worker test failed:', error);
    
    // Check if error indicates permanent block
    const workerClient = new WorkerClient(10000);
    const isBlocked = workerClient.isWorkerBlocked(error);
    const blockReason = isBlocked ? workerClient.getBlockReason(error) : null;

    return NextResponse.json({
      success: false,
      data: {
        healthy: false,
        error: error.message,
        blocked: isBlocked,
        blockReason,
        message: isBlocked 
          ? `Worker is blocked: ${blockReason}` 
          : `Worker test failed: ${error.message}`
      }
    });
  }
}

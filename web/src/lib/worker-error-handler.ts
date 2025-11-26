/**
 * Worker Error Handler
 * Centralized error handling for Worker-related operations
 */

export class WorkerError extends Error {
  constructor(
    message: string,
    public code: string,
    public workerId?: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

export class WorkerErrorHandler {
  /**
   * Handle Worker URL validation errors
   */
  static handleInvalidUrl(url: string): WorkerError {
    console.error(`[WorkerError] Invalid Worker URL: ${url}`);
    return new WorkerError(
      `Invalid Worker URL: ${url}. Worker URLs must use HTTPS protocol.`,
      'INVALID_URL',
      undefined,
      false
    );
  }

  /**
   * Handle Worker unavailable errors
   */
  static handleWorkerUnavailable(workerId: string): WorkerError {
    console.warn(`[WorkerError] Worker unavailable: ${workerId}`);
    return new WorkerError(
      `Worker ${workerId} is currently unavailable`,
      'WORKER_UNAVAILABLE',
      workerId,
      true
    );
  }

  /**
   * Handle Worker rate limit errors
   */
  static handleRateLimit(workerId: string, retryAfter?: number): WorkerError {
    const message = retryAfter
      ? `Worker ${workerId} is rate limited. Retry after ${retryAfter}ms`
      : `Worker ${workerId} is rate limited`;
    
    console.warn(`[WorkerError] ${message}`);
    return new WorkerError(
      message,
      'RATE_LIMITED',
      workerId,
      true
    );
  }

  /**
   * Handle Worker blocked errors
   */
  static handleWorkerBlocked(workerId: string, reason: string): WorkerError {
    console.error(`[WorkerError] Worker blocked: ${workerId} - ${reason}`);
    return new WorkerError(
      `Worker ${workerId} is permanently blocked: ${reason}`,
      'WORKER_BLOCKED',
      workerId,
      false
    );
  }

  /**
   * Handle network timeout errors
   */
  static handleTimeout(workerId: string, timeout: number): WorkerError {
    console.warn(`[WorkerError] Worker timeout: ${workerId} (${timeout}ms)`);
    return new WorkerError(
      `Worker ${workerId} request timed out after ${timeout}ms`,
      'TIMEOUT',
      workerId,
      true
    );
  }

  /**
   * Handle invalid Worker response errors
   */
  static handleInvalidResponse(workerId: string, details?: string): WorkerError {
    const message = details
      ? `Worker ${workerId} returned invalid response: ${details}`
      : `Worker ${workerId} returned invalid response`;
    
    console.error(`[WorkerError] ${message}`);
    return new WorkerError(
      message,
      'INVALID_RESPONSE',
      workerId,
      true
    );
  }

  /**
   * Handle empty Worker pool errors
   */
  static handleEmptyPool(): WorkerError {
    console.error('[WorkerError] No healthy workers available in pool');
    return new WorkerError(
      'No healthy workers available. All workers are either disabled, unhealthy, or quota exhausted.',
      'EMPTY_POOL',
      undefined,
      true
    );
  }

  /**
   * Handle quota exhausted errors
   */
  static handleQuotaExhausted(workerId: string, quota: number): WorkerError {
    console.warn(`[WorkerError] Worker quota exhausted: ${workerId} (${quota} requests)`);
    return new WorkerError(
      `Worker ${workerId} has exhausted its daily quota of ${quota} requests`,
      'QUOTA_EXHAUSTED',
      workerId,
      true
    );
  }

  /**
   * Handle configuration errors
   */
  static handleConfigError(message: string): WorkerError {
    console.error(`[WorkerError] Configuration error: ${message}`);
    return new WorkerError(
      `Worker configuration error: ${message}`,
      'CONFIG_ERROR',
      undefined,
      false
    );
  }

  /**
   * Handle batch partial failure
   */
  static handlePartialFailure(
    workerId: string,
    totalUrls: number,
    failedUrls: number
  ): WorkerError {
    console.warn(
      `[WorkerError] Partial batch failure: ${workerId} - ${failedUrls}/${totalUrls} URLs failed`
    );
    return new WorkerError(
      `Worker ${workerId} batch partially failed: ${failedUrls} out of ${totalUrls} URLs failed`,
      'PARTIAL_FAILURE',
      workerId,
      true
    );
  }

  /**
   * Determine if an error is recoverable
   */
  static isRecoverable(error: Error): boolean {
    if (error instanceof WorkerError) {
      return error.recoverable;
    }
    
    // Network errors are generally recoverable
    if (error.message.includes('ECONNREFUSED') || 
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND')) {
      return true;
    }
    
    // Other errors are not recoverable by default
    return false;
  }

  /**
   * Get error code from error
   */
  static getErrorCode(error: Error): string {
    if (error instanceof WorkerError) {
      return error.code;
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * Format error for logging
   */
  static formatError(error: Error): string {
    if (error instanceof WorkerError) {
      return `[${error.code}] ${error.message}${error.workerId ? ` (Worker: ${error.workerId})` : ''}`;
    }
    return `[UNKNOWN] ${error.message}`;
  }
}

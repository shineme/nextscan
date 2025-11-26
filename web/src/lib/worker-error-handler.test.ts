import { describe, it, expect } from 'vitest';
import { WorkerError, WorkerErrorHandler } from './worker-error-handler';

describe('WorkerErrorHandler', () => {
  describe('Error Creation', () => {
    it('should create invalid URL error', () => {
      const error = WorkerErrorHandler.handleInvalidUrl('http://insecure.com');
      
      expect(error).toBeInstanceOf(WorkerError);
      expect(error.code).toBe('INVALID_URL');
      expect(error.recoverable).toBe(false);
      expect(error.message).toContain('HTTPS');
    });

    it('should create worker unavailable error', () => {
      const error = WorkerErrorHandler.handleWorkerUnavailable('worker-1');
      
      expect(error).toBeInstanceOf(WorkerError);
      expect(error.code).toBe('WORKER_UNAVAILABLE');
      expect(error.workerId).toBe('worker-1');
      expect(error.recoverable).toBe(true);
    });

    it('should create rate limit error', () => {
      const error = WorkerErrorHandler.handleRateLimit('worker-1', 60000);
      
      expect(error).toBeInstanceOf(WorkerError);
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.workerId).toBe('worker-1');
      expect(error.recoverable).toBe(true);
      expect(error.message).toContain('60000');
    });

    it('should create worker blocked error', () => {
      const error = WorkerErrorHandler.handleWorkerBlocked('worker-1', 'Cloudflare block');
      
      expect(error).toBeInstanceOf(WorkerError);
      expect(error.code).toBe('WORKER_BLOCKED');
      expect(error.workerId).toBe('worker-1');
      expect(error.recoverable).toBe(false);
      expect(error.message).toContain('Cloudflare block');
    });

    it('should create timeout error', () => {
      const error = WorkerErrorHandler.handleTimeout('worker-1', 10000);
      
      expect(error).toBeInstanceOf(WorkerError);
      expect(error.code).toBe('TIMEOUT');
      expect(error.workerId).toBe('worker-1');
      expect(error.recoverable).toBe(true);
      expect(error.message).toContain('10000ms');
    });

    it('should create invalid response error', () => {
      const error = WorkerErrorHandler.handleInvalidResponse('worker-1', 'Missing status field');
      
      expect(error).toBeInstanceOf(WorkerError);
      expect(error.code).toBe('INVALID_RESPONSE');
      expect(error.workerId).toBe('worker-1');
      expect(error.recoverable).toBe(true);
      expect(error.message).toContain('Missing status field');
    });

    it('should create empty pool error', () => {
      const error = WorkerErrorHandler.handleEmptyPool();
      
      expect(error).toBeInstanceOf(WorkerError);
      expect(error.code).toBe('EMPTY_POOL');
      expect(error.recoverable).toBe(true);
      expect(error.message).toContain('No healthy workers');
    });

    it('should create quota exhausted error', () => {
      const error = WorkerErrorHandler.handleQuotaExhausted('worker-1', 100000);
      
      expect(error).toBeInstanceOf(WorkerError);
      expect(error.code).toBe('QUOTA_EXHAUSTED');
      expect(error.workerId).toBe('worker-1');
      expect(error.recoverable).toBe(true);
      expect(error.message).toContain('100000');
    });

    it('should create config error', () => {
      const error = WorkerErrorHandler.handleConfigError('Invalid batch size');
      
      expect(error).toBeInstanceOf(WorkerError);
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.recoverable).toBe(false);
      expect(error.message).toContain('Invalid batch size');
    });

    it('should create partial failure error', () => {
      const error = WorkerErrorHandler.handlePartialFailure('worker-1', 100, 25);
      
      expect(error).toBeInstanceOf(WorkerError);
      expect(error.code).toBe('PARTIAL_FAILURE');
      expect(error.workerId).toBe('worker-1');
      expect(error.recoverable).toBe(true);
      expect(error.message).toContain('25 out of 100');
    });
  });

  describe('Error Analysis', () => {
    it('should identify recoverable WorkerError', () => {
      const error = new WorkerError('Test', 'TEST', undefined, true);
      expect(WorkerErrorHandler.isRecoverable(error)).toBe(true);
    });

    it('should identify non-recoverable WorkerError', () => {
      const error = new WorkerError('Test', 'TEST', undefined, false);
      expect(WorkerErrorHandler.isRecoverable(error)).toBe(false);
    });

    it('should identify recoverable network errors', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      expect(WorkerErrorHandler.isRecoverable(error)).toBe(true);
    });

    it('should identify recoverable timeout errors', () => {
      const error = new Error('ETIMEDOUT: Request timed out');
      expect(WorkerErrorHandler.isRecoverable(error)).toBe(true);
    });

    it('should identify recoverable DNS errors', () => {
      const error = new Error('ENOTFOUND: DNS lookup failed');
      expect(WorkerErrorHandler.isRecoverable(error)).toBe(true);
    });

    it('should identify non-recoverable generic errors', () => {
      const error = new Error('Something went wrong');
      expect(WorkerErrorHandler.isRecoverable(error)).toBe(false);
    });

    it('should get error code from WorkerError', () => {
      const error = new WorkerError('Test', 'TEST_CODE', undefined, true);
      expect(WorkerErrorHandler.getErrorCode(error)).toBe('TEST_CODE');
    });

    it('should get UNKNOWN_ERROR code from generic error', () => {
      const error = new Error('Generic error');
      expect(WorkerErrorHandler.getErrorCode(error)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Error Formatting', () => {
    it('should format WorkerError with worker ID', () => {
      const error = new WorkerError('Test message', 'TEST_CODE', 'worker-1', true);
      const formatted = WorkerErrorHandler.formatError(error);
      
      expect(formatted).toContain('[TEST_CODE]');
      expect(formatted).toContain('Test message');
      expect(formatted).toContain('worker-1');
    });

    it('should format WorkerError without worker ID', () => {
      const error = new WorkerError('Test message', 'TEST_CODE', undefined, true);
      const formatted = WorkerErrorHandler.formatError(error);
      
      expect(formatted).toContain('[TEST_CODE]');
      expect(formatted).toContain('Test message');
      expect(formatted).not.toContain('Worker:');
    });

    it('should format generic error', () => {
      const error = new Error('Generic error message');
      const formatted = WorkerErrorHandler.formatError(error);
      
      expect(formatted).toContain('[UNKNOWN]');
      expect(formatted).toContain('Generic error message');
    });
  });
});

/**
 * Property-Based Tests for Worker Client
 * Feature: worker-failover
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { WorkerClient, WorkerResponse, WorkerResult } from './worker-client';

describe('WorkerClient Property Tests', () => {
  /**
   * Feature: worker-failover, Property 10: Permanent Disable Detection
   * Validates: Requirements 2.6, 2.7, 2.8
   * 
   * For any Worker response containing "There is nothing here yet" or
   * "account has been blocked", the Worker should be immediately and
   * permanently disabled without counting against retry attempts.
   */
  describe('Property 10: Permanent Disable Detection', () => {
    it('should detect "There is nothing here yet" in error messages', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (url) => {
            const client = new WorkerClient();
            
            // Test with Error
            const error = new Error('There is nothing here yet');
            expect(client.isWorkerBlocked(error)).toBe(true);
            expect(client.getBlockReason(error)).toBe('not_deployed');
            
            // Test with lowercase
            const error2 = new Error('there is nothing here yet');
            expect(client.isWorkerBlocked(error2)).toBe(true);
            
            // Test with mixed case
            const error3 = new Error('THERE IS NOTHING HERE YET');
            expect(client.isWorkerBlocked(error3)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect "account has been blocked" in error messages', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (url) => {
            const client = new WorkerClient();
            
            // Test with Error
            const error = new Error('account has been blocked');
            expect(client.isWorkerBlocked(error)).toBe(true);
            expect(client.getBlockReason(error)).toBe('account_blocked');
            
            // Test with lowercase
            const error2 = new Error('ACCOUNT HAS BEEN BLOCKED');
            expect(client.isWorkerBlocked(error2)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect block messages in WorkerResponse', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['https'] }),
          (url) => {
            const client = new WorkerClient();
            
            // Test with error in result
            const response: WorkerResponse = {
              success: false,
              total: 1,
              results: [{
                url,
                method: 'HEAD',
                success: false,
                status: 500,
                error: 'There is nothing here yet',
              }],
              timestamp: new Date().toISOString(),
            };
            
            expect(client.isWorkerBlocked(response)).toBe(true);
            expect(client.getBlockReason(response)).toBe('not_deployed');
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not detect block for normal errors', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => 
            !s.toLowerCase().includes('there is nothing here yet') &&
            !s.toLowerCase().includes('account has been blocked')
          ),
          (errorMessage) => {
            const client = new WorkerClient();
            
            const error = new Error(errorMessage);
            expect(client.isWorkerBlocked(error)).toBe(false);
            expect(client.getBlockReason(error)).toBe(null);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Feature: worker-failover, Property 6: Response Format Compatibility
   * Validates: Requirements 7.1, 7.2
   * 
   * For any Worker response, parsing it to ScanResponse format should
   * preserve the essential fields: url, status, contentType, and size.
   */
  describe('Property 6: Response Format Compatibility', () => {
    it('should preserve essential fields when parsing successful responses', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['https'] }),
          fc.integer({ min: 200, max: 299 }),
          fc.oneof(
            fc.constant('application/json'),
            fc.constant('text/html'),
            fc.constant('application/zip'),
            fc.constant('image/png')
          ),
          fc.integer({ min: 0, max: 10000000 }),
          (url, status, contentType, size) => {
            const client = new WorkerClient();
            
            const workerResult: WorkerResult = {
              url,
              method: 'HEAD',
              success: true,
              status,
              summary: {
                contentType,
                contentLengthBytes: size,
                contentLength: `${size} bytes`,
              },
            };
            
            const scanResponse = client.parseToScanResponse(workerResult);
            
            // Verify all essential fields are preserved
            expect(scanResponse.url).toBe(url);
            expect(scanResponse.status).toBe(status);
            expect(scanResponse.contentType).toBe(contentType);
            expect(scanResponse.size).toBe(size);
            expect(scanResponse.error).toBeUndefined();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle missing optional fields gracefully', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['https'] }),
          fc.integer({ min: 200, max: 599 }),
          (url, status) => {
            const client = new WorkerClient();
            
            // Minimal worker result without summary
            const workerResult: WorkerResult = {
              url,
              method: 'HEAD',
              success: true,
              status,
            };
            
            const scanResponse = client.parseToScanResponse(workerResult);
            
            // Verify required fields are present
            expect(scanResponse.url).toBe(url);
            expect(scanResponse.status).toBe(status);
            
            // Optional fields should be null or 0
            expect(scanResponse.contentType).toBe(null);
            expect(scanResponse.size).toBe(0); // Size defaults to 0 when missing
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include error message for failed requests', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['https'] }),
          fc.integer({ min: 400, max: 599 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (url, status, errorMessage) => {
            const client = new WorkerClient();
            
            const workerResult: WorkerResult = {
              url,
              method: 'HEAD',
              success: false,
              status,
              error: errorMessage,
            };
            
            const scanResponse = client.parseToScanResponse(workerResult);
            
            expect(scanResponse.url).toBe(url);
            expect(scanResponse.status).toBe(status);
            expect(scanResponse.error).toBe(errorMessage);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle all valid HTTP status codes', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['https'] }),
          fc.integer({ min: 100, max: 599 }),
          (url, status) => {
            const client = new WorkerClient();
            
            const workerResult: WorkerResult = {
              url,
              method: 'HEAD',
              success: status >= 200 && status < 300,
              status,
            };
            
            const scanResponse = client.parseToScanResponse(workerResult);
            
            expect(scanResponse.status).toBe(status);
            expect(scanResponse.url).toBe(url);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

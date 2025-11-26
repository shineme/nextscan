/**
 * Property-Based Tests for Automation API
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { GET, POST } from './route';
import { automationController } from '@/lib/automation-controller';
import { configService } from '@/lib/config-service';

describe('Automation API Property Tests', () => {
  // Clean up after each test
  afterEach(() => {
    try {
      configService.set('automation_enabled', 'true');
      const stmt = require('@/lib/db').default.prepare('DELETE FROM settings WHERE key = ?');
      stmt.run('automation_last_paused');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Property 15: Status includes enabled field', () => {
    it('should always include enabled boolean field in status response', async () => {
      // Feature: system-control, Property 15: Status includes enabled field
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (initialState) => {
          // Set initial state
          if (initialState) {
            automationController.enable();
          } else {
            automationController.disable();
          }

          // Call GET endpoint
          const response = await GET();
          const data = await response.json();

          // Verify response structure
          expect(data).toHaveProperty('success');
          expect(data.success).toBe(true);
          expect(data).toHaveProperty('data');
          expect(data.data).toHaveProperty('enabled');
          expect(typeof data.data.enabled).toBe('boolean');
          expect(data.data.enabled).toBe(initialState);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 16: Status includes last pause timestamp', () => {
    it('should include lastPaused field after disabling automation', async () => {
      // Feature: system-control, Property 16: Status includes last pause timestamp
      // Disable automation
      automationController.disable();

      // Call GET endpoint
      const response = await GET();
      const data = await response.json();

      // Verify lastPaused is present
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('lastPaused');
      expect(data.data.lastPaused).toBeDefined();
      expect(typeof data.data.lastPaused).toBe('string');

      // Verify it's a valid ISO timestamp
      const timestamp = new Date(data.data.lastPaused);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });

    it('should maintain lastPaused across multiple status checks', async () => {
      // Feature: system-control, Property 16: Status includes last pause timestamp
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (numChecks) => {
          // Disable to set lastPaused
          automationController.disable();

          let firstLastPaused: string | undefined;

          // Check status multiple times
          for (let i = 0; i < numChecks; i++) {
            const response = await GET();
            const data = await response.json();

            expect(data.data).toHaveProperty('lastPaused');

            if (i === 0) {
              firstLastPaused = data.data.lastPaused;
            } else {
              // Should be the same timestamp
              expect(data.data.lastPaused).toBe(firstLastPaused);
            }
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('API Error Handling Tests', () => {
    it('should return 400 for invalid action parameter', async () => {
      // Feature: system-control, Property: API error handling
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('invalid'),
            fc.constant(''),
            fc.constant('ENABLE'),
            fc.constant('Disable'),
            fc.constant('random')
          ),
          async (invalidAction) => {
            const request = new Request('http://localhost/api/automation', {
              method: 'POST',
              body: JSON.stringify({ action: invalidAction }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.message).toContain('Invalid action');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return 400 for empty request body', async () => {
      // Feature: system-control, Property: API error handling
      const request = new Request('http://localhost/api/automation', {
        method: 'POST',
        body: '',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Request body is empty');
    });

    it('should return 400 for invalid JSON', async () => {
      // Feature: system-control, Property: API error handling
      const request = new Request('http://localhost/api/automation', {
        method: 'POST',
        body: '{invalid json}',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Invalid JSON in request body');
    });
  });

  describe('POST Automation Control Tests', () => {
    it('should enable automation when action is enable', async () => {
      // Start with disabled state
      automationController.disable();

      const request = new Request('http://localhost/api/automation', {
        method: 'POST',
        body: JSON.stringify({ action: 'enable' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('enabled');
      expect(data.data.enabled).toBe(true);
      expect(automationController.isEnabled()).toBe(true);
    });

    it('should disable automation when action is disable', async () => {
      // Start with enabled state
      automationController.enable();

      const request = new Request('http://localhost/api/automation', {
        method: 'POST',
        body: JSON.stringify({ action: 'disable' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('disabled');
      expect(data.data.enabled).toBe(false);
      expect(automationController.isEnabled()).toBe(false);
    });

    it('should toggle automation state', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (initialState) => {
          // Set initial state
          if (initialState) {
            automationController.enable();
          } else {
            automationController.disable();
          }

          const request = new Request('http://localhost/api/automation', {
            method: 'POST',
            body: JSON.stringify({ action: 'toggle' }),
          });

          const response = await POST(request);
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);
          expect(data.data.enabled).toBe(!initialState);
          expect(automationController.isEnabled()).toBe(!initialState);
        }),
        { numRuns: 100 }
      );
    });

    it('should return consistent response format for all actions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('enable', 'disable', 'toggle'),
          async (action) => {
            const request = new Request('http://localhost/api/automation', {
              method: 'POST',
              body: JSON.stringify({ action }),
            });

            const response = await POST(request);
            const data = await response.json();

            // Verify response structure
            expect(data).toHaveProperty('success');
            expect(data).toHaveProperty('message');
            expect(data).toHaveProperty('data');
            expect(data.data).toHaveProperty('enabled');
            expect(typeof data.data.enabled).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

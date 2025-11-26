/**
 * Property-Based Tests for AutomationController
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { automationController } from './automation-controller';
import { configService } from './config-service';

describe('AutomationController Property Tests', () => {
  // Clean up after each test
  afterEach(() => {
    // Reset to default state
    try {
      configService.set('automation_enabled', 'true');
      // Clear last paused timestamp
      const stmt = require('./db').default.prepare('DELETE FROM settings WHERE key = ?');
      stmt.run('automation_last_paused');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Property 6: Toggle changes automation state', () => {
    it('should always invert the automation state when toggled', () => {
      // Feature: system-control, Property 6: Toggle changes automation state
      fc.assert(
        fc.property(fc.boolean(), (initialState) => {
          // Set initial state
          if (initialState) {
            automationController.enable();
          } else {
            automationController.disable();
          }

          // Get state before toggle
          const stateBefore = automationController.isEnabled();

          // Toggle
          const newState = automationController.toggle();

          // Get state after toggle
          const stateAfter = automationController.isEnabled();

          // Verify toggle inverted the state
          expect(stateBefore).not.toBe(stateAfter);
          expect(newState).toBe(stateAfter);
          expect(newState).toBe(!stateBefore);
        }),
        { numRuns: 100 }
      );
    });

    it('should toggle correctly multiple times in sequence', { timeout: 10000 }, () => {
      // Feature: system-control, Property 6: Toggle changes automation state
      fc.assert(
        fc.property(fc.array(fc.constant(null), { minLength: 1, maxLength: 5 }), (toggles) => {
          // Start with a known state
          automationController.enable();
          let expectedState = true;

          // Toggle multiple times
          for (let i = 0; i < toggles.length; i++) {
            const newState = automationController.toggle();
            expectedState = !expectedState;

            expect(newState).toBe(expectedState);
            expect(automationController.isEnabled()).toBe(expectedState);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 10: Automation state persistence', () => {
    it('should persist state changes to configuration storage', () => {
      // Feature: system-control, Property 10: Automation state persistence
      fc.assert(
        fc.property(fc.boolean(), (targetState) => {
          // Set the state
          if (targetState) {
            automationController.enable();
          } else {
            automationController.disable();
          }

          // Read directly from config service
          const persistedValue = configService.get('automation_enabled');
          const persistedState = persistedValue === 'true';

          // Verify persistence
          expect(persistedState).toBe(targetState);

          // Verify controller reads the same state
          expect(automationController.isEnabled()).toBe(targetState);
        }),
        { numRuns: 100 }
      );
    });

    it('should persist last paused timestamp when disabling', () => {
      // Feature: system-control, Property 10: Automation state persistence
      const beforeDisable = Date.now();

      automationController.disable();

      const lastPaused = configService.get('automation_last_paused');
      expect(lastPaused).toBeDefined();

      if (lastPaused) {
        const timestamp = new Date(lastPaused).getTime();
        expect(timestamp).toBeGreaterThanOrEqual(beforeDisable);
        expect(timestamp).toBeLessThanOrEqual(Date.now());
      }
    });

    it('should maintain state across multiple operations', { timeout: 10000 }, () => {
      // Feature: system-control, Property 10: Automation state persistence
      fc.assert(
        fc.property(
          fc.array(fc.oneof(fc.constant('enable'), fc.constant('disable'), fc.constant('toggle')), {
            minLength: 1,
            maxLength: 10,
          }),
          (operations) => {
            // Start with known state
            automationController.enable();
            let expectedState = true;

            for (const op of operations) {
              if (op === 'enable') {
                automationController.enable();
                expectedState = true;
              } else if (op === 'disable') {
                automationController.disable();
                expectedState = false;
              } else {
                automationController.toggle();
                expectedState = !expectedState;
              }

              // Verify state is persisted correctly after each operation
              const persistedValue = configService.get('automation_enabled');
              const persistedState = persistedValue === 'true';

              expect(persistedState).toBe(expectedState);
              expect(automationController.isEnabled()).toBe(expectedState);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Additional AutomationController Tests', () => {
    it('should return correct status structure', () => {
      automationController.enable();
      const status = automationController.getStatus();

      expect(status).toHaveProperty('enabled');
      expect(typeof status.enabled).toBe('boolean');
      expect(status.enabled).toBe(true);
    });

    it('should include lastPaused in status after disabling', () => {
      automationController.disable();
      const status = automationController.getStatus();

      expect(status).toHaveProperty('lastPaused');
      expect(status.lastPaused).toBeDefined();
      expect(typeof status.lastPaused).toBe('string');
    });

    it('should calculate uptime when enabled after being paused', () => {
      automationController.disable();
      // Wait a tiny bit
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Small delay
      }
      automationController.enable();

      const status = automationController.getStatus();
      expect(status).toHaveProperty('uptime');
      if (status.uptime !== undefined) {
        expect(status.uptime).toBeGreaterThanOrEqual(0);
      }
    });

    it('shouldRun should match isEnabled', () => {
      fc.assert(
        fc.property(fc.boolean(), (state) => {
          if (state) {
            automationController.enable();
          } else {
            automationController.disable();
          }

          expect(automationController.shouldRun()).toBe(automationController.isEnabled());
          expect(automationController.shouldRun()).toBe(state);
        }),
        { numRuns: 100 }
      );
    });
  });
});

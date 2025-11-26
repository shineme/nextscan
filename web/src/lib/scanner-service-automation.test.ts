/**
 * Property-Based Tests for Scanner Service Automation Control
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { automationController } from './automation-controller';
import { configService } from './config-service';
import scannerService from './scanner-service';

describe('Scanner Service Automation Control Tests', () => {
  // Clean up after each test
  afterEach(() => {
    try {
      configService.set('automation_enabled', 'true');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Property 9: Disabled automation blocks scans', () => {
    it('should throw error when automation is disabled', async () => {
      // Feature: system-control, Property 9: Disabled automation blocks scans
      
      // Disable automation
      automationController.disable();
      
      // Verify automation is disabled
      expect(automationController.isEnabled()).toBe(false);
      expect(automationController.shouldRun()).toBe(false);

      // Attempt to execute scan with a non-existent task ID
      // This should fail with automation error before checking task existence
      await expect(async () => {
        await scannerService.executeScan(999999);
      }).rejects.toThrow('Automation is currently disabled');
    });

    it('should allow scans when automation is enabled', async () => {
      // Feature: system-control, Property 9: Disabled automation blocks scans
      
      // Enable automation
      automationController.enable();
      
      // Verify automation is enabled
      expect(automationController.isEnabled()).toBe(true);
      expect(automationController.shouldRun()).toBe(true);

      // Attempt to execute scan with a non-existent task ID
      // This should fail with task not found error (not automation error)
      await expect(async () => {
        await scannerService.executeScan(999999);
      }).rejects.toThrow('Task 999999 not found');
    });

    it('should check automation state before task validation', async () => {
      // Feature: system-control, Property 9: Disabled automation blocks scans
      
      // Disable automation
      automationController.disable();

      // Try to scan - should fail with automation error
      // (not task error, proving automation check comes first)
      try {
        await scannerService.executeScan(1);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Automation is currently disabled');
        expect(error.message).not.toContain('Task');
      }
    });
  });
});

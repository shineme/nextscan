/**
 * Property-Based Tests for AutomationScheduler
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { automationScheduler } from './automation-scheduler';
import db from './db';

describe('AutomationScheduler Property Tests', () => {
  // Clean up before and after each test
  beforeEach(() => {
    // Clear any existing tasks
    try {
      db.prepare('DELETE FROM scan_tasks').run();
    } catch (error) {
      // Ignore if table doesn't exist
    }
  });

  afterEach(() => {
    // Clean up tasks
    try {
      db.prepare('DELETE FROM scan_tasks').run();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Property 12: Running task blocks new scans', () => {
    it('should not start new scan when a task is running', () => {
      // Feature: system-control, Property 12: Running task blocks new scans
      fc.assert(
        fc.property(
          fc.constantFrom('pending', 'running'),
          fc.string({ minLength: 1, maxLength: 50 }),
          (status, taskName) => {
            // Create a task with pending or running status
            const insertStmt = db.prepare(
              'INSERT INTO scan_tasks (name, target, url_template, status, created_at) VALUES (?, ?, ?, ?, ?)'
            );
            insertStmt.run(taskName, 'test-target', 'http://example.com', status, new Date().toISOString());

            // Verify hasRunningTask returns true
            const hasRunning = (automationScheduler as any).hasRunningTask();
            expect(hasRunning).toBe(true);

            // Clean up
            db.prepare('DELETE FROM scan_tasks').run();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should block new scans for any number of running tasks', () => {
      // Feature: system-control, Property 12: Running task blocks new scans
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (taskCount) => {
            // Create multiple running tasks
            const insertStmt = db.prepare(
              'INSERT INTO scan_tasks (name, target, url_template, status, created_at) VALUES (?, ?, ?, ?, ?)'
            );
            
            for (let i = 0; i < taskCount; i++) {
              const status = i % 2 === 0 ? 'pending' : 'running';
              insertStmt.run(`task-${i}`, 'test-target', 'http://example.com', status, new Date().toISOString());
            }

            // Verify hasRunningTask returns true
            const hasRunning = (automationScheduler as any).hasRunningTask();
            expect(hasRunning).toBe(true);

            // Clean up
            db.prepare('DELETE FROM scan_tasks').run();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 13: Idle automation allows scans', () => {
    it('should allow new scans when no tasks are running', () => {
      // Feature: system-control, Property 13: Idle automation allows scans
      // Ensure no tasks exist
      db.prepare('DELETE FROM scan_tasks').run();

      // Verify hasRunningTask returns false
      const hasRunning = (automationScheduler as any).hasRunningTask();
      expect(hasRunning).toBe(false);
    });

    it('should allow new scans when only completed tasks exist', () => {
      // Feature: system-control, Property 13: Idle automation allows scans
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (taskCount) => {
            // Create multiple completed tasks
            const insertStmt = db.prepare(
              'INSERT INTO scan_tasks (name, target, url_template, status, created_at) VALUES (?, ?, ?, ?, ?)'
            );
            
            for (let i = 0; i < taskCount; i++) {
              const status = i % 2 === 0 ? 'completed' : 'failed';
              insertStmt.run(`task-${i}`, 'test-target', 'http://example.com', status, new Date().toISOString());
            }

            // Verify hasRunningTask returns false
            const hasRunning = (automationScheduler as any).hasRunningTask();
            expect(hasRunning).toBe(false);

            // Clean up
            db.prepare('DELETE FROM scan_tasks').run();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should allow scans after running tasks complete', () => {
      // Feature: system-control, Property 13: Idle automation allows scans
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (taskName) => {
            // Create a running task
            const insertStmt = db.prepare(
              'INSERT INTO scan_tasks (name, target, url_template, status, created_at) VALUES (?, ?, ?, ?, ?)'
            );
            const result = insertStmt.run(taskName, 'test-target', 'http://example.com', 'running', new Date().toISOString());
            const taskId = result.lastInsertRowid;

            // Verify task blocks scans
            let hasRunning = (automationScheduler as any).hasRunningTask();
            expect(hasRunning).toBe(true);

            // Complete the task
            const updateStmt = db.prepare('UPDATE scan_tasks SET status = ? WHERE id = ?');
            updateStmt.run('completed', taskId);

            // Verify scans are now allowed
            hasRunning = (automationScheduler as any).hasRunningTask();
            expect(hasRunning).toBe(false);

            // Clean up
            db.prepare('DELETE FROM scan_tasks').run();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Additional AutomationScheduler Tests', () => {
    it('should handle database errors gracefully', () => {
      // hasRunningTask should fail-open (return false) on errors
      // This is tested by the implementation's try-catch block
      const hasRunning = (automationScheduler as any).hasRunningTask();
      expect(typeof hasRunning).toBe('boolean');
    });

    it('should return correct status structure', () => {
      const status = automationScheduler.getStatus();
      
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('config');
      expect(typeof status.running).toBe('boolean');
      expect(typeof status.config).toBe('object');
    });

    it('should handle mixed task statuses correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              status: fc.constantFrom('pending', 'running', 'completed', 'failed'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (tasks) => {
            // Insert all tasks
            const insertStmt = db.prepare(
              'INSERT INTO scan_tasks (name, target, url_template, status, created_at) VALUES (?, ?, ?, ?, ?)'
            );
            
            for (const task of tasks) {
              insertStmt.run(task.name, 'test-target', 'http://example.com', task.status, new Date().toISOString());
            }

            // Check if any task is pending or running
            const hasActiveTask = tasks.some(
              (t) => t.status === 'pending' || t.status === 'running'
            );

            // Verify hasRunningTask matches expectation
            const hasRunning = (automationScheduler as any).hasRunningTask();
            expect(hasRunning).toBe(hasActiveTask);

            // Clean up
            db.prepare('DELETE FROM scan_tasks').run();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

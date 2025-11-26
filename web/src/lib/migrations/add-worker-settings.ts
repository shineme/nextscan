/**
 * Database Migration: Add Worker Configuration Settings
 * Adds settings for Worker failover mechanism
 */

import db from '../db';

export function addWorkerSettings() {
  console.log('[Migration] Adding Worker configuration settings...');

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  // Worker URLs (JSON array of strings)
  insertStmt.run('worker_urls', '[]');
  console.log('[Migration] Added worker_urls setting');

  // Worker batch size (1-10, default 10)
  insertStmt.run('worker_batch_size', '10');
  console.log('[Migration] Added worker_batch_size setting');

  // Worker timeout (milliseconds, default 10000)
  insertStmt.run('worker_timeout', '10000');
  console.log('[Migration] Added worker_timeout setting');

  // Enable/disable Worker mode (default false)
  insertStmt.run('enable_worker_mode', 'false');
  console.log('[Migration] Added enable_worker_mode setting');

  // Daily quota per Worker (default 100000)
  insertStmt.run('worker_daily_quota', '100000');
  console.log('[Migration] Added worker_daily_quota setting');

  // Permanently disabled Workers (JSON array of objects)
  insertStmt.run('worker_disabled_list', '[]');
  console.log('[Migration] Added worker_disabled_list setting');

  console.log('[Migration] Worker configuration settings added successfully');
}

// Run migration if executed directly
if (require.main === module) {
  try {
    addWorkerSettings();
    console.log('[Migration] Complete');
  } catch (error) {
    console.error('[Migration] Failed:', error);
    process.exit(1);
  }
}

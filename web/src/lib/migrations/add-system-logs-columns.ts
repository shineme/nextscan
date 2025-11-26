/**
 * Migration: Add timestamp and other columns to system_logs table
 */

import db from '../db';

export function migrateSystemLogsTable() {
  try {
    // Check if system_logs table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='system_logs'
    `).get();

    if (!tableExists) {
      console.log('[Migration] system_logs table does not exist, will be created by db.ts');
      return;
    }

    // Check if timestamp column exists
    const columns = db.prepare('PRAGMA table_info(system_logs)').all() as Array<{ name: string }>;
    const columnNames = columns.map(col => col.name);

    const needsMigration = !columnNames.includes('timestamp');

    if (needsMigration) {
      console.log('[Migration] Migrating system_logs table...');
      
      // Drop the old table and recreate with new schema
      db.exec(`
        DROP TABLE IF EXISTS system_logs_old;
        ALTER TABLE system_logs RENAME TO system_logs_old;
        
        CREATE TABLE system_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          level TEXT NOT NULL DEFAULT 'info',
          category TEXT NOT NULL,
          message TEXT NOT NULL,
          details TEXT,
          task_id INTEGER,
          domain TEXT,
          url TEXT,
          response_code INTEGER,
          response_time INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        
        -- Copy old data if any exists
        INSERT INTO system_logs (id, timestamp, level, category, message, details, created_at)
        SELECT id, created_at, level, category, message, details, created_at
        FROM system_logs_old;
        
        DROP TABLE system_logs_old;
        
        -- Recreate indexes
        CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
        CREATE INDEX IF NOT EXISTS idx_system_logs_task_id ON system_logs(task_id);
      `);
      
      console.log('[Migration] system_logs table migrated successfully');
    } else {
      console.log('[Migration] system_logs table is up to date');
    }
  } catch (error) {
    console.error('[Migration] Failed to migrate system_logs table:', error);
    throw error;
  }
}

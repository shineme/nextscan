import Database from 'better-sqlite3';
import path from 'path';

// Skip database initialization during build time (set SKIP_DB_INIT=true in Dockerfile)
const skipDbInit = process.env.SKIP_DB_INIT === 'true';

// Support custom database path via environment variable (for Docker)
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'nextscan.db');

// Create database connection
let db: Database.Database;

if (skipDbInit) {
  // Use in-memory database during build to avoid SQLite locking issues
  db = new Database(':memory:');
  console.log('[Database] Using in-memory database (build mode)');
} else {
  db = new Database(dbPath);
  console.log(`[Database] Using database at: ${dbPath}`);
}

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT UNIQUE,
    rank INTEGER,
    first_seen_at TEXT,
    last_seen_in_csv_at TEXT,
    has_been_scanned INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS scan_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    target TEXT NOT NULL,
    url_template TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    total_urls INTEGER DEFAULT 0,
    scanned_urls INTEGER DEFAULT 0,
    hits INTEGER DEFAULT 0,
    concurrency INTEGER DEFAULT 50,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    started_at TEXT,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS scan_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    domain TEXT NOT NULL,
    url TEXT NOT NULL,
    status INTEGER,
    content_type TEXT,
    size INTEGER,
    scanned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES scan_tasks(id)
  );

  CREATE TABLE IF NOT EXISTS path_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    description TEXT,
    expected_content_type TEXT,
    exclude_content_type INTEGER DEFAULT 0,
    min_size INTEGER DEFAULT 0,
    max_size INTEGER,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_logs (
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

  CREATE INDEX IF NOT EXISTS idx_scan_results_task_id ON scan_results(task_id);
  CREATE INDEX IF NOT EXISTS idx_scan_results_status ON scan_results(status);
  CREATE INDEX IF NOT EXISTS idx_path_templates_enabled ON path_templates(enabled);
  CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
  CREATE INDEX IF NOT EXISTS idx_system_logs_task_id ON system_logs(task_id);

  CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    daily_usage INTEGER DEFAULT 0,
    daily_quota INTEGER DEFAULT 100000,
    quota_reset_at TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// 数据库迁移: 检查并添加缺失的列
try {
  // 迁移 scan_tasks 表
  const scanTasksInfo = db.prepare("PRAGMA table_info(scan_tasks)").all() as Array<{ name: string }>;
  const scanTasksColumns = scanTasksInfo.map(col => col.name);
  
  const scanTasksRequiredColumns = [
    { name: 'url_template', type: 'TEXT NOT NULL DEFAULT ""' },
    { name: 'concurrency', type: 'INTEGER DEFAULT 50' },
    { name: 'progress', type: 'INTEGER DEFAULT 0' },
    { name: 'total_urls', type: 'INTEGER DEFAULT 0' },
    { name: 'scanned_urls', type: 'INTEGER DEFAULT 0' },
    { name: 'hits', type: 'INTEGER DEFAULT 0' },
    { name: 'started_at', type: 'TEXT' },
    { name: 'completed_at', type: 'TEXT' }
  ];
  
  let migrated = false;
  for (const col of scanTasksRequiredColumns) {
    if (!scanTasksColumns.includes(col.name)) {
      console.log(`Migrating database: Adding ${col.name} column to scan_tasks...`);
      db.exec(`ALTER TABLE scan_tasks ADD COLUMN ${col.name} ${col.type}`);
      migrated = true;
    }
  }

  // 迁移 path_templates 表
  const pathTemplatesInfo = db.prepare("PRAGMA table_info(path_templates)").all() as Array<{ name: string }>;
  const pathTemplatesColumns = pathTemplatesInfo.map(col => col.name);
  
  if (!pathTemplatesColumns.includes('exclude_content_type')) {
    console.log('Migrating database: Adding exclude_content_type column to path_templates...');
    db.exec('ALTER TABLE path_templates ADD COLUMN exclude_content_type INTEGER DEFAULT 0');
    migrated = true;
  }

  // 迁移 workers 表
  const workersTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workers'").get();
  if (workersTableExists) {
    const workersInfo = db.prepare("PRAGMA table_info(workers)").all() as Array<{ name: string }>;
    const workersColumns = workersInfo.map(col => col.name);
    
    const workersRequiredColumns = [
      { name: 'daily_usage', type: 'INTEGER DEFAULT 0' },
      { name: 'daily_quota', type: 'INTEGER DEFAULT 100000' },
      { name: 'quota_reset_at', type: 'TEXT' },
      { name: 'enabled', type: 'INTEGER DEFAULT 1' },
      { name: 'created_at', type: 'TEXT DEFAULT CURRENT_TIMESTAMP' }
    ];
    
    for (const col of workersRequiredColumns) {
      if (!workersColumns.includes(col.name)) {
        console.log(`Migrating database: Adding ${col.name} column to workers...`);
        db.exec(`ALTER TABLE workers ADD COLUMN ${col.name} ${col.type}`);
        migrated = true;
      }
    }
  }
  
  if (migrated) {
    console.log('Database migration completed successfully');
  }
} catch (error) {
  console.error('Database migration error:', error);
}

// Seed default settings
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
insertSetting.run('csv_url', 'https://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip');
insertSetting.run('max_concurrency', '100');
insertSetting.run('request_timeout', '10');
insertSetting.run('retry_count', '2');
insertSetting.run('enable_protocol_fallback', 'true');
insertSetting.run('enable_subdomain_discovery', 'false');
insertSetting.run('common_subdomains', 'www,api,admin,test,dev,staging');
insertSetting.run('path_templates', '1.zip,files.zip,(domain).zip,(root_domain).zip');
insertSetting.run('scan_concurrency', '50');
insertSetting.run('scan_timeout', '10000');
insertSetting.run('scan_batch_size', '100');

// Automation scheduler settings
insertSetting.run('automation_enabled', 'true');
insertSetting.run('automation_incremental_enabled', 'true');
insertSetting.run('automation_rescan_enabled', 'false');

// Seed admin user if not exists
const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)');
insertUser.run('admin', 'affadsense');

// Seed default path templates
const insertTemplate = db.prepare(`
  INSERT OR IGNORE INTO path_templates (id, name, template, description, expected_content_type, min_size, max_size)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const defaultTemplates = [
  {
    id: 1,
    name: 'Backup ZIP Files',
    template: 'https://(domain)/backup.zip',
    description: 'Common backup file pattern',
    contentType: 'application/zip',
    minSize: 1024, // 1KB
    maxSize: null
  },
  {
    id: 2,
    name: 'Database Backup',
    template: 'https://(domain)/db.sql',
    description: 'SQL database backup files',
    contentType: 'application/sql',
    minSize: 100,
    maxSize: null
  },
  {
    id: 3,
    name: 'Git Config',
    template: 'https://(domain)/.git/config',
    description: 'Exposed Git configuration',
    contentType: 'text/plain',
    minSize: 50,
    maxSize: 10240 // 10KB
  },
  {
    id: 4,
    name: 'Environment Files',
    template: 'https://(domain)/.env',
    description: 'Environment configuration files',
    contentType: 'text/plain',
    minSize: 10,
    maxSize: 102400 // 100KB
  },
  {
    id: 5,
    name: 'Archive Files',
    template: 'https://(domain)/(year).tar.gz',
    description: 'Year-based archive files',
    contentType: 'application/gzip',
    minSize: 1024,
    maxSize: null
  }
];

for (const tpl of defaultTemplates) {
  insertTemplate.run(
    tpl.id,
    tpl.name,
    tpl.template,
    tpl.description,
    tpl.contentType,
    tpl.minSize,
    tpl.maxSize
  );
}

export default db;

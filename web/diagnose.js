/**
 * Diagnostic script to check system status
 */

const Database = require('better-sqlite3');
const db = new Database('nextscan.db');

console.log('='.repeat(60));
console.log('NEXTSCAN DIAGNOSTIC REPORT');
console.log('='.repeat(60));

// 1. Check domains
console.log('\n📊 DOMAINS:');
const domainCount = db.prepare('SELECT COUNT(*) as count FROM domains').get();
const unscanned = db.prepare('SELECT COUNT(*) as count FROM domains WHERE has_been_scanned = 0').get();
console.log(`  Total: ${domainCount.count.toLocaleString()}`);
console.log(`  Unscanned: ${unscanned.count.toLocaleString()}`);
console.log(`  Scanned: ${(domainCount.count - unscanned.count).toLocaleString()}`);

// 2. Check tasks
console.log('\n📋 TASKS:');
const tasks = db.prepare(`
  SELECT status, COUNT(*) as count 
  FROM scan_tasks 
  GROUP BY status
`).all();
tasks.forEach(t => {
  console.log(`  ${t.status}: ${t.count}`);
});

console.log('\n  Recent tasks:');
const recentTasks = db.prepare(`
  SELECT id, name, status, scanned_urls, total_urls, hits, 
         datetime(created_at, 'localtime') as created,
         datetime(started_at, 'localtime') as started,
         datetime(completed_at, 'localtime') as completed
  FROM scan_tasks 
  ORDER BY id DESC 
  LIMIT 5
`).all();
recentTasks.forEach(t => {
  console.log(`    #${t.id}: ${t.name}`);
  console.log(`      Status: ${t.status}`);
  console.log(`      Progress: ${t.scanned_urls}/${t.total_urls} (${t.hits} hits)`);
  console.log(`      Created: ${t.created}`);
  if (t.started) console.log(`      Started: ${t.started}`);
  if (t.completed) console.log(`      Completed: ${t.completed}`);
  console.log('');
});

// 3. Check results
console.log('🔍 SCAN RESULTS:');
const resultCount = db.prepare('SELECT COUNT(*) as count FROM scan_results').get();
console.log(`  Total: ${resultCount.count.toLocaleString()}`);

if (resultCount.count > 0) {
  const statusDist = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM scan_results 
    GROUP BY status 
    ORDER BY count DESC
  `).all();
  console.log('\n  By status:');
  statusDist.forEach(s => {
    console.log(`    ${s.status}: ${s.count.toLocaleString()}`);
  });

  console.log('\n  Sample results:');
  const samples = db.prepare(`
    SELECT domain, url, status, size, datetime(scanned_at, 'localtime') as scanned
    FROM scan_results 
    ORDER BY id DESC 
    LIMIT 3
  `).all();
  samples.forEach(r => {
    console.log(`    ${r.domain} - ${r.url}`);
    console.log(`      Status: ${r.status}, Size: ${r.size} bytes`);
    console.log(`      Scanned: ${r.scanned}`);
  });
}

// 4. Check templates
console.log('\n📝 PATH TEMPLATES:');
const templates = db.prepare('SELECT id, name, template, enabled FROM path_templates').all();
templates.forEach(t => {
  console.log(`  ${t.enabled ? '✓' : '✗'} #${t.id}: ${t.name}`);
  console.log(`    Template: ${t.template}`);
});

// 5. Check configuration
console.log('\n⚙️  CONFIGURATION:');
const configs = db.prepare('SELECT key, value FROM config WHERE key LIKE "%worker%" OR key LIKE "%automation%"').all();
configs.forEach(c => {
  console.log(`  ${c.key}: ${c.value}`);
});

console.log('\n' + '='.repeat(60));
console.log('END OF REPORT');
console.log('='.repeat(60));

db.close();

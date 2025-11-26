/**
 * Test script to simulate scan and check if results are saved
 */

const Database = require('better-sqlite3');
const db = new Database('nextscan.db');

console.log('='.repeat(60));
console.log('SCAN TEST - CHECKING RESULTS SAVING');
console.log('='.repeat(60));

// 1. Check current state
console.log('\n📊 BEFORE TEST:');
const beforeCount = db.prepare('SELECT COUNT(*) as count FROM scan_results').get();
console.log(`  Results in DB: ${beforeCount.count}`);

// 2. Find a running or pending task
const task = db.prepare(`
  SELECT id, name, status, url_template, scanned_urls, total_urls 
  FROM scan_tasks 
  WHERE status IN ('pending', 'running')
  ORDER BY id DESC 
  LIMIT 1
`).get();

if (!task) {
  console.log('\n❌ No pending or running tasks found');
  console.log('Please create a task first or wait for automation to create one');
  process.exit(0);
}

console.log('\n📋 TASK INFO:');
console.log(`  ID: ${task.id}`);
console.log(`  Name: ${task.name}`);
console.log(`  Status: ${task.status}`);
console.log(`  Template: ${task.url_template}`);
console.log(`  Progress: ${task.scanned_urls}/${task.total_urls}`);

// 3. Wait a bit and check again
console.log('\n⏳ Waiting 30 seconds for scan to progress...');
console.log('   (You should see scan logs in your npm run dev console)');

setTimeout(() => {
  console.log('\n📊 AFTER 30 SECONDS:');
  
  // Check task progress
  const updatedTask = db.prepare('SELECT scanned_urls, hits FROM scan_tasks WHERE id = ?').get(task.id);
  console.log(`  Task progress: ${updatedTask.scanned_urls}/${task.total_urls}`);
  console.log(`  Hits found: ${updatedTask.hits}`);
  
  // Check results
  const afterCount = db.prepare('SELECT COUNT(*) as count FROM scan_results').get();
  console.log(`  Results in DB: ${afterCount.count}`);
  console.log(`  New results: ${afterCount.count - beforeCount.count}`);
  
  if (afterCount.count > beforeCount.count) {
    console.log('\n✅ SUCCESS: Results are being saved!');
    
    // Show sample results
    const samples = db.prepare(`
      SELECT domain, url, status 
      FROM scan_results 
      WHERE task_id = ?
      ORDER BY id DESC 
      LIMIT 5
    `).all(task.id);
    
    console.log('\n📝 Sample results:');
    samples.forEach(r => {
      console.log(`  ${r.status} - ${r.domain} - ${r.url}`);
    });
  } else {
    console.log('\n❌ PROBLEM: No new results saved!');
    console.log('\nPossible issues:');
    console.log('  1. scanBatch is not returning results');
    console.log('  2. saveBatchResults is not being called');
    console.log('  3. Results are being filtered out');
    console.log('\nCheck your npm run dev console for:');
    console.log('  - "===== CALLING scanBatch"');
    console.log('  - "===== scanBatch RETURNED"');
    console.log('  - "===== SAVE BATCH RESULTS START"');
  }
  
  console.log('\n' + '='.repeat(60));
  db.close();
  process.exit(0);
}, 30000);

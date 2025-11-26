/**
 * Database Reset Script
 * Deletes the database file to force recreation with new schema
 */

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'nextscan.db');

try {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('✅ Database file deleted successfully');
    console.log('📝 The database will be recreated with the new schema on next startup');
  } else {
    console.log('ℹ️  Database file does not exist');
  }
} catch (error) {
  console.error('❌ Failed to delete database file:', error.message);
  console.log('\n💡 Please manually delete the file: web/nextscan.db');
  process.exit(1);
}

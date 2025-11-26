import AdmZip from 'adm-zip';
import db from '@/lib/db';
import logger from './logger-service';

const DEFAULT_CSV_URL = 'https://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip';

export async function syncDomains() {
    const startTime = Date.now();
    console.log('Starting domain sync...');
    logger.info('domain', '🚀 Starting domain synchronization');

    try {
        // Get URL from settings
        const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('csv_url') as { value: string } | undefined;
        const csvUrl = setting?.value || DEFAULT_CSV_URL;

        // 1. Download the ZIP file
        console.log(`Downloading from ${csvUrl}...`);
        logger.info('domain', `📥 Downloading domain list from: ${csvUrl}`);
        
        const downloadStart = Date.now();
        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw new Error(`Failed to download CSV: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const downloadTime = Date.now() - downloadStart;
        const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
        
        logger.success('domain', `✅ Downloaded ${fileSizeMB}MB in ${(downloadTime / 1000).toFixed(1)}s`);

        // 2. Unzip
        console.log('Unzipping...');
        logger.info('domain', '📦 Extracting ZIP archive...');
        
        const unzipStart = Date.now();
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();

        // Find the CSV file (usually there's only one, but let's be safe)
        const csvEntry = zipEntries.find(entry => entry.entryName.endsWith('.csv'));
        if (!csvEntry) {
            throw new Error('No CSV file found in the ZIP archive');
        }

        // 3. Parse CSV
        console.log(`Parsing ${csvEntry.entryName}...`);
        logger.info('domain', `📄 Parsing CSV file: ${csvEntry.entryName}`);
        
        const csvText = csvEntry.getData().toString('utf8');
        const lines = csvText.split('\n');
        const unzipTime = Date.now() - unzipStart;
        
        logger.info('domain', `📊 Found ${lines.length.toLocaleString()} domain entries (extracted in ${(unzipTime / 1000).toFixed(1)}s)`);

        // Prepare DB statements
        const insertOrUpdateDomain = db.prepare(`
      INSERT INTO domains (domain, rank, first_seen_at, last_seen_in_csv_at)
      VALUES (@domain, @rank, @now, @now)
      ON CONFLICT(domain) DO UPDATE SET
        rank = @rank,
        last_seen_in_csv_at = @now
    `);

        const now = new Date().toISOString();
        let count = 0;
        const total = lines.length;

        // Use a transaction for better performance
        const insertMany = db.transaction((domains) => {
            let progressCount = 0;
            const progressInterval = Math.floor(domains.length / 10); // Log every 10%
            
            for (const line of domains) {
                if (!line.trim()) continue;

                // Format: rank,domain (e.g., "1,google.com")
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const rank = parseInt(parts[0].trim(), 10);
                    const domain = parts[1].trim();

                    if (domain) {
                        insertOrUpdateDomain.run({ domain, rank, now });
                        count++;
                        progressCount++;
                        
                        // Log progress every 10%
                        if (progressInterval > 0 && progressCount % progressInterval === 0) {
                            const percentage = Math.round((progressCount / domains.length) * 100);
                            logger.info('domain', `💾 Database insertion progress: ${percentage}% (${count.toLocaleString()} domains)`);
                        }
                    }
                }
            }
        });

        // 4. Insert into DB
        console.log('Inserting into database...');
        logger.info('domain', '💾 Inserting domains into database...');
        
        const insertStart = Date.now();
        insertMany(lines);
        const insertTime = Date.now() - insertStart;
        const totalTime = Date.now() - startTime;

        console.log(`Sync completed. Processed ${count} domains.`);
        logger.success('domain', `✅ Database insertion completed: ${count.toLocaleString()} domains in ${(insertTime / 1000).toFixed(1)}s`);
        logger.success('domain', `🎉 Domain sync completed successfully! Total time: ${(totalTime / 1000).toFixed(1)}s`);
        
        return { success: true, count };

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Sync failed:', error);
        logger.error('domain', `❌ Domain sync failed: ${errorMsg}`, {
            details: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}

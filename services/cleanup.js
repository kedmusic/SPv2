const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../database/init');

function cleanupExpiredFiles() {
  console.log('Running cleanup service...');

  const db = getDatabase();

  // Get expired files
  db.all(
    'SELECT * FROM print_jobs WHERE expires_at <= datetime("now") AND status = "active"',
    [],
    (err, expiredFiles) => {
      if (err) {
        console.error('Error fetching expired files:', err);
        db.close();
        return;
      }

      if (!expiredFiles || expiredFiles.length === 0) {
        console.log('No expired files to clean up');
        db.close();
        return;
      }

      let deletedCount = 0;
      let errorCount = 0;

      expiredFiles.forEach((file) => {
        // Delete physical file
        if (fs.existsSync(file.file_path)) {
          try {
            fs.unlinkSync(file.file_path);
            deletedCount++;
          } catch (err) {
            console.error(`Error deleting file ${file.file_path}:`, err);
            errorCount++;
          }
        }

        // Update database status
        db.run(
          'UPDATE print_jobs SET status = "expired" WHERE id = ?',
          [file.id],
          (err) => {
            if (err) {
              console.error(`Error updating status for file ${file.file_id}:`, err);
            }
          }
        );
      });

      console.log(`Cleanup complete: ${deletedCount} files deleted, ${errorCount} errors`);
      db.close();
    }
  );
}

function startupCleanup() {
  console.log('Running startup cleanup...');

  const uploadDir = process.env.UPLOAD_DIR || './cache/uploads';

  if (!fs.existsSync(uploadDir)) {
    console.log('Upload directory does not exist, creating...');
    fs.mkdirSync(uploadDir, { recursive: true });
    return;
  }

  const db = getDatabase();

  // Get all active files from database
  db.all('SELECT stored_filename FROM print_jobs WHERE status = "active"', [], (err, dbFiles) => {
    if (err) {
      console.error('Error fetching database files:', err);
      db.close();
      return;
    }

    const activeFiles = new Set(dbFiles.map(f => f.stored_filename));

    // Get all files in upload directory
    fs.readdir(uploadDir, (err, diskFiles) => {
      if (err) {
        console.error('Error reading upload directory:', err);
        db.close();
        return;
      }

      let orphanedCount = 0;

      // Delete orphaned files
      diskFiles.forEach(file => {
        if (!activeFiles.has(file) && !file.startsWith('temp-')) {
          const filePath = path.join(uploadDir, file);
          try {
            fs.unlinkSync(filePath);
            orphanedCount++;
            console.log(`Deleted orphaned file: ${file}`);
          } catch (err) {
            console.error(`Error deleting orphaned file ${file}:`, err);
          }
        }
      });

      console.log(`Startup cleanup complete: ${orphanedCount} orphaned files deleted`);
      db.close();

      // Run regular cleanup for expired files
      cleanupExpiredFiles();
    });
  });
}

function startCleanupService() {
  // Run startup cleanup
  startupCleanup();

  // Schedule midnight cleanup (every day at 00:00)
  cron.schedule('0 0 * * *', () => {
    console.log('Running scheduled midnight cleanup...');
    cleanupExpiredFiles();
  });

  console.log('Cleanup service scheduled for midnight (00:00)');
}

module.exports = { startCleanupService, cleanupExpiredFiles };

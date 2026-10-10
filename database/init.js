const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../database/stationery.db');

function getDatabase() {
  return new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err);
    }
  });
}

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();

    db.serialize(() => {
      // Create shops table
      db.run(`
        CREATE TABLE IF NOT EXISTS shops (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          shop_id TEXT UNIQUE NOT NULL,
          shop_name TEXT NOT NULL,
          owner_name TEXT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
      });

      // Create qr_tokens table
      db.run(`
        CREATE TABLE IF NOT EXISTS qr_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          shop_id TEXT NOT NULL,
          token TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL,
          is_active INTEGER DEFAULT 1,
          FOREIGN KEY(shop_id) REFERENCES shops(shop_id)
        )
      `, (err) => {
        if (err) reject(err);
      });

      // Create print_jobs table
      db.run(`
        CREATE TABLE IF NOT EXISTS print_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          shop_id TEXT NOT NULL,
          file_id TEXT UNIQUE NOT NULL,
          secure_token TEXT UNIQUE NOT NULL,
          original_filename TEXT NOT NULL,
          stored_filename TEXT NOT NULL,
          file_path TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          file_type TEXT DEFAULT 'general',
          private_security_key TEXT,
          upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL,
          status TEXT DEFAULT 'active',
          printed_at DATETIME NULL,
          FOREIGN KEY(shop_id) REFERENCES shops(shop_id)
        )
      `, (err) => {
        if (err) reject(err);
      });

      // Create indexes
      db.run('CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token)');
      db.run('CREATE INDEX IF NOT EXISTS idx_qr_tokens_shop_id ON qr_tokens(shop_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_print_jobs_secure_token ON print_jobs(secure_token)');
      db.run('CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_id ON print_jobs(shop_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_print_jobs_expires_at ON print_jobs(expires_at)');
      db.run('CREATE INDEX IF NOT EXISTS idx_print_jobs_file_id ON print_jobs(file_id)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    db.close();
  });
}

module.exports = { getDatabase, initializeDatabase };

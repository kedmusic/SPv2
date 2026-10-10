const express = require('express');
const path = require('path');
const fs = require('fs');
const { getDatabase } = require('../database/init');

const router = express.Router();

// Get file details by token
router.get('/:token', (req, res) => {
  const { token } = req.params;

  const db = getDatabase();

  db.get(
    'SELECT * FROM print_jobs WHERE secure_token = ? AND status = "active"',
    [token],
    (err, file) => {
      db.close();

      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!file) {
        return res.status(404).json({ error: 'File not found or expired' });
      }

      // Check expiration
      if (new Date(file.expires_at) < new Date()) {
        return res.status(410).json({ error: 'File has expired' });
      }

      res.json({
        file: {
          fileId: file.file_id,
          fileName: file.original_filename,
          fileSize: file.file_size,
          mimeType: file.mime_type,
          uploadTime: file.upload_time,
          expiresAt: file.expires_at,
          fileType: file.file_type
        }
      });
    }
  );
});

// Serve file
router.get('/file/:token', (req, res) => {
  const { token } = req.params;

  const db = getDatabase();

  db.get(
    'SELECT * FROM print_jobs WHERE secure_token = ? AND status = "active"',
    [token],
    (err, file) => {
      db.close();

      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Check expiration
      if (new Date(file.expires_at) < new Date()) {
        return res.status(410).json({ error: 'File has expired' });
      }

      // Serve file
      if (fs.existsSync(file.file_path)) {
        res.setHeader('Content-Type', file.mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${file.original_filename}"`);
        res.sendFile(path.resolve(file.file_path));
      } else {
        res.status(404).json({ error: 'File not found on disk' });
      }
    }
  );
});

// Mark file as printed
router.post('/:token/printed', (req, res) => {
  const { token } = req.params;

  const db = getDatabase();

  db.run(
    'UPDATE print_jobs SET status = "printed", printed_at = CURRENT_TIMESTAMP WHERE secure_token = ?',
    [token],
    function (err) {
      db.close();

      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json({
        success: true,
        message: 'File marked as printed'
      });
    }
  );
});

module.exports = router;

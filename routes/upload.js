const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { getDatabase } = require('../database/init');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './cache/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, PNG, and DOCX files are allowed.'));
    }
  }
});

// Validate token
router.get('/validate-token', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  const db = getDatabase();

  db.get(
    `SELECT qr_tokens.*, shops.shop_name FROM qr_tokens
     JOIN shops ON qr_tokens.shop_id = shops.shop_id
     WHERE qr_tokens.token = ? AND qr_tokens.is_active = 1`,
    [token],
    (err, row) => {
      db.close();

      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Invalid or expired token' });
      }

      res.json({
        valid: true,
        shopName: row.shop_name
      });
    }
  );
});

// Upload file
router.post('/', upload.single('file'), async (req, res) => {
  const { token } = req.query;
  const { fileType = 'general' } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const db = getDatabase();

  // Validate token and get shop_id
  db.get(
    'SELECT shop_id FROM qr_tokens WHERE token = ? AND is_active = 1',
    [token],
    async (err, tokenRow) => {
      if (err || !tokenRow) {
        fs.unlinkSync(req.file.path);
        db.close();
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const shopId = tokenRow.shop_id;

      // Generate file ID (DDMMYY-XXX format)
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).substr(-2)}`;

      // Get today's file count
      db.get(
        'SELECT COUNT(*) as count FROM print_jobs WHERE shop_id = ? AND file_id LIKE ?',
        [shopId, `${dateStr}-%`],
        async (err, countRow) => {
          if (err) {
            fs.unlinkSync(req.file.path);
            db.close();
            return res.status(500).json({ error: 'Database error' });
          }

          const fileNumber = String((countRow.count || 0) + 1).padStart(3, '0');
          const fileId = `${dateStr}-${fileNumber}`;

          // Generate secure token
          const secureToken = crypto.randomBytes(32).toString('hex');

          // Create stored filename
          const ext = path.extname(req.file.originalname);
          const storedFilename = `${fileId}${ext}`;
          const finalPath = path.join(process.env.UPLOAD_DIR || './cache/uploads', storedFilename);

          // Move file to final location
          fs.renameSync(req.file.path, finalPath);

          // Set expiration (24 hours)
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24);

          // Insert into database
          db.run(
            `INSERT INTO print_jobs (shop_id, file_id, secure_token, original_filename, stored_filename,
             file_path, mime_type, file_size, file_type, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              shopId,
              fileId,
              secureToken,
              req.file.originalname,
              storedFilename,
              finalPath,
              req.file.mimetype,
              req.file.size,
              fileType,
              expiresAt.toISOString()
            ],
            async (err) => {
              if (err) {
                fs.unlinkSync(finalPath);
                db.close();
                return res.status(500).json({ error: 'Failed to save file record' });
              }

              // Generate QR code
              const printUrl = `${process.env.BASE_URL}/print/${secureToken}`;

              try {
                const qrDataUrl = await QRCode.toDataURL(printUrl);

                db.close();
                res.json({
                  success: true,
                  fileId,
                  fileName: req.file.originalname,
                  fileSize: req.file.size,
                  expiresAt: expiresAt.toISOString(),
                  secureToken,
                  fileType,
                  printQR: qrDataUrl,
                  printUrl
                });
              } catch (qrErr) {
                db.close();
                res.status(500).json({ error: 'Failed to generate QR code' });
              }
            }
          );
        }
      );
    }
  );
});

module.exports = router;

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getDatabase } = require('../database/init');

const router = express.Router();

// Get shop details
router.get('/details', verifyToken, (req, res) => {
  const db = getDatabase();

  db.get('SELECT * FROM shops WHERE shop_id = ?', [req.shopId], (err, shop) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: 'Database error' });
    }

    if (!shop) {
      db.close();
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Get QR token
    db.get('SELECT token FROM qr_tokens WHERE shop_id = ? AND is_active = 1', [req.shopId], (err, tokenRow) => {
      db.close();

      if (err || !tokenRow) {
        return res.status(500).json({ error: 'Failed to retrieve QR token' });
      }

      res.json({
        shopId: shop.shop_id,
        shopName: shop.shop_name,
        ownerName: shop.owner_name,
        email: shop.email,
        qrToken: tokenRow.token,
        qrUrl: `${process.env.BASE_URL}/upload?token=${tokenRow.token}`
      });
    });
  });
});

// Get shop files
router.get('/files', verifyToken, (req, res) => {
  const db = getDatabase();

  db.all(
    'SELECT file_id, original_filename, file_size, mime_type, file_type, upload_time, expires_at, status FROM print_jobs WHERE shop_id = ? ORDER BY upload_time DESC',
    [req.shopId],
    (err, files) => {
      db.close();

      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ files });
    }
  );
});

module.exports = router;

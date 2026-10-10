const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDatabase } = require('../database/init');

const router = express.Router();

// Signup endpoint
router.post('/signup', async (req, res) => {
  const { shopName, ownerName, email, password } = req.body;

  // Validation
  if (!shopName || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  if (shopName.length < 2) {
    return res.status(400).json({ error: 'Shop name must be at least 2 characters long' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const db = getDatabase();

  try {
    // Check if email already exists
    db.get('SELECT * FROM shops WHERE email = ?', [email], async (err, row) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }

      if (row) {
        db.close();
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Generate shop ID (16-char hex)
      const shopId = crypto.randomBytes(8).toString('hex').toUpperCase();

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Insert shop
      db.run(
        'INSERT INTO shops (shop_id, shop_name, owner_name, email, password_hash) VALUES (?, ?, ?, ?, ?)',
        [shopId, shopName, ownerName || null, email, passwordHash],
        function (err) {
          if (err) {
            db.close();
            return res.status(500).json({ error: 'Failed to create account' });
          }

          // Generate permanent QR token
          const qrToken = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 10); // 10 years validity

          db.run(
            'INSERT INTO qr_tokens (shop_id, token, expires_at) VALUES (?, ?, ?)',
            [shopId, qrToken, expiresAt.toISOString()],
            (err) => {
              if (err) {
                db.close();
                return res.status(500).json({ error: 'Failed to generate QR token' });
              }

              // Generate JWT
              const jwtToken = jwt.sign(
                { shopId, email, shopName },
                process.env.JWT_SECRET,
                { expiresIn: '8h' }
              );

              // Set HTTP-only cookie
              res.cookie('authToken', jwtToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 8 * 60 * 60 * 1000 // 8 hours
              });

              db.close();
              res.status(201).json({
                success: true,
                message: 'Account created successfully',
                shopId,
                shopName,
                email,
                qrToken
              });
            }
          );
        }
      );
    });
  } catch (error) {
    db.close();
    res.status(500).json({ error: 'Server error' });
  }
});

// Login endpoint
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  const db = getDatabase();

  db.get('SELECT * FROM shops WHERE email = ?', [email], async (err, shop) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: 'Database error' });
    }

    if (!shop) {
      db.close();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, shop.password_hash);

    if (!isValid) {
      db.close();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const jwtToken = jwt.sign(
      { shopId: shop.shop_id, email: shop.email, shopName: shop.shop_name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Set HTTP-only cookie
    res.cookie('authToken', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    });

    db.close();
    res.json({
      success: true,
      message: 'Login successful',
      shopId: shop.shop_id,
      shopName: shop.shop_name
    });
  });
});

// Logout endpoint
router.post('/logout', (req, res) => {
  res.clearCookie('authToken');
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;

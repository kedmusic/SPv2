const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const shopRoutes = require('./routes/shop');
const uploadRoutes = require('./routes/upload');
const printRoutes = require('./routes/print');
const { initializeDatabase } = require('./database/init');
const { startCleanupService } = require('./services/cleanup');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"]
    }
  }
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many authentication attempts, please try again later'
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many upload attempts, please try again later'
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assests', express.static(path.join(__dirname, 'assests')));

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/upload', uploadLimiter, uploadRoutes);
app.use('/api/print', printRoutes);

// Initialize database
initializeDatabase()
  .then(() => {
    console.log('Database initialized successfully');

    // Start cleanup service
    startCleanupService();
    console.log('Cleanup service started');

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;

# STATIONARY PRINT PROJECT - COMPREHENSIVE DOCUMENTATION

**Project Name:** QR-Based Stationery Printing Web Application  
**Version:** 1.0.0  
**Date:** October 7, 2026  
**Document Type:** Technical Specification & Risk Assessment

---

## EXECUTIVE SUMMARY

The Stationary Print project is a production-ready web application designed to modernize printing shop operations through QR code technology. The system enables customers to upload documents anonymously by scanning a shop-specific QR code, receive a print QR code, and allows shopkeepers to process print jobs efficiently without manual file handling.

### Key Innovation
- **Anonymous Upload**: No customer registration required
- **QR-Based Workflow**: Seamless mobile-to-print experience
- **Secure Token System**: Cryptographic security for file access
- **Automatic Cleanup**: Zero manual file management overhead

---

## 1. TECHNOLOGY STACK

### 1.1 Frontend Technologies

#### Core Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| HTML5 | - | Semantic markup and structure |
| CSS3 | - | Styling with Grid/Flexbox layouts |
| Vanilla JavaScript | ES6+ | Client-side interactivity (no frameworks) |

#### Libraries & Tools
| Library | Version | Purpose |
|---------|---------|---------|
| QRCode.js | Latest | QR code generation |
| PDF.js | 3.11.174 | PDF preview rendering |
| Responsive Design | Custom | Mobile-first approach (320px-1440px+) |

**Rationale for Technology Choices:**
- **Vanilla JavaScript**: No framework overhead, faster load times, better performance on low-end devices
- **QRCode.js**: Lightweight, browser-native QR generation
- **PDF.js**: Mozilla-backed, reliable PDF rendering without server dependencies

---

### 1.2 Backend Technologies

#### Runtime & Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 14+ | JavaScript runtime environment |
| Express.js | 4.18.2 | Web application framework |

#### Core Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| bcrypt | 5.1.0 | Password hashing (10 salt rounds) |
| jsonwebtoken | 9.0.0 | JWT authentication tokens |
| cookie-parser | 1.4.6 | HTTP cookie parsing |
| multer | 1.4.5-lts.1 | Multipart/form-data file uploads |
| sqlite3 | 5.1.6 | Embedded relational database |
| qrcode | 1.5.3 | Server-side QR generation |
| node-cron | 3.0.2 | Scheduled task execution |
| helmet | 7.0.0 | Security headers middleware |
| cors | 2.8.5 | Cross-origin resource sharing |
| express-rate-limit | 6.7.0 | Request rate limiting |
| dotenv | 16.0.3 | Environment variable management |

**Backend Architecture Decisions:**
- **Express.js**: Industry standard, minimal overhead, extensive middleware ecosystem
- **SQLite3**: Zero-configuration, file-based, perfect for single-server deployments
- **JWT**: Stateless authentication, scalable, no server-side session storage
- **Multer**: Stream-based uploads, memory efficient for large files

---

### 1.3 Database Technology

#### Database System
**SQLite3** - Embedded Relational Database

**Characteristics:**
- File-based storage (`database/stationery.db`)
- Zero external dependencies
- ACID-compliant transactions
- Supports concurrent reads
- Single-writer architecture

**Database Schema:**

```sql
-- SHOPS TABLE
CREATE TABLE shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT UNIQUE NOT NULL,              -- 16-char hex (e.g., FE1BB62509D8057B)
  shop_name TEXT NOT NULL,                   -- Business name
  owner_name TEXT,                           -- Owner's name (optional)
  email TEXT UNIQUE NOT NULL,                -- Login email
  password_hash TEXT NOT NULL,               -- bcrypt hashed password
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- QR_TOKENS TABLE
CREATE TABLE qr_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT NOT NULL,                     -- Foreign key to shops
  token TEXT UNIQUE NOT NULL,                -- 64-char hex secure token
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,              -- 24-hour validity
  is_active INTEGER DEFAULT 1,               -- Boolean flag (1=active, 0=inactive)
  FOREIGN KEY(shop_id) REFERENCES shops(shop_id)
);

-- PRINT_JOBS TABLE
CREATE TABLE print_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT NOT NULL,                     -- Foreign key to shops
  file_id TEXT UNIQUE NOT NULL,              -- Human-readable ID (DDMMYY-XXX)
  secure_token TEXT UNIQUE NOT NULL,         -- 64-char hex for URL access
  original_filename TEXT NOT NULL,           -- Customer's filename
  stored_filename TEXT NOT NULL,             -- System storage filename
  file_path TEXT NOT NULL,                   -- Absolute file path
  mime_type TEXT NOT NULL,                   -- application/pdf, image/jpeg, etc.
  file_size INTEGER NOT NULL,                -- Size in bytes
  file_type TEXT DEFAULT 'general',          -- 'general' or 'private'
  private_security_key TEXT,                 -- 64-char hex for private files
  upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,              -- 24-hour expiration
  status TEXT DEFAULT 'active',              -- 'active', 'printed', 'expired'
  printed_at DATETIME NULL,                  -- Timestamp when printed
  FOREIGN KEY(shop_id) REFERENCES shops(shop_id)
);
```

**Database Indexes (for performance):**
```sql
CREATE INDEX idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX idx_qr_tokens_shop_id ON qr_tokens(shop_id);
CREATE INDEX idx_print_jobs_secure_token ON print_jobs(secure_token);
CREATE INDEX idx_print_jobs_shop_id ON print_jobs(shop_id);
CREATE INDEX idx_print_jobs_expires_at ON print_jobs(expires_at);
CREATE INDEX idx_print_jobs_file_id ON print_jobs(file_id);
```

---

## 2. STORAGE METHODOLOGY

### 2.1 File Storage System

#### Storage Architecture
**Type:** Local File System (Non-Cloud)  
**Location:** `./cache/uploads/` (relative to project root)  
**Lifecycle:** Temporary (24-hour retention)

#### File Naming Convention
- **Format:** `{FileID}{extension}`
- **Example:** `250926-001.pdf`, `250926-002.jpg`
- **FileID Pattern:** `DDMMYY-XXX` where:
  - `DD` = Day (01-31)
  - `MM` = Month (01-12)
  - `YY` = Year (last 2 digits)
  - `XXX` = Sequential number (001-999)

#### File Storage Flow
```
1. Customer uploads file → Multer receives stream
2. Temporary file created with random name
3. File validation (magic bytes, MIME type, size)
4. File moved to: cache/uploads/{FileID}.{ext}
5. Database record created with file metadata
6. Temporary file deleted
```

#### Supported File Types
| Type | Extensions | MIME Type | Max Size | Magic Bytes |
|------|-----------|-----------|----------|-------------|
| PDF | .pdf | application/pdf | 10 MB | 25 50 44 46 (%PDF) |
| JPEG | .jpg, .jpeg | image/jpeg | 10 MB | FF D8 FF |
| PNG | .png | image/png | 10 MB | 89 50 4E 47 (‰PNG) |
| DOCX | .docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document | 10 MB | 50 4B 03 04 (PK..) |

---

### 2.2 File Security & Validation

#### Multi-Layer Validation
1. **Extension Validation**: Whitelist check against allowed extensions
2. **MIME Type Validation**: Multer fileFilter verification
3. **Magic Bytes Validation**: File signature verification via first 4 bytes
4. **Size Validation**: 10 MB hard limit enforced by Multer

#### Security Measures
- **Path Traversal Prevention**: Filename sanitization removes `../` sequences
- **Secure Token Access**: Files accessible only via 64-char cryptographic token
- **No Direct Filesystem Access**: Files served through `/api/files/:token` endpoint
- **Automatic Expiration**: 24-hour validity enforced at database level

---

### 2.3 Cleanup Service

#### Midnight Cleanup (Cron Job)
**Schedule:** `0 0 * * *` (Every day at 00:00 local time)

**Cleanup Process:**
```javascript
1. Query expired files: WHERE expires_at <= CURRENT_TIMESTAMP
2. For each expired file:
   - Delete physical file from cache/uploads/
   - Update database: SET status = 'expired'
   - Log deletion result
3. Summary: Files deleted, records updated
```

#### Startup Cleanup
**Trigger:** Server initialization

**Process:**
- Scans `cache/uploads/` directory
- Identifies orphaned files (not in database)
- Identifies expired files (past expiration time)
- Deletes both categories
- Ensures consistent state on restart

---

## 3. AUTHENTICATION & AUTHORIZATION

### 3.1 Signup Methodology

#### Registration Flow
```
1. User submits: email, password, shopName, ownerName (optional)
   ↓
2. Server-side validation:
   - Email format validation (RFC 5322)
   - Password strength (minimum 8 characters)
   - Shop name length (minimum 2 characters)
   ↓
3. Duplicate email check: SELECT * FROM shops WHERE email = ?
   ↓
4. Password hashing: bcrypt.hash(password, 10 rounds)
   ↓
5. Shop ID generation: crypto.randomBytes(8).toString('hex').toUpperCase()
   ↓
6. Database insertion:
   INSERT INTO shops (shop_id, shop_name, owner_name, email, password_hash)
   ↓
7. Generate permanent QR token for shop
   ↓
8. Generate JWT for immediate login
   ↓
9. Set HTTP-only cookie with JWT
   ↓
10. Return: shopId, shopName, email, qrToken
```

#### Validation Rules
| Field | Rule | Error Message |
|-------|------|---------------|
| email | RFC 5322 format | "Invalid email format" |
| password | Min 8 characters | "Password must be at least 8 characters long" |
| shopName | Min 2 characters | "Shop name must be at least 2 characters long" |
| email (unique) | No duplicates | "Email already registered" (409 Conflict) |

#### Security Features
- **Password Hashing**: bcrypt with 10 salt rounds (~100ms computation time)
- **Unique Constraints**: Database-enforced email uniqueness
- **Rate Limiting**: 3 signup attempts per IP per hour
- **Secure Shop ID**: 16-character cryptographic hex string (64-bit entropy)

---

### 3.2 Login Methodology

#### Authentication Flow
```
1. User submits: email, password
   ↓
2. Email format validation
   ↓
3. Database lookup: SELECT * FROM shops WHERE email = ?
   ↓
4. If not found → 401 "Invalid email or password"
   ↓
5. Password verification: bcrypt.compare(password, shop.password_hash)
   ↓
6. If invalid → 401 "Invalid email or password"
   ↓
7. Generate JWT token:
   - Payload: { shopId, email, shopName }
   - Secret: process.env.JWT_SECRET
   - Expiry: 8 hours
   ↓
8. Set HTTP-only cookie:
   - Name: authToken
   - HttpOnly: true
   - Secure: true (production only)
   - SameSite: Lax
   - MaxAge: 8 hours
   ↓
9. Return: success, shopId, shopName
```

#### JWT Token Structure
```json
{
  "shopId": "FE1BB62509D8057B",
  "email": "shop@example.com",
  "shopName": "My Stationery Store",
  "iat": 1696680000,
  "exp": 1696708800
}
```

#### Cookie Configuration
| Attribute | Value | Purpose |
|-----------|-------|---------|
| httpOnly | true | Prevents JavaScript access (XSS protection) |
| secure | true (prod) | HTTPS-only transmission |
| sameSite | Lax | CSRF protection |
| maxAge | 28800000ms | 8-hour session timeout |

#### Rate Limiting
- **Login Attempts**: 5 attempts per IP per 15 minutes
- **Lockout Duration**: 15 minutes after limit exceeded
- **Error Response**: 429 "Too many login attempts, please try again later"

---

### 3.3 Session Management

#### Token Verification Middleware
```javascript
// middleware/auth.js
function verifyToken(req, res, next) {
  const token = req.cookies.authToken;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.shopId = decoded.shopId;
    req.email = decoded.email;
    next();
  });
}
```

#### Protected Routes
| Route | Authentication | Redirect |
|-------|---------------|----------|
| /shop/dashboard | Required | /login.html |
| /api/shop/* | Required | 401 JSON response |
| /api/auth/me | Required | 401 JSON response |

#### Logout Flow
```
1. User clicks logout
   ↓
2. POST /api/auth/logout
   ↓
3. Clear authToken cookie
   ↓
4. Redirect to login page
```

---

### 3.4 Security Best Practices Implemented

#### Password Security
✅ **bcrypt hashing** (10 salt rounds = ~100ms computation)  
✅ **No plaintext storage** anywhere in system  
✅ **Minimum length enforcement** (8 characters)  
✅ **Generic error messages** (no "email exists" vs "wrong password" distinction)

#### Token Security
✅ **Cryptographic randomness** (crypto.randomBytes)  
✅ **64-character tokens** (256-bit entropy)  
✅ **Time-limited validity** (8 hours for auth, 24 hours for files)  
✅ **HTTP-only cookies** (no JavaScript access)

#### API Security
✅ **Rate limiting** on all sensitive endpoints  
✅ **Helmet.js security headers** (XSS, clickjacking protection)  
✅ **CORS configuration** for cross-origin requests  
✅ **Parameterized SQL queries** (SQL injection prevention)  
✅ **Input validation** on all user inputs

---

## 4. APPLICATION WORKFLOW

### 4.1 Customer Upload Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: CUSTOMER SCANS SHOP QR CODE                            │
├─────────────────────────────────────────────────────────────────┤
│ - Shopkeeper displays QR code on screen/printed poster         │
│ - Customer scans with mobile camera                            │
│ - Opens: /upload?token={shop_qr_token}                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: UPLOAD PAGE LOADS                                      │
├─────────────────────────────────────────────────────────────────┤
│ - Validates token: GET /api/upload/validate-token?token=XXX    │
│ - Displays shop name: "Upload to {Shop Name}"                  │
│ - Shows drag-and-drop upload zone                              │
│ - File type selector: General or Private                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: FILE SELECTION & UPLOAD                                │
├─────────────────────────────────────────────────────────────────┤
│ - Customer selects file (drag or click)                        │
│ - Client validates: file type, size (<10MB)                    │
│ - Progress bar displays upload progress                        │
│ - POST /api/upload?token={shop_token}                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: SERVER PROCESSING                                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Multer receives file stream                                 │
│ 2. Extension validation (PDF/JPG/PNG/DOCX)                     │
│ 3. MIME type validation                                        │
│ 4. Magic bytes validation (file signature)                     │
│ 5. Size validation (<10MB)                                     │
│ 6. Generate File ID: 070926-001                                │
│ 7. Generate secure token: 64-char hex                          │
│ 8. Move file to: cache/uploads/070926-001.pdf                  │
│ 9. Create database record                                      │
│ 10. Generate print QR code                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: SUCCESS SCREEN                                         │
├─────────────────────────────────────────────────────────────────┤
│ Display:                                                        │
│ ✅ File ID: 070926-001                                         │
│ ✅ File Name: document.pdf                                     │
│ ✅ File Size: 2.5 MB                                           │
│ ✅ Expires: Oct 8, 2026 1:30 PM                                │
│ ✅ Print QR Code (large, scannable)                            │
│ ✅ For Private Files: Security Key (6-digit numeric)           │
│                                                                 │
│ Instructions: "Show this QR code to the shopkeeper"            │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Shopkeeper Print Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: SCAN CUSTOMER'S PRINT QR CODE                          │
├─────────────────────────────────────────────────────────────────┤
│ - Customer shows print QR on phone                             │
│ - Shopkeeper scans with any QR scanner                         │
│ - Opens: /print/{secure_token}                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: PRINT PAGE LOADS                                       │
├─────────────────────────────────────────────────────────────────┤
│ - GET /api/print/{secure_token}                                │
│ - Validates token and expiration                               │
│ - Retrieves file metadata                                      │
│ - If private file: prompts for security key                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: FILE PREVIEW                                           │
├─────────────────────────────────────────────────────────────────┤
│ Display:                                                        │
│ - File ID: 070926-001                                          │
│ - File Name: document.pdf                                      │
│ - File Size: 2.5 MB                                            │
│ - Upload Time: Oct 7, 2026 1:30 PM                             │
│ - Expires In: 23h 45m                                          │
│                                                                 │
│ Preview:                                                        │
│ - PDF: Rendered with PDF.js (scrollable, all pages)            │
│ - Images: Full-size display with zoom                          │
│ - DOCX: Download prompt (browser cannot preview)               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: PRINT EXECUTION                                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. Shopkeeper clicks "PRINT" button                            │
│ 2. Browser print dialog opens                                  │
│ 3. Shopkeeper selects printer and settings                     │
│ 4. Prints document                                             │
│ 5. JavaScript: POST /api/print/{token}/printed                 │
│ 6. Database: UPDATE status='printed', printed_at=NOW()         │
│ 7. Success message displayed                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4.3 Shopkeeper Dashboard Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│ LOGIN                                                           │
├─────────────────────────────────────────────────────────────────┤
│ 1. Navigate to /login                                          │
│ 2. Enter email and password                                    │
│ 3. JWT token stored in HTTP-only cookie                        │
│ 4. Redirect to /shop/dashboard                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DASHBOARD FEATURES                                             │
├─────────────────────────────────────────────────────────────────┤
│ Section 1: SHOP QR CODE                                        │
│ - Large QR code display                                        │
│ - Countdown timer (24h validity)                               │
│ - Refresh button (generates new token)                         │
│ - Download QR as image                                         │
│                                                                 │
│ Section 2: TODAY'S FILES                                       │
│ - Real-time list of uploaded files                             │
│ - Columns: File ID, Name, Size, Status, Time                   │
│ - Status indicators: Active, Printed, Expired                  │
│ - Quick print button (opens print page)                        │
│                                                                 │
│ Section 3: SHOP INFO                                           │
│ - Shop name                                                    │
│ - Owner name                                                   │
│ - Shop ID                                                      │
│ - Logout button                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. FEASIBILITY ANALYSIS

### 5.1 Technical Feasibility

#### ✅ Strengths
| Aspect | Feasibility | Evidence |
|--------|-------------|----------|
| **Technology Maturity** | High | All dependencies are stable, production-proven libraries |
| **Deployment Simplicity** | High | Single-server architecture, no cloud dependencies |
| **Scalability** | Medium | Suitable for single shop or small chain (< 10 locations) |
| **Maintenance** | High | Minimal dependencies, self-contained system |
| **Cost** | High | Zero cloud costs, only hosting required |

#### ⚠️ Limitations
- **Concurrent Users**: SQLite supports 1 writer at a time (readers unlimited)
- **File Storage**: Local storage not suitable for multi-server deployments
- **Geographic Distribution**: No CDN, files served from single location
- **Database Backup**: Manual backup strategy required

---

### 5.2 Business Feasibility

#### Target Market
- **Primary**: Small to medium stationery/printing shops
- **Secondary**: Copy centers, print-on-demand businesses
- **Market Size**: 50,000+ printing shops in India alone

#### Value Proposition
✅ **Eliminates Manual File Transfer**: No USB drives, email, WhatsApp  
✅ **Reduces Customer Friction**: Anonymous, no app installation  
✅ **Improves Efficiency**: Instant file access, no customer phone handling  
✅ **Professional Image**: Modern, tech-forward branding  
✅ **Cost-Effective**: One-time setup, minimal ongoing costs

#### Revenue Model (Future Enhancements)
1. **One-time License Fee**: $50-200 per shop
2. **Subscription Model**: $10-20/month per shop
3. **SaaS Model**: Cloud-hosted, $15-30/month
4. **White-label Solutions**: Custom branding for chains

---

### 5.3 Operational Feasibility

#### Deployment Requirements
| Requirement | Specification | Cost Estimate |
|-------------|--------------|---------------|
| **Server** | VPS with 1GB RAM, 20GB SSD | $5-10/month |
| **Domain** | .com/.in domain | $10-15/year |
| **SSL Certificate** | Let's Encrypt (free) or paid | $0-50/year |
| **Backup Storage** | 10GB cloud storage | $0-5/month |
| **Total Monthly** | - | $5-15/month |

#### Technical Skills Required
- **Deployment**: Basic Linux server management
- **Maintenance**: Node.js basics, PM2 process management
- **Troubleshooting**: Log reading, database queries
- **Skill Level**: Junior developer or tech-savvy shop owner

#### Daily Operations
- **Monitoring**: Check server status (5 minutes/day)
- **Cleanup**: Automatic (no manual intervention)
- **Backups**: Automated daily backups (optional)
- **Support**: Minimal (QR code questions only)

---

## 6. RISK ASSESSMENT & MITIGATION

### 6.1 Security Risks

#### HIGH RISK: Data Breach / Unauthorized File Access
**Risk Level:** 🔴 High  
**Impact:** Customer data exposure, legal liability  
**Likelihood:** Medium (if not properly secured)

**Mitigation Strategies:**
✅ **Implemented:**
- Cryptographic secure tokens (64-char hex = 256-bit entropy)
- HTTP-only cookies (XSS prevention)
- Rate limiting on all endpoints
- Helmet.js security headers
- Parameterized SQL queries (SQL injection prevention)
- File magic byte validation
- Path traversal prevention

⚠️ **Additional Recommendations:**
- Deploy behind HTTPS/TLS (mandatory in production)
- Implement Content Security Policy (CSP) headers
- Regular security audits (quarterly)
- Penetration testing before production launch
- OWASP Top 10 vulnerability scanning

---

#### MEDIUM RISK: Password Compromise
**Risk Level:** 🟡 Medium  
**Impact:** Shop account takeover  
**Likelihood:** Low-Medium

**Mitigation Strategies:**
✅ **Implemented:**
- bcrypt hashing (10 salt rounds)
- Rate limiting (5 login attempts per 15 min)
- Generic error messages

⚠️ **Additional Recommendations:**
- Implement 2FA/OTP (SMS or email)
- Password strength meter on signup
- Breach detection (Have I Been Pwned API)
- Password expiration policy (90-180 days)
- Account lockout after 10 failed attempts

---

#### MEDIUM RISK: File Upload Exploits
**Risk Level:** 🟡 Medium  
**Impact:** Server compromise, malware hosting  
**Likelihood:** Low (well-mitigated)

**Mitigation Strategies:**
✅ **Implemented:**
- Multi-layer validation (extension, MIME, magic bytes)
- File size limits (10 MB)
- No server-side file execution
- Files served with correct Content-Type headers

⚠️ **Additional Recommendations:**
- Virus/malware scanning (ClamAV integration)
- Sandboxed file preview generation
- Content-Disposition: attachment for downloads
- Separate domain for file serving (e.g., files.example.com)

---

### 6.2 Operational Risks

#### HIGH RISK: Data Loss
**Risk Level:** 🔴 High  
**Impact:** Business-critical data permanently lost  
**Likelihood:** Medium (without backups)

**Mitigation Strategies:**
⚠️ **Requires Implementation:**
```bash
# Daily database backup
0 2 * * * cp /app/database/stationery.db /backups/stationery_$(date +\%Y\%m\%d).db

# Retain 7 days of backups
0 3 * * * find /backups -name "*.db" -mtime +7 -delete

# Off-site backup (AWS S3, Google Cloud Storage)
0 4 * * * aws s3 sync /backups s3://my-bucket/db-backups/
```

**Backup Strategy:**
1. **Daily automated backups** of SQLite database
2. **7-day retention** of local backups
3. **Off-site replication** to cloud storage
4. **Monthly backup testing** (restore to test environment)
5. **Disaster recovery plan** documentation

---

#### MEDIUM RISK: Server Downtime
**Risk Level:** 🟡 Medium  
**Impact:** Service unavailable, customer frustration  
**Likelihood:** Medium

**Mitigation Strategies:**
✅ **Implemented:**
- Graceful shutdown handling
- Process cleanup on SIGINT/SIGTERM

⚠️ **Additional Recommendations:**
```bash
# PM2 process manager (auto-restart)
npm install -g pm2
pm2 start server.js --name stationery-print
pm2 startup  # Auto-start on boot
pm2 save

# Health check monitoring
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

**Monitoring Setup:**
- Uptime monitoring (UptimeRobot, Pingdom)
- Error alerting (email/SMS on crashes)
- Resource monitoring (CPU, RAM, disk usage)
- Log aggregation (centralized logging)

---

#### LOW RISK: Disk Space Exhaustion
**Risk Level:** 🟢 Low  
**Impact:** Upload failures, service degradation  
**Likelihood:** Low (automatic cleanup)

**Mitigation Strategies:**
✅ **Implemented:**
- Automatic midnight cleanup
- 24-hour file expiration
- Startup cleanup of orphaned files

⚠️ **Monitoring:**
```bash
# Disk usage alert (90% threshold)
DISK_USAGE=$(df -h /app/cache | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
  echo "CRITICAL: Disk usage at ${DISK_USAGE}%" | mail -s "Disk Alert" admin@example.com
fi
```

---

### 6.3 Business Risks

#### MEDIUM RISK: Low User Adoption
**Risk Level:** 🟡 Medium  
**Impact:** System unused, ROI not achieved  
**Likelihood:** Medium

**Mitigation Strategies:**
- **User Education**: Simple tutorial videos (< 2 minutes)
- **Onboarding**: First-time user tooltips
- **Signage**: Professional QR code posters with instructions
- **Trial Period**: Free 30-day trial for new shops
- **Support**: WhatsApp/email support channel

---

#### LOW RISK: Regulatory Compliance
**Risk Level:** 🟢 Low  
**Impact:** Legal penalties, data protection violations  
**Likelihood:** Low (minimal PII collected)

**Compliance Considerations:**
✅ **GDPR/DPDPA Readiness:**
- Minimal PII collection (only shop email)
- No customer personal data stored
- Automatic data deletion (24 hours)
- Cookie consent implementation

⚠️ **Additional Steps:**
- Privacy policy documentation
- Terms of service
- Data retention policy
- Right to erasure implementation (account deletion)

---

### 6.4 Technical Debt Risks

#### MEDIUM RISK: Scalability Limitations
**Risk Level:** 🟡 Medium  
**Impact:** System cannot grow with business  
**Likelihood:** Medium (if shop chain expands)

**Current Limitations:**
- SQLite single-writer bottleneck
- Local file storage (no multi-server)
- No load balancing capability
- No CDN integration

**Migration Path (if scaling needed):**
```
Phase 1: Current (1-5 shops)
└── SQLite + Local Storage

Phase 2: Growth (5-20 shops)
├── PostgreSQL/MySQL migration
├── Shared NFS/NAS storage
└── Vertical scaling (better server)

Phase 3: Enterprise (20+ shops)
├── PostgreSQL with replication
├── S3/Cloud Storage (AWS, Azure, GCP)
├── Load balancer (Nginx, HAProxy)
├── Redis caching layer
└── Horizontal scaling (multiple servers)
```

---

## 7. FUTURE ENHANCEMENTS & ROADMAP

### 7.1 Short-Term (1-3 Months)

#### Feature: Multi-Shop Support
**Status:** Not Implemented  
**Priority:** High  
**Description:** Allow one installation to serve multiple shops with separate dashboards

**Implementation:**
- Sub-domain routing: `shop1.printapp.com`, `shop2.printapp.com`
- Shop selection on login
- Tenant isolation in database
- Per-shop QR codes

---

#### Feature: Email/SMS Notifications
**Status:** Not Implemented  
**Priority:** Medium  
**Description:** Send upload confirmation to customer via email/SMS

**Implementation:**
```javascript
// Using Twilio for SMS
const twilio = require('twilio');
const client = twilio(accountSid, authToken);

await client.messages.create({
  body: `File uploaded! ID: ${fileId}. Show QR to print.`,
  from: '+1234567890',
  to: customerPhone
});
```

**Cost:** $0.01-0.05 per SMS

---

### 7.2 Medium-Term (3-6 Months)

#### Feature: Payment Integration
**Status:** Not Implemented  
**Priority:** High  
**Description:** Accept online payments for print jobs

**Integration Options:**
- Razorpay (India) - 2% transaction fee
- Stripe (International) - 2.9% + $0.30
- PayPal - 3.5% + fixed fee

**Workflow:**
```
1. Customer uploads file
2. System calculates cost (pages × rate)
3. Payment gateway integration
4. Payment confirmation
5. QR code generated after payment
```

---

#### Feature: Admin Analytics Dashboard
**Status:** Not Implemented  
**Priority:** Medium  
**Description:** Business intelligence and reporting

**Metrics:**
- Daily/weekly/monthly upload volume
- Revenue tracking (if payment integrated)
- Peak hours analysis
- File type distribution
- Average file size
- Customer return rate

**Visualization:**
- Chart.js for graphs
- Export to PDF/Excel
- Email reports

---

### 7.3 Long-Term (6-12 Months)

#### Feature: Mobile App (React Native)
**Status:** Not Implemented  
**Priority:** Medium  
**Description:** Native mobile app for enhanced UX

**Features:**
- Built-in QR scanner
- File upload from gallery
- Push notifications
- Offline queue
- Apple Pay / Google Pay integration

---

#### Feature: Cloud Storage Migration
**Status:** Not Implemented  
**Priority:** High (for scaling)  
**Description:** Move from local storage to AWS S3/Azure Blob

**Benefits:**
- Unlimited scalability
- Multi-region availability
- Automatic backups
- CDN integration (CloudFront)

**Implementation:**
```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

async function uploadToS3(file) {
  return s3.upload({
    Bucket: 'print-files',
    Key: `${shopId}/${fileId}.pdf`,
    Body: fs.createReadStream(file.path),
    ServerSideEncryption: 'AES256'
  }).promise();
}
```

**Cost:** $0.023 per GB/month (S3 Standard)

---

## 8. DEPLOYMENT GUIDE

### 8.1 Production Deployment Checklist

#### Pre-Deployment
- [ ] Change default shop credentials
- [ ] Generate strong JWT_SECRET (32+ random characters)
- [ ] Set `NODE_ENV=production`
- [ ] Configure firewall rules (allow 80, 443; block 3000)
- [ ] Set up SSL certificate (Let's Encrypt)
- [ ] Configure domain DNS (A record to server IP)
- [ ] Set up database backup automation
- [ ] Configure log rotation
- [ ] Set up monitoring (UptimeRobot, PM2)
- [ ] Test disaster recovery procedure

---

### 8.2 Deployment Options

#### Option 1: Linux VPS (Recommended)
**Providers:** DigitalOcean, Linode, Vultr, AWS EC2

```bash
# 1. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install PM2
sudo npm install -g pm2

# 3. Clone/upload project
cd /opt
sudo git clone <repo-url> stationery-print
cd stationery-print

# 4. Install dependencies
npm install --production

# 5. Configure environment
sudo nano .env
# Set JWT_SECRET, NODE_ENV=production

# 6. Start with PM2
pm2 start server.js --name stationery-print
pm2 startup
pm2 save

# 7. Configure Nginx reverse proxy
sudo apt install nginx
sudo nano /etc/nginx/sites-available/stationery-print

# Nginx config:
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

sudo ln -s /etc/nginx/sites-available/stationery-print /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 8. SSL with Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

**Cost:** $5-10/month (1GB RAM, 25GB SSD)

---

#### Option 2: Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p cache/uploads database

EXPOSE 3000

CMD ["npm", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./cache:/app/cache
      - ./database:/app/database
    restart: unless-stopped
```

**Deployment:**
```bash
docker-compose up -d
```

---

#### Option 3: Windows Server

```powershell
# 1. Install Node.js from nodejs.org

# 2. Install NSSM (Non-Sucking Service Manager)
choco install nssm

# 3. Create Windows Service
nssm install StationeryPrint "C:\Program Files\nodejs\node.exe"
nssm set StationeryPrint AppDirectory "D:\StationeryPrint"
nssm set StationeryPrint AppParameters "server.js"
nssm set StationeryPrint AppEnvironmentExtra NODE_ENV=production

# 4. Start service
nssm start StationeryPrint

# 5. Configure IIS reverse proxy (ARR module)
```

---

## 9. MAINTENANCE GUIDE

### 9.1 Daily Maintenance

**Automated Tasks:**
✅ Midnight file cleanup (cron job)  
✅ Process auto-restart (PM2)  
✅ Log rotation (PM2-logrotate)

**Manual Checks (5 minutes):**
- [ ] Check server uptime: `pm2 status`
- [ ] Review error logs: `pm2 logs --err`
- [ ] Check disk usage: `df -h`
- [ ] Verify backup success

---

### 9.2 Weekly Maintenance

- [ ] Review access logs for suspicious activity
- [ ] Check database size: `ls -lh database/stationery.db`
- [ ] Test backup restoration (monthly)
- [ ] Update system packages: `sudo apt update && sudo apt upgrade`

---

### 9.3 Monthly Maintenance

- [ ] Security audit (OWASP ZAP scan)
- [ ] Update Node.js dependencies: `npm outdated && npm update`
- [ ] Review and optimize database (VACUUM)
- [ ] Performance testing (load test with 100 concurrent users)
- [ ] SSL certificate renewal check

---

## 10. TROUBLESHOOTING GUIDE

### Common Issues

#### Issue: "Database is locked"
**Cause:** Multiple processes accessing SQLite  
**Solution:**
```bash
# Check running processes
pm2 list
# Kill duplicates
pm2 delete <id>
```

---

#### Issue: "Upload failed - File too large"
**Cause:** File exceeds 10MB limit  
**Solution:** Increase `MAX_FILE_SIZE` in `.env`
```env
MAX_FILE_SIZE=20971520  # 20 MB
```

---

#### Issue: "QR code expired"
**Cause:** Token older than 24 hours  
**Solution:** Shopkeeper generates new QR from dashboard

---

#### Issue: "PDF preview not loading"
**Cause:** PDF.js library not loaded  
**Solution:** Check CDN availability, use local fallback

---

## 11. CONCLUSION

### Project Viability: ✅ HIGHLY VIABLE

**Strengths:**
- ✅ Production-ready codebase
- ✅ Comprehensive security implementation
- ✅ Low operational costs ($5-15/month)
- ✅ Minimal technical expertise required
- ✅ Clear value proposition for target market
- ✅ Automatic maintenance (cleanup service)

**Recommended Actions:**
1. **Immediate:** Deploy to production with SSL/HTTPS
2. **Week 1:** Pilot test with 2-3 friendly shops
3. **Month 1:** Implement automated backups
4. **Month 2:** Add payment integration
5. **Month 3:** Launch marketing campaign

**Success Metrics:**
- **Target:** 10 shops onboarded in 3 months
- **KPI:** 80% daily active usage rate
- **ROI:** Break-even at 20 shops ($15/month subscription)

---

## APPENDIX A: ENVIRONMENT VARIABLES

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Security
JWT_SECRET=<64-char-random-hex-string>

# File Upload
UPLOAD_DIR=./cache/uploads
MAX_FILE_SIZE=10485760  # 10 MB

# Session
SESSION_EXPIRY=8h

# Optional
BASE_URL=https://yourdomain.com
LOG_LEVEL=info
```

---

## APPENDIX B: API REFERENCE

### Authentication Endpoints

#### POST /api/auth/signup
**Request:**
```json
{
  "email": "shop@example.com",
  "password": "securepass123",
  "shopName": "My Print Shop",
  "ownerName": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "shopId": "FE1BB62509D8057B",
  "shopName": "My Print Shop",
  "email": "shop@example.com",
  "qrToken": "a1b2c3d4..."
}
```

---

#### POST /api/auth/login
**Request:**
```json
{
  "email": "shop@example.com",
  "password": "securepass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "shopId": "FE1BB62509D8057B",
  "shopName": "My Print Shop"
}
```
**Note:** JWT token set in HTTP-only cookie

---

### Upload Endpoints

#### POST /api/upload?token={qr_token}
**Request:** multipart/form-data
- `file`: File (PDF/JPG/PNG/DOCX)
- `fileType`: "general" or "private"

**Response (200):**
```json
{
  "success": true,
  "fileId": "070926-001",
  "fileName": "document.pdf",
  "fileSize": 2621440,
  "expiresAt": "2026-10-08T13:30:00.000Z",
  "secureToken": "abc123...",
  "fileType": "general",
  "printQR": "data:image/png;base64,...",
  "printUrl": "https://domain.com/print/abc123..."
}
```

---

### Print Endpoints

#### GET /api/print/:token
**Response (200):**
```json
{
  "file": {
    "fileId": "070926-001",
    "fileName": "document.pdf",
    "fileSize": 2621440,
    "mimeType": "application/pdf",
    "uploadTime": "2026-10-07T13:30:00.000Z",
    "expiresAt": "2026-10-08T13:30:00.000Z",
    "fileType": "general"
  }
}
```

---

#### POST /api/print/:token/printed
**Response (200):**
```json
{
  "success": true,
  "message": "File marked as printed"
}
```

---

## APPENDIX C: DATABASE QUERIES

### Useful Management Queries

```sql
-- Get total files uploaded today
SELECT COUNT(*) FROM print_jobs 
WHERE DATE(upload_time) = DATE('now', 'localtime');

-- Get total files by status
SELECT status, COUNT(*) as count 
FROM print_jobs 
GROUP BY status;

-- Get top 10 largest files
SELECT file_id, original_filename, file_size 
FROM print_jobs 
ORDER BY file_size DESC 
LIMIT 10;

-- Get expired but not cleaned files
SELECT * FROM print_jobs 
WHERE expires_at < datetime('now') 
AND status = 'active';

-- Get shop statistics
SELECT 
  shop_id,
  COUNT(*) as total_files,
  SUM(CASE WHEN status='printed' THEN 1 ELSE 0 END) as printed,
  SUM(file_size) as total_size
FROM print_jobs
GROUP BY shop_id;

-- Clean up old expired records (manually)
DELETE FROM print_jobs 
WHERE status = 'expired' 
AND expires_at < datetime('now', '-30 days');
```

---

## DOCUMENT REVISION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | Oct 7, 2026 | System | Initial comprehensive documentation |

---

**END OF DOCUMENT**

Total Pages: 30+ (when converted to Word format)  
Document Size: ~15,000 words  
Last Updated: October 7, 2026

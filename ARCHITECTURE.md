# 🏗️ SteganoVault - Architecture Deep Dive

> A comprehensive look at the system design, architectural decisions, and trade-offs behind SteganoVault.

---

## 📋 Table of Contents

- [System Overview](#-system-overview)
- [Architectural Principles](#-architectural-principles)
- [High-Level Architecture](#-high-level-architecture)
- [Container Design](#-container-design)
- [Data Layer Design](#-data-layer-design)
- [API Design](#-api-design)
- [Frontend Architecture](#-frontend-architecture)
- [Security Architecture](#-security-architecture)
- [Design Decisions & Trade-offs](#-design-decisions--trade-offs)
- [Scalability Roadmap](#-scalability-roadmap)
- [Lessons Learned](#-lessons-learned)

---

## 🎯 System Overview

**SteganoVault** is a **containerized microservices application** for hiding secret messages inside ordinary files. It processes images, PDFs, DOCX, audio, and video — offering an intuitive web interface backed by a Flask + MySQL + Nginx stack.

### Core Requirements

| Requirement | Design Choice |
|-------------|---------------|
| **Multi-format support** | Pluggable encoder architecture |
| **Real-time processing** | Synchronous HTTP (no queues) |
| **User accounts** | Session-based auth + BCrypt |
| **Horizontal scalability** | Stateless app + shared DB |
| **Zero data retention** | Temp file + immediate cleanup |
| **One-command deployment** | Docker Compose |

### Non-Functional Requirements

| Category | Target | Actual |
|----------|--------|--------|
| **Latency (encode)** | < 1s for 1 MB | ~0.3s |
| **Concurrent users** | 100+ | 4 concurrent (2 workers × 2 threads) |
| **Availability** | Best effort | Depends on Docker host |
| **Data retention** | Zero on user files | Immediate cleanup |
| **Build time** | One-time | 8-15 min first, 30s cached |

---

## 🧭 Architectural Principles

### 1. **Separation of Concerns**

Each container handles **one responsibility**:

- **Nginx** → HTTP routing, static files, TLS
- **Flask** → Business logic, steganography
- **MySQL** → Data persistence
- **phpMyAdmin** → DB administration

### 2. **Stateless Application**

The Flask container holds **no session state on disk**. Sessions are signed cookies. This allows **horizontal scaling** — any worker can serve any request.

### 3. **Fail-Fast Startup**

Containers refuse to start if dependencies aren't healthy:

- `web` waits for `mysql` health check
- `nginx` waits for `web` health check

### 4. **Zero Trust Between Containers**

Even though containers are on the same network, we:

- Use **parameterized SQL queries** (prevents injection)
- **Validate all inputs** (length, format, file type)
- **Sanitize filenames** (`secure_filename`)
- **Enforce client body limits** at Nginx (`100M`)

### 5. **Immutability**

Docker images are **immutable**. Any change requires a rebuild. This ensures:

- **Reproducibility** — same image, same behavior
- **Rollbacks** — `docker compose down` + revert to previous tag
- **Audit trails** — image digest is a fingerprint

### 6. **Configuration Over Code**

All environment-specific values live in `.env`:

- DB credentials
- SMTP credentials
- Google Drive keys
- Secret key

**Same image** runs in dev, staging, and production — only `.env` changes.

---

## 🏛 High-Level Architecture

### System Context Diagram

```
                    ┌───────────────────────────┐
                    │                           │
                    │       End User            │
                    │     (Web Browser)         │
                    │                           │
                    └─────────────┬─────────────┘
                                  │
                                  │ HTTPS
                                  ▼
            ┌────────────────────────────────────────┐
            │                                        │
            │        SteganoVault Platform           │
            │                                        │
            │  ┌──────────┐      ┌──────────┐       │
            │  │  Nginx   │      │   Web    │       │
            │  │ (Proxy)  │─────▶│ (Flask)  │       │
            │  └──────────┘      └────┬─────┘       │
            │                         │              │
            │                         │              │
            │                    ┌────▼─────┐        │
            │                    │  MySQL   │        │
            │                    │  (Data)  │        │
            │                    └──────────┘        │
            │                                        │
            │  ┌──────────┐                          │
            │  │phpMyAdmin│──────▶ MySQL              │
            │  │ (Admin)  │                          │
            │  └──────────┘                          │
            │                                        │
            └────────────────┬───────────────────────┘
                             │
                             │ Optional Integration
                             ▼
                    ┌─────────────────────┐
                    │   External APIs     │
                    │                     │
                    │ • Google Drive API  │
                    │ • SMTP (Brevo)      │
                    └─────────────────────┘
```

### Container Interaction Matrix

| From ↓ / To → | MySQL | Web | Nginx | phpMyAdmin | Host |
|---------------|-------|-----|-------|------------|------|
| **MySQL** | — | ✗ | ✗ | ✗ | Port 3306 |
| **Web** | ✅ `mysql:3306` | — | ✗ | ✗ | ✗ |
| **Nginx** | ✗ | ✅ `web:5000` | — | ✗ | Port 80 |
| **phpMyAdmin** | ✅ `mysql:3306` | ✗ | ✗ | — | Port 8081 |
| **Host** | ✅ `localhost:3306` | ✗ | ✅ `localhost:80` | ✅ `localhost:8081` | — |

---

## 📦 Container Design

### 1. `steganovault-web` (Flask Application)

**Base Image:** `python:3.10-slim`

**Custom Dockerfile:**

```dockerfile
FROM python:3.10-slim

# 1. System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \                       # For pydub audio processing
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 libgomp1 \   # OpenCV
    libsndfile1 \                  # Audio file I/O
    curl \                         # Health check
    gcc g++ pkg-config \           # C/C++ compilers for pip
    default-libmysqlclient-dev \   # MySQL client lib
    && rm -rf /var/lib/apt/lists/*

# 2. Python dependencies
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Application code
COPY . .

# 4. Runtime setup
RUN mkdir -p static/css static/js static/images logs tmp
RUN chmod +x scripts/entrypoint.sh

EXPOSE 5000

# 5. Startup
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:5000", \
     "--workers", "2", "--threads", "2", \
     "--timeout", "120", "app:app"]
```

**Rationale for each choice:**

| Choice | Reason |
|--------|--------|
| `python:3.10-slim` | Balances size (~150 MB) with compatibility |
| `ffmpeg` | Required by `pydub` for MP3/WAV decoding |
| `libgl1` etc. | OpenCV runtime dependencies |
| `--no-install-recommends` | Skip optional packages, save 50+ MB |
| `COPY requirements.txt` first | Layer caching — only reinstalls if deps change |
| `--workers 2` | 2 × CPU + 1 rule (for 1-2 core machine) |
| `--threads 2` | I/O concurrency within each worker |

**Image size:** ~800 MB (mostly FFmpeg + OpenCV)

**Alternative considered:** `python:3.10-alpine` — 3x smaller but requires compiling many packages (no prebuilt wheels) — rejected for build-time cost.

---

### 2. `steganovault-mysql` (Database)

**Base Image:** `mysql:8.0`

**Configuration:**

```yaml
environment:
  MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpassword123}
  MYSQL_DATABASE: ${MYSQL_DATABASE:-steganovault}
  MYSQL_USER: ${MYSQL_USER:-stegano}
  MYSQL_PASSWORD: ${MYSQL_PASSWORD:-stegano123}

volumes:
  - mysql-data:/var/lib/mysql                          # Persistence
  - ./init-db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro  # Auto-init

healthcheck:
  test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
  interval: 10s
  timeout: 5s
  retries: 10
  start_period: 30s
```

**Why MySQL 8.0?**

- ✅ ACID transactions (needed for user registration)
- ✅ JSON support (future-proofing)
- ✅ Window functions
- ✅ Better default charset (utf8mb4)
- ✅ Official Docker image with healthcheck support

**Alternative considered:** PostgreSQL — richer feature set but overkill for this project.

---

### 3. `steganovault-nginx` (Reverse Proxy)

**Base Image:** `nginx:alpine`

**Why Alpine?** 5 MB vs 20+ MB for Debian-based Nginx. Perfect for a stateless proxy.

**Key responsibilities:**

1. **Static file serving** — CSS/JS/images served directly from disk
2. **Reverse proxy** — Forward dynamic requests to Flask
3. **Gzip compression** — Reduce bandwidth for text responses
4. **Client body limit** — Reject uploads > 100 MB (protects backend)
5. **Timeout control** — `proxy_read_timeout 300s` for large file processing

**Sample config:**

```nginx
upstream steganovault_backend {
    server web:5000;
    keepalive 32;   # Persistent connections to backend
}

location / {
    proxy_pass http://steganovault_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location /static/ {
    proxy_pass http://steganovault_backend/static/;
    add_header Cache-Control "no-store, no-cache" always;
    expires -1;
}

location /encode {
    proxy_pass http://steganovault_backend;
    client_max_body_size 100M;
    proxy_read_timeout 300s;
}
```

---

### 4. `steganovault-phpmyadmin` (DB Admin)

**Base Image:** `phpmyadmin:latest`

**Why phpMyAdmin?**

- **Zero-config browser UI** for MySQL
- **Backed by official PHP project**
- **Quick debugging** without CLI
- **Disposable** — for local/dev use only

**Port:** `8081:80` (8081 on host to avoid conflicts)

---

## 💾 Data Layer Design

### Schema Design

```sql
-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,           -- BCrypt hash (~60 chars)
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email)                   -- Fast lookups
);
```

**Design rationale:**

- **`UNIQUE` on email** — Enforces one account per email at DB level
- **`VARCHAR(255) for password`** — BCrypt hashes are ~60 chars; 255 is future-proof
- **`verified` boolean** — Enables email verification workflow without schema change
- **`INDEX idx_email`** — Every login queries by email → O(log n)

```sql
-- ============================================
-- OTP STORAGE TABLE
-- ============================================
CREATE TABLE otp_storage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,       -- One active OTP per email
    otp VARCHAR(10) NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Design rationale:**

- **`UNIQUE` on email** — Prevents multiple active OTPs; upsert on new request
- **`ON UPDATE CURRENT_TIMESTAMP`** — Auto-refreshes on OTP regeneration
- **No foreign key to users** — Decouples OTP lifecycle from user record

```sql
-- ============================================
-- REVIEWS TABLE
-- ============================================
CREATE TABLE reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    verified BOOLEAN DEFAULT TRUE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reviews_email (user_email),
    INDEX idx_reviews_time (timestamp DESC)
);
```

**Design rationale:**

- **`user_email` foreign key-like** — Denormalized for JOIN-less reads
- **`name` duplicated** — Avoids JOIN when displaying reviews
- **`CHECK rating BETWEEN 1 AND 5`** — Data validation at DB level
- **`INDEX on timestamp DESC`** — Fast "latest reviews" queries

### Indexing Strategy

| Index | Column | Reason |
|-------|--------|--------|
| `PRIMARY KEY` | `id` | Auto-created, used in updates |
| `UNIQUE` | `email` (users) | Prevents duplicate accounts |
| `idx_email` | `email` (users) | Login lookups |
| `idx_reviews_email` | `user_email` | User's reviews query |
| `idx_reviews_time` | `timestamp DESC` | Latest reviews ordering |

**Deliberately NOT indexed:**

- `name` — rarely filtered
- `text` — TEXT columns are expensive to index
- `password` — never searched

### Connection Pooling

```python
db_pool = pooling.MySQLConnectionPool(
    pool_name="stegano_pool",
    pool_size=10,              # Max concurrent connections
    pool_reset_session=True,   # Clean session between uses
    **MYSQL_CONFIG
)
```

**Why 10?** 

- 2 Gunicorn workers × 2 threads = 4 concurrent requests
- Headroom for retries and admin queries
- MySQL default `max_connections = 151` — well within limit

**Alternative considered:** Connection per request — 50ms overhead each, unsustainable under load.

---

## 🔌 API Design

### RESTful Principles

- **Resource-based URLs** — `/api/reviews`, `/encode`, `/decode`
- **Standard HTTP verbs** — `GET`, `POST` (only two needed)
- **JSON bodies** — For structured data
- **Multipart forms** — For file uploads
- **Consistent status codes** — 200, 400, 401, 404, 500

### Endpoint Categories

| Category | Prefix | Auth | Purpose |
|----------|--------|------|---------|
| **File Processing** | `/encode`, `/decode` | Public | Core functionality |
| **Authentication** | `/auth/*` | Mixed | User management |
| **Community** | `/api/*` | Mixed | Reviews, testimonials |
| **System** | `/health`, `/privacy` | Public | Monitoring |

### Response Conventions

**Success (JSON):**

```json
{
    "status": "success",
    "message": "Review submitted",
    "review": { "name": "...", "text": "...", "rating": 5 }
}
```

**Error (JSON):**

```json
{
    "error": "Invalid credentials"
}
```

**File Response (binary):**

```http
HTTP/1.1 200 OK
Content-Type: image/png
Content-Disposition: attachment; filename="encoded_uuid_image.png"
X-Response-Data: {"status":"success","checksum":"abc123...","processing_time":0.31}
```

**Why custom `X-Response-Data` header?** Allows sending both a binary file AND metadata in one request — avoids two round trips.

### HTTP Status Codes Used

| Code | Meaning | When |
|------|---------|------|
| **200** | OK | Successful request |
| **400** | Bad Request | Missing/invalid parameters |
| **401** | Unauthorized | Auth required but missing |
| **403** | Forbidden | Email not verified |
| **404** | Not Found | User/resource not found |
| **500** | Server Error | Encoding failure, DB error |
| **503** | Service Unavailable | Health check degraded |

---

## 🎨 Frontend Architecture

### Component Structure

```
┌─────────────────────────────────────────────────────┐
│                    index.html                        │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  <head>                                     │    │
│  │    • Tailwind CDN                           │    │
│  │    • Font Awesome                           │    │
│  │    • Motion One                             │    │
│  │    • EmailJS                                │    │
│  │    • SparkAgent Chatbot                     │    │
│  │    • Custom CSS (style.css)                 │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  <body>                                     │    │
│  │    • Navbar (theme selector, auth button)   │    │
│  │    • Hero (title, subtitle)                 │    │
│  │    • Tutorial (3 steps)                     │    │
│  │    • Encode/Decode Section                  │    │
│  │    • User Reviews                           │    │
│  │    • Testimonials Carousel                  │    │
│  │    • How It Works (grid cards)              │    │
│  │    • Fun Activities (game)                  │    │
│  │    • Contributors                           │    │
│  │    • Contact Form                           │    │
│  │    • Footer                                 │    │
│  │    • Modals (info, badges, auth, etc.)      │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  <script>                                   │    │
│  │    • static/js/app.js                       │    │
│  └────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### CSS Architecture

**Design system:**

- **CSS Variables** — Theme colors per `data-theme` attribute
- **Utility classes** — Tailwind + custom `.glow-effect`, `.motion-button`
- **Animations** — `@keyframes` for gradient motion, spin, fadeIn
- **Responsive** — Mobile-first with 4 breakpoints

**Theme system:**

```css
[data-theme="dark"] {
    --bg-color: #1a202c;
    --text-color: #e2e8f0;
    --glow-color: #00ffcc;
}

[data-theme="cyberpunk"] {
    --bg-color: #0d0b1e;
    --text-color: #00ffcc;
    --glow-color: #ff00ff;
}
/* ... 11 total themes */
```

**Why 11 themes?** Personalization + demonstrates CSS variable mastery. Zero JS overhead — theme switch is just an attribute change.

### JavaScript Architecture

**Single-file approach** (`app.js`, ~850 lines):

```
app.js
├── Initialization (DOMContentLoaded)
├── Theme switcher
├── Drag & drop
├── Encode/decode handlers
├── Stealth score & badges
├── Modals
├── Game (Spy Target Practice)
├── Contact form (EmailJS)
├── Reviews (fetch + render)
└── Authentication (login, register, OTP, reset)
```

**Why one file?** Small project — no bundler needed. Keeps it simple.

**For larger apps:** Split into modules (`auth.js`, `game.js`, etc.) with ES6 imports.

### API Communication

**Fetch API with async/await:**

```javascript
async function encodeFile() {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('message', message);
    formData.append('password', password);

    try {
        const response = await fetch('/encode', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        // Parse metadata from custom header
        const metadata = JSON.parse(response.headers.get('X-Response-Data'));
        
        // Download file
        const blob = await response.blob();
        triggerDownload(blob, metadata.filename);
    } catch (error) {
        showError(error.message);
    }
}
```

---

## 🔒 Security Architecture

### Defense in Depth

```
┌──────────────────────────────────────────────────────────┐
│  LAYER 1: NETWORK                                        │
│  • Only Nginx (:80) and phpMyAdmin (:8081) exposed       │
│  • Web and MySQL only reachable from Docker network      │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  LAYER 2: NGINX                                          │
│  • client_max_body_size 100M                             │
│  • Deny access to hidden files (location ~ /\.)          │
│  • Rate limiting (optional, can add)                     │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  LAYER 3: FLASK                                          │
│  • secure_filename() on all uploads                      │
│  • Input validation (email, password length)             │
│  • Security headers (X-Frame-Options, etc.)              │
│  • login_required decorator for protected routes         │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  LAYER 4: DATABASE                                       │
│  • Parameterized queries (%s) — no string concat         │
│  • UNIQUE constraints on email                           │
│  • CHECK constraints on rating                           │
│  • Least-privilege user (stegano, not root)              │
└──────────────────────────────────────────────────────────┘
```

### Authentication Security

**Password storage:**

```python
def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
# Cost factor 12 → ~100ms per hash → makes brute force expensive
```

**Session security:**

- Flask uses **signed cookies** (HMAC-SHA1)
- Secret key in `.env` (not in code)
- `HttpOnly` flag prevents JS access
- `SameSite=Lax` prevents CSRF from other origins

**OTP flow:**

- 6-digit code (1M combinations)
- 5-minute expiry
- One active OTP per email (upsert, not insert)
- Constant-time comparison not needed (OTP is not a password — has expiry)

### File Upload Security

**Threats mitigated:**

| Threat | Mitigation |
|--------|-----------|
| Path traversal (`../../etc/passwd`) | `secure_filename()` |
| Huge files (DoS) | Nginx `client_max_body_size 100M` |
| Malicious MIME | Extension whitelist |
| Temp file leak | `finally: shutil.rmtree()` |
| Cross-user access | Random temp dir per request |

**Sample code:**

```python
filename = secure_filename(uploaded_file.filename)  # "evil.jpg" stays same
temp_dir = tempfile.mkdtemp()                      # /tmp/tmpXXXX (random)
try:
    # ... process ...
finally:
    shutil.rmtree(temp_dir, ignore_errors=True)     # Always cleanup
```

---

## ⚖️ Design Decisions & Trade-offs

### 1. Monolith vs Microservices

**Chosen: Container-based monolith with ancillary services**

| Aspect | Monolith | Microservices | Our Choice |
|--------|----------|---------------|------------|
| **Complexity** | Low | High | ✅ Low (monolith) |
| **Deployment** | Simple | Complex | ✅ Simple (Compose) |
| **Scaling** | Whole app | Per-service | ⚠️ Whole app |
| **Team size** | Small | Large | ✅ Small |

**Rationale:** For a portfolio project with one developer, monolith is the right call. The **file processors are modular** (`encode_image`, `encode_pdf`, etc.) — easy to split later if needed.

---

### 2. Synchronous vs Asynchronous Processing

**Chosen: Synchronous HTTP**

| Aspect | Sync | Async (Queue) | Our Choice |
|--------|------|---------------|------------|
| **Latency** | Predictable | Variable | ✅ Predictable |
| **Complexity** | Simple | Redis + Celery | ✅ Simple |
| **Failure mode** | Timeout | Retry | ⚠️ Sync |
| **Use case** | Small files | Large jobs | ✅ Small files |

**Rationale:** Encode/decode takes < 1s for typical files. Async would add complexity (Redis + worker + polling) without proportional benefit.

**When to switch:** If file processing > 10s, or if we need background job tracking.

---

### 3. Sessions vs JWT

**Chosen: Flask sessions (signed cookies)**

| Aspect | Sessions | JWT | Our Choice |
|--------|----------|-----|------------|
| **Revocation** | Easy (delete from server) | Hard | ✅ Easy |
| **Stateless** | No (needs store) | Yes | ⚠️ No |
| **Size** | Small | Larger | ✅ Small |
| **Server-side storage** | Flask default = cookie-based | None | ✅ None |

**Rationale:** For a small app, Flask's default cookie-based sessions are perfect. No Redis needed, no JWT library complexity.

**When to switch:** If we add a mobile app + web app sharing auth, JWT is better.

---

### 4. Local MySQL vs Managed DB

**Chosen: Local MySQL in Docker**

| Aspect | Local Docker MySQL | Managed (RDS, etc.) | Our Choice |
|--------|-------------------|---------------------|------------|
| **Cost** | Free | $15+/month | ✅ Free |
| **Ops overhead** | DIY backups | Managed | ⚠️ DIY |
| **Performance** | Local network | Remote | ✅ Faster |
| **Portability** | Full control | Provider lock | ✅ Portable |

**Rationale:** Portfolio project — free, fast, portable. For real production with uptime SLAs, managed DB is worth the cost.

---

### 5. Nginx vs Caddy vs Traefik

**Chosen: Nginx**

| Feature | Nginx | Caddy | Traefik | Our Choice |
|---------|-------|-------|---------|------------|
| **Maturity** | 20+ years | 7 years | 7 years | ✅ Nginx |
| **Auto TLS** | Manual | ✅ Auto | ✅ Auto | ⚠️ Manual |
| **Config** | Explicit | Minimal | Dynamic | ✅ Explicit |
| **Docker integration** | Manual | Good | ✅ Best | ⚠️ Manual |

**Rationale:** Nginx is the industry standard, most documented, and best understood by hiring managers.

**When to switch:** If we need dynamic container discovery (K8s), use Traefik. For auto-HTTPS on bare VPS, Caddy is simpler.

---

### 6. Docker Compose vs Kubernetes

**Chosen: Docker Compose**

Already covered in [INTERVIEW_QA.md](INTERVIEW_QA.md#q38). Short version:

- **4 services** on one host = Compose perfect
- **Learning curve** = hours vs weeks
- **K8s value** = multi-node, autoscaling → not needed here

---

### 7. Sync BCrypt vs Async Argon2

**Chosen: BCrypt (sync)**

| Aspect | BCrypt | Argon2 | Our Choice |
|--------|--------|--------|------------|
| **Age** | 1999 | 2015 | ⚠️ Older |
| **Memory-hard** | No | Yes | ⚠️ No |
| **Speed** | ~100ms | ~50ms | Similar |
| **Python support** | ✅ `bcrypt` | ✅ `argon2-cffi` | Both OK |

**Rationale:** BCrypt is battle-tested and universally supported. Argon2 is theoretically stronger (resists GPU attacks) but BCrypt is fine for this use case.

**When to switch:** For high-value apps (banking, crypto), Argon2id is recommended.

---

## 📈 Scalability Roadmap

### Current State (Baseline)

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   1 Nginx    │──▶│   1 Flask    │──▶│   1 MySQL    │
│              │   │  (2 workers) │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
```

**Capacity:** ~100 concurrent users, ~10 req/sec

---

### Level 1: Vertical Scaling

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   1 Nginx    │──▶│   1 Flask    │──▶│   1 MySQL    │
│              │   │  (8 workers) │   │  (bigger box)│
└──────────────┘   └──────────────┘   └──────────────┘
```

**Changes:**

- Increase Docker memory limits
- `--workers 8` (matches CPU cores)
- Increase MySQL buffer pool

**Capacity:** ~500 concurrent users

---

### Level 2: Horizontal Scaling (Web Tier)

```
                    ┌──────────────┐
                 ┌──│   Flask 1    │
┌──────────────┐ │  └──────────────┘
│   Nginx LB   │─┤  ┌──────────────┐
│              │ ├──│   Flask 2    │──┐
└──────────────┘ │  └──────────────┘  │
                 │  ┌──────────────┐  │
                 └──│   Flask 3    │  │
                    └──────────────┘  │
                                      ▼
                              ┌──────────────┐
                              │   1 MySQL    │
                              └──────────────┘
```

**Changes:**

```yaml
web:
  deploy:
    replicas: 3

nginx:
  # Load balancing across web replicas
  upstream backend {
    server web:5000;  # Nginx uses Docker DNS round-robin
  }
```

**Need:** Shared session store (Redis) since containers are now multiple.

**Capacity:** ~1,500 concurrent users

---

### Level 3: Database Scaling

```
                    ┌──────────────┐
                    │   Flask N    │
                    └───────┬──────┘
                            │
                    ┌───────▼──────┐
                    │  ProxySQL    │  (Query router)
                    └───────┬──────┘
                            │
               ┌────────────┼────────────┐
               ▼            ▼            ▼
         ┌──────────┐ ┌──────────┐ ┌──────────┐
         │ MySQL    │ │ MySQL    │ │ MySQL    │
         │ Primary  │ │ Replica1 │ │ Replica2 │
         │ (writes) │ │ (reads)  │ │ (reads)  │
         └──────────┘ └──────────┘ └──────────┘
```

**Changes:**

- **Primary** handles writes (register, review submit)
- **Replicas** handle reads (login, list reviews)
- **ProxySQL** routes queries

**Capacity:** ~5,000 concurrent users

---

### Level 4: Full Production (Kubernetes)

```
                    ┌──────────────┐
                    │  Cloudflare  │  (CDN + WAF)
                    └───────┬──────┘
                            ▼
                    ┌──────────────┐
                    │  Ingress     │  (nginx-ingress)
                    └───────┬──────┘
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
           ┌────────┐ ┌────────┐ ┌────────┐
           │ Flask  │ │ Flask  │ │ Flask  │  (Pods)
           └────┬───┘ └────┬───┘ └────┬───┘
                └──────────┼─────────┘
                           ▼
              ┌────────────────────────┐
              │   Redis (Sessions)     │
              │   S3 (File storage)    │
              │   MySQL Operator (HA)  │
              └────────────────────────┘
```

**Components:**

- **Kubernetes** — Orchestration
- **Helm** — Package management
- **Prometheus + Grafana** — Monitoring
- **Loki** — Log aggregation
- **Cert-Manager** — Auto TLS
- **ArgoCD** — GitOps deployment

**Capacity:** 10,000+ concurrent users

---

### Realistic Recommendation

**For SteganoVault's actual use case (portfolio/demo):**

- ✅ **Level 0 is fine** — single host, Docker Compose
- ⚠️ **Level 1 easy upgrade** — just increase worker count
- 📈 **Level 2+ only if** real production traffic justifies

**Premature optimization is the root of all evil.** Don't add Redis/Postgres/K8s until you actually need them.

---

## 📚 Lessons Learned

### 1. **Environment Variables Are Not Optional**

Early on, I hardcoded DB credentials in `app.py`. This made the app **unshippable** — anyone running it needed to edit source code.

**Fix:** Moved everything to `.env` + `os.environ.get()`.

**Takeaway:** Config lives in environment, not code.

---

### 2. **Healthchecks Prevent Race Conditions**

Without healthchecks, `web` would start before MySQL was ready and crash. Docker would restart it → crash loop.

**Fix:** Added `depends_on: condition: service_healthy`.

**Takeaway:** Assume dependencies will be slow. Design for it.

---

### 3. **Cache Busting Is Mandatory**

After editing CSS/JS, users still saw old versions due to Nginx caching + browser caching. Confusing AF.

**Fix:** Disabled cache in dev, added `?v=N` query strings.

**Takeaway:** Development = no cache. Production = version everything.

---

### 4. **Temp File Cleanup Must Be Guaranteed**

Initially, if encoding failed midway, temp files were left behind. Over time, disk filled up.

**Fix:** Wrapped all processing in `try/finally` with `shutil.rmtree()`.

**Takeaway:** Always clean up on both success AND failure paths.

---

### 5. **Docker Layer Order Matters**

Copying all code before `pip install` meant every code change triggered a full dependency reinstall (~5 min). Painful during development.

**Fix:** `COPY requirements.txt` → `RUN pip install` → `COPY . .`

**Takeaway:** Optimize Dockerfile for the change you'll make most often.

---

### 6. **Logs Are Your Best Friend**

First deployment, `web` kept exiting instantly. Without logs, no way to know why.

**Fix:** `docker compose logs web` revealed a missing env var.

**Takeaway:** Always check logs before guessing.

---

### 7. **Don't Trust the Cache**

Browser said I was running new code, but old code kept executing. Wasted 2 hours debugging "correct" code.

**Fix:** Incognito mode + `Disable Cache` checkbox in DevTools.

**Takeaway:** When in doubt, go incognito.

---

## 🎯 Summary

SteganoVault demonstrates a **pragmatic, production-inspired architecture**:

| Aspect | Choice | Why |
|--------|--------|-----|
| **Containerization** | Docker Compose | Simple, portable, one-command |
| **Web framework** | Flask + Gunicorn | Fast to build, well-known |
| **Database** | MySQL 8.0 | Structured data, ACID |
| **Proxy** | Nginx | Industry standard |
| **Session** | Flask signed cookies | No extra infra |
| **Password** | BCrypt | Battle-tested |
| **Deployment** | Compose on VPS | Fits project scale |

**No premature optimization** — no K8s, no Redis, no message queue. Each can be added when needed, with clear migration paths.

---

## 📖 Related Documentation

- 📘 [USER_GUIDE.md](USER_GUIDE.md) — Complete setup guide
- 🐛 [ISSUES.md](ISSUES.md) — Real problems and solutions
- 💼 [INTERVIEW_QA.md](INTERVIEW_QA.md) — Interview preparation
- 🔄 [WORKFLOW.md](WORKFLOW.md) — How everything connects

---

<div align="center">

**Architecture is about trade-offs, not perfection.**

**Built with ❤️ — Hritik Ranjan**

</div>

# 💼 SteganoVault - Interview Questions & Answers

> Real interview questions (and their answers) that can be asked based on this project. Covers Docker, Flask, MySQL, Nginx, DevOps, System Design, and Backend concepts.

---

## 📋 Table of Contents

- [Docker & Containerization](#-docker--containerization)
- [Docker Compose](#-docker-compose)
- [Nginx & Reverse Proxy](#-nginx--reverse-proxy)
- [Flask & Python Backend](#-flask--python-backend)
- [MySQL & Database Design](#-mysql--database-design)
- [Authentication & Security](#-authentication--security)
- [Steganography Concepts](#-steganography-concepts)
- [System Design](#-system-design)
- [DevOps & Deployment](#-devops--deployment)
- [Behavioral Questions](#-behavioral-questions)

---

## 🐳 Docker & Containerization

### Q1: What is Docker and why did you use it in this project?

**Answer:**

Docker is a containerization platform that packages an application and its dependencies into a single, portable unit called a **container**. Containers share the host OS kernel but have isolated user spaces, making them lightweight compared to virtual machines.

**Why I used Docker in SteganoVault:**

1. **Consistency** — The app runs identically on my laptop, a teammate's machine, and in production. No more "works on my machine" issues.
2. **Isolation** — Flask, MySQL, Nginx, and phpMyAdmin each run in their own container with isolated dependencies.
3. **Portability** — The entire stack ships as a single `docker-compose up` command.
4. **Scalability** — Individual services can be scaled independently.
5. **Reproducibility** — The `Dockerfile` documents every system dependency (FFmpeg, OpenCV libs, etc.) precisely.

---

### Q2: What's the difference between a Docker image and a container?

**Answer:**

| Aspect | Image | Container |
|--------|-------|-----------|
| **Definition** | A read-only template with app code, libraries, and dependencies | A running instance of an image |
| **State** | Static, immutable | Dynamic, has runtime state |
| **Storage** | Stored in registry (Docker Hub) | Runs in memory/disk on host |
| **Analogy** | Class (blueprint) | Object (instance) |
| **Command** | `docker build` | `docker run` |

**In SteganoVault:**

- `steganovault-web:latest` is my **image** (built from `Dockerfile`)
- `steganovault-web` is the **container** (running instance of that image)

You can run **multiple containers from the same image** (e.g., for horizontal scaling).

---

### Q3: Explain your Dockerfile step by step.

**Answer:**

Here's my `Dockerfile` with explanations:

```dockerfile
# 1. Base image — Python 3.10 on Debian Slim (smaller than full Debian)
FROM python:3.10-slim

# 2. Prevent apt-get from prompting for input during build
ENV DEBIAN_FRONTEND=noninteractive

# 3. Install system dependencies
#    - ffmpeg: audio/video processing (pydub, mutagen)
#    - libgl1, libglib2.0-0, libsm6, libxext6, libxrender1: OpenCV requirements
#    - libsndfile1: audio file reading (pydub)
#    - libgomp1: OpenMP for OpenCV
#    - default-libmysqlclient-dev, pkg-config: mysql-connector-python build
#    - gcc, g++: C/C++ compilers for some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 \
    libgomp1 libsndfile1 curl gcc g++ \
    default-libmysqlclient-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

# 4. Set working directory inside container
WORKDIR /app

# 5. Copy requirements FIRST (leverages Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 6. Copy the rest of the app (changes frequently)
COPY . .

# 7. Create runtime directories
RUN mkdir -p static/css static/js static/images logs tmp

# 8. Make entrypoint executable
RUN chmod +x scripts/entrypoint.sh

# 9. Document the port (informational only)
EXPOSE 5000

# 10. Run entrypoint (waits for MySQL, then starts Gunicorn)
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "2", "--timeout", "120", "app:app"]
```

**Key design decisions:**

- **`--no-install-recommends`**: Skip optional packages to reduce image size.
- **`COPY requirements.txt` before `COPY . .`**: If only code changes, the pip install layer is cached.
- **`rm -rf /var/lib/apt/lists/*`**: Cleans apt cache, saves ~50 MB.
- **Non-root user not implemented here**: In production, I'd add `USER appuser` for security.

---

### Q4: What is Docker layer caching? How did you optimize it?

**Answer:**

Docker images are built in **layers**. Each `RUN`, `COPY`, or `ADD` creates a new layer. If a layer hasn't changed, Docker reuses the **cached** layer instead of rebuilding it.

**My optimization strategy:**

```dockerfile
# ✅ GOOD: Copy requirements first
COPY requirements.txt .               # Only changes if deps change
RUN pip install -r requirements.txt   # Cached if requirements.txt unchanged
COPY . .                              # Only rebuilds this layer if code changes

# ❌ BAD: Copy everything first
COPY . .                              # Any code change invalidates next layer
RUN pip install -r requirements.txt   # Reinstalls on every code change (SLOW!)
```

**Impact:**

- First build: **~10 minutes** (installs all deps)
- Subsequent code-only change: **~30 seconds** (only `COPY . .` + final layers re-run)

---

### Q5: What's the difference between `EXPOSE`, `-p`, and `-P` in Docker?

**Answer:**

| Option | Where Used | Purpose |
|--------|-----------|---------|
| `EXPOSE 5000` | Dockerfile | **Documentation only** — declares the port the container listens on. Does NOT publish it. |
| `ports: - "80:80"` | docker-compose.yml | **Publishes** host port 80 → container port 80 |
| `docker run -p 80:80` | CLI | Same as `ports:` — publishes port |
| `docker run -P` | CLI | Auto-assigns random host port to each `EXPOSE`'d port |

**In SteganoVault:**

```yaml
web:
  expose:
    - "5000"    # Only accessible inside the Docker network
nginx:
  ports:
    - "80:80"   # Accessible from the host machine
```

**Why this setup?** Only Nginx exposes port 80 to the outside world. The Flask app (port 5000) is **only reachable via Nginx** — more secure.

---

### Q6: How would you reduce the size of your Docker image?

**Answer:**

Current image size: ~800 MB (Python 3.10-slim + FFmpeg + OpenCV + deps).

**Optimization strategies:**

1. **Multi-stage build** — Separate build and runtime stages:

```dockerfile
# Stage 1: Build
FROM python:3.10-slim AS builder
RUN apt-get install -y gcc g++ pkg-config default-libmysqlclient-dev
COPY requirements.txt .
RUN pip install --user -r requirements.txt

# Stage 2: Runtime (only runtime deps)
FROM python:3.10-slim
RUN apt-get install -y ffmpeg libgl1
COPY --from=builder /root/.local /root/.local
COPY . .
```

2. **Use Alpine base image** (`python:3.10-alpine`) — 5x smaller but harder to install some packages.

3. **Use Distroless images** — Google's distroless base for minimal runtime.

4. **Remove unnecessary packages** — e.g., drop OpenCV if not using video features.

5. **`.dockerignore`** — Already using it to exclude `.git`, `node_modules`, `__pycache__`, etc.

**Current `.dockerignore`:**

```
__pycache__/
*.py[cod]
venv/
.env
.git/
.gitignore
*.md
logs/
tmp/
```

---

### Q7: What is the difference between `CMD` and `ENTRYPOINT`?

**Answer:**

| Aspect | `CMD` | `ENTRYPOINT` |
|--------|-------|--------------|
| **Purpose** | Default command (easily overridden) | Fixed executable (harder to override) |
| **Override** | `docker run image <new-cmd>` replaces it | `docker run image <args>` appends args |
| **Multiple** | Only last `CMD` counts | Only last `ENTRYPOINT` counts |
| **Best for** | Arguments to entrypoint | Actual executable |

**My usage:**

```dockerfile
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:5000", ..., "app:app"]
```

**Flow:**

1. Docker runs `/app/scripts/entrypoint.sh` (waits for MySQL)
2. Then executes `gunicorn ...` from `CMD`
3. If I run `docker run image bash`, it runs `entrypoint.sh bash` — the entrypoint ALWAYS runs.

---

## 🐙 Docker Compose

### Q8: Why use Docker Compose instead of `docker run` commands?

**Answer:**

Without Compose, I'd need to run:

```bash
# Create network
docker network create stegano-net

# Run MySQL
docker run -d --name mysql --network stegano-net \
  -e MYSQL_ROOT_PASSWORD=rootpassword123 \
  -e MYSQL_DATABASE=steganovault \
  -v mysql-data:/var/lib/mysql \
  -v ./init-db/init.sql:/docker-entrypoint-initdb.d/init.sql \
  mysql:8.0

# Run web (depends on mysql)
docker run -d --name web --network stegano-net \
  -e MYSQL_HOST=mysql \
  ...

# Run nginx, phpmyadmin... etc
```

**With Compose, it's one file + one command:**

```bash
docker compose up -d
```

**Benefits:**

1. **Declarative** — All services in one `docker-compose.yml`
2. **Dependency management** — `depends_on: condition: service_healthy`
3. **Network management** — Auto-creates network
4. **Volume management** — Auto-creates named volumes
5. **Easy scaling** — `docker compose up -d --scale web=3`
6. **Team-friendly** — Everyone uses the same config

---

### Q9: Explain `depends_on` with `condition: service_healthy`.

**Answer:**

Basic `depends_on` only waits for the container to **start**, not to be **ready**. My web container needs MySQL to be actually ready, not just running.

**My implementation:**

```yaml
mysql:
  healthcheck:
    test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
    interval: 10s
    timeout: 5s
    retries: 10
    start_period: 30s

web:
  depends_on:
    mysql:
      condition: service_healthy
```

**Flow:**

1. MySQL container starts
2. Docker runs healthcheck every 10 seconds
3. Once `mysqladmin ping` succeeds, MySQL is marked **healthy**
4. Only then does Docker start the `web` container

**Without this:** The web container would crash trying to connect before MySQL is ready.

---

### Q10: How do containers communicate with each other?

**Answer:**

Containers in the same Docker network can reach each other by **service name** (which Docker resolves via an internal DNS).

**My network setup:**

```yaml
networks:
  stegano-net:
    driver: bridge
```

**Communication paths:**

| From | To | Address |
|------|-----|---------|
| `web` | MySQL | `mysql:3306` |
| `nginx` | web | `web:5000` |
| `phpmyadmin` | MySQL | `mysql:3306` |

**In `app.py`:**

```python
MYSQL_CONFIG = {
    'host': os.environ.get('MYSQL_HOST', 'mysql'),   # "mysql" = service name
    'port': int(os.environ.get('MYSQL_PORT', 3306)),
    ...
}
```

**In `nginx/conf.d/default.conf`:**

```nginx
upstream steganovault_backend {
    server web:5000;   # "web" = service name
    keepalive 32;
}
```

Docker's **embedded DNS** at `127.0.0.11` resolves these names to the container's IP.

---

## 🌐 Nginx & Reverse Proxy

### Q11: What is a reverse proxy and why did you use Nginx?

**Answer:**

A **reverse proxy** sits in front of backend servers and forwards client requests to them. The client doesn't know which backend served the request.

**Why I used Nginx in SteganoVault:**

1. **Static file serving** — Nginx serves CSS/JS/images much faster than Flask
2. **Gzip compression** — Reduces bandwidth for text responses
3. **Load balancing** — Can distribute requests across multiple Flask workers
4. **SSL termination** — Handles HTTPS certificates (production-ready)
5. **Rate limiting** — Protects against abuse
6. **Client body size control** — Handles large file uploads
7. **Security** — Hides backend details, adds security headers

**Architecture:**

```
Client → Nginx (port 80) → Flask/Gunicorn (port 5000) → MySQL
```

---

### Q12: Explain your Nginx configuration.

**Answer:**

Here's the key part of `nginx/conf.d/default.conf`:

```nginx
upstream steganovault_backend {
    server web:5000;         # Flask container
    keepalive 32;            # Persistent connections for performance
}

server {
    listen 80;
    
    # Proxy to Flask
    location / {
        proxy_pass http://steganovault_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
    
    # Static files with caching
    location /static/ {
        proxy_pass http://steganovault_backend/static/;
        add_header Cache-Control "no-store, no-cache" always;
        expires -1;
        access_log off;
    }
    
    # File upload endpoints (larger body size)
    location /encode {
        proxy_pass http://steganovault_backend;
        client_max_body_size 100M;
        proxy_read_timeout 300s;
    }
    
    # Deny hidden files
    location ~ /\. {
        deny all;
    }
}
```

**Key directives:**

- **`upstream`**: Defines backend servers (can add multiple for load balancing)
- **`proxy_pass`**: Forwards requests to the upstream
- **`X-Forwarded-*`**: Tells Flask the original client IP/protocol
- **`client_max_body_size 100M`**: Allows 100 MB file uploads
- **`proxy_read_timeout 300s`**: Waits up to 5 min for large file processing
- **`expires -1`**: Disables caching for static files (development)

---

### Q13: What is the difference between a forward proxy and a reverse proxy?

**Answer:**

| Aspect | Forward Proxy | Reverse Proxy |
|--------|---------------|---------------|
| **Position** | In front of clients | In front of servers |
| **Purpose** | Hides client identity from servers | Hides server identity from clients |
| **Users** | Known by clients | Known by servers |
| **Examples** | VPN, Squid, corporate proxy | Nginx, HAProxy, Cloudflare |
| **Client knows?** | Yes | No |

**SteganoVault uses a REVERSE proxy** — the browser doesn't know there's a Flask app behind Nginx at `web:5000`.

---

## 🐍 Flask & Python Backend

### Q14: Why did you use Gunicorn instead of the Flask dev server?

**Answer:**

Flask's built-in `app.run()` is **single-threaded** and explicitly **not for production**.

**Gunicorn advantages:**

1. **Multiple workers** — Handles concurrent requests
2. **Process management** — Auto-restarts dead workers
3. **Timeouts** — Kills hanging requests
4. **Battle-tested** — Used by Instagram, Reddit, etc.
5. **Graceful restarts** — Zero-downtime deployments

**My Gunicorn config:**

```bash
gunicorn \
  --bind 0.0.0.0:5000 \
  --workers 2 \        # 2 processes (2 × CPU + 1 rule)
  --threads 2 \        # 2 threads per worker
  --timeout 120 \      # Kill requests > 120s
  --access-logfile - \ # Log to stdout (visible in docker logs)
  --error-logfile - \
  app:app
```

**Why 2 workers?** For a single-core or dual-core dev machine, 2 workers balance concurrency vs. memory.

---

### Q15: What is the difference between WSGI and ASGI?

**Answer:**

| Aspect | WSGI | ASGI |
|--------|------|------|
| **Full form** | Web Server Gateway Interface | Asynchronous Server Gateway Interface |
| **Sync/Async** | Synchronous only | Supports async/await |
| **Use case** | Traditional web apps (Flask, Django) | Async apps (FastAPI, Starlette) |
| **WebSockets** | ❌ No | ✅ Yes |
| **Servers** | Gunicorn, uWSGI | Uvicorn, Daphne, Hypercorn |

**SteganoVault uses WSGI** because:

- Flask is synchronous
- Steganography operations are CPU-bound (no async benefit)
- No WebSocket requirement

**If I needed async:** I'd use FastAPI + Uvicorn.

---

### Q16: How do you handle file uploads in Flask?

**Answer:**

**Step 1 — Receive file in request:**

```python
@app.route("/encode", methods=["POST"])
def encode():
    uploaded_file = request.files['file']
    message = request.form.get("message")
    password = request.form.get("password", "")
```

**Step 2 — Sanitize filename:**

```python
from werkzeug.utils import secure_filename

filename = secure_filename(uploaded_file.filename)
# "my file.png" → "my_file.png"
# "../../etc/passwd" → "etc_passwd" (safe)
```

**Step 3 — Save to temp directory:**

```python
import tempfile

temp_dir = tempfile.mkdtemp()  # e.g., /tmp/tmpabc123/
file_path = os.path.join(temp_dir, filename)
uploaded_file.save(file_path)
```

**Step 4 — Process and cleanup:**

```python
try:
    # ... process file ...
finally:
    shutil.rmtree(temp_dir, ignore_errors=True)   # Always cleanup
```

**Key security measures:**

- `secure_filename()` prevents directory traversal
- `tempfile.mkdtemp()` creates isolated temp directory
- `finally` block ensures cleanup even on error
- Nginx `client_max_body_size 100M` limits upload size

---

### Q17: What is a Flask blueprint and why didn't you use them?

**Answer:**

**Blueprints** are a way to organize routes across multiple files. Example:

```python
# auth/routes.py
from flask import Blueprint
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login')
def login():
    ...
```

```python
# app.py
from auth.routes import auth_bp
app.register_blueprint(auth_bp, url_prefix='/auth')
```

**Why I didn't use them (for this project):**

- **Small project** — ~800 lines of code
- **Single domain** — everything is steganography-related
- **Simplicity** — one file is easier to navigate

**When I WOULD use them:**

- Large apps with multiple domains (auth, admin, API, webhooks)
- Team collaboration (each team owns a blueprint)
- Reusable apps (blueprints can be packaged as libraries)

---

### Q18: How do you handle exceptions in Flask?

**Answer:**

**Approach 1 — Try/except per route:**

```python
@app.route("/encode", methods=["POST"])
def encode():
    try:
        output_file = encode_image(file_path, message, password)
        return send_file(output_file)
    except Exception as e:
        logger.error(f"Encode Error: {e}")
        return jsonify({"error": f"Encoding failed: {str(e)}"}), 500
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
```

**Approach 2 — Global error handler:**

```python
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Server error: {error}")
    return jsonify({"error": "Internal server error"}), 500
```

**In SteganoVault I use both:**

- **Per-route** for specific errors (with detailed message)
- **Global** for consistency and logging

---

## 🗄️ MySQL & Database Design

### Q19: Why MySQL and not PostgreSQL/MongoDB?

**Answer:**

| Database | Best For | Why Not (for this project) |
|----------|----------|----------------------------|
| **MySQL** | Structured data, transactions | ✅ Chosen |
| **PostgreSQL** | Advanced queries, JSON, extensions | Overkill for simple CRUD |
| **MongoDB** | Unstructured/schema-less data | Users/reviews are structured |

**Why MySQL:**

1. **Structured data** — Users, reviews, OTPs are all well-defined
2. **ACID transactions** — Register, verify, review — all need atomicity
3. **Relationships** — User → Reviews (foreign key)
4. **Simple & proven** — Widely used, easy to hire for
5. **Official Docker image** — `mysql:8.0` works great
6. **phpMyAdmin** — Easy browser UI for debugging

**MongoDB would be a poor fit** because:

- User email must be **unique** (need transactions/constraints)
- Reviews need **foreign keys** to users
- OTPs need **atomic updates** (ON DUPLICATE KEY)

---

### Q20: Explain your database schema.

**Answer:**

Three tables:

```sql
-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,        -- BCrypt hash
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email)                -- Fast lookups by email
);

-- OTP storage
CREATE TABLE otp_storage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,    -- One OTP per email
    otp VARCHAR(10) NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Reviews
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

**Design decisions:**

- **`UNIQUE` on email**: Prevents duplicate accounts
- **`INDEX` on email**: O(log n) lookups instead of O(n)
- **`CHECK` on rating**: 1-5 enforced at DB level
- **`ON UPDATE CURRENT_TIMESTAMP`**: OTP timestamp auto-refreshes
- **`user_email` foreign key**: Denormalized name for faster reads (no JOIN needed for display)

---

### Q21: What is a connection pool and why did you use it?

**Answer:**

A **connection pool** maintains a set of open database connections that can be **reused** across requests instead of opening a new one every time.

**Without pooling:**

```python
def get_user(email):
    conn = mysql.connector.connect(...)   # ~50ms overhead
    cursor = conn.cursor()
    ...
    conn.close()                          # Connection destroyed
```

**For 100 requests:** 100 × 50ms = **5 seconds wasted** on connections alone.

**With pooling:**

```python
db_pool = pooling.MySQLConnectionPool(
    pool_name="stegano_pool",
    pool_size=10,        # Keep 10 connections open
    pool_reset_session=True,
    **MYSQL_CONFIG
)

def get_db():
    return db_pool.get_connection()   # Instant, reused connection
```

**Benefits:**

- **Performance**: Reuses warm connections (~5ms vs ~50ms)
- **Resource control**: Limits concurrent connections (MySQL max = 151)
- **Reliability**: Auto-reconnects on failures

**In SteganoVault:** I configured **10 connections** in the pool — enough for 2 Gunicorn workers × 2 threads + headroom.

---

### Q22: What is SQL injection and how did you prevent it?

**Answer:**

**SQL injection** is an attack where malicious SQL is injected via user input.

**Vulnerable code (DON'T DO THIS):**

```python
email = request.json['email']
cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")
# If email = "admin' OR '1'='1", attacker bypasses auth!
```

**My approach (parameterized queries):**

```python
cursor.execute(
    "SELECT id, name, email, password FROM users WHERE email = %s",
    (email,)   # Parameters passed separately
)
```

**Why this is safe:**

1. The SQL template and values are sent **separately** to MySQL
2. MySQL treats `%s` values as **data**, never as SQL code
3. Even if `email = "admin' OR '1'='1"`, MySQL searches for that **exact string** as an email

**Every query in `app.py` uses `%s` parameters** — zero string concatenation.

---

### Q23: What is an index and where did you add them?

**Answer:**

An **index** is a data structure (usually B-tree) that speeds up lookups from O(n) to O(log n).

**Trade-off:**

- ✅ **Fast reads** (SELECT, WHERE, JOIN)
- ❌ **Slower writes** (INSERT, UPDATE) — index must be updated
- ❌ **More storage**

**Indexes in SteganoVault:**

```sql
-- Users: fast lookup by email (used in EVERY login)
INDEX idx_email (email)

-- Reviews: fast lookup by user
INDEX idx_reviews_email (user_email)

-- Reviews: fast sort by timestamp (most recent first)
INDEX idx_reviews_time (timestamp DESC)
```

**Where I deliberately didn't index:**

- `name` (rarely searched)
- `password` (never searched)
- `text` (TEXT columns are expensive to index)

---

## 🔐 Authentication & Security

### Q24: How do you store passwords securely?

**Answer:**

**Never store plain-text passwords.** I use **BCrypt** hashing.

**Why BCrypt (vs MD5/SHA)?**

| Algorithm | Speed | Salted? | Cost Adjustable? | Safe? |
|-----------|-------|---------|------------------|-------|
| MD5 | ⚡ Fast | ❌ No | ❌ | ❌ No |
| SHA-256 | ⚡ Fast | ❌ No | ❌ | ❌ No |
| BCrypt | 🐢 Slow | ✅ Yes | ✅ Yes | ✅ Yes |
| Argon2 | 🐢 Slow | ✅ Yes | ✅ Yes | ✅ Best |

**BCrypt implementation:**

```python
import bcrypt

def hash_password(password):
    # Generates a random salt + hashes with cost factor (default: 12)
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
```

**Example hash:**

```
$2b$12$KIXwz1nCGVdG1xXbFh3P0u7aHHqN8xpZ5tFbFK6x0y1z2A3B4C5D6
 │  │  │                                                        │
 │  │  └── Salt (22 chars) + Hash                                 └── Hash
 │  └── Cost factor (2^12 = 4096 iterations)
 └── BCrypt version
```

**Why cost factor 12?** Balances security vs. speed — ~100ms per hash on modern hardware.

---

### Q25: Explain your OTP flow.

**Answer:**

**Purpose:** Verify user's email during registration and password reset.

**Flow:**

```
1. User registers → 
2. Generate 6-digit OTP → 
3. Store in DB (with timestamp) → 
4. Send via email (SMTP) → 
5. User enters OTP → 
6. Verify: matches + not expired (5 min) → 
7. Mark user as verified
```

**Implementation:**

```python
def generate_otp(email):
    otp = ''.join(random.choices(string.digits, k=6))   # e.g., "482917"
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO otp_storage (email, otp, verified, timestamp)
        VALUES (%s, %s, FALSE, NOW())
        ON DUPLICATE KEY UPDATE otp = %s, verified = FALSE, timestamp = NOW()
    """, (email, otp, otp))
    conn.commit()
    return otp


def verify_otp(email, otp):
    cursor.execute("SELECT otp, timestamp FROM otp_storage WHERE email = %s", (email,))
    row = cursor.fetchone()
    
    # Check 1: OTP exists
    if not row:
        return False
    
    # Check 2: Not expired (5 minutes)
    if (datetime.now() - row['timestamp']).total_seconds() > 300:
        return False
    
    # Check 3: OTP matches
    if row['otp'] == otp:
        cursor.execute("UPDATE otp_storage SET verified = TRUE WHERE email = %s", (email,))
        cursor.execute("UPDATE users SET verified = TRUE WHERE email = %s", (email,))
        return True
    
    return False
```

**Security measures:**

1. **6 digits** = 1 million combinations (random guess = 1 in 1M)
2. **5-minute expiry** — Limits attack window
3. **`ON DUPLICATE KEY`** — Only one active OTP per email (prevents spam)
4. **Rate limit** — Email sending is expensive; could add cooldown

---

### Q26: What are security headers and why did you add them?

**Answer:**

**Security headers** are HTTP response headers that tell the browser how to behave — extra layer against XSS, clickjacking, and MIME-sniffing.

**My implementation:**

```python
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    if 'Cache-Control' not in response.headers:
        response.headers['Cache-Control'] = 'no-store, max-age=0'
    return response
```

**Header explanations:**

| Header | Purpose | Attack Prevented |
|--------|---------|------------------|
| `X-Content-Type-Options: nosniff` | Forces browser to trust declared Content-Type | MIME-sniffing attacks |
| `X-Frame-Options: SAMEORIGIN` | Prevents embedding in iframes on other domains | Clickjacking |
| `X-XSS-Protection: 1; mode=block` | Enables browser's XSS filter | Reflected XSS |
| `Cache-Control: no-store` | Prevents caching sensitive pages | Session data leak |

**Modern alternatives (not used here but worth knowing):**

- `Content-Security-Policy` — Stronger than `X-XSS-Protection` (whitelist sources)
- `Strict-Transport-Security` — Force HTTPS
- `Referrer-Policy` — Control referrer info

---

## 🎭 Steganography Concepts

### Q27: What is steganography vs cryptography?

**Answer:**

| Aspect | Steganography | Cryptography |
|--------|---------------|--------------|
| **Goal** | Hide the **existence** of a message | Hide the **content** of a message |
| **Result** | Looks like a normal file | Looks like random garbage |
| **Detectable?** | If you don't know it's there, you can't find it | Known to exist, but unreadable |
| **Example** | Message hidden in image pixels | Encrypted email |

**In SteganoVault:** I use **steganography** (hiding in images). I could **combine** it with **cryptography** (encrypt, then hide) for defense in depth.

---

### Q28: What is LSB steganography?

**Answer:**

**LSB (Least Significant Bit)** steganography hides data in the **last bit** of each pixel's RGB value.

**Why it works:**

- A pixel channel value is 0-255 (8 bits)
- Changing the last bit changes the value by only 1 (e.g., 200 → 201)
- Human eyes **cannot detect** a difference of 1 in color

**Example:**

```
Original pixel:   RGB(200, 150, 100)
                  = (11001000, 10010110, 01100100)

Hide message "10":
                  Change LSBs:
                  (1100100[0], 1001011[0], 0110010[0])
                  Wait, let's do it correctly:

Original:  (200, 150, 100) = (11001000, 10010110, 01100100)
Message bit 1: Set LSB of red to 1 → 11001001 = 201
Message bit 0: Set LSB of green to 0 → 10010110 = 150 (unchanged)
```

**Capacity:**

- 1 pixel = 3 bits (R, G, B)
- 1,000 × 1,000 image = 3,000,000 bits = **375 KB**
- Real-world: use ~10% for safety = ~37 KB

**Stegano library handles all this:**

```python
from stegano import lsb

encoded_img = lsb.hide("input.png", "secret message")
encoded_img.save("output.png")

message = lsb.reveal("output.png")
```

---

### Q29: How do you hide messages in other file types?

**Answer:**

| File Type | Technique | Where Hidden |
|-----------|-----------|--------------|
| **PNG/JPG** | LSB in pixel bytes | Pixel data |
| **TXT** | Zero-width Unicode chars (`\u200B`, `\u200D`) | Between normal chars |
| **PDF** | Metadata injection | Document properties |
| **DOCX** | Hidden text runs | `run.font.hidden = True` |
| **WAV/MP3** | LSB in audio samples | Audio PCM data |
| **MP4** | Metadata field (`desc`) | Video container metadata |

**Example — TXT with zero-width chars:**

```python
def encode_txt(input_path, message, password):
    # Convert message to binary
    binary = ''.join(format(ord(c), '08b') for c in message)
    
    # Encode each bit as zero-width char
    encoded = ''.join(
        "\u200B" if bit == "0" else "\u200D"   # invisible chars
        for bit in binary
    )
    
    with open(input_path, "a", encoding="utf-8") as f:
        f.write(encoded)
```

The file appears **identical** to the original — the hidden chars are invisible.

---

### Q30: What is steganalysis and how can it detect your messages?

**Answer:**

**Steganalysis** is the study of detecting hidden messages.

**Common techniques:**

1. **Statistical analysis** — LSB changes subtly alter pixel distribution
2. **Chi-square attack** — Compares pixel value frequencies
3. **RS analysis** — Detects LSB modifications
4. **Machine learning** — Trained on clean vs. stego images

**Why SteganoVault is vulnerable:**

- **LSB steganography is easy to detect** with statistical tools
- **PNG format preserves LSBs** — but re-compressing to JPG destroys them
- **No encryption** — even if detected, the message is readable

**How to make it harder:**

1. **Encrypt before hiding** — Even if detected, unreadable
2. **Spread bits randomly** — Don't use first N pixels; use a PRNG
3. **Use larger cover files** — Fewer bits changed per pixel
4. **Use frequency-domain (DCT/DWT)** — Harder to detect than LSB

**For SteganoVault:** It's an **educational tool** — not designed to defeat serious steganalysis.

---

## 🏗 System Design

### Q31: Walk me through the complete request flow when a user encodes a message.

**Answer:**

```
┌────────────────────────────────────────────────────────────────┐
│ 1. Browser (http://localhost)                                   │
│    - User selects file, enters message, clicks Encode           │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼ POST /encode (multipart/form-data)
┌────────────────────────────────────────────────────────────────┐
│ 2. Nginx (container: steganovault-nginx)                        │
│    - Receives HTTP request on port 80                           │
│    - Matches location /encode                                   │
│    - Checks client_max_body_size (100M)                         │
│    - Proxies to upstream: web:5000                              │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼ HTTP (internal Docker network)
┌────────────────────────────────────────────────────────────────┐
│ 3. Flask/Gunicorn (container: steganovault-web)                 │
│    - Gunicorn worker receives request                           │
│    - Route: @app.route("/encode", methods=["POST"])             │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼ Function: encode()
┌────────────────────────────────────────────────────────────────┐
│ 4. Flask app.py: /encode handler                                │
│    a. request.files['file'] → uploaded file                     │
│    b. secure_filename() → sanitize                              │
│    c. tempfile.mkdtemp() → isolated temp dir                    │
│    d. uploaded_file.save(file_path)                             │
│    e. Detect extension (.png, .pdf, etc.)                       │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼ Encoder Function
┌────────────────────────────────────────────────────────────────┐
│ 5. encode_image() / encode_pdf() / etc.                         │
│    - Uses Stegano/PyPDF2/docx to hide message                   │
│    - Returns output_file path                                   │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼ Compute checksum
┌────────────────────────────────────────────────────────────────┐
│ 6. hashlib.sha256() on output file                              │
│    - Integrity verification                                     │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼ Optional: Google Drive
┌────────────────────────────────────────────────────────────────┐
│ 7. upload_to_drive()                                            │
│    - Creates file in folder                                     │
│    - Shares with 'anyone' role                                  │
│    - Returns share URL                                          │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼ Build response
┌────────────────────────────────────────────────────────────────┐
│ 8. send_file() with headers                                     │
│    - Content-Disposition: attachment                            │
│    - X-Response-Data: JSON with checksum, share_url, etc.       │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼ (reverse path back through Nginx)
┌────────────────────────────────────────────────────────────────┐
│ 9. Browser                                                      │
│    - Downloads file (blob)                                      │
│    - Parses X-Response-Data header                              │
│    - Updates UI, stealth score, shows preview                   │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼ finally block
┌────────────────────────────────────────────────────────────────┐
│ 10. Cleanup                                                     │
│     - shutil.rmtree(temp_dir)                                   │
│     - Ensures no file left on disk                              │
└────────────────────────────────────────────────────────────────┘
```

**Total time:** ~300ms for a 1 MB image + network.

---

### Q32: How would you scale SteganoVault to handle 10,000 users?

**Answer:**

**Current bottlenecks:**

1. **Single web container** — Handles all requests
2. **Single MySQL** — No read replicas
3. **Local file storage** — tempdir on container disk
4. **Session-based auth** — Sessions stored in Flask

**Scaling strategy:**

### Phase 1: Vertical Scaling (0 → 1,000 users)

```yaml
web:
  deploy:
    resources:
      limits: { cpus: '4', memory: 4G }
  # Increase Gunicorn workers: --workers 8
```

### Phase 2: Horizontal Scaling (1,000 → 10,000 users)

```yaml
# docker-compose.yml
web:
  deploy:
    replicas: 4   # 4 Flask containers
```

Add **load balancer** (Nginx upstream):

```nginx
upstream stegano_backend {
    least_conn;   # Least-connections algorithm
    server web1:5000;
    server web2:5000;
    server web3:5000;
    server web4:5000;
}
```

### Phase 3: Database Scaling

- **Read replicas** for SELECT-heavy queries
- **Redis** for session storage (replace Flask sessions)
- **Connection pool** per web worker

### Phase 4: Storage Scaling

Replace local `tempfile` with **S3/object storage**:

```python
# Instead of:
output_path = input_path.replace(".png", "_encoded.png")

# Use S3:
s3.upload_file(output_path, "stegano-bucket", key)
```

### Phase 5: Full Production Architecture

```
                   ┌──────────────┐
        ┌─────────▶│  Cloudflare  │  (CDN + DDoS)
        │          └──────────────┘
        │                 │
        ▼                 ▼
┌──────────────┐   ┌──────────────┐
│  Nginx LB    │   │  Nginx LB    │  (Multiple LBs)
└──────────────┘   └──────────────┘
        │                 │
        └────────┬────────┘
                 ▼
       ┌──────────────────┐
       │  Flask Pods (xN) │  (Kubernetes)
       └──────────────────┘
                 │
      ┌──────────┼──────────┐
      ▼          ▼          ▼
┌──────────┐┌──────────┐┌──────────┐
│  MySQL   ││  Redis   ││    S3    │
│ Primary  ││  Cache   ││ Storage  │
│ +Replica ││          ││          │
└──────────┘└──────────┘└──────────┘
```

---

## 🚀 DevOps & Deployment

### Q33: What is the difference between `docker compose down` and `docker compose down -v`?

**Answer:**

| Command | Containers | Networks | Volumes | Data |
|---------|-----------|----------|---------|------|
| `docker compose stop` | Stopped | Kept | Kept | ✅ Kept |
| `docker compose down` | Removed | Removed | Kept | ✅ Kept |
| `docker compose down -v` | Removed | Removed | **Removed** | ❌ **Deleted** |

**-v** = "volumes" — deletes named volumes.

**In SteganoVault:**

- `docker compose down` → MySQL data (users, reviews) is safe
- `docker compose down -v` → MySQL data wiped, fresh start

---

### Q34: What is a Docker volume and why is it important?

**Answer:**

A **volume** is Docker's mechanism for **persistent storage** that outlives the container.

**Why important:** Containers are **ephemeral** — when you `docker rm` a container, its filesystem is lost. Volumes preserve data.

**My volume usage:**

```yaml
volumes:
  mysql-data:              # Named volume (Docker-managed)
    driver: local

services:
  mysql:
    volumes:
      - mysql-data:/var/lib/mysql    # Data persists here
      - ./init-db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro   # Bind mount
```

**Two types of volumes:**

| Type | Example | Use Case |
|------|---------|----------|
| **Named volume** | `mysql-data:/var/lib/mysql` | Persistent data (DB, uploads) |
| **Bind mount** | `./static:/app/static` | Development (live code sync) |

**Where data lives on host:** `/var/lib/docker/volumes/steganovault_mysql-data/_data`

---

### Q35: How do you debug a failing container?

**Answer:**

**Step 1 — Check status:**

```bash
docker compose ps
# Shows which containers are "exited" or "unhealthy"
```

**Step 2 — View logs:**

```bash
docker compose logs web          # All logs
docker compose logs --tail=50 web  # Last 50 lines
docker compose logs -f web         # Follow (live)
```

**Step 3 — Inspect container:**

```bash
docker inspect steganovault-web
# Shows environment vars, mounted volumes, network config
```

**Step 4 — Shell into container:**

```bash
docker compose exec web bash
# Inside: check files, run python, test DB connection

# Or if container is dead:
docker run -it --entrypoint bash steganovault-web
```

**Step 5 — Check resource usage:**

```bash
docker stats
# Shows CPU/memory per container
```

**Step 6 — Common checks:**

```bash
# Is MySQL ready?
docker compose exec mysql mysqladmin ping -u root -p

# Are files copied?
docker compose exec web ls -la /app/static/

# Can web reach MySQL?
docker compose exec web python -c "import mysql.connector; mysql.connector.connect(host='mysql', user='stegano', password='stegano123', database='steganovault')"
```

---

### Q36: How would you implement CI/CD for this project?

**Answer:**

**CI/CD pipeline with GitHub Actions:**

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # ============================================
  # Stage 1: Lint & Test
  # ============================================
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.10'
      
      - name: Install deps
        run: pip install -r requirements.txt
      
      - name: Lint
        run: |
          pip install flake8
          flake8 app.py --max-line-length=120
      
      - name: Test
        run: |
          pip install pytest
          pytest tests/

  # ============================================
  # Stage 2: Build Docker Image
  # ============================================
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build & Push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            hritikranjan1/steganovault:latest
            hritikranjan1/steganovault:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ============================================
  # Stage 3: Deploy to Production
  # ============================================
  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/steganovault
            docker compose pull
            docker compose up -d --remove-orphans
            docker system prune -f
```

**Pipeline stages:**

1. **Test** — Lint + unit tests on every push
2. **Build** — Docker image build + push to registry
3. **Deploy** — SSH into production server, pull, restart

**Secrets required:**

- `DOCKER_USERNAME`, `DOCKER_PASSWORD`
- `PROD_HOST`, `PROD_USER`, `PROD_SSH_KEY`

---

## 🎯 Behavioral Questions

### Q37: What was the hardest bug you faced and how did you fix it?

**Answer:**

**The bug:** After moving CSS/JS from inline to separate files, the UI completely broke — no styling, no interactivity. Browser console showed:

```
Uncaught TypeError: can't access property "addEventListener", document.getElementById(...) is null
    at app.js:2
```

**Investigation:**

1. Verified file contents: `head -5 static/js/app.js` — showed the **old `script.js` content**, not my new code
2. Discovered a multi-commit script had **corrupted the file** during generation
3. Also found **Nginx was caching `app.js` for 7 days** — even after fixing the file, browser showed old version

**Fixes:**

1. **Rewrote `app.js`** from scratch with proper structure
2. **Fixed Nginx config** to disable caching during development:
   ```nginx
   add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
   expires -1;
   ```
3. **Added cache-buster** to `index.html`: `app.js?v=3`
4. **Verified in incognito** to rule out browser cache

**Lesson learned:** Never trust that a script "just worked" — always verify file contents, and always test in a clean browser session.

---

### Q38: Why did you choose Docker Compose over Kubernetes for this project?

**Answer:**

**Docker Compose is the right tool for this project** because:

| Aspect | Docker Compose | Kubernetes |
|--------|---------------|------------|
| **Complexity** | Simple YAML | Steep learning curve |
| **Single-machine** | ✅ Perfect | ❌ Overkill |
| **Local dev** | ✅ One command | ❌ Heavy |
| **Production scale** | ❌ Limited | ✅ Designed for it |
| **Learning time** | Hours | Weeks |

**For SteganoVault:**

- It's a **portfolio/resume project** — runs on one machine
- **4 containers** — Compose handles this beautifully
- **No autoscaling requirement** — traffic is predictable
- **Local dev + demo** — Compose is faster to iterate

**When I'd use Kubernetes:**

- Deploying to production with 10,000+ users
- Multi-region deployment
- Auto-scaling based on load
- Complex service mesh requirements

**My take:** Start simple with Compose. Migrate to K8s when you actually need it — not because it's trendy.

---

### Q39: How would you monitor this application in production?

**Answer:**

**The 4 Golden Signals** (Google SRE):

1. **Latency** — How long do requests take?
2. **Traffic** — How many requests per second?
3. **Errors** — What's the error rate?
4. **Saturation** — How full are CPU/memory/disk?

**Monitoring stack I'd add:**

```yaml
# Add to docker-compose.yml

prometheus:
  image: prom/prometheus
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus-data:/prometheus
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
  volumes:
    - grafana-data:/var/lib/grafana
  ports:
    - "3000:3000"

node-exporter:
  image: prom/node-exporter
  ports:
    - "9100:9100"

cadvisor:
  image: gcr.io/cadvisor/cadvisor
  volumes:
    - /:/rootfs:ro
    - /var/run:/var/run:ro
  ports:
    - "8080:8080"
```

**Instrument Flask with Prometheus:**

```python
from prometheus_flask_exporter import PrometheusMetrics

metrics = PrometheusMetrics(app)
# Auto-instruments every endpoint with:
# - http_request_duration_seconds
# - http_requests_total (by status code)
```

**Key metrics I'd track:**

- `http_requests_total{endpoint="/encode", status="200"}`
- `http_request_duration_seconds{quantile="0.95"}`
- `mysql_connections_active`
- `container_memory_usage_bytes{name="steganovault-web"}`

**Alerts:**

- Error rate > 5% for 5 min → Page on-call
- P95 latency > 2s for 10 min → Warning
- Container restart > 3 times in 5 min → Investigate

---

### Q40: What would you do differently if you rebuilt this project?

**Answer:**

**Architecture improvements:**

1. **Use Redis for sessions** — Currently Flask uses signed cookies; Redis scales better
2. **Add object storage (S3)** — Instead of `tempfile`, use S3 for output files
3. **Separate worker service** — Move encode/decode to background workers (Celery + Redis) for large files
4. **API versioning** — `/api/v1/reviews` instead of `/api/reviews`
5. **Rate limiting** — `Flask-Limiter` to prevent OTP spam

**Code quality:**

6. **Use Flask blueprints** — Split `app.py` (900+ lines) into modular blueprints
7. **Add tests** — Currently zero tests; target 80% coverage
8. **Type hints** — Full type annotations with `mypy` in CI
9. **Pydantic schemas** — Validate request/response bodies

**DevOps:**

10. **Multi-stage Dockerfile** — Reduce image size from 800 MB to ~300 MB
11. **Health checks everywhere** — Currently Nginx lacks a proper healthcheck
12. **Structured logging** — JSON logs for easier parsing in production
13. **Secrets management** — Use Docker secrets or Vault instead of `.env`

**Product:**

14. **Progress indicators** — Show encoding progress for large files
15. **Batch processing** — Encode multiple files at once
16. **Better mobile UX** — Larger touch targets, swipe gestures

---

## 📊 Quick Reference

### Common Commands

```bash
# Docker
docker compose up -d --build
docker compose logs -f web
docker compose exec web bash
docker compose down -v

# MySQL
docker compose exec mysql mysql -u stegano -pstegano123 steganovault
docker compose exec mysql mysqladmin ping

# Health
curl http://localhost/health
curl -I http://localhost/static/js/app.js
```

### Key Files

| File | Purpose |
|------|---------|
| `app.py` | Flask app — all routes, stego logic |
| `docker-compose.yml` | 4 services: web, mysql, nginx, phpmyadmin |
| `Dockerfile` | Custom image for Flask app |
| `nginx/conf.d/default.conf` | Reverse proxy config |
| `init-db/init.sql` | Auto-run DB schema |
| `scripts/entrypoint.sh` | Wait for MySQL, then start Gunicorn |

---

## 🎓 Final Tips

1. **Practice explaining the architecture** out loud — walk through a request
2. **Know your numbers** — 4 containers, 3 tables, 6 file formats, 11 themes
3. **Be honest about trade-offs** — "I chose X over Y because Z"
4. **Show curiosity** — "If I had more time, I'd add..."
5. **Admit gaps** — "I haven't worked with Kafka yet, but I understand the concepts..."

---

<div align="center">

**Built with ❤️ — Every question is a learning opportunity**

</div>

# 🔄 SteganoVault - Complete Workflow Guide

> A deep dive into how every piece of SteganoVault works together — from `docker compose up` to serving a decode request.

---

## 📋 Table of Contents

- [High-Level Workflow](#-high-level-workflow)
- [Startup Sequence](#-startup-sequence)
- [Container Architecture](#-container-architecture)
- [Request Lifecycle — Encode](#-request-lifecycle--encode)
- [Request Lifecycle — Decode](#-request-lifecycle--decode)
- [Database Workflow](#-database-workflow)
- [Authentication Workflow](#-authentication-workflow)
- [File Processing Pipeline](#-file-processing-pipeline)
- [Shutdown & Cleanup](#-shutdown--cleanup)
- [Complete Visual Diagram](#-complete-visual-diagram)

---

## 🎯 High-Level Workflow

SteganoVault is a **4-container microservices application**. Here's the flow at the highest level:

```
┌─────────────────────────────────────────────────────────────────────┐
│                            USER'S BROWSER                            │
│                   http://localhost  (or your domain)                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ HTTP Request
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NGINX (Reverse Proxy, Port 80)                    │
│  • Serves static files (CSS, JS, images)                             │
│  • Routes /encode, /decode, /auth, /api to Flask                     │
│  • Handles gzip compression and caching                              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Proxy to upstream
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  FLASK APP (Gunicorn, Port 5000)                     │
│  • Handles business logic                                            │
│  • Runs steganography algorithms                                     │
│  • Talks to MySQL for persistence                                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ SQL Queries
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   MYSQL DATABASE (Port 3306)                         │
│  • users, otp_storage, reviews tables                                │
│  • Persistent storage via Docker volume                              │
└─────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ Admin queries
                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                    PHPMYADMIN (Port 8081)                            │
│  • Browser-based DB management for developers                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Key insight:** Only **Nginx (port 80)** and **phpMyAdmin (port 8081)** are exposed to the host. The Flask app and MySQL are only reachable from inside the Docker network — a security best practice.

---

## 🚀 Startup Sequence

When you run `docker compose up -d --build`, here's exactly what happens:

### Phase 1: Build (Only on First Run or Code Change)

```
Step 1: Docker reads docker-compose.yml
        └── Discovers 4 services: mysql, web, nginx, phpmyadmin

Step 2: For mysql, nginx, phpmyadmin:
        └── Pulls pre-built images from Docker Hub (~500 MB)
            • mysql:8.0
            • nginx:alpine
            • phpmyadmin:latest

Step 3: For web service:
        └── Builds custom image from ./Dockerfile
            a. FROM python:3.10-slim
            b. apt-get install [ffmpeg, opencv libs, etc.]
            c. pip install -r requirements.txt
            d. COPY . .  (project files)
            e. chmod +x entrypoint.sh
            └── Result: steganovault-web:latest (~800 MB)
```

**Time:** 8–15 minutes first time, ~30 seconds on cached builds.

---

### Phase 2: Network & Volume Creation

```
Docker creates:
├── Network: steganovault_stegano-net (bridge driver)
└── Volume:  steganovault_mysql-data (local driver)
```

All containers join `stegano-net` and can reach each other by **service name**:

- `web` resolves to the Flask container IP
- `mysql` resolves to the MySQL container IP

---

### Phase 3: Container Startup (Ordered by Dependencies)

```
┌────────────────────────────────────────────────────────────────────┐
│ 1. MySQL Container Starts                                          │
│    ┌──────────────────────────────────────────────────────────┐   │
│    │ docker-entrypoint.sh (built into mysql:8.0 image)         │   │
│    │   a. Initialize DB with MYSQL_DATABASE=steganovault       │   │
│    │   b. Create user MYSQL_USER=stegano                       │   │
│    │   c. Run /docker-entrypoint-initdb.d/init.sql             │   │
│    │      └── Creates tables: users, otp_storage, reviews      │   │
│    │      └── Inserts seed data (default reviews)              │   │
│    │   d. Start mysqld on port 3306                            │   │
│    └──────────────────────────────────────────────────────────┘   │
│                                                                    │
│    Healthcheck runs every 10s:                                     │
│    $ mysqladmin ping -h localhost -u root -p***                    │
│    └── After ~30s: STATUS = healthy ✅                             │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Docker waits for healthy
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ 2. Web Container Starts (depends_on: mysql healthy)                │
│    ┌──────────────────────────────────────────────────────────┐   │
│    │ /app/scripts/entrypoint.sh                                │   │
│    │   a. Print banner                                         │   │
│    │   b. Loop: try connecting to mysql:3306                   │   │
│    │      └── If fail: wait 2s, retry                          │   │
│    │      └── If success: "✅ MySQL is ready!"                 │   │
│    │   c. Execute CMD:                                         │   │
│    │      $ gunicorn --bind 0.0.0.0:5000 \                    │   │
│    │          --workers 2 --threads 2 \                        │   │
│    │          --timeout 120 app:app                            │   │
│    │   d. Gunicorn boots 2 workers, binds port 5000            │   │
│    └──────────────────────────────────────────────────────────┘   │
│                                                                    │
│    Healthcheck runs every 30s:                                     │
│    $ curl -f http://localhost:5000/health                          │
│    └── After ~60s: STATUS = healthy ✅                             │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Docker waits for healthy
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ 3. Nginx Container Starts (depends_on: web healthy)                │
│    ┌──────────────────────────────────────────────────────────┐   │
│    │ a. Load /etc/nginx/nginx.conf                             │   │
│    │ b. Load /etc/nginx/conf.d/default.conf                    │   │
│    │    └── upstream: web:5000                                 │   │
│    │ c. Start nginx master process                             │   │
│    │ d. Spawn worker processes (auto = CPU cores)              │   │
│    │ e. Listen on port 80                                      │   │
│    └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ 4. phpMyAdmin Container Starts (depends_on: mysql healthy)         │
│    ┌──────────────────────────────────────────────────────────┐   │
│    │ a. Configure PHP-FPM + Nginx (inside container)           │   │
│    │ b. Connect to MySQL at mysql:3306                         │   │
│    │ c. Listen on port 80 (exposed as 8081 on host)            │   │
│    └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

**Total startup time:** ~90 seconds.

---

## 🏛 Container Architecture

### Detailed Component View

```
┌─────────────────────────── HOST MACHINE ───────────────────────────┐
│                                                                     │
│  Port 80  ────┐                                                     │
│  Port 8081 ─┐ │                                                     │
│             │ │                                                     │
│  ┌──────────┼─┼───────────────────────────────────────────────┐   │
│  │          │ │        DOCKER NETWORK: stegano-net            │   │
│  │          ▼ ▼                                                 │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                  │   │
│  │  │     nginx       │  │   phpmyadmin    │                  │   │
│  │  │  (nginx:alpine) │  │ (phpmyadmin)    │                  │   │
│  │  │  Port 80        │  │ Port 80→8081    │                  │   │
│  │  │                 │  │                 │                  │   │
│  │  │ • Reverse proxy │  │ • DB admin UI   │                  │   │
│  │  │ • Static files  │  │ • Uses PHP      │                  │   │
│  │  └────────┬────────┘  └────────┬────────┘                  │   │
│  │           │                    │                            │   │
│  │           │ proxy_pass         │ mysql protocol             │   │
│  │           │ web:5000           │ mysql:3306                 │   │
│  │           ▼                    ▼                            │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                  │   │
│  │  │      web        │  │      mysql      │                  │   │
│  │  │ (custom build)  │─▶│   (mysql:8.0)   │                  │   │
│  │  │ Port 5000       │  │ Port 3306       │                  │   │
│  │  │                 │  │                 │                  │   │
│  │  │ • Gunicorn      │  │ • Data storage  │                  │   │
│  │  │ • 2 workers     │  │ • Volume:       │                  │   │
│  │  │ • 2 threads     │  │   mysql-data    │                  │   │
│  │  │ • Flask app     │  │                 │                  │   │
│  │  └─────────────────┘  └─────────────────┘                  │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Bind mounts (host ↔ container):                                    │
│  • ./static       ↔ /app/static                                    │
│  • ./templates    ↔ /app/templates                                 │
│  • ./nginx/...    ↔ /etc/nginx/...                                 │
│  • ./init-db/...  ↔ /docker-entrypoint-initdb.d/                   │
│  • ./logs         ↔ /app/logs                                      │
│  • ./tmp          ↔ /app/tmp                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Container Details Table

| Container | Image | Exposed Port | Internal Port | Memory | Purpose |
|-----------|-------|--------------|---------------|--------|---------|
| `steganovault-web` | Custom (`Dockerfile`) | None | 5000 | ~200 MB | Flask + Gunicorn |
| `steganovault-mysql` | `mysql:8.0` | 3306 | 3306 | ~400 MB | Database |
| `steganovault-nginx` | `nginx:alpine` | 80 | 80 | ~20 MB | Reverse proxy |
| `steganovault-phpmyadmin` | `phpmyadmin:latest` | 8081 | 80 | ~100 MB | DB admin UI |

---

## 📨 Request Lifecycle — Encode

Let's trace a **single encode request** from browser to response:

### Step 1: User Action (Browser)

```javascript
// static/js/app.js
async function encodeFile() {
    const file = fileInput.files[0];              // User's image
    const message = document.getElementById('messageInput').value;
    const password = document.getElementById('passwordInput').value;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('message', message);
    formData.append('password', password);

    const response = await fetch('/encode', {
        method: 'POST',
        body: formData
    });

    // ... handle response
}
```

**What happens:**

- Browser creates a `multipart/form-data` POST request
- Request goes to `http://localhost/encode` (port 80)

---

### Step 2: Nginx Receives Request

```nginx
# nginx/conf.d/default.conf
location /encode {
    proxy_pass http://steganovault_backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    client_max_body_size 100M;
}

upstream steganovault_backend {
    server web:5000;
    keepalive 32;
}
```

**Nginx actions:**

1. Matches `location /encode`
2. Validates request size (< 100 MB)
3. Adds headers: `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`
4. Forwards to `web:5000` via HTTP/1.1
5. Waits up to 300s for response

---

### Step 3: Gunicorn Routes to Flask

```
Gunicorn master (PID 1)
├── Worker 1 (PID 8)   ← Picks up this request
│   └── Thread 1       ← Handles synchronously
└── Worker 2 (PID 9)
```

**Gunicorn:**

- 2 worker processes (rule of thumb: 2 × CPU + 1)
- Each worker has 2 threads
- Total concurrency: 4 requests

---

### Step 4: Flask `/encode` Handler

```python
@app.route("/encode", methods=["POST"])
def encode():
    # 1. Extract fields
    uploaded_file = request.files['file']
    message = request.form.get("message")
    password = request.form.get("password", "")
    watermark = request.form.get("watermark", "")

    # 2. Validate
    if not message:
        return jsonify({"error": "Message is required"}), 400

    # 3. Sanitize filename
    filename = secure_filename(uploaded_file.filename)

    # 4. Create isolated temp directory
    temp_dir = tempfile.mkdtemp()                # e.g., /tmp/tmpabc123/
    file_path = os.path.join(temp_dir, filename)
    uploaded_file.save(file_path)

    # 5. Detect file type
    ext = os.path.splitext(file_path)[1].lower()

    try:
        start_time = time.time()

        # 6. Route to correct encoder
        if ext in [".png", ".jpg", ".jpeg"]:
            output_file, preview_file = encode_image(file_path, message, password, watermark)
        elif ext == ".txt":
            output_file = encode_txt(file_path, message, password)
        elif ext == ".pdf":
            output_file = encode_pdf(file_path, message, password)
        elif ext == ".docx":
            output_file = encode_docx(file_path, message, password)
        elif ext in [".wav", ".mp3"]:
            output_file = encode_audio(file_path, message, password)
        elif ext in [".mp4", ".avi", ".mov"]:
            output_file = encode_video(file_path, message, password)
        else:
            return jsonify({"error": "Unsupported format"}), 400

        # 7. Compute checksum
        with open(output_file, "rb") as f:
            checksum = hashlib.sha256(f.read()).hexdigest()

        # 8. Optional: upload to Google Drive
        share_url = upload_to_drive(output_file, final_filename)

        # 9. Build response headers
        response_data = {
            "status": "success",
            "filename": final_filename,
            "checksum": checksum,
            "processing_time": round(time.time() - start_time, 2),
            "preview_url": url_for('static', filename=preview_file) if preview_file else None,
            "share_url": share_url
        }

        # 10. Send file with metadata in custom header
        response = send_file(output_file, as_attachment=True, download_name=final_filename)
        response.headers["X-Response-Data"] = json.dumps(response_data)
        return response

    except Exception as e:
        logger.error(f"Encode Error: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        # 11. ALWAYS cleanup temp directory
        shutil.rmtree(temp_dir, ignore_errors=True)
```

---

### Step 5: Image Encoder Function

```python
def encode_image(input_path, message, password, watermark=None):
    # 1. Ensure PNG format
    if not input_path.lower().endswith(".png"):
        input_path = convert_to_png(input_path)

    # 2. Build composite message
    #    Format: [watermark:]password:message
    secret_message = f"{password}:{message}" if password else message
    if watermark:
        secret_message = f"{watermark}:{secret_message}"

    # 3. Hide message using LSB steganography
    encoded_img = lsb.hide(input_path, secret_message)
    output_path = input_path.replace(".png", "_encoded.png")
    encoded_img.save(output_path, format="PNG", quality=95)

    # 4. Generate thumbnail preview
    preview_filename = generate_preview(output_path)
    return output_path, preview_filename
```

**Stegano library internals:**

- Converts image to numpy array
- Converts message to binary
- Modifies LSB of first N pixels
- Reconstructs image
- Returns PIL Image object

**Capacity check:**

- 1 MB PNG (1024×1024) = ~3 million bits
- Message "hello:test" = ~80 bits
- Plenty of space ✅

---

### Step 6: Response Path Back

```
Flask → Gunicorn → Nginx → Browser
```

**Response headers:**

```http
HTTP/1.1 200 OK
Content-Type: image/png
Content-Disposition: attachment; filename="encoded_uuid_original_encoded.png"
X-Response-Data: {"status":"success","filename":"...","checksum":"abc123...","processing_time":0.31,"preview_url":"/static/...","share_url":null}
Content-Length: 1458234
```

---

### Step 7: Browser Handles Response

```javascript
const response = await fetch('/encode', { method: 'POST', body: formData });

// 1. Extract metadata from custom header
const responseData = JSON.parse(response.headers.get('X-Response-Data'));

// 2. Show before/after previews
if (file.type.startsWith('image/') && responseData.preview_url) {
    previewAfterImg.src = responseData.preview_url;
    previewAfter.classList.remove('hidden');
}

// 3. Trigger download
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = responseData.filename;
a.click();

// 4. Update UI
updateStealthScore(10);
output.innerHTML = `<p class="text-green-500">✅ Mission complete!</p>`;
```

---

### Complete Encode Flow Diagram

```
[Browser]
   │
   │ POST /encode (multipart/form-data, 1 MB image)
   ▼
[Nginx :80]
   │  • Validates body size
   │  • Adds X-Forwarded-* headers
   │  • Proxy to web:5000
   ▼
[Gunicorn :5000]
   │  • Worker picks up request
   │  • Routes to /encode handler
   ▼
[Flask app.py]
   │  • secure_filename()
   │  • tempfile.mkdtemp()
   │  • save uploaded file
   │  • Detect extension
   ▼
[encode_image()]
   │  • Convert to PNG
   │  • lsb.hide(input, message)
   │  • Save encoded PNG
   │  • Generate preview
   ▼
[hashlib]
   │  • SHA-256 checksum
   ▼
[send_file]
   │  • Return response with X-Response-Data header
   ▼
[Gunicorn → Nginx → Browser]
   │
   │ Response: encoded file + metadata
   ▼
[Browser]
   │  • Parse X-Response-Data
   │  • Show preview
   │  • Download file
   │  • Update stealth score
   ▼
[DONE ✅]
```

---

## 📨 Request Lifecycle — Decode

Decode is similar but **simpler** — no checksum verification, no Drive upload.

```python
@app.route("/decode", methods=["POST"])
def decode():
    uploaded_file = request.files['file']
    password = request.form.get("password", "")

    filename = secure_filename(uploaded_file.filename)
    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, filename)
    uploaded_file.save(file_path)

    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext in [".png", ".jpg", ".jpeg"]:
            decoded_message, preview_file = decode_image(file_path, password)
        elif ext == ".txt":
            decoded_message = decode_txt(file_path, password)
        # ... other formats

        return jsonify({
            "status": "success",
            "message": decoded_message,
            "preview_url": url_for('static', filename=preview_file) if preview_file else None,
            "processing_time": round(time.time() - start_time, 2)
        })
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
```

**Decode function (image):**

```python
def decode_image(input_path, password):
    # 1. Reveal hidden message
    extracted_message = lsb.reveal(input_path)

    # 2. Parse "password:message" format
    if extracted_message and ":" in extracted_message:
        parts = extracted_message.split(":")
        if len(parts) == 3:                        # watermark:password:message
            stored_password, stored_message = parts[1], parts[2]
        else:                                      # password:message
            stored_password, stored_message = parts[0], parts[1]

        # 3. Validate password
        if stored_password == password:
            return stored_message, None
        return "Incorrect password!", None

    return extracted_message, None
```

**Response:**

```json
{
    "status": "success",
    "message": "hello world",
    "processing_time": 0.15,
    "preview_url": null
}
```

---

## 💾 Database Workflow

### Initialization (First Boot)

```
Container starts
   │
   ▼
[mysql:8.0 entrypoint]
   │
   ├──▶ 1. Initialize data directory /var/lib/mysql
   │
   ├──▶ 2. Set root password
   │
   ├──▶ 3. Create database: steganovault
   │
   ├──▶ 4. Create user: stegano / stegano123
   │
   ├──▶ 5. Grant ALL on steganovault.* to stegano
   │
   ├──▶ 6. Check if /docker-entrypoint-initdb.d/ has .sql files
   │      │
   │      └──▶ Run init.sql (mounted from ./init-db/init.sql)
   │          ├── CREATE TABLE users ...
   │          ├── CREATE TABLE otp_storage ...
   │          ├── CREATE TABLE reviews ...
   │          └── INSERT INTO reviews (seed data) ...
   │
   └──▶ 7. Start mysqld
```

**Important:** `init.sql` runs **only on the FIRST boot** when `/var/lib/mysql` is empty. If you change `init.sql` later, you must `docker compose down -v` to reset.

---

### Connection Pool

```python
MYSQL_CONFIG = {
    'host': 'mysql',
    'port': 3306,
    'user': 'stegano',
    'password': 'stegano123',
    'database': 'steganovault',
    'charset': 'utf8mb4',
    'autocommit': True,
}

# Pool of 10 reusable connections
db_pool = pooling.MySQLConnectionPool(
    pool_name="stegano_pool",
    pool_size=10,
    pool_reset_session=True,
    **MYSQL_CONFIG
)

def get_db():
    return db_pool.get_connection()                # Reuse connection
```

**Pool lifecycle:**

```
App starts
   │
   ▼
Pool creates 10 connections
   │
   ▼
Request comes in → get_db() → reuse a connection
   │
   ▼
Query executes → cursor.close() → connection stays open
   │
   ▼
conn.close() → returns connection to pool (NOT closed)
   │
   ▼
Next request reuses it
```

**Why 10?** Enough for 2 workers × 2 threads + headroom. MySQL max default is 151.

---

### Common Query Pattern

```python
def get_user_by_email(email):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, name, email, password, verified FROM users WHERE email = %s",
        (email,)                                    # Parameterized
    )
    user = cursor.fetchone()
    cursor.close()
    conn.close()                                    # Return to pool
    return user
```

**Best practices followed:**

- ✅ Parameterized queries (`%s`)
- ✅ `dictionary=True` for named columns
- ✅ Explicit `cursor.close()` + `conn.close()`
- ✅ No string concatenation
- ✅ Connection returned to pool (not destroyed)

---

## 🔐 Authentication Workflow

### Registration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User submits registration form                                │
│    POST /auth/register                                            │
│    { "name": "Test", "email": "test@example.com", "password": "..." }│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Flask /auth/register                                          │
│    a. Validate inputs (name, email, password >= 8 chars)         │
│    b. Check if email already exists                              │
│    c. Hash password with BCrypt                                  │
│    d. INSERT INTO users                                          │
│    e. Generate 6-digit OTP                                       │
│    f. INSERT INTO otp_storage (ON DUPLICATE KEY UPDATE)          │
│    g. Send email via SMTP (Flask-Mail)                           │
│    h. Return { "message": "OTP sent to your email" }             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. User receives email with OTP (e.g., "482917")                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. User submits OTP                                              │
│    POST /auth/verify                                             │
│    { "email": "test@example.com", "otp": "482917" }              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Flask /auth/verify                                            │
│    a. SELECT otp, timestamp FROM otp_storage WHERE email = ?     │
│    b. Check OTP matches                                          │
│    c. Check timestamp < 5 minutes old                            │
│    d. UPDATE otp_storage SET verified = TRUE                     │
│    e. UPDATE users SET verified = TRUE                           │
│    f. Return { "message": "Email verified successfully" }        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. User can now login                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

### Login Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. POST /auth/login                                              │
│    { "email": "test@example.com", "password": "..." }            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Flask /auth/login                                             │
│    a. SELECT * FROM users WHERE email = ?                        │
│    b. Check user exists                                          │
│    c. bcrypt.checkpw(password, user.password)                    │
│    d. Check user.verified == TRUE                                │
│    e. session['user_id'] = user.email                            │
│    f. Return { "message": "Login successful", "user": {...} }    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Flask sets session cookie                                     │
│    Set-Cookie: session=eyJ1c2VyX2lkIjoi..."; HttpOnly; SameSite=Lax │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Browser stores cookie for localhost                           │
│    Subsequent requests include: Cookie: session=...              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Flask decodes session on next request                         │
│    if 'user_id' in session:                                      │
│        user = get_user_by_email(session['user_id'])              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Processing Pipeline

### Supported Formats & Techniques

| Format | Technique | Library | Capacity |
|--------|-----------|---------|----------|
| **PNG/JPG** | LSB in pixels | `stegano` | ~10% of file size |
| **TXT** | Zero-width Unicode | Custom | Unlimited (just appends) |
| **PDF** | Metadata field | `PyPDF2` | ~1 KB |
| **DOCX** | Hidden text runs | `python-docx` | ~1 KB |
| **WAV/MP3** | LSB in samples | `pydub` + `numpy` | ~10% |
| **MP4/AVI** | Container metadata | `mutagen` | ~1 KB |

---

### Common Processing Steps (All Formats)

```
1. Receive uploaded file (multipart)
   └── Saved to /tmp/tmpXXXX/

2. Sanitize filename
   └── werkzeug.utils.secure_filename()

3. Detect MIME type from extension
   └── os.path.splitext(file_path)[1].lower()

4. Route to appropriate encoder/decoder
   └── Based on extension

5. Process file (see per-format below)

6. Return response
   └── send_file() OR jsonify()

7. Cleanup
   └── shutil.rmtree(temp_dir) in finally block
```

---

### Per-Format Deep Dive

#### Image (PNG/JPG)

```python
def encode_image(input_path, message, password, watermark=None):
    # 1. Convert to PNG (JPG is lossy — destroys LSBs)
    if not input_path.lower().endswith(".png"):
        img = Image.open(input_path).convert("RGB")
        png_path = input_path.rsplit(".", 1)[0] + "_converted.png"
        img.save(png_path, format="PNG", quality=95)
        input_path = png_path

    # 2. Compose message with password prefix
    secret_message = f"{password}:{message}" if password else message

    # 3. Hide using LSB
    encoded_img = lsb.hide(input_path, secret_message)
    output_path = input_path.replace(".png", "_encoded.png")
    encoded_img.save(output_path, format="PNG", quality=95)

    # 4. Generate preview (300x300 thumbnail)
    preview_filename = generate_preview(output_path)

    return output_path, preview_filename
```

**Why convert to PNG?** JPG uses lossy compression — it changes pixel values, destroying LSBs. PNG is lossless.

---

#### Text (TXT)

```python
def encode_txt(input_path, message, password):
    with open(input_path, "r", encoding="utf-8") as f:
        original = f.read()

    # 1. Convert message to binary
    binary_data = ''.join(format(ord(c), '08b') for c in secret_message)

    # 2. Map bits to zero-width chars
    encoded = ''.join(
        "\u200B" if b == "0" else "\u200D"   # ZWSP vs ZWJ
        for b in binary_data
    )

    # 3. Append to original
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(original + "\n" + encoded)
```

**Unicode chars used:**

- `\u200B` = Zero-Width Space (represents bit `0`)
- `\u200D` = Zero-Width Joiner (represents bit `1`)

Visually **invisible** in any text editor.

---

#### PDF

```python
def encode_pdf(input_path, message, password):
    reader = PdfReader(input_path)
    writer = PdfWriter()

    # Copy all pages
    for page in reader.pages:
        writer.add_page(page)

    # Add custom metadata
    writer.add_metadata({"/Message": secret_message})

    with open(output_path, "wb") as f:
        writer.write(f)
```

**Hides in PDF metadata** (accessible via `pdfinfo` or PyPDF2).

---

#### DOCX

```python
def encode_docx(input_path, message, password):
    doc = Document(input_path)

    # Add paragraph with hidden text
    paragraph = doc.add_paragraph()
    run = paragraph.add_run(secret_message)
    run.font.hidden = True     # Sets w:vanish in XML

    doc.save(output_path)
```

**Hidden text** in Word — press `Ctrl+*` to reveal.

---

#### Audio (WAV/MP3)

```python
def encode_audio(input_path, message, password):
    # Convert to WAV (uncompressed)
    audio = AudioSegment.from_file(input_path)
    wav_path = input_path.rsplit(".", 1)[0] + "_converted.wav"
    audio.export(wav_path, format="wav", codec="pcm_s16le")

    # Prepare binary message
    binary_message = format(len(secret_bytes), '032b') + ''.join(format(b, '08b') for b in secret_bytes)

    # Modify LSB of first N samples
    samples_array = np.array(audio.get_array_of_samples(), dtype=np.int16)
    for i in range(len(binary_message)):
        samples_array[i] = (samples_array[i] & ~1) | int(binary_message[i])

    # Save
    encoded_audio = audio._spawn(samples_array.tobytes())
    encoded_audio.export(output_path, format="wav", codec="pcm_s16le")
```

**Same LSB technique** as images, but on audio samples.

---

#### Video (MP4)

```python
def encode_video(input_path, message, password):
    # 1. Copy video as-is
    shutil.copy2(input_path, output_path)

    # 2. Add metadata to MP4 container
    video = MP4(output_path)
    video['desc'] = base64.b64encode(secret_message.encode()).decode()
    video.save()
```

**Metadata approach** — doesn't modify video frames, just adds a `desc` tag.

---

## 🛑 Shutdown & Cleanup

### Graceful Shutdown

```
$ docker compose down
   │
   ▼
Docker sends SIGTERM to all containers
   │
   ├──▶ MySQL
   │    └── Flushes pending writes
   │    └── Closes connections
   │    └── Exits cleanly
   │
   ├──▶ Gunicorn
   │    └── Stops accepting new requests
   │    └── Waits for in-flight requests to complete (max 30s)
   │    └── Kills workers
   │    └── Exits
   │
   ├──▶ Nginx
   │    └── Stops accepting new connections
   │    └── Waits for active connections to close
   │    └── Exits
   │
   └──▶ phpMyAdmin
        └── Exits immediately
   │
   ▼
Docker removes:
├── Containers
└── Network (stegano-net)
   │
   ▼
Volumes preserved (mysql-data still exists)
```

---

### Data Persistence

| Scenario | MySQL Data | Static Files | Logs |
|----------|-----------|--------------|------|
| `docker compose restart` | ✅ Preserved | ✅ Preserved | ✅ Preserved |
| `docker compose down` | ✅ Preserved | ✅ Preserved | ✅ Preserved |
| `docker compose down -v` | ❌ **Deleted** | ✅ Preserved | ✅ Preserved |
| `docker compose down --rmi all` | ❌ **Deleted** | ✅ Preserved | ✅ Preserved |

**Where MySQL data lives:**

```
Host: /var/lib/docker/volumes/steganovault_mysql-data/_data/
      (requires sudo to inspect)
```

---

## 📊 Complete Visual Diagram

### End-to-End Request Flow

```
┌──────────────┐
│   Browser    │
│  localhost   │
└──────┬───────┘
       │
       │ 1. HTTP Request
       │    GET /  or  POST /encode
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    NGINX  (:80)                               │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Static files → serve directly                        │  │
│  │  /static/css/style.css                                │  │
│  │  /static/js/app.js                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Dynamic → proxy_pass http://web:5000                 │  │
│  │  /, /encode, /decode, /auth/*, /api/*                 │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     │ 2. Proxy request
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                    GUNICORN  (:5000)                          │
│                                                               │
│  Master process (PID 1)                                       │
│    ├── Worker 1 (PID 8)  ← Routes to Flask                   │
│    └── Worker 2 (PID 9)                                       │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     │ 3. WSGI call
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                    FLASK APP                                  │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Route Handler                                      │    │
│  │    /encode → encode()                               │    │
│  │    /decode → decode()                               │    │
│  │    /auth/login → login()                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Business Logic                                     │    │
│  │    encode_image()  →  lsb.hide()                    │    │
│  │    encode_pdf()    →  PyPDF2 metadata               │    │
│  │    encode_audio()  →  numpy LSB                     │    │
│  └─────────────────────────────────────────────────────┘    │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     │ 4. Query (if needed)
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                    MYSQL  (:3306)                             │
│                                                               │
│  Connection Pool: 10 idle connections                         │
│  Tables: users, otp_storage, reviews                          │
│  Volume: mysql-data (persistent)                              │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     │ 5. Response
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                 BACK TO BROWSER                               │
│                                                               │
│  JSON:  { "status": "success", "message": "hello" }          │
│  File:  encoded_uuid_file.png (with X-Response-Data header)  │
└──────────────────────────────────────────────────────────────┘
```

---

### Data Flow Through Containers

```
[User Input]
    │
    ├── File (multipart)
    ├── Message (string)
    └── Password (string)
         │
         ▼
   [Nginx :80]
         │
         │ Adds headers: X-Real-IP, X-Forwarded-For
         ▼
   [Flask :5000]
         │
         ├──▶ Temp file: /tmp/tmpXXX/input.png
         │
         ├──▶ LSB encoding → /tmp/tmpXXX/output.png
         │
         ├──▶ Save to MySQL (if authenticated)
         │    └── INSERT INTO reviews ...
         │
         ├──▶ [MySQL :3306]
         │    └── Data persisted to volume
         │
         └──▶ Cleanup: rm -rf /tmp/tmpXXX/
         │
         ▼
   [Response]
         │
         ├── File blob (encoded image)
         └── X-Response-Data JSON header
         │
         ▼
   [Browser]
         │
         ├── Parse header
         ├── Show preview
         ├── Trigger download
         └── Update stealth score
```

---

## 🎯 Summary Table

| Phase | Command | Duration | What Happens |
|-------|---------|----------|--------------|
| **Build** | `docker compose build` | 8–15 min | Compile custom image |
| **Start** | `docker compose up -d` | ~90s | All containers boot, health checks pass |
| **Request — Encode** | User clicks Encode | ~0.3s | File → Nginx → Flask → LSB → Response |
| **Request — Decode** | User clicks Decode | ~0.2s | File → Nginx → Flask → Extract → Response |
| **Request — Health** | `curl /health` | ~10ms | DB ping + return JSON |
| **Stop** | `docker compose down` | ~5s | SIGTERM → graceful shutdown |
| **Reset** | `docker compose down -v` | ~5s | Data deleted |

---

## 🔑 Key Takeaways

1. **4 containers, 1 network** — Communication via service names
2. **Nginx is the only public entry point** — Flask/MySQL internal only
3. **Startup is ordered** — MySQL healthy → Web healthy → Nginx starts
4. **Temp files always cleanup** — `finally` block with `shutil.rmtree()`
5. **Connection pooling** — 10 MySQL connections reused across requests
6. **Static files served by Nginx** — not Flask (performance)
7. **Data persists in Docker volumes** — survives container restarts
8. **Health checks ensure reliable startup** — no race conditions

---

## 📞 Debugging Tips

```bash
# See everything happening
docker compose logs -f

# Check a specific container
docker compose logs -f web

# Inspect network
docker network inspect steganovault_stegano-net

# Check volume
docker volume inspect steganovault_mysql-data

# Test connectivity from inside web
docker compose exec web bash
$ curl http://mysql:3306      # Should fail (not HTTP)
$ curl http://nginx:80/health # Should return JSON

# Test DB connection
docker compose exec web python -c "import mysql.connector; conn = mysql.connector.connect(host='mysql', user='stegano', password='stegano123', database='steganovault'); print('✅ DB OK'); conn.close()"
```

---

<div align="center">

**Built with ❤️ — Understanding the flow is 90% of the battle**

</div>

# 📖 SteganoVault - Complete User Guide

> A beginner-friendly, end-to-end setup guide for deploying SteganoVault from scratch. No prior DevOps experience required.

---

## 📋 Table of Contents

- [What You'll Need](#-what-youll-need)
- [Step 1: Install Docker](#-step-1-install-docker)
- [Step 2: Clone the Repository](#-step-2-clone-the-repository)
- [Step 3: Configure Environment](#-step-3-configure-environment)
- [Step 4: Build and Launch](#-step-4-build-and-launch)
- [Step 5: Verify Installation](#-step-5-verify-installation)
- [Step 6: Access the Application](#-step-6-access-the-application)
- [Step 7: Test Core Features](#-step-7-test-core-features)
- [Step 8: Database Management](#-step-8-database-management)
- [Step 9: User Account Setup](#-step-9-user-account-setup)
- [Step 10: Troubleshooting](#-step-10-troubleshooting)
- [Step 11: Common Operations](#-step-11-common-operations)
- [Step 12: Cleanup & Reset](#-step-12-cleanup--reset)
- [Next Steps](#-next-steps)

---

## 🎯 What You'll Need

Before you start, make sure you have:

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Operating System** | Linux, macOS, or Windows 10+ | Ubuntu 22.04+ / macOS |
| **RAM** | 4 GB | 8 GB |
| **Disk Space** | 5 GB free | 10 GB free |
| **Docker** | 20.10+ | Latest |
| **Docker Compose** | v2.0+ | Latest |
| **Git** | Any | Latest |
| **Internet** | For initial setup | — |

### Verify Your System

Open a terminal (or PowerShell on Windows) and run:

```bash
# Check Docker
docker --version
# Expected: Docker version 24.x.x or higher

# Check Docker Compose
docker compose version
# Expected: Docker Compose version v2.x.x

# Check Git
git --version
# Expected: git version 2.x.x
```

**If any command fails**, follow Step 1 to install what's missing.

---

## 🔧 Step 1: Install Docker

### 🐧 For Linux (Ubuntu / Debian)

**1.1 Update your system:**

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

**1.2 Install Docker's official GPG key:**

```bash
sudo apt-get install -y ca-certificates curl gnupg lsb-release

sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

**1.3 Add Docker's repository:**

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

**1.4 Install Docker and Compose:**

```bash
sudo apt-get update
sudo apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
```

**1.5 Add your user to the docker group (avoid sudo):**

```bash
sudo usermod -aG docker $USER

# IMPORTANT: Log out and log back in for changes to take effect
# Or run: newgrp docker
```

**1.6 Verify installation:**

```bash
docker run hello-world
```

You should see:

```
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

---

### 🍎 For macOS

**Option A — Docker Desktop (recommended):**

1. Download from [https://docs.docker.com/desktop/install/mac-install/](https://docs.docker.com/desktop/install/mac-install/)
2. Open the `.dmg` file
3. Drag **Docker** to **Applications**
4. Launch Docker from Applications
5. Wait for the whale icon 🐳 in the menu bar to stop animating

**Option B — Homebrew:**

```bash
brew install --cask docker
open /Applications/Docker.app
```

---

### 🪟 For Windows

**Requirement:** Windows 10/11 with **WSL2** enabled.

**1.1 Enable WSL2 (if not enabled):**

Open PowerShell as Administrator:

```powershell
wsl --install
```

Restart your computer.

**1.2 Install Docker Desktop:**

1. Download from [https://docs.docker.com/desktop/install/windows-install/](https://docs.docker.com/desktop/install/windows-install/)
2. Run the installer
3. Ensure **"Use WSL 2 instead of Hyper-V"** is checked
4. Complete installation and restart

**1.3 Verify:**

Open PowerShell:

```powershell
docker --version
docker compose version
```

---

### 📥 Install Git (if missing)

**Linux:**

```bash
sudo apt-get install -y git
```

**macOS:**

```bash
brew install git
# OR install Xcode Command Line Tools:
xcode-select --install
```

**Windows:**

Download from [https://git-scm.com/download/win](https://git-scm.com/download/win)

---

## 📂 Step 2: Clone the Repository

**2.1 Choose a directory:**

```bash
# Navigate to your preferred folder
cd ~/Desktop          # Linux/macOS
# OR
cd C:\Users\YourName\Desktop   # Windows
```

**2.2 Clone:**

```bash
git clone https://github.com/hritikranjan1/SteganoVault-Docker.git
```

**2.3 Enter the project:**

```bash
cd SteganoVault-Docker
```

**2.4 Verify contents:**

```bash
ls -la
```

**Expected output:**

```
.env.example
.gitignore
Dockerfile
LICENSE
README.md
app.py
docker-compose.yml
init-db/
logs/
nginx/
requirements.txt
scripts/
static/
templates/
tmp/
```

If files are present ✅ → Continue to Step 3.

---

## ⚙️ Step 3: Configure Environment

**3.1 Create `.env` from template:**

```bash
cp .env.example .env
```

**3.2 Open for editing:**

```bash
# Linux/macOS
nano .env

# Windows (Notepad)
notepad .env
```

**3.3 Minimum configuration (copy this):**

```env
# ============================================
# Flask Configuration
# ============================================
SECRET_KEY=change-this-to-a-random-string-min-32-chars
FLASK_ENV=production

# ============================================
# MySQL Database
# ============================================
MYSQL_ROOT_PASSWORD=rootpassword123
MYSQL_DATABASE=steganovault
MYSQL_USER=stegano
MYSQL_PASSWORD=stegano123

# ============================================
# Email (Optional — for OTP verification)
# Leave blank if not testing user registration
# ============================================
MAIL_SERVER=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_DEFAULT_SENDER=noreply@steganovault.com

# ============================================
# Google Drive (Optional — for file sharing)
# Leave blank if not using
# ============================================
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_CREDENTIALS=
```

**3.4 Generate a strong `SECRET_KEY`:**

Run this command and paste the output as `SECRET_KEY` in `.env`:

```bash
# Linux/macOS
python3 -c "import secrets; print(secrets.token_hex(32))"

# Windows PowerShell
python -c "import secrets; print(secrets.token_hex(32))"
```

**Example output:**

```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**3.5 Save the file:**

- **nano:** `Ctrl + O` → `Enter` → `Ctrl + X`
- **Notepad:** `Ctrl + S`

**3.6 ⚠️ Important Security Note:**

**NEVER commit `.env` to Git.** The `.gitignore` already excludes it, but verify:

```bash
cat .gitignore | grep env
# Should show: .env
```

---

## 🚀 Step 4: Build and Launch

**4.1 Make scripts executable (Linux/macOS only):**

```bash
chmod +x scripts/entrypoint.sh
```

**4.2 Build and start:**

```bash
docker compose up -d --build
```

**What this does:**

| Action | Duration |
|--------|----------|
| Download MySQL, Nginx, phpMyAdmin images | ~2 min (500 MB) |
| Build custom Flask image (installs FFmpeg, OpenCV, Python deps) | ~10 min first time |
| Create Docker network `stegano-net` | Instant |
| Create Docker volume `mysql-data` | Instant |
| Start MySQL, wait for healthy | ~30 sec |
| Start Flask, wait for healthy | ~60 sec |
| Start Nginx and phpMyAdmin | ~5 sec |

**Total:** ~12-15 minutes first time.

**4.3 Watch the progress (optional):**

Open a **second terminal** and run:

```bash
docker compose logs -f
```

You'll see logs from all 4 containers interleaved. Look for:

```
steganovault-mysql  | [Server] /usr/sbin/mysqld: ready for connections
steganovault-web    | ✅ MySQL is ready!
steganovault-web    | [INFO] Listening at: http://0.0.0.0:5000
steganovault-web    | INFO:app:MySQL connection pool created
```

Press `Ctrl + C` to stop viewing logs (containers keep running).

---

## ✅ Step 5: Verify Installation

**5.1 Check container status:**

```bash
docker compose ps
```

**Expected output:**

```
NAME                       STATUS                    PORTS
steganovault-mysql         Up (healthy)              0.0.0.0:3306->3306/tcp
steganovault-nginx         Up (healthy)              0.0.0.0:80->80/tcp
steganovault-phpmyadmin    Up                        0.0.0.0:8081->80/tcp
steganovault-web           Up (healthy)              5000/tcp
```

**Key things to check:**

- ✅ All 4 containers show `Up`
- ✅ 3 containers show `(healthy)` — mysql, nginx, web
- ✅ phpMyAdmin doesn't have a healthcheck (normal)

**If any container is `exited` or `unhealthy`:**

```bash
# Check logs for that container
docker compose logs <container-name>

# Example
docker compose logs web
```

**5.2 Test the health endpoint:**

```bash
curl http://localhost/health
```

**Expected response:**

```json
{
    "status": "healthy",
    "timestamp": "2026-09-27T17:00:00.000000",
    "version": "1.0.0",
    "services": {
        "database": "healthy",
        "api": "healthy"
    }
}
```

**Pretty-printed (Linux/macOS):**

```bash
curl http://localhost/health | python3 -m json.tool
```

**5.3 Test static files:**

```bash
curl -I http://localhost/static/css/style.css
# Expected: HTTP/1.1 200 OK

curl -I http://localhost/static/js/app.js
# Expected: HTTP/1.1 200 OK
```

**If any 404 error** → See [Step 10: Troubleshooting](#-step-10-troubleshooting).

---

## 🌐 Step 6: Access the Application

### 🖥️ Main Application

Open your browser and go to:

```
http://localhost
```

**You should see:**

- 🔐 SteganoVault logo and title
- 🎨 Theme selector (top-left dropdown)
- 🔑 Login button (top-right)
- 📊 Stealth Score counter
- 📁 Drag-and-drop file upload area
- 🔒 Encode / 🔓 Decode buttons
- 📈 User reviews section
- 💬 Testimonials carousel
- 🎮 Spy Target Practice game
- 📞 Contact form
- 📄 Footer with disclaimer

**First-time tip:** The default theme is **Dark**. Try switching to **Cyberpunk** or **Hacker Terminal** for a cool visual experience.

### 🗄️ phpMyAdmin (Database Admin)

Open:

```
http://localhost:8081
```

**Login with:**

- **Username:** `root`
- **Password:** `rootpassword123` *(or whatever you set in `.env`)*

**You'll see:**

- Left sidebar: database list
- Click **`steganovault`** to expand
- Tables: `users`, `otp_storage`, `reviews`

### ❤️ Health Endpoint

Open:

```
http://localhost/health
```

Returns JSON with service status — useful for monitoring.

### 🐬 MySQL via CLI (Advanced)

```bash
docker compose exec mysql mysql -u stegano -pstegano123 steganovault
```

You'll land in the MySQL prompt:

```
mysql>
```

Try these commands:

```sql
-- List all tables
SHOW TABLES;

-- See users
SELECT id, name, email, verified FROM users;

-- See reviews
SELECT name, rating, text FROM reviews;

-- Exit
EXIT;
```

---

## 🎯 Step 7: Test Core Features

### 🧪 Test 1: Encode a Message in an Image

**1.1 Prepare a test image:**

Find any **PNG or JPG** file on your computer (e.g., a screenshot).

**1.2 Upload:**

- Drag the image into the drop zone **or** click **Select File**
- The file name will appear below

**1.3 Enter message:**

In the **"Enter Message"** field, type:

```
Hello, this is my secret message!
```

**1.4 Optional password:**

In **"Optional Password"**, type:

```
mypassword123
```

**1.5 Click Encode:**

Click the green **🔒 Encode** button.

**1.6 What happens:**

- ✅ "Before" preview shows your original image
- ✅ "After" preview shows the encoded image (looks identical!)
- ✅ A file downloads automatically with a name like `encoded_uuid_original_encoded.png`
- ✅ A success message appears: *"Mission complete—secret secured!"*
- ✅ Stealth Score increases by **10 points**

**1.7 Where's the file:**

Check your **Downloads** folder. The file will be a PNG (even if you uploaded JPG — that's normal — we convert to PNG to preserve LSB data).

---

### 🧪 Test 2: Decode a Message from an Image

**2.1 Upload the encoded file:**

- Drag the file you just downloaded into the drop zone
- Or click **Select File** and choose it

**2.2 Enter password (if used):**

In the password field, type:

```
mypassword123
```

**2.3 Click Decode:**

Click the red **🔓 Decode** button.

**2.4 What happens:**

- ✅ A "Decoded Message" box appears below
- ✅ Your message shows: `Hello, this is my secret message!`
- ✅ Success message: *"Intel retrieved successfully!"*
- ✅ Stealth Score increases by **15 points**

**2.5 Try wrong password:**

- Re-upload the same file
- Enter a **wrong** password
- Click Decode
- You'll see: `Incorrect password!`

---

### 🧪 Test 3: Encode in Other Formats

Repeat the encode/decode process with different file types:

| Format | Steps |
|--------|-------|
| **TXT** | Create a `test.txt` file with some text, upload it, encode a message. Decode to see hidden message. |
| **PDF** | Use any PDF you have (a resume, a manual). Encode + decode. |
| **DOCX** | Use any Word document. Try opening in Word after encoding — hidden text is invisible! |
| **MP3/WAV** | Use any audio file. Encode + decode. |
| **MP4** | Use any short video (< 50 MB). Encode + decode. |

**Note:** Different formats have different capacity limits:

- **Images:** ~10% of file size
- **TXT:** Unlimited (appends hidden chars)
- **PDF/DOCX/MP4:** ~1 KB (metadata)
- **Audio:** ~10% of file size

---

### 🧪 Test 4: Theme Switching

**1. Locate the theme dropdown** in the top-left corner.

**2. Try these themes:**

- 🌙 **Dark** — Classic dark mode
- ☀️ **Light** — Clean white
- 💾 **Cyberpunk** — Neon pink/cyan with animated grid
- 🕵️ **Retro Spy** — Vintage gold with scanlines
- 🌌 **Neon Noir** — Dark with floating particles
- 📼 **Vaporwave** — 80s pink/purple with waves
- 💻 **Hacker Terminal** — Green Matrix code rain
- 🌠 **Cosmic Galaxy** — Purple/blue with twinkling stars
- 📺 **Glitchcore** — Aggressive glitch effects

**3. Watch the background change** as you switch themes.

---

### 🧪 Test 5: Play the Game

**1. Scroll down** to "Fun Activities" section.

**2. Click Start Game.**

**3. Click the moving target** as many times as you can within 10 seconds.

**4. Each click:**
- Target jumps to a new position
- Stealth Score increases by **5 points**

**5. After 10 seconds:**

- Alert shows your final score
- Game resets

---

### 🧪 Test 6: Register a User

**Note:** This requires valid SMTP credentials in `.env`. If you skipped email setup, you can still test the API via curl (see below).

**1. Click Login button** (top-right).

**2. Click Register.**

**3. Fill the form:**

- Name: `Test User`
- Email: `test@example.com`
- Password: `password123` (min 8 chars)

**4. Click Register.**

**5. Check your email** for a 6-digit OTP.

**6. Enter the OTP** to verify.

**7. Login** with your credentials.

**8. You can now:**
- Submit reviews
- See your name in reviews section

---

### 🧪 Test 7: Submit a Review

**Prerequisites:** Logged in.

**1. Scroll to "Share Your Experience".**

**2. Fill in:**

- Name: `Test User`
- Rating: ⭐⭐⭐⭐⭐
- Review: `Amazing tool for hiding secrets!`

**3. Click Submit.**

**4. See your review** appear in the reviews section below.

**5. Check phpMyAdmin** → `steganovault` → `reviews` table → Verify row exists.

---

## 🗄️ Step 8: Database Management

### 📊 Access via phpMyAdmin

**1. Open:** http://localhost:8081

**2. Login:**
- Server: `mysql` (already filled)
- Username: `root`
- Password: `rootpassword123`

**3. Explore:**
- Click **`steganovault`** in the left sidebar
- Click any table to view data
- Use **SQL** tab to run custom queries

### 💻 Access via MySQL CLI

```bash
docker compose exec mysql mysql -u stegano -pstegano123 steganovault
```

### 🔍 Useful Queries

```sql
-- Show all tables
SHOW TABLES;

-- Count users
SELECT COUNT(*) FROM users;

-- Show verified users
SELECT email, name, created_at FROM users WHERE verified = TRUE;

-- Show recent reviews
SELECT name, rating, LEFT(text, 50) AS preview FROM reviews ORDER BY timestamp DESC LIMIT 10;

-- Show active OTPs (not verified)
SELECT email, otp, timestamp FROM otp_storage WHERE verified = FALSE;

-- Average rating
SELECT AVG(rating) AS avg_rating, COUNT(*) AS total FROM reviews;
```

### 🔄 Reset Database

⚠️ **Warning:** This deletes ALL data — users, reviews, OTPs.

```bash
# Stop containers AND delete volumes
docker compose down -v

# Restart with fresh DB
docker compose up -d
```

**Why you'd do this:**

- Testing with clean slate
- Corrupted data recovery
- Forgot root password

---

## 👤 Step 9: User Account Setup

### 📧 Email Configuration (Optional)

If you want to test **user registration** with OTP, you need SMTP credentials.

**Recommended free option: Brevo (formerly Sendinblue)**

1. Sign up: [https://www.brevo.com/](https://www.brevo.com/)
2. Go to **SMTP & API** → **SMTP**
3. Copy your **SMTP server**, **login**, and **master password**
4. Update `.env`:

```env
MAIL_SERVER=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-brevo-email@example.com
MAIL_PASSWORD=your-brevo-smtp-key
MAIL_DEFAULT_SENDER=noreply@yourdomain.com
```

5. Restart the web container:

```bash
docker compose restart web
```

**Test it:**

```bash
# Register a user
curl -X POST http://localhost/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"password123"}'
```

**Alternative: Gmail (requires app password)**

1. Enable 2FA on your Google account
2. Generate an app password: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Use:

```env
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your.email@gmail.com
MAIL_PASSWORD=your-16-char-app-password
```

### 🔑 Google Drive Integration (Optional)

For automatic file sharing after encoding:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google Drive API**
4. Create a **Service Account** → Download JSON key
5. Share a Google Drive folder with the service account email
6. Copy the folder ID from the URL: `drive.google.com/drive/folders/FOLDER_ID_HERE`
7. Update `.env`:

```env
GOOGLE_DRIVE_FOLDER_ID=1a2b3c4d5e6f7g8h9i0j
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"...","private_key":"..."}
```

8. Restart:

```bash
docker compose restart web
```

After encoding, you'll get a share URL in the response.

---

## 🐛 Step 10: Troubleshooting

### ❌ Issue 1: Port 80 Already In Use

**Error:**

```
Error response from daemon: failed to bind host port 0.0.0.0:80/tcp:
address already in use
```

**Cause:** Something else is listening on port 80 (Apache, another container, etc.).

**Fix — Option A (find & stop):**

```bash
# Find process on port 80
sudo lsof -i :80

# Output example:
# COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
# apache2   1234  root   4u  IPv6  12345      0t0  TCP *:80 (LISTEN)

# Kill it
sudo kill -9 1234
```

**Fix — Option B (change SteganoVault's port):**

Edit `docker-compose.yml`:

```yaml
nginx:
  ports:
    - "8080:80"    # was "80:80"
```

Restart:

```bash
docker compose up -d nginx
```

Access at: **http://localhost:8080**

---

### ❌ Issue 2: Port 8081 Already In Use

**Fix:** Change phpMyAdmin port:

```yaml
phpmyadmin:
  ports:
    - "8082:80"    # was "8081:80"
```

Restart:

```bash
docker compose up -d phpmyadmin
```

Access at: **http://localhost:8082**

---

### ❌ Issue 3: Container Keeps Restarting

**Check logs:**

```bash
docker compose logs web --tail=50
```

**Common causes:**

| Cause | Fix |
|-------|-----|
| Missing `.env` | `cp .env.example .env` |
| Wrong DB credentials | Check `MYSQL_*` values |
| MySQL not ready | Wait 60s, or check `docker compose logs mysql` |
| Python import error | Rebuild: `docker compose up -d --build web` |

---

### ❌ Issue 4: UI is Broken / Unstyled

**Symptom:** Page loads, but looks like plain text with no colors.

**Cause:** CSS/JS not loading (404 or cached old version).

**Fix 1 — Hard refresh:**

```
Ctrl + Shift + R    (Windows/Linux)
Cmd + Shift + R     (Mac)
```

**Fix 2 — Clear browser cache:**

- Chrome: F12 → **Application** tab → **Storage** → **Clear site data**
- Firefox: F12 → **Storage** tab → **Delete All**

**Fix 3 — Test in incognito:**

- Chrome: `Ctrl + Shift + N`
- Firefox: `Ctrl + Shift + P`

**Fix 4 — Verify files exist:**

```bash
curl -I http://localhost/static/css/style.css
curl -I http://localhost/static/js/app.js

# Both should return: HTTP/1.1 200 OK
```

**Fix 5 — Check container files:**

```bash
docker compose exec web ls -la /app/static/css/
docker compose exec web ls -la /app/static/js/

# Should show: style.css, tailwind.min.css, app.js
```

---

### ❌ Issue 5: Encode/Decode Button Does Nothing

**Diagnosis:**

1. Open browser DevTools: `F12`
2. Go to **Console** tab
3. Click Encode button
4. Look for red errors

**Common errors & fixes:**

| Error | Fix |
|-------|-----|
| `addEventListener of null` | Stale `app.js` — hard refresh (Ctrl+Shift+R) |
| `404 /encode` | Nginx not routing — check `nginx/conf.d/default.conf` |
| `500 Internal Server Error` | Check `docker compose logs web` |
| `413 Request Entity Too Large` | File > 100 MB — increase `client_max_body_size` |

**Check Network tab:**

1. F12 → **Network** tab
2. Click Encode button
3. Look for `encode` request
4. Click it → **Response** tab

If you see JSON error → Backend is working. Check the message.

---

### ❌ Issue 6: MySQL Not Starting

**Check logs:**

```bash
docker compose logs mysql
```

**Common issues:**

| Error | Fix |
|-------|-----|
| `Permission denied` | `sudo chown -R $USER:$USER ./init-db` |
| `Corrupt data` | `docker compose down -v && docker compose up -d` |
| `Port 3306 already used` | Change port in `docker-compose.yml` |

---

### ❌ Issue 7: Health Check Failing

**Check web health:**

```bash
curl http://localhost/health
```

If response is `{"status":"degraded"}`, DB is down.

**Check DB:**

```bash
docker compose exec mysql mysqladmin ping -h localhost -u root -prootpassword123
```

If it fails, wait 30 seconds — MySQL may still be initializing.

---

### ❌ Issue 8: Out of Disk Space

```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# Clean up unused data
docker system prune -a --volumes
```

⚠️ **Warning:** `--volumes` deletes ALL volumes — including `mysql-data`.

---

### 🆘 Still Stuck?

Get help:

1. **Collect diagnostics:**

```bash
docker compose ps > diagnostics.txt
docker compose logs >> diagnostics.txt 2>&1
docker version >> diagnostics.txt
```

2. **Open an issue:** [GitHub Issues](https://github.com/hritikranjan1/SteganoVault-Docker/issues)

3. **Include in report:**
   - What you tried
   - Expected vs actual behavior
   - Screenshots
   - `diagnostics.txt` contents

---

## 🔧 Step 11: Common Operations

### ▶️ Start / Stop

```bash
# Start all services (if stopped)
docker compose start

# Stop all services (keep containers)
docker compose stop

# Restart all services
docker compose restart

# Restart a specific service
docker compose restart web
docker compose restart nginx
docker compose restart mysql
```

### 🔄 Rebuild After Code Changes

**Change in `app.py`:**

```bash
docker compose restart web
```

**Change in `Dockerfile` or `requirements.txt`:**

```bash
docker compose up -d --build web
```

**Change in `docker-compose.yml`:**

```bash
docker compose up -d
```

**Change in `nginx/conf.d/default.conf`:**

```bash
docker compose restart nginx
```

**Change in `static/css/style.css` or `static/js/app.js`:**

Just hard refresh browser — volumes mount these files live.

### 📜 View Logs

```bash
# All services (live)
docker compose logs -f

# Specific service (live)
docker compose logs -f web

# Last 100 lines (no follow)
docker compose logs --tail=100 web

# Since a specific time
docker compose logs --since 2024-01-01T10:00:00 web
```

### 💻 Shell Access

```bash
# Flask container
docker compose exec web bash

# Inside container, run Python
python3 -c "import flask; print(flask.__version__)"

# MySQL container
docker compose exec mysql bash

# MySQL CLI
docker compose exec mysql mysql -u stegano -pstegano123 steganovault

# Nginx container
docker compose exec nginx sh
nginx -t   # Test config
nginx -s reload   # Reload config
```

### 📊 Resource Monitoring

```bash
# Live resource usage
docker stats

# Snapshot (no live)
docker stats --no-stream

# Container processes
docker compose top
```

### 💾 Backup Database

```bash
# Backup to file
docker compose exec mysql mysqldump \
    -u root -prootpassword123 \
    steganovault > backup_$(date +%Y%m%d).sql

# Restore from file
docker compose exec -T mysql mysql \
    -u root -prootpassword123 \
    steganovault < backup_20240101.sql
```

### 🔍 Inspect Containers

```bash
# Full config
docker inspect steganovault-web

# Environment variables
docker compose exec web env | grep -v PASSWORD

# Filesystem
docker compose exec web ls -la /app/

# Network
docker network inspect steganovault_stegano-net
```

---

## 🧹 Step 12: Cleanup & Reset

### 🛑 Stop Everything (Keep Data)

```bash
docker compose down
```

- **Containers:** Removed
- **Networks:** Removed
- **Volumes:** ✅ **Preserved** (data safe)
- **Images:** Preserved

Restart with: `docker compose up -d`

### 🗑️ Stop Everything + Delete Data

```bash
docker compose down -v
```

- **Containers:** Removed
- **Networks:** Removed
- **Volumes:** ❌ **DELETED** (data lost)
- **Images:** Preserved

Restart with: `docker compose up -d` (fresh DB)

### 🧨 Full Cleanup

```bash
# Remove containers, networks, volumes, AND images
docker compose down -v --rmi all

# Remove ALL unused Docker data on your system
docker system prune -a --volumes
```

⚠️ **Warning:** `docker system prune -a --volumes` removes **everything** — including images for other projects. Use with caution.

### 🔙 Uninstall Docker (if needed)

**Linux:**

```bash
sudo apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo rm -rf /var/lib/docker /var/lib/containerd
sudo rm -rf /etc/docker /etc/apt/sources.list.d/docker.list
```

**macOS/Windows:** Use the Docker Desktop uninstaller.

---

## 🎓 Next Steps

### 📚 Learn More

Now that SteganoVault is running:

1. **[ARCHITECTURE.md](ARCHITECTURE.md)** — Understand the design decisions
2. **[WORKFLOW.md](WORKFLOW.md)** — Trace a request through the system
3. **[ISSUES.md](ISSUES.md)** — See problems I faced and fixed
4. **[INTERVIEW_QA.md](INTERVIEW_QA.md)** — Prepare for technical interviews

### 🚀 Extend the Project

Try these exercises:

1. **Add a new file format** (e.g., SVG) — implement `encode_svg` / `decode_svg`
2. **Add rate limiting** — use `Flask-Limiter`
3. **Add unit tests** — use `pytest`
4. **Add HTTPS** — use `certbot` with Nginx
5. **Migrate to Kubernetes** — use `kompose convert`
6. **Add Prometheus metrics** — instrument Flask endpoints

### 🐛 Contribute

- **Found a bug?** [Open an issue](https://github.com/hritikranjan1/SteganoVault-Docker/issues)
- **Have a fix?** Submit a PR
- **Have a suggestion?** Start a discussion

### ⭐ Show Support

If this project helped you:

- ⭐ **Star** the repo
- 🐦 **Share** on social media
- 📝 **Blog** about your experience

---

## 🎉 You're Done!

You've successfully deployed SteganoVault — a **4-container, production-grade steganography platform** — using Docker Compose.

**What you learned:**

- ✅ Installing Docker on any OS
- ✅ Cloning and configuring a multi-service project
- ✅ Running Docker Compose with health checks
- ✅ Debugging containerized applications
- ✅ Managing MySQL through phpMyAdmin
- ✅ Working with persistent Docker volumes

**Now go hide some secrets!** 🕵️🔐

---

## 📞 Need More Help?

| Resource | Link |
|----------|------|
| 📘 Full README | [README.md](README.md) |
| 🏗️ Architecture | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 🔄 Workflow | [WORKFLOW.md](WORKFLOW.md) |
| 🐛 Issues Log | [ISSUES.md](ISSUES.md) |
| 💼 Interview Q&A | [INTERVIEW_QA.md](INTERVIEW_QA.md) |
| 🐙 GitHub Issues | [github.com/hritikranjan1/SteganoVault-Docker/issues](https://github.com/hritikranjan1/SteganoVault-Docker/issues) |

---

<div align="center">

**Built with ❤️ — Hritik Ranjan**

*Happy hiding!* 🕵️

</div>

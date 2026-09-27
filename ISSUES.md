# 🐛 SteganoVault - Issues & Solutions Log

> Real problems encountered during development and deployment, and how they were solved.

---

## 📋 Table of Contents

1. [Debian Trixie Package Compatibility](#1-debian-trixie-package-compatibility)
2. [Port 8080 Already In Use](#2-port-8080-already-in-use)
3. [Frontend CSS/JS Not Loading](#3-frontend-cssjs-not-loading)
4. [Browser Caching Static Files](#4-browser-caching-static-files)
5. [Tailwind CDN Production Warning](#5-tailwind-cdn-production-warning)
6. [Font Awesome Glyph Warnings](#6-font-awesome-glyph-warnings)
7. [Nginx Serving Stale Content](#7-nginx-serving-stale-content)
8. [app.js Line 2 Null Error](#8-appjs-line-2-null-error)
9. [MySQL Health Check Failing](#9-mysql-health-check-failing)
10. [Cross-Origin Chatbot Widget Blocked](#10-cross-origin-chatbot-widget-blocked)

---

## 1. Debian Trixie Package Compatibility

### 🚨 Problem

During `docker compose build`, the following error appeared:

```
Package libgl1-mesa-glx is not available, but is referred to by another package.
This may mean that the package is missing, has been obsoleted, or is only available from another source.
ERROR: process "/bin/sh -c apt-get update && apt-get install ..." did not complete successfully: exit code: 100
```

### 🔍 Root Cause

The `python:3.10-slim` base image was updated to **Debian Trixie** (latest), where several packages were **renamed or removed**:

| Old Package (Bookworm) | New Package (Trixie) |
|------------------------|----------------------|
| `libgl1-mesa-glx` | `libgl1` |
| `libxrender-dev` | `libxrender1` |

### ✅ Solution

Updated `Dockerfile` to use new package names:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libsndfile1 \
    curl \
    gcc \
    g++ \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean
```

### 💡 Lesson Learned

- Always **pin base image versions** in production (`python:3.10-slim-bookworm`)
- **Test builds after base image updates** to catch breaking changes early
- Use `apt-cache search <package>` if unsure about package names

---

## 2. Port 8080 Already In Use

### 🚨 Problem

```bash
docker compose up -d
# Error: failed to bind host port 0.0.0.0:8080/tcp: address already in use
```

The `phpmyadmin` container couldn't start because **port 8080 was already taken**.

### 🔍 Root Cause

Another service (possibly a previous phpMyAdmin container or dev server) was already listening on 8080.

### ✅ Solution

**Option A — Find and stop the conflicting process:**

```bash
# Find what's using port 8080
sudo lsof -i :8080

# Kill it (if safe)
sudo kill -9 <PID>
```

**Option B — Change SteganoVault's port (recommended):**

Edit `docker-compose.yml`:

```yaml
phpmyadmin:
  ports:
    - "8081:80"   # Change from "8080:80" to "8081:80"
```

Then:

```bash
docker compose up -d phpmyadmin
```

Access at **http://localhost:8081**.

### 💡 Lesson Learned

- **Avoid common ports** (8080, 3000, 5000) in development
- **Use `.env` variables** for port mapping to make it configurable
- **Document port requirements** in README

---

## 3. Frontend CSS/JS Not Loading

### 🚨 Problem

After moving from inline CSS/JS to separate files, the UI rendered as **unstyled HTML**:

- ❌ No colors, no layout
- ❌ Console error: `Uncaught TypeError: can't access property "addEventListener", document.getElementById(...) is null`
- ❌ Theme switcher not working

### 🔍 Root Cause

The `static/js/app.js` and `static/css/style.css` files were **empty** — the extraction step from `index.html` was incomplete.

Additionally, `app.js` had **syntax errors** from a corrupted merge.

### ✅ Solution

1. **Verified file contents:**

```bash
wc -l static/css/style.css   # Should be 500+
wc -l static/js/app.js        # Should be 700+
```

2. **Extracted CSS/JS from `index.html`** using `awk`:

```bash
# Extract CSS
awk '/<style>/{flag=1;next}/<\/style>/{flag=0}flag' templates/index.html > static/css/style.css

# Extract JS
awk '/document.addEventListener..DOMContentLoaded/{flag=1}flag' templates/index.html > static/js/app.js
```

3. **Fixed `app.js`** by rewriting from scratch with proper structure.

4. **Verified paths in `index.html`:**

```html
<link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
<script src="{{ url_for('static', filename='js/app.js') }}"></script>
```

### 💡 Lesson Learned

- **Always verify** file contents after refactoring (`wc -l`, `head`, `cat`)
- Use `curl -I` to test if files are being served (200 vs 404)
- **Extract from source of truth** — never manually copy-paste large files

---

## 4. Browser Caching Static Files

### 🚨 Problem

Even after updating `static/js/app.js` with new code, browser **kept loading old version**.

Console showed:

```
Uncaught TypeError: can't access property "addEventListener", document.getElementById(...) is null
    at app.js:2
```

But the file on disk had **no such error**.

### 🔍 Root Cause

Browser had **cached `app.js` for 7 days** due to Nginx `expires 7d` header.

### ✅ Solution

**Step 1 — Fix Nginx to disable caching during development:**

```nginx
location /static/ {
    proxy_pass http://steganovault_backend/static/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    
    add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    expires -1;
    access_log off;
}
```

**Step 2 — Restart Nginx:**

```bash
docker compose restart nginx
```

**Step 3 — Browser hard refresh:**

```
Ctrl + Shift + R    (Windows / Linux)
Cmd + Shift + R     (Mac)
```

**Step 4 — Add cache-buster for production:**

In `index.html`:

```html
<script src="{{ url_for('static', filename='js/app.js') }}?v=2"></script>
```

### 💡 Lesson Learned

- **Disable cache during development**, enable in production
- **Add version query strings** (`?v=1`) for cache busting
- **Use incognito mode** to test without cache interference

---

## 5. Tailwind CDN Production Warning

### 🚨 Problem

Browser console warning:

```
cdn.tailwindcss.com should not be used in production.
To use Tailwind CSS in production, install it as a PostCSS plugin
or use the Tailwind CLI: https://tailwindcss.com/docs/installation
```

### 🔍 Root Cause

The `index.html` used **Tailwind Play CDN** for development convenience:

```html
<script src="https://cdn.tailwindcss.com"></script>
```

The Play CDN is meant for **development only** — it includes a JIT compiler that runs on every page load (~40KB extra + processing time).

### ✅ Solution

**Option A — Keep CDN (simplest, small project):**

Ignore the warning — works fine for small projects.

**Option B — Local Tailwind (recommended for production):**

```bash
# Download prebuilt Tailwind CSS
curl -L -o static/css/tailwind.min.css \
  https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css
```

Update `index.html`:

```html
<!-- Remove this -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Add this -->
<link rel="stylesheet" href="{{ url_for('static', filename='css/tailwind.min.css') }}">
```

**Option C — Full PostCSS build (best for production):**

Add a build step in `Dockerfile`:

```dockerfile
# Install Node.js for Tailwind build
RUN apt-get install -y nodejs npm
COPY tailwind.config.js package.json ./
RUN npm install && npx tailwindcss -i ./src/input.css -o ./static/css/tailwind.min.css --minify
```

### 💡 Lesson Learned

- **CDN is fine for learning**, but **always bundle assets** in production
- Tailwind Play CDN warns intentionally — heed the warning
- For multi-page apps, use the PostCSS build pipeline

---

## 6. Font Awesome Glyph Warnings

### 🚨 Problem

Console showed **hundreds** of warnings:

```
downloadable font: glyf: Glyph bbox was incorrect; adjusting (glyph 1085)
    (font-family: "Font Awesome 6 Free" style:normal weight:900 stretch:100
    src index:0) source: https://cdnjs.cloudflare.com/.../fa-solid-900.woff2
```

### 🔍 Root Cause

The Font Awesome 6.0.0-beta3 version had **invalid font metrics** in the `glyf` table. Newer browsers adjust them automatically, generating warnings.

**These are NOT errors** — icons still load correctly.

### ✅ Solution

**Option A — Ignore warnings (fastest):**

They're harmless. Icons work.

**Option B — Use stable Font Awesome version:**

Update `index.html`:

```html
<!-- From beta -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">

<!-- To stable -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```

**Option C — Self-host Font Awesome:**

```bash
curl -L -o static/css/font-awesome.min.css \
  https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css
```

### 💡 Lesson Learned

- **Read warnings carefully** — not all are errors
- **Use stable, latest versions** of libraries
- **Self-host fonts** for production to avoid CDN latency

---

## 7. Nginx Serving Stale Content

### 🚨 Problem

After updating CSS, the **browser showed old styling** — even after hard refresh. `curl` from terminal returned **new content**, but browser kept showing old.

### 🔍 Root Cause

Nginx was configured to **cache static files for 7 days**:

```nginx
location /static/ {
    expires 7d;
    add_header Cache-Control "public";
}
```

### ✅ Solution

**Changed Nginx config to disable caching:**

```nginx
location /static/ {
    proxy_pass http://steganovault_backend/static/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    
    add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    expires -1;
    access_log off;
}
```

**Restart Nginx:**

```bash
docker compose restart nginx
```

**Verify headers:**

```bash
curl -I http://localhost/static/js/app.js
# Should show:
# Cache-Control: no-store, no-cache, must-revalidate, max-age=0
# Pragma: no-cache
# Expires: 0
```

### 💡 Lesson Learned

- **Development:** disable caching entirely
- **Production:** use versioned files (`app.v2.js`) + long cache
- **Verify headers** with `curl -I` before assuming cache is cleared

---

## 8. app.js Line 2 Null Error

### 🚨 Problem

Console error persisted even after replacing `app.js`:

```
Uncaught TypeError: can't access property "addEventListener",
document.getElementById(...) is null
    at app.js:2
```

### 🔍 Root Cause

**Two possibilities were investigated:**

1. **Purana `script.js` content** was still in `app.js` (never replaced)
2. **Browser cache** was serving old `app.js`

**Investigation:**

```bash
head -5 static/js/app.js

# Output (WRONG):
// Dark Mode Toggle
document.getElementById("darkModeToggle").addEventListener("click", () => {
```

The file was **still the old `script.js`** — the multi-commit script had **corrupted the file** during commit generation.

### ✅ Solution

1. **Delete the corrupted file:**

```bash
rm static/js/app.js
```

2. **Recreate from scratch** with proper content.

3. **Verify with:**

```bash
head -5 static/js/app.js
# Correct output:
// ============================================
// SteganoVault - Complete Application JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', function() {
```

4. **Restart container:**

```bash
docker compose restart web
```

5. **Clear browser cache + incognito test.**

### 💡 Lesson Learned

- **Never blindly trust the file on disk** — verify with `head` / `cat`
- **Restore from backup** if scripts corrupt files
- **Test in incognito** to rule out browser cache

---

## 9. MySQL Health Check Failing

### 🚨 Problem

`docker compose ps` showed:

```
steganovault-mysql    Up (unhealthy)
```

Web container couldn't connect.

### 🔍 Root Cause

MySQL healthcheck used **root password in command line**:

```yaml
healthcheck:
  test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD:-rootpassword123}"]
```

If `.env` didn't have `MYSQL_ROOT_PASSWORD`, it defaulted to `rootpassword123`. If MySQL was initialized with a **different password**, healthcheck failed.

### ✅ Solution

**Option A — Use environment variable directly:**

```yaml
healthcheck:
  test: ["CMD-SHELL", "mysqladmin ping -h localhost -u root -p$$MYSQL_ROOT_PASSWORD"]
```

**Option B — Simpler health check without auth:**

```yaml
healthcheck:
  test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
  interval: 10s
  timeout: 5s
  retries: 10
  start_period: 30s
```

**Option C — Reset and rebuild:**

```bash
docker compose down -v
docker compose up -d
```

### 💡 Lesson Learned

- **Use `$$` in docker-compose** to escape shell variables
- **Give MySQL time to initialize** (`start_period: 30s+`)
- **Align `.env` values** with what MySQL was initialized with

---

## 10. Cross-Origin Chatbot Widget Blocked

### 🚨 Problem

Console error:

```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading
the remote resource at https://www.sparkagentai.com/spark-agent-ai-chat-widget.js.
(Reason: CORS header 'Access-Control-Allow-Origin' missing).
```

### 🔍 Root Cause

Third-party chatbot widget (**SparkAgent AI**) doesn't set CORS headers for `localhost`.

### ✅ Solution

**Option A — Remove the widget (cleanest):**

```html
<!-- Remove this from index.html -->
<script type="module" src="https://www.sparkagentai.com/spark-agent-ai-chat-widget.js"
        chatbotId="..."
        chatbotUrl="https://chatbot.sparkagentai.com"></script>
```

**Option B — Use the official embed method** (per SparkAgent docs):

```html
<script>
  window.sparkAgentConfig = {
    chatbotId: "your-id",
    chatbotUrl: "https://chatbot.sparkagentai.com"
  };
</script>
<script src="https://www.sparkagentai.com/widget.js" defer></script>
```

**Option C — Load conditionally** (only on production domain):

```html
<script>
  if (window.location.hostname !== 'localhost') {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://www.sparkagentai.com/spark-agent-ai-chat-widget.js';
    script.setAttribute('chatbotId', '...');
    document.head.appendChild(script);
  }
</script>
```

### 💡 Lesson Learned

- **Third-party widgets often block localhost**
- **Load analytics/widgets conditionally** based on domain
- **Read console errors** — they tell you exactly what's blocked

---

## 📊 Summary Table

| # | Issue | Root Cause | Solution | Impact |
|---|-------|-----------|----------|--------|
| 1 | Debian packages | Base image updated | Renamed packages | Build fails |
| 2 | Port 8080 used | Another service | Change port | Container fails |
| 3 | CSS/JS not loading | Empty files | Extract from HTML | UI broken |
| 4 | Browser cache | Nginx 7d expires | Disable cache | Stale UI |
| 5 | Tailwind CDN warning | Play CDN | Use local build | Console noise |
| 6 | Font Awesome warnings | Beta version | Upgrade to 6.4 | Console noise |
| 7 | Nginx stale content | Cache headers | No-cache headers | Stale UI |
| 8 | app.js line 2 null | Corrupted file | Rewrite file | App crashes |
| 9 | MySQL unhealthy | Wrong credentials | Fix healthcheck | Web can't connect |
| 10 | Chatbot CORS | Third-party | Remove/condition | Console error |

---

## 🎓 Key Takeaways

1. **Always verify file contents** after scripts run — `head`, `wc -l`, `cat`
2. **Disable cache during development** — enable in production with versioning
3. **Read console warnings carefully** — some are harmless, some critical
4. **Pin base image versions** in production Dockerfiles
5. **Test after every change** — don't assume it works
6. **Use incognito mode** to rule out browser cache
7. **Check service dependencies** — MySQL takes 30-60s to be ready
8. **Escape variables in docker-compose** with `$$`

---

## 📞 Report a New Issue

Found a bug not listed here? Open an issue:

**GitHub Issues:** [https://github.com/hritikranjan1/SteganoVault-Docker/issues](https://github.com/hritikranjan1/SteganoVault-Docker/issues)

Include:

- 🔍 What you did
- ❌ What happened
- ✅ What you expected
- 📸 Screenshots/logs
- 💻 Your OS and Docker version

---

<div align="center">

**Built with ❤️ — Every bug is a lesson learned**

</div>

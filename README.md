# 🔐 SteganoVault

Secure steganography tool built with Flask and Docker.

cat >> README.md << 'EOF'

## Architecture

Multi-container setup:
- Flask (web app)
- MySQL (database)
- Nginx (reverse proxy)
- phpMyAdmin (DB admin)

## API Endpoints

- `POST /encode` - Encode message in file
- `POST /decode` - Decode message from file
- `GET /health` - Health check
- `POST /auth/register` - Register user
- `POST /auth/login` - Login
- `GET /api/reviews` - Fetch reviews

## Usage

1. Upload a file (image, PDF, DOCX, audio, or video)
2. Enter your secret message
3. Optionally add a password
4. Click Encode
5. Download the encoded file

To decode, upload an encoded file and click Decode.

## Features

- Multi-format steganography (images, text, PDF, DOCX, audio, video)
- Optional password protection with BCrypt
- 11 themes (Dark, Light, Cyberpunk, etc.)
- Stealth Score gamification with badges
- User authentication with OTP verification
- Reviews and testimonials
- Docker Compose deployment
- Health checks for all services

## Tech Stack

**Backend:**
- Python 3.10, Flask, Gunicorn
- MySQL 8.0
- Stegano (LSB steganography)
- PyPDF2, python-docx, pydub, OpenCV

**Frontend:**
- HTML5, CSS3, JavaScript (ES6+)
- Tailwind CSS
- Font Awesome

**DevOps:**
- Docker, Docker Compose
- Nginx (reverse proxy)
- phpMyAdmin

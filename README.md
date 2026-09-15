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

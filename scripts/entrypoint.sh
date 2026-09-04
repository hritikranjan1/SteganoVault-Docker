#!/bin/bash
set -e

echo "Starting SteganoVault..."

until python -c "
import mysql.connector, os, sys
try:
    conn = mysql.connector.connect(
        host=os.getenv('MYSQL_HOST', 'mysql'),
        port=int(os.getenv('MYSQL_PORT', 3306)),
        user=os.getenv('MYSQL_USER', 'stegano'),
        password=os.getenv('MYSQL_PASSWORD', 'stegano123'),
        database=os.getenv('MYSQL_DATABASE', 'steganovault')
    )
    conn.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
"; do
    echo "Waiting for MySQL..."
    sleep 2
done

echo "MySQL ready!"
exec "$@"

import mysql.connector
from mysql.connector import pooling
import os

MYSQL_CONFIG = {
    'host': os.environ.get('MYSQL_HOST', 'mysql'),
    'port': int(os.environ.get('MYSQL_PORT', 3306)),
    'user': os.environ.get('MYSQL_USER', 'stegano'),
    'password': os.environ.get('MYSQL_PASSWORD', 'stegano123'),
    'database': os.environ.get('MYSQL_DATABASE', 'steganovault'),
    'charset': 'utf8mb4',
    'autocommit': True,
}

try:
    db_pool = pooling.MySQLConnectionPool(
        pool_name="stegano_pool",
        pool_size=10,
        pool_reset_session=True,
        **MYSQL_CONFIG
    )
except Exception:
    db_pool = None

def get_db():
    if db_pool:
        return db_pool.get_connection()
    return mysql.connector.connect(**MYSQL_CONFIG)

# ============================================
# IMAGE STEGANOGRAPHY (LSB)
# ============================================
from stegano import lsb
from PIL import Image

def convert_to_png(input_path):
    img = Image.open(input_path).convert("RGB")
    png_path = input_path.rsplit(".", 1)[0] + "_converted.png"
    img.save(png_path, format="PNG", quality=95)
    return png_path

def encode_image(input_path, message, password, watermark=None):
    if not input_path.lower().endswith(".png"):
        input_path = convert_to_png(input_path)
    secret_message = f"{password}:{message}" if password else message
    if watermark:
        secret_message = f"{watermark}:{secret_message}"
    encoded_img = lsb.hide(input_path, secret_message)
    output_path = input_path.replace(".png", "_encoded.png")
    encoded_img.save(output_path, format="PNG", quality=95)
    return output_path

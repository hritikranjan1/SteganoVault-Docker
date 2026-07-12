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

def decode_image(input_path, password):
    extracted_message = lsb.reveal(input_path)
    if extracted_message and ":" in extracted_message:
        parts = extracted_message.split(":")
        if len(parts) == 3:
            stored_password, stored_message = parts[1], parts[2]
        else:
            stored_password, stored_message = parts[0], parts[1]
        return stored_message if stored_password == password else "Incorrect password!"
    return extracted_message

# ============================================
# TEXT FILE STEGANOGRAPHY (Zero-width chars)
# ============================================
def encode_txt(input_path, message, password):
    with open(input_path, "r", encoding="utf-8") as f:
        original = f.read()
    secret_message = f"{password}:{message}" if password else message
    binary_data = ''.join(format(ord(c), '08b') for c in secret_message)
    encoded = ''.join("\u200B" if b == "0" else "\u200D" for b in binary_data)
    output_path = input_path.replace(".", "_encoded.")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(original + "\n" + encoded)
    return output_path

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

def decode_txt(input_path, password):
    with open(input_path, "r", encoding="utf-8") as f:
        content = f.read()
    binary_data = ''.join("0" if c == "\u200B" else "1" for c in content if c in ["\u200B", "\u200D"])
    if not binary_data:
        return "No hidden message found!"
    extracted = ''.join(chr(int(binary_data[i:i+8], 2)) for i in range(0, len(binary_data) - len(binary_data) % 8, 8))
    if extracted and ":" in extracted:
        stored_password, stored_message = extracted.split(":", 1)
        return stored_message if stored_password == password else "Incorrect password!"
    return extracted

# ============================================
# PDF STEGANOGRAPHY (Metadata)
# ============================================
from PyPDF2 import PdfReader, PdfWriter

def encode_pdf(input_path, message, password):
    reader = PdfReader(input_path)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    secret_message = f"{password}:{message}" if password else message
    writer.add_metadata({"/Message": secret_message})
    output_path = input_path.replace(".", "_encoded.")
    with open(output_path, "wb") as f:
        writer.write(f)
    return output_path

def decode_pdf(input_path, password):
    reader = PdfReader(input_path)
    metadata = reader.metadata
    extracted = metadata.get("/Message", "") if metadata else ""
    if extracted and ":" in extracted:
        stored_password, stored_message = extracted.split(":", 1)
        return stored_message if stored_password == password else "Incorrect password!"
    return extracted

# ============================================
# DOCX STEGANOGRAPHY (Hidden Text)
# ============================================
from docx import Document

def encode_docx(input_path, message, password):
    doc = Document(input_path)
    secret_message = f"{password}:{message}" if password else message
    paragraph = doc.add_paragraph()
    run = paragraph.add_run(secret_message)
    run.font.hidden = True
    output_path = input_path.replace(".", "_encoded.")
    doc.save(output_path)
    return output_path

def decode_docx(input_path, password):
    doc = Document(input_path)
    extracted = ""
    for para in doc.paragraphs:
        for run in para.runs:
            if run.font.hidden:
                extracted += run.text
    if extracted and ":" in extracted:
        stored_password, stored_message = extracted.split(":", 1)
        return stored_message if stored_password == password else "Incorrect password!"
    return extracted

# ============================================
# ENCODE ROUTE
# ============================================
from flask import request, send_file
import tempfile, shutil, time, uuid, json, hashlib
from werkzeug.utils import secure_filename

@app.route("/encode", methods=["POST"])
def encode():
    uploaded_file = request.files['file']
    message = request.form.get("message")
    password = request.form.get("password", "")
    filename = secure_filename(uploaded_file.filename)
    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, filename)
    uploaded_file.save(file_path)
    ext = os.path.splitext(file_path)[1].lower()
    output_file = None
    start = time.time()
    if ext in [".png", ".jpg", ".jpeg"]:
        output_file = encode_image(file_path, message, password)
    elif ext == ".txt":
        output_file = encode_txt(file_path, message, password)
    elif ext == ".pdf":
        output_file = encode_pdf(file_path, message, password)
    elif ext == ".docx":
        output_file = encode_docx(file_path, message, password)
    if output_file and os.path.exists(output_file):
        with open(output_file, "rb") as f:
            checksum = hashlib.sha256(f.read()).hexdigest()
        response = send_file(output_file, as_attachment=True, download_name=os.path.basename(output_file))
        response.headers["X-Response-Data"] = json.dumps({
            "status": "success",
            "filename": os.path.basename(output_file),
            "checksum": checksum,
            "processing_time": round(time.time() - start, 2)
        })
        return response
    return jsonify({"error": "Unsupported format"}), 400

# ============================================
# DECODE ROUTE
# ============================================
@app.route("/decode", methods=["POST"])
def decode():
    uploaded_file = request.files['file']
    password = request.form.get("password", "")
    filename = secure_filename(uploaded_file.filename)
    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, filename)
    uploaded_file.save(file_path)
    ext = os.path.splitext(file_path)[1].lower()
    decoded_message = None
    start = time.time()
    if ext in [".png", ".jpg", ".jpeg"]:
        decoded_message, _ = decode_image(file_path, password)
    elif ext == ".txt":
        decoded_message = decode_txt(file_path, password)
    elif ext == ".pdf":
        decoded_message = decode_pdf(file_path, password)
    elif ext == ".docx":
        decoded_message = decode_docx(file_path, password)
    return jsonify({
        "status": "success",
        "message": decoded_message,
        "processing_time": round(time.time() - start, 2)
    })

# ============================================
# AUTHENTICATION
# ============================================
import bcrypt
import random
import string
from functools import wraps

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        from flask import session
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return wrapper

@app.route('/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({'error': 'Name, email, password required'}), 400
    email = data['email'].lower()
    if len(data['password']) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    hashed = hash_password(data['password'])
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (name, email, password) VALUES (%s, %s, %s)",
            (data['name'], email, hashed)
        )
        conn.commit()
        return jsonify({'message': 'Registered successfully'}), 200
    except mysql.connector.IntegrityError:
        return jsonify({'error': 'Email already exists'}), 400
    finally:
        cursor.close()
        conn.close()

from flask import session

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data['email'].lower()
    password = data['password']
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if not check_password(password, user['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    session['user_id'] = user['email']
    return jsonify({
        'message': 'Login successful',
        'user': {'email': user['email'], 'name': user['name']}
    }), 200

@app.route('/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'message': 'Logged out'}), 200

@app.route('/auth/status', methods=['GET'])
def auth_status():
    if 'user_id' in session:
        return jsonify({'authenticated': True, 'user': {'email': session['user_id']}}), 200
    return jsonify({'authenticated': False}), 200

# ============================================
# REVIEWS API
# ============================================
@app.route('/api/reviews', methods=['GET'])
def get_reviews():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM reviews WHERE verified = TRUE ORDER BY timestamp DESC")
    reviews = cursor.fetchall()
    cursor.close()
    conn.close()
    for r in reviews:
        if r.get('timestamp'):
            r['timestamp'] = r['timestamp'].isoformat()
    return jsonify(reviews)

@app.route('/api/reviews', methods=['POST'])
@login_required
def submit_review():
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO reviews (user_email, name, text, rating, verified) VALUES (%s, %s, %s, %s, TRUE)",
        (session['user_id'], data['name'], data['text'], int(data['rating']))
    )
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'message': 'Review submitted'}), 200

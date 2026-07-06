from flask import Flask, render_template
import os
import logging

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24).hex())

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route("/")
def index():
    return render_template("index.html")

if __name__ == "__main__":
    logger.info("Starting SteganoVault...")
    app.run(host="0.0.0.0", port=5000)

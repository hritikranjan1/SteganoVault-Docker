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

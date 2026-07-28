import sqlite3
import os
from werkzeug.security import generate_password_hash as _hash
def generate_password_hash(pw):
    return _hash(pw, method='pbkdf2:sha256')

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'caritas.db')
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'schema.sql')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def col_exists(conn, table, col):
    cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    return col in cols

def migrate_db(conn):
    migrations = [
        ("usuarios", "identificacion", "ALTER TABLE usuarios ADD COLUMN identificacion TEXT UNIQUE"),
        ("usuarios", "password", "ALTER TABLE usuarios ADD COLUMN password TEXT"),
        ("usuarios", "rol", "ALTER TABLE usuarios ADD COLUMN rol TEXT DEFAULT 'voluntario'"),
        ("usuarios", "activo", "ALTER TABLE usuarios ADD COLUMN activo INTEGER DEFAULT 1"),
        ("usuarios", "usuario", "ALTER TABLE usuarios ADD COLUMN usuario TEXT UNIQUE"),
        ("pacientes", "sexo", "ALTER TABLE pacientes ADD COLUMN sexo TEXT DEFAULT ''"),
        ("pacientes", "direccion", "ALTER TABLE pacientes ADD COLUMN direccion TEXT DEFAULT ''"),
        ("pacientes", "cedula", "ALTER TABLE pacientes ADD COLUMN cedula TEXT DEFAULT ''"),
        ("pacientes", "telefono", "ALTER TABLE pacientes ADD COLUMN telefono TEXT DEFAULT ''"),
        ("pacientes", "embarazada", "ALTER TABLE pacientes ADD COLUMN embarazada INTEGER DEFAULT 0"),
        ("pacientes", "lactante", "ALTER TABLE pacientes ADD COLUMN lactante INTEGER DEFAULT 0"),
        ("pacientes", "cuidador_nombre", "ALTER TABLE pacientes ADD COLUMN cuidador_nombre TEXT DEFAULT ''"),
        ("pacientes", "cuidador_apellido", "ALTER TABLE pacientes ADD COLUMN cuidador_apellido TEXT DEFAULT ''"),
        ("pacientes", "cuidador_cedula", "ALTER TABLE pacientes ADD COLUMN cuidador_cedula TEXT DEFAULT ''"),
        ("pacientes", "cuidador_telefono", "ALTER TABLE pacientes ADD COLUMN cuidador_telefono TEXT DEFAULT ''"),
        ("metricas", "z_score", "ALTER TABLE metricas ADD COLUMN z_score REAL"),
        ("pacientes", "activo", "ALTER TABLE pacientes ADD COLUMN activo INTEGER DEFAULT 1"),
    ]
    for table, col, sql in migrations:
        if not col_exists(conn, table, col):
            conn.execute(sql)

    # Assign usuario to existing users that have none
    for row in conn.execute("SELECT id, nombre FROM usuarios WHERE usuario IS NULL OR usuario = ''").fetchall():
        base = row['nombre'].lower().replace(' ', '_')
        new_usr = base
        i = 1
        while conn.execute("SELECT COUNT(*) as c FROM usuarios WHERE usuario = ? AND id != ?", (new_usr, row['id'])).fetchone()['c'] > 0:
            new_usr = f"{base}{i}"
            i += 1
        conn.execute("UPDATE usuarios SET usuario = ? WHERE id = ?", (new_usr, row['id']))

    cur = conn.execute("SELECT COUNT(*) FROM usuarios WHERE rol = 'admin'")
    if cur.fetchone()[0] == 0:
        conn.execute(
            "INSERT OR IGNORE INTO usuarios (nombre, usuario, identificacion, password, rol) VALUES (?,?,?,?,?)",
            ("admin", "admin", "admin", generate_password_hash("admin"), "admin")
        )

def init_db():
    conn = get_db()
    with open(SCHEMA_PATH, 'r') as f:
        conn.executescript(f.read())

    migrate_db(conn)

    if conn.execute("SELECT COUNT(*) FROM usuarios WHERE rol = 'admin'").fetchone()[0] == 0:
        conn.execute(
            "INSERT OR IGNORE INTO usuarios (nombre, usuario, identificacion, password, rol) VALUES (?,?,?,?,?)",
            ("admin", "admin", "admin", generate_password_hash("admin"), "admin")
        )

    conn.commit()
    conn.close()

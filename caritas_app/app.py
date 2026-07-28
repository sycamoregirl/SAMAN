import sys
import os

# Vendor path for QPython without pip
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'vendor'))

import json
import datetime
import math
from functools import wraps
from io import BytesIO
from flask import Flask, g, render_template, request, redirect, url_for, session, flash, send_file
from werkzeug.security import check_password_hash as _check, generate_password_hash as _gen
def check_password_hash(pw_hash, pw):
    return _check(pw_hash, pw)
def generate_password_hash(pw):
    return _gen(pw, method='pbkdf2:sha256')
from database.db import get_db, init_db, migrate_db

app = Flask(__name__)
app.secret_key = os.urandom(24).hex()

TIPO_VISITAS = ['jornada', 'visita domiciliaria', 'monitoreo', 'nuevo ingreso']

REF_LMS = {
    'M': {
        # WHO BMI-for-age 0-5 años (L=-0.3 constante)
        0: (-0.3, 13.4, 0.09), 1: (-0.3, 14.2, 0.09), 2: (-0.3, 15.4, 0.09),
        3: (-0.3, 16.1, 0.09), 4: (-0.3, 16.6, 0.09), 5: (-0.3, 16.9, 0.09),
        6: (-0.3, 17.0, 0.09), 7: (-0.3, 17.1, 0.09), 8: (-0.3, 17.1, 0.09),
        9: (-0.3, 17.1, 0.09), 10: (-0.3, 17.1, 0.09), 11: (-0.3, 17.0, 0.09),
        12: (-0.3, 17.0, 0.09), 15: (-0.3, 16.8, 0.09), 18: (-0.3, 16.5, 0.09),
        21: (-0.3, 16.3, 0.09), 24: (-0.3, 16.0, 0.09), 30: (-0.3, 15.7, 0.09),
        36: (-0.3, 15.5, 0.09), 42: (-0.3, 15.4, 0.09), 48: (-0.3, 15.3, 0.09),
        54: (-0.3, 15.3, 0.09), 59: (-0.3, 15.3, 0.09),
        # WHO BMI-for-age 5-19 años (L=1 lineal)
        60: (1, 15.1, 4.6), 61: (1, 15.2, 4.7), 62: (1, 15.3, 4.8),
        63: (1, 15.4, 4.9), 64: (1, 15.5, 5.0), 65: (1, 15.6, 5.1),
        66: (1, 15.7, 5.2), 67: (1, 15.8, 5.3), 68: (1, 15.9, 5.4),
        69: (1, 16.0, 5.5), 70: (1, 16.1, 5.6), 71: (1, 16.2, 5.7),
        72: (1, 15.8, 4.8), 84: (1, 15.6, 4.6), 96: (1, 15.7, 4.5),
        108: (1, 15.8, 4.5), 120: (1, 16.0, 4.6), 132: (1, 16.3, 4.7),
        144: (1, 16.7, 4.9), 156: (1, 17.2, 5.1), 168: (1, 17.8, 5.4),
        180: (1, 18.5, 5.7), 192: (1, 19.2, 6.0), 204: (1, 19.9, 6.3),
        216: (1, 20.6, 6.6), 228: (1, 21.2, 6.8),
    },
    'F': {
        # WHO BMI-for-age 0-5 años (L=-0.3 constante)
        0: (-0.3, 13.1, 0.09), 1: (-0.3, 13.9, 0.09), 2: (-0.3, 15.0, 0.09),
        3: (-0.3, 15.7, 0.09), 4: (-0.3, 16.2, 0.09), 5: (-0.3, 16.5, 0.09),
        6: (-0.3, 16.5, 0.09), 7: (-0.3, 16.6, 0.09), 8: (-0.3, 16.6, 0.09),
        9: (-0.3, 16.6, 0.09), 10: (-0.3, 16.6, 0.09), 11: (-0.3, 16.5, 0.09),
        12: (-0.3, 16.5, 0.09), 15: (-0.3, 16.4, 0.09), 18: (-0.3, 16.1, 0.09),
        21: (-0.3, 15.9, 0.09), 24: (-0.3, 15.7, 0.09), 30: (-0.3, 15.5, 0.09),
        36: (-0.3, 15.3, 0.09), 42: (-0.3, 15.2, 0.09), 48: (-0.3, 15.1, 0.09),
        54: (-0.3, 15.1, 0.09), 59: (-0.3, 15.1, 0.09),
        # WHO BMI-for-age 5-19 años (L=1 lineal)
        60: (1, 15.0, 4.6), 61: (1, 15.1, 4.7), 62: (1, 15.2, 4.8),
        63: (1, 15.3, 4.9), 64: (1, 15.4, 5.0), 65: (1, 15.5, 5.1),
        66: (1, 15.6, 5.2), 67: (1, 15.7, 5.3), 68: (1, 15.8, 5.4),
        69: (1, 15.9, 5.5), 70: (1, 16.0, 5.6), 71: (1, 16.1, 5.7),
        72: (1, 15.6, 4.7), 84: (1, 15.4, 4.5), 96: (1, 15.4, 4.4),
        108: (1, 15.5, 4.4), 120: (1, 15.7, 4.5), 132: (1, 16.0, 4.6),
        144: (1, 16.4, 4.8), 156: (1, 16.9, 5.0), 168: (1, 17.5, 5.3),
        180: (1, 18.1, 5.6), 192: (1, 18.8, 5.9), 204: (1, 19.5, 6.2),
        216: (1, 20.1, 6.5), 228: (1, 20.7, 6.7),
    }
}
@app.before_request
def ensure_db():
    if not os.path.exists(os.path.join(os.path.dirname(__file__), 'caritas.db')):
        init_db()
    else:
        conn = get_db()
        migrate_db(conn)
        conn.commit()
        conn.close()

@app.teardown_appcontext
def close_db(exception=None):
    db = getattr(g, 'caritas_db', None)
    if db is not None:
        db.close()

def get_edad(fecha_nac):
    try:
        nac = datetime.datetime.strptime(fecha_nac, "%Y-%m-%d")
        hoy = datetime.datetime.now()
        return hoy.year - nac.year - ((hoy.month, hoy.day) < (nac.month, nac.day))
    except:
        return 0

def get_edad_meses(fecha_nac):
    try:
        nac = datetime.datetime.strptime(fecha_nac, "%Y-%m-%d")
        hoy = datetime.datetime.now()
        return (hoy.year - nac.year) * 12 + (hoy.month - nac.month)
    except:
        return 0

def clasificar_paciente(edad, embarazada, lactante=False):
    if embarazada:
        return "Embarazada"
    if lactante:
        return "Lactante"
    if edad < 10:
        return "Niño"
    return "Adulto"

def calcular_zscore(peso, talla_cm, edad_meses, sexo):
    if sexo not in ('M', 'F') or talla_cm <= 0 or peso <= 0:
        return None
    try:
        imc = peso / ((talla_cm / 100) ** 2)
        ref = REF_LMS.get(sexo, {})
        ages = sorted(ref.keys())
        if not ages:
            return None
        closest = min(ages, key=lambda a: abs(a - edad_meses))
        L, M, S = ref[closest]
        if L == 0:
            return round(math.log(imc / M) / S, 2)
        return round(((imc / M) ** L - 1) / (L * S), 2)
    except:
        return None

def clasificar_desnutricion(peso, talla, perimetro_brazo=None):
    if talla <= 0:
        return "Sin datos"
    imc = round(peso / ((talla / 100) ** 2), 1)
    if perimetro_brazo:
        if perimetro_brazo < 19:
            return "Severa"
        elif perimetro_brazo < 22:
            return "Moderada"
        elif perimetro_brazo < 23:
            return "Leve"
    if imc < 16:
        return "Severa"
    elif imc < 17:
        return "Moderada"
    elif imc < 18.5:
        return "Leve"
    return "Normal"

def get_categoria_color(cat):
    colors = {
        "Embarazada": "badge-embarazada",
        "Lactante": "badge-lactante",
        "Niño": "badge-nino",
        "Adulto": "badge-normal"
    }
    return colors.get(cat, "badge-normal")

def interpretar_zscore(z):
    if z is None:
        return '', ''
    if z < -3:
        return 'Severa', 'z-severa'
    if z < -2:
        return 'Moderada', 'z-moderada'
    if z < -1:
        return 'Leve', 'z-leve'
    if z <= 1.5:
        return 'Normal', 'z-normal'
    return 'Sobrepeso', 'z-moderada'

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'usuario_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'usuario_id' not in session or session.get('rol') != 'admin':
            flash("Acceso denegado", "danger")
            return redirect(url_for('menu'))
        return f(*args, **kwargs)
    return decorated

def log_actividad(accion, detalle=''):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            resp = f(*args, **kwargs)
            if 'usuario_id' in session:
                try:
                    db = get_db()
                    db.execute(
                        "INSERT INTO logs (usuario_id, accion, detalle) VALUES (?,?,?)",
                        (session['usuario_id'], accion, detalle)
                    )
                    db.commit()
                    db.close()
                except:
                    pass
            return resp
        return decorated
    return decorator

@app.route('/')
def index():
    if 'usuario_id' in session:
        return redirect(url_for('menu'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    db = get_db()
    if request.method == 'POST':
        usuario = request.form.get('usuario', '').strip().lower()
        password = request.form.get('password', '')
        user = db.execute("SELECT * FROM usuarios WHERE usuario = ? AND activo = 1", (usuario,)).fetchone()
        if user and check_password_hash(user['password'], password):
            session['usuario_id'] = user['id']
            session['usuario_nombre'] = user['nombre']
            session['rol'] = user['rol']
            db.execute("UPDATE usuarios SET ultima_sesion = datetime('now','localtime') WHERE id = ?", (user['id'],))
            db.commit()
            log_db(db, user['id'], "Inicio de sesion", f"Usuario: {user['nombre']}")
            db.close()
            return redirect(url_for('menu'))
        flash("Usuario o contraseña incorrectos", "danger")
    db.close()
    return render_template('login.html')

@app.route('/logout')
def logout():
    if 'usuario_id' in session:
        try:
            db = get_db()
            log_db(db, session['usuario_id'], "Cierre de sesion", f"Usuario: {session.get('usuario_nombre', '')}")
            db.commit()
            db.close()
        except:
            pass
    session.clear()
    return redirect(url_for('login'))

def log_db(db, usuario_id, accion, detalle=''):
    try:
        db.execute(
            "INSERT INTO logs (usuario_id, accion, detalle) VALUES (?,?,?)",
            (usuario_id, accion, detalle)
        )
        db.commit()
    except:
        pass

@app.route('/menu')
@login_required
def menu():
    db = get_db()
    usuario = db.execute("SELECT * FROM usuarios WHERE id = ?", (session['usuario_id'],)).fetchone()
    db.close()
    return render_template('menu.html', usuario=usuario)

@app.route('/pacientes')
@login_required
def pacientes_lista():
    db = get_db()
    q = request.args.get('q', '')
    if q:
        rows = db.execute(
            "SELECT p.*, "
            "(SELECT fecha FROM visitas WHERE paciente_id = p.id ORDER BY fecha DESC LIMIT 1) as ultima_visita,"
            "(SELECT activa FROM beneficios_tengo WHERE paciente_id = p.id) as tengo_activo "
            "FROM pacientes p WHERE p.nombre || ' ' || p.apellido LIKE ? ORDER BY p.apellido",
            (f'%{q}%',)
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT p.*, "
            "(SELECT fecha FROM visitas WHERE paciente_id = p.id ORDER BY fecha DESC LIMIT 1) as ultima_visita,"
            "(SELECT activa FROM beneficios_tengo WHERE paciente_id = p.id) as tengo_activo "
            "FROM pacientes p ORDER BY p.apellido"
        ).fetchall()
    pacientes = []
    for r in rows:
        p = dict(r)
        p['categoria'] = clasificar_paciente(get_edad(p['fecha_nac']), p['embarazada'], p['lactante'])
        pacientes.append(p)
    db.close()
    return render_template('pacientes/lista.html', pacientes=pacientes, q=q,
                          get_categoria_color=get_categoria_color)

@app.route('/pacientes/nuevo', methods=['GET', 'POST'])
@login_required
def paciente_nuevo():
    db = get_db()
    if request.method == 'POST':
        nombre = request.form['nombre'].strip()
        apellido = request.form['apellido'].strip()
        fecha_nac = request.form['fecha_nac']
        sexo = request.form.get('sexo', '')
        direccion = request.form.get('direccion', '').strip()
        cedula = request.form.get('cedula', '').strip()
        telefono = request.form.get('telefono', '').strip()
        embarazada = 1 if request.form.get('embarazada') else 0
        lactante = 1 if request.form.get('lactante') else 0
        c_nombre = request.form.get('cuidador_nombre', '').strip()
        c_apellido = request.form.get('cuidador_apellido', '').strip()
        c_cedula = request.form.get('cuidador_cedula', '').strip()
        c_telefono = request.form.get('cuidador_telefono', '').strip()

        cur = db.execute(
            "INSERT INTO pacientes (nombre, apellido, fecha_nac, sexo, direccion, cedula, telefono, embarazada, lactante, cuidador_nombre, cuidador_apellido, cuidador_cedula, cuidador_telefono, creado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (nombre, apellido, fecha_nac, sexo, direccion, cedula, telefono, embarazada, lactante, c_nombre, c_apellido, c_cedula, c_telefono, session['usuario_id'])
        )
        paciente_id = cur.lastrowid

        if request.form.get('peso'):
            peso = float(request.form['peso'])
            talla_cm = float(request.form['talla'])
            perimetro = float(request.form['perimetro']) if request.form.get('perimetro') else None
            imc = round(peso / ((talla_cm / 100) ** 2), 1) if talla_cm > 0 else None
            nivel = clasificar_desnutricion(peso, talla_cm, perimetro)
            edad_m = get_edad_meses(fecha_nac)
            z = calcular_zscore(peso, talla_cm, edad_m, sexo)
            db.execute(
                "INSERT INTO metricas (paciente_id, peso, talla, imc, perimetro_brazo, nivel_desnutricion, z_score, notas, usuario_id) VALUES (?,?,?,?,?,?,?,?,?)",
                (paciente_id, peso, talla_cm, imc, perimetro, nivel, z, "Métrica inicial", session['usuario_id'])
            )

        if request.form.get('tengo_fecha_inicio'):
            db.execute(
                "INSERT INTO beneficios_tengo (paciente_id, fecha_inicio, activa) VALUES (?,?,1)",
                (paciente_id, request.form['tengo_fecha_inicio'])
            )

        db.commit()
        log_db(db, session['usuario_id'], "Registro de paciente", f"{nombre} {apellido}")
        flash("Paciente registrado", "success")
        db.close()
        return redirect(url_for('paciente_perfil', id=paciente_id))
    db.close()
    return render_template('pacientes/nuevo.html')

@app.route('/pacientes/<int:id>')
@login_required
def paciente_perfil(id):
    db = get_db()
    paciente = db.execute("SELECT * FROM pacientes WHERE id = ?", (id,)).fetchone()
    if not paciente:
        flash("Paciente no encontrado", "danger")
        db.close()
        return redirect(url_for('pacientes_lista'))
    metricas = db.execute("SELECT m.*, u.nombre as usuario_nombre FROM metricas m LEFT JOIN usuarios u ON m.usuario_id = u.id WHERE m.paciente_id = ? ORDER BY m.fecha DESC", (id,)).fetchall()
    visitas = db.execute("SELECT v.*, u.nombre as usuario_nombre FROM visitas v LEFT JOIN usuarios u ON v.usuario_id = u.id WHERE v.paciente_id = ? ORDER BY v.fecha DESC", (id,)).fetchall()
    entregas = db.execute(
        "SELECT e.*, i.nombre as insumo_nombre, i.unidad, u.nombre as usuario_nombre FROM entregas e "
        "JOIN insumos i ON e.insumo_id = i.id "
        "LEFT JOIN usuarios u ON e.usuario_id = u.id "
        "WHERE e.paciente_id = ? ORDER BY e.fecha DESC", (id,)
    ).fetchall()
    tengo = db.execute("SELECT * FROM beneficios_tengo WHERE paciente_id = ?", (id,)).fetchone()
    usuario = db.execute("SELECT * FROM usuarios WHERE id = ?", (session['usuario_id'],)).fetchone()

    edad = get_edad(paciente['fecha_nac'])
    categoria = clasificar_paciente(edad, paciente['embarazada'], paciente['lactante'])

    alerta_monitoreo = None
    if visitas:
        primera = db.execute(
            "SELECT fecha FROM visitas WHERE paciente_id = ? ORDER BY fecha ASC LIMIT 1", (id,)
        ).fetchone()
        if primera:
            try:
                f_primera = datetime.datetime.strptime(primera['fecha'][:10], "%Y-%m-%d")
                hoy = datetime.datetime.now()
                diff = (hoy.year - f_primera.year) * 12 + (hoy.month - f_primera.month)
                if diff >= 2:
                    alerta_monitoreo = f"Hace {diff} meses desde la primera atencion. Desea continuar atendiendo a este paciente?"
            except:
                pass

    db.close()
    return render_template('pacientes/perfil.html', paciente=paciente, edad=edad, categoria=categoria,
                          metricas=metricas, visitas=visitas, entregas=entregas, tengo=tengo,
                          usuario=usuario, alerta_monitoreo=alerta_monitoreo,
                           get_categoria_color=get_categoria_color, interpretar_zscore=interpretar_zscore)

@app.route('/pacientes/<int:id>/continuar')
@login_required
def paciente_continuar(id):
    db = get_db()
    paciente = db.execute("SELECT * FROM pacientes WHERE id = ?", (id,)).fetchone()
    if paciente:
        db.execute("INSERT INTO visitas (paciente_id, fecha, tipo, observaciones, usuario_id) VALUES (?,date('now','localtime'),'monitoreo',?,?)",
                  (id, "Continuacion de atencion", session['usuario_id']))
        db.commit()
        log_db(db, session['usuario_id'], "Continuacion atencion", f"Paciente {paciente['nombre']} {paciente['apellido']}")
        flash("Atencion continuada", "success")
    db.close()
    return redirect(url_for('paciente_perfil', id=id))

@app.route('/pacientes/<int:id>/dar_baja')
@login_required
def paciente_dar_baja(id):
    db = get_db()
    db.execute("UPDATE pacientes SET activo = 0 WHERE id = ?", (id,))
    db.commit()
    log_db(db, session['usuario_id'], "Baja de paciente", f"Paciente ID {id}")
    flash("Paciente dado de baja", "warning")
    db.close()
    return redirect(url_for('pacientes_lista'))

@app.route('/pacientes/<int:id>/reactivar')
@login_required
def paciente_reactivar(id):
    db = get_db()
    db.execute("UPDATE pacientes SET activo = 1 WHERE id = ?", (id,))
    db.commit()
    log_db(db, session['usuario_id'], "Reactivacion de paciente", f"Paciente ID {id}")
    flash("Paciente reactivado", "success")
    db.close()
    return redirect(url_for('paciente_perfil', id=id))

@app.route('/pacientes/<int:id>/eliminar', methods=['POST'])
@login_required
@admin_required
def paciente_eliminar(id):
    db = get_db()
    paciente = db.execute("SELECT * FROM pacientes WHERE id = ?", (id,)).fetchone()
    if paciente:
        db.execute("DELETE FROM entregas WHERE paciente_id = ?", (id,))
        db.execute("DELETE FROM metricas WHERE paciente_id = ?", (id,))
        db.execute("DELETE FROM visitas WHERE paciente_id = ?", (id,))
        db.execute("DELETE FROM beneficios_tengo WHERE paciente_id = ?", (id,))
        db.execute("DELETE FROM pacientes WHERE id = ?", (id,))
        db.commit()
        log_db(db, session['usuario_id'], "Eliminar paciente", f"{paciente['nombre']} {paciente['apellido']} (ID {id})")
        flash("Paciente y todos sus datos eliminados", "danger")
    db.close()
    return redirect(url_for('pacientes_lista'))

@app.route('/pacientes/<int:id>/editar', methods=['GET', 'POST'])
@login_required
def paciente_editar(id):
    db = get_db()
    paciente = db.execute("SELECT * FROM pacientes WHERE id = ?", (id,)).fetchone()
    if not paciente:
        db.close()
        return redirect(url_for('pacientes_lista'))
    tengo = db.execute("SELECT * FROM beneficios_tengo WHERE paciente_id = ?", (id,)).fetchone()

    if request.method == 'POST':
        db.execute(
            "UPDATE pacientes SET nombre=?, apellido=?, fecha_nac=?, sexo=?, direccion=?, cedula=?, telefono=?, embarazada=?, lactante=?, cuidador_nombre=?, cuidador_apellido=?, cuidador_cedula=?, cuidador_telefono=? WHERE id=?",
            (request.form['nombre'].strip(), request.form['apellido'].strip(), request.form['fecha_nac'],
             request.form.get('sexo', ''), request.form.get('direccion', '').strip(),
             request.form.get('cedula', '').strip(), request.form.get('telefono', '').strip(),
             1 if request.form.get('embarazada') else 0,
             1 if request.form.get('lactante') else 0,
             request.form.get('cuidador_nombre', '').strip(),
             request.form.get('cuidador_apellido', '').strip(),
             request.form.get('cuidador_cedula', '').strip(),
             request.form.get('cuidador_telefono', '').strip(),
             id)
        )

        if tengo:
            db.execute(
                "UPDATE beneficios_tengo SET fecha_inicio=?, activa=?, fecha_fin=? WHERE paciente_id=?",
                (request.form.get('tengo_fecha_inicio', ''), 1 if request.form.get('tengo_activa') else 0,
                 request.form.get('tengo_fecha_fin') or None, id)
            )
        elif request.form.get('tengo_fecha_inicio'):
            db.execute(
                "INSERT INTO beneficios_tengo (paciente_id, fecha_inicio, activa) VALUES (?,?,1)",
                (id, request.form['tengo_fecha_inicio'])
            )

        db.commit()
        log_db(db, session['usuario_id'], "Edicion de paciente", f"{request.form['nombre']} {request.form['apellido']}")
        flash("Datos actualizados", "success")
        db.close()
        return redirect(url_for('paciente_perfil', id=id))
    db.close()
    return render_template('pacientes/editar.html', paciente=paciente, tengo=tengo)

@app.route('/pacientes/<int:id>/metricas/nueva')
@login_required
def metrica_nueva(id):
    return redirect(url_for('visita_nueva', id=id))

@app.route('/metricas/<int:id>/editar', methods=['GET', 'POST'])
@login_required
def metrica_editar(id):
    db = get_db()
    metrica = db.execute("SELECT m.*, p.sexo, p.fecha_nac FROM metricas m JOIN pacientes p ON m.paciente_id = p.id WHERE m.id = ?", (id,)).fetchone()
    if not metrica:
        db.close()
        flash("Metrica no encontrada", "danger")
        return redirect(url_for('pacientes_lista'))
    if request.method == 'POST':
        peso = float(request.form['peso'])
        talla_cm = float(request.form['talla'])
        perimetro = float(request.form['perimetro']) if request.form.get('perimetro') else None
        imc = round(peso / ((talla_cm / 100) ** 2), 1) if talla_cm > 0 else None
        nivel = clasificar_desnutricion(peso, talla_cm, perimetro)
        edad_m = get_edad_meses(metrica['fecha_nac'])
        z = calcular_zscore(peso, talla_cm, edad_m, metrica['sexo'])
        db.execute(
            "UPDATE metricas SET fecha=?, peso=?, talla=?, imc=?, perimetro_brazo=?, nivel_desnutricion=?, z_score=?, notas=? WHERE id=?",
            (request.form['fecha'], peso, talla_cm, imc, perimetro, nivel, z, request.form.get('notas', ''), id)
        )
        db.commit()
        log_db(db, session['usuario_id'], "Edicion de metrica", f"ID {id}")
        flash("Metrica actualizada", "success")
        db.close()
        return redirect(url_for('paciente_perfil', id=metrica['paciente_id']))
    db.close()
    return render_template('metricas/editar.html', metrica=metrica)

@app.route('/pacientes/<int:id>/visitas/nueva', methods=['GET', 'POST'])
@login_required
def visita_nueva(id):
    db = get_db()
    paciente = db.execute("SELECT * FROM pacientes WHERE id = ?", (id,)).fetchone()
    if not paciente:
        db.close()
        return redirect(url_for('pacientes_lista'))
    insumos = db.execute("SELECT * FROM insumos ORDER BY nombre").fetchall()
    if request.method == 'POST':
        db.execute(
            "INSERT INTO visitas (paciente_id, fecha, tipo, observaciones, usuario_id) VALUES (?,?,?,?,?)",
            (id, request.form['fecha'], request.form['tipo'], request.form.get('observaciones', ''), session['usuario_id'])
        )

        peso = float(request.form['peso'])
        talla_cm = float(request.form['talla'])
        perimetro = float(request.form['perimetro']) if request.form.get('perimetro') else None
        imc = round(peso / ((talla_cm / 100) ** 2), 1) if talla_cm > 0 else None
        nivel = clasificar_desnutricion(peso, talla_cm, perimetro)
        edad_m = get_edad_meses(paciente['fecha_nac'])
        z = calcular_zscore(peso, talla_cm, edad_m, paciente['sexo'])
        db.execute(
            "INSERT INTO metricas (paciente_id, fecha, peso, talla, imc, perimetro_brazo, nivel_desnutricion, z_score, notas, usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (id, request.form['fecha'], peso, talla_cm, imc, perimetro, nivel, z, request.form.get('observaciones', ''), session['usuario_id'])
        )

        insumos_ids = request.form.getlist('insumo_id')
        cantidades = request.form.getlist('cantidad')
        for ins_id, cant in zip(insumos_ids, cantidades):
            if ins_id and cant:
                cantidad = float(cant)
                db.execute(
                    "INSERT INTO entregas (paciente_id, insumo_id, cantidad, fecha, visita_id, usuario_id) VALUES (?,?,?,?,NULL,?)",
                    (id, ins_id, cantidad, request.form['fecha'], session['usuario_id'])
                )
                db.execute("UPDATE insumos SET stock_actual = stock_actual - ? WHERE id = ?", (cantidad, ins_id))

        db.commit()
        log_db(db, session['usuario_id'], "Visita registrada", f"Paciente {paciente['nombre']} {paciente['apellido']} - {request.form['tipo']}")
        flash("Visita registrada", "success")
        db.close()
        return redirect(url_for('paciente_perfil', id=id))
    db.close()
    return render_template('visitas/nueva.html', paciente=paciente, insumos=insumos,
                          hoy=datetime.date.today().isoformat(), tipos=TIPO_VISITAS)

@app.route('/pacientes/<int:id>/entregas/nueva', methods=['GET', 'POST'])
@login_required
def entrega_nueva(id):
    db = get_db()
    paciente = db.execute("SELECT * FROM pacientes WHERE id = ?", (id,)).fetchone()
    if not paciente:
        db.close()
        return redirect(url_for('pacientes_lista'))
    insumos = db.execute("SELECT * FROM insumos ORDER BY nombre").fetchall()
    if request.method == 'POST':
        insumos_ids = request.form.getlist('insumo_id')
        cantidades = request.form.getlist('cantidad')
        for ins_id, cant in zip(insumos_ids, cantidades):
            if ins_id and cant:
                cantidad = float(cant)
                db.execute(
                    "INSERT INTO entregas (paciente_id, insumo_id, cantidad, fecha, visita_id, usuario_id) VALUES (?,?,?,?,NULL,?)",
                    (id, ins_id, cantidad, request.form['fecha'], session['usuario_id'])
                )
                db.execute("UPDATE insumos SET stock_actual = stock_actual - ? WHERE id = ?", (cantidad, ins_id))
        db.commit()
        log_db(db, session['usuario_id'], "Entrega registrada", f"Paciente {paciente['nombre']} {paciente['apellido']}")
        flash("Entrega registrada", "success")
        db.close()
        return redirect(url_for('paciente_perfil', id=id))
    db.close()
    return render_template('entregas/nueva.html', paciente=paciente, insumos=insumos, hoy=datetime.date.today().isoformat())

@app.route('/entregas/<int:id>/editar', methods=['GET', 'POST'])
@login_required
def entrega_editar(id):
    db = get_db()
    entrega = db.execute("SELECT e.*, p.nombre, p.apellido FROM entregas e JOIN pacientes p ON e.paciente_id = p.id WHERE e.id = ?", (id,)).fetchone()
    if not entrega:
        db.close()
        flash("Entrega no encontrada", "danger")
        return redirect(url_for('pacientes_lista'))
    insumos = db.execute("SELECT * FROM insumos ORDER BY nombre").fetchall()
    if request.method == 'POST':
        cantidad_anterior = entrega['cantidad']
        insumo_id_anterior = entrega['insumo_id']
        nueva_cantidad = float(request.form['cantidad'])
        nuevo_insumo = request.form['insumo_id']

        db.execute("UPDATE insumos SET stock_actual = stock_actual + ? WHERE id = ?", (cantidad_anterior, insumo_id_anterior))
        db.execute("UPDATE insumos SET stock_actual = stock_actual - ? WHERE id = ?", (nueva_cantidad, nuevo_insumo))

        db.execute(
            "UPDATE entregas SET insumo_id=?, cantidad=?, fecha=? WHERE id=?",
            (nuevo_insumo, nueva_cantidad, request.form['fecha'], id)
        )
        db.commit()
        log_db(db, session['usuario_id'], "Edicion de entrega", f"ID {id}")
        flash("Entrega actualizada", "success")
        db.close()
        return redirect(url_for('paciente_perfil', id=entrega['paciente_id']))
    db.close()
    return render_template('entregas/editar.html', entrega=entrega, insumos=insumos)

@app.route('/inventario/nuevo', methods=['GET', 'POST'])
@login_required
def inventario_nuevo():
    db = get_db()
    if request.method == 'POST':
        nombre = request.form['nombre'].strip()
        categoria = request.form.get('categoria', '').strip()
        unidad = request.form['unidad'].strip()
        stock_actual = float(request.form.get('stock_actual', 0))
        stock_minimo = float(request.form.get('stock_minimo', 0))
        db.execute(
            "INSERT INTO insumos (nombre, categoria, unidad, stock_actual, stock_minimo) VALUES (?,?,?,?,?)",
            (nombre, categoria, unidad, stock_actual, stock_minimo)
        )
        db.commit()
        log_db(db, session['usuario_id'], "Nuevo insumo", nombre)
        flash("Insumo creado", "success")
        db.close()
        return redirect(url_for('inventario_index'))
    db.close()
    return render_template('inventario/nuevo.html')

@app.route('/inventario/<int:id>/eliminar', methods=['POST'])
@login_required
def inventario_eliminar(id):
    db = get_db()
    insumo = db.execute("SELECT * FROM insumos WHERE id = ?", (id,)).fetchone()
    if insumo:
        db.execute("UPDATE entregas SET insumo_id = NULL WHERE insumo_id = ?", (id,))
        db.execute("UPDATE ingresos_insumos SET insumo_id = NULL WHERE insumo_id = ?", (id,))
        db.execute("DELETE FROM insumos WHERE id = ?", (id,))
        db.commit()
        log_db(db, session['usuario_id'], "Eliminar insumo", f"{insumo['nombre']} (ID {id})")
        flash("Insumo eliminado", "danger")
    db.close()
    return redirect(url_for('inventario_index'))

@app.route('/inventario/entrega', methods=['GET', 'POST'])
@login_required
def inventario_entrega():
    db = get_db()
    insumos = db.execute("SELECT * FROM insumos ORDER BY nombre").fetchall()
    pacientes = db.execute("SELECT id, nombre, apellido, cedula FROM pacientes ORDER BY apellido").fetchall()
    if request.method == 'POST':
        paciente_id = request.form['paciente_id']
        fecha = request.form['fecha']
        insumos_ids = request.form.getlist('insumo_id')
        cantidades = request.form.getlist('cantidad')
        for ins_id, cant in zip(insumos_ids, cantidades):
            if ins_id and cant:
                cantidad = float(cant)
                db.execute(
                    "INSERT INTO entregas (paciente_id, insumo_id, cantidad, fecha, visita_id, usuario_id) VALUES (?,?,?,?,NULL,?)",
                    (paciente_id, ins_id, cantidad, fecha, session['usuario_id'])
                )
                db.execute("UPDATE insumos SET stock_actual = stock_actual - ? WHERE id = ?", (cantidad, ins_id))
        db.commit()
        log_db(db, session['usuario_id'], "Entrega desde inventario", f"Paciente ID {paciente_id}")
        flash("Entrega registrada", "success")
        db.close()
        return redirect(url_for('inventario_index'))
    db.close()
    return render_template('inventario/entrega.html', insumos=insumos, pacientes=pacientes,
                          hoy=datetime.date.today().isoformat())

@app.route('/inventario')
@login_required
def inventario_index():
    db = get_db()
    insumos = db.execute("SELECT * FROM insumos ORDER BY nombre").fetchall()
    ingresos = db.execute(
        "SELECT i.*, ins.nombre as insumo_nombre, ins.unidad, u.nombre as usuario_nombre "
        "FROM ingresos_insumos i JOIN insumos ins ON i.insumo_id = ins.id "
        "LEFT JOIN usuarios u ON i.usuario_id = u.id ORDER BY i.fecha DESC LIMIT 20"
    ).fetchall()
    salidas = db.execute(
        "SELECT e.*, i.nombre as insumo_nombre, i.unidad, u.nombre as usuario_nombre, "
        "p.nombre || ' ' || p.apellido as paciente_nombre "
        "FROM entregas e JOIN insumos i ON e.insumo_id = i.id "
        "LEFT JOIN usuarios u ON e.usuario_id = u.id "
        "LEFT JOIN pacientes p ON e.paciente_id = p.id ORDER BY e.fecha DESC LIMIT 20"
    ).fetchall()
    db.close()
    return render_template('inventario/index.html', insumos=insumos, ingresos=ingresos, salidas=salidas)

@app.route('/inventario/llegada', methods=['GET', 'POST'])
@login_required
def inventario_llegada():
    db = get_db()
    insumos = db.execute("SELECT * FROM insumos ORDER BY nombre").fetchall()
    if request.method == 'POST':
        insumo_id = request.form['insumo_id']
        cantidad = float(request.form['cantidad'])
        notas = request.form.get('notas', '')
        db.execute(
            "INSERT INTO ingresos_insumos (insumo_id, cantidad, fecha, usuario_id, notas) VALUES (?,?,?,?,?)",
            (insumo_id, cantidad, request.form['fecha'], session['usuario_id'], notas)
        )
        db.execute("UPDATE insumos SET stock_actual = stock_actual + ? WHERE id = ?", (cantidad, insumo_id))
        db.commit()
        log_db(db, session['usuario_id'], "Ingreso de insumos", f"Insumo ID {insumo_id}, cantidad {cantidad}")
        flash("Ingreso registrado", "success")
        db.close()
        return redirect(url_for('inventario_index'))
    db.close()
    return render_template('inventario/llegada.html', insumos=insumos, hoy=datetime.date.today().isoformat())

@app.route('/bd/pacientes')
@login_required
def bd_pacientes():
    db = get_db()
    q = request.args.get('q', '')
    if q:
        pacientes = db.execute(
            "SELECT p.*, u.nombre as creador, "
            "(SELECT nivel_desnutricion FROM metricas WHERE paciente_id = p.id ORDER BY fecha DESC LIMIT 1) as nivel, "
            "(SELECT activa FROM beneficios_tengo WHERE paciente_id = p.id) as tengo_activo "
            "FROM pacientes p LEFT JOIN usuarios u ON p.creado_por = u.id "
            "WHERE p.nombre || ' ' || p.apellido LIKE ? ORDER BY p.apellido", (f'%{q}%',)
        ).fetchall()
    else:
        pacientes = db.execute(
            "SELECT p.*, u.nombre as creador, "
            "(SELECT nivel_desnutricion FROM metricas WHERE paciente_id = p.id ORDER BY fecha DESC LIMIT 1) as nivel, "
            "(SELECT activa FROM beneficios_tengo WHERE paciente_id = p.id) as tengo_activo "
            "FROM pacientes p LEFT JOIN usuarios u ON p.creado_por = u.id ORDER BY p.apellido"
        ).fetchall()
    db.close()
    return render_template('bd/pacientes.html', pacientes=pacientes, q=q)

@app.route('/bd/insumos')
@login_required
def bd_insumos():
    db = get_db()
    insumos = db.execute("SELECT * FROM insumos ORDER BY nombre").fetchall()
    db.close()
    return render_template('bd/insumos.html', insumos=insumos)

@app.route('/bd/reportes', methods=['GET', 'POST'])
@login_required
def bd_reportes():
    db = get_db()
    reporte = None
    pacientes_data = []
    now = datetime.datetime.now()
    periodo = request.form.get('periodo', 'mensual')
    mes = request.form.get('mes', str(now.month).zfill(2))
    anio = request.form.get('anio', str(now.year))

    if request.method == 'POST':
        if periodo == 'mensual':
            fecha_inicio = f"{anio}-{mes}-01"
            fecha_fin = f"{anio}-{str(int(mes)+1).zfill(2)}-01" if mes != '12' else f"{int(anio)+1}-01-01"
        elif periodo == 'trimestral':
            t = int(request.form.get('trimestre', '1'))
            mes_ini = (t - 1) * 3 + 1
            mes_fin = mes_ini + 3
            fecha_inicio = f"{anio}-{str(mes_ini).zfill(2)}-01"
            fecha_fin = f"{anio}-{str(mes_fin).zfill(2)}-01" if mes_fin <= 12 else f"{int(anio)+1}-01-01"
        elif periodo == 'semestral':
            s = int(request.form.get('semestre', '1'))
            mes_ini = (s - 1) * 6 + 1
            mes_fin = mes_ini + 6
            fecha_inicio = f"{anio}-{str(mes_ini).zfill(2)}-01"
            fecha_fin = f"{anio}-{str(mes_fin).zfill(2)}-01" if mes_fin <= 12 else f"{int(anio)+1}-01-01"
        elif periodo == 'anual':
            fecha_inicio = f"{anio}-01-01"
            fecha_fin = f"{int(anio)+1}-01-01"
        elif periodo == 'personalizado':
            d_mes = request.form.get('desde_mes', '01')
            d_anio = request.form.get('desde_anio', anio)
            h_mes = request.form.get('hasta_mes', '12')
            h_anio = request.form.get('hasta_anio', anio)
            fecha_inicio = f"{d_anio}-{d_mes}-01"
            fecha_fin = f"{h_anio}-{str(int(h_mes)+1).zfill(2)}-01" if h_mes != '12' else f"{int(h_anio)+1}-01-01"
        else:
            fecha_inicio = f"{anio}-{mes}-01"
            fecha_fin = f"{anio}-{str(int(mes)+1).zfill(2)}-01" if mes != '12' else f"{int(anio)+1}-01-01"

        total_pacientes = db.execute("SELECT COUNT(*) FROM pacientes").fetchone()[0]

        atendidos = db.execute(
            "SELECT COUNT(DISTINCT paciente_id) FROM visitas WHERE fecha >= ? AND fecha < ?",
            (fecha_inicio, fecha_fin)
        ).fetchone()[0]

        niveles = db.execute(
            "SELECT m.nivel_desnutricion, COUNT(*) as total FROM "
            "(SELECT paciente_id, MAX(fecha) as max_fecha FROM metricas GROUP BY paciente_id) ult "
            "JOIN metricas m ON m.paciente_id = ult.paciente_id AND m.fecha = ult.max_fecha "
            "GROUP BY m.nivel_desnutricion"
        ).fetchall()

        total_visitas = db.execute(
            "SELECT COUNT(*) FROM visitas WHERE fecha >= ? AND fecha < ?",
            (fecha_inicio, fecha_fin)
        ).fetchone()[0]

        entregas_mes = db.execute(
            "SELECT i.nombre, i.unidad, SUM(e.cantidad) as total FROM entregas e "
            "JOIN insumos i ON e.insumo_id = i.id "
            "WHERE e.fecha >= ? AND e.fecha < ? GROUP BY i.nombre ORDER BY i.nombre",
            (fecha_inicio, fecha_fin)
        ).fetchall()

        criticos = db.execute(
            "SELECT * FROM insumos WHERE stock_actual < stock_minimo ORDER BY nombre"
        ).fetchall()

        pacientes_data = db.execute(
            "SELECT p.id, p.nombre, p.apellido, p.fecha_nac, p.sexo, p.embarazada, p.lactante, p.creado_en, "
            "(SELECT nivel_desnutricion FROM metricas WHERE paciente_id = p.id ORDER BY fecha DESC LIMIT 1) as ultimo_nivel, "
            "(SELECT z_score FROM metricas WHERE paciente_id = p.id ORDER BY fecha DESC LIMIT 1) as ultimo_z, "
            "(SELECT activa FROM beneficios_tengo WHERE paciente_id = p.id) as tengo_activo, "
            "(SELECT COUNT(*) FROM visitas WHERE paciente_id = p.id AND fecha >= ? AND fecha < ?) as visitas_mes "
            "FROM pacientes p ORDER BY p.apellido", (fecha_inicio, fecha_fin)
        ).fetchall()

        insumos_rows = db.execute(
            "SELECT e.paciente_id, i.nombre, SUM(e.cantidad) as total, i.unidad "
            "FROM entregas e JOIN insumos i ON e.insumo_id = i.id "
            "WHERE e.fecha >= ? AND e.fecha < ? "
            "GROUP BY e.paciente_id, i.id ORDER BY e.paciente_id, i.nombre",
            (fecha_inicio, fecha_fin)
        ).fetchall()
        insumos_dict = {}
        for r in insumos_rows:
            insumos_dict.setdefault(r['paciente_id'], []).append(f"{r['nombre']}: {r['total']:.1f}{r['unidad']}")

        cats = {"Lactante": 0, "Niño": 0, "Adulto": 0, "Embarazada": 0}
        for p in pacientes_data:
            edad = get_edad(p['fecha_nac'])
            cat = clasificar_paciente(edad, p['embarazada'], p['lactante'])
            cats[cat] = cats.get(cat, 0) + 1

        periodos_labels = {
            'mensual': f'{mes}/{anio}',
            'trimestral': f'Trimestre {request.form.get("trimestre", "1")} {anio}',
            'semestral': f'Semestre {request.form.get("semestre", "1")} {anio}',
            'anual': f'Año {anio}',
            'personalizado': f'{request.form.get("desde_mes", "?")}/{request.form.get("desde_anio", anio)} - {request.form.get("hasta_mes", "?")}/{request.form.get("hasta_anio", anio)}',
        }
        reporte = {
            'periodo': periodos_labels.get(periodo, f'{mes}/{anio}'),
            'total_pacientes': total_pacientes,
            'atendidos': atendidos,
            'niveles': dict((n['nivel_desnutricion'] or 'Sin datos', n['total']) for n in niveles),
            'total_visitas': total_visitas,
            'entregas': entregas_mes,
            'criticos': criticos,
            'categorias': cats,
        }

        if 'exportar' in request.form:
            tengo_activos = db.execute(
                "SELECT COUNT(*) as c FROM beneficios_tengo WHERE activa = 1"
            ).fetchone()['c']

            ingresos_mes = db.execute(
                "SELECT i.nombre, i.unidad, SUM(ii.cantidad) as total FROM ingresos_insumos ii "
                "JOIN insumos i ON ii.insumo_id = i.id "
                "WHERE ii.fecha >= ? AND ii.fecha < ? GROUP BY i.nombre ORDER BY i.nombre",
                (fecha_inicio, fecha_fin)
            ).fetchall()

            rows = []
            total_visitas = 0
            total_entregas = {}
            for p in pacientes_data:
                edad = get_edad(p['fecha_nac'])
                cat = clasificar_paciente(edad, p['embarazada'], p['lactante'])
                ingreso = (p['creado_en'] or '')[:10]
                items = insumos_dict.get(p['id'], [])
                total_visitas += p['visitas_mes']
                rows.append({
                    'Nombre': f"{p['nombre']} {p['apellido']}",
                    'Tipo': cat,
                    'Fecha ingreso': ingreso,
                    'Tengo': 'Si' if p['tengo_activo'] else 'No',
                    'Visitas en el mes': p['visitas_mes'],
                    'Insumos entregados': ' | '.join(items),
                })

            for r in insumos_rows:
                name = r['nombre']
                total_entregas[name] = total_entregas.get(name, 0) + r['total']
                total_entregas[f'_{name}_unit'] = r['unidad']

            # Totals section
            rows.append({'Nombre': '', 'Tipo': '', 'Fecha ingreso': '', 'Tengo': '', 'Visitas en el mes': '', 'Insumos entregados': ''})
            rows.append({'Nombre': 'RESUMEN DEL MES', 'Tipo': '', 'Fecha ingreso': '', 'Tengo': '', 'Visitas en el mes': '', 'Insumos entregados': ''})

            for cat_name in ['Lactante', 'Niño', 'Adulto', 'Embarazada']:
                rows.append({
                    'Nombre': f'Pacientes {cat_name}',
                    'Tipo': '',
                    'Fecha ingreso': '',
                    'Tengo': '',
                    'Visitas en el mes': cats.get(cat_name, 0),
                    'Insumos entregados': '',
                })

            for r in entregas_mes:
                rows.append({
                    'Nombre': 'Entregado: ' + r['nombre'],
                    'Tipo': '',
                    'Fecha ingreso': '',
                    'Tengo': '',
                    'Visitas en el mes': '',
                    'Insumos entregados': f"{r['total']:.1f} {r['unidad']}",
                })

            for r in ingresos_mes:
                rows.append({
                    'Nombre': 'Ingresado: ' + r['nombre'],
                    'Tipo': '',
                    'Fecha ingreso': '',
                    'Tengo': '',
                    'Visitas en el mes': '',
                    'Insumos entregados': f"{r['total']:.1f} {r['unidad']}",
                })

            rows.append({
                'Nombre': 'Beneficiarios Tengo activos',
                'Tipo': '',
                'Fecha ingreso': '',
                'Tengo': '',
                'Visitas en el mes': tengo_activos,
                'Insumos entregados': '',
            })

            import openpyxl
            from openpyxl.styles import Font
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = 'Reporte'
            headers = ['Nombre', 'Tipo', 'Fecha ingreso', 'Tengo', 'Visitas en el mes', 'Insumos entregados']
            ws.append(headers)
            ws.append([])
            for r in rows:
                ws.append([r.get(h, '') for h in headers])
            output = BytesIO()
            wb.save(output)
            output.seek(0)
            db.close()
            fname = f'reporte_{periodo}_{anio}.xlsx' if periodo != 'personalizado' else f'reporte_{request.form.get("desde_mes","")}-{request.form.get("desde_anio",anio)}_{request.form.get("hasta_mes","")}-{request.form.get("hasta_anio",anio)}.xlsx'
            return send_file(output, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                           as_attachment=True, download_name=fname)

    db.close()
    return render_template('bd/reportes.html', reporte=reporte, periodo=periodo,
                          mes=mes, anio=anio,
                          trimestre=request.form.get('trimestre', '1'),
                          semestre=request.form.get('semestre', '1'),
                          desde_mes=request.form.get('desde_mes', '01'),
                          desde_anio=request.form.get('desde_anio', anio),
                          hasta_mes=request.form.get('hasta_mes', '12'),
                          hasta_anio=request.form.get('hasta_anio', anio),
                          pacientes=pacientes_data, get_edad=get_edad,
                           clasificar_paciente=clasificar_paciente, get_categoria_color=get_categoria_color,
                           interpretar_zscore=interpretar_zscore,
                          meses=[str(i).zfill(2) for i in range(1,13)],
                          anios=[str(a) for a in range(2024, 2028)])

@app.route('/admin/usuarios')
@login_required
@admin_required
def admin_usuarios():
    db = get_db()
    usuarios = db.execute("SELECT * FROM usuarios ORDER BY nombre").fetchall()
    db.close()
    return render_template('admin/usuarios.html', usuarios=usuarios)

@app.route('/admin/usuarios/nuevo', methods=['POST'])
@login_required
@admin_required
def admin_usuario_nuevo():
    nombre_completo = f"{request.form['nombre'].strip()} {request.form['apellido'].strip()}"
    usuario = request.form['usuario'].strip().lower()
    password = request.form['password'].strip()
    if not password:
        flash("La contraseña es obligatoria", "danger")
        return redirect(url_for('admin_usuarios'))
    rol = request.form.get('rol', 'voluntario')
    db = get_db()
    try:
        db.execute(
            "INSERT INTO usuarios (nombre, usuario, password, rol) VALUES (?,?,?,?)",
            (nombre_completo, usuario, generate_password_hash(password), rol)
        )
        db.commit()
        log_db(db, session['usuario_id'], "Creacion de usuario", f"{nombre_completo} ({usuario}, {rol})")
        flash("Usuario creado", "success")
    except Exception as e:
        flash(f"Error: {str(e)}", "danger")
    db.close()
    return redirect(url_for('admin_usuarios'))

@app.route('/admin/usuarios/<int:id>/toggle')
@login_required
@admin_required
def admin_usuario_toggle(id):
    db = get_db()
    user = db.execute("SELECT * FROM usuarios WHERE id = ?", (id,)).fetchone()
    if user and user['id'] != session['usuario_id']:
        nuevo = 0 if user['activo'] else 1
        db.execute("UPDATE usuarios SET activo = ? WHERE id = ?", (nuevo, id))
        db.commit()
        log_db(db, session['usuario_id'], "Estado usuario", f"{user['nombre']} -> {'activo' if nuevo else 'inactivo'}")
        flash("Estado actualizado", "success")
    db.close()
    return redirect(url_for('admin_usuarios'))

@app.route('/admin/usuarios/<int:id>/reset', methods=['POST'])
@login_required
@admin_required
def admin_usuario_reset(id):
    db = get_db()
    user = db.execute("SELECT * FROM usuarios WHERE id = ?", (id,)).fetchone()
    if user:
        nueva_pass = request.form.get('password', user['identificacion'] or '123')
        db.execute("UPDATE usuarios SET password = ? WHERE id = ?", (generate_password_hash(nueva_pass), id))
        db.commit()
        log_db(db, session['usuario_id'], "Reset password", f"{user['nombre']}")
        flash("Contrasena reseteada", "success")
    db.close()
    return redirect(url_for('admin_usuarios'))

@app.route('/admin/usuarios/<int:id>/eliminar', methods=['POST'])
@login_required
@admin_required
def admin_usuario_eliminar(id):
    db = get_db()
    user = db.execute("SELECT * FROM usuarios WHERE id = ?", (id,)).fetchone()
    if user and user['id'] != session['usuario_id']:
        for table in ['metricas', 'visitas', 'entregas', 'ingresos_insumos', 'logs']:
            db.execute(f"UPDATE {table} SET usuario_id = NULL WHERE usuario_id = ?", (id,))
        db.execute("UPDATE pacientes SET creado_por = NULL WHERE creado_por = ?", (id,))
        db.execute("DELETE FROM usuarios WHERE id = ?", (id,))
        db.commit()
        log_db(db, session['usuario_id'], "Eliminar usuario", f"{user['nombre']}")
        flash("Usuario eliminado", "success")
    db.close()
    return redirect(url_for('admin_usuarios'))

@app.route('/admin/logs')
@login_required
@admin_required
def admin_logs():
    db = get_db()
    usuario_filtro = request.args.get('usuario', '')
    accion_filtro = request.args.get('accion', '')
    query = "SELECT l.*, u.nombre as usuario_nombre FROM logs l LEFT JOIN usuarios u ON l.usuario_id = u.id WHERE 1=1"
    params = []
    if usuario_filtro:
        query += " AND l.usuario_id = ?"
        params.append(int(usuario_filtro))
    if accion_filtro:
        query += " AND l.accion = ?"
        params.append(accion_filtro)
    query += " ORDER BY l.timestamp DESC LIMIT 200"
    logs = db.execute(query, params).fetchall()
    acciones = db.execute("SELECT DISTINCT accion FROM logs ORDER BY accion").fetchall()
    usuarios = db.execute("SELECT id, nombre FROM usuarios ORDER BY nombre").fetchall()
    db.close()
    return render_template('admin/logs.html', logs=logs, acciones=acciones, usuarios=usuarios,
                          usuario_filtro=usuario_filtro, accion_filtro=accion_filtro)

@app.route('/sync/exportar')
@login_required
def sync_exportar():
    db = get_db()
    data = {}
    for table in ['usuarios', 'pacientes', 'metricas', 'visitas', 'insumos', 'entregas', 'beneficios_tengo', 'ingresos_insumos', 'logs']:
        rows = db.execute(f"SELECT * FROM {table}").fetchall()
        data[table] = [dict(r) for r in rows]
    db.close()
    js = json.dumps(data, indent=2, default=str)
    r = app.response_class(js, mimetype='application/json')
    r.headers['Content-Disposition'] = f'attachment; filename=caritas_backup_{datetime.date.today().isoformat()}.json'
    return r

@app.route('/sync/importar', methods=['POST'])
@login_required
def sync_importar():
    if 'archivo' not in request.files:
        flash("No se selecciono archivo", "danger")
        return redirect(url_for('sincronizar'))
    f = request.files['archivo']
    if not f.filename.endswith('.json'):
        flash("El archivo debe ser .json", "danger")
        return redirect(url_for('sincronizar'))
    try:
        data = json.load(f)
        db = get_db()
        for table in ['usuarios', 'pacientes', 'metricas', 'visitas', 'insumos', 'entregas', 'beneficios_tengo', 'ingresos_insumos', 'logs']:
            for row in data.get(table, []):
                cols = ', '.join(row.keys())
                placeholders = ', '.join(['?' for _ in row])
                db.execute(f"INSERT OR IGNORE INTO {table} ({cols}) VALUES ({placeholders})", list(row.values()))
        db.commit()
        db.close()
        flash("Datos importados correctamente", "success")
    except Exception as e:
        flash(f"Error al importar: {str(e)}", "danger")
    return redirect(url_for('sincronizar'))

@app.route('/sincronizar')
@login_required
def sincronizar():
    return render_template('sync/sincronizar.html')

if __name__ == '__main__':
    if not os.path.exists(os.path.join(os.path.dirname(__file__), 'caritas.db')):
        init_db()
    app.run(debug=False, host='0.0.0.0', port=5000)

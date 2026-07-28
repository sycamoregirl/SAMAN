CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    usuario TEXT UNIQUE,
    identificacion TEXT UNIQUE,
    password TEXT,
    rol TEXT DEFAULT 'voluntario',
    activo INTEGER DEFAULT 1,
    ultima_sesion TEXT
);

CREATE TABLE IF NOT EXISTS pacientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    fecha_nac TEXT NOT NULL,
    sexo TEXT DEFAULT '',
    direccion TEXT DEFAULT '',
    cedula TEXT DEFAULT '',
    telefono TEXT DEFAULT '',
    embarazada INTEGER DEFAULT 0,
    lactante INTEGER DEFAULT 0,
    cuidador_nombre TEXT DEFAULT '',
    cuidador_apellido TEXT DEFAULT '',
    cuidador_cedula TEXT DEFAULT '',
    cuidador_telefono TEXT DEFAULT '',
    activo INTEGER DEFAULT 1,
    creado_por INTEGER,
    creado_en TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (creado_por) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS metricas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL,
    fecha TEXT DEFAULT (datetime('now','localtime')),
    peso REAL NOT NULL,
    talla REAL NOT NULL,
    imc REAL,
    perimetro_brazo REAL,
    nivel_desnutricion TEXT,
    z_score REAL,
    notas TEXT,
    usuario_id INTEGER,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS visitas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL,
    fecha TEXT DEFAULT (datetime('now','localtime')),
    tipo TEXT DEFAULT 'jornada',
    observaciones TEXT,
    usuario_id INTEGER,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS insumos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    categoria TEXT,
    unidad TEXT NOT NULL,
    stock_actual REAL DEFAULT 0,
    stock_minimo REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS entregas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL,
    insumo_id INTEGER NOT NULL,
    cantidad REAL NOT NULL,
    fecha TEXT DEFAULT (datetime('now','localtime')),
    visita_id INTEGER,
    usuario_id INTEGER,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
    FOREIGN KEY (insumo_id) REFERENCES insumos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS beneficios_tengo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL UNIQUE,
    fecha_inicio TEXT NOT NULL,
    activa INTEGER DEFAULT 1,
    fecha_fin TEXT,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingresos_insumos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    insumo_id INTEGER NOT NULL,
    cantidad REAL NOT NULL,
    fecha TEXT DEFAULT (datetime('now','localtime')),
    usuario_id INTEGER,
    notas TEXT,
    FOREIGN KEY (insumo_id) REFERENCES insumos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    accion TEXT NOT NULL,
    detalle TEXT,
    timestamp TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

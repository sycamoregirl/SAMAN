const DB = (() => {
    const DB_NAME = 'SAMAN';
    const DB_VERSION = 2;
    let db = null;

    const _cache = {};
    const _cacheTime = {};

    function _cacheGet(store) {
        if (_cache[store] !== undefined) return _cache[store];
        return null;
    }

    function _cacheSet(store, data) {
        _cache[store] = data;
        _cacheTime[store] = Date.now();
    }

    function _cacheDel(store) {
        delete _cache[store];
        delete _cacheTime[store];
    }

    function open() {
        return new Promise((resolve, reject) => {
            if (db && db.readyState === 'open') return resolve(db);
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const d = e.target.result;
                const stores = [
                    ['usuarios', { keyPath: 'id', autoIncrement: true }, [['usuario', 'usuario', { unique: true }]]],
                    ['pacientes', { keyPath: 'id', autoIncrement: true }, [['nombre', ['nombre', 'apellido']], ['activo', 'activo']]],
                    ['metricas', { keyPath: 'id', autoIncrement: true }, [['paciente_id', 'paciente_id']]],
                    ['visitas', { keyPath: 'id', autoIncrement: true }, [['paciente_id', 'paciente_id']]],
                    ['insumos', { keyPath: 'id', autoIncrement: true }, [['nombre', 'nombre']]],
                    ['entregas', { keyPath: 'id', autoIncrement: true }, [['paciente_id', 'paciente_id'], ['insumo_id', 'insumo_id']]],
                    ['beneficios_tengo', { keyPath: 'id', autoIncrement: true }, [['paciente_id', 'paciente_id', { unique: true }]]],
                    ['ingresos_insumos', { keyPath: 'id', autoIncrement: true }, [['insumo_id', 'insumo_id']]],
                    ['logs', { keyPath: 'id', autoIncrement: true }, [['usuario_id', 'usuario_id']]]
                ];
                for (const [name, opts, indexes] of stores) {
                    if (!d.objectStoreNames.contains(name)) {
                        const s = d.createObjectStore(name, opts);
                        for (const [idxName, idxKey, idxOpts] of indexes) {
                            s.createIndex(idxName, idxKey, idxOpts || {});
                        }
                    }
                }
            };
            req.onsuccess = (e) => { db = e.target.result; resolve(db); };
            req.onerror = (e) => { console.error('DB open error:', e.target.error); reject(e.target.error); };
        });
    }

    function tx(store, mode) {
        return db.transaction(store, mode).objectStore(store);
    }

    function add(store, data) {
        return new Promise(async (resolve, reject) => {
            try {
                await open();
                data._modified = Date.now();
                const s = tx(store, 'readwrite');
                const req = s.add(data);
                req.onsuccess = () => { _cacheDel(store); resolve(req.result); };
                req.onerror = () => reject(req.error);
            } catch (e) { reject(e); }
        });
    }

    function put(store, data) {
        return new Promise(async (resolve, reject) => {
            try {
                await open();
                data._modified = Date.now();
                const s = tx(store, 'readwrite');
                const req = s.put(data);
                req.onsuccess = () => { _cacheDel(store); resolve(req.result); };
                req.onerror = () => reject(req.error);
            } catch (e) { reject(e); }
        });
    }

    function get(store, id) {
        return new Promise(async (resolve, reject) => {
            try {
                await open();
                const s = tx(store, 'readonly');
                const req = s.get(id);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            } catch (e) { reject(e); }
        });
    }

    function getAll(store) {
        return new Promise(async (resolve, reject) => {
            const cached = _cacheGet(store);
            if (cached) return resolve(cached);
            try {
                await open();
                const s = tx(store, 'readonly');
                const req = s.getAll();
                req.onsuccess = () => {
                    const result = req.result || [];
                    _cacheSet(store, result);
                    resolve(result);
                };
                req.onerror = () => reject(req.error);
            } catch (e) { reject(e); }
        });
    }

    function getAllMulti(storeNames) {
        return new Promise(async (resolve, reject) => {
            const allCached = storeNames.every(n => _cacheGet(n) !== null);
            if (allCached) {
                const r = {};
                for (const n of storeNames) r[n] = _cacheGet(n);
                return resolve(r);
            }
            try {
                await open();
                const txObj = db.transaction(storeNames, 'readonly');
                const results = {};
                let pending = storeNames.length;
                let failed = false;
                for (const name of storeNames) {
                    const cached = _cacheGet(name);
                    if (cached) {
                        results[name] = cached;
                        if (--pending === 0) resolve(results);
                        continue;
                    }
                    const req = txObj.objectStore(name).getAll();
                    req.onsuccess = () => {
                        if (failed) return;
                        results[name] = req.result || [];
                        _cacheSet(name, results[name]);
                        if (--pending === 0) resolve(results);
                    };
                    req.onerror = () => {
                        if (failed) return;
                        failed = true;
                        reject(req.error);
                    };
                }
            } catch (e) { reject(e); }
        });
    }

    function del(store, id) {
        return new Promise(async (resolve, reject) => {
            try {
                await open();
                const s = tx(store, 'readwrite');
                const req = s.delete(id);
                req.onsuccess = () => { _cacheDel(store); resolve(); };
                req.onerror = () => reject(req.error);
            } catch (e) { reject(e); }
        });
    }

    function getByIndex(store, indexName, value) {
        return new Promise(async (resolve, reject) => {
            try {
                await open();
                const s = tx(store, 'readonly');
                const idx = s.index(indexName);
                const req = idx.getAll(value);
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            } catch (e) { reject(e); }
        });
    }

    function getByIndexMap(store, indexName) {
        return new Promise(async (resolve, reject) => {
            try {
                await open();
                const txObj = db.transaction(store, 'readonly');
                const idx = txObj.objectStore(store).index(indexName);
                const req = idx.getAll();
                req.onsuccess = () => {
                    const map = new Map();
                    for (const record of req.result || []) {
                        const key = record[indexName];
                        if (!map.has(key)) map.set(key, []);
                        map.get(key).push(record);
                    }
                    resolve(map);
                };
                req.onerror = () => reject(req.error);
            } catch (e) { reject(e); }
        });
    }

    function clear(store) {
        return new Promise(async (resolve, reject) => {
            try {
                await open();
                const s = tx(store, 'readwrite');
                const req = s.clear();
                req.onsuccess = () => { _cacheDel(store); resolve(); };
                req.onerror = () => reject(req.error);
            } catch (e) { reject(e); }
        });
    }

    function now() {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    function today() {
        return new Date().toISOString().substring(0, 10);
    }

    async function log(usuario_id, accion, detalle) {
        try { await add('logs', { usuario_id, accion, detalle, timestamp: now() }); } catch (e) { console.error('Log error:', e); }
    }

    async function seedInsumos() {
        try {
            const existing = await getAll('insumos');
            if (existing.length > 0) return;
            const productos = [
                { nombre: 'Jabon antiseptico', categoria: 'Higiene', unidad: 'Unidad', stock_actual: 0, stock_minimo: 10 },
                { nombre: 'Vitamina en polvo chispas', categoria: 'Nutricion', unidad: 'Sobre', stock_actual: 0, stock_minimo: 20 },
                { nombre: 'Suero rehidratante', categoria: 'Salud', unidad: 'Sobre', stock_actual: 0, stock_minimo: 15 },
                { nombre: 'Barras rojas', categoria: 'Alimentos', unidad: 'Unidad', stock_actual: 0, stock_minimo: 20 },
                { nombre: 'Barras amarillas', categoria: 'Alimentos', unidad: 'Unidad', stock_actual: 0, stock_minimo: 20 },
                { nombre: 'Barras moradas', categoria: 'Alimentos', unidad: 'Unidad', stock_actual: 0, stock_minimo: 20 },
                { nombre: 'Desparacitante', categoria: 'Salud', unidad: 'Tableta', stock_actual: 0, stock_minimo: 10 },
                { nombre: 'Vitamina en tabletas', categoria: 'Nutricion', unidad: 'Tableta', stock_actual: 0, stock_minimo: 30 },
                { nombre: 'Kit de parto', categoria: 'Kit', unidad: 'Kit', stock_actual: 0, stock_minimo: 5 },
                { nombre: 'Kit de higiene', categoria: 'Kit', unidad: 'Kit', stock_actual: 0, stock_minimo: 5 },
                { nombre: 'Filtro purificador', categoria: 'Agua', unidad: 'Unidad', stock_actual: 0, stock_minimo: 5 },
                { nombre: 'Kit de reemplazo', categoria: 'Kit', unidad: 'Kit', stock_actual: 0, stock_minimo: 5 },
                { nombre: 'Pastillas purificadoras de agua', categoria: 'Agua', unidad: 'Pastilla', stock_actual: 0, stock_minimo: 20 }
            ];
            for (const p of productos) { await add('insumos', p); }
        } catch (e) { console.error('Seed insumos error:', e); }
    }

    async function seedAdmin() {
        try {
            const usuarios = await getAll('usuarios');
            if (usuarios.length > 0) return;
            const hash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
            await add('usuarios', {
                nombre: 'Administrador',
                usuario: 'admin',
                identificacion: '',
                password: hash,
                rol: 'admin',
                activo: 1,
                ultima_sesion: null
            });
            console.log('Admin user seeded');
        } catch (e) { console.error('Seed admin error:', e); }
    }

    async function init() {
        await open();
        await seedInsumos();
        await seedAdmin();
    }

    return { init, open, add, put, get, getAll, getAllMulti, del, getByIndex, getByIndexMap, clear, log, now, today };
})();

const DB = (() => {
    const DB_NAME = 'saman_db';
    const DB_VERSION = 1;
    let _db = null;

    function open() {
        return new Promise((resolve, reject) => {
            if (_db) return resolve(_db);
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('usuarios')) {
                    db.createObjectStore('usuarios', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('pacientes')) {
                    db.createObjectStore('pacientes', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('metricas')) {
                    const store = db.createObjectStore('metricas', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('paciente_id', 'paciente_id', { unique: false });
                }
                if (!db.objectStoreNames.contains('visitas')) {
                    const store = db.createObjectStore('visitas', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('paciente_id', 'paciente_id', { unique: false });
                }
                if (!db.objectStoreNames.contains('insumos')) {
                    db.createObjectStore('insumos', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('entregas')) {
                    const store = db.createObjectStore('entregas', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('paciente_id', 'paciente_id', { unique: false });
                }
                if (!db.objectStoreNames.contains('beneficios_tengo')) {
                    const store = db.createObjectStore('beneficios_tengo', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('paciente_id', 'paciente_id', { unique: true });
                }
                if (!db.objectStoreNames.contains('ingresos_insumos')) {
                    db.createObjectStore('ingresos_insumos', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('logs')) {
                    db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
                }
            };
            req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    function now() {
        const d = new Date();
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    async function hashPw(pw) {
        if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        let hash = 0;
        for (let i = 0; i < pw.length; i++) {
            const chr = pw.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return 'fallback_' + Math.abs(hash).toString(16);
    }

    async function seedAdmin() {
        const db = await open();
        const tx = db.transaction('usuarios', 'readonly');
        const store = tx.objectStore('usuarios');
        const count = await new Promise(r => { const req = store.count(); req.onsuccess = () => r(req.result); });
        if (count > 0) return;

        const hashHex = await hashPw('admin');

        const tx2 = db.transaction('usuarios', 'readwrite');
        tx2.objectStore('usuarios').add({
            nombre: 'Administrador',
            usuario: 'admin',
            identificacion: 'admin',
            password: hashHex,
            rol: 'admin',
            activo: 1,
            ultima_sesion: now()
        });
        return new Promise(r => { tx2.oncomplete = r; });
    }

    function getAll(storeName) {
        return open().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }));
    }

    function getById(storeName, id) {
        return open().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }));
    }

    function add(storeName, data) {
        return open().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).add(data);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }));
    }

    function put(storeName, data) {
        return open().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).put(data);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }));
    }

    function remove(storeName, id) {
        return open().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        }));
    }

    function getByIndex(storeName, indexName, value) {
        return open().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const idx = tx.objectStore(storeName).index(indexName);
            const req = idx.getAll(value);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }));
    }

    function log(usuarioId, accion, detalle) {
        return add('logs', { usuario_id: usuarioId, accion, detalle, timestamp: now() });
    }

    function exportAll() {
        return open().then(async db => {
            const stores = ['usuarios', 'pacientes', 'metricas', 'visitas', 'insumos', 'entregas', 'beneficios_tengo', 'ingresos_insumos', 'logs'];
            const data = {};
            for (const s of stores) {
                data[s] = await getAll(s);
            }
            return data;
        });
    }

    function importAll(data) {
        return open().then(async db => {
            for (const [storeName, items] of Object.entries(data)) {
                if (!db.objectStoreNames.contains(storeName)) continue;
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                for (const item of items) {
                    store.put(item);
                }
                await new Promise(r => { tx.oncomplete = r; });
            }
        });
    }

    return { open, seedAdmin, getAll, getById, add, put, remove, getByIndex, log, exportAll, importAll, now };
})();

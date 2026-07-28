const Sync = (() => {
    const TABLES = ['usuarios', 'pacientes', 'metricas', 'visitas', 'insumos', 'entregas', 'beneficios_tengo', 'ingresos_insumos', 'logs'];
    let syncEnabled = false;
    let syncInterval = null;
    let lastSyncTime = 0;
    let _lastDataSig = {};

    async function _dataSigChanged() {
        for (const t of TABLES) {
            const all = await DB.getAll(t);
            const count = all.length;
            const maxTs = all.reduce((m, r) => Math.max(m, r._modified || 0), 0);
            const key = t + '_c';
            const tsKey = t + '_t';
            if (count !== (_lastDataSig[key] || 0) || maxTs !== (_lastDataSig[tsKey] || 0)) {
                _lastDataSig[key] = count;
                _lastDataSig[tsKey] = maxTs;
                return true;
            }
        }
        return false;
    }

    function isAndroid() {
        return typeof window.SyncBridge !== 'undefined' && window.SyncBridge.getSyncDirPath;
    }

    function getDeviceId() {
        let id = localStorage.getItem('saman_device_id');
        if (!id) {
            id = 'SAMAN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            localStorage.setItem('saman_device_id', id);
        }
        return id;
    }

    function myFileName() {
        return getDeviceId() + '.json';
    }

    async function exportMyData() {
        const data = { _version: '2.0', _device: getDeviceId(), _exported: DB.now(), _timestamp: Date.now() };
        for (const t of TABLES) data[t] = await DB.getAll(t);
        return JSON.stringify(data);
    }

    async function writeMyFile() {
        if (!isAndroid()) return false;
        try {
            if (!(await _dataSigChanged())) return true;
            const json = await exportMyData();
            return window.SyncBridge.writeSyncFile(myFileName(), json);
        } catch (e) {
            console.error('Sync write error:', e);
            return false;
        }
    }

    function readDeviceFile(filename) {
        try {
            const json = window.SyncBridge.readSyncFile(filename);
            if (!json || json.length < 10) return null;
            return JSON.parse(json);
        } catch (e) {
            console.error('Sync read error:', filename, e);
            return null;
        }
    }

    async function mergeFromDevice(deviceData) {
        if (!deviceData || !deviceData._timestamp) return 0;
        let merged = 0;
        for (const t of TABLES) {
            if (!deviceData[t] || !Array.isArray(deviceData[t])) continue;
            for (const record of deviceData[t]) {
                if (record.id === undefined || record.id === null) continue;
                const existing = await DB.get(t, record.id);
                if (!existing) {
                    await DB.add(t, record);
                    merged++;
                } else {
                    const existMod = existing._modified || 0;
                    const remoteMod = record._modified || 0;
                    if (remoteMod > existMod) {
                        await DB.put(t, record);
                        merged++;
                    }
                }
            }
        }
        return merged;
    }

    async function syncNow() {
        if (!isAndroid()) return { ok: false, msg: 'Sync no disponible', imported: 0 };

        try {
            const filesJson = window.SyncBridge.listSyncFiles();
            const files = JSON.parse(filesJson);
            let totalMerged = 0;
            let devicesRead = 0;

            for (const filename of files) {
                if (filename === myFileName()) continue;
                const deviceData = readDeviceFile(filename);
                if (deviceData) {
                    const merged = await mergeFromDevice(deviceData);
                    totalMerged += merged;
                    devicesRead++;
                }
            }

            await writeMyFile();
            lastSyncTime = Date.now();

            return {
                ok: true,
                imported: totalMerged,
                devices: devicesRead,
                msg: totalMerged > 0
                    ? `${totalMerged} registros de ${devicesRead} dispositivo(s)`
                    : `Conectado con ${devicesRead} dispositivo(s) - sin cambios`
            };
        } catch (e) {
            return { ok: false, msg: e.message, imported: 0 };
        }
    }

    async function importFromFiles() {
        if (!isAndroid()) return false;
        try {
            const filesJson = window.SyncBridge.listSyncFiles();
            const files = JSON.parse(filesJson);
            let totalMerged = 0;
            for (const filename of files) {
                if (filename === myFileName()) continue;
                const deviceData = readDeviceFile(filename);
                if (deviceData && deviceData._timestamp > lastSyncTime) {
                    totalMerged += await mergeFromDevice(deviceData);
                }
            }
            return totalMerged > 0;
        } catch (e) {
            return false;
        }
    }

    function startAutoSync(intervalMs = 30000) {
        if (!isAndroid()) return;
        syncEnabled = true;
        if (syncInterval) clearInterval(syncInterval);
        syncInterval = setInterval(async () => {
            if (syncEnabled) {
                try {
                    await importFromFiles();
                    await writeMyFile();
                } catch (e) {
                    console.error('Auto-sync error:', e);
                }
            }
        }, intervalMs);
    }

    function stopAutoSync() {
        syncEnabled = false;
        if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
    }

    function getSyncPath() {
        if (!isAndroid()) return 'No disponible';
        return window.SyncBridge.getSyncDirPath();
    }

    function getStatus() {
        if (!isAndroid()) return 'Desktop';
        const filesJson = window.SyncBridge.listSyncFiles();
        try {
            const files = JSON.parse(filesJson);
            const others = files.filter(f => f !== myFileName());
            return others.length > 0 ? `${others.length} dispositivo(s) vinculado(s)` : 'Sin dispositivos vinculados';
        } catch { return 'Error leyendo dispositivos'; }
    }

    return { init: syncNow, syncNow, startAutoSync, stopAutoSync, getSyncPath, getStatus, isAndroid, writeMyFile, getDeviceId, TABLES };
})();

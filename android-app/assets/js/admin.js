const Admin = (() => {
    async function getLogs(filtroUsuario, filtroAccion) {
        const data = await DB.getAllMulti(['logs', 'usuarios']);
        let logs = data.logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 200);
        if (filtroUsuario) logs = logs.filter(l => l.usuario_id === parseInt(filtroUsuario));
        if (filtroAccion) logs = logs.filter(l => l.accion === filtroAccion);
        const usuariosMap = new Map(data.usuarios.map(u => [u.id, u]));
        return logs.map(l => {
            const user = usuariosMap.get(l.usuario_id);
            return { ...l, usuario_nombre: user ? user.nombre : 'Sistema' };
        });
    }

    async function getAcciones() {
        const logs = await DB.getAll('logs');
        const set = new Set();
        for (const l of logs) set.add(l.accion);
        return [...set].sort();
    }

    async function getUsuarios() {
        const data = await DB.getAllMulti(['usuarios', 'logs']);
        const logsByUser = new Map();
        for (const l of data.logs) {
            const arr = logsByUser.get(l.usuario_id);
            if (arr) arr.push(l); else logsByUser.set(l.usuario_id, [l]);
        }
        return data.usuarios.map(u => {
            const userLogs = logsByUser.get(u.id) || [];
            let lastTs = '';
            for (const l of userLogs) {
                if ((l.timestamp || '') > lastTs) lastTs = l.timestamp;
            }
            return { ...u, ultimo_log: lastTs || null };
        });
    }

    return { getLogs, getAcciones, getUsuarios };
})();

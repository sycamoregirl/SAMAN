const Pacientes = (() => {
    async function lista(query) {
        let pacientes = await DB.getAll('pacientes');
        const todasVisitas = await DB.getAll('visitas');
        const todosTengo = await DB.getAll('beneficios_tengo');

        if (query) {
            const q = query.toLowerCase();
            pacientes = pacientes.filter(p => (`${p.nombre} ${p.apellido}`).toLowerCase().includes(q));
        }

        pacientes.sort((a, b) => (a.apellido || '').localeCompare(b.apellido || ''));

        return pacientes.map(p => {
            const vis = todasVisitas.filter(v => v.paciente_id === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
            const tengo = todosTengo.find(t => t.paciente_id === p.id);
            const edad = Nutricion.getEdad(p.fecha_nac);
            return {
                ...p,
                categoria: Nutricion.clasificarPaciente(edad, p.embarazada, p.lactante),
                ultima_visita: vis.length ? vis[0].fecha : null,
                tengo_activo: tengo && tengo.activa === 1
            };
        });
    }

    async function perfil(id) {
        const p = await DB.getById('pacientes', id);
        if (!p) return null;
        const todasVisitas = await DB.getAll('visitas');
        const todasMetricas = await DB.getAll('metricas');
        const todasEntregas = await DB.getAll('entregas');
        const todosTengo = await DB.getAll('beneficios_tengo');
        const todosInsumos = await DB.getAll('insumos');
        const todosUsuarios = await DB.getAll('usuarios');

        const visitas = todasVisitas.filter(v => v.paciente_id === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
        const metricas = todasMetricas.filter(m => m.paciente_id === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
        const entregas = todasEntregas.filter(e => e.paciente_id === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
        const tengo = todosTengo.find(t => t.paciente_id === id);

        const edad = Nutricion.getEdad(p.fecha_nac);
        const categoria = Nutricion.clasificarPaciente(edad, p.embarazada, p.lactante);

        let alertaMonitoreo = null;
        if (p.activo && metricas.length > 0) {
            const primeraMetrica = metricas[metricas.length - 1];
            const mesesDesdePrimera = (Date.now() - new Date(primeraMetrica.fecha).getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (mesesDesdePrimera >= 2) {
                alertaMonitoreo = 'Han pasado 2+ meses desde la primera atencion';
            }
        }

        const enrichVisitas = visitas.map(v => {
            const user = todosUsuarios.find(u => u.id === v.usuario_id);
            return { ...v, usuario_nombre: user ? user.nombre : '' };
        });

        const enrichMetricas = metricas.map(m => {
            const user = todosUsuarios.find(u => u.id === m.usuario_id);
            const [zlabel, zclass] = Nutricion.interpretarZScore(m.z_score);
            return { ...m, usuario_nombre: user ? user.nombre : '', zlabel, zclass };
        });

        const enrichEntregas = entregas.map(e => {
            const insumo = todosInsumos.find(i => i.id === e.insumo_id);
            const user = todosUsuarios.find(u => u.id === e.usuario_id);
            return { ...e, insumo_nombre: insumo ? insumo.nombre : 'N/A', unidad: insumo ? insumo.unidad : '', usuario_nombre: user ? user.nombre : '' };
        });

        return {
            paciente: p, edad, categoria, visitas: enrichVisitas, metricas: enrichMetricas,
            entregas: enrichEntregas, tengo, alertaMonitoreo
        };
    }

    async function crear(data) {
        data.creado_en = DB.now();
        data.activo = 1;
        return DB.add('pacientes', data);
    }

    async function actualizar(data) {
        return DB.put('pacientes', data);
    }

    async function eliminar(id) {
        await DB.remove('pacientes', id);
    }

    return { lista, perfil, crear, actualizar, eliminar };
})();

const Inventario = (() => {
    async function listar() {
        const data = await DB.getAllMulti(['insumos', 'ingresos_insumos', 'entregas', 'usuarios', 'pacientes']);

        const enrichInsumos = data.insumos.map(i => {
            let status = 'OK';
            if (i.stock_actual < i.stock_minimo) status = 'Critico';
            else if (i.stock_actual < i.stock_minimo * 2) status = 'Bajo';
            return { ...i, status };
        }).sort((a, b) => {
            const order = { Critico: 0, Bajo: 1, OK: 2 };
            return (order[a.status] || 2) - (order[b.status] || 2);
        });

        const insumosMap = new Map(data.insumos.map(i => [i.id, i]));
        const usuariosMap = new Map(data.usuarios.map(u => [u.id, u]));
        const pacientesMap = new Map(data.pacientes.map(p => [p.id, p]));

        const ultimosIngresos = data.ingresos_insumos.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 20).map(ing => {
            const ins = insumosMap.get(ing.insumo_id);
            const user = usuariosMap.get(ing.usuario_id);
            return { ...ing, insumo_nombre: ins ? ins.nombre : '(eliminado)', insumo_unidad: ins ? ins.unidad : '', usuario_nombre: user ? user.nombre : 'Sistema' };
        });

        const ultimasEntregas = data.entregas.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 20).map(ent => {
            const ins = insumosMap.get(ent.insumo_id);
            const pac = pacientesMap.get(ent.paciente_id);
            const user = usuariosMap.get(ent.usuario_id);
            return { ...ent, insumo_nombre: ins ? ins.nombre : '(eliminado)', insumo_unidad: ins ? ins.unidad : '', paciente_nombre: pac ? `${pac.nombre} ${pac.apellido}` : '(eliminado)', usuario_nombre: user ? user.nombre : 'Sistema' };
        });

        return { insumos: enrichInsumos, ingresos: ultimosIngresos, entregas: ultimasEntregas };
    }

    async function nuevoInsumo(data) {
        const id = await DB.add('insumos', {
            nombre: data.nombre,
            categoria: data.categoria || '',
            unidad: data.unidad,
            stock_actual: parseFloat(data.stock_actual) || 0,
            stock_minimo: parseFloat(data.stock_minimo) || 0
        });
        await DB.log(Auth.getUser().id, 'Nuevo insumo', data.nombre);
        return id;
    }

    async function registrarLlegada(data) {
        const id = await DB.add('ingresos_insumos', {
            insumo_id: data.insumo_id,
            cantidad: parseFloat(data.cantidad),
            fecha: data.fecha || DB.today(),
            usuario_id: Auth.getUser() ? Auth.getUser().id : null,
            notas: data.notas || ''
        });
        const ins = await DB.get('insumos', data.insumo_id);
        if (ins) { ins.stock_actual += parseFloat(data.cantidad); await DB.put('insumos', ins); }
        await DB.log(Auth.getUser().id, 'Llegada insumo', `${ins ? ins.nombre : ''} +${data.cantidad}`);
        return id;
    }

    async function eliminarInsumo(id) {
        const ins = await DB.get('insumos', id);
        if (!ins) return false;
        const [entregas, ingresos] = await Promise.all([
            DB.getByIndex('entregas', 'insumo_id', id),
            DB.getByIndex('ingresos_insumos', 'insumo_id', id)
        ]);
        for (const e of entregas) {
            e.insumo_id = null; await DB.put('entregas', e);
        }
        for (const i of ingresos) {
            i.insumo_id = null; await DB.put('ingresos_insumos', i);
        }
        await DB.del('insumos', id);
        await DB.log(Auth.getUser().id, 'Eliminar insumo', ins.nombre);
        return true;
    }

    return { listar, nuevoInsumo, registrarLlegada, eliminarInsumo };
})();

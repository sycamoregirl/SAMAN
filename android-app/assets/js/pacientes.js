const Pacientes = (() => {
    async function listar(q = '') {
        const data = await DB.getAllMulti(['pacientes', 'visitas', 'metricas', 'entregas', 'beneficios_tengo']);
        let pacientes = data.pacientes;

        if (q) {
            const ql = q.toLowerCase();
            pacientes = pacientes.filter(p =>
                (`${p.nombre} ${p.apellido}`.toLowerCase().includes(ql)) ||
                (p.cedula || '').toLowerCase().includes(ql)
            );
        }

        const visitasMap = new Map();
        for (const v of data.visitas) {
            const arr = visitasMap.get(v.paciente_id);
            if (arr) arr.push(v); else visitasMap.set(v.paciente_id, [v]);
        }
        const metricasMap = new Map();
        for (const m of data.metricas) {
            const arr = metricasMap.get(m.paciente_id);
            if (arr) arr.push(m); else metricasMap.set(m.paciente_id, [m]);
        }
        const tengoMap = new Map();
        for (const t of data.beneficios_tengo) {
            tengoMap.set(t.paciente_id, t);
        }

        return pacientes.map(p => {
            const edad = Nutricion.getEdad(p.fecha_nac);
            const cat = Nutricion.clasificarPaciente(edad, p.embarazada, p.lactante);

            const pVisitas = visitasMap.get(p.id) || [];
            let ultimaVisita = null;
            for (const v of pVisitas) {
                if (!ultimaVisita || v.fecha > ultimaVisita.fecha) ultimaVisita = v;
            }

            const tengoActivo = tengoMap.get(p.id);

            const pMetricas = metricasMap.get(p.id) || [];
            let ultimaMetrica = null;
            for (const m of pMetricas) {
                if (!ultimaMetrica || m.fecha > ultimaMetrica.fecha) ultimaMetrica = m;
            }

            return {
                ...p,
                edad, categoria: cat,
                ultima_visita: ultimaVisita ? ultimaVisita.fecha : null,
                tengo_activo: !!tengoActivo && tengoActivo.activa === 1,
                ultima_desnutricion: ultimaMetrica ? ultimaMetrica.nivel_desnutricion : null,
                ultima_zscore: ultimaMetrica ? ultimaMetrica.z_score : null
            };
        }).sort((a, b) => (a.apellido + a.nombre).localeCompare(b.apellido + b.nombre));
    }

    async function nuevo(data) {
        const id = await DB.add('pacientes', {
            nombre: data.nombre,
            apellido: data.apellido,
            fecha_nac: data.fecha_nac,
            sexo: data.sexo || '',
            direccion: data.direccion || '',
            cedula: data.cedula || '',
            telefono: data.telefono || '',
            embarazada: data.embarazada ? 1 : 0,
            lactante: data.lactante ? 1 : 0,
            cuidador_nombre: data.cuidador_nombre || '',
            cuidador_apellido: data.cuidador_apellido || '',
            cuidador_cedula: data.cuidador_cedula || '',
            cuidador_telefono: data.cuidador_telefono || '',
            activo: 1,
            creado_por: Auth.getUser() ? Auth.getUser().id : null,
            creado_en: DB.now()
        });
        if (data.peso && data.talla) {
            await crearMetrica(id, data);
        }
        if (data.tengo_fecha_inicio) {
            await DB.add('beneficios_tengo', {
                paciente_id: id,
                fecha_inicio: data.tengo_fecha_inicio,
                activa: 1,
                fecha_fin: null
            });
        }
        await DB.log(Auth.getUser().id, 'Nuevo paciente', `${data.nombre} ${data.apellido}`);
        return id;
    }

    async function obtener(id) {
        const p = await DB.get('pacientes', id);
        if (!p) return null;
        const edad = Nutricion.getEdad(p.fecha_nac);
        const edadMeses = Nutricion.getEdadMeses(p.fecha_nac);
        const cat = Nutricion.clasificarPaciente(edad, p.embarazada, p.lactante);

        const [visitas, metricas, entregas, tengoArr, usuarios, insumos] = await Promise.all([
            DB.getByIndex('visitas', 'paciente_id', id),
            DB.getByIndex('metricas', 'paciente_id', id),
            DB.getByIndex('entregas', 'paciente_id', id),
            DB.getByIndex('beneficios_tengo', 'paciente_id', id),
            DB.getAll('usuarios'),
            DB.getAll('insumos')
        ]);

        visitas.sort((a, b) => b.fecha.localeCompare(a.fecha));
        metricas.sort((a, b) => b.fecha.localeCompare(a.fecha));
        entregas.sort((a, b) => b.fecha.localeCompare(a.fecha));

        const usuariosMap = new Map(usuarios.map(u => [u.id, u]));
        const insumosMap = new Map(insumos.map(i => [i.id, i]));
        const tengo = tengoArr.find(t => t.activa === 1) || null;

        const enrich = (arr) => arr.map(item => {
            const user = usuariosMap.get(item.usuario_id);
            return { ...item, usuario_nombre: user ? user.nombre : 'Sistema' };
        });

        let primeraVisita = null;
        let mesesDesdePrimera = 0;
        let alertaMonitoreo = false;
        if (visitas.length > 0) {
            primeraVisita = visitas[visitas.length - 1];
            const d1 = new Date(primeraVisita.fecha);
            const hoy = new Date();
            mesesDesdePrimera = (hoy.getFullYear() - d1.getFullYear()) * 12 + (hoy.getMonth() - d1.getMonth());
            if (mesesDesdePrimera >= 2) alertaMonitoreo = true;
        }

        const enrichMetricas = enrich(metricas).map(m => {
            const [label, cls] = Nutricion.interpretarZScore(m.z_score);
            return { ...m, z_label: label, z_class: cls };
        });

        const enrichEntregas = enrich(entregas).map(e => {
            const ins = insumosMap.get(e.insumo_id);
            return { ...e, insumo_nombre: ins ? ins.nombre : '(eliminado)', insumo_unidad: ins ? ins.unidad : '' };
        });

        return {
            ...p, edad, edadMeses, categoria: cat,
            visitas: enrich(visitas),
            metricas: enrichMetricas,
            entregas: enrichEntregas,
            tengo: tengo || null,
            alertaMonitoreo, mesesDesdePrimera
        };
    }

    async function editar(id, data) {
        const p = await DB.get('pacientes', id);
        if (!p) return false;
        Object.assign(p, {
            nombre: data.nombre, apellido: data.apellido,
            fecha_nac: data.fecha_nac, sexo: data.sexo || '',
            direccion: data.direccion || '', cedula: data.cedula || '',
            telefono: data.telefono || '',
            embarazada: data.embarazada ? 1 : 0,
            lactante: data.lactante ? 1 : 0,
            cuidador_nombre: data.cuidador_nombre || '',
            cuidador_apellido: data.cuidador_apellido || '',
            cuidador_cedula: data.cuidador_cedula || '',
            cuidador_telefono: data.cuidador_telefono || ''
        });
        await DB.put('pacientes', p);
        const tengoArr = await DB.getByIndex('beneficios_tengo', 'paciente_id', id);
        const tengo = tengoArr[0] || null;
        if (data.tengo_activa) {
            if (tengo) {
                tengo.activa = 1;
                tengo.fecha_fin = data.tengo_fecha_fin || null;
                await DB.put('beneficios_tengo', tengo);
            } else if (data.tengo_fecha_inicio) {
                await DB.add('beneficios_tengo', {
                    paciente_id: id, fecha_inicio: data.tengo_fecha_inicio,
                    activa: 1, fecha_fin: data.tengo_fecha_fin || null
                });
            }
        } else if (tengo) {
            tengo.activa = 0;
            tengo.fecha_fin = DB.today();
            await DB.put('beneficios_tengo', tengo);
        }
        await DB.log(Auth.getUser().id, 'Editar paciente', `${p.nombre} ${p.apellido}`);
        return true;
    }

    async function darBaja(id) {
        const p = await DB.get('pacientes', id);
        if (!p) return false;
        p.activo = 0;
        await DB.put('pacientes', p);
        await DB.log(Auth.getUser().id, 'Dar baja', `${p.nombre} ${p.apellido}`);
        return true;
    }

    async function reactivar(id) {
        const p = await DB.get('pacientes', id);
        if (!p) return false;
        p.activo = 1;
        await DB.put('pacientes', p);
        await DB.log(Auth.getUser().id, 'Reactivar', `${p.nombre} ${p.apellido}`);
        return true;
    }

    async function eliminar(id) {
        const p = await DB.get('pacientes', id);
        if (!p) return false;
        const [entregasAll, metricasAll, visitasAll, tengoAll] = await Promise.all([
            DB.getByIndex('entregas', 'paciente_id', id),
            DB.getByIndex('metricas', 'paciente_id', id),
            DB.getByIndex('visitas', 'paciente_id', id),
            DB.getByIndex('beneficios_tengo', 'paciente_id', id)
        ]);
        const insumosCache = new Map();
        for (const e of entregasAll) {
            let ins = insumosCache.get(e.insumo_id);
            if (ins === undefined) {
                ins = await DB.get('insumos', e.insumo_id);
                insumosCache.set(e.insumo_id, ins);
            }
            if (ins) { ins.stock_actual += e.cantidad; await DB.put('insumos', ins); }
            await DB.del('entregas', e.id);
        }
        for (const m of metricasAll) await DB.del('metricas', m.id);
        for (const v of visitasAll) await DB.del('visitas', v.id);
        for (const t of tengoAll) await DB.del('beneficios_tengo', t.id);
        await DB.del('pacientes', id);
        await DB.log(Auth.getUser().id, 'Eliminar paciente', `${p.nombre} ${p.apellido}`);
        return true;
    }

    async function crearMetrica(pacienteId, data) {
        const p = await DB.get('pacientes', pacienteId);
        if (!p) return null;
        const talla = parseFloat(data.talla);
        const peso = parseFloat(data.peso);
        const perimetro = data.perimetro ? parseFloat(data.perimetro) : null;
        const imc = talla > 0 ? Math.round(peso / Math.pow(talla / 100, 2) * 10) / 10 : 0;
        const edadMeses = Nutricion.getEdadMeses(p.fecha_nac);
        const z = Nutricion.calcularZScore(peso, talla, edadMeses, p.sexo);
        const nivel = Nutricion.clasificarDesnutricion(peso, talla, perimetro, z);
        return await DB.add('metricas', {
            paciente_id: pacienteId,
            fecha: data.fecha || DB.today(),
            peso, talla, imc, perimetro_brazo: perimetro,
            nivel_desnutricion: nivel, z_score: z,
            notas: data.notas || '',
            usuario_id: Auth.getUser() ? Auth.getUser().id : null
        });
    }

    async function editarMetrica(id, data) {
        const m = await DB.get('metricas', id);
        if (!m) return false;
        const p = await DB.get('pacientes', m.paciente_id);
        if (!p) return false;
        const talla = parseFloat(data.talla);
        const peso = parseFloat(data.peso);
        const perimetro = data.perimetro ? parseFloat(data.perimetro) : null;
        const imc = talla > 0 ? Math.round(peso / Math.pow(talla / 100, 2) * 10) / 10 : 0;
        const edadMeses = Nutricion.getEdadMeses(p.fecha_nac);
        const z = Nutricion.calcularZScore(peso, talla, edadMeses, p.sexo);
        const nivel = Nutricion.clasificarDesnutricion(peso, talla, perimetro, z);
        Object.assign(m, {
            fecha: data.fecha, peso, talla, imc,
            perimetro_brazo: perimetro, nivel_desnutricion: nivel, z_score: z
        });
        await DB.put('metricas', m);
        await DB.log(Auth.getUser().id, 'Editar metrica', `Metrica #${id}`);
        return true;
    }

    async function crearVisita(pacienteId, data) {
        const id = await DB.add('visitas', {
            paciente_id: pacienteId,
            fecha: data.fecha || DB.today(),
            tipo: data.tipo || 'jornada',
            observaciones: data.observaciones || '',
            usuario_id: Auth.getUser() ? Auth.getUser().id : null
        });
        if (data.peso && data.talla) {
            await crearMetrica(pacienteId, { ...data, fecha: data.fecha });
        }
        if (data.entregas && data.entregas.length > 0) {
            for (const ent of data.entregas) {
                if (ent.insumo_id && ent.cantidad > 0) {
                    await DB.add('entregas', {
                        paciente_id: pacienteId, insumo_id: ent.insumo_id,
                        cantidad: ent.cantidad, fecha: data.fecha || DB.today(),
                        visita_id: id,
                        usuario_id: Auth.getUser() ? Auth.getUser().id : null
                    });
                    const ins = await DB.get('insumos', ent.insumo_id);
                    if (ins) { ins.stock_actual = Math.max(0, ins.stock_actual - ent.cantidad); await DB.put('insumos', ins); }
                }
            }
        }
        await DB.log(Auth.getUser().id, 'Nueva visita', `Paciente #${pacienteId} - ${data.tipo}`);
        return id;
    }

    async function continuarAtencion(pacienteId) {
        return crearVisita(pacienteId, {
            fecha: DB.today(), tipo: 'monitoreo',
            observaciones: 'Continuacion de atencion'
        });
    }

    async function crearEntrega(pacienteId, data) {
        if (!data.entregas || data.entregas.length === 0) return null;
        const ids = [];
        for (const ent of data.entregas) {
            if (ent.insumo_id && ent.cantidad > 0) {
                const id = await DB.add('entregas', {
                    paciente_id: pacienteId, insumo_id: ent.insumo_id,
                    cantidad: ent.cantidad, fecha: data.fecha || DB.today(),
                    visita_id: null,
                    usuario_id: Auth.getUser() ? Auth.getUser().id : null
                });
                ids.push(id);
                const ins = await DB.get('insumos', ent.insumo_id);
                if (ins) { ins.stock_actual = Math.max(0, ins.stock_actual - ent.cantidad); await DB.put('insumos', ins); }
            }
        }
        await DB.log(Auth.getUser().id, 'Nueva entrega', `Paciente #${pacienteId}, ${ids.length} items`);
        return ids;
    }

    async function editarEntrega(id, data) {
        const e = await DB.get('entregas', id);
        if (!e) return false;
        const insViejo = await DB.get('insumos', e.insumo_id);
        if (insViejo) { insViejo.stock_actual += e.cantidad; await DB.put('insumos', insViejo); }
        e.insumo_id = data.insumo_id;
        e.cantidad = parseFloat(data.cantidad);
        e.fecha = data.fecha;
        await DB.put('entregas', e);
        const insNuevo = await DB.get('insumos', data.insumo_id);
        if (insNuevo) { insNuevo.stock_actual = Math.max(0, insNuevo.stock_actual - e.cantidad); await DB.put('insumos', insNuevo); }
        await DB.log(Auth.getUser().id, 'Editar entrega', `Entrega #${id}`);
        return true;
    }

    return { listar, nuevo, obtener, editar, darBaja, reactivar, eliminar, crearMetrica, editarMetrica, crearVisita, continuarAtencion, crearEntrega, editarEntrega };
})();

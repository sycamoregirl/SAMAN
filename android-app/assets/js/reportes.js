const Reportes = (() => {
    async function generar(params) {
        const desde = params.desde || '';
        const hasta = params.hasta || '';
        const data = await DB.getAllMulti(['pacientes', 'metricas', 'visitas', 'entregas', 'insumos', 'beneficios_tengo']);

        let visitasFiltradas = data.visitas;
        if (desde) visitasFiltradas = visitasFiltradas.filter(v => v.fecha >= desde);
        if (hasta) visitasFiltradas = visitasFiltradas.filter(v => v.fecha <= hasta + 'T23:59:59');

        let entregasFiltradas = data.entregas;
        if (desde) entregasFiltradas = entregasFiltradas.filter(e => e.fecha >= desde);
        if (hasta) entregasFiltradas = entregasFiltradas.filter(e => e.fecha <= hasta + 'T23:59:59');

        const pacIdsVisitados = new Set(visitasFiltradas.map(v => v.paciente_id));

        const categorias = { Lactante: 0, Nino: 0, Adulto: 0, Embarazada: 0 };
        const desnutricion = { Normal: 0, Leve: 0, Moderada: 0, Severa: 0 };
        let tengoCount = 0;
        let activosCount = 0;

        const metricasMap = new Map();
        for (const m of data.metricas) {
            const arr = metricasMap.get(m.paciente_id);
            if (arr) arr.push(m); else metricasMap.set(m.paciente_id, [m]);
        }
        const tengoMap = new Map();
        for (const t of data.beneficios_tengo) {
            if (t.activa === 1) tengoMap.set(t.paciente_id, t);
        }
        const insumosMap = new Map(data.insumos.map(i => [i.id, i]));
        const visitasPacMap = new Map();
        for (const v of visitasFiltradas) {
            const arr = visitasPacMap.get(v.paciente_id);
            if (arr) arr.push(v); else visitasPacMap.set(v.paciente_id, [v]);
        }
        const entregasPacMap = new Map();
        for (const e of entregasFiltradas) {
            const arr = entregasPacMap.get(e.paciente_id);
            if (arr) arr.push(e); else entregasPacMap.set(e.paciente_id, [e]);
        }

        const pacienteDetalles = data.pacientes.map(p => {
            const edad = Nutricion.getEdad(p.fecha_nac);
            const cat = Nutricion.clasificarPaciente(edad, p.embarazada, p.lactante);
            categorias[cat] = (categorias[cat] || 0) + 1;
            if (p.activo) activosCount++;
            if (tengoMap.has(p.id)) tengoCount++;

            const metPaciente = metricasMap.get(p.id) || [];
            let ultimaMet = null;
            for (const m of metPaciente) {
                if (!ultimaMet || m.fecha > ultimaMet.fecha) ultimaMet = m;
            }

            const entregasPaciente = entregasPacMap.get(p.id) || [];
            if (ultD !== 'Sin datos') desnutricion[ultD] = (desnutricion[ultD] || 0) + 1;
            const insumosEntregados = {};
            entregasPaciente.forEach(e => {
                const ins = insumosMap.get(e.insumo_id);
                const nombre = ins ? ins.nombre : '(eliminado)';
                insumosEntregados[nombre] = (insumosEntregados[nombre] || 0) + e.cantidad;
            });
            const desnutFromZ = (z) => {
                if (z === null || z === undefined || !isFinite(z)) return null;
                if (z >= 0) return 'Normal';
                if (z < -3) return 'Severa';
                if (z < -2) return 'Moderada';
                return 'Leve';
            };
            const ultZ = ultimaMet ? ultimaMet.z_score : null;
            const ultD = desnutFromZ(ultZ) || (ultimaMet ? ultimaMet.nivel_desnutricion : null) || 'Sin datos';
            return {
                ...p, edad, categoria: cat,
                tiene_tengo: tengoMap.has(p.id),
                ultima_desnutricion: ultD,
                ultima_zscore: ultZ,
                visitas_periodo: (visitasPacMap.get(p.id) || []).length,
                insumos_entregados: insumosEntregados
            };
        }).filter(p => !desde && !hasta ? true : (
            visitasPacMap.has(p.id) ||
            entregasPacMap.has(p.id) ||
            p.activo
        ));

        const insumosCriticos = data.insumos.filter(i => i.stock_actual < i.stock_minimo);
        const entregasPorInsumo = {};
        entregasFiltradas.forEach(e => {
            const ins = insumosMap.get(e.insumo_id);
            const nombre = ins ? ins.nombre : '(eliminado)';
            entregasPorInsumo[nombre] = (entregasPorInsumo[nombre] || 0) + e.cantidad;
        });

        return {
            periodo: { desde: desde || 'Inicio', hasta: hasta || 'Hoy' },
            total_pacientes: data.pacientes.length,
            pacientes_activos: activosCount,
            pacientes_atendidos: pacIdsVisitados.size,
            categorias, desnutricion,
            total_visitas: visitasFiltradas.length,
            total_entregas: entregasFiltradas.length,
            entregas_por_insumo: entregasPorInsumo,
            insumos_criticos: insumosCriticos,
            tengo_beneficiarios: tengoCount,
            pacientes: pacienteDetalles
        };
    }

    function _csv(val) {
        const s = String(val ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    function _buildCSV(reporte) {
        const cols = ['Nombre','Apellido','Categoria','Edad','Sexo','Cedula','Telefono','Direccion',
            'Desnutricion','Z-Score','Tengo','Activo','Visitas periodo','Insumos recibidos'];
        let csv = cols.join(',') + '\n';
        reporte.pacientes.forEach(p => {
            const insumos = Object.entries(p.insumos_entregados || {})
                .map(([k, v]) => `${k}:${v}`).join('; ');
            csv += [
                p.nombre, p.apellido, p.categoria, p.edad, p.sexo, p.cedula,
                p.telefono, p.direccion, p.ultima_desnutricion, p.ultima_zscore,
                p.tiene_tengo ? 'Si' : 'No', p.activo ? 'Si' : 'No',
                p.visitas_periodo, insumos
            ].map(_csv).join(',') + '\n';
        });

        csv += '\nRESUMEN\n';
        csv += `Total pacientes,${reporte.total_pacientes}\n`;
        csv += `Pacientes activos,${reporte.pacientes_activos}\n`;
        csv += `Pacientes atendidos periodo,${reporte.pacientes_atendidos}\n`;
        csv += `Total visitas periodo,${reporte.total_visitas}\n`;
        csv += `Beneficiarios Tengo,${reporte.tengo_beneficiarios}\n`;
        csv += '\nCATEGORIAS\n';
        Object.entries(reporte.categorias).forEach(([k, v]) => { csv += `${k},${v}\n`; });
        csv += '\nDESNUTRICION\n';
        Object.entries(reporte.desnutricion).forEach(([k, v]) => { csv += `${k},${v}\n`; });
        csv += '\nINSUMOS ENTREGADOS\n';
        Object.entries(reporte.entregas_por_insumo).forEach(([k, v]) => { csv += `${k},${v}\n`; });

        return '\uFEFF' + csv;
    }

    function _isAndroid() {
        return typeof window.SyncBridge !== 'undefined';
    }

    function exportarCSV(reporte) {
        const csv = _buildCSV(reporte);
        const filename = `SAMAN_Reporte_${DB.today()}.csv`;

        if (_isAndroid()) {
            try {
                const path = window.SyncBridge.writeDownloadsFile(filename, csv);
                if (path) {
                    alert('CSV exportado a Descargas: ' + path);
                } else {
                    alert('Error al exportar CSV: no se pudo escribir el archivo', 'danger');
                }
            } catch (e) {
                alert('Error al exportar CSV: ' + e.message, 'danger');
            }
        } else {
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    return { generar, exportarCSV };
})();

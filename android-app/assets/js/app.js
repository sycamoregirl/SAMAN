const App = (() => {
    let currentPage = 'login';
    let pageHistory = [];
    let _pacSearchTimer = null;
    let _bdSearchTimer = null;
    let _pacPage = 0;
    const _pacPageSize = 50;
    let _pacAllResults = [];

    function show(page) { document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); const el = document.getElementById('page-' + page); if (el) el.classList.add('active'); currentPage = page; }
    function $(id) { return document.getElementById(id); }

    function navigate(page, pushHistory = true) {
        if (pushHistory && currentPage !== page) pageHistory.push(currentPage);
        show(page);
        if (['menu', 'pacientes', 'inventario', 'reportes', 'admin'].includes(page)) {
            $('app-nav').style.display = 'flex';
        }
        if (page === 'menu') renderMenu();
        else if (page === 'pacientes') renderPacientes();
        else if (page === 'inventario') renderInventario();
        else if (page === 'reportes') renderReportes();
        else if (page === 'admin') renderAdmin();
        else if (page === 'sync') renderSync();
        else if (page === 'bd') renderBD();
        window.scrollTo(0, 0);
    }

    function back() {
        if (pageHistory.length > 0) { navigate(pageHistory.pop(), false); }
        else { navigate('menu', false); }
    }

    function alert(msg, type = 'info') {
        const div = document.createElement('div');
        div.className = 'alert-app alert-' + type;
        div.textContent = msg;
        div.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;z-index:9999;text-align:center;';
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    function badge(value, cls) { return `<span class="badge-app ${cls}">${value}</span>`; }

    function catBadge(cat) { return badge(cat, Nutricion.categoriaColor(cat)); }

    function desnutBadge(nivel) {
        const map = { Normal: 'badge-normal', Leve: 'badge-leve', Moderada: 'badge-moderada', Severa: 'badge-severa' };
        return badge(nivel || 'Sin datos', map[nivel] || 'badge-normal');
    }

    function zBadge(z, label, cls) {
        if (z === null || z === undefined) return '<span class="z-score">-</span>';
        return `<span class="z-score ${cls}">${z.toFixed(2)} (${label})</span>`;
    }

    function statusBadge(status) {
        const map = { Critico: 'badge-severa', Bajo: 'badge-leve', OK: 'badge-normal' };
        return badge(status, map[status] || 'badge-normal');
    }

    async function renderMenu() {
        const user = Auth.getUser();
        const data = await DB.getAllMulti(['pacientes', 'insumos']);
        const activos = data.pacientes.filter(p => p.activo).length;
        const criticos = data.insumos.filter(i => i.stock_actual < i.stock_minimo).length;
        let html = `<div class="card-app"><div class="card-body" style="text-align:center">
            <div class="login-icon"><i class="bi bi-heart-pulse"></i></div>
            <h2 style="font-size:22px;margin-bottom:4px">Bienvenido, ${user ? user.nombre : ''}</h2>
            <p style="color:var(--muted);font-size:14px">Sistema de Monitoreo Nutricional</p>
        </div></div>
        <div class="menu-grid">
            <div class="menu-card" onclick="App.navigate('pacientes')">
                <div class="menu-icon blue"><i class="bi bi-people-fill"></i></div>
                <div class="menu-card-text"><strong>Pacientes</strong><small>${activos} activos</small></div>
                <i class="bi bi-chevron-right"></i>
            </div>
            <div class="menu-card" onclick="App.navigate('inventario')">
                <div class="menu-icon green"><i class="bi bi-box-seam"></i></div>
                <div class="menu-card-text"><strong>Inventario</strong><small>${criticos > 0 ? criticos + ' criticos' : 'OK'}</small></div>
                <i class="bi bi-chevron-right"></i>
            </div>
            <div class="menu-card" onclick="App.navigate('reportes')">
                <div class="menu-icon orange"><i class="bi bi-graph-up"></i></div>
                <div class="menu-card-text"><strong>Reportes</strong><small>Estadisticas y exportar</small></div>
                <i class="bi bi-chevron-right"></i>
            </div>
            <div class="menu-card" onclick="App.navigate('bd')">
                <div class="menu-icon purple"><i class="bi bi-database"></i></div>
                <div class="menu-card-text"><strong>Base de Datos</strong><small>Vista tabular</small></div>
                <i class="bi bi-chevron-right"></i>
            </div>
            <div class="menu-card" onclick="App.navigate('sync')">
                <div class="menu-icon blue"><i class="bi bi-arrow-repeat"></i></div>
                <div class="menu-card-text"><strong>Sincronizar</strong><small>${typeof Sync !== 'undefined' && Sync.isAndroid() ? Sync.getStatus() : 'Exportar/Importar JSON'}</small></div>
                <i class="bi bi-chevron-right"></i>
            </div>
            ${Auth.isAdmin() ? `<div class="menu-card" onclick="App.navigate('admin')">
                <div class="menu-icon red"><i class="bi bi-shield-lock"></i></div>
                <div class="menu-card-text"><strong>Administracion</strong><small>Usuarios y logs</small></div>
                <i class="bi bi-chevron-right"></i>
            </div>` : ''}
            <div class="menu-card" onclick="App.logout()" style="border-color:#7F1D1D">
                <div class="menu-icon red"><i class="bi bi-box-arrow-right"></i></div>
                <div class="menu-card-text"><strong>Cerrar sesion</strong><small>${user ? user.usuario : ''}</small></div>
                <i class="bi bi-chevron-right"></i>
            </div>
        </div>`;
        $('page-menu-content').innerHTML = html;
    }

    function renderPacienteCard(p) {
        return `<div class="card-app">
            <div class="paciente-card" onclick="App.verPaciente(${p.id})">
                <div class="paciente-avatar"><i class="bi bi-person-fill"></i></div>
                <div class="paciente-info">
                    <div class="paciente-nombre">${p.apellido}, ${p.nombre}</div>
                    <div class="paciente-meta">${p.edad} anos | ${p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : ''}</div>
                    <div class="inline-flex" style="margin-top:4px">
                        ${catBadge(p.categoria)}
                        ${p.tengo_activo ? badge('Tengo', 'badge-info') : ''}
                        ${!p.activo ? badge('Inactivo', 'badge-severa') : ''}
                        ${p.ultima_desnutricion ? desnutBadge(p.ultima_desnutricion) : ''}
                    </div>
                </div>
                <i class="bi bi-chevron-right" style="color:var(--muted)"></i>
            </div>
        </div>`;
    }

    async function updatePacientesResults(q) {
        _pacAllResults = await Pacientes.listar(q);
        _pacPage = 0;
        renderPacientesPage();
    }

    function renderPacientesPage() {
        const start = _pacPage * _pacPageSize;
        const page = _pacAllResults.slice(start, start + _pacPageSize);
        const el = $('pac-results');
        if (!el) return;
        if (_pacAllResults.length === 0) {
            el.innerHTML = `<div class="empty-state"><i class="bi bi-people"></i><p>No se encontraron pacientes</p></div>`;
            return;
        }
        let html = page.map(p => renderPacienteCard(p)).join('');
        if (start + _pacPageSize < _pacAllResults.length) {
            const rest = _pacAllResults.length - (start + _pacPageSize);
            html += `<div style="text-align:center;padding:16px">
                <button class="btn-app btn-sm-app btn-outline" onclick="App.loadMorePacientes()">
                    <i class="bi bi-arrow-down"></i> Ver mas (${rest} restantes)
                </button>
            </div>`;
        }
        el.innerHTML = html;
    }

    function loadMorePacientes() {
        _pacPage++;
        const start = _pacPage * _pacPageSize;
        const page = _pacAllResults.slice(start, start + _pacPageSize);
        const el = $('pac-results');
        if (!el) return;
        const moreBtn = el.querySelector('div:last-child');
        if (moreBtn) moreBtn.remove();
        let html = page.map(p => renderPacienteCard(p)).join('');
        const container = document.createElement('div');
        container.innerHTML = html;
        while (container.firstChild) el.appendChild(container.firstChild);
        if (start + _pacPageSize < _pacAllResults.length) {
            const rest = _pacAllResults.length - (start + _pacPageSize);
            const btn = document.createElement('div');
            btn.style.cssText = 'text-align:center;padding:16px';
            btn.innerHTML = `<button class="btn-app btn-sm-app btn-outline" onclick="App.loadMorePacientes()">
                <i class="bi bi-arrow-down"></i> Ver mas (${rest} restantes)
            </button>`;
            el.appendChild(btn);
        }
    }

    function searchPacientes(q) {
        clearTimeout(_pacSearchTimer);
        _pacSearchTimer = setTimeout(() => updatePacientesResults(q), 150);
    }

    async function renderPacientes(q = '') {
        let html = `
            <div class="card-app"><div class="card-body" style="display:flex;gap:10px;align-items:center">
                <input type="text" class="form-input" id="pac-buscar" placeholder="Buscar por nombre o cedula..." value="${q}" oninput="App.searchPacientes(this.value)" style="flex:1">
                <button class="btn-app btn-success btn-sm-app" onclick="App.renderPacienteNuevo()"><i class="bi bi-plus-lg"></i> Nuevo</button>
            </div></div>
            <div id="pac-results"><div style="text-align:center;padding:20px;color:var(--muted)">Cargando...</div></div>`;
        $('page-pacientes-content').innerHTML = html;
        await updatePacientesResults(q);
    }

    async function verPaciente(id) {
        const p = await Pacientes.obtener(id);
        if (!p) { alert('Paciente no encontrado', 'danger'); return; }
        let html = `
            <div class="card-app">
                <div class="card-header"><span><i class="bi bi-person"></i> ${p.apellido}, ${p.nombre}</span>
                    <div style="display:flex;gap:8px">
                        <button class="btn-app btn-sm-app btn-outline" onclick="App.editarPaciente(${p.id})"><i class="bi bi-pencil"></i></button>
                        ${p.activo ? `<button class="btn-app btn-sm-app btn-danger" onclick="App.darBajaPaciente(${p.id})"><i class="bi bi-x-lg"></i></button>`
                : `<button class="btn-app btn-sm-app btn-success" onclick="App.reactivarPaciente(${p.id})"><i class="bi bi-arrow-clockwise"></i></button>`}
                    </div>
                </div>
                <div class="card-body">
                    <div class="inline-flex" style="margin-bottom:12px">
                        ${catBadge(p.categoria)}
                        ${p.tengo ? badge('Tengo', 'badge-info') : ''}
                        ${!p.activo ? badge('Inactivo', 'badge-severa') : ''}
                    </div>
                    <div class="metric-row" style="flex-wrap:wrap;gap:16px">
                        <div><strong>Edad:</strong> ${p.edad} anos (${p.edadMeses} meses)</div>
                        <div><strong>Sexo:</strong> ${p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : 'No especificado'}</div>
                        <div><strong>Nac.:</strong> ${p.fecha_nac}</div>
                        ${p.cedula ? `<div><strong>Cedula:</strong> ${p.cedula}</div>` : ''}
                        ${p.telefono ? `<div><strong>Telefono:</strong> ${p.telefono}</div>` : ''}
                        ${p.direccion ? `<div><strong>Direccion:</strong> ${p.direccion}</div>` : ''}
                    </div>
                    ${p.cuidador_nombre ? `<div style="margin-top:12px;padding:10px;background:#1A0404;border-radius:10px">
                        <strong style="color:var(--primary)"><i class="bi bi-person-heart"></i> Cuidador:</strong>
                        ${p.cuidador_nombre} ${p.cuidador_apellido || ''}
                        ${p.cuidador_cedula ? ` | C.I: ${p.cuidador_cedula}` : ''}
                        ${p.cuidador_telefono ? ` | Tel: ${p.cuidador_telefono}` : ''}
                    </div>` : ''}
                </div>
            </div>`;

        if (p.alertaMonitoreo) {
            html += `<div class="alert-app alert-warning">
                <i class="bi bi-exclamation-triangle"></i> Hace ${p.mesesDesdePrimera} meses desde la primera atencion.
                <div style="margin-top:8px;display:flex;gap:8px">
                    <button class="btn-app btn-sm-app btn-success" onclick="App.continuarAtencion(${p.id})">Continuar</button>
                    <button class="btn-app btn-sm-app btn-danger" onclick="App.darBajaPaciente(${p.id})">Dar de baja</button>
                </div>
            </div>`;
        }

        html += `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
            <button class="btn-app btn-primary btn-sm-app" onclick="App.nuevaVisita(${p.id})"><i class="bi bi-plus-lg"></i> Nueva Visita</button>
            <button class="btn-app btn-success btn-sm-app" onclick="App.nuevaEntrega(${p.id})"><i class="bi bi-box-arrow-up"></i> Entregar Insumos</button>
        </div>`;

        if (p.visitas.length > 0) {
            html += `<div class="card-app"><div class="card-header"><span><i class="bi bi-calendar-check"></i> Visitas (${p.visitas.length})</span></div>`;
            p.visitas.forEach(v => {
                html += `<div class="paciente-card" style="cursor:default">
                    <div class="paciente-avatar" style="background:#065F46;color:#6EE7B7;font-size:14px">${v.fecha.substring(5, 10)}</div>
                    <div class="paciente-info">
                        <div class="paciente-nombre">${v.tipo}</div>
                        <div class="paciente-meta">${v.usuario_nombre} | ${v.fecha}</div>
                        ${v.observaciones ? `<div style="font-size:13px;color:var(--muted);margin-top:2px">${v.observaciones}</div>` : ''}
                    </div>
                </div>`;
            });
            html += `</div>`;
        }

        if (p.metricas.length > 0) {
            html += `<div class="card-app"><div class="card-header"><span><i class="bi bi-speedometer2"></i> Metricas (${p.metricas.length})</span></div>`;
            p.metricas.forEach(m => {
                html += `<div class="paciente-card" style="cursor:default" onclick="App.editarMetrica(${m.id})">
                    <div class="paciente-avatar" style="background:#3B1F5E;color:#C4B5FD;font-size:12px">${m.fecha.substring(5, 10)}</div>
                    <div class="paciente-info">
                        <div class="paciente-nombre">${m.peso}kg | ${m.talla}cm | IMC: ${m.imc}</div>
                        <div class="inline-flex" style="margin-top:2px">
                            ${desnutBadge(m.nivel_desnutricion)}
                            ${zBadge(m.z_score, m.z_label, m.z_class)}
                        </div>
                        ${m.perimetro_brazo ? `<div style="font-size:12px;color:var(--muted)">Perimetro brazo: ${m.perimetro_brazo}cm</div>` : ''}
                        <div style="font-size:12px;color:var(--muted)">Por: ${m.usuario_nombre}</div>
                    </div>
                    <i class="bi bi-pencil" style="color:var(--muted);font-size:14px"></i>
                </div>`;
            });
            html += `</div>`;
        }

        if (p.entregas.length > 0) {
            html += `<div class="card-app"><div class="card-header"><span><i class="bi bi-box-arrow-up"></i> Entregas (${p.entregas.length})</span></div>`;
            p.entregas.forEach(e => {
                html += `<div class="paciente-card" style="cursor:default" onclick="App.editarEntrega(${e.id})">
                    <div class="paciente-avatar" style="background:#78350F;color:#FCD34D;font-size:12px">${e.fecha.substring(5, 10)}</div>
                    <div class="paciente-info">
                        <div class="paciente-nombre">${e.insumo_nombre}</div>
                        <div class="paciente-meta">${e.cantidad} ${e.insumo_unidad} | ${e.usuario_nombre}</div>
                    </div>
                    <i class="bi bi-pencil" style="color:var(--muted);font-size:14px"></i>
                </div>`;
            });
            html += `</div>`;
        }

        if (Auth.isAdmin()) {
            html += `<div style="margin-top:16px"><button class="btn-app btn-danger" onclick="App.eliminarPaciente(${p.id})"><i class="bi bi-trash"></i> Eliminar paciente permanentemente</button></div>`;
        }

        $('page-paciente_perfil-content').innerHTML = html;
        navigate('paciente_perfil');
    }

    function renderPacienteNuevo(data = null) {
        const edit = !!data;
        const d = data || {};
        let html = `<div class="card-app"><div class="card-header"><span><i class="bi bi-person-plus"></i> ${edit ? 'Editar' : 'Nuevo'} Paciente</span></div>
        <div class="card-body"><form onsubmit="event.preventDefault(); App.${edit ? 'guardarEditarPaciente' : 'guardarNuevoPaciente'}(${d.id || 'null'}, this)">
            <div class="form-group"><label>Nombre *</label><input type="text" name="nombre" class="form-input" required value="${d.nombre || ''}"></div>
            <div class="form-group"><label>Apellido *</label><input type="text" name="apellido" class="form-input" required value="${d.apellido || ''}"></div>
            <div class="form-group"><label>Fecha de nacimiento *</label><input type="date" name="fecha_nac" class="form-input" required value="${d.fecha_nac || ''}"></div>
            <div class="form-group"><label>Sexo</label><select name="sexo" class="form-select"><option value="">Seleccionar</option><option value="M" ${d.sexo === 'M' ? 'selected' : ''}>Masculino</option><option value="F" ${d.sexo === 'F' ? 'selected' : ''}>Femenino</option></select></div>
            <div class="form-group"><label>Cedula</label><input type="text" name="cedula" class="form-input" value="${d.cedula || ''}"></div>
            <div class="form-group"><label>Telefono</label><input type="text" name="telefono" class="form-input" value="${d.telefono || ''}"></div>
            <div class="form-group"><label>Direccion</label><textarea name="direccion" class="form-textarea">${d.direccion || ''}</textarea></div>
            <div class="inline-flex" style="gap:20px;margin-bottom:16px">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" name="embarazada" ${d.embarazada ? 'checked' : ''}> Embarazada</label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" name="lactante" ${d.lactante ? 'checked' : ''}> Lactante</label>
            </div>
            <div style="background:#1A0404;padding:14px;border-radius:12px;margin-bottom:16px">
                <strong style="color:var(--primary);font-size:14px"><i class="bi bi-person-heart"></i> Cuidador</strong>
                <div class="form-group" style="margin-top:10px"><label>Nombre</label><input type="text" name="cuidador_nombre" class="form-input" value="${d.cuidador_nombre || ''}"></div>
                <div class="form-group"><label>Apellido</label><input type="text" name="cuidador_apellido" class="form-input" value="${d.cuidador_apellido || ''}"></div>
                <div class="form-group"><label>Cedula</label><input type="text" name="cuidador_cedula" class="form-input" value="${d.cuidador_cedula || ''}"></div>
                <div class="form-group"><label>Telefono</label><input type="text" name="cuidador_telefono" class="form-input" value="${d.cuidador_telefono || ''}"></div>
            </div>
            ${!edit ? `<div style="background:#1A0404;padding:14px;border-radius:12px;margin-bottom:16px">
                <strong style="color:var(--primary);font-size:14px"><i class="bi bi-speedometer2"></i> Metrica inicial (opcional)</strong>
                <div class="form-group" style="margin-top:10px"><label>Peso (kg)</label><input type="number" name="peso" step="0.1" class="form-input"></div>
                <div class="form-group"><label>Talla (cm)</label><input type="number" name="talla" step="0.1" class="form-input"></div>
                <div class="form-group"><label>Perimetro brazo (cm)</label><input type="number" name="perimetro" step="0.1" class="form-input"></div>
            </div>
            <div style="background:#1A0404;padding:14px;border-radius:12px;margin-bottom:16px">
                <strong style="color:var(--primary);font-size:14px"><i class="bi bi-gift"></i> Beneficio Tengo (opcional)</strong>
                <div class="form-group" style="margin-top:10px"><label>Fecha inicio</label><input type="date" name="tengo_fecha_inicio" class="form-input"></div>
            </div>` : `
            <div style="background:#1A0404;padding:14px;border-radius:12px;margin-bottom:16px">
                <strong style="color:var(--primary);font-size:14px"><i class="bi bi-gift"></i> Beneficio Tengo</strong>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:10px"><input type="checkbox" name="tengo_activa" ${d.tengo ? 'checked' : ''}> Activa</label>
                <div class="form-group" style="margin-top:10px"><label>Fecha fin</label><input type="date" name="tengo_fecha_fin" value="${d.tengo && d.tengo.fecha_fin ? d.tengo.fecha_fin : ''}" class="form-input"></div>
            </div>`}
            <button type="submit" class="btn-app btn-primary"><i class="bi bi-check-lg"></i> ${edit ? 'Guardar cambios' : 'Registrar paciente'}</button>
        </form></div></div>`;
        $('page-form-content').innerHTML = html;
        navigate('form');
    }

    async function guardarNuevoPaciente(id, form) {
        const d = Object.fromEntries(new FormData(form));
        d.embarazada = form.querySelector('[name=embarazada]').checked;
        d.lactante = form.querySelector('[name=lactante]').checked;
        if (!d.nombre || !d.apellido || !d.fecha_nac) { alert('Complete nombre, apellido y fecha de nacimiento', 'danger'); return; }
        await Pacientes.nuevo(d);
        alert('Paciente registrado exitosamente', 'success');
        navigate('pacientes');
    }

    async function guardarEditarPaciente(id, form) {
        const d = Object.fromEntries(new FormData(form));
        d.embarazada = form.querySelector('[name=embarazada]').checked;
        d.lactante = form.querySelector('[name=lactante]').checked;
        d.tengo_activa = form.querySelector('[name=tengo_activa]').checked;
        d.tengo_fecha_fin = form.querySelector('[name=tengo_fecha_fin]').value;
        await Pacientes.editar(id, d);
        alert('Paciente actualizado', 'success');
        verPaciente(id);
    }

    async function editarPaciente(id) {
        const p = await Pacientes.obtener(id);
        if (p) renderPacienteNuevo(p);
    }

    async function darBajaPaciente(id) {
        if (!confirm('Dar de baja a este paciente?')) return;
        await Pacientes.darBaja(id);
        alert('Paciente dado de baja', 'warning');
        verPaciente(id);
    }

    async function reactivarPaciente(id) {
        await Pacientes.reactivar(id);
        alert('Paciente reactivado', 'success');
        verPaciente(id);
    }

    async function eliminarPaciente(id) {
        if (!confirm('ELIMINAR permanentemente este paciente y todos sus datos?')) return;
        await Pacientes.eliminar(id);
        alert('Paciente eliminado', 'danger');
        navigate('pacientes');
    }

    async function continuarAtencion(id) {
        await Pacientes.continuarAtencion(id);
        alert('Atencion continuada', 'success');
        verPaciente(id);
    }

    function nuevaVisita(pacienteId) {
        DB.getAll('insumos').then(ins => {
            let options = ins.map(i => `<option value="${i.id}">${i.nombre} (${i.unidad}) - Stock: ${i.stock_actual}</option>`).join('');
            let html = `<div class="card-app"><div class="card-header"><span><i class="bi bi-calendar-plus"></i> Nueva Visita</span></div>
            <div class="card-body"><form onsubmit="event.preventDefault(); App.guardarVisita(${pacienteId}, this)">
                <div class="form-group"><label>Fecha *</label><input type="date" name="fecha" class="form-input" required value="${DB.today()}"></div>
                <div class="form-group"><label>Tipo de visita *</label><select name="tipo" class="form-select" required>
                    <option value="jornada">Jornada</option><option value="visita domiciliaria">Visita domiciliaria</option>
                    <option value="monitoreo">Monitoreo</option><option value="nuevo ingreso">Nuevo ingreso</option></select></div>
                <div class="form-group"><label>Observaciones</label><textarea name="observaciones" class="form-textarea"></textarea></div>
                <div style="background:#1A0404;padding:14px;border-radius:12px;margin-bottom:16px">
                    <strong style="color:var(--primary);font-size:14px"><i class="bi bi-speedometer2"></i> Metricas</strong>
                    <div class="form-group" style="margin-top:10px"><label>Peso (kg) *</label><input type="number" name="peso" step="0.1" class="form-input" required></div>
                    <div class="form-group"><label>Talla (cm) *</label><input type="number" name="talla" step="0.1" class="form-input" required></div>
                    <div class="form-group"><label>Perimetro brazo (cm)</label><input type="number" name="perimetro" step="0.1" class="form-input"></div>
                </div>
                <div style="background:#1A0404;padding:14px;border-radius:12px;margin-bottom:16px">
                    <strong style="color:var(--primary);font-size:14px"><i class="bi bi-box-arrow-up"></i> Entrega de insumos (opcional)</strong>
                    <div id="entregas-rows"></div>
                    <button type="button" class="btn-app btn-sm-app btn-outline" onclick="App.addEntregaRow()" style="margin-top:8px"><i class="bi bi-plus"></i> Agregar insumo</button>
                </div>
                <button type="submit" class="btn-app btn-primary"><i class="bi bi-check-lg"></i> Guardar visita</button>
            </form></div></div>`;
            $('page-form-content').innerHTML = html;
            navigate('form');
            window._insumosOpts = options;
        });
    }

    function addEntregaRow() {
        const container = $('entregas-rows');
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
        div.innerHTML = `<select class="form-select" name="entrega_insumo" style="flex:2">${window._insumosOpts || ''}</select>
            <input type="number" name="entrega_cantidad" class="form-input" placeholder="Cant." min="1" step="1" style="flex:1">
            <button type="button" class="btn-app btn-sm-app btn-danger" onclick="this.parentElement.remove()" style="padding:8px"><i class="bi bi-x"></i></button>`;
        container.appendChild(div);
    }

    async function guardarVisita(pacienteId, form) {
        const d = Object.fromEntries(new FormData(form));
        const rows = form.querySelectorAll('#entregas-rows > div');
        const entregas = [];
        rows.forEach(row => {
            const insumo_id = parseInt(row.querySelector('[name=entrega_insumo]').value);
            const cantidad = parseFloat(row.querySelector('[name=entrega_cantidad]').value) || 0;
            if (insumo_id && cantidad > 0) entregas.push({ insumo_id, cantidad });
        });
        d.entregas = entregas;
        await Pacientes.crearVisita(pacienteId, d);
        alert('Visita registrada', 'success');
        verPaciente(pacienteId);
    }

    function nuevaEntrega(pacienteId) {
        DB.getAll('insumos').then(ins => {
            let options = ins.map(i => `<option value="${i.id}">${i.nombre} (${i.unidad}) - Stock: ${i.stock_actual}</option>`).join('');
            let html = `<div class="card-app"><div class="card-header"><span><i class="bi bi-box-arrow-up"></i> Entregar Insumos</span></div>
            <div class="card-body"><form onsubmit="event.preventDefault(); App.guardarEntrega(${pacienteId}, this)">
                <div class="form-group"><label>Fecha</label><input type="date" name="fecha" class="form-input" value="${DB.today()}"></div>
                <div id="entregas-rows"></div>
                <button type="button" class="btn-app btn-sm-app btn-outline" onclick="App.addEntregaRow()" style="margin-top:8px"><i class="bi bi-plus"></i> Agregar insumo</button>
                <button type="submit" class="btn-app btn-success" style="margin-top:16px"><i class="bi bi-check-lg"></i> Registrar entrega</button>
            </form></div></div>`;
            $('page-form-content').innerHTML = html;
            navigate('form');
            window._insumosOpts = options;
            App.addEntregaRow();
        });
    }

    async function guardarEntrega(pacienteId, form) {
        const d = Object.fromEntries(new FormData(form));
        const rows = form.querySelectorAll('#entregas-rows > div');
        const entregas = [];
        rows.forEach(row => {
            const insumo_id = parseInt(row.querySelector('[name=entrega_insumo]').value);
            const cantidad = parseFloat(row.querySelector('[name=entrega_cantidad]').value) || 0;
            if (insumo_id && cantidad > 0) entregas.push({ insumo_id, cantidad });
        });
        if (entregas.length === 0) { alert('Agregue al menos un insumo', 'danger'); return; }
        d.entregas = entregas;
        await Pacientes.crearEntrega(pacienteId, d);
        alert('Entrega registrada', 'success');
        verPaciente(pacienteId);
    }

    async function editarMetrica(id) {
        const m = await DB.get('metricas', id);
        if (!m) return;
        let html = `<div class="card-app"><div class="card-header"><span><i class="bi bi-pencil"></i> Editar Metrica</span></div>
        <div class="card-body"><form onsubmit="event.preventDefault(); App.guardarEditarMetrica(${id}, this)">
            <div class="form-group"><label>Fecha</label><input type="date" name="fecha" class="form-input" value="${m.fecha}"></div>
            <div class="form-group"><label>Peso (kg)</label><input type="number" name="peso" step="0.1" class="form-input" required value="${m.peso}"></div>
            <div class="form-group"><label>Talla (cm)</label><input type="number" name="talla" step="0.1" class="form-input" required value="${m.talla}"></div>
            <div class="form-group"><label>Perimetro brazo (cm)</label><input type="number" name="perimetro" step="0.1" class="form-input" value="${m.perimetro_brazo || ''}"></div>
            <button type="submit" class="btn-app btn-primary"><i class="bi bi-check-lg"></i> Guardar</button>
        </form></div></div>`;
        $('page-form-content').innerHTML = html;
        navigate('form');
        window._metricaPacienteId = m.paciente_id;
    }

    async function guardarEditarMetrica(id, form) {
        const d = Object.fromEntries(new FormData(form));
        await Pacientes.editarMetrica(id, d);
        alert('Metrica actualizada', 'success');
        verPaciente(window._metricaPacienteId);
    }

    async function editarEntrega(id) {
        const e = await DB.get('entregas', id);
        if (!e) return;
        const ins = await DB.getAll('insumos');
        let options = ins.map(i => `<option value="${i.id}" ${i.id === e.insumo_id ? 'selected' : ''}>${i.nombre} (${i.unidad})</option>`).join('');
        let html = `<div class="card-app"><div class="card-header"><span><i class="bi bi-pencil"></i> Editar Entrega</span></div>
        <div class="card-body"><form onsubmit="event.preventDefault(); App.guardarEditarEntrega(${id}, ${e.paciente_id}, this)">
            <div class="form-group"><label>Insumo</label><select name="insumo_id" class="form-select">${options}</select></div>
            <div class="form-group"><label>Cantidad</label><input type="number" name="cantidad" step="0.1" class="form-input" required value="${e.cantidad}"></div>
            <div class="form-group"><label>Fecha</label><input type="date" name="fecha" class="form-input" value="${e.fecha}"></div>
            <button type="submit" class="btn-app btn-primary"><i class="bi bi-check-lg"></i> Guardar</button>
        </form></div></div>`;
        $('page-form-content').innerHTML = html;
        navigate('form');
    }

    async function guardarEditarEntrega(id, pacienteId, form) {
        const d = Object.fromEntries(new FormData(form));
        d.insumo_id = parseInt(d.insumo_id);
        await Pacientes.editarEntrega(id, d);
        alert('Entrega actualizada', 'success');
        verPaciente(pacienteId);
    }

    async function renderInventario() {
        const data = await Inventario.listar();
        let html = `
            <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
                <button class="btn-app btn-success btn-sm-app" onclick="App.formNuevoInsumo()"><i class="bi bi-plus-lg"></i> Nuevo insumo</button>
                <button class="btn-app btn-primary btn-sm-app" onclick="App.formLlegada()"><i class="bi bi-arrow-down"></i> Llegada</button>
            </div>`;

        html += `<div class="card-app"><div class="card-header"><span><i class="bi bi-box-seam"></i> Stock Actual</span></div>`;
        if (data.insumos.length === 0) {
            html += `<div class="card-body"><div class="empty-state"><i class="bi bi-box"></i><p>Sin insumos registrados</p></div></div>`;
        } else {
            data.insumos.forEach(i => {
                html += `<div class="paciente-card" style="cursor:default">
                    <div class="paciente-avatar" style="background:${i.status === 'Critico' ? '#7F1D1D' : i.status === 'Bajo' ? '#78350F' : '#065F46'};color:${i.status === 'Critico' ? '#FCA5A5' : i.status === 'Bajo' ? '#FCD34D' : '#6EE7B7'}">
                        <i class="bi bi-box"></i>
                    </div>
                    <div class="paciente-info">
                        <div class="paciente-nombre">${i.nombre}</div>
                        <div class="paciente-meta">${i.categoria} | ${i.unidad} | Min: ${i.stock_minimo}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-size:20px;font-weight:700">${i.stock_actual}</div>
                        ${statusBadge(i.status)}
                    </div>
                </div>`;
            });
        }
        html += `</div>`;

        if (data.ingresos.length > 0) {
            html += `<div class="card-app"><div class="card-header"><span><i class="bi bi-arrow-down-circle"></i> Ultimos ingresos</span></div>`;
            data.ingresos.forEach(ing => {
                html += `<div class="paciente-card" style="cursor:default">
                    <div class="paciente-info">
                        <div class="paciente-nombre">+${ing.cantidad} ${ing.insumo_unidad} - ${ing.insumo_nombre}</div>
                        <div class="paciente-meta">${ing.usuario_nombre} | ${ing.fecha}${ing.notas ? ' | ' + ing.notas : ''}</div>
                    </div>
                </div>`;
            });
            html += `</div>`;
        }

        if (data.entregas.length > 0) {
            html += `<div class="card-app"><div class="card-header"><span><i class="bi bi-arrow-up-circle"></i> Ultimas entregas</span></div>`;
            data.entregas.forEach(ent => {
                html += `<div class="paciente-card" style="cursor:default">
                    <div class="paciente-info">
                        <div class="paciente-nombre">-${ent.cantidad} ${ent.insumo_unidad} - ${ent.insumo_nombre}</div>
                        <div class="paciente-meta">${ent.paciente_nombre} | ${ent.usuario_nombre} | ${ent.fecha}</div>
                    </div>
                </div>`;
            });
            html += `</div>`;
        }

        $('page-inventario-content').innerHTML = html;
    }

    function formNuevoInsumo() {
        let html = `<div class="card-app"><div class="card-header"><span><i class="bi bi-plus-lg"></i> Nuevo Insumo</span></div>
        <div class="card-body"><form onsubmit="event.preventDefault(); App.guardarNuevoInsumo(this)">
            <div class="form-group"><label>Nombre *</label><input type="text" name="nombre" class="form-input" required></div>
            <div class="form-group"><label>Categoria</label><input type="text" name="categoria" class="form-input" placeholder="Ej: Alimentos, Salud, Kit..."></div>
            <div class="form-group"><label>Unidad *</label><input type="text" name="unidad" class="form-input" required placeholder="Ej: Unidad, Sobre, Tableta, Kit"></div>
            <div class="form-group"><label>Stock actual</label><input type="number" name="stock_actual" class="form-input" value="0" step="1"></div>
            <div class="form-group"><label>Stock minimo</label><input type="number" name="stock_minimo" class="form-input" value="0" step="1"></div>
            <button type="submit" class="btn-app btn-primary"><i class="bi bi-check-lg"></i> Crear insumo</button>
        </form></div></div>`;
        $('page-form-content').innerHTML = html;
        navigate('form');
    }

    async function guardarNuevoInsumo(form) {
        const d = Object.fromEntries(new FormData(form));
        if (!d.nombre || !d.unidad) { alert('Nombre y unidad son requeridos', 'danger'); return; }
        await Inventario.nuevoInsumo(d);
        alert('Insumo creado', 'success');
        navigate('inventario');
    }

    function formLlegada() {
        DB.getAll('insumos').then(ins => {
            let options = ins.map(i => `<option value="${i.id}">${i.nombre} (${i.unidad}) - Stock: ${i.stock_actual}</option>`).join('');
            let html = `<div class="card-app"><div class="card-header"><span><i class="bi bi-arrow-down"></i> Registrar llegada de insumo</span></div>
            <div class="card-body"><form onsubmit="event.preventDefault(); App.guardarLlegada(this)">
                <div class="form-group"><label>Insumo *</label><select name="insumo_id" class="form-select" required>${options}</select></div>
                <div class="form-group"><label>Cantidad *</label><input type="number" name="cantidad" class="form-input" required step="1" min="1"></div>
                <div class="form-group"><label>Fecha</label><input type="date" name="fecha" class="form-input" value="${DB.today()}"></div>
                <div class="form-group"><label>Notas</label><textarea name="notas" class="form-textarea" placeholder="Proveedor, motivo..."></textarea></div>
                <button type="submit" class="btn-app btn-success"><i class="bi bi-check-lg"></i> Registrar llegada</button>
            </form></div></div>`;
            $('page-form-content').innerHTML = html;
            navigate('form');
        });
    }

    async function guardarLlegada(form) {
        const d = Object.fromEntries(new FormData(form));
        d.insumo_id = parseInt(d.insumo_id);
        d.cantidad = parseFloat(d.cantidad);
        if (!d.insumo_id || !d.cantidad) { alert('Complete insumo y cantidad', 'danger'); return; }
        await Inventario.registrarLlegada(d);
        alert('Llegada registrada', 'success');
        navigate('inventario');
    }

    async function renderReportes() {
        const now = new Date();
        let html = `<div class="card-app"><div class="card-header"><span><i class="bi bi-graph-up"></i> Reportes</span></div>
        <div class="card-body"><form onsubmit="App.generarReporte(this);return false">
            <div class="metric-row">
                <div class="form-group" style="flex:1"><label>Desde</label><input type="date" name="desde" class="form-input" value="${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01"></div>
                <div class="form-group" style="flex:1"><label>Hasta</label><input type="date" name="hasta" class="form-input" value="${DB.today()}"></div>
            </div>
            <button type="submit" class="btn-app btn-primary"><i class="bi bi-search"></i> Generar reporte</button>
            <button type="button" class="btn-app btn-success" style="margin-top:8px" onclick="App.generarReporteExport(this.closest('form'))"><i class="bi bi-download"></i> Exportar CSV</button>
        </form></div></div>
        <div id="reporte-resultado"></div>`;
        $('page-reportes-content').innerHTML = html;
    }

    async function generarReporte(form) {
        try {
            const d = Object.fromEntries(new FormData(form));
            const reporte = await Reportes.generar(d);
            window._ultimoReporte = reporte;
            renderReporteResultado(reporte);
        } catch (e) {
            alert('Error al generar reporte: ' + (e.message || e), 'danger');
            console.error(e);
        }
    }

    async function generarReporteExport(form) {
        try {
            const d = Object.fromEntries(new FormData(form));
            const reporte = await Reportes.generar(d);
            Reportes.exportarCSV(reporte);
        } catch (e) {
            alert('Error al exportar: ' + (e.message || e), 'danger');
            console.error(e);
        }
    }

    function renderReporteResultado(r) {
        let html = `
            <div class="card-app"><div class="card-header"><span><i class="bi bi-info-circle"></i> Resumen</span></div>
            <div class="card-body">
                <div class="metric-row" style="flex-wrap:wrap">
                    <div class="metric-item"><div class="value">${r.total_pacientes}</div><div class="label">Total pacientes</div></div>
                    <div class="metric-item"><div class="value">${r.pacientes_activos}</div><div class="label">Activos</div></div>
                    <div class="metric-item"><div class="value">${r.pacientes_atendidos}</div><div class="label">Atendidos</div></div>
                    <div class="metric-item"><div class="value">${r.total_visitas}</div><div class="label">Visitas</div></div>
                    <div class="metric-item"><div class="value">${r.tengo_beneficiarios}</div><div class="label">Tengo</div></div>
                </div>
            </div></div>
            <div class="card-app"><div class="card-header"><span><i class="bi bi-people"></i> Por categoria</span></div>
            <div class="card-body"><div class="metric-row" style="flex-wrap:wrap">
                ${Object.entries(r.categorias).map(([k, v]) => `<div class="metric-item"><div class="value">${v}</div><div class="label">${k}</div></div>`).join('')}
            </div></div></div>
            <div class="card-app"><div class="card-header"><span><i class="bi bi-heart-pulse"></i> Desnutricion</span></div>
            <div class="card-body"><div class="metric-row" style="flex-wrap:wrap">
                ${Object.entries(r.desnutricion).map(([k, v]) => `<div class="metric-item"><div class="value">${v}</div><div class="label">${k}</div></div>`).join('')}
            </div></div></div>`;

        if (Object.keys(r.entregas_por_insumo).length > 0) {
            html += `<div class="card-app"><div class="card-header"><span><i class="bi bi-box-arrow-up"></i> Insumos entregados</span></div><div class="card-body">`;
            Object.entries(r.entregas_por_insumo).forEach(([k, v]) => {
                html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span>${k}</span><strong>${v}</strong></div>`;
            });
            html += `</div></div>`;
        }

        if (r.insumos_criticos.length > 0) {
            html += `<div class="card-app"><div class="card-header"><span><i class="bi bi-exclamation-triangle"></i> Stock critico (${r.insumos_criticos.length})</span></div><div class="card-body">`;
            r.insumos_criticos.forEach(i => {
                html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span>${i.nombre}</span><span style="color:var(--danger)">${i.stock_actual}/${i.stock_minimo}</span></div>`;
            });
            html += `</div></div>`;
        }

        if (r.pacientes.length > 0) {
            html += `<div class="card-app"><div class="card-header"><span><i class="bi bi-table"></i> Detalle de pacientes (${r.pacientes.length})</span></div>
                <div class="card-body" style="padding:0;overflow-x:auto">
                <table class="reporte-tabla">
                <thead><tr>
                    <th>Nombre</th><th>Categoria</th><th>Edad</th><th>Sexo</th><th>Cedula</th>
                    <th>Desnutricion</th><th>Z-Score</th><th>Tengo</th><th>Visitas</th><th>Insumos</th>
                </tr></thead><tbody>`;
            r.pacientes.forEach(p => {
                const insumos = Object.entries(p.insumos_entregados || {}).map(([k, v]) => `${k}: ${v}`).join('<br>');
                html += `<tr>
                    <td>${p.apellido}, ${p.nombre}</td>
                    <td>${catBadge(p.categoria)}</td>
                    <td>${p.edad}</td>
                    <td>${p.sexo || '-'}</td>
                    <td>${p.cedula || '-'}</td>
                    <td>${p.ultima_desnutricion !== 'Sin datos' ? desnutBadge(p.ultima_desnutricion) : p.ultima_desnutricion}</td>
                    <td>${p.ultima_zscore != null ? p.ultima_zscore.toFixed(2) : '-'}</td>
                    <td>${p.tiene_tengo ? 'Si' : 'No'}</td>
                    <td>${p.visitas_periodo}</td>
                    <td style="font-size:11px">${insumos || '-'}</td>
                </tr>`;
            });
            html += `</tbody></table></div></div>`;
        }

        $('reporte-resultado').innerHTML = html;
    }

    function renderBDLista(pacientes) {
        let html = '';
        pacientes.forEach(p => {
            html += `<div class="paciente-card" onclick="App.verPaciente(${p.id})">
                <div class="paciente-avatar"><i class="bi bi-person-fill"></i></div>
                <div class="paciente-info">
                    <div class="paciente-nombre">${p.apellido}, ${p.nombre}</div>
                    <div class="paciente-meta">${p.edad}a | ${p.sexo || '-'} | ${p.cedula || '-'}</div>
                    <div class="inline-flex" style="margin-top:3px">
                        ${catBadge(p.categoria)}
                        ${p.ultima_desnutricion ? desnutBadge(p.ultima_desnutricion) : ''}
                        ${p.tengo_activo ? badge('Tengo', 'badge-info') : ''}
                        ${!p.activo ? badge('Inactivo', 'badge-severa') : ''}
                    </div>
                </div>
            </div>`;
        });
        return html || '<div class="empty-state"><p>Sin resultados</p></div>';
    }

    async function updateBDResults(q) {
        const pacientes = await Pacientes.listar(q);
        const el = $('bd-lista');
        if (el) el.innerHTML = renderBDLista(pacientes);
    }

    function searchBD(q) {
        clearTimeout(_bdSearchTimer);
        _bdSearchTimer = setTimeout(() => updateBDResults(q), 150);
    }

    async function renderBD() {
        let html = `<div class="card-app"><div class="card-body" style="display:flex;gap:10px">
            <input type="text" class="form-input" id="bd-buscar" placeholder="Buscar..." oninput="App.searchBD(this.value)" style="flex:1">
        </div></div><div id="bd-lista"><div style="text-align:center;padding:20px;color:var(--muted)">Cargando...</div></div>`;
        $('page-bd-content').innerHTML = html;
        await updateBDResults('');
    }

    async function renderSync() {
        const syncAvailable = typeof Sync !== 'undefined' && Sync.isAndroid();
        let devices = [];
        let syncPath = '';
        let syncStatus = '';
        let myDevice = '';
        let storageOk = false;

        if (syncAvailable) {
            try { storageOk = window.SyncBridge.isStorageAccessible(); } catch (e) { storageOk = false; }
            syncPath = Sync.getSyncPath();
            syncStatus = Sync.getStatus();
            myDevice = Sync.getDeviceId();
            try {
                const filesJson = window.SyncBridge.listSyncFiles();
                const files = JSON.parse(filesJson);
                for (const f of files) {
                    if (f === myDevice + '.json') continue;
                    const data = JSON.parse(window.SyncBridge.readSyncFile(f));
                    if (data) {
                        const count = Sync.TABLES.reduce((acc, t) => acc + (data[t] ? data[t].length : 0), 0);
                        devices.push({ file: f, device: data._device || f, exported: data._exported || '-', records: count });
                    }
                }
            } catch (e) { }
        }

        let html = `
            <div class="card-app">
                <div class="card-header"><span><i class="bi bi-arrow-repeat"></i> Estado de sincronizacion</span></div>
                <div class="card-body">
                    ${syncAvailable && storageOk ? `
                        <div style="text-align:center;margin-bottom:16px">
                            <i class="bi bi-hdd-network" style="font-size:48px;color:var(--primary);display:block;margin-bottom:8px"></i>
                            <div style="font-size:15px;font-weight:600">${devices.length > 0 ? devices.length + ' dispositivo(s) conectado(s)' : 'Sin dispositivos vinculados'}</div>
                            <div style="font-size:12px;color:var(--muted);margin-top:4px">Carpeta: ${syncPath}</div>
                        </div>
                        <div class="metric-row" style="margin-bottom:16px">
                            <div class="metric-item" style="background:#1A0404;padding:12px;border-radius:10px">
                                <div class="value" style="font-size:16px;color:var(--success)"><i class="bi bi-check-circle"></i></div>
                                <div class="label">Auto-sync activo</div>
                            </div>
                            <div class="metric-item" style="background:#1A0404;padding:12px;border-radius:10px">
                                <div class="value" style="font-size:16px">${devices.length}</div>
                                <div class="label">Dispositivos</div>
                            </div>
                        </div>
                        <button class="btn-app btn-primary" onclick="App.ejecutarSync()" id="btn-sync-now">
                            <i class="bi bi-arrow-repeat"></i> Sincronizar ahora
                        </button>
                    ` : syncAvailable && !storageOk ? `
                        <div style="text-align:center;padding:20px">
                            <i class="bi bi-shield-exclamation" style="font-size:48px;color:var(--danger);display:block;margin-bottom:8px"></i>
                            <div style="font-size:15px;font-weight:600">Permiso de almacenamiento requerido</div>
                            <div style="font-size:13px;color:var(--muted);margin-top:8px">Abre: Ajustes &gt; Apps &gt; SAMAN &gt; Permisos &gt; "Allow management of all files" y activalo. Luego vuelve a esta pantalla.</div>
                            <div style="font-size:12px;color:var(--muted);margin-top:8px">Ruta esperada: ${syncPath}</div>
                        </div>
                    ` : `
                        <div style="text-align:center;padding:20px">
                            <i class="bi bi-exclamation-triangle" style="font-size:48px;color:var(--warning);display:block;margin-bottom:8px"></i>
                            <div style="font-size:15px;font-weight:600">Syncthing no disponible</div>
                            <div style="font-size:13px;color:var(--muted);margin-top:8px">Instala Syncthing para sincronizar entre dispositivos automaticamente</div>
                        </div>
                    `}
                </div>
            </div>`;

        if (syncAvailable && devices.length > 0) {
            html += `<div class="card-app">
                <div class="card-header"><span><i class="bi bi-phone"></i> Dispositivos detectados</span></div>
                <div class="card-body" style="padding:0">`;
            devices.forEach(d => {
                html += `<div class="paciente-card" style="cursor:default">
                    <div class="paciente-avatar" style="background:#1E3A5F;color:#93C5FD"><i class="bi bi-phone-fill"></i></div>
                    <div class="paciente-info">
                        <div class="paciente-nombre">${d.device.substring(0, 20)}...</div>
                        <div class="paciente-meta">${d.records} registros | ${d.exported}</div>
                    </div>
                    <span class="badge-app badge-normal">Sync OK</span>
                </div>`;
            });
            html += `</div></div>`;
        }

        html += `<div class="card-app">
            <div class="card-header"><span><i class="bi bi-info-circle"></i> Como funciona</span></div>
            <div class="card-body">
                <div style="font-size:13px;color:var(--muted);line-height:1.8">
                    <p><i class="bi bi-1-circle-fill" style="color:var(--primary)"></i> Syncthing sincroniza la carpeta <strong>/SAMAN/sync/</strong> entre dispositivos</p>
                    <p><i class="bi bi-2-circle-fill" style="color:var(--primary)"></i> Cada tableta exporta sus datos automaticamente cada 30 segundos</p>
                    <p><i class="bi bi-3-circle-fill" style="color:var(--primary)"></i> Al abrir SAMAN, fusiona los datos de otros dispositivos</p>
                    <p><i class="bi bi-4-circle-fill" style="color:var(--primary)"></i> Tap en "Sincronizar ahora" para sincronizar inmediatamente</p>
                </div>
            </div>
        </div>`;

        html += `<div class="card-app">
            <div class="card-header"><span><i class="bi bi-braces"></i> Avanzado</span></div>
            <div class="card-body">
                <p style="font-size:13px;color:var(--muted);margin-bottom:12px">Exportar/importar manualmente como archivo JSON</p>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn-app btn-sm-app btn-outline" onclick="App.handleSyncExport()"><i class="bi bi-download"></i> Exportar</button>
                    <button class="btn-app btn-sm-app btn-outline" onclick="document.getElementById('import-file').click()"><i class="bi bi-upload"></i> Importar</button>
                    <input type="file" id="import-file" accept=".json" style="display:none" onchange="App.handleSyncImport()">
                </div>
            </div>
        </div>`;

        $('page-sync-content').innerHTML = html;
    }

    async function ejecutarSync() {
        const btn = $('btn-sync-now');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Sincronizando...'; }
        const result = await Sync.syncNow();
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Sincronizar ahora'; }
        if (result.ok) {
            alert(result.msg, 'success');
            renderSync();
        } else {
            alert('Error: ' + (result.msg || 'desconocido'), 'danger');
        }
    }

    async function handleSyncExport() {
        const tables = ['usuarios', 'pacientes', 'metricas', 'visitas', 'insumos', 'entregas', 'beneficios_tengo', 'ingresos_insumos', 'logs'];
        const data = {};
        for (const t of tables) data[t] = await DB.getAll(t);
        data._exported = DB.now();
        data._version = '2.0';
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SAMAN_Backup_${DB.today()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('Datos exportados', 'success');
    }

    async function handleSyncImport() {
        const file = $('import-file').files[0];
        if (!file) { alert('Seleccione un archivo JSON', 'danger'); return; }
        if (!confirm('Esto reemplazara todos los datos actuales. Continuar?')) return;
        const text = await file.text();
        const data = JSON.parse(text);
        const tables = ['usuarios', 'pacientes', 'metricas', 'visitas', 'insumos', 'entregas', 'beneficios_tengo', 'ingresos_insumos', 'logs'];
        for (const t of tables) {
            if (data[t]) {
                await DB.clear(t);
                for (const row of data[t]) await DB.add(t, row);
            }
        }
        alert('Datos importados correctamente', 'success');
        navigate('menu');
    }

    async function renderAdmin() {
        if (!Auth.isAdmin()) { alert('Acceso denegado', 'danger'); navigate('menu'); return; }
        const usuarios = await Admin.getUsuarios();
        let html = `
            <div class="card-app"><div class="card-header"><span><i class="bi bi-person-plus"></i> Nuevo usuario</span></div>
            <div class="card-body"><form onsubmit="event.preventDefault(); App.guardarNuevoUsuario(this)">
                <div class="form-group"><label>Nombre *</label><input type="text" name="nombre" class="form-input" required></div>
                <div class="form-group"><label>Usuario *</label><input type="text" name="usuario" class="form-input" required></div>
                <div class="form-group"><label>Password</label><input type="password" name="password" class="form-input" value="123"></div>
                <div class="form-group"><label>Rol</label><select name="rol" class="form-select"><option value="voluntario">Voluntario</option><option value="admin">Admin</option></select></div>
                <button type="submit" class="btn-app btn-success"><i class="bi bi-plus-lg"></i> Crear usuario</button>
            </form></div></div>

            <div class="card-app"><div class="card-header"><span><i class="bi bi-people"></i> Usuarios (${usuarios.length})</span></div>`;
        usuarios.forEach(u => {
            html += `<div class="paciente-card" style="cursor:default">
                <div class="paciente-avatar" style="background:${u.activo ? '#065F46' : '#7F1D1D'};color:${u.activo ? '#6EE7B7' : '#FCA5A5'}">
                    <i class="bi bi-person-fill"></i>
                </div>
                <div class="paciente-info">
                    <div class="paciente-nombre">${u.usuario} <span style="font-size:12px;color:var(--muted)">${u.rol}</span></div>
                    <div class="paciente-meta">${u.nombre} | ${u.activo ? 'Activo' : 'Inactivo'}${u.ultimo_log ? ' | Ultima: ' + u.ultimo_log : ''}</div>
                </div>
                <div style="display:flex;gap:4px">
                    ${u.id !== Auth.getUser().id ? `
                        <button class="btn-app btn-sm-app btn-outline" onclick="App.toggleUsuario(${u.id})" style="padding:6px 10px"><i class="bi bi-toggle-${u.activo ? 'on' : 'off'}"></i></button>
                        <button class="btn-app btn-sm-app btn-outline" onclick="App.resetPassword(${u.id})" style="padding:6px 10px"><i class="bi bi-key"></i></button>
                        <button class="btn-app btn-sm-app btn-danger" onclick="App.eliminarUsuario(${u.id})" style="padding:6px 10px"><i class="bi bi-trash"></i></button>
                    ` : '<span class="badge-app badge-normal">Tu</span>'}
                </div>
            </div>`;
        });
        html += `</div>`;

        html += `<div style="margin-top:16px"><button class="btn-app btn-outline" onclick="App.verLogs()"><i class="bi bi-clock-history"></i> Ver logs de actividad</button></div>`;

        $('page-admin-content').innerHTML = html;
    }

    async function guardarNuevoUsuario(form) {
        const d = Object.fromEntries(new FormData(form));
        if (!d.nombre || !d.usuario) { alert('Nombre y usuario requeridos', 'danger'); return; }
        await Auth.crearUsuario(d);
        alert('Usuario creado', 'success');
        renderAdmin();
    }

    async function toggleUsuario(id) {
        await Auth.toggleUsuario(id);
        renderAdmin();
    }

    async function resetPassword(id) {
        if (!confirm('Restablecer password a "123" o identificacion?')) return;
        await Auth.resetPassword(id);
        alert('Password restablecido', 'success');
        renderAdmin();
    }

    async function eliminarUsuario(id) {
        if (!confirm('Eliminar este usuario permanentemente?')) return;
        await Auth.eliminarUsuario(id);
        alert('Usuario eliminado', 'danger');
        renderAdmin();
    }

    async function verLogs() {
        const acciones = await Admin.getAcciones();
        const logs = await Admin.getLogs();
        let html = `<div class="card-app"><div class="card-header"><span><i class="bi bi-clock-history"></i> Logs de actividad</span></div>
        <div class="card-body"><form onsubmit="event.preventDefault(); App.filtrarLogs(this)" style="display:flex;gap:8px;flex-wrap:wrap">
            <select name="accion" class="form-select" style="flex:1"><option value="">Todas las acciones</option>
                ${acciones.map(a => `<option value="${a}">${a}</option>`).join('')}
            </select>
            <button type="submit" class="btn-app btn-sm-app btn-primary"><i class="bi bi-search"></i></button>
        </form></div></div>
        <div id="logs-lista">`;
        html += renderLogsLista(logs);
        html += `</div>`;
        $('page-admin-content').innerHTML = html;
        navigate('admin');
    }

    function renderLogsLista(logs) {
        let html = '<div class="card-app"><div class="card-body">';
        if (logs.length === 0) {
            html += '<div class="empty-state"><p>Sin logs</p></div>';
        } else {
            logs.slice(0, 100).forEach(l => {
                html += `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
                    <strong style="color:var(--primary)">${l.accion}</strong> - ${l.detalle || ''}
                    <div style="color:var(--muted);font-size:12px">${l.usuario_nombre} | ${l.timestamp}</div>
                </div>`;
            });
        }
        html += '</div></div>';
        return html;
    }

    async function filtrarLogs(form) {
        const d = Object.fromEntries(new FormData(form));
        const logs = await Admin.getLogs(null, d.accion);
        $('logs-lista').innerHTML = renderLogsLista(logs);
    }

    async function loginSubmit(form) {
        try {
            const d = Object.fromEntries(new FormData(form));
            const result = await Auth.login(d.usuario, d.password);
            if (!result.ok) { alert(result.msg, 'danger'); return; }
            $('app-nav').style.display = 'flex';
            if (typeof Sync !== 'undefined' && Sync.isAndroid()) {
                try { Sync.startAutoSync(30000); } catch (e) { console.error('Sync start error:', e); }
            }
            navigate('menu');
        } catch (e) {
            console.error('Login error:', e);
            alert('Error al iniciar sesion: ' + e.message, 'danger');
        }
    }

    async function logout() {
        if (typeof Sync !== 'undefined') Sync.stopAutoSync();
        await Auth.logout();
        $('app-nav').style.display = 'none';
        pageHistory = [];
        navigate('login', false);
    }

    async function syncManual() {
        navigate('sync');
    }

    async function init() {
        try {
            await DB.init();
        } catch (e) {
            console.error('Init error:', e);
        }
        show('login');
    }

    return {
        init, navigate, back, show, alert,
        loginSubmit, logout, syncManual,
        renderPacientes, renderPacienteNuevo, searchPacientes, verPaciente, editarPaciente, darBajaPaciente, reactivarPaciente, eliminarPaciente,
        guardarNuevoPaciente, guardarEditarPaciente,
        continuarAtencion, nuevaVisita, nuevaEntrega, guardarVisita, guardarEntrega,
        editarMetrica, guardarEditarMetrica, editarEntrega, guardarEditarEntrega,
        addEntregaRow, renderInventario, formNuevoInsumo, formLlegada,
        guardarNuevoInsumo, guardarLlegada,
        renderReportes, generarReporte, generarReporteExport,
        renderBD, searchBD,
        renderSync, handleSyncExport, handleSyncImport, ejecutarSync,
        renderAdmin, guardarNuevoUsuario, toggleUsuario, resetPassword, eliminarUsuario,
        verLogs, filtrarLogs,
        loadMorePacientes
    };
})();

document.addEventListener('DOMContentLoaded', () => App.init());

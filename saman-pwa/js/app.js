const App = (() => {
    let _currentPage = null;

    function $(sel) { return document.querySelector(sel); }

    function renderHeader(title, showBack) {
        const header = $('#app-header');
        if (!header) return;
        const user = Auth.getSession();
        header.innerHTML = `
            <div>
                <img src="logo.png" class="app-logo" alt="Logo" onerror="this.style.display='none'">
                <img src="caritas_logo.png" class="app-logo" alt="Caritas" onerror="this.style.display='none'">
                ${showBack ? '<a class="back-btn" onclick="history.back()"><i class="bi bi-chevron-left"></i></a>' : ''}
            </div>
            <span class="title">${title}</span>
            ${user ? `<span style="font-size:13px;opacity:0.9"><i class="bi bi-person-circle"></i> ${user.nombre}</span>` : ''}
        `;
    }

    function renderNav(activePage) {
        const nav = $('#app-nav');
        if (!nav) return;
        const user = Auth.getSession();
        if (!user) { nav.style.display = 'none'; return; }
        nav.style.display = 'flex';
        nav.innerHTML = `
            <a onclick="App.navigate('menu')" class="${activePage === 'menu' ? 'active' : ''}">
                <i class="bi bi-house-fill"></i>Inicio
            </a>
            <a onclick="App.navigate('pacientes')" class="${activePage === 'pacientes' ? 'active' : ''}">
                <i class="bi bi-people-fill"></i>Pacientes
            </a>
            <a onclick="App.navigate('sync')" class="${activePage === 'sync' ? 'active' : ''}">
                <i class="bi bi-arrow-repeat"></i>Sync
            </a>
        `;
    }

    function showPage(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const page = $(`#page-${id}`);
        if (page) page.classList.add('active');
        _currentPage = id;
        window.scrollTo(0, 0);
    }

    function renderFlash(msg, type) {
        const el = document.createElement('div');
        el.className = `alert-app alert-${type || 'info'}`;
        el.textContent = msg;
        const container = $('.container-app');
        if (container) { container.prepend(el); setTimeout(() => el.remove(), 3000); }
    }

    async function navigate(page, data) {
        if (page !== 'login' && !Auth.isLoggedIn()) page = 'login';

        if (page === 'login') {
            renderHeader('', false);
            renderNav(null);
            showPage('login');
            return;
        }

        if (page === 'menu') {
            renderHeader('Inicio', false);
            renderNav('menu');
            const user = Auth.getSession();
            $('#page-menu-content').innerHTML = `
                <div style="margin-top:12px;text-align:center">
                    <small style="color:var(--muted)">Bienvenido, <strong>${user.nombre}</strong></small>
                </div>
                <div class="menu-grid">
                    <a class="menu-card" onclick="App.navigate('pacientes')">
                        <div class="menu-icon blue"><i class="bi bi-people-fill"></i></div>
                        <div class="menu-card-text"><strong>Pacientes</strong><small>Registrar, consultar y editar pacientes</small></div>
                        <i class="bi bi-chevron-right"></i>
                    </a>
                    <a class="menu-card" onclick="App.navigate('inventario')">
                        <div class="menu-icon orange"><i class="bi bi-box-seam-fill"></i></div>
                        <div class="menu-card-text"><strong>Inventario</strong><small>Gestionar insumos y registrar ingresos</small></div>
                        <i class="bi bi-chevron-right"></i>
                    </a>
                    <a class="menu-card" onclick="App.navigate('reportes')">
                        <div class="menu-icon green"><i class="bi bi-database-fill"></i></div>
                        <div class="menu-card-text"><strong>Base de Datos</strong><small>Tablas, reportes y exportacion</small></div>
                        <i class="bi bi-chevron-right"></i>
                    </a>
                    <a class="menu-card" onclick="App.navigate('sync')">
                        <div class="menu-icon purple"><i class="bi bi-arrow-repeat"></i></div>
                        <div class="menu-card-text"><strong>Sincronizacion</strong><small>Exportar e importar datos</small></div>
                        <i class="bi bi-chevron-right"></i>
                    </a>
                    ${user.rol === 'admin' ? `
                    <a class="menu-card" onclick="App.navigate('admin')">
                        <div class="menu-icon red"><i class="bi bi-shield-fill"></i></div>
                        <div class="menu-card-text"><strong>Administracion</strong><small>Usuarios y registro de actividad</small></div>
                        <i class="bi bi-chevron-right"></i>
                    </a>` : ''}
                    <a class="menu-card" onclick="App.logout()" style="border-color:var(--danger)">
                        <div class="menu-icon" style="background:#7F1D1D;color:#FCA5A5"><i class="bi bi-box-arrow-left"></i></div>
                        <div class="menu-card-text"><strong>Cerrar sesion</strong><small>${user.nombre}</small></div>
                        <i class="bi bi-chevron-right"></i>
                    </a>
                </div>
            `;
            showPage('menu');
            return;
        }

        if (page === 'pacientes') {
            renderHeader('Pacientes', false);
            renderNav('pacientes');
            await renderPacientesList(data);
            showPage('pacientes');
            return;
        }

        if (page === 'paciente_perfil') {
            renderHeader('Paciente', true);
            renderNav('pacientes');
            await renderPacientePerfil(data);
            showPage('paciente_perfil');
            return;
        }

        if (page === 'paciente_nuevo') {
            renderHeader('Nuevo Paciente', true);
            renderNav(null);
            await renderPacienteNuevo();
            showPage('paciente_nuevo');
            return;
        }

        if (page === 'sync') {
            renderHeader('Sincronizacion', false);
            renderNav('sync');
            showPage('sync');
            return;
        }

        showPage(page);
    }

    async function renderPacientesList(query) {
        const pacientes = await Pacientes.lista(query || '');
        const container = $('#page-pacientes-content');
        let html = `
            <div style="display:flex;gap:8px;margin-bottom:12px">
                <input type="text" id="search-pacientes" class="form-input" placeholder="Buscar paciente..."
                    value="${query || ''}" style="flex:1" onkeyup="if(event.key==='Enter')App.searchPacientes()">
                <button class="btn-app btn-sm-app btn-primary" onclick="App.searchPacientes()"><i class="bi bi-search"></i></button>
                <a class="btn-app btn-sm-app btn-success" onclick="App.navigate('paciente_nuevo')"><i class="bi bi-plus-lg"></i> Nuevo</a>
            </div>
        `;
        if (pacientes.length === 0) {
            html += `<div class="empty-state"><i class="bi bi-people"></i><p>No se encontraron pacientes</p>
                <a class="btn-app btn-sm-app btn-primary" style="margin-top:12px;width:auto" onclick="App.navigate('paciente_nuevo')"><i class="bi bi-plus-lg"></i> Primer paciente</a></div>`;
        } else {
            for (const p of pacientes) {
                const catClass = Nutricion.categoriaColor(p.categoria);
                html += `
                <div class="paciente-card" onclick="App.navigate('paciente_perfil', ${p.id})">
                    <div class="paciente-avatar"><i class="bi bi-person-fill"></i></div>
                    <div class="paciente-info">
                        <div class="paciente-nombre">${p.nombre} ${p.apellido}</div>
                        <div class="paciente-meta">
                            ${p.fecha_nac ? p.fecha_nac.substring(0, 4) : ''}
                            <span class="badge-app ${catClass}">${p.categoria}</span>
                            ${p.tengo_activo ? '<span class="badge-app badge-lactante">Tengo</span>' : ''}
                            ${!p.activo ? '<span class="badge-app badge-severa">Inactivo</span>' : ''}
                        </div>
                    </div>
                    ${p.ultima_visita ? `<div style="text-align:right"><small style="color:var(--muted);font-size:11px">${p.ultima_visita.substring(0, 10)}</small></div>` : ''}
                    <i class="bi bi-chevron-right" style="color:var(--muted);margin-left:8px"></i>
                </div>`;
            }
        }
        container.innerHTML = html;
    }

    function searchPacientes() {
        const q = document.getElementById('search-pacientes')?.value || '';
        renderPacientesList(q);
    }

    async function renderPacientePerfil(id) {
        const perfil = await Pacientes.perfil(id);
        if (!perfil) { renderFlash('Paciente no encontrado', 'danger'); navigate('pacientes'); return; }
        const { paciente, edad, categoria, visitas, metricas, entregas, tengo, alertaMonitoreo } = perfil;
        const container = $('#page-paciente_perfil-content');
        const user = Auth.getSession();

        let html = '';
        if (!paciente.activo) html += `<div class="alert-app alert-danger" style="text-align:center"><i class="bi bi-person-x-fill"></i> Paciente inactivo</div>`;
        if (alertaMonitoreo && paciente.activo) {
            html += `<div class="alert-app alert-warning" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                <span style="flex:1"><i class="bi bi-exclamation-triangle-fill"></i> ${alertaMonitoreo}</span>
            </div>`;
        }

        html += `<div class="card-app"><div class="profile-header">
            <div class="profile-avatar"><i class="bi bi-person-fill"></i></div>
            <h5 style="margin:0;font-weight:700;font-size:16px">${paciente.nombre} ${paciente.apellido}</h5>
            <div style="color:var(--muted);font-size:13px;margin:4px 0">
                ${edad} anios &middot; ${paciente.fecha_nac}
                ${paciente.sexo ? `&middot; ${paciente.sexo === 'M' ? 'Masculino' : 'Femenino'}` : ''}
            </div>
            <div class="inline-flex" style="justify-content:center;margin:6px 0">
                <span class="badge-app ${Nutricion.categoriaColor(categoria)}">${categoria}</span>
                ${!paciente.activo ? '<span class="badge-app badge-severa">Inactivo</span>' : ''}
                ${tengo && tengo.activa ? '<span class="badge-app badge-lactante">Tengo activo</span>' : ''}
            </div>
            ${paciente.cedula || paciente.telefono || paciente.direccion ? `
            <div style="font-size:12px;color:var(--muted);margin-top:4px">
                ${paciente.cedula ? `<div><i class="bi bi-card-text"></i> ${paciente.cedula}</div>` : ''}
                ${paciente.telefono ? `<div><i class="bi bi-telephone"></i> ${paciente.telefono}</div>` : ''}
                ${paciente.direccion ? `<div><i class="bi bi-geo-alt"></i> ${paciente.direccion}</div>` : ''}
            </div>` : ''}
            <div style="margin-top:8px;display:flex;gap:6px;justify-content:center">
                ${!paciente.activo ? `<a class="btn-app btn-sm-app btn-success" onclick="App.reactivarPaciente(${paciente.id})"><i class="bi bi-play-fill"></i> Reactivar</a>` : ''}
                ${user.rol === 'admin' ? `<a class="btn-app btn-sm-app btn-danger" onclick="App.eliminarPaciente(${paciente.id}, '${paciente.nombre} ${paciente.apellido}')"><i class="bi bi-trash-fill"></i> Eliminar</a>` : ''}
            </div>
        </div></div>`;

        html += `<div class="card-app"><div class="card-header"><span><i class="bi bi-calendar-check"></i> Visitas</span></div><div class="card-body" style="padding:0">`;
        if (visitas.length === 0) {
            html += `<div class="empty-state"><i class="bi bi-calendar-x"></i><p>Sin visitas registradas</p></div>`;
        } else {
            for (const v of visitas) {
                html += `<div style="padding:14px 16px;border-bottom:1px solid var(--border)">
                    <div style="display:flex;justify-content:space-between">
                        <strong style="font-size:14px">${v.fecha.substring(0, 10)}</strong>
                        <span class="badge-app" style="background:var(--nav);color:var(--muted)">${v.tipo}</span>
                    </div>
                    <small style="color:var(--muted)">${v.usuario_nombre || '&mdash;'}</small>
                    ${v.observaciones ? `<div style="margin-top:4px;font-size:13px;color:var(--muted)">${v.observaciones}</div>` : ''}
                </div>`;
            }
        }
        html += `</div></div>`;

        html += `<div class="card-app"><div class="card-header"><span><i class="bi bi-graph-up"></i> Metricas</span></div><div class="card-body" style="padding:0">`;
        if (metricas.length === 0) {
            html += `<div class="empty-state"><i class="bi bi-bar-chart"></i><p>Sin metricas registradas</p></div>`;
        } else {
            for (const m of metricas) {
                html += `<div style="padding:14px 16px;border-bottom:1px solid var(--border)">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                        <small style="color:var(--muted)"><i class="bi bi-calendar3"></i> ${m.fecha.substring(0, 10)}</small>
                        <small style="color:var(--muted)">${m.usuario_nombre || '&mdash;'}</small>
                    </div>
                    <div class="metric-row">
                        <div class="metric-item"><div class="value">${m.talla}</div><div class="label">Talla cm</div></div>
                        <div class="metric-item"><div class="value">${m.peso}</div><div class="label">Peso kg</div></div>
                        ${m.perimetro_brazo ? `<div class="metric-item"><div class="value">${m.perimetro_brazo}</div><div class="label">Perimetro</div></div>` : ''}
                        <div class="metric-item">
                            <div class="value">
                                ${m.z_score !== null && m.z_score !== undefined ?
                                    `<span class="z-score ${m.zclass}">${m.z_score}</span><span style="font-size:11px;color:var(--muted);display:block">${m.zlabel}</span>`
                                    : '&mdash;'}
                            </div>
                            <div class="label">Z-score</div>
                        </div>
                    </div>
                </div>`;
            }
        }
        html += `</div></div>`;

        html += `<div class="card-app"><div class="card-header"><span><i class="bi bi-box-seam"></i> Insumos entregados</span></div><div class="card-body" style="padding:0">`;
        if (entregas.length === 0) {
            html += `<div class="empty-state"><i class="bi bi-box"></i><p>Sin entregas registradas</p></div>`;
        } else {
            for (const e of entregas) {
                html += `<div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <strong style="font-size:14px">${e.insumo_nombre}</strong>
                        <div><small style="color:var(--muted)">${e.fecha.substring(0, 10)} &middot; ${e.usuario_nombre || '&mdash;'}</small></div>
                    </div>
                    <span style="font-weight:700;font-size:15px">${e.cantidad} ${e.unidad}</span>
                </div>`;
            }
        }
        html += `</div></div>`;

        container.innerHTML = html;
    }

    async function renderPacienteNuevo() {
        const container = $('#page-paciente_nuevo-content');
        container.innerHTML = `
            <div class="card-app"><div class="card-header"><span>Datos personales</span></div><div class="card-body">
                <form id="form-paciente-nuevo" onsubmit="App.submitPacienteNuevo(event)">
                    <div class="form-group"><label>Nombre *</label><input type="text" class="form-input" name="nombre" required></div>
                    <div class="form-group"><label>Apellido *</label><input type="text" class="form-input" name="apellido" required></div>
                    <div class="form-group"><label>Fecha de nacimiento *</label><input type="date" class="form-input" name="fecha_nac" required></div>
                    <div class="form-group"><label>Sexo</label>
                        <select class="form-select" name="sexo">
                            <option value="">Seleccionar...</option>
                            <option value="M">Masculino</option>
                            <option value="F">Femenino</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Cedula</label><input type="text" class="form-input" name="cedula"></div>
                    <div class="form-group"><label>Telefono</label><input type="text" class="form-input" name="telefono"></div>
                    <div class="form-group"><label>Direccion</label><input type="text" class="form-input" name="direccion"></div>
                    <div style="display:flex;gap:12px;margin-bottom:12px">
                        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted)">
                            <input type="checkbox" name="embarazada" value="1"> Embarazada
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted)">
                            <input type="checkbox" name="lactante" value="1"> Lactante
                        </label>
                    </div>
                    <button type="submit" class="btn-app btn-success"><i class="bi bi-check-lg"></i> Guardar paciente</button>
                </form>
            </div></div>
        `;
    }

    async function submitPacienteNuevo(e) {
        e.preventDefault();
        const form = e.target;
        const user = Auth.getSession();
        const data = {
            nombre: form.nombre.value.trim(),
            apellido: form.apellido.value.trim(),
            fecha_nac: form.fecha_nac.value,
            sexo: form.sexo.value,
            cedula: form.cedula.value.trim(),
            telefono: form.telefono.value.trim(),
            direccion: form.direccion.value.trim(),
            embarazada: form.embarazada.checked ? 1 : 0,
            lactante: form.lactante.checked ? 1 : 0,
            cuidador_nombre: '', cuidador_apellido: '', cuidador_cedula: '', cuidador_telefono: '',
            activo: 1,
            creado_por: user ? user.id : null,
            creado_en: DB.now()
        };
        const id = await Pacientes.crear(data);
        await DB.log(user.id, 'Paciente creado', `${data.nombre} ${data.apellido}`);
        navigate('paciente_perfil', id);
    }

    async function eliminarPaciente(id, nombre) {
        if (!confirm(`Eliminar a ${nombre} y todos sus datos?`)) return;
        await Pacientes.eliminar(id);
        const user = Auth.getSession();
        await DB.log(user.id, 'Paciente eliminado', nombre);
        navigate('pacientes');
    }

    async function reactivarPaciente(id) {
        const p = await DB.getById('pacientes', id);
        if (p) {
            p.activo = 1;
            await DB.put('pacientes', p);
            const user = Auth.getSession();
            await DB.log(user.id, 'Paciente reactivado', `${p.nombre} ${p.apellido}`);
            navigate('paciente_perfil', id);
        }
    }

    async function handleSyncExport() {
        const data = await DB.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `saman_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        renderFlash('Datos exportados correctamente', 'success');
    }

    async function handleSyncImport() {
        const input = document.getElementById('import-file');
        if (!input.files.length) { renderFlash('Selecciona un archivo JSON', 'danger'); return; }
        if (!confirm('Esto reemplazara todos los datos actuales. Continuar?')) return;
        const text = await input.files[0].text();
        const data = JSON.parse(text);
        await DB.importAll(data);
        renderFlash('Datos importados correctamente', 'success');
        navigate('menu');
    }

    async function logout() {
        await Auth.logout();
        navigate('login');
    }

    function init() {
        navigate('login');
    }

    async function loginSubmit(form) {
        const usuario = form.usuario.value.trim();
        const password = form.password.value;
        const user = await Auth.login(usuario, password);
        if (user) {
            navigate('menu');
        } else {
            renderFlash('Usuario o contrasena incorrectos', 'danger');
        }
    }

    return {
        navigate, init, searchPacientes, submitPacienteNuevo,
        eliminarPaciente, reactivarPaciente, handleSyncExport, handleSyncImport, logout, renderFlash, loginSubmit
    };
})();

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await DB.open();
        await DB.seedAdmin();
        App.init();
    } catch (err) {
        console.error('Init error:', err);
        document.querySelector('.container-app').innerHTML =
            '<div class="alert-app alert-danger" style="margin-top:20px"><strong>Error al iniciar:</strong> ' + err.message + '</div>';
    }
});

const Auth = (() => {
    let currentUser = null;

    async function sha256(str) {
        const K = [
            0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
            0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
            0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
            0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
            0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
            0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
            0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
            0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
        ];
        const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
        const bytes = new TextEncoder().encode(str);
        const l = bytes.length * 8;
        const pl = (56 - ((bytes.length + 1) % 64) + 64) % 64;
        const msg = new Uint8Array(bytes.length + 1 + pl + 8);
        msg.set(bytes); msg[bytes.length] = 0x80;
        const dv = new DataView(msg.buffer);
        dv.setUint32(msg.length - 8, Math.floor(l / 0x100000000), false);
        dv.setUint32(msg.length - 4, l >>> 0, false);
        let h = H.map(x => x);
        for (let i = 0; i < msg.length; i += 64) {
            const W = new Array(64);
            for (let j = 0; j < 16; j++) W[j] = dv.getUint32(i + j * 4, false);
            for (let j = 16; j < 64; j++) {
                const s0 = ((W[j-15]>>>7)|(W[j-15]<<25)) ^ ((W[j-15]>>>18)|(W[j-15]<<14)) ^ (W[j-15]>>>3);
                const s1 = ((W[j-2]>>>17)|(W[j-2]<<15)) ^ ((W[j-2]>>>19)|(W[j-2]<<13)) ^ (W[j-2]>>>10);
                W[j] = (W[j-16] + s0 + W[j-7] + s1) | 0;
            }
            let [a,b,c,d,e,f,g,hh] = h;
            for (let j = 0; j < 64; j++) {
                const S1 = ((e>>>6)|(e<<26)) ^ ((e>>>11)|(e<<21)) ^ ((e>>>25)|(e<<7));
                const ch = (e&f) ^ (~e&g);
                const t1 = (hh + S1 + ch + K[j] + W[j]) | 0;
                const S0 = ((a>>>2)|(a<<30)) ^ ((a>>>13)|(a<<19)) ^ ((a>>>22)|(a<<10));
                const maj = (a&b) ^ (a&c) ^ (b&c);
                const t2 = (S0 + maj) | 0;
                hh = g; g = f; f = e; e = (d + t1) | 0;
                d = c; c = b; b = a; a = (t1 + t2) | 0;
            }
            h = [(h[0]+a)|0,(h[1]+b)|0,(h[2]+c)|0,(h[3]+d)|0,(h[4]+e)|0,(h[5]+f)|0,(h[6]+g)|0,(h[7]+hh)|0];
        }
        return h.map(x => (x>>>0).toString(16).padStart(8,'0')).join('');
    }

    async function login(usuario, password) {
        try {
            const usuarios = await DB.getAll('usuarios');
            console.log('Usuarios:', usuarios.length);
            const u = usuarios.find(x => x.usuario === usuario && x.activo === 1);
            if (!u) {
                console.log('Usuario no encontrado:', usuario);
                return { ok: false, msg: 'Usuario no encontrado o inactivo' };
            }
            const hash = await sha256(password);
            console.log('Hash:', hash);
            console.log('Expected:', u.password);
            if (u.password !== hash) return { ok: false, msg: 'Contrasena incorrecta' };
            u.ultima_sesion = DB.now();
            try { await DB.put('usuarios', u); } catch (e) { console.error('Update session error:', e); }
            currentUser = u;
            try { await DB.log(u.id, 'Inicio de sesion', u.usuario); } catch (e) { console.error('Log error:', e); }
            return { ok: true, user: u };
        } catch (e) {
            console.error('Login exception:', e);
            return { ok: false, msg: 'Error: ' + e.message };
        }
    }

    async function logout() {
        if (currentUser) {
            await DB.log(currentUser.id, 'Cierre de sesion', currentUser.usuario);
        }
        currentUser = null;
    }

    function getUser() { return currentUser; }
    function isAdmin() { return currentUser && currentUser.rol === 'admin'; }
    function isLoggedIn() { return currentUser !== null; }

    async function getUsuarios() { return DB.getAll('usuarios'); }

    async function crearUsuario(data) {
        const hash = await sha256(data.password || '123');
        const u = await DB.add('usuarios', {
            nombre: data.nombre,
            usuario: data.usuario,
            identificacion: data.identificacion || '',
            password: hash,
            rol: data.rol || 'voluntario',
            activo: 1,
            ultima_sesion: null
        });
        await DB.log(currentUser.id, 'Crear usuario', data.usuario);
        return u;
    }

    async function toggleUsuario(id) {
        const u = await DB.get('usuarios', id);
        if (!u || u.id === currentUser.id) return false;
        u.activo = u.activo === 1 ? 0 : 1;
        await DB.put('usuarios', u);
        await DB.log(currentUser.id, 'Toggle usuario', u.usuario);
        return true;
    }

    async function resetPassword(id) {
        const u = await DB.get('usuarios', id);
        if (!u) return false;
        u.password = await sha256(u.identificacion || '123');
        await DB.put('usuarios', u);
        await DB.log(currentUser.id, 'Reset password', u.usuario);
        return true;
    }

    async function eliminarUsuario(id) {
        const u = await DB.get('usuarios', id);
        if (!u || u.id === currentUser.id) return false;
        const metricas = await DB.getAll('metricas');
        for (const m of metricas) {
            if (m.usuario_id === id) { m.usuario_id = null; await DB.put('metricas', m); }
        }
        const visitas = await DB.getAll('visitas');
        for (const v of visitas) {
            if (v.usuario_id === id) { v.usuario_id = null; await DB.put('visitas', v); }
        }
        const entregas = await DB.getAll('entregas');
        for (const e of entregas) {
            if (e.usuario_id === id) { e.usuario_id = null; await DB.put('entregas', e); }
        }
        const ing = await DB.getAll('ingresos_insumos');
        for (const i of ing) {
            if (i.usuario_id === id) { i.usuario_id = null; await DB.put('ingresos_insumos', i); }
        }
        const logs = await DB.getAll('logs');
        for (const l of logs) {
            if (l.usuario_id === id) { l.usuario_id = null; await DB.put('logs', l); }
        }
        const pacientes = await DB.getAll('pacientes');
        for (const p of pacientes) {
            if (p.creado_por === id) { p.creado_por = null; await DB.put('pacientes', p); }
        }
        await DB.del('usuarios', id);
        await DB.log(currentUser.id, 'Eliminar usuario', u.usuario);
        return true;
    }

    return { login, logout, getUser, isAdmin, isLoggedIn, sha256, getUsuarios, crearUsuario, toggleUsuario, resetPassword, eliminarUsuario };
})();

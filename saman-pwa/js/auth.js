const Auth = (() => {
    function getSession() {
        const s = sessionStorage.getItem('saman_user');
        return s ? JSON.parse(s) : null;
    }

    function setSession(user) {
        sessionStorage.setItem('saman_user', JSON.stringify(user));
    }

    function clearSession() {
        sessionStorage.removeItem('saman_user');
    }

    async function hashPassword(pw) {
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

    async function login(usuario, password) {
        const users = await DB.getAll('usuarios');
        const hash = await hashPassword(password);
        const user = users.find(u => u.usuario === usuario.toLowerCase().trim() && u.activo === 1 && u.password === hash);
        if (!user) return null;
        const session = { id: user.id, nombre: user.nombre, rol: user.rol };
        setSession(session);
        await DB.log(user.id, 'Inicio de sesion', `Usuario: ${user.nombre}`);
        return session;
    }

    async function logout() {
        const session = getSession();
        if (session) {
            await DB.log(session.id, 'Cierre de sesion', `Usuario: ${session.nombre}`);
        }
        clearSession();
    }

    function isLoggedIn() {
        return getSession() !== null;
    }

    function requireAuth() {
        if (!isLoggedIn()) {
            App.navigate('login');
            return false;
        }
        return true;
    }

    function requireAdmin() {
        const s = getSession();
        if (!s || s.rol !== 'admin') {
            App.navigate('menu');
            return false;
        }
        return true;
    }

    return { getSession, login, logout, isLoggedIn, requireAuth, requireAdmin, hashPassword };
})();

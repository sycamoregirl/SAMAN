const Nutricion = (() => {
    const REF_LMS = {
        M: {
            0: [-0.3, 13.4, 0.09], 1: [-0.3, 14.2, 0.09], 2: [-0.3, 15.4, 0.09],
            3: [-0.3, 16.1, 0.09], 4: [-0.3, 16.6, 0.09], 5: [-0.3, 16.9, 0.09],
            6: [-0.3, 17.0, 0.09], 7: [-0.3, 17.1, 0.09], 8: [-0.3, 17.1, 0.09],
            9: [-0.3, 17.1, 0.09], 10: [-0.3, 17.1, 0.09], 11: [-0.3, 17.0, 0.09],
            12: [-0.3, 17.0, 0.09], 15: [-0.3, 16.8, 0.09], 18: [-0.3, 16.5, 0.09],
            21: [-0.3, 16.3, 0.09], 24: [-0.3, 16.0, 0.09], 30: [-0.3, 15.7, 0.09],
            36: [-0.3, 15.5, 0.09], 42: [-0.3, 15.4, 0.09], 48: [-0.3, 15.3, 0.09],
            54: [-0.3, 15.3, 0.09], 59: [-0.3, 15.3, 0.09],
            60: [1, 15.1, 4.6], 61: [1, 15.2, 4.7], 62: [1, 15.3, 4.8],
            63: [1, 15.4, 4.9], 64: [1, 15.5, 5.0], 65: [1, 15.6, 5.1],
            66: [1, 15.7, 5.2], 67: [1, 15.8, 5.3], 68: [1, 15.9, 5.4],
            69: [1, 16.0, 5.5], 70: [1, 16.1, 5.6], 71: [1, 16.2, 5.7],
            72: [1, 15.8, 4.8], 84: [1, 15.6, 4.6], 96: [1, 15.7, 4.5],
            108: [1, 15.8, 4.5], 120: [1, 16.0, 4.6], 132: [1, 16.3, 4.7],
            144: [1, 16.7, 4.9], 156: [1, 17.2, 5.1], 168: [1, 17.8, 5.4],
            180: [1, 18.5, 5.7], 192: [1, 19.2, 6.0], 204: [1, 19.9, 6.3],
            216: [1, 20.6, 6.6], 228: [1, 21.2, 6.8],
        },
        F: {
            0: [-0.3, 13.1, 0.09], 1: [-0.3, 13.9, 0.09], 2: [-0.3, 15.0, 0.09],
            3: [-0.3, 15.7, 0.09], 4: [-0.3, 16.2, 0.09], 5: [-0.3, 16.5, 0.09],
            6: [-0.3, 16.5, 0.09], 7: [-0.3, 16.6, 0.09], 8: [-0.3, 16.6, 0.09],
            9: [-0.3, 16.6, 0.09], 10: [-0.3, 16.6, 0.09], 11: [-0.3, 16.5, 0.09],
            12: [-0.3, 16.5, 0.09], 15: [-0.3, 16.4, 0.09], 18: [-0.3, 16.1, 0.09],
            21: [-0.3, 15.9, 0.09], 24: [-0.3, 15.7, 0.09], 30: [-0.3, 15.5, 0.09],
            36: [-0.3, 15.3, 0.09], 42: [-0.3, 15.2, 0.09], 48: [-0.3, 15.1, 0.09],
            54: [-0.3, 15.1, 0.09], 59: [-0.3, 15.1, 0.09],
            60: [1, 15.0, 4.6], 61: [1, 15.1, 4.7], 62: [1, 15.2, 4.8],
            63: [1, 15.3, 4.9], 64: [1, 15.4, 5.0], 65: [1, 15.5, 5.1],
            66: [1, 15.6, 5.2], 67: [1, 15.7, 5.3], 68: [1, 15.8, 5.4],
            69: [1, 15.9, 5.5], 70: [1, 16.0, 5.6], 71: [1, 16.1, 5.7],
            72: [1, 15.6, 4.7], 84: [1, 15.4, 4.5], 96: [1, 15.4, 4.4],
            108: [1, 15.5, 4.4], 120: [1, 15.7, 4.5], 132: [1, 16.0, 4.6],
            144: [1, 16.4, 4.8], 156: [1, 16.9, 5.0], 168: [1, 17.5, 5.3],
            180: [1, 18.1, 5.6], 192: [1, 18.8, 5.9], 204: [1, 19.5, 6.2],
            216: [1, 20.1, 6.5], 228: [1, 20.7, 6.7],
        }
    };

    function getEdad(fechaNac) {
        const nac = new Date(fechaNac);
        const hoy = new Date();
        let edad = hoy.getFullYear() - nac.getFullYear();
        if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
        return edad;
    }

    function getEdadMeses(fechaNac) {
        const nac = new Date(fechaNac);
        const hoy = new Date();
        return (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth());
    }

    function clasificarPaciente(edad, embarazada, lactante) {
        if (embarazada) return 'Embarazada';
        if (lactante) return 'Lactante';
        if (edad < 10) return 'Nino';
        return 'Adulto';
    }

    function calcularZScore(peso, tallaCm, edadMeses, sexo) {
        if (sexo !== 'M' && sexo !== 'F') return null;
        if (tallaCm <= 0 || peso <= 0) return null;
        try {
            const imc = peso / Math.pow(tallaCm / 100, 2);
            const ref = REF_LMS[sexo];
            if (!ref) return null;
            const ages = Object.keys(ref).map(Number).sort((a, b) => a - b);
            if (!ages.length) return null;
            let closest = ages[0];
            let minDiff = Math.abs(ages[0] - edadMeses);
            for (let i = 1; i < ages.length; i++) {
                const diff = Math.abs(ages[i] - edadMeses);
                if (diff < minDiff) { minDiff = diff; closest = ages[i]; }
            }
            const [L, M, S] = ref[closest];
            if (L === 0) return Math.round(Math.log(imc / M) / S * 100) / 100;
            return Math.round((Math.pow(imc / M, L) - 1) / (L * S) * 100) / 100;
        } catch { return null; }
    }

    function clasificarDesnutricion(peso, talla, perimetroBrazo) {
        if (talla <= 0) return 'Sin datos';
        const imc = Math.round(peso / Math.pow(talla / 100, 2) * 10) / 10;
        if (perimetroBrazo) {
            if (perimetroBrazo < 19) return 'Severa';
            if (perimetroBrazo < 22) return 'Moderada';
            if (perimetroBrazo < 23) return 'Leve';
        }
        if (imc < 16) return 'Severa';
        if (imc < 17) return 'Moderada';
        if (imc < 18.5) return 'Leve';
        return 'Normal';
    }

    function categoriaColor(cat) {
        const colors = { Embarazada: 'badge-embarazada', Lactante: 'badge-lactante', Nino: 'badge-nino', Adulto: 'badge-normal' };
        return colors[cat] || 'badge-normal';
    }

    function interpretarZScore(z) {
        if (z === null || z === undefined) return ['', ''];
        if (z < -3) return ['Severa', 'z-severa'];
        if (z < -2) return ['Moderada', 'z-moderada'];
        if (z < -1) return ['Leve', 'z-leve'];
        if (z <= 1.5) return ['Normal', 'z-normal'];
        return ['Sobrepeso', 'z-moderada'];
    }

    return { getEdad, getEdadMeses, clasificarPaciente, calcularZScore, clasificarDesnutricion, categoriaColor, interpretarZScore };
})();

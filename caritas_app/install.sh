#!/data/data/com.termux/files/usr/bin/bash
# install.sh - Instalación de S.A.M.A.N en Termux
# Ejecutar UNA SOLA VEZ: bash install.sh

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BOLD}${GREEN}"
echo "  ╔══════════════════════════════╗"
echo "  ║     S.A.M.A.N                ║"
echo "  ║  Instalación en Termux       ║"
echo "  ╚══════════════════════════════╝"
echo -e "${NC}"

# 1. Permiso de almacenamiento
echo -e "${YELLOW}[1/6]${NC} Solicitando permiso de almacenamiento..."
termux-setup-storage
sleep 2

# 2. Copiar la app al home de Termux
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$HOME/caritas_app"
echo -e "${YELLOW}[2/6]${NC} Copiando archivos a $APP_DIR..."
rm -rf "$APP_DIR"
cp -r "$SCRIPT_DIR" "$APP_DIR"
cd "$APP_DIR" || exit 1

# 3. Actualizar paquetes
echo -e "${YELLOW}[3/6]${NC} Actualizando paquetes..."
pkg update -y && pkg upgrade -y

# 4. Instalar Python y dependencias
echo -e "${YELLOW}[4/6]${NC} Instalando Python..."
pkg install python -y

echo -e "${YELLOW}[4/6]${NC} Instalando dependencias Python..."
pip install flask openpyxl pandas werkzeug

# 5. Configurar arranque automático (Termux:Boot)
echo -e "${YELLOW}[5/6]${NC} Configurando arranque automático..."
BOOT_DIR="$HOME/.termux/boot"
mkdir -p "$BOOT_DIR"

cat > "$BOOT_DIR/start-saman.sh" << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
cd ~/caritas_app
python app.py &
EOF

chmod +x "$BOOT_DIR/start-saman.sh"

# 6. Crear script de inicio manual
cat > "$PREFIX/bin/saman" << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
cd ~/caritas_app
echo "Iniciando S.A.M.A.N..."
echo "Abre Chrome y entra a http://localhost:5000"
python app.py
EOF
chmod +x "$PREFIX/bin/saman"

# Limpiar BD por si venía con datos de prueba
rm -f "$APP_DIR/caritas.db"

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║        INSTALACIÓN COMPLETADA               ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}PASOS SIGUIENTES:${NC}"
echo ""
echo " 1. Cierra Termux completamente (desliza la app hacia arriba)"
echo ""
echo " 2. Reinicia la tablet UNA SOLA VEZ"
echo "    → Al encender, el servidor arrancará automáticamente"
echo ""
echo " 3. Abre Chrome y ve a:"
echo -e "    ${BOLD}http://localhost:5000${NC}"
echo ""
echo " 4. En Chrome, toca el menú (tres puntos) →"
echo "    'Agregar a pantalla de inicio' → 'Instalar'"
echo "    → Aparecerá el icono de S.A.M.A.N en el escritorio"
echo ""
echo " 5. A partir de ahora: solo toca el icono y la app abre"
echo "    como cualquier app normal"
echo ""
echo -e "${YELLOW}Si no funciona el arranque automático:${NC}"
echo "  - Abre Termux y escribe:  saman"
echo "  - Luego abre Chrome en http://localhost:5000"
echo ""

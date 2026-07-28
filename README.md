# S.A.M.A.N - Sistema de Alerta, Monitoreo, Atención Nutricional y Salud

Aplicación de monitoreo nutricional para el programa de atención médica y nutricional de la Fundación Caritas de Venezuela.

## Características

- **Pacientes**: CRUD completo, visitas, entregas de alimento, métricas antropométricas (peso, talla, perímetro cefálico)
- **Clasificación OMS**: Curvas z-score (peso/edad, peso/talla, talla/edad) con tabla LMS completa
- **Inventario**: 13 insumos pre-cargados (suplementos, kits médicos, desparasitantes, filtros de agua)
- **Reportes**: Filtros por paciente, período, tipo; exportación a CSV
- **Sincronización**: Archivos JSON por dispositivo (`SAMAN_<device_id>.json`) en `/SAMAN/sync/`, merge bidireccional por timestamp `_modified`
- **Administración**: Gestión de usuarios, bitácora de actividad, cambio de contraseñas
- **Multi-dispositivo**: Soporte para N dispositivos sincronizados vía Syncthing

## Estructura

```
SAMAN/
├── android-app/           # APK standalone (WebView + IndexedDB)
│   ├── AndroidManifest.xml
│   ├── build.ps1          # Script de compilación (PowerShell)
│   ├── assets/            # HTML, CSS, JS, fuentes, iconos
│   ├── res/               # Recursos Android (iconos, strings)
│   └── src/               # Java (MainActivity + SyncBridge)
├── caritas_app/           # Versión Flask/Python original (servidor)
│   ├── app.py             # Rutas Flask
│   ├── main.py            # Entry point
│   ├── requirements.txt
│   ├── database/          # SQLite + schema SQL
│   ├── templates/         # Jinja2 templates
│   └── static/            # CSS, iconos, logos
└── README.md
```

## Requisitos para compilar el APK

- Android SDK (build-tools 35+, platform android-33+)
- JDK 8+
- PowerShell (Windows)

## Compilar el APK

```powershell
cd android-app
.\build.ps1
```

El APK se genera en `android-app/SAMAN.apk` (~560 KB).

## Instalar en Android

```bash
adb install SAMAN.apk
```

## Credenciales por defecto

- Usuario: `admin`
- Contraseña: `admin`

## Sincronización con Syncthing

1. Instalar Syncthing en cada dispositivo
2. Compartir la carpeta `/SAMAN/sync/` entre dispositivos
3. El app sincroniza automáticamente cada 30 segundos (cada dispositivo escribe su propio archivo `SAMAN_<device_id>.json`)
4. Al detectar nuevos archivos, el app fusiona automáticamente los datos

## Datos pre-cargados

- 13 insumos de inventario (vitamina en polvo, suero rehidratante, barras, desparasitantes, kits de parto/higiene, filtros de agua, etc.)
- Tabla OMS completa para clasificación nutricional infantil

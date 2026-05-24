# Skilled ERP — Frontend

SPA en React + Vite para el sistema de nóminas e inventario Skilled. Consume la API JSON del backend Flask (repo aparte: `Sistema de nominas/`).

---

## Stack

- **React 18** + **Vite 5**
- **React Router 6** para navegación
- **Tailwind 3** para estilos
- **Axios** con interceptores JWT (refresh transparente)
- **Recharts** para los gráficos del dashboard
- **html5-qrcode** para los scanners QR (móvil)
- **lucide-react** para iconografía

---

## Desarrollo local

```bash
npm install
cp .env.example .env.local        # ajusta VITE_API_URL al backend local
npm run dev                       # http://localhost:5173
```

Para que el SPA hable con tu backend local:

```bash
# .env.local
VITE_API_URL=http://localhost:5000/api
```

El backend debe correr con `CORS_ORIGINS=http://localhost:5173` en su `.env`.

---

## Build

```bash
npm run build                     # genera dist/
npm run preview                   # sirve dist/ local en :4173 para verificar
```

---

## Deploy a Vercel

### 1. Variables de entorno

En el dashboard de Vercel → **Settings → Environment Variables**:

| Variable | Valor | Scope |
|---|---|---|
| `VITE_API_URL` | `https://app.skilledmx.cloud/api` (la URL real del backend, terminada en `/api` sin slash final) | Production, Preview, Development |

> Vercel **no** lee `.env.production` del repo si la misma variable existe en la UI — la UI gana. `.env.production` queda como fallback documental.

### 2. Build settings (auto-detectados por `vercel.json`)

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

No hay que tocar nada en la UI; el `vercel.json` ya fija estos valores.

### 3. Lo que `vercel.json` hace

- **SPA rewrite:** cualquier ruta cae en `/index.html` para que React Router se encargue.
- **Cache headers** agresivos en `/assets/*` y archivos versionados (1 año).
- **Security headers** (X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy con cámara habilitada — necesaria para los scanners QR).

### 4. Lo que debe configurarse del lado Flask

En el `.env` del servidor backend (junto a Gunicorn) hay que setear/verificar:

```bash
# Permite a Vercel hablar con tu API (cross-origin)
CORS_ORIGINS=https://<tu-proyecto>.vercel.app,https://app.skilled.com.mx

# Cross-origin requiere SameSite=None en la refresh-cookie (fuerza Secure)
RT_COOKIE_SAMESITE=None

# Apaga las rutas HTML Jinja viejas (la UI ya vive en Vercel)
LEGACY_UI_ENABLED=false

# Producción
FLASK_ENV=production
```

Si tienes un dominio custom (`app.skilled.com.mx`) apuntando a Vercel, agrégalo a `CORS_ORIGINS`.

### 5. PWA — manifest

`manifest.json` y los íconos viven en `/public`. Después del deploy, los usuarios pueden "Agregar a pantalla de inicio" en móvil y la app se abre en standalone con el ícono Skilled y splash con `theme_color: #2563eb`.

### 6. Quick checklist

- [ ] `VITE_API_URL` en Vercel apunta a tu API real.
- [ ] `CORS_ORIGINS` en el `.env` del servidor incluye el dominio Vercel.
- [ ] `RT_COOKIE_SAMESITE=None` si frontend y API están en dominios distintos.
- [ ] `LEGACY_UI_ENABLED=false` para apagar las rutas Jinja viejas.
- [ ] Reiniciar Gunicorn (`systemctl restart gunicorn`) tras cambiar el `.env`.
- [ ] Hacer push a la rama conectada a Vercel — el deploy es automático.

---

## Estructura del proyecto

```text
plantilla-frontend/
├── public/
│   ├── icons/              # PWA icons (256, 512, maskable)
│   ├── manifest.json       # PWA manifest
│   └── logo*.png           # Logos para sidebar y favicons
├── src/
│   ├── api/                # Wrappers de axios por módulo (1:1 con app/routes/api_*.py)
│   ├── components/         # UI compartida (Layout, Sidebar, Topbar, ui/*)
│   ├── config/             # Configuración (menús por rol)
│   ├── context/            # AuthContext, ThemeContext
│   ├── hooks/              # Hooks reusables (useIsMobile, useAuthenticatedBlob)
│   ├── pages/              # Una carpeta por módulo del sistema
│   │   ├── ajustes/
│   │   ├── credenciales/
│   │   ├── empleados/
│   │   ├── ficha/
│   │   ├── historico/
│   │   ├── horas/
│   │   ├── inventario/
│   │   ├── manual/
│   │   ├── prenomina/
│   │   ├── prestamos/
│   │   ├── proyecto-total/
│   │   ├── proyectos/
│   │   ├── Dashboard.jsx
│   │   ├── Login.jsx
│   │   └── ...
│   ├── utils/              # Helpers (apiError, formato)
│   ├── App.jsx             # Routing principal con role-gating
│   ├── main.jsx
│   └── index.css           # Tailwind directives
├── .env.example            # Plantilla para .env.local
├── .env.production         # VITE_API_URL para builds de producción
├── vercel.json             # Config de deploy en Vercel
├── tailwind.config.js
├── postcss.config.js
└── vite.config.js
```

---

## Roles y rutas

El acceso por rol se controla en `src/App.jsx` con `<RoleRoute allow={...}>` y los menús laterales en `src/config/menus.js`.

| Rol | Home tras login | Puede ver |
|---|---|---|
| `admin` / `super_admin` | `/` (Dashboard) | Todo |
| `coordinador` | `/horas` | Mis Proyectos, Credenciales, Reporte de Horas, Ficha Técnica, Manual |
| `inventario` | `/inventario` | Solo módulo de inventario |
| `solicitante_material` | `/inventario/mis-pedidos` | Solo crear y ver sus pedidos |

---

## API parity

Cada archivo en `src/api/` mapea 1:1 con un blueprint `api_*.py` del backend. Para verificar parity:

| Frontend | Backend |
|---|---|
| `src/api/auth.js` + `AuthContext.jsx` | `app/routes/api_auth.py` (`/api/auth`) |
| `src/api/users.js` | `app/routes/api_users.py` (`/api/users`) |
| `src/api/trabajadores.js` + `credenciales.js` | `app/routes/api_trabajadores.py` (`/api/trabajadores`) |
| `src/api/proyectos.js` | `app/routes/api_proyectos.py` (`/api/proyectos`) |
| `src/api/horas.js` | `app/routes/api_horas.py` (`/api/horas`) |
| `src/api/prenomina.js` | `app/routes/api_prenomina.py` (`/api/prenomina`) |
| `src/api/prestamos.js` | `app/routes/api_prestamos.py` (`/api/prestamos`) |
| `src/api/ajustes.js` | `app/routes/api_ajustes.py` (`/api/ajustes`) |
| `src/api/historico.js` | `app/routes/api_historico.py` (`/api/historico`) |
| `src/api/proyectoTotal.js` | `app/routes/api_proyecto_total.py` (`/api/proyecto-total`) |
| `src/api/dashboard.js` | `app/routes/api_dashboard.py` (`/api/dashboard`) |
| `src/api/bitacora.js` | `app/routes/api_bitacora.py` (`/api/bitacora`) |
| `src/api/metricas.js` | `app/routes/api_metricas.py` (`/api/metricas`) |
| `src/api/notificaciones.js` | `app/routes/api_notificaciones.py` (`/api/notificaciones`) |
| `src/api/inventario.js` | `app/routes/inventario_api.py` (`/api/v1`) |

Si agregas un endpoint nuevo en el backend, replica el wrapper en el archivo correspondiente para mantener la convención.

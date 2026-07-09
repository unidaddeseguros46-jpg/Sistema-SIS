# 🏥 Hospital San José — Frontend

Sistema de gestión hospitalaria (frontend). Aplicación web multi-página clásica sin frameworks, construida con HTML/CSS/JS vanilla + Supabase.

## Stack

| Tecnología | Uso |
|---|---|
| HTML5 + CSS3 + JS (vanilla) | Frontend, sin SPA ni build step |
| Supabase JS v2 (CDN) | Base de datos, autenticación |
| Font Awesome 6 (CDN) | Iconografía |
| Cloudflare Workers | API de validación de DNI |
| Supabase Edge Functions (Deno) | Creación de usuarios Auth |

## Arquitectura

Cada página/módulo es un HTML independiente. **No hay código compartido** entre componentes (cada uno se despliega de forma autónoma).

```
public/
├── index.html                     # Login
├── recuperar-password.html        # Recuperación de contraseña
├── menu.html                      # Menú principal post-login
├── css/
│   ├── styles.css                 # Estilos base globales (layout, login, menú, sidebar, animaciones)
│   ├── styles-registro.css        # Estilos compartidos entre módulos (inputs, tablas, badges, modales)
│   ├── registro-pacientes.css     # Estilos exclusivos de registro-pacientes
│   ├── seguimiento-pacientes.css  # Estilos exclusivos de seguimiento-pacientes
│   ├── detalle-paciente.css       # Estilos exclusivos de detalle-paciente
│   ├── recien-nacidos.css         # Estilos exclusivos de recién nacidos
│   ├── gestion-usuarios.css       # Estilos exclusivos de gestión de usuarios
│   └── calendario-popover.css     # Estilos del popover de calendario
├── js/
│   ├── supabase-config.js         # Cliente Supabase (detección automática local/cloud)
│   ├── layout.js                  # Layout global (sidebar, top header, navegación)
│   ├── login.js                   # Lógica de login
│   ├── menu.js                    # Menú principal
│   ├── filter-dropdown.js         # Dropdown personalizado compartido (createFilterDropdown)
│   ├── custom-select.js           # Select personalizado alternativo (formularios)
│   ├── servicios.js               # Lista global de servicios (SERVICIOS)
│   ├── dynamic-table.js           # Tabla dinámica (data-table)
│   ├── calendario-popover.js      # Popover de calendario para fechas
│   └── (cada módulo tiene su .js) # Lógica específica del módulo
├── modulos/
│   ├── pacientes/
│   │   └── registro-pacientes.html  + registro-pacientes.js
│   ├── consultas/
│   │   ├── consulta-rapida.html     + consulta-rapida.js
│   │   └── consulta-datos.html      + consulta-datos.js
│   ├── seguimiento/
│   │   ├── seguimiento-pacientes.html + seguimiento-pacientes.js
│   │   └── detalle-paciente.html     + detalle-paciente.js
│   ├── recien-nacidos/
│   │   └── recien-nacidos.html       + recien-nacidos.js
│   ├── usuarios/
│   │   ├── gestion-admin.html        + gestion-admin.js
│   │   └── gestion-user.html         + gestion-user.js
│   └── reportes/
│       └── reportes.html             + reportes.js
└── img/
    └── fondo.jpg                  # Imagen de fondo del login
```

## Sistema de CSS

### Orden de carga (en cada módulo)

```html
<link rel="stylesheet" href="../../css/styles.css">               <!-- Global -->
<link rel="stylesheet" href="../../css/styles-registro.css">      <!-- Compartido -->
<link rel="stylesheet" href="../../css/<modulo>.css">             <!-- Específico -->
<link rel="stylesheet" href="../../css/calendario-popover.css">   <!-- Opcional -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
```

### Qué va en cada archivo

| Archivo | Contiene |
|---|---|
| `styles.css` | Layout general (sidebar, .page-content, .top-header), login, menú, animaciones globales, scrollbar, responsive base |
| `styles-registro.css` | `.standard-input`, `.input-stacked`, `.col-span-N`, `.condicion-badge`, `.data-table`, `input[type=date]`, `.cr-date-popover`, `.standard-form-container`, `.blue-toptag-form`, `.action-btn-edit`, `.custom-select-wrapper` base, `.filter-dropdown-wrapper`, estados de modal, keyframes compartidos, `.global-search-box` |
| `<modulo>.css` | Solo reglas **exclusivas** de ese módulo. Ej: `#registro-form` grid, `.btn-header-back`, `.dni-exists-btn`, `.filter-label` |
| `calendario-popover.css` | Popover de selección de fecha |

### Sistema de dropdowns personalizados (filtros)

Hay dos sistemas que coexisten:

1. **`filter-dropdown.js`** — Dropdown ligero para **filtros de tabla**. Se crea con `createFilterDropdown(cfg)`. Retorna un objeto con `syncSelected()`. Los íconos decorativos tienen `pointer-events: none`. El ancho del trigger se ajusta automáticamente al contenido. Compatibilidad hacia atrás: expone `hs.customDropdownUpdate = syncSelected`.

2. **`custom-select.js`** — Select completo con búsqueda, usado en **formularios**. Carga pesada, no se recomienda para filtros simples.

Ambos usan las mismas clases CSS base (`.custom-select-wrapper`, `.custom-select-trigger`, `.custom-select-options`, etc.) definidas en `styles.css` y `styles-registro.css`.

### Cómo agregar un filtro dropdown nuevo

```html
<!-- Hidden select (para compatibilidad con minified JS existente) -->
<select id="filter-servicio" class="hidden" aria-hidden="true">
    <option value="">TODOS</option>
    <option value="Cirugía">Cirugía</option>
</select>

<!-- Dropdown trigger -->
<div class="custom-select-wrapper filter-dropdown-wrapper" id="custom-filter-servicio" tabindex="0" role="combobox" aria-expanded="false">
    <div class="custom-select-trigger">
        <i class="fa-solid fa-hospital custom-select-icon-prefix"></i>
        <span class="custom-select-text">TODOS</span>
        <i class="fa-solid fa-chevron-down custom-select-chevron"></i>
    </div>
    <ul class="custom-select-options" id="custom-filter-servicio-list" role="listbox"></ul>
</div>
```

```js
var filter = window.createFilterDropdown({
    dropdownEl: document.getElementById('custom-filter-servicio'),
    listEl: document.getElementById('custom-filter-servicio-list'),
    hiddenSelectEl: document.getElementById('filter-servicio'),
    defaultText: 'TODOS',
    options: ['Opción 1', 'Opción 2']
});
```

## Autenticación y estado

- Supabase Auth maneja sesiones
- Estado en `sessionStorage`: `userRole`, `userName`, `userEmail`
- Roles: `Desarrollador` → `Administrador` → `Usuario`
- El entorno se detecta automáticamente por `window.location.hostname`:
  - `localhost` → Supabase Docker local (puerto 54321)
  - Otro → Supabase Cloud (`<ref>.supabase.co`)
- Anon key expuesta en `supabase-config.js` (normal para client-side Supabase)

## Módulos y funcionalidad

| Módulo | Página | Funcionalidad |
|---|---|---|
| Pacientes | `registro-pacientes.html` | Registrar paciente nuevo, formulario completo con todos los campos |
| Consulta rápida | `consulta-rapida.html` | Búsqueda rápida de pacientes por DNI, datos del seguro |
| Consulta de datos | `consulta-datos.html` | Consultar datos de pacientes registrados |
| Seguimiento | `seguimiento-pacientes.html` | Seguimiento de pacientes hospitalizados/alta/fallecidos |
| Detalle paciente | `detalle-paciente.html` | Vista detallada de un paciente (eventos, historial) |
| Recién nacidos | `recien-nacidos.html` | Registro y seguimiento de recién nacidos |
| Usuarios (admin) | `gestion-admin.html` | Administración de usuarios del sistema |
| Usuarios (user) | `gestion-user.html` | Perfil de usuario |
| Reportes | `reportes.html` | Reportes del sistema |

## Desarrollo local

Ver `DEVELOPMENT.md` en la raíz del proyecto para instrucciones detalladas.

TL;DR:
```bash
# Terminal 1: Iniciar Supabase
npx supabase start

# Terminal 2: Servir frontend (usar Live Server o similar)
npx supabase functions serve create-user --no-verify-jwt
```

## Build y despliegue

```bash
# Minificar JS y CSS
npm run build    # Ejecuta build.mjs (usa terser y clean-css-cli)
```

### Destinos de deploy

| Componente | Destino |
|---|---|
| `public/` | Host estático (Vercel, Netlify, etc.) |
| `rpa-backend/` | Laptop del usuario (PM2) |
| `cloudflare-worker/` | Cloudflare Workers (npx wrangler deploy) |
| `supabase/functions/` | Supabase Edge Functions (npx supabase functions deploy) |

## Convenciones

- **Idioma**: Español en toda la interfaz, código, commits y comentarios
- **BD**: Columnas en `snake_case`. Trigger `uppercase_text_fields()` pasa a mayúsculas `nombres`, `apellidos`, `servicio`, `tipo_seguro` en `pacientes`
- **Estilo CSS**: Minificado (sin build step — `*.css` son archivos pre-minificados)
- **Estilo JS**: Minificado (archivos `*.js` en producción son minificados, pero las fuentes sin minificar están disponibles)
- **EditorConfig**: LF, indentación 4 espacios (2 para JSON)

## Notas de arquitectura

- No hay tests automatizados ni CI configurados. Todo se verifica manualmente.
- `registro-pacientes.css` se cargaba previamente en todos los módulos. Desde el refactor de junio 2026, solo se carga en `registro-pacientes.html` y `consulta-rapida.html`. Los módulos restantes usan `styles-registro.css` (contiene las reglas compartidas).
- Los filtros dropdown disparan eventos `change` sobre `<select>` ocultos para activar la búsqueda (mantiene compatibilidad con JS minificado existente).
- El backend RPA tiene 4 endpoints: `POST /get-dv`, `POST /get-dv-batch`, `POST /validate`, `POST /validate-batch`. Optimizado para serverless (`@sparticuz/chromium`).
- El Cloudflare Worker valida DNIs de 8 dígitos y devuelve fecha de nacimiento.

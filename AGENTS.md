# Hospital San José — AGENTS.md

## Estructura del repositorio

Proyecto multi-módulo, **sin código compartido entre componentes**. Cada uno se despliega de forma independiente:

| Ruta | Tecnología | Entrypoint | Destino de deploy |
|---|---|---|---|
| `public/` | Vanilla JS + Supabase CDN (global UMD) | 11 páginas HTML | Host estático (cualquiera) |
| `rpa-backend/` | Node.js 18+, Express, Puppeteer | `server.js` | Cloud (Railway, Render, etc.) |
| `cloudflare-worker/` | JavaScript (CF Workers) | `worker.js` | Cloudflare Workers |
| `supabase/functions/create-user/` | Deno / Supabase Edge Functions | `index.ts` | Supabase |

El `package.json` raíz solo contiene la dependencia de la CLI de Supabase (sin scripts de build/start).

## Comandos

- **RPA backend:** `node server.js` (desde `rpa-backend/`)
- **Cloudflare Worker:** `npx wrangler deploy` (desde `cloudflare-worker/`)
- **Supabase local:** Ver `DEVELOPMENT.md` para el flujo completo (2 terminales: `npx supabase start` + `npx supabase functions serve create-user --no-verify-jwt`)

No existen comandos de test, lint, typecheck ni formateo. No hay CI configurado.

## Notas de arquitectura

- **Frontend** es una app multi-página clásica (11 HTML, sin SPA, sin build step). Usa `@supabase/supabase-js@2` desde CDN como global UMD. Los JS usan variables globales (`supabaseClient`, etc.). Estado de auth en `sessionStorage` (`userRole`, `userName`, `userEmail`). El entorno se detecta automáticamente vía `window.location.hostname` (localhost → Supabase Docker local; otro → Supabase Cloud).
- **RPA backend** tiene 4 endpoints: `POST /get-dv` / `POST /get-dv-batch` (scrapea `dniperu.com` por código de verificación + nombres), `POST /validate` / `POST /validate-batch` (scrapea `dondemeatiendo.essalud.gob.pe` por cobertura de seguro). Los endpoints individuales reintentan hasta 3 veces con 2-3s de pausa. Batch procesa secuencialmente con 2s entre pacientes. Optimizado para serverless (`@sparticuz/chromium`).
- **Cloudflare Worker** valida DNI de 8 dígitos, consulta `buscardniperu.com` vía WP AJAX → devuelve `fecha_nac` (dd/mm/yyyy) + `fecha_iso` (yyyy-mm-dd). Timeout de 10s.
- **Supabase Edge Function** (`create-user`) crea usuarios de auth + fila en `perfiles`. Protegida con JWT (`verify_jwt = true`). RBAC completo: Desarrollador→Administrador→Usuario. Usa `service_role_key` para operaciones admin; revierte (elimina el auth user) si falla el insert del perfil.
- **BD**: Supabase con columnas en `snake_case`. Un trigger (`uppercase_text_fields()`) pasa a mayúsculas `nombres`, `apellidos`, `servicio`, `tipo_seguro` antes de insert/update en `pacientes`. `creado_en` es `timestamptz`.

## Convenciones

- Español: todos los comentarios, commits, textos de UI y nombres de variable
- `.editorconfig`: final de línea LF, indentación 4 espacios (2 para `package.json`)
- La anon key de Supabase está expuesta en `public/js/supabase-config.js` (normal para uso client-side)
- RPA backend usa prefijos `[Browser]`, `[RPA]`, `[Server]` en sus logs
- `DEVELOPMENT.md` contiene la guía completa de Supabase local (sincronizar esquema, db diff/push, Supabase Studio en `localhost:54323`)
- `ANALISIS.md` es un transcript de sesión, no documentación del proyecto

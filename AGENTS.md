# Hospital San José — AGENTS.md

## Estructura del repositorio

Proyecto multi-módulo, **sin código compartido entre componentes**. Cada uno se despliega de forma independiente:

| Ruta | Tecnología | Entrypoint | Destino de deploy |
|---|---|---|---|---|
| `public/` | Vanilla JS + Supabase CDN (global UMD) | 11 páginas HTML | Host estático (cualquiera) |
| `rpa-backend/` | Node.js 18+, Express, Puppeteer | `server.js` | Laptop del usuario (PM2) |
| `cloudflare-worker/` | JavaScript (CF Workers) | `worker.js` | Cloudflare Workers |
| `supabase/functions/create-user/` | Deno / Supabase Edge Functions | `index.ts` | Supabase |
| `supabase/functions/rpa-proxy/` | Deno / Supabase Edge Functions | `index.ts` | Supabase (proxy desplegado) |

El `package.json` raíz solo contiene la dependencia de la CLI de Supabase (sin scripts de build/start).

## Comandos

- **RPA backend:** `node server.js` (desde `rpa-backend/`)
- **Cloudflare Worker:** `npx wrangler deploy` (desde `cloudflare-worker/`)
- **PM2 (todo):** `pm2 start ecosystem.config.js`
- **Actualizar URL del túnel:** `.\start-tunnel.ps1` (local) o `.\start-tunnel.ps1 -Production` (cloud)
- **Redeploy proxy:** `npx supabase functions deploy rpa-proxy`
- **Aplicar migración local:** `npx supabase migration up`
- **Subir migración a producción:** `npx supabase db push`
- **Supabase local:** Ver `DEVELOPMENT.md` para el flujo completo (2 terminales: `npx supabase start` + `npx supabase functions serve create-user --no-verify-jwt`)

No existen comandos de test, lint, typecheck ni formateo. No hay CI configurado.

## Notas de arquitectura

- **Frontend** es una app multi-página clásica (11 HTML, sin SPA, sin build step). Usa `@supabase/supabase-js@2` desde CDN como global UMD. Los JS usan variables globales definidas en `public/js/supabase-config.js`: `supabaseClient`, `isLocal`, `RPA_BASE`. Estado de auth en `sessionStorage` (`userRole`, `userName`, `userEmail`). El entorno se detecta automáticamente vía `window.location.hostname` (localhost → Supabase Docker local; otro → Supabase Cloud). `RPA_BASE` siempre apunta al proxy (`/functions/v1/rpa-proxy`) tanto en local como producción.
- **RPA backend** corre en localhost:10000, manejado por PM2 como `RPA-EsSalud`. Expuesto via `cloudflared tunnel --url http://localhost:10000` (PM2: `Cloudflare-Tunnel`). Tiene 4 endpoints: `POST /get-dv` / `POST /get-dv-batch` (scrapea `dniperu.com` por código de verificación + nombres), `POST /validate` / `POST /validate-batch` (scrapea `dondemeatiendo.essalud.gob.pe` por cobertura de seguro). Los endpoints individuales reintentan hasta 3 veces con 2-3s de pausa. Batch procesa secuencialmente con 2s entre pacientes. Optimizado para serverless (`@sparticuz/chromium`).
- **Cloudflare Worker** valida DNI de 8 dígitos, consulta `buscardniperu.com` vía WP AJAX → devuelve `fecha_nac` (dd/mm/yyyy) + `fecha_iso` (yyyy-mm-dd). Timeout de 10s.
- **Supabase Edge Function** (`rpa-proxy`) proxy entre el frontend y el RPA backend local. Recibe `{ endpoint, ...data }` en el body, lee la URL del túnel desde la tabla `rpa_config`, reenvía la petición y devuelve la respuesta. Desplegada sin verificación JWT (`verify_jwt = false`). Cachea la URL 30s.
- **Proxy universal**: tanto local como producción usan el mismo proxy. En local requiere `npx supabase functions serve rpa-proxy --no-verify-jwt` corriendo.
- **Tabla `rpa_config`**: Fila única (`id=1`) con `tunnel_url`. `start-tunnel.ps1` la actualiza vía REST API al iniciar el túnel. Migración en `supabase/migrations/`. Requiere `SUPABASE_SERVICE_ROLE_KEY` para producción.
- **Supabase Edge Function** (`create-user`) crea usuarios de auth + fila en `perfiles`. Protegida con JWT (`verify_jwt = true`). RBAC completo: Desarrollador→Administrador→Usuario. Usa `service_role_key` para operaciones admin; revierte (elimina el auth user) si falla el insert del perfil.
- **BD**: Supabase con columnas en `snake_case`. Un trigger (`uppercase_text_fields()`) pasa a mayúsculas `nombres`, `apellidos`, `servicio`, `tipo_seguro` antes de insert/update en `pacientes`. `creado_en` es `timestamptz`.

## Convenciones

- Español: todos los comentarios, commits, textos de UI y nombres de variable
- `.editorconfig`: final de línea LF, indentación 4 espacios (2 para `package.json`)
- La anon key de Supabase está expuesta en `public/js/supabase-config.js` (normal para uso client-side)
- RPA backend usa prefijos `[Browser]`, `[RPA]`, `[Server]` en sus logs
- `DEVELOPMENT.md` contiene la guía completa de Supabase local (sincronizar esquema, db diff/push, Supabase Studio en `localhost:54323`)
- `ANALISIS.md` es un transcript de sesión, no documentación del proyecto

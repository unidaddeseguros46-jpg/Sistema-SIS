# Guía de Desarrollo Local — Hospital San José

Esta guía explica cómo trabajar en el proyecto utilizando una base de datos local para no afectar los datos reales en producción.

## Requisitos Previos
1. **Docker Desktop:** Debe estar instalado y ejecutándose. [Descargar aquí](https://www.docker.com/products/docker-desktop/).
2. **Supabase CLI:** Instalado en tu proyecto (`npm install supabase --save-dev`).

---

## Flujo de Trabajo Local (2 terminales)

Para tener el entorno completo funcionando (Base de datos + Edge Functions), necesitas abrir **dos terminales** en la carpeta del proyecto.

### Terminal 1 — Base de Datos
```bash
npx supabase start
```
Levanta la base de datos local, autenticación, almacenamiento y más.

### Terminal 2 — Edge Functions
```bash
npx supabase functions serve create-user --no-verify-jwt
```
Sirve la función `create-user` localmente en el mismo servidor (`http://127.0.0.1:54321`).

> **Nota:** El flag `--no-verify-jwt` es necesario solo en local porque el JWT local
> no tiene el mismo formato que el de producción. En producción la función sigue
> protegida (`verify_jwt = true` en Supabase Cloud).

Con ambas terminales activas, todo funciona de forma aislada y ningún dato llega a producción.

---

## Comandos Útiles

| Comando | Descripción |
|---|---|
| `npx supabase start` | Enciende la BD y los servicios locales |
| `npx supabase stop` | Apaga los servicios (no borra datos) |
| `npx supabase status` | Muestra las URLs y claves del entorno local |
| `npx supabase db reset` | Borra datos locales y vuelve a aplicar migraciones + seeds |
| `npx supabase functions serve create-user --no-verify-jwt` | Sirve la Edge Function localmente |

---

## Sincronizar Esquema (Solo la primera vez)

Para que tu base de datos local tenga las mismas tablas que producción:

```bash
npx supabase login --token TU_TOKEN
npx supabase link --project-ref vofqatqocfaqcdcuwama
npx supabase db dump -f supabase/migrations/20260101000000_remote_schema.sql
npx supabase db dump --data-only -f supabase/seed.sql
npx supabase db reset
```

---

## Panel Visual Local
Mientras los servicios estén activos puedes gestionar datos localmente desde:

**http://localhost:54323** (Supabase Studio Local)

---

## Cómo volver a Producción

**No tienes que tocar el código.** El archivo `public/js/supabase-config.js` detecta el entorno automáticamente:

| Entorno | URL del navegador | Base de datos |
|---|---|---|
| **Local** | `localhost` o `127.0.0.1` | BD local (Docker) |
| **Producción** | URL pública de Vercel | Supabase Cloud |

---

## Subir Cambios de Esquema a Producción

Si modificaste tablas localmente y quieres aplicar esos cambios en la nube:

```bash
# 1. Generar el "parche" (migración) con los cambios detectados
npx supabase db diff -f nombre_descriptivo_del_cambio

# 2. Verificar que el parche no tiene errores
npx supabase db reset

# 3. Subir a producción (¡con cuidado!)
npx supabase db push
```

# Hospital San José — Análisis del Proyecto

## Arquitectura General

### Frontend (vanilla JS + CDN Supabase)
**11 páginas HTML**, layout inyectado dinámicamente por `layout.js`.

| Ruta | Propósito |
|---|---|
| `public/index.html` | Login |
| `public/menu.html` | Pantalla principal |
| `public/modulos/pacientes/registro-pacientes.html` | Registro + edición de pacientes |
| `public/modulos/seguimiento/seguimiento-pacientes.html` | Búsqueda y listado |
| `public/modulos/seguimiento/detalle-paciente.html` | Historia clínica detallada |
| `public/modulos/consultas/consulta-rapida.html` | Validación RPA vs EsSalud |
| `public/modulos/consultas/consulta-datos.html` | Consulta externa (DNI + DV + Seguro) |
| `public/modulos/reportes/reportes.html` | (*vacío — solo auth guard*) |
| `public/modulos/usuarios/gestion-admin.html` | CRUD administradores |
| `public/modulos/usuarios/gestion-user.html` | CRUD usuarios |
| `public/recuperar-password.html` | Recuperación de contraseña |

### Backend / APIs externas

| Servicio | URL | Usado por |
|---|---|---|
| **Cloudflare Worker** | `dni-lookup-api.seguimientohospitalario5.workers.dev` | consulta-datos, registro-pacientes |
| **Railway (RPA)** | `sistema-sis-production-5b60.up.railway.app` | consulta-datos (`/get-dv`, `/validate`), consulta-rapida (`/validate-batch`) |
| **Supabase Edge Function** | `create-user` | gestion-admin, gestion-user |

### Base de datos (Supabase)

| Tabla | Columnas clave |
|---|---|
| **`pacientes`** | `id`, `dni`, `historia_clinica`, `apellidos`, `nombres`, `fecha_nacimiento`, `tipo_seguro`, `seguro_extraido`, `servicio`, `condicion`, `codigo_verificacion`, `estado_rpa`, `ultima_validacion_rpa`, `creado_en`, `creado_por` |
| **`hospitalizaciones`** | `id`, `paciente_id`, `fecha_ingreso`, `hora_ingreso`, `fecha_alta`, `hora_alta`, `servicio`, `activa`, `numero_registro`, `creado_por` |
| **`historial_eventos`** | `id`, `paciente_id`, `hospitalizacion_id`, `tipo_evento`, `fecha_evento`, `detalle`, `nuevo_seguro`, `nuevo_seguro_otros`, `registrado_por` |
| **`validaciones_rpa`** | `id`, `paciente_id`, `dni`, `seguro_declarado`, `seguro_extraido`, `estado_validacion`, `fecha_validacion` |
| **`consultas_datos`** | `id`, `dni`, `nombres`, `apellidos`, `fecha_nacimiento`, `codigo_verificacion`, `seguro_validado`, `estado_consulta`, `creado_por` |
| **`perfiles`** | `id_usuario`, `nombre_completo`, `nombre_usuario`, `email`, `id_rol`, `activo`, `susalud_usuario`, `susalud_clave` |
| **`roles`** | `id_rol`, `nombre` |
| **`auditoria`** | Tabla de auditoría vía triggers |

### Flujo de datos por módulo

**consulta-rapida**: Filtros locales → query `pacientes` con `.eq/.ilike/.gte/.lte` → acumula en `accumulatedResults` → renderiza tabla con checkboxes → selecciona hasta 20 → POST a Railway `/validate-batch` → actualiza `pacientes.estado_rpa` + inserta `validaciones_rpa`

**seguimiento-pacientes**: Filtros → query `pacientes` paginado server-side (`.range()`) → renderiza tabla → clic en fila → `detalle-paciente.html?id=X` | clic en botón → `consulta-rapida.html?dni=X&auto=true`

**detalle-paciente**: Carga `pacientes` por id → carga `hospitalizaciones` → carga `historial_eventos` → renderiza timeline + calendario → popovers para: ingreso (INSERT `hospitalizaciones`), eventos (INSERT `historial_eventos` + UPDATE `hospitalizaciones`)

**consulta-datos**: DNI → Worker (nombres/fecha) → Railway `/get-dv` (código verificación) → Railway `/validate` (seguro) → INSERT `consultas_datos` → renderiza tabla → botón "Agregar" abre modal con `registro-pacientes.html?view=modal` via iframe + `cd_auto_fill`

**registro-pacientes**: Formulario con validación → INSERT/UPDATE `pacientes` → modal: oculta Condición (forzada `Hospitalizado`), HC opcional, auto-fill desde consulta-datos

---

## Progreso de la Sesión Actual

### Meta
Modernizar y extender el sistema de gestión de pacientes: rediseño del datepicker, centralización de opciones de servicio, animaciones de tooltip, verificación de existencia de pacientes, contadores dinámicos y ajustes de paginación.

### Restricciones y Convenciones
- El popover del calendario debe coincidir visualmente con detalle-paciente (filter-group con labels, btn-modul btn-clear-hover, cuadrícula de días).
- El rango de fechas requiere al menos una fecha antes de buscar; condición/servicio/hasta-hoy auto-buscan solo cuando hay un rango de fechas o hasta-hoy activo.
- La animación de tooltip flotante usa transición `bottom` (0.35s cubic-bezier) cuando se elimina un tooltip hermano.
- El texto "Paciente registrado" en consulta-datos usa estilo plano que coincide con la columna Fecha/Hora (`font-size:12px; color:#94a3b8;`).
- El botón "Hasta hoy" es toggle; si está activo, hacer clic en el trigger del datepicker muestra un toast y pulsa btnClear (2s, `#404040`).
- Máximo 20 selecciones de paciente; intentos más allá muestran tooltip de error rojo.
- El select de servicio está centralizado vía atributo `data-servicio`; mayúsculas para consulta-rápida, título capitalizado en los demás.
- El título del top-header para consulta-datos cambió a `CÓDIGO / FECHA_NAC / SEGURO` con `SEGURO` en `#3b82f6`.
- El contador de pacientes muestra `X pacientes | Y seleccionados` y se actualiza en cada cambio de filtro/checkbox.
- Paginación muestra 20 registros por página.
- `EMERGENCIA` agregado a todas las listas de servicio en orden alfabético.
- Campo HC visible y opcional (placeholder "Opcional") en modal de consulta-datos.

### Cambios Realizados

#### Datepicker y Calendario
- Corregido cierre del popover al primer clic: agregado `e.stopPropagation()` en manejador de clic de celda de día.
- Reglas CSS `.filter-select` (coincidiendo con detalle-paciente) agregadas en `<style>` inline en consulta-rápida.
- Aplicado `stopPropagation`/interlocking al clic del trigger del datepicker cuando hasta-hoy está activo.
- Animación `transition: bottom 0.35s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s ease` en tooltips flotantes.

#### Hasta hoy
- Agregado toggle Hasta hoy: limpia el rango de fechas, agrega `lte('creado_en', hoy 23:59:59)` a la consulta.
- Al hacer clic en el trigger del datepicker con hasta-hoy activo: muestra toast "Limpie los filtros para usar el rango de fechas" y pulsa btnClear.

#### Centralización de Servicios
- Creado `public/js/servicios.js` con array central `SERVICIOS` + función `populateServicioSelects()`.
- Los cinco selects de servicio en cuatro páginas usan atributo `data-servicio`; opciones `<option>` hardcodeadas eliminadas.
- `EMERGENCIA` agregado en orden alfabético a cada lista.
- `custom-select.js` debe cargar después de `servicios.js` para que las opciones existan antes de la transformación.

#### Tooltips
- Creada `repositionFloatingTooltips()` — llamada después de eliminar tooltip guía o toast del sistema.
- Animación de caída con `bottom` y `opacity`.
- Llamada asíncrona (400ms de retraso) para esperar la animación de salida.

#### Consulta Rápida
- Agregado `filter-servicio` con `data-servicio="upper"` (mayúsculas para coincidir con Supabase).
- Agregada columna Servicio Actual (`<td>${p.servicio || 'N/A'}</td>`) en renderTable.
- Agregado span `#cr-patient-count` (14px, font-weight:500) con `X pacientes | Y seleccionados`.
- Cambiada paginación de 10 a 20 (`crRowsPerPage = 20`).

#### Consulta Datos
- `renderResult` es `async`, consulta `pacientes` por DNI, muestra "Paciente registrado" para pacientes existentes.
- Título del top-header cambiado de `CONSULTA DE DATOS` a `CÓDIGO / FECHA_NAC / SEGURO` (SEGURO en `#3b82f6`).
- Modal: campo HC visible con `placeholder="Opcional"`, siempre enviado en payload si se llena.
- Corregido guardia `if (!isModal)` que impedía el envío de HC en modal.

#### CSS Global
- `btnPulse` keyframes usan `#404040` con sombra suave.
- Clases `.welcome-celeste` (`#3b82f6`), `.guide-tooltip`/`.guide-tooltip-exit`, `.seguro-badge`, `.condicion-badge` en `public/css/styles.css`.

### Contexto Crítico
- Supabase tabla `pacientes`: `condicion` almacenada en mayúsculas (`HOSPITALIZADO`, `ALTA`, `FALLECIDO`); `servicio` convertido a mayúsculas por trigger en insert/update.
- `creado_en` es `timestamp with time zone`; los filtros de fecha usan strings ISO con `T00:00:00` / `T23:59:59`.
- `showSystemTooltip(message, isError)` en `layout.js`: `isError=true` → toast rojo; `isError=false`/omitido → toast verde de éxito.
- Claves `sessionStorage` usadas: `cr_filter_*`, `cr_hasta_hoy`, `cr_accumulated`, `cd_auto_fill`, `userRole`.
- Template `<template id="template-alerta">` está vacío; `updateAlertaBanner` retorna temprano si está vacío.
- Trigger `public.uppercase_text_fields()` se ejecuta BEFORE INSERT/UPDATE en `pacientes`, convirtiendo `nombres`, `apellidos`, `servicio`, `tipo_seguro`, etc. a mayúsculas.

### Archivos Relevantes
- `public/modulos/consultas/consulta-rapida.html`
- `public/modulos/consultas/consulta-rapida.js`
- `public/modulos/consultas/consulta-datos.js`
- `public/modulos/consultas/consulta-datos.html`
- `public/js/servicios.js`
- `public/js/layout.js`
- `public/js/registro-pacientes.js`
- `public/js/custom-select.js`
- `public/modulos/pacientes/registro-pacientes.html`
- `public/modulos/seguimiento/seguimiento-pacientes.html`
- `public/modulos/seguimiento/detalle-paciente.html`
- `public/css/styles.css`

# Kaizen · Demo UV Energía — Sistema para Unidades de Inspección

Frontend funcional de la demo: agenda de verificaciones, expediente digital, PWA de campo offline y dictamen automático con folio y QR. Por ahora corre con **datos en memoria**. Está estructurado para que el backend (Supabase) se conecte sin tocar las pantallas.

> Datos 100 % ficticios. Nunca nombres reales de clientes.

## Arranque

Requiere **Node 24 LTS** (`.nvmrc`). Node 26 rompe ESLint y el loader de Tailwind.

```bash
nvm use
pnpm install
pnpm dev            # http://localhost:3000
```

Inicia sesión con cualquier cuenta de demo; cada una es un rol:

| Cuenta | Rol | Entra a |
|---|---|---|
| admin@demo.uv | Administrador | Todo + Configuración + App de campo |
| coordinacion@demo.uv | Coordinación | Agenda, clientes |
| responsable@demo.uv | Responsable técnico | Revisa y **aprueba dictámenes** |
| cruiz@demo.uv (y atorres, jsalinas) | Inspector | Solo `/campo` (PWA) |

Configuración → «Reiniciar datos de demo» regresa todo al seed entre ensayos.

## Guion que ya funciona de punta a punta

1. **Coordinación** agenda una cita (`/agenda` → *Nueva cita*), o arrastra una existente para reprogramarla.
2. **Inspector** (en el celular) abre `/campo` → ruta del día → captura. Toca **En línea** para simular modo avión: el checklist, las fotos (con GPS, hora y hash) y las firmas se guardan en IndexedDB.
3. Al volver la señal, la cola se sincroniza sola y la inspección pasa a **En revisión**.
4. **Responsable** abre el expediente: el semáforo de completitud (IA) marca faltantes y sugiere la redacción de cada NC → **Aprobar y emitir dictamen**.
5. Se genera el dictamen con **folio consecutivo** y **QR**; el QR abre `/verificar/[token]` (pública, sin sesión).

## Rutas

| Ruta | Pantalla |
|---|---|
| `/login` | Inicio de sesión (cuentas de demo) |
| `/dashboard` | KPIs, dictámenes por mes, productividad, NC frecuentes, vencimientos |
| `/agenda` | FullCalendar (día/semana/mes, drag & drop) + ruta del día en mapa |
| `/clientes` · `/clientes/[id]` | Catálogo, instalaciones, historial |
| `/inspecciones` · `/inspecciones/[id]` | Listado con filtros · expediente (checklist, evidencias, acta, bitácora, completitud IA) |
| `/dictamenes` · `/dictamenes/[id]` | Listado · dictamen imprimible con QR |
| `/configuracion` | Normas, checklists, plantillas, usuarios/competencias, branding (solo admin) |
| `/campo` · `/campo/[inspeccionId]` | PWA del inspector: ruta del día y captura offline |
| `/verificar/[token]` | Verificación pública del dictamen |

## Estructura

```
app/(auth)/            login y server actions de sesión
app/(panel)/<módulo>/  page.tsx + actions.ts (server actions con zod) + componentes cliente
app/campo/             PWA: layout, ruta del día, captura offline, actions.ts de sincronización
app/verificar/         página pública del QR
config/ramas/          TODO lo que cambia por giro: normas, checklist, catálogos, textos
lib/types.ts           modelo de dominio = contrato con el backend
lib/data/              capa de datos (hoy en memoria) ← aquí se conecta Supabase
lib/auth.ts            sesión (hoy cookie de demo) ← aquí va Supabase Auth
lib/permisos.ts        matriz rol → acciones (UI y server actions)
lib/ia/completitud.ts  semáforo de completitud y redacción de NC (hoy reglas; luego LLM)
lib/offline/           Dexie (IndexedDB), estado de red, fotos, cola de sincronización
db/seed.ts             datos de demo (lo mismo que debe insertar `pnpm seed`)
public/sw.js           service worker de la PWA (solo en producción)
```

**Reglas del frontend**
- Las pantallas solo importan de `lib/data/*`, nunca de `lib/data/store.ts`.
- Textos, normas, estatus y catálogos salen de `config/ramas` y del tenant, nada hardcodeado. Cambiar de lead = config + branding.
- Cada mutación es una server action en `actions.ts`: `requirePermiso()` + `zod` + `ejecutar()` (devuelve `ActionResult` para el toast) + `revalidatePath`.
- Next 16 con **Cache Components**: toda lectura dinámica va dentro de `<Suspense>` (los layouts ya lo hacen) y la capa de datos llama `connection()`.

## Para conectar el backend (Antonio)

Las firmas de `lib/data/*` son el contrato. Hay que reemplazar el cuerpo de cada función por la consulta a Supabase y devolver las mismas formas de `lib/types.ts` (snake_case → camelCase). Puntos marcados con `BACKEND:` en el código:

| Archivo | Qué cambia |
|---|---|
| `lib/data/store.ts` | Se elimina. |
| `lib/data/*.ts` | Consultas Supabase con RLS por `tenant_id`. |
| `lib/data/inspecciones.ts` → `aprobarYEmitir` | Función SQL transaccional: folio sin huecos (`SELECT … FOR UPDATE`). |
| `lib/data/bitacora.ts` | Tabla solo inserción (sin UPDATE/DELETE), idealmente por trigger. |
| `lib/auth.ts` + `app/(auth)/actions.ts` | Supabase Auth; `getSession()` mantiene su forma. `proxy.ts` revisa la cookie de Supabase. |
| `app/campo/actions.ts` | Fotos a Storage con URL firmada; la acción recibe rutas, no data URLs. |
| `/api/dictamen/[id]` (por crear) | docxtemplater + Gotenberg con la plantilla del cliente; campos en `Plantilla.campos`. |
| `lib/ia/completitud.ts` | LLM con salida estructurada; misma forma de retorno. |

## Pendientes conocidos

- Mapa real: definir `NEXT_PUBLIC_MAPBOX_TOKEN`. Sin token se muestra un croquis.
- Branding real (logo, colores) de UV Energía: se edita en Configuración → Branding.
- Checklist NOM-002 resumido (25 reactivos, numerales internos R-xx): validarlo con el cliente.
- Formato oficial de acta y dictamen: pedirlo antes de la reunión.

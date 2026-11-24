# Kaizen · Demo UV Energía — Sistema para Unidades de Inspección

Agenda de verificaciones, expediente digital, PWA de campo offline y dictamen automático con folio y QR. Next.js 16 + **Supabase** (Postgres con RLS por tenant, Auth, Storage), Claude para la revisión de completitud y Gotenberg para el PDF.

> Datos 100 % ficticios. Nunca nombres reales de clientes.

## Arranque

Requiere **Node 24 LTS** (`.nvmrc`; Node 26 rompe ESLint y el loader de Tailwind) y **Docker** para el Supabase local.

```bash
nvm use
pnpm install
pnpm exec supabase start        # Postgres, Auth, REST y Storage locales (imprime las llaves)
cp .env.example .env.local      # pega la URL y las llaves que imprimió supabase start
pnpm db:reset                   # aplica supabase/migrations y carga el seed
pnpm dev                        # http://localhost:3000
```

Con `MODO_DEMO=true` el login muestra las cuentas de demo y precarga `SEED_PASSWORD`; cada cuenta es un rol:

| Cuenta | Rol | Entra a |
|---|---|---|
| admin@demo.uv | Administrador | Todo + Configuración + App de campo |
| coordinacion@demo.uv | Coordinación | Agenda, clientes |
| responsable@demo.uv | Responsable técnico | Revisa y **aprueba dictámenes** |
| cruiz@demo.uv (y atorres, jsalinas) | Inspector | Solo `/campo` (PWA) |

Configuración → «Reiniciar datos de demo» (solo con `MODO_DEMO=true`) vuelve a cargar el seed entre ensayos. Desde la terminal: `pnpm seed`.

Opcionales: `ANTHROPIC_API_KEY` (revisión con IA; sin ella el semáforo usa solo reglas), `GOTENBERG_URL` (PDF del dictamen: `docker run --rm -p 3001:3000 gotenberg/gotenberg:8`), `N8N_WEBHOOK_URL` (avisos), `NEXT_PUBLIC_MAPBOX_TOKEN` (mapa real).

## Deploy en Vercel

Hace falta un proyecto de Supabase en la nube, además del de Vercel. Para cargar la base desde tu compu **no** necesitas Docker.

### 1. Supabase (una sola vez)

1. Crea un proyecto en [supabase.com](https://supabase.com). Elige la región más cercana a los usuarios (p. ej. `us-east-1`) y guarda la contraseña de la base.
2. Desde la raíz del repo, aplica las migraciones (esquema, RLS, funciones y buckets de Storage):
   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <ref-del-proyecto>
   pnpm exec supabase db push
   ```
3. Carga los datos de demo. En `.env.local` pon la URL y las llaves del proyecto en la nube (Project Settings → API) y una `SEED_PASSWORD` (mínimo 8 caracteres). Luego corre:
   ```bash
   pnpm seed
   ```
4. En Authentication → URL Configuration, pon la URL de Vercel como **Site URL**. El login es con contraseña, así que no se necesitan redirects.

### 2. Vercel

1. Importa `oenieto/kaizen-inspecciones`. Vercel detecta Next.js solo; no hay que cambiar los comandos de build.
2. En Settings → Environment Variables, agrega las variables para Production (y Preview si se usa):

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable / anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Secret / service_role key (solo servidor: **nunca** con prefijo `NEXT_PUBLIC_`) |
   | `SEED_PASSWORD` | La misma que usaste en `pnpm seed` |
   | `TENANT_SLUG` | `uv-energia` |
   | `MODO_DEMO` | `true` para la demo (muestra las cuentas en el login y habilita «Reiniciar datos de demo») |
   | `ENABLE_EXPERIMENTAL_COREPACK` | `1`, para que Vercel use pnpm 12 (`packageManager` de `package.json`) |
   | `ANTHROPIC_API_KEY` | Opcional: revisión de completitud con IA |
   | `NEXT_PUBLIC_MAPBOX_TOKEN` | Opcional: mapa real de la ruta del día |
   | `GOTENBERG_URL` | Opcional: PDF del dictamen (ver abajo) |
   | `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` | Opcional: avisos a n8n |

3. En Settings → Functions, pon la región de las funciones en la misma zona que Supabase (p. ej. `iad1` para `us-east-1`). Si quedan lejos, cada pantalla tarda más.
4. La versión de Node (24.x) ya viene fijada en `package.json`.
5. Despliega. Las variables `NEXT_PUBLIC_*` se incrustan al compilar: si cambias una, vuelve a desplegar.

### 3. Comprobar

- Entra a `/login` y prueba cada cuenta de demo.
- Sigue el guion de abajo de punta a punta. El QR del dictamen debe abrir `https://<tu-dominio>/verificar/...`.
- Desde el celular: abre la URL e instala la PWA (Agregar a pantalla de inicio). La cámara y la instalación necesitan HTTPS, que Vercel ya da.

### PDF del dictamen

Vercel no puede correr Gotenberg. Sin `GOTENBERG_URL`, el dictamen se descarga en **Word** y el botón de PDF responde que no está configurado. Para tener PDF, despliega la imagen `gotenberg/gotenberg:8` en un servicio de contenedores (Render, Railway, Fly.io o Cloud Run) y pon su URL en `GOTENBERG_URL`.

## Guion que ya funciona de punta a punta

1. **Coordinación** agenda una cita (`/agenda` → *Nueva cita*), o arrastra una existente para reprogramarla.
2. **Inspector** (en el celular) abre `/campo` → ruta del día → captura. Toca **En línea** para simular modo avión: el checklist, las fotos (con GPS, hora y hash) y las firmas se guardan en IndexedDB.
3. Al volver la señal, la cola se sincroniza sola y la inspección pasa a **En revisión**.
4. **Responsable** abre el expediente: el semáforo de completitud (IA) marca faltantes y sugiere la redacción de cada NC → **Aprobar y emitir dictamen**.
5. Se genera el dictamen con **folio consecutivo** y **QR**; el QR abre `/verificar/[token]` (pública, sin sesión). El dictamen se descarga en Word (plantilla del cliente) o PDF.

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
| `/api/dictamen/[id]?formato=docx\|pdf` | Dictamen con la plantilla .docx del tenant (PDF vía Gotenberg) |

## Estructura

```
app/(auth)/            login y server actions de sesión
app/(panel)/<módulo>/  page.tsx + actions.ts (server actions con zod) + componentes cliente
app/campo/             PWA: layout, ruta del día, captura offline, actions.ts de sincronización
app/verificar/         página pública del QR
config/ramas/          TODO lo que cambia por giro: normas, checklist, catálogos, textos
app/api/dictamen/      Word/PDF del dictamen
lib/types.ts           modelo de dominio = contrato con el backend
lib/data/              capa de datos: consultas Supabase (RLS) → formas de lib/types.ts
lib/supabase/          clientes (servidor con cookies, navegador, service_role) y tipos generados
lib/auth.ts            sesión de Supabase Auth; rol y tenant salen de la tabla usuarios
lib/permisos.ts        matriz rol → acciones (UI y server actions; app.puede() en SQL la replica)
lib/ia/completitud.ts  semáforo: reglas deterministas + Claude con salida estructurada
lib/documentos/        llenado de la plantilla .docx (docxtemplater) y PDF (Gotenberg)
lib/offline/           Dexie (IndexedDB), estado de red, fotos, cola de sincronización
supabase/migrations/   esquema, seguridad (RLS, Storage) y funciones de flujo
db/seed.ts             datos de demo; db/sembrar.ts los carga (`pnpm seed`)
db/pruebas/            pruebas de integración contra el Supabase local (`pnpm test:db`)
templates/             plantilla .docx por defecto (scripts/plantilla-dictamen.ts la genera)
public/sw.js           service worker de la PWA (solo en producción)
```

**Reglas del frontend**
- Las pantallas solo importan de `lib/data/*`, nunca de `lib/data/store.ts`.
- Textos, normas, estatus y catálogos salen de `config/ramas` y del tenant, nada hardcodeado. Cambiar de lead = config + branding.
- Cada mutación es una server action en `actions.ts`: `requirePermiso()` + `zod` + `ejecutar()` (devuelve `ActionResult` para el toast) + `revalidatePath`.
- Next 16 con **Cache Components**: toda lectura dinámica va dentro de `<Suspense>` (los layouts ya lo hacen) y la capa de datos llama `connection()`.

## Backend

Las firmas de `lib/data/*` siguen siendo el contrato con las pantallas; por dentro consultan Supabase con la sesión del usuario, así que **toda lectura pasa por RLS**.

| Pieza | Cómo está resuelto |
|---|---|
| Aislamiento | Cada tabla lleva `tenant_id` (por defecto el del usuario). Políticas RLS por tenant y rol; el inspector solo ve sus inspecciones. Privilegios mínimos: escritura directa solo en alta de clientes, instalaciones y citas. |
| Flujo | `reprogramar_inspeccion`, `cancelar_inspeccion`, `sincronizar_captura`, `devolver_a_campo` y `aprobar_y_emitir` son funciones SQL transaccionales: validan permiso y estatus, aplican el cambio y escriben la bitácora. Sus mensajes llegan tal cual al toast. |
| Folio | `aprobar_y_emitir` bloquea la fila `(tenant, año)` de `folios`: aprobaciones simultáneas se serializan y una transacción fallida no consume consecutivo. |
| Bitácora | Solo la escriben triggers y funciones (`auth.uid()` como autor). Un trigger rechaza UPDATE/DELETE/TRUNCATE en `bitacora` y `dictamenes`. |
| Auth | Supabase Auth con correo y contraseña (registro público deshabilitado). `proxy.ts` refresca el token y protege rutas; `getSession()` conserva su forma. |
| Evidencias | Bucket privado `evidencias/{tenant}/{inspección}/{foto}.jpg`. La PWA pide URLs firmadas de subida (`prepararSubidaFotos`), sube directo desde el dispositivo y la acción recibe rutas; la BD verifica que el objeto exista. Hash SHA-256 de los bytes JPEG: la PWA lo calcula al tomar la foto y el servidor lo recalcula sobre el objeto en Storage (si no coincide, rechaza). Las pantallas reciben URLs firmadas de 1 h. |
| Dictamen | `/api/dictamen/[id]` llena la plantilla del bucket `plantillas/{tenant}/dictamen.docx` (o `templates/dictamen.docx`) con docxtemplater; etiquetas en `Plantilla.campos`. PDF con Gotenberg. |
| IA | `evaluarCompletitud()`: las reglas dan el puntaje; Claude (`ANTHROPIC_MODEL`, por defecto `claude-opus-5-5`) agrega inconsistencias y la redacción de cada NC. En caché por contenido del expediente; si falla, quedan las reglas. Nunca dictamina. |
| Avisos | `cita.programada`, `inspeccion.en_revision` y `dictamen.emitido` se envían a `N8N_WEBHOOK_URL` después de responder. |

### Contrato de sincronización (PWA → servidor)

1. La PWA guarda la captura en IndexedDB (`lib/offline/db.ts`). Fotos con id UUID del cliente, GPS, hora y hash.
2. Al finalizar, la captura queda `pendiente` y recibe una llave `envioId` (UUID) que se persiste **antes** del primer intento.
3. `prepararSubidaFotos` da URLs firmadas solo para las fotos que aún no están en Storage; la PWA las sube y guarda cada `ruta` en cuanto sube.
4. `sincronizarInspeccion` valida con zod, recalcula los hashes y llama `sincronizar_captura` (una transacción). La llave y su resultado se guardan en `sincronizaciones`: si la respuesta se pierde y la PWA reintenta, el servidor devuelve el mismo resultado con `repetido: true`, sin duplicar bitácora ni avisos.
5. Con respuesta correcta, la PWA borra la captura local.

Las evidencias son idempotentes por `ruta` (única) y las fotos por su UUID.

**Conflictos.** En la demo hay un inspector por inspección y la captura se bloquea al finalizar, así que no hay conflictos. En productivo (dos dispositivos sobre la misma inspección): concurrencia optimista con `inspecciones.version`. La PWA manda la versión que descargó y solo los reactivos que cambió; si la versión no coincide, el servidor fusiona por reactivo y, cuando ambos cambiaron el mismo, rechaza ese reactivo y la PWA pide al inspector elegir. Las fotos nunca chocan (UUID del cliente, solo se agregan). Cada fusión queda en bitácora con antes/después.

**Cambios de esquema:** nueva migración en `supabase/migrations/`, luego `pnpm db:reset` y `pnpm db:types`. Toda función nueva expuesta debe revocar `EXECUTE` a `public`/`anon` (Postgres lo concede por defecto) y toda tabla nueva necesita RLS.

**Producción:** `supabase link` + `supabase db push` aplica las migraciones; crea las cuentas reales en Auth y su fila en `usuarios` (con `MODO_DEMO` apagado el login no lista cuentas). En Auth → URL Configuration pon el dominio real.

## Pendientes conocidos

- Mapa real: definir `NEXT_PUBLIC_MAPBOX_TOKEN`. Sin token se muestra un croquis.
- Alta de usuarios desde Configuración (hoy: Supabase Auth + fila en `usuarios`).
- Plantilla del acta en Word (`/api/acta`), cuando el cliente entregue su formato.
- Listados sin paginar (PostgREST corta en 1000 filas).
- Next avisa en desarrollo de datos sin caché fuera de `<Suspense>` en varias páginas (ya pasaba con los datos en memoria).
- Branding real (logo, colores) de UV Energía: se edita en Configuración → Branding.
- Checklist NOM-002 resumido (25 reactivos, numerales internos R-xx): validarlo con el cliente.
- Formato oficial de acta y dictamen: pedirlo antes de la reunión.

# InfoTrack Dashboard

Dashboard comercial (Pipeline Total) alimentado en vivo desde **GoHighLevel**.
React + Vite (frontend) · Express (backend que consulta la API de GHL y aplica el motor de cálculo).

## Desarrollo local

```bash
npm install
# Backend (consulta GHL y sirve /api):
npm run server
# Frontend (Vite, en otra terminal):
npm run dev
```

Crea un `.env` a partir de `.env.example` con tus credenciales de GHL:

```
GHL_TOKEN=pit-xxxxxxxx          # Private Integration token
GHL_LOCATION_ID=xxxxxxxx        # ID de la sub-cuenta
GHL_PIPELINE_ID=xxxxxxxx        # (opcional) pipeline COMERCIAL a mostrar
PORT=3001
REFRESH_MS=30000                # refresco automático cada 30 s
```

Los **pipelines IA** no van en el `.env`: se eligen desde la interfaz (ver abajo).

## Producción (un solo servicio)

```bash
npm run build   # genera dist/
npm start       # Express sirve dist/ + la API
```

## Autenticación (login con Postgres)

- Si **`DATABASE_URL`** está presente, se activa el login: los datos quedan protegidos y se
  requiere iniciar sesión. Sin `DATABASE_URL` (dev local), el dashboard queda abierto.
- Al arrancar se crea la tabla `users` y, si no existe, el **admin inicial** definido por
  `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- Los usuarios los crea un **admin** desde la pestaña *Usuarios*.
- Las métricas personalizadas pasan a guardarse en la base de datos (compartidas) cuando hay auth.

## Deploy en Railway

1. Conecta este repo en Railway (build/start ya definidos en `railway.json`).
2. Agrega un **PostgreSQL** al proyecto (New → Database → PostgreSQL). Railway crea `DATABASE_URL`.
3. Carga las variables de entorno del servicio:
   - GHL: `GHL_TOKEN`, `GHL_LOCATION_ID`, `GHL_PIPELINE_ID` (los pipelines IA se
     eligen desde la interfaz, no acá)
   - Auth: `DATABASE_URL` (referencia la del Postgres), `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`
4. Railway expone el servicio; el dashboard queda en `/infotrack-dashboard` y pedirá login.

## Pipelines IA (uno por agente)

Cada agente de IA tiene su propio pipeline en GoHighLevel, todos con las mismas
etapas. **Cuáles se muestran se elige desde la interfaz**, no por variable de entorno:

1. Entra como **admin** a *Pipeline IA → Pipelines*.
2. Marca los pipelines de GHL que son de agentes y, si quieres, ponles un **alias**
   (el nombre con el que se verá el agente). Sin alias se usa el nombre de GHL.
3. Guarda: la selección queda en la tabla `ia_pipelines` y el backend consulta
   GoHighLevel de inmediato.

Cuando el equipo cree un pipeline nuevo, aparece solo en esa lista: basta marcarlo,
sin redeploy ni cambios de configuración.

Todos los agentes seleccionados se sirven juntos en `/api/pipeline-ia`; cada fila
trae su `agente`, que es columna, filtro (multi-select *Agente*) y dimensión de los
gráficos comparativos (*Contactos por Agente*, *Embudo por etapa y agente*). Las
**Citas** se traen de todos los agentes y también quedan etiquetadas.

`GHL_PIPELINE_IA` sigue existiendo solo como semilla del primer arranque (admite
varios ids separados por coma) y para dev sin base de datos, donde la selección
vive en memoria y se pierde al reiniciar.

## Notas

- La data real **no** se versiona: el seed `src/data/pipeline.json` está en `.gitignore`.
  Todo se obtiene en vivo de GoHighLevel.
- Endpoints de descubrimiento: `/api/ghl/pipelines`, `/api/ghl/custom-fields`, `/api/ghl/mapping-check`.
- **Citas**: las oportunidades de los pipelines IA que están en la etapa *Cita Agendada* se cruzan
  contra `GET /contacts/{id}/appointments` (esa ruta solo responde con `Version: 2021-04-15`) y
  se sirven en `/api/citas` con **una fila por cita**. Están en *Pipeline IA → Citas* y como
  dataset de *Mis Métricas*. Se consulta un contacto por request, con un tope compartido
  entre todos los agentes de 300 por refresh (`MAX_CONTACTOS_CITA`).
- **Mis Métricas** trabaja sobre tres datasets: *Pipeline Comercial*, *Pipelines IA* y *Citas*.
  En los dos últimos se puede condicionar por **Agente**.
  Las métricas guardadas antes de esto no traen `dataset` y se siguen evaluando como comerciales.
- **Fuente** es el campo nativo `source` de la oportunidad (texto libre en GHL: hoy trae ~300
  valores distintos, muchos duplicados por tipeo). **Seguimiento** es el custom field
  `opportunity.seguimiento` (8 etapas de follow-up). Ambos son filtrables y sirven como
  condición en *Mis Métricas*; para agrupar bien por Fuente hay que normalizarla en el CRM.
- El motor de cálculo (`src/lib/calc.js`) replica las fórmulas del Excel: MCB, facturación
  mensual, MB, probabilidad, pipeline sensibilizado, etc.
- **Año de facturación**: el desglose mensual (Ene–Dic) y el MB se calculan sobre el año que
  se elija en el selector *"Año fact."* del encabezado. Por defecto es el año en curso y la
  elección queda guardada en el navegador; las opciones salen de los años que cubre la data
  (fecha de inicio de facturación + tiempo de contrato). El Excel original lo tenía fijo en 2026.

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
GHL_PIPELINE_ID=xxxxxxxx        # (opcional) pipeline a mostrar
PORT=3001
REFRESH_MS=30000                # refresco automático cada 30 s
```

## Producción (un solo servicio)

```bash
npm run build   # genera dist/
npm start       # Express sirve dist/ + la API
```

## Deploy en Railway

1. Conecta este repo en Railway (build/start ya definidos en `railway.json`).
2. Carga las variables de entorno (`GHL_TOKEN`, `GHL_LOCATION_ID`, `GHL_PIPELINE_ID`).
3. Railway expone el servicio; el dashboard queda en la raíz `/infotrack-dashboard`.

## Notas

- La data real **no** se versiona: el seed `src/data/pipeline.json` está en `.gitignore`.
  Todo se obtiene en vivo de GoHighLevel.
- Endpoints de descubrimiento: `/api/ghl/pipelines`, `/api/ghl/custom-fields`, `/api/ghl/mapping-check`.
- El motor de cálculo (`src/lib/calc.js`) replica las fórmulas del Excel: MCB, facturación
  mensual, MB, probabilidad, pipeline sensibilizado, etc.

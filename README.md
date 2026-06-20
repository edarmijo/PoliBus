# PoliBus — DSS de Transporte ESPOL × SEDAREY

App de transporte universitario con 3 portales (Estudiante móvil, SEDAREY, ESPOL),
mapas con rutas reales que siguen las calles y los horarios oficiales de ESPOL.

## Desarrollo

```bash
npm i           # instala dependencias
npm run dev     # servidor de desarrollo
```

## Rutas y mapas

- Las rutas, horarios y precios reales están en [`src/app/data/routes.ts`](src/app/data/routes.ts)
  (fuente: <https://www.espol.edu.ec/es/rutas-de-transporte>).
- Las coordenadas por parada están en
  [`src/app/data/route-waypoints.json`](src/app/data/route-waypoints.json).
- El trazado real que sigue las calles está **precalculado** en
  `src/app/data/route-geometries.json` (no hay llamadas de red en runtime).

Para regenerar el trazado (p. ej. tras editar waypoints):

```bash
npm run build:routes
```

Usa OSRM público (gratis, sin API key). Puedes apuntar a otro servicio con
`ROUTING_URL` (ver `.env.example`).

## Conectar tus APIs

La app funciona con data local por defecto. Para conectar un backend:

1. Copia `.env.example` a `.env`.
2. Define `VITE_API_URL` con la URL de tu API (vacío = data local / funciones de `/api`).
3. La capa cliente está en [`src/app/lib/api.ts`](src/app/lib/api.ts)
   (`fetchRoutes`, `fetchBuses`, `fetchFeedback`, `postFeedback`) con fallback local.
4. Las funciones serverless de ejemplo están en [`api/`](api/) — reemplaza el cuerpo
   (marcado con `TODO`) por tus consultas a la base de datos.

## Deploy en Vercel

El proyecto ya incluye [`vercel.json`](vercel.json) (build de Vite + rewrite SPA + `/api`).

1. Sube el repo a GitHub e impórtalo en Vercel.
2. Configura las variables de entorno (`VITE_API_URL`, etc.) en el panel de Vercel.
3. Deploy. Las funciones de `/api` quedan disponibles en el mismo dominio.

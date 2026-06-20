# Plan: PoliBus — Mejoras a Ambos Dashboards + Cambio de Nombre

## Context

La app ya existe en `src/app/App.tsx` (~1511 líneas). Es un archivo único con todos los componentes, datos seed y dos dashboards (SedareyDashboard + EspolDashboard). El objetivo es:
1. Renombrar "PoliBusel" → "PoliBus" en todas las pantallas visibles.
2. Agregar nuevos KPIs gerenciales, filtro de fechas y panel de quejas al **Dashboard ESPOL**.
3. Agregar mantenimiento preventivo, puntualidad de flota y feed de incidentes al **Dashboard de la Cooperativa (SEDAREY)**.

Todo se implementa como evolución coherente del sistema existente — mismos colores (#005DAA, #0891B2, #7C3AED, #059669, dark bg #0D1B2E), misma tipografía Plus Jakarta Sans, mismo patrón de sidebar + header + content scroll.

---

## Cambio 0: Renombrar PoliBusel → PoliBus

Buscar y reemplazar todas las ocurrencias del texto visible "PoliBusel" en App.tsx:
- Sidebar SEDAREY: `"PoliBusel"` y `"SEDAREY Dashboard"` → `"PoliBus"`
- Sidebar ESPOL: `"PoliBusel"` y `"ESPOL — Supervisión"` → `"PoliBus"`
- LoginScreen: logo text `"PoliBusel"`, subtítulo `"Sistema de Transporte ESPOL × SEDAREY"` → `"PoliBus"`
- Status bar del StudentApp: `"PoliBusel"` → `"PoliBus"`
- Footer LoginScreen: `"PoliBusel"` → `"PoliBus"`

---

## Nuevos Datos Seed (agregar antes de los componentes)

### `maintenanceData` (para Cooperativa - Mantenimiento Preventivo)
```ts
const maintenanceData = [
  { busId: "B001", plate: "AEH-1234", driver: "Carlos Pizarro M.", kmDriven: 4823, interval: 5000 },
  { busId: "B002", plate: "AEH-2891", driver: "Miguel Alvarado V.", kmDriven: 2140, interval: 5000 },
  { busId: "B003", plate: "AEK-4521", driver: "Luis Vélez R.", kmDriven: 9650, interval: 10000 },
  { busId: "B004", plate: "AEK-7734", driver: "Jorge Quiñónez P.", kmDriven: 7820, interval: 10000 },
  { busId: "B005", plate: "AEL-0983", driver: "Andrés Morales C.", kmDriven: 4350, interval: 5000 },
  { busId: "B006", plate: "AEL-3312", driver: "Roberto Cedeño A.", kmDriven: 9980, interval: 10000 },
  { busId: "B007", plate: "AEM-5567", driver: "Freddy Salinas J.", kmDriven: 1230, interval: 5000 },
  { busId: "B008", plate: "AEM-8891", driver: "Pablo Intriago G.", kmDriven: 4710, interval: 5000 },
];
```
- `kmRemaining = interval - (kmDriven % interval)`
- `pct = (kmDriven % interval) / interval * 100`
- Status: kmRemaining < 200 → "URGENTE" (rojo), < 800 → "PRÓXIMO" (ámbar), otherwise "NORMAL" (verde)

### `operationalAlerts` (para Cooperativa - Feed de Incidentes)
```ts
const operationalAlerts = [
  { id: "OA001", busId: "B006", driver: "Roberto Cedeño A.", type: "Falla mecánica", detail: "Motor no arranca. Unidad inmovilizada en terminal.", timestamp: "2026-06-05 07:30", severity: "alto" },
  { id: "OA002", busId: "B004", driver: "Jorge Quiñónez P.", type: "Desvío por tráfico", detail: "Tráfico severo en Av. Francisco de Orellana. Ruta desviada.", timestamp: "2026-06-05 08:45", severity: "medio" },
  { id: "OA003", busId: "B003", driver: "Luis Vélez R.", type: "Aforo excedido", detail: "Capacidad máxima alcanzada. Pasajeros no abordaron.", timestamp: "2026-06-05 09:15", severity: "bajo" },
  { id: "OA004", busId: "B001", driver: "Carlos Pizarro M.", type: "Reporte de accidente", detail: "Colisión menor en parqueadero campus. Sin heridos.", timestamp: "2026-06-04 17:10", severity: "medio" },
  { id: "OA005", busId: "B002", driver: "Miguel Alvarado V.", type: "Bus no paró en parada", detail: "Parada Av. del Ejército omitida por aforo completo.", timestamp: "2026-06-04 08:22", severity: "bajo" },
  { id: "OA006", busId: "B005", driver: "Andrés Morales C.", type: "Desvío por tráfico", detail: "Bloqueo en Kennedy Norte. Ruta ajustada.", timestamp: "2026-06-03 13:40", severity: "bajo" },
];
```

### `plannedVsExecuted` (para ESPOL - Cumplimiento de Rutas)
```ts
const plannedVsExecuted = [
  { route: "R1 Terminal", planned: 12, executed: 11 },
  { route: "R2 Urdesa", planned: 10, executed: 10 },
  { route: "R3 Kennedy", planned: 8, executed: 7 },
  { route: "R4 Interno", planned: 20, executed: 19 },
];
```

### `incidentsByUnit` (para ESPOL - Incidentes por Unidad)
```ts
const incidentsByUnit = [
  { busId: "B006", plate: "AEL-3312", driver: "Roberto Cedeño A.", count: 4, types: ["Falla mecánica", "Retraso"] },
  { busId: "B004", plate: "AEK-7734", driver: "Jorge Quiñónez P.", count: 3, types: ["Desvío", "Aforo"] },
  { busId: "B003", plate: "AEK-4521", driver: "Luis Vélez R.", count: 2, types: ["Aforo excedido"] },
  { busId: "B002", plate: "AEH-2891", driver: "Miguel Alvarado V.", count: 1, types: ["No paró"] },
  { busId: "B001", plate: "AEH-1234", driver: "Carlos Pizarro M.", count: 1, types: ["Accidente menor"] },
];
```

### `complaintClusters` (para ESPOL - Quejas Frecuentes, calculado de feedbackItems)
Calculado en tiempo de render usando keyword matching sobre `feedbackItems.filter(f => f.type === "queja")`:
```ts
const COMPLAINT_KEYWORDS = [
  { tag: "Bus lleno", keywords: ["lleno", "capacidad", "subir", "esperar"] },
  { tag: "No paró",   keywords: ["paró", "pasó", "omitió", "no paró"] },
  { tag: "Retraso",   keywords: ["retraso", "tardío", "espera", "tarde"] },
  { tag: "Conductor", keywords: ["conductor", "conducción", "temeraria", "amabilidad"] },
];
```
Se cuenta cuántas quejas contienen cada keyword y se ordena de mayor a menor.

---

## Nuevos Componentes Reutilizables

### `DateRangeFilter` (para ESPOL header)
Props: `{ from: string; to: string; onFromChange; onToChange; onReset }`  
- Dos `<input type="date">` con etiquetas "Desde" / "Hasta"
- Botones rápidos: "Hoy", "Esta semana", "Este mes"  
- Estilo: bg blanco, border border-border, rounded-xl, inline con el header  
- Se coloca en el **header de EspolDashboard**, justo debajo del título

### `KPIHeroCard` (nuevo tipo de stat card para ESPOL)
Props: `{ label; value; unit?; target?; status: "ok"|"warn"|"critical"; subtitle? }`  
- Número grande (text-4xl font-extrabold), etiqueta debajo  
- Indicador de color lateral izquierdo (4px border-left): verde/ámbar/rojo  
- Diferente al `KPI card` actual (este es más grande, más prominente)  
- Reutilizable en ambos dashboards

### `MaintenancePanel` (para SEDAREY - tab "mantenimiento")
- Lista de 8 buses con:
  - Nombre unidad + placa + conductor
  - Barra de progreso: `(kmDriven % interval) / interval * 100`  
  - Texto: "X km hasta próximo mantenimiento"
  - Badge de status: URGENTE (rojo) / PRÓXIMO (ámbar) / NORMAL (verde)
- Ordenado por urgencia (menor kmRemaining primero)
- Alerta destacada arriba si hay unidades en estado URGENTE

### `IncidentFeed` (para SEDAREY - dentro de "monitoreo")
- Lista cronológica de `operationalAlerts`
- Filtro por tipo: Todos / Falla mecánica / Desvío / Aforo / Accidente
- Card por alerta: timestamp, busId + driver, tipo (badge), detalle, severity
- Reemplaza/amplia el panel "Incidentes Activos" actual en monitoreo

### `ComplaintsRankingPanel` (para ESPOL - dentro de "satisfaccion")
- Título: "Quejas más frecuentes"
- Lista de clusters ordenados por frecuencia:
  - Tag label (ej. "Bus lleno")
  - Barra de frecuencia relativa
  - Número de menciones
- Basado en `complaintClusters` computado sobre feedbackItems filtrados por fecha

---

## Cambios por Dashboard

### ESPOL Dashboard (`EspolDashboard`)

**1. DateRangeFilter en header**  
- Agregar estado `dateFrom: string` + `dateTo: string` al componente  
- Mostrar `DateRangeFilter` debajo del título en el header (siempre visible, no depende del tab)
- Afecta: filtrado de `feedbackItems` (tab satisfaccion), `performanceHistory` (tab reportes)

**2. Tab "kpis" — ampliar con 4 KPIs gerenciales**  
Reemplazar las 4 tarjetas actuales (Rutas a Tiempo, Unidades Operativas, Pasajeros, Calificación) con una fila de **4 `KPIHeroCard`** nuevas más prominentes, y mover los indicadores actuales a una segunda fila de cards más pequeñas.

Las 4 nuevas cards:
- **Tasa de Puntualidad** → `84%` (target ≥85%) — verde si ≥85, ámbar si 80-84, rojo si <80
- **Cumplimiento de Rutas** → `85.7%` (47/55 vueltas ejecutadas vs planificadas) — agregar BarChart pequeño de `plannedVsExecuted` (planificado vs. real por ruta)
- **Incidentes Críticos** — tabla de `incidentsByUnit` ordenada por count (máx 5 filas)
- **Satisfacción Neta** → `3.9/5` con `StarRow` + promedio — ya existe, mejorar jerarquía visual

**3. Tab "satisfaccion" — agregar `ComplaintsRankingPanel`**  
Colocar debajo de los componentes existentes (avg rating + distribución + línea de tendencia). El panel muestra el ranking de quejas frecuentes calculado desde `feedbackItems`.

**4. Tab "alertas" — mantener igual** (ya tiene las alertas bien definidas)

---

### SEDAREY Dashboard (`SedareyDashboard`)

**1. Tab "monitoreo" — agregar KPI de Puntualidad + ampliar Incidents**  
- En la fila de 4 KPI cards actuales, **agregar una 5ª card** (o reemplazar la de Incidentes): **Puntualidad de Flota** `84%` usando el mismo `KPIHeroCard`  
- Reemplazar el panel "Incidentes Activos" por el componente `IncidentFeed` (cronológico + filtrable por tipo)

**2. Nuevo tab "mantenimiento" (6º tab en sidebar)**  
- Agregar `"mantenimiento"` al tipo `SedareyTab`
- Icono: `<Wrench>` de lucide-react
- Label: "Mantenimiento"
- Contenido: `MaintenancePanel` con los 8 buses + alertas de mantenimiento
- Incluir KPI summary arriba: "X unidades URGENTE", "Y unidades PRÓXIMO"

---

## Estructura de Archivos

Todo en `src/app/App.tsx` (archivo único existente). El archivo crecerá de ~1511 a ~2100 líneas.

Orden de adiciones:
1. Nuevos tipos: `MaintenanceData`, `OperationalAlert`, `PlannedVsExecuted`, `IncidentByUnit`
2. Nuevos arrays de seed data (después de los existentes)
3. Función helper `computeComplaintClusters(items, dateFrom, dateTo)`
4. Función helper `getMaintenanceStatus(kmRemaining): "URGENTE"|"PRÓXIMO"|"NORMAL"`
5. Nuevos componentes: `DateRangeFilter`, `KPIHeroCard`, `MaintenancePanel`, `IncidentFeed`, `ComplaintsRankingPanel`
6. Modificar `EspolDashboard`: state de fechas, nuevo header con filtro, tabs actualizadas
7. Modificar `SedareyDashboard`: nuevo tab "mantenimiento" en sidebar + nav, ampliar monitoreo

---

## Verificación

1. Cambio de nombre: Todas las ocurrencias de "PoliBusel" desaparecen del UI (login, sidebars, mobile header)
2. ESPOL → kpis: 4 KPIHeroCards con colores condicionales correctos + tabla incidentsByUnit + BarChart plannedVsExecuted
3. ESPOL → satisfaccion: ComplaintsRankingPanel visible con ranking de 4 clusters
4. ESPOL → header: DateRangeFilter con inputs de fecha y quick-select buttons visibles y funcionales
5. SEDAREY → monitoreo: KPI card de puntualidad + IncidentFeed reemplaza panel de incidentes, filtro funciona
6. SEDAREY → sidebar: 6 ítems de nav (agrega "Mantenimiento" con ícono Wrench)
7. SEDAREY → mantenimiento tab: 8 buses con barras de progreso, ordenados por urgencia, badge URGENTE/PRÓXIMO/NORMAL
8. Recharts: `plannedVsExecuted` BarChart (planificado en azul claro, ejecutado en azul) funciona con ResponsiveContainer
9. No hay regresiones en StudentApp ni en tabs no modificadas

# PoliBusel — DSS Transporte Universitario ESPOL

## Context
Build a complete Decision Support System (DSS) for ESPOL's university bus fleet operated by SEDAREY in Guayaquil, Ecuador. Three distinct user portals in a single React SPA.

## Status: IMPLEMENTED ✓

All files were written in the preceding turn. No further changes required.

## Files Modified

| File | Change |
|------|--------|
| `src/styles/fonts.css` | Added Plus Jakarta Sans + Inter + JetBrains Mono from Google Fonts |
| `src/styles/theme.css` | Updated tokens: `--primary: #005DAA`, `--background: #F0F4FA`, dark sidebar vars |
| `src/app/App.tsx` | Complete ~1 500-line implementation (see below) |

## Architecture

```
App (role state: null | student | sedarey | espol)
├── LoginScreen        — dark hero, 3 role-selection cards
├── StudentApp         — mobile phone frame (390×844), 4 tabs
│   ├── BusMap (SVG)   — animated buses along route polylines
│   ├── Mapa tab       — route filter, live bus cards, ETA, occupancy
│   ├── Rutas tab      — stop timeline, fare, frequency
│   ├── Notificaciones — push notification feed (5 items)
│   └── Cuenta tab     — profile, star-rating feedback form, trip history
├── SedareyDashboard   — full desktop, dark sidebar, 5 panels
│   ├── Monitoreo      — KPIs, full map, fleet table, incidents
│   ├── Aforo          — occupancy cards + AreaChart by hour
│   ├── Financiero     — revenue KPIs, BarChart + LineChart, daily table
│   ├── Retroalimentación — feedback inbox with type/status filters
│   └── Supervisor     — quick incident registration form
└── EspolDashboard     — read-only, purple sidebar, 4 panels
    ├── KPIs           — metric cards vs. institutional targets, fleet map
    ├── Satisfacción   — star distribution, trend LineChart
    ├── Reportes       — dual-axis chart + monthly performance table
    └── Alertas        — contextual alert panels + threshold table
```

## Key Design Decisions
- **BusMap**: SVG viewBox 600×400, `preserveAspectRatio="xMidYMid slice"`. Buses animated via `useEffect` + `setInterval` (100ms tick, +0.0013 progress/tick). Route paths defined as typed `[number, number][]` arrays; position computed with linear interpolation.
- **Theme**: Institutional blue `#005DAA` primary, `#0D1B2E` sidebar, `#F0F4FA` background.
- **Fonts**: Plus Jakarta Sans (display/headings), Inter (body), JetBrains Mono (data labels).
- **Charts**: Recharts `AreaChart` (occupancy), `BarChart` (weekly revenue), `LineChart` (monthly + satisfaction trend), dual-axis `LineChart` (ESPOL reports).
- **Seed data**: 4 routes, 8 buses, 6 feedback items, 3 incidents, 6-week/6-month chart data.

## Feature: Real Leaflet Map + Working Date Filter

### Context
User wants: (1) real OpenStreetMap map showing Guayaquil instead of the SVG grid, (2) buses animated along correct routes with stops visible, (3) the date range filter in the ESPOL dashboard to actually filter displayed data.

### 1. Install packages
```bash
pnpm add leaflet react-leaflet
pnpm add -D @types/leaflet
```
Import Leaflet CSS inside `BusMap` component: `import 'leaflet/dist/leaflet.css'`

### 2. Replace BusMap SVG → Leaflet component (`src/app/App.tsx`)

**Real Guayaquil coordinates** (`ROUTE_COORDS: Record<number, [number,number][]>`):
```
R1 – ESPOL→Terminal: ESPOL[-2.1488,-79.9688] → Tanca Marengo[-2.1570,-79.9450] → Arosemena[-2.1740,-79.9210] → Av.Ejército[-2.1890,-79.9050] → Terminal[-2.2028,-79.9044]
R2 – ESPOL→Urdesa:   ESPOL → Tanca Marengo → Orellana[-2.1640,-79.9200] → Urdesa[-2.1660,-79.9070] → Alborada[-2.1500,-79.9000]
R3 – ESPOL→Kennedy:  ESPOL → Tanca Marengo → Kennedy N[-2.1350,-79.9050] → Mall del Sol[-2.1420,-79.8990] → Kennedy C[-2.1470,-79.9000]
R4 – Circuito:       Entrada[-2.1488,-79.9688] → Biblioteca[-2.1494,-79.9698] → FESPE[-2.1500,-79.9706] → Polideportivo[-2.1508,-79.9694] → Entrada[-2.1488,-79.9688]
```

**BusMap props stay the same** (`height`, `selectedRoute`). Internally switch to:
- `MapContainer` centered on ESPOL `[-2.165, -79.945]` zoom 13
- `TileLayer` from OpenStreetMap
- `Polyline` per route (active = full opacity + weight 5, inactive = weight 2 + opacity 0.25)
- `CircleMarker` per stop (radius 6 when active-route, 3 otherwise); show `Popup` with stop name on active route
- Bus markers: `Marker` with custom `L.divIcon` (styled HTML div with route color + occupancy dot)
- Animation: same `useEffect + setInterval` approach, interpolate position along `ROUTE_COORDS[routeId]` using existing `lerp()`, update React state → re-render `Marker` positions

Custom bus DivIcon HTML (inline style, no external images):
```html
<div style="background:{routeColor};border-radius:5px;padding:2px 5px;color:white;font-size:7px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);position:relative">
  {busId}
  <span style="position:absolute;top:-4px;right:-4px;width:9px;height:9px;border-radius:50%;background:{ocColor};border:1.5px solid white"></span>
</div>
```

Fix default Leaflet icon path issue (known Vite/webpack issue):
```tsx
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
L.Icon.Default.mergeOptions({ iconUrl, shadowUrl, iconRetinaUrl: iconUrl });
```
(Only needed if default Marker is used — since we use DivIcon, just suppress the warning.)

### 3. Working date filter in EspolDashboard (`src/app/App.tsx`)

Current state: `dateFrom="2026-05-01"`, `dateTo="2026-06-05"`. The `onApply` callback updates these but nothing reacts.

**Changes:**
- Derive `filteredFeedback` from `feedbackItems` filtered by `item.date >= dateFrom && item.date <= dateTo`
- Derive `filteredPerformance` from `performanceHistory` — map month abbreviations to numbers, keep rows whose month falls within the date range
- Derive `filteredSatisfaction` trend similarly (filter by week label → approximate month)
- Recompute `avgRating`, `criticalInc`, `avgCompliance` from the filtered sets
- Pass filtered data to all charts (`BarChart`, `LineChart`), tables, and KPI cards in `EspolDashboard`
- Show a visible feedback count badge ("Mostrando N de M registros") so the user can see filtering is working

Month-to-number map for filtering `performanceHistory`:
```ts
const MONTH_NUM: Record<string,number> = { Ene:1, Feb:2, Mar:3, Abr:4, May:5, Jun:6, Jul:7, Ago:8, Sep:9, Oct:10, Nov:11, Dic:12 };
```
Parse `dateFrom`/`dateTo` → get fromMonth and toMonth (same year 2026), keep rows where `MONTH_NUM[row.month]` is in range.

### Files modified
- `src/app/App.tsx` — full rewrite of `BusMap` + `EspolDashboard` filter logic

### Verification
1. Open ESPOL dashboard → map shows real Guayaquil streets via OpenStreetMap tiles
2. Bus markers animate along real routes; select a route → see that route's polyline + labelled stops
3. Change date range to "2026-01-01 – 2026-03-31" → Aplicar filtro → KPIs, charts, and tables update to show only Jan–Mar data
4. Change date range back to full period → data resets

## Bug Fix: Duplicate Key Warnings in Recharts

### Root Causes
Two causes in `src/app/App.tsx` inside `EspolDashboard`:

1. **`ticks={[1,2,3,4,5]}` + `domain={[1,5]}`** on the satisfaction trend `YAxis` (line ~1744) — recharts merges explicit ticks with auto-calculated domain-boundary ticks, producing duplicate React keys for values `1` and `5`.

2. **Dual-axis `LineChart`** in the reportes tab (lines ~1769–1778) — two `YAxis` components without explicit `key` props; recharts internal key generator can produce duplicate keys for the two axes.

### Fixes (both in `src/app/App.tsx`)

**Fix 1** — Remove `ticks` prop from satisfaction trend `YAxis`, keep only `domain`:
```tsx
// Before
<YAxis domain={[1,5]} ticks={[1,2,3,4,5]} tick={{ fontSize: 11, fill: "#64748B" }} />
// After
<YAxis domain={[1,5]} tick={{ fontSize: 11, fill: "#64748B" }} />
```

**Fix 2** — Add explicit `key` props to both `YAxis` and both `Line` in the performance LineChart:
```tsx
<YAxis key="ya-left"  yAxisId="l" ... />
<YAxis key="ya-right" yAxisId="r" ... />
<Line  key="ln-time"  yAxisId="l" ... />
<Line  key="ln-sat"   yAxisId="r" ... />
```

No other changes needed.

## Verification
1. Open the app — login screen with 3 role cards appears.
2. Click **Estudiante** → phone frame with animated buses on SVG map.
3. Click **Operador SEDAREY** → full dashboard; navigate all 5 sidebar sections; submit supervisor form.
4. Click **Supervisión ESPOL** → read-only dashboard; check KPI badges, chart rendering, alerts table.
5. Confirm buses move continuously in the map (BusMap animation loop).

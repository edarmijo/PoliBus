// ─── CATÁLOGO REAL DE RUTAS ESPOL / SEDAREY ───────────────────
// Fuente: https://www.espol.edu.ec/es/rutas-de-transporte
// Periodo I Término 2026-2027 · Proveedor: SEDAREY S.A. · WhatsApp: 0958681023
//
// Las coordenadas (waypoints) son aproximadas a barrios/paradas de Guayaquil.
// El trazado real que sigue las calles se precalcula con OSRM en
// scripts/fetch-route-geometries.mjs y se cachea en route-geometries.json.
// Si una ruta no tiene geometría cacheada, se cae a los waypoints (línea recta).

import geometries from "./route-geometries.json";
import waypointsData from "./route-waypoints.json";

const WAYPOINTS = waypointsData as Record<string, [number, number][]>;
const wp = (id: number): [number, number][] => WAYPOINTS[String(id)];

export type RouteDirection = "ingreso" | "salida";

export type RouteSchedule =
  | { kind: "fixed"; times: string[] }
  | { kind: "interval"; blocks: { from: string; to: string; everyMin: number }[] };

export interface EspolRoute {
  id: number;
  name: string;          // nombre completo p. ej. "Acacias → ESPOL"
  shortName: string;     // etiqueta corta p. ej. "Acacias"
  direction: RouteDirection;
  color: string;
  fare: number;          // 0 = gratis
  units: number;         // unidades asignadas
  stops: string[];       // paradas clave (paralelo a waypoints)
  waypoints: [number, number][]; // [lat,lng] por parada (mismo orden que stops)
  schedule: RouteSchedule;
}

// Campus Gustavo Galindo (Prosperina)
export const ESPOL_CAMPUS: [number, number] = [-2.1447, -79.9668];

export const PROVIDER = {
  name: "SEDAREY S.A.",
  whatsapp: "0958681023",
  period: "I Término 2026-2027",
};

export const routes: EspolRoute[] = [
  // ─── INGRESO A ESPOL ───────────────────────────────────────
  {
    id: 1, name: "Interna → ESPOL", shortName: "Interna", direction: "ingreso",
    color: "#005DAA", fare: 0, units: 1,
    stops: ["UPC Ceibos 2", "Av. del Bombero", "Campus ESPOL"],
    waypoints: wp(1),
    schedule: { kind: "interval", blocks: [
      { from: "07:00", to: "10:00", everyMin: 20 },
      { from: "10:00", to: "17:30", everyMin: 30 },
    ] },
  },
  {
    id: 2, name: "Acacias → ESPOL", shortName: "Acacias", direction: "ingreso",
    color: "#0891B2", fare: 0.70, units: 1,
    stops: ["Bloques Acacias", "Sopeña", "Vía Perimetral", "Campus ESPOL"],
    waypoints: wp(2),
    schedule: { kind: "fixed", times: ["06:00", "08:00", "10:00", "12:00"] },
  },
  {
    id: 3, name: "Albán Borja → ESPOL", shortName: "Albán Borja", direction: "ingreso",
    color: "#7C3AED", fare: 0.40, units: 1,
    stops: ["Metrovía Colegio 28 de Mayo", "Av. C.J. Arosemena", "McDonald's Urdesa", "Campus ESPOL"],
    waypoints: wp(3),
    schedule: { kind: "fixed", times: ["06:30", "08:15", "10:15"] },
  },
  {
    id: 4, name: "Cuenca → ESPOL", shortName: "Cuenca", direction: "ingreso",
    color: "#059669", fare: 0.60, units: 1,
    stops: ["Cuenca y Tungurahua", "Puente de la 17", "Bellavista", "Albán Borja", "Campus ESPOL"],
    waypoints: wp(4),
    schedule: { kind: "fixed", times: ["06:10", "08:00"] },
  },
  {
    id: 5, name: "Durán → ESPOL", shortName: "Durán", direction: "ingreso",
    color: "#DC2626", fare: 0.80, units: 1,
    stops: ["Banco Pichincha Durán", "Puente Unidad Nacional", "Av. Benjamín Rosales", "Viaducto Prosperina", "Campus ESPOL"],
    waypoints: wp(5),
    schedule: { kind: "fixed", times: ["06:00", "08:00", "09:40"] },
  },
  {
    id: 6, name: "Orellana → ESPOL", shortName: "Orellana", direction: "ingreso",
    color: "#D97706", fare: 0.50, units: 1,
    stops: ["Mucho Lote 1", "Colegio Mariscal Sucre", "Av. Juan Tanca Marengo", "Campus ESPOL"],
    waypoints: wp(6),
    schedule: { kind: "fixed", times: ["06:20", "07:30"] },
  },
  {
    id: 7, name: "Samborondón → ESPOL", shortName: "Samborondón", direction: "ingreso",
    color: "#DB2777", fare: 0.80, units: 1,
    stops: ["Ecu 911", "Vía Samborondón", "Av. León Febres Cordero", "Campus ESPOL"],
    waypoints: wp(7),
    schedule: { kind: "fixed", times: ["05:50", "07:50", "09:50"] },
  },
  {
    id: 8, name: "Sauces 2 → ESPOL", shortName: "Sauces 2", direction: "ingreso",
    color: "#2563EB", fare: 0.50, units: 1,
    stops: ["Super Seco", "Av. Agustín Freire", "Viaducto Prosperina", "Campus ESPOL"],
    waypoints: wp(8),
    schedule: { kind: "fixed", times: ["06:20", "08:10"] },
  },
  {
    id: 9, name: "Sauces 8 → ESPOL", shortName: "Sauces 8", direction: "ingreso",
    color: "#0D9488", fare: 0.50, units: 1,
    stops: ["Pollo Encanto", "Av. Gabriel Roldós", "Av. Agustín Freire", "Campus ESPOL"],
    waypoints: wp(9),
    schedule: { kind: "fixed", times: ["06:10", "08:10", "10:15"] },
  },
  {
    id: 10, name: "Terminal Pascuales → ESPOL", shortName: "T. Pascuales", direction: "ingreso",
    color: "#9333EA", fare: 0.50, units: 1,
    stops: ["Gasolinera PDV", "Vía Daule", "Campus ESPOL"],
    waypoints: wp(10),
    schedule: { kind: "fixed", times: ["06:20", "07:30"] },
  },

  // ─── SALIDA DE ESPOL ───────────────────────────────────────
  {
    id: 11, name: "ESPOL → Interna", shortName: "Interna", direction: "salida",
    color: "#005DAA", fare: 0, units: 1,
    stops: ["Campus ESPOL", "Av. del Bombero", "UPC Ceibos 2"],
    waypoints: wp(11),
    schedule: { kind: "interval", blocks: [
      { from: "07:15", to: "10:00", everyMin: 20 },
      { from: "10:00", to: "17:30", everyMin: 30 },
    ] },
  },
  {
    id: 12, name: "ESPOL → Albán Borja", shortName: "Albán Borja", direction: "salida",
    color: "#7C3AED", fare: 0.40, units: 1,
    stops: ["Campus ESPOL", "Av. Leopoldo Carrera", "McDonald's", "Colegio 28 de Mayo"],
    waypoints: wp(12),
    schedule: { kind: "fixed", times: ["13:15", "15:15", "17:30"] },
  },
  {
    id: 13, name: "ESPOL → City Mall", shortName: "City Mall", direction: "salida",
    color: "#EA580C", fare: 0.50, units: 1,
    stops: ["Campus ESPOL", "Viaducto Prosperina", "Liceo Cristiano", "City Mall"],
    waypoints: wp(13),
    schedule: { kind: "fixed", times: ["09:30", "11:45", "13:15", "14:15", "15:15", "16:15", "17:30"] },
  },
  {
    id: 14, name: "ESPOL → Durán-Samborondón", shortName: "Durán-Samb.", direction: "salida",
    color: "#DC2626", fare: 0.80, units: 1,
    stops: ["Campus ESPOL", "Vía Perimetral", "La Puntilla", "Puente Unidad Nacional"],
    waypoints: wp(14),
    schedule: { kind: "fixed", times: ["13:15", "15:15", "17:30"] },
  },
  {
    id: 15, name: "ESPOL → Orellana", shortName: "Orellana", direction: "salida",
    color: "#D97706", fare: 0.50, units: 1,
    stops: ["Campus ESPOL", "Plaza Sai Baba", "Colinas de la Alborada", "Riocentro Norte", "Gran Aki"],
    waypoints: wp(15),
    schedule: { kind: "fixed", times: ["13:15", "15:15", "17:30"] },
  },
  {
    id: 16, name: "ESPOL → Sur", shortName: "Sur", direction: "salida",
    color: "#0891B2", fare: 0.70, units: 1,
    stops: ["Campus ESPOL", "Av. Barcelona", "Puente de la 17", "Bloques Acacias"],
    waypoints: wp(16),
    schedule: { kind: "fixed", times: ["11:10", "13:15", "15:15", "17:30"] },
  },
  {
    id: 17, name: "ESPOL → Terminal Pascuales", shortName: "T. Pascuales", direction: "salida",
    color: "#9333EA", fare: 0.50, units: 1,
    stops: ["Campus ESPOL", "Vía Daule", "Gasolinera PDV"],
    waypoints: wp(17),
    schedule: { kind: "fixed", times: ["13:15", "15:15", "17:30"] },
  },
];

const GEOMS = geometries as Record<string, [number, number][]>;

/** Geometría densa que sigue las calles (OSRM). Fallback: waypoints. */
export function getRouteGeometry(routeId: number): [number, number][] {
  const g = GEOMS[String(routeId)];
  if (g && g.length > 1) return g;
  const r = routes.find(x => x.id === routeId);
  return r ? r.waypoints : [];
}

export function getRoute(routeId: number): EspolRoute | undefined {
  return routes.find(r => r.id === routeId);
}

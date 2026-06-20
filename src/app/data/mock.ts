// Datos de demostración (flota, feedback, incidentes, KPIs).
// Referencian las rutas reales de ESPOL definidas en ./routes.
// MIGRACIÓN: estas constantes son el fallback local; las funciones serverless
// en /api las devuelven hoy y luego se reemplazan por tu base de datos / API.

export type OccupancyLevel = "LIBRE" | "MODERADO" | "LLENO";
export type BusStatus = "en_ruta" | "detenido" | "fuera_de_servicio";
export type FeedbackType = "queja" | "sugerencia" | "felicitacion";
export type FeedbackStatus = "pendiente" | "resuelto";

export interface BusData {
  id: string; plate: string; route: string; routeId: number; driver: string;
  status: BusStatus; occupancy: OccupancyLevel; passengers: number; capacity: number;
  eta: number; speed: number; lastUpdate: string; progress: number;
}
export interface FeedbackItem {
  id: string; studentName: string; carnet: string; route: string; rating: number;
  comment: string; type: FeedbackType; status: FeedbackStatus; date: string;
}
export interface Incident { id: string; bus: string; type: string; description: string; time: string; severity: "alto" | "medio" | "bajo"; }
export interface MaintenanceRecord { id: string; plate: string; driver: string; kmTotal: number; kmLastService: number; threshold: number; }
export interface OperativeIncident { id: string; bus: string; driver: string; type: string; detail: string; date: string; time: string; severity: "alto" | "medio" | "bajo"; status: "activo" | "resuelto" | "pendiente"; }

export const buses: BusData[] = [
  { id: "B001", plate: "AEH-1234", route: "Interna", routeId: 1, driver: "Carlos Pizarro M.", status: "en_ruta", occupancy: "LIBRE", passengers: 12, capacity: 30, eta: 8, speed: 28, lastUpdate: "30s", progress: 0.18 },
  { id: "B002", plate: "AEH-2891", route: "Acacias", routeId: 2, driver: "Miguel Alvarado V.", status: "en_ruta", occupancy: "MODERADO", passengers: 28, capacity: 45, eta: 22, speed: 38, lastUpdate: "45s", progress: 0.62 },
  { id: "B003", plate: "AEK-4521", route: "Albán Borja", routeId: 3, driver: "Luis Vélez R.", status: "en_ruta", occupancy: "LLENO", passengers: 44, capacity: 44, eta: 15, speed: 31, lastUpdate: "1m", progress: 0.41 },
  { id: "B004", plate: "AEK-7734", route: "Durán", routeId: 5, driver: "Jorge Quiñónez P.", status: "detenido", occupancy: "MODERADO", passengers: 21, capacity: 44, eta: 38, speed: 0, lastUpdate: "5m", progress: 0.55 },
  { id: "B005", plate: "AEL-0983", route: "Orellana", routeId: 6, driver: "Andrés Morales C.", status: "en_ruta", occupancy: "LIBRE", passengers: 8, capacity: 40, eta: 5, speed: 45, lastUpdate: "20s", progress: 0.14 },
  { id: "B006", plate: "AEL-3312", route: "City Mall", routeId: 13, driver: "Roberto Cedeño A.", status: "fuera_de_servicio", occupancy: "LIBRE", passengers: 0, capacity: 40, eta: 0, speed: 0, lastUpdate: "2h", progress: 0 },
  { id: "B007", plate: "AEM-5567", route: "Samborondón", routeId: 7, driver: "Freddy Salinas J.", status: "en_ruta", occupancy: "MODERADO", passengers: 26, capacity: 44, eta: 12, speed: 52, lastUpdate: "15s", progress: 0.33 },
  { id: "B008", plate: "AEM-8891", route: "Sur", routeId: 16, driver: "Pablo Intriago G.", status: "en_ruta", occupancy: "MODERADO", passengers: 19, capacity: 45, eta: 18, speed: 35, lastUpdate: "1m", progress: 0.71 },
];

export const feedbackItems: FeedbackItem[] = [
  { id: "F001", studentName: "Ana Garcés", carnet: "201801234", route: "Interna", rating: 5, comment: "Excelente servicio hoy, el bus llegó puntual y muy limpio. El conductor fue muy amable con todos.", type: "felicitacion", status: "resuelto", date: "2026-06-04" },
  { id: "F002", studentName: "Diego Ávila", carnet: "201902345", route: "Acacias", rating: 2, comment: "El bus estaba completamente lleno y no pudimos subir. Tuvimos que esperar la siguiente salida bajo el sol.", type: "queja", status: "pendiente", date: "2026-06-05" },
  { id: "F003", studentName: "Sofía Romero", carnet: "202003456", route: "Albán Borja", rating: 3, comment: "Sugiero una salida adicional en la mañana, los lunes hay muchísimos estudiantes a las 06:30.", type: "sugerencia", status: "pendiente", date: "2026-06-05" },
  { id: "F004", studentName: "Mateo Herrera", carnet: "201804567", route: "Durán", rating: 1, comment: "El bus de las 06:00 no paró en el Puente Unidad Nacional aunque había varios estudiantes. Inaceptable.", type: "queja", status: "pendiente", date: "2026-06-04" },
  { id: "F005", studentName: "Valeria Pino", carnet: "202105678", route: "Interna", rating: 4, comment: "La ruta interna funciona muy bien. Muy útil para moverse desde Ceibos sin caminar tanto.", type: "felicitacion", status: "resuelto", date: "2026-06-03" },
  { id: "F006", studentName: "Cristian Loor", carnet: "201906789", route: "Samborondón", rating: 3, comment: "El rastreo en tiempo real es muy útil pero a veces el ETA se desactualiza por varios minutos.", type: "sugerencia", status: "pendiente", date: "2026-06-05" },
  { id: "F007", studentName: "Karina Barros", carnet: "202007890", route: "Orellana", rating: 4, comment: "Buen servicio en general. Pocas veces he tenido problemas. Continúen así.", type: "felicitacion", status: "resuelto", date: "2026-05-28" },
  { id: "F008", studentName: "Luis Mendoza", carnet: "201808901", route: "Sur", rating: 2, comment: "El bus de salida llegó 30 minutos tarde y no había aviso previo. Perdí mi conexión en la 17.", type: "queja", status: "pendiente", date: "2026-05-15" },
  { id: "F009", studentName: "Paula Cevallos", carnet: "202109012", route: "City Mall", rating: 5, comment: "Muy cómodo tener salida directa a City Mall después de clases. Gracias.", type: "felicitacion", status: "resuelto", date: "2026-05-22" },
  { id: "F010", studentName: "Jorge Ramírez", carnet: "201900123", route: "Sauces 8", rating: 2, comment: "Solo hay 3 salidas y siempre van llenas. Pido más unidades para Sauces.", type: "queja", status: "pendiente", date: "2026-06-02" },
  { id: "F011", studentName: "María Suárez", carnet: "202011234", route: "Cuenca", rating: 3, comment: "El precio subió pero el servicio sigue igual. Ojalá mejoren la puntualidad.", type: "sugerencia", status: "pendiente", date: "2026-04-18" },
  { id: "F012", studentName: "Esteban Mora", carnet: "201802233", route: "Durán", rating: 1, comment: "Conducción muy brusca en el viaducto, varios pasajeros se asustaron.", type: "queja", status: "resuelto", date: "2026-04-09" },
  { id: "F013", studentName: "Camila Ortiz", carnet: "202103344", route: "Acacias", rating: 5, comment: "El conductor esperó a una compañera que venía corriendo. Gran gesto.", type: "felicitacion", status: "resuelto", date: "2026-03-27" },
  { id: "F014", studentName: "Andrés Vera", carnet: "201904455", route: "T. Pascuales", rating: 3, comment: "Estaría bien una salida más temprana hacia Pascuales en días de exámenes.", type: "sugerencia", status: "pendiente", date: "2026-03-12" },
  // Registros de fin de 2025 — útiles para probar el filtro de rango que cruza año
  { id: "F015", studentName: "Lucía Andrade", carnet: "201905566", route: "Interna", rating: 4, comment: "Buen cierre de semestre, el servicio mejoró bastante en diciembre.", type: "felicitacion", status: "resuelto", date: "2025-12-12" },
  { id: "F016", studentName: "Kevin Plúas", carnet: "202006677", route: "Albán Borja", rating: 2, comment: "En época de exámenes de diciembre faltaron unidades en la tarde.", type: "queja", status: "resuelto", date: "2025-11-28" },
];

export const incidents: Incident[] = [
  { id: "I001", bus: "B004", type: "Retraso significativo", description: "Bus detenido por tráfico intenso en el Puente Unidad Nacional, retraso aprox. 25 min.", time: "08:45", severity: "medio" },
  { id: "I002", bus: "B006", type: "Falla mecánica", description: "Falla de motor. Unidad fuera de servicio, en taller SEDAREY desde las 07:30.", time: "07:30", severity: "alto" },
  { id: "I003", bus: "B003", type: "Aforo máximo", description: "Bus de Albán Borja superó la capacidad permitida. Estudiantes no pudieron abordar.", time: "09:15", severity: "bajo" },
];

export const maintenanceData: MaintenanceRecord[] = [
  { id: "B001", plate: "AEH-1234", driver: "Carlos Pizarro M.", kmTotal: 48200, kmLastService: 45000, threshold: 50000 },
  { id: "B002", plate: "AEH-2891", driver: "Miguel Alvarado V.", kmTotal: 52100, kmLastService: 50000, threshold: 55000 },
  { id: "B003", plate: "AEK-4521", driver: "Luis Vélez R.", kmTotal: 63800, kmLastService: 60000, threshold: 65000 },
  { id: "B004", plate: "AEK-7734", driver: "Jorge Quiñónez P.", kmTotal: 71200, kmLastService: 70000, threshold: 75000 },
  { id: "B005", plate: "AEL-0983", driver: "Andrés Morales C.", kmTotal: 39600, kmLastService: 35000, threshold: 40000 },
  { id: "B006", plate: "AEL-3312", driver: "Roberto Cedeño A.", kmTotal: 88100, kmLastService: 85000, threshold: 90000 },
  { id: "B007", plate: "AEM-5567", driver: "Freddy Salinas J.", kmTotal: 22300, kmLastService: 20000, threshold: 25000 },
  { id: "B008", plate: "AEM-8891", driver: "Pablo Intriago G.", kmTotal: 59650, kmLastService: 55000, threshold: 60000 },
];

export const operativeIncidents: OperativeIncident[] = [
  { id: "OI001", bus: "B006", driver: "Roberto Cedeño A.", type: "Falla mecánica", detail: "Falla de motor en el Viaducto Prosperina. Unidad inmovilizada, grúa en camino.", date: "2026-06-05", time: "07:30", severity: "alto", status: "activo" },
  { id: "OI002", bus: "B004", driver: "Jorge Quiñónez P.", type: "Desvío por tráfico", detail: "Desvío no autorizado por congestión en el Puente Unidad Nacional. Retraso 25 min.", date: "2026-06-05", time: "08:45", severity: "medio", status: "resuelto" },
  { id: "OI003", bus: "B003", driver: "Luis Vélez R.", type: "Aforo excedido", detail: "Pasajeros abordaron sobre la capacidad máxima (44 pax). Bus no pudo detenerse en la siguiente parada.", date: "2026-06-05", time: "09:15", severity: "bajo", status: "resuelto" },
  { id: "OI004", bus: "B001", driver: "Carlos Pizarro M.", type: "No paró en parada", detail: "Reporte de 3 estudiantes: bus no paró en Av. del Bombero. Conductor alega semáforo rojo.", date: "2026-06-04", time: "17:40", severity: "medio", status: "pendiente" },
  { id: "OI005", bus: "B002", driver: "Miguel Alvarado V.", type: "Conducción temeraria", detail: "Queja formal: exceso de velocidad y frenazos bruscos en la Vía Perimetral. 2 pasajeros con malestar.", date: "2026-06-03", time: "08:10", severity: "alto", status: "pendiente" },
  { id: "OI006", bus: "B005", driver: "Andrés Morales C.", type: "Retraso significativo", detail: "Bus con 35 min de retraso por accidente en Av. Juan Tanca Marengo.", date: "2026-06-02", time: "12:20", severity: "bajo", status: "resuelto" },
  { id: "OI007", bus: "B008", driver: "Pablo Intriago G.", type: "No paró en parada", detail: "Estudiantes reportan que la unidad no se detuvo en Av. Barcelona en la salida de las 17:30.", date: "2026-06-01", time: "17:35", severity: "medio", status: "pendiente" },
  { id: "OI008", bus: "B007", driver: "Freddy Salinas J.", type: "Retraso significativo", detail: "Demora de 20 min por control vehicular en la Vía a Samborondón.", date: "2026-05-29", time: "07:55", severity: "bajo", status: "resuelto" },
];

export const complaintClusters = [
  { tag: "Bus lleno / aforo", count: 23, pct: 34, color: "#DC2626", examples: ["no pudimos subir", "completamente lleno", "aforo excedido"] },
  { tag: "No paró en parada", count: 18, pct: 27, color: "#D97706", examples: ["pasó de largo", "ignoró la parada", "no se detuvo"] },
  { tag: "Retraso / demora", count: 15, pct: 22, color: "#7C3AED", examples: ["llegó tarde", "esperé mucho", "mucho retraso"] },
  { tag: "Conducción brusca", count: 7, pct: 10, color: "#0891B2", examples: ["frenazos bruscos", "exceso de velocidad", "conducción peligrosa"] },
  { tag: "Mal estado del bus", count: 4, pct: 6, color: "#64748B", examples: ["bus sucio", "AC dañado", "asientos rotos"] },
];

// Cumplimiento por ruta (planificadas vs ejecutadas). Usa nombres reales.
export const routeCompliance = [
  { route: "Interna", planned: 36, executed: 35, color: "#005DAA" },
  { route: "Acacias", planned: 24, executed: 22, color: "#0891B2" },
  { route: "Albán Borja", planned: 18, executed: 15, color: "#7C3AED" },
  { route: "Durán", planned: 14, executed: 12, color: "#DC2626" },
  { route: "City Mall", planned: 21, executed: 20, color: "#EA580C" },
];

export const driverIncidents = [
  { driver: "Roberto Cedeño A.", bus: "B006", count: 4, types: ["Falla mecánica", "Retraso"], critical: true },
  { driver: "Jorge Quiñónez P.", bus: "B004", count: 3, types: ["Desvío", "Retraso"], critical: false },
  { driver: "Miguel Alvarado V.", bus: "B002", count: 2, types: ["Conducción temeraria"], critical: true },
  { driver: "Luis Vélez R.", bus: "B003", count: 2, types: ["Aforo excedido"], critical: false },
  { driver: "Pablo Intriago G.", bus: "B008", count: 1, types: ["No paró"], critical: false },
  { driver: "Carlos Pizarro M.", bus: "B001", count: 1, types: ["No paró"], critical: false },
  { driver: "Andrés Morales C.", bus: "B005", count: 1, types: ["Retraso"], critical: false },
  { driver: "Freddy Salinas J.", bus: "B007", count: 0, types: [], critical: false },
];

export const weeklyRevenue = [
  { day: "Lun", revenue: 284, passengers: 568 },
  { day: "Mar", revenue: 312, passengers: 624 },
  { day: "Mié", revenue: 298, passengers: 596 },
  { day: "Jue", revenue: 335, passengers: 670 },
  { day: "Vie", revenue: 401, passengers: 802 },
  { day: "Sáb", revenue: 156, passengers: 312 },
];

export const monthlyRevenue = [
  { month: "Ene", revenue: 6420 },
  { month: "Feb", revenue: 5890 },
  { month: "Mar", revenue: 7230 },
  { month: "Abr", revenue: 6980 },
  { month: "May", revenue: 7510 },
  { month: "Jun", revenue: 3840 },
];

// Rutas representativas mostradas en el gráfico de aforo por hora.
export const aforoRouteIds = [1, 2, 3, 5];

// Ocupación por hora — claves = routeId (string) de aforoRouteIds.
export const occupancyByHour = [
  { time: "06:00", "1": 10, "2": 18, "3": 12, "5": 20 },
  { time: "07:00", "1": 22, "2": 35, "3": 28, "5": 38 },
  { time: "07:30", "1": 26, "2": 43, "3": 40, "5": 41 },
  { time: "08:00", "1": 28, "2": 45, "3": 44, "5": 44 },
  { time: "08:30", "1": 24, "2": 42, "3": 38, "5": 39 },
  { time: "09:00", "1": 18, "2": 28, "3": 22, "5": 25 },
  { time: "10:00", "1": 16, "2": 18, "3": 15, "5": 14 },
  { time: "12:00", "1": 20, "2": 30, "3": 25, "5": 18 },
  { time: "13:00", "1": 24, "2": 38, "3": 28, "5": 22 },
  { time: "14:00", "1": 18, "2": 22, "3": 14, "5": 12 },
] as Array<Record<string, number | string>>;

export const satisfactionTrend = [
  { week: "S4 Nov", year: 2025, month: 11, rating: 3.6 },
  { week: "S1 Dic", year: 2025, month: 12, rating: 3.9 },
  { week: "S1 May", year: 2026, month: 5, rating: 3.8 },
  { week: "S2 May", year: 2026, month: 5, rating: 4.0 },
  { week: "S3 May", year: 2026, month: 5, rating: 3.7 },
  { week: "S4 May", year: 2026, month: 5, rating: 4.1 },
  { week: "S1 Jun", year: 2026, month: 6, rating: 4.2 },
  { week: "S2 Jun", year: 2026, month: 6, rating: 3.9 },
];

export const performanceHistory = [
  { month: "Nov", year: 2025, monthNum: 11, onTime: 80, satisfaction: 3.6, passengers: 17240, incidents: 9 },
  { month: "Dic", year: 2025, monthNum: 12, onTime: 83, satisfaction: 3.9, passengers: 15110, incidents: 6 },
  { month: "Ene", year: 2026, monthNum: 1, onTime: 82, satisfaction: 3.8, passengers: 18420, incidents: 8 },
  { month: "Feb", year: 2026, monthNum: 2, onTime: 79, satisfaction: 3.6, passengers: 16890, incidents: 12 },
  { month: "Mar", year: 2026, monthNum: 3, onTime: 85, satisfaction: 4.0, passengers: 20130, incidents: 5 },
  { month: "Abr", year: 2026, monthNum: 4, onTime: 88, satisfaction: 4.1, passengers: 19870, incidents: 6 },
  { month: "May", year: 2026, monthNum: 5, onTime: 86, satisfaction: 4.1, passengers: 21340, incidents: 7 },
  { month: "Jun", year: 2026, monthNum: 6, onTime: 84, satisfaction: 3.9, passengers: 10920, incidents: 3 },
];

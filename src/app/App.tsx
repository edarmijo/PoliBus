import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Bus, MapPin, Clock, Users, Star, Bell, ChevronRight,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  DollarSign, MessageSquare, Download, LogOut,
  Activity, FileText, Shield, X, Send, RefreshCw,
  Eye, BarChart2, Zap, Navigation, Filter, Calendar,
  Wrench, Tag, AlertCircle, Store, Megaphone, Plus,
  MousePointerClick, Gauge, Power, Satellite,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  routes, getRouteGeometry, getRoute, ESPOL_CAMPUS, PROVIDER,
  type EspolRoute,
} from "./data/routes";
import {
  buses, feedbackItems, maintenanceData, operativeIncidents,
  complaintClusters, routeCompliance, driverIncidents, weeklyRevenue,
  monthlyRevenue, occupancyByHour, aforoRouteIds, satisfactionTrend, performanceHistory,
  type OccupancyLevel, type BusStatus, type FeedbackType, type FeedbackStatus,
} from "./data/mock";
import { expandTimes, scheduleSummary, nextDeparture, fareLabel } from "./lib/schedule";
import { postFeedback } from "./lib/api";
import { ads as seedAds, adCategoryColor, type Ad } from "./data/ads";

// Suppress Leaflet default icon path issues (we use DivIcon + CircleMarker only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;

// ─── TYPES ────────────────────────────────────────────────────

type UserRole = "student" | "sedarey" | "espol" | "conductor" | "emprendedor";
type SedareyTab = "monitoreo" | "aforo" | "financiero" | "retroalimentacion" | "supervisor" | "mantenimiento";
type EspolTab = "kpis" | "satisfaccion" | "reportes" | "alertas";
type StudentTab = "mapa" | "rutas" | "notificaciones" | "cuenta";

const complianceChartData = routeCompliance.map(r => ({
  route: r.route,
  Planificadas: r.planned,
  Ejecutadas: r.executed,
}));

// ─── UTILS ────────────────────────────────────────────────────

const ocColors: Record<OccupancyLevel, string> = {
  LIBRE: "#059669", MODERADO: "#D97706", LLENO: "#DC2626",
};
const ocBadge: Record<OccupancyLevel, string> = {
  LIBRE: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  MODERADO: "bg-amber-50 text-amber-700 border border-amber-200",
  LLENO: "bg-red-50 text-red-700 border border-red-200",
};
const statusBadge: Record<BusStatus, string> = {
  en_ruta: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  detenido: "bg-amber-50 text-amber-700 border border-amber-200",
  fuera_de_servicio: "bg-gray-100 text-gray-500 border border-gray-200",
};
const statusLabel: Record<BusStatus, string> = {
  en_ruta: "En Ruta", detenido: "Detenido", fuera_de_servicio: "Fuera de Servicio",
};
const severityBadge: Record<string, string> = {
  alto: "bg-red-50 text-red-700 border border-red-200",
  medio: "bg-amber-50 text-amber-700 border border-amber-200",
  bajo: "bg-blue-50 text-blue-700 border border-blue-200",
};
const fbTypeBadge: Record<FeedbackType, string> = {
  queja: "bg-red-50 text-red-700 border border-red-200",
  sugerencia: "bg-amber-50 text-amber-700 border border-amber-200",
  felicitacion: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};
const fbTypeLabel: Record<FeedbackType, string> = {
  queja: "Queja", sugerencia: "Sugerencia", felicitacion: "Felicitación",
};

function getMaintStatus(rec: MaintenanceRecord) {
  const km = rec.threshold - rec.kmTotal;
  if (km <= 500) return { label: "CRÍTICO", color: "#DC2626", bg: "bg-red-50", border: "border-red-200" };
  if (km <= 2000) return { label: "PRÓXIMO", color: "#D97706", bg: "bg-amber-50", border: "border-amber-200" };
  return { label: "NORMAL", color: "#059669", bg: "bg-emerald-50", border: "border-emerald-200" };
}

function getPunctColor(val: number, target: number) {
  if (val >= target) return { text: "text-emerald-600", bg: "#059669", border: "border-emerald-200", label: "✓ Cumplida" };
  if (val >= target - 5) return { text: "text-amber-600", bg: "#D97706", border: "border-amber-200", label: "⚠ Por mejorar" };
  return { text: "text-red-600", bg: "#DC2626", border: "border-red-200", label: "✗ Crítico" };
}

function lerpLatLng(pts: Array<[number, number]>, t: number): [number, number] {
  if (!pts.length) return [0, 0];
  if (t <= 0) return pts[0];
  if (t >= 1) return pts[pts.length - 1];
  const seg = 1 / (pts.length - 1);
  const i = Math.min(Math.floor(t / seg), pts.length - 2);
  const st = (t - i * seg) / seg;
  const [lat1, lng1] = pts[i], [lat2, lng2] = pts[i + 1];
  return [lat1 + (lat2 - lat1) * st, lng1 + (lng2 - lng1) * st];
}

// ─── BUS MAP — vanilla Leaflet (React 18 compatible) ─────────

function BusMap({
  height = 360,
  selectedRoute = 0,
  onlyRoute,
  showBuses = true,
}: {
  height?: number;
  selectedRoute?: number;
  onlyRoute?: number;   // preview: dibuja una sola ruta y hace zoom a ella
  showBuses?: boolean;  // preview: oculta los buses simulados
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylinesRef = useRef<Record<number, L.Polyline>>({});
  const markersRef = useRef<Record<string, L.Marker>>({});

  const [prog, setProg] = useState<Record<string, number>>(
    Object.fromEntries(buses.map(b => [b.id, b.progress]))
  );

  // Initialize map once on mount
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;

    const map = L.map(divRef.current, {
      center: ESPOL_CAMPUS,
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    // Rutas a dibujar (todas, o solo la del preview)
    const drawn = onlyRoute ? routes.filter(r => r.id === onlyRoute) : routes;
    const allPts: [number, number][] = [];

    drawn.forEach(r => {
      const pts = getRouteGeometry(r.id); // geometría real que sigue las calles
      if (!pts.length) return;
      const poly = L.polyline(pts, { color: r.color, weight: 5, opacity: 0.85 }).addTo(map);
      polylinesRef.current[r.id] = poly;
      allPts.push(...pts);

      // Marcadores en las paradas reales (waypoints)
      r.waypoints.forEach(([lat, lng], i) => {
        L.circleMarker([lat, lng], {
          radius: 6, color: r.color, fillColor: "white", fillOpacity: 1, weight: 2.5,
        })
          .bindPopup(`<b style="font-family:sans-serif;font-size:11px">${r.stops[i] ?? ""}</b><br><span style="font-size:10px;color:#666">${r.shortName} · ${r.direction === "ingreso" ? "Ingreso" : "Salida"}</span>`)
          .addTo(map);
      });
    });

    // ESPOL campus pin
    L.circleMarker(ESPOL_CAMPUS, { radius: 9, color: "#005DAA", fillColor: "#005DAA", fillOpacity: 1, weight: 3 })
      .bindPopup("<b style='font-family:sans-serif;font-size:12px'>Campus ESPOL</b>")
      .addTo(map);

    // Bus markers (solo en modo flota)
    if (showBuses) {
      buses.forEach(bus => {
        if (bus.status === "fuera_de_servicio") return;
        const pts = getRouteGeometry(bus.routeId);
        if (!pts.length) return;
        const [lat, lng] = lerpLatLng(pts, bus.progress);
        const r = getRoute(bus.routeId);
        const oc = ocColors[bus.occupancy];

        const icon = L.divIcon({
          className: "",
          html: `<div style="background:${r?.color ?? "#005DAA"};border-radius:5px;padding:2px 7px 2px 5px;color:white;font-size:7px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.45);position:relative;font-family:monospace;line-height:15px">${bus.id}<span style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;background:${oc};border:2px solid white;display:block"></span></div>`,
          iconSize: [32, 18],
          iconAnchor: [16, 9],
        });

        const marker = L.marker([lat, lng], { icon, zIndexOffset: 1000 })
          .bindPopup(`<b style="font-family:sans-serif;font-size:11px">${bus.id} · ${bus.route}</b><br><span style="font-size:10px">Conductor: ${bus.driver}</span><br><span style="font-size:10px">Aforo: ${bus.passengers}/${bus.capacity} · ${bus.occupancy}</span>`)
          .addTo(map);

        markersRef.current[bus.id] = marker;
      });
    }

    // Ajustar la vista a las rutas dibujadas
    if (allPts.length) {
      map.fitBounds(L.latLngBounds(allPts as L.LatLngExpression[]), { padding: [20, 20] });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      polylinesRef.current = {};
      markersRef.current = {};
    };
  }, [onlyRoute, showBuses]);

  // Update route visibility when selectedRoute changes
  useEffect(() => {
    if (onlyRoute) return;
    const map = mapRef.current;
    Object.entries(polylinesRef.current).forEach(([id, poly]) => {
      const rId = parseInt(id);
      const active = selectedRoute === 0 || selectedRoute === rId;
      poly.setStyle({ opacity: active ? 0.85 : 0.12, weight: active ? 5 : 2 });
    });
    // Mostrar solo los buses de la ruta filtrada (oculta los de otras rutas)
    if (map) {
      buses.forEach(bus => {
        const marker = markersRef.current[bus.id];
        if (!marker) return;
        const visible = selectedRoute === 0 || bus.routeId === selectedRoute;
        if (visible) marker.addTo(map);
        else marker.remove();
      });
    }
  }, [selectedRoute, onlyRoute]);

  // Animation interval
  useEffect(() => {
    if (!showBuses) return;
    const id = setInterval(() => {
      setProg(prev => {
        const next = { ...prev };
        buses.forEach(b => {
          if (b.status === "en_ruta") next[b.id] = ((prev[b.id] ?? b.progress) + 0.0013) % 1;
        });
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [showBuses]);

  // Move bus markers on each tick
  useEffect(() => {
    if (!showBuses) return;
    buses.forEach(bus => {
      if (bus.status === "fuera_de_servicio") return;
      const pts = getRouteGeometry(bus.routeId);
      if (!pts.length) return;
      const [lat, lng] = lerpLatLng(pts, prog[bus.id] ?? bus.progress);
      markersRef.current[bus.id]?.setLatLng([lat, lng]);
    });
  }, [prog, showBuses]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border" style={{ height }}>
      <div ref={divRef} style={{ width: "100%", height: "100%" }} />
      {/* Legend overlay (above Leaflet z-index ~400) */}
      {showBuses && (
        <div className="absolute top-2 right-12 z-[1000] bg-white/92 backdrop-blur-sm rounded-lg px-2.5 py-2 shadow pointer-events-none text-xs">
          <div className="text-gray-500 text-[10px] font-semibold mb-1.5 uppercase tracking-wider">Aforo</div>
          {(["LIBRE","MODERADO","LLENO"] as OccupancyLevel[]).map(oc => (
            <div key={oc} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
              <div className="w-2 h-2 rounded-full" style={{ background: ocColors[oc] }} />
              <span className="text-gray-700">{oc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SHARED ATOMS ─────────────────────────────────────────────

function OccupancyBadge({ level }: { level: OccupancyLevel }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${ocBadge[level]}`}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ocColors[level] }} />
      {level}
    </span>
  );
}

function StarRow({ value, onChange, size = "sm" }: { value: number; onChange?: (v: number) => void; size?: "sm" | "md" }) {
  const cls = size === "md" ? "w-6 h-6" : "w-4 h-4";
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <button key={i} onClick={() => onChange?.(i)} type="button" className="focus:outline-none">
          <Star className={`${cls} ${i <= value ? "fill-amber-400 text-amber-400" : "text-gray-200"} transition-colors`} />
        </button>
      ))}
    </div>
  );
}

function DateRangeFilter({ from, to, onApply }: { from: string; to: string; onApply: (f: string, t: string) => void }) {
  const [lf, setLf] = useState(from);
  const [lt, setLt] = useState(to);
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <div className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold shrink-0">
        <Calendar className="w-4 h-4 text-[#005DAA]" />Período de consulta
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 font-semibold">Desde</label>
        <input type="date" value={lf} onChange={e => setLf(e.target.value)} className="border border-border rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-[#F8FAFD] focus:outline-none focus:ring-2 focus:ring-[#005DAA]/20" />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 font-semibold">Hasta</label>
        <input type="date" value={lt} onChange={e => setLt(e.target.value)} className="border border-border rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-[#F8FAFD] focus:outline-none focus:ring-2 focus:ring-[#005DAA]/20" />
      </div>
      <button onClick={() => onApply(lf, lt)} className="px-3.5 py-1.5 bg-[#005DAA] text-white text-xs font-bold rounded-lg hover:bg-[#004C8C] transition-colors">
        Aplicar filtro
      </button>
      <div className="ml-auto text-[10px] text-muted-foreground">Mostrando: {fmt(from)} — {fmt(to)}</div>
    </div>
  );
}

function PunctualityCard({ value, target, scope, subtitle, onClick }: { value: number; target: number; scope: string; subtitle?: string; onClick?: () => void }) {
  const c = getPunctColor(value, target);
  return (
    <div onClick={onClick} className={`bg-white rounded-xl p-5 border-2 ${c.border} flex flex-col justify-between ${onClick ? "cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <div><div className="text-xs text-muted-foreground font-semibold">Tasa de Puntualidad</div><div className="text-[10px] text-gray-400 mt-0.5">{scope}</div></div>
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${c.text} bg-gray-50 border`} style={{ borderColor: c.bg }}>{c.label}</span>
      </div>
      <div className={`font-extrabold text-[3.25rem] leading-none mb-2 ${c.text}`}>{value}%</div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-gray-400"><span>0%</span><span className="text-gray-600 font-semibold">Meta: {target}%</span><span>100%</span></div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden relative">
          <div className="h-full rounded-full" style={{ width: `${value}%`, background: c.bg }} />
          <div className="absolute top-0 h-full w-0.5 bg-gray-400/60" style={{ left: `${target}%` }} />
        </div>
        {subtitle && <div className="text-[10px] text-gray-400 mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}

function ComplaintClusters() {
  const total = complaintClusters.reduce((s, c) => s + c.count, 0);
  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2"><Tag className="w-4 h-4 text-[#005DAA]" /><h2 className="font-extrabold text-[#1C2B3A] text-sm">Quejas Frecuentes — Clusters Temáticos</h2></div>
        <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-full">{total} quejas analizadas</span>
      </div>
      <div className="p-4 space-y-4">
        {complaintClusters.map((c, i) => (
          <div key={c.tag}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-extrabold shrink-0" style={{ background: c.color }}>{i + 1}</span>
                <span className="text-sm font-bold text-[#1C2B3A]">{c.tag}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-extrabold text-[#1C2B3A]">{c.count}</span>
                <span className="text-muted-foreground">quejas</span>
                <span className="font-bold px-1.5 py-0.5 rounded-md text-white text-[10px]" style={{ background: c.color }}>{c.pct}%</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
              <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
            </div>
            <div className="text-[10px] text-gray-400 ml-7">Ej: "{c.examples[0]}", "{c.examples[1]}"</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ROUTE PREVIEW (móvil) ────────────────────────────────────

function RoutePreview({ route, onClose }: { route: EspolRoute; onClose: () => void }) {
  const times = expandTimes(route.schedule);
  const next = nextDeparture(route.schedule);
  // Link a Google Maps con los waypoints reales de la ruta
  const gmaps = `https://www.google.com/maps/dir/${route.waypoints.map(([lat, lng]) => `${lat},${lng}`).join("/")}`;

  return (
    <div className="absolute inset-0 z-[2000] flex flex-col bg-black/40" onClick={onClose}>
      <div className="mt-auto bg-[#F0F4FA] rounded-t-3xl overflow-hidden flex flex-col max-h-[88%]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 pt-3 pb-3 shrink-0" style={{ background: route.color }}>
          <div className="flex justify-center mb-2"><div className="w-10 h-1 rounded-full bg-white/40" /></div>
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="text-white font-extrabold text-base truncate">{route.shortName}</div>
              <div className="text-white/80 text-xs">{route.direction === "ingreso" ? "Hacia ESPOL" : "Desde ESPOL"} · {route.stops[0]} → {route.stops[route.stops.length - 1]}</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 ml-2"><X className="w-4 h-4 text-white" /></button>
          </div>
        </div>

        <div className="overflow-y-auto p-3 space-y-3">
          {/* Mapa real de la ruta */}
          <BusMap height={210} onlyRoute={route.id} showBuses={false} />

          <a href={gmaps} target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-extrabold" style={{ background: route.color }}>
            <MapPin className="w-4 h-4" />Ver Mapa en Google Maps
          </a>

          {/* Datos */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
              <div className="text-[10px] text-gray-400">Precio</div>
              <div className="font-extrabold text-sm text-[#1C2B3A]">{fareLabel(route.fare)}</div>
            </div>
            <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
              <div className="text-[10px] text-gray-400">Salidas</div>
              <div className="font-extrabold text-sm text-[#1C2B3A]">{times.length}</div>
            </div>
            <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
              <div className="text-[10px] text-gray-400">Próxima</div>
              <div className="font-extrabold text-sm text-[#1C2B3A]">{next ? next.time : "—"}</div>
            </div>
          </div>

          {/* Horarios reales */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center gap-1.5 mb-2.5"><Clock className="w-4 h-4" style={{ color: route.color }} /><h3 className="font-extrabold text-sm text-[#1C2B3A]">Horarios</h3></div>
            {route.schedule.kind === "interval"
              ? (
                <div className="space-y-1.5">
                  {route.schedule.blocks.map((b, i) => (
                    <div key={i} className="text-sm text-gray-600">{b.from} a {b.to} <span className="text-gray-400">· cada {b.everyMin} min</span></div>
                  ))}
                </div>
              )
              : (
                <div className="flex flex-wrap gap-1.5">
                  {times.map(t => (
                    <span key={t} className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: `${route.color}15`, color: route.color }}>{t}</span>
                  ))}
                </div>
              )}
          </div>

          {/* Paradas */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center gap-1.5 mb-3"><Navigation className="w-4 h-4" style={{ color: route.color }} /><h3 className="font-extrabold text-sm text-[#1C2B3A]">Recorrido</h3></div>
            <div className="space-y-1.5">
              {route.stops.map((stop, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs">
                  <div className="flex flex-col items-center mt-0.5">
                    <div className="w-3 h-3 rounded-full border-2 shrink-0" style={{ borderColor: route.color, background: i === 0 || i === route.stops.length - 1 ? route.color : "white" }} />
                    {i < route.stops.length - 1 && <div className="w-0.5 h-4 mt-0.5" style={{ background: `${route.color}40` }} />}
                  </div>
                  <span className={i === 0 || i === route.stops.length - 1 ? "font-bold text-[#1C2B3A]" : "text-gray-500"}>{stop}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Proveedor */}
          <div className="text-center text-[10px] text-gray-400 pb-2">
            Servicio provisto por {PROVIDER.name} · Consultas WhatsApp: {PROVIDER.whatsapp}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────

function LoginScreen({ onSelectRole }: { onSelectRole: (r: UserRole) => void }) {
  return (
    <div className="min-h-screen bg-[#0D1B2E] flex flex-col" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <header className="flex items-center justify-between px-10 py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#005DAA] rounded-xl flex items-center justify-center"><Bus className="w-6 h-6 text-white" /></div>
          <div><div className="text-white font-extrabold text-xl tracking-tight">PoliBus</div><div className="text-blue-400 text-xs">Sistema de Transporte ESPOL × SEDAREY</div></div>
        </div>
        <div className="flex items-center gap-4 text-sm text-blue-400">
          <span>Guayaquil, Ecuador</span>
          <span className="w-px h-4 bg-blue-800" />
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />Sistema en línea</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-blue-900/40 border border-blue-700/30 rounded-full px-4 py-1.5 text-blue-300 text-sm mb-6">
            <Zap className="w-3.5 h-3.5" />DSS de Transporte Universitario — v2.0 · Junio 2026
          </div>
          <h1 className="text-5xl font-extrabold text-white mb-4 tracking-tight leading-tight">
            Conecta. Monitorea.<br /><span style={{ color: "#005DAA" }}>Decide.</span>
          </h1>
          <p className="text-blue-200 text-lg max-w-2xl mx-auto leading-relaxed">
            Ecosistema integral del transporte universitario ESPOL. Cinco actores, una sola plataforma basada en datos.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl">
          {[
            { role: "student" as UserRole, icon: <Navigation className="w-6 h-6" />, title: "Estudiante", sub: "App Móvil", desc: "Ubica tu bus en tiempo real, consulta aforo y horarios, y califica el servicio.", color: "#005DAA", grad: "from-blue-900/50 to-blue-800/20", tag: "1,847 viajes hoy" },
            { role: "conductor" as UserRole, icon: <Bus className="w-6 h-6" />, title: "Conductor", sub: "App del Conductor", desc: "Tu ruta del día, aforo automático por sensores y GPS dedicado. Sin reportes manuales.", color: "#0E7490", grad: "from-teal-900/50 to-teal-800/20", tag: "Conteo automático" },
            { role: "sedarey" as UserRole, icon: <Activity className="w-6 h-6" />, title: "Cooperativa SEDAREY", sub: "Dashboard Operativo", desc: "Flota, mantenimiento preventivo, kilometraje, finanzas y retroalimentación.", color: "#0891B2", grad: "from-cyan-900/50 to-cyan-800/20", tag: "7 buses activos" },
            { role: "espol" as UserRole, icon: <Shield className="w-6 h-6" />, title: "Bienestar Politécnico", sub: "Auditoría Institucional", desc: "KPIs de cumplimiento contractual, satisfacción y desempeño histórico de SEDAREY.", color: "#7C3AED", grad: "from-purple-900/50 to-purple-800/20", tag: "Auditoría" },
            { role: "emprendedor" as UserRole, icon: <Store className="w-6 h-6" />, title: "Emprendedor", sub: "Portal de Negocios", desc: "Publica ofertas a la comunidad politécnica en el momento exacto de su traslado.", color: "#B45309", grad: "from-amber-900/50 to-amber-800/20", tag: "Economía circular" },
          ].map(item => (
            <button key={item.role} onClick={() => onSelectRole(item.role)}
              className={`group bg-gradient-to-br ${item.grad} border border-white/10 rounded-2xl p-5 text-left hover:border-white/25 hover:scale-[1.02] transition-all duration-200 cursor-pointer`}>
              <div className="flex items-start justify-between mb-3.5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: item.color }}>{item.icon}</div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full border border-white/15 text-white/60">{item.tag}</span>
              </div>
              <div className="text-white font-extrabold text-lg mb-0.5">{item.title}</div>
              <div className="text-xs font-semibold mb-2.5" style={{ color: item.color }}>{item.sub}</div>
              <p className="text-blue-200 text-sm leading-relaxed">{item.desc}</p>
              <div className="mt-4 flex items-center gap-2 text-sm font-bold" style={{ color: item.color }}>
                Acceder<ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </main>

      <footer className="text-center py-4 text-blue-400/50 text-xs">© 2026 PoliBus · ESPOL × SEDAREY · Guayaquil, Ecuador</footer>
    </div>
  );
}

// ─── PUBLICIDAD IN-APP (negocios politécnicos) ────────────────

function PromoStrip() {
  const active = seedAds.filter(a => a.active);
  const [open, setOpen] = useState<Ad | null>(null);
  if (!active.length) return null;
  return (
    <div className="pt-1">
      <div className="flex items-center justify-between px-1 mb-2">
        <h3 className="text-sm font-extrabold text-[#1C2B3A] flex items-center gap-1.5"><Store className="w-4 h-4 text-[#B45309]" />Ofertas cerca de ti</h3>
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded-full">Patrocinado</span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-3 px-3">
        {active.map(ad => (
          <button key={ad.id} onClick={() => setOpen(ad)}
            className="shrink-0 w-[210px] text-left bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-16 flex items-center justify-center text-3xl" style={{ background: `${ad.color}14` }}>{ad.emoji}</div>
            <div className="p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: ad.color }}>{ad.business}</div>
              <div className="font-extrabold text-[#1C2B3A] text-sm leading-tight">{ad.title}</div>
              <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold" style={{ color: ad.color }}>{ad.cta}<ChevronRight className="w-3.5 h-3.5" /></div>
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div className="absolute inset-0 z-[2000] bg-black/40 flex items-end" onClick={() => setOpen(null)}>
          <div className="w-full bg-white rounded-t-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="h-28 flex items-center justify-center text-5xl relative" style={{ background: `${open.color}18` }}>
              {open.emoji}
              <button onClick={() => setOpen(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center"><X className="w-4 h-4 text-gray-600" /></button>
              <span className="absolute top-3 left-3 text-[9px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: open.color }}>{open.category}</span>
            </div>
            <div className="p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: open.color }}>{open.business}</div>
              <h3 className="font-extrabold text-[#1C2B3A] text-lg leading-tight mt-0.5">{open.title}</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{open.desc}</p>
              <div className="text-[11px] text-gray-400 mt-2">Anunciante: {open.owner}</div>
              <button className="w-full mt-4 py-3 rounded-xl text-white font-extrabold text-sm" style={{ background: open.color }}>{open.cta}</button>
              <p className="text-center text-[10px] text-gray-400 mt-2">Contenido patrocinado · PoliBus no cobra al estudiante</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STUDENT APP ──────────────────────────────────────────────

type NotifKind = "eta" | "delay" | "full" | "feedback";
interface Notif { id: string; kind: NotifKind; msg: string; time: string; read: boolean; }

const NOTIF_STYLE: Record<NotifKind, { icon: React.ReactNode; bg: string; ring: string }> = {
  eta:      { icon: <Clock className="w-4 h-4 text-blue-600" />,        bg: "bg-blue-50",    ring: "#005DAA" },
  delay:    { icon: <AlertTriangle className="w-4 h-4 text-amber-600" />, bg: "bg-amber-50",  ring: "#D97706" },
  full:     { icon: <Users className="w-4 h-4 text-red-600" />,          bg: "bg-red-50",    ring: "#DC2626" },
  feedback: { icon: <CheckCircle className="w-4 h-4 text-emerald-600" />, bg: "bg-emerald-50", ring: "#059669" },
};

const INITIAL_NOTIFS: Notif[] = [
  { id: "N1", kind: "eta", msg: "Bus B001 llega en 8 minutos a Campus ESPOL. ¡Prepárate!", time: "hace 2 min", read: false },
  { id: "N2", kind: "delay", msg: "Retraso en ruta Durán: aprox. 25 min por tráfico en el Puente Unidad Nacional.", time: "hace 15 min", read: false },
  { id: "N3", kind: "full", msg: "Bus B003 (Albán Borja) está LLENO. Próxima salida 10:15.", time: "hace 32 min", read: true },
  { id: "N4", kind: "feedback", msg: "Tu feedback para la ruta Interna fue revisado. ¡Gracias!", time: "hace 1h", read: true },
];

function StudentApp({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<StudentTab>("mapa");
  const [selRoute, setSelRoute] = useState(0);
  const [openBus, setOpenBus] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [fbRoute, setFbRoute] = useState(routes[0]?.shortName ?? "");
  const [fbSent, setFbSent] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [routesDir, setRoutesDir] = useState<"ingreso" | "salida">("ingreso");
  const [previewRoute, setPreviewRoute] = useState<EspolRoute | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL_NOTIFS);

  const unreadCount = notifs.filter(n => !n.read).length;
  const markAllRead = () => setNotifs(ns => ns.map(n => ({ ...n, read: true })));
  const toggleRead = (id: string) => setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: !n.read } : n));

  const visibleBuses = (selRoute > 0 ? buses.filter(b => b.routeId === selRoute) : buses).filter(b => b.status !== "fuera_de_servicio");
  const routesByDir = routes.filter(r => r.direction === routesDir);
  const sendFeedback = () => {
    if (!rating) return;
    postFeedback({ route: fbRoute, rating, comment });
    setFbSent(true);
    setTimeout(() => setFbSent(false), 3500);
    setRating(0);
    setComment("");
  };
  const navItems = [
    { t: "mapa" as StudentTab, icon: <MapPin className="w-5 h-5" />, label: "Mapa" },
    { t: "rutas" as StudentTab, icon: <Bus className="w-5 h-5" />, label: "Rutas" },
    { t: "notificaciones" as StudentTab, icon: <Bell className="w-5 h-5" />, label: "Avisos" },
    { t: "cuenta" as StudentTab, icon: <Star className="w-5 h-5" />, label: "Cuenta" },
  ];

  return (
    <div className="min-h-screen bg-[#0D1B2E] flex items-start justify-center py-6 px-4" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <div className="relative w-[390px] h-[844px] bg-[#F0F4FA] rounded-[44px] shadow-[0_30px_80px_rgba(0,0,0,0.65)] overflow-hidden border-[3px] border-[#182435] flex flex-col">
        <div className="bg-gradient-to-br from-[#0A74D1] to-[#004A8F] px-6 pt-3 pb-1 flex justify-between items-center text-white text-[11px] shrink-0">
          <span className="font-mono font-medium">9:41</span>
          <span className="text-[10px] tracking-tight">▲▲▲ ▮</span>
        </div>
        <div className="bg-gradient-to-br from-[#0A74D1] to-[#004A8F] px-5 pb-5 pt-1 shrink-0 relative overflow-hidden">
          <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -left-10 bottom-0 w-28 h-28 rounded-full bg-white/5" />
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-white font-extrabold shrink-0 border border-white/20">AS</div>
              <div>
                <p className="text-blue-100 text-xs font-medium">Hola, Andrea 👋</p>
                <h2 className="text-white font-extrabold text-lg leading-tight">
                  {tab === "mapa" && "Rastreo en Vivo"}
                  {tab === "rutas" && "Mis Rutas"}
                  {tab === "notificaciones" && "Notificaciones"}
                  {tab === "cuenta" && "Mi Cuenta"}
                </h2>
              </div>
            </div>
            <button onClick={() => setTab("notificaciones")} className="w-10 h-10 bg-white/15 hover:bg-white/25 transition-colors rounded-2xl flex items-center justify-center relative border border-white/20">
              <Bell className="w-4 h-4 text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-[#0A5BA8] text-white text-[9px] font-bold flex items-center justify-center">{unreadCount}</span>
              )}
            </button>
          </div>
        </div>

        {showBanner && tab === "mapa" && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 shrink-0">
            <div className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center shrink-0"><Clock className="w-3 h-3 text-amber-600" /></div>
            <p className="text-amber-800 text-xs font-semibold flex-1">Bus B001 llega en ~8 min a Campus ESPOL</p>
            <button onClick={() => setShowBanner(false)}><X className="w-4 h-4 text-amber-400" /></button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {tab === "mapa" && (
            <div className="p-3 space-y-3">
              {/* Filtro por ruta — sección clara y separada */}
              <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Filter className="w-3.5 h-3.5 text-[#005DAA]" />
                  <span className="text-[11px] font-extrabold text-[#1C2B3A] uppercase tracking-wide">Filtrar por ruta</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
                  {[{ id: 0, shortName: "Todas", color: "#005DAA" }, ...routes.filter(r => buses.some(b => b.routeId === r.id))].map(r => {
                    const active = selRoute === r.id;
                    return (
                      <button key={r.id} onClick={() => setSelRoute(r.id)}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${active ? "shadow-sm" : ""}`}
                        style={active ? { background: r.color, color: "white", borderColor: r.color } : { background: "#F4F7FB", color: "#4B5563", borderColor: "transparent" }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: active ? "white" : r.color }} />
                        {r.shortName}
                      </button>
                    );
                  })}
                </div>
              </div>

              <BusMap height={210} selectedRoute={selRoute} />

              {/* Buses en vivo */}
              <div className="flex items-center justify-between px-1 pt-0.5">
                <h3 className="text-sm font-extrabold text-[#1C2B3A]">Buses en vivo</h3>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{visibleBuses.length} activos
                </span>
              </div>

              <div className="space-y-2">
                {visibleBuses.map(bus => {
                  const r = getRoute(bus.routeId);
                  const isOpen = openBus === bus.id;
                  return (
                    <button key={bus.id} onClick={() => setOpenBus(isOpen ? null : bus.id)}
                      className={`w-full bg-white rounded-2xl p-3.5 border text-left transition-all ${isOpen ? "shadow-md" : "border-gray-100 hover:shadow-sm"}`}
                      style={isOpen ? { borderColor: r?.color ?? "#005DAA" } : undefined}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: r?.color ?? "#005DAA" }}><Bus className="w-5 h-5 text-white" /></div>
                          <div>
                            <div className="font-bold text-[#1C2B3A] text-sm flex items-center gap-1.5">{bus.route}<span className="text-[9px] font-semibold text-gray-400">{r?.direction === "salida" ? "↑ Salida" : "↓ Ingreso"}</span></div>
                            <div className="text-gray-400 text-xs font-mono">{bus.id} · {bus.plate}</div>
                          </div>
                        </div>
                        <OccupancyBadge level={bus.occupancy} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="bg-[#F7F9FC] rounded-lg py-1.5 text-center">
                          <div className="text-[9px] text-gray-400">Llega en</div>
                          <div className="text-sm font-extrabold text-[#1C2B3A]">{bus.eta}<span className="text-[10px] font-bold"> min</span></div>
                        </div>
                        <div className="bg-[#F7F9FC] rounded-lg py-1.5 text-center">
                          <div className="text-[9px] text-gray-400">Ocupación</div>
                          <div className="text-sm font-extrabold text-[#1C2B3A]">{bus.passengers}<span className="text-[10px] font-bold">/{bus.capacity}</span></div>
                        </div>
                        <div className="bg-[#F7F9FC] rounded-lg py-1.5 text-center">
                          <div className="text-[9px] text-gray-400">Velocidad</div>
                          <div className="text-sm font-extrabold text-[#1C2B3A]">{bus.speed}<span className="text-[10px] font-bold"> km/h</span></div>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1.5">
                          <div className="flex justify-between"><span>Conductor</span><strong className="text-gray-700">{bus.driver}</strong></div>
                          <div className="flex justify-between"><span>Tarifa</span><strong className="text-gray-700">{r ? fareLabel(r.fare) : "—"}</strong></div>
                          <div className="flex justify-between gap-3"><span className="shrink-0">Horario</span><strong className="text-gray-700 text-right">{r ? scheduleSummary(r.schedule) : "—"}</strong></div>
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-center text-[10px] text-gray-400 font-semibold">{isOpen ? "Toca para ocultar" : "Toca para ver detalles"}</div>
                    </button>
                  );
                })}
              </div>

              {/* Publicidad de negocios politécnicos durante el traslado */}
              <PromoStrip />
            </div>
          )}

          {tab === "rutas" && (
            <div className="p-3 space-y-3">
              {/* Toggle Ingreso / Salida */}
              <div className="flex bg-white rounded-xl p-1 border border-gray-100">
                {(["ingreso", "salida"] as const).map(d => (
                  <button key={d} onClick={() => setRoutesDir(d)}
                    className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition-colors ${routesDir === d ? "bg-[#005DAA] text-white" : "text-gray-500"}`}>
                    {d === "ingreso" ? "Hacia ESPOL" : "Desde ESPOL"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 px-1">Toca una ruta para ver el recorrido en el mapa y sus horarios.</p>

              {routesByDir.map(r => {
                const next = nextDeparture(r.schedule);
                return (
                  <button key={r.id} onClick={() => setPreviewRoute(r)}
                    className="w-full text-left bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="px-4 py-3.5 flex items-center justify-between" style={{ background: r.color }}>
                      <div className="flex items-center gap-2.5"><Bus className="w-5 h-5 text-white" /><div><div className="text-white font-extrabold text-sm">{r.shortName}</div><div className="text-white/70 text-xs">{r.stops[0]} → {r.stops[r.stops.length - 1]}</div></div></div>
                      <div className="text-right"><div className="text-white font-extrabold text-base">{fareLabel(r.fare)}</div><div className="text-white/70 text-[10px]">por viaje</div></div>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="flex flex-col gap-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{scheduleSummary(r.schedule)}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{r.stops.length} paradas</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {next && <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: `${r.color}15`, color: r.color }}>Próx. {next.time}</span>}
                        <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: r.color }}>Ver mapa<ChevronRight className="w-4 h-4" /></span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === "notificaciones" && (
            <div className="p-3 space-y-2.5">
              {/* Barra de acciones */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-gray-500">
                  {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día ✓"}
                </span>
                <button onClick={markAllRead} disabled={unreadCount === 0}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#005DAA] disabled:text-gray-300 disabled:cursor-default transition-colors">
                  <CheckCircle className="w-3.5 h-3.5" />Marcar todas como leídas
                </button>
              </div>

              {notifs.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-gray-300">
                  <Bell className="w-12 h-12 mb-2" /><p className="text-sm font-semibold">Sin notificaciones</p>
                </div>
              ) : notifs.map(n => {
                const st = NOTIF_STYLE[n.kind];
                return (
                  <button key={n.id} onClick={() => toggleRead(n.id)}
                    className={`w-full text-left rounded-2xl p-3.5 border flex gap-3 items-start transition-all ${n.read ? "bg-[#F8FAFD] border-gray-100" : "bg-white shadow-sm"}`}
                    style={n.read ? undefined : { borderColor: `${st.ring}33` }}>
                    <div className={`w-9 h-9 ${st.bg} rounded-xl flex items-center justify-center shrink-0 ${n.read ? "opacity-60" : ""}`}>{st.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-relaxed ${n.read ? "text-gray-500" : "font-semibold text-[#1C2B3A]"}`}>{n.msg}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-gray-400 text-[10px]">{n.time}</span>
                        <span className="text-[9px] font-bold" style={{ color: n.read ? "#9CA3AF" : st.ring }}>
                          {n.read ? "Leída · toca para marcar no leída" : "Toca para marcar leída"}
                        </span>
                      </div>
                    </div>
                    {!n.read && <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5" style={{ background: st.ring }} />}
                  </button>
                );
              })}
            </div>
          )}

          {tab === "cuenta" && (
            <div className="p-3 space-y-3">
              <div className="bg-gradient-to-br from-[#0A74D1] to-[#004A8F] rounded-2xl p-4 relative overflow-hidden">
                <div className="absolute -right-6 -top-8 w-32 h-32 rounded-full bg-white/5" />
                <div className="flex items-center gap-3 relative">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-white font-extrabold text-xl border border-white/20">AS</div>
                  <div><div className="text-white font-extrabold text-base">Andrea Saltos E.</div><div className="text-blue-100 text-xs mt-0.5">MAET-P-202-2024 · FIMCM</div></div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 relative">
                  {[{ k: "Viajes", v: "128" }, { k: "Este mes", v: "24" }, { k: "Ahorro", v: "$31" }].map(s => (
                    <div key={s.k} className="bg-white/10 rounded-xl py-2 text-center border border-white/10">
                      <div className="text-white font-extrabold text-base">{s.v}</div>
                      <div className="text-blue-100 text-[10px]">{s.k}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <h3 className="font-extrabold text-[#1C2B3A] mb-4">Califica el servicio</h3>
                {fbSent ? (
                  <div className="flex flex-col items-center py-6"><CheckCircle className="w-12 h-12 text-emerald-500 mb-2" /><p className="font-bold text-emerald-700">¡Gracias por tu feedback!</p></div>
                ) : (
                  <div className="space-y-3">
                    <select value={fbRoute} onChange={e => setFbRoute(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-[#F8FAFD] text-gray-700 focus:outline-none">{routes.map(r => <option key={r.id} value={r.shortName}>{r.shortName} · {r.direction === "ingreso" ? "Ingreso" : "Salida"}</option>)}</select>
                    <StarRow value={rating} onChange={setRating} size="md" />
                    <textarea rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs resize-none bg-[#F8FAFD] text-gray-700 focus:outline-none" placeholder="Comentario opcional..." value={comment} onChange={e => setComment(e.target.value)} />
                    <button onClick={sendFeedback} disabled={!rating} className="w-full py-2.5 rounded-xl text-white text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: "#005DAA" }}>
                      <Send className="w-4 h-4" />Enviar feedback
                    </button>
                  </div>
                )}
              </div>
              <button onClick={onLogout} className="w-full py-3 rounded-2xl text-red-600 text-sm font-bold border border-red-100 bg-red-50 flex items-center justify-center gap-2">
                <LogOut className="w-4 h-4" />Cerrar sesión
              </button>
            </div>
          )}
        </div>

        {/* Vista previa de ruta (mapa real + horarios) — overlay dentro del marco */}
        {previewRoute && (
          <RoutePreview route={previewRoute} onClose={() => setPreviewRoute(null)} />
        )}

        <div className="bg-white border-t border-gray-100 px-3 pb-3 pt-2 flex gap-1 shrink-0">
          {navItems.map(item => {
            const active = tab === item.t;
            return (
              <button key={item.t} onClick={() => setTab(item.t)}
                className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-2xl transition-all ${active ? "bg-[#005DAA]/10 text-[#005DAA]" : "text-gray-400 hover:text-gray-600"}`}>
                <span className="relative">
                  {item.icon}
                  {item.t === "notificaciones" && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-0.5 bg-red-500 rounded-full border-2 border-white text-white text-[8px] font-bold flex items-center justify-center">{unreadCount}</span>
                  )}
                </span>
                <span className={`text-[9px] ${active ? "font-extrabold" : "font-bold"}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── SEDAREY DASHBOARD ────────────────────────────────────────

function SedareyDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<SedareyTab>("monitoreo");
  const [fbType, setFbType] = useState<"todos" | FeedbackType>("todos");
  const [fbStatus, setFbStatus] = useState<"todos" | FeedbackStatus>("todos");
  const [incForm, setIncForm] = useState({ bus: "", type: "", desc: "", severity: "medio" });
  const [incSent, setIncSent] = useState(false);
  const [mapRoute, setMapRoute] = useState(0);
  const [incTypeFilter, setIncTypeFilter] = useState("todos");

  const criticalMaint = maintenanceData.filter(r => getMaintStatus(r).label === "CRÍTICO").length;
  const filteredFb = feedbackItems.filter(f => (fbType === "todos" || f.type === fbType) && (fbStatus === "todos" || f.status === fbStatus));
  const incTypes = ["todos", ...Array.from(new Set(operativeIncidents.map(i => i.type)))];
  const norm = (s: string) => s.trim().toLowerCase();
  const filteredInc = incTypeFilter === "todos" ? operativeIncidents : operativeIncidents.filter(i => norm(i.type) === norm(incTypeFilter));

  const navItems: Array<{ t: SedareyTab; icon: React.ReactNode; label: string; badge?: number }> = [
    { t: "monitoreo", icon: <Navigation className="w-4 h-4" />, label: "Monitoreo" },
    { t: "aforo", icon: <Users className="w-4 h-4" />, label: "Aforo" },
    { t: "financiero", icon: <DollarSign className="w-4 h-4" />, label: "Financiero" },
    { t: "retroalimentacion", icon: <MessageSquare className="w-4 h-4" />, label: "Retroalimentación" },
    { t: "supervisor", icon: <Zap className="w-4 h-4" />, label: "Supervisor" },
    { t: "mantenimiento", icon: <Wrench className="w-4 h-4" />, label: "Mantenimiento", badge: criticalMaint },
  ];

  return (
    <div className="flex h-screen bg-[#F0F4FA]" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <aside className="w-56 bg-[#0D1B2E] flex flex-col shrink-0">
        <div className="p-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#005DAA] rounded-lg flex items-center justify-center shrink-0"><Bus className="w-4 h-4 text-white" /></div>
            <div><div className="text-white font-extrabold text-sm tracking-tight">PoliBus</div><div className="text-blue-400 text-[9px]">SEDAREY Dashboard</div></div>
          </div>
        </div>
        <nav className="flex-1 p-2.5 space-y-0.5">
          {navItems.map(item => (
            <button key={item.t} onClick={() => setTab(item.t)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${tab === item.t ? "bg-[#005DAA] text-white" : "text-blue-200 hover:bg-white/[0.07] hover:text-white"}`}>
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-extrabold flex items-center justify-center shrink-0">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-2.5 space-y-2">
          <div className="bg-emerald-900/30 border border-emerald-700/25 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold mb-1"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />SISTEMA ACTIVO</div>
            <div className="text-emerald-300 text-[10px]">{buses.filter(b => b.status === "en_ruta").length} en ruta · {buses.filter(b => b.status === "fuera_de_servicio").length} F.S.</div>
          </div>
          <div className="border-t border-white/[0.07] pt-2.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-[#005DAA] rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0">OP</div>
              <div className="min-w-0"><div className="text-white text-[10px] font-bold truncate">Operador SEDAREY</div><div className="text-blue-400 text-[9px]">Turno 06:00–14:00</div></div>
            </div>
            <button onClick={onLogout} className="w-full flex items-center gap-1.5 text-blue-300 hover:text-white text-[10px] py-1 transition-colors"><LogOut className="w-3 h-3" />Cerrar sesión</button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-extrabold text-[#1C2B3A] text-base">{navItems.find(n => n.t === tab)?.label}</h1>
            <p className="text-muted-foreground text-xs flex items-center gap-1.5">Jueves 5 jun 2026 · Flota SEDAREY <span className="inline-flex items-center gap-1 text-[#0E7490]"><Satellite className="w-3 h-3" />GPS dedicado + sensores IR</span></p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 text-xs font-bold text-emerald-700">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />EN VIVO
            </div>
            <button className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "monitoreo" && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <PunctualityCard value={84} target={90} scope="Flota completa · Turno actual" subtitle="Tolerancia: ≤5 min de retraso" />
                <div className="col-span-3 grid grid-cols-3 gap-3">
                  {[
                    { label: "Buses Activos", value: `${buses.filter(b => b.status !== "fuera_de_servicio").length} / ${buses.length}`, icon: <Bus className="w-4 h-4" />, color: "#005DAA", bg: "#EBF2FF" },
                    { label: "Pasajeros Hoy", value: "1,847", icon: <Users className="w-4 h-4" />, color: "#0891B2", bg: "#E0F7FF" },
                    { label: "Incidentes", value: "3", icon: <AlertTriangle className="w-4 h-4" />, color: "#D97706", bg: "#FEF9EC" },
                  ].map(k => (
                    <div key={k.label} className="bg-white rounded-xl p-4 border border-border flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2"><span className="text-muted-foreground text-xs">{k.label}</span><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.bg, color: k.color }}>{k.icon}</div></div>
                      <div className="font-extrabold text-2xl text-[#1C2B3A]">{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-extrabold text-[#1C2B3A] text-sm">Mapa en Tiempo Real — Flota SEDAREY</h2>
                  <div className="flex gap-3 flex-wrap justify-end">
                    {routes.filter(r => buses.some(b => b.routeId === r.id)).map(r => (
                      <button key={r.id} onClick={() => setMapRoute(mapRoute === r.id ? 0 : r.id)} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors">
                        <div className="w-3 h-3 rounded" style={{ background: r.color, opacity: mapRoute === 0 || mapRoute === r.id ? 1 : 0.3 }} />{r.shortName}
                      </button>
                    ))}
                  </div>
                </div>
                <BusMap height={280} selectedRoute={mapRoute} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 bg-white rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h2 className="font-extrabold text-[#1C2B3A] text-sm">Estado de Flota</h2>
                    <span className="text-xs text-muted-foreground">Actualizado hace 30s</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#F8FAFD] border-b border-border">
                          {["Unidad","Placa","Ruta","Estado","Aforo","Pasajeros","ETA","Vel."].map(h => (<th key={h} className="px-3 py-2.5 text-left font-bold text-muted-foreground">{h}</th>))}
                        </tr>
                      </thead>
                      <tbody>
                        {buses.map((bus, i) => (
                          <tr key={bus.id} className={`border-b border-border last:border-0 ${i%2===0?"bg-white":"bg-[#FAFBFD]"}`}>
                            <td className="px-3 py-2 font-bold text-[#005DAA]">{bus.id}</td>
                            <td className="px-3 py-2 font-mono text-gray-600">{bus.plate}</td>
                            <td className="px-3 py-2 text-gray-700">{bus.route}</td>
                            <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${statusBadge[bus.status]}`}>{statusLabel[bus.status]}</span></td>
                            <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${ocBadge[bus.occupancy]}`}>{bus.occupancy}</span></td>
                            <td className="px-3 py-2 text-gray-700">{bus.passengers}/{bus.capacity}</td>
                            <td className="px-3 py-2 text-gray-700">{bus.status !== "fuera_de_servicio" ? `${bus.eta}m` : "—"}</td>
                            <td className="px-3 py-2 text-gray-700">{bus.speed > 0 ? `${bus.speed}km/h` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-border overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-border shrink-0">
                    <h2 className="font-extrabold text-[#1C2B3A] text-sm mb-2">Incidentes Operativos</h2>
                    <select className="w-full border border-border rounded-lg px-2 py-1 text-[10px] text-gray-600 bg-[#F8FAFD] focus:outline-none" value={incTypeFilter} onChange={e => setIncTypeFilter(e.target.value)}>
                      {incTypes.map(t => <option key={t} value={t}>{t === "todos" ? "Todos los tipos" : t}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {filteredInc.map(inc => (
                      <div key={inc.id} className="p-3 bg-[#F8FAFD] rounded-xl border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold text-[#005DAA] text-[10px]">{inc.bus} · {inc.time}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${severityBadge[inc.severity]}`}>{inc.severity.toUpperCase()}</span>
                        </div>
                        <div className="text-[10px] font-bold text-[#1C2B3A]">{inc.type}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{inc.detail.slice(0, 80)}…</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[9px] text-gray-400">{inc.driver.split(" ").slice(0,2).join(" ")}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${inc.status === "activo" ? "bg-red-100 text-red-700" : inc.status === "resuelto" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{inc.status.toUpperCase()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "aforo" && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {buses.filter(b => b.status !== "fuera_de_servicio").map(bus => {
                  const pct = Math.round(bus.passengers / bus.capacity * 100);
                  const r = routes.find(x => x.id === bus.routeId);
                  return (
                    <div key={bus.id} className="bg-white rounded-xl p-4 border border-border">
                      <div className="flex items-center justify-between mb-2"><span className="font-extrabold text-[#005DAA] text-sm">{bus.id}</span><OccupancyBadge level={bus.occupancy} /></div>
                      <div className="text-xs text-gray-400 mb-2.5">{r?.shortName}</div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: ocColors[bus.occupancy] }} /></div>
                      <div className="flex justify-between text-xs"><span className="text-gray-500">{bus.passengers} pax</span><span className="font-bold" style={{ color: ocColors[bus.occupancy] }}>{pct}%</span></div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-white rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-extrabold text-[#1C2B3A]">Historial de Ocupación por Ruta — Hoy</h2>
                  <div className="flex gap-3">{aforoRouteIds.map(id => { const r = getRoute(id); return r ? (<span key={id} className="flex items-center gap-1.5 text-xs text-gray-500"><div className="w-3 h-2 rounded" style={{ background: r.color }} />{r.shortName}</span>) : null; })}</div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={occupancyByHour} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4EAF2" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#64748B" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#64748B" }} unit="p" />
                    <Tooltip contentStyle={{ fontSize: 11, border: "1px solid #E4EAF2", borderRadius: 8 }} />
                    {aforoRouteIds.map(id => { const r = getRoute(id); return r ? (<Area key={id} type="monotone" dataKey={String(id)} name={r.shortName} stroke={r.color} fill={r.color} fillOpacity={0.12} strokeWidth={2} />) : null; })}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {tab === "financiero" && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Ingresos Hoy", value: "$925.50", delta: "+12%", up: true },
                  { label: "Pasajeros Hoy", value: "1,851", delta: "+8%", up: true },
                  { label: "Ingresos Semana", value: "$1,786", delta: "+5%", up: true },
                  { label: "Ingresos Mes", value: "$7,510", delta: "-3%", up: false },
                ].map(k => (
                  <div key={k.label} className="bg-white rounded-xl p-4 border border-border">
                    <div className="text-muted-foreground text-xs mb-1">{k.label}</div>
                    <div className="font-extrabold text-[#1C2B3A] text-2xl mb-1">{k.value}</div>
                    <div className={`flex items-center gap-1 text-xs font-bold ${k.up ? "text-emerald-600" : "text-red-500"}`}>
                      {k.up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}{k.delta} vs semana anterior
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-border">
                  <h2 className="font-extrabold text-[#1C2B3A] text-sm mb-4">Ingresos por Día — Semana Actual</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={weeklyRevenue} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4EAF2" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748B" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                      <Tooltip formatter={(v: number) => [`$${v}`, "Ingresos"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="revenue" fill="#005DAA" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-xl p-4 border border-border">
                  <h2 className="font-extrabold text-[#1C2B3A] text-sm mb-4">Ingresos Mensuales — 2026</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={monthlyRevenue} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4EAF2" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                      <Tooltip formatter={(v: number) => [`$${v}`, "Ingresos"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Line type="monotone" dataKey="revenue" stroke="#005DAA" strokeWidth={2.5} dot={{ fill: "#005DAA", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h2 className="font-extrabold text-[#1C2B3A] text-sm">Detalle Diario</h2>
                  <button className="flex items-center gap-1.5 text-xs text-[#005DAA] font-bold border border-[#005DAA]/20 bg-blue-50 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors"><Download className="w-3.5 h-3.5" />Exportar</button>
                </div>
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#F8FAFD] border-b border-border">{["Día","Pasajeros","Ingreso","Ruta líder","Variación"].map(h => (<th key={h} className="px-4 py-2.5 text-left font-bold text-muted-foreground">{h}</th>))}</tr></thead>
                  <tbody>
                    {weeklyRevenue.map((row, i) => (
                      <tr key={row.day} className={`border-b border-border last:border-0 ${i%2===0?"bg-white":"bg-[#FAFBFD]"}`}>
                        <td className="px-4 py-2.5 font-bold text-[#1C2B3A]">{row.day}</td>
                        <td className="px-4 py-2.5 text-gray-600">{row.passengers.toLocaleString()}</td>
                        <td className="px-4 py-2.5 font-extrabold text-[#1C2B3A]">${row.revenue.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-gray-500">Acacias</td>
                        <td className="px-4 py-2.5">{i > 0 ? (<span className={`font-bold ${row.revenue > weeklyRevenue[i-1].revenue ? "text-emerald-600" : "text-red-500"}`}>{row.revenue > weeklyRevenue[i-1].revenue ? "+" : ""}{((row.revenue - weeklyRevenue[i-1].revenue) / weeklyRevenue[i-1].revenue * 100).toFixed(1)}%</span>) : <span className="text-gray-400">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "retroalimentacion" && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total Feedback", value: "127", icon: <MessageSquare className="w-4 h-4 text-[#005DAA]" />, bg: "#EBF2FF" },
                  { label: "Quejas", value: String(feedbackItems.filter(f=>f.type==="queja").length), icon: <AlertTriangle className="w-4 h-4 text-red-600" />, bg: "#FEF2F2" },
                  { label: "Sugerencias", value: String(feedbackItems.filter(f=>f.type==="sugerencia").length), icon: <Zap className="w-4 h-4 text-amber-600" />, bg: "#FFFBEB" },
                  { label: "Felicitaciones", value: String(feedbackItems.filter(f=>f.type==="felicitacion").length), icon: <Star className="w-4 h-4 text-emerald-600" />, bg: "#ECFDF5" },
                ].map(k => (
                  <div key={k.label} className="bg-white rounded-xl p-4 border border-border flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: k.bg }}>{k.icon}</div>
                    <div><div className="font-extrabold text-2xl text-[#1C2B3A]">{k.value}</div><div className="text-muted-foreground text-xs">{k.label}</div></div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-border p-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide"><Filter className="w-3.5 h-3.5" />Tipo</span>
                  <div className="flex gap-1.5">
                    {(["todos","queja","sugerencia","felicitacion"] as const).map(t => (
                      <button key={t} onClick={() => setFbType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${fbType===t?"bg-[#005DAA] text-white":"bg-[#F4F7FB] text-gray-600 hover:bg-gray-100"}`}>{t === "todos" ? "Todos" : fbTypeLabel[t]}</button>
                    ))}
                  </div>
                </div>
                <div className="w-px h-6 bg-gray-200" />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Estado</span>
                  <div className="flex gap-1.5">
                    {(["todos","pendiente","resuelto"] as const).map(s => (
                      <button key={s} onClick={() => setFbStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${fbStatus===s?"bg-[#1C2B3A] text-white":"bg-[#F4F7FB] text-gray-600 hover:bg-gray-100"}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
                    ))}
                  </div>
                </div>
                <span className="ml-auto text-xs text-gray-400">{filteredFb.length} resultado(s)</span>
              </div>
              <div className="space-y-3">
                {filteredFb.map(fb => (
                  <div key={fb.id} className="bg-white rounded-xl p-4 border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-[#EBF2FF] rounded-full flex items-center justify-center text-[#005DAA] font-extrabold text-xs shrink-0">{fb.studentName.split(" ").map(n => n[0]).join("").slice(0,2)}</div>
                        <div><div className="font-bold text-[#1C2B3A] text-sm">{fb.studentName}</div><div className="text-gray-400 text-xs">{fb.carnet} · {fb.route} · {fb.date}</div></div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${fbTypeBadge[fb.type]}`}>{fbTypeLabel[fb.type]}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${fb.status === "resuelto" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{fb.status === "resuelto" ? "Resuelto" : "Pendiente"}</span>
                      </div>
                    </div>
                    <StarRow value={fb.rating} size="sm" />
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">{fb.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "supervisor" && (
            <div className="max-w-lg">
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="px-5 py-4" style={{ background: "#005DAA" }}>
                  <h2 className="text-white font-extrabold">Registro Rápido de Evento</h2>
                  <p className="text-blue-200 text-xs mt-0.5">Supervisor presencial · Turno 06:00–14:00</p>
                </div>
                <div className="p-5 space-y-4">
                  {incSent ? (
                    <div className="flex flex-col items-center py-10">
                      <CheckCircle className="w-16 h-16 text-emerald-500 mb-3" />
                      <div className="font-extrabold text-lg text-[#1C2B3A]">Evento registrado</div>
                      <button onClick={() => { setIncSent(false); setIncForm({ bus:"", type:"", desc:"", severity:"medio" }); }} className="mt-5 text-sm text-[#005DAA] font-bold hover:underline">Registrar otro evento</button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-bold text-[#1C2B3A] block mb-1.5">Unidad afectada</label>
                        <select className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-[#F8FAFD] focus:outline-none focus:ring-2 focus:ring-[#005DAA]/20" value={incForm.bus} onChange={e => setIncForm({...incForm, bus: e.target.value})}>
                          <option value="">Seleccionar bus...</option>
                          {buses.map(b => <option key={b.id} value={b.id}>{b.id} — {b.plate} ({b.route})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-[#1C2B3A] block mb-1.5">Tipo de evento</label>
                        <select className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-[#F8FAFD] focus:outline-none focus:ring-2 focus:ring-[#005DAA]/20" value={incForm.type} onChange={e => setIncForm({...incForm, type: e.target.value})}>
                          <option value="">Seleccionar tipo...</option>
                          {["Bus tardío","Bus no paró en parada","Incidente de tráfico","Falla mecánica","Aforo excedido","Conductor ausente","Otro"].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-[#1C2B3A] block mb-1.5">Severidad</label>
                        <div className="flex gap-2">
                          {(["bajo","medio","alto"] as const).map(s => (
                            <button key={s} type="button" onClick={() => setIncForm({...incForm, severity: s})}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${incForm.severity === s ? severityBadge[s] : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>{s.toUpperCase()}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-[#1C2B3A] block mb-1.5">Descripción</label>
                        <textarea rows={4} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-[#F8FAFD] resize-none focus:outline-none focus:ring-2 focus:ring-[#005DAA]/20" placeholder="Describe el evento..." value={incForm.desc} onChange={e => setIncForm({...incForm, desc: e.target.value})} />
                      </div>
                      <button onClick={() => { if (incForm.bus && incForm.type) setIncSent(true); }} disabled={!incForm.bus || !incForm.type}
                        className="w-full py-3 bg-[#005DAA] text-white rounded-xl font-extrabold text-sm disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-[#004C8C] transition-colors">
                        <Send className="w-4 h-4" />Registrar evento
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "mantenimiento" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Alerta CRÍTICA", value: String(maintenanceData.filter(r => getMaintStatus(r).label === "CRÍTICO").length), sub: "Requieren servicio inmediato", color: "#DC2626", bg: "#FEF2F2", border: "border-red-200", icon: <AlertCircle className="w-5 h-5 text-red-600" /> },
                  { label: "Próximo mantenimiento", value: String(maintenanceData.filter(r => getMaintStatus(r).label === "PRÓXIMO").length), sub: "< 2,000 km al próximo corte", color: "#D97706", bg: "#FFFBEB", border: "border-amber-200", icon: <Wrench className="w-5 h-5 text-amber-600" /> },
                  { label: "Unidades al día", value: String(maintenanceData.filter(r => getMaintStatus(r).label === "NORMAL").length), sub: "Sin alertas en el período", color: "#059669", bg: "#ECFDF5", border: "border-emerald-200", icon: <CheckCircle className="w-5 h-5 text-emerald-600" /> },
                ].map(k => (
                  <div key={k.label} className={`bg-white rounded-xl p-4 border-2 ${k.border} flex items-center gap-3`}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: k.bg }}>{k.icon}</div>
                    <div><div className="font-extrabold text-3xl" style={{ color: k.color }}>{k.value}</div><div className="font-bold text-[#1C2B3A] text-sm">{k.label}</div><div className="text-muted-foreground text-xs mt-0.5">{k.sub}</div></div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h2 className="font-extrabold text-[#1C2B3A] text-sm">Estado de Mantenimiento por Unidad</h2>
                  <span className="text-xs text-muted-foreground">Intervalo: cada 5,000 km</span>
                </div>
                <div className="p-4 space-y-3">
                  {maintenanceData.slice().sort((a, b) => (a.threshold - a.kmTotal) - (b.threshold - b.kmTotal)).map(rec => {
                    const st = getMaintStatus(rec);
                    const kmSince = rec.kmTotal - rec.kmLastService;
                    const kmLeft = rec.threshold - rec.kmTotal;
                    const pct = Math.min(100, Math.round(kmSince / (rec.threshold - rec.kmLastService) * 100));
                    return (
                      <div key={rec.id} className={`p-3.5 rounded-xl border ${st.border} ${st.bg}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-gray-200 shrink-0"><Bus className="w-4 h-4 text-[#005DAA]" /></div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-[#1C2B3A] text-sm">{rec.id}</span>
                                <span className="font-mono text-gray-500 text-xs">{rec.plate}</span>
                                <span className="text-[9px] px-2 py-0.5 rounded-full font-extrabold text-white" style={{ background: st.color }}>{st.label}</span>
                              </div>
                              <div className="text-xs text-gray-500">{rec.driver}</div>
                            </div>
                          </div>
                          <div className="text-right text-xs"><div className="font-extrabold text-[#1C2B3A]">{rec.kmTotal.toLocaleString()} km</div><div className="text-gray-500">total</div></div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-gray-500">
                            <span>Desde último serv.: <strong className="text-gray-700">{kmSince.toLocaleString()} km</strong></span>
                            <span>Faltan: <strong style={{ color: st.color }}>{kmLeft.toLocaleString()} km</strong></span>
                          </div>
                          <div className="h-2.5 bg-white/70 rounded-full overflow-hidden relative border border-white/50">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: st.color }} />
                          </div>
                          <div className="text-[10px] text-gray-500 text-right">Próximo serv.: <strong className="text-gray-700">{rec.threshold.toLocaleString()} km</strong></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ESPOL DASHBOARD ──────────────────────────────────────────

type KpiKey = "punct" | "compliance" | "incidents" | "satisfaction";

function EspolDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<EspolTab>("kpis");
  const [dateFrom, setDateFrom] = useState("2026-05-01");
  const [dateTo, setDateTo] = useState("2026-06-05");
  const [kpiDetail, setKpiDetail] = useState<KpiKey | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([]);
  const [espolMapRoute, setEspolMapRoute] = useState(0);

  // Índice absoluto año*12+mes para comparar rangos que cruzan el año.
  const fromD = new Date(dateFrom + "T00:00:00");
  const toD = new Date(dateTo + "T00:00:00");
  const monthIdx = (year: number, month1to12: number) => year * 12 + (month1to12 - 1);
  const fromIdx = monthIdx(fromD.getFullYear(), fromD.getMonth() + 1);
  const toIdx = monthIdx(toD.getFullYear(), toD.getMonth() + 1);

  // Filtro de feedback por rango de fechas (comparación por día, inclusivo).
  const filteredFeedback = feedbackItems.filter(f => {
    const d = new Date(f.date + "T00:00:00");
    return d >= fromD && d <= toD;
  });

  // Filtro de historial de desempeño por rango de meses (cruza años correctamente).
  const filteredPerformance = performanceHistory.filter(row => {
    const idx = monthIdx(row.year, row.monthNum);
    return idx >= fromIdx && idx <= toIdx;
  });

  // Filtro de tendencia de satisfacción por rango de meses.
  const filteredSatisfaction = satisfactionTrend.filter(row => {
    const idx = monthIdx(row.year, row.month);
    return idx >= fromIdx && idx <= toIdx;
  });

  const avgCompliance = Math.round(routeCompliance.reduce((s, r) => s + (r.executed / r.planned * 100), 0) / routeCompliance.length);
  const criticalInc = driverIncidents.filter(d => d.critical).length;
  const avgRating = filteredFeedback.length > 0
    ? filteredFeedback.reduce((s, f) => s + f.rating, 0) / filteredFeedback.length
    : 0;
  const avgPunctuality = filteredPerformance.length > 0
    ? Math.round(filteredPerformance.reduce((s, r) => s + r.onTime, 0) / filteredPerformance.length)
    : 84;

  const navItems: Array<{ t: EspolTab; icon: React.ReactNode; label: string }> = [
    { t: "kpis", icon: <BarChart2 className="w-4 h-4" />, label: "KPIs Gerenciales" },
    { t: "satisfaccion", icon: <Star className="w-4 h-4" />, label: "Satisfacción" },
    { t: "reportes", icon: <FileText className="w-4 h-4" />, label: "Reportes Históricos" },
    { t: "alertas", icon: <AlertTriangle className="w-4 h-4" />, label: "Alertas del Sistema" },
  ];

  return (
    <div className="flex h-screen bg-[#F0F4FA]" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <aside className="w-56 bg-[#0D1B2E] flex flex-col shrink-0">
        <div className="p-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 bg-[#7C3AED] rounded-lg flex items-center justify-center shrink-0"><Shield className="w-4 h-4 text-white" /></div>
            <div><div className="text-white font-extrabold text-sm tracking-tight">PoliBus</div><div className="text-purple-400 text-[9px]">Bienestar Politécnico</div></div>
          </div>
          <div className="flex items-center gap-1.5 bg-purple-900/30 border border-purple-700/25 rounded-lg px-2 py-1 mt-1">
            <Eye className="w-3 h-3 text-purple-400" /><span className="text-purple-300 text-[9px] font-bold">Solo Lectura</span>
          </div>
        </div>
        <nav className="flex-1 p-2.5 space-y-0.5">
          {navItems.map(item => (
            <button key={item.t} onClick={() => setTab(item.t)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${tab === item.t ? "bg-[#7C3AED] text-white" : "text-blue-200 hover:bg-white/[0.07] hover:text-white"}`}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>
        <div className="p-2.5 border-t border-white/[0.07]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-[#7C3AED] rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0">ES</div>
            <div className="min-w-0"><div className="text-white text-[10px] font-bold truncate">Bienestar Politécnico</div><div className="text-blue-400 text-[9px]">Dirección de Bienestar Estudiantil</div></div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-1.5 text-blue-300 hover:text-white text-[10px] py-1 transition-colors"><LogOut className="w-3 h-3" />Cerrar sesión</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-extrabold text-[#1C2B3A] text-base">{navItems.find(n => n.t === tab)?.label}</h1>
            <p className="text-muted-foreground text-xs flex items-center gap-1.5">Bienestar Politécnico · Auditoría independiente <span className="inline-flex items-center gap-1 text-[#7C3AED]"><Satellite className="w-3 h-3" />Telemetría GPS + sensores IR</span></p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-full px-3 py-1 text-xs font-bold text-purple-700"><Eye className="w-3 h-3" />Solo lectura</span>
            <button className="flex items-center gap-1.5 text-xs text-[#005DAA] font-bold border border-[#005DAA]/20 bg-blue-50 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors"><Download className="w-3.5 h-3.5" />Exportar PDF</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Persistent date filter — all tabs respect it */}
          <DateRangeFilter from={dateFrom} to={dateTo} onApply={(f, t) => { setDateFrom(f); setDateTo(t); }} />

          {tab === "kpis" && (
            <div className="space-y-4">
              {filteredFeedback.length !== feedbackItems.length && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 font-semibold">
                  <Calendar className="w-3.5 h-3.5" />
                  Mostrando {filteredFeedback.length} de {feedbackItems.length} registros en el período · {filteredPerformance.length} de {performanceHistory.length} meses
                </div>
              )}

              <div className="grid grid-cols-4 gap-3">
                <PunctualityCard value={avgPunctuality} target={90} scope="Todas las rutas · Período filtrado" subtitle="Tolerancia: ≤5 min de retraso" onClick={() => setKpiDetail("punct")} />

                <button onClick={() => setKpiDetail("compliance")} className="text-left bg-white rounded-xl p-5 border-2 border-blue-100 flex flex-col justify-between cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div><div className="text-xs text-muted-foreground font-semibold">Cumplimiento de Rutas</div><div className="text-[10px] text-gray-400 mt-0.5">Planificadas vs. ejecutadas</div></div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{avgCompliance >= 90 ? "✓ Meta" : "⚠ Revisar"}</span>
                  </div>
                  <div className="font-extrabold text-[3.25rem] leading-none text-[#005DAA] mb-3">{avgCompliance}%</div>
                  <div className="space-y-1.5">
                    {routeCompliance.map(r => {
                      const pct = Math.round(r.executed / r.planned * 100);
                      return (
                        <div key={r.route} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} /></div>
                          <span className="text-[10px] font-bold text-gray-600 w-8 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-[10px] font-bold text-[#005DAA] flex items-center gap-1">Ver detalle<ChevronRight className="w-3 h-3" /></div>
                </button>

                <button onClick={() => setKpiDetail("incidents")} className="text-left bg-white rounded-xl p-5 border-2 border-red-100 flex flex-col justify-between cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div><div className="text-xs text-muted-foreground font-semibold">Incidentes Críticos</div><div className="text-[10px] text-gray-400 mt-0.5">Por unidad / conductor</div></div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">{criticalInc} con alerta</span>
                  </div>
                  <div className="font-extrabold text-[3.25rem] leading-none text-red-600 mb-3">{driverIncidents.reduce((s, d) => s + d.count, 0)}</div>
                  <div className="space-y-1">
                    {driverIncidents.filter(d => d.count > 0).slice(0, 4).map(d => (
                      <div key={d.driver} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {d.critical && <div className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />}
                          <span className="text-[10px] text-gray-600 truncate">{d.driver.split(" ").slice(0,2).join(" ")}</span>
                          <span className="text-[9px] text-gray-400 shrink-0 font-mono">{d.bus}</span>
                        </div>
                        <span className={`text-[10px] font-extrabold shrink-0 ml-2 ${d.count >= 3 ? "text-red-600" : d.count >= 2 ? "text-amber-600" : "text-gray-500"}`}>{d.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] font-bold text-red-600 flex items-center gap-1">Ver detalle<ChevronRight className="w-3 h-3" /></div>
                </button>

                <button onClick={() => setKpiDetail("satisfaction")} className="text-left bg-white rounded-xl p-5 border-2 border-amber-100 flex flex-col justify-between cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div><div className="text-xs text-muted-foreground font-semibold">Satisfacción Neta</div><div className="text-[10px] text-gray-400 mt-0.5">{filteredFeedback.length} calificaciones</div></div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{avgRating >= 4 ? "✓ Meta" : filteredFeedback.length === 0 ? "—" : "⚠ Por mejorar"}</span>
                  </div>
                  <div className="font-extrabold text-[3.25rem] leading-none text-amber-500 mb-1">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</div>
                  {avgRating > 0 && <StarRow value={Math.round(avgRating)} size="md" />}
                  <div className="mt-3">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${avgRating / 5 * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-400 mt-0.5"><span>0</span><span className="text-amber-600 font-semibold">Meta: ≥4.0</span><span>5</span></div>
                  </div>
                  <div className="mt-2 text-[10px] font-bold text-amber-600 flex items-center gap-1">Ver detalle<ChevronRight className="w-3 h-3" /></div>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-border">
                  <h2 className="font-extrabold text-[#1C2B3A] text-sm mb-4">Vueltas Planificadas vs. Ejecutadas</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={complianceChartData} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4EAF2" />
                      <XAxis dataKey="route" tick={{ fontSize: 10, fill: "#64748B" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#64748B" }} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Planificadas" fill="#E4EAF2" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Ejecutadas" fill="#005DAA" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h2 className="font-extrabold text-[#1C2B3A] text-sm">Ranking de Incidentes por Conductor</h2>
                    <span className="text-xs text-muted-foreground">Período seleccionado</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFD] border-b border-border">
                        {["#","Conductor","Bus","Inc.","Tipos","Nivel"].map(h => (<th key={h} className="px-3 py-2.5 text-left font-bold text-muted-foreground">{h}</th>))}
                      </tr>
                    </thead>
                    <tbody>
                      {driverIncidents.map((d, i) => (
                        <tr key={d.driver} className={`border-b border-border last:border-0 ${i%2===0?"bg-white":"bg-[#FAFBFD]"}`}>
                          <td className="px-3 py-2 font-extrabold text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold text-[#1C2B3A]">{d.driver}</td>
                          <td className="px-3 py-2 font-mono text-gray-500">{d.bus}</td>
                          <td className="px-3 py-2"><span className={`font-extrabold text-base ${d.count >= 3 ? "text-red-600" : d.count >= 1 ? "text-amber-600" : "text-emerald-600"}`}>{d.count}</span></td>
                          <td className="px-3 py-2 text-gray-500 max-w-[90px] truncate">{d.types.join(", ") || "—"}</td>
                          <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${d.count >= 3 ? "bg-red-50 text-red-700 border-red-200" : d.count >= 1 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{d.count >= 3 ? "ALTO" : d.count >= 1 ? "MEDIO" : "OK"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-extrabold text-[#1C2B3A] text-sm">Flota en Tiempo Real — Vista Institucional</h2>
                  <div className="flex gap-3 flex-wrap justify-end">
                    <button onClick={() => setEspolMapRoute(0)} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors">
                      <div className="w-3 h-3 rounded bg-gray-400" style={{ opacity: espolMapRoute === 0 ? 1 : 0.3 }} />Todas
                    </button>
                    {routes.filter(r => buses.some(b => b.routeId === r.id)).map(r => (
                      <button key={r.id} onClick={() => setEspolMapRoute(espolMapRoute === r.id ? 0 : r.id)} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors">
                        <div className="w-3 h-3 rounded" style={{ background: r.color, opacity: espolMapRoute === 0 || espolMapRoute === r.id ? 1 : 0.3 }} />{r.shortName}
                      </button>
                    ))}
                  </div>
                </div>
                <BusMap height={260} selectedRoute={espolMapRoute} />
              </div>
            </div>
          )}

          {tab === "satisfaccion" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-5 border border-border flex flex-col items-center justify-center">
                  <div className="font-extrabold text-5xl text-[#1C2B3A] mb-2">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</div>
                  <StarRow value={Math.round(avgRating)} size="md" />
                  <div className="text-muted-foreground text-xs mt-2">Promedio del período</div>
                  <div className="text-xs text-gray-500 mt-1">{filteredFeedback.length} de {feedbackItems.length} calificaciones</div>
                </div>
                <div className="col-span-2 bg-white rounded-xl p-4 border border-border">
                  <h3 className="font-extrabold text-[#1C2B3A] text-sm mb-4">Distribución — período filtrado</h3>
                  {[5,4,3,2,1].map(stars => {
                    const count = filteredFeedback.filter(f => f.rating === stars).length;
                    const pct = filteredFeedback.length > 0 ? Math.round(count / filteredFeedback.length * 100) : 0;
                    return (
                      <div key={stars} className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-gray-500 w-6 text-right">{stars}★</span>
                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                        <span className="text-xs text-gray-500 w-14 text-right">{count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-border">
                <h2 className="font-extrabold text-[#1C2B3A] mb-4">
                  Tendencia de Satisfacción — {filteredSatisfaction.length} semana(s) del período
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={filteredSatisfaction.length > 0 ? filteredSatisfaction : satisfactionTrend} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4EAF2" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748B" }} />
                    {/* Fix: removed ticks prop to avoid duplicate React key warnings */}
                    <YAxis domain={[1,5]} tick={{ fontSize: 11, fill: "#64748B" }} />
                    <Tooltip formatter={(v: number) => [v.toFixed(1), "Calificación"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="rating" stroke="#7C3AED" strokeWidth={2.5} dot={{ fill: "#7C3AED", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <ComplaintClusters />
            </div>
          )}

          {tab === "reportes" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-extrabold text-[#1C2B3A]">Historial de Desempeño SEDAREY — 2026</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Mostrando {filteredPerformance.length} de {performanceHistory.length} meses en el período seleccionado</p>
                </div>
                <button className="flex items-center gap-1.5 text-xs text-[#005DAA] font-bold border border-[#005DAA]/20 bg-blue-50 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors"><Download className="w-3.5 h-3.5" />Exportar Excel</button>
              </div>
              <div className="bg-white rounded-xl p-4 border border-border">
                <h3 className="font-extrabold text-[#1C2B3A] text-sm mb-4">% Rutas a Tiempo y Satisfacción Estudiantil</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={filteredPerformance.length > 0 ? filteredPerformance : performanceHistory} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4EAF2" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} />
                    {/* Fix: explicit keys on dual YAxis to avoid duplicate key warnings */}
                    <YAxis key="ya-l" yAxisId="l" tick={{ fontSize: 11, fill: "#64748B" }} unit="%" />
                    <YAxis key="ya-r" yAxisId="r" orientation="right" domain={[1,5]} tick={{ fontSize: 11, fill: "#64748B" }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line key="ln-t" yAxisId="l" type="monotone" dataKey="onTime" name="% A tiempo" stroke="#005DAA" strokeWidth={2.5} dot={{ fill: "#005DAA", r: 4 }} />
                    <Line key="ln-s" yAxisId="r" type="monotone" dataKey="satisfaction" name="Satisfacción" stroke="#7C3AED" strokeWidth={2.5} dot={{ fill: "#7C3AED", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border"><h3 className="font-extrabold text-[#1C2B3A] text-sm">Reporte Mensual Detallado</h3></div>
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#F8FAFD] border-b border-border">{["Mes","Pasajeros","% A tiempo","Satisfacción","Incidentes","Variación"].map(h => (<th key={h} className="px-4 py-2.5 text-left font-bold text-muted-foreground">{h}</th>))}</tr></thead>
                  <tbody>
                    {(filteredPerformance.length > 0 ? filteredPerformance : performanceHistory).map((row, i, arr) => (
                      <tr key={row.month} className={`border-b border-border last:border-0 ${i%2===0?"bg-white":"bg-[#FAFBFD]"}`}>
                        <td className="px-4 py-2.5 font-bold text-[#1C2B3A]">{row.month} 2026</td>
                        <td className="px-4 py-2.5 text-gray-600">{row.passengers.toLocaleString()}</td>
                        <td className="px-4 py-2.5"><span className={`font-bold ${row.onTime >= 85 ? "text-emerald-600" : "text-amber-600"}`}>{row.onTime}%</span></td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">{Array.from({length:5}).map((_,s) => (<Star key={s} className={`w-3 h-3 ${s < Math.round(row.satisfaction) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />))}<span className="ml-1 text-gray-600">{row.satisfaction}</span></div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{row.incidents}</td>
                        <td className="px-4 py-2.5">
                          {i > 0 ? (<span className={`flex items-center gap-1 font-bold ${row.onTime >= arr[i-1].onTime ? "text-emerald-600" : "text-red-500"}`}>{row.onTime >= arr[i-1].onTime ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{row.onTime >= arr[i-1].onTime ? "Mejoró" : "Bajó"}</span>) : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "alertas" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { bg: "bg-amber-50", border: "border-amber-300", icon: <AlertTriangle className="w-5 h-5 text-amber-600" />, title: `Puntualidad en ${avgPunctuality}% — por debajo de meta (90%)`, body: "Se recomienda revisión operacional urgente con SEDAREY. Rutas más afectadas: Durán y Albán Borja.", time: "Detectado: hoy 10:30", badge: "REVISAR", badgeCls: "bg-amber-100 text-amber-800" },
                  { bg: "bg-blue-50", border: "border-blue-200", icon: <Activity className="w-5 h-5 text-blue-600" />, title: `Satisfacción en ${avgRating > 0 ? avgRating.toFixed(1) : "—"}/5 — cerca de la meta`, body: "Quejas frecuentes: Bus lleno (34%) y No paró en parada (27%). Ver panel Satisfacción para detalle completo.", time: "Actualizado: hoy", badge: "MONITOREAR", badgeCls: "bg-blue-100 text-blue-800" },
                  { bg: "bg-emerald-50", border: "border-emerald-200", icon: <CheckCircle className="w-5 h-5 text-emerald-600" />, title: "Flota operativa al 87.5%", body: "7 de 8 unidades operativas. B006 fuera de servicio por falla mecánica — reparación en progreso en taller.", time: "Estado actual", badge: "NORMAL", badgeCls: "bg-emerald-100 text-emerald-800" },
                  { bg: "bg-red-50", border: "border-red-200", icon: <AlertTriangle className="w-5 h-5 text-red-600" />, title: "2 conductores con incidentes críticos", body: "Roberto Cedeño A. (4 incidentes, B006) y Miguel Alvarado V. (conducción temeraria, B002) requieren revisión disciplinaria.", time: "Última alerta: hoy 09:15", badge: "URGENTE", badgeCls: "bg-red-100 text-red-800" },
                ].map((a, i) => dismissedAlerts.includes(i) ? null : (
                  <div key={i} className={`${a.bg} border ${a.border} rounded-xl p-4 transition-all hover:shadow-md`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2.5">{a.icon}<span className="font-extrabold text-[#1C2B3A] text-sm">{a.title}</span></div>
                      <button onClick={() => setDismissedAlerts(d => [...d, i])} title="Descartar" className="text-gray-400 hover:text-gray-700 shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed mb-3">{a.body}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{a.time}</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${a.badgeCls}`}>{a.badge}</span>
                        <button onClick={() => setDismissedAlerts(d => [...d, i])} className="px-2.5 py-0.5 rounded-full font-bold bg-white/70 border border-gray-200 text-gray-600 hover:bg-white">Atender</button>
                      </div>
                    </div>
                  </div>
                ))}
                {dismissedAlerts.length === 4 && (
                  <div className="col-span-2 flex flex-col items-center py-10 text-emerald-500">
                    <CheckCircle className="w-12 h-12 mb-2" /><p className="font-bold text-sm">Todas las alertas atendidas</p>
                    <button onClick={() => setDismissedAlerts([])} className="mt-2 text-xs text-[#005DAA] font-bold hover:underline">Restaurar alertas</button>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl p-4 border border-border">
                <h3 className="font-extrabold text-[#1C2B3A] mb-3">Umbrales de Alerta Configurados</h3>
                <div className="space-y-0">
                  {[
                    { metric: "Tasa de puntualidad", threshold: "< 90%", current: `${avgPunctuality}%`, status: avgPunctuality >= 90 ? "NORMAL" : "ALERTA" },
                    { metric: "Cumplimiento de rutas", threshold: "< 90%", current: `${avgCompliance}%`, status: avgCompliance >= 90 ? "NORMAL" : "AVISO" },
                    { metric: "Satisfacción promedio", threshold: "< 4.0 ★", current: avgRating > 0 ? `${avgRating.toFixed(1)} ★` : "—", status: avgRating >= 4 || avgRating === 0 ? "NORMAL" : "ALERTA" },
                    { metric: "Unidades fuera de servicio", threshold: "> 2 unidades", current: "1 unidad", status: "NORMAL" },
                    { metric: "Conductores con ≥3 incidentes", threshold: "> 1 conductor", current: "1 conductor", status: "AVISO" },
                    { metric: "Quejas sin resolver (24h)", threshold: "> 5 quejas", current: `${feedbackItems.filter(f => f.type === "queja" && f.status === "pendiente").length} quejas`, status: "NORMAL" },
                  ].map(t => (
                    <div key={t.metric} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                      <div><span className="font-semibold text-[#1C2B3A] text-sm">{t.metric}</span><span className="text-muted-foreground text-xs ml-2">Umbral: {t.threshold}</span></div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-gray-600">{t.current}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${t.status === "NORMAL" ? "bg-emerald-100 text-emerald-700" : t.status === "ALERTA" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{t.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalle de KPI (cards interactivas) */}
      {kpiDetail && (
        <div className="fixed inset-0 z-[3000] bg-black/40 flex items-center justify-center p-6" onClick={() => setKpiDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-extrabold text-[#1C2B3A]">
                {kpiDetail === "punct" && "Puntualidad — Detalle"}
                {kpiDetail === "compliance" && "Cumplimiento de Rutas — Detalle"}
                {kpiDetail === "incidents" && "Incidentes Críticos — Detalle"}
                {kpiDetail === "satisfaction" && "Satisfacción — Detalle"}
              </h3>
              <button onClick={() => setKpiDetail(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3">
              {kpiDetail === "punct" && (
                <>
                  <p className="text-sm text-gray-600">Promedio del período: <strong className="text-[#1C2B3A]">{avgPunctuality}%</strong> (meta 90%).</p>
                  {filteredPerformance.map(row => (
                    <div key={row.month} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-16">{row.month} {row.year}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${row.onTime}%`, background: row.onTime >= 85 ? "#059669" : "#D97706" }} /></div>
                      <span className="text-xs font-bold text-gray-700 w-10 text-right">{row.onTime}%</span>
                    </div>
                  ))}
                </>
              )}
              {kpiDetail === "compliance" && (
                <>
                  <p className="text-sm text-gray-600">Promedio global: <strong className="text-[#1C2B3A]">{avgCompliance}%</strong>.</p>
                  {routeCompliance.map(r => {
                    const pct = Math.round(r.executed / r.planned * 100);
                    return (
                      <div key={r.route} className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                        <span className="text-xs text-gray-600 flex-1">{r.route}</span>
                        <span className="text-xs text-gray-400">{r.executed}/{r.planned} vueltas</span>
                        <span className="text-xs font-bold text-gray-700 w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </>
              )}
              {kpiDetail === "incidents" && (
                <>
                  <p className="text-sm text-gray-600">Total: <strong className="text-[#1C2B3A]">{driverIncidents.reduce((s, d) => s + d.count, 0)}</strong> incidentes · {criticalInc} conductores con alerta crítica.</p>
                  {driverIncidents.filter(d => d.count > 0).map(d => (
                    <div key={d.driver} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#1C2B3A] flex items-center gap-1.5">{d.critical && <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />}{d.driver}</div>
                        <div className="text-[10px] text-gray-400">{d.bus} · {d.types.join(", ") || "—"}</div>
                      </div>
                      <span className={`text-base font-extrabold ${d.count >= 3 ? "text-red-600" : "text-amber-600"}`}>{d.count}</span>
                    </div>
                  ))}
                </>
              )}
              {kpiDetail === "satisfaction" && (
                <>
                  <p className="text-sm text-gray-600">Promedio: <strong className="text-[#1C2B3A]">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</strong>/5 · {filteredFeedback.length} calificaciones.</p>
                  {[5,4,3,2,1].map(stars => {
                    const count = filteredFeedback.filter(f => f.rating === stars).length;
                    const pct = filteredFeedback.length > 0 ? Math.round(count / filteredFeedback.length * 100) : 0;
                    return (
                      <div key={stars} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-8">{stars}★</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                        <span className="text-xs text-gray-500 w-14 text-right">{count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t border-border bg-[#F8FAFD] text-right">
              <button onClick={() => setKpiDetail(null)} className="px-4 py-2 bg-[#005DAA] text-white text-xs font-bold rounded-lg hover:bg-[#004C8C] transition-colors">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CONDUCTOR APP (Carlos) ───────────────────────────────────

function ConductorApp({ onLogout }: { onLogout: () => void }) {
  const myBus = buses.find(b => b.id === "B001") ?? buses[0];
  const route = getRoute(myBus.routeId);
  const [onDuty, setOnDuty] = useState(true);
  const times = route ? expandTimes(route.schedule) : [];
  const next = route ? nextDeparture(route.schedule) : null;
  // Índice de la salida "actual" para marcar hechas/pendientes (demo).
  const doneCount = next ? Math.max(0, times.indexOf(next.time)) : times.length;
  const pct = Math.round(myBus.passengers / myBus.capacity * 100);

  return (
    <div className="min-h-screen bg-[#0D1B2E] flex items-start justify-center py-6 px-4" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <div className="relative w-[390px] h-[844px] bg-[#F0F4FA] rounded-[44px] shadow-[0_30px_80px_rgba(0,0,0,0.65)] overflow-hidden border-[3px] border-[#182435] flex flex-col">
        <div className="bg-gradient-to-br from-[#0E7490] to-[#0B4F63] px-6 pt-3 pb-1 flex justify-between items-center text-white text-[11px] shrink-0">
          <span className="font-mono font-medium">9:41</span>
          <span className="text-[10px] tracking-tight">▲▲▲ ▮</span>
        </div>
        <div className="bg-gradient-to-br from-[#0E7490] to-[#0B4F63] px-5 pb-5 pt-1 shrink-0 relative overflow-hidden">
          <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/5" />
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-white font-extrabold border border-white/20">CP</div>
              <div>
                <p className="text-teal-100 text-xs font-medium">Conductor</p>
                <h2 className="text-white font-extrabold text-lg leading-tight">{myBus.driver}</h2>
              </div>
            </div>
            <button onClick={onLogout} className="w-10 h-10 bg-white/15 hover:bg-white/25 transition-colors rounded-2xl flex items-center justify-center border border-white/20"><LogOut className="w-4 h-4 text-white" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Estado del turno */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400 font-semibold">Estado del turno</div>
                <div className={`text-xl font-extrabold ${onDuty ? "text-emerald-600" : "text-gray-400"}`}>{onDuty ? "En Ruta" : "En Descanso"}</div>
              </div>
              <button onClick={() => setOnDuty(v => !v)}
                className={`w-16 h-9 rounded-full flex items-center px-1 transition-colors ${onDuty ? "bg-emerald-500 justify-end" : "bg-gray-300 justify-start"}`}>
                <span className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow"><Power className={`w-3.5 h-3.5 ${onDuty ? "text-emerald-600" : "text-gray-400"}`} /></span>
              </button>
            </div>
          </div>

          {/* Unidad y ruta */}
          <div className="rounded-2xl p-4 text-white" style={{ background: route?.color ?? "#0E7490" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5"><Bus className="w-6 h-6" /><div><div className="font-extrabold text-base">{myBus.id} · {route?.shortName}</div><div className="text-white/80 text-xs font-mono">{myBus.plate}</div></div></div>
              <div className="text-right"><div className="text-white/80 text-[10px]">Próxima salida</div><div className="font-extrabold text-lg">{next ? next.time : "—"}</div></div>
            </div>
          </div>

          {/* Aforo automático por sensores */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-[#1C2B3A] text-sm flex items-center gap-1.5"><Gauge className="w-4 h-4 text-[#0E7490]" />Aforo automático</h3>
              <OccupancyBadge level={myBus.occupancy} />
            </div>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-4xl font-extrabold text-[#1C2B3A] leading-none">{myBus.passengers}</span>
              <span className="text-sm font-bold text-gray-400 mb-0.5">/ {myBus.capacity} pasajeros</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: ocColors[myBus.occupancy] }} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-50 rounded-lg py-2 text-center"><div className="text-[10px] text-emerald-600 font-semibold">Subidas hoy</div><div className="font-extrabold text-emerald-700">+128</div></div>
              <div className="bg-blue-50 rounded-lg py-2 text-center"><div className="text-[10px] text-blue-600 font-semibold">Bajadas hoy</div><div className="font-extrabold text-blue-700">−116</div></div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2.5 flex items-center gap-1"><Satellite className="w-3 h-3" />Conteo por sensores infrarrojos · sin registro manual</p>
          </div>

          {/* Recorrido de hoy */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <h3 className="font-extrabold text-[#1C2B3A] text-sm mb-3">Salidas de hoy</h3>
            <div className="space-y-2">
              {times.map((t, i) => {
                const state = i < doneCount ? "done" : i === doneCount ? "now" : "next";
                return (
                  <div key={t} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${state === "done" ? "bg-emerald-100" : state === "now" ? "bg-teal-100" : "bg-gray-100"}`}>
                      {state === "done" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : state === "now" ? <Navigation className="w-3.5 h-3.5 text-teal-600" /> : <Clock className="w-3.5 h-3.5 text-gray-400" />}
                    </div>
                    <span className={`text-sm font-bold ${state === "next" ? "text-gray-400" : "text-[#1C2B3A]"}`}>{t}</span>
                    {state === "now" && <span className="ml-auto text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">En curso</span>}
                    {state === "done" && <span className="ml-auto text-[10px] text-gray-400">Completada</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-teal-50 border border-teal-100 rounded-2xl p-3 flex items-center gap-2.5">
            <Satellite className="w-5 h-5 text-teal-600 shrink-0" />
            <p className="text-xs text-teal-800 font-semibold">GPS dedicado activo. Tu posición y aforo se reportan solos: enfócate en conducir.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EMPRENDEDOR DASHBOARD ────────────────────────────────────

function EmprendedorDashboard({ onLogout }: { onLogout: () => void }) {
  const [campaigns, setCampaigns] = useState<Ad[]>(seedAds);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ business: "", title: "", desc: "", category: "Comida" as Ad["category"], cta: "Ver más" });

  const toggle = (id: string) => setCampaigns(cs => cs.map(c => c.id === id ? { ...c, active: !c.active } : c));
  const totalImpr = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const ctr = totalImpr > 0 ? (totalClicks / totalImpr * 100) : 0;
  const activeCount = campaigns.filter(c => c.active).length;

  const createCampaign = () => {
    if (!form.business || !form.title) return;
    setCampaigns(cs => [{
      id: `AD${Date.now()}`, business: form.business, owner: "Tú", title: form.title, desc: form.desc,
      category: form.category, color: adCategoryColor[form.category], emoji: "🏷️", cta: form.cta,
      impressions: 0, clicks: 0, active: true,
    }, ...cs]);
    setForm({ business: "", title: "", desc: "", category: "Comida", cta: "Ver más" });
    setShowForm(false);
  };

  const kpis = [
    { label: "Impresiones", value: totalImpr.toLocaleString(), icon: <Eye className="w-4 h-4" />, color: "#B45309", bg: "#FEF3C7" },
    { label: "Clics", value: totalClicks.toLocaleString(), icon: <MousePointerClick className="w-4 h-4" />, color: "#1D4ED8", bg: "#DBEAFE" },
    { label: "CTR promedio", value: `${ctr.toFixed(1)}%`, icon: <TrendingUp className="w-4 h-4" />, color: "#059669", bg: "#D1FAE5" },
    { label: "Campañas activas", value: String(activeCount), icon: <Megaphone className="w-4 h-4" />, color: "#7C3AED", bg: "#EDE9FE" },
  ];

  return (
    <div className="flex h-screen bg-[#F0F4FA]" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <aside className="w-56 bg-[#1C1206] flex flex-col shrink-0">
        <div className="p-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#B45309] rounded-lg flex items-center justify-center shrink-0"><Store className="w-4 h-4 text-white" /></div>
            <div><div className="text-white font-extrabold text-sm tracking-tight">PoliBus</div><div className="text-amber-400/80 text-[9px]">Portal Emprendedor</div></div>
          </div>
        </div>
        <nav className="flex-1 p-2.5 space-y-0.5">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-[#B45309] text-white"><Megaphone className="w-4 h-4" />Mis Campañas</div>
        </nav>
        <div className="p-2.5 border-t border-white/[0.07]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-[#B45309] rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0">EM</div>
            <div className="min-w-0"><div className="text-white text-[10px] font-bold truncate">Negocio Politécnico</div><div className="text-amber-400/70 text-[9px]">Anunciante</div></div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-1.5 text-amber-200/80 hover:text-white text-[10px] py-1 transition-colors"><LogOut className="w-3 h-3" />Cerrar sesión</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-extrabold text-[#1C2B3A] text-base">Mis Campañas</h1>
            <p className="text-muted-foreground text-xs">Llega a la comunidad politécnica en el momento de su traslado</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs text-white font-bold bg-[#B45309] hover:bg-[#92400E] rounded-lg px-3.5 py-2 transition-colors"><Plus className="w-4 h-4" />Crear anuncio</button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="bg-white rounded-xl p-4 border border-border flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: k.bg, color: k.color }}>{k.icon}</div>
                <div><div className="font-extrabold text-2xl text-[#1C2B3A]">{k.value}</div><div className="text-muted-foreground text-xs">{k.label}</div></div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-extrabold text-[#1C2B3A] text-sm">Campañas</h2>
              <span className="text-xs text-muted-foreground">{campaigns.length} en total</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {campaigns.map(c => {
                const cctr = c.impressions > 0 ? (c.clicks / c.impressions * 100).toFixed(1) : "0.0";
                return (
                  <div key={c.id} className={`rounded-xl border p-3.5 transition-all ${c.active ? "border-gray-200 bg-white" : "border-gray-100 bg-[#F8FAFD] opacity-70"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${c.color}18` }}>{c.emoji}</div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-[#1C2B3A] text-sm truncate">{c.title}</div>
                          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: c.color }}>{c.business}</div>
                        </div>
                      </div>
                      <button onClick={() => toggle(c.id)} title={c.active ? "Pausar" : "Activar"}
                        className={`w-11 h-6 rounded-full flex items-center px-0.5 shrink-0 transition-colors ${c.active ? "bg-emerald-500 justify-end" : "bg-gray-300 justify-start"}`}>
                        <span className="w-5 h-5 bg-white rounded-full shadow" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{c.desc}</p>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-[#F7F9FC] rounded-lg py-1.5"><div className="text-[9px] text-gray-400">Impr.</div><div className="text-xs font-extrabold text-[#1C2B3A]">{c.impressions.toLocaleString()}</div></div>
                      <div className="bg-[#F7F9FC] rounded-lg py-1.5"><div className="text-[9px] text-gray-400">Clics</div><div className="text-xs font-extrabold text-[#1C2B3A]">{c.clicks.toLocaleString()}</div></div>
                      <div className="bg-[#F7F9FC] rounded-lg py-1.5"><div className="text-[9px] text-gray-400">CTR</div><div className="text-xs font-extrabold text-[#1C2B3A]">{cctr}%</div></div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${c.color}18`, color: c.color }}>{c.category}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${c.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{c.active ? "Activa" : "Pausada"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <Megaphone className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <strong>Publicidad hipersegmentada.</strong> Tus anuncios se muestran a estudiantes durante su traslado, a tarifas accesibles para negocios politécnicos. Modelo B2C que sostiene la app gratuita para el estudiante.
            </div>
          </div>
        </div>
      </div>

      {/* Modal crear anuncio */}
      {showForm && (
        <div className="fixed inset-0 z-[3000] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-extrabold text-[#1C2B3A]">Crear anuncio</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-bold text-[#1C2B3A] block mb-1.5">Nombre del negocio</label>
                <input value={form.business} onChange={e => setForm({ ...form, business: e.target.value })} placeholder="p. ej. Cafetería Central" className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-[#F8FAFD] focus:outline-none focus:ring-2 focus:ring-[#B45309]/20" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#1C2B3A] block mb-1.5">Título de la oferta</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="p. ej. 2x1 en café" className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-[#F8FAFD] focus:outline-none focus:ring-2 focus:ring-[#B45309]/20" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#1C2B3A] block mb-1.5">Descripción</label>
                <textarea rows={3} value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} placeholder="Detalle de la promoción..." className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-[#F8FAFD] resize-none focus:outline-none focus:ring-2 focus:ring-[#B45309]/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#1C2B3A] block mb-1.5">Categoría</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as Ad["category"] })} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-[#F8FAFD] focus:outline-none">
                    {(Object.keys(adCategoryColor) as Ad["category"][]).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#1C2B3A] block mb-1.5">Texto del botón</label>
                  <input value={form.cta} onChange={e => setForm({ ...form, cta: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-[#F8FAFD] focus:outline-none focus:ring-2 focus:ring-[#B45309]/20" />
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border bg-[#F8FAFD] flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-bold text-gray-600 rounded-lg hover:bg-gray-100">Cancelar</button>
              <button onClick={createCampaign} disabled={!form.business || !form.title} className="px-4 py-2 bg-[#B45309] text-white text-xs font-bold rounded-lg hover:bg-[#92400E] disabled:opacity-40 transition-colors">Publicar anuncio</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  if (!role) return <LoginScreen onSelectRole={setRole} />;
  if (role === "student") return <StudentApp onLogout={() => setRole(null)} />;
  if (role === "conductor") return <ConductorApp onLogout={() => setRole(null)} />;
  if (role === "sedarey") return <SedareyDashboard onLogout={() => setRole(null)} />;
  if (role === "emprendedor") return <EmprendedorDashboard onLogout={() => setRole(null)} />;
  return <EspolDashboard onLogout={() => setRole(null)} />;
}

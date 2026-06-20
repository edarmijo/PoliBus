// Publicidad in-app — negocios politécnicos locales (modelo B2C).
// El "quinto actor": emprendedor universitario. Estos anuncios se muestran al
// estudiante durante su traslado y son gestionados desde el portal de emprendedor.
// MIGRACIÓN: reemplazar por la tabla de campañas de tu base de datos / API.

export type AdCategory = "Comida" | "Servicios" | "Tecnología" | "Librería" | "Bienestar";

export interface Ad {
  id: string;
  business: string;     // negocio anunciante
  owner: string;        // emprendedor
  title: string;        // gancho
  desc: string;         // detalle de la oferta
  category: AdCategory;
  color: string;        // color de acento
  emoji: string;        // ícono visual ligero
  cta: string;          // texto del botón
  impressions: number;
  clicks: number;
  active: boolean;
}

export const ads: Ad[] = [
  { id: "AD1", business: "Cafetería Central", owner: "María José T.", title: "2x1 en café caliente ☕", desc: "Presenta la app antes de tu primer parcial y llévate dos por uno toda la semana.", category: "Comida", color: "#B45309", emoji: "☕", cta: "Ver ubicación", impressions: 4820, clicks: 612, active: true },
  { id: "AD2", business: "Copias & Anillados FIEC", owner: "Jordan P.", title: "Anillado a $1.00", desc: "Imprime tu proyecto de camino a clases. Descuento exclusivo para politécnicos.", category: "Servicios", color: "#1D4ED8", emoji: "🖨️", cta: "Aprovechar", impressions: 3110, clicks: 388, active: true },
  { id: "AD3", business: "Almuerzos Doña Mary", owner: "Mary C.", title: "Almuerzo completo $2.50", desc: "Sopa, segundo y jugo. Pide por la app y recoge sin filas al bajar del bus.", category: "Comida", color: "#059669", emoji: "🍱", cta: "Pedir ahora", impressions: 5640, clicks: 901, active: true },
  { id: "AD4", business: "TechStore Campus", owner: "Kevin A.", title: "Accesorios -20%", desc: "Cargadores, mouse y audífonos. Retiro en el bloque de FIEC.", category: "Tecnología", color: "#7C3AED", emoji: "💻", cta: "Ver catálogo", impressions: 2270, clicks: 254, active: false },
  { id: "AD5", business: "Librería Politécnica", owner: "Andrea S.", title: "Cuadernos desde $0.90", desc: "Todo para el nuevo término. Combos de útiles para estudiantes.", category: "Librería", color: "#DB2777", emoji: "📚", cta: "Ver ofertas", impressions: 1980, clicks: 173, active: true },
  { id: "AD6", business: "Gym FitESPOL", owner: "Luis V.", title: "Mes de prueba gratis 💪", desc: "Entrena cerca del campus. Plan estudiantil con horarios flexibles.", category: "Bienestar", color: "#0891B2", emoji: "💪", cta: "Inscribirme", impressions: 1450, clicks: 121, active: true },
];

export const adCategoryColor: Record<AdCategory, string> = {
  Comida: "#B45309",
  Servicios: "#1D4ED8",
  "Tecnología": "#7C3AED",
  "Librería": "#DB2777",
  Bienestar: "#0891B2",
};

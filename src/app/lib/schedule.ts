// Helpers para los horarios reales de ESPOL (horas fijas o por intervalos).

import type { RouteSchedule } from "../data/routes";

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const toHHMM = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** Lista completa de horas de salida. Para intervalos las expande. */
export function expandTimes(schedule: RouteSchedule): string[] {
  if (schedule.kind === "fixed") return schedule.times;
  const out: string[] = [];
  for (const b of schedule.blocks) {
    for (let t = toMin(b.from); t <= toMin(b.to); t += b.everyMin) {
      out.push(toHHMM(t));
    }
  }
  // dedup (los bloques pueden compartir borde, p.ej. 10:00)
  return Array.from(new Set(out));
}

/** Texto resumido del horario para mostrar en cards. */
export function scheduleSummary(schedule: RouteSchedule): string {
  if (schedule.kind === "interval") {
    return schedule.blocks
      .map(b => `${b.from}–${b.to} c/${b.everyMin} min`)
      .join(" · ");
  }
  const t = schedule.times;
  if (t.length <= 4) return t.join(" · ");
  return `${t.slice(0, 3).join(" · ")} … ${t[t.length - 1]} (${t.length} salidas)`;
}

/** Próxima salida a partir de `now`. Devuelve null si ya no hay más hoy. */
export function nextDeparture(
  schedule: RouteSchedule,
  now: Date = new Date(),
): { time: string; minutesLeft: number } | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const times = expandTimes(schedule).map(toMin).sort((a, b) => a - b);
  const next = times.find(t => t >= nowMin);
  if (next == null) return null;
  return { time: toHHMM(next), minutesLeft: next - nowMin };
}

export function fareLabel(fare: number): string {
  return fare === 0 ? "Gratis" : `$${fare.toFixed(2)}`;
}

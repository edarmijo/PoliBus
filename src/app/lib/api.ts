// Capa de acceso a datos. Si VITE_API_URL está definida, consume tu backend
// (funciones serverless en /api o tu propia API). Si no, cae a la data local
// para que la app siga funcionando en desarrollo sin backend.
//
// Para enchufar tu API: define VITE_API_URL en .env (ver .env.example).

import { routes as localRoutes } from "../data/routes";
import type { EspolRoute } from "../data/routes";
import {
  buses as localBuses,
  feedbackItems as localFeedback,
} from "../data/mock";
import type { BusData, FeedbackItem } from "../data/mock";

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function getJSON<T>(path: string, fallback: T): Promise<T> {
  if (!API_URL) return fallback;
  try {
    const res = await fetch(`${API_URL}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[api] ${path} falló, usando data local:`, err);
    return fallback;
  }
}

export const fetchRoutes = (): Promise<EspolRoute[]> =>
  getJSON("/api/routes", localRoutes);

export const fetchBuses = (): Promise<BusData[]> =>
  getJSON("/api/buses", localBuses);

export const fetchFeedback = (): Promise<FeedbackItem[]> =>
  getJSON("/api/feedback", localFeedback);

export async function postFeedback(
  body: Pick<FeedbackItem, "route" | "rating" | "comment">,
): Promise<{ ok: boolean }> {
  if (!API_URL) return { ok: true }; // demo sin backend
  try {
    const res = await fetch(`${API_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok };
  } catch (err) {
    console.warn("[api] postFeedback falló:", err);
    return { ok: false };
  }
}

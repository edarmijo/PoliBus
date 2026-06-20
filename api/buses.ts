// Vercel Serverless Function — GET /api/buses
// Hoy devuelve la data local. Para GPS en vivo, reemplaza por tu fuente real.

import { buses } from "../src/app/data/mock";

export default function handler(_req: any, res: any) {
  // TODO: conecta tu sistema de rastreo GPS / API aquí y reemplaza `buses`.
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(buses);
}

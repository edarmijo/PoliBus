// Vercel Serverless Function — GET /api/routes
// Hoy devuelve la data local. Reemplaza el cuerpo por tu consulta a la BD / API.

import { routes } from "../src/app/data/routes";

export default function handler(_req: any, res: any) {
  // TODO: conecta tu base de datos / API aquí y reemplaza `routes`.
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
  res.status(200).json(routes);
}

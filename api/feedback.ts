// Vercel Serverless Function — GET/POST /api/feedback
// GET: lista el feedback. POST: recibe un nuevo feedback del estudiante.

import { feedbackItems } from "../src/app/data/mock";

export default function handler(req: any, res: any) {
  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
    // TODO: persiste `body` en tu base de datos (route, rating, comment, etc.).
    console.log("[feedback] nuevo:", body);
    res.status(201).json({ ok: true, received: body });
    return;
  }
  // TODO: reemplaza por tu consulta a la BD.
  res.status(200).json(feedbackItems);
}

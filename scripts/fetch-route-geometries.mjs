// Precalcula la geometría real (que sigue las calles) de cada ruta usando un
// servicio de ruteo OSRM, y la cachea en src/app/data/route-geometries.json.
//
// 100% gratis y sin API key: por defecto usa el servidor público de OSRM
// (https://router.project-osrm.org). Como el resultado se commitea, la app NO
// depende de la red en runtime.
//
// Uso:
//   node scripts/fetch-route-geometries.mjs
//   ROUTING_URL=https://tu-osrm node scripts/fetch-route-geometries.mjs
//
// Fallback gratis sin key si OSRM falla: Valhalla de FOSSGIS
//   ROUTING_URL=https://valhalla1.openstreetmap.de  (requiere ajustar el endpoint)

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../src/app/data");
const WAYPOINTS_FILE = resolve(DATA_DIR, "route-waypoints.json");
const OUT_FILE = resolve(DATA_DIR, "route-geometries.json");

const ROUTING_URL = process.env.ROUTING_URL || "https://router.project-osrm.org";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Llama a OSRM y devuelve [[lat,lng], ...] siguiendo las calles. */
async function fetchOsrm(waypoints) {
  // OSRM espera "lng,lat;lng,lat;..."
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `${ROUTING_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== "Ok" || !json.routes?.length) {
    throw new Error(`OSRM code=${json.code}`);
  }
  // GeoJSON viene como [lng,lat] -> convertir a [lat,lng]
  return json.routes[0].geometry.coordinates.map(([lng, lat]) => [
    Number(lat.toFixed(6)),
    Number(lng.toFixed(6)),
  ]);
}

async function main() {
  const waypoints = JSON.parse(await readFile(WAYPOINTS_FILE, "utf8"));
  const out = {};
  let ok = 0;
  let failed = 0;

  for (const [id, pts] of Object.entries(waypoints)) {
    try {
      const geom = await fetchOsrm(pts);
      out[id] = geom;
      ok++;
      console.log(`✓ ruta ${id}: ${geom.length} puntos`);
    } catch (err) {
      // Fallback seguro: dejar los waypoints (línea recta) para esta ruta.
      out[id] = pts;
      failed++;
      console.warn(`✗ ruta ${id}: ${err.message} — usando waypoints (línea recta)`);
    }
    await sleep(400); // cortesía con el servidor público
  }

  await writeFile(OUT_FILE, JSON.stringify(out, null, 0) + "\n", "utf8");
  console.log(`\nListo: ${ok} con geometría real, ${failed} con fallback.`);
  console.log(`Guardado en ${OUT_FILE}`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});

// GET /api/promociones → promociones activas hoy (según las fechas puestas en el panel)
import { json, leerPromos, promoVigente, hoyColombia } from "../../lib/comun.js";

export async function onRequestGet({ env }) {
  if (!env.TIENDA) return json(500, { error: "Falta enlazar el almacén KV llamado TIENDA" });
  const hoy = hoyColombia();
  const l = (await leerPromos(env)).filter(p => promoVigente(p, hoy));
  return json(200, l, { "Cache-Control": "public, max-age=60" });
}

// GET /api/banners → diapositivas activas del carrusel de la portada
import { json, leerBanners } from "../../lib/comun.js";

export async function onRequestGet({ env }) {
  if (!env.TIENDA) return json(500, { error: "Falta enlazar el almacén KV llamado TIENDA" });
  const l = (await leerBanners(env)).filter(b => b.activo !== false);
  return json(200, l, { "Cache-Control": "public, max-age=30" });
}

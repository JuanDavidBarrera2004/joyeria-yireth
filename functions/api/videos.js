// GET /api/videos → videos visibles en la página
import { json, leerVideos } from "../../lib/comun.js";

export async function onRequestGet({ env }) {
  if (!env.TIENDA) return json(500, { error: "Falta enlazar el almacén KV llamado TIENDA" });
  const l = (await leerVideos(env)).filter(v => v.activo !== false)
    .map(({ id, titulo, tipo, poster, vertical }) => ({ id, titulo, tipo, poster, vertical, src: "/api/video?id=" + id }));
  return json(200, l, { "Cache-Control": "public, max-age=30" });
}

// GET /api/productos → productos visibles   ·   GET /api/productos?id=xxx → uno solo
import { json, leerProductos } from "../../lib/comun.js";

export async function onRequestGet({ env, request }) {
  if (!env.TIENDA) return json(500, { error: "Falta enlazar el almacén KV llamado TIENDA" });
  const id = new URL(request.url).searchParams.get("id");
  const lista = (await leerProductos(env)).filter(p => p.activo !== false);
  if (id) {
    const p = lista.find(x => x.id === id);
    return p ? json(200, p, { "Cache-Control": "public, max-age=30" }) : json(404, { error: "No encontrado" });
  }
  return json(200, lista, { "Cache-Control": "public, max-age=30" });
}

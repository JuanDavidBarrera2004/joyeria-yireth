// POST /api/video-subir?id=vid-xxx&n=0 → guarda una parte del video (cuerpo binario).
// Encabezado X-Clave con la contraseña del panel.
import { json, claveCorrecta, idVideoOk, PARTE_VIDEO, MAX_VIDEO } from "../../lib/comun.js";

export async function onRequestPost({ env, request }) {
  if (!env.TIENDA) return json(500, { error: "Falta enlazar el almacén KV llamado TIENDA" });
  if (!(await claveCorrecta(env, request.headers.get("X-Clave") || ""))) return json(401, { error: "Contraseña incorrecta" });
  const u = new URL(request.url);
  const id = u.searchParams.get("id"), n = Number(u.searchParams.get("n"));
  if (!idVideoOk(id) || !Number.isInteger(n) || n < 0 || n >= Math.ceil(MAX_VIDEO / PARTE_VIDEO)) return json(400, { error: "Parte inválida" });
  const datos = await request.arrayBuffer();
  if (!datos.byteLength || datos.byteLength > PARTE_VIDEO) return json(400, { error: "Tamaño de parte inválido" });
  await env.TIENDA.put(`${id}:${n}`, datos);
  return json(200, { ok: true });
}

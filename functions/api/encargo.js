// POST /api/encargo → el cliente pide una joya exclusiva con fotos de referencia.
// Guarda las fotos (se ven en /api/imagen?id=...) y la solicitud para el panel (pestaña Encargos),
// y devuelve el enlace de WhatsApp con el mensaje y los enlaces de las fotos.
import { json, leerAjustes, limpiarTexto as txt, aleatorio } from "../../lib/comun.js";
import { MATERIALES, COLORES } from "../../lib/datos.js";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];

export async function onRequestPost({ env, request }) {
  if (!env.TIENDA) return json(500, { error: "Falta enlazar el almacén KV llamado TIENDA" });
  let d;
  try { d = await request.json(); } catch { return json(400, { error: "Solicitud inválida" }); }
  if (d.web) return json(200, { ok: true });             // campo trampa para robots

  const e = {
    nombre: txt(d.nombre, 60),
    celular: txt(d.celular, 15).replace(/[^\d]/g, "").replace(/^57(?=\d{10}$)/, ""),
    joya: txt(d.joya, 40),
    oro: MATERIALES.includes(d.oro) ? d.oro : "",
    color: Object.keys(COLORES).includes(d.color) ? d.color : "",
    idea: txt(d.idea, 800),
  };
  if (!e.nombre || e.celular.length !== 10) return json(400, { error: "Escribe tu nombre y un celular de 10 dígitos." });
  const fotosIn = Array.isArray(d.fotos) ? d.fotos.slice(0, 3) : [];
  if (!e.idea && !fotosIn.length) return json(400, { error: "Cuéntanos tu idea o sube al menos una foto." });

  // límite simple: máximo 5 solicitudes por celular al día
  const hoy = new Date().toISOString().slice(0, 10), llaveLim = `lim-enc:${e.celular}:${hoy}`;
  const usados = +(await env.TIENDA.get(llaveLim)) || 0;
  if (usados >= 5) return json(429, { error: "Ya recibimos varias solicitudes tuyas hoy. Escríbenos directo por WhatsApp." });

  const origen = new URL(request.url).origin, fotos = [];
  for (const f of fotosIn) {
    if (!f || !TIPOS.includes(f.tipo) || typeof f.base64 !== "string") return json(400, { error: "Formato de foto no permitido" });
    const bin = Uint8Array.from(atob(f.base64), c => c.charCodeAt(0));
    if (bin.length > 2.5 * 1024 * 1024) return json(400, { error: "Una foto es muy pesada (máx. 2,5 MB)" });
    const id = "img-" + aleatorio(20);
    await env.TIENDA.put(id, bin, { metadata: { tipo: f.tipo } });
    fotos.push("/api/imagen?id=" + id);
  }

  const enc = { id: "E" + Date.now().toString(36).toUpperCase().slice(-6), fecha: new Date().toISOString(), estado: "nuevo", ...e, fotos };
  const lista = (await env.TIENDA.get("encargos", { type: "json" })) || [];
  lista.unshift(enc);
  await env.TIENDA.put("encargos", JSON.stringify(lista.slice(0, 300)));
  await env.TIENDA.put(llaveLim, String(usados + 1), { expirationTtl: 90000 });

  const aj = await leerAjustes(env);
  const msg = [
    `¡Hola Joyería Yireth! Quiero una joya exclusiva (solicitud ${enc.id}).`,
    `Nombre: ${e.nombre}`,
    e.joya && `Joya: ${e.joya}`,
    (e.oro || e.color) && `Oro: ${[e.oro, e.color && "color " + e.color.toLowerCase()].filter(Boolean).join(", ")}`,
    e.idea && `Idea: ${e.idea}`,
    fotos.length && `Fotos de referencia:\n${fotos.map(u => origen + u).join("\n")}`,
  ].filter(Boolean).join("\n");
  return json(200, { ok: true, id: enc.id, url: `https://wa.me/${aj.whatsapp}?text=${encodeURIComponent(msg)}` });
}

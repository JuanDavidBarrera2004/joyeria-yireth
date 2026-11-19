// GET /api/video?id=vid-xxx → reproduce un video guardado por partes en KV.
// Soporta "Range" (lo necesitan Safari/iPhone y la barra de avance del reproductor).
import { leerVideos, idVideoOk, PARTE_VIDEO } from "../../lib/comun.js";

export async function onRequestGet({ env, request }) {
  const id = new URL(request.url).searchParams.get("id");
  if (!env.TIENDA || !idVideoOk(id)) return new Response("No encontrado", { status: 404 });
  const v = (await leerVideos(env)).find(x => x.id === id);
  if (!v) return new Response("No encontrado", { status: 404 });

  const total = v.tam;
  const base = { "Content-Type": v.tipo, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("Range") || "");

  if (m && (m[1] || m[2])) {
    let ini = m[1] ? +m[1] : Math.max(0, total - +m[2]);
    let fin = m[1] && m[2] ? Math.min(+m[2], total - 1) : total - 1;
    if (ini >= total || ini > fin) return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${total}` } });
    // Se responde con máximo 2 partes seguidas (el navegador pide el resto después).
    const n = Math.floor(ini / PARTE_VIDEO);
    const m2 = Math.min(Math.floor(fin / PARTE_VIDEO), n + (fin - ini < PARTE_VIDEO ? 1 : 0));
    fin = Math.min(fin, (m2 + 1) * PARTE_VIDEO - 1);
    const partes = await Promise.all(Array.from({ length: m2 - n + 1 }, (_, k) => env.TIENDA.get(`${id}:${n + k}`, { type: "arrayBuffer", cacheTtl: 3600 })));
    if (partes.some(x => !x)) return new Response("No encontrado", { status: 404 });
    const unido = partes.length === 1 ? new Uint8Array(partes[0]) : new Uint8Array(partes.reduce((t, x) => t + x.byteLength, 0));
    if (partes.length > 1) { let o = 0; for (const x of partes) { unido.set(new Uint8Array(x), o); o += x.byteLength; } }
    const trozo = unido.slice(ini - n * PARTE_VIDEO, fin - n * PARTE_VIDEO + 1);
    return new Response(trozo, { status: 206, headers: { ...base, "Content-Range": `bytes ${ini}-${fin}/${total}`, "Content-Length": String(trozo.byteLength) } });
  }

  // Sin Range: se envía completo, parte por parte.
  let n = 0;
  const flujo = new ReadableStream({
    async pull(c) {
      if (n >= v.partes) return c.close();
      const parte = await env.TIENDA.get(`${id}:${n++}`, { type: "arrayBuffer", cacheTtl: 3600 });
      if (!parte) return c.error(new Error("Falta una parte"));
      c.enqueue(new Uint8Array(parte));
    },
  });
  return new Response(flujo, { headers: { ...base, "Content-Length": String(total) } });
}

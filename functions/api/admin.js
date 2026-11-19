// POST /api/admin → acciones del panel (requiere ADMIN_PASSWORD)
import {
  json, leerProductos, guardarProductos, limpiarProducto, claveCorrecta,
  leerAjustes, limpiarAjustes, leerPedido, guardarPedido, aleatorio, leerBanners, limpiarBanner,
  leerVideos, limpiarVideo, idVideoOk, PARTE_VIDEO, MAX_VIDEO,
} from "../../lib/comun.js";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const ESTADOS = ["pendiente", "pagado", "enviado", "entregado", "cancelado", "rechazado"];

export async function onRequestPost({ env, request }) {
  if (!env.TIENDA) return json(500, { error: "Falta enlazar el almacén KV llamado TIENDA" });
  if (!env.ADMIN_PASSWORD) return json(500, { error: "Falta configurar ADMIN_PASSWORD en Cloudflare" });
  let d;
  try { d = await request.json(); } catch { return json(400, { error: "Solicitud inválida" }); }
  if (!(await claveCorrecta(env, d.clave))) return json(401, { error: "Contraseña incorrecta" });

  switch (d.accion) {
    case "listar":
      return json(200, await leerProductos(env));

    case "guardar": {
      const prod = limpiarProducto(d.producto);
      if (!prod) return json(400, { error: "Revisa el nombre y el precio" });
      const lista = await leerProductos(env);
      const i = lista.findIndex(p => p.id === prod.id);
      if (i >= 0) lista[i] = prod; else lista.push(prod);
      await guardarProductos(env, lista);
      return json(200, { ok: true, producto: prod });
    }

    case "eliminar": {
      const lista = (await leerProductos(env)).filter(p => p.id !== d.id);
      await guardarProductos(env, lista);
      return json(200, { ok: true });
    }

    case "foto": {
      if (!TIPOS.includes(d.tipo) || typeof d.base64 !== "string") return json(400, { error: "Formato no permitido" });
      const bin = Uint8Array.from(atob(d.base64), c => c.charCodeAt(0));
      if (bin.length > 2.5 * 1024 * 1024) return json(400, { error: "La foto es muy pesada (máx. 2,5 MB)" });
      const id = "img-" + aleatorio(20);
      await env.TIENDA.put(id, bin, { metadata: { tipo: d.tipo } });
      return json(200, { url: "/api/imagen?id=" + id });
    }

    case "banners":
      return json(200, await leerBanners(env));

    case "guardar-banners": {
      const lista = (Array.isArray(d.banners) ? d.banners : []).slice(0, 10).map(limpiarBanner).filter(Boolean);
      await env.TIENDA.put("banners", JSON.stringify(lista));
      return json(200, { ok: true, banners: lista });
    }

    case "videos":
      return json(200, await leerVideos(env));

    case "nuevo-video": {
      const tam = Number(d.tam) || 0;
      if (!tam || tam > MAX_VIDEO) return json(400, { error: "El video pesa más de 120 MB. Recórtalo o comprímelo antes de subirlo." });
      return json(200, { id: "vid-" + aleatorio(16), parte: PARTE_VIDEO });
    }

    case "guardar-video": {
      const v = limpiarVideo(d.video);
      if (!v) return json(400, { error: "Datos del video inválidos" });
      const ultima = await env.TIENDA.get(`${v.id}:${v.partes - 1}`, { type: "arrayBuffer" });
      if (!ultima) return json(400, { error: "El video no terminó de subir. Inténtalo de nuevo." });
      const lista = await leerVideos(env);
      const i = lista.findIndex(x => x.id === v.id);
      if (i >= 0) lista[i] = v; else lista.unshift(v);
      await env.TIENDA.put("videos", JSON.stringify(lista.slice(0, 30)));
      return json(200, { ok: true, video: v });
    }

    case "ordenar-videos": {
      const actual = await leerVideos(env);
      const cambios = new Map((Array.isArray(d.videos) ? d.videos : []).map(v => [v.id, v]));
      const ids = (Array.isArray(d.videos) ? d.videos : []).map(v => v.id);
      const lista = ids.map(id => actual.find(v => v.id === id)).filter(Boolean)
        .concat(actual.filter(v => !ids.includes(v.id)))
        .map(v => limpiarVideo({ ...v, ...(cambios.has(v.id) ? { titulo: cambios.get(v.id).titulo, activo: cambios.get(v.id).activo } : {}) })).filter(Boolean);
      await env.TIENDA.put("videos", JSON.stringify(lista));
      return json(200, { ok: true, videos: lista });
    }

    case "eliminar-video": {
      if (!idVideoOk(d.id)) return json(400, { error: "Video inválido" });
      const lista = await leerVideos(env);
      const v = lista.find(x => x.id === d.id);
      await env.TIENDA.put("videos", JSON.stringify(lista.filter(x => x.id !== d.id)));
      const partes = v?.partes || Math.ceil(MAX_VIDEO / PARTE_VIDEO);
      await Promise.all(Array.from({ length: partes }, (_, n) => env.TIENDA.delete(`${d.id}:${n}`)));
      if (v?.poster?.startsWith("/api/imagen?id=")) await env.TIENDA.delete(v.poster.split("id=")[1]);
      return json(200, { ok: true });
    }

    case "encargos":
      return json(200, (await env.TIENDA.get("encargos", { type: "json" })) || []);

    case "estado-encargo": {
      const lista = (await env.TIENDA.get("encargos", { type: "json" })) || [];
      const e = lista.find(x => x.id === d.id);
      if (!e) return json(404, { error: "Solicitud no encontrada" });
      if (!["nuevo", "en proceso", "terminado"].includes(d.estado)) return json(400, { error: "Estado inválido" });
      e.estado = d.estado;
      await env.TIENDA.put("encargos", JSON.stringify(lista));
      return json(200, { ok: true });
    }

    case "eliminar-encargos": {
      const ids = new Set((Array.isArray(d.ids) ? d.ids : []).map(String));
      const lista = (await env.TIENDA.get("encargos", { type: "json" })) || [];
      const fotos = lista.filter(x => ids.has(x.id)).flatMap(x => x.fotos || []);
      for (let i = 0; i < fotos.length; i += 20) await Promise.all(fotos.slice(i, i + 20).map(u => env.TIENDA.delete(u.split("id=")[1])));
      await env.TIENDA.put("encargos", JSON.stringify(lista.filter(x => !ids.has(x.id))));
      return json(200, { ok: true, borrados: lista.length - lista.filter(x => !ids.has(x.id)).length });
    }

    case "eliminar-pedidos": {
      const ids = [...new Set((Array.isArray(d.ids) ? d.ids : []).map(String))];
      const idx = (await env.TIENDA.get("pedidos", { type: "json" })) || [];
      for (let i = 0; i < ids.length; i += 20) await Promise.all(ids.slice(i, i + 20).map(id => env.TIENDA.delete("pedido:" + id)));
      const quedan = idx.filter(x => !ids.includes(x.id));
      await env.TIENDA.put("pedidos", JSON.stringify(quedan));
      return json(200, { ok: true, borrados: idx.length - quedan.length });
    }

    case "ajustes":
      return json(200, await leerAjustes(env));

    case "guardar-ajustes": {
      const a = limpiarAjustes(d.ajustes);
      await env.TIENDA.put("ajustes", JSON.stringify(a));
      return json(200, { ok: true, ajustes: a });
    }

    case "pedidos":
      return json(200, (await env.TIENDA.get("pedidos", { type: "json" })) || []);

    case "pedido": {
      const p = await leerPedido(env, String(d.id || ""));
      return p ? json(200, p) : json(404, { error: "Pedido no encontrado" });
    }

    case "estado-pedido": {
      const p = await leerPedido(env, String(d.id || ""));
      if (!p) return json(404, { error: "Pedido no encontrado" });
      if (!ESTADOS.includes(d.estado)) return json(400, { error: "Estado inválido" });
      p.estado = d.estado;
      await guardarPedido(env, p);
      return json(200, { ok: true });
    }

    default:
      return json(400, { error: "Acción desconocida" });
  }
}

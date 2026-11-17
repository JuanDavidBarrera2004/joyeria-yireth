// POST /api/admin → acciones del panel (requiere ADMIN_PASSWORD)
import {
  json, leerProductos, guardarProductos, limpiarProducto, claveCorrecta,
  leerAjustes, limpiarAjustes, leerPedido, guardarPedido, aleatorio, leerBanners, limpiarBanner,
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

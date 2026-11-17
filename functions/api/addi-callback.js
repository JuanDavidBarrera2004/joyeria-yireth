// POST /api/addi-callback?k=... → Addi informa el resultado del crédito del cliente.
import { leerPedido, guardarPedido, marcarPagado, hmac, igual } from "../../lib/comun.js";

export async function onRequestPost({ env, request }) {
  const raw = await request.text();
  let d = {};
  try { d = JSON.parse(raw); } catch { return new Response("inválido", { status: 400 }); }
  const k = new URL(request.url).searchParams.get("k") || "";
  const esperado = await hmac(env.ADMIN_PASSWORD || "yireth", "addi:" + d.orderId);
  if (!igual(k, esperado)) return new Response("no autorizado", { status: 401 });

  const p = await leerPedido(env, String(d.orderId || ""));
  if (p) {
    if (["APPROVED", "COMPLETED"].includes(d.status)) await marcarPagado(env, p, { via: "addi", solicitud: d.applicationId, estado: d.status });
    else if (["REJECTED", "DECLINED", "ABANDONED"].includes(d.status) && p.estado === "pendiente") {
      p.estado = "rechazado"; p.pago = { via: "addi", solicitud: d.applicationId, estado: d.status }; await guardarPedido(env, p);
    }
  }
  // Addi espera recibir de vuelta el mismo contenido con estado 200
  return new Response(raw, { status: 200, headers: { "Content-Type": "application/json" } });
}

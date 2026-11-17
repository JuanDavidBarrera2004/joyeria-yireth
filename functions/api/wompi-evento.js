// POST /api/wompi-evento → Wompi avisa aquí cuando una transacción cambia de estado.
// En Wompi (Desarrolladores → URL de eventos) pon: https://TU-DOMINIO/api/wompi-evento
import { json, leerPedido, guardarPedido, marcarPagado, sha256, igual } from "../../lib/comun.js";

export async function onRequestPost({ env, request }) {
  if (!env.WOMPI_EVENTS_SECRET) return json(500, { error: "Falta WOMPI_EVENTS_SECRET" });
  let ev;
  try { ev = await request.json(); } catch { return json(400, { error: "inválido" }); }

  // Verificación de la firma de Wompi
  const props = ev?.signature?.properties || [];
  const valor = ruta => ruta.split(".").reduce((o, k) => (o == null ? o : o[k]), ev.data);
  const cadena = props.map(valor).join("") + ev.timestamp + env.WOMPI_EVENTS_SECRET;
  if (!igual((await sha256(cadena)).toLowerCase(), String(ev?.signature?.checksum || "").toLowerCase()))
    return json(401, { error: "firma inválida" });

  const t = ev.data?.transaction;
  if (ev.event !== "transaction.updated" || !t) return json(200, { ok: true });
  const p = await leerPedido(env, t.reference);
  if (!p || t.amount_in_cents !== p.total * 100) return json(200, { ok: true });

  if (t.status === "APPROVED") await marcarPagado(env, p, { via: "wompi", transaccion: t.id, medio: t.payment_method_type });
  else if (["DECLINED", "ERROR", "VOIDED"].includes(t.status) && p.estado === "pendiente") {
    p.estado = "rechazado"; p.pago = { via: "wompi", transaccion: t.id, estado: t.status }; await guardarPedido(env, p);
  }
  return json(200, { ok: true });
}

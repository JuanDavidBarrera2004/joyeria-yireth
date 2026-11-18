// /api/whatsapp → webhook de WhatsApp Cloud API (Meta).
// En Meta for Developers: URL de devolución = https://TU-DOMINIO/api/whatsapp , Token de verificación = WA_VERIFY_TOKEN
import { waListo, prepararDB, firmaValida, procesarMensaje } from "../../lib/whatsapp.js";

// Meta verifica la URL una sola vez
export async function onRequestGet({ env, request }) {
  const q = new URL(request.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && env.WA_VERIFY_TOKEN && q.get("hub.verify_token") === env.WA_VERIFY_TOKEN)
    return new Response(q.get("hub.challenge") || "", { status: 200 });
  return new Response("No autorizado", { status: 403 });
}

// Mensajes entrantes
export async function onRequestPost({ env, request, waitUntil }) {
  const raw = await request.text();
  if (!(await firmaValida(env, raw, request.headers.get("x-hub-signature-256")))) return new Response("firma inválida", { status: 401 });
  if (!waListo(env)) return new Response("ok");
  let d; try { d = JSON.parse(raw); } catch { return new Response("ok"); }
  const sitio = env.SITIO_URL || new URL(request.url).origin;
  const pendientes = [];
  for (const e of d.entry || []) for (const c of e.changes || []) {
    const v = c.value || {};
    if (v.metadata?.phone_number_id && v.metadata.phone_number_id !== env.WA_PHONE_ID) continue;
    const nombres = Object.fromEntries((v.contacts || []).map(k => [k.wa_id, k.profile?.name]));
    for (const m of v.messages || []) pendientes.push([m, nombres[m.from]]);
  }
  if (!pendientes.length) return new Response("ok");
  // se responde a Meta de inmediato y el bot trabaja en segundo plano (en orden)
  waitUntil((async () => {
    await prepararDB(env);
    for (const [m, nombre] of pendientes) await procesarMensaje(env, sitio, m, nombre).catch(err => console.error("bot:", err.message));
  })());
  return new Response("ok");
}

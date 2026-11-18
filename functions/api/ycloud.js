// POST /api/ycloud → eventos de YCloud (mensajes que llegan y mensajes que la dueña envía desde la app)
// En YCloud: Developers → Webhook → Add endpoint → https://TU-DOMINIO/api/ycloud
// Eventos: whatsapp.inbound_message.received y los de mensajes enviados desde la app (echo / smb.message.echoes)
import { hmac } from "../../lib/comun.js";
import { waListo, prepararDB, procesarMensaje, guardarDesdeApp } from "../../lib/whatsapp.js";

const soloNum = n => String(n || "").replace(/[^\d]/g, "");

async function firmaValida(env, raw, cabecera) {
  if (!env.YCLOUD_WEBHOOK_SECRET || !cabecera) return false;
  const partes = Object.fromEntries(String(cabecera).split(",").map(x => x.trim().split("=")));
  if (!partes.t || !partes.s) return false;
  if (Math.abs(Date.now() / 1000 - Number(partes.t)) > 600) return false;
  const esperado = await hmac(env.YCLOUD_WEBHOOK_SECRET, `${partes.t}.${raw}`);
  const s = partes.s.toLowerCase();
  if (s.length !== esperado.length) return false;
  let d = 0; for (let i = 0; i < s.length; i++) d |= s.charCodeAt(i) ^ esperado.charCodeAt(i);
  return d === 0;
}

const textoDe = m => m.text?.body || m.interactive?.list_reply?.title || m.interactive?.button_reply?.title || m.button?.text
  || `[${({ image: "Imagen", audio: "Audio", video: "Video", document: "Documento", sticker: "Sticker", location: "Ubicación", template: "Plantilla" })[m.type] || "Mensaje"}]`;

export async function onRequestPost({ env, request, waitUntil }) {
  const raw = await request.text();
  if (!(await firmaValida(env, raw, request.headers.get("ycloud-signature")))) return new Response("firma inválida", { status: 401 });
  if (!waListo(env)) return new Response("ok");
  let ev; try { ev = JSON.parse(raw); } catch { return new Response("ok"); }
  const sitio = env.SITIO_URL || new URL(request.url).origin;
  const mio = soloNum(env.WA_NUMERO);

  if (ev.type === "whatsapp.inbound_message.received" && ev.whatsappInboundMessage) {
    const w = ev.whatsappInboundMessage;
    if (mio && w.to && soloNum(w.to) !== mio) return new Response("ok");
    // se adapta al mismo formato que usa Meta para reutilizar el bot
    const m = { ...w, from: soloNum(w.from), id: w.wamid || w.id, _ycId: w.id };
    waitUntil((async () => { await prepararDB(env); await procesarMensaje(env, sitio, m, w.customerProfile?.name).catch(e => console.error("bot:", e.message)); })());
  } else if (/echo/.test(ev.type || "")) {
    const w = ev.whatsappMessage || ev.whatsappEchoMessage || ev.whatsappSmbMessageEcho || {};
    const cliente = soloNum(w.to || w.recipient);
    if (cliente && cliente !== mio && !/updated$/.test(ev.type)) {
      waitUntil((async () => { await prepararDB(env); await guardarDesdeApp(env, cliente, textoDe(w), w.wamid || w.id).catch(e => console.error("echo:", e.message)); })());
    }
  }
  return new Response("ok");
}

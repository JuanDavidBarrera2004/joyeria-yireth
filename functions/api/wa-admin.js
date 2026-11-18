// POST /api/wa-admin → bandeja de WhatsApp y promociones del panel (requiere ADMIN_PASSWORD)
import { json, claveCorrecta } from "../../lib/comun.js";
import { waListo, prepararDB, enviar, enviarTexto, ponerModo } from "../../lib/whatsapp.js";

const API = env => `https://graph.facebook.com/${env.WA_API_VERSION || "v23.0"}`;
const H24 = 24 * 3600 * 1000;
const numeroOk = n => /^\d{10,15}$/.test(String(n || ""));

export async function onRequestPost({ env, request }) {
  let d; try { d = await request.json(); } catch { return json(400, { error: "Solicitud inválida" }); }
  if (!(await claveCorrecta(env, d.clave))) return json(401, { error: "Contraseña incorrecta" });

  if (d.accion === "estado") return json(200, {
    token: !!env.WA_TOKEN, telefono: !!env.WA_PHONE_ID, waba: !!env.WA_WABA_ID, verificacion: !!env.WA_VERIFY_TOKEN,
    secreto: !!env.WA_APP_SECRET, baseDatos: !!env.DB, ia: !!env.AI, listo: waListo(env),
  });
  if (!env.DB) return json(400, { error: "Falta conectar la base de datos D1 (nombre DB) en Cloudflare." });
  await prepararDB(env);

  switch (d.accion) {
    case "chats": {
      const r = await env.DB.prepare(`SELECT * FROM chats WHERE ultimo_texto IS NOT NULL ORDER BY actualizado DESC LIMIT 200`).all();
      return json(200, r.results || []);
    }
    case "mensajes": {
      if (!numeroOk(d.numero)) return json(400, { error: "Número inválido" });
      const r = await env.DB.prepare(`SELECT id, dir, autor, texto, ts FROM mensajes WHERE numero = ? ORDER BY ts DESC, id DESC LIMIT 100`).bind(d.numero).all();
      await env.DB.prepare(`UPDATE chats SET no_leidos = 0 WHERE numero = ?`).bind(d.numero).run();
      const chat = await env.DB.prepare(`SELECT * FROM chats WHERE numero = ?`).bind(d.numero).first();
      return json(200, { chat, mensajes: (r.results || []).reverse() });
    }
    case "enviar": {
      if (!waListo(env)) return json(400, { error: "WhatsApp todavía no está conectado." });
      const texto = String(d.texto || "").trim().slice(0, 4000);
      if (!numeroOk(d.numero) || !texto) return json(400, { error: "Escribe un mensaje" });
      const chat = await env.DB.prepare(`SELECT * FROM chats WHERE numero = ?`).bind(d.numero).first();
      if (!chat || Date.now() - chat.ultimo_cliente > H24)
        return json(400, { error: "Pasaron más de 24 horas desde el último mensaje del cliente. WhatsApp solo permite escribirle con una plantilla aprobada (pestaña Promociones)." });
      try { await enviarTexto(env, d.numero, texto, "asesor"); } catch (e) { return json(502, { error: e.message }); }
      await ponerModo(env, d.numero, "humano"); // al escribir el asesor, el bot se calla 12 h
      return json(200, { ok: true });
    }
    case "modo": {
      if (!numeroOk(d.numero) || !["bot", "humano"].includes(d.modo)) return json(400, { error: "Datos inválidos" });
      await ponerModo(env, d.numero, d.modo, 24);
      return json(200, { ok: true });
    }
    case "plantillas": {
      if (!env.WA_WABA_ID || !env.WA_TOKEN) return json(400, { error: "Falta WA_WABA_ID o WA_TOKEN en Cloudflare." });
      const r = await fetch(`${API(env)}/${env.WA_WABA_ID}/message_templates?fields=name,status,language,category,components&limit=100`, { headers: { Authorization: "Bearer " + env.WA_TOKEN } });
      const j = await r.json();
      if (!r.ok) return json(502, { error: j?.error?.message || "Error consultando plantillas" });
      return json(200, (j.data || []).filter(t => t.status === "APPROVED"));
    }
    case "contactos-promo": {
      const r = await env.DB.prepare(`SELECT numero, nombre FROM chats WHERE opt_in = 1 ORDER BY actualizado DESC`).all();
      return json(200, r.results || []);
    }
    case "enviar-promo": {
      // se llama por lotes desde el panel (máx. 25 números por llamada)
      if (!waListo(env)) return json(400, { error: "WhatsApp todavía no está conectado." });
      const nums = (Array.isArray(d.numeros) ? d.numeros : []).filter(numeroOk).slice(0, 25);
      const p = d.plantilla || {};
      if (!/^[a-z0-9_]{1,512}$/.test(p.nombre || "") || !/^[a-z]{2}(_[A-Z]{2})?$/.test(p.idioma || "")) return json(400, { error: "Plantilla inválida" });
      const permitidos = new Set(((await env.DB.prepare(`SELECT numero FROM chats WHERE opt_in = 1`).all()).results || []).map(x => x.numero));
      const resultado = { enviados: 0, fallidos: [] };
      for (const n of nums) {
        if (!permitidos.has(n)) { resultado.fallidos.push({ numero: n, error: "No aceptó promociones" }); continue; }
        const nombre = ((await env.DB.prepare(`SELECT nombre FROM chats WHERE numero = ?`).bind(n).first())?.nombre || "").split(" ")[0] || "cliente";
        const comps = [];
        if (p.imagen && /^https:\/\//.test(p.imagen)) comps.push({ type: "header", parameters: [{ type: "image", image: { link: p.imagen } }] });
        if (p.variables > 0) comps.push({ type: "body", parameters: Array.from({ length: p.variables }, (_, i) => ({ type: "text", text: i === 0 ? nombre : String(p.extra?.[i] || "") })) });
        try {
          await enviar(env, n, { type: "template", template: { name: p.nombre, language: { code: p.idioma }, ...(comps.length ? { components: comps } : {}) } }, "asesor", `[Promoción: ${p.nombre}]`);
          resultado.enviados++;
        } catch (e) { resultado.fallidos.push({ numero: n, error: e.message }); }
      }
      return json(200, resultado);
    }
    default:
      return json(400, { error: "Acción desconocida" });
  }
}

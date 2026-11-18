// Bot de WhatsApp de Joyería Yireth + IA de Cloudflare.
// Funciona de dos formas (se elige sola según las variables que existan en Cloudflare):
//  A) YCloud (recomendado: permite seguir usando la app de WhatsApp Business en el mismo número)
//     Variables: YCLOUD_API_KEY, YCLOUD_WEBHOOK_SECRET, WA_NUMERO (ej. +573185112754)
//  B) Meta directo: WA_TOKEN, WA_PHONE_ID, WA_WABA_ID, WA_VERIFY_TOKEN, WA_APP_SECRET
// Enlaces: base de datos D1 con nombre DB, Workers AI con nombre AI, KV con nombre TIENDA.
import { leerProductos, leerAjustes, hmac, igual } from "./comun.js";

export const usaYCloud = env => !!env.YCLOUD_API_KEY;
export const waListo = env => !!(env.DB && (usaYCloud(env) ? env.WA_NUMERO : (env.WA_TOKEN && env.WA_PHONE_ID)));
const YC = "https://api.ycloud.com/v2";
const e164 = n => "+" + String(n).replace(/[^\d]/g, "");
const API = env => `https://graph.facebook.com/${env.WA_API_VERSION || "v23.0"}`;
const ahora = () => Date.now();
const H24 = 24 * 3600 * 1000;

/* ---------- base de datos (se crea sola la primera vez) ---------- */
let listo = false;
export async function prepararDB(env) {
  if (listo) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS chats (numero TEXT PRIMARY KEY, nombre TEXT, modo TEXT DEFAULT 'bot', humano_hasta INTEGER DEFAULT 0,
      no_leidos INTEGER DEFAULT 0, ultimo_cliente INTEGER DEFAULT 0, actualizado INTEGER DEFAULT 0, ultimo_texto TEXT, opt_in INTEGER DEFAULT 0)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS mensajes (id INTEGER PRIMARY KEY AUTOINCREMENT, numero TEXT, dir TEXT, autor TEXT, texto TEXT, wamid TEXT, ts INTEGER)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_msj ON mensajes(numero, ts)`),
    env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_wamid ON mensajes(wamid) WHERE wamid IS NOT NULL`),
  ]);
  listo = true;
}
export async function guardarEntrante(env, numero, nombre, texto, wamid) {
  try {
    await env.DB.prepare(`INSERT INTO mensajes (numero, dir, autor, texto, wamid, ts) VALUES (?, 'in', 'cliente', ?, ?, ?)`).bind(numero, texto, wamid, ahora()).run();
  } catch (e) { if (String(e.message).includes("UNIQUE")) return false; throw e; } // Meta reenvió el mismo mensaje
  await env.DB.prepare(`INSERT INTO chats (numero, nombre, no_leidos, ultimo_cliente, actualizado, ultimo_texto) VALUES (?, ?, 1, ?, ?, ?)
    ON CONFLICT(numero) DO UPDATE SET nombre = COALESCE(excluded.nombre, chats.nombre), no_leidos = chats.no_leidos + 1,
    ultimo_cliente = excluded.ultimo_cliente, actualizado = excluded.actualizado, ultimo_texto = excluded.ultimo_texto`)
    .bind(numero, nombre || null, ahora(), ahora(), texto.slice(0, 120)).run();
  return true;
}
async function guardarSaliente(env, numero, autor, texto, wamid) {
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO mensajes (numero, dir, autor, texto, wamid, ts) VALUES (?, 'out', ?, ?, ?, ?)`).bind(numero, autor, texto, wamid || null, ahora()),
    env.DB.prepare(`UPDATE chats SET actualizado = ?, ultimo_texto = ? WHERE numero = ?`).bind(ahora(), texto.slice(0, 120), numero),
  ]);
}
export const leerChat = (env, numero) => env.DB.prepare(`SELECT * FROM chats WHERE numero = ?`).bind(numero).first();
export async function historial(env, numero, n = 10) {
  const r = await env.DB.prepare(`SELECT dir, autor, texto, ts FROM mensajes WHERE numero = ? ORDER BY ts DESC, id DESC LIMIT ?`).bind(numero, n).all();
  return (r.results || []).reverse();
}
export const ponerModo = (env, numero, modo, horas = 12) =>
  env.DB.prepare(`UPDATE chats SET modo = ?, humano_hasta = ? WHERE numero = ?`).bind(modo, modo === "humano" ? ahora() + horas * 3600e3 : 0, numero).run();
export const ponerOptIn = (env, numero, v) =>
  env.DB.prepare(`UPDATE chats SET opt_in = ? WHERE numero = ?`).bind(v ? 1 : 0, numero).run();

/* ---------- envío a WhatsApp ---------- */
export async function enviar(env, numero, cuerpo, autor = "bot", textoGuardar = "") {
  let wamid;
  if (usaYCloud(env)) {
    const r = await fetch(`${YC}/whatsapp/messages/sendDirectly`, {
      method: "POST",
      headers: { "X-API-Key": env.YCLOUD_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: e164(env.WA_NUMERO), to: e164(numero), ...cuerpo }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.status === "failed") throw new Error(d?.error?.message || d?.errorMessage || d?.whatsappApiError?.message || "YCloud respondió " + r.status);
    wamid = d.wamid || d.id;
  } else {
    const r = await fetch(`${API(env)}/${env.WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: "Bearer " + env.WA_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: numero, ...cuerpo }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error?.message || "WhatsApp respondió " + r.status);
    wamid = d.messages?.[0]?.id;
  }
  if (textoGuardar !== null) await guardarSaliente(env, numero, autor, textoGuardar || cuerpo.text?.body || "[mensaje]", wamid);
  return { wamid };
}
function marcarLeido(env, m) {
  const p = usaYCloud(env)
    ? (m._ycId ? fetch(`${YC}/whatsapp/inboundMessages/${encodeURIComponent(m._ycId)}/markAsRead`, { method: "POST", headers: { "X-API-Key": env.YCLOUD_API_KEY } }) : null)
    : fetch(`${API(env)}/${env.WA_PHONE_ID}/messages`, { method: "POST", headers: { Authorization: "Bearer " + env.WA_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: m.id }) });
  p?.catch(() => {});
}

// La dueña respondió desde la app de WhatsApp del celular (coexistencia): se guarda y el bot se pausa en ese chat
export async function guardarDesdeApp(env, numero, texto, wamid) {
  try {
    await env.DB.prepare(`INSERT INTO mensajes (numero, dir, autor, texto, wamid, ts) VALUES (?, 'out', 'asesor', ?, ?, ?)`).bind(numero, texto, wamid || null, ahora()).run();
  } catch (e) { if (String(e.message).includes("UNIQUE")) return; throw e; }
  await env.DB.prepare(`INSERT INTO chats (numero, actualizado, ultimo_texto, modo, humano_hasta) VALUES (?, ?, ?, 'humano', ?)
    ON CONFLICT(numero) DO UPDATE SET actualizado = excluded.actualizado, ultimo_texto = excluded.ultimo_texto, modo = 'humano', humano_hasta = excluded.humano_hasta, no_leidos = 0`)
    .bind(numero, ahora(), texto.slice(0, 120), ahora() + 12 * 3600e3).run();
}
export const enviarTexto = (env, numero, texto, autor = "bot") =>
  enviar(env, numero, { type: "text", text: { body: texto.slice(0, 4000), preview_url: true } }, autor, texto);

const corto = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
async function enviarMenu(env, numero, saludo) {
  return enviar(env, numero, {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: corto(saludo, 1000) },
      footer: { text: "También puedes escribir tu pregunta" },
      action: {
        button: "Ver opciones",
        sections: [{
          title: "¿En qué te ayudamos?",
          rows: [
            { id: "catalogo", title: "Ver catálogo", description: "Cadenas, pulseras, aretes, anillos y más" },
            { id: "ofertas", title: "Ofertas", description: "Joyas con descuento" },
            { id: "pagos", title: "Medios de pago y Addi", description: "Tarjeta, PSE, Nequi o a cuotas" },
            { id: "envios", title: "Envíos", description: "Costos y tiempos" },
            { id: "tienda", title: "Horario y dirección", description: "Visítanos en Puerto Boyacá" },
            { id: "compraventa", title: "Compraventa de oro", description: "Vende o cambia tus joyas" },
            { id: "promos", title: "Recibir promociones", description: "Te avisamos de ofertas por aquí" },
            { id: "asesor", title: "Hablar con un asesor", description: "Te atiende una persona" },
          ],
        }],
      },
    },
  }, "bot", "[Menú de opciones]");
}
const enviarBoton = (env, numero, texto, etiqueta, url) =>
  enviar(env, numero, { type: "interactive", interactive: { type: "cta_url", body: { text: corto(texto, 1000) }, action: { name: "cta_url", parameters: { display_text: corto(etiqueta, 20), url } } } }, "bot", `${texto}\n[${etiqueta}: ${url}]`);

/* ---------- verificación de la firma de Meta ---------- */
export async function firmaValida(env, raw, cabecera) {
  if (!env.WA_APP_SECRET) return false;
  const esperado = "sha256=" + (await hmac(env.WA_APP_SECRET, raw));
  return igual(esperado, String(cabecera || ""));
}

/* ---------- cerebro del bot ---------- */
const pesos = n => "$" + Number(n || 0).toLocaleString("es-CO");
const sinTildes = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export async function procesarMensaje(env, sitio, m, nombre) {
  const numero = m.from;
  let texto = "", opcion = "";
  if (m.type === "text") texto = m.text?.body || "";
  else if (m.type === "interactive") { opcion = m.interactive?.list_reply?.id || m.interactive?.button_reply?.id || ""; texto = m.interactive?.list_reply?.title || m.interactive?.button_reply?.title || ""; }
  else if (m.type === "button") texto = m.button?.text || "";
  else texto = `[${({ image: "Imagen", audio: "Audio", video: "Video", document: "Documento", sticker: "Sticker", location: "Ubicación" })[m.type] || "Mensaje"}]`;

  const nuevo = await guardarEntrante(env, numero, nombre, texto || "[vacío]", m.id);
  if (!nuevo) return; // repetido
  marcarLeido(env, m); // palomitas azules

  const aj = await leerAjustes(env);
  const chat = await leerChat(env, numero);
  if (aj.botActivo === false) return;
  // si un asesor tomó la conversación, el bot no responde (salvo que pida el menú)
  const t = sinTildes(texto.trim());
  if (chat?.modo === "humano") {
    const pideMenu = /^(menu|bot)$/.test(t);
    if (chat.humano_hasta > ahora() && !pideMenu) return;
    await ponerModo(env, numero, "bot"); // venció el tiempo del asesor o el cliente pidió el menú
  }

  // palabras clave
  if (!opcion) {
    if (/^(salir|baja|stop|no mas promociones|no quiero promociones)$/.test(t)) opcion = "baja";
    else if (/^(menu|hola|buenas|buenos dias|buenas tardes|buenas noches|inicio|opciones|hi)\b/.test(t) && t.length < 30) opcion = "menu";
    else if (/\b(asesor|humano|persona|agente)\b/.test(t)) opcion = "asesor";
    else if (m.type !== "text" && m.type !== "interactive" && m.type !== "button") opcion = "archivo";
  }
  const primera = !chat || (await historial(env, numero, 3)).filter(x => x.dir === "in").length <= 1;
  const saludoBase = aj.bienvenida || "¡Hola! ✨ Bienvenid@ a Joyería Yireth, joyas en Oro 18K e ITL en Puerto Boyacá.";
  const tienda = `${sitio}/tienda`;

  switch (opcion) {
    case "menu": return enviarMenu(env, numero, `${saludoBase}\n\n¿Qué te gustaría ver?`);
    case "catalogo": return enviarBoton(env, numero, "Mira todas nuestras joyas con fotos y precios. Puedes comprar en línea o escribirnos aquí si tienes dudas 💛", "Ver catálogo", tienda);
    case "ofertas": return enviarBoton(env, numero, "Estas son las joyas que tenemos en oferta ahora mismo ✨", "Ver ofertas", `${sitio}/tienda?oferta=1`);
    case "pagos": return enviarTexto(env, numero, `💳 *Medios de pago*\n• Tarjeta débito o crédito, PSE y Nequi en nuestra página.\n• *Addi*: paga a cuotas sin tarjeta de crédito, solo con tu cédula (compras desde $50.000, sujeto a aprobación).\n• En la tienda también recibimos Addi.\n\nCompra aquí: ${tienda}`);
    case "envios": return enviarTexto(env, numero, `🚚 *Envíos*\nEnviamos a toda Colombia. Costo del envío: ${aj.envio ? pesos(aj.envio) : "gratis"}${aj.envioGratisDesde ? ` (gratis en compras desde ${pesos(aj.envioGratisDesde)})` : ""}.\nDespachamos después de confirmar el pago. En Puerto Boyacá también puedes recoger en la tienda.`);
    case "tienda": return enviarTexto(env, numero, `📍 *Visítanos*\n${aj.direccion}\n🕒 ${aj.horario}\n\nCómo llegar: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(aj.direccion)}`);
    case "compraventa": return enviarTexto(env, numero, `🪙 *Compraventa de oro*\nTrae tus joyas de oro a la tienda: las pesamos frente a ti y te hacemos una oferta, o las cambias por una joya nueva.\nSi quieres, envíanos fotos aquí y un asesor te da una idea. Más info: ${sitio}/compraventa`);
    case "promos": await ponerOptIn(env, numero, true); return enviarTexto(env, numero, "¡Listo! 🎉 Te avisaremos por aquí de nuevas joyas y promociones. Si en algún momento no quieres recibir más, escribe *SALIR*.");
    case "baja": await ponerOptIn(env, numero, false); return enviarTexto(env, numero, "Listo, no te enviaremos más promociones. Si cambias de opinión, escribe *MENU* y elige “Recibir promociones”.");
    case "asesor": case "archivo":
      await ponerModo(env, numero, "humano");
      return enviarTexto(env, numero, opcion === "archivo"
        ? "¡Gracias! Recibimos tu archivo 📎 Un asesor lo revisa y te responde por aquí en breve."
        : `¡Claro! 🙋‍♀️ Un asesor te atenderá por aquí en breve${aj.horario ? ` (horario: ${aj.horario})` : ""}. Si quieres volver al menú automático escribe *MENU*.`);
  }

  // pregunta libre → IA con el catálogo real
  if (primera && t.length < 12) return enviarMenu(env, numero, `${saludoBase}\n\n¿Qué te gustaría ver?`);
  const respuesta = await responderConIA(env, sitio, numero, aj);
  if (respuesta) return enviarTexto(env, numero, respuesta);
  return enviarMenu(env, numero, "Disculpa, no entendí bien 🙈 Elige una opción o escribe *ASESOR* para hablar con una persona.");
}

async function responderConIA(env, sitio, numero, aj) {
  if (!env.AI) return null;
  const productos = (await leerProductos(env)).filter(p => p.activo !== false).sort((a, b) => (a.orden ?? 100) - (b.orden ?? 100)).slice(0, 80);
  const catalogo = productos.length
    ? productos.map(p => `- ${p.nombre} | ${p.categoria} | ${p.material}${p.peso ? " | " + p.peso : ""}${p.medida ? " | " + p.medida : ""} | ${pesos(p.precio)}${p.precioAntes ? ` (antes ${pesos(p.precioAntes)})` : ""}${p.stock === 0 ? " | AGOTADO" : ""} | ${sitio}/producto/${p.id}`).join("\n")
    : "(Todavía no hay productos cargados en la página.)";
  const sistema = `Eres el asistente de WhatsApp de Joyería Yireth, joyería de Oro 18K e ITL en Puerto Boyacá, Colombia (venta al detal y por mayor, compraventa de oro).
Reglas:
- Responde SOLO sobre la joyería: productos, precios, disponibilidad, pagos, envíos, horario, dirección, compraventa y garantías. Si preguntan otra cosa, di amablemente que solo puedes ayudar con temas de la joyería.
- Usa únicamente el catálogo de abajo. Nunca inventes productos, precios, descuentos ni medidas. Si no está, di que no lo ves en el catálogo y ofrece un asesor.
- Cuando recomiendes una joya, incluye su precio y su enlace.
- Responde en español de Colombia, cálido y breve (máximo 5 líneas). Puedes usar 1 o 2 emojis.
- Para comprar: en la página ${sitio}/tienda (tarjeta, PSE, Nequi o Addi a cuotas desde $50.000, sujeto a aprobación). Envíos a toda Colombia: ${aj.envio ? pesos(aj.envio) : "gratis"}${aj.envioGratisDesde ? `, gratis desde ${pesos(aj.envioGratisDesde)}` : ""}.
- Tienda: ${aj.direccion}. Horario: ${aj.horario}.
- Si el cliente quiere separar una joya, negociar, una marcación personalizada, un reclamo o algo que no sabes, dile que escriba ASESOR.
${aj.infoBot ? "Información adicional de la joyería:\n" + aj.infoBot : ""}
Catálogo actual:
${catalogo}`;
  const hist = (await historial(env, numero, 8)).map(x => ({ role: x.dir === "in" ? "user" : "assistant", content: x.texto.slice(0, 600) }));
  const modelos = [env.WA_MODELO || "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct-fast"];
  for (const modelo of modelos) {
    try {
      const r = await env.AI.run(modelo, { messages: [{ role: "system", content: sistema }, ...hist], max_tokens: 350, temperature: 0.3 });
      const txt = String(r?.response || "").trim();
      if (txt) return txt.slice(0, 1500);
    } catch (e) { console.error("IA", modelo, e.message); }
  }
  return null;
}

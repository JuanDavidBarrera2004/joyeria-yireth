// POST /api/pedido → crea el pedido y devuelve a dónde enviar al cliente (Wompi, Addi o WhatsApp)
// GET  /api/pedido?id=...&t=...[&tx=...] → estado del pedido (para la página de gracias)
import {
  json, leerProductos, leerAjustes, costoEnvio, guardarPedido, leerPedido, marcarPagado,
  limpiarTexto as txt, sha256, hmac, aleatorio, igual,
  wompiActivo, wompiApi, addiActivo, addiApi, addiAuth,
} from "../../lib/comun.js";

const sinTildes = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
const pesos = n => "$" + Number(n).toLocaleString("es-CO");

export async function onRequestPost({ env, request }) {
  if (!env.TIENDA) return json(500, { error: "Falta enlazar el almacén KV llamado TIENDA" });
  let d;
  try { d = await request.json(); } catch { return json(400, { error: "Solicitud inválida" }); }
  const origen = new URL(request.url).origin;

  // ---- datos del cliente ----
  const c = d.cliente || {};
  const cliente = {
    nombre: txt(c.nombre, 60), apellido: txt(c.apellido, 60),
    cedula: txt(c.cedula, 15).replace(/[^\d]/g, ""),
    celular: txt(c.celular, 15).replace(/[^\d]/g, "").replace(/^57(?=\d{10}$)/, ""),
    correo: txt(c.correo, 100).toLowerCase(),
    departamento: txt(c.departamento, 40), ciudad: txt(c.ciudad, 60),
    direccion: txt(c.direccion, 120), notas: txt(c.notas, 300),
  };
  if (!cliente.nombre || !cliente.apellido || cliente.cedula.length < 5 || cliente.celular.length !== 10 ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cliente.correo) || !cliente.ciudad || !cliente.direccion)
    return json(400, { error: "Revisa tus datos: nombre, apellido, cédula, celular de 10 dígitos, correo, ciudad y dirección." });

  // ---- productos: los precios se toman del servidor, nunca del navegador ----
  const lista = await leerProductos(env);
  const items = [];
  for (const it of Array.isArray(d.items) ? d.items.slice(0, 30) : []) {
    const p = lista.find(x => x.id === it.id && x.activo !== false);
    const cantidad = Math.max(1, Math.min(20, parseInt(it.cantidad, 10) || 1));
    if (!p) return json(400, { error: "Un producto de tu carrito ya no está disponible. Actualiza la página." });
    if (p.stock !== null && p.stock !== undefined && p.stock < cantidad)
      return json(400, { error: `${p.nombre}: solo quedan ${p.stock} disponibles.` });
    items.push({ id: p.id, nombre: p.nombre, precio: p.precio, cantidad, imagen: p.imagenes?.[0] || "", categoria: p.categoria });
  }
  if (!items.length) return json(400, { error: "Tu carrito está vacío." });

  const aj = await leerAjustes(env);
  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const envio = costoEnvio(aj, subtotal);
  const total = subtotal + envio;
  const metodo = ["tarjeta", "addi", "whatsapp"].includes(d.metodo) ? d.metodo : "whatsapp";

  // opt-in de promociones por WhatsApp (si el bot está conectado)
  if (d.promos === true && env.DB) {
    try {
      const { prepararDB } = await import("../../lib/whatsapp.js");
      await prepararDB(env);
      await env.DB.prepare(`INSERT INTO chats (numero, nombre, opt_in, actualizado) VALUES (?, ?, 1, ?)
        ON CONFLICT(numero) DO UPDATE SET opt_in = 1, nombre = COALESCE(chats.nombre, excluded.nombre)`)
        .bind("57" + cliente.celular, `${cliente.nombre} ${cliente.apellido}`, Date.now()).run();
    } catch (e) { console.error("opt-in:", e.message); }
  }

  const pedido = {
    id: "YJ" + Date.now().toString(36).toUpperCase() + aleatorio(4).toUpperCase(),
    token: aleatorio(16), fecha: new Date().toISOString(),
    cliente, items, subtotal, envio, total, metodo, estado: "pendiente",
  };

  // ---- WhatsApp: el pedido queda registrado y se coordina el pago por chat ----
  if (metodo === "whatsapp") {
    await guardarPedido(env, pedido);
    const msg = `¡Hola Joyería Yireth! ✨ Hice el pedido ${pedido.id}:\n\n` +
      items.map(i => `• ${i.cantidad} x ${i.nombre} — ${pesos(i.precio * i.cantidad)}`).join("\n") +
      `\n\nEnvío: ${envio ? pesos(envio) : "Gratis"}\nTotal: ${pesos(total)}\n\nA nombre de ${cliente.nombre} ${cliente.apellido}, ${cliente.ciudad}.`;
    return json(200, { pedido: pedido.id, url: `https://wa.me/${aj.whatsapp}?text=${encodeURIComponent(msg)}` });
  }

  // ---- Tarjeta, PSE y Nequi con Wompi ----
  if (metodo === "tarjeta") {
    if (!wompiActivo(env)) return json(400, { error: "El pago con tarjeta todavía no está activo. Elige otra opción." });
    await guardarPedido(env, pedido);
    const cents = String(total * 100);
    const firma = await sha256(pedido.id + cents + "COP" + env.WOMPI_INTEGRITY_SECRET);
    const q = new URLSearchParams({
      "public-key": env.WOMPI_PUBLIC_KEY, currency: "COP", "amount-in-cents": cents,
      reference: pedido.id, "signature:integrity": firma,
      "redirect-url": `${origen}/gracias?pedido=${pedido.id}&t=${pedido.token}`,
      "customer-data:email": cliente.correo,
      "customer-data:full-name": `${cliente.nombre} ${cliente.apellido}`,
      "customer-data:phone-number": cliente.celular,
      "customer-data:phone-number-prefix": "+57",
      "customer-data:legal-id": cliente.cedula,
      "customer-data:legal-id-type": "CC",
    });
    return json(200, { pedido: pedido.id, url: "https://checkout.wompi.co/p/?" + q.toString() });
  }

  // ---- Addi (pago a cuotas) ----
  if (!addiActivo(env)) return json(400, { error: "El pago con Addi todavía no está activo en línea. Elige otra opción." });
  if (total < 50000) return json(400, { error: "Addi está disponible para compras desde $50.000." });
  await guardarPedido(env, pedido);
  try {
    const authR = await fetch(addiAuth(env) + "/oauth/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: env.ADDI_CLIENT_ID.trim(), client_secret: env.ADDI_CLIENT_SECRET.trim(), audience: env.ADDI_AUDIENCE || addiApi(env), grant_type: "client_credentials" }),
    });
    const { access_token } = await authR.json();
    if (!access_token) throw new Error("auth");
    const dir = { lineOne: sinTildes(cliente.direccion).slice(0, 60), city: sinTildes(cliente.ciudad), country: "CO" };
    const llave = await hmac(env.ADMIN_PASSWORD || "yireth", "addi:" + pedido.id);
    const cuerpo = {
      orderId: pedido.id,
      totalAmount: total.toFixed(1), shippingAmount: envio.toFixed(1), totalTaxesAmount: "0.0", currency: "COP",
      items: items.map(i => ({
        sku: i.id.slice(0, 50), name: sinTildes(i.nombre).slice(0, 50), quantity: String(i.cantidad),
        unitPrice: i.precio, tax: 0, pictureUrl: i.imagen ? (i.imagen.startsWith("/") ? origen + i.imagen : i.imagen) : origen + "/img/icono-512.png",
        category: "jewelry", brand: "Joyeria Yireth",
      })),
      client: {
        idType: "CC", idNumber: cliente.cedula,
        firstName: sinTildes(cliente.nombre).slice(0, 50), lastName: sinTildes(cliente.apellido).slice(0, 50),
        email: cliente.correo, cellphone: cliente.celular, cellphoneCountryCode: "+57", address: dir,
      },
      shippingAddress: dir, billingAddress: dir,
      allyUrlRedirection: {
        logoUrl: origen + "/img/icono-512.png",
        callbackUrl: `${origen}/api/addi-callback?k=${llave}`,
        redirectionUrl: `${origen}/gracias?pedido=${pedido.id}&t=${pedido.token}`,
      },
    };
    const r = await fetch(addiApi(env) + "/v1/online-applications", {
      method: "POST", redirect: "manual",
      headers: { Authorization: "Bearer " + access_token, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    let url = r.headers.get("location");
    if (!url) { const b = await r.json().catch(() => ({})); url = b.redirectionUrl || b.applicationUrl || b._links?.webRedirect?.href; }
    if (!url) throw new Error("sin url " + r.status);
    return json(200, { pedido: pedido.id, url });
  } catch (e) {
    console.error("Addi:", e.message);
    return json(502, { error: "No pudimos conectar con Addi en este momento. Intenta de nuevo o escríbenos por WhatsApp." });
  }
}

export async function onRequestGet({ env, request }) {
  const u = new URL(request.url);
  const p = await leerPedido(env, u.searchParams.get("id") || "");
  if (!p || !igual(p.token, u.searchParams.get("t") || "")) return json(404, { error: "Pedido no encontrado" });

  // Al volver de Wompi se verifica la transacción directamente con Wompi
  const tx = u.searchParams.get("tx");
  if (p.metodo === "tarjeta" && p.estado === "pendiente" && tx && /^[\w-]{5,60}$/.test(tx) && wompiActivo(env)) {
    try {
      const r = await fetch(`${wompiApi(env)}/transactions/${tx}`);
      const t = (await r.json()).data;
      if (t && t.reference === p.id && t.amount_in_cents === p.total * 100) {
        if (t.status === "APPROVED") await marcarPagado(env, p, { via: "wompi", transaccion: t.id, medio: t.payment_method_type });
        else if (["DECLINED", "ERROR", "VOIDED"].includes(t.status)) { p.estado = "rechazado"; p.pago = { via: "wompi", transaccion: t.id, estado: t.status }; await guardarPedido(env, p); }
      }
    } catch (e) { console.error("Wompi consulta:", e.message); }
  }
  return json(200, { id: p.id, estado: p.estado, metodo: p.metodo, total: p.total, items: p.items.map(i => ({ nombre: i.nombre, cantidad: i.cantidad })) });
}

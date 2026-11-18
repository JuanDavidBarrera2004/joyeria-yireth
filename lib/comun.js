// Utilidades del servidor (Cloudflare Pages Functions).
// Requiere el almacén KV enlazado con el nombre TIENDA y la variable ADMIN_PASSWORD.
import { CATEGORIAS, MATERIALES, AJUSTES_BASE } from "./datos.js";

export const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });

const txt = (v, max) => String(v ?? "").trim().slice(0, max);
const num = v => Math.max(0, Math.min(1000000000, parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10) || 0));
export const limpiarTexto = txt;
export const limpiarNumero = num;

/* ---------- productos ---------- */
export async function leerProductos(env) {
  return (await env.TIENDA.get("productos", { type: "json" })) || [];
}
export async function guardarProductos(env, lista) {
  await env.TIENDA.put("productos", JSON.stringify(lista));
}
export function limpiarProducto(p) {
  if (!p || typeof p !== "object") return null;
  const id = txt(p.id, 70).toLowerCase().replace(/[^a-z0-9-]/g, "");
  const nombre = txt(p.nombre, 120);
  const precio = num(p.precio);
  if (!id || !nombre || !precio) return null;
  const imagenes = (Array.isArray(p.imagenes) ? p.imagenes : [])
    .map(u => txt(u, 300)).filter(u => /^(https:\/\/|\/api\/imagen\?id=)/.test(u)).slice(0, 8);
  const stockTxt = String(p.stock ?? "").trim();
  return {
    id, nombre, precio,
    precioAntes: num(p.precioAntes) > precio ? num(p.precioAntes) : 0,
    categoria: CATEGORIAS.includes(p.categoria) ? p.categoria : "Otros",
    material: MATERIALES.includes(p.material) ? p.material : "Oro 18K",
    peso: txt(p.peso, 30), medida: txt(p.medida, 40),
    descripcion: txt(p.descripcion, 1500),
    imagenes,
    stock: stockTxt === "" ? null : num(stockTxt),
    destacado: p.destacado === true, nuevo: p.nuevo === true,
    activo: p.activo !== false,
    orden: Math.min(99999, num(p.orden) || 100),
  };
}

/* ---------- carrusel de portada ---------- */
export async function leerBanners(env) {
  return (await env.TIENDA.get("banners", { type: "json" })) || [];
}
const imgOk = u => (/^(https:\/\/|\/api\/imagen\?id=|\/img\/)/.test(u) ? u : "");
const enlaceOk = u => (/^(\/[^\s]*|https:\/\/[^\s]+)$/.test(u) ? u : "");
export function limpiarBanner(b) {
  if (!b || typeof b !== "object") return null;
  const imagen = imgOk(txt(b.imagen, 300));
  if (!imagen) return null;
  return {
    id: txt(b.id, 40).replace(/[^\w-]/g, "") || aleatorio(8),
    imagen, imagenMovil: imgOk(txt(b.imagenMovil, 300)),
    linea1: txt(b.linea1, 60), linea2: txt(b.linea2, 60), texto: txt(b.texto, 160),
    boton: txt(b.boton, 30), enlace: enlaceOk(txt(b.enlace, 200)) || "/tienda",
    alinear: ["izquierda", "centro", "derecha"].includes(b.alinear) ? b.alinear : "izquierda",
    oscurecer: b.oscurecer !== false,
    completa: b.completa === true,
    activo: b.activo !== false,
  };
}

/* ---------- ajustes ---------- */
export async function leerAjustes(env) {
  const a = (await env.TIENDA.get("ajustes", { type: "json" })) || {};
  return { ...AJUSTES_BASE, ...a };
}
export function limpiarAjustes(a = {}) {
  return {
    anuncio: txt(a.anuncio, 160),
    whatsapp: String(a.whatsapp ?? "").replace(/[^\d]/g, "").slice(0, 15) || AJUSTES_BASE.whatsapp,
    envio: num(a.envio),
    envioGratisDesde: num(a.envioGratisDesde),
    direccion: txt(a.direccion, 120),
    horario: txt(a.horario, 80),
  };
}
export const costoEnvio = (aj, subtotal) =>
  aj.envioGratisDesde && subtotal >= aj.envioGratisDesde ? 0 : aj.envio;

/* ---------- pedidos ---------- */
export const leerPedido = (env, id) => env.TIENDA.get("pedido:" + id, { type: "json" });
export async function guardarPedido(env, p) {
  await env.TIENDA.put("pedido:" + p.id, JSON.stringify(p));
  // índice liviano para el panel (últimos 300)
  const idx = (await env.TIENDA.get("pedidos", { type: "json" })) || [];
  const res = { id: p.id, fecha: p.fecha, nombre: p.cliente.nombre, total: p.total, metodo: p.metodo, estado: p.estado };
  const i = idx.findIndex(x => x.id === p.id);
  if (i >= 0) idx[i] = res; else idx.unshift(res);
  await env.TIENDA.put("pedidos", JSON.stringify(idx.slice(0, 300)));
}
// Marca un pedido como pagado (una sola vez) y descuenta inventario si aplica
export async function marcarPagado(env, pedido, detalle) {
  if (pedido.estado === "pagado") return pedido;
  pedido.estado = "pagado";
  pedido.pagadoEn = new Date().toISOString();
  pedido.pago = detalle;
  const lista = await leerProductos(env);
  let cambio = false;
  for (const it of pedido.items) {
    const p = lista.find(x => x.id === it.id);
    if (p && p.stock !== null && p.stock !== undefined) { p.stock = Math.max(0, p.stock - it.cantidad); cambio = true; }
  }
  if (cambio) await guardarProductos(env, lista);
  await guardarPedido(env, pedido);
  return pedido;
}

/* ---------- criptografía ---------- */
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
export const sha256 = async s => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
export async function hmac(clave, texto) {
  const k = await crypto.subtle.importKey("raw", enc.encode(clave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(texto)));
}
export function igual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function claveCorrecta(env, intento) {
  if (!env.ADMIN_PASSWORD || typeof intento !== "string") return false;
  return igual(await hmac("yireth", env.ADMIN_PASSWORD), await hmac("yireth", intento));
}
export const aleatorio = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");

/* ---------- pasarelas ---------- */
export const wompiActivo = env => !!(env.WOMPI_PUBLIC_KEY && env.WOMPI_INTEGRITY_SECRET);
export const wompiApi = env => (String(env.WOMPI_PUBLIC_KEY).startsWith("pub_test") ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1");
export const addiActivo = env => !!(env.ADDI_CLIENT_ID && env.ADDI_CLIENT_SECRET && env.ADDI_ALLY_SLUG);
export const addiApi = env => (env.ADDI_SANDBOX === "1" ? "https://api.addi-staging.com" : "https://api.addi.com");
export const addiAuth = env => (env.ADDI_SANDBOX === "1" ? "https://auth.addi-staging.com" : "https://auth.addi.com");

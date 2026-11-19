// Joyería Yireth — lógica común de la tienda
import { EJEMPLOS, AJUSTES_BASE, CATEGORIAS } from "/lib/datos.js";

export const $ = (s, c = document) => c.querySelector(s);
export const $$ = (s, c = document) => [...c.querySelectorAll(s)];
export const pesos = n => "$" + Number(n || 0).toLocaleString("es-CO");
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export { CATEGORIAS };

/* ---------- datos del servidor (con respaldo para la vista previa) ---------- */
export let VISTA_PREVIA = false;
async function pedirJSON(url) {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (r.ok && (r.headers.get("content-type") || "").includes("json")) return await r.json();
  } catch {}
  return null;
}
let _aj, _prods;
export async function ajustes() {
  if (_aj) return _aj;
  const a = await pedirJSON("/api/ajustes");
  if (!a) VISTA_PREVIA = true;
  return (_aj = a || { ...AJUSTES_BASE, pagos: { tarjeta: true, addi: "vista-previa" } });
}
export async function productos() {
  if (_prods) return _prods;
  let l = await pedirJSON("/api/productos");
  if (!Array.isArray(l)) { VISTA_PREVIA = true; l = EJEMPLOS; }
  return (_prods = l.filter(p => p.activo !== false).sort((a, b) => (a.orden ?? 100) - (b.orden ?? 100)));
}
export const waUrl = (num, txt) => `https://wa.me/${num}?text=${encodeURIComponent(txt)}`;

/* ---------- dibujos de joyas (cuando el producto aún no tiene foto) ---------- */
const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
export const ARTE = {
  cadena: `<svg viewBox="0 0 64 64" ${S}><path d="M10 12c4 22 12 34 22 38 10-4 18-16 22-38"/><g>${[0, 1, 2, 3, 4, 5, 6].map(i => { const t = i / 6, x = 10 + 44 * t, y = 12 + 38 * Math.sin(Math.PI * t) * 1; return `<ellipse cx="${x.toFixed(1)}" cy="${(12 + (y - 12) * .98).toFixed(1)}" rx="2.6" ry="1.6"/>`; }).join("")}</g><path d="M32 50v4"/><path d="M29 54h6l-3 6z"/></svg>`,
  pulsera: `<svg viewBox="0 0 64 64" ${S}><ellipse cx="32" cy="32" rx="22" ry="14"/><ellipse cx="32" cy="32" rx="18" ry="10.5"/><circle cx="32" cy="46" r="2.5"/></svg>`,
  arete: `<svg viewBox="0 0 64 64" ${S}><circle cx="22" cy="14" r="3"/><path d="M22 17v6"/><circle cx="22" cy="34" r="10"/><circle cx="42" cy="14" r="3"/><path d="M42 17v6"/><circle cx="42" cy="34" r="10"/></svg>`,
  anillo: `<svg viewBox="0 0 64 64" ${S}><circle cx="32" cy="40" r="16"/><circle cx="32" cy="40" r="12.5"/><path d="M26 22l6-8 6 8-6 4z"/><path d="M26 22h12"/></svg>`,
  dije: `<svg viewBox="0 0 64 64" ${S}><path d="M14 8c4 10 10 16 18 18 8-2 14-8 18-18"/><circle cx="32" cy="29" r="2.5"/><path d="M32 31.5c-7 6-10 12-10 17a10 10 0 0 0 20 0c0-5-3-11-10-17z"/></svg>`,
  tejida: `<svg viewBox="0 0 64 64" ${S}><path d="M8 26c8-6 16 6 24 0s16 6 24 0"/><path d="M8 32c8-6 16 6 24 0s16 6 24 0"/><path d="M8 38c8-6 16 6 24 0s16 6 24 0"/></svg>`,
  argollas: `<svg viewBox="0 0 64 64" ${S}><circle cx="25" cy="36" r="14"/><circle cx="25" cy="36" r="11"/><circle cx="40" cy="30" r="14"/><circle cx="40" cy="30" r="11"/></svg>`,
  corona: `<svg viewBox="0 0 64 64" ${S}><path d="M12 44l4-22 10 10 6-14 6 14 10-10 4 22z"/><path d="M12 50h40"/><circle cx="32" cy="16" r="2"/></svg>`,
  piercing: `<svg viewBox="0 0 64 64" ${S}><path d="M44 22a14 14 0 1 1-24 0"/><circle cx="20" cy="22" r="3"/><circle cx="44" cy="22" r="3"/></svg>`,
  set: `<svg viewBox="0 0 64 64" ${S}><path d="M10 10c3 14 10 22 18 24 8-2 15-10 18-24"/><path d="M28 34l-3 6h6z"/><circle cx="48" cy="44" r="8"/><circle cx="48" cy="44" r="5.5"/></svg>`,
};
const ARTE_CAT = { Cadenas: "cadena", Pulseras: "pulsera", Aretes: "arete", Anillos: "anillo", "Dijes y herrajes": "dije", Tejidas: "tejida", Matrimonio: "argollas", "15 años": "corona", Piercing: "piercing", Sets: "set", Otros: "dije" };
export const arte = cat => ARTE[ARTE_CAT[cat] || "dije"];

/* ---------- tarjeta de producto ---------- */
export function tarjeta(p) {
  const agotado = p.stock === 0;
  const marcas = [agotado && ["agotado", "Agotado"], !agotado && p.precioAntes && ["oferta", "Oferta"], p.top && ["top", "★ Top"], p.destacado && ["tendencia", "Tendencia"], p.nuevo && ["", "Nuevo"]].filter(Boolean).slice(0, 2);
  const etq = marcas.length ? `<div class="etqs">${marcas.map(([c, t]) => `<span class="etq ${c}">${t}</span>`).join("")}</div>` : "";
  const fotos = p.imagenes?.length
    ? `<img class="pri" src="${esc(p.imagenes[0])}" alt="${esc(p.nombre)}" loading="lazy">${p.imagenes[1] ? `<img class="seg" src="${esc(p.imagenes[1])}" alt="" loading="lazy">` : ""}`
    : `<div class="arte">${arte(p.categoria)}</div>`;
  const meta = [p.material, p.peso, p.medida].filter(Boolean).join(" · ");
  return `<article class="prod rev" data-id="${esc(p.id)}">
    <div class="prod-media"><a class="prod-foto" href="/producto/${esc(p.id)}">${etq}${fotos}</a>
    ${agotado ? "" : `<button class="add-rapido" data-add>Agregar al carrito</button>`}</div>
    <div class="prod-info">
      <h3><a href="/producto/${esc(p.id)}">${esc(p.nombre)}</a></h3>
      <div class="meta">${esc(meta)}</div>
      <div class="precio">${p.precioAntes ? `<span class="rojo">${pesos(p.precio)}</span><s>${pesos(p.precioAntes)}</s>` : pesos(p.precio)}</div>
      ${p.precio >= 50000 ? `<div class="cuotas">Paga a cuotas con Addi</div>` : ""}
    </div>
  </article>`;
}
export function pintarRejilla(cont, lista, vacio = "Pronto nuevas joyas.") {
  cont.innerHTML = lista.length ? lista.map(tarjeta).join("") : `<p class="vacio">${vacio}</p>`;
  observar();
}
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-add]"); if (!b) return;
  const card = b.closest("[data-id]"); if (!card) return;
  const p = (await productos()).find(x => x.id === card.dataset.id);
  if (p) Carrito.agregar(p, 1);
});

/* ---------- carrusel de la portada ---------- */
const FL = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${d ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"}"/></svg>`;
export async function montarCarrusel(sec, lista) {
  if (!sec) return;
  lista ||= await pedirJSON("/api/banners");
  if (!Array.isArray(lista) || !lista.length) return; // sin diapositivas: queda la portada de siempre
  const car = document.createElement("section");
  car.className = "carrusel"; car.setAttribute("aria-roledescription", "carrusel"); car.setAttribute("aria-label", "Novedades");
  car.innerHTML = `<div class="diapos">${lista.map((b, i) => `
    ${b.completa ? `<a class="diapo completa" href="${esc(b.enlace || "/tienda")}" role="group" aria-label="${i + 1} de ${lista.length}">
      <picture>${b.imagenMovil ? `<source media="(max-width:700px)" srcset="${esc(b.imagenMovil)}">` : ""}<img src="${esc(b.imagen)}" alt="${esc([b.linea1, b.linea2].filter(Boolean).join(" ") || "Joyería Yireth")}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}></picture></a>` : `
    <div class="diapo ${b.alinear || "izquierda"}${b.oscurecer !== false ? " oscuro" : ""}" role="group" aria-label="${i + 1} de ${lista.length}">
      <picture>${b.imagenMovil ? `<source media="(max-width:700px)" srcset="${esc(b.imagenMovil)}">` : ""}<img src="${esc(b.imagen)}" alt="${esc([b.linea1, b.linea2].filter(Boolean).join(" ") || "Joyería Yireth")}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}></picture>
      <div class="contenedor"><div class="caja-txt">
        ${b.linea1 || b.linea2 ? `<h2>${esc(b.linea1)}${b.linea2 ? `<em>${esc(b.linea2)}</em>` : ""}</h2>` : ""}
        ${b.texto ? `<p>${esc(b.texto)}</p>` : ""}
        ${b.boton ? `<a class="btn btn-oro" href="${esc(b.enlace || "/tienda")}">${esc(b.boton)}</a>` : ""}
      </div></div>
      ${!b.boton ? `<a href="${esc(b.enlace || "/tienda")}" style="position:absolute;inset:0;z-index:1" aria-label="Ver"></a>` : ""}
    </div>`}`).join("")}</div>
    ${lista.length > 1 ? `<button class="flecha izq" aria-label="Anterior">${FL(0)}</button><button class="flecha der" aria-label="Siguiente">${FL(1)}</button>
    <div class="puntos">${lista.map((_, i) => `<button aria-label="Ir a la diapositiva ${i + 1}"></button>`).join("")}</div>` : ""}`;
  sec.replaceWith(car);
  if (lista.length < 2) return;
  const pista = $(".diapos", car), puntos = $$(".puntos button", car);
  let i = 0, t;
  const ir = n => { i = (n + lista.length) % lista.length; pista.style.transform = `translateX(-${i * 100}%)`; puntos.forEach((p, k) => p.classList.toggle("sel", k === i)); reiniciar(); };
  const reiniciar = () => { clearInterval(t); if (!matchMedia("(prefers-reduced-motion: reduce)").matches) t = setInterval(() => ir(i + 1), 6000); };
  $(".izq", car).onclick = () => ir(i - 1); $(".der", car).onclick = () => ir(i + 1);
  puntos.forEach((p, k) => p.onclick = () => ir(k));
  car.addEventListener("mouseenter", () => clearInterval(t)); car.addEventListener("mouseleave", reiniciar);
  let x0 = null;
  car.addEventListener("touchstart", e => x0 = e.touches[0].clientX, { passive: true });
  car.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) ir(i + (dx < 0 ? 1 : -1)); x0 = null; });
  document.addEventListener("visibilitychange", () => document.hidden ? clearInterval(t) : reiniciar());
  ir(0);
}

/* ---------- carrito ---------- */
export const Carrito = {
  items: [],
  cargar() { try { this.items = JSON.parse(localStorage.getItem("yj-carrito") || "[]"); } catch { this.items = []; } },
  guardar() { try { localStorage.setItem("yj-carrito", JSON.stringify(this.items)); } catch {} this.pintar(); document.dispatchEvent(new Event("carrito")); },
  agregar(p, n = 1) {
    const it = this.items.find(i => i.id === p.id);
    if (it) it.cantidad += n; else this.items.push({ id: p.id, nombre: p.nombre, precio: p.precio, categoria: p.categoria, imagen: p.imagenes?.[0] || "", cantidad: n });
    this.guardar(); aviso(`${p.nombre} agregado al carrito`); abrirCarrito(true);
  },
  cambiar(id, d) {
    const it = this.items.find(i => i.id === id); if (!it) return;
    it.cantidad += d; if (it.cantidad <= 0) this.items = this.items.filter(i => i !== it);
    this.guardar();
  },
  quitar(id) { this.items = this.items.filter(i => i.id !== id); this.guardar(); },
  vaciar() { this.items = []; this.guardar(); },
  subtotal() { return this.items.reduce((s, i) => s + i.precio * i.cantidad, 0); },
  cuenta() { return this.items.reduce((s, i) => s + i.cantidad, 0); },
  pintar() {
    $$("[data-contador]").forEach(e => e.textContent = this.cuenta() || "");
    const caja = $("#carritoItems"); if (!caja) return;
    caja.innerHTML = this.items.length ? this.items.map(itemHTML).join("") : `<p class="carrito-vacio">Tu carrito está vacío.</p>`;
    $("#carritoSub").textContent = pesos(this.subtotal());
    $("#irPagar").classList.toggle("off", !this.items.length);
  },
};
export const itemHTML = (i, fijo) => `<div class="item">
  <span class="mini" style="${i.imagen ? `background-image:url('${esc(i.imagen)}')` : ""}">${i.imagen ? "" : arte(i.categoria)}</span>
  <div><b>${esc(i.nombre)}</b><small>${pesos(i.precio)}</small>
    ${fijo ? `<small> · Cant. ${i.cantidad}</small>` : `<div><span class="cant"><button data-menos="${esc(i.id)}" aria-label="Quitar uno">−</button><span>${i.cantidad}</span><button data-mas="${esc(i.id)}" aria-label="Agregar uno">+</button></span></div>`}
  </div>
  <div style="text-align:right">${pesos(i.precio * i.cantidad)}${fijo ? "" : `<br><button class="quitar" data-quitar="${esc(i.id)}">Quitar</button>`}</div>
</div>`;

function montarCarrito() {
  document.body.insertAdjacentHTML("beforeend", `
  <div class="velo" id="velo"></div>
  <aside class="carrito" id="carrito" aria-label="Carrito">
    <div class="carrito-cab"><h3>Tu carrito</h3><button id="cerrarCarrito" aria-label="Cerrar">×</button></div>
    <div class="carrito-items" id="carritoItems"></div>
    <div class="carrito-pie">
      <div class="fila-total grande"><span>Subtotal</span><span id="carritoSub">$0</span></div>
      <small style="color:var(--gris)">El envío se calcula al finalizar la compra.</small>
      <a class="btn btn-negro" id="irPagar" href="/carrito">Finalizar compra</a>
      <button class="btn btn-borde" id="seguir">Seguir comprando</button>
    </div>
  </aside>
  <div class="toast" id="toast"></div>`);
  $("#cerrarCarrito").onclick = $("#velo").onclick = $("#seguir").onclick = () => abrirCarrito(false);
  $$("[data-abrir-carrito]").forEach(b => b.addEventListener("click", () => abrirCarrito(true)));
  document.addEventListener("click", e => {
    const m = e.target.closest("[data-mas]"), n = e.target.closest("[data-menos]"), q = e.target.closest("[data-quitar]");
    if (m) Carrito.cambiar(m.dataset.mas, 1); if (n) Carrito.cambiar(n.dataset.menos, -1); if (q) Carrito.quitar(q.dataset.quitar);
  });
  Carrito.cargar(); Carrito.pintar();
}
export function abrirCarrito(v) {
  if (location.pathname.startsWith("/carrito")) return;
  $("#carrito")?.classList.toggle("abierto", v); $("#velo")?.classList.toggle("abierto", v);
}
let tA;
export function aviso(t) {
  const el = $("#toast"); if (!el) return;
  el.textContent = t; el.classList.add("ver"); clearTimeout(tA); tA = setTimeout(() => el.classList.remove("ver"), 2000);
}

let obs;
export function observar() {
  if (!("IntersectionObserver" in window)) return $$(".rev").forEach(e => e.classList.add("ver"));
  obs ||= new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("ver"); obs.unobserve(e.target); } }), { rootMargin: "0px 0px -30px" });
  $$(".rev:not(.ver)").forEach(e => obs.observe(e));
}

export const ICONO_WA = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8 8 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c1.9.8 2.7.9 3.6.7a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.2-.3-.3-.6-.4ZM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4a9.8 9.8 0 1 1 8.3 4.6Zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.8L.1 24l6.3-1.7a11.8 11.8 0 0 0 5.6 1.4A11.8 11.8 0 0 0 20.4 3.6Z"/></svg>`;

/* ---------- arranque común ---------- */
export async function iniciar() {
  $(".hamb")?.addEventListener("click", () => $(".nav").classList.toggle("abierto"));
  $$(".buscador").forEach(f => f.addEventListener("submit", e => { e.preventDefault(); const q = $("input", f).value.trim(); location.href = "/tienda" + (q ? "?q=" + encodeURIComponent(q) : ""); }));
  $$("[data-anio]").forEach(e => e.textContent = new Date().getFullYear());
  montarCarrito(); observar();
  const a = await ajustes();
  $$("[data-anuncio]").forEach(e => { if (a.anuncio) e.textContent = a.anuncio; else e.remove(); });
  $$("[data-direccion]").forEach(e => e.textContent = a.direccion);
  $$("[data-horario]").forEach(e => e.textContent = a.horario);
  $$("[data-wa]").forEach(el => { el.href = waUrl(a.whatsapp, el.dataset.wa || "¡Hola Joyería Yireth! Quiero información ✨"); el.target = "_blank"; el.rel = "noopener"; });
  document.body.insertAdjacentHTML("beforeend", `<a class="wa-flot" href="${waUrl(a.whatsapp, "¡Hola Joyería Yireth! Quiero información ✨")}" target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp">${ICONO_WA}</a>`);
  return a;
}

// /producto/ID → ficha del producto con título, descripción y datos para Google ya incluidos
import { leerProductos } from "../../lib/comun.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function onRequestGet({ env, params, request }) {
  const plantilla = await env.ASSETS.fetch(new URL("/producto.html", request.url));
  let html = await plantilla.text();
  const origen = new URL(request.url).origin;
  const p = env.TIENDA ? (await leerProductos(env)).find(x => x.id === params.id && x.activo !== false) : null;
  if (!p) {
    return new Response(html.replace("<!--SEO-->", '<meta name="robots" content="noindex">'), {
      status: 404, headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  const img = p.imagenes?.[0] ? (p.imagenes[0].startsWith("/") ? origen + p.imagenes[0] : p.imagenes[0]) : origen + "/img/compartir.png";
  const desc = (p.descripcion || `${p.nombre} en ${p.material}${p.peso ? ", " + p.peso : ""}${p.medida ? ", " + p.medida : ""}.`).slice(0, 155) + " Paga con tarjeta o a cuotas con Addi.";
  const url = `${origen}/producto/${p.id}`;
  const datos = {
    "@context": "https://schema.org", "@type": "Product", name: p.nombre, image: [img], description: desc,
    sku: p.id, brand: { "@type": "Brand", name: "Joyería Yireth" }, category: p.categoria, material: p.material,
    ...(p.precio ? { offers: { "@type": "Offer", url, priceCurrency: "COP", price: p.precio,
      availability: p.stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" } } : {}),
  };
  const seo = `<title>${esc(p.nombre)} | Joyería Yireth</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="product"><meta property="og:title" content="${esc(p.nombre)} | Joyería Yireth">
<meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(img)}"><meta property="og:url" content="${esc(url)}">
<script type="application/ld+json">${JSON.stringify(datos).replace(/</g, "\\u003c")}</script>
<script>window.__PRODUCTO__=${JSON.stringify(p).replace(/</g, "\\u003c")};</script>`;
  html = html.replace(/<title>.*?<\/title>/s, "").replace("<!--SEO-->", seo);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } });
}

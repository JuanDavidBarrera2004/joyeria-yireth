// /sitemap.xml → lista de páginas y productos para Google (se actualiza sola)
import { leerProductos } from "../lib/comun.js";

export async function onRequestGet({ env, request }) {
  const o = new URL(request.url).origin;
  const fijas = ["/", "/tienda", "/exclusividad", "/politicas"];
  const prods = env.TIENDA ? (await leerProductos(env)).filter(p => p.activo !== false) : [];
  const urls = [...fijas.map(u => `<url><loc>${o}${u}</loc></url>`),
    ...prods.map(p => `<url><loc>${o}/producto/${p.id}</loc></url>`)].join("\n  ");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

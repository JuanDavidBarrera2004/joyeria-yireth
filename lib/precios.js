// Descuentos de las ofertas (Black Friday, etc.). Lo usan el servidor (precio real que se cobra)
// y el navegador (lo que se muestra), así que siempre coinciden.
export const hoyColombia = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
export const ofertaVigente = (o, hoy = hoyColombia()) => o.activo !== false && (!o.desde || o.desde <= hoy) && (!o.hasta || hoy <= o.hasta);

// ¿Esta joya entra en la oferta? (todas las joyas, categorías completas o joyas escogidas)
export const entraEnOferta = (o, p) => p.categoria !== "Exclusividad" && (o.todas || (o.categorias || []).includes(p.categoria) || (o.productos || []).includes(p.id));

// Aplica el mayor descuento vigente a cada joya con precio. Redondea a centenas de peso.
export function conDescuentos(lista, ofertas, hoy = hoyColombia()) {
  const activas = (ofertas || []).filter(o => o.descuento > 0 && ofertaVigente(o, hoy));
  if (!activas.length) return lista;
  return lista.map(p => {
    if (!p.precio) return p;
    let mejor = null;
    for (const o of activas) if (entraEnOferta(o, p) && (!mejor || o.descuento > mejor.descuento)) mejor = o;
    if (!mejor) return p;
    const precio = Math.max(100, Math.round(p.precio * (1 - mejor.descuento / 100) / 100) * 100);
    return { ...p, precio, precioAntes: Math.max(p.precioAntes || 0, p.precio), descuento: mejor.descuento, oferta: mejor.etiqueta || mejor.titulo };
  });
}

// Datos base de Joyería Yireth (se usan en la tienda, el panel y el servidor).

export const CATEGORIAS = [
  "Cadenas", "Pulseras", "Aretes", "Anillos", "Dijes y herrajes",
  "Tejidas", "Balines", "Matrimonio", "15 años", "Piercing", "Personalizados", "Sets", "Exclusividad", "Otros",
];
export const SUBCATEGORIAS = { Aretes: ["Candongas", "Lágrimas", "Topos"], Anillos: ["Hombre", "Mujer", "Niño"], "Dijes y herrajes": ["Dijes", "Herrajes"], Personalizados: ["Bolígrafos", "Termos"] };
export const MATERIALES = ["Oro Italiano", "Oro Nacional"];
export const COLORES = { Amarillo: "#d9b04f", Blanco: "#e4e4e0", Rosado: "#e3a98c" };

// Ajustes que el administrador puede cambiar desde el panel (pestaña Ajustes)
export const AJUSTES_BASE = {
  anuncio: "Paga a cuotas con Addi · Envíos a toda Colombia · Venta al detal y por mayor",
  whatsapp: "573185112754",
  envio: 15000,            // costo de envío en pesos
  envioGratisDesde: 500000, // 0 = nunca gratis
  direccion: "Cra 3 #13-57, Puerto Boyacá, Boyacá",
  horario: "Lunes a sábado",
};

// Productos de ejemplo: SOLO se muestran en la vista previa sin servidor.
// En la tienda publicada se ven únicamente los productos cargados desde el panel.
export const EJEMPLOS = [
  ["cadena-cartier-50", "Cadena Cartier 50 cm", "Cadenas", "Oro Italiano", 1850000, 0, "6.2 g", "50 cm", true, true],
  ["pulso-tejido-3mm", "Pulso tejido 3 mm", "Tejidas", "Oro Italiano", 980000, 1100000, "3.1 g", "19 cm", true, false],
  ["topos-corazon", "Topos corazón", "Aretes", "Oro Italiano", 320000, 0, "1.0 g", "6 mm", false, true],
  ["argollas-matrimonio", "Argollas de matrimonio lisas", "Matrimonio", "Oro Italiano", 2400000, 0, "8.0 g", "Par", true, true],
  ["anillo-solitario", "Anillo solitario circón", "Anillos", "Oro Italiano", 690000, 0, "2.2 g", "Talla a pedido", false, true],
  ["dije-virgen", "Dije Virgen Milagrosa", "Dijes y herrajes", "Oro Italiano", 450000, 0, "1.4 g", "2 cm", true, false],
  ["set-15-anos", "Set 15 años cadena y dije", "15 años", "Oro Italiano", 1250000, 1390000, "4.0 g", "45 cm", true, true],
  ["piercing-argolla", "Piercing argolla", "Piercing", "Oro Italiano", 180000, 0, "0.5 g", "8 mm", false, true],
  ["cadena-italiana-gruesa", "Cadena italiana gruesa", "Cadenas", "Oro Italiano", 120000, 0, "", "60 cm", false, true],
  ["pulsera-balines", "Pulsera balines", "Pulseras", "Oro Nacional", 65000, 85000, "", "18 cm", false, false],
].map(([id, nombre, categoria, material, precio, precioAntes, peso, medida, destacado, nuevo], i) => ({
  id, nombre, categoria, material, precio, precioAntes, peso, medida, destacado, nuevo,
  colores: i % 3 ? ["Amarillo"] : ["Amarillo", "Blanco", "Rosado"], descripcion: "Producto de ejemplo para la vista previa.", imagenes: [], stock: null, activo: true, orden: i + 1,
}));

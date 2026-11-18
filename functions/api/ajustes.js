// GET /api/ajustes → datos públicos de la tienda y qué medios de pago están activos
import { json, leerAjustes, wompiActivo, addiActivo } from "../../lib/comun.js";

export async function onRequestGet({ env }) {
  if (!env.TIENDA) return json(500, { error: "Falta enlazar el almacén KV llamado TIENDA" });
  const { infoBot, bienvenida, botActivo, ...a } = await leerAjustes(env);
  return json(200, {
    ...a,
    pagos: { tarjeta: wompiActivo(env), addi: addiActivo(env) ? env.ADDI_ALLY_SLUG : null },
  }, { "Cache-Control": "public, max-age=30" });
}

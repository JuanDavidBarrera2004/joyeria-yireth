// GET /api/imagen?id=... → foto subida desde el panel
export async function onRequestGet({ env, request }) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^img-[a-z0-9]{6,40}$/.test(id) || !env.TIENDA) return new Response("No encontrada", { status: 404 });
  const { value, metadata } = await env.TIENDA.getWithMetadata(id, { type: "arrayBuffer" });
  if (!value) return new Response("No encontrada", { status: 404 });
  return new Response(value, { headers: { "Content-Type": metadata?.tipo || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
}

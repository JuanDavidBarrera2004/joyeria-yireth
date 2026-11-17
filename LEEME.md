# Joyería Yireth: guía

## Publicar (Cloudflare Pages, gratis)
1. Sube todo el contenido de esta carpeta a un repositorio de GitHub.
2. En Cloudflare: Workers y Pages → Crear → Pages → Conectar a Git → elige el repositorio. Deja vacíos el comando de compilación y la carpeta de salida. Nombre del proyecto: `joyeria-yireth`.
3. KV → crea el namespace `yireth-tienda`. En el proyecto: Settings → Bindings → KV namespace → nombre `TIENDA`.
4. Settings → Variables and secrets → agrega `ADMIN_PASSWORD` (Secret).
5. Reintenta la implementación. El panel queda en `/admin.html`.

## Pago con tarjeta, PSE y Nequi (Wompi)
1. Abre la cuenta de comercio en wompi.co (persona natural o empresa).
2. En el panel de Wompi → Desarrolladores, copia las llaves y agrégalas en Cloudflare como **Secret**:
   - `WOMPI_PUBLIC_KEY` (empieza por `pub_prod_`)
   - `WOMPI_INTEGRITY_SECRET` (Secreto de integridad)
   - `WOMPI_EVENTS_SECRET` (Secreto de eventos)
3. En Wompi → Desarrolladores → URL de eventos: `https://TU-DOMINIO/api/wompi-evento`
4. Reintenta la implementación. Para probar sin cobrar, usa primero las llaves de prueba (`pub_test_`).

## Pago a cuotas con Addi
La joyería ya acepta Addi en la tienda física. Para activarlo en línea:
1. Pide a tu asesor de Addi (o en el portal de aliados) la **integración e-commerce personalizada** para tu página.
2. Addi entrega por correo: `client_id`, `client_secret` y el `ally-slug`. Agrégalos en Cloudflare como Secret:
   - `ADDI_CLIENT_ID`, `ADDI_CLIENT_SECRET`, `ADDI_ALLY_SLUG`
   - Para pruebas en el ambiente de Addi: `ADDI_SANDBOX` = `1` (bórrala para producción)
   - Si Addi indica otro "audience", agrégalo como `ADDI_AUDIENCE`.
3. Reintenta la implementación. La opción "Paga a cuotas con Addi" aparece sola en el pago y la calculadora de cuotas en cada producto (compras desde $50.000).

Mientras una pasarela no esté configurada, su opción aparece como "Muy pronto" y el cliente puede pedir por WhatsApp.

## Panel (`/admin.html`)
- **Productos:** nombre, categoría, material, precio, precio antes (oferta), unidades, peso, medida, descripción y hasta 8 fotos. Cuadradas (1:1) de 1200 × 1200 px se ven mejor.
- **Portada:** el carrusel del inicio. Cada diapositiva lleva foto (1920 × 750 px; opcional otra de 1080 × 1350 px para celular), título, segunda línea dorada, texto, botón y a dónde lleva. Si la foto ya viene diseñada con texto (Canva), marca "Foto ya diseñada" y se muestra completa. Se pueden ordenar, activar o desactivar por temporada. Si no hay ninguna activa, se ve la portada de siempre.
- **Pedidos:** cada compra con datos del cliente, productos, total y estado. Los pagos de Wompi y Addi se marcan como "pagado" solos; los de WhatsApp los cambias tú.
- **Ajustes:** mensaje de la barra superior, WhatsApp, dirección, horario, costo de envío y envío gratis desde.

## Google
Cuando tengas dominio propio: cambia `joyeria-yireth.pages.dev` por tu dominio en los archivos HTML y en `robots.txt`, verifica el dominio en Google Search Console y envía `sitemap.xml` (se actualiza solo con los productos).

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

## Bot de WhatsApp (API oficial de Meta)
El bot responde solo con un menú, contesta preguntas con IA usando los productos y precios reales del panel, pasa la conversación a un asesor cuando el cliente lo pide y permite enviar promociones a quienes aceptaron recibirlas. La dueña contesta desde el panel, en la pestaña **WhatsApp**.

**Importante:** al conectar el número a la API de Meta, ese número deja de funcionar en la app de WhatsApp del celular. Antes de conectarlo, haz una copia de seguridad de los chats desde la app.

### 1. Cloudflare (ya queda listo)
- Settings → Bindings → **D1 database**: nombre `DB` (base de datos `yireth-whatsapp`).
- Settings → Bindings → **Workers AI**: nombre `AI`.

### 2. Meta (lo hace la dueña con su Facebook)
1. Entra a **business.facebook.com** y crea (o usa) el portafolio comercial de Joyería Yireth.
2. Entra a **developers.facebook.com** → Mis apps → **Crear app** → tipo **Empresa** → agrega el producto **WhatsApp**.
3. En WhatsApp → **Configuración de la API**: agrega el número 318 511 2754 y verifícalo con el código por SMS o llamada. Antes, elimina la cuenta de WhatsApp de ese número en el celular (Ajustes → Cuenta → Eliminar cuenta), después de hacer la copia de seguridad.
4. Agrega un **método de pago** en el portafolio (Meta cobra las promociones y los mensajes después de los gratis del mes).
5. Crea un **usuario del sistema** (Configuración del negocio → Usuarios del sistema) con rol administrador, asígnale la app y la cuenta de WhatsApp, y genera un **token permanente** con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.

### 3. Variables en Cloudflare (tipo Secret)
| Variable | De dónde sale |
|---|---|
| `WA_TOKEN` | Token permanente del usuario del sistema |
| `WA_PHONE_ID` | WhatsApp → Configuración de la API → "Identificador del número de teléfono" |
| `WA_WABA_ID` | WhatsApp → Configuración de la API → "Identificador de la cuenta de WhatsApp Business" |
| `WA_APP_SECRET` | App → Configuración → Básica → "Clave secreta de la app" |
| `WA_VERIFY_TOKEN` | Una palabra que tú inventes (ej. `yireth-bot-2026`) |

Reintenta la implementación.

### 4. Conectar el webhook
En la app de Meta → WhatsApp → **Configuración** → Webhook:
- URL de devolución de llamada: `https://joyeria-yireth.pages.dev/api/whatsapp`
- Token de verificación: el mismo `WA_VERIFY_TOKEN`
- Suscríbete al campo **messages**.

En el panel → WhatsApp → **Conexión** todo debe aparecer en verde.

### 5. Plantillas para promociones
En WhatsApp Manager → **Plantillas** → crear plantilla de categoría **Marketing**. Puede llevar una imagen y la variable `{{1}}`, que el panel reemplaza por el nombre del cliente. Cuando Meta la aprueba, aparece en el panel → WhatsApp → Promociones.

### Cómo funciona para la dueña
- Los chats llegan a la pestaña **WhatsApp** del panel, que se actualiza sola cada 12 segundos.
- Si el cliente pide "asesor" o envía una foto, el bot se pausa en ese chat por 12 horas y el chat aparece marcado "asesor".
- Cuando la dueña responde desde el panel, el bot también se pausa en ese chat.
- **Devolver al bot** reactiva las respuestas automáticas. El cliente también puede escribir **MENU**.
- WhatsApp solo deja escribir mensajes libres hasta 24 horas después del último mensaje del cliente. Pasado ese tiempo, solo con plantilla.
- En **Ajustes** se puede apagar el bot, cambiar el saludo y darle información extra (garantía, marcación, tiempos).

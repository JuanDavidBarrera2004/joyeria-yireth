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

## Bot de WhatsApp (con YCloud, mismo número y app del celular)
El bot responde solo con un menú, contesta preguntas con IA usando los productos y precios reales del panel, pasa la conversación a un asesor y permite enviar promociones a quienes aceptaron recibirlas.
Con **YCloud** (plan gratis) el número 318 **sigue funcionando en la app de WhatsApp Business del celular**. La dueña puede leer y responder desde el celular o desde el panel (pestaña WhatsApp). Cuando responde desde el celular, el bot se calla 12 horas en ese chat.

### Antes de empezar
- El 318 tiene que estar en **WhatsApp Business**, no en el WhatsApp normal, y con la app actualizada.
- Tener a mano el **Facebook** de la dueña y su celular con WhatsApp Business.
- **No** activar en YCloud su propio chatbot ni respuestas automáticas, porque el bot ya está en la página y responderían dos veces.

### 1. Cloudflare (ya está listo)
Settings → Bindings: **D1 database** `DB` (yireth-whatsapp) y **Workers AI** `AI`.

### 2. YCloud
1. Crea la cuenta gratis en **ycloud.com** (plan Free) con el correo de la joyería.
2. **Conecta WhatsApp** y elige la opción de conectar el número que ya usas en la **app de WhatsApp Business** (coexistencia). Inicia sesión con el Facebook de la dueña, elige o crea el portafolio de Joyería Yireth, escribe el número 318 y **escanea el código QR desde la app de WhatsApp Business** del celular (Ajustes → Dispositivos vinculados / código que muestra Meta).
3. Configura el pago de los mensajes de Meta (saldo o tarjeta), como indique YCloud.
4. **Developers → API Keys**: crea una llave.
5. **Developers → Webhook → Add endpoint**:
   - URL: `https://joyeria-yireth.pages.dev/api/ycloud`
   - Eventos: `whatsapp.inbound_message.received` y los de mensajes enviados desde la app (echo / smb message echoes).
   - Guarda el **secreto** (signing secret) que te muestra.

### 3. Variables en Cloudflare (tipo Secret)
| Variable | Valor |
|---|---|
| `YCLOUD_API_KEY` | La llave de YCloud |
| `YCLOUD_WEBHOOK_SECRET` | El secreto del webhook |
| `WA_NUMERO` | `+573185112754` |

Reintenta la implementación. En el panel → WhatsApp → **Conexión** todo debe salir en verde. Escribe "Hola" al 318 desde otro celular para probar.

### 4. Plantillas para promociones
En YCloud → **Templates** → crear plantilla de categoría **Marketing** (puede llevar imagen y la variable `{{1}}`, que el panel reemplaza por el nombre del cliente). Cuando Meta la aprueba, aparece en el panel → WhatsApp → Promociones.

### Cómo funciona para la dueña
- Puede responder **desde el celular** como siempre, o **desde el panel** (pestaña WhatsApp, se actualiza sola).
- Si el cliente escribe "asesor" o envía una foto, el bot se pausa 12 horas en ese chat.
- Cuando la dueña responde, desde el celular o desde el panel, el bot también se pausa en ese chat.
- **Devolver al bot** en el panel, o que el cliente escriba **MENU**, reactiva las respuestas automáticas.
- En **Ajustes** se puede apagar el bot, cambiar el saludo y darle información extra (garantía, marcación, tiempos).

### Alternativa: Meta directo (sin YCloud)
Si algún día se prefiere conectar directo con Meta: variables `WA_TOKEN`, `WA_PHONE_ID`, `WA_WABA_ID`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN` y webhook `https://joyeria-yireth.pages.dev/api/whatsapp`. Si se hace así, el número **deja de funcionar en la app** del celular.

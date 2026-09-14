# Menú Premium — Software base para restaurantes (demo)

Prototipo funcional de menú digital por QR con vista 3D y comanda de cocina
en vivo. Construido para mostrárselo a dueños de restaurantes en Barinas
como demo de ventas.

## ⚠️ Importante: esto no se pudo probar en vivo aquí

El entorno donde se generó este código no tenía salida de red hacia
`registry.npmjs.org` (el registro de paquetes de Node), así que **no se pudo
ejecutar `npm install` ni levantar el servidor para probarlo end-to-end**.
El código se escribió y se revisó manualmente con cuidado (estructura,
balance de llaves, tipos, imports), pero la primera vez que lo corras en tu
máquina es el verdadero primer test. Si algo falla al instalar o correr,
copia el error exacto y lo arreglamos — es lo esperable en software que
nunca se ha ejecutado.

## Qué incluye

1. **Menú del cliente** (`/r/fogon-barines?mesa=4`) — categorías, fotos,
   descripción, tags, porción, y un plato "estrella" con vista 3D real
   (rotar/zoom con el dedo). Carrito local y botón "Enviar pedido a la
   cocina", con una pantalla de seguimiento en vivo del estado del pedido.
2. **Panel de cocina / KDS** (`/cocina`) — tablero en tiempo real (nuevo →
   en preparación → listo → entregado) con sonido de alerta al llegar un
   pedido, responsive para tablet o celular.
3. **Generador de QR por mesa** (`/admin/mesas`) — genera e imprime un QR
   único por mesa, con el número de mesa codificado en la URL.
4. **Página de inicio** (`/`) — guía rápida para hacer la demo en vivo.

## Cómo correrlo

Requiere [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Cómo hacer la demo en vivo frente a un dueño de restaurante

1. Corre `npm run dev` en tu laptop.
2. Averigua la IP local de tu laptop en la misma red wifi (en Mac/Linux:
   `ipconfig getifaddr en0` o `hostname -I`; en Windows: `ipconfig`).
3. En tu celular (conectado al mismo wifi), abre
   `http://TU_IP_LOCAL:3000/admin/mesas` — ahí puedes cambiar la "URL base"
   por `http://TU_IP_LOCAL:3000` para que los QR apunten a tu laptop.
4. Abre el panel de cocina (`/cocina`) en tu laptop o una tablet, bien
   visible para el dueño del restaurante.
5. Escanea con tu celular el QR de una mesa y haz un pedido de prueba.
   Debería aparecer en la pantalla de cocina al instante, con sonido.

Esto es más convincente en persona que cualquier captura de pantalla.

## Qué es real y qué es simulado (para que no prometas de más)

- **Real y funcional:** todo el flujo de UI, el pedido en tiempo real
  (cliente → cocina) vía Server-Sent Events, el carrito, el tracker de
  estado del cliente, la generación de QR, la vista 3D interactiva.
- **Simulado / temporal:**
  - Los pedidos se guardan **en memoria** — si reinicias el servidor
    (`npm run dev`), se borran. Para un restaurante real usando esto en
    producción, el siguiente paso es mover `lib/order-store.ts` a Postgres
    (recomendado: Supabase, que además da autenticación y storage de
    imágenes gratis) — la forma de los datos (`Order`, `OrderItem`) ya está
    lista para ese cambio.
  - No hay sistema de cuentas/login todavía (es un solo restaurante demo,
    no multi-tenant). Ese es el siguiente bloque de trabajo si un
    restaurante real dice que sí.
  - Las fotos de los platos son de stock (Unsplash) y el modelo 3D es un
    aguacate genérico de muestra (Khronos glTF-Sample-Assets) — sirven para
    demostrar la función, pero un restaurante real necesita sus propias
    fotos y, si quiere 3D en más platos, escanearlos con una app de
    fotogrametría gratuita (KIRI Engine) como se explicó antes.
  - El modelo 3D solo tiene versión Android/web (`.glb`). Para que el botón
    de AR nativo funcione también en iPhone (Quick Look) hace falta además
    un archivo `.usdz` del mismo modelo — el visor 3D interactivo (rotar/
    zoom) sí funciona igual en ambos sistemas sin eso.

## Estructura del proyecto

```
app/
  page.tsx                  → landing / guía de la demo
  r/[slug]/page.tsx         → menú público del cliente
  cocina/page.tsx           → panel de cocina (KDS)
  admin/mesas/page.tsx      → generador de QR por mesa
  api/pedidos/route.ts      → crear pedido (POST) y listar (GET)
  api/pedidos/[id]/route.ts → actualizar estado de un pedido (PATCH)
  api/pedidos/stream/route.ts → Server-Sent Events (tiempo real)
components/                 → UI (Menu, DishCard, DishModal, OrderCard...)
lib/
  data.ts                   → menú del restaurante demo (edítalo aquí)
  order-store.ts            → almacenamiento de pedidos en memoria
  types.ts                  → tipos compartidos (Dish, Order, etc.)
```

## Cómo personalizar el menú demo para otro restaurante

Todo el contenido (nombre del restaurante, categorías, platos, precios,
fotos, cuál plato tiene 3D) vive en un solo archivo: `lib/data.ts`. Para una
demo rápida con otro restaurante de Barinas, basta con editar ese archivo —
no hace falta tocar el resto del código.

## Próximos pasos sugeridos (si un restaurante dice que sí)

1. Reemplazar `order-store.ts` en memoria por Postgres/Supabase.
2. Agregar autenticación simple para el dueño (panel para editar el menú
   sin tocar código: agregar/quitar platos, marcar agotado).
3. Multi-tenant: que este mismo software sirva a varios restaurantes con
   sus propios slugs, sin duplicar el proyecto.
4. Desplegar en Vercel (capa gratuita) para tener una URL pública real en
   vez de correrlo localmente.

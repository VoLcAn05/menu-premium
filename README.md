# Menú Premium — carta digital para restaurantes

Carta por QR con vista 3D de cada plato, prueba en la mesa con realidad
aumentada, asistente que conoce el menú y comanda en vivo hacia cocina.

## Qué incluye

1. **Carta del comensal** (`/r/fogon-barines?mesa=4`). Los nueve platos con
   vista 3D interactiva y proyección en la mesa a tamaño real. Carrito,
   envío a cocina y seguimiento del estado del pedido.
2. **Asistente de sala.** Responde sobre ingredientes, alérgenos, dietas,
   precios, porciones, tiempos de preparación y maridajes, y sugiere qué
   agregar a lo ya pedido.
3. **Pantalla de cocina** (`/cocina`). Tablero en vivo con sonido de alerta.
4. **Generador de QR por mesa** (`/admin/mesas`), listo para imprimir.

## Cómo correrlo

Requiere [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Los modelos 3D

Los nueve platos de `public/models/` están modelados a escala real, en
metros: plato de entrada 21 cm, plato fuerte 27 cm, postre 18 cm, copa 9 cm.
Eso es lo que hace que al pulsar "verlo en tu mesa" el plato aparezca del
tamaño que va a tener de verdad, y no de un tamaño arbitrario.

Dos piezas sostienen ese comportamiento y conviene no tocarlas a ciegas:

- `ar-scale="fixed"` en `components/Model3D.tsx`. Con `auto`, el visor deja
  que el usuario escale el modelo y el tamaño deja de significar nada.
- `touch-action="none"`. Sin eso el navegador se queda con el gesto vertical
  para hacer scroll y el plato solo gira en horizontal.

Son modelos hechos a propósito para esta demo: correctos en tamaño,
proporción y composición del plato, pero no fotorrealistas. **Para un
restaurante real, el salto de calidad está en escanear sus platos de
verdad** con una app de fotogrametría (Polycam o KIRI Engine, ambas exportan
`.glb` desde el teléfono) y cambiar la ruta del archivo en `lib/data.ts`.
Una carta con los platos reales del restaurante es el argumento de venta;
modelos de catálogo no lo son.

## El asistente

`lib/assistant.ts` resuelve las preguntas contra `lib/data.ts` y redacta la
respuesta. No usa servicios externos, no cuesta nada y **no puede inventar
un plato, un precio ni un ingrediente**, porque solo sabe lo que está en los
datos. Entiende ingredientes, alérgenos, dietas, presupuesto, antojos
("algo ligero", "tengo hambre"), porciones, tiempos, comparaciones entre
platos, disponibilidad y maridajes.

Si quieres que redacte con más naturalidad, define `ANTHROPIC_API_KEY` en
las variables de entorno de Vercel. El endpoint le pasa el mismo menú como
única fuente y, si la llamada falla, vuelve solo al motor local. Sin esa
clave todo sigue funcionando igual.

Para darle conocimiento sobre un plato se edita su entrada en `lib/data.ts`,
nunca el código del chatbot. Los campos `ingredientes`, `alergenos`,
`picante`, `minutos`, `personas`, `perfil`, `combina` y `nota` son
exactamente lo que el asistente usa para responder.

## Decisiones de diseño de la carta

No son estéticas; vienen de investigación sobre menús:

- **Precios sin símbolo de moneda y sin decimales de relleno.** Un estudio
  de Cornell con 201 comensales midió cerca de 8% más de gasto por cuenta en
  menús sin "$". Del carrito en adelante el precio sí se muestra completo:
  esconder la cifra cuando alguien va a pagar solo genera desconfianza.
- **El precio va anidado al final de la descripción**, no en una columna a
  la derecha. Una columna de precios crea un eje de lectura vertical que
  invita a comparar cifras y empuja hacia el plato más barato.
- **Sin líneas punteadas de guía.** Llevan la mirada de la descripción al
  número, justo lo contrario de lo que conviene.
- **La foto es el mecanismo de destacar**, con tope de dos por sección. Si
  todos los platos llevan foto, ninguno destaca. Qué platos la llevan se
  decide en `elegirDestacados()`, dentro de `components/Menu.tsx`.
- **Descripciones de 12 a 18 palabras con lenguaje sensorial.** El trabajo
  de Wansink en Cornell midió 27% más de ventas con etiquetas descriptivas
  frente a nombres escuetos.
- **Nombres de plato en serif y peso regular**, separación por filete fino y
  aire. El negrita y las cajas con borde son lenguaje de app, no de carta.

## Qué es real y qué está simulado

**Funciona de verdad:** toda la interfaz, el pedido en vivo de cliente a
cocina por Server-Sent Events, el carrito, el seguimiento del pedido, la
generación de QR, el visor 3D y el modo AR.

**Provisional:**

- Los pedidos se guardan **en memoria**: al reiniciar el servidor se pierden.
  Para producción el siguiente paso es mover `lib/order-store.ts` a Postgres
  (Supabase da además autenticación y almacenamiento de imágenes en su capa
  gratuita). Los tipos `Order` y `OrderItem` ya tienen la forma adecuada.
- No hay cuentas ni panel de administración: es un restaurante único, no
  multi-inquilino. Ese es el siguiente bloque si un restaurante dice que sí.
- Las fotos son de stock (Unsplash) y los modelos 3D son genéricos. Las dos
  cosas se reemplazan por material del restaurante.
- El AR por cámara funciona en **Android** (Scene Viewer) solo con el `.glb`.
  En **iPhone** (Quick Look) hace falta además un `.usdz` de cada plato; sin
  él, en iPhone queda el visor 3D interactivo pero no el modo cámara. Se
  añaden rellenando el campo `usdz` de `model3d` en `lib/data.ts`.

## Estructura

```
app/
  page.tsx                    → índice de la demo
  r/[slug]/page.tsx           → carta del comensal
  cocina/page.tsx             → pantalla de cocina
  admin/mesas/page.tsx        → generador de QR
  api/ai-assistant/route.ts   → asistente (motor local + Claude opcional)
  api/pedidos/…               → crear, listar, actualizar y stream en vivo
components/                   → Menu, DishCard, DishModal, Model3D, AIAssistant…
lib/
  data.ts                     → el menú completo. Se edita aquí y nada más.
  assistant.ts                → motor de comprensión y respuesta
  types.ts                    → tipos compartidos
  order-store.ts              → pedidos en memoria
public/models/                → los nueve modelos .glb a escala real
```

## Adaptarlo a otro restaurante

Todo el contenido vive en `lib/data.ts`: nombre, secciones, platos, precios,
fotos, ingredientes, alérgenos y modelos 3D. Para preparar una demo para
otro restaurante de Barinas basta con editar ese archivo.

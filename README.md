# Menú Premium — carta digital para restaurantes

Carta por QR con vista 3D de cada plato, prueba en la mesa con realidad
aumentada, asistente que conoce el menú y comanda en vivo hacia cocina.

## Qué incluye

1. **Carta del comensal** (`/r/fogon-barines?mesa=4`). Los nueve platos con
   vista 3D interactiva y proyección en la mesa a tamaño real. Carrito,
   envío a cocina y seguimiento del estado del pedido.
2. **Asistente de sala.** Ingredientes, alérgenos, dietas, precios,
   porciones y gramajes, macros, tiempos, qué se le puede quitar a cada
   plato y maridajes; y sugiere qué agregar a lo ya pedido. También busca
   al revés: "algo sin cebolla", "nada frito", "algo por menos de 10".
3. **Macros por plato.** Calorías y reparto de proteína, carbohidratos,
   grasa y fibra en cada ficha, calculados desde la receta.
4. **Pantalla de cocina** (`/cocina`). Tablero en vivo con sonido de alerta.
5. **Generador de QR por mesa** (`/admin/mesas`), listo para imprimir.

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

Cada pieza de comida lleva textura procedural (veta de la carne, marcas de
parrilla, poro del pan, ondas del ganache), superficie desplazada con ruido
para que nada se vea liso de fábrica, y rugosidad propia: un glaseado de
BBQ refleja como algo mojado y un pan no.

Se generan con los scripts de `herramientas/`, sin dependencias más allá de
numpy y Pillow:

```bash
python3 herramientas/build2.py      # reconstruye los 9 .glb
python3 herramientas/validate2.py   # escala real, apoyo en y=0, texturas
python3 herramientas/render2.py     # hoja de contactos para revisarlos
```

Detalles de peso que importan en una carta por QR, que se abre con datos
móviles: las texturas se embeben en JPEG y no en PNG (son ruido, donde PNG
no comprime), y los índices van a 16 bits. Entre las dos cosas el conjunto
baja de unos 6 MB a 3,4 MB.

Aun así **son modelos, no fotografías**: correctos en tamaño, proporción y
composición, bastante más creíbles que la primera versión, pero no
fotorrealistas. **Para un restaurante real el salto de calidad está en
escanear sus platos de verdad** con una app de fotogrametría (Polycam o
KIRI Engine, ambas exportan `.glb` desde el teléfono) y cambiar la ruta del
archivo en `lib/data.ts`. Una carta con los platos reales del restaurante
es el argumento de venta; modelos genéricos no lo son.

## El asistente

`lib/assistant.ts` resuelve las preguntas contra `lib/data.ts` y redacta la
respuesta. No usa servicios externos, no cuesta nada y **no puede inventar
un plato, un precio ni un ingrediente**, porque solo sabe lo que está en los
datos.

Entiende, sin nombrar necesariamente el plato: ingredientes, alérgenos,
dietas (y dos condiciones a la vez, tipo "sin gluten y sin mariscos"),
exclusiones por ingrediente ("algo sin cebolla", "mi hijo no come picante
ni cebolla", "nada frito"), búsqueda por ingrediente, macros y calorías
—de un plato o comparando toda la carta—, porciones y gramajes, qué admite
cambiar la cocina, presupuesto, antojos ("algo ligero", "para un niño",
"alto en proteína"), superlativos ("el más barato", "el que más rinde por
lo que cuesta"), tiempos, comparaciones, disponibilidad y maridajes.

Lo que NO sabe lo dice: wifi, pagos, reservas, la cuenta y horarios los
deriva al mesero en vez de inventárselos.

Hay un banco de pruebas con 66 preguntas reales, cada una con lo que la
respuesta tiene y no tiene que contener:

```bash
node herramientas/test_assistant.mjs
```

Merece la pena ejecutarlo después de tocar el motor, porque los fallos que
saca no son teóricos: así apareció que el alias "ron" del coctel encajaba
dentro de "camarones", y la pregunta "¿qué platos llevan camarones?" se
contestaba hablando de la bebida.

Si quieres que redacte con más naturalidad, define `ANTHROPIC_API_KEY` en
las variables de entorno de Vercel. El endpoint le pasa el mismo menú como
única fuente y, si la llamada falla, vuelve solo al motor local. Sin esa
clave todo sigue funcionando igual.

Para darle conocimiento sobre un plato se edita su entrada en `lib/data.ts`,
nunca el código del chatbot. Los campos `ingredientes`, `alergenos`,
`picante`, `minutos`, `personas`, `gramos`, `macros`, `ajustes`, `perfil`,
`combina` y `nota` son exactamente lo que el asistente usa para responder.

## Los macros

Están en `macros` de cada plato y se calculan con `herramientas/macros.py`:
el gramaje real de cada receta por valores de referencia por 100 g (USDA
FoodData Central para los alimentos básicos). Para cambiarlos se edita la
receta en ese script y se vuelve a ejecutar; el script además comprueba
cada plato contra la regla 4/4/9 kcal por gramo, que es lo que detecta un
error de tecleo en la tabla.

**Son estimaciones, y la interfaz lo dice en cada ficha.** El aceite que
absorbe una fritura o la mano del cocinero con la salsa mueven esto con
facilidad un 15%. Para publicarlos como información nutricional oficial
hace falta pesar las recetas propias, y en varios países eso activa
obligaciones legales de exactitud; conviene que el restaurante lo revise
antes de usarlos como argumento comercial.

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
- Las fotos son de stock (Unsplash) y los modelos 3D están hechos a mano
  para esta demo. Las dos cosas se reemplazan por material del restaurante.
- Los macros son estimados desde la receta, no analizados en laboratorio.
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
herramientas/
  build2.py                   → genera los 9 modelos
  glb2.py                     → exportador glTF (geometría, UV, texturas)
  tex.py                      → texturas procedurales de cada alimento
  macros.py                   → cálculo de macros desde las recetas
  validate2.py                → valida los .glb generados
  render2.py                  → los rasteriza a PNG para revisarlos
  test_assistant.mjs          → 66 preguntas contra el asistente
  check_macros.py             → los macros de data.ts vs. el cálculo
```

Las herramientas son de desarrollo: no se despliegan ni las necesita
Vercel, pero viajan con el repo para que los modelos y los macros se puedan
rehacer sin volver a empezar de cero.

## Adaptarlo a otro restaurante

Todo el contenido vive en `lib/data.ts`: nombre, secciones, platos, precios,
fotos, ingredientes, alérgenos, macros y modelos 3D. Para preparar una demo
para otro restaurante de Barinas basta con editar ese archivo.

import { restaurant } from "@/lib/data";

const SYSTEM_PROMPT = `Eres un asistente de recomendación de comida para "${restaurant.name}", un restaurante con cocina de brasa y sabores de los Llanos en Barinas.

Tu rol es:
1. Responder preguntas sobre los platos del menú con información detallada
2. Recomendar platos basado en preferencias del cliente (picante, vegetariano, mariscos, carnes, etc.)
3. Sugerir complementos para agregarle a un plato ya pedido
4. Describir ingredientes, tamaño de porción y sabores

Menú disponible:
${restaurant.dishes
  .filter((d) => d.available)
  .map(
    (d) =>
      `- ${d.name} ($${d.price}): ${d.description}. Porción: ${d.portion}. Tags: ${d.tags?.join(", ") || "ninguno"}`
  )
  .join("\n")}

Instrucciones:
- Sé amable y profesional
- Cuando el cliente pida recomendaciones para un plato, sugiere 1-2 complementos del menú que combinen bien
- Si el cliente pregunta qué contiene un plato, describe los ingredientes principales
- Fomenta el upselling sugiriendo bebidas o postres si es apropiado
- Responde siempre en español
- Mantén respuestas concisas (máximo 2-3 oraciones por recomendación)`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // En una app real, esto llamaría a Claude API
    // Por ahora, retornamos una respuesta de demo
    const userMessage = messages[messages.length - 1]?.content || "";

    // Recomendaciones basadas en palabras clave
    let response = "";

    if (
      userMessage.toLowerCase().includes("lomo") ||
      userMessage.toLowerCase().includes("steak")
    ) {
      response =
        "Excelente elección. El lomo a la parrilla (320g, $14) es perfecto con nuestro chimichurri de la casa. Le recomiendo acompañarlo con nuestro **Coctel de la casa** ($6) para una experiencia completa. ¿Le gustaría agregar un postre después? La torta de chocolate es espectacular.";
    } else if (
      userMessage.toLowerCase().includes("hamb") ||
      userMessage.toLowerCase().includes("burger")
    ) {
      response =
        "La hamburguesa premium Fogón ($9.50) es nuestra más pedida. Viene con queso ahumado, tocineta crocante y salsa especial. Para complementarla, sugiero el **Ceviche de camarones** ($7) como entrada. ¿Algo de beber?";
    } else if (userMessage.toLowerCase().includes("vegetar")) {
      response =
        "Para un menú vegetariano, le recomiendo la **Ensalada fresca de la casa** ($5.50) como entrada. Otros platos sin carne: la torta de chocolate ($4.50) de postre. ¿Le interesa conocer más detalles?";
    } else if (userMessage.toLowerCase().includes("recomend")) {
      response =
        "¿Qué tipo de comida le gusta? ¿Prefiere mariscos, carnes a la brasa, algo vegetariano, o algo ligero? Con esa info le doy la mejor recomendación.";
    } else if (userMessage.toLowerCase().includes("ingredient")) {
      response =
        "¿Cuál plato le interesa? Puedo describir en detalle qué lleva cada uno. Algunos destacados: el ceviche de camarones marinados en limón, el aguacate relleno con camarones al ajillo, y las costillas ahumadas 6 horas.";
    } else {
      response =
        "Bienvenido a Fogón Barinés. ¿En qué puedo ayudarte? Puedo recomendar platos, describir ingredientes, o sugerir complementos para tu pedido.";
    }

    return Response.json({
      content: response,
      recommendations: [],
    });
  } catch (error) {
    console.error("AI Assistant error:", error);
    return Response.json(
      { error: "Error al procesar tu pregunta" },
      { status: 500 }
    );
  }
}

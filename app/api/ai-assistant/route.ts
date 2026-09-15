import { responder, menuComoTexto } from "@/lib/assistant";
import { restaurant } from "@/lib/data";

export const runtime = "nodejs";

/**
 * Asistente del menú.
 *
 * Por defecto responde con el motor local de `lib/assistant.ts`: no cuesta
 * nada, no depende de terceros y solo puede afirmar lo que está en el menú.
 *
 * Si defines ANTHROPIC_API_KEY en las variables de entorno (en Vercel:
 * Settings -> Environment Variables), redacta con Claude usando ese mismo
 * menú como única fuente. Si la llamada falla por lo que sea, cae de vuelta
 * al motor local en lugar de dejar al cliente sin respuesta.
 */

const MODELO = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

function instrucciones(): string {
  return `Eres el asistente de sala de ${restaurant.name}, ${restaurant.tagline}.
Atiendes a un comensal que está sentado en su mesa mirando el menú en su teléfono.

CARTA DE HOY (única fuente de verdad):
${menuComoTexto()}

Reglas:
- Responde solo con información de la carta. Si te preguntan algo que no está
  ahí, dilo con naturalidad y reconduce al menú. Nunca inventes un plato, un
  precio, un ingrediente ni un dato nutricional.
- Los precios se escriben sin símbolo de moneda, tal como aparecen arriba.
- Si un plato está AGOTADO HOY, dilo y ofrece la alternativa más parecida.
- Con alergias sé literal y prudente: si el plato contiene el alérgeno, dilo
  claro y ofrece alternativas que no lo lleven. Recomienda avisar al mesero.
- Los macros de la carta son ESTIMACIONES calculadas desde la receta. Dilos
  como aproximados y no los presentes nunca como información nutricional
  declarada ni los uses para dar consejo de salud o de dieta. Si alguien
  pregunta por su alimentación por un motivo médico, remítelo a su médico.
- Si te preguntan por algo del local —wifi, pagos, reservas, la cuenta,
  horarios— di que eso lo resuelve el mesero. No te lo inventes.
- Cuando alguien ya eligió un plato, sugiere un acompañamiento o una bebida
  de la carta que combine, explicando en pocas palabras por qué.
- Español de Venezuela, tono cálido y directo, sin florituras.
- Dos o tres frases como máximo. Es un chat en un teléfono, no una carta.`;
}

async function conClaude(
  mensajes: { role: string; content: string }[]
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 400,
        system: instrucciones(),
        messages: mensajes
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      console.error("Anthropic respondió", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const texto = data?.content?.[0]?.text;
    return typeof texto === "string" && texto.trim() ? texto.trim() : null;
  } catch (e) {
    console.error("Fallo al llamar a Anthropic:", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mensajes = Array.isArray(body?.messages) ? body.messages : [];
    const ultima = mensajes[mensajes.length - 1]?.content;

    if (typeof ultima !== "string" || !ultima.trim()) {
      return Response.json(
        { error: "Falta el mensaje del usuario" },
        { status: 400 }
      );
    }
    if (ultima.length > 500) {
      return Response.json({
        texto: "Esa pregunta es muy larga. ¿Me la resumes en una frase?",
        platos: [],
        sugerencias: [],
        motor: "local",
      });
    }

    // El motor local siempre resuelve: da las tarjetas de plato y sirve de
    // red de seguridad si la llamada al modelo no está configurada o falla.
    const local = responder(ultima);
    const redactado = await conClaude(mensajes);

    return Response.json({
      texto: redactado ?? local.texto,
      platos: local.platos,
      sugerencias: local.sugerencias,
      motor: redactado ? "claude" : "local",
    });
  } catch (e) {
    console.error("Error en el asistente:", e);
    return Response.json(
      {
        texto:
          "Se me complicó procesar eso. ¿Lo intentas de nuevo con otras palabras?",
        platos: [],
        sugerencias: ["¿Qué me recomiendas?"],
        motor: "error",
      },
      { status: 200 }
    );
  }
}

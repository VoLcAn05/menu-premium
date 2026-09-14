import { NextRequest } from "next/server";
import { subscribe, listOrders } from "@/lib/order-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events: un flujo unidireccional del servidor hacia el
 * navegador. Se usa aquí en vez de WebSockets porque el caso de uso es
 * simple (solo el servidor empuja eventos, el cliente no necesita
 * responder por ese mismo canal) y SSE funciona sobre HTTP normal, sin
 * librerías adicionales ni servidor custom.
 *
 * Cada conexión (panel de cocina o cliente rastreando su pedido) recibe:
 * 1) un evento "snapshot" inicial con los pedidos actuales del restaurante
 * 2) eventos "created"/"updated" en vivo cuando algo cambia
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("restaurante");
  if (!slug) {
    return new Response("Falta el parámetro 'restaurante'.", { status: 400 });
  }

  const encoder = new TextEncoder();

  let unsubscribe: () => void = () => {};
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // snapshot inicial
      send("snapshot", { orders: listOrders(slug) });

      unsubscribe = subscribe((evt) => {
        if (evt.order.restaurantSlug !== slug) return;
        send(evt.type, { order: evt.order });
      });

      // keep-alive cada 25s para que proxies/navegadores no cierren la conexión
      keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 25000);
    },
    cancel() {
      unsubscribe();
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

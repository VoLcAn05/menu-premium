"use client";

import { useEffect, useState } from "react";
import { Order, OrderStatus } from "@/lib/types";
import { formatUSD, STATUS_LABEL } from "@/lib/format";

const STEPS: OrderStatus[] = ["nuevo", "en_preparacion", "listo", "entregado"];

export function OrderStatusTracker({
  order,
  restaurantSlug,
  onNewOrder,
}: {
  order: Order;
  restaurantSlug: string;
  onNewOrder: () => void;
}) {
  const [current, setCurrent] = useState<Order>(order);

  useEffect(() => {
    const es = new EventSource(
      `/api/pedidos/stream?restaurante=${encodeURIComponent(restaurantSlug)}`
    );
    const handle = (raw: MessageEvent) => {
      try {
        const data = JSON.parse(raw.data);
        if (data.order?.id === order.id) {
          setCurrent(data.order);
        }
      } catch {
        // ignorar mensajes malformados
      }
    };
    es.addEventListener("updated", handle);
    es.addEventListener("created", handle);
    return () => es.close();
  }, [order.id, restaurantSlug]);

  const stepIndex = STEPS.indexOf(current.status);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 text-3xl">
        ✅
      </div>
      <h2 className="font-display text-2xl font-semibold text-cream">
        ¡Pedido enviado a la cocina!
      </h2>
      <p className="mt-1 text-sm text-cream/60">
        Mesa {current.table} · Orden #{current.id.slice(-5).toUpperCase()}
      </p>

      <div className="mt-8 w-full">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => (
            <div key={step} className="flex flex-1 flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                  i <= stepIndex
                    ? "border-gold bg-gold text-ink"
                    : "border-white/20 text-cream/40"
                } ${i === stepIndex ? "animate-pulse-ring" : ""}`}
              >
                {i + 1}
              </div>
              <span
                className={`mt-2 text-center text-[11px] leading-tight ${
                  i <= stepIndex ? "text-cream" : "text-cream/40"
                }`}
              >
                {STATUS_LABEL[step]}
              </span>
            </div>
          ))}
        </div>
        <div className="relative mt-[-34px] h-0.5 px-4">
          <div className="h-full bg-white/10" />
          <div
            className="absolute left-4 top-0 h-0.5 bg-gold transition-all duration-500"
            style={{
              width: `calc(${(stepIndex / (STEPS.length - 1)) * 100}% - ${
                stepIndex === STEPS.length - 1 ? "32px" : "16px"
              })`,
            }}
          />
        </div>
      </div>

      <div className="mt-10 w-full rounded-2xl border border-white/10 bg-charcoal/60 p-4 text-left">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-cream/50">
          Resumen
        </p>
        <ul className="space-y-1">
          {current.items.map((item) => (
            <li
              key={item.dishId}
              className="flex justify-between text-sm text-cream/80"
            >
              <span>
                {item.qty} × {item.name}
              </span>
              <span>{formatUSD(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-sm font-semibold text-cream">
          <span>Total</span>
          <span>{formatUSD(current.total)}</span>
        </div>
      </div>

      <button
        onClick={onNewOrder}
        className="mt-6 rounded-full border border-gold/40 px-6 py-2.5 text-sm font-medium text-gold-light hover:bg-gold/10"
      >
        Hacer otro pedido
      </button>
    </div>
  );
}

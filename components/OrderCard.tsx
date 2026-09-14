"use client";

import { Order, OrderStatus } from "@/lib/types";
import { formatUSD } from "@/lib/format";

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  nuevo: "en_preparacion",
  en_preparacion: "listo",
  listo: "entregado",
};

const NEXT_LABEL: Record<OrderStatus, string> = {
  nuevo: "Empezar a preparar",
  en_preparacion: "Marcar como listo",
  listo: "Marcar como entregado",
  entregado: "Entregado",
};

function timeAgo(ts: number): string {
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 1) return "justo ahora";
  if (mins === 1) return "hace 1 min";
  return `hace ${mins} min`;
}

export function OrderCard({
  order,
  onAdvance,
}: {
  order: Order;
  onAdvance: (id: string, status: OrderStatus) => void;
}) {
  const next = NEXT_STATUS[order.status];
  const urgent = order.status === "nuevo";

  return (
    <div
      className={`flex flex-col rounded-2xl border bg-charcoal/70 p-4 shadow-premium transition-colors ${
        urgent ? "border-red-500/50" : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-lg font-bold text-cream">
          Mesa {order.table}
        </span>
        <span className="text-xs text-cream/40">{timeAgo(order.createdAt)}</span>
      </div>
      <p className="mb-2 text-[11px] uppercase tracking-wide text-cream/40">
        Orden #{order.id.slice(-5).toUpperCase()}
      </p>

      <ul className="mb-3 space-y-1.5">
        {order.items.map((item, i) => (
          <li key={i} className="text-sm text-cream/90">
            <span className="font-semibold text-gold-light">{item.qty}×</span>{" "}
            {item.name}
            {item.note && (
              <span className="block pl-4 text-xs italic text-cream/50">
                “{item.note}”
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-sm font-semibold text-cream/70">
          {formatUSD(order.total)}
        </span>
        {next && (
          <button
            onClick={() => onAdvance(order.id, next)}
            className="rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition-transform active:scale-95"
          >
            {NEXT_LABEL[order.status]}
          </button>
        )}
      </div>
    </div>
  );
}

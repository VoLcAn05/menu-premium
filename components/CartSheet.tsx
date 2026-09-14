"use client";

import { OrderItem } from "@/lib/types";
import { formatUSD } from "@/lib/format";

export function CartSheet({
  items,
  table,
  submitting,
  error,
  onClose,
  onRemove,
  onSubmit,
}: {
  items: OrderItem[];
  table: number | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onRemove: (dishId: string) => void;
  onSubmit: () => void;
}) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="animate-fade-in-up relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-charcoal shadow-premium sm:max-w-md sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-xl font-semibold text-cream">
            Tu pedido {table ? `· Mesa ${table}` : ""}
          </h2>
          <button
            onClick={onClose}
            className="text-cream/60 hover:text-cream"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-cream/50">
              Todavía no has agregado nada del menú.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {items.map((item) => (
                <li
                  key={item.dishId}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-cream">
                      {item.qty} × {item.name}
                    </p>
                    {item.note && (
                      <p className="mt-0.5 text-xs text-cream/50">
                        Nota: {item.note}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gold-light">
                      {formatUSD(item.price * item.qty)}
                    </span>
                    <button
                      onClick={() => onRemove(item.dishId)}
                      className="text-xs text-cream/40 hover:text-red-400"
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="px-5 pb-1 text-sm text-red-400">{error}</p>
        )}

        <div className="border-t border-white/10 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-cream/60">Total</span>
            <span className="font-display text-lg font-semibold text-cream">
              {formatUSD(total)}
            </span>
          </div>
          <button
            onClick={onSubmit}
            disabled={items.length === 0 || submitting || !table}
            className="w-full rounded-full bg-gold py-3 text-center font-display text-sm font-semibold text-ink shadow-premium transition-transform disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
          >
            {submitting
              ? "Enviando a la cocina..."
              : !table
              ? "Falta identificar tu mesa"
              : "Enviar pedido a la cocina"}
          </button>
        </div>
      </div>
    </div>
  );
}

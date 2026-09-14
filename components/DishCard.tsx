"use client";

import { Dish } from "@/lib/types";
import { formatUSD } from "@/lib/format";

export function DishCard({
  dish,
  onOpen,
}: {
  dish: Dish;
  onOpen: (dish: Dish) => void;
}) {
  return (
    <button
      onClick={() => onOpen(dish)}
      disabled={!dish.available}
      className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-charcoal/60 p-3 text-left transition-all hover:border-gold/40 hover:bg-charcoal active:scale-[0.99] ${
        !dish.available ? "opacity-50" : ""
      }`}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dish.image}
          alt={dish.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        {dish.model3d && (
          <span className="absolute bottom-1 left-1 rounded-full bg-gold/95 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink shadow">
            3D
          </span>
        )}
        {!dish.available && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="rounded bg-black/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
              Agotado
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-semibold leading-snug text-cream">
            {dish.name}
          </h3>
          <span className="shrink-0 font-display text-base font-semibold text-gold-light">
            {formatUSD(dish.price)}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-cream/60">
          {dish.description}
        </p>
        {dish.tags && dish.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {dish.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold-light"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

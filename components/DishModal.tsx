"use client";

import { useEffect, useState } from "react";
import { Dish } from "@/lib/types";
import { formatUSD } from "@/lib/format";
import { Model3D } from "./Model3D";

export function DishModal({
  dish,
  onClose,
  onAdd,
}: {
  dish: Dish;
  onClose: () => void;
  onAdd: (dish: Dish, qty: number, note?: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [view, setView] = useState<"foto" | "3d">("foto");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="animate-fade-in-up relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-charcoal shadow-premium sm:max-w-lg sm:rounded-3xl">
        <div className="relative h-64 shrink-0 bg-black">
          {dish.model3d && (
            <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-full bg-black/50 p-1 backdrop-blur">
              <button
                onClick={() => setView("foto")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  view === "foto"
                    ? "bg-gold text-ink"
                    : "text-cream/70 hover:text-cream"
                }`}
              >
                Foto
              </button>
              <button
                onClick={() => setView("3d")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  view === "3d"
                    ? "bg-gold text-ink"
                    : "text-cream/70 hover:text-cream"
                }`}
              >
                Ver en 3D
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-cream backdrop-blur hover:bg-black/70"
            aria-label="Cerrar"
          >
            ✕
          </button>

          {dish.model3d && view === "3d" ? (
            <Model3D
              glb={dish.model3d.glb}
              usdz={dish.model3d.usdz}
              alt={dish.name}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dish.image}
              alt={dish.name}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-28 pt-4">
          <h2 className="font-display text-2xl font-semibold text-cream">
            {dish.name}
          </h2>
          {dish.portion && (
            <p className="mt-1 text-sm text-gold-light">{dish.portion}</p>
          )}
          <p className="mt-3 text-sm leading-relaxed text-cream/70">
            {dish.description}
          </p>

          {dish.tags && dish.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {dish.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold-light"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-cream/50">
              Nota para la cocina (opcional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. sin cebolla, término medio..."
              className="w-full rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-gold/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 border-t border-white/10 bg-charcoal/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3 rounded-full border border-white/15 px-1">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-9 w-9 items-center justify-center text-lg text-cream/80 hover:text-gold"
              aria-label="Restar"
            >
              −
            </button>
            <span className="w-4 text-center font-semibold text-cream">
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="flex h-9 w-9 items-center justify-center text-lg text-cream/80 hover:text-gold"
              aria-label="Sumar"
            >
              +
            </button>
          </div>

          <button
            onClick={() => {
              onAdd(dish, qty, note.trim() || undefined);
              onClose();
            }}
            className="flex-1 rounded-full bg-gold py-3 text-center font-display text-sm font-semibold text-ink shadow-premium transition-transform active:scale-[0.98]"
          >
            Agregar · {formatUSD(dish.price * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}

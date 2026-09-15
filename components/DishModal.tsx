"use client";

import { useEffect, useState } from "react";
import { Dish } from "@/lib/types";
import { precioCarta, formatUSD } from "@/lib/format";
import { Model3D } from "./Model3D";

const NIVEL_PICANTE = [
  null,
  "Picante suave",
  "Picante medio",
  "Bastante picante",
];

function Dato({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-cream/12 px-2.5 py-1 text-[0.7rem] text-cream/55">
      {children}
    </span>
  );
}

/**
 * Bloque de macros del plato.
 *
 * Decisiones que no son estéticas:
 *
 * - Las kcal van grandes y los gramos pequeños, porque es la cifra que la
 *   gente busca primero.
 * - La barra reparte la ENERGÍA, no los gramos: 1 g de grasa aporta 9 kcal
 *   y 1 g de proteína 4, así que una barra por peso daría una idea falsa
 *   de qué domina el plato.
 * - Dice "aproximados" y explica de dónde salen. Son estimaciones desde la
 *   receta, no un análisis de laboratorio, y presentarlas como dato exacto
 *   sería mentirle a alguien que puede estar decidiendo por salud.
 */
function Macros({ dish }: { dish: Dish }) {
  const m = dish.macros;
  if (!m) return null;

  const energia = [
    { clave: "Proteína", g: m.proteina, kcal: m.proteina * 4, color: "bg-gold" },
    {
      clave: "Carbohidratos",
      g: m.carbohidratos,
      kcal: m.carbohidratos * 4,
      color: "bg-gold/55",
    },
    { clave: "Grasa", g: m.grasa, kcal: m.grasa * 9, color: "bg-gold/25" },
  ];
  const total = energia.reduce((s, x) => s + x.kcal, 0) || 1;

  return (
    <section className="filete mt-6 pt-5">
      <h3 className="text-[0.68rem] uppercase tracking-seccion text-cream/40">
        Información nutricional aproximada
      </h3>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-[2rem] leading-none text-gold-light">
          {m.kcal}
        </span>
        <span className="text-[0.8rem] text-cream/50">
          kcal
          {dish.gramos ? ` · ${dish.gramos} g servidos` : ""}
          {dish.personas >= 2 ? " · plato completo, alcanza para dos" : ""}
        </span>
      </div>

      {/* gap-px separa los tramos: tres tonos del mismo dorado se funden
          en una sola barra si se tocan. */}
      <div className="mt-3 flex h-1.5 gap-px overflow-hidden rounded-full bg-cream/10">
        {energia.map((x) => (
          <div
            key={x.clave}
            className={x.color}
            style={{ width: `${(x.kcal / total) * 100}%` }}
            title={`${x.clave}: ${Math.round((x.kcal / total) * 100)}% de las calorías`}
          />
        ))}
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[...energia, { clave: "Fibra", g: m.fibra }].map((x) => (
          <div key={x.clave}>
            <dt className="text-[0.62rem] uppercase tracking-wide text-cream/35">
              {x.clave}
            </dt>
            <dd className="mt-0.5 text-[0.95rem] text-cream/80">{x.g} g</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[0.72rem] leading-relaxed text-cream/35">
        Valores estimados a partir de la receta, no de un análisis de
        laboratorio. Pueden variar según el tamaño de la pieza y la mano del
        cocinero.
      </p>
    </section>
  );
}

export function DishModal({
  dish,
  complementos,
  onClose,
  onAdd,
  onOpenDish,
}: {
  dish: Dish;
  /** Platos que combinan con este, ya filtrados a los disponibles. */
  complementos: Dish[];
  onClose: () => void;
  onAdd: (dish: Dish, qty: number, note?: string) => void;
  onOpenDish: (dish: Dish) => void;
}) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [vista, setVista] = useState<"foto" | "3d">("foto");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const picante = NIVEL_PICANTE[dish.picante];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="animate-fade-in-up relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-charcoal shadow-premium sm:max-w-lg sm:rounded-2xl">
        {/* ---------------------------------------------------- cabecera */}
        <div className="relative h-72 shrink-0 bg-ink">
          {dish.model3d && (
            <div className="absolute right-3 top-3 z-10 flex gap-0.5 rounded-full border border-cream/12 bg-ink/70 p-0.5 backdrop-blur">
              {(["foto", "3d"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  className={`rounded-full px-3.5 py-1.5 text-[0.7rem] font-medium transition-colors ${
                    vista === v
                      ? "bg-gold text-ink"
                      : "text-cream/65 hover:text-cream"
                  }`}
                >
                  {v === "foto" ? "Foto" : "Ver en 3D"}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-cream/12 bg-ink/70 text-cream/80 backdrop-blur hover:text-cream"
            aria-label="Cerrar"
          >
            ✕
          </button>

          {dish.model3d && vista === "3d" ? (
            <Model3D
              glb={dish.model3d.glb}
              usdz={dish.model3d.usdz}
              alt={dish.name}
              medidas={dish.model3d.medidas}
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dish.image}
                alt={dish.name}
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-charcoal to-transparent" />
            </>
          )}
        </div>

        {/* ---------------------------------------------------- contenido */}
        <div className="flex-1 overflow-y-auto px-6 pb-28 pt-5">
          <h2 className="font-display text-[1.75rem] font-normal leading-tight text-cream">
            {dish.name}
          </h2>

          <p className="mt-2.5 text-[0.9rem] leading-relaxed text-cream/60">
            {dish.description}{" "}
            <span className="font-medium text-gold-light">
              {precioCarta(dish.price)}
            </span>
          </p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {dish.portion && <Dato>{dish.portion}</Dato>}
            <Dato>Listo en ~{dish.minutos} min</Dato>
            {picante && (
              <Dato>
                {picante}
                {dish.picanteOpcional ? " (opcional)" : ""}
              </Dato>
            )}
            {dish.dietas?.map((d) => (
              <Dato key={d}>{d}</Dato>
            ))}
          </div>

          <section className="filete mt-6 pt-5">
            <h3 className="text-[0.68rem] uppercase tracking-seccion text-cream/40">
              Lleva
            </h3>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-cream/70">
              {dish.ingredientes.join(" · ")}
            </p>
          </section>

          {dish.alergenos.length > 0 && (
            <section className="mt-5">
              <h3 className="text-[0.68rem] uppercase tracking-seccion text-cream/40">
                Alérgenos
              </h3>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-cream/70">
                Contiene {dish.alergenos.join(", ")}. Si tienes alguna alergia,
                avísale al mesero al pedir.
              </p>
            </section>
          )}

          <Macros dish={dish} />

          {dish.ajustes && dish.ajustes.length > 0 && (
            <section className="mt-5">
              <h3 className="text-[0.68rem] uppercase tracking-seccion text-cream/40">
                Se puede pedir
              </h3>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-cream/70">
                {dish.ajustes.join(" · ")}
              </p>
            </section>
          )}

          {dish.nota && (
            <p className="mt-5 border-l-2 border-gold/35 pl-3 text-[0.82rem] italic leading-relaxed text-cream/50">
              {dish.nota}
            </p>
          )}

          {/* Sugerencia de acompañamiento: el upsell del mesero, aquí. */}
          {complementos.length > 0 && (
            <section className="filete mt-6 pt-5">
              <h3 className="text-[0.68rem] uppercase tracking-seccion text-cream/40">
                Va bien con
              </h3>
              <div className="mt-3 space-y-2">
                {complementos.slice(0, 2).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onOpenDish(c)}
                    className="flex w-full items-center gap-3 rounded-lg border border-cream/10 p-2.5 text-left transition-colors hover:border-gold/35"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.image}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded object-cover"
                      loading="lazy"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[1rem] text-cream">
                        {c.name}
                      </span>
                      <span className="text-[0.75rem] text-cream/45">
                        {precioCarta(c.price)}
                      </span>
                    </span>
                    <span className="shrink-0 text-cream/30">›</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="mt-6">
            <label
              htmlFor="nota-cocina"
              className="mb-2 block text-[0.68rem] uppercase tracking-seccion text-cream/40"
            >
              Nota para la cocina
            </label>
            <input
              id="nota-cocina"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Sin cebolla, término medio…"
              maxLength={120}
              className="w-full rounded-lg border border-cream/10 bg-ink px-3 py-2.5 text-[0.875rem] text-cream placeholder:text-cream/25 focus:border-gold/45 focus:outline-none"
            />
          </div>
        </div>

        {/* ---------------------------------------------------- acciones */}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 border-t border-cream/10 bg-charcoal/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center rounded-full border border-cream/15">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-10 w-10 items-center justify-center text-lg text-cream/70 hover:text-gold"
              aria-label="Quitar uno"
            >
              −
            </button>
            <span className="w-5 text-center text-sm font-medium text-cream">
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => Math.min(20, q + 1))}
              className="flex h-10 w-10 items-center justify-center text-lg text-cream/70 hover:text-gold"
              aria-label="Agregar uno"
            >
              +
            </button>
          </div>

          <button
            onClick={() => {
              onAdd(dish, qty, note.trim() || undefined);
              onClose();
            }}
            className="flex-1 rounded-full bg-gold py-3.5 text-center text-sm font-semibold text-ink transition-transform active:scale-[0.98]"
          >
            Agregar · {formatUSD(dish.price * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}

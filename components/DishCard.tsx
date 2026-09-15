"use client";

import { Dish } from "@/lib/types";
import { precioCarta } from "@/lib/format";

/**
 * Una línea de la carta.
 *
 * Decisiones tomadas de cómo componen su carta los restaurantes de alta
 * cocina, adaptadas a un menú digital donde además se pide:
 *
 * - El precio va ANIDADO al final de la descripción, no en una columna a la
 *   derecha. Una columna de precios crea un eje de lectura vertical que
 *   invita a comparar cifras y empuja al plato más barato.
 * - Sin símbolo de moneda y sin decimales de relleno.
 * - Nombre en serif, peso regular. El negrita en el nombre del plato es de
 *   carta de cadena, no de restaurante de manteles.
 * - Separación por filete fino y aire, nunca por cajas con borde.
 * - La foto es el mecanismo de destacado: solo la llevan los platos que el
 *   restaurante quiere mover. Si todo destaca, nada destaca.
 */

export function DishCard({
  dish,
  destacado = false,
  onOpen,
}: {
  dish: Dish;
  destacado?: boolean;
  onOpen: (dish: Dish) => void;
}) {
  const agotado = !dish.available;

  return (
    <button
      onClick={() => onOpen(dish)}
      disabled={agotado}
      className={`group block w-full text-left transition-opacity ${
        agotado ? "cursor-default opacity-45" : "active:opacity-70"
      }`}
    >
      {destacado && (
        <div className="relative mb-4 aspect-[16/10] w-full overflow-hidden rounded-sm bg-ember">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dish.image}
            alt={dish.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
          {dish.model3d && (
            <span className="absolute bottom-3 left-3 rounded-full border border-cream/25 bg-ink/65 px-2.5 py-1 text-[10px] font-medium uppercase tracking-seccion text-cream/90 backdrop-blur">
              Ver en 3D
            </span>
          )}
          {agotado && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/70">
              <span className="text-[11px] uppercase tracking-seccion text-cream/80">
                Agotado hoy
              </span>
            </div>
          )}
        </div>
      )}

      <h3 className="font-display text-[1.32rem] font-normal leading-[1.15] text-cream">
        {dish.name}
      </h3>

      <p className="mt-1.5 text-[0.875rem] leading-[1.55] text-cream/55">
        {dish.description}{" "}
        <span className="whitespace-nowrap font-medium text-gold-light">
          {precioCarta(dish.price)}
        </span>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem] text-cream/35">
        {dish.portion && <span>{dish.portion}</span>}
        {/*
          Las kcal van aquí y no en el nombre del plato: informan a quien
          las busca sin convertir la carta en una tabla nutricional. El
          desglose completo está dentro de la ficha.
        */}
        {dish.macros && <span>~{dish.macros.kcal} kcal</span>}
        {!destacado && dish.model3d && !agotado && (
          <span className="text-gold/70">Ver en 3D</span>
        )}
        {agotado && (
          <span className="uppercase tracking-seccion text-cream/50">
            Agotado hoy
          </span>
        )}
      </div>
    </button>
  );
}

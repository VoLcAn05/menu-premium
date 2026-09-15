"use client";

import { useEffect, useMemo, useState } from "react";
import { Restaurant, Dish, OrderItem, Order } from "@/lib/types";
import { CategoryNav } from "./CategoryNav";
import { DishCard } from "./DishCard";
import { DishModal } from "./DishModal";
import { CartSheet } from "./CartSheet";
import { OrderStatusTracker } from "./OrderStatusTracker";
import { AIAssistant } from "./AIAssistant";
import { formatUSD, precioCarta } from "@/lib/format";

/**
 * Cuáles platos llevan foto.
 *
 * La foto es el mecanismo de destacado de esta carta: si todos los platos la
 * llevan, ninguno destaca y la pantalla se vuelve un catálogo. Se la quedan
 * los que el restaurante quiere mover — el plato de la casa y los más
 * pedidos — con un tope de dos por sección, porque a partir de ahí el
 * efecto se diluye.
 */
function elegirDestacados(dishes: Dish[]): Set<string> {
  const out = new Set<string>();
  const porCategoria = new Map<string, Dish[]>();
  for (const d of dishes) {
    porCategoria.set(d.category, [...(porCategoria.get(d.category) ?? []), d]);
  }
  for (const platos of porCategoria.values()) {
    const marcados = platos.filter((d) =>
      d.tags?.some((t) => /estrella|pedido/.test(t))
    );
    const elegidos = (marcados.length ? marcados : platos.slice(0, 1)).slice(0, 2);
    for (const d of elegidos) out.add(d.id);
  }
  return out;
}

export function Menu({
  restaurant,
  table,
}: {
  restaurant: Restaurant;
  table: number | null;
}) {
  const [active, setActive] = useState(restaurant.categories[0]?.id ?? "");
  const [openDish, setOpenDish] = useState<Dish | null>(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [sugerencia, setSugerencia] = useState<Dish | null>(null);

  const destacados = useMemo(
    () => elegirDestacados(restaurant.dishes),
    [restaurant]
  );

  const dishesByCategory = useMemo(
    () =>
      restaurant.categories.map((c) => ({
        category: c,
        dishes: restaurant.dishes.filter((d) => d.category === c.id),
      })),
    [restaurant]
  );

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  /** Complementos de un plato que están disponibles y aún no se han pedido. */
  function complementosDe(dish: Dish): Dish[] {
    const yaEnCarrito = new Set(cart.map((i) => i.dishId));
    return (dish.combina ?? [])
      .map((id) => restaurant.dishes.find((d) => d.id === id))
      .filter(
        (d): d is Dish => !!d && d.available && !yaEnCarrito.has(d.id)
      );
  }

  function addToCart(dish: Dish, qty: number, note?: string) {
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.dishId === dish.id && i.note === note
      );
      if (existing) {
        return prev.map((i) =>
          i === existing ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [
        ...prev,
        { dishId: dish.id, name: dish.name, price: dish.price, qty, note },
      ];
    });
    // El momento del mesero: acabas de pedir algo, te ofrece lo que le va.
    setSugerencia(complementosDe(dish)[0] ?? null);
  }

  useEffect(() => {
    if (!sugerencia) return;
    const t = setTimeout(() => setSugerencia(null), 9000);
    return () => clearTimeout(t);
  }, [sugerencia]);

  function removeFromCart(dishId: string) {
    setCart((prev) => prev.filter((i) => i.dishId !== dishId));
  }

  async function submitOrder() {
    if (!table) {
      setError("No se detectó el número de mesa. Escanea el QR de tu mesa.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: restaurant.slug,
          table,
          items: cart,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar el pedido.");
      setConfirmedOrder(data.order as Order);
      setCart([]);
      setCartOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmedOrder) {
    return (
      <OrderStatusTracker
        order={confirmedOrder}
        restaurantSlug={restaurant.slug}
        onNewOrder={() => setConfirmedOrder(null)}
      />
    );
  }

  return (
    <div className="min-h-screen pb-32">
      {/* ------------------------------------------------------ cabecera */}
      <header className="px-6 pb-8 pt-12 text-center">
        <p className="text-[0.68rem] uppercase tracking-seccion text-gold/70">
          {table ? `Mesa ${table}` : "Carta"}
        </p>
        <h1 className="mt-3 font-display text-[2.6rem] font-light leading-[1.05] text-cream">
          {restaurant.name}
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-[0.82rem] leading-relaxed text-cream/45">
          {restaurant.tagline}
        </p>
        <div className="mx-auto mt-7 h-px w-12 bg-gold/35" />

        {!table && (
          <p className="mx-auto mt-6 max-w-sm rounded-lg border border-gold/25 px-4 py-3 text-left text-[0.75rem] leading-relaxed text-cream/50">
            No se detectó tu mesa. Para probar el pedido, abre la carta con el
            número de mesa en el enlace, por ejemplo{" "}
            <code className="text-gold-light">
              /r/{restaurant.slug}?mesa=4
            </code>
            .
          </p>
        )}
      </header>

      <CategoryNav
        categories={restaurant.categories}
        active={active}
        onSelect={(id) => {
          setActive(id);
          document
            .getElementById(`cat-${id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      {/* --------------------------------------------------------- carta */}
      <div className="mx-auto max-w-xl px-6">
        {dishesByCategory.map(({ category, dishes }) => (
          <section
            key={category.id}
            id={`cat-${category.id}`}
            className="scroll-mt-20 pt-14"
          >
            <div className="text-center">
              <h2 className="text-[0.72rem] uppercase tracking-seccion text-gold/75">
                {category.name}
              </h2>
              {category.intro && (
                <p className="mt-1.5 font-display text-[0.95rem] italic text-cream/35">
                  {category.intro}
                </p>
              )}
            </div>

            <div className="mt-8 space-y-8">
              {dishes.map((dish, i) => (
                <div key={dish.id} className={i > 0 ? "filete pt-8" : ""}>
                  <DishCard
                    dish={dish}
                    destacado={destacados.has(dish.id)}
                    onOpen={setOpenDish}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}

        <p className="filete mt-16 pt-8 text-center text-[0.7rem] leading-relaxed text-cream/25">
          Los platos con vista 3D se pueden ver a tamaño real sobre tu mesa.
          <br />
          Si tienes alguna alergia, avísale al mesero al pedir.
        </p>
      </div>

      {/* ------------------------------------------------------- capas */}
      {openDish && (
        <DishModal
          dish={openDish}
          complementos={complementosDe(openDish)}
          onClose={() => setOpenDish(null)}
          onAdd={addToCart}
          onOpenDish={setOpenDish}
        />
      )}

      {cartOpen && (
        <CartSheet
          items={cart}
          table={table}
          submitting={submitting}
          error={error}
          onClose={() => setCartOpen(false)}
          onRemove={removeFromCart}
          onSubmit={submitOrder}
        />
      )}

      <AIAssistant
        dishes={restaurant.dishes}
        cart={cart}
        onOpenDish={setOpenDish}
      />

      {/* Sugerencia tras agregar: lo que ofrecería el mesero en ese momento */}
      {sugerencia && !cartOpen && !openDish && (
        <button
          onClick={() => {
            setOpenDish(sugerencia);
            setSugerencia(null);
          }}
          className="animate-fade-in-up fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-gold/30 bg-charcoal/95 p-3 text-left shadow-premium backdrop-blur sm:inset-x-auto sm:right-6 sm:w-80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sugerencia.image}
            alt=""
            className="h-12 w-12 shrink-0 rounded object-cover"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.68rem] uppercase tracking-seccion text-gold/70">
              Va bien con eso
            </span>
            <span className="block truncate font-display text-[1.05rem] text-cream">
              {sugerencia.name}
            </span>
          </span>
          <span className="shrink-0 text-[0.8rem] text-gold-light">
            {precioCarta(sugerencia.price)}
          </span>
        </button>
      )}

      {cartCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-5 z-40 mx-auto flex max-w-xl items-center justify-between rounded-full bg-gold px-6 py-3.5 text-ink shadow-premium transition-transform active:scale-[0.98] sm:inset-x-auto sm:right-6 sm:w-80"
        >
          <span className="text-sm font-semibold">
            Ver pedido · {cartCount} {cartCount === 1 ? "plato" : "platos"}
          </span>
          <span className="text-sm font-semibold">{formatUSD(cartTotal)}</span>
        </button>
      )}
    </div>
  );
}

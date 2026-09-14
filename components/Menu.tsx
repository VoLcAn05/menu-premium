"use client";

import { useMemo, useState } from "react";
import { Restaurant, Dish, OrderItem, Order } from "@/lib/types";
import { CategoryNav } from "./CategoryNav";
import { DishCard } from "./DishCard";
import { DishModal } from "./DishModal";
import { CartSheet } from "./CartSheet";
import { OrderStatusTracker } from "./OrderStatusTracker";
import { formatUSD } from "@/lib/format";

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

  const dishesByCategory = useMemo(() => {
    return restaurant.categories.map((c) => ({
      category: c,
      dishes: restaurant.dishes.filter((d) => d.category === c.id),
    }));
  }, [restaurant]);

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

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
  }

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
    <div className="min-h-screen pb-28">
      <header className="border-b border-white/10 px-5 pb-6 pt-8">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 font-display text-lg font-bold text-gold">
            {restaurant.logoInitial}
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-cream">
              {restaurant.name}
            </h1>
            <p className="text-sm text-cream/50">{restaurant.tagline}</p>
          </div>
        </div>
        {table ? (
          <p className="mx-auto mt-4 max-w-2xl text-xs font-medium uppercase tracking-wide text-gold-light">
            Mesa {table}
          </p>
        ) : (
          <p className="mx-auto mt-4 max-w-2xl rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            No se detectó tu mesa. Este enlace no trae "?mesa=" — solo para
            probar el menú puedes abrir, por ejemplo, /r/{restaurant.slug}
            ?mesa=4
          </p>
        )}
      </header>

      <div className="mx-auto max-w-2xl">
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

        <div className="space-y-8 px-4 pt-4">
          {dishesByCategory.map(({ category, dishes }) => (
            <section key={category.id} id={`cat-${category.id}`}>
              <h2 className="mb-3 font-display text-lg font-semibold text-cream">
                {category.name}
              </h2>
              <div className="space-y-3">
                {dishes.map((dish) => (
                  <DishCard key={dish.id} dish={dish} onOpen={setOpenDish} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {openDish && (
        <DishModal
          dish={openDish}
          onClose={() => setOpenDish(null)}
          onAdd={addToCart}
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

      {cartCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-2xl items-center justify-between rounded-full bg-gold px-5 py-3.5 text-ink shadow-premium transition-transform active:scale-[0.98] sm:inset-x-auto sm:right-6 sm:w-96"
        >
          <span className="font-display text-sm font-semibold">
            Ver pedido · {cartCount} {cartCount === 1 ? "ítem" : "ítems"}
          </span>
          <span className="font-display text-sm font-semibold">
            {formatUSD(cartTotal)}
          </span>
        </button>
      )}
    </div>
  );
}

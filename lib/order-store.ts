import { Order, OrderItem, OrderStatus } from "./types";

/**
 * Store de pedidos en memoria para la demo.
 *
 * Por qué en memoria y no una base de datos externa: esto es un software
 * base para DEMOSTRAR el flujo completo (cliente pide → cocina recibe en
 * vivo) sin pedirle al restaurante que cree cuentas en ningún servicio
 * externo antes de decidir si les interesa. Es intencional para esta etapa.
 *
 * Para producción real (persistencia entre reinicios, múltiples
 * instancias del servidor, historial de pedidos), el reemplazo natural es
 * Postgres + Supabase Realtime, manteniendo la misma forma de datos
 * (Order/OrderItem) — el resto del código (rutas API, componentes) casi
 * no cambia.
 *
 * Se guarda en `globalThis` para sobrevivir al hot-reload de Next.js en
 * modo desarrollo (si no, cada recarga de un archivo borraría los pedidos).
 */

type Listener = (event: OrderEvent) => void;

export type OrderEvent =
  | { type: "created"; order: Order }
  | { type: "updated"; order: Order };

type Store = {
  orders: Map<string, Order>;
  listeners: Set<Listener>;
};

const globalForStore = globalThis as unknown as { __orderStore?: Store };

function getStore(): Store {
  if (!globalForStore.__orderStore) {
    globalForStore.__orderStore = {
      orders: new Map(),
      listeners: new Set(),
    };
  }
  return globalForStore.__orderStore;
}

function broadcast(event: OrderEvent) {
  const store = getStore();
  for (const listener of store.listeners) {
    try {
      listener(event);
    } catch {
      // un listener roto no debe tumbar a los demás
    }
  }
}

export function createOrder(params: {
  restaurantSlug: string;
  table: number;
  items: OrderItem[];
}): Order {
  const store = getStore();
  const now = Date.now();
  const total = params.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const order: Order = {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    restaurantSlug: params.restaurantSlug,
    table: params.table,
    items: params.items,
    total,
    status: "nuevo",
    createdAt: now,
    updatedAt: now,
  };
  store.orders.set(order.id, order);
  broadcast({ type: "created", order });
  return order;
}

export function listOrders(restaurantSlug: string): Order[] {
  const store = getStore();
  return Array.from(store.orders.values())
    .filter((o) => o.restaurantSlug === restaurantSlug)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getOrder(id: string): Order | undefined {
  return getStore().orders.get(id);
}

export function updateOrderStatus(
  id: string,
  status: OrderStatus
): Order | undefined {
  const store = getStore();
  const order = store.orders.get(id);
  if (!order) return undefined;
  order.status = status;
  order.updatedAt = Date.now();
  broadcast({ type: "updated", order });
  return order;
}

export function subscribe(listener: Listener): () => void {
  const store = getStore();
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

"use client";

import { useEffect, useRef, useState } from "react";
import { restaurant } from "@/lib/data";
import { Order, OrderStatus } from "@/lib/types";
import { OrderCard } from "@/components/OrderCard";

/** Beep corto generado con Web Audio API — sin depender de un archivo de audio externo. */
function playBeep() {
  try {
    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    // el navegador puede bloquear audio sin interacción previa del usuario; no es crítico
  }
}

const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: "nuevo", title: "Nuevos" },
  { status: "en_preparacion", title: "En preparación" },
  { status: "listo", title: "Listos para servir" },
];

export default function CocinaPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const hasLoadedOnce = useRef(false);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    const es = new EventSource(
      `/api/pedidos/stream?restaurante=${encodeURIComponent(restaurant.slug)}`
    );

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.addEventListener("snapshot", (raw: MessageEvent) => {
      const data = JSON.parse(raw.data);
      setOrders(data.orders);
      hasLoadedOnce.current = true;
    });

    es.addEventListener("created", (raw: MessageEvent) => {
      const data = JSON.parse(raw.data);
      setOrders((prev) => [...prev, data.order]);
      if (hasLoadedOnce.current && soundOn) playBeep();
    });

    es.addEventListener("updated", (raw: MessageEvent) => {
      const data = JSON.parse(raw.data);
      setOrders((prev) =>
        prev.map((o) => (o.id === data.order.id ? data.order : o))
      );
    });

    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function advance(id: string, status: OrderStatus) {
    // actualización optimista para que la cocina sienta la UI instantánea
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
    await fetch(`/api/pedidos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  const delivered = orders.filter((o) => o.status === "entregado");

  return (
    <div className="min-h-screen bg-ink px-4 py-6 sm:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-cream">
            Comanda de cocina
          </h1>
          <p className="text-sm text-cream/50">{restaurant.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              connected
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            {connected ? "En vivo" : "Reconectando..."}
          </span>
          <button
            onClick={() => setSoundOn((s) => !s)}
            className="rounded-full border border-white/15 px-3 py-1 text-xs text-cream/70 hover:text-cream"
          >
            🔔 Sonido {soundOn ? "activado" : "silenciado"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colOrders = orders
            .filter((o) => o.status === col.status)
            .sort((a, b) => a.createdAt - b.createdAt);
          return (
            <div key={col.status}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-cream/60">
                {col.title}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-cream/50">
                  {colOrders.length}
                </span>
              </h2>
              <div className="space-y-3">
                {colOrders.length === 0 && (
                  <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-cream/30">
                    Sin pedidos aquí
                  </p>
                )}
                {colOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onAdvance={advance} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {delivered.length > 0 && (
        <p className="mt-8 text-center text-xs text-cream/30">
          {delivered.length} pedido(s) entregados en esta sesión.
        </p>
      )}
    </div>
  );
}

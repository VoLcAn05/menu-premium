"use client";

import { useEffect, useRef, useState } from "react";
import type { Dish, OrderItem } from "@/lib/types";
import { precioCarta } from "@/lib/format";

/**
 * Asistente de sala.
 *
 * Responde contra el menú real (ver lib/assistant.ts) y devuelve, además del
 * texto, los platos a los que se refiere. Esos platos se muestran como
 * tarjetas para que el comensal pueda abrirlos sin tener que buscarlos en la
 * carta: la recomendación termina en el plato abierto, no en un párrafo.
 */

type Mensaje = {
  id: string;
  rol: "user" | "assistant";
  texto: string;
  platos?: string[];
  sugerencias?: string[];
};

const BIENVENIDA: Mensaje = {
  id: "0",
  rol: "assistant",
  texto:
    "Buenas. Conozco la carta completa: qué lleva cada plato, alérgenos, " +
    "cuánto rinde, calorías y macros, qué se le puede quitar y con qué " +
    "combina. También al revés: «algo sin cebolla», «nada frito», «algo " +
    "por menos de 10».",
  sugerencias: [
    "¿Qué me recomiendas?",
    "Algo sin cebolla",
    "¿Cuántas calorías tiene la hamburguesa?",
  ],
};

export function AIAssistant({
  dishes,
  cart,
  onOpenDish,
}: {
  dishes: Dish[];
  cart: OrderItem[];
  onOpenDish: (dish: Dish) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([BIENVENIDA]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, cargando, abierto]);

  useEffect(() => {
    if (abierto) inputRef.current?.focus();
  }, [abierto]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  async function enviar(pregunta: string) {
    const q = pregunta.trim();
    if (!q || cargando) return;

    const mio: Mensaje = { id: crypto.randomUUID(), rol: "user", texto: q };
    setMensajes((prev) => [...prev, mio]);
    setTexto("");
    setCargando(true);

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...mensajes, mio].map((m) => ({
            role: m.rol,
            content: m.texto,
          })),
          // Lo ya pedido, para que pueda sugerir qué falta en la mesa.
          carrito: cart.map((i) => i.dishId),
        }),
      });
      const data = await res.json();
      setMensajes((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          rol: "assistant",
          texto: data.texto ?? "No pude responder eso. ¿Lo intentas de otra forma?",
          platos: data.platos ?? [],
          sugerencias: data.sugerencias ?? [],
        },
      ]);
    } catch {
      setMensajes((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          rol: "assistant",
          texto:
            "Se cayó la conexión un momento. ¿Me repites la pregunta?",
        },
      ]);
    } finally {
      setCargando(false);
    }
  }

  const porId = (id: string) => dishes.find((d) => d.id === id);

  return (
    <>
      {/* ------------------------------------------------ botón flotante */}
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          className={`fixed right-4 z-30 flex items-center gap-2 rounded-full border border-gold/35 bg-charcoal/95 py-3 pl-4 pr-5 text-sm text-cream shadow-premium backdrop-blur transition-transform active:scale-[0.97] ${
            cart.length > 0 ? "bottom-24" : "bottom-6"
          }`}
          aria-label="Abrir el asistente de la carta"
        >
          <span className="text-gold" aria-hidden="true">
            ✦
          </span>
          Preguntar
        </button>
      )}

      {/* ------------------------------------------------------- panel */}
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div
            className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
            onClick={() => setAbierto(false)}
            aria-hidden="true"
          />

          <div className="animate-fade-in-up relative flex h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-charcoal shadow-premium sm:h-[600px] sm:max-w-md sm:rounded-2xl">
            <header className="flex shrink-0 items-center justify-between border-b border-cream/10 px-5 py-4">
              <div>
                <h2 className="font-display text-lg text-cream">
                  Asistente de sala
                </h2>
                <p className="text-[0.7rem] text-cream/40">
                  Responde solo con la carta de hoy
                </p>
              </div>
              <button
                onClick={() => setAbierto(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-cream/50 hover:text-cream"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {mensajes.map((m) => (
                <div key={m.id}>
                  <div
                    className={`flex ${
                      m.rol === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.875rem] leading-relaxed ${
                        m.rol === "user"
                          ? "rounded-br-sm bg-gold text-ink"
                          : "rounded-bl-sm bg-ember text-cream/85"
                      }`}
                    >
                      {m.texto}
                    </div>
                  </div>

                  {/* Platos mencionados, abribles */}
                  {!!m.platos?.length && (
                    <div className="mt-2.5 space-y-1.5">
                      {m.platos.map((id) => {
                        const d = porId(id);
                        if (!d) return null;
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              setAbierto(false);
                              onOpenDish(d);
                            }}
                            className="flex w-full items-center gap-3 rounded-lg border border-cream/10 p-2 text-left transition-colors hover:border-gold/35"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={d.image}
                              alt=""
                              loading="lazy"
                              className="h-11 w-11 shrink-0 rounded object-cover"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-display text-[1rem] leading-tight text-cream">
                                {d.name}
                              </span>
                              <span className="text-[0.72rem] text-cream/45">
                                {precioCarta(d.price)}
                                {!d.available && " · agotado"}
                              </span>
                            </span>
                            <span className="shrink-0 text-cream/30">›</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Preguntas de seguimiento */}
                  {!!m.sugerencias?.length && !cargando && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {m.sugerencias.map((s) => (
                        <button
                          key={s}
                          onClick={() => enviar(s)}
                          className="rounded-full border border-cream/12 px-3 py-1.5 text-[0.75rem] text-cream/60 transition-colors hover:border-gold/40 hover:text-cream"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {cargando && (
                <div className="flex justify-start">
                  <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-ember px-4 py-3.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="typing-dot h-1.5 w-1.5 rounded-full bg-cream"
                        style={{ animationDelay: `${i * 0.18}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={finRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviar(texto);
              }}
              className="flex shrink-0 gap-2 border-t border-cream/10 px-4 py-3"
            >
              <input
                ref={inputRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Pregunta lo que quieras de la carta…"
                maxLength={300}
                className="flex-1 rounded-full border border-cream/12 bg-ink px-4 py-2.5 text-[0.875rem] text-cream placeholder:text-cream/25 focus:border-gold/45 focus:outline-none"
              />
              <button
                type="submit"
                disabled={cargando || !texto.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-ink transition-opacity disabled:opacity-35"
                aria-label="Enviar"
              >
                ↑
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

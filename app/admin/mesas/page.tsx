"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { restaurant } from "@/lib/data";

export default function MesasAdminPage() {
  const [origin, setOrigin] = useState("");
  const [qrs, setQrs] = useState<Record<number, string>>({});

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    (async () => {
      const entries: Record<number, string> = {};
      for (let n = 1; n <= restaurant.tableCount; n++) {
        const url = `${origin}/r/${restaurant.slug}?mesa=${n}`;
        entries[n] = await QRCode.toDataURL(url, {
          width: 320,
          margin: 1,
          color: { dark: "#141110", light: "#f6f1e7" },
        });
      }
      if (!cancelled) setQrs(entries);
    })();
    return () => {
      cancelled = true;
    };
  }, [origin]);

  return (
    <div className="min-h-screen bg-ink px-4 py-8 sm:px-8">
      <div className="mx-auto mb-8 max-w-3xl print:hidden">
        <h1 className="font-display text-2xl font-semibold text-cream">
          Códigos QR por mesa — {restaurant.name}
        </h1>
        <p className="mt-1 text-sm text-cream/60">
          Cada código lleva codificado el número de mesa en la URL, así el
          cliente nunca tiene que escribirlo a mano. Imprime esta página y
          coloca cada QR en su mesa correspondiente.
        </p>
        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-cream/50">
          URL base (cámbiala si vas a mostrar esto desde otro dispositivo/dominio)
        </label>
        <input
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="mt-1 w-full max-w-md rounded-xl border border-white/10 bg-charcoal px-3 py-2 text-sm text-cream focus:border-gold/50 focus:outline-none"
        />
        <button
          onClick={() => window.print()}
          className="mt-4 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-ink"
        >
          Imprimir mesas
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-3">
        {Array.from({ length: restaurant.tableCount }, (_, i) => i + 1).map(
          (n) => (
            <div
              key={n}
              className="flex flex-col items-center rounded-2xl border border-white/10 bg-charcoal/60 p-4 text-center print:border-black/20 print:bg-white"
            >
              <p className="mb-2 font-display text-lg font-semibold text-cream print:text-black">
                Mesa {n}
              </p>
              {qrs[n] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrs[n]} alt={`QR mesa ${n}`} className="h-40 w-40" />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center text-xs text-cream/30">
                  Generando...
                </div>
              )}
              <p className="mt-2 text-[10px] text-cream/40 print:text-black/60">
                {restaurant.name}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

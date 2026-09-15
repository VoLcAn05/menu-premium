"use client";

import "@google/model-viewer";
import { useEffect, useRef, useState } from "react";

/**
 * Visor 3D y realidad aumentada de un plato.
 *
 * Dos detalles que deciden si esto funciona o no:
 *
 * 1. `touch-action="none"`. Sin esto el navegador se queda con el gesto
 *    vertical para hacer scroll de la página, y el plato solo gira en
 *    horizontal. Con esto el dedo lo gira en todas las direcciones.
 *
 * 2. `ar-scale="fixed"` junto con modelos modelados en metros. Así el plato
 *    aparece sobre la mesa del tamaño que tendrá de verdad. Con "auto" el
 *    visor deja que el usuario lo escale y el tamaño deja de significar algo.
 *
 * Los límites de órbita se abren a propósito: el rango vertical por defecto
 * no deja mirar el plato ni desde arriba ni desde abajo.
 */

type Props = {
  glb: string;
  usdz?: string;
  alt: string;
  medidas?: { ancho: number; alto: number };
  poster?: string;
};

export function Model3D({ glb, usdz, alt, medidas, poster }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">(
    "cargando"
  );
  const [arDisponible, setArDisponible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onLoad = () => {
      setEstado("listo");
      // canActivateAR solo es fiable después de cargar el modelo.
      setArDisponible(Boolean((el as unknown as { canActivateAR?: boolean })
        .canActivateAR));
    };
    const onError = () => setEstado("error");

    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
    };
  }, [glb]);

  if (estado === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-ember px-6 text-center">
        <p className="text-sm text-cream/70">
          No se pudo cargar la vista 3D de este plato.
        </p>
        <p className="text-xs text-cream/40">
          Revisa tu conexión y vuelve a abrirlo.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-ember to-ink">
      <model-viewer
        ref={ref as React.RefObject<HTMLElement>}
        src={glb}
        ios-src={usdz}
        alt={alt}
        poster={poster}
        camera-controls
        touch-action="none"
        auto-rotate
        auto-rotate-delay="2500"
        rotation-per-second="18deg"
        interaction-prompt="auto"
        interaction-prompt-threshold="1800"
        min-camera-orbit="-Infinity 0deg auto"
        max-camera-orbit="Infinity 180deg auto"
        camera-orbit="35deg 68deg auto"
        shadow-intensity="1.4"
        shadow-softness="0.85"
        exposure="1.1"
        tone-mapping="neutral"
        ar
        ar-modes="webxr scene-viewer quick-look"
        ar-scale="fixed"
        ar-placement="floor"
        loading="eager"
        reveal="auto"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "transparent",
        }}
      >
        {/* Botón de AR propio: el de serie no se puede estilar. */}
        <button
          slot="ar-button"
          className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full border border-gold/45 bg-ink/85 px-4 py-2.5 text-xs font-medium text-gold-light backdrop-blur transition-colors hover:bg-ink active:scale-[0.97]"
        >
          <span aria-hidden="true">⊕</span>
          Verlo en tu mesa
        </button>
      </model-viewer>

      {estado === "cargando" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-xs uppercase tracking-seccion text-cream/40">
            Cargando 3D…
          </span>
        </div>
      )}

      {estado === "listo" && (
        <>
          <p className="pointer-events-none absolute left-3 top-3 text-[0.68rem] text-cream/45">
            Gíralo con el dedo · pellizca para acercar
          </p>
          {medidas && (
            <p className="pointer-events-none absolute bottom-4 left-3 text-[0.68rem] text-cream/45">
              Tamaño real: {medidas.ancho} × {medidas.alto} cm
            </p>
          )}
          {!arDisponible && (
            <p className="pointer-events-none absolute bottom-3 right-3 max-w-[11rem] text-right text-[0.64rem] leading-snug text-cream/30">
              Para verlo sobre tu mesa, abre la carta desde el teléfono
            </p>
          )}
        </>
      )}
    </div>
  );
}

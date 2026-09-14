"use client";

import "@google/model-viewer";
import { useState } from "react";

export function Model3D({
  glb,
  usdz,
  alt,
}: {
  glb: string;
  usdz?: string;
  alt: string;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-charcoal text-sm text-cream/60">
        No se pudo cargar el modelo 3D (revisa tu conexión a internet).
      </div>
    );
  }

  return (
    <model-viewer
      src={glb}
      ios-src={usdz}
      alt={alt}
      camera-controls
      auto-rotate
      shadow-intensity="1.1"
      exposure="1.05"
      ar={usdz ? true : undefined}
      ar-modes="scene-viewer quick-look webxr"
      loading="eager"
      reveal="auto"
      onError={() => setErrored(true)}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "transparent",
      }}
    />
  );
}

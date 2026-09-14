import type React from "react";

// <model-viewer> es un Web Component (de @google/model-viewer), no un
// elemento HTML nativo, así que TypeScript/JSX no lo conoce por defecto.
// Esta declaración le enseña la forma mínima de props que usamos.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          "ios-src"?: string;
          alt?: string;
          ar?: boolean;
          "ar-modes"?: string;
          "ar-scale"?: string;
          "camera-controls"?: boolean;
          "auto-rotate"?: boolean;
          "shadow-intensity"?: string | number;
          exposure?: string | number;
          poster?: string;
          reveal?: string;
          loading?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};

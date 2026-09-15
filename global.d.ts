import type React from "react";

// <model-viewer> es un Web Component (de @google/model-viewer), no un
// elemento HTML nativo, así que TypeScript/JSX no lo conoce por defecto.
// Esta declaración le enseña la forma de los atributos que usamos.
//
// Casi todos se declaran como string aunque model-viewer acepte números:
// en JSX los atributos de un custom element se serializan a string de todos
// modos, y declararlos así evita el error de pasar {2500} en vez de "2500".
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          "ios-src"?: string;
          alt?: string;
          poster?: string;

          // realidad aumentada
          ar?: boolean;
          "ar-modes"?: string;
          "ar-scale"?: string;
          "ar-placement"?: string;

          // cámara e interacción
          "camera-controls"?: boolean;
          "camera-orbit"?: string;
          "min-camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "field-of-view"?: string;
          "touch-action"?: string;
          "disable-pan"?: boolean;
          "disable-tap"?: boolean;
          "auto-rotate"?: boolean;
          "auto-rotate-delay"?: string | number;
          "rotation-per-second"?: string;
          "interaction-prompt"?: string;
          "interaction-prompt-threshold"?: string | number;

          // iluminación y render
          "shadow-intensity"?: string | number;
          "shadow-softness"?: string | number;
          "environment-image"?: string;
          "tone-mapping"?: string;
          exposure?: string | number;

          // carga
          reveal?: string;
          loading?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};

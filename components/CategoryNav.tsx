"use client";

import { Category } from "@/lib/types";

/**
 * Navegación por secciones, fija al hacer scroll.
 *
 * Sin píldoras de color: en una carta, la sección activa se marca con un
 * filete bajo el texto, igual que un separador impreso. Las píldoras rellenas
 * son lenguaje de app, y es justo lo que hay que evitar aquí.
 */
export function CategoryNav({
  categories,
  active,
  onSelect,
}: {
  categories: Category[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="no-scrollbar sticky top-0 z-30 flex justify-center gap-5 overflow-x-auto border-b border-cream/10 bg-ink px-5 py-3.5 sm:gap-8">
      {categories.map((c) => {
        const activo = c.id === active;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`relative whitespace-nowrap pb-1 text-[0.68rem] uppercase tracking-seccion transition-colors ${
              activo ? "text-gold" : "text-cream/40 hover:text-cream/75"
            }`}
          >
            {c.nav ?? c.name}
            {activo && (
              <span className="absolute inset-x-0 -bottom-px h-px bg-gold" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

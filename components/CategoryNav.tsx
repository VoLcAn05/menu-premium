"use client";

import { Category } from "@/lib/types";

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
    <div className="no-scrollbar sticky top-0 z-30 flex gap-2 overflow-x-auto bg-ink/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-ink/80">
      {categories.map((c) => {
        const isActive = c.id === active;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-gold bg-gold text-ink"
                : "border-white/15 text-cream/70 hover:border-gold/50 hover:text-cream"
            }`}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

export function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export const STATUS_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  en_preparacion: "En preparación",
  listo: "Listo",
  entregado: "Entregado",
};

export const STATUS_COLOR: Record<string, string> = {
  nuevo: "bg-red-500",
  en_preparacion: "bg-amber-500",
  listo: "bg-emerald-500",
  entregado: "bg-neutral-500",
};

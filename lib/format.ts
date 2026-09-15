/**
 * Formato de precios.
 *
 * En la carta el precio va SIN símbolo de moneda: un estudio de Cornell con
 * 201 comensales midió cerca de 8% más de gasto por cuenta en menús sin "$",
 * porque el símbolo activa la conciencia del gasto. También van sin decimales
 * de relleno: "14", no "$14.00".
 *
 * En el carrito y en el total es al revés: ahí el comensal está decidiendo
 * pagar, y esconder la cifra solo genera desconfianza y abandono. Por eso
 * `formatUSD` sigue existiendo y se usa del carrito en adelante.
 */

/** Precio para la carta: sin símbolo, sin ceros de relleno. */
export function precioCarta(amount: number): string {
  return Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace(/0$/, "");
}

/** Precio para carrito, totales y cocina: explícito y sin ambigüedad. */
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

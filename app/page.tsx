import Link from "next/link";
import { restaurant } from "@/lib/data";

const LINKS = [
  {
    href: `/r/${restaurant.slug}?mesa=4`,
    title: "1. Menú del cliente",
    desc: "Lo que ve el comensal al escanear el QR de su mesa: fotos, info del plato, vista 3D en el plato estrella, y pedir directo desde el celular.",
    cta: "Abrir como cliente en Mesa 4",
  },
  {
    href: "/cocina",
    title: "2. Panel de cocina (KDS)",
    desc: "Lo que ve el restaurante en tiempo real: cada pedido aparece al instante con mesa, productos y notas, con sonido de alerta.",
    cta: "Abrir panel de cocina",
  },
  {
    href: "/admin/mesas",
    title: "3. Códigos QR por mesa",
    desc: "Genera e imprime un QR único por cada mesa del restaurante, listo para pegar en la mesa.",
    cta: "Ver códigos QR",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen px-5 py-14">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full border border-gold/30 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gold-light">
          Software base · Demo
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-cream sm:text-4xl">
          Menú digital interactivo + comanda en vivo
        </h1>
        <p className="mt-3 text-cream/60">
          Prototipo funcional para mostrarle a dueños de restaurantes en
          Barinas: el cliente escanea, ve el menú (con fotos y vista 3D) y
          pide desde su celular — la cocina lo recibe al instante, sin papel
          y sin gritar la orden por la ventanilla.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-2xl gap-4">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group rounded-2xl border border-white/10 bg-charcoal/60 p-5 transition-colors hover:border-gold/40 hover:bg-charcoal"
          >
            <h2 className="font-display text-lg font-semibold text-cream">
              {l.title}
            </h2>
            <p className="mt-1 text-sm text-cream/60">{l.desc}</p>
            <span className="mt-3 inline-block text-sm font-semibold text-gold-light group-hover:underline">
              {l.cta} →
            </span>
          </Link>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-cream/30">
        Tip para la demo en vivo: abre "Panel de cocina" en una laptop o
        tablet, y "Menú del cliente" en tu celular. Pide algo y mira cómo
        aparece al instante en la cocina.
      </p>
    </div>
  );
}

import Link from "next/link";
import { restaurant } from "@/lib/data";

const PANTALLAS = [
  {
    href: `/r/${restaurant.slug}?mesa=4`,
    numero: "I",
    titulo: "La carta del comensal",
    texto:
      "Lo que ve quien escanea el QR de su mesa. Cada plato se puede girar en 3D y proyectar sobre la mesa a tamaño real. El asistente responde sobre ingredientes, alérgenos y qué combina con qué.",
    cta: "Abrir como cliente en la mesa 4",
  },
  {
    href: "/cocina",
    numero: "II",
    titulo: "Pantalla de cocina",
    texto:
      "El pedido entra al instante, con mesa, platos y notas, y suena una alerta. De nuevo a en preparación, listo y entregado, sin papel de por medio.",
    cta: "Abrir la pantalla de cocina",
  },
  {
    href: "/admin/mesas",
    numero: "III",
    titulo: "Códigos QR por mesa",
    texto:
      "Un código por mesa, con el número ya codificado en el enlace, listo para imprimir y pegar.",
    cta: "Ver los códigos",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen px-6 py-16">
      <header className="mx-auto max-w-xl text-center">
        <p className="text-[0.68rem] uppercase tracking-seccion text-gold/70">
          Demostración
        </p>
        <h1 className="mt-4 font-display text-[2.8rem] font-light leading-[1.05] text-cream">
          Carta digital con 3D,
          <br />
          asistente y comanda en vivo
        </h1>
        <p className="mx-auto mt-5 max-w-md text-[0.9rem] leading-relaxed text-cream/50">
          El comensal escanea, mira el plato en tres dimensiones, lo prueba
          sobre su propia mesa con la cámara, pregunta lo que quiera y pide
          desde el teléfono. La cocina lo recibe al instante.
        </p>
        <div className="mx-auto mt-8 h-px w-12 bg-gold/35" />
      </header>

      <div className="mx-auto mt-14 max-w-xl space-y-10">
        {PANTALLAS.map((p, i) => (
          <Link
            key={p.href}
            href={p.href}
            className={`group block ${i > 0 ? "filete pt-10" : ""}`}
          >
            <p className="font-display text-[0.9rem] text-gold/60">{p.numero}</p>
            <h2 className="mt-1.5 font-display text-[1.5rem] font-normal leading-tight text-cream">
              {p.titulo}
            </h2>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-cream/50">
              {p.texto}
            </p>
            <span className="mt-3 inline-block text-[0.8rem] text-gold-light group-hover:underline">
              {p.cta} →
            </span>
          </Link>
        ))}
      </div>

      <div className="filete mx-auto mt-16 max-w-xl pt-8">
        <p className="text-[0.78rem] leading-relaxed text-cream/35">
          Para enseñarlo en vivo: abre la pantalla de cocina en una laptop o
          tablet donde el dueño la vea, y la carta en tu teléfono. Haz un
          pedido de prueba y observa cómo entra al instante. Eso convence más
          que cualquier captura.
        </p>
      </div>
    </div>
  );
}

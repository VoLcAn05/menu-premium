import { restaurant } from "./data";
import type { Alergeno, Dieta, Dish } from "./types";

/**
 * Motor del asistente del menú.
 *
 * Funciona sin servicios externos: entiende la pregunta, la resuelve contra
 * los datos de `data.ts` y redacta la respuesta. Todo lo que afirma sale de
 * ahí, así que no puede inventar un plato, un precio ni un ingrediente.
 *
 * Si existe ANTHROPIC_API_KEY, la ruta de API la usa para redactar con más
 * naturalidad, pero pasándole el mismo menú como única fuente. Sin la clave,
 * este motor responde solo — que es el modo por defecto.
 */

// ------------------------------------------------------------ utilidades

/** Minúsculas, sin acentos y sin puntuación: "¿Qué lleva?" -> "que lleva" */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:()"'\`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const VACIAS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al",
  "a", "y", "o", "que", "en", "con", "por", "para", "es", "son", "me", "te",
  "se", "lo", "su", "mi", "tu", "hay", "tiene", "tienen", "esta", "estan",
  "como", "cual", "cuales", "muy", "mas", "menos", "algo", "alguna", "alguno",
  "quiero", "quisiera", "puedo", "puede", "porfavor", "favor", "gracias",
  "buenas", "hola", "si", "no", "pero", "tambien", "sobre", "este", "ese",
]);

function tokens(s: string): string[] {
  return norm(s).split(" ").filter((t) => t.length > 2 && !VACIAS.has(t));
}

/** Raíz aproximada en español: cubre plurales y variaciones simples. */
function raiz(t: string): string {
  return t
    .replace(/(ciones|cion|mente)$/, "")
    .replace(/(es|s)$/, "")
    .replace(/(ito|ita|illo|illa)$/, "");
}

function incluye(texto: string, ...frases: string[]): boolean {
  return frases.some((f) => texto.includes(f));
}

/** Precio sin símbolo y sin decimales inútiles, como en el menú. */
export function precio(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
}

function lista(xs: string[], union = "y"): string {
  if (xs.length === 0) return "";
  if (xs.length === 1) return xs[0];
  return `${xs.slice(0, -1).join(", ")} ${union} ${xs[xs.length - 1]}`;
}

const disponibles = () => restaurant.dishes.filter((d) => d.available);

const porId = (id: string) => restaurant.dishes.find((d) => d.id === id);

// ------------------------------------------------- reconocimiento de platos

/** Puntúa cuánto se parece la pregunta a un plato concreto. */
function puntuarPlato(q: string, qt: string[], d: Dish): number {
  const n = norm(q);
  let score = 0;

  const nombre = norm(d.name);
  if (n.includes(nombre)) score += 100;

  for (const a of d.alias ?? []) {
    const na = norm(a);
    if (n.includes(na)) score += na.length > 5 ? 60 : 45;
  }

  // palabras propias del nombre del plato
  const nombreTokens = tokens(d.name).map(raiz);
  const qRaices = qt.map(raiz);
  for (const t of nombreTokens) {
    if (qRaices.includes(t)) score += 14;
  }

  // ingredientes: señal más débil, sirve para "el que lleva camarones"
  for (const ing of d.ingredientes) {
    for (const t of tokens(ing).map(raiz)) {
      if (qRaices.includes(t)) score += 6;
    }
  }

  return score;
}

/** Platos mencionados en la pregunta, de más a menos probable. */
export function detectarPlatos(q: string): Dish[] {
  const qt = tokens(q);
  return restaurant.dishes
    .map((d) => ({ d, s: puntuarPlato(q, qt, d) }))
    .filter((x) => x.s >= 30)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.d);
}

// ------------------------------------------------- restricciones y antojos

const ALERGENOS: Record<Alergeno, string[]> = {
  gluten: ["gluten", "trigo", "harina", "celiac"],
  lacteos: ["lacteo", "lactosa", "leche", "queso", "mantequilla", "crema"],
  mariscos: ["marisco", "camaron", "gamba", "crustaceo"],
  pescado: ["pescado", "pez"],
  huevo: ["huevo"],
  "frutos secos": ["fruto seco", "frutos secos", "nuez", "nueces", "mani",
    "almendra", "piñon", "pinon"],
  soya: ["soya", "soja"],
  alcohol: ["alcohol", "licor", "ron", "trago"],
};

function detectarAlergeno(q: string): Alergeno | null {
  const n = norm(q);
  for (const [a, palabras] of Object.entries(ALERGENOS)) {
    if (palabras.some((p) => n.includes(norm(p)))) return a as Alergeno;
  }
  return null;
}

function detectarDieta(q: string): Dieta | null {
  const n = norm(q);
  if (incluye(n, "vegano", "vegana")) return "vegano";
  if (incluye(n, "vegetarian")) return "vegetariano";
  if (incluye(n, "sin gluten", "celiac", "sin trigo")) return "sin gluten";
  if (incluye(n, "sin lacteo", "sin lactosa", "sin leche")) return "sin lacteos";
  return null;
}

function cumpleDieta(d: Dish, dieta: Dieta): boolean {
  if (d.dietas?.includes(dieta)) return true;
  if (dieta === "vegano") {
    return (
      !!d.dietas?.includes("vegetariano") &&
      !d.alergenos.includes("lacteos") &&
      !d.alergenos.includes("huevo")
    );
  }
  if (dieta === "sin gluten") return !d.alergenos.includes("gluten");
  if (dieta === "sin lacteos") return !d.alergenos.includes("lacteos");
  return false;
}

type Antojo = {
  clave: string;
  palabras: string[];
  filtro: (d: Dish) => boolean;
  etiqueta: string;
};

const ANTOJOS: Antojo[] = [
  {
    clave: "carne",
    palabras: ["carne", "res", "parrilla", "brasa", "asado", "proteina",
      "carnivoro", "cerdo"],
    filtro: (d) =>
      d.ingredientes.some((i) =>
        /res|cerdo|lomo|costilla|carne|tocineta/.test(norm(i))),
    etiqueta: "de la brasa",
  },
  {
    clave: "mariscos",
    palabras: ["marisco", "camaron", "mar", "pescado"],
    filtro: (d) => d.alergenos.includes("mariscos"),
    etiqueta: "con camarones",
  },
  {
    clave: "ligero",
    palabras: ["ligero", "liviano", "fresco", "suave", "poco pesado",
      "saludable", "sano", "dieta"],
    filtro: (d) => d.perfil.some((p) => /fresco|ligero|citrico/.test(p)),
    etiqueta: "ligero",
  },
  {
    clave: "contundente",
    palabras: ["contundente", "abundante", "pesado", "lleno", "hambre",
      "grande", "fuerte"],
    filtro: (d) => d.perfil.includes("contundente"),
    etiqueta: "para hambre de verdad",
  },
  {
    clave: "dulce",
    palabras: ["dulce", "postre", "azucar"],
    filtro: (d) => d.category === "postres" || d.perfil.includes("dulce"),
    etiqueta: "dulce",
  },
  {
    clave: "picante",
    palabras: ["picante", "pica", "aji", "chile"],
    filtro: (d) => d.picante > 0,
    etiqueta: "con punto de picante",
  },
  {
    clave: "rapido",
    palabras: ["rapido", "prisa", "apurado", "tiempo", "corriendo"],
    filtro: (d) => d.minutos <= 10,
    etiqueta: "de salida rápida",
  },
  {
    clave: "compartir",
    palabras: ["compartir", "dos personas", "pareja", "entre dos"],
    filtro: (d) => d.personas >= 2,
    etiqueta: "para compartir",
  },
];

function detectarAntojo(q: string): Antojo | null {
  const n = norm(q);
  for (const a of ANTOJOS) {
    if (a.palabras.some((p) => n.includes(norm(p)))) return a;
  }
  return null;
}

/** "menos de 10", "barato", "hasta 8" */
function detectarPresupuesto(q: string): number | null {
  const n = norm(q);
  const m = n.match(/(?:menos de|hasta|maximo|por debajo de|bajo)\s*(\d+)/);
  if (m) return Number(m[1]);
  if (incluye(n, "barato", "economico", "mas barato", "menor precio")) {
    return 7;
  }
  return null;
}

// ----------------------------------------------------------- intenciones

export type Intencion =
  | "saludo" | "gracias" | "ayuda" | "ingredientes" | "alergia_plato"
  | "alergia_general" | "dieta" | "precio" | "picante" | "porcion"
  | "tiempo" | "maridaje" | "comparar" | "disponibilidad" | "popular"
  | "ver3d" | "presupuesto" | "antojo" | "recomendar" | "info_plato"
  | "desconocido";

function detectarIntencion(q: string, platos: Dish[]): Intencion {
  const n = norm(q);
  const conPlato = platos.length > 0;

  if (incluye(n, "gracias", "listo asi", "eso es todo")) return "gracias";
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)\b/
    .test(n)) return "saludo";
  if (incluye(n, "que puedes hacer", "que sabes", "ayuda", "como funciona",
    "en que me puedes ayudar")) return "ayuda";

  if (incluye(n, "que lleva", "que trae", "que tiene", "ingrediente",
    "de que esta hecho", "como lo preparan", "como se prepara",
    "de que es") && conPlato) return "ingredientes";

  if (incluye(n, "alergi", "celiac", "intoleran", "puedo comer",
    "soy alergico")) {
    return conPlato ? "alergia_plato" : "alergia_general";
  }
  if (detectarAlergeno(q) && incluye(n, "tiene", "lleva", "contiene",
    "hay")) {
    return conPlato ? "alergia_plato" : "alergia_general";
  }
  if (detectarDieta(q)) return "dieta";

  if (incluye(n, "cuanto cuesta", "cuanto vale", "precio", "cuanto sale",
    "que precio")) return "precio";
  if (incluye(n, "pica", "picante", "enchila") && conPlato) return "picante";
  if (incluye(n, "alcanza", "para cuanta", "para cuanto", "cuanta gente",
    "es grande", "que tan grande", "porcion", "tamaño", "tamano",
    "cuanto trae")) return "porcion";
  if (incluye(n, "cuanto tarda", "cuanto demora", "cuanto se tarda",
    "cuanto tiempo", "rapido")) return "tiempo";

  if (incluye(n, "que va con", "que combina", "acompan", "que le agrego",
    "que pido con", "con que", "para tomar", "tomo con", "bebo con",
    "tomar con", "beber con", "que bebida", "maridaje", "que mas pido",
    "algo mas", "que le pongo", "que sirve con")) return "maridaje";

  if (incluye(n, " o ", "mejor", "diferencia", "cual elijo", "cual me conviene")
    && platos.length >= 2) return "comparar";

  if (incluye(n, "hay ", "queda", "disponible", "se acabo", "tienen")) {
    // "¿tienen algo de carne?" es un antojo, no una pregunta de existencias.
    if (conPlato) return "disponibilidad";
    if (!detectarAntojo(q) && detectarPresupuesto(q) === null) {
      return "disponibilidad";
    }
  }
  if (incluye(n, "mas pedido", "popular", "el mejor", "mas vendido",
    "especialidad", "estrella", "que sale mas")) return "popular";
  if (incluye(n, "3d", "ver el plato", "realidad aumentada", " ar ",
    "como se ve", "foto")) return "ver3d";

  if (detectarPresupuesto(q) !== null) return "presupuesto";
  if (detectarAntojo(q)) return "antojo";
  if (incluye(n, "recomien", "sugier", "que pido", "que como",
    "no se que", "opciones")) return "recomendar";

  if (conPlato) return "info_plato";
  return "desconocido";
}

// ----------------------------------------------------------- respuestas

export type Respuesta = {
  texto: string;
  /** IDs de platos a mostrar como tarjetas bajo la respuesta. */
  platos: string[];
  /** Preguntas de seguimiento sugeridas. */
  sugerencias: string[];
};

const SUG_BASE = [
  "¿Qué me recomiendas?",
  "¿Qué lleva el ceviche?",
  "Algo sin gluten",
  "¿Qué tomo con el lomo?",
];

function fichaPlato(d: Dish): string {
  const partes = [`${d.name} — ${precio(d.price)}.`, d.description];
  if (d.nota) partes.push(d.nota);
  return partes.join(" ");
}

function noDisponible(d: Dish): string {
  const alt = (d.combina ?? [])
    .map(porId)
    .filter((x): x is Dish => !!x && x.available && x.category === d.category);
  const sugerencia = alt.length
    ? ` Mientras tanto, ${alt[0].name.toLowerCase()} va por un camino parecido.`
    : "";
  return `${d.name} está agotado hoy.${sugerencia}`;
}

export function responder(pregunta: string): Respuesta {
  const platos = detectarPlatos(pregunta);
  const intencion = detectarIntencion(pregunta, platos);
  const d = platos[0];

  switch (intencion) {
    case "saludo":
      return {
        texto:
          `Bienvenido a ${restaurant.name}. Conozco el menú completo: ` +
          `ingredientes, alérgenos, tamaños de porción y qué combina con qué. ` +
          `¿Qué se te antoja?`,
        platos: [],
        sugerencias: SUG_BASE,
      };

    case "gracias":
      return {
        texto: "A la orden. Si necesitas algo más del menú, aquí estoy.",
        platos: [],
        sugerencias: [],
      };

    case "ayuda":
      return {
        texto:
          "Puedo decirte qué lleva cada plato, si tiene algún alérgeno, " +
          "cuánto rinde, cuánto tarda, qué combina con qué y recomendarte " +
          "según lo que se te antoje o lo que no puedas comer.",
        platos: [],
        sugerencias: SUG_BASE,
      };

    case "ingredientes": {
      if (!d) break;
      const al = d.alergenos.length
        ? ` Contiene ${lista(d.alergenos)}.`
        : " No tiene alérgenos de los que se preguntan con frecuencia.";
      return {
        texto:
          `${d.name} lleva ${lista(d.ingredientes)}.${al}` +
          (d.nota ? ` ${d.nota}` : ""),
        platos: [d.id],
        sugerencias: [`¿Cuánto rinde?`, `¿Qué tomo con eso?`],
      };
    }

    case "alergia_plato": {
      if (!d) break;
      const a = detectarAlergeno(pregunta);
      if (!a) break;
      const tiene = d.alergenos.includes(a);
      if (!tiene) {
        return {
          texto:
            `${d.name} no lleva ${a}. Lleva ${lista(d.ingredientes)}. ` +
            `Aun así, conviene avisarle al mesero al pedir.`,
          platos: [d.id],
          sugerencias: [`Otras opciones sin ${a}`],
        };
      }
      const alts = disponibles().filter(
        (x) => x.id !== d.id && !x.alergenos.includes(a)
      );
      return {
        texto:
          `Sí, ${d.name} contiene ${a}. ` +
          (alts.length
            ? `Sin ${a} te sirven: ${lista(alts.slice(0, 3).map((x) => x.name))}.`
            : `No tengo una alternativa sin ${a} en el menú de hoy.`),
        platos: alts.slice(0, 3).map((x) => x.id),
        sugerencias: ["¿Qué me recomiendas entonces?"],
      };
    }

    case "alergia_general": {
      const a = detectarAlergeno(pregunta);
      if (!a) break;
      const ok = disponibles().filter((x) => !x.alergenos.includes(a));
      const no = disponibles().filter((x) => x.alergenos.includes(a));
      return {
        texto:
          `Sin ${a} puedes pedir ${lista(ok.map((x) => x.name))}. ` +
          (no.length
            ? `Evita ${lista(no.map((x) => x.name))}, que sí lo llevan.`
            : ""),
        platos: ok.slice(0, 4).map((x) => x.id),
        sugerencias: ["¿Cuál de esos es el más pedido?"],
      };
    }

    case "dieta": {
      const dieta = detectarDieta(pregunta)!;
      const ok = disponibles().filter((x) => cumpleDieta(x, dieta));
      if (!ok.length) {
        return {
          texto:
            `Hoy no tengo un plato ${dieta} completo en el menú. ` +
            `La ensalada se puede pedir sin queso, que la deja sin lácteos ` +
            `y sin gluten — vale la pena preguntarle al mesero.`,
          platos: ["ensalada-casa"],
          sugerencias: ["¿Qué lleva la ensalada?"],
        };
      }
      return {
        texto:
          `Opciones ${dieta}: ${lista(ok.map((x) => `${x.name} (${precio(x.price)})`))}.` +
          (dieta === "vegano"
            ? " La ensalada va sin queso para que sea vegana."
            : ""),
        platos: ok.map((x) => x.id),
        sugerencias: ["¿Qué lleva exactamente?"],
      };
    }

    case "precio": {
      if (d) {
        return {
          texto:
            `${d.name} cuesta ${precio(d.price)}. ${d.portion ?? ""}`.trim(),
          platos: [d.id],
          sugerencias: ["¿Qué le agrego?"],
        };
      }
      const orden = [...disponibles()].sort((a, b) => a.price - b.price);
      return {
        texto:
          `Los precios van de ${precio(orden[0].price)} ` +
          `(${orden[0].name.toLowerCase()}) a ` +
          `${precio(orden[orden.length - 1].price)} ` +
          `(${orden[orden.length - 1].name.toLowerCase()}). ` +
          `¿De qué plato quieres saber?`,
        platos: [],
        sugerencias: ["Algo por menos de 10"],
      };
    }

    case "picante": {
      if (!d) break;
      const nivel = ["nada picante", "con un toque suave de picante",
        "picante medio", "bastante picante"][d.picante];
      return {
        texto:
          `${d.name} es ${nivel}.` +
          (d.picanteOpcional
            ? " El picante va aparte, lo puedes pedir sin nada o subirle."
            : ""),
        platos: [d.id],
        sugerencias: ["¿Qué más hay picante?"],
      };
    }

    case "porcion": {
      if (!d) break;
      const rinde =
        d.personas >= 2
          ? "Alcanza cómodo para dos"
          : "Es una porción para una persona";
      const med = d.model3d?.medidas
        ? ` El plato servido mide unos ${d.model3d.medidas.ancho} cm de ancho; ` +
          `puedes verlo a tamaño real con el botón de ver en tu mesa.`
        : "";
      return {
        texto: `${d.portion ?? rinde}. ${rinde}.${med}`,
        platos: [d.id],
        sugerencias: ["Quiero verlo en 3D"],
      };
    }

    case "tiempo": {
      if (d) {
        return {
          texto:
            `${d.name} sale en unos ${d.minutos} minutos desde que lo pides.`,
          platos: [d.id],
          sugerencias: ["¿Qué sale más rápido?"],
        };
      }
      // Para "¿qué sale rápido?" interesa la comida, no el postre ni la barra.
      const comida = disponibles().filter(
        (x) => x.category === "entradas" || x.category === "fuertes"
      );
      const rapidos = [...comida].sort((a, b) => a.minutos - b.minutos);
      const lento = rapidos[rapidos.length - 1];
      return {
        texto:
          `Lo que sale más rápido: ` +
          `${lista(rapidos.slice(0, 3).map(
            (x) => `${x.name.toLowerCase()} (${x.minutos} min)`))}. ` +
          `Lo que más tarda es ${lento.name.toLowerCase()}, ` +
          `unos ${lento.minutos} minutos.`,
        platos: rapidos.slice(0, 3).map((x) => x.id),
        sugerencias: ["¿Qué me recomiendas?"],
      };
    }

    case "maridaje": {
      if (!d) break;
      const comp = (d.combina ?? [])
        .map(porId)
        .filter((x): x is Dish => !!x && x.available);
      if (!comp.length) break;
      const razon: Record<string, string> = {
        "coctel-casa": "el romero y el limón cortan bien la grasa",
        "ensalada-casa": "algo fresco al lado equilibra el plato",
        "torta-chocolate": "cierra sin quedar demasiado lleno",
        "ceviche-camarones": "empezar frío antes de la brasa funciona",
        "lomo-parrilla": "pesa lo suficiente para seguir después",
      };
      const l = comp.slice(0, 2).map(
        (c) => `${c.name} (${precio(c.price)})${razon[c.id] ? `, ${razon[c.id]}` : ""}`
      );
      return {
        texto: `Con ${d.name.toLowerCase()} va bien ${lista(l, "o")}.`,
        platos: comp.slice(0, 2).map((x) => x.id),
        sugerencias: [`¿Qué lleva ${comp[0].name.split(" ")[0].toLowerCase()}?`],
      };
    }

    case "comparar": {
      const [a, b] = platos;
      if (!a || !b) break;
      const dif: string[] = [];
      if (a.price !== b.price) {
        const caro = a.price > b.price ? a : b;
        const barato = a.price > b.price ? b : a;
        dif.push(
          `${caro.name} cuesta ${precio(caro.price)} y ` +
          `${barato.name.toLowerCase()} ${precio(barato.price)}`
        );
      }
      if (a.minutos !== b.minutos) {
        const rap = a.minutos < b.minutos ? a : b;
        dif.push(`${rap.name.toLowerCase()} sale más rápido (${rap.minutos} min)`);
      }
      dif.push(
        `${a.name} es ${lista(a.perfil.slice(0, 2))}; ` +
        `${b.name.toLowerCase()}, ${lista(b.perfil.slice(0, 2))}`
      );
      return {
        texto:
          `${dif.join(". ")}. Si quieres algo más ligero ve por ` +
          `${(a.perfil.includes("contundente") ? b : a).name.toLowerCase()}.`,
        platos: [a.id, b.id],
        sugerencias: [`¿Qué lleva ${a.name.split(" ")[0].toLowerCase()}?`],
      };
    }

    case "disponibilidad": {
      if (!d) {
        // Preguntan por algo que no existe en la carta.
        const cats = restaurant.categories
          .map((c) => {
            const n = disponibles().filter((x) => x.category === c.id).length;
            return n ? `${c.name.toLowerCase()} (${n})` : null;
          })
          .filter(Boolean) as string[];
        return {
          texto:
            `Eso no está en la carta de hoy. Lo que sí hay: ${lista(cats)}. ` +
            `¿Te digo qué es lo más pedido?`,
          platos: [],
          sugerencias: ["Sí, lo más pedido", "Algo de carne", "Algo ligero"],
        };
      }
      if (!d.available) {
        return {
          texto: noDisponible(d),
          platos: (d.combina ?? []).filter((id) => porId(id)?.available).slice(0, 2),
          sugerencias: ["¿Qué me recomiendas?"],
        };
      }
      return {
        texto: `Sí, hay ${d.name.toLowerCase()} — ${precio(d.price)}, ` +
          `sale en unos ${d.minutos} minutos.`,
        platos: [d.id],
        sugerencias: ["¿Qué le agrego?"],
      };
    }

    case "popular": {
      const top = disponibles().filter((x) =>
        x.tags?.some((t) => /pedido|estrella/.test(t)));
      return {
        texto:
          `Lo que más sale: ${lista(top.map((x) => `${x.name} (${precio(x.price)})`))}. ` +
          `El aguacate relleno es el plato de la casa.`,
        platos: top.map((x) => x.id),
        sugerencias: ["¿Qué lleva el aguacate?"],
      };
    }

    case "ver3d": {
      const obj = d ?? porId("aguacate-camarones")!;
      return {
        texto:
          `Sí. Abre ${obj.name.toLowerCase()} y toca "Ver en 3D": puedes ` +
          `girarlo con el dedo. Con el botón de ver en tu mesa lo proyectas ` +
          `a tamaño real${obj.model3d?.medidas
            ? ` (mide unos ${obj.model3d.medidas.ancho} cm)`
            : ""}, apuntando la cámara a la mesa.`,
        platos: [obj.id],
        sugerencias: ["¿Cuánto rinde?"],
      };
    }

    case "presupuesto": {
      const tope = detectarPresupuesto(pregunta)!;
      const ok = disponibles()
        .filter((x) => x.price <= tope)
        .sort((a, b) => a.price - b.price);
      if (!ok.length) {
        const min = Math.min(...disponibles().map((x) => x.price));
        return {
          texto:
            `Por debajo de ${tope} no tengo nada hoy. Lo más económico es ` +
            `${precio(min)}.`,
          platos: [],
          sugerencias: ["¿Qué me recomiendas?"],
        };
      }
      return {
        texto:
          `Por ${tope} o menos: ` +
          `${lista(ok.map((x) => `${x.name} (${precio(x.price)})`))}.`,
        platos: ok.map((x) => x.id),
        sugerencias: ["¿Cuál rinde más?"],
      };
    }

    case "antojo": {
      const a = detectarAntojo(pregunta)!;
      const ok = disponibles().filter(a.filtro);
      if (!ok.length) {
        return {
          texto:
            `Hoy no tengo nada ${a.etiqueta} disponible. ` +
            `¿Te muestro lo más pedido?`,
          platos: [],
          sugerencias: ["Sí, lo más pedido"],
        };
      }
      const dieta = detectarDieta(pregunta);
      const filtrados = dieta ? ok.filter((x) => cumpleDieta(x, dieta)) : ok;
      const fin = filtrados.length ? filtrados : ok;
      return {
        texto:
          `Algo ${a.etiqueta}: ` +
          `${lista(fin.map((x) => `${x.name} (${precio(x.price)})`))}. ` +
          `${fin[0].nota ?? ""}`.trim(),
        platos: fin.map((x) => x.id),
        sugerencias: [`¿Qué lleva ${fin[0].name.split(" ")[0].toLowerCase()}?`],
      };
    }

    case "info_plato": {
      if (!d) break;
      if (!d.available) {
        return {
          texto: noDisponible(d),
          platos: [],
          sugerencias: ["¿Qué me recomiendas?"],
        };
      }
      return {
        texto: fichaPlato(d),
        platos: [d.id],
        sugerencias: [
          "¿Qué lleva?",
          "¿Qué le agrego?",
          "¿Cuánto rinde?",
        ],
      };
    }

    case "recomendar":
    default:
      break;
  }

  // Recomendación por defecto y respuesta a lo que no se entendió.
  const estrella = porId("aguacate-camarones")!;
  const pedidos = disponibles().filter((x) => x.tags?.includes("más pedido"));
  const texto =
    intencion === "desconocido"
      ? `No estoy seguro de haber entendido. Puedo decirte qué lleva un ` +
        `plato, si tiene algún alérgeno, cuánto rinde o qué combina con qué. ` +
        `Si quieres ir a lo seguro: ${estrella.name} (${precio(estrella.price)}), ` +
        `que es el plato de la casa.`
      : `Depende del hambre. El plato de la casa es ${estrella.name} ` +
        `(${precio(estrella.price)}). De la brasa, lo que más sale es ` +
        `${lista(pedidos.map((x) => x.name.toLowerCase()), "y")}. ` +
        `¿Prefieres algo ligero, algo de carne o algo para compartir?`;

  return {
    texto,
    platos: [estrella.id, ...pedidos.slice(0, 2).map((x) => x.id)],
    sugerencias: ["Algo ligero", "Algo de carne", "Para compartir"],
  };
}

/** Resumen del menú para pasárselo a un modelo externo como única fuente. */
export function menuComoTexto(): string {
  return restaurant.dishes
    .map((d) => {
      const campos = [
        `${d.name} | ${precio(d.price)} | ${d.category}`,
        `  disponible: ${d.available ? "si" : "AGOTADO HOY"}`,
        `  descripcion: ${d.description}`,
        `  ingredientes: ${d.ingredientes.join(", ")}`,
        `  alergenos: ${d.alergenos.join(", ") || "ninguno"}`,
        `  picante: ${d.picante}/3${d.picanteOpcional ? " (opcional)" : ""}`,
        `  rinde: ${d.personas} persona(s) · ${d.portion ?? ""}`,
        `  tiempo: ${d.minutos} min`,
        `  perfil: ${d.perfil.join(", ")}`,
      ];
      if (d.combina?.length) {
        campos.push(`  combina con: ${d.combina
          .map((id) => porId(id)?.name)
          .filter(Boolean)
          .join(", ")}`);
      }
      if (d.nota) campos.push(`  nota: ${d.nota}`);
      return campos.join("\n");
    })
    .join("\n\n");
}

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

  // El alias se busca como palabra completa, no como subcadena. Buscando
  // subcadenas, el alias "ron" del coctel aparecía dentro de "camarones" y
  // la pregunta "¿qué platos llevan camarones?" se contestaba hablando del
  // coctel.
  for (const a of d.alias ?? []) {
    const na = norm(a);
    const limite = new RegExp(`(^|\\s)${na.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(s|es)?($|\\s)`);
    if (limite.test(n)) score += na.length > 5 ? 60 : 45;
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

/**
 * Palabra completa, no subcadena: "camarones" contiene "ron", y buscando
 * subcadenas una pregunta sobre camarones se leía como una pregunta sobre
 * alcohol.
 */
function mencionaPalabra(n: string, p: string): boolean {
  const esc = norm(p).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${esc}\\w{0,3}($|\\s)`).test(n);
}

function mencionaAlergeno(n: string, a: Alergeno): boolean {
  return ALERGENOS[a].some((p) => mencionaPalabra(n, p));
}

function detectarAlergeno(q: string): Alergeno | null {
  const n = norm(q);
  for (const a of Object.keys(ALERGENOS) as Alergeno[]) {
    if (mencionaAlergeno(n, a)) return a;
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
  {
    clave: "ninos",
    palabras: ["niño", "nino", "niña", "nina", "chamo", "para un menor",
      "carta infantil", "menu infantil"],
    filtro: (d) => d.picante === 0 && !d.alergenos.includes("alcohol"),
    etiqueta: "para un niño (sin picante y sin alcohol)",
  },
  {
    clave: "proteina",
    palabras: ["alto en proteina", "mucha proteina", "proteina", "gym",
      "gimnasio", "masa muscular", "entreno"],
    filtro: (d) => (d.macros?.proteina ?? 0) >= 40,
    etiqueta: "alto en proteína",
  },
  {
    clave: "pocas_calorias",
    palabras: ["bajo en caloria", "pocas caloria", "menos caloria",
      "light", "cuidando la linea", "sin engordar"],
    filtro: (d) => (d.macros?.kcal ?? 9999) <= 400,
    etiqueta: "bajo en calorías",
  },
];

function detectarAntojo(q: string): Antojo | null {
  const n = norm(q);
  for (const a of ANTOJOS) {
    if (a.palabras.some((p) => n.includes(norm(p)))) return a;
  }
  return null;
}

// ------------------------------------------------------------ ingredientes

/**
 * Sinónimos de comensal -> palabras que aparecen en `ingredientes`.
 *
 * Nadie pregunta "¿tiene Allium cepa?"; pregunta "¿lleva cebolla?" y espera
 * que eso cubra la cebolla morada y la caramelizada. Sin este mapa, buscar
 * "queso" no encontraría el parmesano ni el queso de mano.
 */
const SINONIMOS: Record<string, string[]> = {
  queso: ["queso", "parmesano"],
  cebolla: ["cebolla", "cebollin"],
  ajo: ["ajo"],
  cilantro: ["cilantro"],
  tomate: ["tomate"],
  camaron: ["camaron", "camarones"],
  carne: ["res", "lomo", "carne", "costilla", "cerdo", "tocineta"],
  cerdo: ["cerdo", "costilla", "tocineta"],
  picante: ["aji"],
  limon: ["limon"],
  pan: ["pan", "brioche"],
  harina: ["harina", "pasta", "pan", "brioche"],
  huevo: ["huevo"],
  leche: ["leche", "crema", "mantequilla", "queso", "parmesano"],
  mantequilla: ["mantequilla"],
  mayonesa: ["mayonesa"],
  papa: ["papa", "papas"],
  yuca: ["yuca"],
  albahaca: ["albahaca", "pesto"],
  aguacate: ["aguacate"],
  chocolate: ["chocolate"],
  alcohol: ["ron"],
  azucar: ["papelon", "azucar", "chocolate"],
  frutos: ["piñones", "pinones"],
  lechuga: ["lechuga", "lechugas"],
  vegetales: ["lechuga", "tomate", "cebolla", "aguacate"],
  salsa: ["salsa", "bbq", "chimichurri", "pesto", "vinagreta"],
  // No es un ingrediente sino una preparación, pero "nada frito" es una
  // petición habitual y se resuelve igual: buscando en los ingredientes.
  frito: ["frita", "fritas"],
  crudo: ["curado"],
};

type RefIngrediente = { termino: string; claves: string[] };

/**
 * Todos los ingredientes mencionados en la pregunta.
 *
 * En plural a propósito: "algo sin gluten y sin mariscos" o "no come
 * picante ni cebolla" son peticiones con dos restricciones, y contestar
 * solo a la primera es la clase de respuesta a medias que hace que el
 * comensal deje de preguntar.
 */
function detectarIngredientes(q: string): RefIngrediente[] {
  const qr = tokens(q).map(raiz);
  const out: RefIngrediente[] = [];
  const vistos = new Set<string>();

  for (const [termino, claves] of Object.entries(SINONIMOS)) {
    if (qr.includes(raiz(termino)) && !vistos.has(termino)) {
      vistos.add(termino);
      out.push({ termino, claves });
    }
  }
  if (out.length) return out;

  // Si no está en el mapa, se busca contra los ingredientes reales del menú.
  for (const d of restaurant.dishes) {
    for (const ing of d.ingredientes) {
      for (const t of tokens(ing)) {
        if (qr.includes(raiz(t)) && !vistos.has(t)) {
          vistos.add(t);
          out.push({ termino: t, claves: [t] });
        }
      }
    }
  }
  return out;
}

function detectarIngrediente(q: string): RefIngrediente | null {
  return detectarIngredientes(q)[0] ?? null;
}

function llevaIngrediente(d: Dish, claves: string[]): boolean {
  const texto = norm(d.ingredientes.join(" "));
  return claves.some((c) => texto.includes(norm(c).replace(/s$/, "")));
}

/** Si la cocina admite quitarlo, el plato sigue siendo una opción. */
function seLePuedeQuitar(d: Dish, termino: string): boolean {
  return (d.ajustes ?? []).some((a) => norm(a).includes(`sin ${norm(termino)}`));
}

/** El ajuste concreto que menciona ese ingrediente, si existe. */
function ajustePara(d: Dish, termino: string): string | null {
  const t = norm(termino).replace(/s$/, "");
  return (d.ajustes ?? []).find((a) => norm(a).includes(t)) ?? null;
}

// ----------------------------------------------------------------- macros

type EjeMacro = "kcal" | "proteina" | "carbohidratos" | "grasa" | "fibra";

const NOMBRE_MACRO: Record<EjeMacro, string> = {
  kcal: "calorías",
  proteina: "proteína",
  carbohidratos: "carbohidratos",
  grasa: "grasa",
  fibra: "fibra",
};

function detectarEjeMacro(q: string): EjeMacro | null {
  const n = norm(q);
  if (incluye(n, "caloria", "kcal", "calorico", "engorda")) return "kcal";
  if (incluye(n, "proteina", "proteico")) return "proteina";
  if (incluye(n, "carbohidrato", "carbo", "azucar")) return "carbohidratos";
  if (incluye(n, "grasa", "graso")) return "grasa";
  if (incluye(n, "fibra")) return "fibra";
  if (incluye(n, "macro", "nutricional", "nutricion", "saludable", "sano",
    "nutritiv", "pesado es")) return "kcal";
  return null;
}

function resumenMacros(d: Dish): string {
  if (!d.macros) return "";
  const m = d.macros;
  return (
    `${m.kcal} kcal aproximadas, ${m.proteina} g de proteína, ` +
    `${m.carbohidratos} g de carbohidratos y ${m.grasa} g de grasa` +
    (d.gramos ? `, sobre unos ${d.gramos} g servidos` : "")
  );
}

const conMacros = () => disponibles().filter((d) => !!d.macros);

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
  | "sin_ingrediente" | "con_ingrediente" | "macros" | "ajustes"
  | "categoria" | "superlativo" | "fuera_de_carta" | "desconocido";

/** Frases que piden excluir algo: "sin cebolla", "que no tenga queso". */
function pideExcluir(n: string): boolean {
  return (
    /\bsin\b/.test(n) ||
    /\bno (tiene|tienen|lleva|llevan|trae|traen|tenga|lleve|traiga|come|comen|quiere|quieren|quiero)\b/
      .test(n) ||
    incluye(n, "no puedo comer", "no como", "odio", "no me gusta", "quitar",
      "sacar", "libre de")
  );
}

/**
 * Preguntas del local que no se responden desde la carta.
 *
 * Inventarse un horario o una forma de pago sería peor que no contestar:
 * el comensal actuaría sobre un dato falso. Aquí se deriva al mesero.
 */
function esFueraDeCarta(n: string): boolean {
  return incluye(n, "wifi", "baño", "bano", "estacionamiento", "reserva",
    "reservar", "domicilio", "delivery", "factura", "tarjeta", "efectivo",
    "pago movil", "zelle", "propina", "horario", "a que hora", "direccion",
    "donde queda", "telefono", "la cuenta", "pagar", "pago con");
}

const CATEGORIA_PALABRAS: Record<string, string[]> = {
  entradas: ["entrada", "entradas", "para empezar", "aperitivo", "picar"],
  fuertes: ["fuerte", "fuertes", "plato principal", "principales", "brasa",
    "parrilla"],
  postres: ["postre", "postres", "dulce final", "para cerrar"],
  bebidas: ["bebida", "bebidas", "tomar", "trago", "barra", "beber"],
};

function detectarCategoria(q: string): string | null {
  const n = norm(q);
  for (const [id, palabras] of Object.entries(CATEGORIA_PALABRAS)) {
    if (palabras.some((p) => n.includes(p))) return id;
  }
  return null;
}

type Superlativo = {
  palabras: string[];
  etiqueta: string;
  valor: (d: Dish) => number;
  mayor: boolean;
};

const SUPERLATIVOS: Superlativo[] = [
  { palabras: ["mas barato", "mas economico", "menor precio", "mas accesible"],
    etiqueta: "más barato", valor: (d) => d.price, mayor: false },
  { palabras: ["mas caro", "mas costoso", "mayor precio"],
    etiqueta: "más caro", valor: (d) => d.price, mayor: true },
  { palabras: ["mas rapido", "sale antes", "menos tiempo"],
    etiqueta: "de salida más rápida", valor: (d) => d.minutos, mayor: false },
  { palabras: ["mas tarda", "mas lento", "mas demora"],
    etiqueta: "que más tarda", valor: (d) => d.minutos, mayor: true },
  { palabras: ["mas grande", "mas abundante", "el que mas rinde", "mas comida"],
    etiqueta: "más abundante", valor: (d) => d.gramos ?? 0, mayor: true },
  { palabras: ["mas proteina", "mayor proteina"],
    etiqueta: "con más proteína", valor: (d) => d.macros?.proteina ?? 0,
    mayor: true },
  { palabras: ["menos caloria", "mas ligero", "menos calorico"],
    etiqueta: "con menos calorías", valor: (d) => d.macros?.kcal ?? 9999,
    mayor: false },
  { palabras: ["mas caloria", "mas calorico", "que mas engorda"],
    etiqueta: "con más calorías", valor: (d) => d.macros?.kcal ?? 0,
    mayor: true },
  // Cuánta comida se lleva el comensal por cada unidad que paga. Es la
  // pregunta real detrás de "¿qué me llena más por menos dinero?".
  { palabras: ["llena mas", "rinde mas por", "por menos dinero",
    "mejor relacion", "mas comida por", "me conviene mas"],
    etiqueta: "que más rinde por lo que cuesta",
    valor: (d) => (d.gramos ?? 0) / Math.max(d.price, 0.01), mayor: true },
];

function detectarSuperlativo(q: string): Superlativo | null {
  const n = norm(q);
  return SUPERLATIVOS.find((s) => s.palabras.some((p) => n.includes(p))) ?? null;
}

function detectarIntencion(q: string, platos: Dish[]): Intencion {
  const n = norm(q);
  const conPlato = platos.length > 0;

  if (incluye(n, "gracias", "listo asi", "eso es todo")) return "gracias";
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)\b/
    .test(n)) return "saludo";
  if (incluye(n, "que puedes hacer", "que sabes", "ayuda", "como funciona",
    "en que me puedes ayudar")) return "ayuda";

  // Antes que cualquier intención del menú: "¿tienen wifi?" lleva "tienen"
  // y si no se corta aquí acaba respondido como una pregunta de existencias.
  if (esFueraDeCarta(n)) return "fuera_de_carta";

  if (incluye(n, "que lleva", "que trae", "que tiene", "ingrediente",
    "de que esta hecho", "como lo preparan", "como se prepara",
    "de que es") && conPlato) return "ingredientes";

  // "Soy vegetariano y alérgico a los lácteos" son dos condiciones a la vez.
  // La rama de dieta sabe combinarlas; la de alergia sola perdería la mitad.
  const dietaDetectada = detectarDieta(q);
  const dietaFuerte = dietaDetectada === "vegetariano" ||
    dietaDetectada === "vegano";

  if (!dietaFuerte && incluye(n, "alergi", "celiac", "intoleran",
    "puedo comer", "soy alergico")) {
    return conPlato ? "alergia_plato" : "alergia_general";
  }
  // "¿el lomo tiene gluten?" es una pregunta de alérgeno; "¿dónde hay
  // queso?" es una búsqueda por ingrediente. La diferencia está en si se
  // nombra un plato, no en la palabra suelta.
  if (conPlato && detectarAlergeno(q) &&
    incluye(n, "tiene", "lleva", "contiene")) {
    return "alergia_plato";
  }
  if (detectarDieta(q)) return "dieta";

  // Macros antes que precio: "¿cuánto tiene de proteína?" lleva "cuanto".
  if (detectarEjeMacro(q)) return "macros";

  // Exclusión por ingrediente. Va después de dieta y alergia porque
  // "sin gluten" o "soy alérgico al marisco" son preguntas distintas y con
  // mejor respuesta por esas vías.
  if (pideExcluir(n) && detectarIngrediente(q)) {
    return conPlato && incluye(n, "puedo pedir", "se puede", "me lo pueden",
      "lo pueden", "aceptan") ? "ajustes" : "sin_ingrediente";
  }
  if (incluye(n, "puedo pedir", "se puede pedir", "lo pueden hacer",
    "se puede cambiar", "puedo cambiar", "cambiar", "modificar", "en vez de",
    "en lugar de", "media porcion", "porcion pequeña", "porcion pequena",
    "aparte")) return "ajustes";

  if (detectarSuperlativo(q)) return "superlativo";

  if (incluye(n, "cuanto cuesta", "cuanto vale", "precio", "cuanto sale",
    "que precio")) return "precio";
  if (incluye(n, "pica", "picante", "enchila") && conPlato) return "picante";
  if (incluye(n, "alcanza", "para cuanta", "para cuanto", "cuanta gente",
    "es grande", "que tan grande", "porcion", "tamaño", "tamano",
    "cuanto trae", "gramo", "cuanto pesa", "que peso", "cuanto rinde",
    "para cuantas personas")) return "porcion";
  if (incluye(n, "cuanto tarda", "cuanto demora", "cuanto se tarda",
    "cuanto tiempo", "rapido")) return "tiempo";

  if (incluye(n, "que va con", "que combina", "acompan", "que le agrego",
    "que pido con", "con que", "para tomar", "tomo con", "bebo con",
    "tomar con", "beber con", "que bebida", "maridaje", "que mas pido",
    "algo mas", "que le pongo", "que sirve con")) return "maridaje";

  if (incluye(n, " o ", "mejor", "diferencia", "cual elijo", "cual me conviene")
    && platos.length >= 2) return "comparar";

  if (incluye(n, "hay ", "queda", "disponible", "se acabo", "tienen")) {
    // "¿tienen algo de carne?" es un antojo y "¿dónde hay queso?" una
    // búsqueda por ingrediente; ninguna de las dos pregunta por existencias.
    if (conPlato) return "disponibilidad";
    if (
      !detectarAntojo(q) &&
      detectarPresupuesto(q) === null &&
      !detectarCategoria(q) &&
      !detectarIngrediente(q)
    ) {
      return "disponibilidad";
    }
  }
  if (incluye(n, "mas pedido", "popular", "el mejor", "mas vendido",
    "especialidad", "estrella", "que sale mas")) return "popular";
  if (incluye(n, "3d", "ver el plato", "realidad aumentada", " ar ",
    "como se ve", "foto")) return "ver3d";

  if (detectarPresupuesto(q) !== null) return "presupuesto";
  // El antojo solo aplica si no se nombró un plato: "¿es saludable la
  // ensalada?" contiene "sano" pero pregunta por un plato concreto, y
  // responder con una lista de platos ligeros deja la pregunta sin contestar.
  if (!conPlato && detectarAntojo(q)) return "antojo";
  if (incluye(n, "recomien", "sugier", "que pido", "que como",
    "no se que", "opciones")) return "recomendar";

  // "¿qué postres tienen?" se responde con la sección entera.
  if (!conPlato && detectarCategoria(q)) return "categoria";

  // "¿qué platos llevan camarones?" sin nombrar ningún plato.
  if (!conPlato && detectarIngrediente(q)) return "con_ingrediente";

  if (conPlato) return "info_plato";
  if (esFueraDeCarta(n)) return "fuera_de_carta";
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
  "Algo sin cebolla",
  "¿Cuántas calorías tiene la hamburguesa?",
  "¿Qué tomo con el lomo?",
];

function fichaPlato(d: Dish): string {
  const partes = [`${d.name} — ${precio(d.price)}.`, d.description];
  if (d.portion) partes.push(`${d.portion}.`);
  if (d.macros) partes.push(`Unas ${d.macros.kcal} kcal aproximadas.`);
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
          "Puedo decirte qué lleva cada plato, sus alérgenos, cuánto rinde " +
          "y cuántos gramos trae, sus calorías y macros, qué se le puede " +
          "quitar, cuánto tarda y qué combina con qué. También busco al " +
          "revés: platos sin un ingrediente, por presupuesto o por antojo.",
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
      // "sin gluten y sin mariscos" son dos condiciones. Contestar solo la
      // primera le pone delante un plato que no puede comer.
      const nq = norm(pregunta);
      const extra = (Object.keys(ALERGENOS) as Alergeno[]).filter((a) => {
        if (a === "gluten" && dieta === "sin gluten") return false;
        if (a === "lacteos" && dieta === "sin lacteos") return false;
        return mencionaAlergeno(nq, a);
      });
      const ok = disponibles().filter(
        (x) => cumpleDieta(x, dieta) && extra.every((a) => !x.alergenos.includes(a))
      );
      if (extra.length) {
        // Un plato que incumple solo por algo que la cocina puede quitar
        // sigue siendo una opción, y a veces es la única.
        const ajustables = disponibles().filter(
          (x) =>
            !ok.includes(x) &&
            cumpleDieta(x, dieta) &&
            extra.every((a) =>
              !x.alergenos.includes(a) ||
              ALERGENOS[a].some((p) => seLePuedeQuitar(x, p)))
        );
        if (!ok.length && !ajustables.length) {
          return {
            texto:
              `Con las dos condiciones —${dieta} y sin ${lista(extra)}— hoy no ` +
              `me queda ningún plato. Vale la pena preguntarle al mesero si ` +
              `la cocina puede adaptar alguno.`,
            platos: [],
            sugerencias: ["¿Qué hay sin mariscos?", "¿Qué me recomiendas?"],
          };
        }
        const trozos: string[] = [];
        if (ok.length) {
          trozos.push(
            `${dieta} y sin ${lista(extra)}: ` +
            lista(ok.map((x) => `${x.name} (${precio(x.price)})`))
          );
        }
        if (ajustables.length) {
          trozos.push(
            `Y ${lista(ajustables.map(
              (x) => `${x.name.toLowerCase()} (${lista(x.ajustes ?? [], "o")})`
            ))}`
          );
        }
        return {
          texto: `${trozos.join(". ")}.`,
          platos: [...ok, ...ajustables].map((x) => x.id),
          sugerencias: ["¿Qué lleva exactamente?", "¿Cuál es el más pedido?"],
        };
      }
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
      if (!d) {
        // "¿qué porciones se pueden pedir?" sin nombrar plato: lo útil es
        // decir qué rinde para uno, qué rinde para dos y qué se puede pedir
        // a media porción.
        const paraDos = disponibles().filter((x) => x.personas >= 2);
        const medias = disponibles().filter((x) =>
          (x.ajustes ?? []).some((a) => norm(a).includes("media porcion")));
        return {
          texto:
            `Cada plato es una porción individual salvo ` +
            `${lista(paraDos.map((x) => x.name.toLowerCase()))}, que alcanzan ` +
            `para dos. ` +
            (medias.length
              ? `Se puede pedir media porción de ` +
                `${lista(medias.map((x) => x.name.toLowerCase()))}. `
              : "") +
            `Si me dices cuál te interesa te doy el gramaje exacto.`,
          platos: [...paraDos, ...medias].slice(0, 3).map((x) => x.id),
          sugerencias: ["¿Cuánto trae el lomo?", "¿Qué alcanza para dos?"],
        };
      }
      const rinde =
        d.personas >= 2
          ? "Alcanza cómodo para dos"
          : "Es una porción para una persona";
      const peso = d.gramos ? ` Son unos ${d.gramos} g servidos.` : "";
      const media = (d.ajustes ?? []).some((a) =>
        norm(a).includes("media porcion"))
        ? " También se puede pedir media porción."
        : "";
      const med = d.model3d?.medidas
        ? ` El plato mide unos ${d.model3d.medidas.ancho} cm de ancho; con el ` +
          `botón de verlo en tu mesa lo proyectas a tamaño real.`
        : "";
      return {
        texto: `${d.portion ?? rinde}. ${rinde}.${peso}${media}${med}`,
        platos: [d.id],
        sugerencias: ["Quiero verlo en 3D", "¿Cuántas calorías tiene?"],
      };
    }

    case "sin_ingrediente": {
      const ings = detectarIngredientes(pregunta);
      if (!ings.length) break;
      // "sin cebolla ni picante", no "sin cebolla y picante".
      const nombres = lista(ings.map((i) => i.termino), ings.length > 1 ? "ni" : "y");

      // Un plato solo sirve si está libre de TODAS las restricciones.
      const libres = disponibles().filter(
        (x) => ings.every((i) => !llevaIngrediente(x, i.claves))
      );
      // Y sirve con aviso si lo que lleva se le puede quitar.
      const ajustables = disponibles().filter(
        (x) =>
          !libres.includes(x) &&
          ings.every(
            (i) => !llevaIngrediente(x, i.claves) || seLePuedeQuitar(x, i.termino)
          )
      );

      if (!libres.length && !ajustables.length) {
        return {
          texto:
            `Hoy todo lo que hay en la carta lleva ${nombres}. ` +
            `Vale la pena preguntarle al mesero si la cocina puede adaptarlo.`,
          platos: [],
          sugerencias: ["¿Qué me recomiendas?"],
        };
      }
      const partes: string[] = [];
      if (libres.length) {
        partes.push(
          `Sin ${nombres}: ` +
          lista(libres.map((x) => `${x.name} (${precio(x.price)})`))
        );
      }
      if (ajustables.length) {
        partes.push(
          `Y ${lista(ajustables.map((x) => x.name.toLowerCase()))} ` +
          `${ajustables.length > 1 ? "se pueden pedir" : "se puede pedir"} ` +
          `sin ${nombres} si lo avisas`
        );
      }
      return {
        texto: `${partes.join(". ")}.`,
        platos: [...libres, ...ajustables].slice(0, 4).map((x) => x.id),
        sugerencias: ["¿Cuál es el más pedido de esos?", "¿Qué lleva exactamente?"],
      };
    }

    case "con_ingrediente": {
      const ing = detectarIngrediente(pregunta)!;
      const con = disponibles().filter((x) => llevaIngrediente(x, ing.claves));
      if (!con.length) {
        return {
          texto:
            `Ningún plato de la carta de hoy lleva ${ing.termino}. ` +
            `¿Te digo qué es lo más pedido?`,
          platos: [],
          sugerencias: ["Sí, lo más pedido", "Algo de carne"],
        };
      }
      return {
        texto:
          `Con ${ing.termino}: ` +
          `${lista(con.map((x) => `${x.name} (${precio(x.price)})`))}.`,
        platos: con.map((x) => x.id),
        sugerencias: [`¿Qué lleva ${con[0].name.split(" ")[0].toLowerCase()}?`],
      };
    }

    case "macros": {
      const eje = detectarEjeMacro(pregunta)!;
      if (d?.macros) {
        return {
          texto:
            `${d.name}: ${resumenMacros(d)}. Son valores aproximados, ` +
            `calculados a partir de la receta.`,
          platos: [d.id],
          sugerencias: ["¿Qué tiene menos calorías?", "¿Cuánto rinde?"],
        };
      }
      // Sin plato concreto: se ordena la carta por el eje preguntado.
      const menor = eje === "kcal" || eje === "grasa" || eje === "carbohidratos";
      const orden = [...conMacros()].sort((a, b) =>
        menor
          ? (a.macros![eje] as number) - (b.macros![eje] as number)
          : (b.macros![eje] as number) - (a.macros![eje] as number)
      );
      const unidad = eje === "kcal" ? "kcal" : "g";
      return {
        texto:
          `Por ${NOMBRE_MACRO[eje]}, ${menor ? "de menos a más" : "de más a menos"}: ` +
          `${lista(orden.slice(0, 4).map(
            (x) => `${x.name.toLowerCase()} (${x.macros![eje]} ${unidad})`))}. ` +
          `Son valores aproximados del plato completo, calculados desde la receta.`,
        platos: orden.slice(0, 3).map((x) => x.id),
        sugerencias: ["Algo bajo en calorías", "Algo alto en proteína"],
      };
    }

    case "ajustes": {
      if (!d) {
        if (incluye(norm(pregunta), "media porcion", "porcion pequeña",
          "porcion pequena", "mitad")) {
          const medias = disponibles().filter((x) =>
            (x.ajustes ?? []).some((a) => norm(a).includes("media porcion")));
          return {
            texto: medias.length
              ? `Se puede pedir media porción de ` +
                `${lista(medias.map((x) => x.name.toLowerCase()))}. ` +
                `El resto sale en porción completa.`
              : `Hoy no hay medias porciones; todo sale en porción completa.`,
            platos: medias.map((x) => x.id),
            sugerencias: ["¿Cuánto rinde cada plato?"],
          };
        }
        // "¿puedo cambiar las papas?" no nombra plato, pero sí el
        // ingrediente: se busca qué plato lo lleva y qué admite la cocina.
        const ingSuelto = detectarIngrediente(pregunta);
        if (ingSuelto) {
          const afectados = disponibles()
            .map((x) => ({ x, aj: ajustePara(x, ingSuelto.termino) }))
            .filter((r) => r.aj);
          if (afectados.length) {
            return {
              texto:
                `${lista(afectados.map(
                  (r) => `en ${r.x.name.toLowerCase()} se puede ${r.aj!.toLowerCase()}`
                ))}. Avísale al mesero al pedir.`,
              platos: afectados.map((r) => r.x.id),
              sugerencias: ["¿Qué más se le puede quitar?"],
            };
          }
        }
        const conAjuste = disponibles().filter((x) => (x.ajustes ?? []).length);
        return {
          texto:
            `La cocina admite cambios en casi todo: ` +
            `${lista(conAjuste.slice(0, 4).map(
              (x) => `${x.name.toLowerCase()} (${lista(x.ajustes!.slice(0, 2), "o")})`
            ))}. ¿De qué plato quieres saber?`,
          platos: conAjuste.slice(0, 3).map((x) => x.id),
          sugerencias: ["¿La hamburguesa sin tocineta?", "¿Media porción de qué?"],
        };
      }
      const ing = detectarIngrediente(pregunta);
      if (ing && !llevaIngrediente(d, ing.claves)) {
        return {
          texto: `${d.name} no lleva ${ing.termino}, así que puedes pedirlo tal cual.`,
          platos: [d.id],
          sugerencias: ["¿Qué lleva entonces?"],
        };
      }
      const aj = ing ? ajustePara(d, ing.termino) : null;
      if (aj) {
        return {
          texto:
            `Sí: en ${d.name.toLowerCase()} se puede ${aj.toLowerCase()}. ` +
            `Avísale al mesero al ordenar.`,
          platos: [d.id],
          sugerencias: ["¿Qué más se le puede quitar?"],
        };
      }
      if (!(d.ajustes ?? []).length) {
        return {
          texto:
            `${d.name} sale como está en la carta. Si necesitas un cambio, ` +
            `el mesero lo consulta con cocina.` + (d.nota ? ` ${d.nota}` : ""),
          platos: [d.id],
          sugerencias: ["¿Qué lleva?"],
        };
      }
      return {
        texto:
          `De ${d.name.toLowerCase()} se puede pedir: ${lista(d.ajustes!)}.` +
          (ing ? ` Quitar ${ing.termino} no está entre los cambios habituales; ` +
            `pregúntale al mesero.` : "") +
          (d.nota ? ` ${d.nota}` : ""),
        platos: [d.id],
        sugerencias: ["¿Cuánto rinde?", "¿Qué lleva?"],
      };
    }

    case "categoria": {
      const cat = detectarCategoria(pregunta)!;
      const nombre = restaurant.categories.find((c) => c.id === cat)?.name ?? cat;
      const ok = disponibles().filter((x) => x.category === cat);
      const agotados = restaurant.dishes.filter(
        (x) => x.category === cat && !x.available
      );
      if (!ok.length) {
        return {
          texto: `Hoy no queda nada en ${nombre.toLowerCase()}.`,
          platos: [],
          sugerencias: ["¿Qué me recomiendas?"],
        };
      }
      return {
        texto:
          `En ${nombre.toLowerCase()}: ` +
          `${lista(ok.map((x) => `${x.name} (${precio(x.price)})`))}.` +
          (agotados.length
            ? ` ${lista(agotados.map((x) => x.name))} está agotado hoy.`
            : ""),
        platos: ok.map((x) => x.id),
        sugerencias: [`¿Qué lleva ${ok[0].name.split(" ")[0].toLowerCase()}?`],
      };
    }

    case "superlativo": {
      const s = detectarSuperlativo(pregunta)!;
      const pool = disponibles().filter((x) => s.valor(x) > 0);
      if (!pool.length) break;
      const orden = [...pool].sort((a, b) =>
        s.mayor ? s.valor(b) - s.valor(a) : s.valor(a) - s.valor(b));
      const g = orden[0];
      const detalle =
        s.etiqueta.includes("proteína") || s.etiqueta.includes("calorías")
          ? ` (${resumenMacros(g)})`
          : s.etiqueta.includes("abundante") && g.gramos
            ? ` (unos ${g.gramos} g)`
            : s.etiqueta.includes("rápida") || s.etiqueta.includes("tarda")
              ? ` (${g.minutos} min)`
              : ` (${precio(g.price)})`;
      return {
        texto:
          `El ${s.etiqueta} es ${g.name}${detalle}. ` +
          `Detrás va ${orden[1].name.toLowerCase()}.`,
        platos: orden.slice(0, 2).map((x) => x.id),
        sugerencias: [`¿Qué lleva ${g.name.split(" ")[0].toLowerCase()}?`],
      };
    }

    case "fuera_de_carta":
      return {
        texto:
          `Eso no lo manejo yo: solo sé de la carta — ingredientes, ` +
          `alérgenos, porciones, macros, tiempos y qué combina con qué. ` +
          `Para cuenta, pagos, reservas o cualquier cosa del local, el ` +
          `mesero te resuelve mejor.`,
        platos: [],
        sugerencias: SUG_BASE,
      };

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

  // Antes de rendirse: si en la pregunta hay un ingrediente del menú, eso
  // ya es una respuesta concreta. Contestar "no entendí" teniendo el dato
  // es lo que hace que un asistente se sienta de cartón.
  if (intencion === "desconocido") {
    const ing = detectarIngrediente(pregunta);
    if (ing) {
      const con = disponibles().filter((x) => llevaIngrediente(x, ing.claves));
      if (con.length) {
        return {
          texto:
            `Con ${ing.termino} hay ` +
            `${lista(con.map((x) => `${x.name} (${precio(x.price)})`))}. ` +
            `¿Quieres saber qué lleva alguno, cuánto rinde o sus macros?`,
          platos: con.map((x) => x.id),
          sugerencias: ["¿Qué lleva?", "¿Cuánto rinde?", "¿Cuántas calorías?"],
        };
      }
    }
    const cat = detectarCategoria(pregunta);
    if (cat) {
      const ok = disponibles().filter((x) => x.category === cat);
      if (ok.length) {
        return {
          texto: `En esa sección hay ${lista(ok.map((x) => x.name))}.`,
          platos: ok.map((x) => x.id),
          sugerencias: ["¿Qué me recomiendas?"],
        };
      }
    }
  }

  const estrella = porId("aguacate-camarones")!;
  const pedidos = disponibles().filter((x) => x.tags?.includes("más pedido"));
  const texto =
    intencion === "desconocido"
      ? `Esa no la tengo. Lo que sí puedo decirte de cualquier plato: qué ` +
        `lleva, qué alérgenos tiene, cuánto rinde, cuántas calorías y ` +
        `macros trae, qué se le puede quitar, cuánto tarda y con qué ` +
        `combina. También busco por ingrediente ("algo sin cebolla") o por ` +
        `presupuesto. Si quieres ir a lo seguro: ${estrella.name} ` +
        `(${precio(estrella.price)}), que es el plato de la casa.`
      : `Depende del hambre. El plato de la casa es ${estrella.name} ` +
        `(${precio(estrella.price)}). De la brasa, lo que más sale es ` +
        `${lista(pedidos.map((x) => x.name.toLowerCase()), "y")}. ` +
        `¿Prefieres algo ligero, algo de carne o algo para compartir?`;

  return {
    texto,
    platos: [estrella.id, ...pedidos.slice(0, 2).map((x) => x.id)],
    sugerencias: ["Algo ligero", "Algo de carne", "Algo sin mariscos"],
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
        `  peso servido: ${d.gramos ? `${d.gramos} g` : "sin dato"}`,
        `  tiempo: ${d.minutos} min`,
        `  perfil: ${d.perfil.join(", ")}`,
      ];
      if (d.macros) {
        campos.push(
          `  macros aproximados del plato completo: ${d.macros.kcal} kcal, ` +
          `${d.macros.proteina} g proteina, ${d.macros.carbohidratos} g ` +
          `carbohidratos, ${d.macros.grasa} g grasa, ${d.macros.fibra} g fibra`
        );
      }
      if (d.ajustes?.length) {
        campos.push(`  se puede pedir: ${d.ajustes.join(", ")}`);
      }
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

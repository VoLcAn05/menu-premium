/**
 * Banco de pruebas del asistente.
 *
 * Copia lib/ a un directorio temporal, ajusta los imports para que Node los
 * resuelva, y corre un set de preguntas reales comprobando que la respuesta
 * contenga lo que debe contener (y no contenga lo que no debe).
 */

import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SRC = new URL("../lib", import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), "assist-"));
mkdirSync(join(dir, "lib"), { recursive: true });

for (const f of ["types.ts", "data.ts", "assistant.ts"]) {
  let src = readFileSync(join(SRC, f), "utf8");
  src = src
    .replace(/from "\.\/data"/g, 'from "./data.ts"')
    .replace(/from "\.\/types"/g, 'from "./types.ts"')
    .replace(/import \{ Restaurant \}/g, "import type { Restaurant }");
  writeFileSync(join(dir, "lib", f), src);
}

const { responder, detectarPlatos } = await import(
  join(dir, "lib", "assistant.ts")
);

// ----------------------------------------------------------------- casos
// debe: subcadenas que TIENEN que aparecer (en minúsculas, sin acentos)
// noDebe: subcadenas que NO pueden aparecer

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const CASOS = [
  // --- conocimiento de ingredientes
  ["¿Qué lleva el ceviche?", ["camarones", "limon", "cilantro"], []],
  ["de que esta hecha la hamburguesa", ["queso ahumado", "tocineta"], []],
  ["ingredientes de la pasta", ["pesto", "parmesano"], []],

  // --- alérgenos: el caso que de verdad importa
  ["¿la pasta tiene gluten?", ["si", "gluten"], []],
  ["el lomo tiene gluten", ["no lleva gluten"], []],
  ["soy alergico a los mariscos", ["lomo", "hamburguesa"], []],
  ["tengo alergia a los frutos secos que puedo comer", ["lomo"], []],
  ["soy celiaco", ["lomo", "evita"], []],

  // --- dietas
  ["opciones vegetarianas", ["ensalada"], []],
  ["algo vegano", ["ensalada"], []],
  ["que hay sin lactosa", ["ceviche"], []],

  // --- precio y presupuesto
  ["cuanto cuesta el lomo", ["14"], []],
  ["algo por menos de 8", ["ensalada", "ceviche"], ["lomo a la parrilla"]],
  ["que es lo mas barato", ["ensalada"], []],

  // --- porción y tiempo
  ["la ensalada alcanza para dos", ["dos"], []],
  ["cuanto tarda el lomo", ["22"], []],
  ["que sale rapido", ["ensalada", "ceviche"], []],

  // --- picante
  ["el ceviche pica", ["picante"], []],
  ["que hay picante", ["ceviche", "aguacate"], []],

  // --- maridaje y upsell
  ["que tomo con el lomo", ["coctel"], []],
  ["que le agrego a la hamburguesa", ["coctel", "ensalada"], []],

  // --- comparación
  ["lomo o costillas cual es mejor", ["lomo", "costilla"], []],

  // --- disponibilidad (costillas está agotado)
  ["hay costillas", ["agotad"], []],
  ["quiero costillas bbq", ["agotad"], []],

  // --- antojos
  ["quiero algo de carne", ["lomo"], []],
  ["algo ligero", ["ceviche"], []],
  ["tengo mucha hambre", ["lomo", "hamburguesa"], []],
  ["algo para compartir", ["ensalada"], []],
  ["quiero mariscos", ["ceviche", "aguacate"], []],
  ["algo dulce", ["torta"], []],

  // --- populares y 3D
  ["cual es el mas pedido", ["aguacate", "lomo"], []],
  ["puedo ver el plato en 3d", ["3d", "tamano real"], []],

  // --- conversación
  ["hola", ["bienvenido"], []],
  ["gracias", ["orden"], []],
  ["que puedes hacer", ["alergeno"], []],

  // --- fuera de dominio: debe admitir que no sabe, no inventar
  ["cual es la capital de francia", ["esa no la tengo"], ["paris"]],
  ["tienen sushi", ["no esta en la carta"], []],

  // --- exclusión por ingrediente (lo que antes no sabía hacer)
  ["que comidas no tienen cebolla", ["sin cebolla", "lomo"], []],
  ["algo sin queso", ["sin queso"], []],
  ["quiero algo que no lleve camarones", ["sin camaron"], ["ceviche de camarones (7)"]],
  ["no como cerdo, que me recomiendas", ["sin cerdo"], []],
  ["platos sin cilantro", ["sin cilantro"], []],
  ["algo sin tomate", ["sin tomate"], []],

  // --- búsqueda por ingrediente
  ["que platos llevan camarones", ["ceviche", "aguacate", "pasta"], []],
  ["donde hay queso", ["queso"], []],
  ["que tiene chocolate", ["torta"], []],

  // --- macros
  ["cuantas calorias tiene la hamburguesa", ["1620", "kcal"], []],
  ["macros del lomo", ["proteina", "grasa"], []],
  ["cuanta proteina tiene el ceviche", ["61"], []],
  ["que tiene menos calorias", ["ceviche"], []],
  ["cual tiene mas proteina", ["proteina"], []],
  ["informacion nutricional", ["aproximad"], []],
  ["quiero algo alto en proteina", ["proteina"], []],
  ["algo bajo en calorias", ["caloria"], []],

  // --- porciones y ajustes
  ["que porciones se pueden pedir", ["porcion"], []],
  ["cuantos gramos trae el lomo", ["463"], []],
  ["puedo pedir la hamburguesa sin tocineta", ["sin tocineta"], []],
  ["se puede pedir media porcion", ["media porcion"], []],
  ["la ensalada se puede pedir sin queso", ["sin queso"], []],
  ["que le puedo quitar al coctel", ["sin alcohol"], []],

  // --- secciones y superlativos
  ["que postres tienen", ["torta"], []],
  ["que bebidas hay", ["coctel"], []],
  ["cual es el plato mas grande", ["555"], []],
  ["cual es el mas caro", ["lomo"], []],

  // --- cosas del local: debe derivar al mesero, no inventar
  ["tienen wifi", ["mesero"], []],
  ["puedo pagar con tarjeta", ["mesero"], []],
];

let ok = 0;
const fallos = [];

for (const [q, debe, noDebe] of CASOS) {
  const r = responder(q);
  const t = norm(r.texto);
  const faltan = debe.filter((s) => !t.includes(norm(s)));
  const sobran = noDebe.filter((s) => t.includes(norm(s)));

  // Ningún caso puede devolver texto vacío o sin sentido
  const vacio = r.texto.trim().length < 20;

  if (faltan.length || sobran.length || vacio) {
    fallos.push({ q, faltan, sobran, vacio, texto: r.texto });
  } else {
    ok++;
  }
}

console.log(`\n${ok}/${CASOS.length} casos correctos\n`);

if (fallos.length) {
  console.log("FALLOS:");
  for (const f of fallos) {
    console.log(`\n  P: ${f.q}`);
    if (f.faltan.length) console.log(`     falta: ${f.faltan.join(" | ")}`);
    if (f.sobran.length) console.log(`     sobra: ${f.sobran.join(" | ")}`);
    if (f.vacio) console.log(`     respuesta demasiado corta`);
    console.log(`     R: ${f.texto.slice(0, 190)}`);
  }
  process.exit(1);
}

// Comprobación extra: los platos devueltos deben existir
import(join(dir, "lib", "data.ts")).then(({ restaurant }) => {
  const ids = new Set(restaurant.dishes.map((d) => d.id));
  for (const [q] of CASOS) {
    for (const id of responder(q).platos) {
      if (!ids.has(id)) {
        console.log(`ID inexistente "${id}" en respuesta a "${q}"`);
        process.exit(1);
      }
    }
  }
  console.log("Todos los IDs de plato devueltos existen en el menu.");
});

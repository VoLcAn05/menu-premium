import { Restaurant } from "./types";

/**
 * Restaurante de demostración.
 *
 * Las fotos son de stock (Unsplash, uso libre) solo para esta demo de ventas —
 * en un restaurante real se reemplazan por fotos propias de cada plato.
 *
 * El modelo 3D (Aguacate relleno) usa un asset de muestra público
 * (Avocado.glb, Khronos glTF-Sample-Assets) para demostrar la función de
 * "ver en 3D / AR" con un plato real y verificable. Solo se activa en UN
 * plato "estrella", a propósito: como se explicó en el análisis de negocio,
 * escanear cada plato del menú en 3D cuesta tiempo real, así que el modelo
 * de producto correcto es aplicarlo solo a los platos bandera, no a todo el
 * catálogo. Cuando tengas platos reales escaneados (con KIRI Engine u otra
 * app de fotogrametría), solo reemplazas la URL de `model3d`.
 */

const IMG = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`;

export const restaurant: Restaurant = {
  slug: "fogon-barines",
  name: "Fogón Barinés",
  tagline: "Cocina de brasa y sabores de los Llanos",
  logoInitial: "F",
  tableCount: 12,
  categories: [
    { id: "entradas", name: "Entradas" },
    { id: "fuertes", name: "Platos fuertes" },
    { id: "postres", name: "Postres" },
    { id: "bebidas", name: "Bebidas" },
  ],
  dishes: [
    {
      id: "ensalada-casa",
      name: "Ensalada fresca de la casa",
      description:
        "Mezcla de vegetales de estación, queso de mano llanero, tomate confitado y vinagreta de papelón.",
      price: 5.5,
      image: IMG("photo-1512621776951-a57141f2eefd"),
      category: "entradas",
      tags: ["vegetariano"],
      portion: "1 porción · ideal para compartir",
      available: true,
    },
    {
      id: "ceviche-camarones",
      name: "Ceviche de camarones estilo Barinas",
      description:
        "Camarones frescos marinados en limón, ají dulce, cebolla morada y cilantro. Servido bien frío.",
      price: 7.0,
      image: IMG("photo-1626663011519-b42e5ee10056"),
      category: "entradas",
      tags: ["más pedido"],
      portion: "250 g · 1 persona",
      available: true,
    },
    {
      id: "aguacate-camarones",
      name: "Aguacate relleno con camarones al ajillo",
      description:
        "Aguacate criollo relleno de camarones salteados en ajo y mantequilla, toque de ají picante opcional.",
      price: 8.5,
      image: IMG("photo-1600335895229-6e75511892c8"),
      category: "entradas",
      tags: ["plato estrella", "picante opcional"],
      portion: "1 aguacate mediano · 1 persona",
      model3d: {
        glb: "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Avocado/glTF-Binary/Avocado.glb",
      },
      available: true,
    },
    {
      id: "lomo-parrilla",
      name: "Lomo a la parrilla con chimichurri",
      description:
        "Corte de lomo de res a la brasa, término a tu gusto, servido con chimichurri de la casa y yuca frita.",
      price: 14.0,
      image: IMG("photo-1600891964092-4316c288032e"),
      category: "fuertes",
      tags: ["más pedido"],
      portion: "320 g · 1 persona",
      available: true,
    },
    {
      id: "costillas-bbq",
      name: "Costillas ahumadas BBQ",
      description:
        "Costillas de cerdo ahumadas 6 horas, glaseadas en salsa BBQ casera, acompañadas de ensalada de papa.",
      price: 13.5,
      image: IMG("photo-1588168333986-5078d3ae3976"),
      category: "fuertes",
      portion: "400 g · 1 persona",
      available: false,
    },
    {
      id: "pasta-pesto",
      name: "Pasta al pesto con camarones",
      description:
        "Pasta fresca en salsa pesto de albahaca, camarones salteados y lascas de parmesano.",
      price: 11.0,
      image: IMG("photo-1627042633145-b780d842ba45"),
      category: "fuertes",
      portion: "1 porción generosa",
      available: true,
    },
    {
      id: "hamburguesa-premium",
      name: "Hamburguesa premium Fogón",
      description:
        "Carne 100% de res, queso ahumado, tocineta crocante, cebolla caramelizada y salsa especial de la casa.",
      price: 9.5,
      image: IMG("photo-1550547660-d9450f859349"),
      category: "fuertes",
      tags: ["más pedido"],
      portion: "250 g de carne · con papas incluidas",
      available: true,
    },
    {
      id: "torta-chocolate",
      name: "Torta de chocolate con ganache",
      description:
        "Bizcocho húmedo de chocolate, relleno y cubierto de ganache, con toque de sal de mar.",
      price: 4.5,
      image: IMG("photo-1602351447937-745cb720612f"),
      category: "postres",
      tags: ["vegetariano"],
      portion: "1 porción",
      available: true,
    },
    {
      id: "coctel-casa",
      name: "Coctel de la casa",
      description:
        "Ron añejo llanero, papelón, limón y un toque de romero fresco. Versión sin alcohol disponible.",
      price: 6.0,
      image: IMG("photo-1609951651556-5334e2706168"),
      category: "bebidas",
      available: true,
    },
  ],
};

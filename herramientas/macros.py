"""
Calcula los macros de cada plato sumando sus ingredientes.

No son cifras inventadas ni copiadas de ningún sitio: se parte de valores
por 100 g de referencia (USDA FoodData Central para los alimentos básicos)
y del gramaje real de cada receta, y se suma. Aun así son ESTIMACIONES:
el aceite que absorbe una fritura, el tamaño del aguacate del día o la
mano del cocinero con la salsa mueven el resultado con facilidad un 15%.

Un restaurante que quiera publicar estos datos como información
nutricional oficial tiene que pesar sus propias recetas; en varios países
publicar cifras nutricionales activa obligaciones legales de exactitud.
Por eso el texto que ve el comensal dice "aproximado".

Ejecutar:  python3 herramientas/macros.py       -> imprime el bloque TypeScript
"""

# kcal, proteína, carbohidratos, grasa, fibra  (por 100 g o 100 ml)
TABLA = {
    "aguacate":            (160, 2.0, 8.5, 14.7, 6.7),
    "camaron":             (99, 24.0, 0.2, 0.3, 0.0),
    "mantequilla":         (717, 0.9, 0.1, 81.1, 0.0),
    "aceite_oliva":        (884, 0.0, 0.0, 100.0, 0.0),
    "ajo":                 (149, 6.4, 33.1, 0.5, 2.1),
    "aji_dulce":           (27, 1.0, 6.0, 0.2, 1.0),
    "cilantro":            (23, 2.1, 3.7, 0.5, 2.8),
    "limon_jugo":          (25, 0.4, 8.4, 0.1, 0.4),
    "cebolla_morada":      (40, 1.1, 9.3, 0.1, 1.7),
    "lechuga":             (17, 1.2, 3.3, 0.3, 2.1),
    "queso_mano":          (310, 18.2, 3.7, 24.3, 0.0),
    "tomate":              (18, 0.9, 3.9, 0.2, 1.2),
    "papelon":             (380, 0.0, 98.0, 0.0, 0.0),
    "lomo_res":            (212, 29.0, 0.0, 10.0, 0.0),
    "yuca_frita":          (250, 1.6, 40.0, 9.5, 1.9),
    "perejil":             (36, 3.0, 6.3, 0.8, 3.3),
    "carne_molida":        (254, 26.0, 0.0, 16.0, 0.0),
    "pan_brioche":         (300, 9.0, 45.0, 9.0, 2.0),
    "queso_ahumado":       (356, 25.0, 2.2, 27.0, 0.0),
    "tocineta":            (541, 37.0, 1.4, 42.0, 0.0),
    "cebolla_caramelizada": (100, 1.0, 12.0, 5.0, 1.5),
    "salsa_casa":          (400, 1.0, 8.0, 40.0, 0.0),
    "papas_fritas":        (312, 3.4, 41.0, 15.0, 3.8),
    "pasta_fresca":        (160, 6.5, 30.0, 1.5, 1.6),
    "pesto":               (450, 5.0, 6.0, 45.0, 1.5),
    "parmesano":           (392, 36.0, 3.2, 26.0, 0.0),
    "costilla_cerdo":      (361, 27.0, 0.0, 28.0, 0.0),
    "salsa_bbq":           (172, 0.8, 41.0, 0.6, 0.7),
    "ensalada_papa":       (143, 2.5, 11.0, 10.0, 1.3),
    "torta_chocolate":     (395, 5.0, 45.0, 22.0, 2.5),
    "ganache":             (450, 4.0, 35.0, 33.0, 3.0),
    "ron":                 (231, 0.0, 0.0, 0.0, 0.0),
    "albahaca":            (23, 3.2, 2.7, 0.6, 1.6),
    "pinones":             (673, 13.7, 13.1, 68.4, 3.7),
}

# gramos (o ml) de cada ingrediente en la porción que se sirve
RECETAS = {
    "aguacate-camarones": [
        ("aguacate", 200), ("camaron", 80), ("mantequilla", 12),
        ("ajo", 6), ("aji_dulce", 10), ("cilantro", 3), ("limon_jugo", 8),
    ],
    "ceviche-camarones": [
        ("camaron", 250), ("limon_jugo", 45), ("aji_dulce", 20),
        ("cebolla_morada", 35), ("cilantro", 6),
    ],
    "ensalada-casa": [
        ("lechuga", 130), ("queso_mano", 55), ("tomate", 85),
        ("aceite_oliva", 12), ("papelon", 8),
    ],
    "lomo-parrilla": [
        ("lomo_res", 320), ("aceite_oliva", 8), ("perejil", 10),
        ("ajo", 5), ("yuca_frita", 120),
    ],
    "hamburguesa-premium": [
        ("carne_molida", 250), ("pan_brioche", 80), ("queso_ahumado", 30),
        ("tocineta", 25), ("cebolla_caramelizada", 25), ("salsa_casa", 25),
        ("papas_fritas", 120),
    ],
    "pasta-pesto": [
        ("pasta_fresca", 190), ("pesto", 45), ("camaron", 90),
        ("parmesano", 15), ("pinones", 8),
    ],
    "costillas-bbq": [
        ("costilla_cerdo", 260), ("salsa_bbq", 50), ("ensalada_papa", 130),
    ],
    "torta-chocolate": [
        ("torta_chocolate", 95), ("ganache", 25),
    ],
    "coctel-casa": [
        ("ron", 50), ("papelon", 22), ("limon_jugo", 25),
    ],
}

ORDEN = ["aguacate-camarones", "ceviche-camarones", "ensalada-casa",
         "lomo-parrilla", "hamburguesa-premium", "pasta-pesto",
         "costillas-bbq", "torta-chocolate", "coctel-casa"]


def calcular(receta):
    t = [0.0] * 5
    for ing, g in receta:
        if ing not in TABLA:
            raise KeyError(f"ingrediente sin datos: {ing}")
        for i, v in enumerate(TABLA[ing]):
            t[i] += v * g / 100.0
    return t


def redondear(kcal, prot, carb, gras, fib):
    # kcal a la decena: dar "487 kcal" sugiere una precisión que no existe
    return (int(round(kcal / 10.0) * 10), round(prot), round(carb),
            round(gras), round(fib))


if __name__ == "__main__":
    print("// generado por scratchpad/macros.py — no editar a mano\n")
    for nombre in ORDEN:
        receta = RECETAS[nombre]
        kcal, prot, carb, gras, fib = redondear(*calcular(receta))
        peso = sum(g for _, g in receta)
        print(f'  // {nombre}: {peso} g servidos')
        print(f'  macros: {{ kcal: {kcal}, proteina: {prot}, '
              f'carbohidratos: {carb}, grasa: {gras}, fibra: {fib} }},')
    print()
    print(f"{'plato':22s} {'g':>5s} {'kcal':>6s} {'prot':>5s} "
          f"{'carb':>5s} {'gras':>5s} {'fib':>4s}   %P/%C/%G")
    for nombre in ORDEN:
        receta = RECETAS[nombre]
        vals = calcular(receta)
        kcal, prot, carb, gras, fib = redondear(*vals)
        peso = sum(g for _, g in receta)
        # Comprobación cruzada: 4/4/9 kcal por gramo debe acercarse al total.
        aprox = prot * 4 + carb * 4 + gras * 9
        desvio = abs(aprox - kcal) / max(kcal, 1) * 100
        # El alcohol aporta 7 kcal/g y no entra en la regla 4/4/9, así que
        # en el coctel la diferencia es correcta y no un error de cuentas.
        lleva_alcohol = any(i == "ron" for i, _ in receta)
        marca = "  <-- revisar" if desvio > 12 and not lleva_alcohol else ""
        if lleva_alcohol:
            marca = "  (alcohol: 7 kcal/g, fuera de la regla 4/4/9)"
        tot = max(1, prot * 4 + carb * 4 + gras * 9)
        print(f"{nombre:22s} {peso:5d} {kcal:6d} {prot:5d} {carb:5d} "
              f"{gras:5d} {fib:4d}   "
              f"{prot*4/tot*100:2.0f}/{carb*4/tot*100:2.0f}/"
              f"{gras*9/tot*100:2.0f}{marca}")

"""
Comprueba que los macros escritos en lib/data.ts coinciden con el cálculo
de macros.py.

Existe porque los números se copian a mano al TypeScript, y un macro mal
tecleado no rompe nada: se muestra tranquilamente en la ficha del plato y
en las respuestas del asistente como si fuera correcto. Este script es lo
que lo detecta.

Ejecutar:  python3 herramientas/check_macros.py
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from macros import RECETAS, calcular, redondear

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    os.pardir, "lib", "data.ts")

src = open(DATA, encoding="utf-8").read()
# Las categorías también tienen campo `id`, así que se busca solo a partir
# de la lista de platos.
src = src[src.index("dishes: ["):]

esperado = {n: redondear(*calcular(r)) for n, r in RECETAS.items()}
fallos = []

for pid in esperado:
    bloque = re.search(
        rf'id:\s*"{re.escape(pid)}"(.*?)(?=\n      id:\s*"|\Z)', src, re.S)
    if not bloque:
        fallos.append(f"{pid}: no aparece en data.ts")
        continue
    b = bloque.group(1)

    m = re.search(r"macros:\s*\{([^}]*)\}", b)
    if not m:
        fallos.append(f"{pid}: sin macros")
    else:
        v = dict(re.findall(r"(\w+):\s*(-?\d+)", m.group(1)))
        got = tuple(int(v[k]) for k in
                    ("kcal", "proteina", "carbohidratos", "grasa", "fibra"))
        if got != esperado[pid]:
            fallos.append(f"{pid}: data.ts {got} != calculado {esperado[pid]}")

    g = re.search(r"gramos:\s*(\d+)", b)
    peso = sum(x for _, x in RECETAS[pid])
    if not g:
        fallos.append(f"{pid}: sin gramos")
    elif int(g.group(1)) != peso:
        fallos.append(f"{pid}: gramos {g.group(1)} != {peso} de la receta")

if fallos:
    print("PROBLEMAS:")
    for f in fallos:
        print("  -", f)
    sys.exit(1)

print(f"Los macros y gramos de los {len(esperado)} platos coinciden con "
      f"el cálculo de macros.py.")

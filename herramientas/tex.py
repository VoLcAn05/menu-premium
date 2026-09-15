"""
Texturas procedurales para los platos. Cada función devuelve HxWx3 en [0,1].

La idea es sencilla: una superficie de comida real nunca es de un solo color.
Tiene mancha, veta, poro y quemado. Eso es exactamente lo que separa un
render que parece plástico de uno que parece comida, mucho más que subir el
número de polígonos.
"""

import numpy as np

from glb2 import fbm

N = 256


def _mezcla(a, b, t):
    a = np.asarray(a, np.float32)
    b = np.asarray(b, np.float32)
    t = np.clip(t, 0, 1)[..., None]
    return a[None, None, :] * (1 - t) + b[None, None, :] * t


def carne_parrilla(n=N):
    """Lomo sellado: costra tostada, veta y marcas de parrilla cruzadas."""
    grano = fbm((n, n), 26, 6, semilla=101)
    veta = fbm((n, n), 90, 3, semilla=102)
    base = _mezcla((0.36, 0.17, 0.10), (0.62, 0.34, 0.20), grano * 0.75 + 0.15)
    base = base * (0.9 + 0.2 * veta[..., None])

    # Marcas de parrilla: dos familias de bandas oscuras a 90 grados.
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    b1 = np.cos(x / n * np.pi * 2 * 5)
    b2 = np.cos(y / n * np.pi * 2 * 5)
    marca = np.clip((b1 - 0.86) * 9, 0, 1) + np.clip((b2 - 0.86) * 9, 0, 1)
    marca = np.clip(marca, 0, 1) * (0.55 + 0.45 * grano)
    base = base * (1 - 0.72 * marca[..., None])

    # Puntos de sal gruesa.
    sal = (fbm((n, n), 4, 2, semilla=103) > 0.955).astype(np.float32)
    return np.clip(base + sal[..., None] * 0.5, 0, 1)


def pan_brioche(n=N):
    """Pan tostado: dorado con poro, ajonjolí y un bronceado hacia el borde."""
    poro = fbm((n, n), 12, 5, semilla=201)
    manch = fbm((n, n), 55, 3, semilla=202)
    base = _mezcla((0.70, 0.44, 0.18), (0.90, 0.69, 0.38), manch)
    base = base * (0.84 + 0.30 * poro[..., None])

    semilla = (fbm((n, n), 3.2, 1, semilla=203) > 0.977).astype(np.float32)
    semilla = np.clip(semilla + np.roll(semilla, 1, 0) * 0.6, 0, 1)
    return np.clip(base * (1 - 0.3 * semilla[..., None])
                   + semilla[..., None] * np.array([0.94, 0.86, 0.66], np.float32) * 0.9, 0, 1)


def aguacate(n=N):
    """Pulpa de aguacate: verde amarillo al centro, fibra radial suave."""
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    r = np.sqrt((x / n - 0.5) ** 2 + (y / n - 0.5) ** 2) * 2
    fibra = fbm((n, n), 9, 4, semilla=301)
    base = _mezcla((0.85, 0.86, 0.42), (0.30, 0.47, 0.17), np.clip(r * 0.95, 0, 1))
    return np.clip(base * (0.9 + 0.22 * fibra[..., None]), 0, 1)


def camaron(n=N):
    """Camarón salteado: naranja rosado con segmentos y punta más oscura."""
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    seg = np.clip(np.cos(x / n * np.pi * 2 * 7) * 0.5 + 0.5, 0, 1) ** 2
    manch = fbm((n, n), 20, 4, semilla=401)
    base = _mezcla((0.94, 0.52, 0.34), (0.76, 0.25, 0.18), seg * 0.55 + manch * 0.3)
    blanco = np.clip((fbm((n, n), 30, 3, semilla=402) - 0.62) * 3, 0, 1)
    return np.clip(base + blanco[..., None] * 0.22, 0, 1)


def ceramica(n=N, tono=(0.94, 0.93, 0.90)):
    """Loza: casi lisa, con grano finísimo. Sin esto el plato parece plástico."""
    grano = fbm((n, n), 3, 2, semilla=501)
    base = np.asarray(tono, np.float32)[None, None, :] * (0.975 + 0.05 * grano[..., None])
    aro = fbm((n, n), 120, 2, semilla=502)
    return np.clip(base * (0.985 + 0.03 * aro[..., None]), 0, 1)


def ganache(n=N):
    """Ganache: chocolate oscuro con ondas de colada y brillo irregular."""
    onda = fbm((n, n), 34, 4, semilla=601)
    fino = fbm((n, n), 7, 3, semilla=602)
    base = _mezcla((0.13, 0.07, 0.05), (0.29, 0.16, 0.10), onda)
    return np.clip(base * (0.88 + 0.26 * fino[..., None]), 0, 1)


def bizcocho(n=N):
    """Miga de bizcocho de chocolate: poro abierto y tono parejo."""
    poro = fbm((n, n), 5.5, 5, semilla=701)
    hueco = (poro > 0.72).astype(np.float32)
    base = _mezcla((0.27, 0.16, 0.11), (0.40, 0.25, 0.17), poro)
    return np.clip(base * (1 - 0.35 * hueco[..., None]), 0, 1)


def pasta(n=N):
    """Pasta fresca: amarillo pálido con la veta del laminado."""
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    veta = np.clip(np.cos(y / n * np.pi * 2 * 26) * 0.5 + 0.5, 0, 1)
    manch = fbm((n, n), 22, 3, semilla=801)
    base = _mezcla((0.86, 0.75, 0.45), (0.95, 0.89, 0.66), manch * 0.7 + veta * 0.3)
    return np.clip(base, 0, 1)


def pesto(n=N):
    """Pesto: verde con trozos de albahaca y piñón, nada homogéneo."""
    g = fbm((n, n), 14, 5, semilla=901)
    trozo = (fbm((n, n), 5, 3, semilla=902) > 0.7).astype(np.float32)
    base = _mezcla((0.22, 0.33, 0.12), (0.45, 0.56, 0.22), g)
    pinon = (fbm((n, n), 3.5, 2, semilla=903) > 0.972).astype(np.float32)
    base = base * (1 - 0.25 * trozo[..., None])
    return np.clip(base + pinon[..., None] * np.array([0.85, 0.76, 0.55], np.float32) * 0.8, 0, 1)


def hoja_verde(n=N):
    """Lechuga: verde con nervadura y bordes más claros."""
    nervio = fbm((n, n), 8, 4, semilla=1001)
    claro = fbm((n, n), 40, 3, semilla=1002)
    base = _mezcla((0.24, 0.42, 0.15), (0.58, 0.74, 0.34), claro * 0.6 + nervio * 0.4)
    lineas = np.clip((np.abs(np.cos(np.mgrid[0:n, 0:n][1] / n * np.pi * 9)) - 0.9) * 10, 0, 1)
    return np.clip(base * (1 - 0.18 * lineas[..., None]), 0, 1)


def bbq(n=N):
    """Glaseado BBQ: rojo oscuro pegajoso con reflejo desigual."""
    g = fbm((n, n), 24, 5, semilla=1101)
    base = _mezcla((0.22, 0.07, 0.04), (0.50, 0.17, 0.07), g)
    brillo = np.clip((fbm((n, n), 11, 3, semilla=1102) - 0.6) * 3, 0, 1)
    return np.clip(base + brillo[..., None] * 0.18, 0, 1)


def costra_cerdo(n=N):
    """Costilla ahumada: corteza oscura con fibra longitudinal."""
    fibra = fbm((n, n), 6, 5, semilla=1201)
    y = np.mgrid[0:n, 0:n][0].astype(np.float32)
    hebra = np.clip(np.cos(y / n * np.pi * 2 * 18) * 0.5 + 0.5, 0, 1)
    base = _mezcla((0.25, 0.10, 0.06), (0.52, 0.24, 0.12), fibra * 0.7 + hebra * 0.3)
    return np.clip(base, 0, 1)


def tomate(n=N):
    grano = fbm((n, n), 10, 4, semilla=1301)
    return np.clip(_mezcla((0.58, 0.09, 0.06), (0.86, 0.26, 0.14), grano), 0, 1)


def queso_blanco(n=N):
    grano = fbm((n, n), 7, 4, semilla=1401)
    return np.clip(_mezcla((0.90, 0.88, 0.80), (0.99, 0.98, 0.94), grano), 0, 1)


def ensalada_papa(n=N):
    """Papa en mayonesa: crema amarilla pálida con punteado de perejil."""
    g = fbm((n, n), 13, 4, semilla=1801)
    base = _mezcla((0.80, 0.72, 0.48), (0.96, 0.92, 0.75), g)
    verde = (fbm((n, n), 3.5, 2, semilla=1802) > 0.965).astype(np.float32)
    pim = (fbm((n, n), 2.8, 1, semilla=1803) > 0.985).astype(np.float32)
    base = base * (1 - 0.55 * verde[..., None]) \
        + verde[..., None] * np.array([0.30, 0.46, 0.18], np.float32) * 0.55
    return np.clip(base * (1 - 0.6 * pim[..., None]), 0, 1)


def papa_frita(n=N):
    g = fbm((n, n), 9, 4, semilla=1501)
    base = _mezcla((0.72, 0.51, 0.20), (0.94, 0.78, 0.42), g)
    quem = (fbm((n, n), 4, 2, semilla=1502) > 0.88).astype(np.float32)
    return np.clip(base * (1 - 0.4 * quem[..., None]), 0, 1)


def liquido_ambar(n=N):
    g = fbm((n, n), 30, 4, semilla=1601)
    return np.clip(_mezcla((0.55, 0.24, 0.08), (0.83, 0.47, 0.17), g), 0, 1)


def cebolla_morada(n=N):
    anillo = np.clip(np.cos(np.mgrid[0:n, 0:n][0] / n * np.pi * 2 * 12) * .5 + .5, 0, 1)
    g = fbm((n, n), 16, 3, semilla=1701)
    return np.clip(_mezcla((0.44, 0.22, 0.42), (0.80, 0.64, 0.80), anillo * .6 + g * .4), 0, 1)

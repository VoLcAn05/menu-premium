"""
Los 9 platos de Fogón Barinés, modelados con textura y superficie irregular.

Medidas en metros, sobre vajilla real:
  entrada 21 cm · fuerte 27 cm · postre 18 cm · copa 9 cm de boca

Frente a la primera versión, cada pieza de comida lleva ahora textura
procedural, desplazamiento por ruido y rugosidad por material. Una salsa
glaseada no puede tener la misma rugosidad que un pan, y una hoja de
lechuga perfectamente lisa se lee como plástico a cualquier distancia.
"""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tex
from glb2 import (Mesh, Texturas, box, caja_redondeada, cylinder, ellipsoid,
                  export_glb, lathe, material, torus)

AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, os.pardir, "public", "models")
os.makedirs(OUT, exist_ok=True)

TAM = 192  # lado de las texturas; 256 se ve algo mejor pero pesa el doble


# --------------------------------------------------------------- utilidades

def M(v, f, uv, mat):
    return Mesh(v, f, mat, uv=uv)


def disco(r, grosor, seg=40, mat=None):
    """Rodaja: tomate, limón, cebolla."""
    return lathe([(0, 0), (r * 0.97, 0.0), (r, grosor * 0.5),
                  (r * 0.97, grosor), (0, grosor)], seg)


def baston(largo, lado, r=0.0018, n=7):
    """Bastón de sección cuadrada con canto vivo suavizado.

    Una papa frita o un palo de yuca tienen esquinas. Con una cápsula
    cilíndrica quedan pastillas, que es de lo que más chirría en un
    modelo de comida.
    """
    v, f, uv = caja_redondeada(lado, lado, largo, r=r, n=n)
    return v, f, uv


def capsula(largo, radio, seg=24):
    """Cilindro de extremos redondeados, eje Z. Huesos y cordones."""
    h = max(1e-4, largo - 2 * radio)
    perfil = [(radio * np.cos(t), radio + radio * np.sin(t))
              for t in np.linspace(-np.pi / 2, 0, 7)]
    perfil.append((radio, radio + h))
    perfil += [(radio * np.cos(t), radio + h + radio * np.sin(t))
               for t in np.linspace(0, np.pi / 2, 7)[1:]]
    return lathe(perfil, seg)


def hoja_curva(largo, ancho, curva=0.5, seg=14, mat=None, semilla=0):
    """Hoja de lechuga: lámina alabeada y ondulada, no un disco plano.

    Es la pieza que más delata un modelo hecho a la ligera: la lechuga real
    no tiene una sola superficie plana en toda la hoja.
    """
    u = np.linspace(-1, 1, seg)
    w = np.linspace(-1, 1, seg)
    U, W = np.meshgrid(u, w, indexing="ij")
    rng = np.random.default_rng(semilla + 31)
    fase = rng.uniform(0, 6.283, 4)

    ancho_local = ancho * np.sqrt(np.maximum(0.02, 1 - U ** 2))
    x = U * largo / 2
    z = W * ancho_local / 2
    y = (curva * (U ** 2) * largo * 0.22
         + 0.10 * ancho * np.sin(W * 3.1 + fase[0])
         + 0.06 * ancho * np.sin(U * 4.3 + fase[1]))
    v = np.stack([x, y, z], -1).reshape(-1, 3).astype(np.float32)

    faces = []
    for i in range(seg - 1):
        for j in range(seg - 1):
            a, b = i * seg + j, (i + 1) * seg + j
            faces.append([a, b, b + 1])
            faces.append([a, b + 1, a + 1])
    uv = np.stack([(U + 1) / 2, (W + 1) / 2], -1).reshape(-1, 2).astype(np.float32)
    return v, np.asarray(faces, np.uint32), uv


def cuna(radio, grados, altura, y0=0.0, seg=30):
    """Sector circular extruido: la porción de torta."""
    ang = np.linspace(0, np.deg2rad(grados), seg, dtype=np.float32)
    arco = np.stack([radio * np.cos(ang), np.zeros_like(ang),
                     radio * np.sin(ang)], -1)
    base = np.vstack([[[0, 0, 0]], arco]).astype(np.float32)
    n = len(base)
    v = np.vstack([base + [0, y0, 0], base + [0, y0 + altura, 0]])
    faces = []
    for i in range(1, n - 1):
        faces.append([0, i, i + 1])
        faces.append([n, n + i + 1, n + i])
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, n + j, j])
        faces.append([i, n + i, n + j])
    uv = np.zeros((len(v), 2), np.float32)
    uv[:, 0] = np.clip(np.abs(v[:, 0]) / max(radio, 1e-6), 0, 1)
    uv[:, 1] = np.clip((v[:, 1] - y0) / max(altura, 1e-6), 0, 1)
    return v, np.asarray(faces, np.uint32), uv


def hebra(radio_nido, alto, vueltas=2.2, grosor=0.0038, seg=110, tube=8):
    """Hebra de pasta: hélice con sección circular y UV a lo largo."""
    t = np.linspace(0, vueltas * 2 * np.pi, seg, dtype=np.float32)
    r = radio_nido * (1.0 - 0.13 * t / t[-1])
    centro = np.stack([r * np.cos(t),
                       alto + 0.004 * np.sin(t * 1.7),
                       r * np.sin(t)], -1)
    tang = np.gradient(centro, axis=0)
    tang /= np.maximum(np.linalg.norm(tang, axis=1, keepdims=True), 1e-9)
    nrm = np.cross(tang, np.array([0, 1, 0], np.float32))
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    bin_ = np.cross(tang, nrm)

    ang = np.linspace(0, 2 * np.pi, tube, endpoint=False, dtype=np.float32)
    v = (centro[:, None, :]
         + grosor * (np.cos(ang)[None, :, None] * nrm[:, None, :]
                     + np.sin(ang)[None, :, None] * bin_[:, None, :])
         ).reshape(-1, 3).astype(np.float32)
    faces = []
    for i in range(seg - 1):
        for j in range(tube):
            k = (j + 1) % tube
            a, b = i * tube, (i + 1) * tube
            faces.append([a + j, b + j, b + k])
            faces.append([a + j, b + k, a + k])
    uv = np.stack(np.meshgrid(np.linspace(0, 4, seg),
                              np.linspace(0, 1, tube, endpoint=False),
                              indexing="ij"), -1).reshape(-1, 2).astype(np.float32)
    return v, np.asarray(faces, np.uint32), uv


def esparcir(constructor, n, radio, y, escala=(0.85, 1.15), semilla=0,
             inclina=0.25, centro=(0.0, 0.0)):
    out = []
    r = np.random.default_rng(11 + semilla)
    for i in range(n):
        a = r.uniform(0, 2 * np.pi)
        d = radio * np.sqrt(r.uniform(0, 1))
        out.append(constructor(i).transform(
            scale=r.uniform(*escala),
            rot_y=r.uniform(0, 2 * np.pi),
            rot_x=r.uniform(-inclina, inclina),
            translate=(centro[0] + d * np.cos(a), y + r.uniform(0, 0.005),
                       centro[1] + d * np.sin(a))))
    return out


# ------------------------------------------------------------------ vajilla

def perfil_plato(diam, alto=0.022, hondo=False):
    r = diam / 2
    if hondo:
        return [(0, 0), (r * .34, 0), (r * .36, .004), (r * .30, .006),
                (r * .30, .010), (r * .62, alto * .55), (r * .88, alto * .95),
                (r, alto), (r * .985, alto * 1.04), (r * .86, alto),
                (r * .58, alto * .60), (r * .26, .016), (0, .015)]
    return [(0, 0), (r * .40, 0), (r * .42, .004), (r * .36, .006),
            (r * .36, .009), (r * .74, alto * .42), (r * .94, alto * .88),
            (r, alto), (r * .98, alto * 1.05), (r * .80, alto * .62),
            (r * .40, .012), (0, .011)]


# ------------------------------------------------------------------- platos

def ensalada(T):
    loza = material("loza", [1, 1, 1], rough=0.18, tex=T.add(tex.ceramica(TAM)))
    verde = material("lechuga", [1, 1, 1], rough=0.46,
                     tex=T.add(tex.hoja_verde(TAM)))
    rojo = material("tomate", [1, 1, 1], rough=0.26,
                    tex=T.add(tex.tomate(TAM)), clearcoat=0.5)
    queso = material("queso_mano", [1, 1, 1], rough=0.62,
                     tex=T.add(tex.queso_blanco(TAM)))
    vin = material("vinagreta", [0.42, 0.24, 0.07], rough=0.14, alpha=0.9,
                   clearcoat=0.8)

    m = [M(*lathe(perfil_plato(0.21, hondo=True), 96), loza)]

    # Núcleo macizo debajo y hojas pegadas a su superficie. Solo con hojas
    # sueltas se ve el plato por los huecos y la ensalada queda desparramada;
    # así tiene volumen y nada flota.
    nucleo = material("nucleo", [0.16, 0.26, 0.10], rough=0.65)
    m.append(Mesh(*ellipsoid(0.034, 0.019, 0.034, 30, 18,
                             squash_top=0.85)[:2], nucleo)
             .transform(translate=(0, 0.017, 0)))

    r = np.random.default_rng(77)
    for anillo, (n, rad, alt, cae) in enumerate(
            [(14, 0.038, 0.019, 1.05), (10, 0.028, 0.030, 0.72),
             (6, 0.013, 0.039, 0.30)]):
        for k in range(n):
            a = k * 2 * np.pi / n + r.uniform(-0.22, 0.22)
            m.append(M(*hoja_curva(0.052, 0.038, 0.85, 12,
                                   semilla=anillo * 13 + k), verde)
                     .rugoso(0.0016, 110, 5 + anillo * 20 + k)
                     .transform(scale=r.uniform(0.85, 1.12),
                                rot_z=cae * r.uniform(0.75, 1.2),
                                rot_y=a,
                                translate=(rad * np.cos(a),
                                           alt + r.uniform(-0.002, 0.003),
                                           rad * np.sin(a))))

    m += esparcir(lambda i: M(*disco(0.011, 0.005, 26), rojo)
                  .rugoso(0.0004, 200, 40 + i),
                  7, 0.032, 0.041, semilla=3, inclina=1.1)
    m += esparcir(lambda i: M(*caja_redondeada(0.015, 0.013, 0.015, 0.003), queso)
                  .rugoso(0.0006, 180, 60 + i),
                  6, 0.026, 0.045, semilla=5, inclina=0.5)
    m += esparcir(lambda i: Mesh(*ellipsoid(0.005, 0.0016, 0.005, 12, 8)[:2], vin),
                  9, 0.040, 0.030, semilla=8, inclina=0.1)
    return m, "ensalada-casa"


def ceviche(T):
    vidrio = material("vidrio", [0.88, 0.93, 0.94], rough=0.04, alpha=0.30)
    jugo = material("marinada", [0.93, 0.92, 0.62], rough=0.06, alpha=0.78,
                    clearcoat=1.0)
    gamba = material("camaron", [1, 1, 1], rough=0.28,
                     tex=T.add(tex.camaron(TAM)), clearcoat=0.7)
    ceb = material("cebolla", [1, 1, 1], rough=0.40,
                   tex=T.add(tex.cebolla_morada(TAM)))
    verde = material("cilantro", [0.30, 0.50, 0.18], rough=0.50)

    r = 0.075
    perfil = [(0, 0), (r * .30, 0), (r * .32, .004), (r * .28, .006),
              (r * .42, .017), (r * .72, .034), (r * .92, .048), (r, .055),
              (r * .97, .055), (r * .88, .047), (r * .66, .032),
              (r * .36, .014), (0, .009)]
    m = [M(*lathe(perfil, 96), vidrio)]
    m.append(M(*lathe([(0, 0), (0.052, 0), (0.058, 0.012),
                       (0.059, 0.014), (0, 0.014)], 64), jugo)
             .transform(translate=(0, 0.014, 0)))

    # Un camarón de ceviche mide unos 3 cm enroscado, no 5. Con el tamaño
    # de antes parecían trozos de pescado y el plato entero se leía mal.
    def camaron(i):
        v, f, uv = torus(0.0115, 0.0040, 26, 12)
        ang = np.arctan2(v[:, 2], v[:, 0])
        keep = ang > -0.9
        mapa = -np.ones(len(v), np.int64)
        mapa[keep] = np.arange(keep.sum())
        nf = mapa[np.asarray([t for t in f if keep[t].all()], np.int64)]
        return M(v[keep], nf.astype(np.uint32), uv[keep], gamba) \
            .rugoso(0.0004, 170, 70 + i)

    m += esparcir(camaron, 16, 0.042, 0.019, semilla=1, inclina=0.7)
    m += esparcir(camaron, 8, 0.030, 0.027, semilla=21, inclina=0.9)
    m += esparcir(lambda i: M(*torus(0.0095, 0.0014, 24, 8), ceb),
                  9, 0.042, 0.029, semilla=4, inclina=0.9)
    m += esparcir(lambda i: M(*hoja_curva(0.014, 0.010, 0.6, 8, semilla=i), verde),
                  8, 0.040, 0.034, semilla=8, inclina=0.8)
    return m, "ceviche-camarones"


def aguacate(T):
    loza = material("loza", [1, 1, 1], rough=0.18, tex=T.add(tex.ceramica(TAM)))
    pulpa = material("pulpa", [1, 1, 1], rough=0.38,
                     tex=T.add(tex.aguacate(TAM)))
    piel = material("piel", [0.13, 0.19, 0.10], rough=0.70)
    gamba = material("camaron", [1, 1, 1], rough=0.26,
                     tex=T.add(tex.camaron(TAM)), clearcoat=0.85)
    ajillo = material("ajillo", [0.83, 0.62, 0.20], rough=0.12, alpha=0.92,
                      clearcoat=1.0)

    m = [M(*lathe(perfil_plato(0.21), 96), loza)]
    sup = 0.011
    piel_p = [(.000, .000), (.014, .0012), (.026, .0055), (.035, .0135),
              (.0405, .024), (.0415, .031), (.0395, .0355), (.0345, .0345),
              (.027, .0285), (.019, .0235), (.012, .021), (.000, .0205)]
    carne_p = [(.000, .0022), (.013, .0032), (.024, .0072), (.032, .0148),
               (.0375, .0245), (.0385, .0305), (.0365, .0338), (.032, .0330),
               (.025, .0278), (.018, .0232), (.011, .0210), (.000, .0205)]

    for s in (-1, 1):
        cx, giro = s * 0.038, s * 0.35
        m.append(M(*lathe(piel_p, 64), piel)
                 .rugoso(0.0007, 90, 12 + s)
                 .transform(scale=(1, 1, 1.28), rot_y=giro, translate=(cx, sup, 0)))
        m.append(M(*lathe(carne_p, 64), pulpa)
                 .rugoso(0.0005, 130, 18 + s)
                 .transform(scale=(1, 1, 1.28), rot_y=giro, translate=(cx, sup, 0)))
        for k in range(4):
            a = k * 1.7 + s
            v, f, uv = torus(0.0135, 0.0050, 26, 12)
            ang = np.arctan2(v[:, 2], v[:, 0])
            keep = ang > -1.0
            mapa = -np.ones(len(v), np.int64)
            mapa[keep] = np.arange(keep.sum())
            nf = mapa[np.asarray([t for t in f if keep[t].all()], np.int64)]
            m.append(M(v[keep], nf.astype(np.uint32), uv[keep], gamba)
                     .transform(rot_y=a, rot_x=0.2,
                                translate=(cx + 0.008 * np.cos(a), sup + 0.027,
                                           0.011 * np.sin(a))))
        m.append(Mesh(*ellipsoid(0.022, 0.0035, 0.018, 24, 10,
                                 squash_top=0.4)[:2], ajillo)
                 .transform(translate=(cx, sup + 0.022, 0)))
    return m, "aguacate-camarones"


def lomo(T):
    loza = material("loza", [1, 1, 1], rough=0.18, tex=T.add(tex.ceramica(TAM)))
    carne = material("lomo", [1, 1, 1], rough=0.44,
                     tex=T.add(tex.carne_parrilla(TAM)), clearcoat=0.35)
    chimi = material("chimichurri", [0.30, 0.44, 0.12], rough=0.22, clearcoat=0.7)
    yuca = material("yuca", [1, 1, 1], rough=0.55, tex=T.add(tex.papa_frita(TAM)))
    jugo = material("jugo", [0.35, 0.16, 0.08], rough=0.10, alpha=0.75,
                    clearcoat=1.0)

    m = [M(*lathe(perfil_plato(0.27), 96), loza)]
    sup, cx, cz, giro = 0.013, -0.028, 0.006, 0.24

    # Un lomo de 320 g es un bloque de unos 12 x 9 x 3,5 cm con los cantos
    # vencidos, no un elipsoide: con el elipsoide se leía como un panecillo.
    v, f, uv = caja_redondeada(0.118, 0.036, 0.088, r=0.013, n=11)
    m.append(M(v, f, uv, carne).rugoso(0.0026, 48, 4)
             .transform(rot_y=giro, translate=(cx, sup + 0.019, cz)))

    # Cordón de chimichurri alrededor, no una mancha uniforme.
    for k in range(9):
        a = k * 0.70
        m.append(Mesh(*ellipsoid(0.009, 0.0030, 0.007, 14, 8)[:2], chimi)
                 .transform(rot_y=a,
                            translate=(cx + 0.030 * np.cos(a), sup + 0.036,
                                       cz + 0.024 * np.sin(a))))
    # Jugo de la carne sobre la loza.
    m.append(Mesh(*ellipsoid(0.048, 0.0016, 0.038, 30, 10,
                             squash_top=0.3)[:2], jugo)
             .transform(rot_y=giro, translate=(cx, sup + 0.001, cz)))

    m += esparcir(lambda i: M(*baston(0.062, 0.0135, 0.0022), yuca)
                  .rugoso(0.0007, 90, 30 + i),
                  7, 0.024, sup + 0.011, semilla=2, centro=(0.074, -0.014))
    return m, "lomo-parrilla"


def costillas(T):
    loza = material("loza", [1, 1, 1], rough=0.18, tex=T.add(tex.ceramica(TAM)))
    corteza = material("corteza", [1, 1, 1], rough=0.40,
                       tex=T.add(tex.costra_cerdo(TAM)))
    glaseado = material("glaseado", [1, 1, 1], rough=0.11,
                        tex=T.add(tex.bbq(TAM)), clearcoat=1.0)
    hueso = material("hueso", [0.93, 0.90, 0.81], rough=0.50)
    papa = material("ensalada_papa", [1, 1, 1], rough=0.42,
                    tex=T.add(tex.ensalada_papa(TAM)), clearcoat=0.35)

    m = [M(*lathe(perfil_plato(0.27), 96), loza)]
    sup = 0.013
    # Costilla: losa ancha y baja con el hueso saliendo por el costado.
    # Con elipsoides gruesos parecían salchichas.
    for i in range(4):
        z = (i - 1.5) * 0.030
        alt = sup + 0.010 + (0.002 if i % 2 else 0)
        giro = 0.06 * (i - 1.5)
        v, f, uv = caja_redondeada(0.108, 0.019, 0.027, r=0.007, n=10)
        m.append(M(v, f, uv, corteza).rugoso(0.0018, 62, 80 + i)
                 .transform(rot_y=giro, translate=(-0.016, alt + 0.009, z)))
        v2, f2, uv2 = caja_redondeada(0.104, 0.009, 0.025, r=0.004, n=9)
        m.append(M(v2, f2, uv2, glaseado).rugoso(0.0013, 55, 90 + i)
                 .transform(rot_y=giro, translate=(-0.016, alt + 0.017, z)))
        m.append(M(*capsula(0.024, 0.0046, 14), hueso)
                 .transform(rot_y=np.pi / 2,
                            translate=(0.055, alt + 0.008, z)))
    # Ensalada de papa: montículo de dados, no huevos sueltos.
    m += esparcir(lambda i: M(*caja_redondeada(0.013, 0.011, 0.013, 0.003), papa)
                  .rugoso(0.0008, 130, 100 + i),
                  7, 0.028, sup + 0.007, semilla=6, centro=(0.079, 0.0))
    m += esparcir(lambda i: M(*caja_redondeada(0.012, 0.010, 0.012, 0.003), papa)
                  .rugoso(0.0008, 130, 120 + i),
                  5, 0.019, sup + 0.017, semilla=16, centro=(0.079, 0.0))
    return m, "costillas-bbq"


def pasta(T):
    loza = material("loza", [1, 1, 1], rough=0.18, tex=T.add(tex.ceramica(TAM)))
    fideo = material("pasta", [1, 1, 1], rough=0.36,
                     tex=T.add(tex.pasta(TAM)), clearcoat=0.5)
    salsa = material("pesto", [1, 1, 1], rough=0.30,
                     tex=T.add(tex.pesto(TAM)), clearcoat=0.6)
    gamba = material("camaron", [1, 1, 1], rough=0.26,
                     tex=T.add(tex.camaron(TAM)), clearcoat=0.8)
    parm = material("parmesano", [0.96, 0.93, 0.78], rough=0.58)

    m = [M(*lathe(perfil_plato(0.27, hondo=True), 96), loza)]
    base = 0.020
    # Nido: hebras a distintos radios y alturas, con el pesto repartido
    # entre ellas. Con una sola tapa de salsa encima parecía una crepe.
    # Cada hebra sale de un centro y una inclinación ligeramente distintos;
    # si todas comparten eje el nido se lee como anillos concéntricos.
    rr = np.random.default_rng(404)
    for k in range(11):
        dx, dz = rr.uniform(-0.006, 0.006, 2)
        m.append(M(*hebra(0.052 - k * 0.0029, base + k * 0.0030,
                          vueltas=1.9 + 0.22 * k + rr.uniform(-0.3, 0.3),
                          grosor=0.0034, seg=100), fideo)
                 .transform(rot_y=rr.uniform(0, 6.28),
                            rot_x=rr.uniform(-0.09, 0.09),
                            translate=(dx, 0, dz)))
    for k in (3, 6, 9):
        dx, dz = rr.uniform(-0.005, 0.005, 2)
        m.append(M(*hebra(0.049 - k * 0.0029, base + k * 0.0030 + 0.0016,
                          vueltas=1.6 + 0.2 * k, grosor=0.0032, seg=90), salsa)
                 .transform(rot_y=rr.uniform(0, 6.28), translate=(dx, 0, dz)))
    m += esparcir(lambda i: M(*ellipsoid(0.012, 0.0028, 0.010, 16, 9,
                                         squash_top=0.5), salsa),
                  9, 0.042, base + 0.031, semilla=55, inclina=0.3)

    def camaron(i):
        v, f, uv = torus(0.018, 0.0064, 28, 13)
        ang = np.arctan2(v[:, 2], v[:, 0])
        keep = ang > -1.0
        mapa = -np.ones(len(v), np.int64)
        mapa[keep] = np.arange(keep.sum())
        nf = mapa[np.asarray([t for t in f if keep[t].all()], np.int64)]
        return M(v[keep], nf.astype(np.uint32), uv[keep], gamba)

    m += esparcir(camaron, 6, 0.036, base + 0.034, semilla=9, inclina=0.5)
    m += esparcir(lambda i: Mesh(*box(0.016, 0.0010, 0.010)[:2], parm),
                  8, 0.042, base + 0.039, semilla=12, inclina=0.45)
    return m, "pasta-pesto"


def hamburguesa(T):
    loza = material("loza", [1, 1, 1], rough=0.18, tex=T.add(tex.ceramica(TAM)))
    pan = material("brioche", [1, 1, 1], rough=0.72,
                   tex=T.add(tex.pan_brioche(TAM)))
    carne = material("carne", [1, 1, 1], rough=0.42,
                     tex=T.add(tex.carne_parrilla(TAM)), clearcoat=0.3)
    queso = material("queso", [0.93, 0.70, 0.20], rough=0.30, clearcoat=0.6)
    tocineta = material("tocineta", [0.60, 0.22, 0.14], rough=0.32, clearcoat=0.5)
    verde = material("lechuga", [1, 1, 1], rough=0.46,
                     tex=T.add(tex.hoja_verde(TAM)))
    papa = material("papa", [1, 1, 1], rough=0.52,
                    tex=T.add(tex.papa_frita(TAM)))

    m = [M(*lathe(perfil_plato(0.27), 96), loza)]
    cx = -0.030
    m.append(M(*lathe([(0, 0), (0.050, 0), (0.052, 0.008),
                       (0.050, 0.018), (0, 0.020)], 64), pan)
             .rugoso(0.0009, 110, 21).transform(translate=(cx, 0.022, 0)))
    m.append(M(*hoja_curva(0.098, 0.088, 0.25, 16, semilla=4), verde)
             .transform(translate=(cx, 0.043, 0)))
    m.append(M(*cylinder(0.052, 0.023, 64), carne)
             .rugoso(0.0018, 65, 23).transform(translate=(cx, 0.044, 0)))

    # Queso derretido: tapa cuadrada con las puntas caídas por el borde.
    qv, qf, quv = hoja_curva(0.100, 0.100, -0.55, 14, semilla=9)
    m.append(M(qv, qf, quv, queso).transform(rot_y=0.55,
                                             translate=(cx, 0.069, 0)))
    for k in (-1, 1):
        m.append(M(*caja_redondeada(0.092, 0.004, 0.019, 0.002), tocineta)
                 .rugoso(0.0009, 100, 30 + k)
                 .transform(rot_y=0.10 * k, translate=(cx, 0.074, k * 0.013)))
    m.append(M(*lathe([(0, 0), (0.050, 0.002), (0.052, 0.012), (0.046, 0.026),
                       (0.030, 0.034), (0, 0.037)], 64), pan)
             .rugoso(0.0011, 95, 26).transform(translate=(cx, 0.078, 0)))

    r = np.random.default_rng(21)
    for k in range(8):
        m.append(M(*baston(0.070, 0.0115, 0.0018), papa)
                 .rugoso(0.0006, 120, 40 + k)
                 .transform(rot_y=r.uniform(-0.6, 0.6),
                            rot_x=r.uniform(-0.14, 0.14),
                            translate=(0.079 + r.uniform(-0.012, 0.012),
                                       0.019 + (k // 3) * 0.011,
                                       r.uniform(-0.025, 0.025))))
    return m, "hamburguesa-premium"


def torta(T):
    loza = material("loza", [1, 1, 1], rough=0.18, tex=T.add(tex.ceramica(TAM)))
    miga = material("bizcocho", [1, 1, 1], rough=0.78,
                    tex=T.add(tex.bizcocho(TAM)))
    crema = material("ganache", [1, 1, 1], rough=0.12,
                     tex=T.add(tex.ganache(TAM)), clearcoat=1.0)
    sal = material("sal", [1, 1, 0.98], rough=0.28)

    m = [M(*lathe(perfil_plato(0.18), 96), loza)]
    sup, R, GR = 0.011, 0.060, 55
    capas = [(0.000, 0.019, miga), (0.019, 0.005, crema),
             (0.024, 0.019, miga), (0.043, 0.008, crema)]
    for y0, h, mat in capas:
        r = R if mat is miga else R * 1.008
        pieza = M(*cuna(r, GR, h, y0), mat)
        if mat is miga:
            pieza = pieza.rugoso(0.0008, 130, int(y0 * 1000) + 3)
        m.append(pieza.transform(rot_y=-0.38, translate=(0.012, sup, -0.026)))

    # Hilo de ganache cayendo por el canto cortado.
    for k in range(4):
        a = np.deg2rad(8 + k * 13)
        m.append(M(*ellipsoid(0.0035, 0.008, 0.0035, 12, 10), crema)
                 .transform(rot_y=-0.38,
                            translate=(0.012 + R * 0.99 * np.cos(a - 0.38),
                                       sup + 0.044,
                                       -0.026 + R * 0.99 * np.sin(a - 0.38))))
    for k in range(6):
        a, d = 0.05 + k * 0.13, 0.028 + (k % 2) * 0.013
        m.append(Mesh(*box(0.0022, 0.0012, 0.0022)[:2], sal)
                 .transform(translate=(0.012 + d * np.cos(a), sup + 0.0515,
                                       -0.026 + d * np.sin(a))))
    return m, "torta-chocolate"


def coctel(T):
    vidrio = material("vidrio", [0.88, 0.93, 0.95], rough=0.03, alpha=0.26)
    licor = material("licor", [1, 1, 1], rough=0.05, alpha=0.86,
                     tex=T.add(tex.liquido_ambar(TAM)), clearcoat=1.0)
    hielo = material("hielo", [0.91, 0.96, 0.98], rough=0.06, alpha=0.42)
    romero = material("romero", [0.24, 0.38, 0.19], rough=0.58)
    citrico = material("limon", [0.88, 0.86, 0.36], rough=0.30, clearcoat=0.8)

    perfil = [(0, 0), (.038, 0), (.040, .004), (.036, .008), (.038, .030),
              (.043, .070), (.045, .105), (.043, .105), (.041, .072),
              (.036, .032), (.034, .010), (0, .010)]
    m = [M(*lathe(perfil, 96), vidrio)]
    m.append(M(*lathe([(0, 0), (0.035, 0), (0.040, 0.055), (0.0405, 0.058),
                       (0, 0.058)], 72), licor)
             .transform(translate=(0, 0.011, 0)))
    for k, (dx, dz, ry) in enumerate([(-0.013, 0.009, 0.4), (0.014, -0.007, 1.1),
                                      (0.001, -0.017, 2.2)]):
        m.append(M(*caja_redondeada(0.022, 0.022, 0.022, 0.003), hielo)
                 .transform(rot_y=ry, translate=(dx, 0.036 + k * 0.005, dz)))
    # Rodaja de limón montada en el borde de la copa, no flotando al lado.
    m.append(M(*disco(0.016, 0.0032, 30), citrico)
             .transform(rot_x=np.pi / 2, rot_y=0.4,
                        translate=(-0.036, 0.094, 0.012)))
    # Ramita de romero apoyada dentro, inclinada y saliendo por la boca.
    tallo = 0.075
    m.append(M(*capsula(tallo, 0.0015, 10), romero)
             .transform(rot_x=1.15, translate=(0.014, 0.074, -0.008)))
    for k in range(9):
        t = k / 8.0
        m.append(M(*hoja_curva(0.013, 0.0032, 0.35, 6, semilla=k), romero)
                 .transform(rot_y=k * 1.15, rot_z=0.55,
                            translate=(0.014 + 0.0035 * ((k % 2) * 2 - 1),
                                       0.048 + t * tallo * 0.92,
                                       -0.008 - (0.5 - t) * 0.026)))
    return m, "coctel-casa"


PLATOS = [ensalada, ceviche, aguacate, lomo, costillas,
          pasta, hamburguesa, torta, coctel]


if __name__ == "__main__":
    total = 0
    for fn in PLATOS:
        T = Texturas()
        meshes, nombre = fn(T)
        # Nada por debajo del plano de apoyo: el ruido puede empujar el
        # canto de una hoja bajo el plato y en AR eso se ve como comida
        # hundida en la mesa.
        for pieza in meshes:
            pieza.v[:, 1] = np.maximum(pieza.v[:, 1], 0.0)
            pieza.n = None
        size = export_glb(meshes, os.path.join(OUT, f"{nombre}.glb"), T)
        tris = sum(len(m.f) for m in meshes)
        total += size
        print(f"{nombre:24s} {size/1024:7.1f} KB  {tris:6d} tris  "
              f"{len(T.img)} tex  "
              f"{sum(len(x) for x in T.img)/1024:5.1f} KB tex")
    print(f"{'TOTAL':24s} {total/1024:7.1f} KB")

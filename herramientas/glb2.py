"""
Generador de .glb (glTF 2.0 binario) con texturas, UV, color por vértice y
desplazamiento por ruido. Python puro sobre numpy + PIL.

Respecto a la versión anterior añade lo que separa "forma correcta" de
"parece comida":

  - UV automáticos en las superficies paramétricas (lathe, elipsoide, toro),
    que es lo que permite pegar una textura.
  - Texturas PNG procedurales embebidas dentro del propio .glb, sin
    archivos sueltos.
  - COLOR_0 por vértice, para variación de tono sin necesidad de UV.
  - Ruido fbm para romper la perfección matemática de las superficies.
  - Materiales PBR con rugosidad por zona (una salsa glaseada y un pan
    mate no pueden compartir el mismo valor).

Todo en METROS: model-viewer, Scene Viewer y Quick Look leen la unidad
glTF como 1 metro, y de ahí sale el tamaño real en AR.
"""

import io
import json
import struct

import numpy as np
from PIL import Image

RNG = np.random.default_rng(20250915)


# ------------------------------------------------------------------- ruido

def _valor_ruido(shape, escala, rng):
    """Ruido de valor: rejilla aleatoria interpolada con suavizado cúbico."""
    h, w = shape
    gh, gw = max(2, int(h / escala) + 2), max(2, int(w / escala) + 2)
    rejilla = rng.random((gh, gw)).astype(np.float32)

    y = np.linspace(0, gh - 1, h, dtype=np.float32)
    x = np.linspace(0, gw - 1, w, dtype=np.float32)
    y0, x0 = np.floor(y).astype(int), np.floor(x).astype(int)
    y1, x1 = np.minimum(y0 + 1, gh - 1), np.minimum(x0 + 1, gw - 1)
    fy, fx = y - y0, x - x0
    fy = fy * fy * (3 - 2 * fy)
    fx = fx * fx * (3 - 2 * fx)

    a = rejilla[np.ix_(y0, x0)]
    b = rejilla[np.ix_(y0, x1)]
    c = rejilla[np.ix_(y1, x0)]
    d = rejilla[np.ix_(y1, x1)]
    arriba = a + (b - a) * fx[None, :]
    abajo = c + (d - c) * fx[None, :]
    return arriba + (abajo - arriba) * fy[:, None]


def fbm(shape, escala=48.0, octavas=5, persistencia=0.5, semilla=None):
    """Ruido fractal en [0,1]. La base de casi toda la textura de comida."""
    rng = RNG if semilla is None else np.random.default_rng(semilla)
    total = np.zeros(shape, np.float32)
    amp, suma, esc = 1.0, 0.0, float(escala)
    for _ in range(octavas):
        total += _valor_ruido(shape, esc, rng) * amp
        suma += amp
        amp *= persistencia
        esc = max(2.0, esc / 2)
    n = total / suma
    return (n - n.min()) / max(1e-6, float(np.ptp(n)))


def ruido_3d(puntos, escala=1.0, semilla=7):
    """Ruido pseudo-3D para desplazar vértices. Suma de senos con fase."""
    rng = np.random.default_rng(semilla)
    p = np.asarray(puntos, np.float32) * escala
    out = np.zeros(len(p), np.float32)
    amp, tot = 1.0, 0.0
    for _ in range(4):
        dir_ = rng.normal(size=(3, 3)).astype(np.float32)
        fase = rng.random(3).astype(np.float32) * 6.283
        out += amp * np.sin(p @ dir_[0] + fase[0]) \
                   * np.cos(p @ dir_[1] + fase[1]) \
                   * np.sin(p @ dir_[2] + fase[2])
        tot += amp
        amp *= 0.5
        p = p * 2.1
    return out / tot


# --------------------------------------------------------------- geometría

class Mesh:
    """Malla triangular con material, y opcionalmente UV y color por vértice."""

    def __init__(self, verts, faces, material, normals=None, uv=None, color=None):
        self.v = np.asarray(verts, dtype=np.float32)
        self.f = np.asarray(faces, dtype=np.uint32)
        self.material = material
        self.n = None if normals is None else np.asarray(normals, np.float32)
        self.uv = None if uv is None else np.asarray(uv, np.float32)
        self.c = None if color is None else np.asarray(color, np.float32)

    def with_normals(self, smooth=True):
        if self.n is not None:
            return self
        v, f = self.v, self.f
        fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
        n = np.zeros_like(v)
        for i in range(3):
            np.add.at(n, f[:, i], fn)
        ln = np.linalg.norm(n, axis=1, keepdims=True)
        self.n = (n / np.where(ln == 0, 1, ln)).astype(np.float32)
        return self

    def _clon(self, v):
        return Mesh(v, self.f, self.material, uv=self.uv, color=self.c)

    def transform(self, scale=1.0, translate=(0, 0, 0), rot_y=0.0, rot_x=0.0,
                  rot_z=0.0):
        v = self.v * np.asarray(scale, np.float32)
        if rot_x:
            c, s = np.cos(rot_x), np.sin(rot_x)
            v = v @ np.array([[1, 0, 0], [0, c, s], [0, -s, c]], np.float32)
        if rot_z:
            c, s = np.cos(rot_z), np.sin(rot_z)
            v = v @ np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]], np.float32)
        if rot_y:
            c, s = np.cos(rot_y), np.sin(rot_y)
            v = v @ np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]], np.float32)
        return self._clon(v + np.asarray(translate, np.float32))

    def rugoso(self, amplitud, escala=60.0, semilla=3, eje=None):
        """Desplaza los vértices con ruido. Lo que quita el aire de plástico.

        eje=None desplaza a lo largo de la normal del vértice.
        """
        self.with_normals()
        d = ruido_3d(self.v, escala, semilla)[:, None] * amplitud
        dirs = self.n if eje is None else np.asarray(eje, np.float32)[None, :]
        m = self._clon(self.v + dirs * d)
        return m

    def tinte(self, base, variacion=0.06, escala=40.0, semilla=11):
        """Color por vértice alrededor de `base`. Da manchas sin textura."""
        base = np.asarray(base, np.float32)
        d = ruido_3d(self.v, escala, semilla)[:, None] * variacion
        c = np.clip(base[None, :] + d, 0, 1)
        m = self._clon(self.v)
        m.n = self.n
        m.c = np.hstack([c, np.ones((len(c), 1), np.float32)])
        return m


def _uv_rejilla(rings, segments, v_flip=False):
    u = np.linspace(0, 1, segments + 1)[:segments]
    vv = np.linspace(0, 1, rings)
    if v_flip:
        vv = vv[::-1]
    U, V = np.meshgrid(u, vv)
    return np.stack([U.ravel(), V.ravel()], axis=-1).astype(np.float32)


def lathe(profile, segments=96, close_top=False, uv=True):
    """Superficie de revolución en Y. profile: [(radio, altura), ...]."""
    prof = np.asarray(profile, np.float32)
    rings = len(prof)
    ang = np.linspace(0, 2 * np.pi, segments, endpoint=False, dtype=np.float32)
    cos, sin = np.cos(ang), np.sin(ang)

    v = np.empty((rings * segments, 3), np.float32)
    for i, (r, y) in enumerate(prof):
        v[i * segments:(i + 1) * segments, 0] = r * cos
        v[i * segments:(i + 1) * segments, 1] = y
        v[i * segments:(i + 1) * segments, 2] = r * sin

    faces = []
    for i in range(rings - 1):
        a, b = i * segments, (i + 1) * segments
        for j in range(segments):
            k = (j + 1) % segments
            faces.append([a + j, b + j, b + k])
            faces.append([a + j, b + k, a + k])

    tex = _uv_rejilla(rings, segments) if uv else None

    if close_top:
        centro = len(v)
        v = np.vstack([v, [[0.0, prof[-1][1], 0.0]]])
        if tex is not None:
            tex = np.vstack([tex, [[0.5, 1.0]]])
        a = (rings - 1) * segments
        for j in range(segments):
            k = (j + 1) % segments
            faces.append([a + j, centro, a + k])

    return v, np.asarray(faces, np.uint32), tex


def ellipsoid(rx, ry, rz, seg=64, rings=40, squash_top=1.0, uv=True):
    phi = np.linspace(-np.pi / 2, np.pi / 2, rings, dtype=np.float32)
    theta = np.linspace(0, 2 * np.pi, seg, endpoint=False, dtype=np.float32)
    P, T = np.meshgrid(phi, theta, indexing="ij")
    y = np.sin(P)
    y = np.where(y > 0, y * squash_top, y)
    v = np.stack([
        rx * np.cos(P) * np.cos(T),
        ry * y,
        rz * np.cos(P) * np.sin(T),
    ], axis=-1).reshape(-1, 3).astype(np.float32)

    faces = []
    for i in range(rings - 1):
        a, b = i * seg, (i + 1) * seg
        for j in range(seg):
            k = (j + 1) % seg
            faces.append([a + j, b + j, b + k])
            faces.append([a + j, b + k, a + k])
    return v, np.asarray(faces, np.uint32), (_uv_rejilla(rings, seg) if uv else None)


def cylinder(r, h, seg=48, r_top=None):
    r_top = r if r_top is None else r_top
    return lathe([(0, 0), (r, 0), (r_top, h), (0, h)], seg)


def torus(R, r, seg=56, tube=26):
    u = np.linspace(0, 2 * np.pi, seg, endpoint=False, dtype=np.float32)
    w = np.linspace(0, 2 * np.pi, tube, endpoint=False, dtype=np.float32)
    U, W = np.meshgrid(u, w, indexing="ij")
    v = np.stack([
        (R + r * np.cos(W)) * np.cos(U),
        r * np.sin(W),
        (R + r * np.cos(W)) * np.sin(U),
    ], axis=-1).reshape(-1, 3).astype(np.float32)
    faces = []
    for i in range(seg):
        ii = (i + 1) % seg
        for j in range(tube):
            jj = (j + 1) % tube
            a, b = i * tube, ii * tube
            faces.append([a + j, b + j, b + jj])
            faces.append([a + j, b + jj, a + jj])
    uv = np.stack(np.meshgrid(
        np.linspace(0, 1, seg, endpoint=False),
        np.linspace(0, 1, tube, endpoint=False), indexing="ij",
    ), -1).reshape(-1, 2).astype(np.float32)
    return v, np.asarray(faces, np.uint32), uv


def box(w, h, d):
    x, y, z = w / 2, h / 2, d / 2
    v = np.array([
        [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
        [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z],
    ], np.float32)
    f = np.array([
        [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
        [0, 1, 5], [0, 5, 4], [3, 7, 6], [3, 6, 2],
        [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5],
    ], np.uint32)
    return v, f, None


def caja_redondeada(w, h, d, r=0.004, n=8):
    """Caja con cantos redondeados. Una carne no tiene aristas vivas."""
    v, f, uv = ellipsoid(1, 1, 1, seg=n * 4, rings=n * 2 + 1, uv=True)
    p = v.copy()
    ex, ey, ez = max(1e-4, w / 2 - r), max(1e-4, h / 2 - r), max(1e-4, d / 2 - r)
    # Proyección tipo "esfera inflada dentro de una caja": empuja cada punto
    # de la esfera hacia la superficie de la caja dejando el radio r de canto.
    m = np.max(np.abs(p) / np.array([1, 1, 1], np.float32), axis=1, keepdims=True)
    dirn = p / np.where(m == 0, 1, m)
    out = np.clip(dirn, -1, 1) * np.array([ex, ey, ez], np.float32) + \
        np.clip(p, -1, 1) * r
    return out.astype(np.float32), f, uv


# --------------------------------------------------------------- materiales

class Texturas:
    """Acumula las imágenes que se embeben dentro del propio .glb.

    En JPEG y no en PNG a propósito: son texturas de ruido, justo el caso
    donde PNG no comprime nada y JPEG baja el archivo casi un orden de
    magnitud. Un menú por QR se abre desde el teléfono del comensal, con
    datos móviles, así que el peso del modelo es parte del diseño.
    """

    def __init__(self, calidad=86):
        self.img = []
        self.calidad = calidad

    def add(self, arr):
        """arr: HxWx3 float [0,1] -> índice de textura."""
        im = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), "RGB")
        bio = io.BytesIO()
        im.save(bio, format="JPEG", quality=self.calidad,
                optimize=True, progressive=False)
        self.img.append(bio.getvalue())
        return len(self.img) - 1


def material(name, color, rough=0.6, metal=0.0, alpha=None, tex=None,
             emissive=None, clearcoat=None):
    m = {
        "name": name,
        "pbrMetallicRoughness": {
            "baseColorFactor": list(color) + ([1.0] if len(color) == 3 else []),
            "metallicFactor": metal,
            "roughnessFactor": rough,
        },
        "doubleSided": True,
    }
    if tex is not None:
        m["pbrMetallicRoughness"]["baseColorTexture"] = {"index": tex}
    if alpha is not None:
        m["pbrMetallicRoughness"]["baseColorFactor"][3] = alpha
        m["alphaMode"] = "BLEND"
    if emissive is not None:
        m["emissiveFactor"] = list(emissive)
    if clearcoat is not None:
        # Barniz sobre la salsa: lo que hace que un glaseado se lea como mojado.
        m["extensions"] = {
            "KHR_materials_clearcoat": {
                "clearcoatFactor": float(clearcoat),
                "clearcoatRoughnessFactor": 0.12,
            }
        }
    return m


# -------------------------------------------------------------- exportador

def export_glb(meshes, path, texturas=None):
    materials, mat_index = [], {}
    buf = bytearray()
    accessors, buffer_views, primitives = [], [], []
    imagenes, muestras, texturas_json = [], [], []

    def add_view(data, target=None):
        while len(buf) % 4:
            buf.append(0)
        offset = len(buf)
        buf.extend(data)
        bv = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target is not None:
            bv["target"] = target
        buffer_views.append(bv)
        return len(buffer_views) - 1

    if texturas is not None and texturas.img:
        muestras.append({
            "magFilter": 9729, "minFilter": 9987,
            "wrapS": 10497, "wrapT": 10497,
        })
        for datos in texturas.img:
            vi = add_view(datos)
            imagenes.append({"bufferView": vi, "mimeType": "image/jpeg"})
            texturas_json.append({"sampler": 0, "source": len(imagenes) - 1})

    for mesh in meshes:
        mesh.with_normals()
        # Un material con textura sobre una malla sin UV se dibuja blanco
        # puro, y en el visor parece un trozo de plástico. Es un fallo fácil
        # de cometer y difícil de ver, así que se corta aquí.
        tiene_tex = "baseColorTexture" in mesh.material["pbrMetallicRoughness"]
        if tiene_tex and (mesh.uv is None or len(mesh.uv) != len(mesh.v)):
            raise ValueError(
                f"material '{mesh.material['name']}' lleva textura pero la "
                f"malla no trae UV ({len(mesh.v)} vértices)")
        key = json.dumps(mesh.material, sort_keys=True)
        if key not in mat_index:
            mat_index[key] = len(materials)
            materials.append(mesh.material)

        pos = mesh.v.astype(np.float32)
        nrm = mesh.n.astype(np.float32)
        idx = mesh.f.astype(np.uint32).reshape(-1)

        v_pos = add_view(pos.tobytes(), 34962)
        accessors.append({
            "bufferView": v_pos, "componentType": 5126, "count": len(pos),
            "type": "VEC3",
            "min": pos.min(axis=0).tolist(), "max": pos.max(axis=0).tolist(),
        })
        attrs = {"POSITION": len(accessors) - 1}

        v_nrm = add_view(nrm.tobytes(), 34962)
        accessors.append({"bufferView": v_nrm, "componentType": 5126,
                          "count": len(nrm), "type": "VEC3"})
        attrs["NORMAL"] = len(accessors) - 1

        if mesh.uv is not None and len(mesh.uv) == len(pos):
            uv = mesh.uv.astype(np.float32)
            v_uv = add_view(uv.tobytes(), 34962)
            accessors.append({"bufferView": v_uv, "componentType": 5126,
                              "count": len(uv), "type": "VEC2"})
            attrs["TEXCOORD_0"] = len(accessors) - 1

        if mesh.c is not None and len(mesh.c) == len(pos):
            col = mesh.c.astype(np.float32)
            v_c = add_view(col.tobytes(), 34962)
            accessors.append({"bufferView": v_c, "componentType": 5126,
                              "count": len(col), "type": "VEC4"})
            attrs["COLOR_0"] = len(accessors) - 1

        # Índices de 16 bits cuando la malla cabe: ninguna pieza de comida
        # llega a 65.536 vértices y esto se lleva por delante casi la mitad
        # del peso del archivo, que es lo que el comensal espera en el
        # teléfono.
        if len(pos) <= 65535:
            v_idx = add_view(idx.astype(np.uint16).tobytes(), 34963)
            ctype = 5123
        else:
            v_idx = add_view(idx.tobytes(), 34963)
            ctype = 5125
        accessors.append({"bufferView": v_idx, "componentType": ctype,
                          "count": len(idx), "type": "SCALAR"})

        primitives.append({
            "attributes": attrs, "indices": len(accessors) - 1,
            "material": mat_index[key],
        })

    gltf = {
        "asset": {"version": "2.0", "generator": "menu-premium procedural v2"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": primitives}],
        "materials": materials,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(buf)}],
    }
    if imagenes:
        gltf["images"] = imagenes
        gltf["samplers"] = muestras
        gltf["textures"] = texturas_json
    if any("extensions" in m for m in materials):
        gltf["extensionsUsed"] = ["KHR_materials_clearcoat"]

    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    bn = bytes(buf)
    bn += b"\0" * (-len(bn) % 4)

    total = 12 + 8 + len(js) + 8 + len(bn)
    with open(path, "wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, total))
        fh.write(struct.pack("<II", len(js), 0x4E4F534A))
        fh.write(js)
        fh.write(struct.pack("<II", len(bn), 0x004E4942))
        fh.write(bn)
    return total

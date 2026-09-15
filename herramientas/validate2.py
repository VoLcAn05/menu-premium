"""
Valida los .glb: contenedor, JSON glTF, accessors, texturas, escala real
y apoyo en y=0.

Lo que se comprueba no es cosmético. Si la escala se va, en AR el plato
aparece del tamaño equivocado sobre la mesa, que es justo la función de
esa pantalla; si la base no está en y=0 el plato flota o se hunde; y un
material con textura sobre una malla sin UV se dibuja blanco.
"""

import io
import json
import os
import struct
import sys

import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                 sys.argv[1] if len(sys.argv) > 1 else "../public/models")

ESPERADO = {  # ancho esperado en cm, tolerancia +/- 20%
    "ensalada-casa": 21, "ceviche-camarones": 15, "aguacate-camarones": 21,
    "lomo-parrilla": 27, "costillas-bbq": 27, "pasta-pesto": 27,
    "hamburguesa-premium": 27, "torta-chocolate": 18, "coctel-casa": 9,
}
CT = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

fallos = []

for nombre in sorted(ESPERADO):
    ruta = os.path.join(D, f"{nombre}.glb")
    data = open(ruta, "rb").read()

    magic, version, length = struct.unpack("<III", data[:12])
    assert magic == 0x46546C67, f"{nombre}: magic incorrecto"
    assert version == 2, f"{nombre}: version != 2"
    assert length == len(data), f"{nombre}: longitud declarada != real"

    off = 12
    js_len, js_type = struct.unpack("<II", data[off:off + 8])
    assert js_type == 0x4E4F534A, f"{nombre}: primer chunk no es JSON"
    gltf = json.loads(data[off + 8:off + 8 + js_len])
    off += 8 + js_len
    bin_len, bin_type = struct.unpack("<II", data[off:off + 8])
    assert bin_type == 0x004E4942, f"{nombre}: segundo chunk no es BIN"
    buf = data[off + 8:off + 8 + bin_len]

    assert gltf["buffers"][0]["byteLength"] <= len(buf), f"{nombre}: buffer"
    for i, bv in enumerate(gltf["bufferViews"]):
        assert bv.get("byteOffset", 0) + bv["byteLength"] <= len(buf), \
            f"{nombre}: bufferView {i} se sale del buffer"
        assert bv.get("byteOffset", 0) % 4 == 0, \
            f"{nombre}: bufferView {i} sin alinear a 4 bytes"

    # Las imágenes embebidas tienen que poder decodificarse de verdad.
    for i, im in enumerate(gltf.get("images", [])):
        bv = gltf["bufferViews"][im["bufferView"]]
        raw = buf[bv["byteOffset"]:bv["byteOffset"] + bv["byteLength"]]
        pic = Image.open(io.BytesIO(raw))
        pic.load()
        assert im["mimeType"] in ("image/jpeg", "image/png"), \
            f"{nombre}: mimeType no permitido en glTF"

    prims = gltf["meshes"][0]["primitives"]
    n_mat = len(gltf["materials"])
    n_tex = len(gltf.get("textures", []))
    for p in prims:
        assert p["material"] < n_mat, f"{nombre}: material fuera de rango"
        a_idx = gltf["accessors"][p["indices"]]
        a_pos = gltf["accessors"][p["attributes"]["POSITION"]]
        bv = gltf["bufferViews"][a_idx["bufferView"]]
        idx = np.frombuffer(buf, CT[a_idx["componentType"]], a_idx["count"],
                            bv["byteOffset"])
        assert idx.max() < a_pos["count"], \
            f"{nombre}: índice {idx.max()} >= {a_pos['count']} vértices"
        assert a_idx["count"] % 3 == 0, f"{nombre}: índices no múltiplo de 3"
        assert "min" in a_pos and "max" in a_pos, \
            f"{nombre}: POSITION sin min/max (lo exige glTF)"

        mat = gltf["materials"][p["material"]]
        pbr = mat["pbrMetallicRoughness"]
        if "baseColorTexture" in pbr:
            assert pbr["baseColorTexture"]["index"] < n_tex, \
                f"{nombre}: textura fuera de rango"
            assert "TEXCOORD_0" in p["attributes"], \
                f"{nombre}: material '{mat['name']}' con textura y sin UV"
            a_uv = gltf["accessors"][p["attributes"]["TEXCOORD_0"]]
            assert a_uv["count"] == a_pos["count"], \
                f"{nombre}: nº de UV != nº de vértices"

    mins = np.array([gltf["accessors"][p["attributes"]["POSITION"]]["min"]
                     for p in prims]).min(axis=0)
    maxs = np.array([gltf["accessors"][p["attributes"]["POSITION"]]["max"]
                     for p in prims]).max(axis=0)
    dim = (maxs - mins) * 100

    ancho, esp = max(dim[0], dim[2]), ESPERADO[nombre]
    ok = abs(ancho - esp) / esp < 0.20
    if not ok:
        fallos.append(f"{nombre}: ancho {ancho:.1f} cm, esperado ~{esp} cm")
    apoyo = abs(mins[1]) < 0.002
    if not apoyo:
        fallos.append(f"{nombre}: base en y={mins[1]*100:.1f} cm, no en 0")

    kb = len(data) / 1024
    if kb > 750:
        fallos.append(f"{nombre}: {kb:.0f} KB, demasiado para datos móviles")

    print(f"{nombre:22s} {dim[0]:5.1f} x {dim[1]:5.1f} x {dim[2]:5.1f} cm "
          f"| {len(prims):3d} prims | {n_mat} mats | {n_tex} tex "
          f"| {kb:6.1f} KB | {'OK' if ok and apoyo else 'REVISAR'}")

print()
if fallos:
    print("PROBLEMAS:")
    for f in fallos:
        print("  -", f)
    sys.exit(1)
print("Los 9 modelos son GLB válidos, con textura, escala real y apoyo en y=0.")

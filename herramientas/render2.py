"""
Rasterizador para revisar los .glb sin GPU ni navegador.

Respecto al anterior sabe leer índices de 16 bits, coordenadas UV y las
texturas embebidas, que es justo lo que hay que comprobar: si la textura
no está bien mapeada, en el visor real se ve como plástico manchado y
desde aquí no habría manera de enterarse.
"""

import io
import json
import os
import struct
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16,
      5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def load_glb(path):
    data = open(path, "rb").read()
    js_len = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20:20 + js_len])
    buf = data[20 + js_len + 8:]

    def leer(acc_i):
        a = gltf["accessors"][acc_i]
        bv = gltf["bufferViews"][a["bufferView"]]
        n = NC[a["type"]]
        arr = np.frombuffer(buf, CT[a["componentType"]], a["count"] * n,
                            bv.get("byteOffset", 0) + a.get("byteOffset", 0))
        return arr.reshape(-1, n) if n > 1 else arr

    imagenes = []
    for im in gltf.get("images", []):
        bv = gltf["bufferViews"][im["bufferView"]]
        raw = buf[bv["byteOffset"]:bv["byteOffset"] + bv["byteLength"]]
        pic = Image.open(io.BytesIO(raw)).convert("RGB")
        imagenes.append(np.asarray(pic, np.float32) / 255.0)

    prims = []
    for p in gltf["meshes"][0]["primitives"]:
        at = p["attributes"]
        pos = leer(at["POSITION"])
        nrm = leer(at["NORMAL"])
        uv = leer(at["TEXCOORD_0"]) if "TEXCOORD_0" in at else None
        idx = leer(p["indices"]).astype(np.int64).reshape(-1, 3)
        mat = gltf["materials"][p["material"]]
        pbr = mat["pbrMetallicRoughness"]
        timg = None
        if "baseColorTexture" in pbr:
            t = gltf["textures"][pbr["baseColorTexture"]["index"]]
            timg = imagenes[t["source"]]
        prims.append(dict(pos=pos, nrm=nrm, uv=uv, idx=idx, tex=timg,
                          base=pbr["baseColorFactor"],
                          rough=pbr.get("roughnessFactor", 0.5)))
    return prims


def _muestrear(img, uv):
    h, w, _ = img.shape
    u = np.mod(uv[:, 0], 1.0) * (w - 1)
    v = np.mod(uv[:, 1], 1.0) * (h - 1)
    return img[v.astype(int), u.astype(int)]


def render(path, size=470, elev=np.deg2rad(24), azim=np.deg2rad(38)):
    prims = load_glb(path)
    allv = np.vstack([p["pos"] for p in prims])
    lo, hi = allv.min(0), allv.max(0)
    centro = (lo + hi) / 2
    radio = np.linalg.norm(hi - lo) / 2

    d = radio * 2.85
    eye = centro + d * np.array([np.cos(elev) * np.sin(azim), np.sin(elev),
                                 np.cos(elev) * np.cos(azim)])
    fwd = centro - eye
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0, 1, 0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    view = np.stack([right, up, -fwd])
    f = 1.0 / np.tan(np.deg2rad(30) / 2)
    near = 0.01

    color = np.zeros((size, size, 3), np.float32)
    gy = np.linspace(0, 1, size)[:, None]
    color += (0.075 + 0.055 * (1 - gy))[..., None]
    zbuf = np.full((size, size), np.inf, np.float32)

    luz = np.array([0.45, 0.82, 0.36]); luz /= np.linalg.norm(luz)
    luz2 = np.array([-0.6, 0.35, -0.45]); luz2 /= np.linalg.norm(luz2)

    for p in prims:
        pos, nrm, idx = p["pos"], p["nrm"], p["idx"]
        cam = (pos - eye) @ view.T
        z = -cam[:, 2]
        ok = z > near
        px = ((cam[:, 0] * f / np.maximum(z, near)) * 0.5 + 0.5) * size
        py = (1.0 - ((cam[:, 1] * f / np.maximum(z, near)) * 0.5 + 0.5)) * size

        n = nrm / np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
        dif = np.clip(n @ luz, 0, 1)
        dif2 = np.clip(n @ luz2, 0, 1)
        vd = eye - pos
        vd /= np.maximum(np.linalg.norm(vd, axis=1, keepdims=True), 1e-9)
        h = luz + vd
        h /= np.maximum(np.linalg.norm(h, axis=1, keepdims=True), 1e-9)
        rough = p["rough"]
        spec = np.clip(np.sum(n * h, axis=1), 0, 1) ** (2 + 130 * (1 - rough) ** 2)
        spec *= (1 - rough) * 0.95

        base = np.array(p["base"][:3], np.float32)
        alpha = p["base"][3] if len(p["base"]) > 3 else 1.0
        # Luz por vértice, albedo por píxel: si la textura se muestrea por
        # vértice se pierde todo el detalle fino y el modelo se juzga mal.
        lum = (0.20 + 0.72 * dif + 0.22 * dif2).astype(np.float32)
        usa_tex = p["tex"] is not None and p["uv"] is not None
        albedo_v = None if usa_tex else np.broadcast_to(
            base, (len(pos), 3)).astype(np.float32)
        uv = p["uv"]

        for tri in idx:
            if not ok[tri].all():
                continue
            x0, x1, x2 = px[tri]; y0, y1, y2 = py[tri]
            area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
            if area >= -1e-9:
                continue
            ax = max(int(np.floor(min(x0, x1, x2))), 0)
            bx = min(int(np.ceil(max(x0, x1, x2))), size - 1)
            ay = max(int(np.floor(min(y0, y1, y2))), 0)
            by = min(int(np.ceil(max(y0, y1, y2))), size - 1)
            if ax > bx or ay > by:
                continue
            X, Y = np.meshgrid(np.arange(ax, bx + 1) + .5,
                               np.arange(ay, by + 1) + .5)
            w0 = ((x1 - x0) * (Y - y0) - (X - x0) * (y1 - y0)) / area
            w1 = ((x2 - x1) * (Y - y1) - (X - x1) * (y2 - y1)) / area
            w2 = 1.0 - w0 - w1
            dentro = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
            if not dentro.any():
                continue
            zt = w1 * z[tri[0]] + w2 * z[tri[1]] + w0 * z[tri[2]]
            sub = zbuf[ay:by + 1, ax:bx + 1]
            cerca = dentro & (zt < sub)
            if not cerca.any():
                continue
            lu = (w1 * lum[tri[0]] + w2 * lum[tri[1]] + w0 * lum[tri[2]])
            sp = (w1 * spec[tri[0]] + w2 * spec[tri[1]] + w0 * spec[tri[2]])
            if usa_tex:
                uu = w1 * uv[tri[0], 0] + w2 * uv[tri[1], 0] + w0 * uv[tri[2], 0]
                vv = w1 * uv[tri[0], 1] + w2 * uv[tri[1], 1] + w0 * uv[tri[2], 1]
                th, tw, _ = p["tex"].shape
                alb = p["tex"][(np.mod(vv, 1.0) * (th - 1)).astype(int),
                               (np.mod(uu, 1.0) * (tw - 1)).astype(int)] \
                    * base[None, None, :]
            else:
                alb = (w1[..., None] * albedo_v[tri[0]]
                       + w2[..., None] * albedo_v[tri[1]]
                       + w0[..., None] * albedo_v[tri[2]])
            col = np.clip(lu[..., None] * alb + sp[..., None] * 0.7, 0, 1)
            dst = color[ay:by + 1, ax:bx + 1]
            if alpha < 0.999:
                color[ay:by + 1, ax:bx + 1] = np.where(
                    cerca[..., None], dst * (1 - alpha) + col * alpha, dst)
            else:
                color[ay:by + 1, ax:bx + 1] = np.where(cerca[..., None], col, dst)
                sub[cerca] = zt[cerca]

    return Image.fromarray(
        (np.clip(color, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8))


if __name__ == "__main__":
    POR_DEFECTO = os.path.join(os.pardir, "public", "models")
    carpeta = sys.argv[1] if len(sys.argv) > 1 else POR_DEFECTO
    salida = sys.argv[2] if len(sys.argv) > 2 else "preview2.png"
    D = os.path.join(HERE, carpeta)
    nombres = sorted(f[:-4] for f in os.listdir(D) if f.endswith(".glb"))
    tiles = [(n, render(os.path.join(D, f"{n}.glb"))) for n in nombres]
    for n, _ in tiles:
        print("render", n)
    cols, S = 3, 470
    rows = (len(tiles) + cols - 1) // cols
    hoja = Image.new("RGB", (cols * S, rows * S), (12, 12, 14))
    for i, (n, im) in enumerate(tiles):
        hoja.paste(im, ((i % cols) * S, (i // cols) * S))
    hoja.save(os.path.join(HERE, salida))
    print("->", os.path.join(HERE, salida))

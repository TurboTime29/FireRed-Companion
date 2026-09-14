"""Download FRLG map images from Bulbapedia and match them to game maps by pixel size (16 px per tile).

Writes public/maps/<MAP_ID>.png and scripts/raw/maps_index.json. Re-runnable; skips maps already downloaded.
"""
import json, os, re, sys, time, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
RAW = os.path.join(HERE, "raw", "pokefirered")
OUT = os.path.join(PROJ, "public", "maps")
os.makedirs(OUT, exist_ok=True)
UA = {"User-Agent": "firered-companion-builder/0.1 (personal project; kash6747@gmail.com)"}
CACHE_PATH = os.path.join(HERE, "raw", "maps_index.json")
cache = json.load(open(CACHE_PATH, encoding="utf-8")) if os.path.exists(CACHE_PATH) else {"pages": {}, "images": {}, "maps": {}}


def api(**q):
    q.update(format="json", formatversion=2)
    for i in range(3):
        try:
            r = urllib.request.Request("https://bulbapedia.bulbagarden.net/w/api.php?" + urllib.parse.urlencode(q), headers=UA)
            return json.load(urllib.request.urlopen(r, timeout=60))
        except Exception as e:
            print("  retry", e, file=sys.stderr); time.sleep(3)
    return {}


def page_images(page):
    """All *FRLG*.png file names referenced by a page (wikitext regex + expanded fragments)."""
    if page in cache["pages"]:
        return cache["pages"][page]
    d = api(action="parse", page=page, prop="wikitext", redirects=1)
    names = set()
    if "parse" in d:
        wt = d["parse"]["wikitext"]
        for n in re.findall(r"([\w' .()\-–]+\.png)", wt):
            n = n.strip()
            names.add(n)
            if "FRLG" in n and not n.lower().startswith(page.lower().split(" (")[0].lower()[:5]):
                names.add(f"{page} {n}")  # template fragments like "2F FRLG.png"
        for n in re.findall(r"\[\[File:([^|\]]+\.png)", wt):
            names.add(n.strip())
    # also whatever MediaWiki says is used on the page
    d2 = api(action="query", prop="images", titles=page, imlimit=500, redirects=1)
    for p in d2.get("query", {}).get("pages", []):
        for im in p.get("images", []):
            t = im["title"].replace("File:", "")
            if t.lower().endswith(".png"):
                names.add(t)
    names = sorted(n for n in names if not n.startswith(" ") and not re.search(r"^(Spr |Bag |Dream |Menu |Type |Gen |Ani |Sugimori )|LGPE|HGSS|RSE|Emerald|RBY|GSC|Yellow| Map\.png$| trainer", n))
    cache["pages"][page] = names
    time.sleep(0.3)
    return names


def image_info(names):
    out = {}
    todo = [n for n in names if n not in cache["images"]]
    for i in range(0, len(todo), 40):
        chunk = todo[i:i + 40]
        d = api(action="query", prop="imageinfo", titles="|".join("File:" + n for n in chunk), iiprop="url|size", redirects=1)
        for p in d.get("query", {}).get("pages", []):
            t = p["title"].replace("File:", "")
            ii = (p.get("imageinfo") or [None])[0]
            cache["images"][t] = {"w": ii["width"], "h": ii["height"], "url": ii["url"]} if ii else None
        time.sleep(0.3)
    for n in names:
        if cache["images"].get(n):
            out[n] = cache["images"][n]
    return out


def bulba_pages(loc):
    """Candidate Bulbapedia page titles for a map, most specific first."""
    sec = loc["sectionName"]
    out = []
    if loc["key"].endswith("_Gym"):
        out.append(sec.replace(" City", "").replace(" Island", "") + " Gym")
    if "OaksLab" in loc["key"] or "ProfessorOaksLab" in loc["key"]:
        out.append("Professor Oak's Laboratory")
    out += [bulba_page(loc), f"Kanto {sec}", f"{sec} (Kanto)"]
    if sec == "Pokémon Mansion":
        out.append("Pokémon Mansion (Kanto)")
    return list(dict.fromkeys(out))


def bulba_page(loc):
    sec = loc["sectionName"]
    m = re.match(r"Route (\d+)$", sec)
    if m:
        return f"Kanto Route {m.group(1)}"
    if sec == "Underground Path":
        return "Underground Path (Kanto Routes 5–6)" if "NORTH_SOUTH" in loc["id"] else "Underground Path (Kanto Routes 7–8)"
    if sec == "Pokémon League":
        return "Indigo Plateau"
    if sec == "Diglett's Cave":
        return "Diglett's Cave"
    return sec


import struct


def visible_bbox(lay):
    """Bounding box (ox, oy, w, h in tiles) of tiles that differ from the border metatile: Bulbapedia crops indoor maps to this."""
    W, H = lay["width"], lay["height"]
    try:
        data = struct.unpack("<%dH" % (W * H), open(os.path.join(RAW, lay["blockdata_filepath"]), "rb").read()[:W * H * 2])
        border = struct.unpack("<H", open(os.path.join(RAW, lay["border_filepath"]), "rb").read()[:2])[0] & 0x3FF
    except Exception:
        return (0, 0, W, H)
    xs = [i % W for i, v in enumerate(data) if (v & 0x3FF) != border]
    ys = [i // W for i, v in enumerate(data) if (v & 0x3FF) != border]
    if not xs:
        return (0, 0, W, H)
    return (min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)


def main():
    locations = json.load(open(os.path.join(PROJ, "public", "data", "locations.json"), encoding="utf-8"))
    layouts = {l.get("id"): l for l in json.load(open(os.path.join(RAW, "data", "layouts", "layouts.json")))["layouts"] if l.get("id")}
    maps = {}
    for mj in os.listdir(os.path.join(RAW, "data", "maps")):
        p = os.path.join(RAW, "data", "maps", mj, "map.json")
        if os.path.exists(p):
            m = json.load(open(p, encoding="utf-8"))
            maps[m["id"]] = m
    matched = 0
    todo = []
    for loc in locations:
        if loc["key"].startswith("Prototype") or "Unused" in loc["key"]:
            continue
        m = maps.get(loc["id"])
        lay = layouts.get(m["layout"]) if m else None
        if not lay:
            continue
        todo.append((loc, lay))
    total = len(todo)
    for loc, lay in todo:
        dest = os.path.join(OUT, loc["id"] + ".png")
        if loc["id"] in cache["maps"] and os.path.exists(dest):
            matched += 1
            continue
        full = (lay["width"] * 16, lay["height"] * 16)
        crop = visible_bbox(lay)  # (ox, oy, w, h) in tiles
        cw, ch = crop[2] * 16, crop[3] * 16
        found = None
        for page in bulba_pages(loc):
            names = page_images(page)
            infos = image_info(names) if names else {}
            exact = [n for n, ii in infos.items() if (ii["w"], ii["h"]) == full]
            cropped = [n for n, ii in infos.items() if (ii["w"], ii["h"]) == (cw, ch) and (cw, ch) != full]
            near = [n for n, ii in infos.items() if 0 <= full[0] - ii["w"] <= 16 and 0 <= full[1] - ii["h"] <= 16 and n not in exact]
            suffix = loc["key"].split("_")[-1] if "_" in loc["key"] else ""
            key = lambda n: (suffix and suffix.lower() not in n.replace(" ", "").lower(), "FRLG" not in n, len(n))
            if exact:
                found = (sorted(exact, key=key)[0], infos, [0, 0]); break
            if cropped:
                found = (sorted(cropped, key=key)[0], infos, [crop[0], crop[1]]); break
            if near:
                found = (sorted(near, key=key)[0], infos, [0, 0]); break
        if not found:
            continue
        name, infos, offset = found
        if True:
            hits = [name]
            ii = infos[name]
            try:
                r = urllib.request.Request(ii["url"], headers=UA)
                data = urllib.request.urlopen(r, timeout=120).read()
                open(dest, "wb").write(data)
                cache["maps"][loc["id"]] = {"file": hits[0], "w": ii["w"], "h": ii["h"], "offset": offset}
                matched += 1
                print(f"  {loc['name']} <- {hits[0]} ({len(data)//1024} KB)")
                time.sleep(0.4)
            except Exception as e:
                print("  download failed", loc["id"], e, file=sys.stderr)
        json.dump(cache, open(CACHE_PATH, "w", encoding="utf-8"))
    json.dump(cache, open(CACHE_PATH, "w", encoding="utf-8"))
    print(f"MAPS_DONE matched {matched} of {total} maps")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

"""Expand content/walkthrough/*.json into public/data/walkthrough.json and validate coverage.

Chapter file:
  {"id":"c03","n":3,"title":"...","subtitle":"...","guidePart":3,"maps":["MAP_..."],
   "steps":[ {"kind":"story","text":"..."},
             {"auto":"map","map":"MAP_VIRIDIAN_FOREST"}            # expands to trainers + item balls + hidden items + tutors of that map
             {"auto":"trainers"|"items"|"hidden"|"tutors","map":...,"exclude":["TRAINER_X"]}
             {"kind":"boss","text":"...","trainers":["TRAINER_LEADER_BROCK"],"badge":1}
             {"kind":"battle","text":"...","battleGroup":"rival-route22-early"}
             {"kind":"item","text":"...","items":["ITEM_TM39"],"flag":"FLAG_..."} ]}
"""
import os, re, json, glob, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
DATA = os.path.join(PROJ, "public", "data")
CONTENT = os.path.join(PROJ, "content", "walkthrough")


def load(n):
    return json.load(open(os.path.join(DATA, n + ".json"), encoding="utf-8"))


P = {p["id"]: p for p in load("pokemon")}
M = {m["id"]: m for m in load("moves")}
I = {i["id"]: i for i in load("items")}
IK = {i["key"]: i for i in I.values()}
T = {t["id"]: t for t in load("trainers")}
TK = {t["key"]: t for t in T.values()}
L = {l["id"]: l for l in load("locations")}
G = load("guide")


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def guide_sections(loc):
    key = norm(loc["sectionName"])
    out = []
    for part in G:
        for s in part["sections"]:
            h = norm(s["heading"])
            if h == key or (len(key) > 5 and (h.startswith(key) or (key.startswith(h) and len(h) > 5))):
                out.append(s)
    return out


def item_matches(gi, item):
    n, g, d = norm(item["name"]), norm(gi["name"]), norm(gi["display"])
    if item.get("move"):
        tm = item["name"].split(" ")[0]
        return norm(tm) in d or norm(" ".join(item["name"].split(" ")[1:])) in d
    return g == n or d.startswith(n) or (n.startswith(g) and len(g) > 3)


def where(loc, item, hidden, used):
    for s in guide_sections(loc):
        for gi in s["items"]:
            if gi["hidden"] == hidden and item_matches(gi, item) and id(gi) not in used:
                used.add(id(gi))
                return gi["where"]
    return None


def trainer_text(t):
    boss = t["classKey"] in ("LEADER", "ELITE_FOUR", "CHAMPION", "BOSS") or t["classKey"].startswith("RIVAL")
    mons = ", ".join(f"{P[m['species']]['name']} Lv.{m['level']}" for m in t["party"])
    name = f"Rival {t['name']}" if t["classKey"].startswith("RIVAL") or t["classKey"] == "CHAMPION" else f"{t['class']} {t['name']}"
    return ("boss" if boss else "battle"), f"{name}: {mons}"


def expand_auto(step, chapter, used_guide):
    loc = L[step["map"]]
    what = step["auto"]
    excl = set(step.get("exclude", []))
    out = []
    if what in ("map", "trainers"):
        for tid in loc["trainers"]:
            t = T[tid]
            if t["key"] in excl or t.get("battleGroup") or t.get("rematchOf") is not None:
                continue
            kind, text = trainer_text(t)
            out.append({"kind": kind, "text": text, "map": loc["id"], "trainers": [tid]})
    if what in ("map", "items"):
        for b in loc["items"]:
            it = I[b["item"]]
            w = where(loc, it, False, used_guide)
            out.append({"kind": "item", "text": f"{it['name']} (item ball){' — ' + w if w else ''}", "map": loc["id"], "items": [it["id"]], "flag": b["flag"], "x": b["x"], "y": b["y"]})
    if what in ("map", "hidden"):
        for b in loc["hiddenItems"]:
            it = I[b["item"]]
            w = where(loc, it, True, used_guide)
            qty = f" ×{b['qty']}" if b.get("qty", 1) > 1 else ""
            out.append({"kind": "hidden", "text": f"Hidden {it['name']}{qty}{' — ' + w if w else ' — use the Itemfinder'}", "map": loc["id"], "items": [it["id"]], "flag": b["flag"], "x": b["x"], "y": b["y"]})
    if what in ("map", "tutors"):
        for tu in loc["tutors"]:
            out.append({"kind": "tutor", "text": f"Move Tutor teaches {M[tu['move']]['name']} (once only)", "map": loc["id"]})
    return out


def resolve(step):
    s = dict(step)
    if "trainers" in s:
        ids = []
        for k in s["trainers"]:
            if isinstance(k, int):
                ids.append(k)
            elif k in TK:
                ids.append(TK[k]["id"])
            else:
                raise SystemExit(f"unknown trainer {k}")
        s["trainers"] = ids
    if "items" in s:
        ids = []
        for k in s["items"]:
            if isinstance(k, int):
                ids.append(k)
            elif k in IK:
                ids.append(IK[k]["id"])
            else:
                print(f"  warning: unknown item {k} (dropped)")
        s["items"] = ids
    if "pokemon" in s:
        s["pokemon"] = [k if isinstance(k, int) else next(p["id"] for p in P.values() if p["name"].lower() == k.lower()) for k in s["pokemon"]]
    if "map" in s and s["map"] not in L:
        raise SystemExit(f"unknown map {s['map']}")
    return s


def main():
    chapters = []
    covered_trainers, covered_flags = set(), set()
    for path in sorted(glob.glob(os.path.join(CONTENT, "c*.json"))):
        c = json.load(open(path, encoding="utf-8"))
        used_guide = set()
        steps = []
        for st in c["steps"]:
            if "auto" in st:
                steps.extend(expand_auto(st, c, used_guide))
            else:
                steps.append(resolve(st))
        for i, s in enumerate(steps, start=1):
            s["id"] = f"{c['id']}-{i:03d}"
            for t in s.get("trainers", []):
                covered_trainers.add(t)
            if s.get("flag"):
                covered_flags.add(s["flag"])
            if s.get("battleGroup"):
                for t in T.values():
                    if t.get("battleGroup") == s["battleGroup"]:
                        covered_trainers.add(t["id"])
        for m in c["maps"]:
            if m not in L:
                raise SystemExit(f"{c['id']}: unknown map {m}")
        chapters.append({"id": c["id"], "n": c["n"], "title": c["title"], "subtitle": c.get("subtitle", ""), "maps": c["maps"], "guidePart": c.get("guidePart", 0), "steps": steps})
    out = os.path.join(DATA, "walkthrough.json")
    json.dump(chapters, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"walkthrough.json: {len(chapters)} chapters, {sum(len(c['steps']) for c in chapters)} steps ({os.path.getsize(out)//1024} KB)")
    # coverage report
    chapter_maps = {m for c in chapters for m in c["maps"]}
    missing_t = [t for t in T.values() if t["maps"] and t.get("rematchOf") is None and t["id"] not in covered_trainers and t["classKey"] not in ("PKMN_TRAINER_UNUSED",)]
    missing_items = [(L[l]["name"], I[b["item"]]["name"]) for l in L for b in L[l]["items"] if b["flag"] not in covered_flags]
    missing_hidden = [(L[l]["name"], I[b["item"]]["name"]) for l in L for b in L[l]["hiddenItems"] if b["flag"] not in covered_flags]
    print(f"coverage: trainers missing {len(missing_t)}, item balls missing {len(missing_items)}, hidden missing {len(missing_hidden)}")
    if "-v" in sys.argv:
        from collections import Counter
        print(" trainers by map:", Counter(L[t["maps"][0]]["name"] for t in missing_t).most_common(40))
        print(" items by map:", Counter(x[0] for x in missing_items).most_common(40))
        print(" hidden by map:", Counter(x[0] for x in missing_hidden).most_common(40))
    maps_with_stuff = {l for l in L if (L[l]["items"] or L[l]["hiddenItems"] or L[l]["trainers"]) and l not in chapter_maps}
    if "-v" in sys.argv:
        print(" maps with content not in any chapter:", sorted(L[l]["name"] for l in maps_with_stuff))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

import json, os, glob, sys
sys.stdout.reconfigure(encoding="utf-8")
D = lambda n: json.load(open(f"public/data/{n}.json", encoding="utf-8"))
P = {p["id"]: p for p in D("pokemon")}; M = {m["id"]: m for m in D("moves")}; I = {i["id"]: i for i in D("items")}
T = {t["id"]: t for t in D("trainers")}; L = {l["id"]: l for l in D("locations")}
def tk(k): return [t for t in T.values() if t["key"] == k][0]
print("BROCK", [(P[m["species"]]["name"], m["level"], [M[x]["name"] for x in m["moves"]]) for m in tk("TRAINER_LEADER_BROCK")["party"]])
print("empty parties", [t["key"] for t in T.values() if not t["party"]][:20])
ben = tk("TRAINER_YOUNGSTER_BEN")
print("BEN", ben["maps"], [(T[r]["key"], [m["level"] for m in T[r]["party"]]) for r in ben.get("rematches", [])])
print("trainers", len(T), "no-map", [t["key"] for t in T.values() if not t["maps"]][:40])
print("route3 trainers", [T[t]["name"] for t in L["MAP_ROUTE3"]["trainers"]])
print("e4", [(t["name"], [P[m["species"]]["name"] for m in t["party"]]) for t in T.values() if t["classKey"] in ("ELITE_FOUR", "CHAMPION")][:12])
print("gyarados bite", M[44]["category"], "psychic", M[94]["category"], "earthquake", M[89]["category"], "seismic toss", M[69]["category"])
print("kadabra evo", P[64]["evolutions"], "golbat", P[42]["evolutions"])
print("item sample", I[13]["name"], I[289]["name"], I[339]["name"], I[339].get("sprite"))
print("tutors", [(L[k]["name"], [M[t["move"]]["name"] for t in L[k]["tutors"]]) for k in L if L[k]["tutors"]])
print("trades", [(P[t["give"]]["name"], P[t["get"]]["name"]) for t in D("trades")])
sp = "scripts/raw/pokeapi-sprites/sprites"
missing = [i["sprite"] for i in I.values() if not os.path.exists(f"{sp}/items/{i['sprite']}.png")]
print("missing item sprites", len(missing), missing)
print("missing mon sprites", [n for n in P if not os.path.exists(f"{sp}/pokemon/versions/generation-iii/firered-leafgreen/{n}.png")][:20])
keys = {i["key"] for i in I.values()}; cnt = 0
for mj in glob.glob("scripts/raw/pokefirered/data/maps/*/map.json"):
    for ev in json.load(open(mj, encoding="utf-8")).get("bg_events", []):
        if ev.get("type") == "hidden_item" and ev["item"] not in keys:
            print("unmatched hidden", mj.split(os.sep)[-2], ev["item"]); cnt += 1
print("unmatched", cnt)
print("gifts", [(g["cmd"], L[g["map"]]["name"], P.get(g.get("species"), {}).get("name") or I.get(g.get("item"), {}).get("name") or g.get("arg")) for g in D("gifts_raw")])
print("battleGroups", sorted({t["battleGroup"] for t in T.values() if t.get("battleGroup")}))
print("sample names", [L[k]["name"] for k in list(L)[:12]], [L[k]["name"] for k in L if "SEVII" in k or "ISLAND" in k][:8])

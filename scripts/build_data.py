"""Build public/data/*.json from the pokefirered decompilation + PokeAPI CSVs.

Run: python scripts/build_data.py
"""
import os, re, json, csv, sys, glob, subprocess
from collections import defaultdict, OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cparse import ROOT, read, defines, enum_values, strings_table, struct_blocks, fields

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
OUT = os.path.join(PROJ, "public", "data")
CSV = os.path.join(HERE, "raw", "pokeapi-csv")
os.makedirs(OUT, exist_ok=True)


def dump(name, obj):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  wrote {name} ({os.path.getsize(path)//1024} KB)")


def csv_rows(name):
    with open(os.path.join(CSV, name + ".csv"), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def clean_flavor(s):
    return re.sub(r"\s+", " ", s.replace("­\n", "").replace("­", "").replace("\n", " ")).strip()


def title(s):
    """'MASTER BALL' -> 'Master Ball' with game-specific fixes."""
    words = s.title().replace("'S", "'s")
    fixes = {"Tm": "TM", "Hm": "HM", "Pp": "PP", "Hp": "HP", "Vs": "VS", "Pc": "PC"}
    out = [fixes.get(w, w) for w in words.split(" ")]
    r = " ".join(out)
    r = re.sub(r"^Tm(\d\d)", r"TM\1", r)
    r = re.sub(r"^Hm(\d\d)", r"HM\1", r)
    r = r.replace("Pokéball", "Poké Ball").replace("Pokemon", "Pokémon").replace("Pokéflute", "Poké Flute")
    r = r.replace("S.S.Anne", "S.S. Anne").replace("Exp.Share", "Exp. Share")
    return r


# ---------------------------------------------------------------- constants
SPECIES = defines("include/constants/species.h")
ITEMS = defines("include/constants/items.h")
MOVES = defines("include/constants/moves.h")
ABILITIES = defines("include/constants/abilities.h")
TYPES = {k: v for k, v in defines("include/constants/pokemon.h").items() if k.startswith("TYPE_")}
TYPE_NAME = {v: k[5:].title() for k, v in TYPES.items()}
TYPE_NAME[TYPES["TYPE_MYSTERY"]] = "???"
OPP = defines("include/constants/opponents.h")
CLASS_NAMES = strings_table("src/data/text/trainer_class_names.h", "TRAINER_CLASS_")
NATDEX = enum_values("include/constants/pokedex.h", "NATIONAL_DEX_NONE")

# TM/HM alias defines: ITEM_TM06_TOXIC -> ITEM_TM06
TM_ALIAS = {}
for m in re.finditer(r"#define\s+(ITEM_(?:TM|HM)\d\d)_([A-Z0-9_]+)\s+(ITEM_(?:TM|HM)\d\d)", read("include/constants/items.h")):
    TM_ALIAS[m.group(1) + "_" + m.group(2)] = (m.group(3), "MOVE_" + m.group(2))
TM_TO_MOVE = {item: move for item, move in TM_ALIAS.values()}

# species internal id -> national dex number
species_to_nat = {}
body = read("src/pokemon.c")
body = body[body.index("sSpeciesToNationalPokedexNum"):]
body = body[body.index("{") + 1: body.index("};")]
for i, m in enumerate(re.finditer(r"SPECIES_TO_NATIONAL\((\w+)\)", body), start=1):
    species_to_nat[i] = NATDEX["NATIONAL_DEX_" + m.group(1)]
SPECIES_BY_ID = {v: k for k, v in SPECIES.items()}
species_const_to_nat = {SPECIES_BY_ID[sid]: nat for sid, nat in species_to_nat.items() if sid in SPECIES_BY_ID}

# pretty names from PokeAPI (english, language 9)
species_pretty = {int(r["pokemon_species_id"]): r["name"] for r in csv_rows("pokemon_species_names") if r["local_language_id"] == "9"}
move_pretty = {int(r["move_id"]): r["name"] for r in csv_rows("move_names") if r["local_language_id"] == "9"}
ability_pretty = {int(r["ability_id"]): r["name"] for r in csv_rows("ability_names") if r["local_language_id"] == "9"}
ability_flavor = {}
for r in csv_rows("ability_flavor_text"):
    if r["language_id"] == "9" and r["version_group_id"] in ("7", "6", "5"):
        ability_flavor.setdefault(int(r["ability_id"]), clean_flavor(r["flavor_text"]))
ability_prose = {int(r["ability_id"]): r["short_effect"] for r in csv_rows("ability_prose") if r["local_language_id"] == "9"}
move_flavor = {}
for r in csv_rows("move_flavor_text"):
    if r["language_id"] == "9" and r["version_group_id"] == "7":
        move_flavor[int(r["move_id"])] = clean_flavor(r["flavor_text"])
move_effect_id = {int(r["id"]): int(r["effect_id"]) for r in csv_rows("moves") if r["effect_id"]}
effect_prose = {int(r["move_effect_id"]): r["short_effect"] for r in csv_rows("move_effect_prose") if r["local_language_id"] == "9"}
move_meta = {int(r["move_id"]): r for r in csv_rows("move_meta")}
meta_cat = {int(r["id"]): r["identifier"] for r in csv_rows("move_meta_categories")}


def slug(name):
    s = name.lower().replace("♀", "-f").replace("♂", "-m").replace("é", "e").replace("'", "").replace(".", "").replace(":", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


PHYSICAL_TYPES = {"Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel"}
FIXED_DAMAGE_EFFECTS = {"EFFECT_OHKO", "EFFECT_LEVEL_DAMAGE", "EFFECT_PSYWAVE", "EFFECT_SONICBOOM", "EFFECT_DRAGON_RAGE", "EFFECT_COUNTER",
                        "EFFECT_MIRROR_COAT", "EFFECT_SUPER_FANG", "EFFECT_ENDEAVOR", "EFFECT_BIDE", "EFFECT_RETURN", "EFFECT_FRUSTRATION",
                        "EFFECT_PRESENT", "EFFECT_MAGNITUDE", "EFFECT_FLAIL", "EFFECT_HIDDEN_POWER", "EFFECT_LOW_KICK", "EFFECT_SPIT_UP",
                        "EFFECT_TRIPLE_KICK", "EFFECT_BEAT_UP", "EFFECT_ERUPTION"}

# ---------------------------------------------------------------- moves
print("moves")
moves = {}
for key, b in struct_blocks(read("src/data/battle_moves.h"), r"MOVE_[A-Z0-9_]+"):
    f = fields(b)
    mid = MOVES[key]
    if mid == 0:
        continue
    t = TYPE_NAME[TYPES[f["type"]]]
    power = int(f["power"])
    if power == 0 and f["effect"] not in FIXED_DAMAGE_EFFECTS:
        cat = "status"
    else:
        cat = "physical" if t in PHYSICAL_TYPES else "special"
    fl = f.get("flags", "0")
    chance = int(f["secondaryEffectChance"])
    moves[mid] = {
        "id": mid, "key": key, "name": move_pretty.get(mid, key[5:].title()), "type": t,
        "power": power, "accuracy": int(f["accuracy"]), "pp": int(f["pp"]), "priority": int(f["priority"]),
        "effectChance": chance, "effect": f["effect"][7:].lower().replace("_", " "),
        "category": cat, "contact": "FLAG_MAKES_CONTACT" in fl, "target": f["target"][12:].lower(),
        "description": move_flavor.get(mid, ""),
        "effectText": effect_prose.get(move_effect_id.get(mid, -1), "").replace("$effect_chance", str(chance)),
    }
    mm = move_meta.get(mid)
    if mm:
        moves[mid]["metaCategory"] = meta_cat.get(int(mm["meta_category_id"]))
        for k in ("min_hits", "max_hits", "min_turns", "max_turns", "drain", "healing", "crit_rate", "ailment_chance", "flinch_chance", "stat_chance"):
            if mm.get(k) not in ("", None, "0"):
                moves[mid][k] = int(mm[k])
MOVE_BY_KEY = {v["key"]: k for k, v in moves.items()}

# ---------------------------------------------------------------- items
print("items")
raw_items = json.load(open(os.path.join(ROOT, "src/data/items.json"), encoding="utf-8"))["items"]
items = {}
for it in raw_items:
    key = it["itemId"]
    iid = ITEMS[key]
    if iid == 0 or it["english"].startswith("????"):
        continue
    name = title(it["english"])
    entry = {"id": iid, "key": key, "name": name, "price": it["price"], "pocket": it["pocket"][7:].lower().replace("_", " "),
             "description": it["description_english"].replace("\\n", " ").replace("\n", " "), "keyItem": bool(it.get("importance"))}
    if it.get("holdEffect", "HOLD_EFFECT_NONE") != "HOLD_EFFECT_NONE":
        entry["holdEffect"] = it["holdEffect"][12:].lower().replace("_", " ")
        entry["holdEffectParam"] = it.get("holdEffectParam", 0)
    if key in TM_TO_MOVE and TM_TO_MOVE[key] in MOVE_BY_KEY:
        mv = MOVE_BY_KEY[TM_TO_MOVE[key]]
        entry["move"] = mv
        entry["name"] = f"{name} {moves[mv]['name']}"
        entry["sprite"] = ("hm-" if key.startswith("ITEM_HM") else "tm-") + moves[mv]["type"].lower()
    else:
        entry["sprite"] = slug(name)
    items[iid] = entry
ITEM_BY_KEY = {v["key"]: k for k, v in items.items()}
# slugs that differ from PokeAPI's item sprite file names
SPRITE_FIX = {"parlyz-heal": "paralyze-heal", "x-defend": "x-defense", "x-special": "x-sp-atk", "energypowder": "energy-powder",
              "s-s-ticket": "ss-ticket", "twistedspoon": "twisted-spoon", "nevermeltice": "never-melt-ice", "blackglasses": "black-glasses",
              "brightpowder": "bright-powder", "silverpowder": "silver-powder", "deepseatooth": "deep-sea-tooth", "deepseascale": "deep-sea-scale",
              "tinymushroom": "tiny-mushroom", "itemfinder": "dowsing-machine", "thunderstone": "thunder-stone"}
for it in items.values():
    it["sprite"] = SPRITE_FIX.get(it["sprite"], it["sprite"])

# ---------------------------------------------------------------- learnsets
print("learnsets")
lvl_sets = {}
for m in re.finditer(r"static const u16 (s\w+LevelUpLearnset)\[\] = \{(.*?)\};", read("src/data/pokemon/level_up_learnsets.h"), re.S):
    lvl_sets[m.group(1)] = [(int(a), MOVE_BY_KEY[b]) for a, b in re.findall(r"LEVEL_UP_MOVE\(\s*(\d+),\s*(MOVE_\w+)\)", m.group(2))]
lvl_ptr = dict(re.findall(r"\[(SPECIES_\w+)\]\s*=\s*(s\w+LevelUpLearnset)", read("src/data/pokemon/level_up_learnset_pointers.h")))
tmhm = {}
txt = read("src/data/pokemon/tmhm_learnsets.h")
for m in re.finditer(r"\[(SPECIES_\w+)\]\s*=\s*TMHM_LEARNSET\((.*?)\),\s*\n", txt, re.S):
    tmhm[m.group(1)] = sorted({ITEM_BY_KEY[TM_ALIAS["ITEM_" + t][0]] for t in re.findall(r"TMHM\((\w+)\)", m.group(2))})
tutor = {}
txt = read("src/data/pokemon/tutor_learnsets.h")
txt = txt[txt.index("sTutorLearnsets"):]
for m in re.finditer(r"\[(SPECIES_\w+)\]\s*=\s*(.*?),\s*\n", txt, re.S):
    tutor[m.group(1)] = sorted({MOVE_BY_KEY[t] for t in re.findall(r"TUTOR\((MOVE_\w+)\)", m.group(2))})
egg = {}
for m in re.finditer(r"egg_moves\((\w+),(.*?)\)", read("src/data/pokemon/egg_moves.h"), re.S):
    egg["SPECIES_" + m.group(1)] = [MOVE_BY_KEY[t] for t in re.findall(r"MOVE_\w+", m.group(2))]
evos = {}
txt = read("src/data/pokemon/evolution.h")
for m in re.finditer(r"\[(SPECIES_\w+)\]\s*=\s*\{(.*?)\}\},", txt, re.S):
    lst = []
    for method, param, to in re.findall(r"\{(EVO_\w+),\s*([^,]+),\s*(SPECIES_\w+)\}", m.group(2) + "}"):
        e = {"method": method[4:].lower(), "to": species_const_to_nat.get(to)}
        param = param.strip()
        if method == "EVO_LEVEL":
            e["level"] = int(param)
        elif method in ("EVO_ITEM", "EVO_TRADE_ITEM"):
            e["item"] = ITEM_BY_KEY[param]
        elif method == "EVO_FRIENDSHIP":
            e["friendship"] = 220
        elif method in ("EVO_FRIENDSHIP_DAY", "EVO_FRIENDSHIP_NIGHT"):
            e["friendship"] = 220
            e["note"] = "FireRed has no clock, so this evolution only works after trading to Ruby/Sapphire/Emerald."
        elif method == "EVO_BEAUTY":
            e["note"] = "Needs max Beauty from Pokéblocks: impossible in FireRed."
        elif method.startswith("EVO_LEVEL_"):
            e["level"] = int(param)
            e["note"] = {"ATK_GT_DEF": "Attack higher than Defense", "ATK_EQ_DEF": "Attack equal to Defense", "ATK_LT_DEF": "Attack lower than Defense",
                         "SILCOON": "50% chance (personality)", "CASCOON": "50% chance (personality)", "NINJASK": "",
                         "SHEDINJA": "Appears too if you have a free party slot and a Poké Ball"}.get(method[10:], "")
        else:
            e["param"] = param
        if method == "EVO_TRADE":
            e["note"] = "Trade-only: needs a link cable and a second game."
        if method == "EVO_TRADE_ITEM":
            e["note"] = "Trade while holding the item: needs a link cable and a second game."
        if not e.get("note"):
            e.pop("note", None)
        lst.append(e)
    evos[m.group(1)] = lst

# ---------------------------------------------------------------- species
print("species")
names_raw = strings_table("src/data/text/species_names.h", "SPECIES_")
dex_text = {}
for m in re.finditer(r"const u8 (g\w+PokedexText)\[\] = _\((.*?)\);", read("src/data/pokemon/pokedex_text_fr.h"), re.S):
    dex_text[m.group(1)] = " ".join(s for s in re.findall(r"\"(.*?)\"", m.group(2))).replace("\\n", " ")
dex_entries = {}
for key, b in struct_blocks(read("src/data/pokemon/pokedex_entries.h"), r"NATIONAL_DEX_\w+"):
    f = fields(b)
    dex_entries[NATDEX[key]] = {"category": title(re.search(r'"(.*?)"', f["categoryName"]).group(1)), "height": int(f["height"]) / 10,
                                "weight": int(f["weight"]) / 10, "text": dex_text.get(f["description"], "")}
growth_names = {"GROWTH_MEDIUM_FAST": "Medium Fast", "GROWTH_ERRATIC": "Erratic", "GROWTH_FLUCTUATING": "Fluctuating",
                "GROWTH_MEDIUM_SLOW": "Medium Slow", "GROWTH_FAST": "Fast", "GROWTH_SLOW": "Slow"}
pokemon = {}
for key, b in struct_blocks(read("src/data/pokemon/species_info.h"), r"SPECIES_\w+"):
    nat = species_const_to_nat.get(key)
    if not nat or nat in pokemon or not (1 <= nat <= 386):
        continue
    f = fields(b)
    if "baseHP" not in f:
        continue
    types = [TYPE_NAME[TYPES[t.strip()]] for t in f["types"].strip("{}").split(",")]
    if types[0] == types[1]:
        types = types[:1]
    ab = [ABILITIES[a.strip()] for a in f["abilities"].strip("{}").split(",")]
    ab = [a for a in ab if a]
    gr = f["genderRatio"]
    if gr == "MON_GENDERLESS":
        female = None
    elif gr == "MON_MALE":
        female = 0
    elif gr == "MON_FEMALE":
        female = 100
    else:
        female = float(re.search(r"[\d.]+", gr).group(0))
    de = dex_entries.get(nat, {})
    pname = species_pretty.get(nat, title(names_raw.get(key, key[8:])))
    p = {
        "id": nat, "key": key, "name": pname, "slug": slug(pname),
        "types": types,
        "stats": {"hp": int(f["baseHP"]), "atk": int(f["baseAttack"]), "def": int(f["baseDefense"]), "spa": int(f["baseSpAttack"]),
                  "spd": int(f["baseSpDefense"]), "spe": int(f["baseSpeed"])},
        "abilities": [{"id": a, "name": ability_pretty.get(a, ""), "text": ability_flavor.get(a) or ability_prose.get(a, "")} for a in ab],
        "catchRate": int(f["catchRate"]), "expYield": int(f["expYield"]), "femaleRatio": female,
        "growth": growth_names.get(f["growthRate"], f["growthRate"]),
        "eggGroups": [g.strip()[10:].title().replace("_", " ") for g in f["eggGroups"].strip("{}").split(",")],
        "baseFriendship": int(f["friendship"]), "eggCycles": int(f["eggCycles"]),
        "category": de.get("category", ""), "height": de.get("height"), "weight": de.get("weight"), "dexText": de.get("text", ""),
        "levelUp": [list(x) for x in lvl_sets.get(lvl_ptr.get(key, ""), [])],
        "tmhm": tmhm.get(key, []), "tutor": tutor.get(key, []), "egg": egg.get(key, []),
        "evolutions": evos.get(key, []),
        "heldItems": [ITEM_BY_KEY[f[k]] for k in ("itemCommon", "itemRare") if f.get(k) and f[k] != "ITEM_NONE" and f[k] in ITEM_BY_KEY],
        "safariFlee": int(f.get("safariZoneFleeRate", 0)),
    }
    if len(set(p["eggGroups"])) == 1:
        p["eggGroups"] = p["eggGroups"][:1]
    pokemon[nat] = p
for p in pokemon.values():
    for e in p["evolutions"]:
        if e["to"]:
            pokemon[e["to"]].setdefault("evolvesFrom", p["id"])
print(f"  {len(pokemon)} species")


def default_moves(nat, level):
    """Gen 3 default trainer moveset: the last four level-up moves learnable at `level`."""
    learned = [m for l, m in pokemon[nat]["levelUp"] if l <= level]
    out = []
    for m in learned:
        if m in out:
            out.remove(m)
        out.append(m)
    return out[-4:]


# ---------------------------------------------------------------- trainers
print("trainers")
party_defs = {}
txt = read("src/data/trainer_parties.h")
for chunk in txt.split("static const struct ")[1:]:
    m = re.match(r"(TrainerMon\w+) (sParty_\w+)\[\] = \{(.*)\};", chunk, re.S)
    if not m:
        continue
    kind, label, body = m.groups()
    mons = []
    for mb in re.findall(r"\{([^{}]*)\}", re.sub(r"\.moves = \{[^}]*\}", lambda x: x.group(0).replace("{", "<").replace("}", ">"), body)):
        f = fields(mb + "\n")
        if "species" not in f:
            continue
        mv = re.search(r"\.moves = <([^>]*)>", mb)
        if mv:
            f["moves"] = mv.group(1)
        mon = {"species": species_const_to_nat[f["species"].strip()], "level": int(f["lvl"]), "iv": int(f["iv"])}
        if "heldItem" in f and f["heldItem"].strip() != "ITEM_NONE":
            mon["item"] = ITEM_BY_KEY[f["heldItem"].strip()]
        if "moves" in f:
            mon["moves"] = [MOVE_BY_KEY[x.strip()] for x in f["moves"].strip("<>").split(",") if x.strip() != "MOVE_NONE"]
        else:
            mon["moves"] = default_moves(mon["species"], mon["level"])
            mon["defaultMoves"] = True
        mons.append(mon)
    party_defs[label] = mons
trainers = {}
for key, b in struct_blocks(read("src/data/trainers.h"), r"TRAINER_[A-Z0-9_]+"):
    f = fields(b)
    tid = OPP[key]
    if tid == 0 or "party" not in f:
        continue
    pm = re.search(r"\((sParty_\w+)\)", f["party"])
    cls = f["trainerClass"]
    trainers[tid] = {
        "id": tid, "key": key, "class": title(CLASS_NAMES.get(cls, cls[14:])), "classKey": cls[14:],
        "name": title(re.search(r'"(.*?)"', f["trainerName"]).group(1)),
        "pic": f["trainerPic"][12:].lower(), "double": f.get("doubleBattle", "FALSE") == "TRUE",
        "items": [ITEM_BY_KEY[x.strip()] for x in f.get("items", "{}").strip("{}").split(",") if x.strip() and x.strip() != "ITEM_NONE"],
        "party": party_defs.get(pm.group(1) if pm else "", []),
        "female": "F_TRAINER_FEMALE" in f.get("encounterMusic_gender", ""),
        "maps": [],
    }
TRAINER_BY_KEY = {v["key"]: k for k, v in trainers.items()}
# Vs Seeker rematch chains
txt = read("src/vs_seeker.c")
txt = txt[txt.index("sRematches[]"):]
txt = txt[: txt.index("};")]
for m in re.finditer(r"\{\s*\{([^}]*)\}\s*,\s*MAP\((MAP_\w+)\)", txt):
    chain = list(OrderedDict.fromkeys(re.findall(r"TRAINER_\w+", m.group(1))))
    base = chain[0]
    for i, t in enumerate(chain[1:], start=1):
        if t in TRAINER_BY_KEY and base in TRAINER_BY_KEY:
            trainers[TRAINER_BY_KEY[t]]["rematchOf"] = TRAINER_BY_KEY[base]
            trainers[TRAINER_BY_KEY[t]]["rematchTier"] = i
            trainers[TRAINER_BY_KEY[base]].setdefault("rematches", []).append(TRAINER_BY_KEY[t])
# rival / champion variants keyed by the rival's starter
STARTER_OF = {"BULBASAUR": 1, "CHARMANDER": 4, "SQUIRTLE": 7}
for t in trainers.values():
    m = re.match(r"TRAINER_(RIVAL_\w+?|CHAMPION_FIRST|CHAMPION_REMATCH)_(BULBASAUR|CHARMANDER|SQUIRTLE)$", t["key"])
    if m:
        t["battleGroup"] = m.group(1).lower().replace("_", "-")
        t["rivalStarter"] = STARTER_OF[m.group(2)]
print(f"  {len(trainers)} trainers")

# ---------------------------------------------------------------- maps / locations
print("maps")
mapsec = {s["id"]: s.get("name", s["id"]) for s in json.load(open(os.path.join(ROOT, "src/data/region_map/region_map_sections.json"), encoding="utf-8"))["map_sections"]}
ball_scripts = dict(re.findall(r"(\w+)::\s*\n\s*finditem (ITEM_\w+)", read("data/scripts/item_ball_scripts.inc")))
tutor_scripts = {}
for m in re.finditer(r"(\w+Tutor)::.*?setvar VAR_0x8005, MOVETUTOR_(\w+)", read("data/scripts/move_tutors.inc"), re.S):
    tutor_scripts[m.group(1)] = m.group(2)
# script label -> first trainer it battles (shared trainers.inc + every map's scripts.inc)
label_trainer = {}
for inc in [os.path.join(ROOT, "data/scripts/trainers.inc")] + glob.glob(os.path.join(ROOT, "data/maps/*/scripts.inc")):
    text = open(inc, encoding="utf-8").read()
    for block in re.split(r"\n(?=\w+::)", text):
        lm = re.match(r"(\w+)::", block)
        tm = re.search(r"trainerbattle_\w+ (TRAINER_\w+)", block)
        if lm and tm:
            label_trainer.setdefault(lm.group(1), tm.group(1))


def camel_words(s):
    s = re.sub(r"([a-z])([A-Z0-9])", r"\1 \2", s)
    s = re.sub(r"([A-Z])([A-Z][a-z])", r"\1 \2", s)
    return s


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def display_name(folder, sec):
    secname = title(sec)
    words = [camel_words(p).replace("Pokemon", "Pokémon") for p in folder.split("_")]
    key = norm(secname)
    before, after, hit = [], [], False
    for w in words:
        if not hit and norm(w) == key:
            hit = True
            continue
        (after if hit else before).append(w)
    if not hit:
        # folder does not mention the section: "FiveIsland_WaterLabyrinth" under MAPSEC_WATER_LABYRINTH
        before, after = [], words[1:] if norm(words[0]) in key or key in norm(words[0]) else words
        if words and norm(words[0]) != key and not (norm(words[0]) in key or key in norm(words[0])):
            before = [words[0]]
            after = words[1:]
            if after and norm(after[0]) == key:
                after = after[1:]
    name = secname
    if before:
        name = f"{' '.join(before)} – {name}"
    if after:
        name = f"{name} – {' '.join(after)}"
    return name


encounters_raw = json.load(open(os.path.join(ROOT, "src/data/wild_encounters.json"), encoding="utf-8"))["wild_encounter_groups"][0]
rate_tables = {f["type"]: f for f in encounters_raw["fields"]}
enc_by_map = {}


def aggregate(slots, idxs, rates):
    agg = OrderedDict()
    for i in idxs:
        s = slots[i]
        nat = species_const_to_nat[s["species"]]
        a = agg.setdefault(nat, {"species": nat, "rate": 0, "min": s["min_level"], "max": s["max_level"]})
        a["rate"] += rates[i]
        a["min"] = min(a["min"], s["min_level"])
        a["max"] = max(a["max"], s["max_level"])
    return list(agg.values())


for e in encounters_raw["encounters"]:
    if "FireRed" not in e["base_label"]:
        continue
    out = {}
    for kind, label in (("land_mons", "grass"), ("water_mons", "surf"), ("rock_smash_mons", "rock-smash"), ("fishing_mons", "fishing")):
        if kind not in e:
            continue
        rates = rate_tables[kind]["encounter_rates"]
        slots = e[kind]["mons"]
        if kind == "fishing_mons":
            for rod, idxs in rate_tables[kind]["groups"].items():
                out[rod.replace("_", "-")] = aggregate(slots, idxs, rates)
        else:
            out[label] = aggregate(slots, range(len(slots)), rates)
            out[label + "Rate"] = e[kind]["encounter_rate"]
    enc_by_map[e["map"]] = out

locations = {}
gifts = []
for mj in sorted(glob.glob(os.path.join(ROOT, "data/maps/*/map.json"))):
    m = json.load(open(mj, encoding="utf-8"))
    folder = os.path.basename(os.path.dirname(mj))
    sec = m["region_map_section"]
    scripts_path = os.path.join(os.path.dirname(mj), "scripts.inc")
    scr = open(scripts_path, encoding="utf-8").read() if os.path.exists(scripts_path) else ""
    secname = mapsec.get(sec, sec[7:].replace("_", " "))
    loc = {
        "id": m["id"], "key": folder, "section": sec, "sectionName": title(secname),
        "name": display_name(folder, secname), "type": m["map_type"][9:].lower(),
        "connections": [{"map": c["map"], "dir": c["direction"]} for c in (m.get("connections") or [])],
        "warps": sorted({w["dest_map"] for w in m.get("warp_events", []) if w["dest_map"] != m["id"]}),
        "items": [], "hiddenItems": [], "trainers": [], "shops": [], "tutors": [], "encounters": enc_by_map.get(m["id"], {}),
    }
    seen = []

    def add_trainer(k):
        if k in TRAINER_BY_KEY and k not in seen:
            seen.append(k)
            loc["trainers"].append(TRAINER_BY_KEY[k])
            trainers[TRAINER_BY_KEY[k]]["maps"].append(m["id"])

    for ev in m.get("object_events", []):
        if ev.get("graphics_id") == "OBJ_EVENT_GFX_ITEM_BALL":
            ik = ball_scripts.get(ev["script"])
            if ik and ik in ITEM_BY_KEY:
                loc["items"].append({"item": ITEM_BY_KEY[ik], "x": ev["x"], "y": ev["y"], "flag": ev.get("flag")})
        sc = ev.get("script", "")
        tut = tutor_scripts.get(sc)
        if not tut:
            g = re.search(re.escape(sc) + r"::\s*\n\s*goto (\w+Tutor)", scr) if sc else None
            if g:
                tut = tutor_scripts.get(g.group(1))
        if tut:
            mk = "MOVE_" + tut
            if mk in MOVE_BY_KEY:
                loc["tutors"].append({"move": MOVE_BY_KEY[mk], "x": ev["x"], "y": ev["y"]})
        if sc in label_trainer:
            add_trainer(label_trainer[sc])
    for tl in re.findall(r"(?:goto|call|goto_if_\w+ \w+, \w+,) (\w+Tutor)\b", scr):
        if tl in tutor_scripts and "MOVE_" + tutor_scripts[tl] in MOVE_BY_KEY and not any(t["move"] == MOVE_BY_KEY["MOVE_" + tutor_scripts[tl]] for t in loc["tutors"]):
            loc["tutors"].append({"move": MOVE_BY_KEY["MOVE_" + tutor_scripts[tl]]})
    for ev in m.get("bg_events", []):
        if ev.get("type") == "hidden_item" and ev["item"] in ITEM_BY_KEY:
            loc["hiddenItems"].append({"item": ITEM_BY_KEY[ev["item"]], "x": ev["x"], "y": ev["y"], "qty": ev.get("quantity", 1),
                                       "flag": ev.get("flag"), "underfoot": bool(ev.get("underfoot"))})
    for tm in re.finditer(r"trainerbattle_(\w+) (TRAINER_\w+)", scr):
        add_trainer(tm.group(2))
    for sm in re.finditer(r"pokemart (\w+)", scr):
        lst = re.search(re.escape(sm.group(1)) + r"::\s*\n((?:\s*\.2byte ITEM_\w+\s*\n)+)", scr)
        if lst:
            its = [ITEM_BY_KEY[x] for x in re.findall(r"\.2byte (ITEM_\w+)", lst.group(1)) if x in ITEM_BY_KEY]
            if its and its not in loc["shops"]:
                loc["shops"].append(its)
    for gm in re.finditer(r"^\s*(givemon|giveegg|setwildbattle|giveitem|additem) ([A-Z_0-9]+)(?:, *(\d+))?", scr, re.M):
        cmd, arg, lvl = gm.groups()
        rec = {"map": m["id"], "cmd": cmd}
        if arg in species_const_to_nat:
            rec["species"] = species_const_to_nat[arg]
        elif arg in ITEM_BY_KEY:
            rec["item"] = ITEM_BY_KEY[arg]
        else:
            rec["arg"] = arg
        if lvl:
            rec["level"] = int(lvl)
        gifts.append(rec)
    locations[m["id"]] = loc
# rematch trainers inherit their base trainer's map
for t in trainers.values():
    if t.get("rematchOf") is not None and not t["maps"]:
        t["maps"] = list(trainers[t["rematchOf"]]["maps"])
# drop Ruby/Sapphire leftovers and unused placeholders (no map, no party, or not reachable)
for tid in list(trainers):
    t = trainers[tid]
    if not t["maps"] and not t.get("battleGroup") and t.get("rematchOf") is None:
        del trainers[tid]
    elif not t["party"]:
        del trainers[tid]
for loc in locations.values():
    loc["trainers"] = [x for x in loc["trainers"] if x in trainers]
for t in trainers.values():
    if "rematches" in t:
        t["rematches"] = [r for r in t["rematches"] if r in trainers]
# species -> encounter locations
for mid, enc in enc_by_map.items():
    for method, lst in enc.items():
        if method.endswith("Rate"):
            continue
        for e in lst:
            pokemon[e["species"]].setdefault("locations", []).append({"map": mid, "method": method, "rate": e["rate"], "min": e["min"], "max": e["max"]})
for rec in gifts:
    if "species" in rec and rec["cmd"] in ("givemon", "giveegg", "setwildbattle"):
        method = {"givemon": "gift", "giveegg": "egg", "setwildbattle": "static"}[rec["cmd"]]
        pokemon[rec["species"]].setdefault("locations", []).append({"map": rec["map"], "method": method, "rate": 100, "min": rec.get("level", 5), "max": rec.get("level", 5)})
# in-game trades
trades = []
txt = read("src/data/ingame_trades.h")
txt = re.sub(r"#if defined\(FIRERED\)(.*?)#else.*?#endif", r"\1", txt, flags=re.S)
for key, b in struct_blocks(txt, r"INGAME_TRADE_\w+"):
    f = fields(b)
    trades.append({"key": key, "give": species_const_to_nat[f["requestedSpecies"].strip()], "get": species_const_to_nat[f["species"].strip()],
                   "nickname": re.search(r'"(.*?)"', f["nickname"]).group(1), "item": ITEM_BY_KEY.get(f.get("heldItem", "").strip())})
n_balls = sum(len(l["items"]) for l in locations.values())
n_hidden = sum(len(l["hiddenItems"]) for l in locations.values())
print(f"  {len(locations)} maps, {n_balls} item balls, {n_hidden} hidden items, {len(gifts)} gift/static records, {len(trades)} trades")

# ---------------------------------------------------------------- type chart (Gen 3)
order = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel"]
eff = defaultdict(dict)
type_ids = {int(r["id"]): r["identifier"].title() for r in csv_rows("types")}
for r in csv_rows("type_efficacy"):
    a, d = type_ids[int(r["damage_type_id"])], type_ids[int(r["target_type_id"])]
    if a in order and d in order:
        eff[a][d] = int(r["damage_factor"]) / 100
# Gen 3 differences from the modern chart: Steel resists Ghost and Dark
eff["Ghost"]["Steel"] = 0.5
eff["Dark"]["Steel"] = 0.5
chart = {"types": order, "effectiveness": {a: {d: eff[a].get(d, 1) for d in order} for a in order}}

# ---------------------------------------------------------------- write
commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
dump("pokemon.json", [pokemon[i] for i in sorted(pokemon)])
dump("moves.json", [moves[i] for i in sorted(moves)])
dump("items.json", [items[i] for i in sorted(items)])
dump("trainers.json", [trainers[i] for i in sorted(trainers)])
dump("locations.json", [locations[k] for k in sorted(locations)])
dump("typechart.json", chart)
dump("trades.json", trades)
dump("gifts_raw.json", gifts)
# event flags the app can read back from a .sav: item balls, hidden items, gifts, badges, story beats
from cparse import defines_eval
all_flags = defines_eval("include/constants/flags.h", seed=OPP)
used = {b["flag"] for l in locations.values() for b in l["items"] + l["hiddenItems"]}
ENCOUNTER_FLAGS = {"FLAG_HIDE_ROUTE_12_SNORLAX", "FLAG_HIDE_ROUTE_16_SNORLAX", "FLAG_HIDE_MOLTRES", "FLAG_HIDE_ZAPDOS", "FLAG_HIDE_ARTICUNO", "FLAG_HIDE_MEWTWO",
                   "FLAG_HIDE_POWER_PLANT_ELECTRODE_1", "FLAG_HIDE_POWER_PLANT_ELECTRODE_2"}
flags_out = {k: v for k, v in all_flags.items() if k in used or k in ENCOUNTER_FLAGS or k.startswith(("FLAG_GOT_", "FLAG_BADGE", "FLAG_BEAT_", "FLAG_DEFEATED_", "FLAG_SYS_", "FLAG_RESCUED_", "FLAG_OAK_", "FLAG_DELIVERED_", "FLAG_FOUGHT_", "FLAG_WOKE_UP_"))}
trainer_flags_start = all_flags.get("TRAINER_FLAGS_START", 0x500)
print(f"  {len(flags_out)} event flags exported (trainer flags start at {hex(trainer_flags_start)})")

species_map = [0] * (max(species_to_nat) + 1)
for sid, nat in species_to_nat.items():
    species_map[sid] = nat if 1 <= nat <= 386 else 0
dump("meta.json", {"source": "pret/pokefirered", "commit": commit, "speciesMap": species_map, "flags": flags_out, "trainerFlagsStart": trainer_flags_start,
                   "flagsCount": all_flags.get("FLAGS_COUNT", 0x900),
                   "counts": {"pokemon": len(pokemon), "moves": len(moves), "items": len(items), "trainers": len(trainers), "maps": len(locations),
                              "itemBalls": n_balls, "hiddenItems": n_hidden}})
print("DONE")

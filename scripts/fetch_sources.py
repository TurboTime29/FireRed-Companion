"""Download Bulbapedia walkthrough wikitext (21 parts) and PokeAPI CSVs into scripts/raw/."""
import json, os, sys, time, urllib.request, urllib.parse

RAW = os.path.join(os.path.dirname(__file__), "raw")
UA = {"User-Agent": "firered-companion-builder/0.1 (personal project; kash6747@gmail.com)"}

def get(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:
            print("  retry", i, url, e, file=sys.stderr)
            time.sleep(2 + 2 * i)
    raise SystemExit("failed: " + url)

def bulba_wikitext(title):
    q = urllib.parse.urlencode({"action": "parse", "page": title, "prop": "wikitext", "format": "json", "formatversion": 2})
    data = json.loads(get("https://bulbapedia.bulbagarden.net/w/api.php?" + q))
    if "error" in data:
        raise SystemExit(f"bulbapedia error for {title}: {data['error']}")
    return data["parse"]["wikitext"]

def main():
    out = os.path.join(RAW, "bulbapedia")
    for part in range(1, 21):
        path = os.path.join(out, f"part-{part:02d}.wikitext")
        if os.path.exists(path):
            continue
        title = f"Walkthrough:Pokémon FireRed and LeafGreen/Part {part}"
        print("fetching", title)
        open(path, "w", encoding="utf-8").write(bulba_wikitext(title))
        time.sleep(1)
    csvs = ["moves", "move_flavor_text", "move_effect_prose", "move_names", "move_meta", "move_meta_categories",
            "move_meta_ailments", "item_names", "item_flavor_text", "pokemon_species_names", "types", "type_efficacy",
            "abilities", "ability_names", "ability_flavor_text", "ability_prose", "pokemon_species", "pokemon_species_flavor_text",
            "natures", "nature_names", "stats", "growth_rates", "encounter_methods", "locations", "location_names", "location_areas"]
    base = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/"
    for name in csvs:
        path = os.path.join(RAW, "pokeapi-csv", name + ".csv")
        if os.path.exists(path):
            continue
        print("fetching csv", name)
        open(path, "wb").write(get(base + name + ".csv"))
    print("FETCH_DONE")

if __name__ == "__main__":
    main()

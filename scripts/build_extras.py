"""Small extra datasets: Game Corner prizes (FireRed branch) and the ability list. Writes public/data/extras.json."""
import json, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / 'scripts/raw/pokefirered'
pokemon = json.load(open(ROOT / 'public/data/pokemon.json', encoding='utf-8'))
items = json.load(open(ROOT / 'public/data/items.json', encoding='utf-8'))
item_by_key = {i['key']: i['id'] for i in items}
species_by_name = {p['name'].upper().replace(' ', '_').replace('.', '').replace("'", ''): p['id'] for p in pokemon}


def prizes(path):
    txt = open(path, encoding='utf-8').read()
    # keep only the FireRed branch of ".ifdef FIRERED ... .else .ifdef LEAFGREEN ... .endif .endif" blocks
    txt = re.sub(r'\.else\s*\n\s*\.ifdef LEAFGREEN.*?\.endif\s*\n\s*\.endif', '', txt, flags=re.S)
    out = []
    for m in re.finditer(r'setvar VAR_TEMP_1, (SPECIES_\w+|ITEM_\w+)\s*\n\s*setvar VAR_TEMP_2, (\d+)', txt):
        k, cost = m.group(1), int(m.group(2))
        if k.startswith('SPECIES_'):
            out.append({'kind': 'pokemon', 'id': species_by_name.get(k[8:]), 'key': k, 'coins': cost})
        else:
            out.append({'kind': 'item', 'id': item_by_key.get(k), 'key': k, 'coins': cost})
    return out


gc = prizes(RAW / 'data/maps/CeladonCity_GameCorner_PrizeRoom/scripts.inc')
abilities = {}
for p in pokemon:
    for a in p['abilities']:
        abilities.setdefault(a['id'], {'id': a['id'], 'name': a['name'], 'text': a['text'], 'pokemon': []})['pokemon'].append(p['id'])
json.dump({'gameCorner': gc, 'abilities': sorted(abilities.values(), key=lambda a: a['name'])}, open(ROOT / 'public/data/extras.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('game corner:', [(e['key'], e['id'], e['coins']) for e in gc])
print('abilities:', len(abilities))

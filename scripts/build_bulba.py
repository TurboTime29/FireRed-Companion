"""Parse the 20 Bulbapedia walkthrough parts (wikitext) into public/data/guide.json.

Content is CC BY-NC-SA 2.5 (https://bulbapedia.bulbagarden.net). The app shows attribution.
Output shape:
  [{part, title, sections:[{id, heading, level, prose:[str], items:[{name, where, hidden}],
                             trainers:[{cls, name, party:[{name, level}]}], catches:[{dex, name, method, levels, rate, fr, lg}],
                             shops:[{name, items:[{name, price}]}]}]}]
"""
import os, re, json, html, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw", "bulbapedia")
OUT = os.path.join(os.path.dirname(HERE), "public", "data")


def split_params(s):
    """Split template params on | while respecting nested {{ }} and [[ ]]."""
    out, depth, cur = [], 0, ""
    i = 0
    while i < len(s):
        two = s[i:i + 2]
        if two in ("{{", "[["):
            depth += 1; cur += two; i += 2; continue
        if two in ("}}", "]]"):
            depth -= 1; cur += two; i += 2; continue
        if s[i] == "|" and depth == 0:
            out.append(cur); cur = ""; i += 1; continue
        cur += s[i]; i += 1
    out.append(cur)
    return out


def find_templates(text, name):
    """Yield (start, end, params) for every {{name|...}} (case-insensitive), brace-balanced."""
    pat = re.compile(r"\{\{" + name + r"\s*(\||\}\})", re.I)
    for m in pat.finditer(text):
        i = m.start()
        depth, j = 0, i
        while j < len(text):
            if text.startswith("{{", j):
                depth += 2 if False else 1; j += 2; continue
            if text.startswith("}}", j):
                depth -= 1; j += 2
                if depth == 0:
                    break
                continue
            j += 1
        inner = text[i + 2:j - 2]
        yield i, j, split_params(inner)[1:]


TEMPLATE_TEXT = {
    "p": lambda a: a[0], "m": lambda a: a[0], "i": lambda a: a[0], "t": lambda a: a[0], "type": lambda a: a[0] + "-type",
    "ka": lambda a: a[-1], "ga": lambda a: a[-1] if len(a) > 1 else a[0], "a": lambda a: a[-1], "DL": lambda a: a[-1],
    "tt": lambda a: a[0], "rt": lambda a: "Route " + a[0], "wp": lambda a: a[-1], "bp": lambda a: a[-1],
    "TM": lambda a: f"TM{a[0]} {a[1]}" if len(a) > 1 else f"TM{a[0]}", "HM": lambda a: f"HM{a[0]} {a[1]}" if len(a) > 1 else f"HM{a[0]}",
    "pdollar": lambda a: "$", "PDollar": lambda a: "$", "player": lambda a: "you", "OBP": lambda a: a[0],
    "stat": lambda a: a[0], "status": lambda a: a[0], "badge": lambda a: a[0] + " Badge", "key": lambda a: a[0],
    "game": lambda a: "Pokémon " + a[0], "game2": lambda a: a[0], "sup/3": lambda a: "", "sup/1": lambda a: "", "sup/2": lambda a: "",
    "color": lambda a: a[-1] if len(a) > 1 else "", "colour": lambda a: a[-1] if len(a) > 1 else "", "wp": lambda a: a[-1],
    "PlayerChoice": lambda a: " / ".join(a), "sign": lambda a: " ".join(a) if a else "", "Pokémon": lambda a: "Pokémon",
    "Pok": lambda a: "Pokémon", "v2": lambda a: a[0], "v": lambda a: a[0], "cat": lambda a: "", "an": lambda a: a[0],
}


def strip_markup(s):
    """Wikitext -> plain text."""
    prev = None
    while prev != s:
        prev = s
        # innermost templates first
        def repl(m):
            parts = split_params(m.group(1))
            name = parts[0].strip()
            args = [p.split("=", 1)[1] if "=" in p and not p.strip().startswith("http") else p for p in parts[1:]]
            fn = TEMPLATE_TEXT.get(name) or TEMPLATE_TEXT.get(name.lower())
            if name.lower() in ("sc",):
                return args[0] if args else ""
            if fn:
                try:
                    return fn(args)
                except Exception:
                    return args[0] if args else ""
            if name.lower().startswith("pokémon") or name.lower().startswith("pok"):
                return "Pokémon"
            return ""
        s = re.sub(r"\{\{([^{}]*)\}\}", repl, s)
    s = re.sub(r"\[\[File:[^\]]*\]\]", "", s, flags=re.I)
    s = re.sub(r"\[\[([^\]|]*)\|([^\]]*)\]\]", r"\2", s)
    s = re.sub(r"\[\[([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"\[https?://[^\s\]]+ ([^\]]*)\]", r"\1", s)
    s = re.sub(r"<sc>(.*?)</sc>", r"\1", s)
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("'''", "").replace("''", "")
    s = html.unescape(s)
    s = re.sub(r"[ \t]+", " ", s).strip()
    return s


def parse_items(text):
    out = []
    for _, _, params in find_templates(text, "Itemlist"):
        if len(params) < 2:
            continue
        name = strip_markup(params[0])
        where = params[1]
        kv = {p.split("=", 1)[0].strip(): p.split("=", 1)[1] for p in params[2:] if "=" in p}
        fr = kv.get("FR", "yes").strip().lower() != "no"
        display = strip_markup(kv["display"]) if "display" in kv else name
        if not fr:
            continue
        lines = [l.strip(" *") for l in where.split("\n") if l.strip(" *")]
        if not lines:
            lines = [""]
        for l in lines:
            hidden = "hidden" in l.lower()
            out.append({"name": name, "display": display, "where": strip_markup(re.sub(r"''\(hidden\)''|\(hidden\)", "", l, flags=re.I)).strip(", "), "hidden": hidden})
    return out


def parse_trainers(text):
    out = []
    for _, _, p in find_templates(text, "Trainerentry"):
        p = [x for x in p if "=" not in x.split("|")[0][:12]]
        if len(p) < 5:
            continue
        cls, name, money, count = strip_markup(p[1]), strip_markup(p[2]), p[3], p[4]
        party = []
        i = 5
        while i + 4 < len(p) + 1 and i + 3 < len(p):
            dex, mon, gender, lvl = p[i], p[i + 1], p[i + 2], p[i + 3]
            if re.fullmatch(r"\d{3}", dex.strip()):
                party.append({"dex": int(dex), "name": strip_markup(mon), "level": int(re.sub(r"\D", "", lvl) or 0)})
            i += 5
        out.append({"cls": cls, "name": name, "party": party})
    return out


def parse_catches(text):
    out = []
    for _, _, p in find_templates(text, "Catch/entryfl"):
        if len(p) < 7:
            continue
        kv = {x.split("=", 1)[0].strip(): x.split("=", 1)[1] for x in p if "=" in x}
        pos = [x for x in p if "=" not in x]
        if len(pos) < 7:
            continue
        out.append({"dex": int(re.sub(r"\D", "", pos[0]) or 0), "name": strip_markup(pos[1]), "fr": pos[2].strip().lower() == "yes",
                    "lg": pos[3].strip().lower() == "yes", "method": strip_markup(pos[4]), "levels": strip_markup(pos[5]), "rate": strip_markup(pos[6])})
    return out


def parse_shops(text):
    out = []
    for s, e, p in find_templates(text, "shop"):
        name = strip_markup(p[0]) if p else "Shop"
        block = text[e:]
        end = block.find("{{shopfooter}}")
        block = block[: end if end >= 0 else 2000]
        items = []
        for _, _, q in find_templates(block, "shopitem"):
            if len(q) >= 2:
                items.append({"name": strip_markup(q[0]), "price": int(re.sub(r"\D", "", q[1]) or 0)})
        if items:
            out.append({"name": name, "items": items})
    return out


def remove_tables(text):
    """Drop {| ... |} tables (nested) from prose."""
    out, depth, i = "", 0, 0
    while i < len(text):
        if text.startswith("{|", i):
            depth += 1; i += 2; continue
        if text.startswith("|}", i) and depth:
            depth -= 1; i += 2; continue
        if depth == 0:
            out += text[i]
        i += 1
    return out


def prose_paragraphs(text):
    t = remove_tables(text)
    # remove remaining data templates that are not prose
    for name in ("Itemlist", "Itlisth", "Itlistfoot", "Trainerheader", "Trainerentry", "Trainerdiv", "Trainerfooter", "Catch/header", "Catch/entryfl",
                 "Catch/div", "Catch/footer", "shop", "shoprow", "shopfooter", "Party", "Party/end", "WalkthroughNotice", "WalkthroughPrevNext",
                 "Project Walkthroughs notice", "Sevii Islands", "roundy", "locationcolor/light", "locationcolor/med"):
        for s, e, _ in sorted(find_templates(t, re.escape(name)), reverse=True):
            t = t[:s] + t[e:]
    t = re.sub(r"\{\{Party/(?:Header|Footer|Div|Pokémon|Pokemon)\|.*?\}\}", "", t, flags=re.S)
    paras = []
    for block in re.split(r"\n\s*\n", t):
        b = block.strip()
        if not b or b.startswith("{{") and b.endswith("}}") and "\n" not in b and "|" in b and b.count("{{") == 1 and len(b) < 60:
            continue
        lines = []
        for line in b.split("\n"):
            line = line.strip()
            if not line or line.startswith("|") or line.startswith("!") or line.startswith("{|") or line.startswith("[[File:") or line.startswith("[[Category"):
                continue
            if line.startswith("*") or line.startswith("#"):
                line = "• " + line.lstrip("*# ")
            lines.append(strip_markup(line))
        p = " ".join(l for l in lines if l)
        p = re.sub(r"\s+", " ", p).strip()
        if len(p) > 1 and not p.startswith("Category:") and not p.startswith("FRLG header") and not p.startswith("header "):
            paras.append(p)
    return paras


def parse_part(n, text):
    sections = []
    title = re.search(r"^==\s*([^=]+?)\s*==", text, re.M)
    chunks = re.split(r"^(={2,4})\s*([^=\n]+?)\s*\1\s*$", text, flags=re.M)
    # chunks: [pre, eq, heading, body, eq, heading, body, ...]
    idx = 0
    for i in range(1, len(chunks), 3):
        level = len(chunks[i])
        heading = strip_markup(chunks[i + 1])
        body = chunks[i + 2]
        idx += 1
        sections.append({
            "id": f"p{n:02d}-s{idx:02d}", "heading": heading, "level": level,
            "prose": prose_paragraphs(body), "items": parse_items(body), "trainers": parse_trainers(body),
            "catches": parse_catches(body), "shops": parse_shops(body),
        })
    return {"part": n, "title": title.group(1) if title else f"Part {n}", "sections": sections}


def main():
    parts = []
    for n in range(1, 21):
        path = os.path.join(RAW, f"part-{n:02d}.wikitext")
        parts.append(parse_part(n, open(path, encoding="utf-8").read()))
    path = os.path.join(OUT, "guide.json")
    json.dump(parts, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    tot = lambda k: sum(len(s[k]) for p in parts for s in p["sections"])
    print(f"guide.json: {len(parts)} parts, {sum(len(p['sections']) for p in parts)} sections, {tot('prose')} paragraphs, {tot('items')} item entries, {tot('trainers')} trainers, {tot('catches')} catch rows, {tot('shops')} shops ({os.path.getsize(path)//1024} KB)")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

"""Small helpers for pulling data out of the pokefirered C sources."""
import os, re, json

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw", "pokefirered")

def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()

_DEF = re.compile(r"^#define\s+([A-Z0-9_]+)\s+(\(?-?\d+\)?|0x[0-9A-Fa-f]+)\s*$", re.M)

def defines(rel):
    """name -> int for simple numeric #defines."""
    out = {}
    for m in _DEF.finditer(read(rel)):
        v = m.group(2).strip("()")
        out[m.group(1)] = int(v, 0)
    return out

def defines_eval(rel, seed=None):
    """name -> int for #defines whose value is an integer expression over earlier defines (e.g. (SYS_FLAGS + 0x20))."""
    env = dict(seed or {})
    for m in re.finditer(r"^#define\s+(\w+)\s+(.+?)\s*(?://.*)?$", read(rel), re.M):
        name, expr = m.group(1), m.group(2)
        expr = re.sub(r"/\*.*?\*/", "", expr).strip()
        if not re.fullmatch(r"[A-Za-z0-9_\s+\-*()<>|]+", expr):
            continue
        try:
            env[name] = int(eval(expr, {"__builtins__": {}}, env))
        except Exception:
            pass
    return env


def enum_values(rel, first_name):
    """Assign sequential ints to an enum starting at the line containing first_name (value 0 for the enum's first item)."""
    text = read(rel)
    start = text.index("enum")
    body = text[start:]
    body = body[body.index("{") + 1: body.index("};")]
    body = re.sub(r"//.*", "", body)
    body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)
    out, i = {}, 0
    for tok in body.split(","):
        tok = tok.strip()
        if not tok:
            continue
        if "=" in tok:
            name, val = [t.strip() for t in tok.split("=")]
            i = int(val, 0)
        else:
            name = tok
        out[name] = i
        i += 1
    return out

def strings_table(rel, key_prefix):
    """[KEY] = _("STRING") -> dict."""
    out = {}
    for m in re.finditer(r"\[(" + key_prefix + r"[A-Z0-9_]+)\]\s*=\s*_\(\"([^\"]*)\"\)", read(rel)):
        out[m.group(1)] = m.group(2)
    return out

def struct_blocks(text, key_re):
    """Yield (key, body) for `[KEY] = { ... }` blocks (brace-balanced)."""
    for m in re.finditer(r"\[(" + key_re + r")\]\s*=\s*", text):
        i = m.end()
        if text[i] != "{":
            continue
        depth, j = 0, i
        while True:
            c = text[j]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        yield m.group(1), text[i + 1:j]

def fields(body):
    """.name = value, -> dict (values kept as raw strings)."""
    out = {}
    for m in re.finditer(r"\.(\w+)\s*=\s*([^,]+?(?:\{[^}]*\})?[^,]*?),?\s*\n", body + "\n"):
        out[m.group(1)] = m.group(2).strip()
    return out

def pretty_const(name, prefix):
    """SPECIES_MR_MIME -> Mr. Mime style fallback; used only where no better name exists."""
    s = name[len(prefix):].lower().replace("_", " ")
    return s.title()

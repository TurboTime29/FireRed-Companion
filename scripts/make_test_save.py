"""Generate a synthetic but structurally valid FireRed .sav (128 KB) for testing the importer.

Party: Charmeleon Lv.20 (nickname FLAME, Ember/Scratch/Growl/Metal Claw, holding Oran Berry), Pidgey Lv.9. Box 1: Rattata Lv.4.
Badges: Boulder + Cascade. Money 12345. Dex: seen/caught bits for those species. Player name RED, TID 12345, SID 54321.
Writes scripts/fixtures/test.sav
"""
import os, struct, json
BROCK = next(t["id"] for t in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data", "trainers.json"), encoding="utf-8")) if t["key"] == "TRAINER_LEADER_BROCK")

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "fixtures")
os.makedirs(OUT, exist_ok=True)

SECTOR_DATA = 0xF80
SIG = 0x08012025
SAVE_INDEX = 7
SEC_KEY = 0xDEADBEEF

CHARS = {" ": 0x00, ".": 0xAD, "-": 0xAE}
def enc(s, n):
    out = bytearray()
    for ch in s:
        if "0" <= ch <= "9": out.append(0xA1 + ord(ch) - 48)
        elif "A" <= ch <= "Z": out.append(0xBB + ord(ch) - 65)
        elif "a" <= ch <= "z": out.append(0xD5 + ord(ch) - 97)
        else: out.append(CHARS.get(ch, 0x00))
    out.append(0xFF)
    while len(out) < n: out.append(0xFF)
    return bytes(out[:n])

ORDER = ["GAEM","GAME","GEAM","GEMA","GMAE","GMEA","AGEM","AGME","AEGM","AEMG","AMGE","AMEG","EGAM","EGMA","EAGM","EAMG","EMGA","EMAG","MGAE","MGEA","MAGE","MAEG","MEGA","MEAG"]
GROWTH = {"Medium Slow": lambda n: (6*n**3)//5 - 15*n**2 + 100*n - 140, "Medium Fast": lambda n: n**3, "Fast": lambda n: 4*n**3//5, "Slow": lambda n: 5*n**3//4}

def pokemon(pid, otid, species, level, moves, item=0, nick="", growth="Medium Fast", boxed=False, ivs=(15,20,25,30,5,10), ability=0):
    G = struct.pack("<HHIBBH", species, item, GROWTH[growth](level), 0, 70, 0)
    A = struct.pack("<4H4B", *(moves + [0]*(4-len(moves))), *[10]*4)
    E = bytes(12)
    ivw = 0
    for i, v in enumerate(ivs): ivw |= (v & 31) << (5*i)
    ivw |= (ability & 1) << 31
    M = struct.pack("<BBHII", 0, 0, 0, ivw, 0)
    subs = {"G": G, "A": A, "E": E, "M": M}
    order = ORDER[pid % 24]
    data = b"".join(subs[c] for c in order)
    key = pid ^ otid
    enc_data = b"".join(struct.pack("<I", struct.unpack("<I", data[i:i+4])[0] ^ key) for i in range(0, 48, 4))
    checksum = sum(struct.unpack("<24H", data)) & 0xFFFF
    head = struct.pack("<II", pid, otid) + enc(nick, 10) + bytes([2, 0]) + enc("RED", 7) + bytes([0]) + struct.pack("<HH", checksum, 0)
    box = head + enc_data
    assert len(box) == 80
    if boxed: return box
    stats = struct.pack("<IBBHHHHHHH", 0, level, 0, 50, 50, 20, 20, 20, 20, 20)
    return box + stats

def sector(id_, data, size):
    buf = bytearray(0x1000)
    buf[:len(data)] = data
    chunk = bytes(buf[:size])
    s = sum(struct.unpack("<%dI" % (size // 4), chunk[: size // 4 * 4])) & 0xFFFFFFFF
    ck = ((s >> 16) + (s & 0xFFFF)) & 0xFFFF
    struct.pack_into("<HHII", buf, 0xFF4, id_, ck, SIG, SAVE_INDEX)
    return bytes(buf)

def bits(species_list):
    b = bytearray(52)
    for n in species_list: b[(n-1)//8] |= 1 << ((n-1) % 8)
    return bytes(b)

# SaveBlock2
sb2 = bytearray(0xF24)
sb2[0:8] = enc("RED", 8)
sb2[8] = 0
struct.pack_into("<HH", sb2, 0x0A, 12345, 54321)
struct.pack_into("<HBB", sb2, 0x0E, 12, 34, 56)
seen = [4, 5, 16, 19, 25]; caught = [5, 16, 19]
sb2[0x28:0x28+52] = bits(caught)
sb2[0x5C:0x5C+52] = bits(seen)
struct.pack_into("<I", sb2, 0xAC, 1)  # FRLG game code
struct.pack_into("<I", sb2, 0xF20, SEC_KEY)

# SaveBlock1
sb1 = bytearray(0x3D88)
party = [pokemon(0x12345678, (54321 << 16) | 12345, 5, 20, [52, 10, 45, 232], item=139, nick="FLAME", growth="Medium Slow"),
         pokemon(0x0BADF00D, (54321 << 16) | 12345, 16, 9, [33, 28], growth="Medium Slow")]
sb1[0x34] = len(party)
for i, p in enumerate(party): sb1[0x38 + i*100: 0x38 + (i+1)*100] = p
struct.pack_into("<I", sb1, 0x290, 12345 ^ SEC_KEY)
# bag: 5 Potions (item 13), key item Town Map? use HM01 (339) x1 in TM pocket
struct.pack_into("<HH", sb1, 0x310, 13, 5 ^ (SEC_KEY & 0xFFFF))
struct.pack_into("<HH", sb1, 0x464, 339, 1 ^ (SEC_KEY & 0xFFFF))
# badges: flags 0x820, 0x821
# story flags: Viridian Forest Poke Ball (0x156), hidden Potion (1000), got HM01 (0x237), beaten Brock (trainer flag 0x500 + 414)
for f in (0x820, 0x821, 0x156, 1000, 0x237, 0x500 + BROCK): sb1[0xEE0 + f // 8] |= 1 << (f % 8)

# PC
pc = bytearray(0x83D0)
struct.pack_into("<I", pc, 0, 0)
pc[4:4+80] = pokemon(0x00C0FFEE, (54321 << 16) | 12345, 19, 4, [33, 39], boxed=True, growth="Medium Fast")

sizes = [0xF24] + [0xF80]*3 + [0x3D88 - 3*0xF80] + [0xF80]*8 + [0x83D0 - 8*0xF80]
chunks = [bytes(sb2)] + [bytes(sb1[i*0xF80:(i+1)*0xF80]) for i in range(4)] + [bytes(pc[i*0xF80:(i+1)*0xF80]) for i in range(9)]
# rotate sector order to make sure the reader uses the footer id, not the position
order = list(range(14))
order = order[5:] + order[:5]
slot_a = b"".join(sector(i, chunks[i], sizes[i]) for i in order)
slot_b = bytes(0xE000)  # empty second slot
tail = bytes(0x20000 - len(slot_a) - len(slot_b))
open(os.path.join(OUT, "test.sav"), "wb").write(slot_a + slot_b + tail)
json.dump({"playerName": "RED", "trainerId": 12345, "money": 12345, "badges": [True, True] + [False]*6, "seen": seen, "caught": caught,
           "party": [{"species": 5, "level": 20, "nickname": "FLAME", "moves": [52, 10, 45, 232], "item": 139, "nature": "Hardy"}, {"species": 16, "level": 9}],
           "boxed": [{"species": 19, "level": 4}]}, open(os.path.join(OUT, "test.expected.json"), "w"))
print("wrote fixtures/test.sav")

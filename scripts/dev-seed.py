"""
Fills a local GramMap with demo plots so the interface can be looked at without real payments.

  1. .env.local:  TREASURY_ADDRESS=0:ffff…  MOCK_CHAIN_FILE=.data/mock-chain.json  GENESIS_UTIME=0
  2. npm run build && npm start
  3. python3 scripts/dev-seed.py http://localhost:3000

Only works against a local server: the mock chain file is ignored on Vercel.
"""
import base64, io, json, random, sys, urllib.request
from PIL import Image, ImageDraw

base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
out = sys.argv[2] if len(sys.argv) > 2 else ".data/mock-chain.json"
random.seed(7)

PALETTES = [
    ((250, 204, 21), (30, 30, 30)), ((16, 185, 129), (255, 255, 255)), ((244, 63, 94), (255, 255, 255)),
    ((59, 130, 246), (255, 255, 255)), ((250, 250, 250), (20, 20, 20)), ((168, 85, 247), (255, 255, 255)),
    ((20, 20, 20), (250, 204, 21)), ((249, 115, 22), (20, 20, 20)),
]
NAMES = ["Moon Cats", "Pixel Bakery", "North Wind DAO", "Tide Charts", "Lantern Labs", "Paper Boats", "Quiet Radio",
         "Salt & Signal", "Harbor Lights", "Kiln", "Orbit Tea", "Field Notes", "Glass Garden", "Low Tide FM"]


def picture(w, h, label):
    bg, fg = random.choice(PALETTES)
    s = max(4, min(24, 1024 // max(w, h)))
    img = Image.new("RGB", (w * s, h * s), bg)
    d = ImageDraw.Draw(img)
    kind = random.choice(["ring", "bars", "check", "tri"])
    W, H = img.size
    m = min(W, H)
    if kind == "ring":
        d.ellipse([W / 2 - m * .34, H / 2 - m * .34, W / 2 + m * .34, H / 2 + m * .34], outline=fg, width=max(2, m // 9))
    elif kind == "bars":
        for i in range(0, W, max(4, W // 6)):
            d.rectangle([i, H * .25, i + max(2, W // 14), H * .75], fill=fg)
    elif kind == "check":
        c = max(2, m // 4)
        for y in range(0, H, c):
            for x in range(0, W, c):
                if (x // c + y // c) % 2 == 0:
                    d.rectangle([x, y, x + c - 1, y + c - 1], fill=fg)
    else:
        d.polygon([(W * .5, H * .18), (W * .82, H * .8), (W * .18, H * .8)], fill=fg)
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def post(path, body):
    req = urllib.request.Request(base + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def overlaps(a, b):
    return a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]


taken = [(440, 480, 120, 40)]
plots = []
sizes = [(24, 24), (16, 10), (10, 10), (10, 10), (8, 8), (20, 6), (6, 6), (5, 5), (4, 4), (12, 12), (3, 3), (2, 2), (30, 12), (10, 4)]
tries = 0
while len(plots) < 46 and tries < 4000:
    tries += 1
    w, h = random.choice(sizes)
    x = int(random.gauss(500, 70)) - w // 2
    y = int(random.gauss(500, 55)) - h // 2
    r = (x, y, w, h)
    if x < 0 or y < 0 or x + w > 1000 or y + h > 1000 or any(overlaps(r, t) for t in taken):
        continue
    taken.append(r)
    plots.append(r)

txs = []
for i, (x, y, w, h) in enumerate(plots):
    owner = "0:" + format(random.randrange(1, 9), "x") * 64
    comment = f"gm:b:{x}:{y}:{w}:{h}"
    if i % 7 != 6:  # a few plots stay without a picture
        name = random.choice(NAMES)
        draft = post("/api/drafts", {"title": name, "url": f"https://example.com/{name.lower().replace(' ', '-')}",
                                     "image": picture(w, h, name) if i % 9 != 8 else None})
        comment += ":" + draft["hash"]
    txs.append({"hash": format(i + 1, "064x"), "lt": str((i + 1) * 1000), "utime": 1795651200 + i * 977,
                "from": owner, "value": str(w * h * 10**9), "comment": comment, "credited": True})

# One payment that lost a race, to show on the refund list.
x, y, w, h = plots[0]
txs.append({"hash": format(999, "064x"), "lt": str(999000), "utime": 1795651200 + 60000,
            "from": "0:" + "9" * 64, "value": str(w * h * 10**9), "comment": f"gm:b:{x}:{y}:{w}:{h}", "credited": True})

with open(out, "w") as f:
    json.dump(txs, f)
state = post("/api/sync", {})
print(f"seeded {len(state['plots'])} plots")

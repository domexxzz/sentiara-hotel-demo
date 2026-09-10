"""รอบสี่ — ทับชั้นดีไซน์ ASTRA ลงบนหน้าที่ประกอบเสร็จแล้ว

    python assemble4.py        (หรือรัน build.py ทีเดียวทั้งสี่รอบ)

ทำไมทับ ไม่รื้อเทมเพลตเขียนใหม่
---------------------------------
ตัวอย่างกดเล่นได้ 8 อันผูกกับชื่อคลาสและ id เดิมทั้งหมด (play.js finance.js
wifi.js รวมกัน ~46KB) รื้อ markup แล้วมันพังแบบที่ **หน้ายังดูปกติตอนโหลด**
แต่กดปุ่มแล้วไม่มีอะไรเกิดขึ้น ซึ่งเป็นอาการที่จะไปโผล่ตอนยืนอยู่หน้าลูกค้า

ชั้นทับแตะสี่จุดเท่านั้น
  1. เพิ่มฟอนต์ mono (ป้ายกำกับและตัวเลขทั้งหน้าเปลี่ยนบุคลิกด้วยจุดนี้จุดเดียว)
  2. ต่อ astra.css หลัง </style> เดิม — ชนะด้วยลำดับ ไม่ต้องพึ่ง !important
  3. เติมของในแถบบน: แถบวัด ตัวนับหัวข้อ ปุ่มสลับธีม + ใส่ data-n ให้ทุกหัวข้อ
     (เลขยักษ์เป็นลายน้ำวาดจาก attr(data-n) — CSS อ่าน textContent ไม่ได้)
  4. ต่อ astra.js ท้ายไฟล์
"""
import pathlib
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

HERE = pathlib.Path(__file__).parent
DEST = HERE / "sentiara-functions.html"
s = DEST.read_text(encoding="utf-8")
part = lambda n: (HERE / "parts" / n).read_text(encoding="utf-8")

if "astra" in s:
    raise SystemExit("หน้านี้ทับชั้น ASTRA ไปแล้ว — รัน build.py เพื่อประกอบใหม่ทั้งหมด")


def swap(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f"{label}: เจอ {n} ครั้ง ต้องเจอครั้งเดียว")
    s = s.replace(old, new, 1)


# ── 1 · ฟอนต์ mono ───────────────────────────────────────────────────
swap("family=Archivo:wght@400;500;600;800&family=IBM+Plex+Sans+Thai:wght@400;500;600;700",
     "family=Archivo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600"
     "&family=IBM+Plex+Sans+Thai:wght@400;500;600;700", "ฟอนต์")

# ── 2 · CSS ทับท้าย ──────────────────────────────────────────────────
swap("</style>", "</style>\n\n<style>\n/* astra */\n" + part("astra.css") + "</style>", "astra.css")

# ── 3 · ของในแถบบน ───────────────────────────────────────────────────
swap("""    </nav>
  </div>
</div>""",
     """    </nav>
    <div class="hud">
      <span class="count">หัวข้อ <b>——</b> / 14</span>
      <button class="look" type="button">กลางวัน</button>
    </div>
    <i class="meter"></i>
  </div>
</div>

<div class="keys" aria-hidden="true">
  <kbd>↑</kbd><kbd>↓</kbd> ข้ามหัวข้อ<kbd>D</kbd> สลับธีม
</div>""", "แถบบน")

# ── 4 · data-n ให้ทุกหัวข้อ (เลขลายน้ำ) ──────────────────────────────
s, hit = re.subn(r'<section class="grp" id="g(\d\d)">',
                 lambda m: f'<section class="grp" id="g{m.group(1)}" data-n="{m.group(1)}">', s)
if hit != 14:
    raise SystemExit(f"ใส่ data-n ได้ {hit} หัวข้อ ต้องได้ 14")

# ── 5 · สคริปต์ ──────────────────────────────────────────────────────
s = s.rstrip() + "\n\n<script>\n" + part("astra.js") + "</script>\n"

DEST.write_text(s, encoding="utf-8")

# ── ตรวจ ─────────────────────────────────────────────────────────────
checks = {
    "token กลางคืน": "--field:" in s,
    "ธีมสว่างยังอยู่": '[data-look="day"]' in s,
    "ฟอนต์ mono": "IBM+Plex+Mono" in s,
    "แถบวัด": 'class="meter"' in s,
    "ตัวนับหัวข้อ": 'class="count"' in s,
    "ปุ่มสลับธีม": 'class="look"' in s,
    "คำใบ้ปุ่มลัด": 'class="keys"' in s,
    "เลขลายน้ำ 14 หัวข้อ": s.count("data-n=") == 14,
    "สคริปต์ astra": "astra-look" in s,
    "ตัวอย่างกดเล่นครบ 8": len(re.findall(r'id="p-[a-z]+"', s)) == 8,
    "สคริปต์ครบห้าก้อน": s.count("<script>") == 5,
}
print(f"เสร็จ · {DEST.stat().st_size / 1024 / 1024:.2f} MB")
for k, ok in checks.items():
    print(f"   {'ผ่าน' if ok else 'ไม่ผ่าน ✗'}  {k}")
if not all(checks.values()):
    raise SystemExit("✗ ทับชั้นไม่ครบ")

"""รอบสอง — ยกบัญชีขึ้นเป็นหัวข้อของตัวเอง แล้วเลื่อนเลขหัวข้อที่เหลือ

    python assemble2.py
"""
import base64, pathlib, re, sys
sys.stdout.reconfigure(encoding="utf-8")

here = pathlib.Path(__file__).parent
parts = here / "parts"
s = (here / "deck.stage1.html").read_text(encoding="utf-8")
part = lambda n: (parts / n).read_text(encoding="utf-8")


def swap(old, new, label, count=1):
    global s
    if s.count(old) < count:
        raise SystemExit(f"หาไม่เจอตอนแทน: {label}")
    s = s.replace(old, new, count)


# ── 1 · เลื่อนหัวข้อ 05..12 ลงเป็น 06..13 (ไล่จากท้ายกันเลขชนกัน) ────
for n in range(12, 4, -1):
    s = s.replace(f'id="g{n:02d}"', f'id="g{n + 1:02d}"')
    s = s.replace(f'<span class="n">{n:02d}</span>', f'<span class="n">{n + 1:02d}</span>')
    s = s.replace(f'href="#g{n:02d}"', f'href="#g{n + 1:02d}"')

# ── 2 · แถบนำทาง 13 หัวข้อ ───────────────────────────────────────────
s = re.sub(
    r'<a href="#g01">01</a>.*?<a href="#g13">13</a>',
    "".join(f'<a href="#g{i:02d}">{i:02d}</a>' for i in range(1, 14)),
    s, flags=re.S,
)

# ── 3 · CSS + แทรกหัวข้อบัญชีก่อนหัวข้อ 06 (แดชบอร์ดเดิม) ────────────
swap("/* ── หัวข้อฟังก์ชันแต่ละกลุ่ม ──────────────────────────────── */",
     part("finance.css") + "\n/* ── หัวข้อฟังก์ชันแต่ละกลุ่ม ──────────────────────────────── */",
     "finance.css")

swap('  <!-- ══ 05 ══════════════════════════════════════════════════ -->\n'
     '  <section class="grp" id="g06">',
     part("sec-finance.html") + '\n\n  <!-- ══ 06 ══════════════════════════════════════════════════ -->\n'
     '  <section class="grp" id="g06">',
     "แทรกหัวข้อบัญชี")

# ── 4 · หัวข้อการเงินหน้าบ้าน (04) ปรับชื่อและเพิ่มรายการ ────────────
swap("<h2>การเงินและเอกสารภาษี</h2>", "<h2>การเงินหน้าบ้าน — บิลและเอกสารภาษี</h2>", "ชื่อ 04")
swap("<p class=\"lead\">ทุกบาทเข้าบิลเอง แก้เงียบ ๆ ไม่ได้ ต้องมีเหตุผลและผู้อนุมัติเสมอ</p>",
     "<p class=\"lead\">ทุกบาทที่แขกใช้เข้าบิลเอง แก้เงียบ ๆ ไม่ได้ ต้องมีเหตุผลและผู้อนุมัติเสมอ — "
     "นี่คือชั้นที่คนหน้าเคาน์เตอร์ใช้ ส่วนชั้นบัญชีอยู่หัวข้อถัดไป</p>", "lead 04")

# ── 5 · หัวข้อแดชบอร์ด (เดิม 05 ตอนนี้ 06) ปรับชื่อและใส่ตัวอย่าง ────
swap("<h2>แดชบอร์ดเจ้าของกิจการ</h2>", "<h2>แดชบอร์ดเจ้าของ — กำไรขาดทุนและกระแสเงินสด</h2>", "ชื่อ 06")
swap("""    <figure class="shot">
      <img src="{{IMG:owner-finance}}\"""",
     part("demo-pnl.html") + """
    <figure class="shot">
      <img src="{{IMG:owner-finance}}\"""",
     "demo-pnl")

# ── 6 · หัวเรื่อง ────────────────────────────────────────────────────
swap("""      <div><b>12</b><span>กลุ่มงาน</span></div>
      <div><b>66</b><span>ฟังก์ชัน</span></div>
      <div><b>5</b><span>ตัวอย่างกดเล่นได้</span></div>
      <div><b>7</b><span>ช่องทางขาย</span></div>""",
     """      <div><b>13</b><span>กลุ่มงาน</span></div>
      <div><b>76</b><span>ฟังก์ชัน</span></div>
      <div><b>7</b><span>ตัวอย่างกดเล่นได้</span></div>
      <div><b>57</b><span>บัญชีในผังบัญชี</span></div>""", "figures")
swap("ตั้งแต่แขกกดจอง จนถึงตัวเลขที่เข้าสมุดบัญชี — 12 กลุ่มงาน 66 ฟังก์ชัน",
     "ตั้งแต่แขกกดจอง จนถึงใบสำคัญที่ลงสมุดบัญชีคู่ — 13 กลุ่มงาน 76 ฟังก์ชัน", "sub")

# ── 7 · เพิ่มขั้นบัญชีในผังเส้นทางของแขก ─────────────────────────────
swap('<span class="what">เข้าสมุดบัญชี</span><span class="note">ลงแล้วแก้ไม่ได้</span>',
     '<span class="what">ลงสมุดบัญชีคู่</span><span class="note">เดบิตเท่าเครดิต ลงแล้วแก้ไม่ได้</span>',
     "journey")

# ── 8 · สคริปต์ ──────────────────────────────────────────────────────
swap("</script>\n</body>", "</script>\n</body>", "noop") if False else None
s = s.rstrip() + "\n\n<script>\n" + part("finance.js") + "</script>\n"

# ── 9 · ฝังภาพ ───────────────────────────────────────────────────────
shots = here / "shots"
missing = []


def img(m):
    f = shots / f"{m.group(1)}.jpg"
    if not f.exists():
        missing.append(m.group(1)); return m.group(0)
    return "data:image/jpeg;base64," + base64.b64encode(f.read_bytes()).decode()


s = re.sub(r"\{\{IMG:([a-z0-9-]+)\}\}", img, s)
if missing:
    raise SystemExit(f"ไม่เจอภาพ: {missing}")

dest = here / "sentiara-functions.html"
dest.write_text(s, encoding="utf-8")

print(f"ประกอบเสร็จ · {dest.stat().st_size / 1024 / 1024:.2f} MB · ตัวยึดเหลือ {s.count('{{IMG:')}")
for k in ['id="g05"', 'id="g13"', "p-jv", "p-pnl", "p-cal", "p-chan", "p-guard", "p-chiva", "p-rate"]:
    print(f"   {k:<12} {'พบ' if k in s else 'ไม่พบ ✗'}")
nums = re.findall(r'<span class="n">(\d\d)</span>', s)
print("   ลำดับหัวข้อ:", " ".join(nums))

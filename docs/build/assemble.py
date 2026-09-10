"""ประกอบหน้านำเสนอจากชิ้นส่วน แล้วฝังภาพเป็น data URI

    python assemble.py
"""
import base64, pathlib, re, sys
sys.stdout.reconfigure(encoding="utf-8")

here = pathlib.Path(__file__).parent
parts = here / "parts"
s = (here / "deck.template.html").read_text(encoding="utf-8")


def part(name: str) -> str:
    return (parts / name).read_text(encoding="utf-8")


def swap(old: str, new: str, label: str) -> None:
    global s
    if old not in s:
        raise SystemExit(f"หาไม่เจอตอนแทน: {label}")
    s = s.replace(old, new, 1)


# ── 1 · แถบนำทางขยายเป็น 12 หัวข้อ ───────────────────────────────────
swap(
    '<a href="#g01">01</a><a href="#g02">02</a><a href="#g03">03</a><a href="#g04">04</a>'
    '<a href="#g05">05</a><a href="#g06">06</a><a href="#g07">07</a><a href="#g08">08</a>'
    '<a href="#g09">09</a><a href="#g10">10</a>',
    "".join(f'<a href="#g{i:02d}">{i:02d}</a>' for i in range(1, 13)),
    "nav",
)

# ── 2 · CSS ของตัวอย่างกดเล่น ────────────────────────────────────────
swap(
    "/* ── หัวข้อฟังก์ชันแต่ละกลุ่ม ──────────────────────────────── */",
    part("play.css")
    + "\n/* ── หัวข้อฟังก์ชันแต่ละกลุ่ม ──────────────────────────────── */",
    "play.css",
)

# ── 3 · ตัวเลขบนหัวเรื่อง ────────────────────────────────────────────
swap(
    """      <div><b>10</b><span>กลุ่มงาน</span></div>
      <div><b>55</b><span>ฟังก์ชัน</span></div>
      <div><b>5</b><span>มุมมองผู้ใช้</span></div>
      <div><b>6</b><span>ระดับสิทธิ์</span></div>
      <div><b>100%</b><span>ภาษาไทยทั้งระบบ</span></div>""",
    """      <div><b>12</b><span>กลุ่มงาน</span></div>
      <div><b>66</b><span>ฟังก์ชัน</span></div>
      <div><b>5</b><span>ตัวอย่างกดเล่นได้</span></div>
      <div><b>7</b><span>ช่องทางขาย</span></div>
      <div><b>100%</b><span>ภาษาไทยทั้งระบบ</span></div>""",
    "figures",
)
swap(
    "ตั้งแต่แขกกดจอง จนถึงตัวเลขที่เข้าสมุดบัญชี — 10 กลุ่มงาน 55 ฟังก์ชัน",
    "ตั้งแต่แขกกดจอง จนถึงตัวเลขที่เข้าสมุดบัญชี — 12 กลุ่มงาน 66 ฟังก์ชัน",
    "sub",
)
swap(
    '<a class="btn ghost" href="#g01">ดูฟังก์ชันทั้งหมด ↓</a>',
    '<a class="btn ghost" href="#p-cal">ลองกดเล่นเลย ↓</a>',
    "cta",
)

# ── 4 · ตัวอย่างกดเล่นเข้าไปในหัวข้อ 01 และ 06 ───────────────────────
swap(
    """    <figure class="shot">
      <img src="{{IMG:owner-guests}}\"""",
    part("demo-calendar.html")
    + """
    <figure class="shot">
      <img src="{{IMG:owner-guests}}\"""",
    "demo-calendar",
)
swap(
    """    <figure class="shot">
      <img src="{{IMG:owner-settings}}\"""",
    part("demo-rate.html")
    + """
    <figure class="shot">
      <img src="{{IMG:owner-settings}}\"""",
    "demo-rate",
)

# ── 5 · ย้ายช่องทางขายและแชทออกจากหัวข้อ 10 ไปอยู่หัวข้อ 11 ──────────
for gone in [
    """      <li><span class="en">Unified Inbox</span><h3>กล่องข้อความรวมทุกช่องทาง</h3>
        <p>LINE · เว็บจอง · เว็บไซต์ มาจอเดียว รู้ว่ากำลังคุยกับแขกห้องไหน</p></li>
""",
    """      <li><span class="en">Reply Guard</span><h3>ด่านกรองก่อนตอบอัตโนมัติ</h3>
        <p>ตรวจคำตอบกับข้อมูลจริงก่อนส่ง ตอบราคาผิดหรือรับปากแทนโรงแรมไม่ได้</p></li>
""",
    """      <li><span class="en">Channel Manager</span><h3>ช่องทางขายและเว็บจอง</h3>
        <p>ห้องว่างและราคาส่งออกไปทุกช่องทางพร้อมกัน ขายห้องเดียวซ้ำสองที่ไม่ได้</p></li>
""",
]:
    swap(gone, "", "ย้ายออกจาก 10")
swap('<span class="tally">10 ฟังก์ชัน</span>', '<span class="tally">7 ฟังก์ชัน</span>', "tally 10")

# ── 6 · แทรกหัวข้อ 11 และ 12 ต่อท้ายหัวข้อ 10 ────────────────────────
anchor = "</section>\n\n</div>\n\n<div class=\"wrap\">\n  <div class=\"close\">"
swap(anchor, "</section>\n\n" + part("sec-11-12.html") + "\n\n</div>\n\n<div class=\"wrap\">\n  <div class=\"close\">", "sections 11-12")

# ── 7 · สคริปต์ของตัวอย่าง ──────────────────────────────────────────
swap("</script>\n", "</script>\n\n<script>\n" + part("play.js") + "</script>\n", "play.js")

(here / "deck.stage1.html").write_text(s, encoding="utf-8")

# ── 8 · ฝังภาพ ───────────────────────────────────────────────────────
shots = here / "shots"
missing = []


def img(m):
    f = shots / f"{m.group(1)}.jpg"
    if not f.exists():
        missing.append(m.group(1))
        return m.group(0)
    return "data:image/jpeg;base64," + base64.b64encode(f.read_bytes()).decode()


s = re.sub(r"\{\{IMG:([a-z0-9-]+)\}\}", img, s)
if missing:
    raise SystemExit(f"ไม่เจอภาพ: {missing}")

dest = here / "sentiara-functions.html"
dest.write_text(s, encoding="utf-8")

print(f"ประกอบเสร็จ · {dest.stat().st_size / 1024 / 1024:.2f} MB")
print("ตัวยึดที่เหลือ:", s.count("{{IMG:"))
for check in ["p-cal", "p-rate", "p-chan", "p-guard", "p-chiva", 'id="g11"', 'id="g12"']:
    print(f"   {check:<12} {'พบ' if check in s else 'ไม่พบ ✗'}")

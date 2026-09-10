"""รอบสาม — เพิ่มหัวข้อ 14 Wi-Fi ที่พัก และซ่อมแถบนำทางที่เพี้ยนจากรอบสอง

    python assemble3.py

แถบนำทางรอบสองพลาดจริง: regex มองหา `#g13">13` ที่ยังไม่เกิด แล้ว re.sub
เงียบไปเฉย ๆ ไม่ error — เหลือลิงก์ 12 อันที่เลขกับปลายทางเลื่อนกัน
กด "05" แล้วไปโผล่หัวข้อ 06 รอบนี้สร้างแถบใหม่ทั้งแถบแล้วตรวจซ้ำ
"""
import pathlib, re, sys
sys.stdout.reconfigure(encoding="utf-8")

here = pathlib.Path(__file__).parent
parts = here / "parts"
dest = here / "sentiara-functions.html"
s = dest.read_text(encoding="utf-8")
part = lambda n: (parts / n).read_text(encoding="utf-8")

if 'id="g14"' in s:
    raise SystemExit("มีหัวข้อ 14 อยู่แล้ว — ประกอบใหม่จาก assemble.py + assemble2.py ก่อน")


def swap(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f"ต้องเจอครั้งเดียวแต่เจอ {n} ครั้ง: {label}")
    s = s.replace(old, new, 1)


# ── 1 · CSS ──────────────────────────────────────────────────────────
swap("/* ── หัวข้อฟังก์ชันแต่ละกลุ่ม ──────────────────────────────── */",
     part("wifi.css") + "\n/* ── หัวข้อฟังก์ชันแต่ละกลุ่ม ──────────────────────────────── */",
     "wifi.css")

# ── 2 · หัวข้อ 14 ต่อท้ายหัวข้อ 13 ก่อนบล็อกปิดท้าย ──────────────────
tail = '\n</div>\n\n<div class="wrap">\n  <div class="close">'
swap(tail, "\n" + part("sec-wifi.html") + tail, "แทรกหัวข้อ 14")

# ── 3 · แถบนำทาง สร้างใหม่ทั้งแถบ 14 อัน ─────────────────────────────
nav = "".join(f'<a href="#g{i:02d}">{i:02d}</a>' for i in range(1, 15))
s, hit = re.subn(r"(?<=<nav aria-label=\"ข้ามไปยังกลุ่มฟังก์ชัน\">\n      ).*?(?=\n    </nav>)",
                 nav, s, flags=re.S)
if hit != 1:
    raise SystemExit(f"ซ่อมแถบนำทางไม่ได้ — แทนได้ {hit} จุด")

# ── 4 · ตัวเลขหัวเรื่อง ──────────────────────────────────────────────
swap("""      <div><b>13</b><span>กลุ่มงาน</span></div>
      <div><b>76</b><span>ฟังก์ชัน</span></div>
      <div><b>7</b><span>ตัวอย่างกดเล่นได้</span></div>""",
     """      <div><b>14</b><span>กลุ่มงาน</span></div>
      <div><b>83</b><span>ฟังก์ชัน</span></div>
      <div><b>8</b><span>ตัวอย่างกดเล่นได้</span></div>""", "figures")
swap("ตั้งแต่แขกกดจอง จนถึงใบสำคัญที่ลงสมุดบัญชีคู่ — 13 กลุ่มงาน 76 ฟังก์ชัน",
     "ตั้งแต่แขกกดจอง จนถึงใบสำคัญที่ลงสมุดบัญชีคู่ — 14 กลุ่มงาน 83 ฟังก์ชัน", "sub")

# ── 5 · สคริปต์ ──────────────────────────────────────────────────────
s = s.rstrip() + "\n\n<script>\n" + part("wifi.js") + "</script>\n"

dest.write_text(s, encoding="utf-8")

# ── ตรวจ ─────────────────────────────────────────────────────────────
print(f"เสร็จ · {dest.stat().st_size / 1024 / 1024:.2f} MB")
ids = re.findall(r'<section class="grp" id="g(\d\d)"', s)
nums = re.findall(r'<span class="n">(\d\d)</span>', s)
links = re.findall(r'<a href="#g(\d\d)">(\d\d)</a>', s)
tally = [int(x) for x in re.findall(r'class="tally">(\d+) ฟังก์ชัน', s)]
li = s.count('<li><span class="en">')
demos = re.findall(r'id="(p-[a-z]+)"', s)

print("   หัวข้อ:", " ".join(ids))
print("   เลขที่แสดง:", " ".join(nums))
print("   นำทางตรงปลายทาง:", "ตรงหมด" if all(a == b for a, b in links) else f"เพี้ยน {links}")
print(f"   นำทาง {len(links)} อัน · หัวข้อ {len(ids)} อัน")
print(f"   ผลรวมฟังก์ชัน {sum(tally)} · นับ <li> ได้ {li}")
print(f"   ตัวอย่างกดเล่น {len(demos)}: {' '.join(demos)}")

bad = []
if ids != [f"{i:02d}" for i in range(1, 15)]: bad.append("ลำดับหัวข้อ")
if nums != ids: bad.append("เลขที่แสดงไม่ตรง id")
if len(links) != 14 or any(a != b for a, b in links): bad.append("แถบนำทาง")
if sum(tally) != 83 or li != 83: bad.append("จำนวนฟังก์ชันไม่ตรงกับที่โฆษณา")
if len(demos) != 8: bad.append("จำนวนตัวอย่าง")
if bad:
    raise SystemExit("✗ ยังไม่ผ่าน: " + ", ".join(bad))
print("   ผ่านทุกข้อ")

"""แปลง HANDOFF.md เป็น docs/handoff.html — อ่านสบายตา มีสารบัญ ค้นในหน้าได้

    cd docs/build && python md2html.py

ต้องมี:  pip install markdown        (ใช้เฉพาะเครื่องที่ประกอบเอกสาร
                                      ไฟล์ผลลัพธ์เปิดได้เองไม่ต้องลงอะไร)

ทำไมต้องมีทั้ง .md และ .html
-----------------------------
`.md` คือฉบับที่แก้และ diff ได้ใน git · `.html` คือฉบับที่**ส่งให้คนอ่าน**
เปิดจากดิสก์ได้เลย มีสารบัญลอยข้าง แถบความคืบหน้า และตารางที่จัดมาให้อ่านง่าย
ห้ามแก้ `.html` ตรง ๆ — แก้ `.md` แล้วรันไฟล์นี้ใหม่ (มีข้อความเตือนอยู่หัวไฟล์ผลลัพธ์)

โทนสีและตัวอักษรยกมาจากหน้านำเสนอลูกค้าชุดเดียวกัน เพื่อให้เอกสารสองฉบับ
ดูเป็นตระกูลเดียวกันเวลาสลับแท็บ
"""
from __future__ import annotations

import html as htmllib
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

try:
    import markdown
except ModuleNotFoundError:
    raise SystemExit("ยังไม่ได้ลง markdown — ลงด้วย:  pip install markdown")

HERE = Path(__file__).resolve().parent
SRC = HERE.parent.parent / "HANDOFF.md"
OUT = HERE.parent / "handoff.html"

CSS = """
:root {
  --paper: #fffaf5; --cream: #f8f0e8; --cream-deep: #efe3d8;
  --ink: #241815; --ink-soft: #33231f; --muted: #786c65; --line: #d8cbc1;
  --red: #c92210; --red-bright: #ff4a2f; --green: #24765a;
  --display: Archivo, "IBM Plex Sans Thai", Tahoma, sans-serif;
  --body: "IBM Plex Sans Thai", Archivo, Tahoma, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --rail: 268px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 20px; }
body {
  margin: 0; background: var(--cream); color: var(--ink);
  font-family: var(--body); font-size: 16px; line-height: 1.78;
  -webkit-font-smoothing: antialiased;
}

/* แถบความคืบหน้า — เอกสารยาว คนอ่านควรรู้ว่าเหลืออีกเท่าไร */
#bar {
  position: fixed; inset: 0 auto auto 0; height: 3px; width: 0;
  background: var(--red); z-index: 40; transition: width .08s linear;
}

.shell { display: grid; grid-template-columns: var(--rail) minmax(0, 1fr); gap: 0; }

/* ── สารบัญลอยข้าง ─────────────────────────────────────────── */
aside {
  position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto;
  background: var(--ink); color: var(--cream); padding: 26px 20px 40px;
}
aside .mark {
  font-family: var(--display); font-weight: 800; letter-spacing: .12em;
  font-size: .82rem; display: block; color: var(--paper);
}
aside .mark em { color: var(--red-bright); font-style: normal; }
aside .sub {
  font-size: .74rem; color: #b9a99e; display: block;
  margin: 3px 0 20px; letter-spacing: .02em;
}
aside nav { display: grid; gap: 1px; }
aside nav a {
  display: grid; grid-template-columns: 1.7em 1fr; gap: 8px;
  color: #d6c7bd; text-decoration: none; font-size: .84rem;
  padding: 5px 8px; border-radius: 3px; line-height: 1.45;
}
aside nav a b {
  font-family: var(--display); font-weight: 700; color: var(--muted);
  font-variant-numeric: tabular-nums; font-size: .78rem;
}
aside nav a:hover { background: #3a2723; color: var(--paper); }
aside nav a.on { background: var(--red); color: #fff; }
aside nav a.on b { color: #ffd9d0; }
aside .foot {
  margin-top: 24px; padding-top: 16px; border-top: 1px solid #4b332d;
  font-size: .74rem; color: #9c8b81; line-height: 1.7;
}
aside .foot code { color: #ffb9a6; font-family: var(--mono); font-size: .92em; }

/* ── เนื้อเอกสาร ────────────────────────────────────────────── */
main { background: var(--paper); min-width: 0; }
.doc { max-width: 860px; margin: 0 auto; padding: 46px max(24px, 5vw) 110px; }

.warn {
  background: var(--cream); border-left: 3px solid var(--red);
  padding: 11px 15px; font-size: .86rem; color: var(--ink-soft);
  margin: 0 0 34px;
}
.warn code { font-family: var(--mono); font-size: .92em; }

h1 {
  font-family: var(--display); font-size: clamp(1.9rem, 4.4vw, 2.7rem);
  font-weight: 800; line-height: 1.14; letter-spacing: -.015em;
  margin: 0 0 8px; text-wrap: balance;
}
h2 {
  font-family: var(--display); font-size: clamp(1.28rem, 2.5vw, 1.62rem);
  font-weight: 800; line-height: 1.28; margin: 58px 0 4px;
  padding-top: 22px; border-top: 1.5px solid var(--ink); text-wrap: balance;
}
h2:first-of-type { margin-top: 34px; }
h3 {
  font-family: var(--display); font-size: 1.06rem; font-weight: 700;
  margin: 30px 0 2px; color: var(--ink);
}
h4 { font-family: var(--display); font-size: .95rem; margin: 22px 0 2px; }

p { margin: 10px 0; }
strong { font-weight: 700; }
em { font-style: italic; color: var(--brown, var(--ink-soft)); }
a { color: var(--red); text-decoration-thickness: 1px; text-underline-offset: 2px; }
a:hover { color: var(--red-bright); }
hr { border: 0; height: 0; margin: 0; }

ul, ol { margin: 10px 0; padding-left: 1.35em; }
li { margin: 4px 0; }
li > ul, li > ol { margin: 3px 0; }

blockquote {
  margin: 18px 0; padding: 12px 16px; background: var(--cream);
  border-left: 3px solid var(--muted); color: var(--ink-soft); font-size: .94rem;
}
blockquote p { margin: 4px 0; }

code {
  font-family: var(--mono); font-size: .88em; background: var(--cream-deep);
  padding: 1px 5px; border-radius: 3px; word-break: break-word;
}
pre {
  background: var(--ink); color: #efe3d8; padding: 15px 17px;
  overflow-x: auto; font-size: .82rem; line-height: 1.68; margin: 16px 0;
}
pre code { background: none; padding: 0; color: inherit; font-size: 1em; }

/* ตารางในเอกสารนี้คือสาระ ไม่ใช่ของประดับ — จัดให้อ่านเร็ว */
.tw { overflow-x: auto; margin: 18px 0; }
table { border-collapse: collapse; width: 100%; font-size: .88rem; min-width: 480px; }
th, td {
  text-align: left; vertical-align: top; padding: 8px 12px;
  border-bottom: 1px solid var(--line);
}
thead th {
  font-family: var(--display); font-size: .68rem; font-weight: 700;
  letter-spacing: .09em; text-transform: uppercase; color: var(--muted);
  background: var(--cream); border-bottom: 1.5px solid var(--ink);
  white-space: nowrap;
}
tbody tr:hover { background: var(--cream); }
td code { font-size: .84em; }

/* ปุ่มขึ้นบนสุด — เอกสาร 450 บรรทัด เลื่อนกลับเองเหนื่อย */
#top {
  position: fixed; right: 20px; bottom: 20px; z-index: 30;
  font-family: var(--display); font-size: .74rem; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase;
  background: var(--ink); color: var(--paper); border: 0;
  padding: 9px 14px; cursor: pointer; opacity: 0;
  transition: opacity .18s; pointer-events: none;
}
#top.show { opacity: 1; pointer-events: auto; }
#top:hover { background: var(--red); }

@media (max-width: 900px) {
  .shell { grid-template-columns: 1fr; }
  aside {
    position: static; height: auto; padding: 20px 18px 24px;
  }
  aside nav { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
  .doc { padding: 30px 20px 90px; }
}
@media print {
  aside, #bar, #top, .warn { display: none; }
  body, main { background: #fff; }
  .doc { max-width: none; padding: 0; }
  h2 { page-break-after: avoid; }
  pre, table, blockquote { page-break-inside: avoid; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  * { transition: none !important; }
}
"""

JS = """
// สารบัญเน้นหัวข้อที่กำลังอ่าน + แถบความคืบหน้า
(function () {
  var links = [].slice.call(document.querySelectorAll('aside nav a'));
  var heads = links.map(function (a) { return document.getElementById(a.hash.slice(1)); });
  var bar = document.getElementById('bar');
  var top = document.getElementById('top');

  function paint() {
    var y = window.scrollY;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? Math.min(100, (y / h) * 100) : 0) + '%';
    top.classList.toggle('show', y > 700);

    var cur = 0;
    for (var i = 0; i < heads.length; i++) {
      if (heads[i] && heads[i].getBoundingClientRect().top <= 90) cur = i;
    }
    links.forEach(function (a, i) { a.classList.toggle('on', i === cur); });
  }

  addEventListener('scroll', paint, { passive: true });
  addEventListener('resize', paint);
  top.addEventListener('click', function () { scrollTo({ top: 0, behavior: 'smooth' }); });
  paint();
})();
"""


def build() -> None:
    if not SRC.exists():
        raise SystemExit(f"ไม่เจอ {SRC}")
    raw = SRC.read_text(encoding="utf-8")

    md = markdown.Markdown(extensions=["tables", "fenced_code", "toc", "sane_lists"],
                           extension_configs={"toc": {"toc_depth": "2-2"}})
    body = md.convert(raw)

    # ตารางต้องเลื่อนในกรอบของตัวเอง ไม่ใช่ทำให้ทั้งหน้าเลื่อนข้าง
    body = body.replace("<table>", '<div class="tw"><table>').replace("</table>", "</table></div>")

    # สารบัญจาก h2 · ตัดเลขนำหน้า ("4 · ..." → เลข 4 ไปอยู่ช่องซ้าย)
    items = []
    for t in md.toc_tokens:
        name = re.sub(r"\s*<[^>]+>\s*", "", t["name"]).strip()
        m = re.match(r"^(\d+)\s*·\s*(.+)$", name)
        num, label = (m.group(1), m.group(2)) if m else ("", name)
        items.append(f'<a href="#{t["id"]}"><b>{htmllib.escape(num)}</b>'
                     f'<span>{htmllib.escape(label)}</span></a>')
    nav = "\n      ".join(items)

    page = f"""<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sentiara PMS — เอกสารส่งต่องาน</title>
<meta name="description" content="เอกสารส่งต่องาน Sentiara PMS — ทำอะไรได้บ้าง แก้ปัญหามาแบบไหน และกฎที่ห้ามทำลาย">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap">
<style>{CSS}</style>
</head>
<body>
<div id="bar"></div>
<div class="shell">
  <aside>
    <span class="mark">SENTIARA<em>·</em>PMS</span>
    <span class="sub">เอกสารส่งต่องาน · 10 ก.ย. 2569</span>
    <nav>
      {nav}
    </nav>
    <div class="foot">
      ฉบับที่แก้ได้คือ <code>HANDOFF.md</code> ในรากของ repo<br>
      หน้านี้ประกอบด้วย <code>docs/build/md2html.py</code>
    </div>
  </aside>
  <main>
    <div class="doc">
      <p class="warn">
        <b>หน้านี้เป็นไฟล์ที่ถูกประกอบขึ้น ห้ามแก้ตรงนี้</b> — แก้ที่
        <code>HANDOFF.md</code> แล้วรัน <code>python docs/build/md2html.py</code> ใหม่
      </p>
      {body}
    </div>
  </main>
</div>
<button id="top" type="button">ขึ้นบนสุด</button>
<script>{JS}</script>
</body>
</html>
"""
    OUT.write_text(page, encoding="utf-8")
    print(f"✓ {OUT.relative_to(HERE.parent.parent)} · {OUT.stat().st_size / 1024:.0f} KB · "
          f"สารบัญ {len(items)} หัวข้อ")


if __name__ == "__main__":
    build()

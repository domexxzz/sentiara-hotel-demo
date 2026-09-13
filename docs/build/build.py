"""ประกอบหน้านำเสนอลูกค้าใหม่ทั้งหน้า จากชิ้นส่วนในโฟลเดอร์นี้

    cd docs/build && python build.py

ได้ `docs/presentation.html` ไฟล์เดียวจบ — เปิดด้วยเบราว์เซอร์ได้เลย
ไม่ต้องมีเซิร์ฟเวอร์ ไม่ต้องต่อเน็ต (ภาพฝังเป็น data URI ทั้งหมด)

ทำไมต้องประกอบสามรอบ ไม่เขียนไฟล์เดียวไปเลย
---------------------------------------------
เพราะแต่ละรอบเกิดคนละวัน ตามที่ลูกค้าขอเพิ่ม และรอบหลัง ๆ ต้อง **เลื่อนเลข
หัวข้อ** ของรอบก่อน (แทรกหัวข้อบัญชีเป็น 05 ทำให้ 05..12 เดิมกลายเป็น 06..13)
การเลื่อนเลขบนไฟล์ที่ประกอบแล้วปลอดภัยกว่าการไปแก้เลขในเทมเพลตทุกที่
แล้วเสี่ยงลืมจุดใดจุดหนึ่ง

ลำดับ
  รอบ 1  assemble.py   เทมเพลต + parts → deck.stage1.html → sentiara-functions.html
  รอบ 2  assemble2.py  ยกบัญชีขึ้นเป็นหัวข้อ 05 แล้วเลื่อนที่เหลือ (อ่าน stage1)
  รอบ 3  assemble3.py  เพิ่มหัวข้อ 14 Wi-Fi + ซ่อมแถบนำทาง
  รอบ 4  assemble4.py  ทับชั้นดีไซน์ ASTRA (ธีมกลางคืน · ปุ่มลัด · เผยตัวเมื่อเลื่อนถึง)

ทุกรอบมีตัวตรวจในตัว ถ้าหาข้อความที่จะแทนไม่เจอจะหยุดทันที ไม่แทนเงียบ ๆ
(เคยพลาดตรงนี้แล้ว — `re.sub` ที่หาไม่เจอคืนข้อความเดิมเฉย ๆ ไม่ error
 ผลคือแถบนำทางเพี้ยนไปหลายวันโดยไม่มีใครรู้ ดู HANDOFF.md ข้อ 7.10)

ตรวจหน้าที่ได้ด้วยเบราว์เซอร์จริงต่อ:  node check-deck.mjs
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "presentation.html"
BUILT = HERE / "sentiara-functions.html"
PASSES = ("assemble.py", "assemble2.py", "assemble3.py", "assemble4.py", "assemble5.py")


def main() -> int:
    # รอบ 3 จะปฏิเสธถ้าเจอหัวข้อ 14 อยู่แล้ว จึงต้องล้างของรอบก่อนออกก่อน
    for stale in (BUILT, HERE / "deck.stage1.html"):
        stale.unlink(missing_ok=True)

    for step in PASSES:
        print(f"\n── {step} ───────────────────────────────────────")
        r = subprocess.run([sys.executable, step], cwd=HERE)
        if r.returncode != 0:
            print(f"\n✗ หยุดที่ {step} — อ่านข้อความด้านบน")
            return r.returncode

    if not BUILT.exists():
        print("\n✗ ประกอบเสร็จแต่ไม่เจอไฟล์ผลลัพธ์")
        return 1

    shutil.copyfile(BUILT, OUT)
    mb = OUT.stat().st_size / 1024 / 1024
    print(f"\n✓ เสร็จ → {OUT.relative_to(HERE.parent.parent)}  ({mb:.2f} MB)")
    print("  ตรวจด้วยเบราว์เซอร์จริง:  node check-deck.mjs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""แพ็กทั้งระบบเป็นไฟล์ .exe เดียวจบ

    python scripts/แพ็กเป็นโปรแกรม.py

ได้ `dist/SentiaraPMS.exe` ที่ลูกค้าดับเบิลคลิกเปิดได้เลย ไม่ต้องลง Python
ไม่ต้องรู้จัก pip — แบบเดียวกับที่ Ledger Bridge ทำ

ในไฟล์เดียวนั้นมีทั้ง **หลังบ้านและหน้าจอ** · เปิดแล้วเบราว์เซอร์เด้งขึ้นมา
ที่จอใช้งานจริง ไม่ใช่หน้าคู่มือ API — เจ้าของโรงแรมไม่รู้จัก Swagger
และไม่ควรต้องรู้จัก

ทำไมถึงต้องเป็นไฟล์เดียว
-------------------------
เจ้าของโรงแรมไม่ใช่ผู้ดูแลระบบ · ขั้นตอนติดตั้งที่มีมากกว่า "ดับเบิลคลิก"
คือขั้นตอนที่จะมีคนโทรมาถาม และทุกสายที่โทรมาคือต้นทุนที่กินกำไรของสัญญานั้น

ต้องลงของสองอย่างก่อน (เครื่องของนักพัฒนาเท่านั้น ลูกค้าไม่ต้อง):

    pip install pyinstaller        แพ็กหลังบ้าน
    npm install                    สร้างหน้าจอ (ที่รากโปรเจกต์)

ตรวจผลลัพธ์ต่อด้วย:  python scripts/ทดสอบโปรแกรมที่แพ็ก.py
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

ROOT = Path(__file__).resolve().parents[1]     # server/
WEB = ROOT.parent                              # รากโปรเจกต์ คือที่อยู่ของหน้าจอ
LAUNCHER = Path(__file__).resolve().parent / "launcher.py"
NAME = "SentiaraPMS"
PORT = 8900


def build_ui() -> Path | None:
    """สร้างหน้าจอด้วย npm แล้วคืนโฟลเดอร์ผลลัพธ์

    ชี้ `VITE_API_URL` มาที่ตัวเอง เพราะหน้าจอกับ API อยู่ในไฟล์เดียวกันตอนรัน
    ต้องเป็น URL เต็ม ไม่ใช่ค่าว่าง — ค่าว่างแปลว่า "ไม่ต้องลองต่อหลังบ้าน"
    (ดู `API_CONFIGURED` ใน src/lib/api.ts) แล้วลูกค้าจะได้โหมดสาธิตแทนของจริง
    """
    if shutil.which("npm") is None:
        print("! ไม่พบ npm — จะแพ็กเฉพาะหลังบ้าน ลูกค้าจะได้แต่ API ไม่มีหน้าจอ")
        return None

    print("กำลังสร้างหน้าจอ...")
    env = {**os.environ, "VITE_API_URL": f"http://127.0.0.1:{PORT}"}
    r = subprocess.run(["npm", "run", "build"], cwd=WEB, env=env,
                       shell=(sys.platform == "win32"))
    if r.returncode != 0:
        print("! สร้างหน้าจอไม่สำเร็จ — จะแพ็กเฉพาะหลังบ้าน")
        return None

    out = WEB / "dist"
    if not (out / "index.html").exists():
        print("! สร้างหน้าจอแล้วแต่ไม่เจอ index.html — จะแพ็กเฉพาะหลังบ้าน")
        return None
    return out


def main() -> int:
    if shutil.which("pyinstaller") is None:
        print("✗ ยังไม่ได้ลง PyInstaller")
        print("  ลงด้วย:  pip install pyinstaller")
        print("\n  (ลงเฉพาะเครื่องที่ใช้แพ็ก ลูกค้าไม่ต้องลงอะไรเลย)")
        return 1

    ui = build_ui()

    cmd = [
        "pyinstaller", "--onefile", "--name", NAME,
        "--distpath", str(ROOT / "dist"),
        "--workpath", str(ROOT / "build"),
        "--specpath", str(ROOT / "build"),
        # FastAPI และ uvicorn โหลดโมดูลย่อยตอนรัน PyInstaller จึงมองไม่เห็นเอง
        # ตัวเปิดอยู่ใน scripts/ แต่แพ็กเกจ pms อยู่ที่ server/ — ตัวแพ็กใส่แค่
        # โฟลเดอร์ของสคริปต์ลง sys.path ให้ ไม่บอกตรงนี้จะได้ .exe ที่แพ็กผ่าน
        # แล้วพังตอนเปิดด้วย ModuleNotFoundError: No module named 'pms'
        "--paths", str(ROOT),
        "--collect-all", "uvicorn",
        "--collect-all", "fastapi",
        "--hidden-import", "pms.api",
        "--hidden-import", "pms.seed",
        "--hidden-import", "pms.web",
        str(LAUNCHER),
    ]
    if ui is not None:
        # ตัวคั่นของ --add-data ต่างกันตามระบบปฏิบัติการ
        cmd[2:2] = ["--add-data", f"{ui}{os.pathsep}web"]

    print("\nกำลังแพ็ก... ใช้เวลาสักครู่\n")
    r = subprocess.run(cmd, cwd=ROOT)
    if r.returncode != 0:
        print("\n✗ แพ็กไม่สำเร็จ — อ่าน log ด้านบน")
        return r.returncode

    exe = ROOT / "dist" / (f"{NAME}.exe" if sys.platform == "win32" else NAME)
    print(f"\nเสร็จ → {exe}")
    if exe.exists():
        print(f"       {exe.stat().st_size / 1024 / 1024:.0f} MB")
    print("หน้าจอ: " + ("แพ็กไปด้วยแล้ว" if ui is not None else "ไม่ได้แพ็กไปด้วย — ได้แต่ API"))
    print("\nส่งให้ลูกค้าทั้งไฟล์เดียว ดับเบิลคลิกเปิดได้เลย")
    print("ฐานข้อมูลจะถูกสร้างในโฟลเดอร์ data ข้าง ๆ ตัวโปรแกรม")
    print("สำรองข้อมูล = ปิดโปรแกรมแล้วก๊อปโฟลเดอร์ data ทั้งอัน")
    print("\nตรวจก่อนส่ง:  python scripts/ทดสอบโปรแกรมที่แพ็ก.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

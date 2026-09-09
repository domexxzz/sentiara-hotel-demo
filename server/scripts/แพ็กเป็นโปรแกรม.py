"""แพ็กหลังบ้านเป็นไฟล์ .exe เดียวจบ

    python scripts/แพ็กเป็นโปรแกรม.py

ได้ `dist/SentiaraPMS.exe` ที่ลูกค้าดับเบิลคลิกเปิดได้เลย ไม่ต้องลง Python
ไม่ต้องรู้จัก pip — แบบเดียวกับที่ Ledger Bridge ทำ

ทำไมถึงต้องเป็นไฟล์เดียว
-------------------------
เจ้าของโรงแรมไม่ใช่ผู้ดูแลระบบ · ขั้นตอนติดตั้งที่มีมากกว่า "ดับเบิลคลิก"
คือขั้นตอนที่จะมีคนโทรมาถาม และทุกสายที่โทรมาคือต้นทุนที่กินกำไรของสัญญานั้น

ต้องลง PyInstaller ก่อน (เครื่องของนักพัฒนาเท่านั้น ลูกค้าไม่ต้อง):

    pip install pyinstaller
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

ROOT = Path(__file__).resolve().parents[1]
NAME = "SentiaraPMS"


def main() -> int:
    if shutil.which("pyinstaller") is None:
        print("✗ ยังไม่ได้ลง PyInstaller")
        print("  ลงด้วย:  pip install pyinstaller")
        print("\n  (ลงเฉพาะเครื่องที่ใช้แพ็ก ลูกค้าไม่ต้องลงอะไรเลย)")
        return 1

    launcher = ROOT / "_launch.py"
    launcher.write_text(
        '"""ตัวเปิดสำหรับไฟล์ .exe — เตรียมข้อมูลตั้งต้นแล้วเปิดเซิร์ฟเวอร์"""\n'
        "import os, sys, threading, webbrowser\n"
        "from pathlib import Path\n"
        "\n"
        "# ฐานข้อมูลอยู่ข้าง ๆ ตัวโปรแกรม ไม่ใช่ในโฟลเดอร์ชั่วคราวที่หายตอนรีบูต\n"
        "here = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path.cwd()\n"
        "os.environ.setdefault('PMS_DB', f'sqlite:///{(here / \"data\" / \"pms.db\").as_posix()}')\n"
        "\n"
        "from pms.seed import main as seed_main\n"
        "from pms.app import app\n"
        "import uvicorn\n"
        "\n"
        "if not (here / 'data' / 'pms.db').exists():\n"
        "    sys.argv = ['seed']\n"
        "    seed_main()\n"
        "    input('\\nจดรหัสบัตรและรหัสผ่านด้านบนไว้ แล้วกด Enter เพื่อเปิดระบบ...')\n"
        "\n"
        "threading.Timer(1.5, lambda: webbrowser.open('http://127.0.0.1:8900/docs')).start()\n"
        "uvicorn.run(app, host='127.0.0.1', port=8900)\n",
        encoding="utf-8",
    )

    cmd = [
        "pyinstaller", "--onefile", "--name", NAME,
        "--distpath", str(ROOT / "dist"),
        "--workpath", str(ROOT / "build"),
        "--specpath", str(ROOT / "build"),
        # FastAPI และ uvicorn โหลดโมดูลย่อยตอนรัน PyInstaller จึงมองไม่เห็นเอง
        "--collect-all", "uvicorn",
        "--collect-all", "fastapi",
        "--hidden-import", "pms.api",
        "--hidden-import", "pms.seed",
        str(launcher),
    ]
    print("กำลังแพ็ก... ใช้เวลาสักครู่\n")
    r = subprocess.run(cmd, cwd=ROOT)
    launcher.unlink(missing_ok=True)

    if r.returncode != 0:
        print("\n✗ แพ็กไม่สำเร็จ — อ่าน log ด้านบน")
        return r.returncode

    exe = ROOT / "dist" / (f"{NAME}.exe" if sys.platform == "win32" else NAME)
    print(f"\nเสร็จ → {exe}")
    if exe.exists():
        print(f"       {exe.stat().st_size / 1024 / 1024:.0f} MB")
    print("\nส่งให้ลูกค้าทั้งไฟล์เดียว · ดับเบิลคลิกเปิดได้เลย")
    print("ฐานข้อมูลจะถูกสร้างในโฟลเดอร์ data ข้าง ๆ ตัวโปรแกรม")
    print("สำรองข้อมูล = ปิดโปรแกรมแล้วก๊อปโฟลเดอร์ data ทั้งอัน")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

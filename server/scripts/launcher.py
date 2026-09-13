"""ตัวเปิดของไฟล์ .exe — เตรียมข้อมูลตั้งต้น เสิร์ฟหน้าจอ แล้วเปิดเบราว์เซอร์

ไฟล์นี้ไม่ได้ถูก import จากที่ไหน · `แพ็กเป็นโปรแกรม.py` ส่งมันให้ PyInstaller
เป็นจุดเริ่มของโปรแกรม

ทำไมเป็นไฟล์จริง ไม่ใช่สตริงในสคริปต์แพ็ก
--------------------------------------------
เดิมตัวเปิดถูกเขียนเป็นสตริงยักษ์ที่ escape ซ้อนกันอยู่ในสคริปต์แพ็ก
อ่านยาก แก้แล้วพังง่าย และ **ไม่มีอะไรตรวจไวยากรณ์ให้เลยจนกว่าจะแพ็กเสร็จ
แล้วเอาไปเปิดจริง** ซึ่งช้าเกินกว่าจะรู้ตัว · เป็นไฟล์จริงแล้ว ตัวตรวจ
ไวยากรณ์กับคนอ่านโค้ดเห็นมันตามปกติ
"""
from __future__ import annotations

import os
import sys
import threading
import webbrowser
from pathlib import Path

PORT = 8900

# ฐานข้อมูลอยู่ข้าง ๆ ตัวโปรแกรม ไม่ใช่ในโฟลเดอร์ชั่วคราวที่หายตอนรีบูต
HERE = Path(sys.executable).parent if getattr(sys, "frozen", False) else Path.cwd()
DB = HERE / "data" / "pms.db"

os.environ.setdefault("PMS_DB", f"sqlite:///{DB.as_posix()}")
# หน้าจอเสิร์ฟจากที่อยู่เดียวกับ API · เปิดทางให้ทั้ง localhost และ 127.0.0.1
# เผื่อลูกค้าพิมพ์เอง ไม่งั้นเบราว์เซอร์บล็อกด้วยกฎข้ามต้นทาง
os.environ.setdefault("PMS_ORIGINS", f"http://127.0.0.1:{PORT},http://localhost:{PORT}")

# ── ต้องถามก่อน import pms.app ──────────────────────────────────────
# การ import pms.app เรียก create_app() ซึ่งสร้างตารางและ **ไฟล์ฐานข้อมูล**
# ทันที · ถ้าไปถามว่า "ไฟล์มีหรือยัง" ทีหลัง คำตอบจะเป็น "มีแล้ว" เสมอ
# แล้วข้ามการสร้างข้อมูลตั้งต้น — ลูกค้าเปิดโปรแกรมครั้งแรกจะได้ฐานว่าง
# ที่ไม่มีพนักงานสักคน แล้วล็อกอินไม่ได้เลย (เคยพลาดมาแล้วจริง)
FRESH = not DB.exists()

from pms.app import app  # noqa: E402  ต้องอยู่หลังการตั้งค่าสภาพแวดล้อม
from pms.seed import main as seed_main  # noqa: E402
import uvicorn  # noqa: E402


def main() -> None:
    if FRESH:
        sys.argv = ["seed"]
        seed_main()
        try:
            input("\nจดรหัสบัตรและรหัสผ่านด้านบนไว้ แล้วกด Enter เพื่อเปิดระบบ...")
        except EOFError:
            pass          # เปิดแบบไม่มีแป้นพิมพ์ เช่นตอนทดสอบอัตโนมัติ

    threading.Timer(1.5, lambda: webbrowser.open(f"http://127.0.0.1:{PORT}/")).start()
    print(f"\n  เปิดระบบที่ http://127.0.0.1:{PORT}")
    print(f"  คู่มือ API ที่ http://127.0.0.1:{PORT}/docs")
    print("  ปิดโปรแกรมด้วยการปิดหน้าต่างนี้\n")
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")


if __name__ == "__main__":
    main()

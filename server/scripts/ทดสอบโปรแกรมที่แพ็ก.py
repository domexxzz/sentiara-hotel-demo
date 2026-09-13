"""ทดสอบไฟล์ .exe ที่แพ็กแล้ว เหมือนเครื่องลูกค้าที่ไม่มีอะไรเลย

    python scripts/ทดสอบโปรแกรมที่แพ็ก.py

ทำไมต้องมีสคริปต์นี้
---------------------
"แพ็กผ่าน" ไม่เท่ากับ "ลูกค้าเปิดใช้ได้" · PyInstaller แพ็กสำเร็จได้ทั้งที่
โมดูลบางตัวหายไป แล้วไปพังตอนเปิดจริงบนเครื่องที่ไม่มี Python โดยเฉพาะ
FastAPI กับ uvicorn ที่โหลดโมดูลย่อยตอนรัน ซึ่งตัวแพ็กมองไม่เห็นเอง

สคริปต์นี้ก๊อป .exe ไปไว้ในโฟลเดอร์เปล่า **นอกโปรเจกต์** แล้วสั่งเปิด
ถ้ามันแอบใช้ซอร์สในโปรเจกต์อยู่ จะพังตรงนี้ ไม่ใช่ที่หน้าลูกค้า

ข้อที่สำคัญที่สุดคือข้อสุดท้าย — **ล็อกอินด้วยบัตรที่โปรแกรมเพิ่งพิมพ์ออกมา
แล้วเรียกดูห้องได้จริง** · ครั้งหนึ่งเคยแพ็กผ่าน เปิดขึ้น ตอบ API ครบ
แต่ฐานข้อมูลว่างเปล่าไม่มีพนักงานสักคน ลูกค้าล็อกอินไม่ได้เลย
และไม่มีข้อไหนจับได้จนกระทั่งเพิ่มข้อนี้
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

ROOT = Path(__file__).resolve().parents[1]
EXE = ROOT / "dist" / ("SentiaraPMS.exe" if sys.platform == "win32" else "SentiaraPMS")
BASE = "http://127.0.0.1:8900"


def call(path: str, *, data: dict | None = None, token: str = "",
         timeout: float = 6.0) -> tuple[int, object]:
    req = urllib.request.Request(f"{BASE}{path}")
    if token:
        req.add_header("authorization", f"Bearer {token}")
    if data is not None:
        req.data = json.dumps(data).encode()
        req.add_header("content-type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode("utf-8", "replace")
            try:
                return r.status, json.loads(body)
            except json.JSONDecodeError:
                return r.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:200]


def wait_up(proc: subprocess.Popen, seconds: int = 90) -> bool:
    """รอจนเปิดพอร์ตได้ · ยอมแพ้ทันทีถ้าโปรแกรมตายไปก่อน จะได้ไม่รอเก้อครบเวลา"""
    for _ in range(seconds * 2):
        if proc.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(f"{BASE}/docs", timeout=1):
                return True
        except Exception:
            time.sleep(0.5)
    return False


def main() -> int:
    if not EXE.exists():
        print(f"✗ ยังไม่มีไฟล์ที่แพ็ก: {EXE}")
        print("  แพ็กก่อนด้วย:  python scripts/แพ็กเป็นโปรแกรม.py")
        return 1

    print(f"ไฟล์ที่จะทดสอบ · {EXE.name} · {EXE.stat().st_size / 1024 / 1024:.0f} MB\n")

    # โฟลเดอร์เปล่านอกโปรเจกต์ — ไม่มีซอร์ส ไม่มี venv ไม่มี requirements
    room = Path(tempfile.mkdtemp(prefix="sentiara-clean-"))
    target = room / EXE.name
    shutil.copyfile(EXE, target)
    # ถ้ามีใครถือพอร์ตนี้อยู่ก่อน เทสจะไปคุยกับตัวนั้นแล้วรายงานว่าผ่าน
    # ทั้งที่ .exe ที่เพิ่งแพ็กอาจเปิดไม่ขึ้นเลย — เคยโดนมาแล้ว
    import socket
    with socket.socket() as sk:
        sk.settimeout(0.6)
        if sk.connect_ex(("127.0.0.1", 8900)) == 0:
            print("✗ พอร์ต 8900 มีคนใช้อยู่ก่อนแล้ว — ปิดตัวนั้นก่อน")
            print("  หาว่าใครถือ:  Get-NetTCPConnection -LocalPort 8900 -State Listen")
            return 1

    print(f"ห้องทดลอง: {room}")
    print("ไฟล์ในห้อง:", [p.name for p in room.iterdir()], "\n")

    # ตัดทางไม่ให้เผลอหยิบโค้ดจากโปรเจกต์ผ่านตัวแปรสภาพแวดล้อม
    env = {k: v for k, v in os.environ.items()
           if k not in ("PYTHONPATH", "PYTHONHOME", "PMS_DB", "PMS_ORIGINS")}

    proc = subprocess.Popen(
        [str(target)], cwd=room, env=env,
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )

    # อ่าน stdout ไปเรื่อย ๆ ในอีกเธรด — ต้องเก็บบัตรกับรหัสที่ตัวติดตั้งพิมพ์ออกมา
    # และถ้าไม่อ่าน ไปป์จะเต็มแล้วโปรแกรมค้างเงียบ ๆ
    said: list[str] = []

    def drain() -> None:
        for raw in iter(proc.stdout.readline, b""):
            said.append(raw.decode("utf-8", "replace").rstrip())

    threading.Thread(target=drain, daemon=True).start()
    try:
        proc.stdin.write(b"\n")     # ตัวติดตั้งรอให้กด Enter หลังโชว์รหัส
        proc.stdin.flush()
    except OSError:
        pass

    checks: list[tuple[str, bool, str]] = []
    if not wait_up(proc):
        print("✗ เปิดไม่ขึ้น · ข้อความจากโปรแกรม:\n")
        print("\n".join(said[-40:]))
        proc.kill()
        return 1

    try:
        code, _ = call("/docs")
        checks.append(("หน้าคู่มือ API เปิดได้", code == 200, f"HTTP {code}"))

        code, body = call("/")
        html = isinstance(body, str) and "<div id=\"root\"" in body
        checks.append(("เปิดแล้วได้หน้าจอ ไม่ใช่หน้าเปล่า", code == 200 and html,
                       f"HTTP {code} · {len(body) if isinstance(body, str) else 0} ไบต์"))

        code, _ = call("/api/v1/rooms")
        checks.append(("ยังไม่ล็อกอิน ต้องไม่ให้ดูห้อง", code in (401, 403), f"HTTP {code}"))

        db = room / "data" / "pms.db"
        checks.append(("สร้างฐานข้อมูลข้างตัวโปรแกรม", db.exists(),
                       f"{db.stat().st_size / 1024:.0f} KB" if db.exists() else "ไม่พบ"))

        # บัตรกับรหัสที่ตัวติดตั้งพิมพ์ออกมา หน้าตา:  T-OWN    123456   owner  ชื่อ
        creds = [m.groups() for line in said
                 if (m := re.match(r"\s+([A-Z][\w-]{2,10})\s+(\d{4,8})\s+(\w+)\s", line))]
        checks.append(("ตัวติดตั้งบอกบัตรและรหัสให้จด", len(creds) >= 1,
                       f"{len(creds)} บัญชี" if creds else "ไม่เจอในข้อความ"))

        token = ""
        if creds:
            card, pin, role = creds[0]
            code, body = call("/api/v1/auth/login", data={"card": card, "pin": pin})
            token = body.get("token", "") if isinstance(body, dict) else ""
            checks.append((f"ล็อกอินด้วยบัตร {card} ({role})", code == 200 and bool(token),
                           f"HTTP {code}"))

        if token:
            code, body = call("/api/v1/rooms", token=token)
            n = len(body) if isinstance(body, list) else len(body.get("rooms", [])) \
                if isinstance(body, dict) else 0
            checks.append(("ล็อกอินแล้วเรียกดูห้องได้", code == 200 and n > 0, f"{n} ห้อง"))
    finally:
        proc.kill()
        try:
            proc.wait(timeout=10)
        except Exception:
            pass

    print("ผลตรวจ")
    for name, good, note in checks:
        print(f"  {'ผ่าน  ' if good else 'ไม่ผ่าน ✗'} {name:<36} {note}")

    bad = [c for c in checks if not c[1]]
    print(f"\nห้องทดลองยังอยู่ที่ {room} (ลบเองได้)")
    if bad:
        print(f"\n✗ ไม่ผ่าน {len(bad)} ข้อ")
        return 1
    print("\n✓ ผ่านทุกข้อ — ไฟล์เดียวนี้เอาไปวางเครื่องลูกค้าแล้วดับเบิลคลิกได้")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

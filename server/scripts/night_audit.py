"""งานปิดยอดรายคืน — กวาดเหตุการณ์ของวันทำการเข้าคิว แล้วส่งเข้าระบบบัญชี

    cd server
    python scripts/night_audit.py                 # ดูอย่างเดียว ไม่ส่งออกจริง
    LEDGER_DRY_RUN=0 python scripts/night_audit.py # ส่งจริง
    python scripts/night_audit.py --date 2026-09-08

ตั้งเป็นงานตามเวลาให้รันวันละครั้งหลังปิดรอบวันทำการ

กุญแจอ่านจากตัวแปรสภาพแวดล้อม ไม่ฝังในโค้ด
--------------------------------------------
    LEDGER_TOKEN     กุญแจเครื่องจักร ขึ้นต้นด้วย lbk_
    LEDGER_SOURCE    ต้องตรงกับ source ของกุญแจ (ค่าเริ่มต้น sentiara)
    LEDGER_URL       เว้นว่างไว้ = ให้ไล่หาพอร์ตเองแล้วยืนยันด้วยกุญแจ
    LEDGER_DRY_RUN   1 (ค่าเริ่มต้น) = เตรียมของแต่ไม่ยิงออก

กุญแจที่หลุดขึ้น git ต้องถือว่ารั่วถาวร ให้เพิกถอนแล้วออกใหม่
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

from pms import clock                                        # noqa: E402
from pms.ledger import LedgerClient, collect, outbox_summary  # noqa: E402
from pms.session import session_factory, settings, setup  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description="ปิดยอดรายคืนและส่งเข้าระบบบัญชี")
    ap.add_argument("--date", help="วันทำการ YYYY-MM-DD (ค่าเริ่มต้น: วันนี้ตามเวลาไทย)")
    ap.add_argument("--collect-only", action="store_true",
                    help="กวาดเข้าคิวอย่างเดียว ไม่ส่ง")
    args = ap.parse_args()

    setup()
    db = session_factory()()
    try:
        day = date.fromisoformat(args.date) if args.date else clock.today()
        print(f"วันทำการ {day}")

        made = collect(db, day, settings.vat_pct)
        print("กวาดเข้าคิว:", json.dumps(made, ensure_ascii=False))
        if made["errors"]:
            print("  ⚠ มีรายการที่ประกอบไม่ได้ — ต้องแก้ก่อน ไม่ใช่รอให้หายเอง")

        print("คิวตอนนี้ :", json.dumps(outbox_summary(db), ensure_ascii=False))
        if args.collect_only:
            return 0

        client = LedgerClient()
        if client.dry_run:
            print("\ndry-run · ไม่ได้ส่งออกจริง (ตั้ง LEDGER_DRY_RUN=0 เพื่อส่งจริง)")
        out = client.send_pending(db)
        print("ผลการส่ง:", json.dumps(out, ensure_ascii=False)[:600])

        if out["realigned"]:
            print(f"  หมายเหตุ: ออกลำดับใหม่ {out['realigned']} รายการให้พ้น watermark ของปลายทาง")
        if out["failed"]:
            print("  ✗ ส่งไม่สำเร็จ — ของยังอยู่ในคิว ส่งซ้ำได้ปลอดภัย")
            return 1

        print("\nส่งแล้วไม่ได้แปลว่าลงบัญชีแล้ว — ไปดูสถานะจริงที่หน้า")
        print("'งานค้างจาก PMS' ในโปรแกรมบัญชี ถ้ายังไม่ได้ตั้งกฎลงบัญชี")
        print("รายการจะค้างอยู่ตรงนั้น ซึ่งถูกต้องแล้ว ไม่ใช่ความผิดพลาด")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

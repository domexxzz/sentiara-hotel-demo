"""ข้อมูลตั้งต้น — ผังห้อง 43 ห้องตามใบเสนอราคา และตัวอย่างให้ลองกดได้ทันที

    cd server
    python -m pms.seed              # ผังห้อง + ตัวอย่างการเข้าพักและรายจ่าย
    python -m pms.seed --rooms-only # ผังห้องอย่างเดียว ไม่มีตัวอย่าง
    python -m pms.seed --reset      # ล้างของเดิมแล้วสร้างใหม่

ราคาและชื่อประเภทห้องตรงกับหน้าจอเดโม (`src/data.ts`) ตั้งใจให้ตรงกัน
เพื่อให้ย้าย frontend มาต่อหลังบ้านตัวจริงได้ทีละจอโดยตัวเลขไม่เพี้ยน

ตัวอย่างการเข้าพักจงใจสร้างให้ **จบครบวงจร** — จอง เข้าพัก ลงอาหาร รับชำระ
ปิดบิล ออกใบกำกับภาษี — เพื่อให้มีของจริงรอส่งเข้าระบบบัญชีตั้งแต่นาทีแรก
ไม่ต้องมานั่งกดสร้างเองก่อนถึงจะทดสอบการเชื่อมต่อได้
"""
from __future__ import annotations

import sys

# หน้าต่างคำสั่งของวินโดวส์ไทยใช้โค้ดเพจ 874 ซึ่งพิมพ์จุดกลาง (·) ไม่ได้
# ถ้าไม่ตั้งบรรทัดนี้ สคริปต์จะพังตอน print ทั้งที่สร้างข้อมูลสำเร็จไปแล้ว
# ซึ่งชวนให้เข้าใจผิดว่า seed ไม่ผ่าน (ดักไว้เผื่อ stdout ถูกแทนที่ตอนเรียกจากที่อื่น)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

import argparse
from datetime import timedelta

from sqlalchemy import delete, select

from pms import booking as bk
from pms import clock
from pms import folio as fo
from pms.db import (Booking, Charge, Expense, Folio, LedgerOutbox, Payment, Room,
                    RoomNight, RoomType, TaxInvoice)
from pms.money import baht
from pms.session import session_factory, settings

#: ประเภทห้อง · ราคาตรงกับ src/data.ts ของหน้าจอเดโม
ROOM_TYPES = [
    ("deluxe", "ดีลักซ์", 1650, 1875),
    ("superior", "ซูพีเรียร์", 1350, 1530),
    ("dorm", "รายเตียง (ดอร์ม)", 450, 520),
]

#: ผังห้อง 43 ห้อง — จำนวนตรงกับใบเสนอราคา (กลอน NFC ห้องละ ฿4,000 × 43)
FLOORS = [
    ("1", "deluxe", [f"1{n:02d}" for n in range(1, 11)]),      # 101–110
    ("2", "superior", [f"2{n:02d}" for n in range(1, 13)]),    # 201–212
    ("3", "superior", [f"3{n:02d}" for n in range(1, 13)]),    # 301–312
    ("4", "dorm", [f"D{n:02d}" for n in range(1, 10)]),        # D01–D09
]


def wipe(db) -> None:
    """ล้างของเดิม — ลบเรียงจากลูกไปหาแม่ ไม่งั้นคีย์นอกจะขวาง"""
    for model in (LedgerOutbox, TaxInvoice, Payment, Charge, Folio,
                  RoomNight, Booking, Expense, Room, RoomType):
        db.execute(delete(model))
    db.commit()


def seed_rooms(db) -> int:
    if db.scalar(select(Room).limit(1)):
        print("  มีผังห้องอยู่แล้ว ข้าม (ใช้ --reset ถ้าอยากสร้างใหม่)")
        return 0

    types = {}
    for code, name, rate, ota in ROOM_TYPES:
        rt = RoomType(code=code, name=name,
                      rate_satang=baht(rate), ota_satang=baht(ota))
        db.add(rt)
        types[code] = rt
    db.flush()

    n = 0
    for floor, code, numbers in FLOORS:
        for no in numbers:
            db.add(Room(no=no, room_type_id=types[code].id, floor=floor))
            n += 1
    db.commit()
    return n


def seed_demo(db) -> None:
    """หนึ่งการเข้าพักที่จบครบวงจร + หนึ่งที่ยังพักอยู่ + รายจ่ายประจำเดือน"""
    today = clock.today()

    # ── เข้าพักที่จบแล้ว · มีของรอส่งเข้าบัญชีทันที ──────────────────
    past = bk.create_booking(
        db, "101", "คุณอนันต์ ศรีสุข",
        today - timedelta(days=3), today - timedelta(days=1),
        adults=2, source="direct", guest_phone="081-234-5678",
        weekend_pct=settings.weekend_pct, deposit_pct=settings.deposit_pct,
    )
    f = fo.get_folio(db, past.ref)
    fo.add_charge(db, f, "fnb", "ลาเต้ · คาเฟ่", baht(65), qty=2)
    fo.add_charge(db, f, "service", "ซักรีด", baht(40), qty=3)
    fo.add_charge(db, f, "discount", "ส่วนลดลูกค้าเก่า", baht(200))
    t = fo.totals(db, f)
    fo.add_payment(db, f, "transfer", t.gross)
    fo.close_folio(db, f)
    inv = fo.issue_tax_invoice(
        db, f, buyer_name="บริษัท เชียงใหม่ทัวร์ จำกัด",
        buyer_taxid="0505560001234",
        buyer_address="88/9 ถ.นิมมานเหมินท์ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200",
        vat_pct=settings.vat_pct,
    )
    print(f"  เข้าพักจบแล้ว   {past.ref} · ใบกำกับภาษี {inv.number}")

    # ── ยังพักอยู่ · บิลยังเปิด ยังไม่เข้าบัญชี ──────────────────────
    stay = bk.create_booking(
        db, "201", "คุณมาลี ทองดี", today, today + timedelta(days=2),
        adults=1, source="ota", guest_phone="089-876-5432",
        weekend_pct=settings.weekend_pct, deposit_pct=settings.deposit_pct,
    )
    bk.check_in_booking(db, stay.ref)
    print(f"  ยังพักอยู่      {stay.ref} · ห้อง 201")

    # ── รายจ่าย · ครบทั้งจ่ายแล้วและยังค้าง ─────────────────────────
    for at, cat, label, amount, paid, due in [
        (today - timedelta(days=5), "payroll", "เงินเดือนพนักงาน", 84000, True, None),
        (today - timedelta(days=4), "electricity", "ค่าไฟฟ้า", 18500, True, None),
        (today - timedelta(days=2), "ota", "ค่าคอมมิชชัน OTA", 6200, False,
         today + timedelta(days=25)),
        (today - timedelta(days=1), "supplies", "ผ้าปูและของใช้ในห้อง", 9800, False,
         today + timedelta(days=14)),
    ]:
        db.add(Expense(at=at, category=cat, label=label,
                       amount_satang=baht(amount), paid=paid, due=due))
    db.commit()
    print("  รายจ่าย         4 รายการ (จ่ายแล้ว 2 · ค้าง 2)")


def main() -> None:
    ap = argparse.ArgumentParser(description="สร้างข้อมูลตั้งต้นของ PMS")
    ap.add_argument("--reset", action="store_true", help="ล้างของเดิมก่อน")
    ap.add_argument("--rooms-only", action="store_true", help="ผังห้องอย่างเดียว")
    args = ap.parse_args()

    db = session_factory()()
    try:
        if args.reset:
            wipe(db)
            print("ล้างข้อมูลเดิมแล้ว")
        n = seed_rooms(db)
        if n:
            print(f"  ผังห้อง         {n} ห้อง · {len(ROOM_TYPES)} ประเภท")
        if not args.rooms_only and not db.scalar(select(Booking).limit(1)):
            seed_demo(db)
        print("เสร็จ · เปิดเซิร์ฟเวอร์ด้วย  uvicorn pms.app:app --reload")
    finally:
        db.close()


if __name__ == "__main__":
    main()

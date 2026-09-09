"""ทะเบียนผู้พักและการแจ้งที่พักคนต่างด้าว

สองเรื่องนี้ **กฎหมายบังคับ ไม่ใช่ของแถม**
--------------------------------------------
* **ม.35 พ.ร.บ.โรงแรม พ.ศ. 2547** — ผู้จัดการโรงแรมต้องจัดให้มีบัตรทะเบียน
  ผู้พัก (ร.ร.3) และทะเบียนผู้พัก (ร.ร.4) ทันทีที่รับผู้พัก และเก็บไว้ให้
  นายทะเบียนตรวจได้
* **ม.38 พ.ร.บ.คนเข้าเมือง พ.ศ. 2522** — เจ้าบ้านหรือผู้จัดการโรงแรมที่รับ
  คนต่างด้าวเข้าพัก ต้องแจ้งต่อพนักงานเจ้าหน้าที่ **ภายใน 24 ชั่วโมง**
  นับแต่เวลาที่คนต่างด้าวเข้าพัก (แบบ ตม.30)

ระบบต่างประเทศไม่มีสองอย่างนี้ให้ และเป็นเหตุผลหลักที่โรงแรมไทยต้องใช้ระบบไทย

สิ่งที่ไฟล์นี้ทำและไม่ทำ
------------------------
ทำ — เก็บข้อมูลให้ครบตามแบบ ตรวจความถูกต้อง จับเวลา 24 ชั่วโมง และบอกว่า
     ใบไหนใกล้ครบกำหนดแล้ว

**ไม่ทำ — ยังไม่ได้ต่อระบบของกรมการปกครองและสำนักงานตรวจคนเข้าเมืองจริง**
การกด "แจ้งแล้ว" บันทึกสถานะไว้ในเครื่องเท่านั้น การต่อระบบราชการต้องมี
บัญชีผู้ใช้และข้อตกลงกับหน่วยงาน ซึ่งเป็นงานติดตั้ง ไม่ใช่งานเขียนโปรแกรม
"""
from __future__ import annotations

import re
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from pms import clock
from pms.db import Booking, GuestRegister

#: กฎหมายให้เวลา 24 ชั่วโมงนับแต่คนต่างด้าวเข้าพัก
TM30_HOURS = 24

#: เตือนล่วงหน้าเมื่อเหลือเวลาน้อยกว่านี้ · หกชั่วโมงพอให้คนกะดึกจัดการทัน
TM30_WARN_HOURS = 6


class RegistryError(Exception):
    pass


def _clean_id(v: str) -> str:
    return re.sub(r"[\s-]", "", v or "")


def valid_thai_id(v: str) -> bool:
    """เลขบัตรประชาชนไทย 13 หลักพร้อมหลักตรวจสอบ

    ตรวจหลักสุดท้ายจริง ไม่ใช่แค่นับหลัก — เลขที่พิมพ์ผิดหนึ่งตัวจะผ่านการ
    นับหลักทุกครั้ง แล้วไปโผล่เป็นทะเบียนที่นายทะเบียนตรวจแล้วไม่ตรงกับใคร
    """
    s = _clean_id(v)
    if len(s) != 13 or not s.isdigit():
        return False
    total = sum(int(s[i]) * (13 - i) for i in range(12))
    return (11 - total % 11) % 10 == int(s[12])


def register(
    db: Session, ref: str, *,
    full_name: str,
    nationality: str,
    id_type: str,
    id_number: str,
    birth_date: date | None = None,
    address: str = "",
    arrived_from: str = "",
    phone: str = "",
) -> GuestRegister:
    """ลงทะเบียนผู้พักหนึ่งราย · ทำทันทีที่รับเข้าพักตามที่ ม.35 กำหนด"""
    b = db.scalar(select(Booking).where(Booking.ref == ref))
    if b is None:
        raise RegistryError(f"ไม่พบการจอง {ref}")
    if b.status == "cancelled":
        raise RegistryError("การจองถูกยกเลิกแล้ว ลงทะเบียนผู้พักไม่ได้")
    if db.scalar(select(GuestRegister).where(GuestRegister.booking_id == b.id)):
        raise RegistryError(f"การจอง {ref} ลงทะเบียนผู้พักไปแล้ว")

    if not full_name.strip():
        raise RegistryError("ต้องระบุชื่อ-สกุลผู้พัก")
    if id_type not in ("thai_id", "passport"):
        raise RegistryError("ประเภทเอกสารต้องเป็นบัตรประชาชนหรือหนังสือเดินทาง")

    num = _clean_id(id_number)
    if not num:
        raise RegistryError("ต้องระบุเลขเอกสารแสดงตน")
    if id_type == "thai_id" and not valid_thai_id(num):
        raise RegistryError(
            "เลขบัตรประชาชนไม่ถูกต้อง — หลักตรวจสอบไม่ตรง "
            "(พิมพ์ผิดหนึ่งตัวก็ตรวจจับได้ตรงนี้ ดีกว่าไปเจอตอนนายทะเบียนตรวจ)"
        )
    if id_type == "passport" and not (6 <= len(num) <= 20):
        raise RegistryError("เลขหนังสือเดินทางต้องยาว 6–20 อักขระ")

    # คนต่างด้าวคือคนที่ไม่ได้ถือสัญชาติไทย — ตัดสินจากสัญชาติ ไม่ใช่จากชนิดเอกสาร
    # เพราะคนไทยที่ถือพาสปอร์ตมาเช็กอินก็ยังเป็นคนไทย ไม่ต้องแจ้ง ตม.30
    foreign = nationality.strip().lower() not in ("ไทย", "thai", "thailand", "th")

    row = GuestRegister(
        booking_id=b.id,
        full_name=full_name.strip(),
        nationality=nationality.strip() or "ไทย",
        id_type=id_type,
        id_number=num,
        birth_date=birth_date,
        address=address.strip(),
        arrived_from=arrived_from.strip(),
        phone=phone.strip(),
        foreign=foreign,
        # นาฬิกาเดินตั้งแต่ "เวลาที่คนต่างด้าวเข้าพัก" ไม่ใช่เวลาที่พนักงานกรอกฟอร์ม
        tm30_due=(clock.now() + timedelta(hours=TM30_HOURS)) if foreign else None,
    )
    db.add(row)
    db.flush()
    return row


def mark_tm30_sent(db: Session, ref: str, receipt: str = "") -> GuestRegister:
    """บันทึกว่าแจ้ง ตม.30 แล้ว

    ⚠ **บันทึกสถานะในเครื่องเท่านั้น ยังไม่ได้ยิงเข้าระบบ ตม. จริง**
    เก็บเลขรับเรื่องที่ได้จากระบบราชการไว้ด้วย เพื่อให้ตรวจย้อนได้ว่าแจ้งจริง
    """
    row = _row(db, ref)
    if not row.foreign:
        raise RegistryError("ผู้พักรายนี้ไม่ใช่คนต่างด้าว ไม่ต้องแจ้ง ตม.30")
    if row.tm30_sent_at is not None:
        raise RegistryError(f"แจ้ง ตม.30 ของ {ref} ไปแล้วเมื่อ {row.tm30_sent_at}")
    row.tm30_sent_at = clock.now()
    row.tm30_receipt = receipt.strip()
    db.flush()
    return row


def _row(db: Session, ref: str) -> GuestRegister:
    row = db.scalar(
        select(GuestRegister).join(Booking).where(Booking.ref == ref)
    )
    if row is None:
        raise RegistryError(f"ยังไม่ได้ลงทะเบียนผู้พักของการจอง {ref}")
    return row


def tm30_pending(db: Session) -> list[dict]:
    """คนต่างด้าวที่ยังไม่ได้แจ้ง · เรียงตามที่ใกล้ครบกำหนดที่สุดก่อน

    เรียงแบบนี้เพราะรายการที่เหลือเวลาน้อยที่สุดคือรายการที่ต้องทำก่อน —
    ไม่ใช่รายการที่เข้าพักก่อน
    """
    now = clock.now()
    rows = db.scalars(
        select(GuestRegister)
        .where(GuestRegister.foreign == True,          # noqa: E712
               GuestRegister.tm30_sent_at.is_(None))
        .order_by(GuestRegister.tm30_due)
    ).all()
    out = []
    for r in rows:
        left = (r.tm30_due - now).total_seconds() / 3600 if r.tm30_due else 0
        b = db.get(Booking, r.booking_id)
        out.append({
            "ref": b.ref if b else "",
            "room": b.room.no if b else "",
            "name": r.full_name,
            "nationality": r.nationality,
            "passport": r.id_number,
            "due": r.tm30_due,
            "hours_left": round(left, 1),
            "overdue": left < 0,
            "urgent": 0 <= left <= TM30_WARN_HOURS,
        })
    return out


def rr4(db: Session, since: date, until: date) -> list[dict]:
    """ทะเบียนผู้พัก ร.ร.4 · เล่มที่นายทะเบียนขอดู

    เรียงตามวันเข้าพักและเลขห้อง ซึ่งเป็นลำดับที่เล่มกระดาษใช้มาตลอด —
    คนที่เคยตรวจเล่มจริงจะหาของเจอทันทีโดยไม่ต้องเรียนรู้อะไรใหม่
    """
    rows = db.scalars(
        select(GuestRegister)
        .join(Booking)
        .where(Booking.check_in >= since, Booking.check_in <= until)
        .order_by(Booking.check_in, Booking.room_id)
    ).all()
    out = []
    for r in rows:
        b = db.get(Booking, r.booking_id)
        out.append({
            "ref": b.ref, "room": b.room.no,
            "check_in": b.check_in, "check_out": b.check_out,
            "name": r.full_name, "nationality": r.nationality,
            "id_type": r.id_type, "id_number": r.id_number,
            "birth_date": r.birth_date, "address": r.address,
            "arrived_from": r.arrived_from,
            "foreign": r.foreign,
            "tm30_sent_at": r.tm30_sent_at,
        })
    return out

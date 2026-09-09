"""ทะเบียนผู้พัก — ร.ร.3 · ร.ร.4 · ตม.30

ทำไมต้องมี ทั้งที่ไม่เกี่ยวกับเงิน
------------------------------------
ม.35 พ.ร.บ.โรงแรม พ.ศ. 2547 บังคับให้มีทะเบียนผู้พัก บันทึกให้แล้วเสร็จ
**ภายใน 24 ชั่วโมง** นับแต่เวลาที่เข้าพัก และเก็บไว้ไม่น้อยกว่าหนึ่งปี
ม.38 พ.ร.บ.คนเข้าเมือง พ.ศ. 2522 บังคับให้แจ้งที่พักของคนต่างด้าวภายใน 24 ชั่วโมง

ทั้งสองข้อมีโทษ และทั้งสองข้อวัดจาก **เวลา** ไม่ใช่จากความตั้งใจ
ระบบจึงต้องบอกได้ตลอดว่า *ตอนนี้เหลือเวลาเท่าไร* ไม่ใช่แค่เก็บข้อมูลไว้เฉย ๆ

สิ่งที่ไฟล์นี้ทำต่างจากหน้าจอเดโม
-----------------------------------
หน้าจอเดโมเก็บสัญชาติเป็น "ไทย/ต่างชาติ" และถือว่าหนึ่งการจอง = หนึ่งแถว
ซึ่งใช้จริงไม่ได้สองเรื่อง

1. **กฎหมายลงทะเบียนผู้พัก ไม่ใช่ผู้จอง** — จองหนึ่งใบมีผู้ใหญ่สองคน
   ต้องมีสองแถว การนับหัวจาก `booking.adults` แล้วลงชื่อคนจองซ้ำ ๆ ไม่ผ่านการตรวจ
2. **ตม.30 ต้องรู้สัญชาติจริงและเลขหนังสือเดินทาง** ไม่ใช่แค่ธงว่าต่างชาติ

**สิ่งที่ยังทำไม่ได้จริง** — การยื่น ตม.30 ต้องผ่านระบบของสำนักงานตรวจคนเข้าเมือง
ตรงนี้บันทึกว่ายื่นแล้วเมื่อไรและได้เลขรับอะไร **แต่ไม่ได้ยิงเข้าระบบ ตม. เอง**
ใครอ่านโค้ดนี้ต้องรู้ว่ายังต้องมีคนไปกรอกในระบบเขาอยู่
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from pms import clock
from pms.db import AuditLog, Booking, GuestRegistration

#: กฎหมายทั้งสองฉบับให้เวลาเท่ากัน — 24 ชั่วโมงนับแต่เวลาที่เข้าพัก
DEADLINE = timedelta(hours=24)

#: เตือนเมื่อเหลือเวลาน้อยกว่านี้ · หกชั่วโมงพอให้กะกันได้ในรอบเวรเดียว
WARN_WITHIN = timedelta(hours=6)


class RegistryError(Exception):
    pass


def audit(db: Session, action: str, entity: str, entity_id: str | int,
          detail: str = "", actor: str = "system") -> AuditLog:
    """เขียนร่องรอยก่อนเสมอ · ไม่มีเส้นทางไหนลบหรือแก้แถวนี้ได้"""
    row = AuditLog(actor=actor, action=action, entity=entity,
                   entity_id=str(entity_id), detail=detail[:600])
    db.add(row)
    return row


# ── ลงทะเบียน ────────────────────────────────────────────────────────
def register_guest(
    db: Session, booking: Booking, *,
    full_name: str, nationality: str = "TH", id_number: str = "",
    id_kind: str = "", occupation: str = "", address: str = "",
    came_from: str = "", going_to: str = "", actor: str = "system",
) -> GuestRegistration:
    """ลงทะเบียนผู้พักหนึ่งคน

    เลขประจำตัวบังคับ เพราะทั้ง ร.ร.4 และ ตม.30 ต้องใช้ ปล่อยว่างไว้ก่อน
    แล้วค่อยตามเก็บทีหลังคือวิธีที่ทำให้ถึงกำหนดแล้วยังกรอกไม่ครบ
    """
    if not full_name.strip():
        raise RegistryError("ต้องระบุชื่อผู้พัก")
    nationality = (nationality or "TH").upper()[:2]
    kind = id_kind or ("national_id" if nationality == "TH" else "passport")

    num = id_number.replace("-", "").strip()
    if not num:
        raise RegistryError("ต้องระบุเลขประจำตัวประชาชนหรือเลขหนังสือเดินทาง")
    if kind == "national_id" and len(num) != 13:
        raise RegistryError("เลขประจำตัวประชาชนต้องมี 13 หลัก")

    g = GuestRegistration(
        booking_id=booking.id, full_name=full_name.strip(),
        nationality=nationality, id_number=num, id_kind=kind,
        occupation=occupation.strip(), address=address.strip(),
        came_from=came_from.strip(), going_to=going_to.strip(),
        arrived_at=clock.now(),
    )
    db.add(g)
    db.flush()
    audit(db, "register_guest", "guest_registration", g.id,
          f"{g.full_name} · {g.nationality} · จอง {booking.ref}", actor)
    db.commit()
    db.refresh(g)
    return g


def sign_rr3(db: Session, reg: GuestRegistration, actor: str = "system") -> GuestRegistration:
    """ผู้พักลงลายมือชื่อในบัตร ร.ร.3

    **ยังไม่ได้เก็บภาพลายมือชื่อ** — เก็บแค่เวลาที่เซ็น ถ้าจะใช้เป็นหลักฐานจริง
    ต้องมีที่เก็บภาพหรือลายเซ็นดิจิทัลเพิ่ม อย่าเข้าใจผิดว่าครบแล้ว
    """
    if reg.rr3_signed_at:
        raise RegistryError("บัตรใบนี้ลงลายมือชื่อไปแล้ว")
    reg.rr3_signed_at = clock.now()
    audit(db, "sign_rr3", "guest_registration", reg.id, reg.full_name, actor)
    db.commit()
    return reg


# ── กำหนดเวลา ────────────────────────────────────────────────────────
@dataclass
class Due:
    reg: GuestRegistration
    deadline: datetime
    remaining: timedelta
    overdue: bool
    urgent: bool
    needs: list[str]

    @property
    def hours_left(self) -> float:
        return round(self.remaining.total_seconds() / 3600, 1)


def _needs(reg: GuestRegistration) -> list[str]:
    todo = []
    if reg.rr3_signed_at is None:
        todo.append("ร.ร.3")
    if reg.rr4_filed_at is None:
        todo.append("ร.ร.4")
    if reg.nationality != "TH" and reg.tm30_filed_at is None:
        todo.append("ตม.30")
    return todo


def outstanding(db: Session, now: datetime | None = None) -> list[Due]:
    """ใครยังทำไม่ครบ และเหลือเวลาเท่าไร · เรียงจากใกล้หมดเวลาที่สุด

    นี่คือสิ่งที่ทำให้ระบบมีประโยชน์จริง — เก็บข้อมูลครบแต่ไม่มีใครรู้ว่า
    เหลือเวลาเท่าไร สุดท้ายก็ถึงกำหนดแล้วยังไม่ได้ยื่นอยู่ดี
    """
    now = now or clock.now()
    out = []
    for reg in db.scalars(select(GuestRegistration).order_by(GuestRegistration.arrived_at)):
        todo = _needs(reg)
        if not todo:
            continue
        deadline = reg.arrived_at + DEADLINE
        left = deadline - now
        out.append(Due(reg=reg, deadline=deadline, remaining=left,
                       overdue=left.total_seconds() < 0,
                       urgent=timedelta() <= left <= WARN_WITHIN,
                       needs=todo))
    return sorted(out, key=lambda d: d.remaining)


# ── ยื่นเอกสาร ───────────────────────────────────────────────────────
def file_rr4(db: Session, day: date | None = None, actor: str = "system") -> dict:
    """ส่ง ร.ร.4 ของวันหนึ่งให้นายทะเบียน

    ส่งเฉพาะคนที่เซ็น ร.ร.3 แล้ว — ร.ร.4 คือการรวบรวมสิ่งที่ผู้พักลงชื่อไว้
    ถ้าส่งโดยยังไม่มีลายมือชื่อ เอกสารที่ส่งไปก็ไม่มีฐานรองรับ
    """
    day = day or clock.today()
    rows = [r for r in db.scalars(select(GuestRegistration)
                                  .where(GuestRegistration.rr4_filed_at.is_(None)))
            if r.arrived_at.date() == day]

    ready = [r for r in rows if r.rr3_signed_at is not None]
    waiting = [r for r in rows if r.rr3_signed_at is None]
    if not ready:
        return {"filed": 0, "batch": "", "waiting_rr3": len(waiting), "date": day}

    batch = f"RR4-{day.isoformat()}"
    now = clock.now()
    for r in ready:
        r.rr4_filed_at = now
        r.rr4_batch = batch
    audit(db, "file_rr4", "batch", batch,
          f"ส่ง {len(ready)} ราย · วันที่ {day.isoformat()}", actor)
    db.commit()
    return {"filed": len(ready), "batch": batch,
            "waiting_rr3": len(waiting), "date": day}


def file_tm30(db: Session, reg: GuestRegistration, receipt: str,
              actor: str = "system") -> GuestRegistration:
    """บันทึกว่าแจ้ง ตม.30 แล้ว พร้อมเลขรับจากระบบตรวจคนเข้าเมือง

    **ไม่ได้ยิงเข้าระบบ ตม. เอง** — ยังต้องมีคนไปกรอกในระบบเขา แล้วเอาเลขรับ
    กลับมาบันทึกที่นี่ ถ้าไม่บังคับให้ใส่เลขรับ ระบบจะบอกว่า "แจ้งแล้ว" ได้
    ทั้งที่ไม่มีใครแจ้ง ซึ่งอันตรายกว่าไม่มีระบบเลย
    """
    if reg.nationality == "TH":
        raise RegistryError("ตม.30 ใช้กับคนต่างด้าวเท่านั้น")
    if reg.tm30_filed_at:
        raise RegistryError("รายนี้แจ้ง ตม.30 ไปแล้ว")
    if not receipt.strip():
        raise RegistryError("ต้องระบุเลขรับจากระบบตรวจคนเข้าเมือง")
    reg.tm30_filed_at = clock.now()
    reg.tm30_receipt = receipt.strip()
    audit(db, "file_tm30", "guest_registration", reg.id,
          f"{reg.full_name} · {reg.nationality} · เลขรับ {reg.tm30_receipt}", actor)
    db.commit()
    return reg


def rr4_book(db: Session, since: date | None = None) -> list[GuestRegistration]:
    """เล่มทะเบียนผู้พัก · กฎหมายให้เก็บไม่น้อยกว่าหนึ่งปี จึงคืนทั้งหมดถ้าไม่ระบุ"""
    q = select(GuestRegistration).order_by(GuestRegistration.arrived_at.desc())
    rows = list(db.scalars(q))
    if since:
        rows = [r for r in rows if r.arrived_at.date() >= since]
    return rows

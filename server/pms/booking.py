"""เอนจินการจอง — หาห้องว่าง จอง เช็กอิน เช็กเอาต์

หัวใจอยู่ที่ `create_booking()` ซึ่ง **ไม่เช็กว่าห้องว่างก่อนบันทึก**
แต่ยิง INSERT ลง `room_night` แล้วปล่อยให้คีย์ไม่ซ้ำเป็นคนปฏิเสธ
วิธีนี้ปลอดภัยแม้มีคำขอเข้ามาพร้อมกันหลายเส้น เพราะการตัดสินอยู่ในฐานข้อมูล
ไม่ได้อยู่ในโค้ดที่อาจถูกแทรกกลางคัน

`availability()` มีไว้ให้หน้าจอแสดงผลเท่านั้น **ห้ามใช้ผลของมันมาตัดสินใจแทนการจอง**
เพราะระหว่างที่คนดูหน้าจออยู่ ห้องอาจถูกจองไปแล้ว
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from pms.db import Booking, Folio, Room, RoomNight, RoomType
from pms.money import pct_of
from pms.rates import nightly_rates


class RoomNotAvailable(Exception):
    """ห้องถูกจองไปแล้วในช่วงที่ขอ · บอกคืนที่ชนมาด้วยเพื่อให้เสนอทางเลือกได้"""

    def __init__(self, room_no: str, nights: list[date] | None = None) -> None:
        self.room_no = room_no
        self.nights = nights or []
        super().__init__(f"ห้อง {room_no} ไม่ว่างในช่วงที่ขอ")


class BookingError(Exception):
    pass


def nights_between(check_in: date, check_out: date) -> list[date]:
    """คืนที่ต้องกันห้อง — นับวันเข้าพัก ไม่นับวันที่ออก

    แขกเข้า 9 ออก 11 = กันคืนของวันที่ 9 กับ 10 · วันที่ 11 ขายให้คนอื่นได้เลย
    ถ้านับวันออกด้วยจะเสียรายได้ไปหนึ่งคืนต่อการจองทุกครั้ง
    """
    if check_out <= check_in:
        raise BookingError("วันที่ออกต้องหลังวันที่เข้า")
    n = (check_out - check_in).days
    return [check_in + timedelta(days=i) for i in range(n)]


@dataclass
class Availability:
    room: Room
    free: bool
    busy_nights: list[date]


def availability(
    db: Session, check_in: date, check_out: date,
    room_type_code: str | None = None,
) -> list[Availability]:
    """ห้องไหนว่างช่วงนี้บ้าง — ใช้แสดงผล ไม่ใช่ใช้ตัดสินใจ"""
    wanted = nights_between(check_in, check_out)

    q = select(Room).where(Room.out_of_order == False)  # noqa: E712
    if room_type_code:
        q = q.join(RoomType).where(RoomType.code == room_type_code)
    rooms = list(db.scalars(q))

    taken = db.execute(
        select(RoomNight.room_id, RoomNight.night)
        .where(RoomNight.night >= check_in, RoomNight.night < check_out)
    ).all()
    busy: dict[int, list[date]] = {}
    for room_id, night in taken:
        busy.setdefault(room_id, []).append(night)

    out = []
    for r in rooms:
        b = sorted(busy.get(r.id, []))
        out.append(Availability(room=r, free=not b, busy_nights=b))
    return sorted(out, key=lambda a: a.room.no)


def _ref() -> str:
    return "BK-" + secrets.token_hex(4).upper()


def create_booking(
    db: Session,
    room_no: str,
    guest_name: str,
    check_in: date,
    check_out: date,
    *,
    adults: int = 1,
    children: int = 0,
    source: str = "direct",
    guest_phone: str = "",
    weekend_pct: int = 20,
    deposit_pct: int = 30,
    ref: str | None = None,
) -> Booking:
    """จองห้อง · โยน RoomNotAvailable ถ้าชน

    **ไม่มีการเช็กว่าว่างก่อน** — ยิง INSERT แล้วให้คีย์ไม่ซ้ำเป็นคนตัดสิน
    ถ้าชน SQLAlchemy โยน IntegrityError เราแปลงเป็นข้อผิดพลาดที่อ่านรู้เรื่อง
    """
    wanted = nights_between(check_in, check_out)

    room = db.scalar(select(Room).where(Room.no == room_no))
    if room is None:
        raise BookingError(f"ไม่รู้จักห้อง {room_no}")
    if room.out_of_order:
        raise BookingError(f"ห้อง {room_no} ปิดปรับปรุงอยู่")

    rates = nightly_rates(room.room_type.rate_satang, check_in, check_out, weekend_pct)
    total = sum(r.rate_satang for r in rates)

    booking = Booking(
        ref=ref or _ref(),
        guest_name=guest_name,
        guest_phone=guest_phone,
        room_id=room.id,
        check_in=check_in,
        check_out=check_out,
        adults=adults,
        children=children,
        source=source,
        status="confirmed",
        deposit_satang=pct_of(total, deposit_pct),
    )
    db.add(booking)
    db.flush()  # ให้ได้ booking.id ก่อนผูกกับคืน

    for r in rates:
        db.add(RoomNight(
            room_id=room.id, night=r.day,
            booking_id=booking.id, rate_satang=r.rate_satang,
        ))

    # เปิดบิลพร้อมกับการจอง — ค่าห้องลงบิลทันที ไม่ต้องรอเช็กอิน
    folio = Folio(booking_id=booking.id, status="open")
    db.add(folio)

    # flush ตรงนี้คือจุดที่คีย์ไม่ซ้ำของ room_night ทำงาน
    # ต้องดักที่ flush ไม่ใช่ที่ commit — SQLAlchemy ยิง INSERT ตั้งแต่ flush แล้ว
    # (เคยดักที่ commit อย่างเดียว ผลคือ IntegrityError หลุดออกไปดิบ ๆ)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        # หาว่าคืนไหนชน เพื่อบอกคนขายว่าเสนอวันไหนแทนได้
        clash = db.execute(
            select(RoomNight.night)
            .where(RoomNight.room_id == room.id,
                   RoomNight.night >= check_in, RoomNight.night < check_out)
        ).scalars().all()
        raise RoomNotAvailable(room_no, sorted(clash))

    from pms.db import Charge
    for r in rates:
        db.add(Charge(
            folio_id=folio.id, kind="room",
            label=f"ค่าห้อง {room_no} · คืนวันที่ {r.day.isoformat()}"
                  + (" (เรตวันหยุด)" if r.weekend else ""),
            qty=1, unit_satang=r.rate_satang,
        ))
    db.commit()
    db.refresh(booking)
    return booking


def check_in_booking(db: Session, ref: str) -> Booking:
    b = _get(db, ref)
    if b.status != "confirmed":
        raise BookingError(f"เช็กอินไม่ได้ · สถานะปัจจุบันคือ {b.status}")
    b.status = "inhouse"

    # ออกรหัส Wi-Fi ให้เลย ไม่ต้องมีใครสั่ง — แขกถามหา Wi-Fi เป็นคำถามแรก
    # หลังได้กุญแจห้อง และรหัสที่ต้องรอพนักงานไปกดคือรหัสที่มักถูกแทนด้วย
    # รหัสรวมของโรงแรม ซึ่งทำให้โยง session กลับไปหาคนไม่ได้เลย
    from pms.wifi import issue as issue_wifi
    _cred, secret = issue_wifi(db, b.ref)
    db.commit()
    # แนบรหัสจริงกลับไปครั้งเดียวให้เคาน์เตอร์พิมพ์ใบให้แขก
    b.wifi_secret_once = secret      # type: ignore[attr-defined]
    return b


def cancel_booking(db: Session, ref: str) -> Booking:
    """ยกเลิก — ต้องคืนคืนที่กันไว้ให้ขายต่อได้ ไม่งั้นห้องจะว่างแต่ขายไม่ออก"""
    b = _get(db, ref)
    if b.status == "checkedout":
        raise BookingError("เช็กเอาต์ไปแล้ว ยกเลิกไม่ได้")
    for n in list(b.nights):
        db.delete(n)
    b.status = "cancelled"
    db.commit()
    return b


def _get(db: Session, ref: str) -> Booking:
    b = db.scalar(select(Booking).where(Booking.ref == ref))
    if b is None:
        raise BookingError(f"ไม่พบการจอง {ref}")
    return b

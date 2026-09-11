"""ค่ากิจการที่ใช้ร่วมกันทุกเครื่องในโหมด live."""
from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from pms.db import PropertySetting, RoomType
from pms.money import baht, to_baht
from pms.session import settings as env_defaults


def get(db: Session) -> PropertySetting:
    """อ่านค่าปัจจุบัน; ฐานเก่ายังไม่มีแถวให้ใช้ค่า env เป็นค่าเริ่มต้น."""
    row = db.get(PropertySetting, 1)
    if row is not None:
        return row
    return PropertySetting(
        id=1,
        hotel_name=env_defaults.hotel_name,
        city="เชียงใหม่",
        phone="053-000-000",
        vat_pct=env_defaults.vat_pct,
        weekend_pct=env_defaults.weekend_pct,
        deposit_pct=env_defaults.deposit_pct,
        ma_pct=15,
        check_in_time="14:00",
        check_out_time="12:00",
    )


def output(db: Session) -> dict:
    row = get(db)
    types = db.scalars(select(RoomType).order_by(RoomType.id)).all()
    return {
        "hotelName": row.hotel_name,
        "city": row.city,
        "phone": row.phone,
        "vatPct": row.vat_pct,
        "weekendPct": row.weekend_pct,
        "depositPct": row.deposit_pct,
        "maPct": row.ma_pct,
        "checkInTime": row.check_in_time,
        "checkOutTime": row.check_out_time,
        "types": [
            {"code": t.code, "name": t.name, "rate": to_baht(t.rate_satang),
             "ota": to_baht(t.ota_satang)}
            for t in types
        ],
    }


def save(db: Session, data) -> dict:
    row = db.get(PropertySetting, 1)
    if row is None:
        row = PropertySetting(id=1)
        db.add(row)
    row.hotel_name = data.hotelName.strip()
    row.city = data.city.strip()
    row.phone = data.phone.strip()
    row.vat_pct = data.vatPct
    row.weekend_pct = data.weekendPct
    row.deposit_pct = data.depositPct
    row.ma_pct = data.maPct
    row.check_in_time = data.checkInTime
    row.check_out_time = data.checkOutTime

    existing = {t.code: t for t in db.scalars(select(RoomType)).all()}
    submitted: set[str] = set()
    for item in data.types:
        code = item.code or "custom-" + secrets.token_hex(4)
        if code in submitted:
            raise ValueError(f"รหัสประเภทห้องซ้ำกัน: {code}")
        submitted.add(code)
        room_type = existing.get(code)
        if room_type is None:
            room_type = RoomType(code=code)
            db.add(room_type)
        room_type.name = item.name.strip()
        room_type.rate_satang = baht(item.rate)
        room_type.ota_satang = baht(item.ota)

    # ลบได้เฉพาะประเภทที่ยังไม่มีห้องผูกอยู่ เพื่อไม่ให้ผังห้องเสีย FK
    for code, room_type in existing.items():
        if code not in submitted:
            if room_type.rooms:
                raise ValueError(
                    f"ลบประเภท {room_type.name} ไม่ได้ เพราะยังมีห้องใช้งานอยู่"
                )
            db.delete(room_type)

    db.commit()
    return output(db)

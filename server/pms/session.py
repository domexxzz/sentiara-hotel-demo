"""ตัวตั้งค่าและ session ของฐานข้อมูล"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterator

from sqlalchemy.orm import Session

from pms.db import init_db, make_engine, make_session_factory


@dataclass
class Settings:
    """ค่าที่ต้องตรงกับหน้าจอเดโม — แก้ที่นี่แล้วทั้งหลังบ้านเปลี่ยนตาม"""

    hotel_name: str = os.environ.get("PMS_HOTEL", "Sentiara Hotel")
    vat_pct: int = int(os.environ.get("PMS_VAT_PCT", "7"))
    weekend_pct: int = int(os.environ.get("PMS_WEEKEND_PCT", "20"))
    deposit_pct: int = int(os.environ.get("PMS_DEPOSIT_PCT", "30"))


settings = Settings()

_engine = None
_factory = None


def setup(db_url: str | None = None):
    global _engine, _factory
    _engine = make_engine(db_url)
    init_db(_engine)
    _factory = make_session_factory(_engine)
    return _engine


def session_factory():
    if _factory is None:
        setup()
    return _factory


def get_db() -> Iterator[Session]:
    db = session_factory()()
    try:
        yield db
    finally:
        db.close()


def dispose() -> None:
    """ปิดการเชื่อมต่อทั้งหมดและปล่อยไฟล์ฐานข้อมูล

    จำเป็นตอนกู้คืน — บนวินโดวส์ไฟล์ที่ยังมีคนเปิดอยู่ เขียนทับไม่ได้เลย
    แล้วจะได้ PermissionError ที่อ่านไม่ออกว่าเกิดจากอะไร
    """
    global _engine, _factory
    if _engine is not None:
        _engine.dispose()

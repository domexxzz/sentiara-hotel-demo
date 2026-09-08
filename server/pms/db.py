"""แบบจำลองข้อมูล PMS

การตัดสินใจที่สำคัญที่สุดในไฟล์นี้ — ตาราง `room_night`
--------------------------------------------------------
ความเสี่ยงอันดับหนึ่งในแผน HMP คือ **ขายห้องซ้ำจากการยิงพร้อมกัน**
(โอกาสกลาง · ผลกระทบ "สูงมาก")

วิธีที่คนทำกันคือ "เช็กก่อนว่าว่างไหม แล้วค่อยบันทึก" — ซึ่ง **ผิดเสมอ**
เพราะระหว่างเช็กกับบันทึกมีช่องว่างให้คำขออีกอันแทรกเข้ามาได้
(time-of-check to time-of-use) ต่อให้ใส่ transaction ก็ยังต้องล็อกให้ถูกจุด

ที่นี่ใช้วิธีที่แข็งกว่า — **ให้ฐานข้อมูลปฏิเสธเอง**
หนึ่งคืนของหนึ่งห้อง = หนึ่งแถวใน `room_night` ที่มี UNIQUE(room_id, night)
จองซ้ำ = INSERT ชนคีย์ = ฐานข้อมูลโยน IntegrityError ทันที
**ไม่มีทางที่โค้ดจะเผลอลืมเช็ก เพราะไม่ได้เช็กด้วยโค้ดตั้งแต่แรก**

วิธีนี้ทำงานเหมือนกันทั้งบน SQLite และ PostgreSQL จึงย้ายฐานได้โดยไม่ต้องคิดใหม่
"""
from __future__ import annotations

import os
from datetime import date, datetime

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, String,
    UniqueConstraint, create_engine, event,
)
from pms import clock
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

DB_URL = os.environ.get("PMS_DB", "sqlite:///./data/pms.db")


class Base(DeclarativeBase):
    pass


# ── ห้องและราคา ──────────────────────────────────────────────────────
class RoomType(Base):
    __tablename__ = "room_type"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(64))
    #: ราคาวันธรรมดา หน่วยสตางค์ · รวม VAT แล้วตามที่ประกาศให้แขก
    rate_satang: Mapped[int] = mapped_column(Integer)
    ota_satang: Mapped[int] = mapped_column(Integer, default=0)

    rooms: Mapped[list["Room"]] = relationship(back_populates="room_type")


class Room(Base):
    __tablename__ = "room"

    id: Mapped[int] = mapped_column(primary_key=True)
    no: Mapped[str] = mapped_column(String(16), unique=True)
    room_type_id: Mapped[int] = mapped_column(ForeignKey("room_type.id"))
    floor: Mapped[str] = mapped_column(String(8), default="")
    #: ปิดปรับปรุง = ขายไม่ได้ แต่ยังอยู่ในผังให้แม่บ้านและช่างเห็น
    out_of_order: Mapped[bool] = mapped_column(Boolean, default=False)

    room_type: Mapped[RoomType] = relationship(back_populates="rooms")


# ── การจอง ───────────────────────────────────────────────────────────
class Booking(Base):
    __tablename__ = "booking"

    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    guest_name: Mapped[str] = mapped_column(String(128))
    guest_phone: Mapped[str] = mapped_column(String(32), default="")
    room_id: Mapped[int] = mapped_column(ForeignKey("room.id"))
    check_in: Mapped[date] = mapped_column(Date)
    check_out: Mapped[date] = mapped_column(Date)
    adults: Mapped[int] = mapped_column(Integer, default=1)
    children: Mapped[int] = mapped_column(Integer, default=0)
    #: direct | walkin | ota | line — ใช้แยกค่าคอมมิชชันตอนลงบัญชี
    source: Mapped[str] = mapped_column(String(16), default="direct")
    #: confirmed | inhouse | checkedout | cancelled
    status: Mapped[str] = mapped_column(String(16), default="confirmed")
    deposit_satang: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)

    room: Mapped[Room] = relationship()
    nights: Mapped[list["RoomNight"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("check_out > check_in", name="ck_booking_dates"),
    )


class RoomNight(Base):
    """หนึ่งแถว = หนึ่งห้องหนึ่งคืน · คีย์ไม่ซ้ำคือสิ่งที่กันจองซ้ำจริง ๆ"""

    __tablename__ = "room_night"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("room.id"), index=True)
    night: Mapped[date] = mapped_column(Date, index=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("booking.id"), index=True)
    #: ราคาคืนนั้น ๆ เก็บไว้เลย ไม่คิดใหม่ตอนออกบิล
    #: ถ้าคิดใหม่ ราคาที่แขกตกลงตอนจองกับที่เรียกเก็บจะต่างกันเมื่อเจ้าของแก้เรตกลางทาง
    rate_satang: Mapped[int] = mapped_column(Integer)

    booking: Mapped[Booking] = relationship(back_populates="nights")

    __table_args__ = (
        UniqueConstraint("room_id", "night", name="uq_room_night"),
    )


# ── บิล ──────────────────────────────────────────────────────────────
class Folio(Base):
    """บิลของการเข้าพักหนึ่งครั้ง — รวมค่าห้อง อาหาร และบริการไว้ใบเดียว"""

    __tablename__ = "folio"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("booking.id"), unique=True)
    #: open | closed
    status: Mapped[str] = mapped_column(String(16), default="open")
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    booking: Mapped[Booking] = relationship()
    charges: Mapped[list["Charge"]] = relationship(
        back_populates="folio", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="folio", cascade="all, delete-orphan"
    )


class Charge(Base):
    __tablename__ = "charge"

    id: Mapped[int] = mapped_column(primary_key=True)
    folio_id: Mapped[int] = mapped_column(ForeignKey("folio.id"), index=True)
    #: room | fnb | service | discount — แยกเพราะลงคนละบัญชี
    kind: Mapped[str] = mapped_column(String(16))
    label: Mapped[str] = mapped_column(String(160))
    qty: Mapped[int] = mapped_column(Integer, default=1)
    #: ราคาต่อหน่วย รวม VAT แล้ว
    unit_satang: Mapped[int] = mapped_column(Integer)
    at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)

    folio: Mapped[Folio] = relationship(back_populates="charges")

    @property
    def total_satang(self) -> int:
        return self.qty * self.unit_satang


class Payment(Base):
    __tablename__ = "payment"

    id: Mapped[int] = mapped_column(primary_key=True)
    folio_id: Mapped[int] = mapped_column(ForeignKey("folio.id"), index=True)
    #: cash | card | transfer | deposit
    method: Mapped[str] = mapped_column(String(16))
    amount_satang: Mapped[int] = mapped_column(Integer)
    at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)

    folio: Mapped[Folio] = relationship(back_populates="payments")


# ── ใบกำกับภาษี ──────────────────────────────────────────────────────
class TaxInvoice(Base):
    __tablename__ = "tax_invoice"

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    folio_id: Mapped[int] = mapped_column(ForeignKey("folio.id"), unique=True)
    buyer_name: Mapped[str] = mapped_column(String(200))
    buyer_taxid: Mapped[str] = mapped_column(String(20), default="")
    buyer_address: Mapped[str] = mapped_column(String(400), default="")
    base_satang: Mapped[int] = mapped_column(Integer)
    vat_satang: Mapped[int] = mapped_column(Integer)
    gross_satang: Mapped[int] = mapped_column(Integer)
    vat_pct: Mapped[int] = mapped_column(Integer)
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)


# ── รายจ่าย ──────────────────────────────────────────────────────────
class Expense(Base):
    __tablename__ = "expense"

    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[date] = mapped_column(Date)
    #: payroll | utility | supplies | ota | maintenance | marketing | finance | other
    category: Mapped[str] = mapped_column(String(24), index=True)
    label: Mapped[str] = mapped_column(String(200))
    amount_satang: Mapped[int] = mapped_column(Integer)
    paid: Mapped[bool] = mapped_column(Boolean, default=True)
    due: Mapped[date | None] = mapped_column(Date, nullable=True)


# ── การส่งเข้าระบบบัญชี ──────────────────────────────────────────────
class LedgerPost(Base):
    """บันทึกว่ารายการไหนถูกส่งเข้าระบบบัญชีไปแล้ว

    `idem_key` ไม่ซ้ำ = **ส่งซ้ำไม่ได้แม้เน็ตหลุดแล้วลองใหม่**
    นี่คือคำถามข้อแรกที่เราถาม Ledger Bridge ไป — เราต้องกันฝั่งเราเองด้วย
    ไม่ใช่ฝากความถูกต้องไว้กับปลายทางฝ่ายเดียว
    """

    __tablename__ = "ledger_post"

    id: Mapped[int] = mapped_column(primary_key=True)
    idem_key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    #: folio | expense
    source_kind: Mapped[str] = mapped_column(String(16))
    source_id: Mapped[int] = mapped_column(Integer)
    #: pending | sent | failed
    status: Mapped[str] = mapped_column(String(16), default="pending")
    payload_json: Mapped[str] = mapped_column(String)
    response: Mapped[str] = mapped_column(String(600), default="")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ── engine ───────────────────────────────────────────────────────────
def make_engine(url: str | None = None):
    url = url or DB_URL
    if url.startswith("sqlite") and ":memory:" not in url:
        os.makedirs(os.path.dirname(url.replace("sqlite:///", "")) or ".", exist_ok=True)
    eng = create_engine(url, future=True)

    if url.startswith("sqlite"):
        @event.listens_for(eng, "connect")
        def _sqlite_pragmas(dbapi_conn, _rec):
            cur = dbapi_conn.cursor()
            # SQLite ปิด foreign key เป็นค่าเริ่มต้น — ไม่เปิดคือคีย์นอกไม่ทำงานเลย
            cur.execute("PRAGMA foreign_keys=ON")
            # WAL ให้อ่านขณะเขียนได้ ลดโอกาส "database is locked" ตอนเช็กอินพร้อมกัน
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA busy_timeout=5000")
            cur.close()

    return eng


def make_session_factory(engine):
    return sessionmaker(bind=engine, expire_on_commit=False, future=True)


def init_db(engine) -> None:
    Base.metadata.create_all(engine)

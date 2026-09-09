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
import secrets
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


def new_ref(prefix: str) -> str:
    """รหัสอ้างอิงสาธารณะของแถว — สุ่ม ไม่ใช่เลขเรียง

    ทำไมไม่ใช้ `id`
    ----------------
    `eventId` ที่ส่งเข้าระบบบัญชีต้องไม่ซ้ำ **ตลอดอายุของกิจการ** ไม่ใช่แค่ใน
    ฐานข้อมูลก้อนปัจจุบัน ถ้าผูก eventId กับ `id` ที่เป็นเลขเรียง แล้ววันหนึ่ง
    seed ฐานใหม่หรือย้ายเครื่อง เลขจะวนกลับมาเป็น 1, 2, 3 ชนกับของที่ส่งไปแล้ว
    ปลายทางจะปฏิเสธเงียบ ๆ ว่า "ซ้ำ" ทั้งที่เป็นคนละรายการ — เงินหายจากบัญชี
    โดยไม่มีอะไรฟ้อง

    64 บิตสุ่มพอสำหรับปริมาณระดับโรงแรม และอ่านออกเสียงได้ตอนโทรคุยกัน
    """
    return f"{prefix}-{secrets.token_hex(4).upper()}"


#: หมวดรายจ่าย — ละเอียดพอที่จะแมปกับผังบัญชีจริงได้ตัวต่อตัว
#:
#: เดิมมี "utility" ก้อนเดียวและ "finance" ก้อนเดียว ซึ่งหยาบกว่าผังบัญชีของ
#: โปรแกรมบัญชีปลายทาง — ค่าไฟ ค่าน้ำ ค่าเน็ต อยู่คนละบัญชีกัน และดอกเบี้ยจ่าย
#: อยู่คนละกลุ่มงบกับค่าธรรมเนียมธนาคาร รวมไว้แล้วนักบัญชีต้องมานั่งแยกเองทุกเดือน
#: ซึ่งเป็นงานที่ระบบควรทำให้ตั้งแต่ตอนบันทึก
EXPENSE_CATEGORIES = (
    "payroll",       # เงินเดือนและค่าแรง
    "electricity",   # ค่าไฟฟ้า
    "water",         # ค่าน้ำประปา
    "telecom",       # ค่าโทรศัพท์และอินเทอร์เน็ต
    "supplies",      # วัสดุสิ้นเปลือง
    "ota",           # ค่าคอมมิชชัน OTA
    "maintenance",   # ค่าซ่อมแซมและบำรุงรักษา
    "marketing",     # ค่าโฆษณาและส่งเสริมการขาย
    "bankfee",       # ค่าธรรมเนียมธนาคาร
    "interest",      # ดอกเบี้ยจ่าย
    "other",         # เบ็ดเตล็ด
)


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
    #: clean | dirty | cleaning | inspect
    #:
    #: แยกจาก out_of_order เพราะเป็นคนละคำถาม — "ขายได้ไหม" กับ "สะอาดหรือยัง"
    #: ห้องที่ปิดซ่อมก็ยังต้องทำความสะอาดหลังช่างเสร็จ และห้องสกปรกก็ไม่ได้
    #: แปลว่าเสีย · รวมสองอย่างเป็นฟิลด์เดียวเมื่อไร จะมีสถานะที่แสดงไม่ได้
    housekeeping: Mapped[str] = mapped_column(String(16), default="clean")

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
    #: รหัสอ้างอิงสาธารณะ · ใช้ประกอบ eventId ตอนส่งเข้าระบบบัญชี (ดู new_ref)
    ref: Mapped[str] = mapped_column(String(24), unique=True, index=True,
                                     default=lambda: new_ref("PY"))
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
    #: รหัสอ้างอิงสาธารณะ · ใช้ประกอบ eventId ตอนส่งเข้าระบบบัญชี (ดู new_ref)
    ref: Mapped[str] = mapped_column(String(24), unique=True, index=True,
                                     default=lambda: new_ref("EX"))
    at: Mapped[date] = mapped_column(Date)
    #: หนึ่งใน EXPENSE_CATEGORIES · แมปกับผังบัญชีปลายทางแบบตัวต่อตัว
    category: Mapped[str] = mapped_column(String(24), index=True)
    label: Mapped[str] = mapped_column(String(200))
    amount_satang: Mapped[int] = mapped_column(Integer)
    paid: Mapped[bool] = mapped_column(Boolean, default=True)
    due: Mapped[date | None] = mapped_column(Date, nullable=True)


# ── คิวส่งออกไปยังระบบบัญชี (outbox) ─────────────────────────────────
class LedgerOutbox(Base):
    """เหตุการณ์ที่รอส่งเข้าโปรแกรมบัญชี · หนึ่งแถว = หนึ่งเหตุการณ์

    ทำไมต้องมี outbox ไม่ยิงตรง
    ----------------------------
    ปลายทางกำหนดว่า `seq` ของทุกเหตุการณ์ต้อง **เพิ่มขึ้นเรื่อย ๆ และไม่ซ้ำ**
    และต้องมาจากคิวของผู้ส่ง ไม่ใช่สร้างใหม่ทุกครั้งที่ยิง เพราะถ้าสร้างใหม่จาก
    เลขที่ปลายทางบอกว่ารับถึงไหนแล้ว พอส่งสำเร็จบางส่วนแล้วส่งรอบใหม่
    เลขจะเลื่อนไม่ตรงกับของเดิม แล้วของที่ตกค้างจะถูกทิ้งเงียบ ๆ

    เก็บลงตารางก่อนแล้วค่อยส่ง ยังได้ผลพลอยได้อีกข้อ — เน็ตหลุดกลางดึกแล้ว
    ของยังอยู่ ส่งซ้ำพรุ่งนี้ได้ ไม่ต้องไปไล่สร้างใหม่จากบิลย้อนหลัง

    กับดักของ SQLite ที่ต้องระวัง
    ------------------------------
    `INTEGER PRIMARY KEY` เฉย ๆ คือ rowid ซึ่ง **เอาเลขที่ถูกลบแล้วกลับมาใช้ซ้ำได้**
    (เลขใหม่ = max ปัจจุบัน + 1 · ลบแถวท้ายทิ้งแล้วเลขถอยหลัง) เมื่อ seq ถอยหลัง
    ปลายทางจะถือว่าต่ำกว่าที่รับไปแล้วและ**ทิ้งทั้งชุดโดยไม่แจ้ง**
    `sqlite_autoincrement` บังคับให้ใช้ตาราง sqlite_sequence ซึ่งไม่เคยย้อนเลข
    (ย้ายไป PostgreSQL แล้ว SEQUENCE เพิ่มขึ้นเสมอโดยธรรมชาติ ไม่ต้องทำอะไรเพิ่ม)
    """

    __tablename__ = "ledger_outbox"

    #: นี่คือ `seq` ที่ส่งออกไปตรง ๆ — ไม่ได้คิดใหม่ตอนส่ง
    seq: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    #: คงที่ตลอดอายุของเหตุการณ์ · ส่งซ้ำกี่ครั้งปลายทางก็ลงบัญชีครั้งเดียว
    event_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    #: NA | DEP | STL | EXP | ADJ
    event_type: Mapped[str] = mapped_column(String(16), index=True)
    #: วันทำการของโรงแรม ไม่ใช่วันที่ระบบ — ปลายทางใช้ค่านี้หางวดบัญชี
    business_date: Mapped[date] = mapped_column(Date, index=True)
    payload_json: Mapped[str] = mapped_column(String)
    #: pending | sent | failed
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    response: Mapped[str] = mapped_column(String(600), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = ({"sqlite_autoincrement": True},)


# ── ทะเบียนผู้พัก ────────────────────────────────────────────────────
class GuestRegister(Base):
    """บัตรทะเบียนผู้พัก ร.ร.3 หนึ่งใบ · รวมกันเป็นทะเบียน ร.ร.4

    ม.35 พ.ร.บ.โรงแรม พ.ศ. 2547 บังคับให้จัดทำ **ทันทีที่รับผู้พัก**
    และ ม.38 พ.ร.บ.คนเข้าเมือง บังคับให้แจ้งคนต่างด้าวภายใน 24 ชั่วโมง

    หนึ่งการจองหนึ่งใบ — คีย์ไม่ซ้ำบน booking_id กันลงทะเบียนซ้ำที่ฐานข้อมูล
    ไม่ใช่ที่โค้ด เพราะพนักงานสองคนกดพร้อมกันได้จริงตอนแขกเข้าเป็นกลุ่ม
    """

    __tablename__ = "guest_register"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("booking.id"), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    nationality: Mapped[str] = mapped_column(String(64), default="ไทย")
    #: thai_id | passport
    id_type: Mapped[str] = mapped_column(String(16))
    id_number: Mapped[str] = mapped_column(String(32), index=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    address: Mapped[str] = mapped_column(String(400), default="")
    #: เดินทางมาจากที่ใด — ช่องบังคับในแบบ ตม.30
    arrived_from: Mapped[str] = mapped_column(String(160), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    #: ตัดสินจากสัญชาติ ไม่ใช่จากชนิดเอกสาร — คนไทยที่ถือพาสปอร์ตมาเช็กอิน
    #: ก็ยังเป็นคนไทย ไม่ต้องแจ้ง ตม.30
    foreign: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    #: ครบกำหนดแจ้ง ตม.30 · นับจากเวลาที่เข้าพัก ไม่ใช่เวลาที่กรอกฟอร์ม
    tm30_due: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    tm30_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    #: เลขรับเรื่องจากระบบราชการ — เก็บไว้ให้ตรวจย้อนได้ว่าแจ้งจริง
    tm30_receipt: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)


# ── งานแม่บ้าน ───────────────────────────────────────────────────────
class HousekeepingTask(Base):
    """งานทำความสะอาดหนึ่งใบ

    เกิดเองตอนเช็กเอาต์ ไม่ต้องมีใครสั่ง — ห้องที่แขกออกแล้วแต่ไม่มีใครรู้ว่า
    ต้องทำ คือห้องที่ขายไม่ได้ทั้งที่ว่าง ซึ่งเป็นรายได้ที่หายไปเงียบ ๆ

    เส้นทางของงานหนึ่งใบ
    ---------------------
        open → doing → inspect → done        แม่บ้านทำ หัวหน้าตรวจแล้วผ่าน
                         └──→ doing          หัวหน้าตีกลับพร้อมเหตุผล

    ห้องกลับไปขายได้ **ตอนหัวหน้าอนุมัติ** ไม่ใช่ตอนแม่บ้านกดว่าเสร็จ —
    คนที่ทำงานเป็นคนตรวจงานตัวเองเมื่อไร มาตรฐานก็หายไปทันที
    """

    __tablename__ = "housekeeping_task"

    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(24), unique=True, index=True,
                                     default=lambda: new_ref("HK"))
    room_id: Mapped[int] = mapped_column(ForeignKey("room.id"), index=True)
    #: checkout | stayover | deep | maintenance
    kind: Mapped[str] = mapped_column(String(16), default="checkout")
    #: open | doing | inspect | done | cancelled
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    #: ยิ่งเลขน้อยยิ่งด่วน · ห้องที่มีแขกรอเข้าวันนี้ต้องมาก่อนห้องที่ยังไม่มีคนจอง
    priority: Mapped[int] = mapped_column(Integer, default=5, index=True)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), nullable=True)
    note: Mapped[str] = mapped_column(String(300), default="")
    #: เหตุผลที่หัวหน้าตีกลับ · ต้องบอกเสมอ ไม่งั้นแม่บ้านไม่รู้ว่าต้องแก้อะไร
    reject_reason: Mapped[str] = mapped_column(String(300), default="")
    #: จำนวนรูปที่ถ่ายส่ง · มาตรฐานคือสามมุม มุมรวม เตียง ห้องน้ำ
    photos: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, index=True)
    done_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    room: Mapped["Room"] = relationship()


# ── ผู้ใช้ สิทธิ์ และร่องรอย ─────────────────────────────────────────
class Staff(Base):
    """พนักงานหนึ่งคน · บัตร NFC ใบเดียวกับที่ใช้เปิดประตูและลงเวลา"""

    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(24), unique=True, index=True,
                                     default=lambda: new_ref("ST"))
    name: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(120), default="")
    #: owner | manager | front | hk | tech | pos — ดูผังสิทธิ์ที่ pms/auth.py
    role: Mapped[str] = mapped_column(String(16), index=True)
    #: รหัสบัตรที่แตะเข้าระบบ · ไม่ซ้ำกันทั้งโรงแรม
    card: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    #: เก็บเฉพาะแฮช ไม่เคยเก็บรหัสจริง · ทำหายแล้วออกใหม่อย่างเดียว
    pin_hash: Mapped[str] = mapped_column(String(200))
    #: ลาออกแล้วปิดใช้งาน ไม่ลบทิ้ง — ร่องรอยเก่ายังต้องชี้กลับมาที่คนนี้ได้
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)


class StaffSession(Base):
    """เซสชันที่ยังใช้ได้อยู่

    เก็บแค่แฮชของโทเคน — ฐานข้อมูลรั่วแล้วคนที่ได้ไปยังสวมสิทธิ์ใครไม่ได้
    เพราะย้อนกลับไปเป็นโทเคนจริงไม่ได้
    """

    __tablename__ = "staff_session"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)


class AuditEvent(Base):
    """ใครทำอะไรกับอะไรเมื่อไร

    เก็บชื่อคนซ้ำไว้ในแถวด้วย ไม่ใช่อ้างแค่ id — พนักงานลาออกแล้วเปลี่ยนชื่อ
    หรือถูกปิดใช้งาน ร่องรอยเก่าต้องยังอ่านออกว่าตอนนั้นใครเป็นคนกด
    """

    __tablename__ = "audit_event"

    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, index=True)
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), nullable=True)
    staff_name: Mapped[str] = mapped_column(String(120), default="")
    #: auth.login · booking.create · folio.close · invoice.issue …
    action: Mapped[str] = mapped_column(String(48), index=True)
    #: ชนิดของสิ่งที่ถูกกระทำ เช่น booking · folio · expense
    entity: Mapped[str] = mapped_column(String(24), default="")
    #: รหัสอ้างอิงของสิ่งนั้น เช่น BK-0464FE0F
    ref: Mapped[str] = mapped_column(String(40), default="", index=True)
    detail: Mapped[str] = mapped_column(String(400), default="")


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

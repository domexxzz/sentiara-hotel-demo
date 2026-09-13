"""แปลงสิ่งที่ PMS รู้ ให้เป็น "เหตุการณ์" ที่ระบบบัญชีรับได้

หลักการที่ต่างจากของเดิมทั้งหมด
--------------------------------
เดิมไฟล์ `ledger.py` ประกอบ **ใบสำคัญพร้อมเดบิต/เครดิต** เองแล้วส่งออก ซึ่งแปลว่า
PMS ต้องรู้ผังบัญชีของโรงแรมนั้น — ผิดตั้งแต่หลักการ เพราะผังบัญชีของแต่ละที่
ไม่เหมือนกันและเปลี่ยนได้โดยที่ PMS ไม่ควรต้องรับรู้ ทุกครั้งที่นักบัญชีย้ายบัญชี
เราต้องแก้โค้ดตาม ซึ่งขายให้โรงแรมที่สองไม่ได้

สัญญาของ Ledger Bridge จึงเป็น **PMS ส่งเหตุการณ์ ไม่ได้ส่งรายการบัญชี**
เรารายงานว่า "คืนนี้ห้อง 201 ขายได้เท่านี้ เก็บเงินสดเท่านี้" ส่วนการแปลงเป็น
เดบิต/เครดิต เป็นหน้าที่ของกฎลงบัญชีที่นักบัญชีตั้งและเซ็นรับที่ปลายทาง

ผลที่ตามมาซึ่งสำคัญกว่าที่คิด — คำถามที่ยังตกลงกันไม่จบสองข้อ
(VAT ของค่าห้องเข้า "ภาษีขาย" หรือ "ภาษีขายยังไม่ถึงกำหนด" · มัดจำมี VAT หรือไม่)
**ไม่บล็อกไฟล์นี้เลย** เพราะคำตอบไปอยู่ในกฎฝั่งปลายทาง ไม่ได้อยู่ใน payload
หน้าที่เราคือส่งข้อมูลให้ครบพอที่กฎทั้งสองแบบเขียนได้

ห้าชนิดที่ระบบนี้ผลิต
----------------------
    NA   ปิดยอดรายคืน — รายได้ที่เกิดขึ้นจริงในวันทำการนั้น
    DEP  รับมัดจำ — เงินเข้าก่อนได้ให้บริการ
    STL  รับชำระ — เงินเข้าตอนหรือหลังให้บริการ
    EXP  รายจ่าย
    ADJ  กลับรายการ — ยกเลิก คืนเงิน ลงผิด

กฎเหล็กที่ไฟล์นี้บังคับให้ทำถูกโดยไม่ต้องจำ
--------------------------------------------
* **จำนวนเงินออกไปเป็นสตริงเสมอ** ผ่าน `money()` ซึ่งรับเฉพาะสตางค์จำนวนเต็ม
  ส่ง float เข้าไปจะโยนทิ้งทันที ไม่ปัดให้เงียบ ๆ
* **วันที่เป็นวันทำการ** มาจาก `clock.py` (เวลาไทย) ไม่ใช่ `date.today()` ของเครื่อง
* **`eventId` ผูกกับ `ref` ที่สุ่ม ไม่ใช่ `id` ที่เป็นเลขเรียง** (เหตุผลอยู่ที่ `new_ref`)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from pms.db import Booking, Charge, CreditNote, Expense, Folio, Payment, RoomNight, TaxInvoice
from pms.folio import totals
from pms.money import split_vat

#: ชนิดเหตุการณ์ที่ระบบนี้ผลิต · ปลายทางต้องมีกฎลงบัญชีของทุกตัวก่อนถึงจะลงจริงได้
EVENT_TYPES = ("NA", "DEP", "STL", "EXP", "ADJ")

#: หมวดรายได้ในบรรทัดของ NA · ชื่อกลาง ๆ ที่ไม่ผูกกับผังบัญชีของใคร
#: `Charge.kind` ของเรามีแค่ room/fnb/service/discount — ละเอียดน้อยกว่าที่บัญชี
#: อยากได้ (มินิบาร์กับซักรีดมีบัญชีรายได้ของตัวเอง) จึงแยกเพิ่มจากชื่อรายการ
LINE_CATEGORIES = ("ROOM", "FNB", "MINIBAR", "LAUNDRY", "SERVICE", "DISCOUNT")


class EventError(Exception):
    """ประกอบเหตุการณ์ไม่ได้ · หยุดตรงนี้ ดีกว่าส่งของที่ผิดออกไปแล้วแก้ไม่ได้"""


def money(satang: int) -> str:
    """สตางค์จำนวนเต็ม → สตริงจำนวนเงินที่ปลายทางรับ

        money(550000) == "5500.00"

    ปลายทางปฏิเสธตัวเลขทศนิยมทุกกรณี ไม่ใช่ความจู้จี้ —
    `JSON.parse('{"a":21608.65}')` ให้ `21608.650000000001` **ตั้งแต่ก่อนถึง
    โค้ดที่จะตรวจ** ความคลาดเคลื่อนเกิดที่ตัวแปลง JSON ไม่ใช่ที่ตรรกะ

    ฝั่งเราจึงบวกเป็นสตางค์จำนวนเต็มตลอดทาง แล้วแปลงตรงนี้ที่เดียว
    """
    if isinstance(satang, bool) or not isinstance(satang, int):
        raise EventError(
            f"จำนวนเงินต้องเป็นสตางค์จำนวนเต็ม ได้ {type(satang).__name__} — "
            "float ทำเงินเพี้ยนสะสมจนงบไม่ลง"
        )
    sign = "-" if satang < 0 else ""
    n = abs(satang)
    return f"{sign}{n // 100}.{n % 100:02d}"


@dataclass
class Event:
    """หนึ่งเหตุการณ์ที่พร้อมเข้า outbox

    ยังไม่มี `seq` — เลขนั้นมาจากคิวตอนบันทึกลงตาราง ไม่ใช่ตอนประกอบ
    ถ้าให้ตรงนี้กำหนดเอง จะกลายเป็นสร้างเลขใหม่ทุกครั้งที่ประกอบ ซึ่งผิดกฎข้อ 1
    """

    event_id: str
    event_type: str
    business_date: date
    payload: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.event_type not in EVENT_TYPES:
            raise EventError(f"ไม่รู้จักชนิดเหตุการณ์ {self.event_type}")
        if not self.event_id.strip():
            raise EventError("eventId ว่างไม่ได้")
        # เลขที่เอกสารและรหัสอ้างอิงถูกพิมพ์ลงรายงานและส่งออกเป็น CSV/DBF ต่อ
        # อักขระควบคุมตัวเดียวทำให้ไฟล์ส่งออกเพี้ยนทั้งคอลัมน์ตั้งแต่แถวนั้นลงไป
        if any(ch in self.event_id for ch in "\n\r\t"):
            raise EventError(f"eventId มีอักขระควบคุม: {self.event_id!r}")

    def envelope(self, seq: int) -> dict:
        """หน้าตาที่ส่งออกจริง · `seq` ฉีดเข้ามาตอนส่ง ไม่ได้เก็บไว้ในตัวเอง"""
        return {
            "seq": seq,
            "eventType": self.event_type,
            "businessDate": self.business_date.isoformat(),
            "payload": {
                "eventId": self.event_id,
                "docType": self.event_type,
                "businessDate": self.business_date.isoformat(),
                **self.payload,
            },
        }


# ── ตัวช่วยแยกหมวดรายได้ ──────────────────────────────────────────────
def _category_of(charge: Charge) -> str:
    """หมวดรายได้ของรายการหนึ่ง

    `Charge.kind` มีแค่สี่ค่า แต่ผังบัญชีของโรงแรมแยกมินิบาร์กับซักรีดออกจาก
    อาหารและเครื่องดื่ม จึงต้องดูชื่อรายการประกอบ · ถ้าเดาไม่ออกให้ตกไปที่ FNB
    ซึ่งเป็นบัญชีที่กว้างที่สุดในกลุ่มเดียวกัน ดีกว่าไปโผล่ผิดกลุ่ม
    """
    if charge.kind == "room":
        return "ROOM"
    if charge.kind == "discount":
        return "DISCOUNT"
    if charge.kind == "service":
        return "SERVICE"
    label = charge.label
    if "มินิบาร์" in label or "minibar" in label.lower():
        return "MINIBAR"
    if "ซักรีด" in label or "laundry" in label.lower():
        return "LAUNDRY"
    return "FNB"


def _vat_of(gross: int, vat_pct: int) -> tuple[int, int]:
    """ถอด VAT ออกจากยอดที่รวมภาษีแล้ว · คืน (ฐาน, ภาษี)

    ราคาห้องที่ประกาศเป็นราคารวมภาษีแล้ว ถ้าบวกเพิ่มอีกจะเก็บเงินแขกเกิน
    """
    v = split_vat(abs(gross), vat_pct)
    sign = -1 if gross < 0 else 1
    return v.base * sign, v.vat * sign


# ── NA · ปิดยอดรายคืน ─────────────────────────────────────────────────
def night_audit_events(
    db: Session, business_date: date, vat_pct: int = 7,
) -> list[Event]:
    """รายได้ที่เกิดขึ้นจริงในวันทำการนั้น · หนึ่งเหตุการณ์ต่อหนึ่งการเข้าพัก

    ทำไมค่าห้องอ่านจาก `room_night` ไม่ใช่จาก `charge`
    ---------------------------------------------------
    `create_booking()` ลงค่าห้องของ **ทุกคืนเข้าบิลตั้งแต่วันจอง** ซึ่งถูกสำหรับบิล
    (แขกเห็นยอดรวมได้ทันที) แต่ผิดสำหรับบัญชี — เงินที่รับล่วงหน้ายังไม่ใช่รายได้
    จนกว่าจะได้ให้บริการจริง จองวันนี้เข้าพักเดือนหน้า รายได้เป็นของเดือนหน้า

    `room_night` มีแถวละหนึ่งห้องหนึ่งคืนพร้อมราคาของคืนนั้น ซึ่งเป็นความละเอียด
    ที่ตรงกับการรับรู้รายได้รายวันพอดี · ราคาในสองตารางมาจาก `nightly_rates()`
    ตัวเดียวกัน จึงไม่มีทางคลาดกัน

    รายการอื่น (อาหาร มินิบาร์ ซักรีด ส่วนลด) อ่านจาก `charge` ตามวันที่ลงจริง
    """
    nights = db.scalars(
        select(RoomNight).where(RoomNight.night == business_date)
    ).all()

    # จัดกลุ่มตามการจอง — ค่าห้องมาจากคืน ส่วนที่เหลือมาจากบิล
    by_booking: dict[int, dict] = {}
    for n in nights:
        b = by_booking.setdefault(n.booking_id, {"room": 0, "charges": []})
        b["room"] += n.rate_satang

    # รายการที่ลงบิลในวันนั้น · หนึ่งวันทำการ = ตั้งแต่เที่ยงคืนถึงเที่ยงคืน
    day_charges = db.scalars(
        select(Charge).join(Folio).where(Charge.kind != "room")
    ).all()
    for ch in day_charges:
        if ch.at.date() != business_date:
            continue
        folio = db.get(Folio, ch.folio_id)
        if folio is None:
            continue
        by_booking.setdefault(folio.booking_id, {"room": 0, "charges": []})
        by_booking[folio.booking_id]["charges"].append(ch)

    out: list[Event] = []
    for booking_id, parts in sorted(by_booking.items()):
        b = db.get(Booking, booking_id)
        if b is None or b.status == "cancelled":
            continue

        buckets: dict[str, int] = {}
        if parts["room"]:
            buckets["ROOM"] = parts["room"]
        for ch in parts["charges"]:
            cat = _category_of(ch)
            buckets[cat] = buckets.get(cat, 0) + ch.total_satang

        gross = sum(buckets.values())
        if gross == 0:
            continue

        lines = []
        base_total = 0
        for cat in LINE_CATEGORIES:
            if cat not in buckets:
                continue
            g = buckets[cat]
            base, _vat = _vat_of(g, vat_pct)
            base_total += base          # รวมด้วยค่าจริง ส่วนลดต้องหักออกตรงนี้

            # ── ส่งออกเป็น "ขนาด" เสมอ ไม่ส่งยอดติดลบ ────────────────
            # เครื่องยนต์กฎปลายทางบังคับว่าทุกบรรทัดใบสำคัญต้องมากกว่าศูนย์
            # (ข้อบังคับที่ฐานข้อมูล ไม่ใช่ if ในโค้ด) และภาษากฎของมันไม่มี
            # abs และกลับเครื่องหมายไม่ได้ · ยอดติดลบจึงถูกกฎกรองทิ้ง**เงียบ ๆ**
            # แล้วใบสำคัญไม่สมดุลเท่ากับส่วนลดพอดี — พิสูจน์มาแล้วด้วยการยิง
            # payload จริงผ่านเครื่องยนต์ ได้ UNBALANCED 186.92
            #
            # ทิศทางบอกด้วย `category` แทน ซึ่งตรงกับผังบัญชีที่กำหนดให้
            # 4190-00 ส่วนลดจ่าย มีด้านปกติเป็นเดบิตอยู่แล้ว
            if g < 0 and cat != "DISCOUNT":
                # หมวดอื่นติดลบแปลว่ามีอะไรผิดที่ต้นทาง อย่ากลบด้วย abs
                raise EventError(
                    f"หมวด {cat} ของ {b.ref} ติดลบ ({money(g)}) — "
                    "มีแต่ DISCOUNT ที่ติดลบได้"
                )
            lines.append({
                "category": cat,
                "grossAmount": money(abs(g)),
                "netAmount": money(abs(base)),
            })

        # ปัดเศษทีละหมวดแล้วรวมกัน อาจคลาดจากยอดจริงไม่กี่สตางค์
        # ยกส่วนต่างให้ภาษีเสมอ ผลรวมจึงตรงกับที่แขกจ่ายพอดี
        vat_total = gross - base_total

        out.append(Event(
            event_id=f"NA-{business_date.isoformat()}-{b.ref}",
            event_type="NA",
            business_date=business_date,
            payload={
                "bookingRef": b.ref,
                "room": b.room.no,
                "guestName": b.guest_name,
                "source": b.source,
                "lines": lines,
                "vatBase": money(base_total),
                "vatAmount": money(vat_total),
                "vatPct": vat_pct,
                "grandTotal": money(gross),
            },
        ))
    return out


# ── DEP / STL · เงินเข้า ──────────────────────────────────────────────
def payment_event(db: Session, payment: Payment, vat_pct: int = 7) -> Event:
    """เงินที่รับเข้ามาหนึ่งครั้ง

    แยกเป็นสองชนิดเพราะบัญชีมองคนละเรื่อง — มัดจำคือ **หนี้สิน** (รับเงินแล้วแต่
    ยังไม่ได้ให้บริการ ต้องคืนได้ถ้ายกเลิก) ส่วนเงินที่รับตอนหรือหลังเข้าพักคือ
    การ **ล้างลูกหนี้** ที่เกิดจากรายได้ซึ่งรับรู้ไปแล้ว

    แยกที่ `method` ไม่ใช่ที่สถานะการจอง เพราะสถานะเปลี่ยนได้ตลอดเวลา
    แต่ eventId ต้องคงที่ตลอดกาล — ถ้าให้สถานะเป็นตัวตัดสิน เหตุการณ์เดียวกัน
    จะเปลี่ยนชนิดได้เมื่อประกอบใหม่ทีหลัง
    """
    folio = db.get(Folio, payment.folio_id)
    if folio is None:
        raise EventError(f"ไม่พบบิลของการรับชำระ {payment.ref}")
    b = folio.booking

    is_deposit = payment.method == "deposit"
    kind = "DEP" if is_deposit else "STL"
    base, vat = _vat_of(payment.amount_satang, vat_pct)

    return Event(
        event_id=f"{kind}-{payment.ref}",
        event_type=kind,
        business_date=payment.at.date(),
        payload={
            "bookingRef": b.ref,
            "room": b.room.no,
            "guestName": b.guest_name,
            "method": payment.method,
            "amount": money(payment.amount_satang),
            # ถอด VAT ให้ด้วย เพื่อให้กฎที่ถือว่ามัดจำมีภาษีเขียนได้โดยไม่ต้อง
            # คิดเอง · กฎที่ถือว่าไม่มีภาษีก็แค่ไม่ใช้สองช่องนี้
            "vatBase": money(base),
            "vatAmount": money(vat),
            "vatPct": vat_pct,
            "settlement": [{"method": payment.method,
                            "amount": money(payment.amount_satang)}],
        },
    )


def folio_close_event(db: Session, folio: Folio, vat_pct: int = 7) -> Event:
    """ปิดบิล · รายงานยอดค้างที่กลายเป็นลูกหนี้

    ต้องเป็นเหตุการณ์แยก ไม่ใช่รวมกับการรับชำระ เพราะบิลปิดได้ทั้งที่ยังเก็บเงิน
    ไม่ครบ (วางบิลเครดิต · บัตรถูกปฏิเสธตอนเช็กเอาต์) และยอดที่ค้างต้องไปอยู่ใน
    ลูกหนี้ ไม่ใช่หายไปเฉย ๆ
    """
    if folio.status != "closed":
        raise EventError("ต้องปิดบิลก่อน ถึงจะรายงานยอดปิดบิลได้")

    t = totals(db, folio)
    b = folio.booking
    inv = _invoice_of(db, folio)

    # ตัวเลขภาษีบนใบกำกับคือของจริงที่ลูกค้าถือไปใช้และสรรพากรตรวจ
    # ถ้ามีใบกำกับแล้ว **ห้ามคำนวณใหม่** — ปัดเศษคนละจังหวะแล้วต่างกันสตางค์เดียว
    # เอกสารสองใบก็ขัดกันเอง แล้วฝ่ายบัญชีกระทบยอดไม่ลงโดยหาสาเหตุไม่เจอ
    if inv is not None:
        if inv.gross_satang != t.gross:
            raise EventError(
                f"ยอดบิลเปลี่ยนหลังออกใบกำกับภาษี {inv.number} · "
                f"ใบกำกับ {inv.gross_satang} แต่บิล {t.gross} สตางค์ — ห้ามส่ง"
            )
        base, vat = inv.base_satang, inv.vat_satang
    else:
        base, vat = _vat_of(t.gross, vat_pct)

    closed = folio.closed_at
    return Event(
        event_id=f"STL-CLOSE-{b.ref}",
        event_type="STL",
        business_date=closed.date(),
        payload={
            "bookingRef": b.ref,
            "room": b.room.no,
            "guestName": b.guest_name,
            "source": b.source,
            "closing": True,
            "grandTotal": money(t.gross),
            "paidTotal": money(t.paid),
            "balanceDue": money(t.balance),
            "vatBase": money(base),
            "vatAmount": money(vat),
            "vatPct": vat_pct,
            "taxInvoiceNo": inv.number if inv else None,
        },
    )


def _invoice_of(db: Session, folio: Folio):
    from pms.db import TaxInvoice
    return db.scalar(select(TaxInvoice).where(TaxInvoice.folio_id == folio.id))


# ── EXP · รายจ่าย ─────────────────────────────────────────────────────
def expense_event(expense: Expense) -> Event:
    """รายจ่ายหนึ่งรายการ

    ไม่แปลงเป็นเลขบัญชีตรงนี้ · ส่ง `category` ไปให้กฎปลายทางแมปเอง
    หมวดของเราถูกแตกให้ละเอียดพอที่จะแมปตัวต่อตัวได้แล้ว (ดู EXPENSE_CATEGORIES)
    """
    return Event(
        event_id=f"EXP-{expense.ref}",
        event_type="EXP",
        business_date=expense.at,
        payload={
            "category": expense.category,
            "label": expense.label,
            "amount": money(expense.amount_satang),
            "paid": expense.paid,
            "dueDate": expense.due.isoformat() if expense.due else None,
            # ภาษีหัก ณ ที่จ่าย — ปลายทางต้องรู้ทั้งสามยอด เพราะกฎลงบัญชี
            # ต้องแยกเป็นเจ้าหนี้ (netPayable) กับภาษีค้างนำส่ง (withholdingTax)
            # ส่งไปเสมอแม้เป็นศูนย์ กฎจะได้ไม่ต้องเดาว่าไม่มีช่องหรือไม่ได้หัก
            "withholdingKind": expense.wht_kind,
            "withholdingTax": money(expense.wht_satang or 0),
            "netPayable": money(expense.net_payable_satang),
        },
    )


# ── ADJ · กลับรายการ ──────────────────────────────────────────────────
def adjustment_event(
    *, reason: str, source_ref: str, business_date: date,
    amount_satang: int, vat_satang: int = 0,
    credit_note_no: str | None = None, memo: str = "",
) -> Event:
    """กลับรายการที่ลงไปแล้ว — ยกเลิก คืนเงิน หรือลงผิด

    ใบสำคัญที่ลงบัญชีแล้ว **แก้ไม่ได้ลบไม่ได้** ปลายทางบังคับด้วยทริกเกอร์ใน
    ฐานข้อมูล ไม่ใช่แค่ไม่มีปุ่มให้กด การแก้จึงมีทางเดียวคือตั้งรายการกลับ

    ตัวเรียกจริงคือ `credit_note_events()` ข้างล่าง ซึ่งอ่านใบลดหนี้ที่ออกแล้ว
    มาแปลงเป็นเหตุการณ์ · เรียกตรง ๆ ได้ด้วยสำหรับการกลับรายการที่ไม่มี VAT
    """
    if amount_satang <= 0:
        raise EventError("ยอดที่กลับรายการต้องมากกว่าศูนย์")
    # กลับ VAT โดยไม่มีใบลดหนี้ = ยอดภาษีขายในสมุดกับที่ยื่นสรรพากรไม่ตรงกัน
    # และไม่มีเอกสารอ้างอิงตอนถูกตรวจ · หยุดตรงนี้ดีกว่าไปรู้ตอนสิ้นปี
    if vat_satang and not credit_note_no:
        raise EventError(
            "กลับรายการที่มี VAT ต้องมีเลขที่ใบลดหนี้ — "
            "ยังไม่มีระบบใบลดหนี้ในตัวนี้ ต้องทำก่อนใช้กับของจริง"
        )
    return Event(
        event_id=f"ADJ-{reason}-{source_ref}",
        event_type="ADJ",
        business_date=business_date,
        payload={
            "reason": reason,
            "sourceRef": source_ref,
            "amount": money(amount_satang),
            # ── ส่งฐานที่ไม่รวมภาษีมาด้วย ไม่ให้ปลายทางคำนวณเอง ──────────
            # เครื่องยนต์กฎฝั่ง Ledger Bridge ต้องการ `netAmount` ตรง ๆ
            # ไม่ยอมลบ amount − vatAmount ให้ · ยิงของจริงแล้วได้ MISSING_FIELD
            # และถูกแล้วที่เขาไม่ลบเอง — เศษการปัดต้องมาจากที่เดียวคือคนออกเอกสาร
            # ไม่งั้นใบลดหนี้กับใบกำกับเดิมจะปัดเศษคนละทางแล้วยอดภาษีขายเพี้ยน
            "netAmount": money(amount_satang - vat_satang),
            "vatAmount": money(vat_satang),
            "creditNoteNo": credit_note_no,
            "memo": memo,
        },
    )

def credit_note_events(db: Session, business_date: date) -> list[Event]:
    """ใบลดหนี้ที่ออกในวันนั้น → เหตุการณ์ ADJ

    ใบสำคัญที่ลงบัญชีแล้วแก้ไม่ได้ ทางเดียวคือตั้งรายการกลับ — และการกลับ
    ต้องมีเอกสารอ้างอิงเสมอ ไม่ใช่แค่ยอดติดลบลอย ๆ ที่ผู้สอบบัญชีโยงกลับไม่ได้
    """
    rows = db.scalars(select(CreditNote)).all()
    out: list[Event] = []
    for cn in rows:
        if cn.issued_at.date() != business_date:
            continue
        inv = db.get(TaxInvoice, cn.tax_invoice_id)
        folio = db.get(Folio, inv.folio_id) if inv else None
        b = folio.booking if folio else None
        out.append(adjustment_event(
            reason="creditnote",
            source_ref=cn.number,
            business_date=business_date,
            amount_satang=cn.gross_satang,
            vat_satang=cn.vat_satang,
            credit_note_no=cn.number,
            memo=f"ลดหนี้ใบกำกับ {inv.number if inv else '-'}"
                 f"{' · ' + b.ref if b else ''} · {cn.reason}",
        ))
    return out


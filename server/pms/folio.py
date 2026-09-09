"""บิล — ลงค่าใช้จ่าย รับชำระ ปิดบิล และออกใบกำกับภาษี

กติกาที่ยึด
-----------
* ลงค่าใช้จ่ายเข้าบิลที่ปิดไปแล้วไม่ได้ — ปิดแล้วคือปิด ถ้าต้องแก้ต้องเปิดใบใหม่
* ปิดบิลที่ยังจ่ายไม่ครบได้ แต่ต้องบันทึกเป็น **ลูกหนี้** ไม่ใช่ปล่อยหาย
  (โรงแรมจริงมีทั้งวางบิลเครดิตและบัตรถูกปฏิเสธตอนเช็กเอาต์)
* ใบกำกับภาษีออกได้ใบเดียวต่อหนึ่งบิล และออกได้เฉพาะบิลที่ปิดแล้ว
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from pms import clock
from pms.db import Booking, Charge, Folio, Payment, TaxInvoice
from pms.money import VatSplit, split_vat


class FolioError(Exception):
    pass


@dataclass
class FolioTotals:
    room: int
    fnb: int
    service: int
    discount: int
    gross: int
    paid: int
    balance: int


def get_folio(db: Session, ref: str) -> Folio:
    f = db.scalar(select(Folio).join(Booking).where(Booking.ref == ref))
    if f is None:
        raise FolioError(f"ไม่พบบิลของการจอง {ref}")
    return f


def totals(db: Session, folio: Folio) -> FolioTotals:
    by_kind: dict[str, int] = {}
    for c in folio.charges:
        by_kind[c.kind] = by_kind.get(c.kind, 0) + c.total_satang
    gross = sum(by_kind.values())
    paid = db.scalar(
        select(func.coalesce(func.sum(Payment.amount_satang), 0))
        .where(Payment.folio_id == folio.id)
    ) or 0
    return FolioTotals(
        room=by_kind.get("room", 0),
        fnb=by_kind.get("fnb", 0),
        service=by_kind.get("service", 0),
        discount=by_kind.get("discount", 0),
        gross=gross,
        paid=paid,
        balance=gross - paid,
    )


def add_charge(
    db: Session, folio: Folio, kind: str, label: str,
    unit_satang: int, qty: int = 1,
) -> Charge:
    if folio.status != "open":
        raise FolioError("บิลปิดแล้ว ลงรายการเพิ่มไม่ได้")
    if kind not in ("room", "fnb", "service", "discount"):
        raise FolioError(f"ไม่รู้จักประเภทรายการ {kind}")
    if qty < 1:
        raise FolioError("จำนวนต้องอย่างน้อย 1")
    # ส่วนลดเก็บเป็นค่าติดลบ ผลรวมจึงบวกตรง ๆ ได้โดยไม่ต้องแยกเคส
    if kind == "discount" and unit_satang > 0:
        unit_satang = -unit_satang
    c = Charge(folio_id=folio.id, kind=kind, label=label, qty=qty, unit_satang=unit_satang)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def add_payment(db: Session, folio: Folio, method: str, amount_satang: int) -> Payment:
    if folio.status != "open":
        raise FolioError("บิลปิดแล้ว รับชำระเพิ่มไม่ได้")
    if amount_satang <= 0:
        raise FolioError("ยอดชำระต้องมากกว่าศูนย์")
    p = Payment(folio_id=folio.id, method=method, amount_satang=amount_satang)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def close_folio(db: Session, folio: Folio) -> FolioTotals:
    """ปิดบิลและเช็กเอาต์ · ยอดค้างกลายเป็นลูกหนี้"""
    if folio.status == "closed":
        raise FolioError("บิลนี้ปิดไปแล้ว")

    t = totals(db, folio)
    folio.status = "closed"
    folio.closed_at = clock.now()

    b = folio.booking
    b.status = "checkedout"
    # คืนของการเข้าพักที่จบแล้วต้องอยู่ต่อ ไม่ลบทิ้ง — ไม่งั้นประวัติหายและ
    # ปฏิทินย้อนหลังจะโล่งทั้งที่มีคนพักจริง

    # ห้องเข้าคิวแม่บ้านเอง ไม่ต้องมีใครสั่ง — ห้องที่แขกออกแล้วแต่ไม่มีใครรู้
    # ว่าต้องทำ คือห้องที่ขายไม่ได้ทั้งที่ว่าง รายได้หายโดยไม่มีตัวเลขไหนติดลบ
    from pms.housekeeping import open_task
    open_task(db, b.room.no, kind="checkout",
              note=f"เช็กเอาต์ {b.guest_name}")

    db.commit()
    return t


def issue_tax_invoice(
    db: Session, folio: Folio, *,
    buyer_name: str, buyer_taxid: str = "", buyer_address: str = "",
    vat_pct: int = 7, number: str | None = None,
) -> TaxInvoice:
    """ออกใบกำกับภาษีเต็มรูปตาม ม.86/4

    ต้องปิดบิลก่อน — ออกจากบิลที่ยังเปิดอยู่แปลว่ายอดยังเปลี่ยนได้
    ซึ่งทำให้เอกสารภาษีไม่ตรงกับที่เก็บเงินจริง
    """
    if folio.status != "closed":
        raise FolioError("ต้องปิดบิลก่อนออกใบกำกับภาษี")
    if db.scalar(select(TaxInvoice).where(TaxInvoice.folio_id == folio.id)):
        raise FolioError("บิลนี้ออกใบกำกับภาษีไปแล้ว")
    if not buyer_name.strip():
        raise FolioError("ต้องระบุชื่อผู้ซื้อ")
    # ม.86/4 (3) บังคับให้มีเลขประจำตัวผู้เสียภาษีของผู้ซื้อกรณีนิติบุคคล
    # ออกไปโดยไม่มีเลข ผู้ซื้อเอาไปใช้ไม่ได้แล้วต้องกลับมาให้ออกใหม่
    if buyer_taxid and len(buyer_taxid.replace("-", "").strip()) != 13:
        raise FolioError("เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก")

    t = totals(db, folio)
    if t.gross <= 0:
        raise FolioError("ยอดบิลเป็นศูนย์ ออกใบกำกับภาษีไม่ได้")

    v: VatSplit = split_vat(t.gross, vat_pct)
    inv = TaxInvoice(
        number=number or _next_number(db),
        folio_id=folio.id,
        buyer_name=buyer_name.strip(),
        buyer_taxid=buyer_taxid.strip(),
        buyer_address=buyer_address.strip(),
        base_satang=v.base, vat_satang=v.vat, gross_satang=v.gross,
        vat_pct=vat_pct,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


def _next_number(db: Session) -> str:
    """เลขที่ใบกำกับภาษีเรียงต่อเนื่องรายปีพุทธศักราช

    เลขต้องเรียงไม่ข้าม — สรรพากรตรวจเรื่องนี้ ถ้าข้ามต้องอธิบายได้ว่าทำไม
    """
    # ปีตามเวลาไทย — ออกบิลคืนวันที่ 31 ธ.ค. ตอนสามทุ่มด้วย UTC จะได้เลขปีเก่า
    year = clock.today().year + 543
    prefix = f"INV-{year}-"
    last = db.scalar(
        select(func.max(TaxInvoice.number)).where(TaxInvoice.number.like(prefix + "%"))
    )
    seq = int(last.rsplit("-", 1)[1]) + 1 if last else 1
    return f"{prefix}{seq:05d}"

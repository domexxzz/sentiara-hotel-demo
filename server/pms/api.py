"""HTTP API ของ PMS

เส้นทางตั้งใจให้ตรงกับสิ่งที่หน้าจอเดโมทำอยู่แล้ว เพื่อให้ frontend ย้ายมาต่อ
ตัวจริงได้ทีละจอ ไม่ต้องรื้อทั้งหมดพร้อมกัน
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from pms import booking as bk
from pms import folio as fo
from pms.db import Booking, Expense, Folio, LedgerPost, Room, RoomType
from pms.ledger import LedgerClient, entry_for_expense, entry_for_folio
from pms.money import baht_text, to_baht
from pms.session import get_db, settings

router = APIRouter()


def _b(satang: int) -> float:
    return to_baht(satang)


# ── ห้อง ─────────────────────────────────────────────────────────────
@router.get("/rooms", summary="ผังห้องทั้งหมด")
def list_rooms(db: Session = Depends(get_db)):
    rooms = db.scalars(select(Room).order_by(Room.no))
    return {"rooms": [
        {"no": r.no, "type": r.room_type.name, "type_code": r.room_type.code,
         "floor": r.floor, "out_of_order": r.out_of_order,
         "rate": _b(r.room_type.rate_satang)}
        for r in rooms
    ]}


@router.get("/availability", summary="ห้องว่างในช่วงวันที่กำหนด")
def get_availability(
    check_in: date, check_out: date,
    room_type: str | None = None,
    db: Session = Depends(get_db),
):
    try:
        rows = bk.availability(db, check_in, check_out, room_type)
    except bk.BookingError as e:
        raise HTTPException(400, str(e))
    free = [a for a in rows if a.free]
    return {
        "check_in": check_in, "check_out": check_out,
        "free": [{"no": a.room.no, "type": a.room.room_type.name,
                  "rate": _b(a.room.room_type.rate_satang)} for a in free],
        "busy": [{"no": a.room.no, "nights": [n.isoformat() for n in a.busy_nights]}
                 for a in rows if not a.free],
        "free_count": len(free),
    }


# ── การจอง ───────────────────────────────────────────────────────────
class BookIn(BaseModel):
    room_no: str
    guest_name: str = Field(min_length=1, max_length=128)
    check_in: date
    check_out: date
    adults: int = Field(default=1, ge=1, le=10)
    children: int = Field(default=0, ge=0, le=10)
    source: str = Field(default="direct", pattern="^(direct|walkin|ota|line)$")
    guest_phone: str = ""


@router.post("/bookings", status_code=201, summary="จองห้อง")
def create_booking(body: BookIn, db: Session = Depends(get_db)):
    try:
        b = bk.create_booking(
            db, body.room_no, body.guest_name, body.check_in, body.check_out,
            adults=body.adults, children=body.children, source=body.source,
            guest_phone=body.guest_phone,
            weekend_pct=settings.weekend_pct, deposit_pct=settings.deposit_pct,
        )
    except bk.RoomNotAvailable as e:
        raise HTTPException(409, {
            "message": str(e),
            "room_no": e.room_no,
            "busy_nights": [n.isoformat() for n in e.nights],
        })
    except bk.BookingError as e:
        raise HTTPException(400, str(e))
    return _booking_out(db, b)


@router.get("/bookings/{ref}", summary="ดูการจอง")
def get_booking(ref: str, db: Session = Depends(get_db)):
    b = db.scalar(select(Booking).where(Booking.ref == ref))
    if b is None:
        raise HTTPException(404, f"ไม่พบการจอง {ref}")
    return _booking_out(db, b)


@router.post("/bookings/{ref}/check-in", summary="เช็กอิน")
def check_in(ref: str, db: Session = Depends(get_db)):
    try:
        return _booking_out(db, bk.check_in_booking(db, ref))
    except bk.BookingError as e:
        raise HTTPException(400, str(e))


@router.post("/bookings/{ref}/cancel", summary="ยกเลิกการจอง · คืนห้องให้ขายต่อได้")
def cancel(ref: str, db: Session = Depends(get_db)):
    try:
        return _booking_out(db, bk.cancel_booking(db, ref))
    except bk.BookingError as e:
        raise HTTPException(400, str(e))


def _booking_out(db: Session, b: Booking) -> dict:
    f = db.scalar(select(Folio).where(Folio.booking_id == b.id))
    t = fo.totals(db, f) if f else None
    return {
        "ref": b.ref, "guest": b.guest_name, "room": b.room.no,
        "check_in": b.check_in, "check_out": b.check_out,
        "nights": len(b.nights), "status": b.status, "source": b.source,
        "deposit": _b(b.deposit_satang),
        "folio": None if t is None else {
            "status": f.status, "gross": _b(t.gross),
            "paid": _b(t.paid), "balance": _b(t.balance),
        },
    }


# ── บิล ──────────────────────────────────────────────────────────────
class ChargeIn(BaseModel):
    kind: str = Field(pattern="^(room|fnb|service|discount)$")
    label: str = Field(min_length=1, max_length=160)
    amount: float = Field(gt=0)
    qty: int = Field(default=1, ge=1)


class PayIn(BaseModel):
    method: str = Field(pattern="^(cash|card|transfer|deposit)$")
    amount: float = Field(gt=0)


@router.get("/folios/{ref}", summary="ดูบิล")
def get_folio(ref: str, db: Session = Depends(get_db)):
    try:
        f = fo.get_folio(db, ref)
    except fo.FolioError as e:
        raise HTTPException(404, str(e))
    t = fo.totals(db, f)
    return {
        "ref": ref, "status": f.status,
        "charges": [{"kind": c.kind, "label": c.label, "qty": c.qty,
                     "unit": _b(c.unit_satang), "total": _b(c.total_satang)}
                    for c in f.charges],
        "payments": [{"method": p.method, "amount": _b(p.amount_satang)} for p in f.payments],
        "totals": {"room": _b(t.room), "fnb": _b(t.fnb), "service": _b(t.service),
                   "discount": _b(t.discount), "gross": _b(t.gross),
                   "paid": _b(t.paid), "balance": _b(t.balance)},
        "in_words": baht_text(t.gross),
    }


@router.post("/folios/{ref}/charges", status_code=201, summary="ลงค่าใช้จ่ายเข้าบิล")
def post_charge(ref: str, body: ChargeIn, db: Session = Depends(get_db)):
    from pms.money import baht
    try:
        f = fo.get_folio(db, ref)
        c = fo.add_charge(db, f, body.kind, body.label, baht(body.amount), body.qty)
    except fo.FolioError as e:
        raise HTTPException(400, str(e))
    return {"id": c.id, "total": _b(c.total_satang)}


@router.post("/folios/{ref}/payments", status_code=201, summary="รับชำระ")
def post_payment(ref: str, body: PayIn, db: Session = Depends(get_db)):
    from pms.money import baht
    try:
        f = fo.get_folio(db, ref)
        p = fo.add_payment(db, f, body.method, baht(body.amount))
    except fo.FolioError as e:
        raise HTTPException(400, str(e))
    return {"id": p.id, "amount": _b(p.amount_satang)}


@router.post("/folios/{ref}/close", summary="ปิดบิลและเช็กเอาต์")
def close(ref: str, db: Session = Depends(get_db)):
    try:
        f = fo.get_folio(db, ref)
        t = fo.close_folio(db, f)
    except fo.FolioError as e:
        raise HTTPException(400, str(e))
    return {"ref": ref, "gross": _b(t.gross), "paid": _b(t.paid),
            "balance": _b(t.balance), "in_words": baht_text(t.gross)}


class InvoiceIn(BaseModel):
    buyer_name: str = Field(min_length=1, max_length=200)
    buyer_taxid: str = ""
    buyer_address: str = ""


@router.post("/folios/{ref}/tax-invoice", status_code=201, summary="ออกใบกำกับภาษี ม.86/4")
def tax_invoice(ref: str, body: InvoiceIn, db: Session = Depends(get_db)):
    try:
        f = fo.get_folio(db, ref)
        inv = fo.issue_tax_invoice(
            db, f, buyer_name=body.buyer_name, buyer_taxid=body.buyer_taxid,
            buyer_address=body.buyer_address, vat_pct=settings.vat_pct,
        )
    except fo.FolioError as e:
        raise HTTPException(400, str(e))
    return {
        "number": inv.number, "buyer": inv.buyer_name, "taxid": inv.buyer_taxid,
        "base": _b(inv.base_satang), "vat": _b(inv.vat_satang),
        "gross": _b(inv.gross_satang), "vat_pct": inv.vat_pct,
        "in_words": baht_text(inv.gross_satang),
    }


# ── รายจ่าย ──────────────────────────────────────────────────────────
class ExpenseIn(BaseModel):
    at: date
    category: str = Field(pattern="^(payroll|utility|supplies|ota|maintenance|marketing|finance|other)$")
    label: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0)
    paid: bool = True
    due: date | None = None


@router.post("/expenses", status_code=201, summary="บันทึกรายจ่าย")
def add_expense(body: ExpenseIn, db: Session = Depends(get_db)):
    from pms.money import baht
    e = Expense(at=body.at, category=body.category, label=body.label,
                amount_satang=baht(body.amount), paid=body.paid, due=body.due)
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"id": e.id, "amount": _b(e.amount_satang)}


@router.get("/expenses", summary="รายจ่ายทั้งหมด")
def list_expenses(db: Session = Depends(get_db)):
    rows = db.scalars(select(Expense).order_by(Expense.at.desc()))
    return {"expenses": [
        {"id": e.id, "at": e.at, "category": e.category, "label": e.label,
         "amount": _b(e.amount_satang), "paid": e.paid, "due": e.due}
        for e in rows
    ]}


# ── บัญชี ────────────────────────────────────────────────────────────
@router.get("/ledger/preview/{ref}", summary="ดูรายการบัญชีของบิลก่อนส่ง")
def preview(ref: str, db: Session = Depends(get_db)):
    try:
        f = fo.get_folio(db, ref)
        e = entry_for_folio(db, f, settings.vat_pct)
    except Exception as ex:
        raise HTTPException(400, str(ex))
    return {
        "idempotency_key": e.idem_key, "reference": e.reference,
        "balanced": e.balanced,
        "debit_total": _b(e.debit_total), "credit_total": _b(e.credit_total),
        "lines": [{"account": l.account, "debit": _b(l.debit),
                   "credit": _b(l.credit), "memo": l.memo} for l in e.lines],
    }


@router.post("/ledger/send", summary="ส่งทุกอย่างที่ยังไม่เคยส่งเข้าระบบบัญชี")
def send_ledger(db: Session = Depends(get_db)):
    client = LedgerClient()
    return client.send_pending(db, settings.vat_pct)


@router.get("/ledger/posts", summary="ประวัติการส่งเข้าระบบบัญชี")
def ledger_posts(db: Session = Depends(get_db)):
    rows = db.scalars(select(LedgerPost).order_by(LedgerPost.id.desc()))
    return {"posts": [
        {"idem_key": p.idem_key, "status": p.status, "attempts": p.attempts,
         "response": p.response, "sent_at": p.sent_at}
        for p in rows
    ]}

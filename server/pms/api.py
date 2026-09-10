"""HTTP API ของ PMS

เส้นทางตั้งใจให้ตรงกับสิ่งที่หน้าจอเดโมทำอยู่แล้ว เพื่อให้ frontend ย้ายมาต่อ
ตัวจริงได้ทีละจอ ไม่ต้องรื้อทั้งหมดพร้อมกัน
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from pms import booking as bk
from pms import folio as fo
from pms import housekeeping as hk
from pms import registry as reg
from pms import wifi as wf
from pms.db import (EXPENSE_CATEGORIES, Booking, Expense, Folio, HousekeepingTask,
                    LedgerOutbox, Room, RoomType)
from pms.auth import AuthError, current_staff, login, logout, record, require
from pms.db import Staff
from pms.events import EventError, night_audit_events
from pms.ledger import LedgerClient, collect, outbox_summary
from pms.money import baht_text, to_baht
from pms.session import get_db, settings

router = APIRouter()


def _b(satang: int) -> float:
    return to_baht(satang)



# ── เข้าออกระบบ ──────────────────────────────────────────────────────
class LoginIn(BaseModel):
    card: str = Field(min_length=1, max_length=32)
    pin: str = Field(min_length=4, max_length=64)


@router.post("/auth/login", summary="แตะบัตรเข้าระบบ · คืนโทเคนที่แสดงครั้งเดียว")
def auth_login(body: LoginIn, db: Session = Depends(get_db)):
    try:
        token, staff = login(db, body.card, body.pin)
    except AuthError as e:
        # 401 เสมอ ไม่แยกว่าบัตรผิดหรือรหัสผิด ไม่บอกใบ้ว่าบัตรไหนมีอยู่จริง
        raise HTTPException(401, str(e)) from None
    from pms.auth import ROLES
    return {
        "token": token, "ref": staff.ref, "name": staff.name,
        "title": staff.title, "role": staff.role,
        "permissions": sorted(ROLES[staff.role]),
    }


@router.post("/auth/logout", summary="ออกจากระบบ · เพิกถอนโทเคนใบนี้")
def auth_logout(authorization: str = Header(default=""), db: Session = Depends(get_db)):
    if authorization.lower().startswith("bearer "):
        logout(db, authorization[7:].strip())
    return {"ok": True}


@router.get("/auth/me", summary="ตอนนี้ใช้งานในชื่อใคร มีสิทธิ์อะไรบ้าง")
def auth_me(staff: Staff = Depends(current_staff)):
    from pms.auth import ROLES
    return {
        "ref": staff.ref, "name": staff.name, "title": staff.title,
        "role": staff.role, "permissions": sorted(ROLES[staff.role]),
    }


# ── ห้อง ─────────────────────────────────────────────────────────────
@router.get("/rooms", summary="ผังห้องทั้งหมด",
             dependencies=[Depends(require("booking"))])
def list_rooms(db: Session = Depends(get_db)):
    rooms = db.scalars(select(Room).order_by(Room.no))
    return {"rooms": [
        {"no": r.no, "type": r.room_type.name, "type_code": r.room_type.code,
         "floor": r.floor, "out_of_order": r.out_of_order,
         "housekeeping": r.housekeeping, "sellable": hk.sellable(r),
         "rate": _b(r.room_type.rate_satang)}
        for r in rooms
    ]}


@router.get("/availability", summary="ห้องว่างในช่วงวันที่กำหนด",
             dependencies=[Depends(require("booking"))])
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


@router.post("/bookings", status_code=201, summary="จองห้อง",
             dependencies=[Depends(require("booking"))])
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


@router.get("/bookings", summary="รายการจอง · ใช้เติมผังห้องและปฏิทิน",
             dependencies=[Depends(require("booking"))])
def list_bookings(
    status: str | None = None,
    since: date | None = None,
    until: date | None = None,
    db: Session = Depends(get_db),
):
    """ค่าเริ่มต้นคืนเฉพาะที่ยังไม่จบ — หน้าจอต้องการของที่ยังขายอยู่

    ยกเลิกแล้วไม่ส่งกลับมาเลย เพราะคืนที่กันไว้ถูกคืนให้ขายต่อแล้ว
    ถ้าส่งไปด้วยหน้าจอจะวาดว่ามีคนจองทั้งที่ห้องว่าง
    """
    q = select(Booking).order_by(Booking.check_in, Booking.id)
    if status:
        q = q.where(Booking.status == status)
    else:
        q = q.where(Booking.status != "cancelled")
    if since:
        q = q.where(Booking.check_out > since)
    if until:
        q = q.where(Booking.check_in < until)
    rows = list(db.scalars(q))
    return {"count": len(rows), "bookings": [_booking_out(db, b) for b in rows]}


@router.get("/bookings/{ref}", summary="ดูการจอง",
             dependencies=[Depends(require("booking"))])
def get_booking(ref: str, db: Session = Depends(get_db)):
    b = db.scalar(select(Booking).where(Booking.ref == ref))
    if b is None:
        raise HTTPException(404, f"ไม่พบการจอง {ref}")
    return _booking_out(db, b)


@router.post("/bookings/{ref}/check-in", summary="เช็กอิน",
             dependencies=[Depends(require("booking"))])
def check_in(ref: str, db: Session = Depends(get_db)):
    try:
        b = bk.check_in_booking(db, ref)
    except bk.BookingError as e:
        raise HTTPException(400, str(e))
    out = _booking_out(db, b)
    # รหัส Wi-Fi ที่ออกให้ตอนเช็กอิน · แสดงครั้งเดียวให้เคาน์เตอร์พิมพ์ใบให้แขก
    # หลังจากนี้อ่านย้อนไม่ได้ เพราะฐานข้อมูลเก็บแค่แฮช
    secret = getattr(b, "wifi_secret_once", None)
    if secret:
        out["wifi"] = {"room": b.room.no, "secret": secret,
                       "note": "แสดงครั้งเดียว · อ่านย้อนไม่ได้ ทำหายต้องออกใหม่"}
    return out


@router.post("/bookings/{ref}/cancel", summary="ยกเลิกการจอง · คืนห้องให้ขายต่อได้",
             dependencies=[Depends(require("booking"))])
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



# ── งานแม่บ้าน ───────────────────────────────────────────────────────
class HkOpenIn(BaseModel):
    room_no: str
    kind: str = Field(default="checkout", pattern="^(checkout|stayover|deep|maintenance)$")
    note: str = ""


class HkMoveIn(BaseModel):
    to: str = Field(pattern="^(doing|inspect|done|cancelled)$")
    reason: str = ""
    photos: int | None = None


@router.get("/housekeeping", summary="คิวงานแม่บ้าน · เรียงตามลำดับที่ควรทำจริง",
            dependencies=[Depends(require("housekeeping"))])
def hk_board(db: Session = Depends(get_db)):
    return {"tasks": hk.board(db)}


@router.post("/housekeeping", status_code=201, summary="เปิดงานให้ห้องหนึ่ง",
             dependencies=[Depends(require("housekeeping"))])
def hk_open(body: HkOpenIn, staff: Staff = Depends(current_staff),
            db: Session = Depends(get_db)):
    try:
        t = hk.open_task(db, body.room_no, kind=body.kind, note=body.note)
    except hk.HousekeepingError as e:
        raise HTTPException(400, str(e)) from None
    record(db, staff, "hk.open", "room", body.room_no, body.kind)
    db.commit()
    return {"ref": t.ref, "room": body.room_no, "status": t.status, "priority": t.priority}


@router.post("/housekeeping/{ref}", summary="ขยับงานไปสถานะถัดไป")
def hk_move(ref: str, body: HkMoveIn, staff: Staff = Depends(current_staff),
            db: Session = Depends(get_db)):
    """ผ่านหรือตีกลับต้องมีสิทธิ์ `inspect` — ห้องกลับไปขายได้ตรงนี้

    คนที่ทำงานเป็นคนตรวจงานตัวเองเมื่อไร มาตรฐานก็หายไปทันที
    """
    from pms.auth import can
    need = "inspect" if body.to in ("done",) else "housekeeping"
    # ตีกลับ (inspect → doing) ก็เป็นการตัดสินคุณภาพ ต้องมีสิทธิ์ตรวจเหมือนกัน
    cur = db.scalar(select(HousekeepingTask).where(HousekeepingTask.ref == ref))
    if cur is not None and cur.status == "inspect" and body.to == "doing":
        need = "inspect"
    if not can(staff.role, need):
        raise HTTPException(403, f"บทบาทนี้ไม่มีสิทธิ์ {need} — งานนี้ต้องให้หัวหน้าเป็นคนกด")

    try:
        t = hk.advance(db, ref, body.to, staff=staff, reason=body.reason, photos=body.photos)
    except hk.HousekeepingError as e:
        raise HTTPException(400, str(e)) from None
    record(db, staff, f"hk.{body.to}", "room", t.room.no, body.reason)
    db.commit()
    return {"ref": t.ref, "room": t.room.no, "status": t.status,
            "housekeeping": t.room.housekeeping, "sellable": hk.sellable(t.room)}


# ── บิล ──────────────────────────────────────────────────────────────
class ChargeIn(BaseModel):
    kind: str = Field(pattern="^(room|fnb|service|discount)$")
    label: str = Field(min_length=1, max_length=160)
    amount: float = Field(gt=0)
    qty: int = Field(default=1, ge=1)


class PayIn(BaseModel):
    method: str = Field(pattern="^(cash|card|transfer|deposit)$")
    amount: float = Field(gt=0)


@router.get("/folios/{ref}", summary="ดูบิล",
             dependencies=[Depends(require("folio"))])
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


@router.post("/folios/{ref}/charges", status_code=201, summary="ลงค่าใช้จ่ายเข้าบิล",
             dependencies=[Depends(require("folio"))])
def post_charge(ref: str, body: ChargeIn, db: Session = Depends(get_db)):
    from pms.money import baht
    try:
        f = fo.get_folio(db, ref)
        c = fo.add_charge(db, f, body.kind, body.label, baht(body.amount), body.qty)
    except fo.FolioError as e:
        raise HTTPException(400, str(e))
    return {"id": c.id, "total": _b(c.total_satang)}


@router.post("/folios/{ref}/payments", status_code=201, summary="รับชำระ",
             dependencies=[Depends(require("folio"))])
def post_payment(ref: str, body: PayIn, db: Session = Depends(get_db)):
    from pms.money import baht
    try:
        f = fo.get_folio(db, ref)
        p = fo.add_payment(db, f, body.method, baht(body.amount))
    except fo.FolioError as e:
        raise HTTPException(400, str(e))
    return {"id": p.id, "amount": _b(p.amount_satang)}


@router.post("/folios/{ref}/close", summary="ปิดบิลและเช็กเอาต์",
             dependencies=[Depends(require("folio"))])
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


@router.post("/folios/{ref}/tax-invoice", status_code=201, summary="ออกใบกำกับภาษี ม.86/4",
             dependencies=[Depends(require("invoice"))])
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




class CreditNoteIn(BaseModel):
    reason: str = Field(min_length=1, max_length=300)
    amount: float = Field(gt=0)


@router.post("/folios/{ref}/credit-note", status_code=201,
             summary="ออกใบลดหนี้ ม.86/10 · ต้องอ้างใบกำกับภาษีใบเดิม",
             dependencies=[Depends(require("invoice"))])
def credit_note(ref: str, body: CreditNoteIn, staff: Staff = Depends(current_staff),
                db: Session = Depends(get_db)):
    from pms.money import baht
    try:
        cn = fo.issue_credit_note(db, ref, reason=body.reason,
                                  amount_satang=baht(body.amount))
    except fo.FolioError as e:
        raise HTTPException(400, str(e)) from None
    record(db, staff, "creditnote.issue", "booking", ref,
           f"{cn.number} · {body.reason}")
    db.commit()
    return {
        "number": cn.number, "reason": cn.reason,
        "base": _b(cn.base_satang), "vat": _b(cn.vat_satang),
        "gross": _b(cn.gross_satang), "vat_pct": cn.vat_pct,
        "in_words": baht_text(cn.gross_satang),
    }


@router.get("/folios/{ref}/credit-notes", summary="ใบลดหนี้ทั้งหมดของบิลนี้",
            dependencies=[Depends(require("invoice"))])
def list_credit_notes(ref: str, db: Session = Depends(get_db)):
    rows = fo.credit_notes(db, ref)
    return {"credit_notes": [
        {"number": c.number, "reason": c.reason, "gross": _b(c.gross_satang),
         "vat": _b(c.vat_satang), "issued_at": c.issued_at} for c in rows
    ]}



# ── Wi-Fi ที่พัก ─────────────────────────────────────────────────────
#
# แบ่งเป็นสองกลุ่มที่ยืนยันตัวตนคนละแบบโดยตั้งใจ
#   /wifi/authorize · /wifi/accounting   อุปกรณ์เครือข่ายเรียก → ความลับร่วม
#   ที่เหลือ                              พนักงานเรียก → โทเคนกับสิทธิ์ wifi
#
# เราเตอร์ไม่ใช่คน จะให้ถือบัญชีพนักงานไม่ได้ · และช่องของอุปกรณ์ต้องอยู่บน
# วงในเท่านั้น ห้ามเปิดออกอินเทอร์เน็ต
def _gateway(x_wifi_secret: str = Header(default="")) -> None:
    """ตัวประกอบสำหรับช่องที่อุปกรณ์เรียก · ไม่ตั้งค่า = ปฏิเสธทุกคำขอ"""
    if not wf.gateway_ok(x_wifi_secret):
        raise HTTPException(
            401,
            "อุปกรณ์ไม่ได้รับอนุญาต — ตั้ง PMS_WIFI_SECRET ให้ตรงกันทั้งสองฝั่ง "
            "(ไม่ตั้งค่าคือปฏิเสธทุกคำขอโดยตั้งใจ ไม่ใช่ปล่อยผ่าน)",
        )


class WifiAuthIn(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    secret: str = Field(min_length=1, max_length=64)
    mac: str = Field(min_length=1, max_length=32)


@router.post("/wifi/authorize", summary="อุปกรณ์ถามว่าให้เครื่องนี้ต่อได้ไหม",
             dependencies=[Depends(_gateway)])
def wifi_authorize(body: WifiAuthIn, db: Session = Depends(get_db)):
    try:
        return wf.authorize(db, body.username, body.secret, body.mac)
    except wf.WifiError as e:
        # 403 ไม่ใช่ 401 — คำขอมีสิทธิ์เรียกเส้นทางนี้ แต่แขกคนนั้นต่อไม่ได้
        raise HTTPException(403, str(e)) from None


class WifiAcctIn(BaseModel):
    action: str = Field(pattern="^(start|update|stop)$")
    username: str = Field(min_length=1, max_length=32)
    session_id: str = Field(min_length=1, max_length=64)
    mac: str = Field(min_length=1, max_length=32)
    ip: str = ""
    nas: str = ""
    bytes_in: int = 0
    bytes_out: int = 0


@router.post("/wifi/accounting", summary="อุปกรณ์รายงานการเปิด–ปิด session",
             dependencies=[Depends(_gateway)])
def wifi_accounting(body: WifiAcctIn, db: Session = Depends(get_db)):
    try:
        row = wf.accounting(db, **body.model_dump())
    except wf.WifiError as e:
        raise HTTPException(400, str(e)) from None
    db.commit()
    return {"session_id": row.acct_session_id, "ended_at": row.ended_at}


@router.post("/bookings/{ref}/wifi", summary="ออกรหัส Wi-Fi ใหม่ · แสดงครั้งเดียว",
             dependencies=[Depends(require("wifi"))])
def wifi_issue(ref: str, staff: Staff = Depends(current_staff),
               db: Session = Depends(get_db)):
    """ใช้ตอนแขกทำใบหาย · ออกใหม่แล้วรหัสเดิมใช้ไม่ได้ทันที

    เก็บแค่แฮช จึงอ่านรหัสเดิมให้ฟังไม่ได้ ต้องออกใหม่อย่างเดียว
    """
    try:
        cred, secret = wf.issue(db, ref)
    except wf.WifiError as e:
        raise HTTPException(400, str(e)) from None
    record(db, staff, "wifi.issue", "booking", ref, f"ห้อง {cred.username}")
    db.commit()
    return {
        "room": cred.username, "secret": secret,
        "valid_until": cred.valid_until, "device_limit": cred.device_limit,
        "note": "รหัสนี้แสดงครั้งเดียว · ระบบเก็บแค่แฮช อ่านย้อนไม่ได้",
    }


@router.post("/bookings/{ref}/wifi/revoke", summary="ตัดสิทธิ์ Wi-Fi ทันที",
             dependencies=[Depends(require("wifi"))])
def wifi_revoke(ref: str, staff: Staff = Depends(current_staff),
                db: Session = Depends(get_db)):
    try:
        cred = wf.revoke(db, ref)
    except wf.WifiError as e:
        raise HTTPException(400, str(e)) from None
    record(db, staff, "wifi.revoke", "booking", ref, f"ห้อง {cred.username}")
    db.commit()
    return {"room": cred.username, "revoked": True}


@router.get("/wifi/online", summary="ใครกำลังต่ออยู่ตอนนี้",
            dependencies=[Depends(require("wifi"))])
def wifi_online(db: Session = Depends(get_db)):
    rows = wf.online(db)
    return {"devices": len(rows), "rows": rows}


@router.get("/wifi/report",
            summary="รายงานตัวตนตาม ม.26 พ.ร.บ.คอมพิวเตอร์ · IP นี้คือใคร",
            dependencies=[Depends(require("wifi"))])
def wifi_report(since: date, until: date, db: Session = Depends(get_db)):
    rows = wf.identity_report(db, since, until)
    return {
        "since": since, "until": until,
        "sessions": len(rows),
        "unregistered": sum(1 for r in rows if not r["registered"]),
        "rows": rows,
        "note": ("รายงานนี้ตอบว่า session ไหนคือใคร · ข้อมูลจราจร (เข้าเว็บอะไร) "
                 "อยู่ที่อุปกรณ์เครือข่าย ขอจากที่นั่น — ระบบนี้ไม่เก็บโดยตั้งใจ"),
    }


# ── ทะเบียนผู้พัก ────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    nationality: str = Field(default="ไทย", max_length=64)
    id_type: str = Field(pattern="^(thai_id|passport)$")
    id_number: str = Field(min_length=1, max_length=32)
    birth_date: date | None = None
    address: str = ""
    arrived_from: str = ""
    phone: str = ""


@router.post("/bookings/{ref}/register", status_code=201,
             summary="ลงทะเบียนผู้พัก ร.ร.3 · ม.35 พ.ร.บ.โรงแรม 2547",
             dependencies=[Depends(require("register"))])
def guest_register(ref: str, body: RegisterIn, staff: Staff = Depends(current_staff),
                   db: Session = Depends(get_db)):
    try:
        row = reg.register(db, ref, **body.model_dump())
    except reg.RegistryError as e:
        raise HTTPException(400, str(e)) from None
    record(db, staff, "register.create", "booking", ref, row.full_name)
    db.commit()
    return {
        "ref": ref, "name": row.full_name, "nationality": row.nationality,
        "foreign": row.foreign, "tm30_due": row.tm30_due,
        "note": ("ต้องแจ้ง ตม.30 ภายใน 24 ชั่วโมง" if row.foreign
                 else "ผู้พักสัญชาติไทย ไม่ต้องแจ้ง ตม.30"),
    }


@router.get("/register", summary="ทะเบียนผู้พัก ร.ร.4 · เล่มที่นายทะเบียนขอดู",
            dependencies=[Depends(require("register"))])
def rr4(since: date, until: date, db: Session = Depends(get_db)):
    return {"since": since, "until": until, "rows": reg.rr4(db, since, until)}


@router.get("/register/tm30", summary="คนต่างด้าวที่ยังไม่ได้แจ้ง · ใกล้ครบกำหนดขึ้นก่อน",
            dependencies=[Depends(require("register"))])
def tm30_list(db: Session = Depends(get_db)):
    rows = reg.tm30_pending(db)
    return {
        "pending": len(rows),
        "overdue": sum(1 for r in rows if r["overdue"]),
        "urgent": sum(1 for r in rows if r["urgent"]),
        "rows": rows,
    }


class Tm30In(BaseModel):
    receipt: str = ""


@router.post("/register/{ref}/tm30", summary="บันทึกว่าแจ้ง ตม.30 แล้ว",
             dependencies=[Depends(require("register"))])
def tm30_sent(ref: str, body: Tm30In, staff: Staff = Depends(current_staff),
              db: Session = Depends(get_db)):
    """⚠ บันทึกสถานะในเครื่องเท่านั้น — ยังไม่ได้ยิงเข้าระบบ ตม. จริง"""
    try:
        row = reg.mark_tm30_sent(db, ref, body.receipt)
    except reg.RegistryError as e:
        raise HTTPException(400, str(e)) from None
    record(db, staff, "register.tm30", "booking", ref, body.receipt)
    db.commit()
    return {"ref": ref, "sent_at": row.tm30_sent_at, "receipt": row.tm30_receipt,
            "note": "บันทึกในระบบแล้ว — การส่งเข้าระบบ ตม. จริงยังต้องทำแยก"}


# ── รายจ่าย ──────────────────────────────────────────────────────────
class ExpenseIn(BaseModel):
    at: date
    #: สร้างจาก EXPENSE_CATEGORIES ที่เดียว — เพิ่มหมวดแล้วไม่ต้องตามแก้ regex ตรงนี้
    category: str = Field(pattern="^(" + "|".join(EXPENSE_CATEGORIES) + ")$")
    label: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0)
    paid: bool = True
    due: date | None = None


@router.post("/expenses", status_code=201, summary="บันทึกรายจ่าย",
             dependencies=[Depends(require("expense"))])
def add_expense(body: ExpenseIn, db: Session = Depends(get_db)):
    from pms.money import baht
    e = Expense(at=body.at, category=body.category, label=body.label,
                amount_satang=baht(body.amount), paid=body.paid, due=body.due)
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"id": e.id, "amount": _b(e.amount_satang)}


@router.get("/expenses", summary="รายจ่ายทั้งหมด",
             dependencies=[Depends(require("expense"))])
def list_expenses(db: Session = Depends(get_db)):
    rows = db.scalars(select(Expense).order_by(Expense.at.desc()))
    return {"expenses": [
        {"id": e.id, "at": e.at, "category": e.category, "label": e.label,
         "amount": _b(e.amount_satang), "paid": e.paid, "due": e.due}
        for e in rows
    ]}


# ── บัญชี ────────────────────────────────────────────────────────────
#
# หมายเหตุสำคัญ: เราส่ง **เหตุการณ์** ไม่ได้ส่งรายการบัญชี — PMS ไม่รู้ผังบัญชี
# ของโรงแรมนั้นและไม่ควรรู้ การแปลงเป็นเดบิต/เครดิตเป็นหน้าที่ของกฎลงบัญชี
# ที่นักบัญชีตั้งและเซ็นรับที่ปลายทาง
@router.get("/ledger/preview", summary="ดูเหตุการณ์ของวันทำการหนึ่งก่อนส่ง",
             dependencies=[Depends(require("ledger"))])
def preview(business_date: date | None = None, db: Session = Depends(get_db)):
    from pms import clock
    day = business_date or clock.today()
    try:
        events = night_audit_events(db, day, settings.vat_pct)
    except EventError as ex:
        raise HTTPException(400, str(ex))
    return {
        "business_date": day.isoformat(),
        "count": len(events),
        # seq จริงมาจากคิวตอนบันทึก · ตรงนี้ใส่ 0 เพราะเป็นแค่ตัวอย่างให้ดู
        "events": [e.envelope(0) for e in events],
    }


@router.post("/ledger/collect", summary="กวาดเหตุการณ์ของวันทำการเข้าคิว (night audit)",
             dependencies=[Depends(require("ledger"))])
def collect_events(business_date: date | None = None, db: Session = Depends(get_db)):
    return collect(db, business_date, settings.vat_pct)


@router.post("/ledger/send", summary="ส่งคิวที่ยังไม่เคยส่งสำเร็จ",
             dependencies=[Depends(require("ledger"))])
def send_ledger(db: Session = Depends(get_db)):
    return LedgerClient().send_pending(db)


@router.get("/ledger/outbox", summary="คิวส่งออกและสถานะของแต่ละรายการ",
             dependencies=[Depends(require("ledger"))])
def ledger_outbox(db: Session = Depends(get_db)):
    rows = db.scalars(select(LedgerOutbox).order_by(LedgerOutbox.seq.desc()))
    return {
        "summary": outbox_summary(db),
        "rows": [
            {"seq": r.seq, "event_id": r.event_id, "event_type": r.event_type,
             "business_date": r.business_date, "status": r.status,
             "attempts": r.attempts, "response": r.response, "sent_at": r.sent_at}
            for r in rows
        ],
    }

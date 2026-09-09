"""เทสใบลดหนี้ · ม.86/10 ประมวลรัษฎากร

ใบสำคัญที่ลงบัญชีแล้วแก้ไม่ได้และลบไม่ได้ ลงผิดหรือยกเลิกหลังออกใบกำกับภาษี
แล้ว ทางเดียวคือออกใบลดหนี้แล้วตั้งรายการกลับ

เทสกลุ่มนี้ปกป้องข้อเดียว — **ยอดที่ลดต้องโยงกลับไปหาใบกำกับใบเดิมได้เสมอ
และห้ามลดเกินยอดที่เหลือ** ลดเกินเมื่อไร ภาษีขายที่ยื่นจะติดลบ ซึ่งเป็น
สัญญาณที่สรรพากรตรวจเจอทันที

    cd server && python -m pytest -q
"""
from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from pms import clock
from pms import folio as fo
from pms.app import create_app
from pms.auth import hash_secret
from pms.db import CreditNote, LedgerOutbox, Room, RoomType, Staff
from pms.events import credit_note_events
from pms.money import baht
from pms.session import session_factory

API = "/api/v1"
PIN = "717171"


@pytest.fixture()
def app(tmp_path):
    a = create_app(f"sqlite:///{tmp_path}/t.db")
    db = session_factory()()
    dx = RoomType(code="deluxe", name="ดีลักซ์", rate_satang=baht(1650), ota_satang=baht(1875))
    db.add(dx)
    db.flush()
    db.add_all([Room(no="101", room_type_id=dx.id, floor="1"),
                Room(no="102", room_type_id=dx.id, floor="1")])
    for name, role, card in [("เจ้าของ", "owner", "T-OWN"), ("ร้านอาหาร", "pos", "T-PS")]:
        db.add(Staff(name=name, title=name, role=role, card=card, pin_hash=hash_secret(PIN)))
    db.commit()
    db.close()
    return a


def as_role(app, role: str) -> TestClient:
    card = {"owner": "T-OWN", "pos": "T-PS"}[role]
    c = TestClient(app)
    r = c.post(f"{API}/auth/login", json={"card": card, "pin": PIN})
    assert r.status_code == 200
    c.headers["authorization"] = "Bearer " + r.json()["token"]
    return c


@pytest.fixture()
def c(app):
    return as_role(app, "owner")


@pytest.fixture()
def db():
    s = session_factory()()
    yield s
    s.close()


def _invoiced(c, room="101"):
    """เข้าพักจนจบและออกใบกำกับภาษีแล้ว · ยอดรวม ฿3,300"""
    ref = c.post(f"{API}/bookings", json={
        "room_no": room, "guest_name": "คุณอนันต์",
        "check_in": "2026-09-14", "check_out": "2026-09-16"}).json()["ref"]
    c.post(f"{API}/folios/{ref}/payments", json={"method": "cash", "amount": 3300})
    c.post(f"{API}/folios/{ref}/close")
    inv = c.post(f"{API}/folios/{ref}/tax-invoice", json={"buyer_name": "บริษัท ก"}).json()
    return ref, inv


# ══ 1 · ต้องอ้างใบกำกับใบเดิมเสมอ ═══════════════════════════════════
def test_cannot_credit_a_folio_with_no_tax_invoice(c):
    """ใบลดหนี้ที่ลอยอยู่โดยไม่รู้ว่าลดของใบไหน คือใบที่สรรพากรตรวจแล้ว
    โยงกลับไม่ได้"""
    ref = c.post(f"{API}/bookings", json={
        "room_no": "101", "guest_name": "ก",
        "check_in": "2026-09-14", "check_out": "2026-09-16"}).json()["ref"]
    c.post(f"{API}/folios/{ref}/close")
    r = c.post(f"{API}/folios/{ref}/credit-note",
               json={"reason": "ยกเลิก", "amount": 100})
    assert r.status_code == 400 and "ใบกำกับ" in r.json()["detail"]


def test_reason_is_required(c):
    """ม.86/10 บังคับให้ระบุเหตุผล และเป็นสิ่งที่ผู้สอบบัญชีถามข้อแรก"""
    ref, _ = _invoiced(c)
    r = c.post(f"{API}/folios/{ref}/credit-note", json={"reason": "  ", "amount": 100})
    assert r.status_code == 422 or r.status_code == 400


# ══ 2 · ยอดและภาษี ═══════════════════════════════════════════════════
def test_vat_is_extracted_not_added(c):
    """ราคาที่ประกาศรวมภาษีแล้ว ใบลดหนี้จึงต้องถอด VAT ออกเหมือนใบกำกับ
    ฐาน + ภาษี ต้องเท่ากับยอดที่ลดเป๊ะ"""
    ref, _ = _invoiced(c)
    cn = c.post(f"{API}/folios/{ref}/credit-note",
                json={"reason": "ห้องมีปัญหา ลดให้หนึ่งคืน", "amount": 1650}).json()
    assert round(cn["base"] + cn["vat"], 2) == cn["gross"] == 1650.0
    assert cn["vat_pct"] == 7


def test_cannot_credit_more_than_the_invoice(c):
    """ลดเกินแล้วภาษีขายที่ยื่นจะติดลบ ซึ่งสรรพากรตรวจเจอทันที"""
    ref, inv = _invoiced(c)
    r = c.post(f"{API}/folios/{ref}/credit-note",
               json={"reason": "ลดเกิน", "amount": inv["gross"] + 1})
    assert r.status_code == 400 and "ลดได้ไม่เกิน" in r.json()["detail"]


def test_partial_credits_accumulate_and_stop_at_the_limit(c):
    """ลดทีละส่วนได้ แต่รวมกันต้องไม่เกินยอดใบกำกับ"""
    ref, _ = _invoiced(c)                                   # ฿3,300
    assert c.post(f"{API}/folios/{ref}/credit-note",
                  json={"reason": "ครั้งที่หนึ่ง", "amount": 2000}).status_code == 201
    assert c.post(f"{API}/folios/{ref}/credit-note",
                  json={"reason": "ครั้งที่สอง", "amount": 1300}).status_code == 201
    over = c.post(f"{API}/folios/{ref}/credit-note",
                  json={"reason": "เกินแล้ว", "amount": 1})
    assert over.status_code == 400


def test_credit_note_uses_the_original_invoice_vat_rate(c, db):
    """อัตราเปลี่ยนระหว่างทางแล้วใช้อัตราใหม่ ยอดจะไม่หักล้างกันพอดี"""
    ref, inv = _invoiced(c)
    c.post(f"{API}/folios/{ref}/credit-note", json={"reason": "คืนเงิน", "amount": 1000})
    cn = db.scalar(select(CreditNote))
    assert cn.vat_pct == inv["vat_pct"]


# ══ 3 · เลขที่เอกสาร ═════════════════════════════════════════════════
def test_numbers_run_in_sequence_without_gaps(c):
    """เลขต้องเรียงไม่ข้าม เหมือนใบกำกับภาษี — สรรพากรตรวจเรื่องนี้"""
    ref, _ = _invoiced(c)
    nums = [c.post(f"{API}/folios/{ref}/credit-note",
                   json={"reason": f"ครั้งที่ {i}", "amount": 100}).json()["number"]
            for i in range(1, 4)]
    seq = [int(n.rsplit("-", 1)[1]) for n in nums]
    assert seq == list(range(seq[0], seq[0] + 3))
    assert all(n.startswith(f"CN-{clock.today().year + 543}-") for n in nums)


def test_number_is_printable(c):
    """เลขที่ถูกพิมพ์ลงรายงานและส่งออกเป็น CSV/DBF — อักขระควบคุมตัวเดียว
    ทำให้ไฟล์เพี้ยนทั้งคอลัมน์"""
    ref, _ = _invoiced(c)
    n = c.post(f"{API}/folios/{ref}/credit-note",
               json={"reason": "ทดสอบ", "amount": 100}).json()["number"]
    assert n == n.strip() and not any(ch in n for ch in "\n\r\t")


# ══ 4 · ต่อเข้าสมุดบัญชี — ปลดล็อก ADJ ═══════════════════════════════
def test_a_credit_note_produces_an_adj_event(c, db):
    """`adjustment_event` เขียนไว้ตั้งแต่ต้นแต่ไม่มีใครเรียก เพราะไม่มีใบลดหนี้
    ตอนนี้มีแล้ว จึงผลิต ADJ ได้จริง"""
    ref, _ = _invoiced(c)
    c.post(f"{API}/folios/{ref}/credit-note", json={"reason": "ลดราคา", "amount": 500})
    evs = credit_note_events(db, clock.today())
    assert len(evs) == 1
    e = evs[0]
    assert e.event_type == "ADJ"
    assert e.payload["creditNoteNo"].startswith("CN-")
    assert e.payload["amount"] == "500.00"
    assert e.payload["vatAmount"] != "0.00", "ต้องกลับ VAT ด้วย ไม่ใช่แค่ยอดรวม"


def test_collect_puts_the_adj_in_the_outbox(c, db):
    from pms.ledger import collect
    ref, _ = _invoiced(c)
    c.post(f"{API}/folios/{ref}/credit-note", json={"reason": "ลดราคา", "amount": 500})
    made = collect(db, clock.today(), 7)
    assert made["ADJ"] == 1
    rows = db.scalars(select(LedgerOutbox).where(LedgerOutbox.event_type == "ADJ")).all()
    assert len(rows) == 1


def test_adjustment_still_refuses_vat_reversal_without_a_number():
    """ตัวกันเดิมต้องยังทำงาน — กลับ VAT โดยไม่มีเลขใบลดหนี้ยังห้ามอยู่"""
    from pms.events import EventError, adjustment_event
    with pytest.raises(EventError):
        adjustment_event(reason="cancel", source_ref="BK-1",
                         business_date=date(2026, 9, 14),
                         amount_satang=baht(990), vat_satang=baht(64.77))


# ══ 5 · สิทธิ์และร่องรอย ═════════════════════════════════════════════
def test_restaurant_staff_cannot_issue_a_credit_note(app):
    c = as_role(app, "pos")
    r = c.post(f"{API}/folios/BK-1/credit-note", json={"reason": "x", "amount": 100})
    assert r.status_code == 403


def test_issuing_leaves_an_audit_trace(c, db):
    from pms.db import AuditEvent
    ref, _ = _invoiced(c)
    c.post(f"{API}/folios/{ref}/credit-note", json={"reason": "แขกร้องเรียน", "amount": 300})
    row = db.scalars(
        select(AuditEvent).where(AuditEvent.action == "creditnote.issue")).all()[-1]
    assert row.ref == ref and "แขกร้องเรียน" in row.detail


def test_listing_shows_every_credit_note_for_the_folio(c):
    ref, _ = _invoiced(c)
    c.post(f"{API}/folios/{ref}/credit-note", json={"reason": "หนึ่ง", "amount": 100})
    c.post(f"{API}/folios/{ref}/credit-note", json={"reason": "สอง", "amount": 200})
    out = c.get(f"{API}/folios/{ref}/credit-notes").json()["credit_notes"]
    assert [x["gross"] for x in out] == [100.0, 200.0]
    assert [x["reason"] for x in out] == ["หนึ่ง", "สอง"]

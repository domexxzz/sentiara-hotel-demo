"""เทสสัญญาการส่งข้อมูลเข้าระบบบัญชี

สัญญาของ Ledger Bridge คือ **PMS ส่งเหตุการณ์ ไม่ได้ส่งรายการบัญชี**
ไฟล์นี้คุมสามเรื่องที่ผิดแล้วเงินหายจากบัญชีโดยไม่มีอะไรฟ้อง

  1. รูปแบบจำนวนเงิน — ต้องเป็นสตริง float หลุดออกไปไม่ได้
  2. ความคงที่ของ eventId — ไม่คงที่ = ส่งซ้ำแล้วบัญชีซ้ำ
  3. seq ต้องไม่ถอยหลัง — ถอยเมื่อไรปลายทางทิ้งทั้งชุดโดยไม่แจ้ง

    cd server && python -m pytest -q
"""
from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from pms import folio as fo
from pms.app import create_app
from pms.db import (
    EXPENSE_CATEGORIES, Booking, Expense, LedgerOutbox, Payment, Room, RoomType,
)
from pms.events import (
    EventError, adjustment_event, expense_event, folio_close_event, money,
    night_audit_events, payment_event,
)
from pms.ledger import LedgerClient, collect, enqueue
from pms.money import baht
from pms.session import session_factory

API = "/api/v1"

MON = date(2026, 9, 14)
TUE = date(2026, 9, 15)


@pytest.fixture()
def app(tmp_path):
    a = create_app(f"sqlite:///{tmp_path}/t.db")
    db = session_factory()()
    dx = RoomType(code="deluxe", name="ดีลักซ์", rate_satang=baht(1650), ota_satang=baht(1875))
    db.add(dx)
    db.flush()
    db.add_all([
        Room(no="101", room_type_id=dx.id, floor="1"),
        Room(no="102", room_type_id=dx.id, floor="1"),
    ])
    db.commit()
    db.close()
    return a


@pytest.fixture()
def c(app):
    """ล็อกอินเป็นเจ้าของ — บทบาทเดียวที่มีสิทธิ์ครบทุกข้อ"""
    return _as(app, "owner")


def _as(app, role: str) -> TestClient:
    """ไคลเอนต์ที่ล็อกอินเป็นบทบาทนั้นแล้ว

    เทสทุกตัวต้องผ่านระบบสิทธิ์เหมือนของจริง — ถ้าเปิดทางลับให้เทสข้ามยาม
    ยามที่พังจะไม่มีอะไรจับได้เลย
    """
    from pms.auth import hash_secret
    from pms.db import Staff
    db = session_factory()()
    if not db.scalar(select(Staff).where(Staff.role == role)):
        db.add(Staff(name=f"เทส-{role}", title="", role=role,
                     card=f"T-{role.upper()}", pin_hash=hash_secret("999999")))
        db.commit()
    card = db.scalar(select(Staff).where(Staff.role == role)).card
    db.close()
    c = TestClient(app)
    r = c.post(f"{API}/auth/login", json={"card": card, "pin": "999999"})
    assert r.status_code == 200, r.text
    c.headers["authorization"] = "Bearer " + r.json()["token"]
    return c


@pytest.fixture()
def db():
    s = session_factory()()
    yield s
    s.close()


def _stay(c, room="101", name="คุณอนันต์"):
    r = c.post(f"{API}/bookings", json={"room_no": room, "guest_name": name,
                                        "check_in": "2026-09-14", "check_out": "2026-09-16"})
    return r.json()["ref"]


def _cents(s: str) -> int:
    """อ่านสตริงจำนวนเงินกลับเป็นสตางค์ · ใช้เทียบยอดในเทสโดยไม่แตะ float"""
    sign = -1 if s.startswith("-") else 1
    whole, frac = s.lstrip("-").split(".")
    return sign * (int(whole) * 100 + int(frac))


# ══ 1 · จำนวนเงิน ════════════════════════════════════════════════════
def test_money_leaves_as_string_never_float():
    """ปลายทางปฏิเสธตัวเลขทศนิยมทุกกรณี — ไม่ใช่ความจู้จี้

    `JSON.parse('{"a":21608.65}')` ให้ 21608.650000000001 ตั้งแต่ก่อนถึงโค้ด
    ที่จะตรวจ ความคลาดเคลื่อนเกิดที่ตัวแปลง JSON ไม่ใช่ที่ตรรกะของใคร
    """
    assert money(550000) == "5500.00"
    assert money(5) == "0.05"
    assert money(-12345) == "-123.45"
    with pytest.raises(EventError):
        money(5500.00)
    with pytest.raises(EventError):
        money(True)          # bool เป็น int ใน Python ต้องกันด้วย


def test_every_amount_in_a_real_event_is_a_string(c, db):
    """ไล่ทุกช่องเงินของเหตุการณ์จริง ไม่ให้มีตัวเลขหลุดออกไปแม้ช่องเดียว"""
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/charges",
           json={"kind": "fnb", "label": "อาหาร", "amount": 333})
    ev = night_audit_events(db, MON, 7)[0]
    p = ev.payload
    for key in ("vatBase", "vatAmount", "grandTotal"):
        assert isinstance(p[key], str), f"{key} ต้องเป็นสตริง"
    for line in p["lines"]:
        assert isinstance(line["grossAmount"], str)
        assert isinstance(line["netAmount"], str)


# ══ 2 · การรับรู้รายได้ ══════════════════════════════════════════════
def test_night_audit_reports_only_that_nights_room_revenue(c, db):
    """ค่าห้องต้องรับรู้ทีละคืน ไม่ใช่ทั้งก้อนตั้งแต่วันจอง

    `create_booking()` ลงค่าห้องทุกคืนเข้าบิลตั้งแต่วันจอง ซึ่งถูกสำหรับบิล
    (แขกเห็นยอดรวมทันที) แต่ผิดสำหรับบัญชี — เงินรับล่วงหน้ายังไม่ใช่รายได้
    จนกว่าจะได้ให้บริการจริง จองวันนี้เข้าพักเดือนหน้า รายได้เป็นของเดือนหน้า
    """
    _stay(c)                                     # 14–16 ก.ย. = สองคืน
    evs = night_audit_events(db, MON, 7)
    assert len(evs) == 1
    room = next(l for l in evs[0].payload["lines"] if l["category"] == "ROOM")
    assert room["grossAmount"] == "1650.00"      # คืนเดียว ไม่ใช่ 3300
    assert evs[0].payload["grandTotal"] == "1650.00"


def test_room_revenue_appears_on_each_night_separately(c, db):
    _stay(c)
    for day in (MON, TUE):
        evs = night_audit_events(db, day, 7)
        assert len(evs) == 1 and evs[0].payload["grandTotal"] == "1650.00"


def test_cancelled_booking_produces_no_revenue(c, db):
    ref = _stay(c)
    c.post(f"{API}/bookings/{ref}/cancel")
    assert night_audit_events(db, MON, 7) == []


def test_night_audit_splits_minibar_and_laundry_from_fnb(c, db):
    """ผังบัญชีของโรงแรมแยกมินิบาร์กับซักรีดออกจากอาหาร — ต้องแยกตั้งแต่ต้นทาง

    `Charge.kind` ของเรามีแค่ room/fnb/service/discount ซึ่งหยาบกว่าที่บัญชี
    ต้องการ จึงดูชื่อรายการประกอบด้วย
    """
    ref = _stay(c)
    for label, amount in [("อาหารเช้า", 300), ("มินิบาร์ · น้ำดื่ม", 40), ("ซักรีด", 120)]:
        c.post(f"{API}/folios/{ref}/charges",
               json={"kind": "fnb", "label": label, "amount": amount})
    from pms import clock
    ev = night_audit_events(db, clock.today(), 7)[0]
    cats = {l["category"]: l["grossAmount"] for l in ev.payload["lines"]}
    assert cats["FNB"] == "300.00"
    assert cats["MINIBAR"] == "40.00"
    assert cats["LAUNDRY"] == "120.00"


def test_event_totals_reconcile_exactly(c, db):
    """ฐาน + ภาษี = ยอดรวม เป๊ะเสมอ แม้ปัดเศษทีละหมวดแล้วรวมกัน

    ส่วนต่างจากการปัดต้องยกให้ภาษี ไม่ใช่ปล่อยให้ผลรวมเพี้ยน
    """
    ref = _stay(c)
    for label, amount in [("อาหาร", 333), ("มินิบาร์", 77), ("ซักรีด", 45)]:
        c.post(f"{API}/folios/{ref}/charges",
               json={"kind": "fnb", "label": label, "amount": amount})
    from pms import clock
    p = night_audit_events(db, clock.today(), 7)[0].payload
    assert _cents(p["vatBase"]) + _cents(p["vatAmount"]) == _cents(p["grandTotal"])
    assert sum(_cents(l["grossAmount"]) for l in p["lines"]) == _cents(p["grandTotal"])


# ══ 3 · eventId ══════════════════════════════════════════════════════
def test_event_id_is_stable_across_rebuilds(c, db):
    """ประกอบใหม่กี่ครั้ง eventId ต้องเท่าเดิม ไม่งั้นส่งซ้ำ = บัญชีซ้ำ"""
    _stay(c)
    a = [e.event_id for e in night_audit_events(db, MON, 7)]
    b = [e.event_id for e in night_audit_events(db, MON, 7)]
    assert a == b
    assert a[0].startswith("NA-2026-09-14-BK-")


def test_event_id_uses_random_ref_not_sequential_id(c, db):
    """eventId ต้องผูกกับ ref ที่สุ่ม ไม่ใช่ id ที่เป็นเลขเรียง

    ถ้าผูกกับ id แล้ววันหนึ่ง seed ฐานใหม่หรือย้ายเครื่อง เลขจะวนกลับมาเป็น
    1, 2, 3 ชนกับของที่ส่งไปแล้ว ปลายทางปฏิเสธเงียบ ๆ ว่า "ซ้ำ" ทั้งที่เป็น
    คนละรายการ — เงินหายจากบัญชีโดยไม่มีอะไรฟ้อง
    """
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/payments", json={"method": "cash", "amount": 100})
    b = db.scalar(select(Booking).where(Booking.ref == ref))
    pay = db.scalars(select(Payment)).all()[-1]
    assert b.ref.startswith("BK-") and pay.ref.startswith("PY-")
    assert payment_event(db, pay, 7).event_id == f"STL-{pay.ref}"

    e = Expense(at=MON, category="supplies", label="ผ้า", amount_satang=baht(500))
    db.add(e)
    db.commit()
    db.refresh(e)
    assert e.ref.startswith("EX-")
    assert expense_event(e).event_id == f"EXP-{e.ref}"


def test_event_id_has_no_control_characters(c, db):
    """eventId ถูกพิมพ์ลงรายงานและส่งออกเป็น CSV/DBF ต่อ
    อักขระควบคุมตัวเดียวทำให้ไฟล์ส่งออกเพี้ยนทั้งคอลัมน์ตั้งแต่แถวนั้นลงไป"""
    _stay(c)
    for e in night_audit_events(db, MON, 7):
        assert not any(ch in e.event_id for ch in "\n\r\t")


def test_deposit_and_settlement_are_different_event_types(c, db):
    """มัดจำเป็นหนี้สิน ส่วนเงินที่รับตอนเข้าพักคือการล้างลูกหนี้

    แยกที่ `method` ไม่ใช่ที่สถานะการจอง เพราะสถานะเปลี่ยนได้ตลอดเวลา
    แต่ eventId ต้องคงที่ตลอดกาล
    """
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/payments", json={"method": "deposit", "amount": 990})
    c.post(f"{API}/folios/{ref}/payments", json={"method": "cash", "amount": 2310})
    pays = db.scalars(select(Payment).order_by(Payment.id)).all()
    assert [payment_event(db, p, 7).event_type for p in pays] == ["DEP", "STL"]


def test_close_event_takes_vat_from_the_tax_invoice(c, db):
    """ตัวเลขภาษีมาจากใบกำกับ ไม่คำนวณใหม่

    เอกสารที่ลูกค้าถือกับที่ลงบัญชีต้องเป็นตัวเลขชุดเดียวกัน ปัดเศษคนละจังหวะ
    แล้วต่างกันสตางค์เดียว ฝ่ายบัญชีก็กระทบยอดไม่ลงและหาสาเหตุยากมาก
    """
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/charges",
           json={"kind": "discount", "label": "ส่วนลด", "amount": 200})
    c.post(f"{API}/folios/{ref}/payments", json={"method": "cash", "amount": 3100})
    c.post(f"{API}/folios/{ref}/close")
    inv = c.post(f"{API}/folios/{ref}/tax-invoice",
                 json={"buyer_name": "บริษัท ก"}).json()

    ev = folio_close_event(db, fo.get_folio(db, ref), 7)
    assert _cents(ev.payload["vatAmount"]) == round(inv["vat"] * 100)
    assert _cents(ev.payload["vatBase"]) == round(inv["base"] * 100)
    assert ev.payload["taxInvoiceNo"] == inv["number"]


def test_open_folio_has_no_close_event(c, db):
    ref = _stay(c)
    with pytest.raises(EventError):
        folio_close_event(db, fo.get_folio(db, ref), 7)


def test_adjustment_refuses_to_reverse_vat_without_a_credit_note():
    """กลับ VAT โดยไม่มีใบลดหนี้ = ยอดภาษีในสมุดกับที่ยื่นสรรพากรไม่ตรงกัน
    และไม่มีเอกสารอ้างอิงตอนถูกตรวจ"""
    with pytest.raises(EventError):
        adjustment_event(reason="cancel", source_ref="BK-1", business_date=MON,
                         amount_satang=baht(990), vat_satang=baht(64.77))
    ok = adjustment_event(reason="cancel", source_ref="BK-1", business_date=MON,
                          amount_satang=baht(990), vat_satang=baht(64.77),
                          credit_note_no="CN-2569-00001")
    assert ok.event_type == "ADJ" and ok.event_id == "ADJ-cancel-BK-1"


# ══ 4 · คิวส่งออก ════════════════════════════════════════════════════
def test_outbox_seq_never_goes_backwards(c, db):
    """seq ถอยหลังเมื่อไร ปลายทางทิ้งทั้งชุดโดยไม่แจ้ง

    SQLite `INTEGER PRIMARY KEY` เฉย ๆ คือ rowid ซึ่งเอาเลขที่ลบแล้วกลับมาใช้ซ้ำ
    (เลขใหม่ = max ปัจจุบัน + 1) ต้องเป็น AUTOINCREMENT เท่านั้น
    """
    _stay(c)
    rows = [enqueue(db, e) for e in night_audit_events(db, MON, 7)]
    rows += [enqueue(db, e) for e in night_audit_events(db, TUE, 7)]
    seqs = [r.seq for r in rows]
    assert seqs == sorted(set(seqs))

    top = max(seqs)
    db.delete(db.get(LedgerOutbox, top))          # ลบแถวท้ายทิ้ง
    db.commit()

    _stay(c, room="102", name="คุณสมหญิง")
    again = [enqueue(db, e) for e in night_audit_events(db, MON, 7)]
    assert max(r.seq for r in again) > top, "seq ใช้เลขซ้ำหลังลบแถว — ขาด AUTOINCREMENT"


def test_enqueue_twice_does_not_duplicate(c, db):
    _stay(c)
    ev = night_audit_events(db, MON, 7)[0]
    assert enqueue(db, ev).seq == enqueue(db, ev).seq


def test_collect_is_idempotent(c, db):
    """night audit รันซ้ำวันเดิมต้องไม่เพิ่มของในคิว"""
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/payments", json={"method": "cash", "amount": 3300})
    a = collect(db, MON, 7)
    b = collect(db, MON, 7)
    assert a["NA"] == 1
    assert b["NA"] == 0 and b["skipped"] >= 1


def test_payload_is_frozen_at_enqueue_time(c, db):
    """ของที่ส่งต้องเป็นภาพ ณ ตอนที่เหตุการณ์เกิด ไม่ใช่ ณ ตอนที่ส่ง

    เจ้าของแก้เรตหลังแขกเช็กเอาต์แล้ว ยอดที่ประกอบใหม่จะไม่ตรงกับที่เก็บเงินจริง
    """
    import json
    ref = _stay(c)
    row = enqueue(db, night_audit_events(db, MON, 7)[0])
    before = json.loads(row.payload_json)["grandTotal"]

    c.post(f"{API}/folios/{ref}/charges",
           json={"kind": "fnb", "label": "อาหาร", "amount": 500})
    db.refresh(row)
    assert json.loads(row.payload_json)["grandTotal"] == before


def test_send_marks_queue_and_does_not_resend(c, db):
    _stay(c)
    collect(db, MON, 7)
    client = LedgerClient(dry_run=True)
    first = client.send_pending(db)
    second = client.send_pending(db)
    assert first["sent"] >= 1 and first["dry_run"] is True
    assert second["queued"] == 0 and second["sent"] == 0


def test_send_uses_queue_seq_not_a_fresh_number(c, db):
    """กฎข้อ 1 ของปลายทาง — seq มาจากคิวของเรา ไม่ใช่สร้างใหม่ทุกครั้งที่ยิง"""
    _stay(c)
    rows = [enqueue(db, e) for e in night_audit_events(db, MON, 7)]
    LedgerClient(dry_run=True).send_pending(db)
    for r in rows:
        db.refresh(r)
        assert r.status == "sent" and r.attempts == 1


# ══ 5 · หมวดรายจ่าย ══════════════════════════════════════════════════
def test_expense_categories_map_one_to_one():
    """หมวดต้องละเอียดพอแมปกับผังบัญชีตัวต่อตัว

    เดิม utility เป็นก้อนเดียวทั้งที่ผังแยกค่าไฟ/ค่าน้ำ/ค่าเน็ต และ finance
    รวมดอกเบี้ยกับค่าธรรมเนียมธนาคารซึ่งอยู่คนละกลุ่มงบ รวมไว้แล้วนักบัญชี
    ต้องมานั่งแยกเองทุกเดือน ซึ่งเป็นงานที่ระบบควรทำให้ตั้งแต่ตอนบันทึก
    """
    for gone in ("utility", "finance"):
        assert gone not in EXPENSE_CATEGORIES
    for need in ("electricity", "water", "telecom", "bankfee", "interest"):
        assert need in EXPENSE_CATEGORIES


def test_api_rejects_retired_expense_category(c):
    bad = c.post(f"{API}/expenses", json={"at": "2026-09-14", "category": "utility",
                                          "label": "ค่าไฟ", "amount": 100})
    assert bad.status_code == 422
    good = c.post(f"{API}/expenses", json={"at": "2026-09-14", "category": "electricity",
                                           "label": "ค่าไฟ", "amount": 100})
    assert good.status_code == 201


# ══ 6 · กับดัก watermark ══════════════════════════════════════════════
#
# เจอตอนยิงของจริงเข้า sandbox ครั้งแรก — ส่งไป 4 รายการ ปลายทางตอบ 202
# ไม่มี error ใด ๆ แต่ **ไม่มีอะไรเข้าคิวเลย** เพราะลำดับต่ำกว่าที่รับไปแล้ว
# และปลายทางรายงานกรณีนั้นว่า `duplicates` ซึ่งดูเหมือนความสำเร็จทุกประการ
def test_align_sequence_lifts_queue_above_watermark(c, db):
    """ฐานข้อมูลใหม่เริ่มนับที่ 1 เสมอ · ถ้า source เดิมเคยถูกใช้มาก่อน
    ของทุกชิ้นที่เราส่งจะหายเงียบ ๆ จนกว่าจะดันลำดับให้พ้น watermark"""
    from pms.ledger import align_sequence
    _stay(c)
    rows = [enqueue(db, e) for e in night_audit_events(db, MON, 7)]
    assert min(r.seq for r in rows) == 1

    moved = align_sequence(db, 905_868_066)
    assert moved == len(rows)

    after = list(db.scalars(select(LedgerOutbox)))
    assert all(r.seq > 905_868_066 for r in after)
    # ออกเลขใหม่ได้ แต่ eventId ต้องเท่าเดิม — นั่นคือตัวกันบัญชีซ้ำตัวจริง
    assert {r.event_id for r in after} == {r.event_id for r in rows}


def test_align_keeps_new_rows_above_watermark_too(c, db):
    """แถวที่เพิ่มเข้ามาหลังจัดลำดับต้องได้เลขสูงต่อไป ไม่ใช่ย้อนกลับไปที่ 1"""
    from pms.ledger import align_sequence
    _stay(c)
    enqueue(db, night_audit_events(db, MON, 7)[0])
    align_sequence(db, 905_868_066)

    fresh = enqueue(db, night_audit_events(db, TUE, 7)[0])
    assert fresh.seq > 905_868_066


def test_align_leaves_already_sent_rows_alone(c, db):
    """ของที่ส่งสำเร็จไปแล้วห้ามออกเลขใหม่ — ประวัติต้องตรงกับที่ปลายทางได้รับ"""
    from pms.ledger import align_sequence
    _stay(c)
    row = enqueue(db, night_audit_events(db, MON, 7)[0])
    LedgerClient(dry_run=True).send_pending(db)
    db.refresh(row)
    was = row.seq

    align_sequence(db, 905_868_066)
    db.refresh(row)
    assert row.seq == was and row.status == "sent"


def test_partial_insert_is_reported_as_failure(c, db, monkeypatch):
    """ปลายทางตอบ 202 แต่รับเข้าคิวไม่ครบ = ล้มเหลว ไม่ใช่สำเร็จ

    ถ้านับว่าสำเร็จ แถวจะถูกทำเครื่องหมาย sent แล้วไม่มีใครส่งซ้ำอีกเลย
    ยอดหายจากบัญชีถาวรโดยไม่มีอะไรฟ้อง
    """
    _stay(c)
    collect(db, MON, 7)
    client = LedgerClient(dry_run=False)

    class FakeBridge:
        def ingest_status(self):
            return {"watermark": 0}

        def send_events(self, events):
            return {"received": len(events), "inserted": 0,
                    "duplicates": len(events), "watermark": 0}

    monkeypatch.setattr(client, "bridge", lambda: FakeBridge())
    r = client.send_pending(db)
    assert r["failed"] == r["queued"] and r["sent"] == 0
    assert "รับเข้าคิวจริงแค่ 0" in r["errors"][0]["detail"]
    assert all(x.status == "failed" for x in db.scalars(select(LedgerOutbox)))

"""เทสทะเบียนผู้พัก — งานที่กฎหมายบังคับและมีโทษ

    cd server && python -m pytest tests/test_registry.py -q

สามเรื่องที่เทสหนักที่สุด
  1. ลงทะเบียน "ผู้พัก" ไม่ใช่ "ผู้จอง" — จองใบเดียวมีหลายคนได้
  2. นาฬิกา 24 ชั่วโมง — ทั้ง ม.35 พ.ร.บ.โรงแรม และ ม.38 พ.ร.บ.คนเข้าเมือง
     วัดจากเวลา ไม่ใช่จากความตั้งใจ
  3. ตม.30 ต้องมีเลขรับ — ไม่งั้นระบบบอกว่า "แจ้งแล้ว" ได้ทั้งที่ไม่มีใครแจ้ง
"""
from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from pms import clock
from pms import registry as reg
from pms.app import create_app
from pms.auth import hash_secret
from pms.db import GuestRegistration, Room, RoomType, Staff
from pms.money import baht
from pms.session import session_factory

API = "/api/v1"
PIN = "606060"

#: เลขบัตรที่หลักตรวจสอบถูกต้องจริง — คิดจากสูตร ไม่ใช่กดเลขมั่วให้ครบ 13 หลัก
#: เลขมั่วผ่านการนับหลักได้ทุกครั้ง แต่ไม่ผ่าน valid_thai_id() และไม่ควรผ่าน
GOOD_ID = "1103700123458"

TH = {"full_name": "คุณอนันต์ ศรีสุข", "nationality": "TH",
      "id_number": GOOD_ID}
JP = {"full_name": "Kenji Tanaka", "nationality": "JP",
      "id_number": "TK1234567", "id_kind": "passport"}


@pytest.fixture()
def app(tmp_path):
    a = create_app(f"sqlite:///{tmp_path}/r.db")
    db = session_factory()()
    dx = RoomType(code="deluxe", name="ดีลักซ์",
                  rate_satang=baht(1650), ota_satang=baht(1875))
    db.add(dx)
    db.flush()
    db.add(Room(no="101", room_type_id=dx.id, floor="1"))
    for name, role, card in [("เจ้าของ", "owner", "T-OWN"),
                             ("เคาน์เตอร์", "front", "T-FD"),
                             ("แม่บ้าน", "hk", "T-HK")]:
        db.add(Staff(name=name, title=name, role=role, card=card,
                     pin_hash=hash_secret(PIN)))
    db.commit()
    db.close()
    return a


def as_role(app, role: str) -> TestClient:
    """ทะเบียนผู้พักเป็นข้อมูลแสดงตน ทุกเส้นทางมียามอยู่ · ต้องล็อกอินก่อน"""
    card = {"owner": "T-OWN", "front": "T-FD", "hk": "T-HK"}[role]
    c = TestClient(app)
    r = c.post(f"{API}/auth/login", json={"card": card, "pin": PIN})
    assert r.status_code == 200, r.text
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


def _booking(c) -> str:
    return c.post(f"{API}/bookings", json={
        "room_no": "101", "guest_name": "คุณอนันต์ ศรีสุข",
        "check_in": "2026-09-14", "check_out": "2026-09-16",
        "adults": 2}).json()["ref"]


# ══ ลงทะเบียนผู้พัก ══════════════════════════════════════════════════
def test_one_row_per_person_not_per_booking(c):
    """จองใบเดียวมีผู้ใหญ่สองคน = ทะเบียนสองแถว

    ระบบที่ลงแถวเดียวตามชื่อคนจองจะตรวจไม่ผ่าน เพราะกฎหมายลงทะเบียน "ผู้พัก"
    """
    ref = _booking(c)
    assert c.post(f"{API}/bookings/{ref}/guests", json=TH).status_code == 201
    assert c.post(f"{API}/bookings/{ref}/guests", json=JP).status_code == 201
    rows = c.get(f"{API}/registry/book").json()["rows"]
    assert len(rows) == 2
    assert {r["name"] for r in rows} == {TH["full_name"], JP["full_name"]}


def test_thai_id_must_be_thirteen_digits(c):
    ref = _booking(c)
    r = c.post(f"{API}/bookings/{ref}/guests", json={**TH, "id_number": "12345"})
    assert r.status_code == 400


def test_thai_id_checksum_is_actually_verified():
    """ตรวจหลักสุดท้ายจริง ไม่ใช่แค่นับหลัก

    เลขที่พิมพ์ผิดหนึ่งตัวผ่านการนับหลักได้ทุกครั้ง แล้วไปโผล่เป็น ร.ร.4
    ที่นายทะเบียนตรวจแล้วไม่ตรงกับใคร — จุดที่แก้ย้อนหลังแพงที่สุด
    """
    assert reg.valid_thai_id(GOOD_ID)
    assert reg.valid_thai_id("-".join([GOOD_ID[0], GOOD_ID[1:5], GOOD_ID[5:10],
                                       GOOD_ID[10:12], GOOD_ID[12]]))
    # สลับเลขสองตัวติดกัน — จำนวนหลักเท่าเดิม หลักตรวจสอบต้องไม่ผ่าน
    swapped = GOOD_ID[:4] + GOOD_ID[5] + GOOD_ID[4] + GOOD_ID[6:]
    assert not reg.valid_thai_id(swapped)
    assert not reg.valid_thai_id("1234567890123")
    assert not reg.valid_thai_id(GOOD_ID[:12])


def test_made_up_id_is_refused_at_the_counter(c):
    ref = _booking(c)
    r = c.post(f"{API}/bookings/{ref}/guests",
               json={**TH, "id_number": "1234567890123"})
    assert r.status_code == 400 and "หลักสุดท้าย" in r.json()["detail"]


def test_id_number_is_required(c):
    """ปล่อยว่างแล้วตามเก็บทีหลัง = ถึงกำหนดแล้วยังกรอกไม่ครบ"""
    ref = _booking(c)
    r = c.post(f"{API}/bookings/{ref}/guests", json={**TH, "id_number": ""})
    assert r.status_code == 422           # pydantic ปัดตกตั้งแต่ชั้นตรวจข้อมูล


def test_passport_is_the_default_for_foreigners(c):
    ref = _booking(c)
    out = c.post(f"{API}/bookings/{ref}/guests",
                 json={"full_name": "Kenji Tanaka", "nationality": "JP",
                       "id_number": "TK1234567"}).json()
    assert out["id_kind"] == "passport"
    assert out["tm30_required"] is True


def test_thai_guest_needs_no_tm30(c):
    ref = _booking(c)
    out = c.post(f"{API}/bookings/{ref}/guests", json=TH).json()
    assert out["tm30_required"] is False


# ══ นาฬิกา 24 ชั่วโมง ════════════════════════════════════════════════
def test_due_list_counts_down_from_arrival(c):
    ref = _booking(c)
    c.post(f"{API}/bookings/{ref}/guests", json=TH)
    due = c.get(f"{API}/registry/due").json()
    assert due["overdue"] == 0
    item = due["items"][0]
    assert 23 <= item["hours_left"] <= 24
    assert set(item["needs"]) == {"ร.ร.3", "ร.ร.4"}


def test_foreigner_needs_all_three_forms(c):
    ref = _booking(c)
    c.post(f"{API}/bookings/{ref}/guests", json=JP)
    item = c.get(f"{API}/registry/due").json()["items"][0]
    assert set(item["needs"]) == {"ร.ร.3", "ร.ร.4", "ตม.30"}


def test_overdue_after_twenty_four_hours(c, db):
    """เลย 24 ชั่วโมงต้องขึ้นว่าเกินกำหนด ไม่ใช่เงียบไป"""
    ref = _booking(c)
    c.post(f"{API}/bookings/{ref}/guests", json=TH)
    g = db.scalar(select(GuestRegistration))
    g.arrived_at = clock.now() - timedelta(hours=30)
    db.commit()

    rows = reg.outstanding(db)
    assert rows[0].overdue is True
    assert rows[0].hours_left < 0


def test_urgent_flag_within_six_hours(c, db):
    ref = _booking(c)
    c.post(f"{API}/bookings/{ref}/guests", json=TH)
    g = db.scalar(select(GuestRegistration))
    g.arrived_at = clock.now() - timedelta(hours=20)
    db.commit()
    d = reg.outstanding(db)[0]
    assert d.urgent is True and d.overdue is False


def test_finished_guests_drop_off_the_list(c):
    ref = _booking(c)
    rid = c.post(f"{API}/bookings/{ref}/guests", json=TH).json()["id"]
    c.post(f"{API}/registrations/{rid}/sign-rr3")
    c.post(f"{API}/registry/file-rr4")
    assert c.get(f"{API}/registry/due").json()["items"] == []


# ══ ยื่นเอกสาร ═══════════════════════════════════════════════════════
def test_rr4_only_files_signed_cards(c):
    """ร.ร.4 คือการรวบรวมสิ่งที่ผู้พักลงชื่อไว้ · ส่งก่อนเซ็นก็ไม่มีฐานรองรับ"""
    ref = _booking(c)
    a = c.post(f"{API}/bookings/{ref}/guests", json=TH).json()["id"]
    c.post(f"{API}/bookings/{ref}/guests", json=JP)
    c.post(f"{API}/registrations/{a}/sign-rr3")

    out = c.post(f"{API}/registry/file-rr4").json()
    assert out["filed"] == 1
    assert out["waiting_rr3"] == 1
    assert out["batch"].startswith("RR4-")


def test_cannot_sign_the_same_card_twice(c):
    ref = _booking(c)
    rid = c.post(f"{API}/bookings/{ref}/guests", json=TH).json()["id"]
    assert c.post(f"{API}/registrations/{rid}/sign-rr3").status_code == 200
    assert c.post(f"{API}/registrations/{rid}/sign-rr3").status_code == 400


def test_tm30_requires_a_receipt_number(c):
    """ไม่มีเลขรับ = ระบบจะบอกว่าแจ้งแล้วได้ทั้งที่ไม่มีใครแจ้ง

    อันตรายกว่าไม่มีระบบเลย เพราะคนเชื่อว่าปลอดภัยแล้ว
    """
    ref = _booking(c)
    rid = c.post(f"{API}/bookings/{ref}/guests", json=JP).json()["id"]
    assert c.post(f"{API}/registrations/{rid}/tm30",
                  json={"receipt": ""}).status_code == 422
    ok = c.post(f"{API}/registrations/{rid}/tm30", json={"receipt": "TM30-6900123"})
    assert ok.status_code == 200
    assert ok.json()["tm30_receipt"] == "TM30-6900123"


def test_tm30_rejected_for_thai_guests(c):
    ref = _booking(c)
    rid = c.post(f"{API}/bookings/{ref}/guests", json=TH).json()["id"]
    r = c.post(f"{API}/registrations/{rid}/tm30", json={"receipt": "X1"})
    assert r.status_code == 400


def test_tm30_cannot_be_filed_twice(c):
    ref = _booking(c)
    rid = c.post(f"{API}/bookings/{ref}/guests", json=JP).json()["id"]
    c.post(f"{API}/registrations/{rid}/tm30", json={"receipt": "TM30-1"})
    r = c.post(f"{API}/registrations/{rid}/tm30", json={"receipt": "TM30-2"})
    assert r.status_code == 400


# ══ ร่องรอยการตรวจสอบ ════════════════════════════════════════════════
def test_every_filing_leaves_a_trail(c):
    ref = _booking(c)
    rid = c.post(f"{API}/bookings/{ref}/guests", json=JP).json()["id"]
    c.post(f"{API}/registrations/{rid}/sign-rr3")
    c.post(f"{API}/registrations/{rid}/tm30", json={"receipt": "TM30-9"})
    c.post(f"{API}/registry/file-rr4")

    actions = [r["action"] for r in c.get(f"{API}/audit").json()["rows"]]
    assert {"register_guest", "sign_rr3", "file_tm30", "file_rr4"} <= set(actions)


def test_audit_log_has_no_way_to_delete(c):
    """เอกสารกฎหมายที่แก้ได้โดยไม่ทิ้งร่องรอย เท่ากับไม่มีค่าตอนถูกตรวจ"""
    assert c.delete(f"{API}/audit").status_code == 405


# ══ ภาษีหัก ณ ที่จ่าย ════════════════════════════════════════════════
def test_withholding_only_applies_to_services(c):
    """ภาษีหัก ณ ที่จ่ายใช้กับ *บริการ* ไม่ใช่ *สินค้า*

    ซื้อผ้าปูที่นอนไม่ต้องหัก · จ้างซักผ้าต้องหัก 3%
    หักผิดฝั่งแล้วเจ้าหนี้ได้เงินไม่ครบ หรือสรรพากรได้ไม่ครบ
    """
    goods = c.post(f"{API}/expenses", json={
        "at": "2026-09-14", "category": "supplies", "label": "ผ้าปูที่นอน",
        "amount": 9800, "wht_kind": "none"}).json()
    assert goods["withholding_tax"] == 0.0
    assert goods["net_payable"] == 9800.0

    service = c.post(f"{API}/expenses", json={
        "at": "2026-09-14", "category": "maintenance", "label": "จ้างซักผ้าปู",
        "amount": 9800, "wht_kind": "service"}).json()
    assert service["withholding_tax"] == 294.0        # 3%
    assert service["net_payable"] == 9506.0


def test_withheld_amounts_always_reconcile():
    """จ่ายจริง + ที่ค้างนำส่ง ต้องเท่าค่าใช้จ่ายพอดีทุกกรณี"""
    from pms.money import WHT_RATES, withhold
    for kind in WHT_RATES:
        for base in (1, 99, 100_000, 333_333, 1_070_000):
            w = withhold(base, kind)
            assert w.net + w.tax == w.base


def test_expense_event_carries_all_three_amounts(c, db):
    """กฎลงบัญชีต้องแยกเจ้าหนี้กับภาษีค้างนำส่ง จึงต้องได้ครบสามยอด"""
    from sqlalchemy import select as _sel

    from pms.db import Expense
    from pms.events import expense_event
    c.post(f"{API}/expenses", json={
        "at": "2026-09-14", "category": "maintenance", "label": "ค่าซ่อมแอร์",
        "amount": 5000, "wht_kind": "service"})
    e = db.scalar(_sel(Expense))
    p = expense_event(e).payload
    assert p["amount"] == "5000.00"
    assert p["withholdingTax"] == "150.00"
    assert p["netPayable"] == "4850.00"
    assert p["withholdingKind"] == "service"


# ══ สิทธิ์ ═══════════════════════════════════════════════════════════
def test_housekeeping_cannot_read_the_register(app):
    """ข้อมูลแสดงตนของแขกเป็นข้อมูลอ่อนไหว จำกัดเฉพาะคนที่ต้องใช้

    แม่บ้านต้องรู้ว่าห้องไหนต้องทำ ไม่ต้องรู้เลขพาสปอร์ตของใคร
    """
    hk = as_role(app, "hk")
    assert hk.get(f"{API}/registry/due").status_code == 403
    assert hk.get(f"{API}/registry/book").status_code == 403
    assert hk.get(f"{API}/audit").status_code == 403


def test_the_register_is_closed_to_strangers(app):
    """ไม่ล็อกอินต้องไม่เห็นอะไรเลย · 401 ไม่ใช่ 200 ที่ว่างเปล่า"""
    anon = TestClient(app)
    assert anon.get(f"{API}/registry/book").status_code == 401
    assert anon.post(f"{API}/registry/file-rr4").status_code == 401


def test_the_trail_names_the_person_not_the_machine(c, db):
    """ร่องรอยต้องบอกว่า *ใคร* เป็นคนยื่น ไม่ใช่คำว่า system

    คำถามที่นายทะเบียนถามคือใครเป็นคนบันทึก ถ้าตอบได้แค่ "ระบบ"
    ก็เท่ากับตอบไม่ได้
    """
    ref = _booking(c)
    c.post(f"{API}/bookings/{ref}/guests", json=TH)
    row = c.get(f"{API}/audit").json()["rows"][0]
    assert row["action"] == "register_guest"
    assert row["actor"] == "เจ้าของ"

"""เทสทะเบียนผู้พักและการแจ้งคนต่างด้าว

สองเรื่องนี้กฎหมายบังคับ ไม่ใช่ของแถม — ทำผิดแล้วมีโทษจริง
เทสกลุ่มนี้จึงคุมสิ่งที่นายทะเบียนจะตรวจ ไม่ใช่แค่ว่าโค้ดไม่พัง

    cd server && python -m pytest -q
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from pms import clock
from pms import registry as reg
from pms.app import create_app
from pms.auth import hash_secret
from pms.db import GuestRegister, Room, RoomType, Staff
from pms.money import baht
from pms.session import session_factory

API = "/api/v1"
PIN = "606060"

#: เลขบัตรประชาชนที่หลักตรวจสอบถูกต้อง (คิดจากสูตรจริง ไม่ใช่เลขมั่ว)
GOOD_ID = "1101700207251"


@pytest.fixture()
def app(tmp_path):
    a = create_app(f"sqlite:///{tmp_path}/t.db")
    db = session_factory()()
    dx = RoomType(code="deluxe", name="ดีลักซ์", rate_satang=baht(1650), ota_satang=baht(1875))
    db.add(dx)
    db.flush()
    db.add_all([Room(no=f"10{i}", room_type_id=dx.id, floor="1") for i in (1, 2, 3)])
    for name, role, card in [("เจ้าของ", "owner", "T-OWN"), ("เคาน์เตอร์", "front", "T-FD"),
                             ("แม่บ้าน", "hk", "T-HK")]:
        db.add(Staff(name=name, title=name, role=role, card=card, pin_hash=hash_secret(PIN)))
    db.commit()
    db.close()
    return a


def as_role(app, role: str) -> TestClient:
    card = {"owner": "T-OWN", "front": "T-FD", "hk": "T-HK"}[role]
    c = TestClient(app)
    r = c.post(f"{API}/auth/login", json={"card": card, "pin": PIN})
    assert r.status_code == 200
    c.headers["authorization"] = "Bearer " + r.json()["token"]
    return c


@pytest.fixture()
def c(app):
    return as_role(app, "front")


@pytest.fixture()
def db():
    s = session_factory()()
    yield s
    s.close()


def _stay(c, room="101", name="คุณอนันต์"):
    return c.post(f"{API}/bookings", json={
        "room_no": room, "guest_name": name,
        "check_in": "2026-09-14", "check_out": "2026-09-16"}).json()["ref"]


THAI = {"full_name": "อนันต์ ศรีสุข", "nationality": "ไทย",
        "id_type": "thai_id", "id_number": GOOD_ID}
FOREIGN = {"full_name": "Kenji Tanaka", "nationality": "Japan",
           "id_type": "passport", "id_number": "TR1234567",
           "arrived_from": "Tokyo"}


# ══ 1 · เลขบัตรประชาชน ═══════════════════════════════════════════════
def test_thai_id_checksum_is_actually_verified():
    """ตรวจหลักสุดท้ายจริง ไม่ใช่แค่นับหลัก — เลขที่พิมพ์ผิดหนึ่งตัวจะผ่าน
    การนับหลักทุกครั้ง แล้วไปโผล่เป็นทะเบียนที่ตรวจแล้วไม่ตรงกับใคร"""
    assert reg.valid_thai_id(GOOD_ID)
    assert reg.valid_thai_id("1-1017-00207-25-1")          # มีขีดคั่นก็ต้องได้
    # สลับตัวเลขสองตัว — จำนวนหลักเท่าเดิม แต่หลักตรวจสอบต้องไม่ผ่าน
    swapped = GOOD_ID[:4] + GOOD_ID[5] + GOOD_ID[4] + GOOD_ID[6:]
    assert not reg.valid_thai_id(swapped)
    assert not reg.valid_thai_id("1234567890123")
    assert not reg.valid_thai_id("110170020725")           # ขาดหลัก


def test_bad_thai_id_is_refused_at_the_counter(c):
    ref = _stay(c)
    r = c.post(f"{API}/bookings/{ref}/register",
               json={**THAI, "id_number": "1234567890123"})
    assert r.status_code == 400 and "หลักตรวจสอบ" in r.json()["detail"]


# ══ 2 · ลงทะเบียน ════════════════════════════════════════════════════
def test_registering_a_thai_guest_needs_no_tm30(c):
    ref = _stay(c)
    r = c.post(f"{API}/bookings/{ref}/register", json=THAI).json()
    assert r["foreign"] is False and r["tm30_due"] is None


def test_registering_a_foreign_guest_starts_the_24h_clock(c, db):
    ref = _stay(c)
    r = c.post(f"{API}/bookings/{ref}/register", json=FOREIGN).json()
    assert r["foreign"] is True
    row = db.scalar(select(GuestRegister))
    left = (row.tm30_due - clock.now()).total_seconds() / 3600
    assert 23 < left <= 24, f"ต้องเหลือราว 24 ชั่วโมง ได้ {left}"


def test_a_thai_holding_a_passport_is_still_thai(c):
    """ตัดสินจากสัญชาติ ไม่ใช่จากชนิดเอกสาร — คนไทยที่ถือพาสปอร์ตมาเช็กอิน
    ก็ยังเป็นคนไทย ไม่ต้องแจ้ง ตม.30"""
    ref = _stay(c)
    r = c.post(f"{API}/bookings/{ref}/register", json={
        "full_name": "สมชาย ใจดี", "nationality": "ไทย",
        "id_type": "passport", "id_number": "AB123456"}).json()
    assert r["foreign"] is False


def test_registering_twice_is_refused(c):
    """หนึ่งการจองหนึ่งใบ · คีย์ไม่ซ้ำที่ฐานข้อมูลกันไว้อีกชั้น เพราะพนักงาน
    สองคนกดพร้อมกันได้จริงตอนแขกเข้าเป็นกลุ่ม"""
    ref = _stay(c)
    assert c.post(f"{API}/bookings/{ref}/register", json=THAI).status_code == 201
    again = c.post(f"{API}/bookings/{ref}/register", json=THAI)
    assert again.status_code == 400 and "ไปแล้ว" in again.json()["detail"]


def test_cancelled_booking_cannot_be_registered(c):
    ref = _stay(c)
    c.post(f"{API}/bookings/{ref}/cancel")
    r = c.post(f"{API}/bookings/{ref}/register", json=THAI)
    assert r.status_code == 400 and "ยกเลิก" in r.json()["detail"]


# ══ 3 · ตม.30 ════════════════════════════════════════════════════════
def test_pending_list_puts_the_most_urgent_first(c, db):
    """เรียงตามที่เหลือเวลาน้อยที่สุด ไม่ใช่ตามลำดับที่เข้าพัก"""
    a = _stay(c, "101", "A")
    b = _stay(c, "102", "B")
    c.post(f"{API}/bookings/{a}/register", json={**FOREIGN, "id_number": "AA1111111"})
    c.post(f"{API}/bookings/{b}/register", json={**FOREIGN, "id_number": "BB2222222"})

    # ทำให้ใบหลังใกล้ครบกำหนดกว่า
    rows = db.scalars(select(GuestRegister).order_by(GuestRegister.id)).all()
    rows[1].tm30_due = clock.now() + timedelta(hours=2)
    db.commit()

    out = c.get(f"{API}/register/tm30").json()
    assert out["pending"] == 2
    assert out["rows"][0]["ref"] == b, "ใบที่ใกล้ครบกำหนดต้องมาก่อน"
    assert out["rows"][0]["urgent"] is True


def test_overdue_is_flagged(c, db):
    ref = _stay(c)
    c.post(f"{API}/bookings/{ref}/register", json=FOREIGN)
    row = db.scalar(select(GuestRegister))
    row.tm30_due = clock.now() - timedelta(hours=1)
    db.commit()

    out = c.get(f"{API}/register/tm30").json()
    assert out["overdue"] == 1 and out["rows"][0]["overdue"] is True


def test_marking_sent_removes_it_from_the_queue(c):
    ref = _stay(c)
    c.post(f"{API}/bookings/{ref}/register", json=FOREIGN)
    assert c.get(f"{API}/register/tm30").json()["pending"] == 1

    r = c.post(f"{API}/register/{ref}/tm30", json={"receipt": "TM30-2569-0001"})
    assert r.status_code == 200
    assert "ยังต้องทำแยก" in r.json()["note"], "ต้องบอกตรง ๆ ว่ายังไม่ได้ยิงเข้าระบบราชการ"
    assert c.get(f"{API}/register/tm30").json()["pending"] == 0


def test_marking_sent_twice_is_refused(c):
    ref = _stay(c)
    c.post(f"{API}/bookings/{ref}/register", json=FOREIGN)
    c.post(f"{API}/register/{ref}/tm30", json={})
    again = c.post(f"{API}/register/{ref}/tm30", json={})
    assert again.status_code == 400 and "ไปแล้ว" in again.json()["detail"]


def test_thai_guest_cannot_be_marked_tm30(c):
    ref = _stay(c)
    c.post(f"{API}/bookings/{ref}/register", json=THAI)
    r = c.post(f"{API}/register/{ref}/tm30", json={})
    assert r.status_code == 400 and "ไม่ใช่คนต่างด้าว" in r.json()["detail"]


# ══ 4 · เล่ม ร.ร.4 ═══════════════════════════════════════════════════
def test_rr4_is_the_book_the_registrar_asks_for(c):
    """เรียงตามวันเข้าพักและเลขห้อง ซึ่งเป็นลำดับที่เล่มกระดาษใช้มาตลอด"""
    a = _stay(c, "102", "B")
    b = _stay(c, "101", "A")
    c.post(f"{API}/bookings/{a}/register", json={**THAI, "full_name": "บี"})
    c.post(f"{API}/bookings/{b}/register", json={**THAI, "full_name": "เอ",
                                                 "id_number": GOOD_ID})
    out = c.get(f"{API}/register?since=2026-09-01&until=2026-09-30").json()
    assert len(out["rows"]) == 2
    assert [r["room"] for r in out["rows"]] == ["101", "102"], "เรียงตามเลขห้อง"
    assert {"name", "nationality", "id_number", "check_in", "check_out"} <= set(out["rows"][0])


# ══ 5 · สิทธิ์ ═══════════════════════════════════════════════════════
def test_housekeeping_cannot_read_the_register(app):
    """ข้อมูลแสดงตนของแขกเป็นข้อมูลอ่อนไหว จำกัดเฉพาะคนที่ต้องใช้"""
    c = as_role(app, "hk")
    assert c.get(f"{API}/register/tm30").status_code == 403
    assert c.get(f"{API}/register?since=2026-09-01&until=2026-09-30").status_code == 403


def test_registering_leaves_an_audit_trace(c, db):
    from pms.db import AuditEvent
    ref = _stay(c)
    c.post(f"{API}/bookings/{ref}/register", json=THAI)
    rows = db.scalars(
        select(AuditEvent).where(AuditEvent.action == "register.create")).all()
    assert rows and rows[-1].ref == ref

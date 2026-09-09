"""เทสระบบยืนยันตัวตนและสิทธิ์

เหตุผลที่เทสกลุ่มนี้สำคัญกว่าที่เห็น — ยามที่พังจะไม่ส่งเสียง ระบบยังทำงาน
ได้ปกติทุกอย่าง แค่ทุกคนทำได้ทุกอย่าง กว่าจะรู้ก็ตอนเงินหาย

เทสที่มีค่าที่สุดในไฟล์นี้คือตัวที่ **ล้มกับโค้ดก่อนหน้า** — ยิงเส้นทางโดย
ไม่แนบโทเคนแล้วต้องได้ 401 ถ้าเทสนี้ผ่านบนโค้ดที่ยังไม่มียาม แปลว่าเทสนั้น
ไม่ได้ทดสอบอะไรเลย

    cd server && python -m pytest -q
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from pms.app import create_app
from pms.auth import PERMISSIONS, ROLES, can, hash_secret, verify_secret
from pms.db import AuditEvent, Room, RoomType, Staff, StaffSession
from pms.money import baht
from pms.session import session_factory

API = "/api/v1"

PEOPLE = [
    ("เจ้าของ", "owner", "T-OWN"),
    ("ผู้จัดการ", "manager", "T-MGR"),
    ("เคาน์เตอร์", "front", "T-FD"),
    ("แม่บ้าน", "hk", "T-HK"),
    ("ช่าง", "tech", "T-TC"),
    ("ร้านอาหาร", "pos", "T-PS"),
]
PIN = "424242"


@pytest.fixture()
def app(tmp_path):
    a = create_app(f"sqlite:///{tmp_path}/t.db")
    db = session_factory()()
    dx = RoomType(code="deluxe", name="ดีลักซ์", rate_satang=baht(1650), ota_satang=baht(1875))
    db.add(dx)
    db.flush()
    db.add(Room(no="101", room_type_id=dx.id, floor="1"))
    for name, role, card in PEOPLE:
        db.add(Staff(name=name, title=name, role=role, card=card, pin_hash=hash_secret(PIN)))
    db.commit()
    db.close()
    return a


@pytest.fixture()
def anon(app):
    """ไคลเอนต์ที่ยังไม่ได้ล็อกอิน"""
    return TestClient(app)


def as_role(app, role: str) -> TestClient:
    card = next(c for _n, r, c in PEOPLE if r == role)
    c = TestClient(app)
    r = c.post(f"{API}/auth/login", json={"card": card, "pin": PIN})
    assert r.status_code == 200, r.text
    c.headers["authorization"] = "Bearer " + r.json()["token"]
    return c


# ══ 1 · ไม่มีโทเคน = เข้าไม่ได้ ══════════════════════════════════════
GUARDED = [
    ("get", "/rooms"), ("get", "/availability?check_in=2026-09-14&check_out=2026-09-16"),
    ("post", "/bookings"), ("get", "/bookings/BK-1"),
    ("get", "/folios/BK-1"), ("post", "/folios/BK-1/charges"),
    ("post", "/folios/BK-1/payments"), ("post", "/folios/BK-1/close"),
    ("post", "/folios/BK-1/tax-invoice"),
    ("get", "/expenses"), ("post", "/expenses"),
    ("get", "/ledger/preview"), ("post", "/ledger/collect"),
    ("post", "/ledger/send"), ("get", "/ledger/outbox"),
]


@pytest.mark.parametrize("method,path", GUARDED)
def test_every_route_refuses_without_a_token(anon, method, path):
    """ยิงทุกเส้นทางโดยไม่แนบโทเคน — ต้องได้ 401 ทุกเส้น ไม่มีข้อยกเว้น

    เทสตัวนี้ล้มกับโค้ดก่อนหน้าที่ยังไม่มียาม ซึ่งเป็นวิธีเดียวที่จะรู้ว่า
    ยามทำงานจริง ไม่ใช่แค่เขียนไว้เฉย ๆ
    """
    # GET ของ TestClient ไม่รับ json= จึงใช้ request() ที่ส่ง body ได้ทุกเมท็อด
    r = anon.request(method.upper(), API + path, json={})
    assert r.status_code == 401, f"{method.upper()} {path} ได้ {r.status_code}"


def test_health_stays_open(anon):
    """หน้าตรวจสภาพต้องเปิดไว้ ไม่งั้นตัวเฝ้าระบบเช็กไม่ได้ว่าเซิร์ฟเวอร์ยังอยู่"""
    assert anon.get("/health").status_code == 200


def test_garbage_token_is_refused(anon):
    anon.headers["authorization"] = "Bearer sts_this-token-never-existed"
    assert anon.get(f"{API}/rooms").status_code == 401


def test_token_without_bearer_prefix_is_refused(app):
    c = as_role(app, "owner")
    tok = c.headers["authorization"].split(" ", 1)[1]
    c.headers["authorization"] = tok            # ลืมคำว่า Bearer
    assert c.get(f"{API}/rooms").status_code == 401


# ══ 2 · รหัสและโทเคน ═════════════════════════════════════════════════
def test_secrets_are_stored_only_as_hashes(app):
    """ฐานข้อมูลต้องไม่เคยเก็บรหัสจริงและไม่เคยเก็บโทเคนจริง"""
    c = as_role(app, "owner")
    token = c.headers["authorization"].split(" ", 1)[1]
    db = session_factory()()
    staff = db.scalar(select(Staff).where(Staff.role == "owner"))
    assert PIN not in staff.pin_hash
    assert staff.pin_hash.startswith("scrypt$")
    for s in db.scalars(select(StaffSession)):
        assert token not in s.token_hash
    db.close()


def test_wrong_pin_and_unknown_card_look_identical(anon):
    """ตอบเหมือนกันทั้งสองกรณี ไม่บอกใบ้ว่าบัตรใบไหนมีอยู่จริง"""
    bad_pin = anon.post(f"{API}/auth/login", json={"card": "T-OWN", "pin": "000000"})
    no_card = anon.post(f"{API}/auth/login", json={"card": "T-ไม่มี", "pin": "000000"})
    assert bad_pin.status_code == no_card.status_code == 401
    assert bad_pin.json()["detail"] == no_card.json()["detail"]


def test_hash_verify_roundtrip():
    h = hash_secret("รหัสภาษาไทยก็ได้")
    assert verify_secret("รหัสภาษาไทยก็ได้", h)
    assert not verify_secret("อย่างอื่น", h)
    # เกลือสุ่มทุกครั้ง รหัสเดียวกันจึงได้แฮชคนละค่า
    assert hash_secret("x") != hash_secret("x")


def test_logout_kills_the_token(app):
    c = as_role(app, "owner")
    assert c.get(f"{API}/rooms").status_code == 200
    c.post(f"{API}/auth/logout")
    assert c.get(f"{API}/rooms").status_code == 401


def test_expired_session_is_refused(app):
    from datetime import timedelta
    from pms import clock
    c = as_role(app, "owner")
    db = session_factory()()
    s = db.scalars(select(StaffSession)).all()[-1]
    s.expires_at = clock.now() - timedelta(minutes=1)
    db.commit()
    db.close()
    assert c.get(f"{API}/rooms").status_code == 401


def test_deactivated_staff_cannot_use_an_old_token(app):
    """ไล่ออกแล้วโทเคนที่ถืออยู่ต้องใช้ไม่ได้ทันที ไม่ต้องรอหมดอายุ"""
    c = as_role(app, "front")
    assert c.get(f"{API}/rooms").status_code == 200
    db = session_factory()()
    st = db.scalar(select(Staff).where(Staff.role == "front"))
    st.active = False
    db.commit()
    db.close()
    assert c.get(f"{API}/rooms").status_code == 401


# ══ 3 · สิทธิ์ตามบทบาท ═══════════════════════════════════════════════
def test_front_desk_cannot_reach_the_ledger(app):
    """พนักงานเคาน์เตอร์ทำงานหน้าบ้านได้ครบ แต่แตะสมุดบัญชีไม่ได้"""
    c = as_role(app, "front")
    assert c.get(f"{API}/rooms").status_code == 200
    assert c.post(f"{API}/bookings", json={
        "room_no": "101", "guest_name": "ก",
        "check_in": "2026-09-14", "check_out": "2026-09-16"}).status_code == 201
    assert c.get(f"{API}/ledger/outbox").status_code == 403
    assert c.get(f"{API}/expenses").status_code == 403


def test_restaurant_staff_cannot_book_or_invoice(app):
    """พนักงานร้านอาหารลงได้แค่รายการอาหาร ไม่ใช่ทั้งระบบ"""
    c = as_role(app, "pos")
    assert c.post(f"{API}/bookings", json={
        "room_no": "101", "guest_name": "ก",
        "check_in": "2026-09-14", "check_out": "2026-09-16"}).status_code == 403
    assert c.post(f"{API}/folios/BK-1/tax-invoice", json={"buyer_name": "ก"}).status_code == 403


@pytest.mark.parametrize("role", ["hk", "tech"])
def test_housekeeping_and_maintenance_touch_no_money(app, role):
    """แม่บ้านกับช่างไม่มีสิทธิ์ทางการเงินเลยสักข้อ"""
    c = as_role(app, role)
    assert c.get(f"{API}/folios/BK-1").status_code == 403
    assert c.get(f"{API}/expenses").status_code == 403
    assert c.post(f"{API}/ledger/send").status_code == 403


def test_the_audited_cannot_approve_themselves():
    """คนที่ถูกตรวจสอบอนุมัติให้ตัวเองไม่ได้ — ถ้าได้ การตรวจสอบก็ไร้ความหมาย"""
    assert not can("front", "approve")
    assert not can("pos", "approve")
    assert can("owner", "approve") and can("manager", "approve")


def test_role_matrix_only_uses_known_permissions():
    """กันสิทธิ์ที่พิมพ์ผิดแล้วกลายเป็นสิทธิ์ที่ไม่มีใครมี ซึ่งเงียบมาก"""
    for role, perms in ROLES.items():
        unknown = perms - set(PERMISSIONS)
        assert not unknown, f"{role} อ้างสิทธิ์ที่ไม่มีอยู่: {unknown}"


def test_login_reports_the_permissions_the_screen_should_show(app):
    """หน้าจอต้องรู้ว่าจะซ่อนปุ่มไหน ไม่ใช่ให้กดแล้วค่อยโดนปฏิเสธ"""
    c = TestClient(app)
    r = c.post(f"{API}/auth/login", json={"card": "T-FD", "pin": PIN}).json()
    assert r["role"] == "front"
    assert set(r["permissions"]) == set(ROLES["front"])
    assert "ledger" not in r["permissions"]


# ══ 4 · ร่องรอยการตรวจสอบ ════════════════════════════════════════════
def test_login_leaves_a_trace(app):
    as_role(app, "manager")
    db = session_factory()()
    rows = db.scalars(select(AuditEvent).where(AuditEvent.action == "auth.login")).all()
    assert rows and rows[-1].staff_name == "ผู้จัดการ"
    db.close()


def test_audit_keeps_the_name_even_after_the_person_is_renamed(app):
    """ร่องรอยเก่าต้องยังอ่านออกว่าตอนนั้นใครกด แม้คนนั้นจะเปลี่ยนชื่อทีหลัง"""
    as_role(app, "owner")
    db = session_factory()()
    st = db.scalar(select(Staff).where(Staff.role == "owner"))
    st.name = "เปลี่ยนชื่อแล้ว"
    db.commit()
    row = db.scalars(select(AuditEvent).where(AuditEvent.action == "auth.login")).all()[-1]
    assert row.staff_name == "เจ้าของ"
    db.close()

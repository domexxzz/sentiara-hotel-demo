"""ค่ากิจการในโหมด live ต้องอยู่ในฐานข้อมูลและมีผลกับงานจริง."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from pms.app import create_app
from pms.auth import hash_secret
from pms.db import Room, RoomType, Staff
from pms.money import baht
from pms.session import session_factory

API = "/api/v1"
PIN = "424242"


@pytest.fixture()
def app(tmp_path):
    app = create_app(f"sqlite:///{tmp_path}/settings.db")
    db = session_factory()()
    kind = RoomType(code="deluxe", name="ดีลักซ์",
                    rate_satang=baht(1650), ota_satang=baht(1875))
    db.add(kind)
    db.flush()
    db.add(Room(no="101", room_type_id=kind.id, floor="1"))
    db.add_all([
        Staff(name="เจ้าของ", title="เจ้าของ", role="owner",
              card="T-OWN", pin_hash=hash_secret(PIN)),
        Staff(name="เคาน์เตอร์", title="เคาน์เตอร์", role="front",
              card="T-FRONT", pin_hash=hash_secret(PIN)),
    ])
    db.commit()
    db.close()
    return app


def logged_in(app, card: str) -> TestClient:
    client = TestClient(app)
    response = client.post(f"{API}/auth/login", json={"card": card, "pin": PIN})
    client.headers["authorization"] = "Bearer " + response.json()["token"]
    return client


def changed_settings() -> dict:
    return {
        "hotelName": "โรงแรมทดสอบกลาง",
        "city": "ลำพูน",
        "phone": "053-111-222",
        "vatPct": 7,
        "weekendPct": 25,
        "depositPct": 40,
        "maPct": 12,
        "checkInTime": "15:00",
        "checkOutTime": "11:00",
        "types": [{"code": "deluxe", "name": "ดีลักซ์ใหม่", "rate": 2000, "ota": 2300}],
    }


def test_settings_require_login_and_permission(app):
    anon = TestClient(app)
    assert anon.get(f"{API}/settings").status_code == 401
    assert anon.post(f"{API}/settings", json=changed_settings()).status_code == 401

    front = logged_in(app, "T-FRONT")
    assert front.get(f"{API}/settings").status_code == 403
    assert front.post(f"{API}/settings", json=changed_settings()).status_code == 403


def test_settings_persist_across_sessions_and_drive_booking_price(app):
    owner = logged_in(app, "T-OWN")
    saved = owner.post(f"{API}/settings", json=changed_settings())
    assert saved.status_code == 200, saved.text
    assert saved.json()["hotelName"] == "โรงแรมทดสอบกลาง"
    assert saved.json()["types"][0]["code"] == "deluxe"

    another = logged_in(app, "T-OWN")
    assert another.get(f"{API}/settings").json() == saved.json()
    assert another.get("/health").json()["hotel"] == "โรงแรมทดสอบกลาง"

    booking = another.post(f"{API}/bookings", json={
        "room_no": "101", "guest_name": "ผู้เข้าพัก",
        "check_in": "2026-09-14", "check_out": "2026-09-16",
    })
    assert booking.status_code == 201, booking.text
    # สองคืน คืนละ 2,000 บาท และมัดจำตามค่ากลางใหม่ 40%
    assert booking.json()["folio"]["gross"] == 4000
    assert booking.json()["deposit"] == 1600


def test_settings_reject_invalid_or_destructive_room_type_changes(app):
    owner = logged_in(app, "T-OWN")
    bad = changed_settings()
    bad["types"][0]["ota"] = 1000
    assert owner.post(f"{API}/settings", json=bad).status_code == 400

    removing_used_type = changed_settings()
    removing_used_type["types"] = [
        {"name": "สวีท", "rate": 3000, "ota": 3400},
    ]
    assert owner.post(f"{API}/settings", json=removing_used_type).status_code == 409

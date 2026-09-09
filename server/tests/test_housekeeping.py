"""เทสงานแม่บ้านและสถานะห้อง

สิ่งที่เทสกลุ่มนี้ปกป้อง — **ห้องกลับไปขายได้ตอนหัวหน้าอนุมัติเท่านั้น**
ถ้าแม่บ้านกดเสร็จแล้วห้องขายได้เลย มาตรฐานก็หายไปทันที และแขกที่เข้าห้องที่
ยังไม่เรียบร้อยคือรีวิวหนึ่งดาวที่ลบไม่ได้

    cd server && python -m pytest -q
"""
from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from pms import housekeeping as hk
from pms.app import create_app
from pms.auth import hash_secret
from pms.db import HousekeepingTask, Room, RoomType, Staff
from pms.money import baht
from pms.session import session_factory

API = "/api/v1"
PIN = "313131"

MON = date(2026, 9, 14)
WED = date(2026, 9, 16)


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
        Room(no="103", room_type_id=dx.id, floor="1"),
    ])
    for name, role, card in [("เจ้าของ", "owner", "T-OWN"), ("แม่บ้าน", "hk", "T-HK"),
                             ("ช่าง", "tech", "T-TC"), ("เคาน์เตอร์", "front", "T-FD")]:
        db.add(Staff(name=name, title=name, role=role, card=card, pin_hash=hash_secret(PIN)))
    db.commit()
    db.close()
    return a


def as_role(app, role: str) -> TestClient:
    card = {"owner": "T-OWN", "hk": "T-HK", "tech": "T-TC", "front": "T-FD"}[role]
    c = TestClient(app)
    r = c.post(f"{API}/auth/login", json={"card": card, "pin": PIN})
    assert r.status_code == 200, r.text
    c.headers["authorization"] = "Bearer " + r.json()["token"]
    return c


@pytest.fixture()
def db():
    s = session_factory()()
    yield s
    s.close()


def _stay(c, room="101"):
    return c.post(f"{API}/bookings", json={
        "room_no": room, "guest_name": "คุณอนันต์",
        "check_in": "2026-09-14", "check_out": "2026-09-16"}).json()["ref"]


def _room(db, no="101") -> Room:
    return db.scalar(select(Room).where(Room.no == no))


# ══ 1 · งานเกิดเองตอนเช็กเอาต์ ═══════════════════════════════════════
def test_checkout_opens_a_cleaning_task_by_itself(app, db):
    """ห้องที่แขกออกแล้วแต่ไม่มีใครรู้ว่าต้องทำ คือห้องที่ขายไม่ได้ทั้งที่ว่าง —
    รายได้หายโดยไม่มีตัวเลขไหนติดลบ"""
    c = as_role(app, "owner")
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/payments", json={"method": "cash", "amount": 3300})
    c.post(f"{API}/folios/{ref}/close")

    t = db.scalar(select(HousekeepingTask))
    assert t is not None and t.status == "open"
    db.expire_all()
    assert _room(db).housekeeping == "dirty"


def test_a_dirty_room_is_not_sellable(app, db):
    c = as_role(app, "owner")
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/close")
    db.expire_all()
    assert not hk.sellable(_room(db))
    rooms = {r["no"]: r for r in c.get(f"{API}/rooms").json()["rooms"]}
    assert rooms["101"]["sellable"] is False
    assert rooms["101"]["housekeeping"] == "dirty"


def test_opening_twice_returns_the_same_task(app, db):
    """เปิดซ้อนได้เมื่อไร แม่บ้านจะเห็นห้องเดียวกันสองบรรทัดแล้วไม่รู้ว่าทำอันไหน"""
    c = as_role(app, "owner")
    a = c.post(f"{API}/housekeeping", json={"room_no": "102"}).json()
    b = c.post(f"{API}/housekeeping", json={"room_no": "102"}).json()
    assert a["ref"] == b["ref"]
    assert len(db.scalars(select(HousekeepingTask)).all()) == 1


# ══ 2 · เส้นทางของงาน ════════════════════════════════════════════════
def test_the_room_comes_back_only_after_a_supervisor_approves(app, db):
    """หัวใจของไฟล์นี้ — แม่บ้านกดเสร็จแล้วห้องยัง**ขายไม่ได้**
    ต้องรอหัวหน้าตรวจก่อน"""
    owner = as_role(app, "owner")
    ref = owner.post(f"{API}/housekeeping", json={"room_no": "103"}).json()["ref"]

    maid = as_role(app, "hk")
    maid.post(f"{API}/housekeeping/{ref}", json={"to": "doing"})
    db.expire_all()
    assert _room(db, "103").housekeeping == "cleaning"
    assert not hk.sellable(_room(db, "103"))

    maid.post(f"{API}/housekeeping/{ref}", json={"to": "inspect", "photos": 3})
    db.expire_all()
    assert _room(db, "103").housekeeping == "inspect"
    assert not hk.sellable(_room(db, "103")), "ส่งตรวจแล้วยังขายไม่ได้"

    r = maid.post(f"{API}/housekeeping/{ref}", json={"to": "done"})
    assert r.status_code == 200 and r.json()["sellable"] is True
    db.expire_all()
    assert _room(db, "103").housekeeping == "clean"


def test_sending_to_inspection_needs_three_photos(app):
    """สามมุมมาตรฐาน มุมรวม เตียง ห้องน้ำ — น้อยกว่านี้หัวหน้าตรวจไม่ได้จริง"""
    owner = as_role(app, "owner")
    ref = owner.post(f"{API}/housekeeping", json={"room_no": "103"}).json()["ref"]
    maid = as_role(app, "hk")
    maid.post(f"{API}/housekeeping/{ref}", json={"to": "doing"})
    bad = maid.post(f"{API}/housekeeping/{ref}", json={"to": "inspect", "photos": 2})
    assert bad.status_code == 400 and "3 มุม" in bad.json()["detail"]


def test_rejecting_without_a_reason_is_refused(app):
    """ตีกลับโดยไม่บอกเหตุผล แม่บ้านจะส่งกลับมาแบบเดิมอีกรอบ"""
    owner = as_role(app, "owner")
    ref = owner.post(f"{API}/housekeeping", json={"room_no": "103"}).json()["ref"]
    maid = as_role(app, "hk")
    maid.post(f"{API}/housekeeping/{ref}", json={"to": "doing"})
    maid.post(f"{API}/housekeeping/{ref}", json={"to": "inspect", "photos": 3})

    blank = owner.post(f"{API}/housekeeping/{ref}", json={"to": "doing"})
    assert blank.status_code == 400 and "เหตุผล" in blank.json()["detail"]

    ok = owner.post(f"{API}/housekeeping/{ref}",
                    json={"to": "doing", "reason": "ใต้เตียงยังมีฝุ่น"})
    assert ok.status_code == 200


def test_rejection_clears_the_photos_so_they_must_be_retaken(app, db):
    """ตีกลับแล้วต้องถ่ายใหม่ ไม่ใช่ส่งรูปเดิมกลับมา"""
    owner = as_role(app, "owner")
    ref = owner.post(f"{API}/housekeeping", json={"room_no": "103"}).json()["ref"]
    maid = as_role(app, "hk")
    maid.post(f"{API}/housekeeping/{ref}", json={"to": "doing"})
    maid.post(f"{API}/housekeeping/{ref}", json={"to": "inspect", "photos": 3})
    owner.post(f"{API}/housekeeping/{ref}", json={"to": "doing", "reason": "ผ้าไม่เรียบ"})

    t = db.scalar(select(HousekeepingTask).where(HousekeepingTask.ref == ref))
    db.refresh(t)
    assert t.photos == 0
    again = maid.post(f"{API}/housekeeping/{ref}", json={"to": "inspect"})
    assert again.status_code == 400


def test_cannot_skip_steps(app):
    """เดินนอกเส้นทางไม่ได้ · เปิดงานแล้วกดเสร็จเลยไม่ได้"""
    owner = as_role(app, "owner")
    ref = owner.post(f"{API}/housekeeping", json={"room_no": "103"}).json()["ref"]
    r = owner.post(f"{API}/housekeeping/{ref}", json={"to": "done"})
    assert r.status_code == 400 and "สถานะ open" in r.json()["detail"]


# ══ 3 · สิทธิ์ ═══════════════════════════════════════════════════════
def test_a_maid_cannot_approve_their_own_work(app):
    """ช่างมีสิทธิ์ทำงาน แต่ไม่ใช่คนตัดสินว่าห้องสะอาดพอขายหรือยัง"""
    owner = as_role(app, "owner")
    ref = owner.post(f"{API}/housekeeping", json={"room_no": "103"}).json()["ref"]
    tech = as_role(app, "tech")
    tech.post(f"{API}/housekeeping/{ref}", json={"to": "doing"})
    tech.post(f"{API}/housekeeping/{ref}", json={"to": "inspect", "photos": 3})

    denied = tech.post(f"{API}/housekeeping/{ref}", json={"to": "done"})
    assert denied.status_code == 403 and "inspect" in denied.json()["detail"]


def test_front_desk_has_no_housekeeping_access(app):
    c = as_role(app, "front")
    assert c.get(f"{API}/housekeeping").status_code == 403


def test_housekeeping_staff_touch_no_money(app):
    """แม่บ้านเห็นคิวงานได้ แต่ยังแตะเงินไม่ได้เหมือนเดิม"""
    c = as_role(app, "hk")
    assert c.get(f"{API}/housekeeping").status_code == 200
    assert c.get(f"{API}/expenses").status_code == 403


# ══ 4 · ลำดับความเร่งด่วน ════════════════════════════════════════════
def test_rooms_with_a_guest_arriving_today_come_first(app, db):
    """เรียงตามลำดับที่ควรทำจริง — ห้องที่แขกยืนรออยู่ที่ล็อบบี้กับห้องที่ยัง
    ไม่มีใครจอง ไม่ควรมีค่าเท่ากัน"""
    from pms import booking as bkg
    from pms import clock
    owner = as_role(app, "owner")

    # ห้อง 102 มีคนจองเข้าวันนี้ · ห้อง 103 ไม่มีใครจอง
    today = clock.today()
    bkg.create_booking(db, "102", "แขกรออยู่", today, today.replace(day=today.day + 1))
    db.commit()

    owner.post(f"{API}/housekeeping", json={"room_no": "103"})
    owner.post(f"{API}/housekeeping", json={"room_no": "102"})

    order = [t["room"] for t in owner.get(f"{API}/housekeeping").json()["tasks"]]
    assert order[0] == "102", f"ห้องที่มีแขกรอต้องมาก่อน ได้ {order}"


def test_the_board_shows_why_a_task_was_rejected(app):
    """หัวหน้าตีกลับแล้วเหตุผลต้องอยู่บนคิว ไม่ใช่หายไปในบันทึก"""
    owner = as_role(app, "owner")
    ref = owner.post(f"{API}/housekeeping", json={"room_no": "103"}).json()["ref"]
    maid = as_role(app, "hk")
    maid.post(f"{API}/housekeeping/{ref}", json={"to": "doing"})
    maid.post(f"{API}/housekeeping/{ref}", json={"to": "inspect", "photos": 3})
    owner.post(f"{API}/housekeeping/{ref}", json={"to": "doing", "reason": "กระจกมีคราบ"})

    task = next(t for t in maid.get(f"{API}/housekeeping").json()["tasks"] if t["ref"] == ref)
    assert task["reject_reason"] == "กระจกมีคราบ"
    assert task["status"] == "doing"

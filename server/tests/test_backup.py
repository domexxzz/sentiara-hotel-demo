"""เทสการสำรองและกู้คืน

สิ่งที่เทสกลุ่มนี้ปกป้อง — **สำรองที่กู้ไม่ได้ ไม่ใช่การสำรอง**
ตัวที่สำคัญที่สุดคือตัวที่สำรองขณะยังมีรายการค้างใน WAL แล้วพิสูจน์ว่า
สำเนามีรายการนั้นครบ · ก๊อปไฟล์ .db เฉย ๆ จะสอบตกข้อนี้

    cd server && python -m pytest -q
"""
from __future__ import annotations

import sqlite3

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from pms.app import create_app
from pms.auth import hash_secret
from pms.backup import BackupError, backup, counts, prune, restore, verify
from pms.db import Booking, Room, RoomType, Staff
from pms.money import baht
from pms.session import session_factory

API = "/api/v1"
PIN = "828282"


@pytest.fixture()
def env(tmp_path):
    """ฐานข้อมูลจริงบนดิสก์ · ในหน่วยความจำสำรองไม่ได้ตามที่ตั้งใจ"""
    url = f"sqlite:///{tmp_path}/pms.db"
    app = create_app(url)
    db = session_factory()()
    dx = RoomType(code="deluxe", name="ดีลักซ์", rate_satang=baht(1650), ota_satang=baht(1875))
    db.add(dx)
    db.flush()
    db.add_all([Room(no=f"10{i}", room_type_id=dx.id, floor="1") for i in (1, 2, 3)])
    db.add(Staff(name="เจ้าของ", title="เจ้าของ", role="owner",
                 card="T-OWN", pin_hash=hash_secret(PIN)))
    db.commit()
    db.close()

    c = TestClient(app)
    r = c.post(f"{API}/auth/login", json={"card": "T-OWN", "pin": PIN})
    c.headers["authorization"] = "Bearer " + r.json()["token"]
    return {"url": url, "app": app, "c": c, "dir": tmp_path}


def _book(c, room="101", name="คุณอนันต์"):
    return c.post(f"{API}/bookings", json={
        "room_no": room, "guest_name": name,
        "check_in": "2026-09-14", "check_out": "2026-09-16"}).json()["ref"]


# ══ 1 · สำรองได้ขณะระบบยังทำงาน ══════════════════════════════════════
def test_backup_captures_rows_still_sitting_in_the_wal(env):
    """หัวใจของไฟล์นี้ — ฐานเปิดโหมด WAL รายการล่าสุดอยู่ในไฟล์ -wal
    ยังไม่ลงไฟล์หลัก · ก๊อป .db เฉย ๆ จะได้สำเนาที่ขาดรายการนั้น
    """
    c = env["c"]
    ref = _book(c, "101", "คุณต้องอยู่ในสำเนา")

    res = backup(env["url"], out_dir=env["dir"] / "backups")

    con = sqlite3.connect(f"file:{res.path}?mode=ro", uri=True)
    try:
        got = con.execute("SELECT guest_name FROM booking WHERE ref=?", (ref,)).fetchone()
    finally:
        con.close()
    assert got is not None and got[0] == "คุณต้องอยู่ในสำเนา"


def test_backup_verifies_itself(env):
    """ตรวจสำเนาทุกครั้งหลังสำรอง ไม่ใช่ทางเลือก"""
    res = backup(env["url"], out_dir=env["dir"] / "backups")
    assert res.bytes > 0
    assert res.counts["room"] == 3 and res.counts["staff"] == 1


def test_server_keeps_working_during_and_after_backup(env):
    """ไม่ต้องปิดเซิร์ฟเวอร์ — โรงแรมเปิด 24 ชั่วโมง หยุดระบบเพื่อสำรองไม่ได้"""
    c = env["c"]
    _book(c, "101")
    backup(env["url"], out_dir=env["dir"] / "backups")
    assert c.get(f"{API}/rooms").status_code == 200
    assert _book(c, "102")


# ══ 2 · ตัวตรวจต้องจับของเสียได้ ════════════════════════════════════
def test_verify_rejects_a_corrupt_file(env):
    bad = env["dir"] / "เสีย.db"
    # bytes literal รับได้แค่ ASCII · ขยะอะไรก็ได้ ขอแค่ไม่ใช่ไฟล์ SQLite
    bad.write_bytes(b"not a sqlite database at all" * 40)
    with pytest.raises(BackupError):
        verify(bad)


def test_verify_rejects_an_empty_file(env):
    empty = env["dir"] / "ว่าง.db"
    empty.write_bytes(b"")
    with pytest.raises(BackupError, match="ว่างเปล่า"):
        verify(empty)


def test_verify_rejects_a_database_with_no_rooms(env, tmp_path):
    """สำเนาที่มีโครงตารางครบแต่ไม่มีข้อมูลเลย น่าจะสำรองผิดไฟล์"""
    blank = f"sqlite:///{tmp_path}/blank.db"
    create_app(blank)
    with pytest.raises(BackupError, match="ไม่มีข้อมูล"):
        verify(tmp_path / "blank.db")


def test_memory_database_cannot_be_backed_up():
    with pytest.raises(BackupError, match="หน่วยความจำ"):
        backup("sqlite:///:memory:")


def test_postgres_url_is_refused_with_a_useful_message():
    """ย้ายฐานแล้วต้องได้คำแนะนำ ไม่ใช่ error ที่อ่านไม่รู้เรื่อง"""
    with pytest.raises(BackupError, match="pg_dump"):
        backup("postgresql://localhost/pms")


# ══ 3 · กู้คืน ═══════════════════════════════════════════════════════
def test_restore_brings_everything_back_after_the_file_is_lost(env):
    """ภัยพิบัติจริงคือไฟล์หายทั้งไฟล์ ไม่ใช่ข้อมูลหายทีละแถว —
    ดิสก์เสีย โดนลบ หรือเครื่องถูกขโมย · เทสจึงจำลองแบบนั้น"""
    from pms.session import dispose
    c = env["c"]
    ref = _book(c, "101", "ต้องกลับมาครบ")
    res = backup(env["url"], out_dir=env["dir"] / "backups")

    # ไฟล์หายทั้งไฟล์ พร้อม WAL
    dispose()
    for suffix in ("", "-wal", "-shm"):
        f = env["dir"] / f"pms.db{suffix}"
        if f.exists():
            f.unlink()
    assert not (env["dir"] / "pms.db").exists()

    restore(res.path, env["url"])
    back = counts(env["dir"] / "pms.db")
    assert back["booking"] == 1 and back["room"] == 3 and back["staff"] == 1

    # และของที่กู้มาต้องเป็นข้อมูลจริง ไม่ใช่แค่โครงตาราง
    import sqlite3 as _s
    con = _s.connect(f"file:{env['dir'] / 'pms.db'}?mode=ro", uri=True)
    try:
        got = con.execute("SELECT guest_name FROM booking WHERE ref=?", (ref,)).fetchone()
    finally:
        con.close()
    assert got[0] == "ต้องกลับมาครบ"


def test_restore_keeps_the_current_database_first(env):
    """กู้คืนผิดไฟล์เป็นความผิดพลาดที่เกิดจริงตอนคนกำลังตกใจ —
    เขียนทับของเดิมไปแล้วก็จบ ไม่มีอะไรให้ย้อน"""
    c = env["c"]
    _book(c, "101")
    res = backup(env["url"], out_dir=env["dir"] / "backups")
    restore(res.path, env["url"])
    kept = list(env["dir"].glob("pms.before-restore-*.db"))
    assert kept, "ต้องเก็บของเดิมไว้ก่อนเขียนทับ"


def test_restore_removes_stale_wal_files(env):
    """ไม่ลบ WAL เก่า SQLite จะเอารายการค้างในนั้นมาทับสำเนาที่เพิ่งกู้
    แล้วได้ฐานที่ปนกันสองชุดโดยไม่มีใครรู้"""
    c = env["c"]
    _book(c, "101")
    res = backup(env["url"], out_dir=env["dir"] / "backups")
    _book(c, "102")                       # ทำให้มี WAL ค้างอยู่แน่ ๆ

    restore(res.path, env["url"])
    assert counts(env["dir"] / "pms.db")["booking"] == 1, "รายการหลังสำรองต้องไม่ปนกลับมา"


def test_restore_checks_the_archive_before_touching_anything(env):
    """ตรวจก่อนแตะของเดิม ไม่ใช่หลัง — ไฟล์เสียต้องไม่ทำให้ของดีหายไปด้วย"""
    c = env["c"]
    _book(c, "101")
    bad = env["dir"] / "เสีย.db"
    bad.write_bytes(b"not a sqlite database at all" * 40)

    with pytest.raises(BackupError):
        restore(bad, env["url"])
    assert counts(env["dir"] / "pms.db")["booking"] == 1, "ของเดิมต้องยังอยู่ครบ"


# ══ 4 · เก็บกวาด ═════════════════════════════════════════════════════
def test_prune_keeps_the_newest(env):
    out = env["dir"] / "backups"
    out.mkdir(parents=True, exist_ok=True)
    for i in range(6):
        (out / f"pms-2026090{i}-000000.db").write_bytes(b"x")
    gone = prune(out, keep=2)
    left = sorted(p.name for p in out.glob("pms-*.db"))
    assert len(gone) == 4 and len(left) == 2
    assert left == ["pms-20260904-000000.db", "pms-20260905-000000.db"]

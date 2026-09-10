"""เทส Wi-Fi ที่พัก

สิ่งที่เทสกลุ่มนี้ปกป้อง — **ทุก session ต้องโยงกลับไปหาคนได้**
นั่นคือทั้งหมดที่ ม.26 พ.ร.บ.คอมพิวเตอร์ ต้องการจากฝั่งเรา และเป็นสิ่งที่
รหัส Wi-Fi รวมของโรงแรมให้ไม่ได้เลย

ตัวที่สำคัญที่สุดสองตัว — ช่องของอุปกรณ์ต้องปฏิเสธเมื่อไม่ตั้งความลับร่วม
(ไม่ใช่ปล่อยผ่าน) และรายงานต้องตอบได้ว่า IP นั้นคือใครพร้อมเลขเอกสารแสดงตน

    cd server && python -m pytest -q
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from pms import clock
from pms import wifi as wf
from pms.app import create_app
from pms.auth import hash_secret
from pms.db import Room, RoomType, Staff, WifiCredential, WifiSession
from pms.money import baht
from pms.session import session_factory

API = "/api/v1"
PIN = "939393"
# ค่าความลับส่งไปทาง HTTP header ซึ่งเข้ารหัสได้แค่ ASCII
# ของจริงก็ควรเป็น ASCII เหมือนกัน ไม่ใช่ข้อความภาษาไทย
GW = "gw-secret-2569-xY7q"
GOOD_ID = "1101700207251"


@pytest.fixture(autouse=True)
def gateway_secret(monkeypatch):
    monkeypatch.setenv("PMS_WIFI_SECRET", GW)


@pytest.fixture()
def app(tmp_path):
    a = create_app(f"sqlite:///{tmp_path}/t.db")
    db = session_factory()()
    dx = RoomType(code="deluxe", name="ดีลักซ์", rate_satang=baht(1650), ota_satang=baht(1875))
    db.add(dx)
    db.flush()
    db.add_all([Room(no=f"20{i}", room_type_id=dx.id, floor="2") for i in (1, 2, 3)])
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


def _checked_in(c, room="201", name="คุณอนันต์"):
    """เข้าพักจริงและได้รหัส Wi-Fi มาแล้ว · คืน (ref, room, secret)"""
    today = clock.today()
    ref = c.post(f"{API}/bookings", json={
        "room_no": room, "guest_name": name,
        "check_in": today.isoformat(),
        "check_out": (today + timedelta(days=2)).isoformat()}).json()["ref"]
    out = c.post(f"{API}/bookings/{ref}/check-in").json()
    return ref, room, out["wifi"]["secret"]


def _gw(app) -> TestClient:
    """ไคลเอนต์แทนอุปกรณ์เครือข่าย · ไม่มีบัญชีพนักงาน มีแต่ความลับร่วม"""
    g = TestClient(app)
    g.headers["x-wifi-secret"] = GW
    return g


# ══ 1 · ช่องของอุปกรณ์ต้องปิดเป็นค่าเริ่มต้น ═════════════════════════
def test_gateway_refuses_when_the_secret_is_not_configured(app, monkeypatch):
    """ระบบที่ลืมตั้งค่าแล้วเปิดกว้าง คือระบบที่ไม่มีใครรู้ว่าเปิดกว้างอยู่ —
    ไม่ตั้งค่าต้องปฏิเสธ ไม่ใช่ปล่อยผ่าน"""
    monkeypatch.delenv("PMS_WIFI_SECRET", raising=False)
    g = TestClient(app)
    r = g.post(f"{API}/wifi/authorize",
               json={"username": "201", "secret": "x", "mac": "aa:bb:cc:dd:ee:ff"})
    assert r.status_code == 401 and "ปฏิเสธทุกคำขอ" in r.json()["detail"]


def test_gateway_refuses_a_wrong_secret(app):
    g = TestClient(app)
    g.headers["x-wifi-secret"] = "wrong-guess"
    r = g.post(f"{API}/wifi/authorize",
               json={"username": "201", "secret": "x", "mac": "aabbccddeeff"})
    assert r.status_code == 401


def test_staff_routes_still_need_a_staff_token(app):
    """ความลับของอุปกรณ์ไม่ใช่กุญแจผีที่เปิดได้ทุกเส้นทาง"""
    g = _gw(app)
    assert g.get(f"{API}/wifi/online").status_code == 401
    assert g.get(f"{API}/wifi/report?since=2026-09-01&until=2026-09-30").status_code == 401


def test_housekeeping_cannot_see_who_is_online(app):
    """ใครต่อเน็ตอยู่เป็นข้อมูลของแขก แม่บ้านไม่ต้องรู้"""
    hk = as_role(app, "hk")
    assert hk.get(f"{API}/wifi/online").status_code == 403


# ══ 2 · ออกรหัสตอนเช็กอินเอง ═════════════════════════════════════════
def test_check_in_issues_a_credential_by_itself(c):
    """แขกถามหา Wi-Fi เป็นคำถามแรกหลังได้กุญแจห้อง · รหัสที่ต้องรอพนักงาน
    ไปกดคือรหัสที่มักถูกแทนด้วยรหัสรวมของโรงแรม"""
    _ref, room, secret = _checked_in(c)
    assert len(secret) == 6
    # ตัวอักษรที่หน้าตาเหมือนกันถูกตัดออก เพราะแขกอ่านจากใบแล้วพิมพ์ผิด
    assert not set(secret) & set("0O1lI5S")


def test_the_secret_is_stored_only_as_a_hash(c, db):
    """แขกทำใบหาย เคาน์เตอร์ออกใหม่ ไม่ใช่อ่านของเดิมให้ฟัง"""
    _ref, _room, secret = _checked_in(c)
    cred = db.scalar(select(WifiCredential))
    assert secret not in cred.secret_hash
    assert cred.secret_hash.startswith("scrypt$")


def test_reissuing_kills_the_old_secret_and_open_sessions(app, c, db):
    ref, room, old = _checked_in(c)
    g = _gw(app)
    g.post(f"{API}/wifi/accounting", json={
        "action": "start", "username": room, "session_id": "s1", "mac": "aabbccddeeff"})

    new = c.post(f"{API}/bookings/{ref}/wifi").json()["secret"]
    assert new != old

    # รหัสเดิมใช้ไม่ได้แล้ว
    denied = g.post(f"{API}/wifi/authorize",
                    json={"username": room, "secret": old, "mac": "aabbccddeeff"})
    assert denied.status_code == 403
    # และ session ที่เปิดด้วยรหัสเดิมถูกปิด ไม่ค้างต่อไป
    row = db.scalar(select(WifiSession).where(WifiSession.acct_session_id == "s1"))
    db.refresh(row)
    assert row.ended_at is not None


# ══ 3 · อนุญาตให้ต่อ ═════════════════════════════════════════════════
def test_a_valid_guest_gets_online(app, c):
    _ref, room, secret = _checked_in(c, "201", "คุณมาลี")
    g = _gw(app)
    r = g.post(f"{API}/wifi/authorize",
               json={"username": room, "secret": secret, "mac": "AA:BB:CC:DD:EE:FF"})
    assert r.status_code == 200
    body = r.json()
    assert body["room"] == room and body["guest"] == "คุณมาลี"
    assert body["session_timeout"] > 0


def test_wrong_room_and_wrong_secret_look_identical(app, c):
    """ใครยืนที่ล็อบบี้แล้วลองสุ่มเลขห้อง ต้องไม่ได้ข้อมูลอะไรกลับไป"""
    _ref, room, _secret = _checked_in(c)
    g = _gw(app)
    bad_secret = g.post(f"{API}/wifi/authorize",
                        json={"username": room, "secret": "zzzzzz", "mac": "aabbccddeeff"})
    no_room = g.post(f"{API}/wifi/authorize",
                     json={"username": "999", "secret": "zzzzzz", "mac": "aabbccddeeff"})
    assert bad_secret.status_code == no_room.status_code == 403
    assert bad_secret.json()["detail"] == no_room.json()["detail"]


def test_revoked_credential_cannot_connect(app, c):
    ref, room, secret = _checked_in(c)
    c.post(f"{API}/bookings/{ref}/wifi/revoke")
    g = _gw(app)
    r = g.post(f"{API}/wifi/authorize",
               json={"username": room, "secret": secret, "mac": "aabbccddeeff"})
    assert r.status_code == 403


def test_expired_credential_cannot_connect(app, c, db):
    _ref, room, secret = _checked_in(c)
    cred = db.scalar(select(WifiCredential))
    cred.valid_until = clock.now() - timedelta(minutes=1)
    db.commit()
    g = _gw(app)
    r = g.post(f"{API}/wifi/authorize",
               json={"username": room, "secret": secret, "mac": "aabbccddeeff"})
    assert r.status_code == 403


def test_mac_format_differences_do_not_count_as_new_devices(app, c):
    """Mikrotik ส่ง AA:BB:… · UniFi ส่ง aabb… · ไม่ทำให้เหมือนกันก่อนเทียบ
    เครื่องเดิมจะถูกนับใหม่ทุกครั้งแล้วชนเพดานจำนวนเครื่อง"""
    _ref, room, secret = _checked_in(c)
    g = _gw(app)
    for fmt in ("AA:BB:CC:DD:EE:FF", "aa-bb-cc-dd-ee-ff", "aabbccddeeff"):
        g.post(f"{API}/wifi/accounting", json={
            "action": "start", "username": room,
            "session_id": f"s-{fmt}", "mac": fmt})
    r = g.post(f"{API}/wifi/authorize",
               json={"username": room, "secret": secret, "mac": "AA:BB:CC:DD:EE:FF"})
    assert r.status_code == 200
    assert r.json()["devices_online"] == 1, "สามรูปแบบต้องนับเป็นเครื่องเดียว"


def test_device_limit_is_enforced_and_explains_itself(app, c):
    _ref, room, secret = _checked_in(c)
    g = _gw(app)
    for i in range(3):
        g.post(f"{API}/wifi/accounting", json={
            "action": "start", "username": room,
            "session_id": f"s{i}", "mac": f"aabbccdde{i}ff"})
    r = g.post(f"{API}/wifi/authorize",
               json={"username": room, "secret": secret, "mac": "ffffffffffff"})
    assert r.status_code == 403
    assert "3 เครื่อง" in r.json()["detail"]
    assert "แจ้งเคาน์เตอร์" in r.json()["detail"], "ต้องบอกทางออก ไม่ใช่แค่ปฏิเสธ"


def test_a_device_already_online_can_reconnect_at_the_limit(app, c):
    """เครื่องเดิมกลับมาต่อใหม่ตอนชนเพดาน ต้องไม่ถูกปฏิเสธ —
    ไม่งั้นแขกที่เน็ตสะดุดจะต่อกลับไม่ได้ทั้งที่ไม่ได้เพิ่มเครื่อง"""
    _ref, room, secret = _checked_in(c)
    g = _gw(app)
    for i in range(3):
        g.post(f"{API}/wifi/accounting", json={
            "action": "start", "username": room,
            "session_id": f"s{i}", "mac": f"aabbccdde{i}ff"})
    again = g.post(f"{API}/wifi/authorize",
                   json={"username": room, "secret": secret, "mac": "aabbccdde1ff"})
    assert again.status_code == 200


def test_missing_mac_is_refused(app, c):
    """ไม่มี MAC ก็โยง session กลับไปหาคนไม่ได้ ซึ่งทำให้ทั้งระบบไร้ความหมาย"""
    _ref, room, secret = _checked_in(c)
    with pytest.raises(wf.WifiError, match="MAC"):
        db = session_factory()()
        try:
            wf.authorize(db, room, secret, "   ")
        finally:
            db.close()


# ══ 4 · บันทึก session ═══════════════════════════════════════════════
def test_accounting_start_then_stop(app, c, db):
    _ref, room, _secret = _checked_in(c)
    g = _gw(app)
    g.post(f"{API}/wifi/accounting", json={
        "action": "start", "username": room, "session_id": "s1",
        "mac": "aabbccddeeff", "ip": "10.0.5.21", "nas": "AP-ชั้น2"})
    row = db.scalar(select(WifiSession))
    assert row.ended_at is None and row.ip == "10.0.5.21" and row.nas == "AP-ชั้น2"

    g.post(f"{API}/wifi/accounting", json={
        "action": "stop", "username": room, "session_id": "s1",
        "mac": "aabbccddeeff", "bytes_in": 5_000, "bytes_out": 1_200})
    db.refresh(row)
    assert row.ended_at is not None and row.bytes_in == 5_000


def test_repeated_start_does_not_duplicate_the_session(app, c, db):
    """เราเตอร์ส่งซ้ำได้จริงตอนเน็ตสะดุด"""
    _ref, room, _secret = _checked_in(c)
    g = _gw(app)
    for _ in range(3):
        g.post(f"{API}/wifi/accounting", json={
            "action": "start", "username": room, "session_id": "s1", "mac": "aabbccddeeff"})
    assert len(db.scalars(select(WifiSession)).all()) == 1


def test_byte_counters_are_totals_not_increments(app, c, db):
    """ปริมาณจากอุปกรณ์เป็นยอดสะสมของ session · บวกเข้าไปเรื่อย ๆ เมื่อไร
    ยอดจะพุ่งเป็นหลายเท่าของจริง"""
    _ref, room, _secret = _checked_in(c)
    g = _gw(app)
    g.post(f"{API}/wifi/accounting", json={
        "action": "start", "username": room, "session_id": "s1", "mac": "aabbccddeeff"})
    for total in (1_000, 5_000, 9_000):
        g.post(f"{API}/wifi/accounting", json={
            "action": "update", "username": room, "session_id": "s1",
            "mac": "aabbccddeeff", "bytes_in": total})
    row = db.scalar(select(WifiSession))
    db.refresh(row)
    assert row.bytes_in == 9_000, "ต้องเป็นยอดล่าสุด ไม่ใช่ผลบวก 15,000"


def test_online_list_shows_the_guest_at_the_counter(app, c):
    """ใช้ตอนแขกโทรมาบอกว่าเน็ตใช้ไม่ได้ — เคาน์เตอร์ต้องเห็นทันทีว่าต่ออยู่ไหม"""
    _ref, room, _secret = _checked_in(c, "202", "คุณสมชาย")
    g = _gw(app)
    g.post(f"{API}/wifi/accounting", json={
        "action": "start", "username": room, "session_id": "s1",
        "mac": "aabbccddeeff", "ip": "10.0.5.30"})
    out = c.get(f"{API}/wifi/online").json()
    assert out["devices"] == 1
    assert out["rows"][0]["room"] == "202" and out["rows"][0]["guest"] == "คุณสมชาย"


# ══ 5 · รายงานตาม ม.26 ══════════════════════════════════════════════
def test_the_report_answers_who_that_ip_was(app, c):
    """หัวใจของฟีเจอร์นี้ทั้งหมด — เจ้าหน้าที่ถามว่า "วันนั้น IP นี้คือใคร"
    และคำตอบต้องมีเลขเอกสารแสดงตนจากทะเบียนผู้พัก"""
    ref, room, _secret = _checked_in(c, "201", "ชื่อบนการจอง")
    c.post(f"{API}/bookings/{ref}/register", json={
        "full_name": "อนันต์ ศรีสุข", "nationality": "ไทย",
        "id_type": "thai_id", "id_number": GOOD_ID})

    g = _gw(app)
    g.post(f"{API}/wifi/accounting", json={
        "action": "start", "username": room, "session_id": "s1",
        "mac": "aabbccddeeff", "ip": "10.0.5.21", "nas": "AP-ชั้น2"})

    today = clock.today().isoformat()
    out = c.get(f"{API}/wifi/report?since={today}&until={today}").json()
    assert out["sessions"] == 1
    row = out["rows"][0]
    assert row["ip"] == "10.0.5.21" and row["room"] == "201"
    assert row["id_number"] == GOOD_ID
    assert row["name"] == "อนันต์ ศรีสุข", "ต้องใช้ชื่อตามเอกสาร ไม่ใช่ชื่อบนการจอง"
    assert row["registered"] is True
    assert "ไม่เก็บโดยตั้งใจ" in out["note"], "ต้องบอกตรง ๆ ว่าเราไม่เก็บข้อมูลจราจร"


def test_the_report_flags_sessions_with_no_identity(app, c):
    """แขกที่ต่อเน็ตแต่ยังไม่ได้ลงทะเบียนผู้พัก คือช่องว่างที่ต้องเห็น
    ไม่ใช่ปล่อยให้เงียบไปจนเจ้าหน้าที่มาขอแล้วตอบไม่ได้"""
    _ref, room, _secret = _checked_in(c)
    g = _gw(app)
    g.post(f"{API}/wifi/accounting", json={
        "action": "start", "username": room, "session_id": "s1", "mac": "aabbccddeeff"})
    today = clock.today().isoformat()
    out = c.get(f"{API}/wifi/report?since={today}&until={today}").json()
    assert out["unregistered"] == 1
    assert out["rows"][0]["registered"] is False


def test_retention_below_ninety_days_is_refused(db):
    """การตั้งค่าผิดพลาดจะทำให้ผิดกฎหมายเงียบ ๆ ไม่มีอะไรฟ้อง จนกว่า
    เจ้าหน้าที่จะมาขอแล้วเราไม่มีให้"""
    with pytest.raises(wf.WifiError, match="90 วัน"):
        wf.prune_sessions(db, days=30)


def test_retention_above_the_floor_is_allowed(app, c, db):
    _ref, room, _secret = _checked_in(c)
    g = _gw(app)
    g.post(f"{API}/wifi/accounting", json={
        "action": "start", "username": room, "session_id": "s1", "mac": "aabbccddeeff"})
    # ของใหม่ต้องไม่ถูกลบ
    assert wf.prune_sessions(db, days=90) == 0
    row = db.scalar(select(WifiSession))
    row.started_at = clock.now() - timedelta(days=200)
    db.commit()
    assert wf.prune_sessions(db, days=90) == 1
    db.commit()


# ══ 6 · ช่วงผ่อนผันหลังเช็กเอาต์ ═════════════════════════════════════
def test_wifi_survives_checkout_for_a_grace_period(app, c, db):
    """ตัดทันทีที่ปิดบิลคือความสะดวกที่หายไปโดยไม่ได้อะไรคืน —
    แขกยังยืนรอแท็กซี่อยู่ที่ล็อบบี้"""
    ref, room, secret = _checked_in(c)
    c.post(f"{API}/folios/{ref}/close")

    cred = db.scalar(select(WifiCredential))
    db.refresh(cred)
    left = (cred.valid_until - clock.now()).total_seconds() / 3600
    assert 2 < left <= wf.GRACE_HOURS, f"ควรเหลือราว {wf.GRACE_HOURS} ชั่วโมง ได้ {left}"

    g = _gw(app)
    r = g.post(f"{API}/wifi/authorize",
               json={"username": room, "secret": secret, "mac": "aabbccddeeff"})
    assert r.status_code == 200, "หลังเช็กเอาต์ในช่วงผ่อนผันยังต่อได้"


def test_issuing_leaves_an_audit_trace(c, db):
    from pms.db import AuditEvent
    ref, _room, _secret = _checked_in(c)
    c.post(f"{API}/bookings/{ref}/wifi")
    row = db.scalars(select(AuditEvent).where(AuditEvent.action == "wifi.issue")).all()[-1]
    assert row.ref == ref

"""Wi-Fi ที่พัก — ชั้นที่ตอบว่า "session นี้คือใคร"

เส้นแบ่งที่ตั้งใจขีดไว้
------------------------
    อุปกรณ์เครือข่าย   รู้ว่า MAC นี้ทำอะไร   ไม่รู้ว่าเป็นใคร
    ระบบนี้            รู้ว่า MAC นี้คือใคร    ไม่เก็บว่าทำอะไร

**ม.26 พ.ร.บ.ว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ พ.ศ. 2550** ให้
ผู้ให้บริการเก็บข้อมูลจราจรไม่น้อยกว่า 90 วัน โทษปรับไม่เกินห้าแสนบาท ·
ข้อมูลจราจรที่อุปกรณ์เก็บจะไร้ประโยชน์ถ้าโยงกลับไปหาคนไม่ได้ ไฟล์นี้คือ
ชิ้นที่หายไปนั้น

**เราไม่เป็นถังเก็บ log จราจรโดยตั้งใจ** — อุปกรณ์ทำได้ดีกว่าและถูกกว่า
ส่วนข้อมูลว่าใครเข้าเว็บอะไรเป็นข้อมูลที่ร้อนที่สุดในสายตา PDPA ยิ่งถือน้อย
ยิ่งดี · เราเก็บแค่ว่า "IP นี้ในช่วงเวลานี้คือแขกคนไหน" ซึ่งเล็กและจำเป็น

ต่อกับอุปกรณ์ยังไง
-------------------
ไม่ผูกกับยี่ห้อไหน เพราะเปิดเป็น HTTP ให้อุปกรณ์เรียกเข้ามา

* **FreeRADIUS** → โมดูล `rlm_rest` ชี้มาที่ `/wifi/authorize` และ `/wifi/accounting`
  แล้ว Mikrotik / Ruckus / Aruba / Cisco ต่อผ่าน RADIUS ตามปกติ
* **UniFi / Omada** → external captive portal เรียกตรงได้เลย
* **Mikrotik hotspot** → ชี้ RADIUS มาที่ FreeRADIUS ตัวเดียวกัน

ความปลอดภัยของช่องนี้
----------------------
สองเส้นทางที่อุปกรณ์เรียก **ไม่ได้ใช้บัญชีพนักงาน** เพราะเราเตอร์ไม่ใช่คน
ใช้ความลับร่วมจาก `PMS_WIFI_SECRET` แทน · และ **ถ้าไม่ตั้งค่า เส้นทางจะปฏิเสธ
ทุกคำขอ ไม่ใช่ปล่อยผ่าน** — ระบบที่ลืมตั้งค่าแล้วเปิดกว้างคือระบบที่ไม่มีใคร
รู้ว่าเปิดกว้างอยู่

ช่องนี้ต้องอยู่บนวงในเท่านั้น ห้ามเปิดออกอินเทอร์เน็ต
"""
from __future__ import annotations

import hmac
import os
import re
import secrets
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from pms import clock
from pms.auth import hash_secret, verify_secret
from pms.db import Booking, GuestRegister, WifiCredential, WifiSession

#: ช่วงผ่อนผันหลังเช็กเอาต์ · แขกที่รอแท็กซี่อยู่ที่ล็อบบี้ยังควรใช้เน็ตได้
GRACE_HOURS = 3

#: กี่เครื่องต่อห้อง — มือถือ โน้ตบุ๊ก แท็บเล็ต
DEFAULT_DEVICE_LIMIT = 3

#: กฎหมายให้เก็บไม่น้อยกว่า 90 วัน · ตัวเลขนี้เป็นพื้น ไม่ใช่เป้า
MIN_RETENTION_DAYS = 90

#: ตัวอักษรที่ใช้สร้างรหัส — ตัด 0/O/1/l/I/5/S ออก เพราะแขกอ่านจากใบแล้ว
#: พิมพ์ผิดเป็นตัวที่หน้าตาเหมือนกัน แล้วโทรมาบอกว่ารหัสใช้ไม่ได้
_ALPHABET = "abcdefghjkmnpqrtuvwxy2346789"


class WifiError(Exception):
    pass


def _norm_mac(mac: str) -> str:
    """ทำ MAC ให้อยู่รูปเดียว — อุปกรณ์แต่ละยี่ห้อส่งมาไม่เหมือนกัน

    Mikrotik ส่ง `AA:BB:CC:DD:EE:FF` · UniFi ส่ง `aabbccddeeff` ·
    บางตัวส่ง `AA-BB-CC-DD-EE-FF` · ถ้าไม่ทำให้เหมือนกันก่อนเทียบ
    เครื่องเดิมจะถูกนับเป็นเครื่องใหม่ทุกครั้งที่ต่อ แล้วชนเพดานจำนวนเครื่อง
    """
    return re.sub(r"[^0-9a-f]", "", (mac or "").lower())


def gateway_ok(presented: str) -> bool:
    """ตรวจความลับร่วมของอุปกรณ์ · ไม่ตั้งค่า = ปฏิเสธทุกคำขอ"""
    want = os.environ.get("PMS_WIFI_SECRET", "")
    if not want:
        return False
    return hmac.compare_digest(presented or "", want)


# ── ออกรหัสให้แขก ────────────────────────────────────────────────────
def issue(
    db: Session, ref: str, *,
    device_limit: int | None = None,
    grace_hours: int = GRACE_HOURS,
) -> tuple[WifiCredential, str]:
    """ออกรหัส Wi-Fi ให้การเข้าพักหนึ่งครั้ง · คืนรหัสจริงครั้งเดียว

    เรียกซ้ำได้ — ออกรหัสใหม่ทับของเดิม (แขกทำใบหาย) และ session ที่เปิดอยู่
    จะถูกปิด เพราะรหัสเดิมใช้ไม่ได้แล้ว
    """
    b = db.scalar(select(Booking).where(Booking.ref == ref))
    if b is None:
        raise WifiError(f"ไม่พบการจอง {ref}")
    if b.status == "cancelled":
        raise WifiError("การจองถูกยกเลิกแล้ว ออกรหัส Wi-Fi ไม่ได้")

    # อ่านค่าที่ต้องใช้ให้ครบ **ก่อน** สร้างแถวใหม่
    #
    # `b.room.no` เป็น lazy load ซึ่งยิง SELECT · ถ้าเรียกหลัง db.add() แล้ว
    # SQLAlchemy จะ autoflush แถวที่ยังไม่มี username ออกไปก่อน แล้วชน
    # NOT NULL — บั๊กที่โผล่เฉพาะตอนสร้างใหม่ ไม่โผล่ตอนออกรหัสซ้ำ
    room_no = b.room.no
    secret = "".join(secrets.choice(_ALPHABET) for _ in range(6))
    secret_hash = hash_secret(secret)
    start = datetime.combine(b.check_in, datetime.min.time())
    until = datetime.combine(b.check_out, datetime.min.time()) + timedelta(hours=grace_hours)
    limit = device_limit or DEFAULT_DEVICE_LIMIT

    cred = db.scalar(select(WifiCredential).where(WifiCredential.booking_id == b.id))
    if cred is None:
        cred = WifiCredential(
            booking_id=b.id, username=room_no, secret_hash=secret_hash,
            valid_from=start, valid_until=until, device_limit=limit,
        )
        db.add(cred)
    else:
        cred.username = room_no
        cred.secret_hash = secret_hash
        cred.valid_from = start
        cred.valid_until = until
        cred.device_limit = limit
        cred.revoked = False
    db.flush()

    # ออกรหัสใหม่แล้วของเก่าต้องหลุด ไม่ใช่ค้างต่อไปด้วยรหัสที่เลิกใช้แล้ว
    _close_open_sessions(db, cred.id, why="ออกรหัสใหม่")
    return cred, secret


def revoke(db: Session, ref: str) -> WifiCredential:
    """ตัดสิทธิ์ทันที · ใช้กับกรณีที่ต้องตัดก่อนกำหนด ไม่ใช่การเช็กเอาต์ปกติ"""
    cred = _cred_of(db, ref)
    cred.revoked = True
    _close_open_sessions(db, cred.id, why="ถูกตัดสิทธิ์")
    db.flush()
    return cred


def extend_to_checkout(db: Session, booking: Booking, grace_hours: int = GRACE_HOURS) -> None:
    """ตั้งวันหมดอายุตอนปิดบิล = เวลาปิดบิล + ช่วงผ่อนผัน

    ตัดทันทีที่ปิดบิลคือความสะดวกที่หายไปโดยไม่ได้อะไรคืน — แขกยังยืนรอ
    แท็กซี่อยู่ที่ล็อบบี้ และไม่มีใครได้ประโยชน์จากการตัดเน็ตตอนนั้น
    """
    cred = db.scalar(select(WifiCredential).where(WifiCredential.booking_id == booking.id))
    if cred is None:
        return
    cred.valid_until = clock.now() + timedelta(hours=grace_hours)
    db.flush()


def _cred_of(db: Session, ref: str) -> WifiCredential:
    cred = db.scalar(
        select(WifiCredential).join(Booking).where(Booking.ref == ref)
    )
    if cred is None:
        raise WifiError(f"การจอง {ref} ยังไม่มีรหัส Wi-Fi")
    return cred


def _close_open_sessions(db: Session, credential_id: int, *, why: str = "") -> int:
    now = clock.now()
    rows = db.scalars(
        select(WifiSession).where(WifiSession.credential_id == credential_id,
                                  WifiSession.ended_at.is_(None))
    ).all()
    for r in rows:
        r.ended_at = now
    return len(rows)


# ── สิ่งที่อุปกรณ์เรียก ──────────────────────────────────────────────
def authorize(db: Session, username: str, secret: str, mac: str) -> dict:
    """อุปกรณ์ถามว่า "ให้เครื่องนี้ต่อได้ไหม" · คืนข้อมูลที่จำเป็นต่อ session

    ตอบข้อความเดียวกันทุกกรณีที่ปฏิเสธ ไม่บอกใบ้ว่าห้องไหนมีแขกอยู่จริง —
    ใครยืนที่ล็อบบี้แล้วลองสุ่มเลขห้อง ต้องไม่ได้ข้อมูลอะไรกลับไป
    """
    deny = WifiError("รหัสไม่ถูกต้องหรือหมดอายุแล้ว")
    cred = db.scalar(
        select(WifiCredential).where(WifiCredential.username == username.strip())
        .order_by(WifiCredential.id.desc())
    )
    if cred is None or cred.revoked:
        hash_secret(secret)              # เผาเวลาเท่ากัน ไม่ให้จับจังหวะได้
        raise deny
    if not verify_secret(secret, cred.secret_hash):
        raise deny

    now = clock.now()
    if not (cred.valid_from <= now <= cred.valid_until):
        raise deny

    b = db.get(Booking, cred.booking_id)
    if b is None or b.status == "cancelled":
        raise deny

    key = _norm_mac(mac)
    if not key:
        raise WifiError("อุปกรณ์ไม่ได้ส่งหมายเลข MAC มา — โยง session กลับไปหาคนไม่ได้")

    # นับเครื่องที่กำลังต่ออยู่ · เครื่องเดิมกลับมาต่อใหม่ไม่นับเพิ่ม
    active = {
        _norm_mac(r.mac) for r in db.scalars(
            select(WifiSession).where(WifiSession.credential_id == cred.id,
                                      WifiSession.ended_at.is_(None))
        )
    }
    if key not in active and len(active) >= cred.device_limit:
        raise WifiError(
            f"ห้อง {cred.username} ต่อได้ {cred.device_limit} เครื่อง "
            f"และตอนนี้ต่ออยู่ครบแล้ว — ปิดเครื่องที่ไม่ใช้ หรือแจ้งเคาน์เตอร์เพิ่มจำนวน"
        )

    return {
        "ok": True,
        "booking_ref": b.ref,
        "room": cred.username,
        "guest": b.guest_name,
        "device_limit": cred.device_limit,
        "devices_online": len(active),
        # อุปกรณ์ใช้ค่านี้ตั้งเวลาตัดเอง ไม่ต้องมาถามเราซ้ำ
        "session_timeout": max(60, int((cred.valid_until - now).total_seconds())),
    }


def accounting(
    db: Session, *,
    action: str, username: str, session_id: str, mac: str,
    ip: str = "", nas: str = "", bytes_in: int = 0, bytes_out: int = 0,
) -> WifiSession:
    """บันทึกการเปิด–ปิด session ที่อุปกรณ์รายงานมา

    RADIUS ส่งสามจังหวะ — `start` เมื่อต่อ · `update` เป็นระยะ · `stop` เมื่อหลุด
    ทั้งสามจังหวะเข้าที่นี่ และ `start` ของ session ที่มีอยู่แล้วไม่สร้างซ้ำ
    เพราะเราเตอร์ส่งซ้ำได้จริงตอนเน็ตสะดุด
    """
    if action not in ("start", "update", "stop"):
        raise WifiError(f"ไม่รู้จักจังหวะ {action}")

    cred = db.scalar(
        select(WifiCredential).where(WifiCredential.username == username.strip())
        .order_by(WifiCredential.id.desc())
    )
    if cred is None:
        raise WifiError(f"ไม่พบรหัส Wi-Fi ของห้อง {username}")

    row = db.scalar(
        select(WifiSession).where(WifiSession.acct_session_id == session_id)
    )
    if row is None:
        row = WifiSession(
            credential_id=cred.id, acct_session_id=session_id,
            mac=_norm_mac(mac), ip=ip.strip(), nas=nas.strip(),
        )
        db.add(row)

    # ปริมาณข้อมูลจากอุปกรณ์เป็นยอดสะสมของ session นั้น ไม่ใช่ส่วนเพิ่ม
    # บวกเข้าไปเรื่อย ๆ เมื่อไร ยอดจะพุ่งเป็นหลายเท่าของจริง
    if bytes_in:
        row.bytes_in = bytes_in
    if bytes_out:
        row.bytes_out = bytes_out
    if ip:
        row.ip = ip.strip()

    if action == "stop" and row.ended_at is None:
        row.ended_at = clock.now()

    db.flush()
    return row


# ── รายงานตาม ม.26 ──────────────────────────────────────────────────
def identity_report(db: Session, since: date, until: date) -> list[dict]:
    """ต่อ session เข้ากับตัวตนของแขก · นี่คือสิ่งที่เจ้าหน้าที่มาขอ

    ตอบคำถามว่า "วันนั้น IP นี้คือใคร" ได้ครบ — ชื่อ สัญชาติ เลขเอกสารแสดงตน
    ห้อง และช่วงเวลาที่ต่ออยู่ · ส่วนว่าเข้าเว็บอะไร ขอจากอุปกรณ์เครือข่าย
    ซึ่งเก็บไว้อยู่แล้ว
    """
    rows = db.scalars(
        select(WifiSession)
        .where(func.date(WifiSession.started_at) >= since.isoformat(),
               func.date(WifiSession.started_at) <= until.isoformat())
        .order_by(WifiSession.started_at)
    ).all()

    out = []
    for r in rows:
        cred = db.get(WifiCredential, r.credential_id)
        b = db.get(Booking, cred.booking_id) if cred else None
        gr = db.scalar(
            select(GuestRegister).where(GuestRegister.booking_id == b.id)
        ) if b else None
        out.append({
            "started_at": r.started_at, "ended_at": r.ended_at,
            "mac": r.mac, "ip": r.ip, "nas": r.nas,
            "room": cred.username if cred else "",
            "booking_ref": b.ref if b else "",
            # ชื่อจากทะเบียนผู้พักก่อน เพราะเป็นชื่อตามเอกสารแสดงตน
            # ชื่อบนการจองอาจเป็นชื่อเล่นหรือชื่อคนที่จองให้
            "name": (gr.full_name if gr else (b.guest_name if b else "")),
            "nationality": gr.nationality if gr else "",
            "id_type": gr.id_type if gr else "",
            "id_number": gr.id_number if gr else "",
            "registered": gr is not None,
            "bytes_in": r.bytes_in, "bytes_out": r.bytes_out,
        })
    return out


def prune_sessions(db: Session, days: int = 365) -> int:
    """ลบบันทึก session ที่เก่ากว่ากำหนด · ห้ามต่ำกว่า 90 วัน

    ตัวกันนี้มีเพราะการตั้งค่าผิดพลาดจะทำให้ผิดกฎหมายเงียบ ๆ ไม่มีอะไรฟ้อง
    จนกว่าเจ้าหน้าที่จะมาขอแล้วเราไม่มีให้
    """
    if days < MIN_RETENTION_DAYS:
        raise WifiError(
            f"เก็บได้ไม่ต่ำกว่า {MIN_RETENTION_DAYS} วัน — "
            "ม.26 พ.ร.บ.คอมพิวเตอร์ กำหนดไว้เป็นพื้น ไม่ใช่ค่าที่ปรับลงได้"
        )
    cutoff = clock.now() - timedelta(days=days)
    rows = db.scalars(select(WifiSession).where(WifiSession.started_at < cutoff)).all()
    for r in rows:
        db.delete(r)
    db.flush()
    return len(rows)


def online(db: Session) -> list[dict]:
    """ใครกำลังต่ออยู่ตอนนี้ · ใช้ที่เคาน์เตอร์ตอนแขกโทรมาบอกว่าเน็ตใช้ไม่ได้"""
    rows = db.scalars(
        select(WifiSession).where(WifiSession.ended_at.is_(None))
        .order_by(WifiSession.started_at)
    ).all()
    out = []
    for r in rows:
        cred = db.get(WifiCredential, r.credential_id)
        b = db.get(Booking, cred.booking_id) if cred else None
        out.append({
            "room": cred.username if cred else "", "mac": r.mac, "ip": r.ip,
            "guest": b.guest_name if b else "", "since": r.started_at,
            "nas": r.nas,
        })
    return out

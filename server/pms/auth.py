"""ยืนยันตัวตนและสิทธิ์

ทำไมต้องมีก่อนอย่างอื่น
------------------------
`README` เขียนไว้เองว่า "ตอนนี้ API ยังไม่มีการยืนยันตัวตนเลย — ห้ามเปิดออก
อินเทอร์เน็ต" ตราบใดที่ยังเป็นแบบนั้น จะย้ายหน้าจอมาต่อหลังบ้านไม่ได้เลย
เพราะใครเปิด URL เจอก็ปิดบิลของคนอื่น ออกใบกำกับภาษี หรือแก้ราคาห้องได้

และเหตุผลที่ลึกกว่านั้น — เจ้าของซื้อระบบเพราะอยากรู้ว่าเงินถูกบันทึกครบ
ถ้าพนักงานอนุมัติส่วนลดให้ตัวเองได้ บันทึกการตรวจสอบทั้งหมดก็ไม่มีความหมาย
เพราะคนที่ถูกตรวจสอบเป็นคนกดเอง

ใช้อะไรเก็บรหัส
----------------
`hashlib.scrypt` ของไพธอนเอง ไม่ลงไลบรารีเพิ่ม — โครงการนี้ยึดหลัก "พึ่งพา
น้อยกว่าคือพังยากกว่า" มาตลอด (ดูเหตุผลเรื่อง zoneinfo ใน clock.py)
scrypt กินหน่วยความจำโดยตั้งใจ จึงทนการไล่เดารหัสด้วยการ์ดจอได้ดีกว่า
ตระกูล sha ล้วน ๆ ที่เร็วเกินไปจนกลายเป็นข้อเสีย

**ฐานข้อมูลเก็บแค่แฮช ไม่เคยเก็บรหัสจริงและไม่เคยเก็บโทเคนจริง** ทำหายแล้ว
ออกใหม่อย่างเดียว กู้คืนไม่ได้ — ตั้งใจให้เป็นแบบนั้น
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import timedelta

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from pms import clock
from pms.db import AuditEvent, Staff, StaffSession
from pms.session import get_db

#: อายุเซสชัน · กะหนึ่งของโรงแรมยาวราวสิบสองชั่วโมง เผื่อโอทีอีกหน่อย
SESSION_HOURS = 14

_SCRYPT = dict(n=2**14, r=8, p=1, dklen=32)


# ── รหัสผ่าน ─────────────────────────────────────────────────────────
def hash_secret(secret: str, salt: bytes | None = None) -> str:
    """แฮชรหัสด้วย scrypt · คืนสตริงที่มีเกลือติดมาในตัว

    เก็บเกลือไว้ในสตริงเดียวกันเลย จะได้ไม่ต้องมีคอลัมน์แยกให้ลืมย้ายตอน
    ย้ายฐานข้อมูล และอ่านออกได้ว่าแถวไหนยังเป็นรูปแบบเก่า
    """
    salt = salt or secrets.token_bytes(16)
    dk = hashlib.scrypt(secret.encode("utf-8"), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${dk.hex()}"


def verify_secret(secret: str, stored: str) -> bool:
    """เทียบรหัสแบบใช้เวลาคงที่ ไม่ให้เดาได้จากระยะเวลาที่ใช้ตอบ"""
    try:
        kind, salt_hex, want = stored.split("$")
    except ValueError:
        return False
    if kind != "scrypt":
        return False
    got = hashlib.scrypt(secret.encode("utf-8"), salt=bytes.fromhex(salt_hex), **_SCRYPT)
    return hmac.compare_digest(got.hex(), want)


def _token_hash(token: str) -> str:
    """โทเคนเป็นค่าสุ่มยาวอยู่แล้ว จึงแฮชด้วย sha256 ตรง ๆ ได้

    ต่างจากรหัสผ่านที่คนตั้งเองและเดาได้ — โทเคน 32 ไบต์สุ่มไม่มีใครไล่เดาไหว
    การใส่ scrypt ตรงนี้จะทำให้ทุกคำขอต้องคิดแฮชหนักโดยไม่ได้อะไรเพิ่ม
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ── สิทธิ์ ───────────────────────────────────────────────────────────
#: ตรงกับ src/lib/roles.ts ฝั่งหน้าจอ แต่ละเอียดกว่าเพราะ API ต้องคุมรายเส้นทาง
#: แก้ที่นี่แล้วต้องแก้ฝั่งหน้าจอตาม ไม่งั้นปุ่มจะโผล่ให้กดทั้งที่กดแล้วโดนปฏิเสธ
PERMISSIONS = (
    "booking",    # สร้าง แก้ ยกเลิกการจอง เช็กอิน
    "folio",      # ลงรายการเข้าบิลและรับชำระ
    "fnb",        # ลงเฉพาะรายการอาหารและเครื่องดื่ม (สิทธิ์ย่อยของ folio)
    "invoice",    # ออกใบกำกับภาษี
    "register",   # ทะเบียนผู้พัก ร.ร.3/4 และ ตม.30
    "expense",    # บันทึกรายจ่าย
    "ledger",     # ส่งเข้าระบบบัญชี
    "revenue",    # เห็นตัวเลขรายได้และต้นทุนทั้งกิจการ
    "approve",    # อนุมัติส่วนลดและคืนเงินที่เกินอำนาจพนักงาน
    "settings",   # แก้ราคา ภาษี ผังห้อง
    "staff",      # จัดการผู้ใช้และสิทธิ์
)

ROLES: dict[str, frozenset[str]] = {
    "owner":   frozenset(PERMISSIONS),
    "manager": frozenset(PERMISSIONS),
    # พนักงานเคาน์เตอร์ทำงานหน้าบ้านได้ครบ แต่ไม่เห็นตัวเลขทั้งกิจการ
    # และอนุมัติส่วนลดให้ตัวเองไม่ได้ — นั่นคือจุดที่การตรวจสอบมีความหมาย
    "front":   frozenset({"booking", "folio", "fnb", "invoice", "register"}),
    "hk":      frozenset(),
    "tech":    frozenset(),
    "pos":     frozenset({"fnb"}),
}

ROLE_LABEL = {
    "owner": "เจ้าของ", "manager": "ผู้จัดการ", "front": "พนักงานเคาน์เตอร์",
    "hk": "แม่บ้าน / หัวหน้า", "tech": "ช่าง", "pos": "ร้านอาหาร",
}


def can(role: str, perm: str) -> bool:
    return perm in ROLES.get(role, frozenset())


class AuthError(Exception):
    pass


# ── เข้าออกระบบ ──────────────────────────────────────────────────────
def login(db: DbSession, card: str, pin: str) -> tuple[str, Staff]:
    """แตะบัตรแล้วใส่รหัส · คืนโทเคนที่แสดงครั้งเดียว

    เหตุผลที่ต้องมีรหัสด้วย ไม่ใช่บัตรอย่างเดียว — บัตรหล่นในลานจอดรถแล้ว
    คนเก็บได้เปิดบิลของโรงแรมทั้งใบไม่ได้ ต้องรู้รหัสด้วย
    """
    staff = db.scalar(select(Staff).where(Staff.card == card.strip()))
    # ตอบข้อความเดียวกันทั้งกรณีไม่มีบัตรและรหัสผิด ไม่บอกใบ้ว่าบัตรไหนมีจริง
    fail = AuthError("บัตรหรือรหัสไม่ถูกต้อง")
    if staff is None or not staff.active:
        # เผาเวลาเท่ากับตอนมีคนจริง ไม่ให้จับได้จากระยะเวลาว่าบัตรนี้มีอยู่ไหม
        hash_secret(pin)
        raise fail
    if not verify_secret(pin, staff.pin_hash):
        raise fail

    token = "sts_" + secrets.token_urlsafe(32)
    db.add(StaffSession(
        token_hash=_token_hash(token),
        staff_id=staff.id,
        expires_at=clock.now() + timedelta(hours=SESSION_HOURS),
    ))
    record(db, staff, "auth.login", "staff", staff.ref)
    db.commit()
    return token, staff


def logout(db: DbSession, token: str) -> None:
    row = db.scalar(select(StaffSession).where(StaffSession.token_hash == _token_hash(token)))
    if row is not None and not row.revoked:
        row.revoked = True
        db.commit()


def staff_for(db: DbSession, token: str) -> Staff:
    """แปลงโทเคนเป็นคน · โยนถ้าหมดอายุ ถูกเพิกถอน หรือคนนั้นถูกปิดใช้งานไปแล้ว"""
    row = db.scalar(select(StaffSession).where(StaffSession.token_hash == _token_hash(token)))
    if row is None or row.revoked:
        raise AuthError("เซสชันใช้ไม่ได้แล้ว กรุณาแตะบัตรใหม่")
    if row.expires_at <= clock.now():
        raise AuthError("เซสชันหมดอายุ กรุณาแตะบัตรใหม่")
    staff = db.get(Staff, row.staff_id)
    if staff is None or not staff.active:
        raise AuthError("บัญชีนี้ถูกปิดใช้งานแล้ว")
    return staff


# ── ร่องรอยการตรวจสอบ ────────────────────────────────────────────────
def record(db: DbSession, staff: Staff | None, action: str,
           entity: str = "", ref: str = "", detail: str = "") -> None:
    """บันทึกว่าใครทำอะไรกับอะไร

    ไม่ commit ให้ — ผู้เรียกเป็นคนตัดสินว่ารายการนี้จบเมื่อไร ร่องรอยจึงถูก
    บันทึกพร้อมกับสิ่งที่มันอธิบายเสมอ ถ้าธุรกรรมล้ม ร่องรอยก็ต้องหายไปด้วย
    ไม่ใช่เหลือค้างว่ามีคนทำทั้งที่ไม่มีอะไรเกิดขึ้น
    """
    db.add(AuditEvent(
        staff_id=staff.id if staff else None,
        staff_name=staff.name if staff else "",
        action=action, entity=entity, ref=ref, detail=detail[:400],
    ))


# ── ตัวประกอบสำหรับเส้นทาง FastAPI ───────────────────────────────────
def current_staff(
    authorization: str = Header(default=""),
    db: DbSession = Depends(get_db),
) -> Staff:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "ต้องแนบโทเคนมาด้วย — แตะบัตรเข้าระบบก่อน")
    try:
        return staff_for(db, authorization[7:].strip())
    except AuthError as e:
        raise HTTPException(401, str(e)) from None


def require(perm: str):
    """ตัวประกอบที่บังคับสิทธิ์หนึ่งข้อ

        @router.post("/x", dependencies=[Depends(require("folio"))])

    ปฏิเสธพร้อมบอกว่าบทบาทนี้ขาดสิทธิ์อะไร ไม่ใช่แค่ 403 เปล่า ๆ —
    พนักงานที่โดนปฏิเสธโดยไม่รู้เหตุผลจะไปโทรหาหัวหน้า ซึ่งก็ไม่รู้เหมือนกัน
    """
    if perm not in PERMISSIONS:
        raise ValueError(f"ไม่รู้จักสิทธิ์ {perm!r}")

    def guard(staff: Staff = Depends(current_staff)) -> Staff:
        if not can(staff.role, perm):
            raise HTTPException(
                403,
                f"{ROLE_LABEL.get(staff.role, staff.role)}ไม่มีสิทธิ์ {perm} — "
                f"งานนี้ต้องให้ผู้ที่มีสิทธิ์เป็นคนทำ",
            )
        return staff

    return guard

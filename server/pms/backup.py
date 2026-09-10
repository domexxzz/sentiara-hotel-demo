"""สำรองและกู้คืนข้อมูล

ทำไมไม่ก๊อปไฟล์ .db เฉย ๆ
--------------------------
ฐานข้อมูลเปิดโหมด WAL อยู่ (ดู `make_engine`) ข้อมูลที่เขียนล่าสุดจึงอยู่ใน
ไฟล์ `-wal` ยังไม่ได้ลงไฟล์หลัก · ก๊อปแค่ `.db` ตอนระบบยังทำงานอยู่ จะได้
สำเนาที่ **ขาดรายการล่าสุด** หรือแย่กว่านั้นคือได้ไฟล์ที่เปิดไม่ขึ้นเลย
เพราะก๊อปคร่อมจังหวะที่กำลังเขียน

`sqlite3.Connection.backup()` เป็นทางการที่ SQLite ให้มา — มันล็อกอ่านให้เอง
ทำสำเนาที่ **สอดคล้องกันทั้งไฟล์** ได้แม้ระบบกำลังรับงานอยู่ ไม่ต้องปิดเซิร์ฟเวอร์

ที่สำคัญกว่าการสำรอง — การกู้คืน
----------------------------------
สำรองที่ไม่เคยลองกู้ ไม่ใช่การสำรอง แต่เป็นความรู้สึกปลอดภัย · `verify()`
เปิดไฟล์สำเนาขึ้นมาจริง นับแถวจริง แล้วรัน `PRAGMA integrity_check`
ทุกครั้งหลังสำรองเสร็จ ไม่ใช่ทางเลือก
"""
from __future__ import annotations

import os
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from pms import clock

#: ตารางที่ต้องมีข้อมูลอยู่จริงถึงจะถือว่าสำเนาใช้ได้
#: ไม่ใช่ทุกตาราง — โรงแรมที่เพิ่งติดตั้งยังไม่มีบิลเป็นเรื่องปกติ
CORE_TABLES = ("room", "room_type", "staff")

#: ทุกตารางที่นับให้ดูตอนสำรอง เพื่อเทียบก่อน–หลังกู้คืน
COUNTED = (
    "room_type", "room", "booking", "room_night", "folio", "charge", "payment",
    "tax_invoice", "credit_note", "expense", "ledger_outbox",
    "guest_registration", "housekeeping_task", "staff", "audit_event",
    # บันทึก session Wi-Fi ต้องนับด้วย — ม.26 บังคับให้เก็บ 90 วัน
    # ถ้ากู้คืนแล้วหายไปเงียบ ๆ เราผิดกฎหมายโดยไม่มีอะไรฟ้อง
    "wifi_credential", "wifi_session",
)


class BackupError(Exception):
    pass


@dataclass
class BackupResult:
    path: Path
    bytes: int
    counts: dict[str, int]


def _db_path(url: str) -> Path:
    if not url.startswith("sqlite"):
        raise BackupError(
            f"ตัวสำรองนี้รองรับเฉพาะ SQLite · ได้ {url.split(':')[0]} — "
            "ถ้าย้ายไป PostgreSQL แล้วให้ใช้ pg_dump แทน"
        )
    p = url.replace("sqlite:///", "").replace("sqlite://", "")
    if ":memory:" in p:
        raise BackupError("ฐานข้อมูลในหน่วยความจำสำรองไม่ได้")
    return Path(p).resolve()


def counts(path: Path) -> dict[str, int]:
    """นับแถวทุกตาราง · ใช้เทียบก่อน–หลังกู้คืน"""
    out: dict[str, int] = {}
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        have = {r[0] for r in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}
        for t in COUNTED:
            if t in have:
                out[t] = con.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
    finally:
        con.close()
    return out


def verify(path: Path) -> dict[str, int]:
    """เปิดสำเนาขึ้นมาจริงแล้วตรวจ · โยนถ้าใช้ไม่ได้

    สำรองที่ไม่เคยลองเปิด ไม่ใช่การสำรอง แต่เป็นความรู้สึกปลอดภัย
    """
    if not path.exists() or path.stat().st_size == 0:
        raise BackupError(f"ไฟล์สำรอง {path} ไม่มีอยู่หรือว่างเปล่า")

    try:
        con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    except sqlite3.Error as e:
        raise BackupError(f"เปิดไฟล์สำรอง {path.name} ไม่ได้ · {e}") from None
    try:
        ok = con.execute("PRAGMA integrity_check").fetchone()[0]
        if ok != "ok":
            raise BackupError(f"ไฟล์สำรองเสียหาย · integrity_check บอกว่า {ok}")
        have = {r[0] for r in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}
        missing = [t for t in CORE_TABLES if t not in have]
        if missing:
            raise BackupError(f"ไฟล์สำรองขาดตาราง {', '.join(missing)}")
    except sqlite3.DatabaseError as e:
        # ไฟล์ที่ไม่ใช่ฐานข้อมูลเลยจะระเบิดตรงนี้ · ห่อให้เป็นข้อความที่บอกได้ว่า
        # ต้องทำอะไรต่อ แทนที่จะโยน sqlite3 ดิบ ๆ ให้คนดูแลระบบไปเดาเอง
        raise BackupError(
            f"ไฟล์ {path.name} ไม่ใช่ฐานข้อมูลที่ใช้ได้ · {e}"
        ) from None
    finally:
        con.close()

    got = counts(path)
    for t in CORE_TABLES:
        if got.get(t, 0) == 0:
            raise BackupError(
                f"ไฟล์สำรองมีตาราง {t} แต่ไม่มีข้อมูลเลย — "
                "น่าจะสำรองผิดไฟล์หรือสำรองก่อนตั้งค่าระบบ"
            )
    return got


def backup(db_url: str | None = None, out_dir: str | Path = "backups") -> BackupResult:
    """สำรองแบบออนไลน์ · ไม่ต้องปิดเซิร์ฟเวอร์ และตรวจสำเนาให้ทุกครั้ง"""
    src = _db_path(db_url or os.environ.get("PMS_DB", "sqlite:///./data/pms.db"))
    if not src.exists():
        raise BackupError(f"ไม่พบฐานข้อมูลที่ {src}")

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    # ชื่อไฟล์เป็นเวลาไทย ไม่ใช่ UTC — สำรองตอนตีหนึ่งต้องอยู่ในวันที่ถูก
    stamp = clock.now().strftime("%Y%m%d-%H%M%S")
    dest = out / f"pms-{stamp}.db"

    con = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    try:
        tgt = sqlite3.connect(dest)
        try:
            # SQLite ล็อกอ่านให้เองระหว่างนี้ · สำเนาจึงสอดคล้องกันทั้งไฟล์
            # แม้ระบบกำลังรับงานอยู่ ต่างจากการก๊อปไฟล์ที่คร่อมจังหวะเขียนได้
            con.backup(tgt)
        finally:
            tgt.close()
    finally:
        con.close()

    got = verify(dest)
    return BackupResult(path=dest, bytes=dest.stat().st_size, counts=got)


def restore(archive: str | Path, db_url: str | None = None,
            *, keep_current: bool = True) -> Path:
    """กู้คืนจากไฟล์สำรอง

    เก็บของเดิมไว้เป็น `.before-restore` เสมอ (ปิดด้วย keep_current=False)
    เพราะ "กู้คืนผิดไฟล์" เป็นความผิดพลาดที่เกิดจริงตอนคนกำลังตกใจ และถ้า
    เขียนทับของเดิมไปแล้วก็จบ — ไม่มีอะไรให้ย้อน
    """
    src = Path(archive).resolve()
    verify(src)                       # ตรวจก่อนแตะของเดิม ไม่ใช่หลัง

    dest = _db_path(db_url or os.environ.get("PMS_DB", "sqlite:///./data/pms.db"))
    dest.parent.mkdir(parents=True, exist_ok=True)

    # ปล่อยไฟล์ก่อนแตะ — บนวินโดวส์ไฟล์ที่ยังมีคนเปิดอยู่เขียนทับไม่ได้เลย
    # และของจริงต้องปิดเซิร์ฟเวอร์อยู่แล้ว ตรงนี้กันกรณีเรียกจากในโปรเซสเดียวกัน
    try:
        from pms.session import dispose
        dispose()
    except Exception:
        pass

    if dest.exists() and keep_current:
        stamp = clock.now().strftime("%Y%m%d-%H%M%S")
        try:
            dest.replace(dest.with_suffix(f".before-restore-{stamp}.db"))
        except OSError as e:
            raise BackupError(
                f"เก็บฐานข้อมูลเดิมไว้ก่อนกู้คืนไม่ได้ · {e} — "
                "ปิดเซิร์ฟเวอร์ก่อนกู้คืนเสมอ"
            ) from None

    # ลบไฟล์ WAL ของเดิมด้วย ไม่งั้น SQLite จะเอารายการค้างในนั้นมาทับสำเนา
    # ที่เพิ่งกู้ แล้วได้ฐานที่ปนกันสองชุดโดยไม่มีใครรู้
    for suffix in ("-wal", "-shm"):
        stale = Path(str(dest) + suffix)
        if stale.exists():
            stale.unlink()

    try:
        con = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
        try:
            tgt = sqlite3.connect(dest)
            try:
                con.backup(tgt)
            finally:
                tgt.close()
        finally:
            con.close()
    except (OSError, sqlite3.Error) as e:
        raise BackupError(
            f"เขียนฐานข้อมูลที่ {dest} ไม่ได้ · {e} — "
            "ปิดเซิร์ฟเวอร์ก่อนกู้คืนเสมอ ไฟล์ที่ยังมีคนเปิดอยู่เขียนทับไม่ได้"
        ) from None

    verify(dest)
    return dest


def prune(out_dir: str | Path = "backups", keep: int = 30) -> list[Path]:
    """ลบไฟล์สำรองเก่าที่เกินจำนวนที่เก็บ · คืนรายการที่ลบ

    เก็บ 30 ชุดเป็นค่าเริ่มต้น — ประมาณหนึ่งเดือนถ้าสำรองวันละครั้ง
    นานพอที่จะย้อนกลับไปก่อนความผิดพลาดที่กว่าจะรู้ตัวก็ผ่านไปหลายวัน
    """
    out = Path(out_dir)
    if not out.exists():
        return []
    files = sorted(out.glob("pms-*.db"), key=lambda p: p.name)
    doomed = files[:-keep] if keep > 0 else []
    for f in doomed:
        f.unlink()
    return doomed

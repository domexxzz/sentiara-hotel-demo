"""คิวส่งออกไปยังระบบบัญชี — บันทึกลง outbox ก่อน แล้วค่อยส่ง

ไฟล์นี้เขียนใหม่ทั้งหมดจากรุ่นก่อน
------------------------------------
รุ่นก่อนประกอบ **ใบสำคัญพร้อมเดบิต/เครดิต** จากผังบัญชีที่ฝังไว้ในโค้ด แล้วยิงไป
`POST /journal-entries` ซึ่งผิดสัญญาของ Ledger Bridge ทั้งสามชั้น — ผิดหลักการ
(PMS ไม่ควรรู้ผังบัญชี) ผิดเส้นทาง และผิดรูปแบบข้อมูล (ส่งเงินเป็นจำนวนเต็ม
ทั้งที่ปลายทางรับเฉพาะสตริง)

รุ่นนี้ส่ง **เหตุการณ์** เข้า `POST /v1/ingest/events` ตามสัญญาจริง
การประกอบเหตุการณ์อยู่ที่ `events.py` ไฟล์นี้รับผิดชอบแค่คิวและการส่ง

ทำไมต้องผ่าน outbox ไม่ยิงตรงตอนเกิดเหตุ
-----------------------------------------
1. `seq` ต้องเพิ่มขึ้นเรื่อย ๆ ไม่ซ้ำ และ **มาจากคิวของเรา** ไม่ใช่สร้างใหม่ทุกครั้ง
   ที่ยิง · ตัวอย่างที่ผู้ขายแนบมาสร้าง seq จาก watermark ของปลายทางทุกรอบ
   ซึ่งขัดกับกฎข้อ 1 ของเอกสารเขาเอง — พอส่งสำเร็จบางส่วนแล้วส่งรอบใหม่
   เลขจะเลื่อนไม่ตรงของเดิม แล้วของที่ตกค้างถูกทิ้งเงียบ ๆ ที่ watermark
2. เน็ตหลุดกลางดึกแล้วของยังอยู่ ส่งซ้ำพรุ่งนี้ได้ ไม่ต้องไล่สร้างใหม่จากบิลย้อนหลัง
3. บัญชีสนใจยอดรวมของวันทำการ ไม่ได้สนใจเวลาที่แขกเดินออกจากล็อบบี้

สิ่งที่ต้องรู้ก่อนอ่านผลลัพธ์
------------------------------
**`202` แปลว่า "รับไว้แล้ว" ไม่ใช่ "ลงบัญชีแล้ว"** ปลายทางแยกจังหวะรับข้อมูล
ออกจากจังหวะลงบัญชีโดยเจตนา — ตอนรับต้องแทบไม่มีทางล้มเหลว ส่วนตอนลงบัญชี
ล้มได้หลายแบบ (กฎยังไม่เซ็นรับ · ผังบัญชียังไม่ผูก · งวดปิดไปแล้ว) ซึ่งเป็นเรื่อง
ที่คนต้องเข้าไปแก้ ไม่ใช่เรื่องที่ลองใหม่แล้วหายเอง

ดูสถานะจริงที่หน้า "งานค้างจาก PMS" ในโปรแกรมบัญชี
"""
from __future__ import annotations

import json
import os
from datetime import date

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from pms import clock
from pms.db import Expense, Folio, LedgerOutbox, Payment
from pms.events import (
    Event, EventError, expense_event, folio_close_event, night_audit_events,
    payment_event,
)
from pms.ledger_bridge import LedgerBridge, LedgerError as BridgeError


class LedgerError(Exception):
    pass


# ── ชั้นคิว ───────────────────────────────────────────────────────────
def enqueue(db: Session, event: Event) -> LedgerOutbox:
    """ใส่เหตุการณ์ลงคิว · เรียกซ้ำด้วยเหตุการณ์เดิมไม่เพิ่มแถวใหม่

    ความไม่ซ้ำบังคับด้วย UNIQUE บน `event_id` ในฐานข้อมูล เราเช็กก่อนเพื่อให้
    เรียกซ้ำได้เงียบ ๆ แต่ต่อให้เผลอลืมเช็ก ฐานข้อมูลก็ยังปฏิเสธให้อยู่ดี
    """
    existing = db.scalar(
        select(LedgerOutbox).where(LedgerOutbox.event_id == event.event_id)
    )
    if existing is not None:
        return existing

    row = LedgerOutbox(
        event_id=event.event_id,
        event_type=event.event_type,
        business_date=event.business_date,
        # เก็บ payload ไว้เลยตั้งแต่ตอนเข้าคิว ไม่ประกอบใหม่ตอนส่ง
        # เพราะยอดต้นทางอาจเปลี่ยนไปแล้ว เช่นเจ้าของแก้เรตหลังแขกเช็กเอาต์
        # ของที่ส่งต้องเป็นภาพ ณ ตอนที่เหตุการณ์เกิด ไม่ใช่ ณ ตอนที่ส่ง
        payload_json=json.dumps(event.envelope(0)["payload"], ensure_ascii=False),
        status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def collect(db: Session, business_date: date | None = None, vat_pct: int = 7) -> dict:
    """กวาดทุกอย่างที่ควรส่งของวันทำการนั้นเข้าคิว · เรียกซ้ำได้ปลอดภัย

    นี่คืองาน night audit — เรียกวันละครั้งตอนปิดยอด
    """
    day = business_date or clock.today()
    made = {"NA": 0, "DEP": 0, "STL": 0, "EXP": 0, "skipped": 0, "errors": []}

    def put(ev: Event) -> None:
        before = db.scalar(
            select(LedgerOutbox).where(LedgerOutbox.event_id == ev.event_id)
        )
        enqueue(db, ev)
        if before is None:
            made[ev.event_type] = made.get(ev.event_type, 0) + 1
        else:
            made["skipped"] += 1

    # รายได้ของคืนนั้น
    for ev in night_audit_events(db, day, vat_pct):
        put(ev)

    # เงินที่รับเข้ามาในวันนั้น
    for p in db.scalars(select(Payment)):
        if p.at.date() != day:
            continue
        try:
            put(payment_event(db, p, vat_pct))
        except EventError as e:
            made["errors"].append({"ref": p.ref, "detail": str(e)})

    # บิลที่ปิดในวันนั้น
    for f in db.scalars(select(Folio).where(Folio.status == "closed")):
        if f.closed_at is None or f.closed_at.date() != day:
            continue
        try:
            put(folio_close_event(db, f, vat_pct))
        except EventError as e:
            made["errors"].append({"folio": f.id, "detail": str(e)})

    # รายจ่ายที่ลงวันนั้น
    for x in db.scalars(select(Expense).where(Expense.at == day)):
        try:
            put(expense_event(x))
        except EventError as e:
            made["errors"].append({"ref": x.ref, "detail": str(e)})

    made["businessDate"] = day.isoformat()
    return made


# ── จัดลำดับให้สูงกว่าที่ปลายทางรับไปแล้ว ─────────────────────────────
def align_sequence(db: Session, watermark: int) -> int:
    """ดันลำดับของคิวให้สูงกว่า watermark ของปลายทาง · คืนจำนวนแถวที่ต้องออกเลขใหม่

    ทำไมต้องมี — กับดักที่เสียเวลาไปครึ่งวันกว่าจะเจอ
    -------------------------------------------------
    ปลายทางจำไว้ว่ารับถึงลำดับไหนแล้วต่อหนึ่ง `source` และ **ทิ้งของที่ลำดับ
    ต่ำกว่านั้นทันที** โดยรายงานกลับมาว่า `duplicates` ไม่ใช่ `skipped`
    ซึ่งหน้าตาเหมือนความสำเร็จทุกประการ — `202` ก็ได้ ไม่มี error ใด ๆ

    ฐานข้อมูลใหม่ของเราเริ่มนับที่ 1 เสมอ ถ้า `source` เดียวกันเคยถูกใช้มาก่อน
    (สคริปต์ตรวจของผู้ขายส่ง `seq` ที่มาจาก `Date.now()` ซึ่งดัน watermark
    ไปที่เก้าร้อยกว่าล้านทันที) ทุกอย่างที่เราส่งจะหายเงียบ ๆ ตลอดไป

    การออกเลขใหม่ปลอดภัยไหม — ปลอดภัย
    -----------------------------------
    `seq` เป็นแค่ตัวบอกลำดับและช่องว่างในชั้นขนส่ง **ไม่ใช่กุญแจกันบัญชีซ้ำ**
    ตัวที่กันบัญชีซ้ำคือ `eventId` ซึ่งบังคับด้วย unique index ตอน *ลงบัญชี*
    (พิสูจน์แล้วว่าชั้นรับข้อมูลไม่ได้กันด้วย eventId — ส่ง eventId เดิมด้วย
    seq ใหม่ ปลายทางตอบ `inserted: 1`) เปลี่ยน seq จึงไม่ทำให้เกิดบัญชีซ้ำ
    เพราะใบที่สองจะถูกปฏิเสธตอนลงบัญชีอยู่ดี
    """
    stale = list(db.scalars(
        select(LedgerOutbox)
        .where(LedgerOutbox.status != "sent", LedgerOutbox.seq <= watermark)
        .order_by(LedgerOutbox.seq)
    ))
    if not stale:
        return 0

    kept = [{
        "event_id": r.event_id, "event_type": r.event_type,
        "business_date": r.business_date, "payload_json": r.payload_json,
        "status": r.status, "attempts": r.attempts or 0,
        "response": r.response, "created_at": r.created_at,
    } for r in stale]
    for r in stale:
        db.delete(r)
    db.flush()

    _bump_sequence(db, watermark)
    for k in kept:
        db.add(LedgerOutbox(**k))
    db.commit()
    return len(kept)


def _bump_sequence(db: Session, above: int) -> None:
    """ตั้งตัวนับของตารางให้เริ่มนับต่อจาก `above`

    SQLite เก็บตัวนับของ AUTOINCREMENT ไว้ที่ตาราง `sqlite_sequence`
    PostgreSQL ใช้ SEQUENCE ซึ่งขยับด้วย `setval` — แยกตามชนิดฐานข้อมูล
    ที่ใช้จริง ไม่เดาว่าอันไหน
    """
    dialect = db.bind.dialect.name if db.bind is not None else ""
    if dialect == "sqlite":
        row = db.execute(
            text("SELECT seq FROM sqlite_sequence WHERE name='ledger_outbox'")
        ).first()
        if row is None:
            db.execute(text(
                "INSERT INTO sqlite_sequence(name, seq) VALUES('ledger_outbox', :v)"
            ), {"v": above})
        elif row[0] < above:
            db.execute(text(
                "UPDATE sqlite_sequence SET seq = :v WHERE name='ledger_outbox'"
            ), {"v": above})
    elif dialect == "postgresql":
        db.execute(text(
            "SELECT setval(pg_get_serial_sequence('ledger_outbox','seq'), :v)"
        ), {"v": above})
    else:
        raise LedgerError(
            f"ยังไม่รู้วิธีขยับตัวนับลำดับบนฐานข้อมูลชนิด {dialect!r} — "
            "ต้องเพิ่มก่อน ไม่งั้นของจะหายเงียบ ๆ ที่ watermark"
        )


# ── ชั้นส่ง ───────────────────────────────────────────────────────────
class LedgerClient:
    """ตัวส่งคิวออกไปยัง Ledger Bridge

    `dry_run=True` (ค่าเริ่มต้น) = ประกอบของและบันทึกไว้ **แต่ไม่ยิงออกจริง**
    ใช้ตรวจตัวเลขให้ครบก่อนต่อสายจริง · เปิดของจริงด้วย `LEDGER_DRY_RUN=0`
    """

    #: ส่งได้ไม่เกิน 500 รายการต่อคำขอตามสัญญาของปลายทาง
    #: ใช้ 200 เพื่อให้เหลือที่หายใจ และเวลาชุดหนึ่งพังจะเสียหายวงแคบกว่า
    BATCH = 200

    def __init__(
        self, base_url: str | None = None, token: str | None = None,
        source: str | None = None, dry_run: bool | None = None,
    ) -> None:
        self.base_url = base_url or os.environ.get("LEDGER_URL") or None
        self.token = token or os.environ.get("LEDGER_TOKEN", "")
        self.source = source or os.environ.get("LEDGER_SOURCE", "sentiara")
        env_dry = os.environ.get("LEDGER_DRY_RUN", "1") not in ("0", "false", "False")
        self.dry_run = env_dry if dry_run is None else dry_run
        self._bridge: LedgerBridge | None = None

    def bridge(self) -> LedgerBridge:
        """ต่อสายเมื่อต้องใช้จริงเท่านั้น

        `base_url` ว่าง = ให้ตัวเชื่อมไล่หาพอร์ตเอง (3111 ไม่ว่างจะเลื่อนไป 3112…)
        และยืนยันด้วยกุญแจว่าเจอตัวที่ถูก — สำคัญเมื่อเครื่องมี Ledger Bridge
        ของหลายกิจการเปิดพร้อมกัน
        """
        if self._bridge is None:
            self._bridge = LedgerBridge(
                base_url=self.base_url, token=self.token, source=self.source
            )
        return self._bridge

    def watermark(self) -> int:
        """ปลายทางรับถึงลำดับไหนแล้ว · ใช้ตอนกลับมาส่งต่อหลังรีสตาร์ต"""
        st = self.bridge().ingest_status()
        return int(st.get("watermark") or st.get("lastSeq") or 0)

    def send_pending(self, db: Session, limit: int | None = None) -> dict:
        """ส่งทุกอย่างในคิวที่ยังไม่เคยส่งสำเร็จ · เรียกซ้ำได้ปลอดภัย

        จัดลำดับให้สูงกว่า watermark ก่อนเสมอ ไม่งั้นของหายเงียบ ๆ (ดู align_sequence)
        """
        realigned = 0
        if not self.dry_run:
            realigned = align_sequence(db, self.watermark())

        rows = list(db.scalars(
            select(LedgerOutbox)
            .where(LedgerOutbox.status != "sent")
            .order_by(LedgerOutbox.seq)
            .limit(limit or self.BATCH)
        ))
        result = {"queued": len(rows), "sent": 0, "failed": 0,
                  "realigned": realigned, "dry_run": self.dry_run, "errors": []}
        if not rows:
            return result

        events = [{
            # seq มาจากคีย์ของแถวในคิว ไม่ได้คิดใหม่ตอนส่ง
            "seq": r.seq,
            "eventType": r.event_type,
            "businessDate": r.business_date.isoformat(),
            "payload": json.loads(r.payload_json),
        } for r in rows]

        if self.dry_run:
            detail, ok = "dry-run · ไม่ได้ส่งออกจริง", True
        else:
            try:
                out = self.bridge().send_events(events)
                detail = json.dumps(out, ensure_ascii=False)[:600]
                # ── ห้ามเชื่อแค่ว่า HTTP สำเร็จ ────────────────────────
                # `202` มาพร้อมกันทั้งตอนที่ของเข้าคิวจริง และตอนที่ของถูกทิ้ง
                # เพราะลำดับต่ำกว่า watermark — กรณีหลังรายงานเป็น `duplicates`
                # ซึ่งหน้าตาเหมือนความสำเร็จทุกประการ ต้องนับ `inserted` เอง
                inserted = int(out.get("inserted", 0))
                ok = inserted == len(rows)
                if not ok:
                    detail = (
                        f"ปลายทางรับเข้าคิวจริงแค่ {inserted} จาก {len(rows)} รายการ · "
                        f"ที่เหลือถูกทิ้งเพราะลำดับต่ำกว่าที่รับไปแล้ว — {detail}"
                    )
            except BridgeError as e:
                # อ่าน code เอาไปตัดสินใจ อ่าน message เอาไปแสดงให้คน
                detail = f"{e.status} {e.code} · {e.message}"
                if e.issues:
                    detail += " · " + json.dumps(e.issues, ensure_ascii=False)[:300]
                if not e.retryable:
                    detail += " · ข้อมูลผิด ลองใหม่ไปก็ได้ผลเดิม ต้องแก้ก่อน"
                ok = False

        now = clock.now()
        for r in rows:
            r.attempts = (r.attempts or 0) + 1
            r.status = "sent" if ok else "failed"
            r.response = detail[:600]
            if ok:
                r.sent_at = now
        db.commit()

        result["sent" if ok else "failed"] = len(rows)
        if not ok:
            result["errors"].append({"detail": detail})
        return result


def outbox_summary(db: Session) -> dict:
    """สรุปคิว · ใช้ดูว่ามีอะไรค้างส่งอยู่บ้าง"""
    rows = list(db.scalars(select(LedgerOutbox).order_by(LedgerOutbox.seq)))
    by_status: dict[str, int] = {}
    for r in rows:
        by_status[r.status] = by_status.get(r.status, 0) + 1
    return {
        "total": len(rows),
        "by_status": by_status,
        "max_seq": rows[-1].seq if rows else 0,
    }

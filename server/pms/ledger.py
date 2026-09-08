"""ส่งรายการเข้าระบบบัญชี (Ledger Bridge)

หน้าที่ของไฟล์นี้
------------------
แปลงสิ่งที่ PMS รู้ (บิลที่ปิดแล้ว · รายจ่าย) ให้เป็นรายการบัญชีคู่ที่ **ลงตัว**
แล้วส่งออกไปอย่างปลอดภัยจากการส่งซ้ำ

สามเรื่องที่ทำให้ตัวเลขบัญชีพังบ่อยที่สุด และวิธีที่ไฟล์นี้กันไว้
-----------------------------------------------------------------
1. **ส่งซ้ำ** — เน็ตหลุดกลางทางแล้วลองใหม่ ปลายทางลงสองครั้ง
   กัน: ทุกรายการมี `idem_key` ที่คงที่ (มาจาก id ของต้นทาง ไม่ใช่เวลา)
        และตาราง `ledger_post` มี UNIQUE บนคีย์นั้น — **ส่งซ้ำถูกปฏิเสธที่ฝั่งเรา
        ก่อนออกจากบ้านด้วยซ้ำ** ไม่ฝากความถูกต้องไว้กับปลายทางฝ่ายเดียว

2. **เดบิตไม่เท่าเครดิต** — ปัดเศษคนละทางแล้วต่างกัน 1 สตางค์
   กัน: คิดเป็นสตางค์จำนวนเต็มทั้งหมด และ `assert` ให้ลงตัวก่อนส่งเสมอ
        ถ้าไม่ลงตัวคือหยุด ไม่ใช่ส่งออกไปให้ฝ่ายบัญชีมาตามทีหลัง

3. **VAT ผิดทาง** — ราคาห้องเป็นราคารวมภาษีแล้ว ถ้าบวกเพิ่มอีกจะเก็บเกิน
   กัน: ใช้ `split_vat` ถอดออกจากยอดรวมเสมอ ตาม ม.86/4 (6)

ผังบัญชีที่ใช้ตั้งต้น
---------------------
ยังไม่รู้ผังบัญชีจริงของ Ledger Bridge จึงใช้ชื่อบัญชีกลาง ๆ ที่แมปทีหลังได้
ตั้งไว้ที่เดียวใน `ACCOUNTS` — เปลี่ยนตรงนี้ที่เดียวเมื่อได้ผังจริง
"""
from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from datetime import date, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from pms import clock
from pms.db import Expense, Folio, LedgerPost, TaxInvoice
from pms.folio import totals

#: ชื่อบัญชีตั้งต้น — แมปกับผังจริงของ Ledger Bridge เมื่อได้เอกสาร
ACCOUNTS = {
    "cash": "1010 เงินสดและเงินฝากธนาคาร",
    "ar": "1140 ลูกหนี้การค้า",
    "vat_output": "2130 ภาษีขาย",
    "rev_room": "4010 รายได้ค่าห้อง",
    "rev_fnb": "4020 รายได้อาหารและเครื่องดื่ม",
    "rev_service": "4030 รายได้บริการอื่น",
    "discount": "4090 ส่วนลดจ่าย",
    "ap": "2010 เจ้าหนี้การค้า",
    "exp": {
        "payroll": "5010 เงินเดือนและค่าแรง",
        "utility": "5020 ค่าสาธารณูปโภค",
        "supplies": "5030 วัสดุสิ้นเปลือง",
        "ota": "5040 ค่าคอมมิชชัน",
        "maintenance": "5050 ค่าซ่อมแซมและบำรุงรักษา",
        "marketing": "5060 ค่าโฆษณาและส่งเสริมการขาย",
        "finance": "5070 ดอกเบี้ยและค่าธรรมเนียม",
        "other": "5090 ค่าใช้จ่ายอื่น",
    },
}


class LedgerError(Exception):
    pass


@dataclass
class Line:
    account: str
    debit: int = 0
    credit: int = 0
    memo: str = ""


@dataclass
class JournalEntry:
    idem_key: str
    entry_date: str
    reference: str
    memo: str
    lines: list[Line] = field(default_factory=list)
    source_kind: str = ""
    source_id: int = 0

    @property
    def debit_total(self) -> int:
        return sum(l.debit for l in self.lines)

    @property
    def credit_total(self) -> int:
        return sum(l.credit for l in self.lines)

    @property
    def balanced(self) -> bool:
        return self.debit_total == self.credit_total

    def to_payload(self) -> dict:
        if not self.balanced:
            raise LedgerError(
                f"รายการไม่ลงตัว · เดบิต {self.debit_total} เครดิต {self.credit_total} "
                f"({self.reference}) — ห้ามส่งออก"
            )
        if not self.lines:
            raise LedgerError("รายการว่าง ไม่มีบรรทัดให้ลง")
        return {
            "idempotency_key": self.idem_key,
            "date": self.entry_date,
            "reference": self.reference,
            "memo": self.memo,
            "currency": "THB",
            # ส่งเป็นสตางค์พร้อมบอกหน่วยให้ชัด ปลายทางจะได้ไม่เดาว่าเป็นบาทหรือสตางค์
            "amount_unit": "satang",
            "lines": [asdict(l) for l in self.lines],
        }


# ── แปลงบิลที่ปิดแล้วเป็นรายการบัญชี ─────────────────────────────────
def entry_for_folio(db: Session, folio: Folio, vat_pct: int = 7) -> JournalEntry:
    if folio.status != "closed":
        raise LedgerError("ลงบัญชีได้เฉพาะบิลที่ปิดแล้ว")

    t = totals(db, folio)
    b = folio.booking
    inv = db.scalar(select(TaxInvoice).where(TaxInvoice.folio_id == folio.id))

    # ── ภาษีขาย ──────────────────────────────────────────────────────
    # ใบกำกับภาษีคือเอกสารตัวจริงที่ลูกค้าถือไปใช้และสรรพากรตรวจ
    # ภาษีขายในสมุดบัญชีจึงต้อง **เท่ากับบนใบกำกับภาษีเป๊ะ ๆ** ไม่ใช่คำนวณใหม่
    # แล้วหวังว่าจะตรง — ปัดเศษคนละจังหวะแล้วต่างกันสตางค์เดียวก็กระทบยอดไม่ลง
    from pms.money import split_vat
    if inv is not None:
        if inv.gross_satang != t.gross:
            raise LedgerError(
                f"ยอดบิลเปลี่ยนหลังออกใบกำกับภาษี {inv.number} · "
                f"ใบกำกับ {inv.gross_satang} แต่บิล {t.gross} สตางค์ — ห้ามลงบัญชี"
            )
        base_total, vat_total = inv.base_satang, inv.vat_satang
    else:
        v = split_vat(t.gross, vat_pct)
        base_total, vat_total = v.base, v.vat

    # ── กระจายฐานภาษีลงบัญชีรายได้ ───────────────────────────────────
    # ส่วนลด ณ จุดขาย **ลดฐานภาษีด้วย** ไม่ใช่ลดแค่รายได้ จึงถอด VAT ออกเหมือนกัน
    # (ถ้าเดบิตเต็มจำนวน ภาษีขายในสมุดจะมากกว่าบนใบกำกับเท่ากับ VAT ของส่วนลด)
    parts = [
        ("rev_room", t.room, "รายได้ค่าห้อง"),
        ("rev_fnb", t.fnb, "รายได้อาหารและเครื่องดื่ม"),
        ("rev_service", t.service, "รายได้บริการอื่น"),
        ("discount", t.discount, "ส่วนลด"),          # เก็บเป็นค่าติดลบอยู่แล้ว
    ]
    parts = [p for p in parts if p[1] != 0]
    bases = {k: split_vat(abs(g), vat_pct).base * (1 if g > 0 else -1)
             for k, g, _ in parts}

    # ปัดเศษทีละบัญชีแล้วรวมกัน อาจคลาดจากยอดตัวจริงไม่กี่สตางค์
    # โยนเศษเข้าบัญชีที่ยอดใหญ่ที่สุด — คลาดน้อยที่สุดและอธิบายที่มาได้
    residual = base_total - sum(bases.values())
    if residual and parts:
        bases[max(parts, key=lambda p: abs(p[1]))[0]] += residual

    lines: list[Line] = []
    for key, _g, memo in parts:
        amount = bases[key]
        if key == "discount":
            lines.append(Line(account=ACCOUNTS["discount"], debit=-amount, memo=memo))
        else:
            lines.append(Line(account=ACCOUNTS[key], credit=amount, memo=memo))

    if vat_total:
        lines.append(Line(account=ACCOUNTS["vat_output"], credit=vat_total,
                          memo=f"ภาษีขาย {vat_pct}%"))

    # ฝั่งเดบิต — เงินที่รับจริงเข้าเงินสด ส่วนที่ค้างเป็นลูกหนี้
    if t.paid:
        lines.append(Line(account=ACCOUNTS["cash"], debit=t.paid, memo="รับชำระ"))
    if t.balance:
        lines.append(Line(account=ACCOUNTS["ar"], debit=t.balance,
                          memo=f"ค้างชำระ · {b.guest_name}"))

    closed = folio.closed_at or clock.now()
    return JournalEntry(
        # คีย์มาจาก id ของบิล ไม่ใช่เวลา — ส่งกี่ครั้งคีย์ก็เท่าเดิม
        idem_key=f"folio:{folio.id}",
        entry_date=closed.date().isoformat(),
        reference=inv.number if inv else b.ref,
        memo=f"เช็กเอาต์ห้อง {b.room.no} · {b.guest_name}",
        lines=lines,
        source_kind="folio",
        source_id=folio.id,
    )


def entry_for_expense(db: Session, expense: Expense) -> JournalEntry:
    acct = ACCOUNTS["exp"].get(expense.category, ACCOUNTS["exp"]["other"])
    credit_acct = ACCOUNTS["cash"] if expense.paid else ACCOUNTS["ap"]
    return JournalEntry(
        idem_key=f"expense:{expense.id}",
        entry_date=expense.at.isoformat(),
        reference=f"EXP-{expense.id}",
        memo=expense.label,
        lines=[
            Line(account=acct, debit=expense.amount_satang, memo=expense.label),
            Line(account=credit_acct, credit=expense.amount_satang,
                 memo="จ่ายแล้ว" if expense.paid else "ค้างจ่าย"),
        ],
        source_kind="expense",
        source_id=expense.id,
    )


# ── ส่งออก ───────────────────────────────────────────────────────────
class LedgerClient:
    """ตัวส่งไป Ledger Bridge

    `dry_run=True` (ค่าเริ่มต้น) = เตรียมรายการและบันทึกไว้ **แต่ไม่ยิงออกจริง**
    ใช้ตรวจตัวเลขให้ครบก่อนต่อสายจริง
    """

    def __init__(
        self, base_url: str | None = None, api_key: str | None = None,
        dry_run: bool | None = None, timeout: float = 20.0,
    ) -> None:
        self.base_url = (base_url or os.environ.get("LEDGER_URL", "http://localhost:3111")).rstrip("/")
        self.api_key = api_key or os.environ.get("LEDGER_KEY", "")
        env_dry = os.environ.get("LEDGER_DRY_RUN", "1") not in ("0", "false", "False")
        self.dry_run = env_dry if dry_run is None else dry_run
        self.timeout = timeout

    def _post(self, payload: dict) -> tuple[bool, str]:
        if self.dry_run:
            return True, "dry-run · ไม่ได้ส่งออกจริง"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        try:
            r = httpx.post(f"{self.base_url}/journal-entries",
                           json=payload, headers=headers, timeout=self.timeout)
        except httpx.ConnectError:
            return False, f"ต่อ Ledger Bridge ที่ {self.base_url} ไม่ได้"
        except httpx.TimeoutException:
            return False, f"Ledger Bridge ไม่ตอบใน {self.timeout} วินาที"
        if r.status_code in (200, 201, 409):
            # 409 = ปลายทางบอกว่าเคยรับคีย์นี้แล้ว ถือว่าสำเร็จ ไม่ใช่ล้มเหลว
            return True, f"{r.status_code} {r.text[:180]}"
        return False, f"{r.status_code} {r.text[:180]}"

    def send(self, db: Session, entry: JournalEntry) -> LedgerPost:
        """ส่งหนึ่งรายการ · ส่งซ้ำคีย์เดิมจะถูกปฏิเสธที่นี่ ไม่ออกไปถึงปลายทาง"""
        existing = db.scalar(select(LedgerPost).where(LedgerPost.idem_key == entry.idem_key))
        if existing and existing.status == "sent":
            return existing

        payload = entry.to_payload()  # โยนถ้าไม่ลงตัว — กันไม่ให้ของเสียออกจากบ้าน
        post = existing or LedgerPost(
            idem_key=entry.idem_key,
            source_kind=entry.source_kind,
            source_id=entry.source_id,
            payload_json=json.dumps(payload, ensure_ascii=False),
        )
        post.payload_json = json.dumps(payload, ensure_ascii=False)
        # default=0 ของ SQLAlchemy ทำงานตอน INSERT ไม่ใช่ตอนสร้างวัตถุ
        # อ็อบเจกต์ใหม่จึงมี attempts เป็น None จนกว่าจะ commit
        post.attempts = (post.attempts or 0) + 1
        ok, detail = self._post(payload)
        post.status = "sent" if ok else "failed"
        post.response = detail[:600]
        if ok:
            post.sent_at = clock.now()
        if existing is None:
            db.add(post)
        db.commit()
        db.refresh(post)
        return post

    def send_pending(self, db: Session, vat_pct: int = 7) -> dict:
        """ส่งทุกอย่างที่ยังไม่เคยส่งสำเร็จ · เรียกซ้ำได้ปลอดภัย"""
        sent_keys = set(db.scalars(
            select(LedgerPost.idem_key).where(LedgerPost.status == "sent")
        ))
        result = {"sent": 0, "failed": 0, "skipped": 0, "errors": []}

        for folio in db.scalars(select(Folio).where(Folio.status == "closed")):
            key = f"folio:{folio.id}"
            if key in sent_keys:
                result["skipped"] += 1
                continue
            try:
                p = self.send(db, entry_for_folio(db, folio, vat_pct))
                result["sent" if p.status == "sent" else "failed"] += 1
                if p.status != "sent":
                    result["errors"].append({"key": key, "detail": p.response})
            except LedgerError as e:
                result["failed"] += 1
                result["errors"].append({"key": key, "detail": str(e)})

        for exp in db.scalars(select(Expense)):
            key = f"expense:{exp.id}"
            if key in sent_keys:
                result["skipped"] += 1
                continue
            try:
                p = self.send(db, entry_for_expense(db, exp))
                result["sent" if p.status == "sent" else "failed"] += 1
                if p.status != "sent":
                    result["errors"].append({"key": key, "detail": p.response})
            except LedgerError as e:
                result["failed"] += 1
                result["errors"].append({"key": key, "detail": str(e)})

        result["dry_run"] = self.dry_run
        return result

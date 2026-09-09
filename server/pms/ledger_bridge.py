"""
ledger_bridge.py — ตัวเชื่อมขั้นต่ำที่ใช้งานได้จริง ไม่ต้องลงไลบรารีอะไรเพิ่ม

ก๊อปไฟล์นี้เข้าโปรเจ็คได้เลย · ใช้ urllib ของ Python เอง ไม่ต้องมี requests

── สิ่งที่ไฟล์นี้ตั้งใจกันไว้ให้ ────────────────────────────────────────────
1. เงินเป็นสตริงเสมอ · มีตัวช่วยแปลงจากสตางค์จำนวนเต็ม
   ห้ามคำนวณเงินด้วย float เด็ดขาด — 0.1 + 0.2 ไม่เท่ากับ 0.3 และผิดสะสม

2. วันที่ใช้เวลาเครื่อง ไม่ใช่ UTC
   datetime.utcnow() ให้วันที่เร็วกว่าไทยเจ็ดชั่วโมง · งานที่รันตอนตีสอง
   จะได้วันที่เป็นเมื่อวานทั้งที่ตั้งใจเป็นวันนี้

3. ข้อผิดพลาดโยนออกมาพร้อมรหัส ไม่ใช่แค่ข้อความ
   เพราะคุณต้องแยกให้ออกระหว่าง "ลองใหม่ได้" กับ "ต้องแก้ข้อมูลก่อน"
"""
from __future__ import annotations

import sys

# หน้าต่างคำสั่งของวินโดวส์ไทยใช้โค้ดเพจ 874 ซึ่งพิมพ์เครื่องหมายถูกและจุดกลางไม่ได้
# ถ้าไม่ตั้งบรรทัดนี้ สคริปต์จะพังตอน print ทั้งที่งานสำเร็จไปแล้ว
# ซึ่งชวนให้เข้าใจผิดว่าส่งข้อมูลไม่ผ่าน
#
# ── แก้จากต้นฉบับของ Ledger Bridge หนึ่งจุด ──────────────────────────
# ต้นฉบับเรียกบรรทัดนี้ตรง ๆ ตอน import ซึ่งใช้ได้เมื่อรันเป็นสคริปต์
# แต่ในเซิร์ฟเวอร์ stdout ถูกแทนที่ (pytest ดักไว้ · uvicorn เปลี่ยนเส้นทาง log)
# ด้วยวัตถุที่ไม่มีเมท็อดนี้ แล้ว import ทั้งโมดูลจะพังตั้งแต่ยังไม่ได้ทำอะไร
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

import json
import urllib.error
import urllib.request
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from http.cookiejar import CookieJar
from typing import Any


class LedgerError(Exception):
    """ความผิดพลาดจาก Ledger Bridge พร้อมรหัสสถานะและรหัสเหตุผล"""

    def __init__(self, status: int, code: str, message: str, detail: str | None = None,
                 issues: list[dict[str, Any]] | None = None) -> None:
        super().__init__(f"{status} {code}: {message}")
        self.status = status
        self.code = code
        self.message = message
        self.detail = detail
        self.issues = issues or []

    @property
    def retryable(self) -> bool:
        """
        ลองใหม่ได้ไหม

        5xx และ 429 คือฝั่งเราหรือจังหวะไม่ดี · ลองใหม่ได้
        4xx ที่เหลือคือข้อมูลผิด ลองกี่ครั้งก็ได้ผลเดิม อย่าวนลูป
        """
        return self.status >= 500 or self.status == 429


def money(satang: int) -> str:
    """
    แปลงสตางค์จำนวนเต็มเป็นสตริงจำนวนเงิน

        money(550000) == "5500.00"

    เก็บเงินเป็น int สตางค์ตลอดทางในโค้ดของคุณ แล้วแปลงตอนจะส่งเท่านั้น
    """
    if not isinstance(satang, int):
        raise TypeError("ต้องเป็นจำนวนเต็มหน่วยสตางค์ ไม่ใช่ float — float ทำเงินเพี้ยน")
    sign = "-" if satang < 0 else ""
    n = abs(satang)
    return f"{sign}{n // 100}.{n % 100:02d}"


def money_from_decimal(value: Decimal) -> str:
    """ถ้าฝั่งคุณใช้ Decimal อยู่แล้ว ใช้ตัวนี้ · ปัดครึ่งขึ้นแบบเดียวกับบัญชีไทย"""
    q = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{q:f}"


def today() -> str:
    """
    วันที่วันนี้ตามนาฬิกาเครื่อง

    อย่าใช้ datetime.utcnow().date() — ไทยเร็วกว่า UTC เจ็ดชั่วโมง
    ระหว่างเที่ยงคืนถึงเจ็ดโมงเช้าจะได้วันที่ผิดไปหนึ่งวัน
    """
    return date.today().isoformat()


def find_base_url(token: str | None = None, timeout: float = 3.0,
                  first_port: int = 3111, span: int = 10) -> str:
    """
    ไล่หาพอร์ตที่ Ledger Bridge เปิดอยู่

    ถ้าให้ token มาด้วย จะยืนยันว่าเป็นตัวที่รับกุญแจดอกนั้นจริง —
    สำคัญเมื่อเครื่องมี Ledger Bridge ของหลายกิจการเปิดพร้อมกัน
    """
    seen: list[str] = []
    for port in range(first_port, first_port + span):
        url = f"http://127.0.0.1:{port}"
        try:
            req = urllib.request.Request(url + "/v1/health")
            with urllib.request.urlopen(req, timeout=timeout) as res:
                if json.loads(res.read()).get("app") != "ledger-bridge":
                    continue
        except Exception:
            continue
        seen.append(url)
        if not token:
            return url
        try:
            req = urllib.request.Request(
                url + "/v1/ingest/status",
                headers={"authorization": f"Bearer {token}"})
            with urllib.request.urlopen(req, timeout=timeout):
                return url
        except Exception:
            continue
    if seen:
        raise LedgerError(
            0, "WRONG_INSTANCE",
            "เจอ Ledger Bridge ที่ " + ", ".join(seen) +
            " แต่ไม่มีตัวไหนรับกุญแจนี้ — น่าจะเป็นของกิจการอื่นที่เปิดค้างอยู่")
    raise LedgerError(
        0, "NOT_RUNNING",
        f"ไม่เจอ Ledger Bridge ที่พอร์ต {first_port}-{first_port + span - 1} — เปิดโปรแกรมทิ้งไว้หรือยัง")


class LedgerBridge:
    """
    ตัวเชื่อมเดียว ใช้ได้ทั้งสองทาง

      · กุญแจเครื่องจักร (token)  → ส่งเหตุการณ์เข้ามาให้ระบบลงบัญชีให้
      · บัญชีผู้ใช้ (email + password) → อ่านรายงาน ลงใบสำคัญเอง

    เลือกใส่อย่างใดอย่างหนึ่ง หรือทั้งคู่ก็ได้
    """

    def __init__(self, base_url: str | None = None,
                 token: str | None = None, source: str | None = None,
                 email: str | None = None, password: str | None = None,
                 timeout: float = 20.0) -> None:
        """
        base_url = None แปลว่าให้หาพอร์ตเอง (แนะนำ)

        อย่าฝัง 3111 ไว้ในโค้ด · โปรแกรมเลื่อนพอร์ตเองถ้า 3111 ไม่ว่าง
        และเครื่องที่มี Ledger Bridge ของกิจการอื่นเปิดอยู่ ตัวที่คุณต้องการ
        จะไปอยู่พอร์ตถัดไป · ถ้ายิงผิดตัว อาการที่เห็นคือ 401 กุญแจไม่ถูกต้อง
        ซึ่งชวนให้ไปแก้ผิดที่ทั้งวัน
        """
        self.base = base_url.rstrip("/") if base_url else find_base_url(token, timeout)
        self.token = token
        self.source = source
        self.email = email
        self.password = password
        self.timeout = timeout
        self._jar = CookieJar()
        self._opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self._jar))
        self._logged_in = False

    # ── ชั้นล่างสุด ────────────────────────────────────────────────────
    def _call(self, method: str, path: str, body: Any = None,
              use_token: bool = False) -> Any:
        data = None
        headers = {"accept": "application/json"}
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            headers["content-type"] = "application/json"
        if use_token:
            if not self.token:
                raise LedgerError(0, "NO_TOKEN", "ยังไม่ได้ตั้งกุญแจเครื่องจักร")
            headers["authorization"] = f"Bearer {self.token}"

        req = urllib.request.Request(self.base + path, data=data,
                                     headers=headers, method=method)
        try:
            with self._opener.open(req, timeout=self.timeout) as res:
                raw = res.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", errors="replace")
            try:
                j = json.loads(raw)
            except json.JSONDecodeError:
                j = {}
            raise LedgerError(
                e.code, j.get("code", "UNKNOWN"),
                j.get("message", raw[:200]), j.get("detail"), j.get("issues"),
            ) from None
        except urllib.error.URLError as e:
            # ต่อไม่ติดเลย — ส่วนใหญ่คือยังไม่ได้เปิดโปรแกรม
            raise LedgerError(
                0, "NOT_RUNNING",
                "ต่อ Ledger Bridge ไม่ได้ — เปิดโปรแกรมทิ้งไว้หรือยัง",
                str(e.reason),
            ) from None

    def _ensure_login(self) -> None:
        if self._logged_in:
            return
        if not (self.email and self.password):
            raise LedgerError(0, "NO_USER", "เส้นทางนี้ต้องใช้บัญชีผู้ใช้ ไม่ใช่กุญแจเครื่องจักร")
        self._call("POST", "/v1/auth/login",
                   {"email": self.email, "password": self.password})
        self._logged_in = True

    # ── ตรวจสภาพ ──────────────────────────────────────────────────────
    def health(self) -> dict[str, Any]:
        """เรียกก่อนเสมอ · ยืนยันว่าที่ตอบอยู่ตรงพอร์ตนี้คือ Ledger Bridge จริง"""
        h = self._call("GET", "/v1/health")
        if h.get("app") != "ledger-bridge":
            raise LedgerError(0, "WRONG_APP",
                              "พอร์ตนี้มีโปรแกรมอื่นตอบอยู่ ไม่ใช่ Ledger Bridge")
        return h

    # ── ทางที่ 1 · ส่งเหตุการณ์ด้วยกุญแจเครื่องจักร ──────────────────
    def send_events(self, events: list[dict[str, Any]]) -> dict[str, Any]:
        """
        ส่งเหตุการณ์เข้ามาให้ระบบลงบัญชีตามกฎที่ตั้งไว้

        แต่ละรายการต้องมี seq (เพิ่มขึ้นเรื่อย ๆ ไม่ซ้ำ) eventType businessDate
        และ payload ที่มี eventId คงที่ต่อหนึ่งเหตุการณ์

        eventId ที่คงที่คือสิ่งที่ทำให้ส่งซ้ำได้อย่างปลอดภัย — ฐานข้อมูลกันซ้ำให้เอง
        เน็ตหลุดแล้วไม่รู้ว่าถึงหรือยัง ส่งซ้ำได้เลย
        """
        if not 1 <= len(events) <= 500:
            raise ValueError("ส่งได้ครั้งละ 1–500 รายการ")
        body: dict[str, Any] = {"events": events}
        if self.source:
            body["source"] = self.source
        return self._call("POST", "/v1/ingest/events", body, use_token=True)

    def ingest_status(self) -> dict[str, Any]:
        """เช็คว่ากุญแจยังใช้ได้ และระบบรับถึงลำดับไหนแล้ว"""
        return self._call("GET", "/v1/ingest/status", use_token=True)

    # ── ทางที่ 2 · ทำงานในฐานะผู้ใช้ ──────────────────────────────────
    def accounts(self, postable_only: bool = True) -> list[dict[str, Any]]:
        """
        ผังบัญชี · อย่าเดารหัสบัญชีเอง แต่ละกิจการไม่เหมือนกัน

        เรียกตัวนี้แล้วจับคู่เก็บไว้ตอนตั้งค่า ไม่ใช่ฝังรหัสไว้ในโค้ด
        """
        self._ensure_login()
        q = "?postableOnly=1" if postable_only else ""
        return self._call("GET", f"/v1/accounts{q}")["accounts"]

    def periods(self) -> list[dict[str, Any]]:
        """งวดบัญชีและสถานะเปิด/ปิด · ลงได้เฉพาะงวดที่เปิดอยู่"""
        self._ensure_login()
        out = self._call("GET", "/v1/periods")
        return out.get("periods", out)

    def open_period_for(self, business_date: str) -> dict[str, Any] | None:
        """หางวดที่ครอบวันนี้และยังเปิดอยู่ · คืน None ถ้าไม่มี"""
        for p in self.periods():
            if p["starts_on"] <= business_date <= p["ends_on"] and p["state"] == "open":
                return p
        return None

    def post_entry(self, journal_code: str, entry_no: str, business_date: str,
                   lines: list[dict[str, str]], memo: str | None = None) -> dict[str, Any]:
        """
        ลงใบสำคัญเอง (ไม่ผ่านกฎลงบัญชี)

        journal_code มีแค่ห้าเล่ม: 00 ทั่วไป · 01 จ่าย · 02 รับ · 03 ขาย · 04 ซื้อ
        แต่ละบรรทัดเป็น {"accountCode": "1111-00", "side": "D", "amount": "5500.00"}
        เดบิตรวมต้องเท่ากับเครดิตรวมพอดี มิฉะนั้นได้ 422
        """
        self._ensure_login()
        body: dict[str, Any] = {
            "journalCode": journal_code,
            "entryNo": entry_no,
            "businessDate": business_date,
            "lines": lines,
        }
        if memo:
            body["memo"] = memo
        return self._call("POST", "/v1/entries", body)

    def trial_balance(self, fy: int, seq: int) -> dict[str, Any]:
        """งบทดลอง · ใช้เทียบยอดกับฝั่งคุณตอนกระทบยอดสิ้นเดือน"""
        self._ensure_login()
        return self._call("GET", f"/v1/reports/trial-balance?fy={fy}&seq={seq}")

    def daily_revenue(self, day: str) -> dict[str, Any]:
        """รายได้รายวันแยกตามแหล่ง"""
        self._ensure_login()
        return self._call("GET", f"/v1/reports/daily-revenue?date={day}")


# ── ลองรันไฟล์นี้ตรง ๆ เพื่อดูว่าต่อติดไหม ──────────────────────────────
if __name__ == "__main__":
    import sys

    lb = LedgerBridge()
    try:
        print("โปรแกรม:", lb.health())
    except LedgerError as e:
        print("ต่อไม่ได้:", e.message)
        sys.exit(1)
    print("ใช้ ตรวจก่อนเริ่ม.mjs เพื่อตรวจให้ครบทุกชั้น")

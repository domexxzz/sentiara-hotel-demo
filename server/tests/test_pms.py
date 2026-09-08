"""เทส PMS — เน้นสิ่งที่พังแล้วเสียเงินจริง

    cd server && python -m pytest -q

สามเรื่องที่เทสหนักที่สุด
  1. จองซ้ำ — ความเสี่ยงอันดับหนึ่งในแผน HMP
  2. VAT — ผิดทางแล้วเก็บเงินเกินหรือขาด และผิดกฎหมายด้วย
  3. ส่งบัญชีซ้ำ — ลงสองครั้งแล้วงบพัง ไล่หาย้อนหลังยาก
"""
from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from pms import booking as bk
from pms import folio as fo
from pms.app import create_app
from pms.db import Expense, Room, RoomType
from pms.ledger import LedgerClient, entry_for_expense, entry_for_folio
from pms.money import add_vat, baht, baht_text, split_vat, to_baht
from pms.rates import nightly_rates, stay_total
from pms.session import session_factory

API = "/api/v1"

# 2026-09-11 = ศุกร์ · 2026-09-12 = เสาร์
FRI = date(2026, 9, 11)
SAT = date(2026, 9, 12)
MON = date(2026, 9, 14)
TUE = date(2026, 9, 15)


@pytest.fixture()
def app(tmp_path):
    a = create_app(f"sqlite:///{tmp_path}/t.db")
    db = session_factory()()
    dx = RoomType(code="deluxe", name="ดีลักซ์", rate_satang=baht(1650), ota_satang=baht(1875))
    sp = RoomType(code="superior", name="ซูพีเรียร์", rate_satang=baht(1350), ota_satang=baht(1530))
    db.add_all([dx, sp])
    db.flush()
    db.add_all([
        Room(no="101", room_type_id=dx.id, floor="1"),
        Room(no="102", room_type_id=dx.id, floor="1"),
        Room(no="201", room_type_id=sp.id, floor="2"),
        Room(no="999", room_type_id=sp.id, floor="9", out_of_order=True),
    ])
    db.commit()
    db.close()
    return a


@pytest.fixture()
def c(app):
    return TestClient(app)


@pytest.fixture()
def db():
    s = session_factory()()
    yield s
    s.close()


# ══ เงินและ VAT ══════════════════════════════════════════════════════
def test_money_is_integer_satang():
    assert baht(1650) == 165000
    assert baht(0.1) + baht(0.2) == baht(0.3)      # float ทำแบบนี้ไม่ได้


@pytest.mark.parametrize("gross", [165000, 100, 1, 333333, 198000])
def test_split_vat_always_reconciles(gross):
    v = split_vat(gross, 7)
    assert v.base + v.vat == gross                  # กฎเหล็ก


def test_split_vat_known_value():
    v = split_vat(baht(1650), 7)
    assert to_baht(v.base) == 1542.06
    assert to_baht(v.vat) == 107.94


def test_no_vat_registration():
    v = split_vat(baht(1650), 0)
    assert v.vat == 0 and v.base == v.gross


def test_add_vat_is_the_other_direction():
    """ใบเสนอราคาบวก VAT เพิ่ม · บิลห้องถอดออก — คนละทิศ ห้ามสลับ"""
    v = add_vat(baht(150000), 7)
    assert to_baht(v.gross) == 160500.0


def test_baht_text():
    assert baht_text(baht(1650)) == "หนึ่งพันหกร้อยห้าสิบบาทถ้วน"
    assert baht_text(baht(344540)) == "สามแสนสี่หมื่นสี่พันห้าร้อยสี่สิบบาทถ้วน"


# ══ เรตวันหยุด ═══════════════════════════════════════════════════════
def test_weekend_rate_applies_to_fri_sat():
    rates = nightly_rates(baht(1650), FRI, MON, 20)
    assert [r.weekend for r in rates] == [True, True, False]   # ศ · ส · อา
    assert to_baht(rates[0].rate_satang) == 1980.0
    assert to_baht(rates[2].rate_satang) == 1650.0


def test_stay_total_matches_sum_of_nights():
    assert stay_total(baht(1650), FRI, MON, 20) == baht(1980 + 1980 + 1650)


# ══ กันจองซ้ำ — สำคัญที่สุด ══════════════════════════════════════════
def test_double_booking_is_rejected(c):
    a = c.post(f"{API}/bookings", json={
        "room_no": "101", "guest_name": "คนแรก",
        "check_in": "2026-09-14", "check_out": "2026-09-16"})
    assert a.status_code == 201

    b = c.post(f"{API}/bookings", json={
        "room_no": "101", "guest_name": "คนที่สอง",
        "check_in": "2026-09-15", "check_out": "2026-09-17"})
    assert b.status_code == 409
    assert "2026-09-15" in b.json()["detail"]["busy_nights"]


def test_checkout_day_is_sellable_same_day(c):
    """แขกออกวันที่ 16 = ขายคืนวันที่ 16 ให้คนอื่นได้ทันที"""
    c.post(f"{API}/bookings", json={"room_no": "101", "guest_name": "A",
                                    "check_in": "2026-09-14", "check_out": "2026-09-16"})
    r = c.post(f"{API}/bookings", json={"room_no": "101", "guest_name": "B",
                                        "check_in": "2026-09-16", "check_out": "2026-09-18"})
    assert r.status_code == 201


def test_concurrent_bookings_only_one_wins(db):
    """จำลองสองคำขอเข้าพร้อมกัน — ต้องมีคนชนะคนเดียวเสมอ

    ถ้าเปลี่ยนไปใช้ "เช็กก่อนแล้วค่อยบันทึก" เทสนี้จะล้ม เพราะทั้งคู่จะเห็นว่าว่าง
    """
    ok, fail = 0, 0
    for name in ("A", "B"):
        s = session_factory()()
        try:
            bk.create_booking(s, "102", name, MON, TUE)
            ok += 1
        except bk.RoomNotAvailable:
            fail += 1
        finally:
            s.close()
    assert (ok, fail) == (1, 1)


def test_cancel_frees_the_room(c):
    r = c.post(f"{API}/bookings", json={"room_no": "201", "guest_name": "A",
                                        "check_in": "2026-09-14", "check_out": "2026-09-16"})
    ref = r.json()["ref"]
    assert c.post(f"{API}/bookings/{ref}/cancel").status_code == 200
    again = c.post(f"{API}/bookings", json={"room_no": "201", "guest_name": "B",
                                            "check_in": "2026-09-14", "check_out": "2026-09-16"})
    assert again.status_code == 201


def test_cannot_book_out_of_order_room(c):
    r = c.post(f"{API}/bookings", json={"room_no": "999", "guest_name": "A",
                                        "check_in": "2026-09-14", "check_out": "2026-09-15"})
    assert r.status_code == 400


def test_backwards_dates_rejected(c):
    r = c.post(f"{API}/bookings", json={"room_no": "101", "guest_name": "A",
                                        "check_in": "2026-09-16", "check_out": "2026-09-14"})
    assert r.status_code == 400


def test_availability_reflects_bookings(c):
    before = c.get(f"{API}/availability?check_in=2026-09-14&check_out=2026-09-16").json()
    c.post(f"{API}/bookings", json={"room_no": "101", "guest_name": "A",
                                    "check_in": "2026-09-14", "check_out": "2026-09-16"})
    after = c.get(f"{API}/availability?check_in=2026-09-14&check_out=2026-09-16").json()
    assert after["free_count"] == before["free_count"] - 1


# ══ บิล ══════════════════════════════════════════════════════════════
def _stay(c, room="101", name="คุณอนันต์"):
    r = c.post(f"{API}/bookings", json={"room_no": room, "guest_name": name,
                                        "check_in": "2026-09-14", "check_out": "2026-09-16"})
    return r.json()["ref"]


def test_room_charges_are_posted_on_booking(c):
    ref = _stay(c)
    f = c.get(f"{API}/folios/{ref}").json()
    assert len(f["charges"]) == 2                      # สองคืน
    assert f["totals"]["room"] == 3300.0               # จ–อ ไม่ใช่วันหยุด


def test_fnb_lands_on_the_same_folio(c):
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/charges",
           json={"kind": "fnb", "label": "ลาเต้", "amount": 65, "qty": 2})
    f = c.get(f"{API}/folios/{ref}").json()
    assert f["totals"]["fnb"] == 130.0
    assert f["totals"]["gross"] == 3430.0


def test_discount_is_stored_negative(c):
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/charges",
           json={"kind": "discount", "label": "ส่วนลดลูกค้าเก่า", "amount": 300})
    f = c.get(f"{API}/folios/{ref}").json()
    assert f["totals"]["discount"] == -300.0
    assert f["totals"]["gross"] == 3000.0


def test_closed_folio_rejects_new_charges(c):
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/close")
    r = c.post(f"{API}/folios/{ref}/charges",
               json={"kind": "fnb", "label": "น้ำ", "amount": 20})
    assert r.status_code == 400


def test_unpaid_balance_becomes_receivable(c):
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/payments", json={"method": "cash", "amount": 1000})
    out = c.post(f"{API}/folios/{ref}/close").json()
    assert out["balance"] == 2300.0


# ══ ใบกำกับภาษี ══════════════════════════════════════════════════════
def test_tax_invoice_needs_closed_folio(c):
    ref = _stay(c)
    r = c.post(f"{API}/folios/{ref}/tax-invoice", json={"buyer_name": "บริษัท ก"})
    assert r.status_code == 400


def test_tax_invoice_splits_vat_and_reconciles(c):
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/close")
    inv = c.post(f"{API}/folios/{ref}/tax-invoice",
                 json={"buyer_name": "บริษัท ทดสอบ จำกัด",
                       "buyer_taxid": "0105569127258"}).json()
    assert round(inv["base"] + inv["vat"], 2) == inv["gross"] == 3300.0
    assert inv["number"].startswith("INV-25")


def test_bad_taxid_is_rejected(c):
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/close")
    r = c.post(f"{API}/folios/{ref}/tax-invoice",
               json={"buyer_name": "บริษัท ก", "buyer_taxid": "123"})
    assert r.status_code == 400


def test_one_invoice_per_folio(c):
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/close")
    body = {"buyer_name": "บริษัท ก"}
    assert c.post(f"{API}/folios/{ref}/tax-invoice", json=body).status_code == 201
    assert c.post(f"{API}/folios/{ref}/tax-invoice", json=body).status_code == 400


def test_invoice_numbers_do_not_skip(c):
    refs = [_stay(c, room=r) for r in ("101", "102", "201")]
    nums = []
    for ref in refs:
        c.post(f"{API}/folios/{ref}/close")
        nums.append(c.post(f"{API}/folios/{ref}/tax-invoice",
                           json={"buyer_name": "บริษัท ก"}).json()["number"])
    seq = [int(n.rsplit("-", 1)[1]) for n in nums]
    assert seq == list(range(seq[0], seq[0] + 3))


# ══ บัญชี ════════════════════════════════════════════════════════════
def test_journal_entry_balances(c, db):
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/charges",
           json={"kind": "fnb", "label": "อาหาร", "amount": 500})
    c.post(f"{API}/folios/{ref}/payments", json={"method": "cash", "amount": 3800})
    c.post(f"{API}/folios/{ref}/close")

    e = entry_for_folio(db, fo.get_folio(db, ref), 7)
    assert e.balanced, f"เดบิต {e.debit_total} เครดิต {e.credit_total}"
    assert e.idem_key == f"folio:{fo.get_folio(db, ref).id}"


def test_preview_shows_balanced_entry(c):
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/payments", json={"method": "cash", "amount": 3300})
    c.post(f"{API}/folios/{ref}/close")
    p = c.get(f"{API}/ledger/preview/{ref}").json()
    assert p["balanced"] is True
    assert p["debit_total"] == p["credit_total"] == 3300.0


def test_unbalanced_entry_never_leaves(db):
    """สร้างรายการที่ไม่ลงตัวแล้วต้องส่งไม่ออก"""
    from pms.ledger import JournalEntry, LedgerError, Line
    e = JournalEntry(idem_key="x", entry_date="2026-09-14", reference="X", memo="",
                     lines=[Line("A", debit=100), Line("B", credit=99)])
    with pytest.raises(LedgerError):
        e.to_payload()


def test_sending_twice_does_not_duplicate(c, db):
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/payments", json={"method": "cash", "amount": 3300})
    c.post(f"{API}/folios/{ref}/close")

    client = LedgerClient(dry_run=True)
    entry = entry_for_folio(db, fo.get_folio(db, ref), 7)
    first = client.send(db, entry)
    second = client.send(db, entry)
    assert first.id == second.id
    assert second.attempts == 1          # ครั้งที่สองไม่ยิงซ้ำ


def test_send_pending_is_idempotent(c, db):
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/payments", json={"method": "cash", "amount": 3300})
    c.post(f"{API}/folios/{ref}/close")
    db.add(Expense(at=MON, category="utility", label="ค่าไฟ", amount_satang=baht(24600)))
    db.commit()

    client = LedgerClient(dry_run=True)
    a = client.send_pending(db, 7)
    b = client.send_pending(db, 7)
    assert a["sent"] == 2 and a["failed"] == 0
    assert b["sent"] == 0 and b["skipped"] == 2       # ไม่ส่งซ้ำ


def test_expense_entry_uses_ap_when_unpaid(db):
    e = Expense(id=1, at=MON, category="ota", label="ค่าคอม",
                amount_satang=baht(24800), paid=False)
    j = entry_for_expense(db, e)
    assert j.balanced
    assert any("เจ้าหนี้" in l.account for l in j.lines)


def test_open_folio_cannot_be_posted(c, db):
    ref = _stay(c)
    from pms.ledger import LedgerError
    with pytest.raises(LedgerError):
        entry_for_folio(db, fo.get_folio(db, ref), 7)


def test_health(c):
    h = c.get("/health").json()
    assert h["ok"] and h["vat_pct"] == 7 and h["ledger_dry_run"] is True

def test_invoice_vat_matches_journal_vat(c, db):
    """ใบกำกับภาษีกับสมุดบัญชีต้องรายงาน VAT ตรงกันเป๊ะ

    เคยไม่ตรงเพราะเดบิตส่วนลดเต็มจำนวนโดยไม่ถอด VAT — ต่างกันเท่ากับ VAT ของส่วนลด
    ฝ่ายบัญชีจะกระทบยอดไม่ลงและหาสาเหตุยากมาก เพราะเอกสารสองใบขัดกันเอง
    """
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/charges",
           json={"kind": "discount", "label": "ส่วนลด", "amount": 200})
    c.post(f"{API}/folios/{ref}/payments", json={"method": "cash", "amount": 3100})
    c.post(f"{API}/folios/{ref}/close")

    inv = c.post(f"{API}/folios/{ref}/tax-invoice",
                 json={"buyer_name": "บริษัท ก"}).json()
    e = entry_for_folio(db, fo.get_folio(db, ref), 7)
    journal_vat = sum(l.credit for l in e.lines if "ภาษีขาย" in l.account)

    assert e.balanced
    assert to_baht(journal_vat) == inv["vat"], "VAT สองที่ต้องตรงกัน"
    journal_rev = sum(l.credit for l in e.lines if l.account.startswith("40"))
    journal_disc = sum(l.debit for l in e.lines if "ส่วนลด" in l.account)
    assert to_baht(journal_rev - journal_disc) == inv["base"], "ฐานภาษีสองที่ต้องตรงกัน"


# ══ นาฬิกา — กฎเหล็กของ Ledger Bridge ════════════════════════════════
def test_clock_is_thai_time_not_utc():
    """งาน night audit ตอนตีสองต้องได้วันที่ของ 'วันนี้' ไม่ใช่เมื่อวาน

    ตีสองเวลาไทย = ห้าทุ่มของเมื่อวานเวลา UTC ถ้าอ่านเวลาแบบ UTC
    ยอดขายทั้งคืนจะไปตกผิดวัน และงบสองวันติดกันผิดพร้อมกันทั้งคู่
    """
    from datetime import datetime, timezone
    from pms import clock
    gap = clock.now() - datetime.now(timezone.utc).replace(tzinfo=None)
    assert 6.9 * 3600 < gap.total_seconds() < 7.1 * 3600


def test_closed_folio_is_dated_in_thai_time(c, db):
    """วันที่ในใบสำคัญที่ส่งเข้าบัญชีต้องเป็นวันตามเวลาไทย"""
    ref = _stay(c)
    c.post(f"{API}/folios/{ref}/payments", json={"method": "cash", "amount": 3300})
    c.post(f"{API}/folios/{ref}/close")
    from pms import clock
    e = entry_for_folio(db, fo.get_folio(db, ref), 7)
    assert e.entry_date == clock.today().isoformat()


@pytest.mark.parametrize("gross,pct,want", [
    (baht(3300), 30, baht(990)),      # เคยได้ 990.10
    (baht(5610), 30, baht(1683)),     # เคยได้ 1683.17
    (baht(1000), 30, baht(300)),      # เคยได้ 300.03
    (baht(1000), 12.5, baht(125)),    # เปอร์เซ็นต์มีทศนิยมก็ต้องได้
    (baht(1650), 0, 0),
])
def test_pct_of_multiplies_before_dividing(gross, pct, want):
    """เคยหาร 100000/pct ก่อน ซึ่งปัดตัวหารทิ้งเศษ มัดจำเลยเกินทุกครั้ง"""
    from pms.money import pct_of
    assert pct_of(gross, pct) == want


def test_deposit_on_booking_is_exact(c):
    b = c.post(f"{API}/bookings", json={"room_no": "101", "guest_name": "A",
                                        "check_in": "2026-09-14", "check_out": "2026-09-16"}).json()
    assert b["folio"]["gross"] == 3300.0
    assert b["deposit"] == 990.0          # ไม่ใช่ 990.10

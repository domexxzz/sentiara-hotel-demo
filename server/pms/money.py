"""จำนวนเงิน — เก็บเป็น "สตางค์" จำนวนเต็มเสมอ

ทำไมไม่ใช้ทศนิยม
-----------------
`0.1 + 0.2 != 0.3` ในเลขทศนิยมแบบ float · เดโมฝั่งหน้าจอใช้บาทเต็มจึงไม่เจอปัญหา
แต่พอถอด VAT ออกจากยอดรวม เศษสตางค์เกิดขึ้นทันที (฿1,650 → ฐาน ฿1,542.06)
และเมื่อยอดพวกนี้ถูกบวกกันหลายพันรายการแล้วส่งเข้าระบบบัญชี **ความคลาดเคลื่อน
จะสะสมจนงบไม่ลง** ซึ่งเป็นปัญหาที่ไล่หาย้อนหลังยากที่สุดชนิดหนึ่ง

จึงเก็บทุกอย่างเป็นสตางค์ (int) แปลงเป็นบาทเฉพาะตอนแสดงผล

VAT
---
ราคาที่โรงแรมประกาศเป็น **ราคารวมภาษีแล้ว** ("฿1,650 /คืน · ภาษีแล้ว")
ใบกำกับภาษีเต็มรูปตาม **ม.86/4 (6) ประมวลรัษฎากร** บังคับให้แสดงภาษี
"แยกออกจากมูลค่าของสินค้าและหรือของบริการให้ชัดแจ้ง" → ต้อง **ถอด** ออกจากยอดรวม
ไม่ใช่บวกเพิ่มจากยอดที่แขกเห็น

กฎเหล็กของการถอด: **ฐาน + ภาษี = ยอดรวม เป๊ะเสมอ**
ถ้าปัดเศษแล้วไม่ตรง ต้องยกส่วนต่างให้ภาษี ไม่ใช่ปล่อยให้ผลรวมเพี้ยน
"""
from __future__ import annotations

from dataclasses import dataclass

#: 1 บาท = 100 สตางค์
SATANG = 100


def baht(amount: float | int) -> int:
    """แปลงบาทเป็นสตางค์ · ปัดครึ่งขึ้นเพื่อให้ผลเหมือนกันทุกเครื่อง

    ไม่ใช้ round() ของ Python เพราะเป็น banker's rounding (2.5 → 2)
    ซึ่งไม่ตรงกับที่คนทำบัญชีคาดหวังและไม่ตรงกับฝั่งหน้าจอ
    """
    return int(amount * SATANG + (0.5 if amount >= 0 else -0.5))


def to_baht(satang: int) -> float:
    return satang / SATANG


def fmt(satang: int) -> str:
    """แสดงผลแบบไทย · ใช้ในบิลและใบกำกับภาษี"""
    sign = "-" if satang < 0 else ""
    whole, frac = divmod(abs(satang), SATANG)
    return f"{sign}฿{whole:,}.{frac:02d}"


@dataclass(frozen=True)
class VatSplit:
    """ผลการถอด VAT · ทุกค่าเป็นสตางค์"""

    base: int
    vat: int
    gross: int

    def __post_init__(self) -> None:
        # กันไม่ให้สร้างค่าที่ผลรวมไม่ลง — ถ้าหลุดมาได้ แปลว่ามีบั๊กที่ต้นทาง
        assert self.base + self.vat == self.gross, "ฐาน + ภาษี ต้องเท่ากับยอดรวม"


def split_vat(gross: int, vat_pct: int) -> VatSplit:
    """ถอด VAT ออกจากยอดที่รวมภาษีแล้ว

    vat_pct = 0 (ยังไม่จด VAT) → ภาษีเป็นศูนย์ ฐานเท่ากับยอดรวม
    """
    if vat_pct <= 0:
        return VatSplit(base=gross, vat=0, gross=gross)
    base = round_half_up(gross * 100, 100 + vat_pct)
    # ส่วนต่างจากการปัดยกให้ภาษีเสมอ ผลรวมจึงตรงกับที่แขกจ่ายพอดี
    return VatSplit(base=base, vat=gross - base, gross=gross)


def add_vat(base: int, vat_pct: int) -> VatSplit:
    """บวก VAT จากราคาที่ยังไม่รวมภาษี — ใช้กับใบเสนอราคา ไม่ใช่บิลห้อง"""
    if vat_pct <= 0:
        return VatSplit(base=base, vat=0, gross=base)
    vat = round_half_up(base * vat_pct, 100)
    return VatSplit(base=base, vat=vat, gross=base + vat)


def round_half_up(numerator: int, denominator: int) -> int:
    """หารแล้วปัดครึ่งขึ้น ด้วยเลขจำนวนเต็มล้วน ไม่แตะ float เลย"""
    if denominator == 0:
        raise ZeroDivisionError("ตัวหารเป็นศูนย์")
    if (numerator < 0) != (denominator < 0):
        return -((-numerator * 2 + denominator) // (2 * denominator))
    return (numerator * 2 + denominator) // (2 * denominator)


def pct_of(amount: int, pct: float) -> int:
    """คิดเปอร์เซ็นต์ของจำนวนเงิน · ใช้กับมัดจำและส่วนลด

    **คูณก่อนหารเสมอ** เคยเขียนเป็น `หาร(amount, 100000/pct)` ซึ่งปัดตัวหารทิ้งเศษ
    ตั้งแต่ต้น (`100000/30` ได้ `3333` ไม่ใช่ `3333.33`) มัดจำจึงเกินทุกครั้ง
    30% ของ ฿3,300 คิดได้ ฿990.10 แทนที่จะเป็น ฿990.00

    คูณ pct ด้วย 1000 เพื่อรับเปอร์เซ็นต์ที่มีจุดทศนิยม เช่น 12.5% ได้ด้วย
    """
    if not pct:
        return 0
    return round_half_up(amount * round(pct * 1000), 100_000)


# ── จำนวนเงินเป็นตัวอักษร — เอกสารภาษีไทยบังคับ ────────────────────
_DIGIT = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"]
_PLACE = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"]


def _read_group(n: int) -> str:
    s, out, ln = str(n), "", len(str(n))
    for i, ch in enumerate(s):
        d, pos = int(ch), ln - i - 1
        if d == 0:
            continue
        if pos == 0 and d == 1 and ln > 1:
            out += "เอ็ด"
        elif pos == 1 and d == 1:
            pass
        elif pos == 1 and d == 2:
            out += "ยี่"
        else:
            out += _DIGIT[d]
        out += _PLACE[pos]
    return out


def _chunk(n: int) -> str:
    if n < 1_000_000:
        return _read_group(n)
    return _chunk(n // 1_000_000) + "ล้าน" + _read_group(n % 1_000_000)


def baht_text(satang: int) -> str:
    """เช่น 165000 → 'หนึ่งพันหกร้อยห้าสิบบาทถ้วน'"""
    neg = satang < 0
    satang = abs(satang)
    whole, frac = divmod(satang, SATANG)
    words = "ศูนย์" if whole == 0 else _chunk(whole)
    words += "บาท"
    words += (_read_group(frac) + "สตางค์") if frac else "ถ้วน"
    return ("ลบ" if neg else "") + words


# ── ภาษีหัก ณ ที่จ่าย ────────────────────────────────────────────────
#: อัตราที่ใช้บ่อยในโรงแรม · ท.ป.4/2528 และที่แก้ไขเพิ่มเติม
#: ตัวเลขเป็นหน่วยหนึ่งในหมื่น (0.01%) เพื่อรองรับ 0.75% โดยไม่ต้องใช้ float
WHT_RATES = {
    "service": 300,      # 3.00%  ค่าบริการ ค่าจ้างทำของ
    "rent": 500,         # 5.00%  ค่าเช่าอสังหาริมทรัพย์
    "professional": 300,  # 3.00%  ค่าวิชาชีพอิสระ
    "advertising": 200,  # 2.00%  ค่าโฆษณา
    "transport": 100,    # 1.00%  ค่าขนส่ง
    "none": 0,           # ซื้อสินค้า — ไม่ต้องหัก
}


@dataclass(frozen=True)
class Withheld:
    """ยอดที่ต้องจ่ายจริง และยอดที่ต้องนำส่งสรรพากร

    กฎเหล็ก: `net + tax == base` เสมอ — เงินที่ออกจากมือเรารวมกับที่ค้างนำส่ง
    ต้องเท่ากับค่าใช้จ่ายพอดี ถ้าไม่ตรง เจ้าหนี้จะทวงส่วนต่างหรือสรรพากรจะขาด
    """

    base: int
    tax: int
    net: int

    def __post_init__(self) -> None:
        assert self.net + self.tax == self.base, "หักแล้วยอดไม่ลงตัว"


def withhold(base: int, kind: str = "none") -> Withheld:
    """คำนวณภาษีหัก ณ ที่จ่ายจากฐานที่ **ยังไม่รวม VAT**

    สองข้อที่ผิดกันบ่อยจนกลายเป็นค่าปรับ
    -------------------------------------
    1. **หักจากยอดรวม VAT** — ผิด ต้องหักจากฐานก่อนภาษีมูลค่าเพิ่ม
       ยอด ฿10,700 (รวม VAT 7%) หัก 3% ต้องได้ ฿300 ไม่ใช่ ฿321
    2. **หักค่าสินค้า** — ผิด ภาษีหัก ณ ที่จ่ายใช้กับ *บริการ* ไม่ใช่ *สินค้า*
       ซื้อผ้าปูที่นอนไม่ต้องหัก จ้างซักผ้าต้องหัก
    """
    rate = WHT_RATES.get(kind)
    if rate is None:
        raise ValueError(f"ไม่รู้จักประเภทการหัก {kind}")
    if not rate:
        return Withheld(base=base, tax=0, net=base)
    tax = round_half_up(base * rate, 10_000)
    return Withheld(base=base, tax=tax, net=base - tax)

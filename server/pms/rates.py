"""แผนราคา — วันธรรมดา / วันหยุด

ตรงกับ `src/lib/rates.ts` ฝั่งหน้าจอทุกประการ ตั้งใจให้เป็นคู่แฝดกัน
ถ้าแก้ที่หนึ่งต้องแก้อีกที่ ไม่งั้นราคาที่แขกเห็นกับที่เรียกเก็บจะไม่ตรงกัน
ซึ่งเป็นเรื่องที่ลูกค้าจับได้ทันทีและเสียความน่าเชื่อถือมากที่สุด

คืนศุกร์และเสาร์คิดเรตวันหยุด — นับ**วันที่เข้าพัก** ไม่ใช่วันที่ออก
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from pms.money import round_half_up

DEFAULT_WEEKEND_PCT = 20

#: 4 = ศุกร์, 5 = เสาร์ ตาม date.weekday() (จันทร์ = 0)
_WEEKEND_DOW = (4, 5)


def is_weekend_night(day: date) -> bool:
    return day.weekday() in _WEEKEND_DOW


def rate_for_night(base_satang: int, day: date, weekend_pct: int = DEFAULT_WEEKEND_PCT) -> int:
    if not is_weekend_night(day):
        return base_satang
    return round_half_up(base_satang * (100 + weekend_pct), 100)


@dataclass(frozen=True)
class NightRate:
    day: date
    rate_satang: int
    weekend: bool


def nightly_rates(
    base_satang: int, check_in: date, check_out: date,
    weekend_pct: int = DEFAULT_WEEKEND_PCT,
) -> list[NightRate]:
    """ราคาทีละคืน — แจกแจงให้แขกเห็นได้ว่าคืนไหนเท่าไร"""
    out: list[NightRate] = []
    d = check_in
    while d < check_out:
        out.append(NightRate(d, rate_for_night(base_satang, d, weekend_pct), is_weekend_night(d)))
        d += timedelta(days=1)
    return out


def stay_total(
    base_satang: int, check_in: date, check_out: date,
    weekend_pct: int = DEFAULT_WEEKEND_PCT,
) -> int:
    return sum(n.rate_satang for n in nightly_rates(base_satang, check_in, check_out, weekend_pct))


def weekend_nights(check_in: date, check_out: date) -> int:
    return sum(1 for n in nightly_rates(1, check_in, check_out) if n.weekend)

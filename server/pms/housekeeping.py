"""งานแม่บ้านและสถานะห้อง

ทำไมห้องกลับไปขายได้ตอนหัวหน้าอนุมัติ ไม่ใช่ตอนแม่บ้านกดเสร็จ
--------------------------------------------------------------
คนที่ทำงานเป็นคนตรวจงานตัวเองเมื่อไร มาตรฐานก็หายไปทันที และแขกที่เข้าห้อง
ที่ยังไม่เรียบร้อยคือรีวิวหนึ่งดาวที่ลบไม่ได้ · ต้นทุนของการให้หัวหน้าตรวจ
คือเวลาไม่กี่นาที ส่วนต้นทุนของการไม่ตรวจคือลูกค้าที่ไม่กลับมาอีกเลย

ทำไมงานเกิดเองตอนเช็กเอาต์
---------------------------
ห้องที่แขกออกแล้วแต่ไม่มีใครรู้ว่าต้องทำ คือห้องที่ขายไม่ได้ทั้งที่ว่าง —
รายได้ที่หายไปโดยไม่มีใครเห็นว่าหาย เพราะไม่มีตัวเลขไหนติดลบ

`housekeeping` แยกจาก `out_of_order` เพราะเป็นคนละคำถาม
--------------------------------------------------------
"ขายได้ไหม" กับ "สะอาดหรือยัง" ไม่ใช่เรื่องเดียวกัน · ห้องที่ปิดซ่อมก็ยัง
ต้องทำความสะอาดหลังช่างเสร็จ และห้องสกปรกก็ไม่ได้แปลว่าเสีย
"""
from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from pms import clock
from pms.db import Booking, HousekeepingTask, Room, RoomNight, Staff

#: สถานะที่ห้องหนึ่งเป็นได้ในสายตาแม่บ้าน
HK_STATES = ("clean", "dirty", "cleaning", "inspect")

#: เส้นทางที่งานหนึ่งใบเดินได้ · นอกเหนือจากนี้คือความผิดพลาด ไม่ใช่ทางลัด
FLOW: dict[str, tuple[str, ...]] = {
    "open": ("doing", "cancelled"),
    "doing": ("inspect", "cancelled"),
    "inspect": ("done", "doing"),      # ผ่าน หรือ ถูกตีกลับ
    "done": (),
    "cancelled": (),
}


class HousekeepingError(Exception):
    pass


def _room(db: Session, no: str) -> Room:
    r = db.scalar(select(Room).where(Room.no == no))
    if r is None:
        raise HousekeepingError(f"ไม่รู้จักห้อง {no}")
    return r


def open_task(
    db: Session, room_no: str, *, kind: str = "checkout",
    note: str = "", priority: int | None = None,
) -> HousekeepingTask:
    """เปิดงานให้ห้องหนึ่ง · ถ้ามีงานค้างอยู่แล้วคืนใบเดิม ไม่เปิดซ้อน

    เปิดซ้อนได้เมื่อไร แม่บ้านจะเห็นห้องเดียวกันสองบรรทัดแล้วไม่รู้ว่าทำอันไหน
    """
    room = _room(db, room_no)
    live = db.scalar(
        select(HousekeepingTask)
        .where(HousekeepingTask.room_id == room.id,
               HousekeepingTask.status.in_(("open", "doing", "inspect")))
        .order_by(HousekeepingTask.id)
    )
    if live is not None:
        return live

    t = HousekeepingTask(
        room_id=room.id, kind=kind, note=note,
        priority=priority if priority is not None else _priority(db, room),
    )
    room.housekeeping = "dirty"
    db.add(t)
    db.flush()
    return t


def _priority(db: Session, room: Room) -> int:
    """ห้องที่มีแขกรอเข้าวันนี้ต้องมาก่อน

    เรียงตามลำดับที่แม่บ้านควรทำจริง ไม่ใช่ตามเวลาที่งานถูกสร้าง —
    ห้องที่แขกยืนรออยู่ที่ล็อบบี้กับห้องที่ยังไม่มีใครจอง ไม่ควรมีค่าเท่ากัน
    """
    today = clock.today()
    waiting = db.scalar(
        select(RoomNight)
        .join(Booking)
        .where(RoomNight.room_id == room.id, RoomNight.night == today,
               Booking.status == "confirmed")
    )
    if waiting is not None:
        return 1
    soon = db.scalar(
        select(RoomNight).where(RoomNight.room_id == room.id, RoomNight.night > today)
    )
    return 3 if soon is not None else 5


def advance(
    db: Session, ref: str, to: str, *,
    staff: Staff | None = None, reason: str = "", photos: int | None = None,
) -> HousekeepingTask:
    """ขยับงานไปสถานะถัดไป · เดินนอกเส้นทางไม่ได้"""
    t = db.scalar(select(HousekeepingTask).where(HousekeepingTask.ref == ref))
    if t is None:
        raise HousekeepingError(f"ไม่พบงาน {ref}")
    if to not in FLOW.get(t.status, ()):
        raise HousekeepingError(
            f"งานอยู่สถานะ {t.status} จะไป {to} ไม่ได้ — "
            f"ทำได้แค่ {' หรือ '.join(FLOW.get(t.status, ())) or 'จบแล้ว'}"
        )

    room = db.get(Room, t.room_id)

    if to == "doing":
        # ทั้งเริ่มงานใหม่และถูกตีกลับ มาลงที่นี่เหมือนกัน
        if t.status == "inspect":
            if not reason.strip():
                raise HousekeepingError(
                    "ตีกลับต้องบอกเหตุผล — ไม่งั้นแม่บ้านไม่รู้ว่าต้องแก้อะไร "
                    "แล้วส่งกลับมาแบบเดิมอีกรอบ"
                )
            t.reject_reason = reason.strip()
            t.photos = 0
        if staff is not None:
            t.assigned_to = staff.id
        room.housekeeping = "cleaning"

    elif to == "inspect":
        n = photos if photos is not None else t.photos
        # สามมุมมาตรฐาน — มุมรวม เตียง ห้องน้ำ · น้อยกว่านี้หัวหน้าตรวจไม่ได้จริง
        if n < 3:
            raise HousekeepingError(
                f"ต้องถ่ายครบ 3 มุมก่อนส่งตรวจ (มุมรวม เตียง ห้องน้ำ) — ตอนนี้มี {n} รูป"
            )
        t.photos = n
        t.reject_reason = ""
        room.housekeeping = "inspect"

    elif to == "done":
        t.done_at = clock.now()
        room.housekeeping = "clean"

    elif to == "cancelled":
        room.housekeeping = "clean"

    t.status = to
    db.flush()
    return t


def sellable(room: Room) -> bool:
    """ขายได้ไหม ณ ตอนนี้ · ปิดซ่อมหรือยังไม่สะอาด = ขายไม่ได้"""
    return not room.out_of_order and room.housekeeping == "clean"


def board(db: Session, day: date | None = None) -> list[dict]:
    """คิวงานที่แม่บ้านเห็น · เรียงตามลำดับที่ควรทำจริง"""
    rows = db.scalars(
        select(HousekeepingTask)
        .where(HousekeepingTask.status.in_(("open", "doing", "inspect")))
        .order_by(HousekeepingTask.priority, HousekeepingTask.created_at)
    ).all()
    out = []
    for t in rows:
        who = db.get(Staff, t.assigned_to) if t.assigned_to else None
        out.append({
            "ref": t.ref, "room": t.room.no, "type": t.room.room_type.name,
            "kind": t.kind, "status": t.status, "priority": t.priority,
            "photos": t.photos, "note": t.note, "reject_reason": t.reject_reason,
            "assigned_to": who.name if who else None,
            "created_at": t.created_at,
        })
    return out

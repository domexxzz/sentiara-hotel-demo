"""สำรองและกู้คืนข้อมูล — เครื่องมือสำหรับคนดูแลระบบ

    python scripts/backup.py                     สำรองหนึ่งชุด แล้วตรวจให้
    python scripts/backup.py --list              ดูชุดที่มีอยู่
    python scripts/backup.py --verify FILE       ตรวจไฟล์สำรองหนึ่งไฟล์
    python scripts/backup.py --restore FILE      กู้คืน (เก็บของเดิมไว้ให้)
    python scripts/backup.py --prune 30          เก็บ 30 ชุดล่าสุด ลบที่เหลือ

ตั้งเป็นงานตามเวลาให้รันทุกคืนหลังปิดยอด · สำรองได้ขณะระบบยังทำงานอยู่
ไม่ต้องปิดเซิร์ฟเวอร์

**ซ้อมกู้คืนอย่างน้อยปีละครั้ง** สำรองที่ไม่เคยลองกู้ ไม่ใช่การสำรอง
แต่เป็นความรู้สึกปลอดภัย
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

from pms.backup import BackupError, backup, counts, prune, restore, verify  # noqa: E402


def human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} GB"


def main() -> int:
    ap = argparse.ArgumentParser(description="สำรองและกู้คืนฐานข้อมูล PMS")
    ap.add_argument("--out", default="backups", help="โฟลเดอร์เก็บไฟล์สำรอง")
    ap.add_argument("--list", action="store_true", help="ดูชุดที่มีอยู่")
    ap.add_argument("--verify", metavar="FILE", help="ตรวจไฟล์สำรองหนึ่งไฟล์")
    ap.add_argument("--restore", metavar="FILE", help="กู้คืนจากไฟล์สำรอง")
    ap.add_argument("--prune", type=int, metavar="N", help="เก็บ N ชุดล่าสุด ลบที่เหลือ")
    args = ap.parse_args()

    try:
        if args.list:
            files = sorted(Path(args.out).glob("pms-*.db"))
            if not files:
                print(f"ยังไม่มีไฟล์สำรองใน {args.out}")
                return 0
            print(f"ไฟล์สำรองใน {args.out} · {len(files)} ชุด")
            for f in files:
                print(f"   {f.name:<28} {human(f.stat().st_size)}")
            return 0

        if args.verify:
            got = verify(Path(args.verify))
            print(f"ไฟล์สำรองใช้ได้ · {args.verify}")
            for t, n in got.items():
                if n:
                    print(f"   {t:<20} {n:>7,} แถว")
            return 0

        if args.restore:
            print(f"กำลังกู้คืนจาก {args.restore}")
            dest = restore(args.restore)
            print(f"กู้คืนแล้ว → {dest}")
            print("ของเดิมถูกเก็บไว้เป็นไฟล์ .before-restore-… ในโฟลเดอร์เดียวกัน")
            print("\n⚠ ปิดเซิร์ฟเวอร์ก่อนกู้คืนเสมอ แล้วเปิดใหม่หลังเสร็จ")
            return 0

        if args.prune is not None:
            gone = prune(args.out, args.prune)
            print(f"ลบไฟล์สำรองเก่า {len(gone)} ชุด · เหลือ {args.prune} ชุดล่าสุด")
            for f in gone:
                print(f"   ลบ {f.name}")
            return 0

        res = backup(out_dir=args.out)
        print(f"สำรองแล้ว → {res.path}  ({human(res.bytes)})")
        print("ตรวจสำเนาผ่าน · integrity_check ok")
        for t, n in res.counts.items():
            if n:
                print(f"   {t:<20} {n:>7,} แถว")
        return 0

    except BackupError as e:
        print(f"✗ {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

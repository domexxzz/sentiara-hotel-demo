"""หาที่อยู่ของหน้าจอที่แพ็กมาด้วยกัน

ตอนแพ็กเป็นไฟล์เดียว หน้าจอ (ผลลัพธ์ของ `npm run build`) ถูกยัดเข้าไปในตัว
`.exe` ด้วย · ตอนรัน PyInstaller จะคลายไฟล์พวกนี้ลงโฟลเดอร์ชั่วคราวแล้วบอก
ที่อยู่ไว้ที่ `sys._MEIPASS`

ทำไมต้องแพ็กหน้าจอไปด้วย
-------------------------
โปรแกรมที่ลูกค้าดับเบิลคลิกแล้วเจอหน้า Swagger คือ *เซิร์ฟเวอร์* ไม่ใช่
*โปรแกรม* · เจ้าของโรงแรมไม่รู้จัก Swagger และไม่ควรต้องรู้จัก
ไฟล์เดียวต้องเปิดแล้วได้จอที่ใช้ทำงานจริงเลย
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def ui_dir() -> Path | None:
    """โฟลเดอร์หน้าจอที่พร้อมเสิร์ฟ · คืน None ถ้าไม่มี (เช่นตอนพัฒนา)"""
    # 1. สั่งชี้เองได้ ใช้ตอนทดสอบว่าการเสิร์ฟหน้าจอทำงานไหมโดยไม่ต้องแพ็ก
    override = os.environ.get("PMS_WEB")
    if override:
        p = Path(override)
        return p if (p / "index.html").exists() else None

    # 2. ตอนเป็นไฟล์เดียวที่แพ็กแล้ว
    base = getattr(sys, "_MEIPASS", None)
    if base:
        p = Path(base) / "web"
        return p if (p / "index.html").exists() else None

    return None

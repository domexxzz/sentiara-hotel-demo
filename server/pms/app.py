"""เซิร์ฟเวอร์ PMS

    python -m uvicorn pms.app:app --port 8792
    เปิด http://localhost:8792/docs
"""
from __future__ import annotations

import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from pms.api import router
from pms import property_settings as ps
from pms.session import get_db, setup
from pms.web import ui_dir

API_PREFIX = "/api/v1"


def create_app(db_url: str | None = None) -> FastAPI:
    setup(db_url)
    app = FastAPI(
        title="Sentiara PMS",
        version="0.1.0",
        description=(
            "หลังบ้านระบบจัดการโรงแรม — จอง เช็กอิน บิล ใบกำกับภาษี "
            "และส่งรายการเข้าระบบบัญชี\n\n"
            "**กันจองซ้ำที่ระดับฐานข้อมูล** ไม่ใช่เช็กด้วยโค้ด"
        ),
    )
    # หน้าจอรันคนละที่อยู่กับ API จึงต้องอนุญาตข้ามต้นทาง
    # ค่าเริ่มต้นเปิดเฉพาะเครื่องตัวเอง · ตั้ง PMS_ORIGINS เมื่อขึ้นเครื่องจริง
    origins = [o.strip() for o in os.environ.get(
        "PMS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware, allow_origins=origins, allow_credentials=False,
        allow_methods=["GET", "POST"], allow_headers=["authorization", "content-type"],
    )
    app.include_router(router, prefix=API_PREFIX)

    @app.get("/health", tags=["meta"])
    def health(db: Session = Depends(get_db)) -> dict:
        cfg = ps.get(db)
        return {
            "ok": True,
            "hotel": cfg.hotel_name,
            "vat_pct": cfg.vat_pct,
            "weekend_pct": cfg.weekend_pct,
            "ledger_dry_run": os.environ.get("LEDGER_DRY_RUN", "1") not in ("0", "false"),
        }

    # หน้าจอที่แพ็กมาด้วยกัน (ถ้ามี) — ต้อง mount **ท้ายสุด** เพราะ "/" กินทุก
    # เส้นทางที่ยังไม่มีใครรับ · ใส่ก่อน router แล้ว /api กับ /docs จะโดนกลืน
    # html=True ให้ตกลงมาที่ index.html เสมอ หน้าจอเป็น SPA เส้นทางอยู่ฝั่งเบราว์เซอร์
    web = ui_dir()
    if web is not None:
        app.mount("/", StaticFiles(directory=str(web), html=True), name="ui")

    return app


app = create_app()

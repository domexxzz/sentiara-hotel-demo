"""เซิร์ฟเวอร์ PMS

    python -m uvicorn pms.app:app --port 8792
    เปิด http://localhost:8792/docs
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pms.api import router
from pms.session import settings, setup

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
    def health() -> dict:
        return {
            "ok": True,
            "hotel": settings.hotel_name,
            "vat_pct": settings.vat_pct,
            "weekend_pct": settings.weekend_pct,
            "ledger_dry_run": os.environ.get("LEDGER_DRY_RUN", "1") not in ("0", "false"),
        }

    return app


app = create_app()

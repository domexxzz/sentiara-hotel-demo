@echo off
REM ============================================================
REM  Sentiara PMS - เริ่มระบบ
REM
REM  ดับเบิลคลิกไฟล์นี้ไฟล์เดียว ครั้งแรกจะเตรียมของให้เอง
REM  ครั้งต่อไปเปิดเร็ว เพราะเตรียมไว้แล้ว
REM
REM  ต้องมี Python 3.10 ขึ้นไปในเครื่อง (python.org)
REM ============================================================
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo   Sentiara PMS
echo   ============
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo   [!] ไม่พบ Python ในเครื่อง
  echo.
  echo       ติดตั้งจาก https://www.python.org/downloads/
  echo       ตอนติดตั้ง อย่าลืมติ๊ก "Add Python to PATH"
  echo.
  pause
  exit /b 1
)

REM --- เตรียมสภาพแวดล้อมแยก ไม่ไปยุ่งกับ Python ตัวอื่นในเครื่อง ---
if not exist ".venv\Scripts\python.exe" (
  echo   กำลังเตรียมระบบครั้งแรก ใช้เวลาสักครู่...
  python -m venv .venv
  if errorlevel 1 (
    echo   [!] สร้างสภาพแวดล้อมไม่สำเร็จ
    pause
    exit /b 1
  )
  ".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
  ".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt
  if errorlevel 1 (
    echo   [!] ติดตั้งส่วนประกอบไม่สำเร็จ - เช็กว่าต่ออินเทอร์เน็ตอยู่ไหม
    pause
    exit /b 1
  )
  echo   เตรียมระบบเสร็จแล้ว
  echo.
)

REM --- ข้อมูลตั้งต้น ทำครั้งเดียวตอนยังไม่มีฐานข้อมูล ---
if not exist "data\pms.db" (
  echo   กำลังสร้างข้อมูลตั้งต้น...
  ".venv\Scripts\python.exe" -m pms.seed
  echo.
  echo   ^>^> จดรหัสบัตรและรหัสผ่านด้านบนไว้ แสดงครั้งเดียวเท่านั้น ^<^<
  echo.
  pause
)

REM --- สำรองข้อมูลก่อนเปิดทุกครั้ง เก็บ 30 ชุดล่าสุด ---
if exist "data\pms.db" (
  ".venv\Scripts\python.exe" scripts\backup.py >nul 2>&1
  ".venv\Scripts\python.exe" scripts\backup.py --prune 30 >nul 2>&1
)

echo   เปิดระบบที่ http://127.0.0.1:8900
echo   คู่มือ API ที่ http://127.0.0.1:8900/docs
echo.
echo   ปิดระบบด้วยการปิดหน้าต่างนี้ หรือกด Ctrl+C
echo.

start "" http://127.0.0.1:8900/docs
".venv\Scripts\python.exe" -m uvicorn pms.app:app --host 127.0.0.1 --port 8900

endlocal

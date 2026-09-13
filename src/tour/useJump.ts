import { useEffect, useRef } from "react";
import { onTarget, takeLatest, type Target } from "./target";

/** ให้แอปย่อยรับเฉพาะส่วนของตัวเองจากคำสั่ง "ไปที่จอนี้"
 *
 * เรียก `apply` สองจังหวะ เพราะคำสั่งมาถึงได้สองแบบ
 *   1. สั่งตอนที่จอปลายทาง **ยังไม่เกิด** (สลับมุมมองแล้วค่อยเปิดแท็บ)
 *      → หยิบจาก takeLatest() ตอน mount
 *   2. สั่งตอนที่จอปลายทาง **เปิดอยู่แล้ว** (อยู่จอเจ้าของ แล้วข้ามไปอีกแท็บ)
 *      → ได้ยินจาก onTarget ตามปกติ
 *
 * เก็บ apply ไว้ใน ref เพื่อให้ effect ผูกครั้งเดียวตอน mount แต่ยังเรียก
 * ฟังก์ชันตัวล่าสุดเสมอ — ถ้าใส่ apply ใน dependency จะถอด/ใส่ listener
 * ใหม่ทุกเฟรมที่ component วาดใหม่
 */
export function useJump(apply: (t: Target) => void): void {
  const latest = useRef(apply);
  latest.current = apply;

  useEffect(() => {
    const run = (t: Target) => latest.current(t);
    const pending = takeLatest();
    if (pending) run(pending);
    return onTarget(run);
  }, []);
}

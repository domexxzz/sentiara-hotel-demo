/** ตัวส่ง "ไปที่จอนี้" ข้ามแอปย่อย
 *
 * ทำไมไม่ใช้ context หรือ prop
 * -----------------------------
 * แต่ละมุมมองมี store ของตัวเอง (desk · staff · pos · owner) และ provider
 * ของมันถูก mount ตอนที่เลือกมุมมองนั้นเท่านั้น สารบัญฟังก์ชันจึงต้องสั่งได้
 * ทั้งกรณีที่แอปปลายทาง **ยังไม่ mount** (สลับมุมมองแล้วค่อยเปิดแท็บ) และ
 * กรณีที่ **mount อยู่แล้ว** (อยู่จอเจ้าของอยู่ แล้วกระโดดไปอีกแท็บ)
 *
 * ยัด state ก้อนนี้เข้า context กลางแปลว่าต้องยกทั้งสี่ store ขึ้นไปบนสุด
 * ซึ่งรื้อของที่ใช้งานได้อยู่แล้วโดยไม่จำเป็น · ตัวส่งเล็ก ๆ ตัวนี้แทน
 * ให้แต่ละแอปหยิบเฉพาะส่วนของตัวเองไปใช้ แล้วไม่ต้องรู้จักกัน
 */
import type { OwnerTab } from "../owner/ownerStore";
import type { DeskView } from "../desk/deskStore";
import type { PosView } from "../pos/posStore";
import type { StaffView, Role } from "../staff/staffStore";

export type Flow = "guest" | "desk" | "staff" | "owner" | "pos";

export type Target = {
  flow: Flow;
  owner?: OwnerTab;
  desk?: DeskView;
  pos?: PosView;
  staff?: StaffView;
  role?: Role;
  /** ข้อความบอกว่าไปถึงแล้วให้กดอะไรต่อ — แสดงเป็นแถบใต้หัวจอ */
  hint?: string;
};

type Listener = (t: Target) => void;

const listeners = new Set<Listener>();

/** เป้าหมายล่าสุด เก็บไว้ให้แอปที่เพิ่ง mount หยิบไปใช้ได้
 *  (ตอนสั่งไป จอปลายทางยังไม่เกิด จึงไม่ได้ยินเสียงเรียกรอบนั้น) */
let latest: Target | null = null;

export function goTo(t: Target): void {
  latest = t;
  listeners.forEach((fn) => fn(t));
}

export function onTarget(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** แอปย่อยเรียกตอน mount เพื่อรับเป้าหมายที่สั่งไว้ก่อนหน้า แล้วล้างทิ้ง
 *  ล้างทิ้งเพราะถ้าไม่ล้าง การสลับกลับมาจอเดิมทีหลังจะเด้งไปแท็บเก่าเอง */
export function takeLatest(): Target | null {
  const t = latest;
  latest = null;
  return t;
}

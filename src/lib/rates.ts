import { addDays, nightsBetween, parse } from "./date";

/**
 * แผนราคาวันธรรมดา/วันหยุด
 * ผังห้องคืนศุกร์–เสาร์เต็ม 93–95% ส่วนวันอาทิตย์ 66% — โรงแรมที่ขายราคาเดียวทุกคืน
 * คือโรงแรมที่ทิ้งรายได้สองคืนที่ดีที่สุดของสัปดาห์
 */
/**
 * ค่าตั้งต้น · หน้าตั้งค่าระบบเขียนทับได้ผ่าน setWeekendPct
 * ประกาศเป็น let เพราะ ES module ให้ live binding — ไฟล์ที่ import ไปแล้ว
 * เห็นค่าใหม่ทันทีโดยไม่ต้องส่งพารามิเตอร์ไล่ไปทุกจุดที่คิดราคา (มี 12 จุด)
 */
export let WEEKEND_PCT = 20;

/** เรียกจาก HotelProvider เมื่อเจ้าของแก้ค่าในหน้าตั้งค่า */
export const setWeekendPct = (pct: number) => {
  WEEKEND_PCT = Math.max(0, Math.min(200, Math.round(pct)));
};

/** คืนวันศุกร์และเสาร์คิดเรตวันหยุด (นับวันที่เข้าพัก ไม่ใช่วันที่ออก) */
export const isWeekendNight = (day: string) => {
  const dow = parse(day).getDay();
  return dow === 5 || dow === 6;
};

export const rateForNight = (base: number, day: string) =>
  isWeekendNight(day) ? Math.round((base * (100 + WEEKEND_PCT)) / 100) : base;

export type NightRate = { day: string; rate: number; weekend: boolean };

/** ราคาแยกรายคืนของการเข้าพักหนึ่งครั้ง */
export const nightlyRates = (base: number, checkIn: string, checkOut: string): NightRate[] => {
  const n = Math.max(1, nightsBetween(checkIn, checkOut));
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(checkIn, i);
    return { day, rate: rateForNight(base, day), weekend: isWeekendNight(day) };
  });
};

/** ค่าห้องรวมทั้งการเข้าพัก — ใช้แทน `rate * nights` ทุกที่ */
export const stayTotal = (base: number, checkIn: string, checkOut: string) =>
  nightlyRates(base, checkIn, checkOut).reduce((sum, n) => sum + n.rate, 0);

/** จำนวนคืนวันหยุดในช่วงที่เข้าพัก — ใช้อธิบายให้แขกเห็นว่าทำไมราคาไม่เท่ากัน */
export const weekendNights = (checkIn: string, checkOut: string) =>
  nightlyRates(1, checkIn, checkOut).filter((n) => n.weekend).length;

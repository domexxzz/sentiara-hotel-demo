import { ROOMS, type Room } from "../data";

/**
 * โหมดประเภทธุรกิจ — โรงแรม หรือ คอนโดปล่อยเช่ารายวัน
 *
 * ระบบหลังบ้านเหมือนกันทั้งหมด (ปฏิทิน บิล แม่บ้าน ใบกำกับภาษี ทะเบียนผู้พัก)
 * ต่างกันแค่ชื่อประเภทห้อง ขนาด รูป และคำที่ใช้ — จึงเปลี่ยนได้ที่ชั้นการแสดงผล
 * ไม่ต้องแยกเป็นคนละระบบ
 *
 * ยูนิตชั้นล่างสุดของคอนโดเป็น **สัญญาเช่ารายเดือน ไม่เปิดขายรายวัน** ตามที่คอนโด
 * ปล่อยเช่าจริงมักเป็น — ยูนิตพวกนี้ยังอยู่ในผังห้องเคาน์เตอร์ (เพราะแม่บ้านและช่าง
 * ยังต้องดูแล) แต่หายไปจากฝั่งแขก
 */
export type PropertyMode = "hotel" | "condo";

/** ชื่อประเภทห้องเรียงตามระดับ · ดัชนีตรงกันข้ามโหมด ใช้แปลงผังห้องได้ตรง ๆ */
export const TIERS: Record<PropertyMode, string[]> = {
  hotel: ["ดีลักซ์", "ซูพีเรียร์", "รายเตียง (ดอร์ม)"],
  condo: ["1 ห้องนอน", "สตูดิโอ", "ยูนิตเช่ารายเดือน"],
};

/** ระดับที่ขายรายวันไม่ได้ในโหมดนั้น */
export const LONGSTAY_TIER: Record<PropertyMode, number | null> = {
  hotel: null,
  condo: 2,
};

export const PROPERTY: Record<
  PropertyMode,
  { name: string; kind: string; city: string; unitWord: string }
> = {
  hotel: { name: "Sentiara Hotel", kind: "โรงแรม", city: "เชียงใหม่", unitWord: "ห้อง" },
  condo: { name: "Sentiara Residence", kind: "คอนโดให้เช่ารายวัน", city: "กรุงเทพฯ", unitWord: "ยูนิต" },
};

/** ห้องที่เปิดขายรายวันในโหมดนั้น — ฝั่งแขกเห็นเท่านี้ */
export function roomsFor(mode: PropertyMode): Room[] {
  if (mode === "hotel") return ROOMS;
  return [
    {
      ...ROOMS[0],
      name: TIERS.condo[0],
      bed: "1 ห้องนอนแยก · เตียงควีน + โซฟา",
      sqm: 42,
      amenities: ["แอร์", "Wi-Fi ฟรี", "ครัวเล็ก", "เครื่องซักผ้า", "สระส่วนกลาง"],
      photos: ["/condo/onebed-1.jpg", "/condo/onebed-2.jpg", "/condo/onebed-3.jpg"],
    },
    {
      ...ROOMS[1],
      name: TIERS.condo[1],
      bed: "สตูดิโอ · เตียงควีน + มุมนั่งเล่น",
      sqm: 28,
      amenities: ["แอร์", "Wi-Fi ฟรี", "ครัวเล็ก", "ระเบียง"],
      photos: ["/condo/studio-1.jpg", "/condo/studio-2.jpg", "/condo/studio-3.jpg"],
    },
  ];
}

/** แปลงประเภทของห้องหนึ่งจากโหมดหนึ่งไปอีกโหมด */
export const tierIndexOf = (type: string) => {
  const i = TIERS.hotel.indexOf(type);
  return i >= 0 ? i : TIERS.condo.indexOf(type);
};

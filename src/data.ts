// ── Mock domain data for the Sentiara guest prototype ──────────────────
// All values are demo data. Prices in THB. No backend — state lives in memory.

export const HOTEL = {
  name: "Sentiara Hotel",
  city: "เชียงใหม่",
  phone: "053-000-000",
  otaGapPct: 12, // จองตรงถูกกว่า OTA 12%
  depositPct: 30, // มัดจำ 30% ตอนจอง
};

export const GUEST = {
  name: "คุณอนันต์ ศรีสุข",
  first: "อนันต์",
  room: "201",
};

export const TRIP = {
  rangeLabel: "14–16 ส.ค. 2026",
  rangeShort: "14–16 ส.ค.",
  nights: 2,
  adults: 2,
  children: 0,
};

export type Room = {
  id: string;
  name: string;
  bed: string;
  sqm: number;
  price: number; // ราคาจองตรง /คืน
  ota: number; // ราคา OTA /คืน
  available: number;
  tag?: string;
  amenities: string[];
  /** รูปห้องที่โรงแรมอัปโหลดเอง — ไม่มีไฟล์ก็ถอยไปใช้พื้นหลังเดิม */
  photos?: string[];
};

export const ROOMS: Room[] = [
  {
    id: "deluxe",
    name: "ดีลักซ์",
    bed: "เตียงใหญ่ 1 เตียง",
    sqm: 32,
    price: 1650,
    ota: 1875,
    available: 14,
    tag: "ถูกที่สุดของเดือน",
    amenities: ["แอร์", "Wi-Fi ฟรี", "มินิบาร์", "ระเบียง"],
    photos: ["/rooms/deluxe-1.jpg", "/rooms/deluxe-2.jpg", "/rooms/deluxe-3.jpg"],
  },
  {
    id: "superior",
    name: "ซูพีเรียร์",
    bed: "เตียงคู่ 2 เตียง",
    sqm: 26,
    price: 1350,
    ota: 1530,
    available: 8,
    amenities: ["แอร์", "Wi-Fi ฟรี", "โต๊ะทำงาน"],
    photos: ["/rooms/superior-1.jpg", "/rooms/superior-2.jpg"],
  },
  {
    id: "dorm",
    name: "รายเตียง (ดอร์ม)",
    bed: "เตียง 1 ที่ · ห้องรวม 6 เตียง",
    sqm: 4,
    price: 450,
    ota: 520,
    available: 3,
    amenities: ["แอร์", "Wi-Fi ฟรี", "ล็อกเกอร์"],
    photos: ["/rooms/dorm-1.jpg", "/rooms/dorm-2.jpg"],
  },
];

export type PayMethod = "qr" | "cash";

// Minibar / F&B items the guest can add during the stay → auto-billed to room
export type ShopItem = { id: string; label: string; note: string; price: number };

export const MINIBAR: ShopItem[] = [
  { id: "water", label: "น้ำดื่ม", note: "ขวดละ", price: 20 },
  { id: "latte", label: "ลาเต้ · คาเฟ่", note: "แก้วละ", price: 65 },
  { id: "beer", label: "เบียร์ท้องถิ่น", note: "กระป๋องละ", price: 90 },
  { id: "laundry", label: "ซักรีด", note: "ชิ้นละ", price: 40 },
];

// Quick-reply requests in the in-room chat
export const QUICK_REQUESTS = [
  { id: "towel", text: "ขอผ้าเช็ดตัวเพิ่ม 2 ผืนครับ", job: "ผ้าเช็ดตัว 2 ผืน" },
  { id: "clean", text: "รบกวนทำความสะอาดห้องช่วงบ่ายครับ", job: "ทำความสะอาดห้อง" },
  { id: "late", text: "ขอเช็กเอาท์สายถึง 14:00 ได้ไหมครับ", job: "ขอ Late check-out" },
];

export { money } from "./lib/format";

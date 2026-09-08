// ── Staff mobile (แม่บ้าน / หัวหน้า) mock data ─────────────────────────
// Demo values only. Mirrors the "Sentiara Staff Mobile" mockup:
// full-screen 390×844, primary buttons >= 52px, Thai throughout, offline-first.

export const HK = { name: "สมศรี", role: "แม่บ้าน", shift: "กะเช้า 07:00–16:00" };
export const SUP = { name: "มาลี", role: "หัวหน้าแม่บ้าน" };
export const TECH = { name: "วิชัย", role: "ช่างประจำ" };

/** อะไหล่ที่ช่างเบิกจากคลังได้ — ต้นทุนวิ่งเข้ารายงานเดือนอัตโนมัติ */
export const PARTS = [
  { id: "r32", label: "น้ำยาแอร์ R32 · 1 ถัง", price: 850 },
  { id: "filter", label: "ฟิลเตอร์แอร์ · 1 ชิ้น", price: 370 },
  { id: "tap", label: "ชุดก๊อกอ่างล้างหน้า", price: 420 },
  { id: "led", label: "หลอดไฟ LED · 1 หลอด", price: 180 },
];

/** มุมรูปที่ช่างต้องถ่าย — ก่อนและหลังซ่อม */
export const TECH_ANGLES = [
  { id: "before", label: "รูปก่อนซ่อม" },
  { id: "after", label: "รูปหลังซ่อม" },
];

export type JobStatus = "todo" | "doing" | "review" | "rejected" | "done";

export type Job = {
  id: string;
  room: string;
  type: string;
  kind: "ทำความสะอาดออก" | "ทำความสะอาดพัก" | "ตรวจซ้ำ";
  priority?: string; // why the queue put it here
  status: JobStatus;
  minutes: number; // expected duration
  photos: string[]; // angle keys captured
  checks: string[]; // checklist keys ticked
  defect?: string; // supervisor's reject reason
  doneAt?: string;
};

// Queue is built every morning — rooms with the earliest arrival come first.
export const JOBS: Job[] = [
  {
    id: "HK-2281",
    room: "305",
    type: "ดีลักซ์",
    kind: "ทำความสะอาดออก",
    priority: "แขก Tanaka เช็กอิน 14:00",
    status: "todo",
    minutes: 35,
    photos: [],
    checks: [],
  },
  {
    id: "HK-2282",
    room: "205",
    type: "ดีลักซ์",
    kind: "ทำความสะอาดออก",
    priority: "คาดเสร็จ 13:45",
    status: "todo",
    minutes: 35,
    photos: [],
    checks: [],
  },
  {
    id: "HK-2283",
    room: "304",
    type: "ซูพีเรียร์",
    kind: "ทำความสะอาดพัก",
    priority: "แขกยังพักอยู่ · ขอช่วงบ่าย",
    status: "todo",
    minutes: 20,
    photos: [],
    checks: [],
  },
  {
    id: "HK-2280",
    room: "402",
    type: "ดีลักซ์",
    kind: "ทำความสะอาดออก",
    priority: "เพิ่งเช็กเอาท์",
    status: "done",
    minutes: 35,
    photos: ["wide", "bed", "bath"],
    checks: ["dust", "linen", "amenity", "smell"],
    doneAt: "12:40",
  },
];

// Mandatory checklist before a room can be submitted.
export const CHECKLIST = [
  { id: "dust", label: "ปัดฝุ่นตามขอบและมุมห้อง" },
  { id: "linen", label: "เปลี่ยนผ้าปู–ปลอกหมอน ไม่มีรอยยับ" },
  { id: "amenity", label: "ของใช้ครบตามมาตรฐาน" },
  { id: "bath", label: "ห้องน้ำแห้ง ไม่มีคราบ" },
  { id: "smell", label: "ไม่มีกลิ่นอับ · เปิดระบายอากาศแล้ว" },
];

// Three mandatory angles — "บังคับถ่ายก่อนปิดงาน"
export const ANGLES = [
  { id: "wide", label: "มุมรวม", hint: "ยืนหน้าประตู ถ่ายให้เห็นทั้งห้อง" },
  { id: "bed", label: "เตียง", hint: "เห็นผ้าปูและหัวเตียงเต็มเฟรม" },
  { id: "bath", label: "ห้องน้ำ", hint: "เห็นอ่างล้างหน้าและพื้นห้องน้ำ" },
];

// Reasons the supervisor must pick when sending a room back.
export const DEFECTS = [
  { id: "dust", label: "ฝุ่นตามขอบ" },
  { id: "linen", label: "ผ้าปูมีรอยยับ" },
  { id: "amenity", label: "ของใช้ไม่ครบ" },
  { id: "smell", label: "กลิ่นอับ" },
];

// Maintenance issues a housekeeper can raise mid-job — becomes a work order.
export const ISSUES = [
  { id: "tap", label: "ก๊อกอ่างล้างหน้าหยด" },
  { id: "ac", label: "แอร์ไม่เย็น" },
  { id: "light", label: "ไฟห้องน้ำเสีย" },
  { id: "tv", label: "ทีวีไม่ติด" },
];

/**
 * ทีมงาน แม่บ้าน และคลังของใช้
 *
 * บัตร NFC ใบเดียว
 * ----------------
 * ใบเดียวกันเปิดประตู ล็อกอินเข้าระบบ และลงเวลา — พนักงานไม่ต้องจำรหัสผ่าน
 * ซึ่งสำคัญกว่าที่คิด เพราะรหัสที่จำไม่ได้จะถูกจดไว้ข้างจอเสมอ
 *
 * ตัวชี้วัดที่ไม่กลายเป็นเครื่องมือกดดัน
 * -------------------------------------
 * วัด "เวลาเฉลี่ยต่อห้อง" อย่างเดียวคือการสอนให้คนทำเร็วแล้วหยาบ
 * ตัวเลขความเร็วจึงต้องมี **งานที่ถูกตีกลับ** อยู่ข้าง ๆ เสมอ ห้ามแยกกันแสดง
 * คนที่เร็วที่สุดแต่ถูกตีกลับบ่อยที่สุด ไม่ใช่คนที่ทำงานดีที่สุด
 */

/* ── ทะเบียนพนักงาน ────────────────────────────────────────────────── */

export type Staff = {
  id: string;
  name: string;
  role: string;
  /** รหัสบัตร NFC · ใบเดียวใช้ทั้งเปิดประตู ล็อกอิน และลงเวลา */
  card: string;
  hourly: number;
  active: boolean;
};

export const STAFF: Staff[] = [
  { id: "E-01", name: "คุณสมศรี ใจดี", role: "แม่บ้าน", card: "NFC-4471", hourly: 62, active: true },
  { id: "E-02", name: "คุณวันดี แสงทอง", role: "แม่บ้าน", card: "NFC-4472", hourly: 62, active: true },
  { id: "E-03", name: "คุณประสิทธิ์ ช่างดี", role: "ช่างซ่อมบำรุง", card: "NFC-4480", hourly: 78, active: true },
  { id: "E-04", name: "คุณนภา รักงาน", role: "พนักงานต้อนรับ", card: "NFC-4490", hourly: 70, active: true },
  { id: "E-05", name: "คุณจิรา พ้นงาน", role: "แม่บ้าน", card: "NFC-4473", hourly: 62, active: false },
];

/* ── ลงเวลาและค่าแรง ───────────────────────────────────────────────── */

/** กะมาตรฐานวันละ 8 ชั่วโมง · เกินจากนี้คิดโอที */
export const SHIFT_HOURS = 8;
/** อัตราโอทีตาม ม.61 พ.ร.บ.คุ้มครองแรงงาน — ไม่น้อยกว่า 1.5 เท่า */
export const OT_MULTIPLIER = 1.5;

export type Shift = { staffId: string; date: string; inAt: string; outAt: string };

export const SHIFTS: Shift[] = [
  { staffId: "E-01", date: "2026-09-08", inAt: "07:52", outAt: "17:10" },
  { staffId: "E-02", date: "2026-09-08", inAt: "08:04", outAt: "16:05" },
  { staffId: "E-03", date: "2026-09-08", inAt: "08:00", outAt: "19:30" },
  { staffId: "E-04", date: "2026-09-08", inAt: "06:55", outAt: "15:02" },
];

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export type Pay = { hours: number; normal: number; ot: number; wage: number };

/**
 * คิดค่าแรงจาก **เวลาที่ทำจริง** ไม่ใช่จากกะที่ตั้งไว้
 *
 * ปัดเป็นนาที ไม่ปัดเป็นชั่วโมง — ปัดขึ้นทั้งชั่วโมงทำให้จ่ายเกินสะสม
 * ปัดลงทำให้พนักงานได้ไม่ครบ ซึ่งผิดกฎหมาย
 */
export function pay(s: Shift, hourly: number): Pay {
  const mins = minutes(s.outAt) - minutes(s.inAt);
  const hours = mins / 60;
  const normal = Math.min(hours, SHIFT_HOURS);
  const ot = Math.max(0, hours - SHIFT_HOURS);
  return {
    hours: Math.round(hours * 100) / 100,
    normal: Math.round(normal * 100) / 100,
    ot: Math.round(ot * 100) / 100,
    wage: Math.round((normal + ot * OT_MULTIPLIER) * hourly),
  };
}

/* ── ตัวชี้วัดรายคน ────────────────────────────────────────────────── */

export type Kpi = {
  staffId: string;
  done: number;
  avgMinutes: number;
  /** หัวหน้าตรวจแล้วตีกลับ — ตัวเลขนี้ต้องอยู่ข้างความเร็วเสมอ */
  bounced: number;
};

export const KPIS: Kpi[] = [
  { staffId: "E-01", done: 14, avgMinutes: 26, bounced: 0 },
  { staffId: "E-02", done: 17, avgMinutes: 18, bounced: 4 },
  { staffId: "E-05", done: 9, avgMinutes: 31, bounced: 1 },
];

/**
 * อ่านตัวเลขให้เป็นประโยค แทนที่จะปล่อยให้คนสรุปเอง
 *
 * ปล่อยตัวเลขเปล่า ๆ ไว้ คนจะมองแค่คอลัมน์ความเร็วแล้วชมคนที่เร็วที่สุด
 * ทั้งที่งานถูกตีกลับหนึ่งในสี่ใบ
 */
export function readKpi(k: Kpi): { tone: "good" | "warn"; text: string } {
  const rate = k.done ? Math.round((k.bounced / k.done) * 100) : 0;
  if (rate >= 20)
    return {
      tone: "warn",
      text: `เร็วที่สุดแต่ถูกตีกลับ ${rate}% — เร็วแล้วหยาบไม่ใช่ทำงานดี`,
    };
  if (k.bounced === 0) return { tone: "good", text: "ไม่มีงานถูกตีกลับเลย" };
  return { tone: "good", text: `ถูกตีกลับ ${rate}% · อยู่ในเกณฑ์` };
}

/* ── ตรวจมาตรฐานห้อง ───────────────────────────────────────────────── */

/** สามมุมมาตรฐาน · ขาดมุมไหนส่งตรวจไม่ได้ */
export const ANGLES = ["มุมรวมทั้งห้อง", "เตียงและผ้าปู", "ห้องน้ำ"] as const;

export type RoomCheck = {
  room: string;
  staffId: string;
  photos: string[];
  status: "waiting" | "passed" | "bounced";
  reason?: string;
};

export const CHECKS: RoomCheck[] = [
  { room: "208", staffId: "E-01", photos: [...ANGLES], status: "passed" },
  { room: "210", staffId: "E-02", photos: [...ANGLES], status: "bounced", reason: "ผ้าเช็ดตัวขาดหนึ่งผืน" },
  { room: "301", staffId: "E-02", photos: [ANGLES[0], ANGLES[1]], status: "waiting" },
  { room: "305", staffId: "E-01", photos: [...ANGLES], status: "waiting" },
];

/** ส่งตรวจได้ไหม — ขาดมุมใดมุมหนึ่งคือยังส่งไม่ได้ ไม่ใช่เตือนแล้วปล่อยผ่าน */
export function readyToReview(c: RoomCheck): { ok: boolean; missing: string[] } {
  const missing = ANGLES.filter((a) => !c.photos.includes(a));
  return { ok: missing.length === 0, missing };
}

/* ── คลังของใช้และการสั่งซื้อ ──────────────────────────────────────── */

export type Item = {
  sku: string;
  name: string;
  unit: string;
  onHand: number;
  /** ต่ำกว่านี้ต้องสั่งซื้อ */
  reorderAt: number;
  /** สั่งครั้งละเท่าไร */
  packSize: number;
  cost: number;
  /** ใช้ต่อการเข้าพักหนึ่งครั้ง — ใช้ตัดสต็อกตามที่ขายจริง */
  perStay: number;
};

export const ITEMS: Item[] = [
  { sku: "LIN-01", name: "ผ้าปูที่นอน", unit: "ผืน", onHand: 62, reorderAt: 40, packSize: 20, cost: 320, perStay: 1 },
  { sku: "TWL-01", name: "ผ้าเช็ดตัว", unit: "ผืน", onHand: 34, reorderAt: 50, packSize: 30, cost: 180, perStay: 2 },
  { sku: "AMN-01", name: "สบู่และแชมพู", unit: "ชุด", onHand: 88, reorderAt: 60, packSize: 100, cost: 22, perStay: 1 },
  { sku: "MIN-01", name: "น้ำดื่มมินิบาร์", unit: "ขวด", onHand: 41, reorderAt: 48, packSize: 48, cost: 9, perStay: 2 },
];

export type Draft = { sku: string; name: string; qty: number; cost: number; why: string };

/**
 * ร่างใบสั่งซื้อของที่ต่ำกว่าจุดสั่ง
 *
 * **ร่างไว้ให้ ไม่ได้สั่งเอง** — ระบบที่สั่งของเองโดยไม่มีคนกดยืนยัน
 * วันหนึ่งจะสั่งผิดแล้วไม่มีใครรู้จนของมาถึง
 */
export function draftOrders(items: Item[], stays: number): Draft[] {
  return items
    .filter((i) => i.onHand < i.reorderAt)
    .map((i) => ({
      sku: i.sku,
      name: i.name,
      qty: i.packSize,
      cost: i.packSize * i.cost,
      why: `เหลือ ${i.onHand} ${i.unit} · ต่ำกว่าจุดสั่ง ${i.reorderAt} · ใช้ราว ${i.perStay * stays} ${i.unit}/วัน`,
    }));
}

/* ── คู่มือและผู้ช่วยเรื่องระเบียบ ──────────────────────────────────── */

export type Sop = { code: string; title: string; steps: string[]; minutes: number };

export const SOPS: Sop[] = [
  {
    code: "HK-01", title: "ทำความสะอาดห้องหลังเช็กเอาต์", minutes: 25,
    steps: [
      "เปิดหน้าต่างระบายอากาศก่อนเริ่มเสมอ",
      "เก็บผ้าใช้แล้วทั้งหมดลงถุงก่อนแตะของสะอาด",
      "เช็ดจากบนลงล่าง จากในออกนอก",
      "เปลี่ยนของใช้ให้ครบตามรายการในระบบ",
      "ถ่ายรูปสามมุมส่งหัวหน้าตรวจ",
    ],
  },
  {
    code: "FD-02", title: "รับเรื่องร้องเรียนจากแขก", minutes: 10,
    steps: [
      "ฟังจนจบก่อน อย่าเพิ่งอธิบาย",
      "ทวนสิ่งที่ได้ยินให้แขกยืนยันว่าเข้าใจตรงกัน",
      "บอกสิ่งที่ทำได้ทันที และสิ่งที่ต้องรอ",
      "บันทึกลงระบบทุกครั้ง แม้แก้จบแล้ว",
    ],
  },
];

export type Rule = { topic: string; answer: string; source: string; tags: string[] };

/**
 * คลังระเบียบและสวัสดิการ
 *
 * เหมือนผู้ช่วยกฎหมาย — **ไม่มีต้นทางก็ไม่ตอบ** เพราะเรื่องสิทธิของลูกจ้าง
 * ตอบผิดแล้วกระทบเงินในกระเป๋าคนจริง ๆ
 */
export const RULES: Rule[] = [
  {
    topic: "โอที",
    answer: "ทำเกินเวลาทำงานปกติ ได้ค่าล่วงเวลาไม่น้อยกว่า 1.5 เท่าของค่าจ้างต่อชั่วโมง",
    source: "พ.ร.บ.คุ้มครองแรงงาน พ.ศ. 2541 มาตรา 61",
    tags: ["โอที", "ล่วงเวลา", "ทำเกินเวลา"],
  },
  {
    topic: "วันหยุดพักผ่อนประจำปี",
    answer: "ทำงานครบหนึ่งปี มีสิทธิหยุดพักผ่อนประจำปีไม่น้อยกว่าหกวันทำงาน",
    source: "พ.ร.บ.คุ้มครองแรงงาน พ.ศ. 2541 มาตรา 30",
    tags: ["วันหยุด", "พักร้อน", "ลาพักผ่อน"],
  },
  {
    topic: "ลาป่วย",
    answer: "ลาป่วยได้เท่าที่ป่วยจริง โดยได้ค่าจ้างไม่เกินสามสิบวันทำงานต่อปี",
    source: "พ.ร.บ.คุ้มครองแรงงาน พ.ศ. 2541 มาตรา 32 และ 57",
    tags: ["ลาป่วย", "ป่วย", "ลากี่วัน"],
  },
  {
    topic: "เวลาพัก",
    answer: "ทำงานติดต่อกันครบห้าชั่วโมง ต้องมีเวลาพักไม่น้อยกว่าหนึ่งชั่วโมง",
    source: "พ.ร.บ.คุ้มครองแรงงาน พ.ศ. 2541 มาตรา 27",
    tags: ["เวลาพัก", "พักเที่ยง", "พักกี่ชั่วโมง"],
  },
];

export function askRule(q: string): Rule | null {
  const t = q.toLowerCase().trim();
  if (!t) return null;
  return RULES.find((r) => r.tags.some((tag) => t.includes(tag))) ?? null;
}

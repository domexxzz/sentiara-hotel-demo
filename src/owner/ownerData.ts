// ── Owner dashboard mock data ──────────────────────────────────────────
// Demo values only. Core pitch from the mockup: every number is traceable
// back to closed bills — "ตัวเลขทุกบรรทัดกดดูที่มาได้".

export type Day = {
  label: string;
  rooms: number; // ค่าห้อง
  fnb: number; // อาหาร & เครื่องดื่ม
  occ: number; // % เข้าพัก
  sold: number; // ห้องที่ขายได้
  orders: number; // ออร์เดอร์ร้านอาหาร
};

/** สัปดาห์นี้ · อา 7 – ส 13 ส.ค. 2026 (คืนล่าสุด = รายการสุดท้าย) */
export const WEEK: Day[] = [
  { label: "อา 7", rooms: 25100, fnb: 6200, occ: 66, sold: 19, orders: 11 },
  { label: "จ 8", rooms: 29500, fnb: 7100, occ: 76, sold: 22, orders: 12 },
  { label: "อ 9", rooms: 28700, fnb: 6400, occ: 74, sold: 21, orders: 10 },
  { label: "พ 10", rooms: 30800, fnb: 7800, occ: 79, sold: 23, orders: 13 },
  { label: "พฤ 11", rooms: 32100, fnb: 8200, occ: 82, sold: 24, orders: 14 },
  { label: "ศ 12", rooms: 36400, fnb: 10600, occ: 93, sold: 27, orders: 16 },
  { label: "ส 13", rooms: 37600, fnb: 11400, occ: 95, sold: 28, orders: 17 },
];

/** สัปดาห์ก่อน — ใช้เทียบอย่างเดียว (ตั้งให้โตราว +11% ตามรายงานเช้าในดีไซน์) */
export const LAST_WEEK = { revenue: 250400, occ: 76, direct: 19 };

export const MONTH = {
  bills: 579,
  directShare: 26, // % จองตรง
  otaCommissionSaved: 7400,
  directDiscountProfit: 23400,
};

export type Source = { label: string; note?: string; amount?: string };

export type AiQna = {
  q: string;
  /** May contain {revenue} {delta} {occ} {lastOcc} — filled from live totals
   *  so an answer can never drift from the KPI cards above it. */
  a: string;
  evidence: string;
  action?: string;
};

export const AI_QNA: AiQna[] = [
  {
    q: "อาทิตย์นี้เทียบอาทิตย์ที่แล้วเป็นยังไง",
    a: "ดีขึ้นครับ — รายได้ {revenue} ({delta}) · เข้าพักเฉลี่ย {occ}% เทียบ {lastOcc}% · ห้องดีลักซ์เต็มทุกคืนศุกร์–เสาร์ ตัวดันหลักคือจองตรงเพิ่มเป็น 26%",
    evidence: "ที่มา: บิลที่ปิดแล้ว 7 วัน · เทียบช่วงเดียวกันสัปดาห์ก่อน",
  },
  {
    q: "ค่าไฟห้องไหนแพงผิดปกติ",
    a: "ห้อง 210 ครับ — สูงกว่าห้องแบบเดียวกัน 41% ต่อเนื่อง 3 คืน · น่าจะแอร์ ผมเตรียมใบงานช่างไว้แล้ว กดสั่งได้เลย",
    evidence: "ที่มา: มิเตอร์ไฟรายห้อง 16 จุด (+41% 3 คืนติด) + แม่บ้านสมศรีแจ้ง “ลมไม่เย็น”",
    action: "สั่งช่างเลย",
  },
  {
    q: "ส่วนลดจองตรงคุ้มกับค่าคอมไหม",
    a: "คุ้มครับ — ใช้ไป 212 ครั้ง · ต้นทุนส่วนลดต่อการจอง ฿200 แต่เลี่ยงค่าคอมเฉลี่ย ฿264 และได้ LINE ของแขกไว้ขายซ้ำ · กำไรสุทธิจากการดันจองตรง ฿23,400 เดือนนี้",
    evidence: "ที่มา: บิลจองตรง 212 ใบ เทียบอัตราค่าคอม OTA 15–18%",
  },
  {
    q: "มีส่วนลดที่ให้เปล่าประโยชน์ไหม",
    a: "มีครับ — โค้ดวันธรรมดาใช้ไป 46 ครั้ง แต่ 31 ครั้งเป็นวันที่เต็มอยู่แล้ว เท่ากับให้ส่วนลดกับแขกที่จะจองยังไงก็ได้ · แนะนำจำกัดเฉพาะวันที่จองต่ำกว่า 70%",
    evidence: "ที่มา: บิลที่ใช้โค้ด 46 ใบ เทียบกับอัตราเข้าพักของวันนั้น",
  },
];

export type Approval = {
  id: string;
  title: string;
  amount: number;
  by: string;
  at: string;
  reason: string;
  aiNote: string;
};

export const APPROVALS: Approval[] = [
  {
    id: "AP-441",
    title: "ส่วนลด 5% · ห้อง 201 คุณอนันต์",
    amount: 203,
    by: "สมชาย (เคาน์เตอร์)",
    at: "วันนี้ 09:29",
    reason: "แขกเก่าขอส่วนลด · แอร์เสียงดังคืนแรก",
    aiNote:
      "จริงครับ — แขกคนนี้เข้าพัก 4 ครั้งในปีนี้ จองตรงทุกครั้ง ไม่เคยยกเลิก · ส่วนลดอยู่ในเพดาน 10% ที่คุณตั้งไว้",
  },
  {
    id: "AP-442",
    title: "คืนเงินมัดจำ #B-2390",
    amount: 990,
    by: "มาลี (หัวหน้าแม่บ้าน)",
    at: "เมื่อวาน 17:04",
    reason: "แขกยกเลิกก่อน 48 ชม. ตามเงื่อนไข",
    aiNote: "ตรงตามนโยบายยกเลิกฟรีก่อน 48 ชม. · ยังไม่เคยคืนเงินให้เลขจองนี้",
  },
];

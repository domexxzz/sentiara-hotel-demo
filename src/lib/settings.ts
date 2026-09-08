/**
 * ตั้งค่าระบบ — ค่าที่เคยฝังอยู่ในโค้ด ย้ายมาให้เจ้าของแก้เองได้
 *
 * เหตุผลที่ต้องมี: ราคาห้อง เรตวันหยุด VAT มัดจำ เคยเป็นตัวเลขตายตัวในไฟล์
 * แปลว่าขายให้โรงแรมที่สองต้องแก้โค้ดใหม่ทุกครั้ง ซึ่งขายไม่ได้จริง
 *
 * ทุกจอที่แสดงราคาต้องอ่านจากที่นี่ที่เดียว — ห้ามมีตัวเลขราคาซ้ำที่อื่น
 */

export type RoomTypeCfg = {
  /** ตรงกับชื่อประเภทห้องในผังห้อง — ใช้จับคู่กับ DeskRoom.type */
  name: string;
  /** ราคาต่อคืนวันธรรมดา (บาท) */
  rate: number;
  /** ราคาที่ตั้งบน OTA — สูงกว่าเพราะบวกค่าคอมฯ ไว้แล้ว */
  ota: number;
};

export type Settings = {
  hotelName: string;
  city: string;
  phone: string;
  /** ภาษีมูลค่าเพิ่ม (%) — 0 = ยังไม่จด VAT */
  vatPct: number;
  /** บวกกี่ % สำหรับคืนศุกร์–เสาร์ */
  weekendPct: number;
  /** เก็บมัดจำกี่ % ตอนจอง */
  depositPct: number;
  /** ค่าดูแลระบบรายปี คิดเป็น % ของค่าลิขสิทธิ์ */
  maPct: number;
  /** เวลาเช็กอิน / เช็กเอาต์มาตรฐาน */
  checkInTime: string;
  checkOutTime: string;
  types: RoomTypeCfg[];
};

export const DEFAULT_SETTINGS: Settings = {
  hotelName: "Sentiara Hotel",
  city: "เชียงใหม่",
  phone: "053-000-000",
  vatPct: 7,
  weekendPct: 20,
  depositPct: 30,
  maPct: 15,
  checkInTime: "14:00",
  checkOutTime: "12:00",
  types: [
    { name: "ดีลักซ์", rate: 1650, ota: 1875 },
    { name: "ซูพีเรียร์", rate: 1350, ota: 1530 },
    { name: "สวีท", rate: 2900, ota: 3300 },
    { name: "รายเตียง (ดอร์ม)", rate: 450, ota: 520 },
  ],
};

/** ราคาต่อคืนของประเภทห้อง · ไม่รู้จักประเภทไหนให้ตกมาที่ประเภทถูกสุด ไม่ใช่เลขมั่ว */
export const rateOf = (s: Settings, type: string): number => {
  const hit = s.types.find((t) => t.name === type);
  if (hit) return hit.rate;
  return s.types.length ? Math.min(...s.types.map((t) => t.rate)) : 0;
};

export const otaOf = (s: Settings, type: string): number => {
  const hit = s.types.find((t) => t.name === type);
  return hit ? hit.ota : Math.round(rateOf(s, type) * 1.14);
};

/** ตารางราคาแบบเดิมที่โค้ดเก่าคาดหวัง — เอาไว้ส่งต่อให้ส่วนที่ยังรับเป็น Record */
export const rateTable = (s: Settings): Record<string, number> =>
  Object.fromEntries(s.types.map((t) => [t.name, t.rate]));

/** จองตรงถูกกว่า OTA กี่ % โดยเฉลี่ย — ใช้เป็นจุดขายฝั่งแขก ต้องคำนวณจากราคาจริง */
export const otaGapPct = (s: Settings): number => {
  const pairs = s.types.filter((t) => t.ota > 0 && t.rate > 0);
  if (!pairs.length) return 0;
  const avg = pairs.reduce((sum, t) => sum + (t.ota - t.rate) / t.ota, 0) / pairs.length;
  return Math.round(avg * 100);
};

/** ตรวจก่อนบันทึก — ค่าที่พังจะทำให้ทั้งระบบคิดเงินผิด ต้องกันตั้งแต่หน้าตั้งค่า */
export function validate(s: Settings): string[] {
  const bad: string[] = [];
  if (!s.hotelName.trim()) bad.push("ต้องมีชื่อกิจการ");
  if (s.vatPct < 0 || s.vatPct > 30) bad.push("VAT ต้องอยู่ระหว่าง 0–30%");
  if (s.weekendPct < 0 || s.weekendPct > 200) bad.push("เรตวันหยุดต้องอยู่ระหว่าง 0–200%");
  if (s.depositPct < 0 || s.depositPct > 100) bad.push("มัดจำต้องอยู่ระหว่าง 0–100%");
  if (!s.types.length) bad.push("ต้องมีประเภทห้องอย่างน้อย 1 ประเภท");
  s.types.forEach((t) => {
    if (!t.name.trim()) bad.push("ประเภทห้องต้องมีชื่อ");
    if (t.rate <= 0) bad.push(`ราคา${t.name || "ห้อง"}ต้องมากกว่า 0`);
    if (t.ota > 0 && t.ota < t.rate)
      bad.push(`ราคา OTA ของ${t.name}ต่ำกว่าราคาจองตรง — จองตรงจะไม่ถูกกว่า`);
  });
  const names = s.types.map((t) => t.name.trim());
  if (new Set(names).size !== names.length) bad.push("ชื่อประเภทห้องซ้ำกัน");
  return bad;
}

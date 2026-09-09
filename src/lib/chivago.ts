/**
 * ChivaGo — สิทธิพิเศษที่ตรวจสอบได้
 *
 * ปัญหาที่ตั้งใจแก้
 * ------------------
 * แต้มสะสมทั่วไปคือตัวเลขที่ใครก็แจกได้ ผู้สนับสนุนหรือหน่วยงานที่เอาไปอ้าง
 * จึงตรวจย้อนไม่ได้ว่ามีคนมาจริงกี่คน · ที่นี่แยกแต้มเป็นสองชนิดคนละชั้นความน่าเชื่อถือ
 * แล้ว **ห้ามเอามารวมกันแสดงผล** เพราะพอรวมแล้วชั้นที่ตรวจได้จะเสียความหมายทันที
 *
 *   แต้มเขียว (Green)  ต้องอยู่ในพื้นที่จริง ถ่ายรูปที่มีพิกัดติดมา
 *                      แล้วโฮสต์ชื่อจริงกดอนุมัติ ถึงจะได้
 *   แต้มทริป (Trip)    ได้ง่ายกว่า ใช้แลกของรางวัลได้
 *                      **แต่ห้ามแสดงให้ดูเหมือนแต้มที่ผ่านการตรวจ**
 *
 * สามข้อที่พลาดแล้วทั้งระบบเสียความหมาย
 * ---------------------------------------
 * 1. **จ่ายแต้มซ้ำ** — โฮสต์กดอนุมัติสองครั้งเพราะเน็ตช้า แล้วแต้มออกสองเท่า
 *    กัน: จ่ายผูกกับ `submissionId` ไม่ใช่กับการกดปุ่ม
 * 2. **นับซ้ำในรายงาน** — คนหนึ่งทำสามกิจกรรมแล้วรายงานว่า "สามคน"
 *    กัน: นับหัวคนที่ไม่ซ้ำเสมอ ไม่ได้นับจำนวนกิจกรรม
 * 3. **ใบรับรองที่แก้ได้** — เอกสารที่แก้ตัวเลขแล้วไม่มีใครรู้ ก็ไม่ต่างจากไม่มี
 *    กัน: ผนึกด้วยรหัสตรวจสอบที่คิดจากเนื้อในทั้งหมด แก้แล้วรหัสไม่ตรง
 */

export type PointKind = "green" | "trip";

export type Submission = {
  id: string;
  guest: string;
  guestId: string;
  activity: string;
  /** พิกัดที่ติดมากับรูป · ไม่มีพิกัด = ตรวจไม่ได้ = ให้แต้มเขียวไม่ได้ */
  geo: { lat: number; lng: number } | null;
  /** ระยะห่างจากจุดกิจกรรมเป็นเมตร */
  metres: number | null;
  at: string;
  points: number;
  photo: string;
};

export type Decision = {
  submissionId: string;
  approved: boolean;
  reason: string;
  host: string;
  at: string;
};

/** ระยะที่ยังถือว่า "อยู่ในพื้นที่จริง" · เกินกว่านี้โฮสต์ต้องปฏิเสธ */
export const GEOFENCE_M = 300;

/**
 * ตรวจว่าคำขอนี้มีสิทธิ์ได้แต้มเขียวไหม
 *
 * คืนเหตุผลมาด้วยเสมอ ไม่ใช่แค่ true/false — โฮสต์ต้องอธิบายให้แขกได้ว่า
 * ทำไมไม่ผ่าน ไม่งั้นแขกจะรู้สึกว่าถูกปฏิเสธมั่ว ๆ แล้วเลิกใช้
 */
export function checkGreen(s: Submission): { ok: boolean; why: string } {
  if (!s.geo) return { ok: false, why: "รูปไม่มีพิกัดติดมา — ตรวจไม่ได้ว่าอยู่ในพื้นที่จริง" };
  if (s.metres !== null && s.metres > GEOFENCE_M)
    return { ok: false, why: `ถ่ายห่างจากจุดกิจกรรม ${s.metres} เมตร (เกิน ${GEOFENCE_M} เมตร)` };
  return { ok: true, why: `พิกัดตรง ห่าง ${s.metres} เมตร · ให้แต้มเขียวได้` };
}

/* ── กระเป๋าแต้ม ───────────────────────────────────────────────────── */

export type Wallet = { green: number; trip: number };

/**
 * รวมแต้มจากผลการตรวจ · **จ่ายครั้งเดียวต่อหนึ่งคำขอเสมอ**
 *
 * โฮสต์กดสองครั้งเพราะเน็ตช้าเป็นเรื่องปกติ ถ้าจ่ายตามจำนวนครั้งที่กด
 * แต้มจะออกเกินโดยไม่มีใครรู้ จึงยุบด้วย `submissionId` ก่อนบวกเสมอ
 */
export function wallet(subs: Submission[], decisions: Decision[]): Wallet {
  const once = new Map<string, Decision>();
  for (const d of decisions) if (!once.has(d.submissionId)) once.set(d.submissionId, d);

  let green = 0;
  let trip = 0;
  for (const s of subs) {
    const d = once.get(s.id);
    if (d?.approved) green += s.points;
    // ไม่ผ่านการตรวจก็ยังได้แต้มทริป — เข้าร่วมจริงแต่พิสูจน์ไม่ได้
    else if (d) trip += Math.round(s.points / 2);
  }
  return { green, trip };
}

/* ── รายงานให้ผู้สนับสนุน ──────────────────────────────────────────── */

export type SponsorReport = {
  people: number;
  activities: number;
  greenPoints: number;
  rejected: number;
};

/**
 * นับ **คนที่มาจริง** ไม่ใช่การมองเห็นหรือมูลค่าประเมิน
 *
 * คนหนึ่งทำสามกิจกรรมคือ **หนึ่งคน** — รายงานที่นับกิจกรรมแล้วเรียกว่าคน
 * คือที่มาของตัวเลข ESG ที่ตรวจแล้วไม่เหลืออะไร
 */
export function sponsorReport(subs: Submission[], decisions: Decision[]): SponsorReport {
  const once = new Map<string, Decision>();
  for (const d of decisions) if (!once.has(d.submissionId)) once.set(d.submissionId, d);

  const heads = new Set<string>();
  let activities = 0;
  let greenPoints = 0;
  let rejected = 0;
  for (const s of subs) {
    const d = once.get(s.id);
    if (!d) continue;
    if (d.approved) {
      heads.add(s.guestId); // Set = คนซ้ำนับหัวเดียว
      activities += 1;
      greenPoints += s.points;
    } else rejected += 1;
  }
  return { people: heads.size, activities, greenPoints, rejected };
}

/* ── ใบรับรองที่แก้ไม่ได้ ──────────────────────────────────────────── */

/**
 * รหัสตรวจสอบจากเนื้อในทั้งหมด (FNV-1a)
 *
 * **นี่คือ checksum ไม่ใช่ลายเซ็นดิจิทัล** — กันการแก้โดยไม่ตั้งใจและพิสูจน์ว่า
 * ไฟล์ที่ถืออยู่ตรงกับตอนออก แต่คนที่ตั้งใจปลอมและคำนวณรหัสใหม่ได้ก็ยังทำได้
 * ของจริงต้องเป็น SHA-256 พร้อมลายเซ็นของผู้ออก ซึ่งยังไม่ได้ทำ
 */
export function checksum(payload: unknown): string {
  const text = JSON.stringify(payload);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, "0");
}

export type Statement = {
  no: string;
  issuedAt: string;
  guest: string;
  body: SponsorReport;
  seal: string;
};

export function issueStatement(guest: string, body: SponsorReport, at: string): Statement {
  const no = `CG-${at.replace(/-/g, "")}-${checksum(guest).slice(0, 4)}`;
  return { no, issuedAt: at, guest, body, seal: checksum({ no, at, guest, body }) };
}

/** ตรวจว่าใบรับรองยังตรงกับตอนออกไหม · ไม่ตรง = ปฏิเสธการอ่าน ไม่ใช่เตือนแล้วอ่านต่อ */
export function verify(s: Statement): boolean {
  return s.seal === checksum({ no: s.no, at: s.issuedAt, guest: s.guest, body: s.body });
}

/* ── เครือข่ายสิทธิพิเศษข้ามธุรกิจ ──────────────────────────────────── */

export type Partner = {
  name: string;
  kind: string;
  perk: string;
  cost: number;
  /** ต้องเป็นแต้มเขียวเท่านั้นไหม — สิทธิ์ที่มีต้นทุนสูงมักบังคับ */
  greenOnly: boolean;
};

export const PARTNERS: Partner[] = [
  { name: "ครัวป้านิด", kind: "ร้านอาหารท้องถิ่น", perk: "ของหวานฟรีเมื่อสั่งอาหารจานหลัก", cost: 120, greenOnly: false },
  { name: "จักรยานเช่า ริมปิง", kind: "บริการเช่า", perk: "เช่าจักรยานครึ่งวัน", cost: 250, greenOnly: false },
  { name: "สวนผักอินทรีย์แม่ริม", kind: "เกษตรชุมชน", perk: "เวิร์กช็อปเก็บผัก 2 ชั่วโมง", cost: 400, greenOnly: true },
  { name: "หัตถกรรมบ้านถวาย", kind: "ชุมชนหัตถกรรม", perk: "คลาสแกะสลักไม้", cost: 500, greenOnly: true },
];

/** แลกได้ไหม · แยกเหตุผลระหว่าง "แต้มไม่พอ" กับ "ชนิดแต้มไม่ถูก" ให้ชัด */
export function canRedeem(p: Partner, w: Wallet): { ok: boolean; why: string } {
  if (p.greenOnly && w.green < p.cost)
    return {
      ok: false,
      why: `ต้องใช้แต้มเขียว ${p.cost} · มี ${w.green} · แต้มทริปใช้กับสิทธิ์นี้ไม่ได้`,
    };
  if (!p.greenOnly && w.green + w.trip < p.cost)
    return { ok: false, why: `ต้องใช้ ${p.cost} แต้ม · มีรวม ${w.green + w.trip}` };
  // ข้อความตอนแลกได้ต้องบอกสิ่งที่ป้ายด้านบนไม่ได้บอก — เหลือเท่าไรหลังแลก
  // ไม่ใช่พูดซ้ำว่าใช้แต้มชนิดไหน ซึ่งป้ายบอกไปแล้ว
  const left = p.greenOnly ? w.green - p.cost : w.green + w.trip - p.cost;
  return { ok: true, why: `แลกได้ · เหลือ ${left.toLocaleString()} แต้ม` };
}

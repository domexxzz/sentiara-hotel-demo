/**
 * ลูกค้าเดิม · แต้มสะสม · โอกาสที่ควรทัก
 *
 * โรงแรมส่วนใหญ่รู้จักแขกเฉพาะตอนที่เขาอยู่ในห้อง พอเช็กเอาต์ก็ลืมกันไป
 * ทั้งที่ค่าได้ลูกค้าใหม่แพงกว่าค่าเรียกลูกค้าเก่ากลับมาหลายเท่า
 *
 * ไฟล์นี้เก็บสามอย่าง — เขาเคยมากี่ครั้ง · เขาพอใจไหม · มีเหตุอะไรให้ทักได้บ้าง
 * และ **ไม่แต่งเหตุขึ้นมาเอง** ถ้าไม่มีวันเกิดก็ไม่มีการแจ้งเตือนวันเกิด
 */

export type Feedback = {
  /** 1–5 ดาว */
  score: number;
  text?: string;
  at: string;
  room?: string;
};

export type Guest = {
  id: string;
  name: string;
  phone?: string;
  /** MM-DD — เก็บแค่วันเดือน ไม่เก็บปีเกิด เพราะไม่ได้ใช้และเป็นข้อมูลอ่อนไหวเกินจำเป็น */
  birthday?: string;
  /** วันที่เข้าพักครั้งแรก ใช้คิดวันครบรอบการเป็นลูกค้า */
  since?: string;
  stays: number;
  /** ยอดใช้จ่ายสะสม (บาท ก่อน VAT) */
  spend: number;
  points: number;
  lastStay?: string;
  feedback: Feedback[];
  foreign?: boolean;
};

/** ได้ 1 แต้มต่อการใช้จ่าย 20 บาท — ปัดลง ไม่ปัดขึ้น ลูกค้าจะได้ไม่รู้สึกว่าโดนโกงตอนคำนวณย้อน */
export const POINT_PER_BAHT = 20;
export const pointsFor = (spend: number) => Math.floor(spend / POINT_PER_BAHT);

export type Tier = { id: string; label: string; min: number; perk: string };

export const TIERS: Tier[] = [
  { id: "new", label: "ลูกค้าใหม่", min: 0, perk: "—" },
  { id: "silver", label: "เงิน", min: 2, perk: "เช็กเอาต์สาย 14:00 ฟรี" },
  { id: "gold", label: "ทอง", min: 5, perk: "อัปเกรดห้องเมื่อว่าง · น้ำดื่มฟรีทุกวัน" },
  { id: "platinum", label: "แพลทินัม", min: 10, perk: "อัปเกรดห้องแน่นอน · เช็กเอาต์ 16:00" },
];

export const tierOf = (g: Guest): Tier =>
  [...TIERS].reverse().find((t) => g.stays >= t.min) ?? TIERS[0];

export type Reward = { id: string; label: string; cost: number; note: string };

export const REWARDS: Reward[] = [
  { id: "water", label: "น้ำดื่ม 2 ขวด", cost: 40, note: "ส่งขึ้นห้องตอนเช็กอิน" },
  { id: "late", label: "เช็กเอาต์สาย 16:00", cost: 150, note: "ต้องมีห้องว่างคืนถัดไป" },
  { id: "breakfast", label: "อาหารเช้า 1 ที่", cost: 220, note: "ใช้ได้ในวันที่เข้าพัก" },
  { id: "upgrade", label: "อัปเกรดห้อง 1 ระดับ", cost: 500, note: "เมื่อมีห้องว่าง" },
  { id: "night", label: "ส่วนลดค่าห้อง ฿500", cost: 900, note: "ใช้กับการจองตรงเท่านั้น" },
];

export type Occasion = {
  guest: Guest;
  kind: "birthday" | "anniversary" | "festival" | "winback";
  label: string;
  why: string;
  /** ข้อความตั้งต้นที่พนักงานแก้ได้ก่อนส่ง — ระบบไม่ส่งเอง */
  draft: string;
};

/** เทศกาลที่คนไทยเดินทาง — เดือน-วัน เริ่มต้น และช่วงที่ควรทักล่วงหน้า */
export const FESTIVALS: { at: string; label: string }[] = [
  { at: "12-31", label: "ปีใหม่" },
  { at: "04-13", label: "สงกรานต์" },
  { at: "11-15", label: "ลอยกระทง" },
  { at: "10-23", label: "วันปิยมหาราช" },
];

/** เติม "คุณ" ให้เฉพาะชื่อที่ยังไม่มีคำนำหน้า — กัน "คุณคุณอนันต์" */
const polite = (name: string) =>
  /^(คุณ|นาย|นาง|นางสาว|ดร\.|Mr\.|Ms\.|Mrs\.)/.test(name) ? name : "คุณ" + name;

const mmdd = (day: string) => day.slice(5);

const daysBetweenMmdd = (from: string, to: string) => {
  const [fm, fd] = from.split("-").map(Number);
  const [tm, td] = to.split("-").map(Number);
  const a = new Date(2001, fm - 1, fd).getTime();
  const b = new Date(2001, tm - 1, td).getTime();
  let diff = Math.round((b - a) / 86400000);
  if (diff < -180) diff += 365;
  if (diff > 180) diff -= 365;
  return diff;
};

/**
 * โอกาสที่ควรทักในอีก `within` วันข้างหน้า
 * เรียงตามความใกล้ — ของที่ต้องทำวันนี้ขึ้นก่อน
 */
export function occasions(guests: Guest[], today: string, within = 30): Occasion[] {
  const out: Occasion[] = [];
  const nowMmdd = mmdd(today);

  for (const g of guests) {
    if (g.birthday) {
      const d = daysBetweenMmdd(nowMmdd, g.birthday);
      if (d >= 0 && d <= within) {
        out.push({
          guest: g,
          kind: "birthday",
          label: d === 0 ? "วันเกิดวันนี้" : `วันเกิดอีก ${d} วัน`,
          why: `เก็บวันเกิดไว้ตอนเช็กอิน (${g.birthday})`,
          draft: `สวัสดีค่ะ ${polite(g.name)} — ${g.stays >= 2 ? "ขอบคุณที่กลับมาหาเราเสมอนะคะ " : ""}ทางโรงแรมขออวยพรวันเกิดล่วงหน้าค่ะ ถ้าแวะมาช่วงนี้มีเค้กชิ้นเล็กรอให้ที่ห้องค่ะ`,
        });
      }
    }
    if (g.since) {
      const d = daysBetweenMmdd(nowMmdd, mmdd(g.since));
      const years = Number(today.slice(0, 4)) - Number(g.since.slice(0, 4));
      if (d >= 0 && d <= within && years >= 1) {
        out.push({
          guest: g,
          kind: "anniversary",
          label: `ครบ ${years} ปีที่เป็นลูกค้า`,
          why: `เข้าพักครั้งแรก ${g.since}`,
          draft: `${polite(g.name)} เข้าพักกับเราครั้งแรกเมื่อ ${years} ปีที่แล้วค่ะ ขอบคุณที่ไว้ใจกันมาตลอด — มีส่วนลดพิเศษให้สำหรับการจองตรงครั้งถัดไปค่ะ`,
        });
      }
    }
  }

  for (const f of FESTIVALS) {
    const d = daysBetweenMmdd(nowMmdd, f.at);
    if (d < 0 || d > within) continue;
    // ทักเฉพาะลูกค้าที่เคยมาแล้ว — คนที่ไม่เคยมายังไม่ใช่ลูกค้าเก่า
    for (const g of guests.filter((x) => x.stays >= 1)) {
      out.push({
        guest: g,
        kind: "festival",
        label: `${f.label} · อีก ${d} วัน`,
        why: "ช่วงเทศกาลคนจองล่วงหน้า — ทักก่อนห้องเต็ม",
        draft: `ช่วง${f.label}นี้ห้องเริ่มเต็มแล้วค่ะ ${polite(g.name)} จองตรงกับเราตอนนี้ได้ราคาดีกว่าเว็บจองค่ะ`,
      });
    }
  }

  // ลูกค้าที่หายไปนาน — ของนี้มีค่ากว่าวันเกิดเพราะเป็นเงินที่กำลังจะหลุดมือ
  for (const g of guests) {
    if (!g.lastStay || g.stays < 2) continue;
    const gap = Math.round(
      (new Date(today + "T00:00:00").getTime() -
        new Date(g.lastStay + "T00:00:00").getTime()) /
        86400000,
    );
    if (gap >= 180) {
      out.push({
        guest: g,
        kind: "winback",
        label: `หายไป ${Math.floor(gap / 30)} เดือน`,
        why: `เคยมา ${g.stays} ครั้ง ครั้งล่าสุด ${g.lastStay}`,
        draft: `${polite(g.name)} ไม่ได้แวะมานานแล้วนะคะ — เรามีแต้มสะสมของคุณค้างอยู่ ${g.points} แต้ม ใช้แลกได้เลยค่ะ`,
      });
    }
  }

  const rank = { birthday: 0, anniversary: 1, winback: 2, festival: 3 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** คะแนนความพอใจเฉลี่ย — ไม่มีรีวิวเลยต้องตอบ null ไม่ใช่ 0 ซึ่งแปลว่าแย่ */
export function avgScore(guests: Guest[]): number | null {
  const all = guests.flatMap((g) => g.feedback);
  if (!all.length) return null;
  return Math.round((all.reduce((s, f) => s + f.score, 0) / all.length) * 10) / 10;
}

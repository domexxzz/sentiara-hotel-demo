/**
 * ด่านสี่ชั้นก่อนบอทตอบลูกค้า
 *
 * โรงแรมเสี่ยงสองอย่างเวลาปล่อยบอทคุยกับแขก และทั้งสองอย่างแก้ทีหลังไม่ได้
 *   ตอบราคาผิด   = ข้อผูกพันที่โรงแรมต้องรับผิดชอบ
 *   ตอบว่าว่างผิด = ห้องถูกจองซ้ำ
 *
 * การสั่งในคำสั่งระบบว่า "ห้ามแต่งราคา" เป็นการขอร้อง ไฟล์นี้คือคำตัดสิน —
 * อ่านคำตอบที่ร่างไว้กลับมาตรวจกับข้อมูลจริงก่อนถึงตาแขก ไม่ผ่านคือส่งต่อคน
 * ไม่ใช่ส่งออกไปแล้วหวังว่าจะถูก
 */

/** เหตุผลที่ต้องให้คนรับช่วง — ตั้งชื่อเป็นภาษาที่พนักงานอ่านแล้วรู้เรื่องทันที */
export type EscalationReason =
  | "ต่อรองราคา"
  | "ขอคืนเงินหรือเลื่อนวัน"
  | "ร้องเรียนหรือไม่พอใจ"
  | "จัดงานหรืออีเวนต์"
  | "ถามเรื่องเดิมซ้ำ"
  | "ตอบตัวเลขเงินที่ไม่ได้มาจากระบบ"
  | "ตอบเรื่องห้องว่างที่ไม่ตรงปฏิทิน"
  | "รับปากเรื่องที่ยังไม่ได้อนุมัติ"
  | "เกินหน้าต่างเวลาที่ตอบได้";

/** ── ด่าน 1 · คำที่บอทไม่ควรตอบเอง ตรวจก่อนเรียกโมเดลด้วยซ้ำ ────────── */
const TRIGGERS: { reason: EscalationReason; words: string[] }[] = [
  {
    reason: "ต่อรองราคา",
    words: ["ลดได้ไหม", "ลดหน่อย", "ต่อราคา", "ถูกกว่านี้", "ลดราคา", "แพงไป", "ขอส่วนลด"],
  },
  {
    reason: "ขอคืนเงินหรือเลื่อนวัน",
    words: ["คืนเงิน", "ยกเลิก", "เลื่อนวัน", "เปลี่ยนวัน", "ขอเลื่อน", "ไม่ไปแล้ว"],
  },
  {
    reason: "ร้องเรียนหรือไม่พอใจ",
    words: ["ร้องเรียน", "ไม่พอใจ", "แย่มาก", "เสียหาย", "ของหาย", "สกปรก", "เสียงดัง"],
  },
  {
    reason: "จัดงานหรืออีเวนต์",
    words: ["จัดงาน", "อีเวนต์", "งานแต่ง", "สัมมนา", "เหมาทั้งชั้น", "ถ่ายทำ", "ออกกอง"],
  },
];

export const assess = (text: string): EscalationReason | null => {
  const t = (text || "").toLowerCase();
  for (const { reason, words } of TRIGGERS) {
    if (words.some((w) => t.includes(w))) return reason;
  }
  return null;
};

/** ── ด่าน 2 · หน้าต่างเวลาที่ช่องทางนั้นยอมให้ตอบ ────────────────────
 *  แชตของ OTA ผูกกับการจอง ไม่ใช่ผูกกับคน — การจองจบแล้วสายก็ปิด
 *  ต้องรู้ตั้งแต่ก่อนร่างคำตอบ ไม่ใช่ไปเจอตอนกดส่งแล้วข้อความหายเงียบ */
export type SendWindow = { allowed: boolean; reason: string };

export const windowFor = (channel: string, bookingActive: boolean): SendWindow =>
  channel === "web" || channel === "line" || bookingActive
    ? { allowed: true, reason: "" }
    : {
        allowed: false,
        reason: `แชต ${channel} ผูกกับการจองที่ปิดไปแล้ว — ส่งออกไม่ได้`,
      };

/** ── ด่าน 3 · ข้อเท็จจริงที่บอทอ้างอิงได้รอบนี้ ─────────────────────
 *  ว่าง = ห้ามพูดตัวเลขใด ๆ · ไม่ใช่ "ไม่พบข้อมูล" แล้วปล่อยให้เดาต่อ */
export type GroundedFacts = {
  /** ตัวเลขเงินที่พูดได้ — มาจากเรตจริงและยอดบิลจริงเท่านั้น */
  figures: number[];
  /** ห้องว่างที่นับจากปฏิทินจริง · null = รอบนี้ยังไม่ได้ถาม */
  available: number | null;
  /** ช่วงวันที่ที่ตัวเลขข้างบนอ้างถึง */
  range?: string;
  /** ดึงข้อมูลจริงไม่สำเร็จ — ต่างจาก "ถามแล้วได้ศูนย์" */
  lookupFailed?: string;
};

export const emptyFacts: GroundedFacts = { figures: [], available: null };

/** ── ด่าน 4 · อ่านคำตอบกลับมาตรวจ ─────────────────────────────────── */
export type GuardVerdict =
  | { passed: true }
  | { passed: false; reason: EscalationReason; detail: string };

/** ตัวเลขเงินในข้อความ — รับทั้ง "1,980" "฿1980" "1980 บาท" */
const MONEY = /(?:฿\s*)?(\d{1,3}(?:,\d{3})+|\d{3,6})/g;

export const figuresIn = (text: string): number[] => {
  const out: number[] = [];
  for (const m of text.matchAll(MONEY)) {
    const n = Number(m[1].replace(/,/g, ""));
    // ต่ำกว่าร้อยมักเป็นจำนวนคน/คืน/เลขห้อง ไม่ใช่ราคา
    if (n >= 100) out.push(n);
  }
  return out;
};

/** ตรวจก่อนคำว่า "ว่าง" เพราะ "ไม่ว่าง" มีคำว่า "ว่าง" อยู่ข้างใน */
const SAYS_FULL = ["ไม่ว่าง", "เต็มแล้ว", "เต็มหมด", "ถูกจองแล้ว", "มีคนจองแล้ว", "เต็ม"];
const SAYS_FREE = ["ว่าง", "ยังมีห้อง", "จองได้", "เหลือห้อง", "พร้อมให้เข้าพัก"];

export type Claim = "free" | "full" | "none";

export const claimedAvailability = (text: string): Claim => {
  const t = text || "";
  if (SAYS_FULL.some((w) => t.includes(w))) return "full";
  if (SAYS_FREE.some((w) => t.includes(w))) return "free";
  return "none";
};

/** คำรับปากที่พนักงานเท่านั้นให้ได้ */
const PROMISES = ["รับรอง", "การันตี", "อัปเกรดให้", "ฟรีให้", "จัดให้แน่นอน", "ยืนยันได้เลย"];

export function checkGrounded(draft: string, facts: GroundedFacts): GuardVerdict {
  const promise = PROMISES.find((p) => draft.includes(p));
  if (promise) {
    return {
      passed: false,
      reason: "รับปากเรื่องที่ยังไม่ได้อนุมัติ",
      detail: `คำตอบมีคำว่า “${promise}” ซึ่งเป็นการรับปากที่ต้องให้พนักงานเป็นคนให้`,
    };
  }

  const said = figuresIn(draft);
  const stray = said.find((n) => !facts.figures.includes(n));
  if (stray !== undefined) {
    return {
      passed: false,
      reason: "ตอบตัวเลขเงินที่ไม่ได้มาจากระบบ",
      detail: `คำตอบพูดถึง ฿${stray.toLocaleString("en-US")} ซึ่งไม่มีในเรตจริง${
        facts.figures.length
          ? ` — ระบบมีแค่ ${facts.figures.map((f) => "฿" + f.toLocaleString("en-US")).join(" · ")}`
          : " และรอบนี้ยังไม่ได้ถามราคาจากระบบเลย"
      }`,
    };
  }

  const claim = claimedAvailability(draft);
  if (claim !== "none") {
    if (facts.lookupFailed) {
      return {
        passed: false,
        reason: "ตอบเรื่องห้องว่างที่ไม่ตรงปฏิทิน",
        detail: `คำตอบพูดเรื่องห้องว่างทั้งที่ดึงปฏิทินไม่สำเร็จ — ${facts.lookupFailed}`,
      };
    }
    if (facts.available === null) {
      return {
        passed: false,
        reason: "ตอบเรื่องห้องว่างที่ไม่ตรงปฏิทิน",
        detail: "คำตอบพูดเรื่องห้องว่างทั้งที่รอบนี้ยังไม่ได้ถามปฏิทิน",
      };
    }
    const actually: Claim = facts.available > 0 ? "free" : "full";
    if (claim !== actually) {
      return {
        passed: false,
        reason: "ตอบเรื่องห้องว่างที่ไม่ตรงปฏิทิน",
        detail:
          actually === "full"
            ? `คำตอบบอกว่าว่าง แต่ปฏิทิน${facts.range ? " " + facts.range : ""}เต็มแล้ว — นี่คือจุดที่เกิดการจองซ้ำ`
            : `คำตอบบอกว่าเต็ม แต่ปฏิทิน${facts.range ? " " + facts.range : ""}ยังเหลือ ${facts.available} ห้อง — เสียการขายฟรี ๆ`,
      };
    }
  }

  return { passed: true };
}

/** ผลรวมของทั้งสี่ด่าน */
export type Decision = {
  send: boolean;
  text: string;
  /** ด่านที่ตัดสิน — ใช้โชว์ให้พนักงานเห็นว่าทำไมถึงไม่ส่ง */
  gate: 1 | 2 | 3 | 4 | null;
  reason?: EscalationReason;
  detail?: string;
};

export function decide(args: {
  incoming: string;
  draft: string;
  facts: GroundedFacts;
  channel: string;
  bookingActive: boolean;
  repeated?: boolean;
}): Decision {
  const { incoming, draft, facts, channel, bookingActive, repeated } = args;

  const trigger = assess(incoming);
  if (trigger) {
    return {
      send: false,
      text: draft,
      gate: 1,
      reason: trigger,
      detail: `ลูกค้าพิมพ์เรื่อง “${trigger}” — เรื่องแบบนี้ให้คนตอบเสมอ`,
    };
  }
  if (repeated) {
    return {
      send: false,
      text: draft,
      gate: 1,
      reason: "ถามเรื่องเดิมซ้ำ",
      detail: "ถามซ้ำแปลว่าคำตอบก่อนหน้ายังไม่ตรงใจ — ให้คนอ่านเอง",
    };
  }

  const win = windowFor(channel, bookingActive);
  if (!win.allowed) {
    return {
      send: false,
      text: draft,
      gate: 2,
      reason: "เกินหน้าต่างเวลาที่ตอบได้",
      detail: win.reason,
    };
  }

  if (facts.lookupFailed) {
    return {
      send: false,
      text: draft,
      gate: 3,
      reason: "ตอบเรื่องห้องว่างที่ไม่ตรงปฏิทิน",
      detail: `ดึงข้อมูลจริงไม่สำเร็จ — ${facts.lookupFailed}`,
    };
  }

  const verdict = checkGrounded(draft, facts);
  if (!verdict.passed) {
    return { send: false, text: draft, gate: 4, reason: verdict.reason, detail: verdict.detail };
  }
  return { send: true, text: draft, gate: null };
}

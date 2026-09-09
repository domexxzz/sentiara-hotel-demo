/**
 * ความปลอดภัยและงานกฎหมาย
 *
 * "เรื่องที่ไม่มีใครนึกถึงจนกว่าจะมีปัญหา — และตอนนั้นย้อนกลับไปแก้ไม่ได้แล้ว"
 *
 * สามเรื่องในไฟล์นี้ต่างกันคนละแบบ แต่มีสิ่งเดียวกันคือ **หลักฐานต้องตรวจย้อนได้**
 * กล้องที่ดูสดได้แต่ไล่ย้อนไม่ได้ · อุปกรณ์ที่ต่อเน็ตได้แต่ไม่รู้ว่าปลอดภัยไหม ·
 * คำตอบทางกฎหมายที่ฟังดูดีแต่อ้างมาตราไม่ได้ — ทั้งสามอย่างมีค่าเท่ากับไม่มี
 */

/* ── กล้องวงจรปิด ──────────────────────────────────────────────────── */

/**
 * เหตุการณ์จากกล้อง **ที่ผูกกับห้องและการจองแล้ว**
 *
 * คุณค่าไม่ได้อยู่ที่ดูภาพสดได้ — จอกล้องอย่างเดียวมีขายทั่วไป
 * อยู่ที่ตอนมีเรื่อง คนถามว่า "คืนวันที่ 7 ห้อง 208 ใครเข้าออกบ้าง"
 * แล้วตอบได้ทันทีโดยไม่ต้องไล่ดูวิดีโอทีละชั่วโมง
 */
export type CamEvent = {
  id: string;
  at: string;
  camera: string;
  zone: string;
  kind: "card" | "door" | "motion" | "face";
  headline: string;
  room?: string;
  bookingRef?: string;
  guest?: string;
  /** low = บันทึกไว้เฉย ๆ · high = ต้องมีคนดู */
  level: "low" | "high";
  clip: string;
};

export const CAM_EVENTS: CamEvent[] = [
  {
    id: "EV-9012", at: "2026-09-08 02:14", camera: "CAM-03", zone: "ทางเดินชั้น 2",
    kind: "card", headline: "แตะบัตรผิดห้อง 3 ครั้งติด แล้วเดินออก",
    room: "208", bookingRef: "BK-7C41A9", guest: "คุณอนันต์ ศรีสุข",
    level: "high", clip: "02:13:48 – 02:15:20",
  },
  {
    id: "EV-9013", at: "2026-09-08 02:31", camera: "CAM-03", zone: "ทางเดินชั้น 2",
    kind: "door", headline: "ประตูค้างเปิด 12 นาที",
    room: "210", bookingRef: "BK-2F80B3", guest: "คุณมาลี ทองดี",
    level: "high", clip: "02:31:02 – 02:43:10",
  },
  {
    id: "EV-9014", at: "2026-09-08 03:02", camera: "CAM-01", zone: "ล็อบบี้",
    kind: "motion", headline: "มีคนอยู่ในล็อบบี้นอกเวลาเปิด",
    level: "low", clip: "03:02:11 – 03:04:55",
  },
  {
    id: "EV-9015", at: "2026-09-08 07:45", camera: "CAM-07", zone: "ประตูหลัง",
    kind: "card", headline: "บัตรพนักงานเข้าประตูหลัง",
    level: "low", clip: "07:45:02 – 07:45:30",
  },
];

/* ── ตรวจความปลอดภัยอุปกรณ์ ─────────────────────────────────────────── */

export type Device = {
  id: string;
  name: string;
  vendor: string;
  firmware: string;
  releasedOn: string;
  /** ยังใช้รหัสผ่านที่ติดมาจากโรงงานอยู่ไหม */
  defaultPassword: boolean;
  /** พอร์ตที่เปิดอยู่ */
  ports: number[];
  upnp: boolean;
  /** ผ่านการตรวจแล้วให้เข้าเครือข่ายโรงแรมได้ */
  approved: boolean;
};

export const DEVICES: Device[] = [
  { id: "D-01", name: "กล้อง CAM-03 ทางเดินชั้น 2", vendor: "Dahua", firmware: "2.800.15", releasedOn: "2024-03-11", defaultPassword: false, ports: [80, 554], upnp: false, approved: true },
  { id: "D-02", name: "กล้อง CAM-09 ลานจอดรถ", vendor: "Dahua", firmware: "2.622.03", releasedOn: "2021-06-02", defaultPassword: true, ports: [23, 80, 554, 37777], upnp: true, approved: false },
  { id: "D-03", name: "กลอนประตู NFC ห้อง 208", vendor: "Sentiara", firmware: "1.4.2", releasedOn: "2026-05-20", defaultPassword: false, ports: [], upnp: false, approved: true },
  { id: "D-04", name: "มิเตอร์ไฟ ชั้น 3", vendor: "Tuya", firmware: "0.9.7", releasedOn: "2022-11-30", defaultPassword: false, ports: [6668], upnp: true, approved: false },
];

export type Finding = { level: "block" | "warn"; what: string; why: string };

/** พอร์ตที่ไม่ควรเปิดบนเครือข่ายโรงแรม */
const RISKY_PORTS: Record<number, string> = {
  23: "Telnet · ส่งรหัสผ่านเป็นข้อความเปล่า ใครดักสายได้ก็อ่านได้",
  37777: "พอร์ตจัดการของผู้ผลิต · เคยมีช่องโหว่ที่ข้ามการยืนยันตัวตนได้",
  6668: "พอร์ตควบคุมของ Tuya · เปิดออกอินเทอร์เน็ตแล้วสั่งอุปกรณ์ได้จากภายนอก",
};

/** เฟิร์มแวร์ที่เก่ากว่านี้ถือว่าไม่ได้รับแพตช์แล้ว */
export const FIRMWARE_CUTOFF = "2023-01-01";

/**
 * ตรวจอุปกรณ์หนึ่งตัวก่อนให้เข้าเครือข่าย
 *
 * `block` = ห้ามต่อจนกว่าจะแก้ · `warn` = ต่อได้แต่ต้องรู้ตัว
 * แยกสองระดับเพราะถ้าทุกอย่างเป็น "เตือน" หมด สุดท้ายไม่มีใครแก้อะไรเลย
 */
export function audit(d: Device): Finding[] {
  const out: Finding[] = [];
  if (d.defaultPassword)
    out.push({
      level: "block",
      what: "ยังใช้รหัสผ่านจากโรงงาน",
      why: "รหัสของทุกรุ่นหาได้จากคู่มือบนเว็บ · เท่ากับไม่ได้ตั้งรหัสเลย",
    });
  for (const p of d.ports)
    if (RISKY_PORTS[p])
      out.push({ level: p === 23 ? "block" : "warn", what: `พอร์ต ${p} เปิดอยู่`, why: RISKY_PORTS[p] });
  if (d.releasedOn < FIRMWARE_CUTOFF)
    out.push({
      level: "block",
      what: `เฟิร์มแวร์ ${d.firmware} ออกเมื่อ ${d.releasedOn}`,
      why: "เก่ากว่ารอบแพตช์ล่าสุด · ช่องโหว่ที่ประกาศหลังจากนั้นยังไม่ถูกปิด",
    });
  if (d.upnp)
    out.push({
      level: "warn",
      what: "เปิด UPnP",
      why: "อุปกรณ์เปิดพอร์ตบนเราเตอร์ได้เอง โดยไม่มีใครสั่งและไม่มีใครรู้",
    });
  return out;
}

export const canJoinNetwork = (d: Device) => !audit(d).some((f) => f.level === "block");

/* ── ผู้ช่วยงานกฎหมาย ──────────────────────────────────────────────── */

export type Contract = {
  party: string;
  kind: string;
  signedOn: string;
  endsOn: string;
  /** ต้องบอกล่วงหน้ากี่วันถ้าจะไม่ต่อ */
  noticeDays: number;
};

export const CONTRACTS: Contract[] = [
  { party: "Agoda", kind: "สัญญาช่องทางจอง", signedOn: "2025-01-15", endsOn: "2026-12-31", noticeDays: 60 },
  { party: "บริษัท รักษาความปลอดภัย เชียงใหม่", kind: "จ้างเหมาบริการ", signedOn: "2025-10-01", endsOn: "2026-09-30", noticeDays: 30 },
  { party: "ซักรีดสะอาดใส", kind: "จ้างเหมาบริการ", signedOn: "2026-03-01", endsOn: "2027-02-28", noticeDays: 30 },
];

/** เหลือกี่วันก่อนถึงวันที่ต้องบอกล่วงหน้า · ติดลบ = เลยกำหนดบอกแล้ว */
export function daysToNotice(c: Contract, today: string): number {
  const end = new Date(c.endsOn).getTime();
  const deadline = end - c.noticeDays * 86400000;
  return Math.round((deadline - new Date(today).getTime()) / 86400000);
}

/**
 * คลังกฎหมายที่ผู้ช่วยอ้างอิงได้
 *
 * **ผู้ช่วยตอบได้เฉพาะเรื่องที่มีอยู่ในคลังนี้** ถามนอกคลังต้องตอบว่าไม่รู้
 * ไม่ใช่เดาให้ฟังดูดี — คำตอบทางกฎหมายที่อ้างมาตราไม่ได้ มีค่าเท่ากับไม่มี
 * และอันตรายกว่า เพราะคนเอาไปทำตาม
 */
export type Source = { law: string; section: string; text: string; tags: string[] };

export const SOURCES: Source[] = [
  {
    law: "พ.ร.บ.โรงแรม พ.ศ. 2547", section: "มาตรา 35",
    text: "ผู้จัดการต้องจัดให้มีบัตรทะเบียนผู้พักและทะเบียนผู้พัก บันทึกให้แล้วเสร็จภายในยี่สิบสี่ชั่วโมงนับแต่เวลาที่ผู้พักเข้าพัก และเก็บรักษาไว้ไม่น้อยกว่าหนึ่งปี",
    tags: ["ทะเบียนผู้พัก", "ร.ร.3", "ร.ร.4", "24 ชั่วโมง", "เก็บกี่ปี"],
  },
  {
    law: "พ.ร.บ.คนเข้าเมือง พ.ศ. 2522", section: "มาตรา 38",
    text: "เจ้าบ้าน เจ้าของ หรือผู้ครอบครองเคหสถาน ซึ่งคนต่างด้าวเข้าพักอาศัย ต้องแจ้งต่อพนักงานเจ้าหน้าที่ภายในยี่สิบสี่ชั่วโมงนับแต่เวลาที่คนต่างด้าวเข้าพักอาศัย",
    tags: ["ตม.30", "คนต่างด้าว", "ต่างชาติ", "แจ้งที่พัก"],
  },
  {
    law: "ประมวลรัษฎากร", section: "มาตรา 86/4",
    text: "ใบกำกับภาษีต้องมีรายการอย่างน้อยตามที่กำหนด รวมถึงจำนวนภาษีมูลค่าเพิ่มที่คำนวณจากมูลค่าของสินค้าหรือบริการ โดยให้แยกออกจากมูลค่าของสินค้าหรือของบริการให้ชัดแจ้ง",
    tags: ["ใบกำกับภาษี", "vat", "ภาษีมูลค่าเพิ่ม", "แยกภาษี"],
  },
  {
    law: "ประมวลรัษฎากร", section: "มาตรา 78/1 (1)",
    text: "ความรับผิดในการเสียภาษีมูลค่าเพิ่มสำหรับการให้บริการ เกิดขึ้นเมื่อได้รับชำระราคาค่าบริการ",
    tags: ["มัดจำ", "จุดความรับผิด", "รับเงินล่วงหน้า", "vat ค่าบริการ"],
  },
  {
    law: "พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562", section: "มาตรา 37",
    text: "ผู้ควบคุมข้อมูลส่วนบุคคลมีหน้าที่จัดให้มีมาตรการรักษาความมั่นคงปลอดภัยที่เหมาะสม และป้องกันการสูญหาย เข้าถึง ใช้ เปลี่ยนแปลง แก้ไข หรือเปิดเผยโดยมิชอบ",
    tags: ["pdpa", "กล้องวงจรปิด", "ข้อมูลส่วนบุคคล", "cctv", "เก็บภาพ"],
  },
];

export type Answer = { found: boolean; source?: Source; note: string };

/**
 * ตอบคำถามจากคลังเท่านั้น
 *
 * **ไม่เจอแหล่งอ้างอิง = ไม่ตอบ** ซึ่งเป็นพฤติกรรมที่ตั้งใจ ไม่ใช่ข้อจำกัด
 * ผู้ช่วยที่เดาคำตอบทางกฎหมายให้ฟังดูมั่นใจ อันตรายกว่าผู้ช่วยที่บอกว่าไม่รู้
 */
export function ask(q: string): Answer {
  const text = q.toLowerCase().trim();
  if (!text) return { found: false, note: "พิมพ์คำถามก่อน" };
  const hit = SOURCES.find((s) => s.tags.some((t) => text.includes(t.toLowerCase())));
  if (!hit)
    return {
      found: false,
      note: "ไม่มีแหล่งอ้างอิงในคลังสำหรับคำถามนี้ — ไม่ตอบ เพราะคำตอบทางกฎหมายที่อ้างมาตราไม่ได้ อันตรายกว่าไม่ตอบ",
    };
  return { found: true, source: hit, note: "ตอบจากตัวบทโดยตรง กดดูมาตราเต็มได้" };
}

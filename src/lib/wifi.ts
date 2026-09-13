/** Wi-Fi ที่พัก — กติกาและข้อมูลตัวอย่างสำหรับโหมดสาธิต
 *
 * ตัวเลขและกติกาทุกข้อยกมาจากหลังบ้านจริง (`server/pms/wifi.py`) ไม่ได้ตั้งใหม่
 * ให้จอดูดี — ถ้าสองฝั่งไม่ตรงกัน ลูกค้าที่ซื้อไปแล้วจะเจอของคนละอย่างกับที่
 * กดเล่นตอนตัดสินใจ
 *
 * ทำไมโรงแรมต้องมีชั้นนี้
 * ------------------------
 * ม.26 พ.ร.บ.คอมพิวเตอร์ พ.ศ. 2550 ให้ผู้ให้บริการเก็บข้อมูลจราจรไม่น้อยกว่า
 * 90 วัน โทษปรับไม่เกินห้าแสนบาท · อุปกรณ์เครือข่ายเก็บได้ดีอยู่แล้วว่า
 * "MAC ไหนทำอะไร" แต่ตอบไม่ได้ว่า "MAC นั้นคือใคร" — ชิ้นที่หายไปคือทะเบียน
 * ผู้พัก ซึ่งอยู่ใน PMS · ระบบนี้จึงเป็นชั้น "ใคร" ไม่ใช่ชั้น "ทำอะไร"
 */

/** ผ่อนผันหลังเช็กเอาต์ · แขกยังยืนรอแท็กซี่อยู่ที่ล็อบบี้ ตัดทันทีคือใจร้าย */
export const GRACE_HOURS = 3;

/** มือถือ โน้ตบุ๊ก แท็บเล็ต — พอสำหรับห้องหนึ่ง และกันเอารหัสไปแจกต่อ */
export const DEVICE_LIMIT = 3;

/** กฎหมายกำหนดเป็น "พื้น" ไม่ใช่ค่าที่ปรับลงได้ */
export const MIN_RETENTION_DAYS = 90;

/** ตัด i l o s z 0 1 5 ออก — อ่านผิดแล้วแขกโทรมาหาเคาน์เตอร์ */
export const ALPHABET = "abcdefghjkmnpqrtuvwxy2346789";

export type Cred = {
  ref: string;
  /** ชื่อผู้ใช้คือเลขห้อง — รหัสรวมทั้งตึกโยงกลับไปหาคนไม่ได้ */
  room: string;
  guest: string;
  secret: string;
  validFrom: string;
  validUntil: string;
  limit: number;
  revoked: boolean;
};

export type Session = {
  id: string;
  room: string;
  mac: string;
  ip: string;
  nas: string;
  startedAt: string;
  endedAt: string | null;
  mb: number;
};

/** ผู้พักหนึ่งคนต่อหนึ่งแถว ตาม ม.35 พ.ร.บ.โรงแรม — ไม่ใช่หนึ่งการจองต่อแถว
 *  ห้องที่มีผู้ใหญ่สองคนต้องตอบเจ้าหน้าที่ได้ทั้งสองคน */
export type Occupant = { name: string; nationality: string; doc: string };

export type WifiState = {
  creds: Cred[];
  sessions: Session[];
  occupants: Record<string, Occupant[]>;
  retentionDays: number;
};

const iso = (d: string, t: string) => `${d}T${t}:00+07:00`;

export const DEMO: WifiState = {
  retentionDays: 90,
  creds: [
    { ref: "BK-6F2A91", room: "402", guest: "Mr. James Whitfield", secret: "kq7n3x",
      validFrom: iso("2026-08-12", "14:00"), validUntil: iso("2026-08-16", "15:00"), limit: 3, revoked: false },
    { ref: "BK-71C0D4", room: "207", guest: "คุณกัญญารัตน์ พงษ์ไพบูลย์", secret: "w4gh2q",
      validFrom: iso("2026-08-13", "15:20"), validUntil: iso("2026-08-15", "15:00"), limit: 3, revoked: false },
    { ref: "BK-4B8E07", room: "508", guest: "Mr. Chen Wei Lin", secret: "t6bmxy",
      validFrom: iso("2026-07-04", "13:10"), validUntil: iso("2026-07-07", "15:00"), limit: 3, revoked: false },
    { ref: "BK-90A3C2", room: "305", guest: "Tanaka H.", secret: "j9pr4d",
      validFrom: iso("2026-08-10", "14:40"), validUntil: iso("2026-08-12", "15:00"), limit: 3, revoked: true },
  ],
  sessions: [
    { id: "s1", room: "402", mac: "a4:83:e7:1c:9f:20", ip: "10.24.7.113", nas: "AP-ชั้น4-ทางเดิน",
      startedAt: iso("2026-08-14", "09:02"), endedAt: null, mb: 812 },
    { id: "s2", room: "402", mac: "f0:9f:c2:55:aa:10", ip: "10.24.7.118", nas: "AP-ชั้น4-ทางเดิน",
      startedAt: iso("2026-08-14", "09:40"), endedAt: null, mb: 96 },
    { id: "s3", room: "207", mac: "3c:22:fb:04:8a:d1", ip: "10.24.7.58", nas: "AP-ชั้น2-ลิฟต์",
      startedAt: iso("2026-08-14", "08:12"), endedAt: null, mb: 145 },
    { id: "s4", room: "207", mac: "b8:27:eb:71:03:4f", ip: "10.24.7.61", nas: "AP-ชั้น2-ลิฟต์",
      startedAt: iso("2026-08-13", "21:30"), endedAt: iso("2026-08-14", "07:05"), mb: 1230 },
    // เช็กเอาต์ไปแล้ว 38 วัน แต่ยังอยู่ในช่วงเก็บ 90 วัน — นี่คือเหตุผลของกฎนั้น
    { id: "s5", room: "508", mac: "f0:18:98:77:12:6e", ip: "10.24.7.201", nas: "AP-ชั้น5-ห้องพัก",
      startedAt: iso("2026-07-06", "02:07"), endedAt: iso("2026-07-06", "03:44"), mb: 2394 },
  ],
  occupants: {
    "BK-6F2A91": [
      { name: "Mr. James Whitfield", nationality: "สหราชอาณาจักร", doc: "พาสปอร์ต 536214897" },
      { name: "Mrs. Clara Whitfield", nationality: "สหราชอาณาจักร", doc: "พาสปอร์ต 536214901" },
    ],
    "BK-71C0D4": [
      { name: "คุณกัญญารัตน์ พงษ์ไพบูลย์", nationality: "ไทย", doc: "บัตรประชาชน 1-1017-00207-25-1" },
    ],
    "BK-4B8E07": [
      { name: "Mr. Chen Wei Lin", nationality: "จีน", doc: "พาสปอร์ต E48127395" },
    ],
    "BK-90A3C2": [
      { name: "Tanaka H.", nationality: "ญี่ปุ่น", doc: "พาสปอร์ต TK1234567" },
    ],
  },
};

/** เวลาในโหมดสาธิต — ตรึงไว้ให้ตรงกับจออื่นทั้งระบบ (src/lib/date.ts) */
export const NOW = iso("2026-08-14", "10:30");

export const normMac = (mac: string) => mac.replace(/[^0-9a-fA-F]/g, "").toLowerCase();

export function makeSecret(pick: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(pick() * ALPHABET.length)];
  return out;
}

/** เวลาหมดอายุ = เวลาเช็กเอาต์ + ผ่อนผัน */
export function expiryOf(checkoutIso: string, graceHours = GRACE_HOURS): string {
  const d = new Date(checkoutIso);
  d.setHours(d.getHours() + graceHours);
  return d.toISOString();
}

export type AuthOk = {
  ok: true;
  room: string;
  guest: string;
  ref: string;
  devicesOnline: number;
  limit: number;
};
export type AuthNo = { ok: false; reason: string };

/** อุปกรณ์ถามว่า "ให้เครื่องนี้ต่อได้ไหม"
 *
 * ปฏิเสธด้วยข้อความเดียวกันทุกกรณีที่เกี่ยวกับรหัส — ใครยืนที่ล็อบบี้แล้วลอง
 * สุ่มเลขห้องต้องไม่ได้ข้อมูลกลับไปว่าห้องไหนมีแขกอยู่จริง
 * ยกเว้นกรณีเครื่องเต็ม ซึ่งบอกตรง ๆ ได้เพราะคนถามถือรหัสที่ถูกต้องอยู่แล้ว
 */
export function authorize(
  state: WifiState,
  input: { room: string; secret: string; mac: string },
  now: string = NOW,
): AuthOk | AuthNo {
  const deny: AuthNo = { ok: false, reason: "รหัสไม่ถูกต้องหรือหมดอายุแล้ว" };
  const cred = state.creds.find((c) => c.room === input.room.trim());
  if (!cred || cred.revoked) return deny;
  if (cred.secret !== input.secret.trim().toLowerCase()) return deny;

  const t = new Date(now).getTime();
  if (t < new Date(cred.validFrom).getTime() || t > new Date(cred.validUntil).getTime()) return deny;

  const key = normMac(input.mac);
  if (!key) return { ok: false, reason: "อุปกรณ์ไม่ได้ส่งหมายเลข MAC มา — โยง session กลับไปหาคนไม่ได้" };

  // เครื่องเดิมกลับมาต่อใหม่ไม่นับเพิ่ม
  const active = new Set(
    state.sessions.filter((s) => s.room === cred.room && !s.endedAt).map((s) => normMac(s.mac)),
  );
  if (!active.has(key) && active.size >= cred.limit) {
    return {
      ok: false,
      reason: `ห้อง ${cred.room} ต่อได้ ${cred.limit} เครื่อง และตอนนี้ต่ออยู่ครบแล้ว — ` +
        "ปิดเครื่องที่ไม่ใช้ หรือแจ้งเคาน์เตอร์เพิ่มจำนวน",
    };
  }
  return { ok: true, room: cred.room, guest: cred.guest, ref: cred.ref, devicesOnline: active.size, limit: cred.limit };
}

export type Identity = {
  session: Session;
  cred: Cred;
  /** ผู้พักทุกคนในห้องนั้น ไม่ใช่คนเดียว — รหัสผูกกับห้อง การเดาว่าเป็นคนแรก
   *  ในทะเบียนคือการชี้ตัวคนที่อาจไม่ได้ถือเครื่องนั้น */
  occupants: Occupant[];
  daysKept: number;
  /** ยังอยู่ในช่วงที่กฎหมายบังคับให้เก็บไหม */
  withinRetention: boolean;
};

export function identityOf(state: WifiState, sessionId: string, now: string = NOW): Identity | null {
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const cred = state.creds.find((c) => c.room === session.room);
  if (!cred) return null;
  const days = Math.floor((new Date(now).getTime() - new Date(session.startedAt).getTime()) / 86_400_000);
  return {
    session,
    cred,
    occupants: state.occupants[cred.ref] ?? [],
    daysKept: days,
    withinRetention: days <= state.retentionDays,
  };
}

/** ตั้งเวลาเก็บต่ำกว่าที่กฎหมายกำหนดไม่ได้
 *  ตัวกันนี้มีเพราะการตั้งค่าผิดจะทำให้ผิดกฎหมาย **เงียบ ๆ** ไม่มีอะไรฟ้อง
 *  จนกว่าเจ้าหน้าที่จะมาขอแล้วเราไม่มีให้ */
export function setRetention(days: number): { ok: boolean; reason?: string } {
  if (!Number.isFinite(days) || days < MIN_RETENTION_DAYS) {
    return {
      ok: false,
      reason: `เก็บได้ไม่ต่ำกว่า ${MIN_RETENTION_DAYS} วัน — ม.26 พ.ร.บ.คอมพิวเตอร์ กำหนดไว้เป็นพื้น ไม่ใช่ค่าที่ปรับลงได้`,
    };
  }
  return { ok: true };
}

export const onlineNow = (state: WifiState) => state.sessions.filter((s) => !s.endedAt);

export const fmtTime = (i: string) =>
  new Date(i).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const fmtMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`);

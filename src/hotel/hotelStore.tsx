import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer,
  useState, type ReactNode,
} from "react";
import { ROOM_RACK, type DeskRoom, type RoomStatus } from "../desk/deskData";
import { TODAY, addDays, nightsBetween } from "../lib/date";
import { HOTEL } from "../data";
import { stayTotal, rateForNight, setWeekendPct } from "../lib/rates";
import { setVatPct } from "../lib/tax";
import { decide, emptyFacts, type Decision, type GroundedFacts } from "../lib/replyGuard";
import { STAFF, staffByCard, type Staff } from "../lib/roles";
import { LONGSTAY_TIER, TIERS, tierIndexOf, type PropertyMode } from "../lib/property";
import { DEFAULT_SETTINGS, rateOf, type Settings } from "../lib/settings";
import { type Expense, type Receivable } from "../lib/finance";
import { pointsFor, type Feedback, type Guest } from "../lib/loyalty";
import { canPersist, load, save, wipe } from "../lib/persist";
import { useBackend } from "../lib/backend";
import { ApiError } from "../lib/api";
import { pull, push } from "./sync";

// ── Types ─────────────────────────────────────────────────────────────
export type BookingStatus = "confirmed" | "inhouse" | "checkedout";
export type BookingSource = "direct" | "walkin" | "ota" | "line";

export type Booking = {
  paid?: number;
  balance?: number;
  id: string;
  guest: string;
  roomType: string;
  room?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rate: number; // ต่อคืน
  deposit: number;
  status: BookingStatus;
  source: BookingSource;
  foreign?: boolean;
  note?: string;
};

export type BillLine = {
  id: string;
  label: string;
  note?: string;
  qty: number;
  price: number;
  /** ที่มาของรายการ — ใช้แยกรายงานห้อง vs ร้านอาหาร */
  kind: "room" | "fnb" | "service";
};

/** ── กล่องข้อความรวม ─────────────────────────────────────────────────
 *  ตัวตนของห้องแชตคือ (channel, externalId) ส่วนช่องทางเป็นแค่คุณสมบัติ
 *  หน้าจอไม่ต้องรู้ว่าข้อความมาจากไหน เพิ่มช่องใหม่ = เพิ่ม adapter สองฝั่ง */
export type ChatChannel = "web" | "line" | "booking" | "airbnb" | "agoda" | "walkin";

export type ChatMessage = {
  id: string;
  convId: string;
  direction: "in" | "out";
  text: string;
  at: string;
  /** ใครเป็นคนส่ง — ว่าง = ลูกค้า, "bot" = บอท, ชื่อ = พนักงาน */
  sentBy?: string;
};

export type Conversation = {
  id: string;
  channel: ChatChannel;
  /** รหัสฝั่งแพลตฟอร์ม · OTA ใช้รหัสการจอง หนึ่งการจอง = หนึ่งห้องแชต */
  externalId: string;
  guest: string;
  /** ผูกกับการจองได้ = รู้ห้อง วันเข้าพัก และยอดบิลของคนที่กำลังคุยอยู่ */
  bookingId?: string;
  lastText: string;
  lastAt: string;
  unread: number;
  /** งานค้างที่บอทตอบเองไม่ได้ — ต้องมีคนมารับช่วง */
  handover?: { gate: number; reason: string; detail: string; draft: string };
};

/** ทุกการแตะบัตร/ออกบัตร มีร่องรอยเสมอ */
export type CardEvent = {
  id: string;
  at: string;
  room: string;
  who: string;
  kind: "issue" | "enter" | "denied" | "expire" | "staff";
  note?: string;
};

export type WoStatus = "open" | "doing" | "paused" | "done";

export type WorkOrder = {
  id: string;
  room: string;
  label: string;
  from: string;
  urgent?: boolean;
  status: WoStatus;
  photos: string[];
  parts: string[];
  cost: number;
  note?: string;
};

type State = {
  rooms: DeskRoom[];
  bookings: Booking[];
  /** บิลที่ยังเปิดอยู่ แยกตามเลขห้อง */
  bills: Record<string, BillLine[]>;
  /** บิลที่ปิดแล้ว — ใช้คิดรายได้ฝั่งเจ้าของ */
  closed: { room: string; guest: string; lines: BillLine[]; total: number }[];
  /** ประวัติการยกเลิก + คืนเงิน (มีร่องรอยเสมอ แก้เงียบ ๆ ไม่ได้) */
  refunds: { id: string; guest: string; amount: number; reason: string }[];
  cardEvents: CardEvent[];
  /** พนักงานที่ล็อกอินอยู่ · null = โหมดสาธิต เปิดได้ทุกจอ */
  session: Staff | null;
  /** โรงแรม หรือ คอนโดปล่อยเช่ารายวัน — ต่างกันที่ชั้นแสดงผล ระบบหลังบ้านเดียวกัน */
  mode: PropertyMode;
  conversations: Conversation[];
  messages: ChatMessage[];
  /** ใบงานช่าง — แม่บ้าน เคาน์เตอร์ และเจ้าของสั่งได้หมด ช่างเห็นที่เดียว */
  workOrders: WorkOrder[];
  /** ค่าที่เจ้าของแก้เองได้ — ราคา เรตวันหยุด VAT มัดจำ */
  settings: Settings;
  expenses: Expense[];
  /** บิลที่ปิดแล้วแต่เก็บเงินไม่ครบ */
  receivables: Receivable[];
  /** ลูกค้าเดิม พร้อมประวัติเข้าพัก แต้ม และรีวิว */
  guests: Guest[];
  /** พนักงาน — แก้ไขได้จริง ไม่ใช่ค่าคงที่ในโค้ดเหมือนเดิม */
  staff: Staff[];
};

type Action =
  | { type: "CREATE_BOOKING"; booking: Omit<Booking, "id" | "status"> & { id?: string } }
  | { type: "CHECK_IN"; bookingId: string; room: string }
  | { type: "ADD_CHARGE"; room: string; line: Omit<BillLine, "id" | "qty"> & { qty?: number } }
  | { type: "CHECK_OUT"; room: string }
  | { type: "ADD_PAYMENT"; room: string; amount: number; method: "cash" | "card" | "transfer" }
  | { type: "SET_ROOM"; room: string; patch: Partial<DeskRoom> }
  | { type: "MOVE_ROOM"; from: string; to: string }
  | { type: "CHANGE_DATES"; bookingId: string; checkIn: string; checkOut: string }
  | { type: "EDIT_BOOKING"; bookingId: string; patch: Partial<Booking> }
  | { type: "CANCEL"; bookingId: string; refund: number }
  | { type: "INGEST"; channel: ChatChannel; externalId: string; text: string;
      direction?: "in" | "out"; guest?: string; bookingId?: string; sentBy?: string }
  | { type: "HANDOVER"; convId: string; gate: number; reason: string; detail: string; draft: string }
  | { type: "CLEAR_HANDOVER"; convId: string }
  | { type: "READ_CONV"; convId: string }
  | { type: "SIGN_IN"; card: string }
  | { type: "SIGN_OUT" }
  | { type: "SET_MODE"; mode: PropertyMode }
  | { type: "CARD_TAP"; room: string; who: string; staff?: boolean }
  | { type: "ADD_WO"; wo: Omit<WorkOrder, "status" | "photos" | "parts" | "cost"> }
  | { type: "WO_PATCH"; id: string; patch: Partial<WorkOrder> }
  | { type: "SET_SETTINGS"; patch: Partial<Settings> }
  | { type: "ADD_EXPENSE"; expense: Omit<Expense, "id"> }
  | { type: "PATCH_EXPENSE"; id: string; patch: Partial<Expense> }
  | { type: "DEL_EXPENSE"; id: string }
  | { type: "SETTLE_RECEIVABLE"; id: string }
  | { type: "ADD_STAFF"; staff: Omit<Staff, "id"> }
  | { type: "PATCH_STAFF"; id: string; patch: Partial<Staff> }
  | { type: "DEL_STAFF"; id: string }
  | { type: "ADD_FEEDBACK"; guestId: string; feedback: Feedback }
  | { type: "REDEEM"; guestId: string; rewardId: string; cost: number; label: string }
  | { type: "RESET" }
  /** เทข้อมูลจากหลังบ้านทับของเดิมทั้งชุด · เซิร์ฟเวอร์เป็นแหล่งความจริง */
  | { type: "HYDRATE"; rooms: DeskRoom[]; bookings: Booking[];
      bills: Record<string, BillLine[]>; settings?: Settings };

// ── Seed ──────────────────────────────────────────────────────────────
const SEED_BOOKINGS: Booking[] = [
  {
    id: "B-2402",
    guest: "Tanaka Hiroshi",
    roomType: "ซูพีเรียร์",
    room: "404",
    checkIn: TODAY,
    checkOut: addDays(TODAY, 3),
    adults: 1,
    children: 0,
    rate: 1350,
    deposit: 1215,
    status: "confirmed",
    source: "ota",
    foreign: true,
    note: "ต่างชาติ · ต้องยื่น ตม.30",
  },
  // แขกที่เช็กอินไว้ก่อนเริ่มสาธิต — ต้องมีการจองคู่กับบิลที่เปิดค้างไว้
  {
    id: "B-2377",
    guest: "คุณสมศักดิ์ พงษ์ไพร",
    roomType: "ดีลักซ์",
    room: "402",
    checkIn: addDays(TODAY, -2),
    checkOut: TODAY,
    adults: 2,
    children: 0,
    rate: 1650,
    deposit: 1650,
    status: "inhouse",
    source: "direct",
    note: "เช็กเอาท์วันนี้",
  },
  {
    id: "B-2390",
    guest: "Tanaka H.",
    roomType: "ดีลักซ์",
    room: "305",
    checkIn: addDays(TODAY, -1),
    checkOut: addDays(TODAY, 2),
    adults: 1,
    children: 0,
    rate: 1350,
    deposit: 1350,
    status: "inhouse",
    source: "ota",
    foreign: true,
    note: "พักอยู่ · ตม.30 ยื่นแล้ว",
  },
  {
    id: "B-2431",
    guest: "คุณพลอย จันทร์ฉาย",
    roomType: "ดีลักซ์",
    checkIn: TODAY,
    checkOut: addDays(TODAY, 1),
    adults: 2,
    children: 0,
    rate: 1650,
    deposit: 0,
    status: "confirmed",
    source: "line",
    note: "LINE: @ploychan · แขกเก่า 3 ครั้ง",
  },
];

/** ห้องที่มีแขกอยู่แล้วตั้งแต่ก่อนเริ่มสาธิต — เปิดบิลค้างไว้ให้เหมือนจริง */
const SEED_BILLS: Record<string, BillLine[]> = {
  "402": [
    { id: "s1", label: "ค่าห้อง ดีลักซ์", note: "2 คืน", qty: 2, price: 1650, kind: "room" },
    { id: "s2", label: "มินิบาร์", note: "น้ำ 4 · เบียร์ 2", qty: 1, price: 260, kind: "fnb" },
    { id: "s3", label: "คาเฟ่ · ลาเต้ 3", note: "ยิงเข้าห้องจาก POS", qty: 1, price: 195, kind: "fnb" },
    { id: "s4", label: "ซักรีด 8 ชิ้น", note: "แม่บ้านกดจากมือถือ", qty: 1, price: 320, kind: "service" },
    { id: "s5", label: "อาหารห้องอาหาร", note: "บิล #F-1183", qty: 1, price: 1355, kind: "fnb" },
  ],
  "305": [
    { id: "s6", label: "ค่าห้อง ดีลักซ์", note: "3 คืน", qty: 3, price: 1350, kind: "room" },
  ],
};

const SEED_CARDS: CardEvent[] = [
  { id: "c1", at: "07:12", room: "—", who: "สมศรี (แม่บ้าน)", kind: "staff", note: "แตะบัตรลงเวลาเข้างาน" },
  { id: "c2", at: "08:40", room: "305", who: "Tanaka H.", kind: "enter" },
  { id: "c3", at: "09:02", room: "402", who: "คุณสมศักดิ์ พงษ์ไพร", kind: "enter" },
  { id: "c4", at: "10:35", room: "301", who: "บัตรที่หมดอายุแล้ว", kind: "denied", note: "แขกเก่าเช็กเอาท์ไปเมื่อวาน — ประตูปฏิเสธเอง" },
  { id: "c5", at: "11:20", room: "204", who: "วิชัย (ช่าง)", kind: "staff", note: "เข้าห้องปิดซ่อม WO-1182" },
];

const SEED_WO: WorkOrder[] = [
  {
    id: "WO-1182",
    room: "204",
    label: "แอร์ไม่เย็น",
    from: "แม่บ้านสมศรี + เซ็นเซอร์ค่าไฟ (+41%)",
    urgent: true,
    status: "open",
    photos: [],
    parts: [],
    cost: 0,
    note: "ห้องปิดขายอยู่ — ปิดงานเมื่อไร ห้องกลับเข้าคิวแม่บ้าน",
  },
];

/**
 * ห้องที่ผังบอกว่ามีแขกอยู่หรือรอเช็กอิน ต้องมีการจองคู่กันเสมอ
 * ไม่งั้นปฏิทินจะโชว์ว่าง ทั้งที่หน้าเคาน์เตอร์บอกว่ามีคนพัก
 */
const RATE_OF: Record<string, number> = {
  ดีลักซ์: 1650,
  ซูพีเรียร์: 1350,
  สวีท: 2900,
  "รายเตียง (ดอร์ม)": 450,
};

const derivedBookings = (): Booking[] => {
  const taken = new Set(SEED_BOOKINGS.map((b) => b.room));
  let n = 2300;
  return ROOM_RACK.filter(
    (r) =>
      (r.status === "occupied" || r.status === "arriving" || r.status === "dirty") &&
      !taken.has(r.no),
  ).map((r) => {
    // กระจายวันเข้า–ออกให้ดูเป็นธรรมชาติ แทนที่จะเข้าออกพร้อมกันทั้งโรงแรม
    // เลขห้องดอร์มเป็น D1..D6 — ใช้ผลรวมรหัสตัวอักษรแทนเพื่อให้ยังกระจายวันได้
    const seed =
      Number(r.no) ||
      [...r.no].reduce((t, ch) => t + ch.charCodeAt(0), 0);
    const stay = 2 + (seed % 3);
    // ห้องที่แม่บ้านกำลังทำ = แขกเก่าออกเช้านี้ และมีคนจองเข้าคืนนี้แล้ว
    const started = r.status === "occupied" ? -(1 + (seed % 2)) : 0;
    const rate = RATE_OF[r.type] ?? 1350;
    return {
      id: "B-" + ++n,
      guest: r.guest ?? "แขกห้อง " + r.no,
      roomType: r.type,
      room: r.no,
      checkIn: addDays(TODAY, started),
      // ห้องที่มีแขกอยู่ต้องกินคืนวันนี้เสมอ ไม่งั้นปฏิทินจะขัดกับผังห้อง
      checkOut: addDays(TODAY, Math.max(1, started + stay)),
      adults: 1 + (seed % 2),
      children: 0,
      rate,
      deposit: Math.round(
        stayTotal(rate, addDays(TODAY, started), addDays(TODAY, Math.max(1, started + stay))) * 0.3,
      ),
      status: r.status === "occupied" ? "inhouse" : "confirmed",
      // ชื่อที่ไม่มีอักษรไทยเลย = แขกต่างชาติ ต้องยื่น ตม.30 — ผังห้องกับทะเบียน
      // ผู้พักต้องบอกสัญชาติตรงกัน ไม่งั้น ร.ร.4 จะขึ้นว่า K. Wilson เป็นคนไทย
      foreign: !/[฀-๿]/.test(r.guest ?? ""),
      note: r.status === "dirty" ? "รอห้องพร้อม · แม่บ้านกำลังทำ" : undefined,
      source: seed % 3 === 0 ? "ota" : "direct",
    } satisfies Booking;
  });
};

const SEED_CONVS: Conversation[] = [
  {
    id: "cv1",
    channel: "booking",
    externalId: "bk-91250531",
    guest: "K. Wilson",
    lastText: "เช็กอินก่อน 14:00 ได้ไหมครับ",
    lastAt: "13:42",
    unread: 1,
  },
  {
    id: "cv2",
    channel: "line",
    externalId: "U8f2a1",
    guest: "คุณศิริพร",
    lastText: "สอบถามห้องว่างสุดสัปดาห์นี้ค่ะ",
    lastAt: "13:20",
    unread: 2,
  },
  {
    id: "cv3",
    channel: "airbnb",
    externalId: "abnb-77401",
    guest: "M. Dubois",
    lastText: "Merci! See you tomorrow",
    lastAt: "11:05",
    unread: 0,
  },
];

const SEED_CHAT: ChatMessage[] = [
  { id: "m1", convId: "cv1", direction: "in", text: "สวัสดีครับ ผมจองห้องดีลักซ์ไว้", at: "13:40" },
  { id: "m2", convId: "cv1", direction: "in", text: "เช็กอินก่อน 14:00 ได้ไหมครับ", at: "13:42" },
  { id: "m3", convId: "cv2", direction: "in", text: "สวัสดีค่ะ", at: "13:18" },
  { id: "m4", convId: "cv2", direction: "in", text: "สอบถามห้องว่างสุดสัปดาห์นี้ค่ะ", at: "13:20" },
  { id: "m5", convId: "cv3", direction: "in", text: "Is early check-in possible?", at: "10:58" },
  { id: "m6", convId: "cv3", direction: "out", text: "ได้ครับ ห้องพร้อมตั้งแต่ 13:00", at: "11:02", sentBy: "สมชาย" },
  { id: "m7", convId: "cv3", direction: "in", text: "Merci! See you tomorrow", at: "11:05" },
];

// ── รายจ่ายเดือนนี้ · ตัวเลขระดับโรงแรม 39 ห้อง ────────────────────────
// จงใจให้บางรายการยังไม่จ่าย เพื่อให้เห็นความต่างระหว่าง "กำไร" กับ "เงินสดที่ออกจริง"
const SEED_EXPENSES: Expense[] = [
  { id: "EX-801", at: addDays(TODAY, -6), cat: "payroll", label: "ค่าแรงพนักงาน 12 คน · 7 คืน", amount: 78400, paid: true, note: "รวมโอทีคืนศุกร์–เสาร์ที่คนเยอะ" },
  { id: "EX-802", at: addDays(TODAY, -5), cat: "electricity", label: "ค่าไฟ · เฉลี่ยตามมิเตอร์รายห้อง", amount: 24600, paid: true, note: "ห้อง 210 สูงผิดปกติ — ดูแท็บค่าไฟ & IoT" },
  { id: "EX-803", at: addDays(TODAY, -5), cat: "water", label: "ค่าน้ำประปา", amount: 2400, paid: true },
  { id: "EX-804", at: addDays(TODAY, -5), cat: "telecom", label: "อินเทอร์เน็ต + โทรศัพท์", amount: 4200, paid: true },
  { id: "EX-804", at: addDays(TODAY, -4), cat: "supplies", label: "ผ้าปู ผ้าเช็ดตัว ของใช้ในห้อง", amount: 12300, paid: true },
  { id: "EX-805", at: addDays(TODAY, -3), cat: "supplies", label: "วัตถุดิบครัว · ใบสั่งซื้อจาก POS", amount: 7300, paid: true, auto: true, note: "ระบบสร้างเองจากสต็อกที่ต่ำกว่าจุดสั่งซื้อ" },
  { id: "EX-806", at: addDays(TODAY, -2), cat: "ota", label: "ค่าคอมมิชชัน Agoda + Booking.com", amount: 24800, paid: false, due: addDays(TODAY, 14), auto: true, note: "หักจากยอดจองผ่านเว็บจองในช่วงนี้" },
  { id: "EX-807", at: addDays(TODAY, -3), cat: "maintenance", label: "ซ่อมแอร์ห้อง 210 + อะไหล่", amount: 4200, paid: true },
  { id: "EX-808", at: addDays(TODAY, -1), cat: "maintenance", label: "ล้างแอร์ 6 เครื่อง", amount: 5200, paid: false, due: addDays(TODAY, 9) },
  { id: "EX-809", at: addDays(TODAY, -6), cat: "marketing", label: "โฆษณา Facebook + ส่วนลดจองตรง", amount: 6300, paid: true },
  { id: "EX-810", at: addDays(TODAY, -6), cat: "interest", label: "ดอกเบี้ยเงินกู้ปรับปรุงอาคาร · สัดส่วน 7 คืน", amount: 19800, paid: true },
  { id: "EX-811", at: addDays(TODAY, -1), cat: "other", label: "ค่าเก็บขยะ + ค่าธรรมเนียมท้องถิ่น", amount: 5600, paid: false, due: addDays(TODAY, 21) },
];

// ── ลูกหนี้ · บิลที่ปิดแล้วแต่ยังเก็บเงินไม่ครบ ────────────────────────
const SEED_RECEIVABLES: Receivable[] = [
  { id: "AR-114", guest: "บริษัท ล้านนา ทัวร์ จำกัด", room: "301–304", amount: 46800, since: addDays(TODAY, -38), reason: "วางบิลเครดิต 30 วัน · เลยกำหนดแล้ว" },
  { id: "AR-118", guest: "คุณธีรพงษ์ วัฒนกุล", room: "205", amount: 3200, since: addDays(TODAY, -11), reason: "มินิบาร์ค้างจ่าย · บัตรถูกปฏิเสธตอนเช็กเอาต์" },
  { id: "AR-121", guest: "สำนักงานเขตพื้นที่การศึกษา", room: "401–408", amount: 88400, since: addDays(TODAY, -6), reason: "รอเบิกงบราชการ · ปกติ 45 วัน" },
];

// ── ลูกค้าเดิม · ประวัติเข้าพัก แต้ม และรีวิว ──────────────────────────
const SEED_GUESTS: Guest[] = [
  { id: "G-01", name: "คุณอนันต์ ศรีสุข", phone: "081-234-5678", birthday: "08-16", since: "2023-08-16", stays: 7, spend: 61400, points: 3070, lastStay: addDays(TODAY, -41),
    feedback: [{ score: 5, text: "พนักงานจำได้ว่าชอบห้องชั้นสูง ประทับใจมาก", at: addDays(TODAY, -41), room: "512" }] },
  { id: "G-02", name: "มณีรัตน์ พงศ์ไพบูลย์", phone: "089-777-1122", birthday: "09-02", since: "2024-02-11", stays: 4, spend: 28900, points: 1445, lastStay: addDays(TODAY, -22),
    feedback: [{ score: 4, text: "ห้องดีแต่เสียงจากถนนดังตอนเช้า", at: addDays(TODAY, -22), room: "203" }] },
  { id: "G-03", name: "Tanaka Hiroshi", foreign: true, since: "2025-01-08", stays: 3, spend: 19350, points: 967, lastStay: TODAY, feedback: [] },
  { id: "G-04", name: "สุชาติ เรืองโรจน์", phone: "086-555-9090", birthday: "11-20", since: "2022-11-20", stays: 11, spend: 142600, points: 7130, lastStay: addDays(TODAY, -9),
    feedback: [
      { score: 5, text: "มาประจำทุกไตรมาส ไม่เคยผิดหวัง", at: addDays(TODAY, -9), room: "512" },
      { score: 3, text: "รอบนี้เช็กอินช้าไปหน่อย คนเยอะ", at: addDays(TODAY, -104), room: "310" },
    ] },
  { id: "G-05", name: "ปิยะดา แก้วมงคล", phone: "092-330-4411", since: "2024-06-30", stays: 2, spend: 9800, points: 490, lastStay: addDays(TODAY, -219),
    feedback: [{ score: 2, text: "แอร์ห้องเสียงดัง แจ้งแล้วแก้ช้า", at: addDays(TODAY, -219), room: "210" }] },
  { id: "G-06", name: "K. Wilson", foreign: true, since: "2025-12-02", stays: 2, spend: 15200, points: 760, lastStay: addDays(TODAY, -195), feedback: [] },
  // มาครั้งเดียวแล้วหายไป — ต้องมีในฐานข้อมูลด้วย ไม่งั้น "ลูกค้ากลับมาซ้ำ 100%"
  // ซึ่งเป็นตัวเลขที่ไม่มีโรงแรมไหนทำได้ และทำให้ทั้งหน้าดูเป็นของปลอม
  { id: "G-07", name: "ณัฐพล จันทร์เพ็ญ", phone: "084-201-7788", since: addDays(TODAY, -63), stays: 1, spend: 3600, points: 180, lastStay: addDays(TODAY, -63),
    feedback: [{ score: 4, at: addDays(TODAY, -63), room: "108" }] },
  { id: "G-08", name: "Chen Wei", foreign: true, since: addDays(TODAY, -31), stays: 1, spend: 5100, points: 255, lastStay: addDays(TODAY, -31), feedback: [] },
  { id: "G-09", name: "วรรณา ทองอยู่", since: addDays(TODAY, -17), stays: 1, spend: 2700, points: 135, lastStay: addDays(TODAY, -17),
    feedback: [{ score: 3, text: "ที่จอดรถเต็มตอนเย็น", at: addDays(TODAY, -17), room: "305" }] },
  { id: "G-10", name: "Emily Carter", foreign: true, since: addDays(TODAY, -8), stays: 1, spend: 7200, points: 360, lastStay: addDays(TODAY, -8), feedback: [] },
];

const initial: State = {
  rooms: ROOM_RACK,
  bookings: [...SEED_BOOKINGS, ...derivedBookings()],
  bills: SEED_BILLS,
  closed: [],
  refunds: [],
  cardEvents: SEED_CARDS,
  session: null,
  mode: "hotel",
  conversations: SEED_CONVS,
  messages: SEED_CHAT,
  workOrders: SEED_WO,
  settings: DEFAULT_SETTINGS,
  expenses: SEED_EXPENSES,
  receivables: SEED_RECEIVABLES,
  guests: SEED_GUESTS,
  staff: STAFF,
};

const syncRuntimeSettings = (value: Settings) => {
  setWeekendPct(value.weekendPct);
  setVatPct(value.vatPct);
  HOTEL.depositPct = value.depositPct;
  HOTEL.name = value.hotelName;
  HOTEL.city = value.city;
  HOTEL.phone = value.phone;
};

/** โหลดของที่เคยบันทึกไว้ทับค่าตั้งต้น · ไม่คืนสถานะล็อกอิน — เปิดใหม่ต้องแตะบัตรใหม่ */
const boot = (): State => {
  const state = { ...load<State>("hotel", initial), session: null };
  // ตั้งก่อน render แรก เพื่อให้โมดูลเก่าไม่แสดงราคาเริ่มต้นชั่วครู่
  syncRuntimeSettings(state.settings);
  return state;
};

let seq = 2431;
let cardSeq = 100;
let convSeq = 3;
let msgSeq = 7;
//: เวลาของข้อความต้องเดินหน้าเสมอ · CLOCK วนซ้ำทำให้คำตอบดูมาก่อนคำถาม
let clockTick = 0;
const stamp = () => {
  const t = 13 * 60 + 45 + clockTick++ * 3;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
let woSeq = 1182;
let expenseSeq = 811;
let staffSeq = 6;
let guestSeq = 10;
const CLOCK = ["13:04", "13:19", "13:36", "13:48", "14:07", "14:22", "14:41"];
let lineSeq = 0;
const nextBooking = () => "B-" + ++seq;
const nextLine = () => "L" + ++lineSeq;

const setRoom = (rooms: DeskRoom[], no: string, patch: Partial<DeskRoom>) =>
  rooms.map((r) => (r.no === no ? { ...r, ...patch } : r));

// ── Reducer ───────────────────────────────────────────────────────────
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE": {
      /* เทของจากหลังบ้านทับ ไม่ใช่ผสาน — ถ้าผสาน ของที่ถูกลบบนเซิร์ฟเวอร์
         จะค้างอยู่บนจอนี้ตลอดไปโดยไม่มีใครรู้

         ส่วนที่หลังบ้านยังไม่มี (แชท ใบงานช่าง แต้ม ChivaGo) คงไว้
         ตามเดิม เพราะยังไม่มีของจริงมาแทน — และหน้าจอบอกผู้ใช้ตรง ๆ
         ว่าส่วนไหนยังเป็นข้อมูลสาธิต */
      return {
        ...state,
        rooms: action.rooms,
        bookings: action.bookings,
        bills: action.bills,
        settings: action.settings ?? state.settings,
      };
    }

    case "CREATE_BOOKING": {
      const id = action.booking.id ?? nextBooking();
      const booking: Booking = { ...action.booking, id, status: "confirmed" };
      return {
        ...state,
        bookings: [...state.bookings, booking],
        // กันห้องในปฏิทินเสมอ แต่สถานะห้องหน้าเคาน์เตอร์ขยับเฉพาะคนที่เข้าพักวันนี้
        // (จองล่วงหน้าสามสัปดาห์ ไม่ควรทำให้ห้องดูขายไม่ได้ตั้งแต่วันนี้)
        rooms: booking.room && booking.checkIn <= TODAY
          ? setRoom(state.rooms, booking.room, {
              status: "arriving",
              guest: booking.guest,
            })
          : state.rooms,
      };
    }

    case "CHECK_IN": {
      const b = state.bookings.find((x) => x.id === action.bookingId);
      if (!b) return state;
      const nights = nightsBetween(b.checkIn, b.checkOut) || 1;
      return {
        ...state,
        bookings: state.bookings.map((x) =>
          x.id === b.id ? { ...x, status: "inhouse", room: action.room } : x,
        ),
        rooms: setRoom(state.rooms, action.room, {
          status: "occupied",
          guest: b.guest,
          note: undefined,
        }),
        cardEvents: [
          {
            id: "c" + ++cardSeq,
            at: CLOCK[state.cardEvents.length % CLOCK.length],
            room: action.room,
            who: b.guest,
            kind: "issue",
            note: "เขียนรหัสห้องลงบัตรที่เคาน์เตอร์ · ใช้เวลา 10 วินาที",
          },
          ...state.cardEvents,
        ],
        bills: {
          ...state.bills,
          [action.room]: [
            {
              id: nextLine(),
              label: `ค่าห้อง ${b.roomType}`,
              note: `${nights} คืน`,
              qty: nights,
              price: b.rate,
              kind: "room",
            },
          ],
        },
      };
    }

    case "ADD_CHARGE": {
      const lines = state.bills[action.room] ?? [];
      const qty = action.line.qty ?? 1;
      const same = lines.find(
        (l) => l.label === action.line.label && l.price === action.line.price,
      );
      return {
        ...state,
        bills: {
          ...state.bills,
          [action.room]: same
            ? lines.map((l) => (l.id === same.id ? { ...l, qty: l.qty + qty } : l))
            : [...lines, { ...action.line, qty, id: nextLine() }],
        },
      };
    }

    case "CHECK_OUT": {
      const lines = state.bills[action.room] ?? [];
      const b = state.bookings.find(
        (x) => x.room === action.room && x.status === "inhouse",
      );
      const rest = { ...state.bills };
      delete rest[action.room];
      const spend = lines.reduce((s, l) => s + l.price * l.qty, 0);
      const who = b?.guest ?? state.rooms.find((r) => r.no === action.room)?.guest ?? "—";
      // จับคู่กับลูกค้าเดิมด้วยชื่อ · ไม่เจอก็สร้างประวัติใหม่ให้เลย
      // ถ้าไม่ทำตรงนี้ แต้มกับประวัติเข้าพักจะไม่มีวันเพิ่มขึ้นเอง
      const known = state.guests.find((g) => g.name === who);
      const guests: Guest[] = known
        ? state.guests.map((g) =>
            g.id === known.id
              ? {
                  ...g,
                  stays: g.stays + 1,
                  spend: g.spend + spend,
                  points: g.points + pointsFor(spend),
                  lastStay: TODAY,
                }
              : g,
          )
        : [
            ...state.guests,
            {
              id: "G-" + ++guestSeq,
              name: who,
              since: b?.checkIn ?? TODAY,
              stays: 1,
              spend,
              points: pointsFor(spend),
              lastStay: TODAY,
              feedback: [],
              foreign: b?.foreign,
            },
          ];
      return {
        ...state,
        guests,
        bills: rest,
        closed: [
          ...state.closed,
          {
            room: action.room,
            guest: b?.guest ?? state.rooms.find((r) => r.no === action.room)?.guest ?? "—",
            lines,
            total: lines.reduce((s, l) => s + l.price * l.qty, 0),
          },
        ],
        bookings: b
          ? state.bookings.map((x) => (x.id === b.id ? { ...x, status: "checkedout" } : x))
          : state.bookings,
        rooms: setRoom(state.rooms, action.room, {
          status: "dirty",
          guest: undefined,
          note: "เพิ่งเช็กเอาท์ · เข้าคิวแม่บ้าน",
        }),
        cardEvents: [
          {
            id: "c" + ++cardSeq,
            at: CLOCK[state.cardEvents.length % CLOCK.length],
            room: action.room,
            who: b?.guest ?? "แขก",
            kind: "expire",
            note: "เช็กเอาท์แล้ว บัตรหมดอายุทันที — แขกเก่าย้อนเข้าไม่ได้",
          },
          ...state.cardEvents,
        ],
      };
    }

    case "MOVE_ROOM": {
      const lines = state.bills[action.from] ?? [];
      const b = state.bookings.find(
        (x) => x.room === action.from && x.status === "inhouse",
      );
      const bills = { ...state.bills };
      delete bills[action.from];
      bills[action.to] = lines;
      return {
        ...state,
        bills,
        bookings: b
          ? state.bookings.map((x) => (x.id === b.id ? { ...x, room: action.to } : x))
          : state.bookings,
        rooms: setRoom(
          setRoom(state.rooms, action.from, {
            status: "dirty",
            guest: undefined,
            note: "ย้ายห้อง · เข้าคิวแม่บ้าน",
          }),
          action.to,
          { status: "occupied", guest: b?.guest, note: undefined },
        ),
      };
    }

    case "CHANGE_DATES": {
      const b = state.bookings.find((x) => x.id === action.bookingId);
      if (!b) return state;
      const nights = Math.max(1, nightsBetween(action.checkIn, action.checkOut));
      // จำนวนคืนเปลี่ยน => มัดจำ 30% ต้องคิดใหม่ ไม่งั้นยอดคืนเงินจะไม่ตรงกับที่โชว์
      const deposit = Math.round(
        (stayTotal(b.rate, action.checkIn, action.checkOut) * HOTEL.depositPct) / 100,
      );
      const bookings = state.bookings.map((x) =>
        x.id === b.id
          ? { ...x, checkIn: action.checkIn, checkOut: action.checkOut, deposit }
          : x,
      );
      // แขกที่พักอยู่แล้ว: ปรับจำนวนคืนในบิลให้ตรงกับวันใหม่
      const room = b.room;
      if (b.status !== "inhouse" || !room) return { ...state, bookings };
      return {
        ...state,
        bookings,
        bills: {
          ...state.bills,
          [room]: (state.bills[room] ?? []).map((l) =>
            l.kind === "room" ? { ...l, qty: nights, note: `${nights} คืน` } : l,
          ),
        },
      };
    }

    case "EDIT_BOOKING":
      return {
        ...state,
        bookings: state.bookings.map((x) =>
          x.id === action.bookingId ? { ...x, ...action.patch } : x,
        ),
      };

    case "CANCEL": {
      const b = state.bookings.find((x) => x.id === action.bookingId);
      if (!b) return state;
      return {
        ...state,
        bookings: state.bookings.filter((x) => x.id !== b.id),
        // ห้องที่กันไว้ให้กลับมาขายได้ทันที
        rooms: b.room && b.status === "confirmed"
          ? setRoom(state.rooms, b.room, { status: "ready", guest: undefined })
          : state.rooms,
        refunds: [
          ...state.refunds,
          {
            id: b.id,
            guest: b.guest,
            amount: action.refund,
            reason:
              action.refund >= b.deposit
                ? "ยกเลิกก่อน 48 ชม. — คืนมัดจำเต็ม"
                : "ยกเลิกกระชั้น — ริบมัดจำตามเงื่อนไข",
          },
        ],
      };
    }

    case "INGEST": {
      // ตัวตนของห้องคือ (channel, externalId) · ไม่มีก็สร้างให้ ไม่ใช่ทิ้งข้อความ
      const dir = action.direction ?? "in";
      let conv = state.conversations.find(
        (c) => c.channel === action.channel && c.externalId === action.externalId,
      );
      const convs = [...state.conversations];
      if (!conv) {
        conv = {
          id: "cv" + ++convSeq,
          channel: action.channel,
          externalId: action.externalId,
          guest: action.guest ?? "ลูกค้า",
          bookingId: action.bookingId,
          lastText: "",
          lastAt: "",
          unread: 0,
        };
        convs.push(conv);
      }
      const at = stamp();
      const msg: ChatMessage = {
        id: "m" + ++msgSeq,
        convId: conv.id,
        direction: dir,
        text: action.text,
        at,
        sentBy: action.sentBy,
      };
      return {
        ...state,
        conversations: convs.map((c) =>
          c.id !== conv!.id
            ? c
            : {
                ...c,
                // เติมเฉพาะช่องที่ยังว่าง ไม่ทับของเดิม
                guest: c.guest === "ลูกค้า" && action.guest ? action.guest : c.guest,
                bookingId: c.bookingId ?? action.bookingId,
                lastText: action.text.slice(0, 90),
                lastAt: at,
                // ลูกค้าทักมา = ยังไม่ได้อ่าน · เราตอบ = เคลียร์
                unread: dir === "in" ? c.unread + 1 : 0,
              },
        ),
        messages: [...state.messages, msg],
      };
    }

    case "HANDOVER":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.convId
            ? {
                ...c,
                handover: {
                  gate: action.gate,
                  reason: action.reason,
                  detail: action.detail,
                  draft: action.draft,
                },
              }
            : c,
        ),
      };

    case "CLEAR_HANDOVER":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.convId ? { ...c, handover: undefined } : c,
        ),
      };

    case "SIGN_IN": {
      const who = staffByCard(action.card);
      if (!who) return state;
      return {
        ...state,
        session: who,
        // ล็อกอินคือการแตะบัตรครั้งหนึ่ง ต้องมีร่องรอยเหมือนแตะประตู
        cardEvents: [
          {
            id: "c" + ++cardSeq,
            at: stamp(),
            room: "—",
            who: `${who.name} (${who.title})`,
            kind: "staff",
            note: `แตะบัตร ${who.card} เข้าใช้งานระบบ`,
          },
          ...state.cardEvents,
        ],
      };
    }

    case "SIGN_OUT":
      return { ...state, session: null };

    case "READ_CONV":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.convId ? { ...c, unread: 0 } : c,
        ),
      };

    case "CARD_TAP": {
      const r = state.rooms.find((x) => x.no === action.room);
      const ok = action.staff || r?.status === "occupied";
      return {
        ...state,
        cardEvents: [
          {
            id: "c" + ++cardSeq,
            at: CLOCK[state.cardEvents.length % CLOCK.length],
            room: action.room,
            who: action.who,
            kind: action.staff ? "staff" : ok ? "enter" : "denied",
            note: ok
              ? undefined
              : "บัตรหมดอายุแล้ว — ห้องนี้เช็กเอาท์ไปแล้ว ประตูปฏิเสธเอง",
          },
          ...state.cardEvents,
        ],
      };
    }

    case "ADD_WO": {
      if (state.workOrders.some((w) => w.id === action.wo.id)) return state;
      return {
        ...state,
        workOrders: [
          ...state.workOrders,
          { ...action.wo, status: "open", photos: [], parts: [], cost: 0 },
        ],
      };
    }

    case "WO_PATCH":
      return {
        ...state,
        workOrders: state.workOrders.map((w) =>
          w.id === action.id ? { ...w, ...action.patch } : w,
        ),
      };

    case "SET_ROOM":
      return { ...state, rooms: setRoom(state.rooms, action.room, action.patch) };

    case "SET_MODE": {
      // เปลี่ยนประเภทธุรกิจ = เริ่มเดโมใหม่ · การจองเดิมอ้างประเภทห้องเก่าอยู่
      const tier = LONGSTAY_TIER[action.mode];
      return {
        ...initial,
        mode: action.mode,
        session: state.session,
        rooms: ROOM_RACK.map((r) => {
          const i = tierIndexOf(r.type);
          const type = i >= 0 ? TIERS[action.mode][i] : r.type;
          // ยูนิตเช่ารายเดือนมีผู้เช่าอยู่ตลอด ไม่เข้าคิวขายรายวัน
          return i === tier
            ? {
                ...r,
                type,
                status: "occupied" as const,
                guest: "ผู้เช่ารายเดือน",
                note: "สัญญาเช่ารายเดือน · ไม่เปิดขายรายวัน",
              }
            : { ...r, type };
        }),
        // การจองที่ค้างอยู่อ้างประเภทเก่า ต้องล้างพร้อมกัน
        bookings: [],
        bills: {},
      };
    }

    // ── ตั้งค่าระบบ ────────────────────────────────────────────
    case "SET_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.patch } };

    // ── รายจ่าย ────────────────────────────────────────────────
    case "ADD_EXPENSE":
      return {
        ...state,
        expenses: [{ ...action.expense, id: "EX-" + ++expenseSeq }, ...state.expenses],
      };

    case "PATCH_EXPENSE":
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.id ? { ...e, ...action.patch } : e,
        ),
      };

    case "DEL_EXPENSE":
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.id) };

    case "SETTLE_RECEIVABLE":
      return {
        ...state,
        receivables: state.receivables.filter((r) => r.id !== action.id),
      };

    // ── พนักงาน ────────────────────────────────────────────────
    case "ADD_STAFF":
      return { ...state, staff: [...state.staff, { ...action.staff, id: "s-" + ++staffSeq }] };

    case "PATCH_STAFF":
      return {
        ...state,
        staff: state.staff.map((x) => (x.id === action.id ? { ...x, ...action.patch } : x)),
        // ถ้าแก้คนที่กำลังล็อกอินอยู่ ต้องอัปเดตสิทธิ์ทันที ไม่ใช่รอออกแล้วเข้าใหม่
        session:
          state.session?.id === action.id
            ? { ...state.session, ...action.patch }
            : state.session,
      };

    case "DEL_STAFF":
      return {
        ...state,
        staff: state.staff.filter((x) => x.id !== action.id),
        // ลบคนที่ล็อกอินอยู่ = เตะออกทันที ไม่ปล่อยให้ใช้สิทธิ์ของคนที่ไม่มีแล้ว
        session: state.session?.id === action.id ? null : state.session,
      };

    // ── ลูกค้า · รีวิวและแต้ม ──────────────────────────────────
    case "ADD_FEEDBACK":
      return {
        ...state,
        guests: state.guests.map((g) =>
          g.id === action.guestId
            ? { ...g, feedback: [action.feedback, ...g.feedback] }
            : g,
        ),
      };

    case "REDEEM":
      return {
        ...state,
        guests: state.guests.map((g) =>
          // แต้มไม่พอแลกไม่ได้ — กันไว้ที่นี่ด้วย ไม่ใช่เชื่อว่าหน้าจอกันให้แล้ว
          g.id === action.guestId && g.points >= action.cost
            ? { ...g, points: g.points - action.cost }
            : g,
        ),
      };

    case "RESET":
      // ล้างที่เก็บด้วย ไม่งั้นรีเฟรชแล้วของเดิมกลับมาทั้งที่กด "เริ่มใหม่" ไปแล้ว
      wipe();
      return initial;

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────
type Ctx = {
  state: State;
  dispatch: (action: Action) => Promise<boolean>;
  /** การจองที่ยังรอเช็กอิน — ฟีดให้หน้าเคาน์เตอร์ */
  arrivals: Booking[];
  /** แขกที่กำลังพักอยู่ — ฟีดให้ POS และหน้าเช็กเอาท์ */
  inHouse: Booking[];
  billOf: (room: string) => BillLine[];
  billTotal: (room: string) => number;
  /** ห้องว่างพร้อมขายของประเภทนั้น ณ ตอนนี้ (สถานะแม่บ้าน) */
  readyRooms: (type?: string) => DeskRoom[];
  /** ห้องนั้นว่างตลอดช่วงวันที่หรือไม่ — ไม่ชนการจองอื่น และไม่ปิดซ่อม */
  isRoomFree: (room: string, from: string, to: string, exceptId?: string) => boolean;
  /** ห้องที่ว่างจริงตลอดช่วงวันที่ (ใช้ตอนจอง/กันห้องล่วงหน้า) */
  availableRooms: (from: string, to: string, type?: string, exceptId?: string) => DeskRoom[];
  /** การจองที่กินวันนั้นของห้องนั้น — ใช้วาดปฏิทิน */
  bookingOn: (room: string, day: string) => Booking | undefined;
  /** ข้อเท็จจริงที่บอทอ้างอิงได้รอบนี้ — ประกอบจากปฏิทินและเรตจริงเท่านั้น */
  factsFor: (text: string) => GroundedFacts;
  /** ให้บอทลองตอบหนึ่งข้อความ แล้วผ่านด่านทั้งสี่ · คืนคำตัดสิน */
  botReply: (convId: string, incoming: string, wrong?: "price" | "promise" | "stale") => Decision;
  msgsOf: (convId: string) => ChatMessage[];
  unreadChats: number;
  session: Staff | null;
  staffList: typeof STAFF;
  mode: PropertyMode;
  stats: {
    occupancy: number;
    sold: number;
    soldTonight: number;
    inHouseRooms: number;
    sellable: number;
    ready: number;
    dirty: number;
  };
  nextWoId: () => string;
  /** ราคาต่อคืนของประเภทห้อง อ่านจากหน้าตั้งค่า ไม่ใช่ตัวเลขฝังในโค้ด */
  rateFor: (type: string) => number;
  settings: Settings;
  /** สรุปการเงิน — รายได้ รายจ่าย กำไร และเงินสดที่ออกจริง */
  money: {
    revenueRoom: number;
    revenueFnb: number;
    expense: number;
    unpaidExpense: number;
    owed: number;
  };
  guestByName: (name: string) => Guest | undefined;
  /** บันทึกลงเบราว์เซอร์เครื่องนี้ได้จริงไหม — ใช้บอกผู้ใช้ตามจริง */
  persisted: boolean;
  /** กำลังทำงานกับฐานข้อมูลจริง ไม่ใช่ข้อมูลสาธิต */
  live: boolean;
  /** กำลังคุยกับหลังบ้านอยู่ — ใช้ปิดปุ่มกันกดซ้ำ */
  syncing: boolean;
  /** เหตุผลที่หลังบ้านปฏิเสธรายการล่าสุด · ว่าง = ไม่มีปัญหา */
  syncError: string;
  /** ปิดข้อความผิดพลาดหลังผู้ใช้อ่านแล้ว */
  clearSyncError: () => void;
};

const HotelContext = createContext<Ctx | null>(null);

export function HotelProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, boot);
  const { mode, session: backendSession } = useBackend();
  const live = mode === "live";
  const canPullHotel = backendSession?.permissions.includes("booking") ?? false;
  const canLoadSettings = backendSession?.permissions.includes("settings") ?? false;
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  /* เทข้อมูลจริงลงจอทุกครั้งที่เข้าโหมดจริง และหลังทุกรายการที่หลังบ้านรับไป */
  const refresh = useCallback(async () => {
    // แม่บ้าน ช่าง และ POS ไม่มีสิทธิ์ booking และใช้ store/API ของจอตัวเอง
    // อย่าดึงข้อมูลโรงแรมให้ได้ 403 ทุกครั้งที่ล็อกอินหรือทำรายการ
    if (!canPullHotel) return;
    try {
      const snap = await pull(canLoadSettings);
      rawDispatch({ type: "HYDRATE", ...snap });
    } catch (e) {
      setSyncError(e instanceof ApiError ? e.message : "ดึงข้อมูลจากหลังบ้านไม่สำเร็จ");
    }
  }, [canLoadSettings, canPullHotel]);

  useEffect(() => {
    // การเรียก API เป็นการ sync กับระบบภายนอกโดยตรง จึงต้องเริ่มจาก effect
    // oxlint-disable-next-line react/set-state-in-effect
    if (live && canPullHotel) void refresh();
  }, [live, canPullHotel, refresh]);

  /**
   * ชั้นกลางเหนือ dispatch — หน้าจอทุกจอยังเรียกเหมือนเดิม ไม่ต้องแก้สักบรรทัด
   *
   * โหมดสาธิต  ส่งตรงเข้ารีดิวเซอร์ เหมือนที่เคยเป็นมา
   * โหมดจริง    ยิงหลังบ้านก่อน สำเร็จแล้วค่อยดึงภาพใหม่มาทั้งชุด
   *             ล้มเหลวก็ไม่แตะสถานะในเครื่องเลย — เซิร์ฟเวอร์เป็นแหล่งความจริง
   *             และการวาดไปก่อนแล้วค่อยรู้ว่าถูกปฏิเสธ คือครู่ที่พนักงาน
   *             เผลอบอกแขกไปแล้วว่าจองได้
   */
  const dispatch = useCallback<(action: Action) => Promise<boolean>>(
    async (action) => {
      if (mode === "locked") {
        setSyncError("กรุณาเข้าสู่ระบบก่อนทำรายการ");
        return false;
      }
      if (mode === "demo") {
        rawDispatch(action);
        return true;
      }
      setSyncError("");
      setSyncing(true);
      try {
        const handled = await push(action as never, state.bookings);
        if (handled) await refresh();
        else throw new ApiError(400, "รายการนี้ยังไม่รองรับในโหมดเชื่อมต่อหลังบ้าน");
        return true;
      } catch (e) {
        setSyncError(e instanceof ApiError ? e.message : "หลังบ้านปฏิเสธรายการนี้");
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [mode, refresh, state.bookings],
  );

  // บันทึกทุกครั้งที่สถานะเปลี่ยน — ไม่เก็บ session เพราะเปิดใหม่ต้องแตะบัตรใหม่
  useEffect(() => {
    // โหมดจริงไม่บันทึกลงเบราว์เซอร์ — แหล่งความจริงอยู่ที่เซิร์ฟเวอร์
    // ถ้าบันทึกด้วย เปิดเครื่องใหม่แล้วของเก่าจะทับของจริงชั่วครู่ก่อนโหลดเสร็จ
    if (mode !== "demo") return;
    const { session: _drop, ...rest } = state;
    save("hotel", rest);
  }, [state, mode]);

  // โมดูลเก่าบางส่วนยังอ่านค่าแบบ live binding; layout effect ทำให้ค่าพร้อมก่อน paint
  // ส่วน render แรกถูกตั้งไว้แล้วใน boot() จึงไม่กะพริบเป็นค่าเริ่มต้น
  useLayoutEffect(() => syncRuntimeSettings(state.settings), [state.settings]);

  const value = useMemo<Ctx>(() => {
    /** สองช่วงวันชนกันเมื่อเริ่มก่อนอีกช่วงจบ และจบหลังอีกช่วงเริ่ม (วันเช็กเอาท์ไม่นับว่าชน) */
    const overlaps = (aIn: string, aOut: string, bIn: string, bOut: string) =>
      aIn < bOut && bIn < aOut;

    const isRoomFree = (room: string, from: string, to: string, exceptId?: string) => {
      const r = state.rooms.find((x) => x.no === room);
      if (!r || r.status === "ooo") return false;
      return !state.bookings.some(
        (b) =>
          b.room === room &&
          b.status !== "checkedout" &&
          b.id !== exceptId &&
          overlaps(from, to, b.checkIn, b.checkOut),
      );
    };

    /** ข้อเท็จจริงที่บอทอ้างอิงได้รอบนี้ — ถามระบบจริง ไม่ถามก็ต้องว่าง */
    const factsFor = (text: string): GroundedFacts => {
      const wantsRoom = /ว่าง|ห้อง|จอง|พัก|ราคา|เท่าไร|เท่าไหร่|คืนละ/.test(text);
      if (!wantsRoom) return emptyFacts;
      const from = TODAY;
      const to = addDays(TODAY, 1);
      const free = state.rooms.filter((r) => r.status !== "ooo" && isRoomFree(r.no, from, to));
      return {
        figures: [
          ...new Set(free.map((r) => rateForNight(rateOf(state.settings, r.type), from))),
        ],
        available: free.length,
        range: "คืนนี้",
      };
    };

    const billOf = (room: string) => state.bills[room] ?? [];
    const billTotal = (room: string) =>
      billOf(room).reduce((s, l) => s + l.price * l.qty, 0);

    const sold = state.rooms.filter(
      (r) => r.status === "occupied" || r.status === "arriving",
    ).length;
    const sellable = state.rooms.filter((r) => r.status !== "ooo").length;

    return {
      state,
      dispatch,
      arrivals: state.bookings.filter((b) => b.status === "confirmed"),
      inHouse: state.bookings.filter((b) => b.status === "inhouse"),
      billOf,
      billTotal,
      readyRooms: (type?: string) =>
        state.rooms.filter((r) => r.status === "ready" && (!type || r.type === type)),

      isRoomFree,
      availableRooms: (from, to, type, exceptId) =>
        state.rooms.filter(
          (r) => (!type || r.type === type) && isRoomFree(r.no, from, to, exceptId),
        ),
      factsFor: factsFor,

      msgsOf: (convId) => state.messages.filter((m) => m.convId === convId),
      unreadChats: state.conversations.reduce((t, c) => t + c.unread, 0),
      // สิทธิ์ทุกจอในโหมดจริงต้องอ้างผู้ใช้ที่เซิร์ฟเวอร์ยืนยัน ไม่ใช่บัตรเดโมที่เคยเลือก
      session: mode === "demo" ? state.session : backendSession ? {
        id: backendSession.ref, name: backendSession.name, title: backendSession.title,
        role: backendSession.role, card: "",
      } : null,
      staffList: state.staff,
      mode: state.mode,
      settings: state.settings,
      rateFor: (type: string) => rateOf(state.settings, type),
      guestByName: (name: string) => state.guests.find((g) => g.name === name),
      persisted: canPersist(),
      live,
      syncing,
      syncError,
      clearSyncError: () => setSyncError(""),
      money: {
        // รายได้ห้องของบิลที่ยังเปิดอยู่ + ที่ปิดไปแล้ววันนี้ — แยกค่าห้องกับร้านอาหาร
        revenueRoom: [
          ...Object.values(state.bills).flat(),
          ...state.closed.flatMap((c) => c.lines),
        ]
          .filter((l) => l.kind === "room")
          .reduce((t, l) => t + l.price * l.qty, 0),
        revenueFnb: [
          ...Object.values(state.bills).flat(),
          ...state.closed.flatMap((c) => c.lines),
        ]
          .filter((l) => l.kind !== "room")
          .reduce((t, l) => t + l.price * l.qty, 0),
        expense: state.expenses.reduce((t, e) => t + e.amount, 0),
        unpaidExpense: state.expenses
          .filter((e) => !e.paid)
          .reduce((t, e) => t + e.amount, 0),
        owed: state.receivables.reduce((t, r) => t + r.amount, 0),
      },

      botReply: (convId, incoming, wrong) => {
        const conv = state.conversations.find((c) => c.id === convId);
        const facts = factsFor(incoming);
        const booking = conv?.bookingId
          ? state.bookings.find((b) => b.id === conv.bookingId)
          : undefined;

        // ร่างคำตอบ · ปกติประกอบจากข้อเท็จจริงที่ผ่านมา
        // forceWrong = จำลองว่าโมเดลแต่งตัวเลขเอง เพื่อให้เห็นด่าน 4 ทำงานจริง
        // จำลองความผิดพลาดของโมเดลสามแบบที่เกิดจริงบ่อยที่สุด
        const WRONG = {
          price: "ได้เลยครับ คืนนี้ยังว่างอยู่ ราคาพิเศษ ฿990 ต่อคืนครับ",
          promise: "ได้เลยครับ เดี๋ยวอัปเกรดให้เป็นห้องวิวสระว่ายน้ำนะครับ",
          stale: "ขออภัยครับ คืนนี้ห้องเต็มแล้วครับ",
        } as const;
        const draft = wrong
          ? WRONG[wrong]
          : facts.available === null
            ? "รับทราบครับ เดี๋ยวเจ้าหน้าที่ติดต่อกลับนะครับ"
            : facts.available > 0
              ? `คืนนี้ยังว่างอยู่ ${facts.available} ห้องครับ เริ่มต้น ฿${Math.min(...facts.figures).toLocaleString("en-US")} ต่อคืน`
              : "คืนนี้ห้องเต็มแล้วครับ ขออนุญาตเสนอวันอื่นให้นะครับ";

        // ถามซ้ำ = คำตอบก่อนหน้ายังไม่ตรงใจ
        const mine = state.messages.filter((m) => m.convId === convId && m.direction === "in");
        const repeated = mine.length > 1 && mine[mine.length - 1]?.text === incoming;

        return decide({
          incoming,
          draft,
          facts,
          channel: conv?.channel ?? "web",
          bookingActive: !booking || booking.status !== "checkedout",
          repeated,
        });
      },

      bookingOn: (room, day) =>
        state.bookings.find(
          (b) =>
            b.room === room &&
            b.status !== "checkedout" &&
            day >= b.checkIn &&
            day < b.checkOut,
        ),
      nextWoId: () => "WO-" + ++woSeq,
      stats: {
        sold,
        // ขายแล้วสำหรับคืนนี้ — รวมห้องที่แม่บ้านยังทำอยู่แต่มีคนจองไว้แล้ว
        soldTonight: state.rooms.filter(
          (r) =>
            r.status !== "ooo" &&
            state.bookings.some(
              (b) =>
                b.room === r.no &&
                b.status !== "checkedout" &&
                TODAY >= b.checkIn &&
                TODAY < b.checkOut,
            ),
        ).length,
        sellable,
        // แขกอยู่ในห้องจริง — ไม่รวมห้องที่จองแล้วแต่ยังไม่มาถึง
        inHouseRooms: state.rooms.filter((r) => r.status === "occupied").length,
        ready: state.rooms.filter((r) => r.status === "ready").length,
        dirty: state.rooms.filter((r) => r.status === "dirty").length,
        occupancy: Math.round((sold / sellable) * 100),
      },
    };
  }, [state, dispatch, live, mode, backendSession, syncing, syncError]);

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel() {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error("useHotel must be used within HotelProvider");
  return ctx;
}

export type { DeskRoom, RoomStatus };

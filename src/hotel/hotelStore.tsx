import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { ROOM_RACK, type DeskRoom, type RoomStatus } from "../desk/deskData";
import { TODAY, addDays, nightsBetween } from "../lib/date";
import { HOTEL } from "../data";
import { stayTotal, rateForNight } from "../lib/rates";
import { decide, emptyFacts, type Decision, type GroundedFacts } from "../lib/replyGuard";
import { STAFF, staffByCard, type Staff } from "../lib/roles";
import { LONGSTAY_TIER, TIERS, tierIndexOf, type PropertyMode } from "../lib/property";

// ── Types ─────────────────────────────────────────────────────────────
export type BookingStatus = "confirmed" | "inhouse" | "checkedout";
export type BookingSource = "direct" | "walkin" | "ota" | "line";

export type Booking = {
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
};

type Action =
  | { type: "CREATE_BOOKING"; booking: Omit<Booking, "id" | "status"> & { id?: string } }
  | { type: "CHECK_IN"; bookingId: string; room: string }
  | { type: "ADD_CHARGE"; room: string; line: Omit<BillLine, "id" | "qty"> & { qty?: number } }
  | { type: "CHECK_OUT"; room: string }
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
  | { type: "RESET" };

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
const CLOCK = ["13:04", "13:19", "13:36", "13:48", "14:07", "14:22", "14:41"];
let lineSeq = 0;
const nextBooking = () => "B-" + ++seq;
const nextLine = () => "L" + ++lineSeq;

const setRoom = (rooms: DeskRoom[], no: string, patch: Partial<DeskRoom>) =>
  rooms.map((r) => (r.no === no ? { ...r, ...patch } : r));

// ── Reducer ───────────────────────────────────────────────────────────
function reducer(state: State, action: Action): State {
  switch (action.type) {
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
      return {
        ...state,
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

    case "RESET":
      return initial;

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────
type Ctx = {
  state: State;
  dispatch: React.Dispatch<Action>;
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
};

const HotelContext = createContext<Ctx | null>(null);

export function HotelProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

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
        figures: [...new Set(free.map((r) => rateForNight(RATE_OF[r.type] ?? 1350, from)))],
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
      session: state.session,
      staffList: STAFF,
      mode: state.mode,

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
  }, [state]);

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel() {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error("useHotel must be used within HotelProvider");
  return ctx;
}

export type { DeskRoom, RoomStatus };

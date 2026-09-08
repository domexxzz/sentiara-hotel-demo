// ── Front-desk (เคาน์เตอร์) mock data ──────────────────────────────────
// Demo values only. Mirrors the "Sentiara App" mockup: live room rack,
// today's arrivals/departures, walk-in rates.

export type RoomStatus = "ready" | "occupied" | "dirty" | "ooo" | "arriving";

export type DeskRoom = {
  no: string;
  type: string;
  status: RoomStatus;
  guest?: string;
  note?: string;
};

export const STATUS_LABEL: Record<RoomStatus, string> = {
  ready: "ว่าง · พร้อมขาย",
  occupied: "มีแขกพัก",
  dirty: "รอแม่บ้าน",
  arriving: "จองแล้ว · รอเช็กอิน",
  ooo: "ปิดซ่อม",
};

export const ROOM_RACK: DeskRoom[] = [
  // ชั้น 2
  { no: "201", type: "ดีลักซ์", status: "ready" },
  { no: "202", type: "ดีลักซ์", status: "occupied", guest: "K. Wilson" },
  { no: "203", type: "ซูพีเรียร์", status: "occupied", guest: "คุณวิภา" },
  { no: "204", type: "ซูพีเรียร์", status: "ooo", note: "WO-1182 แอร์ไม่เย็น" },
  { no: "205", type: "ดีลักซ์", status: "dirty", note: "คาดเสร็จ 13:45" },
  { no: "206", type: "ซูพีเรียร์", status: "ready" },
  { no: "207", type: "ซูพีเรียร์", status: "occupied", guest: "M. Dubois" },
  { no: "208", type: "ดีลักซ์", status: "occupied", guest: "คุณเกียรติ" },
  { no: "209", type: "ซูพีเรียร์", status: "occupied", guest: "คุณนภา" },
  { no: "210", type: "ดีลักซ์", status: "occupied", guest: "S. Park" },
  // ชั้น 3
  { no: "301", type: "ดีลักซ์", status: "occupied", guest: "คุณมานพ" },
  { no: "302", type: "ดีลักซ์", status: "ready" },
  { no: "303", type: "ซูพีเรียร์", status: "occupied", guest: "L. Chen" },
  { no: "304", type: "ซูพีเรียร์", status: "dirty", note: "คาดเสร็จ 12:20" },
  { no: "305", type: "ดีลักซ์", status: "occupied", guest: "Tanaka H." },
  { no: "306", type: "ซูพีเรียร์", status: "occupied", guest: "คุณจิรา" },
  { no: "307", type: "ซูพีเรียร์", status: "occupied", guest: "A. Kumar" },
  { no: "308", type: "ดีลักซ์", status: "occupied", guest: "คุณสุดา" },
  { no: "309", type: "ซูพีเรียร์", status: "occupied", guest: "R. Silva" },
  { no: "310", type: "ดีลักซ์", status: "ready" },
  // ชั้น 4
  { no: "401", type: "ดีลักซ์", status: "occupied", guest: "คุณพิชัย" },
  { no: "402", type: "ดีลักซ์", status: "occupied", guest: "คุณสมศักดิ์", note: "เช็กเอาท์วันนี้" },
  { no: "403", type: "ซูพีเรียร์", status: "occupied", guest: "J. Meyer" },
  { no: "404", type: "ซูพีเรียร์", status: "arriving", guest: "Tanaka Hiroshi" },
  { no: "405", type: "ดีลักซ์", status: "dirty", note: "คาดเสร็จ 13:10" },
  { no: "406", type: "ซูพีเรียร์", status: "occupied", guest: "คุณอารีย์" },
  { no: "407", type: "ซูพีเรียร์", status: "occupied", guest: "T. Nguyen" },
  { no: "408", type: "ดีลักซ์", status: "occupied", guest: "คุณธนา" },
  { no: "409", type: "ซูพีเรียร์", status: "ready" },
  { no: "410", type: "ดีลักซ์", status: "occupied", guest: "คุณกมล" },
  // ดอร์ม 6 เตียง — ขายเป็นรายเตียง แต่ละเตียงคือหน่วยขายหนึ่งหน่วย
  { no: "D1", type: "รายเตียง (ดอร์ม)", status: "occupied", guest: "A. Kowalski" },
  { no: "D2", type: "รายเตียง (ดอร์ม)", status: "occupied", guest: "คุณปรีชา" },
  { no: "D3", type: "รายเตียง (ดอร์ม)", status: "occupied", guest: "L. Rossi" },
  { no: "D4", type: "รายเตียง (ดอร์ม)", status: "ready" },
  { no: "D5", type: "รายเตียง (ดอร์ม)", status: "ready" },
  { no: "D6", type: "รายเตียง (ดอร์ม)", status: "dirty", note: "คาดเสร็จ 12:50" },
];

export type Arrival = {
  bookingNo: string;
  guest: string;
  type: string;
  nights: number;
  pax: number;
  total: number;
  deposit: number;
  room?: string;
  foreign?: boolean;
  note?: string;
};

export const ARRIVALS: Arrival[] = [
  {
    bookingNo: "B-2418",
    guest: "คุณอนันต์ ศรีสุข",
    type: "ดีลักซ์",
    nights: 2,
    pax: 2,
    total: 3300,
    deposit: 990,
    room: "201",
    note: "จองตรงผ่านเว็บ · มัดจำรับแล้ว",
  },
  {
    bookingNo: "B-2402",
    guest: "Tanaka Hiroshi",
    type: "ซูพีเรียร์",
    nights: 3,
    pax: 1,
    total: 4050,
    deposit: 1215,
    room: "404",
    foreign: true,
    note: "ต่างชาติ · ต้องยื่น ตม.30",
  },
  {
    bookingNo: "B-2431",
    guest: "คุณพลอย จันทร์ฉาย",
    type: "ดีลักซ์",
    nights: 1,
    pax: 2,
    total: 1650,
    deposit: 0,
    note: "LINE: @ploychan · แขกเก่า 3 ครั้ง",
  },
];

export type Departure = {
  room: string;
  guest: string;
  bill: number;
  paid: number;
  lines: { label: string; note?: string; amount: number }[];
};

export const DEPARTURE: Departure = {
  room: "402",
  guest: "คุณสมศักดิ์ พงษ์ไพร",
  bill: 5430,
  paid: 1650,
  lines: [
    { label: "ค่าห้อง ดีลักซ์", note: "12–14 ส.ค. · 2 คืน", amount: 3300 },
    { label: "มินิบาร์", note: "น้ำ 4 · เบียร์ 2", amount: 260 },
    { label: "คาเฟ่ · ลาเต้ 3", note: "ยิงเข้าห้องจาก POS", amount: 195 },
    { label: "ซักรีด 8 ชิ้น", note: "แม่บ้านกดจากมือถือ", amount: 320 },
    { label: "อาหารห้องอาหาร", note: "บิล #F-1183", amount: 1355 },
  ],
};

// Walk-in rates — no direct-booking discount at the counter.
// Availability is counted from the live rack, never hard-coded.
export const WALKIN_RATES = [
  { id: "deluxe", name: "ดีลักซ์", bed: "เตียงใหญ่", rate: 1850 },
  { id: "superior", name: "ซูพีเรียร์", bed: "เตียงคู่", rate: 1550 },
];

export const SHIFT = {
  staff: "สมชาย ใจดี",
  role: "พนักงานเคาน์เตอร์",
  window: "กะเช้า 07:00–15:00",
  sync: "ซิงก์ 3 วินาทีที่แล้ว",
};

export { money } from "../lib/format";

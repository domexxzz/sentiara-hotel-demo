import { api, ApiError, type ApiBooking, type ApiRoom } from "../lib/api";
import { TODAY } from "../lib/date";
import type { Booking, BillLine } from "./hotelStore";
import type { DeskRoom, RoomStatus } from "../desk/deskData";

/**
 * ชั้นแปลงข้อมูลระหว่างหลังบ้านกับหน้าจอ
 *
 * สถานะแม่บ้านยึดค่าจาก API เพราะห้องไม่มีแขกไม่ได้แปลว่าพร้อมขาย
 * แขกที่เลยกำหนดเช็กเอาต์แต่ยังอยู่ ต้องอยู่ในภาพเดียวกันด้วยเสมอ
 */

/** วันนี้ตามเวลาไทย · โหมดจริงใช้วันจริง ไม่ใช่วันที่ตรึงไว้ของเดโม */
export const realToday = (): string => {
  const d = new Date();
  const th = new Date(d.getTime() + (d.getTimezoneOffset() + 420) * 60000);
  return `${th.getFullYear()}-${String(th.getMonth() + 1).padStart(2, "0")}-${String(
    th.getDate(),
  ).padStart(2, "0")}`;
};

/** แปลงการจองหนึ่งใบจากหลังบ้านเป็นรูปที่หน้าจอใช้ */
export function toBooking(b: ApiBooking, rateOfRoom: (no: string) => number): Booking {
  return {
    id: b.ref,
    guest: b.guest,
    room: b.room,
    // หลังบ้านคืนชื่อประเภทมากับผังห้อง จึงหาย้อนจากเลขห้องเอา
    roomType: "",
    checkIn: b.check_in,
    checkOut: b.check_out,
    adults: 1,
    children: 0,
    // ราคาต่อคืนโดยเฉลี่ยของการจองใบนี้ — เรตวันหยุดทำให้แต่ละคืนไม่เท่ากัน
    // ยอดจริงที่เรียกเก็บอยู่ในบิล ตัวนี้ใช้แค่แสดงผลคร่าว ๆ
    rate: b.folio && b.nights > 0
      ? Math.round(b.folio.gross / b.nights)
      : rateOfRoom(b.room),
    deposit: b.deposit,
    paid: b.folio?.paid ?? 0,
    balance: b.folio?.balance ?? 0,
    status: b.status === "cancelled" ? "checkedout" : b.status,
    source: b.source,
  };
}

/** ผังห้องจากหลังบ้าน + สถานะที่คิดได้จากการจอง */
export function toRooms(rooms: ApiRoom[], bookings: ApiBooking[], today: string): DeskRoom[] {
  const inhouse = new Map<string, string>();
  const arriving = new Map<string, string>();
  for (const b of bookings) {
    if (b.status === "inhouse") inhouse.set(b.room, b.guest);
    else if (b.status === "confirmed" && b.check_in <= today) arriving.set(b.room, b.guest);
  }
  return rooms.map((r) => {
    let status: RoomStatus = "ready";
    let guest: string | undefined;
    if (r.out_of_order) status = "ooo";
    else if (inhouse.has(r.no)) {
      status = "occupied";
      guest = inhouse.get(r.no);
    } else if (!r.sellable || r.housekeeping !== "clean") {
      status = "dirty";
      guest = arriving.get(r.no);
    } else if (arriving.has(r.no)) {
      status = "arriving";
      guest = arriving.get(r.no);
    }
    return { no: r.no, type: r.type, status, guest };
  });
}

export type Snapshot = {
  rooms: DeskRoom[];
  bookings: Booking[];
  bills: Record<string, BillLine[]>;
};

/**
 * ดึงสถานะทั้งหมดจากหลังบ้านมาหนึ่งภาพ
 *
 * ดึงบิลเฉพาะของแขกที่ยังพักอยู่ ไม่ดึงทุกใบ — โรงแรมที่เปิดมาหนึ่งปีมีบิล
 * เป็นพัน การโหลดทั้งหมดทุกครั้งที่กดปุ่มคือสิ่งที่ทำให้ระบบช้าลงเรื่อย ๆ
 * จนใช้ไม่ได้ในปีที่สอง
 */
export async function pull(): Promise<Snapshot> {
  const today = realToday();
  const [{ rooms }, { bookings: upcoming }, { bookings: inhouse }] = await Promise.all([
    api.rooms(),
    api.bookings({ since: today }),
    // แขกที่ครบวันเช็กเอาต์แล้วยังอยู่ ต้องไม่หายจากผังห้อง
    api.bookings({ status: "inhouse" }),
  ]);
  const bookings = [...new Map([...upcoming, ...inhouse].map((b) => [b.ref, b])).values()];

  const rateOf = new Map(rooms.map((r) => [r.no, r.rate]));
  const typeOf = new Map(rooms.map((r) => [r.no, r.type]));

  const list = bookings.map((b) => {
    const out = toBooking(b, (no) => rateOf.get(no) ?? 0);
    out.roomType = typeOf.get(b.room) ?? "";
    return out;
  });

  const bills: Record<string, BillLine[]> = {};
  const staying = bookings.filter((b) => b.status === "inhouse");
  const folios = await Promise.all(
    staying.map((b) => api.folio(b.ref)),
  );
  folios.forEach((f, i) => {
    if (!f) return;
    bills[staying[i].room] = f.charges.map((c, n) => ({
      id: `${staying[i].ref}-${n}`,
      label: c.label,
      qty: c.qty,
      price: c.kind === "discount" ? -c.unit : c.unit,
      kind: c.kind === "discount" ? "service" : c.kind,
    }));
  });

  return { rooms: toRooms(rooms, bookings, today), bookings: list, bills };
}

/**
 * ส่งการกระทำหนึ่งอย่างไปให้หลังบ้านตัดสิน
 *
 * คืน `true` ถ้าหลังบ้านรับผิดชอบการกระทำนั้นแล้ว (หน้าจอต้องดึงข้อมูลใหม่)
 * คืน `false` ถ้ายังไม่มีเส้นทางรองรับ ผู้เรียกต้องแจ้งว่าใช้ในโหมดจริงไม่ได้
 *
 * **ไม่อัปเดตหน้าจอแบบมองโลกในแง่ดี** — ยิงไปก่อนแล้วค่อยวาด ถ้าหลังบ้าน
 * ปฏิเสธเพราะห้องถูกจองไปแล้ว หน้าจอที่วาดไปก่อนจะโกหกอยู่ครู่หนึ่ง
 * ซึ่งเป็นครู่ที่พนักงานใช้บอกแขกไปแล้วว่าจองได้
 */
export async function push(
  action: { type: string; [k: string]: unknown },
  bookings: Pick<Booking, "id" | "room" | "status">[] = [],
): Promise<boolean> {
  const roomRef = () => {
    const matches = bookings.filter((b) => b.room === action.room && b.status === "inhouse");
    if (matches.length !== 1) throw new ApiError(400, "ไม่พบการเข้าพักที่ระบุได้แน่นอนสำหรับห้องนี้ กรุณาโหลดข้อมูลใหม่");
    return matches[0].id;
  };
  switch (action.type) {
    case "CREATE_BOOKING": {
      const b = action.booking as {
        room?: string; guest: string; checkIn: string; checkOut: string;
        adults?: number; children?: number; source?: string;
      };
      if (!b.room) throw new ApiError(400, "กรุณาเลือกห้องก่อนจอง");
      await api.createBooking({
        room_no: b.room,
        guest_name: b.guest,
        check_in: b.checkIn,
        check_out: b.checkOut,
        adults: b.adults ?? 1,
        children: b.children ?? 0,
        source: b.source ?? "direct",
      });
      return true;
    }

    case "CHECK_IN":
      await api.checkIn(String(action.bookingId));
      return true;

    case "CANCEL":
      await api.cancel(String(action.bookingId));
      return true;

    case "ADD_CHARGE": {
      const line = action.line as { label: string; price: number; qty?: number; kind: string };
      const ref = roomRef();
      await api.addCharge(ref, {
        kind: line.kind === "room" ? "room" : line.kind === "fnb" ? "fnb" : "service",
        label: line.label,
        amount: line.price,
        qty: line.qty ?? 1,
      });
      return true;
    }

    case "CHECK_OUT": {
      const ref = roomRef();
      const folio = await api.folio(ref);
      if (folio.totals.balance > 0) throw new ApiError(400, "บิลยังมียอดค้างชำระ กรุณารับชำระก่อนปิดบิล");
      await api.closeFolio(ref);
      return true;
    }

    case "ADD_PAYMENT": {
      const ref = roomRef();
      const folio = await api.folio(ref);
      if (folio.totals.balance !== Number(action.amount) || folio.totals.balance <= 0) {
        throw new ApiError(400, "ยอดค้างชำระเปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่ก่อนรับชำระ");
      }
      await api.addPayment(ref, { method: String(action.method), amount: Number(action.amount) });
      return true;
    }

    default:
      // ยังไม่มีตัวเชื่อมสำหรับคำสั่งนี้ ห้ามแอบเปลี่ยนข้อมูลเฉพาะในเครื่อง
      return false;
  }
}

/** ตรวจว่าวันนี้ของเดโมกับวันนี้จริงห่างกันไหม — ใช้เตือนตอนสลับโหมด */
export const demoDateDiffers = (): boolean => realToday() !== TODAY;

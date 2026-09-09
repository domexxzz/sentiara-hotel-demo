import { api, type ApiBooking, type ApiRoom } from "../lib/api";
import { TODAY } from "../lib/date";
import type { Booking, BillLine } from "./hotelStore";
import type { DeskRoom, RoomStatus } from "../desk/deskData";

/**
 * ชั้นแปลงข้อมูลระหว่างหลังบ้านกับหน้าจอ
 *
 * ── สิ่งที่หลังบ้านยังไม่รู้ ─────────────────────────────────────────
 * หลังบ้านรู้เรื่องการขายห้องกับเงิน แต่ยังไม่รู้เรื่อง **สถานะแม่บ้าน**
 * (รอทำความสะอาด / พร้อมขาย) เพราะยังไม่มีตารางนั้น
 *
 * เวลาเทข้อมูลจริงลงผังห้อง สถานะที่คิดได้จึงมีแค่สามอย่าง — ปิดซ่อม
 * มีแขกอยู่ และว่าง · ห้องที่เพิ่งเช็กเอาต์จะขึ้นว่า "ว่าง" ทันทีทั้งที่
 * จริง ๆ ยังไม่ได้ทำความสะอาด
 *
 * **นี่คือของที่ยังขาด ไม่ใช่ของที่ออกแบบมาแบบนี้** และหน้าจอต้องบอกตามจริง
 * ไม่ใช่เดาสถานะแม่บ้านขึ้นมาเองให้ดูเหมือนครบ
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
  const [{ rooms }, { bookings }] = await Promise.all([
    api.rooms(),
    api.bookings({ since: today }),
  ]);

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
    staying.map((b) => api.folio(b.ref).catch(() => null)),
  );
  folios.forEach((f, i) => {
    if (!f) return;
    bills[staying[i].room] = f.charges.map((c, n) => ({
      id: `${staying[i].ref}-${n}`,
      label: c.label,
      qty: c.qty,
      price: c.unit,
      kind: c.kind === "discount" ? "service" : c.kind,
    }));
  });

  return { rooms: toRooms(rooms, bookings, today), bookings: list, bills };
}

/**
 * ส่งการกระทำหนึ่งอย่างไปให้หลังบ้านตัดสิน
 *
 * คืน `true` ถ้าหลังบ้านรับผิดชอบการกระทำนั้นแล้ว (หน้าจอต้องดึงข้อมูลใหม่)
 * คืน `false` ถ้าเป็นเรื่องที่หลังบ้านยังไม่รู้จัก (ทำในเครื่องต่อไปตามเดิม)
 *
 * **ไม่อัปเดตหน้าจอแบบมองโลกในแง่ดี** — ยิงไปก่อนแล้วค่อยวาด ถ้าหลังบ้าน
 * ปฏิเสธเพราะห้องถูกจองไปแล้ว หน้าจอที่วาดไปก่อนจะโกหกอยู่ครู่หนึ่ง
 * ซึ่งเป็นครู่ที่พนักงานใช้บอกแขกไปแล้วว่าจองได้
 */
export async function push(action: { type: string; [k: string]: unknown }): Promise<boolean> {
  switch (action.type) {
    case "CREATE_BOOKING": {
      const b = action.booking as {
        room?: string; guest: string; checkIn: string; checkOut: string;
        adults?: number; children?: number; source?: string;
      };
      if (!b.room) return false;      // ยังไม่ได้เลือกห้อง หลังบ้านรับไม่ได้
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
      const ref = action.bookingRef as string | undefined;
      if (!ref) return false;         // หน้าจอยังไม่ได้บอกว่าเป็นบิลของการจองใบไหน
      await api.addCharge(ref, {
        kind: line.kind === "room" ? "room" : line.kind === "fnb" ? "fnb" : "service",
        label: line.label,
        amount: line.price,
        qty: line.qty ?? 1,
      });
      return true;
    }

    case "CHECK_OUT": {
      const ref = action.bookingRef as string | undefined;
      if (!ref) return false;
      await api.closeFolio(ref);
      return true;
    }

    default:
      // แม่บ้าน แชท ใบงานช่าง แต้ม ตั้งค่า — หลังบ้านยังไม่มีตารางพวกนี้
      return false;
  }
}

/** ตรวจว่าวันนี้ของเดโมกับวันนี้จริงห่างกันไหม — ใช้เตือนตอนสลับโหมด */
export const demoDateDiffers = (): boolean => realToday() !== TODAY;

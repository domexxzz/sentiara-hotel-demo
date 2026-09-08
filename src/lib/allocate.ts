import type { DeskRoom } from "../desk/deskData";

/**
 * เลือกห้องให้การจองหลายห้อง
 *
 * คนที่จองสองห้องคือครอบครัวที่มีลูก หรือกลุ่มเพื่อน — คำถามแรกของเขาคือ
 * "ห้องติดกันไหม" การหยิบห้องว่างตัวแรก ๆ มาให้โดยไม่ดูเลขห้อง ทำให้ได้
 * ห้อง 201 กับ 302 ซึ่งคนละชั้น แล้วไปโวยกันที่เคาน์เตอร์
 *
 * ลำดับความพยายาม: ติดกันบนชั้นเดียวกัน → ชั้นเดียวกันแต่ไม่ติด → คนละชั้น
 * และต้องบอกผลตามจริงเสมอ ไม่ใช่บอกว่าติดกันแล้วปล่อยให้ไปเซอร์ไพรส์หน้างาน
 */

export type Allocation = {
  rooms: DeskRoom[];
  /** เลขห้องเรียงติดกันหมด เช่น 201, 202 */
  adjacent: boolean;
  /** อยู่ชั้นเดียวกันทุกห้อง */
  sameFloor: boolean;
  /** ข้อความบอกแขกตามจริง */
  note: string;
};

/** ชั้นของห้องจากเลขห้อง · ห้องดอร์ม (D1–D6) นับเป็นชั้นเดียวกันหมด */
export const floorOf = (no: string) => {
  const n = Number(no);
  return Number.isNaN(n) ? "dorm" : String(Math.floor(n / 100));
};

/** ลำดับห้องบนชั้น ใช้เทียบว่าติดกันไหม */
const seqOf = (no: string) => {
  const n = Number(no);
  return Number.isNaN(n) ? Number(no.replace(/\D/g, "")) || 0 : n;
};

/** ห้องชุดที่เลขเรียงติดกันยาวที่สุดบนชั้นเดียว ที่ยาวพอตามจำนวนที่ขอ */
const runOnFloor = (rooms: DeskRoom[], count: number): DeskRoom[] | null => {
  const sorted = [...rooms].sort((a, b) => seqOf(a.no) - seqOf(b.no));
  let run: DeskRoom[] = [];
  for (const r of sorted) {
    if (run.length === 0 || seqOf(r.no) === seqOf(run[run.length - 1].no) + 1) {
      run.push(r);
    } else {
      run = [r];
    }
    if (run.length === count) return run;
  }
  return null;
};

export function allocate(free: DeskRoom[], count: number): Allocation {
  if (count <= 1) {
    const one = free.slice(0, count);
    return { rooms: one, adjacent: true, sameFloor: true, note: "" };
  }

  const byFloor = new Map<string, DeskRoom[]>();
  for (const r of free) {
    const f = floorOf(r.no);
    byFloor.set(f, [...(byFloor.get(f) ?? []), r]);
  }
  // ชั้นที่มีห้องว่างเยอะก่อน — โอกาสได้ห้องติดกันสูงกว่า
  const floors = [...byFloor.entries()].sort((a, b) => b[1].length - a[1].length);

  // 1) ติดกันบนชั้นเดียวกัน
  for (const [floor, rooms] of floors) {
    const run = runOnFloor(rooms, count);
    if (run) {
      return {
        rooms: run,
        adjacent: true,
        sameFloor: true,
        note:
          floor === "dorm"
            ? `เตียงติดกัน ${run.map((r) => r.no).join(" · ")}`
            : `ห้องติดกัน ชั้น ${floor} — ${run.map((r) => r.no).join(" · ")}`,
      };
    }
  }

  // 2) ชั้นเดียวกันแต่เลขไม่ติดกัน
  for (const [floor, rooms] of floors) {
    if (rooms.length >= count) {
      const pick = rooms.slice(0, count);
      return {
        rooms: pick,
        adjacent: false,
        sameFloor: true,
        note: `ชั้นเดียวกัน (ชั้น ${floor}) แต่ห้องไม่ติดกัน — ${pick.map((r) => r.no).join(" · ")}`,
      };
    }
  }

  // 3) คนละชั้น — ต้องบอกตรง ๆ
  const pick = free.slice(0, count);
  return {
    rooms: pick,
    adjacent: false,
    sameFloor: false,
    note: `ช่วงนี้จัดห้องติดกันไม่ได้ ห้องอยู่คนละชั้น — ${pick.map((r) => r.no).join(" · ")} · แจ้งเคาน์เตอร์ได้ถ้าอยากให้ลองสลับ`,
  };
}

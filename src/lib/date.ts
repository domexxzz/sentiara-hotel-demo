// ── Thai-calendar helpers ──────────────────────────────────────────────
// Dates move around as "YYYY-MM-DD" keys so state stays comparable and
// serialisable; Date objects only appear inside these functions.

export const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export const TH_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** อา จ อ พ พฤ ศ ส — Sunday-first, matching Thai calendars */
export const TH_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/** วันที่ที่ระบบสาธิตถือว่าเป็น "วันนี้" — ตรึงไว้ให้เดโมนิ่ง */
export const TODAY = "2026-08-14";

export const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

export const parse = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (k: string, n: number) => {
  const d = parse(k);
  d.setDate(d.getDate() + n);
  return key(d);
};

/** จำนวนคืนระหว่างสองวัน (เช็กเอาท์ − เช็กอิน) */
export const nightsBetween = (from: string, to: string) =>
  Math.max(0, Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000));

/** "14 ส.ค." */
export const fmtShort = (k: string) => {
  const d = parse(k);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]}`;
};

/** "14 ส.ค. 2026" — ปี ค.ศ. ให้ตรงกับที่ใช้ทั้งดีไซน์ */
export const fmtLong = (k: string) => `${fmtShort(k)} ${parse(k).getFullYear()}`;

/** "14–16 ส.ค. 2026" · ย่อเดือนซ้ำเมื่ออยู่เดือนเดียวกัน */
export const fmtRange = (from: string, to: string) => {
  const a = parse(from);
  const b = parse(to);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()}–${b.getDate()} ${TH_MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  return `${fmtShort(from)} – ${fmtLong(to)}`;
};

/** "14–16 ส.ค." สำหรับที่แคบ ๆ */
export const fmtRangeShort = (from: string, to: string) => {
  const a = parse(from);
  const b = parse(to);
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()}–${b.getDate()} ${TH_MONTHS[b.getMonth()]}`;
  }
  return `${fmtShort(from)} – ${fmtShort(to)}`;
};

export type MonthCell = { k: string; day: number; inMonth: boolean };

/**
 * ตารางวันของเดือน (6 แถว × 7 วัน) เริ่มวันอาทิตย์ — รวมวันเติมจากเดือนข้างเคียง
 * เพื่อให้กริดเต็มเสมอ ไม่ต้องจัด layout พิเศษ
 */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { k: key(d), day: d.getDate(), inMonth: d.getMonth() === month };
  });
}

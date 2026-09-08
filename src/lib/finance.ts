/**
 * รายจ่าย · กำไรขาดทุน · กระแสเงินสด · หนี้ค้าง
 *
 * ก่อนหน้านี้ระบบมีแต่ฝั่งรายได้ เจ้าของจึงตอบไม่ได้ว่าเดือนนี้กำไรเท่าไร
 * ซึ่งเป็นคำถามเดียวที่เขาซื้อระบบเพื่อจะตอบ
 *
 * ทุกยอดในไฟล์นี้เป็นบาทเต็ม ไม่มีสตางค์ และเป็นราคา **ก่อน VAT**
 * เพราะ VAT ไม่ใช่รายได้ของโรงแรม เป็นเงินที่เก็บแทนสรรพากร
 */

export type ExpenseCat =
  | "payroll"
  | "utility"
  | "supplies"
  | "ota"
  | "maintenance"
  | "marketing"
  | "finance"
  | "other";

export const CAT: Record<ExpenseCat, { label: string; hint: string }> = {
  payroll: { label: "เงินเดือน & ค่าแรง", hint: "รวมโอทีและประกันสังคม" },
  utility: { label: "ค่าน้ำ ค่าไฟ อินเทอร์เน็ต", hint: "ผูกกับมิเตอร์รายห้องได้" },
  supplies: { label: "ของใช้ & วัตถุดิบ", hint: "ผ้า สบู่ ของในห้อง วัตถุดิบครัว" },
  ota: { label: "ค่าคอมมิชชัน OTA", hint: "หักจากยอดจองผ่านเว็บจอง" },
  maintenance: { label: "ซ่อมบำรุง", hint: "งานช่างและอะไหล่" },
  marketing: { label: "การตลาด", hint: "โฆษณา ส่วนลด โปรโมชัน" },
  finance: { label: "ดอกเบี้ย & ค่าธรรมเนียม", hint: "เงินกู้ ค่าธรรมเนียมธนาคาร" },
  other: { label: "อื่น ๆ", hint: "ที่ไม่เข้าหมวดไหน" },
};

export const CAT_ORDER: ExpenseCat[] = [
  "payroll",
  "utility",
  "supplies",
  "ota",
  "maintenance",
  "marketing",
  "finance",
  "other",
];

export type Expense = {
  id: string;
  /** วันที่เกิดค่าใช้จ่าย YYYY-MM-DD */
  at: string;
  cat: ExpenseCat;
  label: string;
  /** บาท ก่อน VAT */
  amount: number;
  /** จ่ายแล้วหรือยัง — ยังไม่จ่าย = เจ้าหนี้ค้างจ่าย */
  paid: boolean;
  /** กำหนดชำระ ถ้ายังไม่จ่าย */
  due?: string;
  note?: string;
  /** สร้างเองโดยระบบ (เช่น ค่าคอม OTA จากการจองจริง) — แก้มือไม่ได้ */
  auto?: boolean;
};

/** ลูกหนี้ — บิลที่ปิดแล้วแต่ยังเก็บเงินไม่ครบ */
export type Receivable = {
  id: string;
  guest: string;
  room: string;
  /** ยอดที่ยังค้าง (บาท) */
  amount: number;
  since: string;
  reason: string;
};

export type Pnl = {
  revenueRoom: number;
  revenueFnb: number;
  revenue: number;
  byCat: { cat: ExpenseCat; amount: number; pct: number }[];
  expense: number;
  profit: number;
  margin: number;
  /** จ่ายจริงแล้วเท่าไร — ใช้ดูกระแสเงินสด */
  cashOut: number;
  /** ค้างจ่ายเท่าไร */
  unpaid: number;
};

export function pnl(
  revenueRoom: number,
  revenueFnb: number,
  expenses: Expense[],
): Pnl {
  const revenue = revenueRoom + revenueFnb;
  const expense = expenses.reduce((s, e) => s + e.amount, 0);
  const cashOut = expenses.filter((e) => e.paid).reduce((s, e) => s + e.amount, 0);

  const byCat = CAT_ORDER.map((cat) => {
    const amount = expenses
      .filter((e) => e.cat === cat)
      .reduce((s, e) => s + e.amount, 0);
    return { cat, amount, pct: expense > 0 ? Math.round((amount / expense) * 100) : 0 };
  }).filter((c) => c.amount > 0);

  const profit = revenue - expense;
  return {
    revenueRoom,
    revenueFnb,
    revenue,
    byCat,
    expense,
    profit,
    margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
    cashOut,
    unpaid: expense - cashOut,
  };
}

/**
 * จุดคุ้มทุนรายคืน — ต้องขายห้องได้กี่ห้องต่อคืนถึงจะไม่ขาดทุน
 * คำนวณจากรายจ่ายจริงหารจำนวนคืน แล้วหารด้วย ADR
 * ถ้า ADR ยังเป็นศูนย์ (ยังไม่มีการขาย) ตอบ null ดีกว่าตอบเลขที่ไม่มีความหมาย
 */
export function breakEvenRooms(
  expense: number,
  nights: number,
  adr: number,
): number | null {
  if (adr <= 0 || nights <= 0) return null;
  return Math.ceil(expense / nights / adr);
}

/** เงินที่ยังไม่เข้ากระเป๋าจริง — ลูกหนี้ค้างชำระรวม */
export const owedTotal = (rows: Receivable[]) => rows.reduce((s, r) => s + r.amount, 0);

/** ค้างเกินกี่วัน — ใช้จัดลำดับความเร่งด่วนในการตามเก็บ */
export function daysOverdue(since: string, today: string): number {
  const a = new Date(since + "T00:00:00");
  const b = new Date(today + "T00:00:00");
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

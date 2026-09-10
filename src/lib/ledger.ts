/**
 * ระบบบัญชีคู่ — จากบิลถึงงบการเงิน
 *
 * ตัวเลขบนหน้านี้คิดด้วยกติกาเดียวกับหลังบ้านตัวจริง (`server/pms/`) ที่ต่อกับ
 * โปรแกรมบัญชี Ledger Bridge อยู่แล้ว จึงไม่ใช่ตัวเลขที่แต่งขึ้นเพื่อโชว์
 *
 * สามข้อที่ยึดเหมือนกันทั้งสองฝั่ง
 * --------------------------------
 * 1. **เงินเป็นสตางค์จำนวนเต็ม** — `0.1 + 0.2 !== 0.3` ในเลขทศนิยม
 *    พอถอด VAT ออกจากยอดรวม เศษสตางค์เกิดทันที (฿1,650 → ฐาน ฿1,542.06)
 *    บวกกันหลายพันรายการแล้วงบไม่ลง ซึ่งไล่หาย้อนหลังยากที่สุดชนิดหนึ่ง
 *
 * 2. **ถอด VAT ไม่ใช่บวกเพิ่ม** — ราคาห้องที่ประกาศเป็นราคารวมภาษีแล้ว
 *    ม.86/4 (6) ประมวลรัษฎากร บังคับให้แสดงภาษีแยกจากมูลค่าบริการให้ชัดแจ้ง
 *    บวกเพิ่มจากยอดที่แขกเห็น = เก็บเงินเกิน
 *
 * 3. **PMS ส่งเหตุการณ์ ไม่ได้ส่งรายการบัญชี** — PMS รู้ว่าคืนนี้ขายห้องได้เท่าไร
 *    แต่ไม่รู้ว่าเงินก้อนนั้นลงบัญชีตัวไหน และไม่ควรรู้ เพราะผังบัญชีของแต่ละ
 *    โรงแรมไม่เหมือนกัน การแปลงเป็นเดบิต/เครดิตเป็นหน้าที่ของกฎลงบัญชี
 *    ที่นักบัญชีเป็นคนตั้งและเซ็นรับ
 */

/** 1 บาท = 100 สตางค์ */
export const SATANG = 100;

/** บาท → สตางค์ · ปัดครึ่งขึ้นให้ผลเหมือนกันทุกเครื่อง */
export const satang = (baht: number) => Math.round(baht * SATANG);

/**
 * สตางค์ → ข้อความบนหน้าจอ **พร้อมสตางค์เสมอ**
 *
 * จอนี้ห้ามใช้ `money()` ของส่วนอื่นซึ่งปัดเป็นบาทเต็ม — ทั้งจอกำลังอธิบายว่า
 * ต่างกันสตางค์เดียวก็กระทบยอดไม่ลง แล้วถ้าเอาเลขที่ปัดแล้วมาโชว์
 * "ฐาน ฿3,131 + ภาษี ฿219 = ฿3,350" ผู้ชมบวกตามแล้วไม่ตรง ข้อโต้แย้งพังทันที
 */
export const baht2 = (sat: number) =>
  "฿" +
  (sat / SATANG).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** สตางค์ → สตริงจำนวนเงินแบบที่โปรแกรมบัญชีรับ · `"5500.00"` ไม่ใช่ `5500` */
export function moneyString(sat: number): string {
  const sign = sat < 0 ? "-" : "";
  const n = Math.abs(sat);
  return `${sign}${Math.floor(n / SATANG)}.${String(n % SATANG).padStart(2, "0")}`;
}

/** หารแล้วปัดครึ่งขึ้นด้วยจำนวนเต็มล้วน ไม่แตะทศนิยมเลย */
const divRound = (a: number, b: number) => Math.floor((a * 2 + b) / (2 * b));

export type VatSplit = { base: number; vat: number; gross: number };

/**
 * ถอด VAT ออกจากยอดรวม
 *
 * กฎเหล็ก **ฐาน + ภาษี = ยอดรวม เป๊ะเสมอ** ถ้าปัดเศษแล้วไม่ตรง
 * ต้องยกส่วนต่างให้ภาษี ไม่ใช่ปล่อยให้ผลรวมเพี้ยน
 */
export function splitVatSatang(gross: number, vatPct: number): VatSplit {
  if (vatPct <= 0) return { base: gross, vat: 0, gross };
  const base = divRound(gross * 100, 100 + vatPct);
  return { base, vat: gross - base, gross };
}

/* ── ภาษีหัก ณ ที่จ่าย ─────────────────────────────────────────────── */

/** อัตราตาม ท.ป.4/2528 · เก็บเป็นหนึ่งในหมื่นเพื่อรองรับ 0.75% โดยไม่ใช้ทศนิยม */
export const WHT: Record<string, { rate: number; label: string }> = {
  none: { rate: 0, label: "ซื้อสินค้า — ไม่ต้องหัก" },
  service: { rate: 300, label: "ค่าบริการ ค่าจ้างทำของ 3%" },
  professional: { rate: 300, label: "ค่าวิชาชีพอิสระ 3%" },
  rent: { rate: 500, label: "ค่าเช่าอสังหาริมทรัพย์ 5%" },
  advertising: { rate: 200, label: "ค่าโฆษณา 2%" },
  transport: { rate: 100, label: "ค่าขนส่ง 1%" },
};

/**
 * หักภาษี ณ ที่จ่ายจากฐานที่ **ยังไม่รวม VAT**
 *
 * สองข้อที่ผิดกันบ่อยจนกลายเป็นค่าปรับ — หักจากยอดรวม VAT (ต้องหักจากฐาน)
 * และหักค่าสินค้า (ใช้กับ *บริการ* เท่านั้น ซื้อผ้าปูไม่หัก จ้างซักผ้าหัก)
 */
export function withhold(base: number, kind: keyof typeof WHT | string) {
  const rate = WHT[kind]?.rate ?? 0;
  const tax = rate ? divRound(base * rate, 10_000) : 0;
  return { base, tax, net: base - tax };
}

/* ── ผังบัญชี ──────────────────────────────────────────────────────── */

/**
 * ผังบัญชีโรงแรมไทย — ตัดมาเฉพาะบัญชีที่รายการหน้านี้แตะจริง
 *
 * ของจริงที่เครื่องทดสอบมี 57 บัญชีที่ลงได้ · เลขบัญชีของแต่ละโรงแรมไม่เหมือนกัน
 * **จึงตั้งไว้ที่เดียว** และฝั่ง PMS ไม่อ้างเลขพวกนี้ตอนส่งข้อมูลออกไปเลย
 */
export const ACCOUNTS = {
  cash: "1010 เงินสดและเงินฝากธนาคาร",
  ar: "1140 ลูกหนี้การค้า",
  vatOut: "2130 ภาษีขาย",
  whtPayable: "2140 ภาษีหัก ณ ที่จ่ายค้างนำส่ง",
  ap: "2010 เจ้าหนี้การค้า",
  deposit: "2210 เงินมัดจำรับล่วงหน้า",
  revRoom: "4010 รายได้ค่าห้อง",
  revFnb: "4020 รายได้อาหารและเครื่องดื่ม",
  revService: "4030 รายได้บริการอื่น",
  discount: "4090 ส่วนลดจ่าย",
  expense: "5050 ค่าซ่อมแซมและบำรุงรักษา",
} as const;

export type Line = { account: string; debit: number; credit: number; memo?: string };

export type Entry = {
  /** คงที่ตลอดชีวิตของเหตุการณ์ · ผูกกับเลขบิล ไม่ใช่เวลา */
  eventId: string;
  kind: string;
  title: string;
  /** วันทำการของโรงแรม ไม่ใช่เวลาของระบบ */
  businessDate: string;
  lines: Line[];
  reversalOf?: string;
};

export const debitTotal = (e: Entry) => e.lines.reduce((s, l) => s + l.debit, 0);
export const creditTotal = (e: Entry) => e.lines.reduce((s, l) => s + l.credit, 0);
export const isBalanced = (e: Entry) => debitTotal(e) === creditTotal(e);

/* ── บิลหนึ่งใบ → เหตุการณ์ → ใบสำคัญ ───────────────────────────────── */

export type FolioInput = {
  ref: string;
  room: string;
  guest: string;
  businessDate: string;
  /** ทุกยอดเป็นสตางค์จำนวนเต็ม · ส่วนลดใส่เป็นค่าบวก */
  room_: number;
  fnb: number;
  service: number;
  discount: number;
  paid: number;
  vatPct: number;
};

export const grossOf = (f: FolioInput) => f.room_ + f.fnb + f.service - f.discount;

/**
 * หน้าตาของสิ่งที่ **ส่งออกไปจริง** — เหตุการณ์ ไม่ใช่เดบิต/เครดิต
 *
 * จำนวนเงินทุกช่องเป็นสตริง เพราะ `JSON.parse('{"a":21608.65}')` ให้
 * `21608.650000000001` ตั้งแต่ก่อนถึงโค้ดที่จะตรวจ — ความคลาดเคลื่อนเกิดที่
 * ตัวแปลง JSON ไม่ใช่ที่ตรรกะ
 */
export function eventPayload(f: FolioInput) {
  const gross = grossOf(f);
  const v = splitVatSatang(gross, f.vatPct);
  const line = (category: string, amount: number) => ({
    category,
    netAmount: moneyString(splitVatSatang(amount, f.vatPct).base),
  });
  const settlement = [{ method: "CASH", amount: moneyString(f.paid) }];
  if (gross - f.paid > 0)
    settlement.push({ method: "CITY_LEDGER", amount: moneyString(gross - f.paid) });

  return {
    eventId: `NA-${f.ref}`,
    eventType: "NA",
    businessDate: f.businessDate,
    payload: {
      docType: "NA",
      room: f.room,
      guestName: f.guest,
      lines: [
        line("ROOM", f.room_),
        ...(f.fnb ? [line("FNB", f.fnb)] : []),
        ...(f.service ? [line("SERVICE", f.service)] : []),
        ...(f.discount ? [{ category: "DISCOUNT", netAmount: moneyString(-splitVatSatang(f.discount, f.vatPct).base) }] : []),
      ],
      serviceCharge: "0.00",
      vat: moneyString(v.vat),
      grandTotal: moneyString(gross),
      settlement,
    },
  };
}

/**
 * สิ่งที่ **กฎลงบัญชีฝั่งโปรแกรมบัญชี** แปลงออกมา
 *
 * แสดงไว้ให้เห็นว่าปลายทางทำอะไรกับข้อมูลที่เราส่งไป — ไม่ใช่สิ่งที่ PMS ส่ง
 * ภาษีขายยึดจากยอดที่ถอดจากยอดรวมทีเดียว แล้วโยนเศษปัดเข้าบัญชีรายได้ที่ใหญ่สุด
 * เพื่อให้ตัวเลขบนใบกำกับภาษีกับในสมุดบัญชีตรงกันเป๊ะ ไม่ต่างกันแม้สตางค์เดียว
 */
export function postingResult(f: FolioInput): Entry {
  const gross = grossOf(f);
  const v = splitVatSatang(gross, f.vatPct);
  const parts: [keyof typeof ACCOUNTS, number, number][] = [
    ["revRoom", f.room_, 1],
    ["revFnb", f.fnb, 1],
    ["revService", f.service, 1],
    ["discount", f.discount, -1],
  ];
  const bases = new Map<string, number>();
  for (const [key, amt, sign] of parts)
    if (amt) bases.set(key, splitVatSatang(amt, f.vatPct).base * sign);

  const residual = v.base - [...bases.values()].reduce((s, n) => s + n, 0);
  if (residual) {
    const biggest = parts.filter(([, a]) => a).sort((a, b) => b[1] - a[1])[0][0];
    bases.set(biggest, (bases.get(biggest) ?? 0) + residual);
  }

  const lines: Line[] = [];
  for (const [key, amount] of bases) {
    if (key === "discount") {
      lines.push({ account: ACCOUNTS.discount, debit: -amount, credit: 0, memo: "ส่วนลด" });
    } else {
      lines.push({ account: ACCOUNTS[key as keyof typeof ACCOUNTS], debit: 0, credit: amount });
    }
  }
  if (v.vat)
    lines.push({ account: ACCOUNTS.vatOut, debit: 0, credit: v.vat, memo: `ภาษีขาย ${f.vatPct}%` });
  if (f.paid) lines.push({ account: ACCOUNTS.cash, debit: f.paid, credit: 0, memo: "รับชำระ" });
  const balance = gross - f.paid;
  if (balance > 0)
    lines.push({ account: ACCOUNTS.ar, debit: balance, credit: 0, memo: `ค้างชำระ · ${f.guest}` });

  return {
    eventId: `NA-${f.ref}`,
    kind: "NA",
    title: `ปิดยอด ${f.ref} · ห้อง ${f.room}`,
    businessDate: f.businessDate,
    lines,
  };
}

/**
 * ตั้งรายการกลับ — ทางเดียวที่แก้ใบสำคัญที่ลงไปแล้วได้
 *
 * ใบสำคัญเป็นตารางเขียนอย่างเดียว บังคับด้วยทริกเกอร์ในฐานข้อมูลของโปรแกรมบัญชี
 * แก้ไม่ได้ลบไม่ได้แม้เขียน SQL ตรง ๆ — ซึ่งเป็นวิธีที่ผู้สอบบัญชียอมรับ
 */
export function reverse(e: Entry, businessDate: string): Entry {
  return {
    eventId: `ADJ-${e.eventId}`,
    kind: "ADJ",
    title: `กลับรายการ ${e.title}`,
    businessDate,
    reversalOf: e.eventId,
    lines: e.lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit })),
  };
}

/** รายจ่ายที่ต้องหักภาษี ณ ที่จ่าย → ใบสำคัญ */
export function expenseEntry(args: {
  ref: string;
  label: string;
  businessDate: string;
  amount: number;
  kind: string;
}): Entry {
  const w = withhold(args.amount, args.kind);
  const lines: Line[] = [
    { account: ACCOUNTS.expense, debit: w.base, credit: 0, memo: args.label },
  ];
  if (w.tax)
    lines.push({
      account: ACCOUNTS.whtPayable,
      debit: 0,
      credit: w.tax,
      memo: "นำส่งภายในวันที่ 7 ของเดือนถัดไป",
    });
  lines.push({ account: ACCOUNTS.cash, debit: 0, credit: w.net, memo: "จ่ายจริง" });
  return {
    eventId: `EXP-${args.ref}`,
    kind: "EXP",
    title: args.label,
    businessDate: args.businessDate,
    lines,
  };
}

/* ── งบทดลอง ───────────────────────────────────────────────────────── */

export type TrialRow = { account: string; debit: number; credit: number };

/** รวมทุกใบสำคัญเป็นงบทดลอง · เดบิตรวมต้องเท่าเครดิตรวมเสมอ */
export function trialBalance(entries: Entry[]): TrialRow[] {
  const acc = new Map<string, TrialRow>();
  for (const e of entries)
    for (const l of e.lines) {
      const row = acc.get(l.account) ?? { account: l.account, debit: 0, credit: 0 };
      row.debit += l.debit;
      row.credit += l.credit;
      acc.set(l.account, row);
    }
  return [...acc.values()].sort((a, b) => a.account.localeCompare(b.account, "th"));
}

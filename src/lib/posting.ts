/** เอกสารตัวอย่างที่ยิงเข้าเครื่องยนต์กฎจริงของ Ledger Bridge ได้
 *
 * ทำไมต้องมีไฟล์นี้ ไม่ใช้ข้อมูลจอบัญชีเดิม
 * ----------------------------------------
 * `src/lib/ledger.ts` คิดเดบิต/เครดิตด้วยตรรกะที่เราเขียนเลียนแบบเอาเอง
 * ซึ่งวันที่กฎฝั่งเขาเปลี่ยน เดโมจะโชว์ตัวเลขคนละชุดกับของจริงโดยไม่มีใครรู้
 * ไฟล์นี้จึงไม่คิดอะไรเลย — เก็บแค่ **เอกสารที่ส่งออกจริง** แล้วให้
 * `src/vendor/ledger-engine.mjs` (ของที่ทีม Ledger Bridge ประกอบจากซอร์สจริง)
 * เป็นคนตอบว่าลงบัญชีเป็นอะไร
 *
 * รูปร่างของทุกเอกสารในนี้ ตรงกับที่ `server/pms/events.py` ส่งออกจริง
 * ไม่ใช่รูปที่ทำให้เดโมดูสวย
 */

/** เงินเป็นสตริงเสมอ — ทั้งฝั่งเราและฝั่งเขาปฏิเสธตัวเลขทศนิยมโดยตั้งใจ */
export type Doc = Record<string, unknown>;

export interface Sample {
  key: string;
  docType: string;
  title: string;
  /** เกิดตอนไหนในชีวิตจริงของโรงแรม — คนดูต้องโยงกับงานหน้าบ้านได้ */
  when: string;
  /** ช่องที่ให้คนดูลองแก้ได้ · ต้องเป็นช่องเงินระดับบนสุดเท่านั้น */
  tweak?: { field: string; label: string };
  doc: Doc;
}

export const SAMPLES: Sample[] = [
  {
    key: "na",
    docType: "NA",
    title: "ปิดยอดรายคืน",
    when: "ตีสองทุกคืน · ระบบรวมทุกห้องที่มีคนพักแล้วออกเป็นเอกสารใบละห้อง",
    tweak: { field: "grandTotal", label: "ยอดรวมทั้งบิล" },
    doc: {
      eventId: "NA-2026-09-13-BK-FE705B5F",
      docType: "NA",
      businessDate: "2026-09-13",
      bookingRef: "BK-FE705B5F",
      room: "108",
      guestName: "คุณอนันต์ ศรีสุข",
      source: "direct",
      lines: [
        { category: "ROOM", grossAmount: "1650.00", netAmount: "1542.06" },
        { category: "FNB", grossAmount: "130.00", netAmount: "121.50" },
        { category: "SERVICE", grossAmount: "120.00", netAmount: "112.15" },
        { category: "DISCOUNT", grossAmount: "200.00", netAmount: "186.92" },
      ],
      vatBase: "1588.79",
      vatAmount: "111.21",
      vatPct: 7,
      grandTotal: "1700.00",
    },
  },
  {
    key: "stl",
    docType: "STL",
    title: "รับชำระระหว่างพัก",
    when: "แขกจ่ายบางส่วนที่เคาน์เตอร์ · กดรับเงินแล้วเอกสารออกทันที",
    tweak: { field: "amount", label: "ยอดที่รับ" },
    doc: {
      eventId: "STL-PY-8AD8047C",
      docType: "STL",
      businessDate: "2026-09-13",
      bookingRef: "BK-FE705B5F",
      room: "108",
      guestName: "คุณอนันต์ ศรีสุข",
      method: "transfer",
      amount: "1000.00",
      vatBase: "934.58",
      vatAmount: "65.42",
      vatPct: 7,
      settlement: [{ method: "transfer", amount: "1000.00" }],
    },
  },
  {
    key: "exp",
    docType: "EXP",
    title: "รายจ่าย + หัก ณ ที่จ่าย",
    when: "จ่ายผู้รับเหมา · ระบบคำนวณภาษีหักไว้ตาม ท.ป.4/2528 ให้เอง",
    tweak: { field: "amount", label: "ยอดก่อนหักภาษี" },
    doc: {
      eventId: "EXP-EX-06C4D7BA",
      docType: "EXP",
      businessDate: "2026-09-13",
      category: "maintenance",
      label: "จ้างซักผ้าปูที่นอน",
      amount: "9800.00",
      paid: true,
      dueDate: null,
      withholdingKind: "service",
      withholdingTax: "294.00",
      netPayable: "9506.00",
    },
  },
  {
    key: "adj",
    docType: "ADJ",
    title: "ใบลดหนี้ (ม.86/10)",
    when: "ออกใบกำกับไปแล้วแต่คิดเกิน · แก้ใบเดิมไม่ได้ ต้องออกใบลดหนี้",
    doc: {
      eventId: "ADJ-creditnote-CN-2569-00001",
      docType: "ADJ",
      businessDate: "2026-09-13",
      reason: "creditnote",
      sourceRef: "CN-2569-00001",
      amount: "500.00",
      netAmount: "467.29",
      vatAmount: "32.71",
      creditNoteNo: "CN-2569-00001",
      memo: "ลดหนี้ใบกำกับ INV-2569-00002 · คืนค่าอาหารที่เสิร์ฟผิด",
    },
  },
  {
    key: "dep",
    docType: "DEP",
    title: "รับมัดจำ",
    when: "แขกโอนมัดจำก่อนเข้าพัก",
    doc: {
      eventId: "DEP-PY-8AD8047C",
      docType: "DEP",
      businessDate: "2026-09-13",
      bookingRef: "BK-FE705B5F",
      room: "108",
      guestName: "คุณอนันต์ ศรีสุข",
      method: "deposit",
      amount: "1000.00",
      vatBase: "934.58",
      vatAmount: "65.42",
      vatPct: 7,
      settlement: [{ method: "deposit", amount: "1000.00" }],
    },
  },
];

/** แทนค่าช่องเงินหนึ่งช่องแล้วคืนเอกสารใหม่ — ไม่แก้ของเดิม
 *
 * รับเป็นสตริงเสมอ และไม่พยายาม "ช่วย" แปลงตัวเลขให้ ถ้าคนกรอกพิมพ์ผิด
 * ต้องให้เครื่องยนต์เป็นคนบอกว่าผิด เพราะนั่นคือสิ่งที่จะเกิดตอนต่อของจริง
 */
export function withAmount(s: Sample, raw: string): Doc {
  if (!s.tweak) return s.doc;
  return { ...s.doc, [s.tweak.field]: raw };
}

/** ตัวอย่างความผิดที่ตั้งใจให้คนดูลองกด — ทุกอันเคยเกิดกับคนที่ต่อจริง */
export const TRAPS: { key: string; label: string; why: string; make: (d: Doc) => Doc }[] = [
  {
    key: "number",
    label: "ส่งเงินเป็นตัวเลข",
    why: "1700.0 กับ \"1700.00\" ต่างกัน · ทศนิยมฐานสองเก็บเงินไม่ตรงตั้งแต่แรก",
    make: (d) => ({ ...d, grandTotal: 1700.0, amount: 1000.0 }),
  },
  {
    key: "missing",
    label: "ลืมช่อง VAT",
    why: "ช่องที่หายไปกับช่องที่เป็นศูนย์ ไม่เหมือนกัน — อันหลังคือยืนยันว่าไม่มีภาษี",
    make: (d) => {
      const x = { ...d };
      delete x.vatAmount;
      return x;
    },
  },
  {
    key: "unbalanced",
    label: "ยอดรวมไม่ตรงกับบรรทัด",
    why: "บวกทีละบรรทัดแล้วไม่เท่ายอดรวม · ปลายทางไม่ยอมลงใบสำคัญที่ไม่สมดุล",
    make: (d) => ({ ...d, grandTotal: "9999.00", amount: "9999.00" }),
  },
];

/**
 * ภาษีมูลค่าเพิ่มและใบกำกับภาษีเต็มรูป
 *
 * ราคาที่โรงแรมประกาศเป็นราคารวมภาษีแล้ว ("฿1,650 /คืน · ภาษีแล้ว") แต่
 * ใบกำกับภาษีเต็มรูปตาม **มาตรา 86/4 (6) ประมวลรัษฎากร** บังคับให้แสดง
 * จำนวนภาษี "แยกออกจากมูลค่าของสินค้าและหรือของบริการให้ชัดแจ้ง"
 * จึงต้องถอด VAT ออกจากยอดรวม ไม่ใช่บวกเพิ่มจากยอดที่แขกเห็น
 */
export const VAT_PCT = 7;

/** ถอด VAT ออกจากยอดที่รวมภาษีแล้ว — ฐานภาษี + ภาษี = ยอดที่แขกจ่ายเสมอ */
export const splitVat = (gross: number) => {
  const base = Math.round((gross * 100) / (100 + VAT_PCT));
  return { base, vat: gross - base, gross };
};

/** ผู้ประกอบการที่ออกใบกำกับภาษี — ต้องมีครบตาม ม.86/4 (2) */
export const ISSUER = {
  name: "บริษัท เซนเทียร่า โฮเทล จำกัด",
  branch: "สำนักงานใหญ่",
  taxId: "0-1055-•••••-••-•",
  address: "123 ถ.นิมมานเหมินท์ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200",
};

/** ผู้ซื้อ — ม.86/4 (3) ต้องมีชื่อและที่อยู่ ถ้าออกในนามบริษัทต้องมีเลขผู้เสียภาษีด้วย */
export type Buyer = {
  name: string;
  address: string;
  taxId?: string;
  branch?: string;
};

export type InvoiceLine = { label: string; note?: string; qty: number; price: number };

export type TaxInvoice = {
  /** ม.86/4 (4) เลขที่ใบกำกับภาษี */
  no: string;
  /** ม.86/4 (7) วันที่ออก */
  date: string;
  buyer: Buyer;
  lines: InvoiceLine[];
  base: number;
  vat: number;
  gross: number;
  room: string;
};

let seq = 0;

/** เลขที่ใบกำกับภาษีต้องเรียงไม่ซ้ำ · รูปแบบ INV-YYMM-#### */
export const nextInvoiceNo = (day: string) => {
  const [y, m] = day.split("-");
  return `INV-${y.slice(2)}${m}-${String(++seq).padStart(4, "0")}`;
};

export const buildInvoice = (args: {
  no: string;
  date: string;
  room: string;
  buyer: Buyer;
  lines: InvoiceLine[];
}): TaxInvoice => {
  const gross = args.lines.reduce((t, l) => t + l.price * l.qty, 0);
  const { base, vat } = splitVat(gross);
  return { ...args, base, vat, gross };
};

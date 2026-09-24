/**
 * กติกาการคิดราคา — แหล่งความจริงแหล่งเดียวของทั้งใบเสนอราคา
 *
 * ทำไมต้องแยกไฟล์และเป็นฟังก์ชันบริสุทธิ์
 * ----------------------------------------
 * ใบเสนอราคาหน้าเดียวมีตัวเลขเดียวกันโผล่สามที่ — การ์ดสามใบ ตารางรายการ
 * และช่องรวมท้ายใบ · ถ้าคิดแยกกันสามที่ วันหนึ่งจะมีที่หนึ่งที่ลืมแก้
 * แล้ว **ลูกค้าจะเป็นคนเจอก่อนเรา** ซึ่งเป็นความผิดพลาดที่แก้ทีหลังไม่ได้
 *
 * ทุกตัวเลขในหน้าจึงมาจาก `quote()` ตัวเดียว และมีเทสยิงกติกาทุกข้อ
 *
 * ที่มาของกติกา: `docs/packages.md`
 */

/** ราคาล็อกต่อห้อง — รวมล็อก ติดตั้ง ตั้งค่า ทดสอบ อบรม และรับประกันปีแรก */
export const LOCK_PER_ROOM = 4000;

/** ค่าดูแลล็อกรายปี ต่อห้อง (แบตเตอรี่ + ตรวจประจำปี) · เลือกซื้อหรือไม่ก็ได้ */
export const LOCK_CARE_PER_ROOM = 300;

/** ค่าดูแลโปรแกรมรายปี คิดเป็นสัดส่วนของค่าลิขสิทธิ์ · เริ่มเก็บปีที่ 2 */
export const CARE_RATE = 0.18;

/**
 * ค่าลิขสิทธิ์โปรแกรมเป็นขั้น ไม่คิดรายห้อง
 *
 * เพราะฝั่งล็อกคิดรายห้องอยู่แล้ว · ถ้าคิดรายห้องทั้งสองก้อน ลูกค้าจะรู้สึกว่า
 * โดนคิดเงินสองรอบจากจำนวนห้องเดียวกัน ซึ่งเป็นความรู้สึกที่อธิบายยากมาก
 * ตอนอยู่ในห้องประชุม
 */
export const SOFTWARE_TIERS = [
  { upTo: 25, price: 150000, label: "ถึง 25 ห้อง" },
  { upTo: 60, price: 190000, label: "26–60 ห้อง" },
];

/** ส่วนลดเมื่อซื้อครบชุด — 9% ของยอดรวม ปัดลงหลักพัน
 *
 * ปัดลงไม่ใช่ปัดใกล้ เพราะตัวเลขบนใบเสนอราคาต้องลงท้ายสวย และการปัดลง
 * ทำให้เราไม่มีวันลดเกินที่ตั้งใจ · 9% มาจากดีล 43 ห้องที่ตกลงกันแล้ว
 * (362,000 → ลด 32,000 → 330,000) แล้วถอดกลับเป็นกติกาให้ใช้ซ้ำได้
 */
export const BUNDLE_DISCOUNT_RATE = 0.09;

/** สมมติฐานที่ใช้คำนวณจุดคุ้มทุน — เปิดเผยไว้ตรงนี้เพราะมันคือสมมติฐาน ไม่ใช่ข้อเท็จจริง */
export const ROI = {
  adr: 1343,           // ราคาห้องเฉลี่ยจากเดโม
  occupancy: 0.77,     // อัตราเข้าพักจากเดโม
  shiftToDirect: 0.10, // สัดส่วนยอดที่คาดว่าจะย้ายจาก OTA มาจองตรงได้
  otaCommission: [0.15, 0.18], // ช่วงค่าคอมมิชชัน OTA ทั่วไป
};

const floorTo = (n, step) => Math.floor(n / step) * step;

/** ราคาโปรแกรมตามจำนวนห้อง · เกินขั้นสุดท้ายคืน null เพราะตีราคาเป็นสูตรไม่ได้ */
export function softwarePrice(rooms) {
  for (const t of SOFTWARE_TIERS) {
    if (rooms <= t.upTo) return { price: t.price, label: t.label };
  }
  return null;
}

/**
 * คิดราคาทั้งใบจากจำนวนห้องเดียว
 *
 * โยน error เมื่อคิดไม่ได้ แทนที่จะคืนตัวเลขมั่ว ๆ — ใบเสนอราคาที่ตัวเลขผิด
 * แย่กว่าใบเสนอราคาที่สร้างไม่ออก เพราะอันหลังเรารู้ตัวทันที
 */
export function quote(rooms) {
  if (!Number.isInteger(rooms) || rooms < 1) {
    throw new Error(`จำนวนห้องต้องเป็นจำนวนเต็มบวก (ได้ ${rooms})`);
  }
  const tier = softwarePrice(rooms);
  if (!tier) {
    throw new Error(
      `${rooms} ห้องเกิน ${SOFTWARE_TIERS[SOFTWARE_TIERS.length - 1].upTo} ห้อง — ` +
      "ต้องตีราคาเป็นรายโครงการ เพราะงานจริงอยู่ที่การรวมรายงานข้ามสาขา " +
      "ย้ายข้อมูลจากระบบเดิม และต่อกับระบบบัญชีที่เครือใช้อยู่",
    );
  }

  const lock = rooms * LOCK_PER_ROOM;
  const software = tier.price;
  const gross = lock + software;
  const discount = floorTo(gross * BUNDLE_DISCOUNT_RATE, 1000);
  const bundle = gross - discount;

  const careSoftware = Math.round(software * CARE_RATE);
  const careLock = rooms * LOCK_CARE_PER_ROOM;

  // ── จุดคุ้มทุน · เปิดสูตรไว้ให้ตรวจได้ ────────────────────────────
  const monthlyRevenue = Math.round(rooms * ROI.adr * ROI.occupancy * 30);
  const shifted = monthlyRevenue * ROI.shiftToDirect;
  const savedLow = Math.round(shifted * ROI.otaCommission[0]);
  const savedHigh = Math.round(shifted * ROI.otaCommission[1]);
  const paybackLong = Math.ceil(bundle / savedLow);
  const paybackShort = Math.ceil(bundle / savedHigh);

  return {
    rooms,
    lock,
    lockPerRoom: LOCK_PER_ROOM,
    software,
    softwareTier: tier.label,
    gross,
    discount,
    bundle,
    careSoftware,
    careLock,
    careTotal: careSoftware + careLock,
    roi: { monthlyRevenue, savedLow, savedHigh, paybackShort, paybackLong },
  };
}

/** จัดรูปเงินแบบที่ใช้ทั้งใบ — ไม่มีสตางค์ เพราะราคาขายเป็นหลักพันเสมอ */
export const baht = (n) => "฿" + n.toLocaleString("en-US");

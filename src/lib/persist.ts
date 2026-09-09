/**
 * จำสถานะข้ามการรีเฟรช
 *
 * เดโมที่รีเฟรชแล้วข้อมูลหายหมด ทำให้ลูกค้าไม่กล้าเชื่อว่าของจริงจะบันทึกได้
 * ไฟล์นี้แก้ปัญหานั้น — แต่ต้องพูดให้ตรงว่า **นี่ไม่ใช่ฐานข้อมูล**
 *
 *   เก็บใน localStorage ของเบราว์เซอร์เครื่องนี้เท่านั้น
 *   เปิดอีกเครื่องคือข้อมูลคนละชุด · ล้างข้อมูลเบราว์เซอร์แล้วหาย
 *   สองคนแก้พร้อมกันไม่เห็นกัน
 *
 * ของจริงต้องมีเซิร์ฟเวอร์และฐานข้อมูล — อันนี้คือสะพานให้เดโมเดินต่อได้ก่อน
 */

/**
 * ขึ้นเลขนี้เมื่อโครงสร้าง state เปลี่ยนจนของเก่าใช้ไม่ได้ — ของเก่าจะถูกทิ้งเอง
 *
 * v2 · แตกหมวดรายจ่ายให้ตรงกับผังบัญชีของโปรแกรมบัญชี
 *      utility → electricity / water / telecom · finance → bankfee / interest
 *      ของที่บันทึกไว้ตอน v1 มีหมวดที่ไม่มีอยู่แล้ว ถ้าไม่ทิ้ง หน้ารายจ่ายจะ
 *      แสดงชื่อหมวดเป็นค่าว่างและยอดหายไปจากกราฟแยกหมวด
 */
const VERSION = 2;

const keyOf = (name: string) => `sentiara:${name}:v${VERSION}`;

export function load<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(keyOf(name));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object") return fallback;
    // รวมกับค่าตั้งต้น — ฟิลด์ใหม่ที่เพิ่งเพิ่มจะไม่หายไปกับของเก่าที่บันทึกไว้
    return { ...(fallback as object), ...(parsed as object) } as T;
  } catch {
    return fallback;
  }
}

export function save<T>(name: string, value: T): void {
  try {
    localStorage.setItem(keyOf(name), JSON.stringify(value));
  } catch {
    // เต็มโควตาหรือโหมดส่วนตัว — ปล่อยผ่าน ระบบต้องเดินต่อได้แม้บันทึกไม่ได้
  }
}

/** ล้างของที่บันทึกไว้ทั้งหมด — ปุ่ม "เริ่มเดโมใหม่" เรียกอันนี้ */
export function wipe(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sentiara:")) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ไม่มีอะไรให้ล้าง */
  }
}

/** บันทึกได้จริงไหมในเบราว์เซอร์นี้ — ใช้บอกผู้ใช้ตามจริง ไม่ใช่อ้างว่าบันทึกแล้วทั้งที่ไม่ได้ */
export function canPersist(): boolean {
  try {
    const probe = "sentiara:probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

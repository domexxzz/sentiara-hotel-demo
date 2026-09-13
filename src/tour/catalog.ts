/** สารบัญฟังก์ชัน — 14 กลุ่ม 83 ฟังก์ชัน ผูกกับจอจริงในเดโม
 *
 * ทำไมต้องมีไฟล์นี้
 * ------------------
 * หน้านำเสนอโฆษณา 83 ฟังก์ชัน · เดโมมี 5 มุมมองกับอีกยี่สิบกว่าจอย่อย
 * แต่ไม่มีอะไรบอกลูกค้าว่า "ฟังก์ชันที่เพิ่งอ่านมา อยู่ตรงไหนให้กด"
 * ลูกค้าที่หาไม่เจอจะสรุปว่าไม่มี ซึ่งแย่กว่าไม่ได้โฆษณาตั้งแต่แรก
 *
 * ไฟล์นี้คือแผนที่นั้น และเป็นสัญญาที่เทสคุมได้ (tests/catalog.test.cjs):
 * ทุกรายการต้องชี้ไปยังมุมมองและแท็บที่มีอยู่จริง
 *
 * ความซื่อสัตย์
 * -------------
 * ตอนนี้ทั้ง 83 รายการมีจอจริงให้กดครบแล้ว · ธง `soon` ยังเก็บไว้ในชนิดข้อมูล
 * สำหรับฟังก์ชันที่จะเพิ่มเข้าหน้านำเสนอก่อนทำจอเสร็จ — ตาม AGENTS.md ข้อ 7
 * หน้านำเสนอเป็นเอกสารขายที่เจ้าของกำหนดให้พูดถึงทุกฟังก์ชันเป็นความสามารถ
 * แต่ **ตัวซอฟต์แวร์เองห้ามพาไปที่ที่ไม่มีอะไร** ลูกค้ากดแล้วเจอจอว่าง
 * เสียหายกว่าบอกตรง ๆ ว่ายังไม่เสร็จ
 */
import type { Target } from "./target";

export type Spot = Target & {
  /** ชื่อบนหน้านำเสนอ ใช้ค้นหาด้วยได้ */
  en: string;
  th: string;
  /** ยังไม่มีจอเฉพาะในเดโม — พาไปจอที่ใกล้ที่สุดแทน */
  soon?: true;
};

export type Group = {
  n: string;
  en: string;
  th: string;
  spots: Spot[];
};

export const CATALOG: Group[] = [
  {
    n: "01", en: "Manage Customer", th: "งานลูกค้าและการจอง",
    spots: [
      { en: "Home", th: "หน้าจองฝั่งแขก", flow: "guest", hint: "นี่คือหน้าที่แขกเห็นบนมือถือ" },
      { en: "Book Room System", th: "ระบบจองห้อง", flow: "guest", hint: "กด “จองห้องนี้” แล้วเดินตามขั้นตอนจนจบ" },
      { en: "Check In / Check Out", th: "เช็กอิน–เช็กเอาต์", flow: "desk", desk: "rack", hint: "กดห้องที่มีแขกมาถึงวันนี้ในผังห้อง" },
      { en: "Change Room", th: "ย้ายห้อง เลื่อนวัน ยกเลิก", flow: "desk", desk: "manage", hint: "เลือกการจองแล้วกดย้ายห้องหรือเลื่อนวัน" },
      { en: "Booking History", th: "ประวัติการเข้าพัก", flow: "owner", owner: "guests", hint: "กดชื่อลูกค้าเพื่อดูว่าเคยพักกี่ครั้ง" },
      { en: "Feedback", th: "รีวิวจากแขก", flow: "owner", owner: "guests", hint: "รีวิวแสดงอยู่ในประวัติของลูกค้าแต่ละคน" },
      { en: "Redeem Present", th: "แต้มสะสมและของรางวัล", flow: "owner", owner: "guests", hint: "ดูแต้มคงเหลือและของที่แลกได้" },
      { en: "Alert For Anniversary", th: "เตือนวันเกิดและวันครบรอบ", flow: "owner", owner: "guests", hint: "ลูกค้าที่มีวันสำคัญใกล้ถึงจะถูกทำเครื่องหมายไว้" },
      { en: "Festival", th: "แคมเปญเทศกาล", flow: "owner", owner: "channels", hint: "ตั้งราคาช่วงเทศกาลแล้วส่งออกทุกช่องทางพร้อมกัน" },
    ],
  },
  {
    n: "02", en: "Manage Employee", th: "งานทีมงาน",
    spots: [
      { en: "Clock In / Clock Out", th: "ลงเวลาเข้าออกงาน", flow: "staff", staff: "list", hint: "ปุ่มตอกบัตรอยู่หัวจอพนักงาน" },
      { en: "Enrollment Employee", th: "ทะเบียนพนักงาน", flow: "owner", owner: "team", hint: "รายชื่อพนักงานพร้อมบทบาทและสิทธิ์" },
      { en: "KPI For Employee", th: "ตัวชี้วัดรายคน", flow: "owner", owner: "team", hint: "ดูงานที่ทำเสร็จและงานที่ถูกตีกลับรายคน" },
      { en: "SOP", th: "คลังคู่มือการทำงาน", flow: "owner", owner: "team", hint: "คู่มือที่พนักงานเปิดดูได้จากมือถือ" },
      { en: "AI For Regulation", th: "ผู้ช่วยตอบเรื่องระเบียบ", flow: "owner", owner: "ai", hint: "ลองถามเรื่องระเบียบพนักงานดู" },
    ],
  },
  {
    n: "03", en: "Manage Housekeeper", th: "งานแม่บ้าน",
    spots: [
      { en: "Image Standard", th: "ถ่ายรูปตรวจมาตรฐานห้อง", flow: "staff", staff: "list", role: "hk", hint: "เปิดใบงาน แล้วแนบรูปให้ครบ 3 รูปก่อนส่งตรวจ" },
      { en: "Clock In / Clock Out", th: "ลงเวลาแม่บ้าน", flow: "staff", staff: "list", role: "hk", hint: "ตอกบัตรก่อนเริ่มงานกะ" },
      { en: "Examine Inventory", th: "คลังของใช้ในห้อง", flow: "owner", owner: "team", hint: "ของใช้ที่เบิกไปและที่เหลือในคลัง" },
    ],
  },
  {
    n: "04", en: "Financial", th: "การเงินหน้าบ้าน",
    spots: [
      { en: "Bill", th: "บิลห้องใบเดียวจบ", flow: "desk", desk: "checkout", hint: "ค่าห้อง อาหาร มินิบาร์ อยู่ในบิลใบเดียวกัน" },
      { en: "Tax", th: "ใบกำกับภาษีเต็มรูป", flow: "desk", desk: "invoice", hint: "ออกใบกำกับภาษีตาม ม.86/4 ครบทุกช่อง" },
      { en: "Transaction", th: "สมุดรายการเดินบัญชี", flow: "owner", owner: "finance", hint: "ทุกรายการรับจ่ายเรียงตามวัน" },
      { en: "Accountant", th: "เชื่อมโปรแกรมบัญชี", flow: "owner", owner: "ledger", hint: "คิวที่รอส่งเข้าโปรแกรมบัญชีอยู่ท้ายจอ" },
      { en: "Tag Financial", th: "แยกหมวดรายจ่าย", flow: "owner", owner: "finance", hint: "รายจ่าย 11 หมวดที่ตรงกับผังบัญชีจริง" },
      { en: "Procurement", th: "สั่งซื้อและตัดสต็อก", flow: "pos", pos: "stock", hint: "สั่งอาหารแล้ววัตถุดิบตัดสต็อกเอง" },
      { en: "Debt Collection", th: "ติดตามลูกหนี้", flow: "owner", owner: "finance", hint: "ยอดค้างรับแยกตามอายุหนี้" },
      { en: "Pledge", th: "มัดจำและเงินประกัน", flow: "desk", desk: "checkout", hint: "มัดจำหักออกจากยอดที่ต้องจ่ายตอนปิดบิล" },
    ],
  },
  {
    n: "05", en: "Double-Entry Accounting", th: "ระบบบัญชีคู่",
    spots: [
      { en: "Event-Driven Posting", th: "ส่งเหตุการณ์ ไม่ได้ส่งรายการบัญชี", flow: "owner", owner: "posting", hint: "เลือกเหตุการณ์แล้วดูว่ากฎปลายทางแปลงเป็นเดบิต/เครดิตอะไร" },
      { en: "Chart of Accounts", th: "ผังบัญชีโรงแรมไทย", flow: "owner", owner: "posting", hint: "ผังบัญชีจริงจากโปรแกรมบัญชี ไม่ใช่รายการที่เดโมพิมพ์เอง" },
      { en: "Balanced Or Nothing", th: "เดบิตไม่เท่าเครดิต ส่งออกไม่ได้", flow: "owner", owner: "posting", hint: "กดปุ่ม “ยอดรวมไม่ตรงกับบรรทัด” แล้วดูว่าระบบบัญชีปฏิเสธยังไง" },
      { en: "Idempotent Delivery", th: "ส่งซ้ำไม่เกิดบัญชีซ้ำ", flow: "owner", owner: "ledger", hint: "ลองกดส่งซ้ำดูว่ายอดขยับไหม" },
      { en: "Write-Once Ledger", th: "ลงแล้วแก้ไม่ได้ ลบไม่ได้", flow: "owner", owner: "ledger", hint: "แก้ไม่ได้ ต้องตั้งรายการกลับเท่านั้น" },
      { en: "Integer Money", th: "เงินเป็นสตางค์จำนวนเต็มทั้งระบบ", flow: "owner", owner: "ledger", hint: "ไม่มีเศษหายจากการปัดเลขทศนิยม" },
      { en: "VAT Extraction", th: "ถอด VAT ไม่ใช่บวกเพิ่ม", flow: "desk", desk: "invoice", hint: "ราคาที่แขกเห็นคือราคาที่จ่าย VAT ถอดออกมา" },
      { en: "Business Date", th: "วันทำการ ไม่ใช่เวลาเครื่อง", flow: "owner", owner: "ledger", hint: "ปิดยอดรายคืนใช้วันทำการ" },
      { en: "Withholding Tax", th: "ภาษีหัก ณ ที่จ่าย", flow: "owner", owner: "finance", hint: "จ้างบริการหัก 3% · ซื้อของไม่หัก" },
      { en: "Trial Balance", th: "งบทดลองและปิดงวด", flow: "owner", owner: "ledger", hint: "ยอดรวมสองฝั่งต้องเท่ากันเสมอ" },
    ],
  },
  {
    n: "06", en: "Dashboard", th: "แดชบอร์ดเจ้าของ",
    spots: [
      { en: "Business Analysis", th: "ตัวเลขชี้วัดธุรกิจ", flow: "owner", owner: "overview", hint: "กดการ์ดตัวเลขเพื่อดูว่ามาจากบิลใบไหน" },
      { en: "Income / Outcome", th: "รายได้เทียบรายจ่าย", flow: "owner", owner: "finance", hint: "รายได้กับรายจ่ายในจอเดียว" },
      { en: "Profit / Loss", th: "กำไรขาดทุน", flow: "owner", owner: "finance", hint: "กำไรขั้นต้นและกำไรสุทธิของงวด" },
      { en: "Cashflow", th: "กระแสเงินสด", flow: "owner", owner: "finance", hint: "เงินเข้าออกจริง ไม่ใช่ยอดตามบิล" },
      { en: "Debt", th: "หนี้สินและภาระผูกพัน", flow: "owner", owner: "finance", hint: "ยอดค้างจ่ายและค้างรับ" },
    ],
  },
  {
    n: "07", en: "Setting / Config", th: "ตั้งค่าระบบ",
    spots: [
      { en: "Property Profile", th: "ข้อมูลกิจการ", flow: "owner", owner: "settings", hint: "ชื่อ เลขผู้เสียภาษี ที่อยู่ที่ขึ้นบนใบกำกับภาษี" },
      { en: "Room Rates", th: "ราคาห้องรายประเภท", flow: "owner", owner: "settings", hint: "แก้ราคาแล้วดูว่าหน้าจองฝั่งแขกเปลี่ยนตาม" },
      { en: "Seasonal Pricing", th: "เรตวันหยุดและฤดูกาล", flow: "owner", owner: "settings", hint: "ศุกร์–เสาร์ใช้เรตคนละตัวกับวันธรรมดา" },
      { en: "Tax & Deposit", th: "ภาษีและมัดจำ", flow: "owner", owner: "settings", hint: "อัตรา VAT และมัดจำที่ใช้ทั้งระบบ" },
      { en: "Roles & Permissions", th: "สิทธิ์ผู้ใช้", flow: "owner", owner: "team", hint: "6 บทบาท · ลองแตะบัตรเป็นแม่บ้านแล้วดูว่าเข้าจอไหนไม่ได้" },
    ],
  },
  {
    n: "08", en: "Manage IoT", th: "อุปกรณ์ในอาคาร",
    spots: [
      { en: "Smart Door Lock", th: "กลอนประตู NFC", flow: "owner", owner: "door", hint: "ทุกครั้งที่เปิดประตูมีบันทึกว่าใครและเมื่อไร" },
      { en: "Energy Metering", th: "มิเตอร์ไฟรายห้อง", flow: "owner", owner: "energy", hint: "ห้องที่กินไฟผิดปกติถูกทำเครื่องหมายไว้" },
      { en: "Fire Alarm System", th: "ระบบแจ้งเหตุเพลิงไหม้", flow: "owner", owner: "energy", hint: "สัญญาณจากเซ็นเซอร์เข้าระบบเดียวกับงานอื่น" },
    ],
  },
  {
    n: "09", en: "Security & Legal", th: "ความปลอดภัยและงานกฎหมาย",
    spots: [
      { en: "Security Camera", th: "กล้องวงจรปิด", flow: "owner", owner: "security", hint: "สถานะกล้องและการเก็บภาพย้อนหลัง" },
      { en: "Firmware Analyze", th: "ตรวจความปลอดภัยอุปกรณ์", flow: "owner", owner: "security", hint: "อุปกรณ์ที่เฟิร์มแวร์เก่าเกินไปถูกเตือน" },
      { en: "Lawyer", th: "ผู้ช่วยงานกฎหมาย", flow: "owner", owner: "security", hint: "งานตามกฎหมายที่ครบกำหนดเร็ว ๆ นี้" },
    ],
  },
  {
    n: "10", en: "Thai Compliance", th: "งานที่กฎหมายไทยบังคับ",
    spots: [
      { en: "Guest Register", th: "ทะเบียนผู้พัก ร.ร.3 / ร.ร.4", flow: "desk", desk: "register", hint: "หนึ่งแถวต่อผู้พักหนึ่งคน ตาม ม.35 พ.ร.บ.โรงแรม" },
      { en: "Immigration TM.30", th: "แจ้งที่พักคนต่างด้าว ตม.30", flow: "desk", desk: "register", hint: "แขกต่างชาติจะมีนาฬิกานับถอยหลัง 24 ชั่วโมง" },
      { en: "Double-Entry Ledger", th: "ส่งเข้าสมุดบัญชีคู่", flow: "owner", owner: "ledger", hint: "ใบสำคัญที่ส่งออกไปแล้วแก้ไม่ได้" },
      { en: "Audit Trail", th: "ร่องรอยการตรวจสอบ", flow: "owner", owner: "security", hint: "ใครทำอะไรเมื่อไร ลบไม่ได้" },
    ],
  },
  {
    n: "11", en: "Operations Core", th: "จอที่ใช้ระหว่างวัน",
    spots: [
      { en: "Room Calendar", th: "ปฏิทินห้อง 14 วัน", flow: "desk", desk: "calendar", hint: "ลองกดช่องที่มีคนจองแล้วดูว่าระบบยอมไหม" },
      { en: "Room Rack", th: "ผังห้องเรียลไทม์", flow: "desk", desk: "rack", hint: "สีห้องเปลี่ยนตามสิ่งที่คุณกดในจออื่น" },
      { en: "Adjacent Rooms", th: "จัดห้องติดกัน", flow: "desk", desk: "walkin", hint: "จองหลายห้องแล้วระบบจัดห้องติดกันให้" },
      { en: "Restaurant POS", th: "POS ร้านอาหารเข้าบิลห้อง", flow: "pos", pos: "order", hint: "เลือกห้องปลายทางก่อน แล้วกดเมนู" },
      { en: "Approvals", th: "รออนุมัติส่วนลดและคืนเงิน", flow: "owner", owner: "approvals", hint: "ส่วนลดเกินเพดานต้องผ่านเจ้าของ" },
      { en: "Maintenance Orders", th: "ใบงานช่าง", flow: "staff", staff: "tech", role: "tech", hint: "ใบงานช่างแยกจากงานแม่บ้าน" },
      { en: "AI Assistant", th: "ผู้ช่วยเจ้าของกิจการ", flow: "owner", owner: "ai", hint: "ถามแล้วคำตอบอ้างอิงบิลใบจริงเสมอ" },
    ],
  },
  {
    n: "12", en: "Channels & Messaging", th: "ช่องทางขายและข้อความ",
    spots: [
      { en: "Channel Manager", th: "ซิงก์ห้องว่างและราคา", flow: "owner", owner: "channels", hint: "Agoda · Booking · Traveloka ในจอเดียว" },
      { en: "Instant Sync", th: "จองเข้ามาปิดขายทุกที่ทันที", flow: "owner", owner: "channels", hint: "ขายห้องเดียวกันซ้ำสองช่องทางไม่ได้" },
      { en: "Rate Parity", th: "ราคาตรงกันทุกช่องทาง", flow: "owner", owner: "channels", hint: "ตั้งราคาที่เดียว ส่งออกพร้อมกัน" },
      { en: "Commission Tracking", th: "ค่านายหน้าเข้ารายจ่ายเอง", flow: "owner", owner: "finance", hint: "จองผ่าน OTA แล้วค่าคอมเข้ารายจ่ายอัตโนมัติ" },
      { en: "Direct Booking Engine", th: "หน้าจองตรงบนเว็บโรงแรม", flow: "guest", hint: "จองตรงถูกกว่าผ่าน OTA เพราะไม่มีค่านายหน้า" },
      { en: "Unified Inbox", th: "แชทรวมทุกช่องทาง", flow: "desk", desk: "inbox", hint: "ไลน์ เฟซบุ๊ก OTA มาอยู่กล่องเดียว" },
      { en: "Reply Guard", th: "ด่านกรองก่อนตอบอัตโนมัติ", flow: "desk", desk: "inbox", hint: "คำตอบอัตโนมัติต้องผ่านด่านกรองสี่ชั้นก่อนส่ง" },
      { en: "Review Sync", th: "รีวิวจากทุกช่องทางที่เดียว", flow: "owner", owner: "channels", hint: "รีวิวทุกช่องทางรวมอยู่ที่เดียว" },
    ],
  },
  {
    n: "13", en: "ChivaGo · Verified Privilege", th: "ChivaGo สิทธิพิเศษ",
    spots: [
      { en: "Green Points", th: "แต้มที่โฮสต์ยืนยันแล้ว", flow: "owner", owner: "chivago", hint: "แต้มที่ต้องมีคนยืนยัน ไม่ใช่กดเอง" },
      { en: "Trip Points", th: "แต้มที่ยืนยันเอง", flow: "owner", owner: "chivago", hint: "ได้ง่ายกว่า แต่แสดงผลแยกกันคนละช่อง" },
      { en: "Host Console", th: "จอสำหรับโฮสต์อนุมัติ", flow: "owner", owner: "chivago", hint: "โฮสต์กดอนุมัติหรือปฏิเสธพร้อมเหตุผล" },
      { en: "Immutable Statement", th: "ใบรับรองที่แก้ไม่ได้", flow: "owner", owner: "chivago", hint: "แก้แล้วรหัสตรวจสอบไม่ตรง ระบบปฏิเสธ" },
      { en: "ESG & Sponsor Report", th: "รายงานให้ผู้สนับสนุน", flow: "owner", owner: "chivago", hint: "นับคนที่มาจริง ไม่นับการมองเห็น" },
      { en: "B2B Partner Network", th: "เครือข่ายสิทธิพิเศษข้ามธุรกิจ", flow: "owner", owner: "chivago", hint: "โรงแรมกับร้านอาหารในย่านเดียวกันแลกสิทธิ์กัน" },
    ],
  },
  {
    n: "14", en: "Guest Wi-Fi & Compliance", th: "Wi-Fi ที่พัก",
    spots: [
      { en: "Auto Credential", th: "ออกรหัสตอนเช็กอินเอง", flow: "owner", owner: "wifi", hint: "กด “ออกรหัสใหม่” แล้วดูว่ารหัสแสดงครั้งเดียว" },
      { en: "Per-Room Identity", th: "รหัสของใครของมัน", flow: "owner", owner: "wifi", hint: "ชื่อผู้ใช้คือเลขห้อง รหัสสุ่มรายห้อง ไม่ใช่รหัสรวมทั้งตึก" },
      { en: "Auto Expiry", th: "หมดอายุเองหลังเช็กเอาต์", flow: "owner", owner: "wifi", hint: "ดูบรรทัด “ใช้ได้ถึง” — เช็กเอาต์บวกผ่อนผัน 3 ชั่วโมง" },
      { en: "Device Limit", th: "จำกัดจำนวนเครื่องต่อห้อง", flow: "owner", owner: "wifi", hint: "กดปุ่ม “เครื่องที่สี่ — เกินโควตา” ดูข้อความที่ระบบตอบกลับ" },
      { en: "Session Records", th: "บันทึกทุกครั้งที่ต่อ", flow: "owner", owner: "wifi", hint: "ตาราง session เก็บ MAC · IP · จุดกระจายสัญญาณ · เวลา · ปริมาณ" },
      { en: "Compliance Report", th: "รายงานตัวตนตาม ม.26", flow: "owner", owner: "wifi", hint: "กด “ใครใช้” ที่แถว 10.24.7.201 — แขกเช็กเอาต์ไปเดือนกว่าแล้วยังตอบได้" },
      { en: "Vendor Neutral", th: "ต่อกับอุปกรณ์ยี่ห้อไหนก็ได้", flow: "owner", owner: "wifi", hint: "ผ่าน RADIUS หรือ captive portal มาตรฐาน — ดูหัวข้อ “ลองเป็นอุปกรณ์”" },
    ],
  },
];

/** ลำดับที่ใช้เดินให้ดูหนึ่งรอบ — เลือกให้ข้อมูลไหลต่อกันเป็นเรื่องเดียว
 *  ไม่ใช่ไล่ตามหมายเลขกลุ่ม เพราะเรื่องจะกระโดด */
export const WALK: { title: string; body: string; go: Target }[] = [
  { title: "แขกจองเองจากมือถือ", body: "ราคาที่เห็นคือราคาที่จ่าย ไม่มีค่าธรรมเนียมโผล่ทีหลัง", go: { flow: "guest", hint: "กด “จองห้องนี้” แล้วเดินจนจบขั้นตอน" } },
  { title: "การจองโผล่ที่เคาน์เตอร์ทันที", body: "ไม่มีใครต้องคีย์ซ้ำ และห้องนั้นปิดขายทุกช่องทางพร้อมกัน", go: { flow: "desk", desk: "rack", hint: "หาห้องที่เพิ่งจองในผังห้อง" } },
  { title: "เช็กอินแล้วลงทะเบียนผู้พัก", body: "ม.35 พ.ร.บ.โรงแรม บังคับ — หนึ่งแถวต่อผู้พักหนึ่งคน", go: { flow: "desk", desk: "register", hint: "แขกต่างชาติมีนาฬิกานับถอยหลัง ตม.30 ขึ้นให้เห็น" } },
  { title: "แขกสั่งอาหารเข้าบิลห้อง", body: "เลือกห้องปลายทางก่อน แล้วกดเมนู — วัตถุดิบตัดสต็อกเอง", go: { flow: "pos", pos: "order", hint: "เลือก “ห้อง 402” แล้วกดต้มยำกุ้ง" } },
  { title: "บิลใบเดียวรวมทุกอย่าง", body: "ค่าห้อง อาหาร มินิบาร์ อยู่ในบิลเดียว มัดจำหักให้แล้ว", go: { flow: "desk", desk: "checkout", hint: "ดูว่าค่าอาหารที่เพิ่งสั่งเข้ามาอยู่ในบิลแล้ว" } },
  { title: "ออกใบกำกับภาษีเต็มรูป", body: "ตาม ม.86/4 ครบทุกช่อง รวมจำนวนเงินเป็นตัวอักษร", go: { flow: "desk", desk: "invoice", hint: "VAT ถอดออกจากราคา ไม่ได้บวกเพิ่ม" } },
  { title: "ห้องกลับไปขายได้ตอนหัวหน้าตรวจผ่าน", body: "ไม่ใช่ตอนแม่บ้านกดว่าเสร็จ — คนตรวจงานตัวเองคือมาตรฐานที่หายไป", go: { flow: "staff", staff: "list", role: "hk", hint: "ทำงานให้เสร็จ แนบรูป 3 รูป แล้วสลับเป็นหัวหน้าเพื่อตรวจ" } },
  { title: "ทุกบาทลงสมุดบัญชีคู่", body: "เดบิตเท่าเครดิต ลงแล้วแก้ไม่ได้ ต้องตั้งรายการกลับเท่านั้น", go: { flow: "owner", owner: "ledger", hint: "ลองกดส่งซ้ำดูว่ายอดขยับไหม" } },
  { title: "เจ้าของเห็นผลของทุกปุ่มที่เพิ่งกด", body: "ตัวเลขทุกตัวกดดูได้ว่ามาจากบิลใบไหน", go: { flow: "owner", owner: "overview", hint: "กดการ์ดตัวเลขเพื่อดูที่มา" } },
];

export const ALL_SPOTS: Spot[] = CATALOG.flatMap((g) => g.spots);
export const TOTAL = ALL_SPOTS.length;

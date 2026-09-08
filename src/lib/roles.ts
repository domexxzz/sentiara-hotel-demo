/**
 * สิทธิ์ผู้ใช้ — ใครเห็นอะไรได้บ้าง
 *
 * เหตุผลที่ต้องมี: เจ้าของซื้อระบบเพราะอยากรู้ว่าเงินถูกบันทึกครบ
 * ถ้าพนักงานเคาน์เตอร์เปิดจอเจ้าของได้เอง กดอนุมัติส่วนลดเองได้
 * บันทึกการตรวจสอบทั้งหมดก็ไม่มีความหมาย — คนที่ถูกตรวจสอบเป็นคนกดเอง
 *
 * ล็อกอินด้วยบัตร NFC ใบเดียวกับที่ใช้เข้าห้องทำงานและลงเวลา
 * (ดู owner/DoorLog.tsx และ staff/TimeClock.tsx) — พนักงานไม่ต้องจำรหัส
 */

export type Role = "owner" | "manager" | "front" | "hk" | "tech" | "pos";

export type Flow = "guest" | "desk" | "staff" | "owner" | "pos";

/** สิทธิ์ระดับการกระทำ — ละเอียดกว่าระดับจอ */
export type Perm =
  /** เห็นตัวเลขรายได้และต้นทุนทั้งกิจการ */
  | "revenue"
  /** อนุมัติส่วนลด/คืนเงินที่เกินอำนาจพนักงาน */
  | "approve"
  /** ออกใบกำกับภาษี */
  | "invoice"
  /** ส่งทะเบียนผู้พักให้นายทะเบียน */
  | "register"
  /** แก้ราคาห้องและเรตวันหยุด */
  | "rate";

export type Staff = {
  id: string;
  name: string;
  role: Role;
  title: string;
  /** รหัสบัตร NFC ที่แตะเพื่อล็อกอิน */
  card: string;
};

export const STAFF: Staff[] = [
  { id: "s-own", name: "คุณดวงพร", role: "owner", title: "เจ้าของกิจการ", card: "OWN-01" },
  { id: "s-mgr", name: "คุณมาลี", role: "manager", title: "ผู้จัดการโรงแรม", card: "MGR-07" },
  { id: "s-fd", name: "สมชาย", role: "front", title: "พนักงานเคาน์เตอร์", card: "FD-14" },
  { id: "s-hk", name: "สมศรี", role: "hk", title: "หัวหน้าแม่บ้าน", card: "HK-22" },
  { id: "s-tc", name: "วิชัย", role: "tech", title: "ช่างประจำโรงแรม", card: "TC-05" },
  { id: "s-pos", name: "น้องแนน", role: "pos", title: "พนักงานร้านอาหาร", card: "PS-09" },
];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "เจ้าของ",
  manager: "ผู้จัดการ",
  front: "พนักงานเคาน์เตอร์",
  hk: "แม่บ้าน / หัวหน้า",
  tech: "ช่าง",
  pos: "ร้านอาหาร",
};

/** จอที่แต่ละบทบาทเปิดได้ · "guest" เปิดได้ทุกคนเพราะเป็นมุมของแขก ไม่ใช่ของพนักงาน */
const FLOWS_OF: Record<Role, Flow[]> = {
  owner: ["guest", "desk", "staff", "owner", "pos"],
  manager: ["guest", "desk", "staff", "owner", "pos"],
  front: ["guest", "desk"],
  hk: ["staff"],
  tech: ["staff"],
  pos: ["pos"],
};

/** เมนูในหน้าเคาน์เตอร์ที่ต้องมีสิทธิ์เพิ่ม · ที่ไม่ระบุ = เปิดได้ทุกคนที่เข้าจอนี้ได้ */
const DESK_NEEDS: Record<string, Perm> = {
  invoice: "invoice",
  register: "register",
};

/** แท็บในจอเจ้าของที่ต้องมีสิทธิ์เพิ่ม */
const OWNER_NEEDS: Record<string, Perm> = {
  overview: "revenue",
  finance: "revenue",
  channels: "revenue",
  approvals: "approve",
  // ตั้งค่าระบบแก้ราคาและสิทธิ์คนอื่นได้ — ต้องเป็นระดับที่แก้เรตได้เท่านั้น
  settings: "rate",
};

const PERMS_OF: Record<Role, Perm[]> = {
  owner: ["revenue", "approve", "invoice", "register", "rate"],
  manager: ["revenue", "approve", "invoice", "register", "rate"],
  front: ["invoice", "register"],
  hk: [],
  tech: [],
  pos: [],
};

export const can = (role: Role, perm: Perm) => PERMS_OF[role].includes(perm);

export const canOpen = (role: Role, flow: Flow) => FLOWS_OF[role].includes(flow);

export const canOpenDesk = (role: Role, view: string) => {
  const need = DESK_NEEDS[view];
  return !need || can(role, need);
};

export const canOpenOwnerTab = (role: Role, tab: string) => {
  const need = OWNER_NEEDS[tab];
  return !need || can(role, need);
};

/** ข้อความอธิบายว่าทำไมเปิดไม่ได้ — ต้องบอกเหตุผล ไม่ใช่แค่ปฏิเสธ */
export const denyReason = (role: Role, flow: Flow) => {
  if (flow === "owner")
    return `${ROLE_LABEL[role]}ไม่มีสิทธิ์เปิดจอเจ้าของ — รายได้ ต้นทุน และการอนุมัติส่วนลด เห็นได้เฉพาะเจ้าของกับผู้จัดการ`;
  if (flow === "desk")
    return `${ROLE_LABEL[role]}ไม่มีสิทธิ์เปิดหน้าเคาน์เตอร์ — การจอง บิล และข้อมูลแขกจำกัดเฉพาะผู้ที่ต้องใช้`;
  if (flow === "pos") return `${ROLE_LABEL[role]}ไม่มีสิทธิ์เปิด POS ร้านอาหาร`;
  return `${ROLE_LABEL[role]}ไม่มีสิทธิ์เปิดจอนี้`;
};

export const staffByCard = (card: string) =>
  STAFF.find((s) => s.card.toLowerCase() === card.trim().toLowerCase());

export const staffById = (id: string) => STAFF.find((s) => s.id === id);

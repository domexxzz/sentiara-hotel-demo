// ── POS ร้านอาหาร + จอครัว ─────────────────────────────────────────────
// Demo data. Core mechanic from the mockup: ครัวกด "เสร็จแล้ว" → ตัดสต็อกตามสูตร
// → ต่ำกว่าจุดสั่งซื้อ ระบบสร้างใบสั่งซื้อรอไว้ → ของหมดจริง ปิดเมนูทุกช่องทางเอง

export type Ingredient = {
  id: string;
  label: string;
  unit: string;
  qty: number; // คงเหลือ
  reorder: number; // จุดสั่งซื้อ
};

export const STOCK: Ingredient[] = [
  { id: "shrimp", label: "กุ้งขาว", unit: "ก.", qty: 540, reorder: 400 },
  { id: "noodle", label: "เส้นข้าวซอย", unit: "ก้อน", qty: 9, reorder: 8 },
  { id: "glass", label: "วุ้นเส้น", unit: "ก้อน", qty: 7, reorder: 6 },
  { id: "chicken", label: "อกไก่", unit: "ก.", qty: 1800, reorder: 800 },
  { id: "coffee", label: "เมล็ดกาแฟ", unit: "ก.", qty: 1400, reorder: 500 },
  { id: "milk", label: "นมสด", unit: "มล.", qty: 3200, reorder: 1500 },
];

export type MenuItem = {
  id: string;
  name: string;
  cat: "อาหาร" | "เครื่องดื่ม";
  price: number;
  /** สูตร — ใช้ตัดสต็อกอัตโนมัติเมื่อครัวกดเสร็จ */
  recipe: { ing: string; use: number }[];
  cost: number; // ต้นทุนวัตถุดิบต่อจาน
};

export const MENU: MenuItem[] = [
  {
    id: "tomyum",
    name: "ต้มยำกุ้ง",
    cat: "อาหาร",
    price: 220,
    cost: 96,
    recipe: [{ ing: "shrimp", use: 180 }],
  },
  {
    id: "khaosoi",
    name: "ข้าวซอยไก่",
    cat: "อาหาร",
    price: 150,
    cost: 52,
    recipe: [
      { ing: "noodle", use: 1 },
      { ing: "chicken", use: 200 },
    ],
  },
  {
    id: "padthai",
    name: "ผัดไทยกุ้ง",
    cat: "อาหาร",
    price: 180,
    cost: 71,
    recipe: [
      { ing: "shrimp", use: 120 },
      { ing: "glass", use: 1 },
    ],
  },
  {
    id: "kaprao",
    name: "กะเพราไก่ไข่ดาว",
    cat: "อาหาร",
    price: 130,
    cost: 44,
    recipe: [{ ing: "chicken", use: 180 }],
  },
  {
    id: "latte",
    name: "ลาเต้",
    cat: "เครื่องดื่ม",
    price: 65,
    cost: 21,
    recipe: [
      { ing: "coffee", use: 18 },
      { ing: "milk", use: 200 },
    ],
  },
  {
    id: "americano",
    name: "อเมริกาโน่",
    cat: "เครื่องดื่ม",
    price: 55,
    cost: 14,
    recipe: [{ ing: "coffee", use: 18 }],
  },
  {
    id: "thaitea",
    name: "ชาไทยเย็น",
    cat: "เครื่องดื่ม",
    price: 60,
    cost: 19,
    recipe: [{ ing: "milk", use: 180 }],
  },
  {
    id: "water",
    name: "น้ำดื่ม",
    cat: "เครื่องดื่ม",
    price: 20,
    cost: 6,
    recipe: [],
  },
];

/** ที่คิดเงินได้ — โต๊ะหน้าร้าน หรือยิงเข้าบิลห้องแขก */
export const TARGETS = [
  { id: "t5", label: "โต๊ะ 5", kind: "table" as const },
  { id: "t9", label: "โต๊ะ 9", kind: "table" as const },
  { id: "r201", label: "ห้อง 201 · คุณอนันต์", kind: "room" as const, room: "201" },
  { id: "r305", label: "ห้อง 305 · Tanaka", kind: "room" as const, room: "305" },
];

/** ยอดสะสมของบิลห้องก่อนเริ่มสาธิต (ให้ตรงกับฝั่งแขก) */
export const ROOM_TABS: Record<string, number> = { "201": 3320, "305": 4050 };

export const SHIFT = "ชั้น 1 · 14 โต๊ะ · ครัวไทย + คาเฟ่";

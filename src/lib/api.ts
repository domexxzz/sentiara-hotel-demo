/**
 * ตัวเชื่อมไปหลังบ้าน PMS ตัวจริง
 *
 * ── หลักการเดียวที่สำคัญที่สุดของไฟล์นี้ ─────────────────────────────
 * เดโมคือเครื่องมือขาย ถ้าทำให้มันต้องมีเซิร์ฟเวอร์ถึงจะเปิดได้ ก็เท่ากับ
 * พังเครื่องมือขาย · บิลด์เดียวจึงต้องทำงานสองโหมด
 *
 *   ต่อหลังบ้านได้    → ใช้ข้อมูลจริง หลายเครื่องเห็นตรงกัน มีสิทธิ์ผู้ใช้จริง
 *   ตั้งค่าแล้วต่อไม่ได้ → พักการทำรายการจนเชื่อมต่อได้ ไม่บันทึกของจริงเป็นข้อมูลสาธิต
 *
 * ตั้งที่อยู่หลังบ้านผ่าน `VITE_API_URL` ตอน build · ไม่ตั้ง = โหมดสาธิตล้วน
 *
 * ── ทำไมไม่ใช้ไลบรารีเรียก API ──────────────────────────────────────
 * ทั้งระบบใช้แค่สิบกว่าเส้นทาง `fetch` ทำได้หมดและไม่เพิ่มของที่ต้องดูแล
 * ซึ่งตรงกับที่หลังบ้านทำไว้ (ใช้ urllib ของไพธอนเอง ไม่ลง requests)
 */

import type { Role } from "./roles";

/** ที่อยู่หลังบ้าน · ว่าง = ไม่ต้องลองต่อเลย */
export const API_BASE: string = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

/** ระบบนี้ถูกตั้งค่าให้ต่อหลังบ้านไหม (ยังไม่ได้แปลว่าต่อติด) */
export const API_CONFIGURED = API_BASE.length > 0;

const PREFIX = "/api/v1";
const TOKEN_KEY = "sentiara:token";

/* ── โทเคน ────────────────────────────────────────────────────────────
   เก็บใน sessionStorage ไม่ใช่ localStorage โดยตั้งใจ — ปิดแท็บแล้วหลุด
   เครื่องที่เคาน์เตอร์เป็นเครื่องรวมที่พนักงานผลัดกันใช้ ไม่ควรค้างสิทธิ์
   ของกะที่แล้วไว้ให้กะถัดไปหยิบไปใช้ */
export const getToken = (): string => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
};

export const setToken = (t: string): void => {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* โหมดส่วนตัวหรือโควตาเต็ม — ระบบต้องเดินต่อได้ แค่ต้องล็อกอินใหม่เมื่อรีเฟรช */
  }
};

/** ข้อผิดพลาดจากหลังบ้าน พร้อมรหัสสถานะให้ตัดสินใจได้ ไม่ใช่แค่ข้อความ */
export class ApiError extends Error {
  /* ประกาศฟิลด์แยกจาก constructor เพราะ erasableSyntaxOnly ของโปรเจ็คนี้
     ไม่ให้ใช้ parameter property — ตัวเลือกนั้นบังคับให้ TypeScript ลบชนิด
     ออกได้อย่างเดียวโดยไม่ต้องสร้างโค้ดเพิ่ม */
  readonly status: number;
  readonly detail?: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }

  /** ลองใหม่ได้ไหม · 4xx คือข้อมูลผิด ลองกี่ครั้งก็ได้ผลเดิม อย่าวนลูป */
  get retryable(): boolean {
    return this.status === 0 || this.status >= 500 || this.status === 429;
  }

  /** ต้องแตะบัตรเข้าระบบใหม่ */
  get needsLogin(): boolean {
    return this.status === 401;
  }
}

/** แปลงสถานะเป็นข้อความที่พนักงานอ่านแล้วรู้ว่าต้องทำอะไรต่อ */
function humanise(status: number, detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  // ข้อผิดพลาดของ pydantic มาเป็นรายการรายช่อง — ยกช่องแรกมาบอกก็พอ
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { loc?: unknown[]; msg?: string };
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "";
    return `ข้อมูลที่กรอกไม่ถูกต้อง${field ? ` (${String(field)})` : ""} — ${first.msg ?? ""}`;
  }
  if (status === 0) return "ต่อหลังบ้านไม่ได้ — เช็กว่าเซิร์ฟเวอร์เปิดอยู่ไหม";
  if (status === 401) return "เซสชันหมดอายุ กรุณาแตะบัตรเข้าระบบใหม่";
  if (status === 403) return "บทบาทนี้ไม่มีสิทธิ์ทำรายการนี้";
  if (status === 404) return "ไม่พบรายการที่ขอ";
  if (status >= 500) return "หลังบ้านมีปัญหา ลองใหม่อีกครั้ง";
  return `ทำรายการไม่สำเร็จ (${status})`;
}

type Method = "GET" | "POST";

async function call<T>(
  method: Method,
  path: string,
  body?: unknown,
  opts: { auth?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const { auth = true, timeoutMs = 12000 } = opts;
  if (!API_CONFIGURED) throw new ApiError(0, "ยังไม่ได้ตั้งที่อยู่หลังบ้าน");

  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth) {
    const t = getToken();
    if (t) headers.authorization = `Bearer ${t}`;
  }

  // ตัดสายเองถ้าช้าเกินไป — หน้าจอที่ค้างรอโดยไม่บอกอะไรแย่กว่าหน้าจอที่บอกว่าล้มเหลว
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(API_BASE + PREFIX + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: stop.signal,
    });
  } catch {
    throw new ApiError(0, humanise(0, null));
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail ?? data;
    throw new ApiError(res.status, humanise(res.status, detail), detail);
  }
  return data as T;
}

/* ── รูปข้อมูลที่หลังบ้านคืนมา ─────────────────────────────────────── */
export type ApiRoom = {
  no: string;
  type: string;
  type_code: string;
  floor: string;
  out_of_order: boolean;
  housekeeping: "clean" | "dirty" | "cleaning" | "inspect";
  sellable: boolean;
  rate: number;
};

export type ApiFolioSummary = {
  status: "open" | "closed";
  gross: number;
  paid: number;
  balance: number;
};

export type ApiBooking = {
  ref: string;
  guest: string;
  room: string;
  check_in: string;
  check_out: string;
  nights: number;
  status: "confirmed" | "inhouse" | "checkedout" | "cancelled";
  source: "direct" | "walkin" | "ota" | "line";
  deposit: number;
  folio: ApiFolioSummary | null;
};

export type ApiCharge = {
  kind: "room" | "fnb" | "service" | "discount";
  label: string;
  qty: number;
  unit: number;
  total: number;
  at?: string;
};

export type ApiFolio = {
  ref: string;
  guest: string;
  room: string;
  status: "open" | "closed";
  charges: ApiCharge[];
  payments: { method: string; amount: number; at?: string }[];
  room_total?: number;
  totals: { room: number; fnb: number; service: number; discount: number;
    gross: number; paid: number; balance: number };
};

export type Session = {
  token: string;
  ref: string;
  name: string;
  title: string;
  role: Role;
  permissions: string[];
};

export type Health = {
  ok: boolean;
  hotel: string;
  vat_pct: number;
  weekend_pct: number;
  ledger_dry_run: boolean;
};

/* ── เส้นทางที่หน้าจอเรียกใช้ ──────────────────────────────────────── */
export const api = {
  /** ตรวจว่าหลังบ้านเปิดอยู่ไหม · ไม่ต้องมีโทเคน และตัดสายเร็วกว่าปกติ
   *  เพราะหน้าแรกไม่ควรค้างรอนานถ้าไม่มีเซิร์ฟเวอร์ */
  async health(): Promise<Health> {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);
    if (!res || !res.ok) throw new ApiError(0, humanise(0, null));
    return (await res.json()) as Health;
  },

  login: (card: string, pin: string) =>
    call<Session>("POST", "/auth/login", { card, pin }, { auth: false }),

  logout: () => call<{ ok: boolean }>("POST", "/auth/logout"),

  me: () => call<Omit<Session, "token">>("GET", "/auth/me"),

  rooms: () => call<{ rooms: ApiRoom[] }>("GET", "/rooms"),

  bookings: (q: { status?: string; since?: string; until?: string } = {}) => {
    const p = new URLSearchParams();
    if (q.status) p.set("status", q.status);
    if (q.since) p.set("since", q.since);
    if (q.until) p.set("until", q.until);
    const qs = p.toString();
    return call<{ count: number; bookings: ApiBooking[] }>(
      "GET",
      "/bookings" + (qs ? `?${qs}` : ""),
    );
  },

  booking: (ref: string) => call<ApiBooking>("GET", `/bookings/${ref}`),

  createBooking: (b: {
    room_no: string;
    guest_name: string;
    check_in: string;
    check_out: string;
    adults?: number;
    children?: number;
    source?: string;
    guest_phone?: string;
  }) => call<ApiBooking>("POST", "/bookings", b),

  checkIn: (ref: string) => call<ApiBooking>("POST", `/bookings/${ref}/check-in`),

  cancel: (ref: string) => call<ApiBooking>("POST", `/bookings/${ref}/cancel`),

  availability: (checkIn: string, checkOut: string, roomType?: string) => {
    const p = new URLSearchParams({ check_in: checkIn, check_out: checkOut });
    if (roomType) p.set("room_type", roomType);
    return call<{
      free: { no: string; type: string; rate: number }[];
      busy: { no: string; nights: string[] }[];
      free_count: number;
    }>("GET", `/availability?${p}`);
  },

  folio: (ref: string) => call<ApiFolio>("GET", `/folios/${ref}`),

  addCharge: (
    ref: string,
    c: { kind: string; label: string; amount: number; qty?: number },
  ) => call<unknown>("POST", `/folios/${ref}/charges`, c),

  addPayment: (ref: string, p: { method: string; amount: number }) =>
    call<unknown>("POST", `/folios/${ref}/payments`, p),

  closeFolio: (ref: string) => call<unknown>("POST", `/folios/${ref}/close`),

  taxInvoice: (
    ref: string,
    b: { buyer_name: string; buyer_taxid?: string; buyer_address?: string },
  ) => call<Record<string, unknown>>("POST", `/folios/${ref}/tax-invoice`, b),
};

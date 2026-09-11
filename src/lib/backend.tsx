import {
  useCallback, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import {
  API_CONFIGURED, ApiError, api, getToken, setToken,
  type Health, type Session,
} from "./api";
import { BackendContext } from "../contexts";

/**
 * สถานะการต่อหลังบ้าน — ตัวที่ตัดสินว่าแอปกำลังทำงานโหมดไหน
 *
 * สามสถานะ ไม่ใช่สอง
 * -------------------
 *   demo    ไม่ได้ตั้งที่อยู่หลังบ้าน → ข้อมูลสาธิตอยู่ในเครื่อง
 *   locked  ตั้งหลังบ้านแล้ว แต่ยังต่อไม่ได้หรือยังไม่ล็อกอิน → ห้ามทำรายการ
 *   live    ล็อกอินแล้ว → ทุกอย่างวิ่งผ่านฐานข้อมูลจริง หลายเครื่องเห็นตรงกัน
 *
 * ที่ต้องแยก `locked` ออกมา เพราะถ้ารวมกับ `demo` แล้วคนที่ยังไม่ล็อกอินจะเห็น
 * ข้อมูลสาธิตปนกับของจริงโดยไม่รู้ตัว แล้วสั่งงานจากตัวเลขที่ไม่ใช่ของโรงแรมตัวเอง
 */
export type Mode = "demo" | "locked" | "live";

export type Ctx = {
  mode: Mode;
  /** ต่อหลังบ้านติดไหม (ยังไม่ได้แปลว่าล็อกอินแล้ว) */
  online: boolean;
  /** กำลังตรวจการเชื่อมต่อครั้งแรกอยู่ */
  probing: boolean;
  health: Health | null;
  session: Session | null;
  /** ข้อความบอกสาเหตุล่าสุดที่ล็อกอินไม่ผ่าน */
  error: string;
  busy: boolean;
  signIn: (card: string, pin: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** ลองต่อหลังบ้านอีกครั้ง — ใช้กับปุ่ม "ลองใหม่" */
  retry: () => Promise<void>;
  /** มีสิทธิ์ข้อนี้ไหม · โหมดสาธิตให้ทุกสิทธิ์ เพราะไม่มีของจริงให้ปกป้อง */
  can: (perm: string) => boolean;
};

export function BackendProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [probing, setProbing] = useState(API_CONFIGURED);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const probe = useCallback(async () => {
    if (!API_CONFIGURED) {
      setProbing(false);
      return;
    }
    setProbing(true);
    try {
      const h = await api.health();
      setHealth(h);
      // มีโทเคนค้างอยู่จากแท็บเดิม — ถามหลังบ้านว่ายังใช้ได้ไหมก่อนเชื่อ
      const t = getToken();
      if (t) {
        try {
          const me = await api.me();
          setSession({ token: t, ...me });
        } catch {
          // หมดอายุหรือถูกเพิกถอน — ทิ้งแล้วให้แตะบัตรใหม่ ไม่ต้องแจ้งเตือน
          setToken("");
          setSession(null);
        }
      }
    } catch {
      // เครื่องที่ตั้งหลังบ้านแล้วต้องพักการทำรายการ ไม่เปลี่ยนเป็นเดโมเงียบ ๆ
      setHealth(null);
      setSession(null);
    } finally {
      setProbing(false);
    }
  }, []);

  useEffect(() => {
    // probe คือการ sync กับ API ภายนอกโดยตรง จึงเริ่มจาก effect เมื่อ provider mount
    // oxlint-disable-next-line react/set-state-in-effect
    void probe();
  }, [probe]);

  const signIn = useCallback(async (card: string, pin: string) => {
    setBusy(true);
    setError("");
    try {
      const s = await api.login(card, pin);
      setToken(s.token);
      setSession(s);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "ล็อกอินไม่สำเร็จ");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    // บอกหลังบ้านให้เพิกถอนด้วย ไม่ใช่ลบโทเคนฝั่งเราแล้วปล่อยให้ใบเดิมยังใช้ได้
    try {
      await api.logout();
    } catch {
      /* ต่อไม่ติดก็ยังต้องออกจากระบบฝั่งนี้ได้ */
    }
    setToken("");
    setSession(null);
  }, []);

  const value = useMemo<Ctx>(() => {
    const online = health !== null;
    const mode: Mode = !API_CONFIGURED ? "demo" : online && session ? "live" : "locked";
    return {
      mode,
      online,
      probing,
      health,
      session,
      error,
      busy,
      signIn,
      signOut,
      retry: probe,
      can: (perm) => mode === "demo" || (mode === "live" && !!session?.permissions.includes(perm)),
    };
  }, [health, session, probing, error, busy, signIn, signOut, probe]);

  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

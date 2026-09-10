import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { APPROVALS, WEEK, type Approval } from "./ownerData";

export type OwnerTab =
  | "overview"
  | "finance"
  | "ledger"
  | "guests"
  | "team"
  | "chivago"
  | "channels"
  | "door"
  | "security"
  | "energy"
  | "ai"
  | "approvals"
  | "settings";

export type AuditEntry = {
  id: string;
  text: string;
  stamp: string;
};

export type AiTurn = { q: string; a: string; evidence: string; action?: string };

type State = {
  tab: OwnerTab;
  /** KPI whose "ที่มา" panel is open. */
  openKpi: string | null;
  /** Day index selected in the revenue chart. */
  dayIdx: number;
  approvals: Approval[];
  audit: AuditEntry[];
  chat: AiTurn[];
  workOrder: string | null;
};

type Action =
  | { type: "TAB"; tab: OwnerTab }
  | { type: "KPI"; id: string | null }
  | { type: "DAY"; idx: number }
  | { type: "DECIDE"; id: string; approve: boolean }
  | { type: "ASK"; turn: AiTurn }
  | { type: "ORDER_TECH" };

const initial: State = {
  tab: "overview",
  openKpi: null,
  dayIdx: WEEK.length - 1, // คืนล่าสุด
  approvals: APPROVALS,
  audit: [],
  chat: [],
  workOrder: null,
};

let seq = 0;
const nid = () => "a" + ++seq;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "TAB":
      return { ...state, tab: action.tab };

    case "KPI":
      return { ...state, openKpi: state.openKpi === action.id ? null : action.id };

    case "DAY":
      return { ...state, dayIdx: action.idx };

    case "DECIDE": {
      const item = state.approvals.find((a) => a.id === action.id);
      if (!item) return state;
      return {
        ...state,
        approvals: state.approvals.filter((a) => a.id !== action.id),
        audit: [
          {
            id: nid(),
            text: `${action.approve ? "อนุมัติ" : "ไม่อนุมัติ"} ${item.title} · ฿${item.amount.toLocaleString("en-US")} — โดยเจ้าของ`,
            stamp: "วันนี้ 14:58 · บันทึกลงบิลถาวร แก้เงียบ ๆ ไม่ได้",
          },
          ...state.audit,
        ],
      };
    }

    case "ASK":
      return { ...state, chat: [...state.chat, action.turn] };

    case "ORDER_TECH":
      return { ...state, workOrder: "WO-1184 · ห้อง 210 ตรวจแอร์ — ส่งให้ช่างวิชัยแล้ว" };

    default:
      return state;
  }
}

type Ctx = {
  state: State;
  dispatch: React.Dispatch<Action>;
  totals: {
    revenue: number;
    rooms: number;
    fnb: number;
    occAvg: number;
    lastNight: number;
    prevNight: number;
    adr: number;
    revpar: number;
    availNights: number;
    soldNights: number;
    fnbShare: number;
  };
};

const OwnerContext = createContext<Ctx | null>(null);

export function OwnerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  const totals = useMemo(() => {
    const rooms = WEEK.reduce((s, d) => s + d.rooms, 0);
    const fnb = WEEK.reduce((s, d) => s + d.fnb, 0);
    const revenue = rooms + fnb;
    const occAvg = Math.round(WEEK.reduce((s, d) => s + d.occ, 0) / WEEK.length);
    const soldTotal = WEEK.reduce((s, d) => s + d.sold, 0);
    // ห้องที่เปิดขายในแต่ละคืน ถอดกลับจากข้อมูลเดิม (ขายได้ ÷ อัตราเข้าพัก)
    // คำนวณจากชุดเดียวกับ KPI อื่น ตัวเลขจึงขัดกันเองไม่ได้
    const availNights = WEEK.reduce((s, d) => s + Math.round(d.sold / (d.occ / 100)), 0);
    const last = WEEK[WEEK.length - 1];
    const prev = WEEK[WEEK.length - 2];
    return {
      revenue,
      rooms,
      fnb,
      occAvg,
      lastNight: last.rooms + last.fnb,
      prevNight: prev.rooms + prev.fnb,
      adr: Math.round(rooms / soldTotal), // ราคาห้องเฉลี่ยที่ขายได้จริง
      // RevPAR วัดรายได้ต่อห้องที่ "เปิดขาย" ไม่ใช่ต่อห้องที่ขายได้ — ห้องว่างจึงถูกนับด้วย
      revpar: Math.round(rooms / availNights),
      availNights,
      soldNights: soldTotal,
      fnbShare: Math.round((fnb / revenue) * 100),
    };
  }, []);

  const value = useMemo(() => ({ state, dispatch, totals }), [state, totals]);
  return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>;
}

export function useOwner() {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error("useOwner must be used within OwnerProvider");
  return ctx;
}

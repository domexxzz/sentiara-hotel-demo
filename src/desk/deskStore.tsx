import { useMemo, useReducer, type ReactNode } from "react";
import type { Booking } from "../hotel/hotelStore";
import { DeskContext } from "../contexts";

/** เหลือเฉพาะสถานะหน้าจอ — ห้อง/การจอง/บิล อยู่ใน hotelStore ที่ทุก flow ใช้ร่วมกัน */
export type DeskView =
  | "rack"
  | "calendar"
  | "inbox"
  | "register"
  | "invoice"
  | "checkin"
  | "walkin"
  | "checkout"
  | "manage";

export type Toast = { id: string; text: string };

type State = {
  view: DeskView;
  /** การจองที่กำลังเช็กอินอยู่ */
  active: Booking | null;
  /** ห้องที่กำลังปิดบิล */
  closingRoom: string | null;
  /** การจองที่กำลังแก้ไข (ย้ายห้อง/เลื่อนวัน/ยกเลิก) */
  managing: Booking | null;
  /** คำค้นในผังห้องและรายชื่อแขก */
  query: string;
  tm30Queue: string[];
  toasts: Toast[];
};

type Action =
  | { type: "VIEW"; view: DeskView }
  | { type: "START_CHECKIN"; booking: Booking }
  | { type: "START_CHECKOUT"; room: string }
  | { type: "START_MANAGE"; booking: Booking }
  | { type: "QUERY"; q: string }
  | { type: "DONE" }
  | { type: "TM30"; guest: string }
  | { type: "TOAST"; text: string }
  | { type: "DROP_TOAST"; id: string };

const initial: State = {
  view: "rack",
  active: null,
  closingRoom: null,
  managing: null,
  query: "",
  tm30Queue: [],
  toasts: [],
};

let seq = 100;
const nid = () => String(++seq);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "VIEW":
      return { ...state, view: action.view };
    case "START_CHECKIN":
      return { ...state, active: action.booking, view: "checkin" };
    case "START_CHECKOUT":
      return { ...state, closingRoom: action.room, view: "checkout" };
    case "START_MANAGE":
      return { ...state, managing: action.booking, view: "manage" };
    case "QUERY":
      return { ...state, query: action.q };
    case "DONE":
      return { ...state, view: "rack", active: null, closingRoom: null, managing: null };
    case "TM30":
      return { ...state, tm30Queue: [...state.tm30Queue, action.guest] };
    case "TOAST":
      return { ...state, toasts: [...state.toasts, { id: nid(), text: action.text }] };
    case "DROP_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

export type Ctx = { state: State; dispatch: React.Dispatch<Action> };

export function DeskProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

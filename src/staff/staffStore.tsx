import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { useHotel, type DeskRoom, type WorkOrder } from "../hotel/hotelStore";

export type Role = "hk" | "sup" | "tech";
export type StaffView = "list" | "job" | "review" | "tech";
export type JobStatus = "todo" | "doing" | "review" | "rejected" | "done";

/** ความคืบหน้าของงานทำความสะอาด เก็บรายห้อง — ตัวห้องเองอยู่ใน hotelStore */
export type Progress = {
  status: JobStatus;
  checks: string[];
  photos: string[];
  defect?: string;
  doneAt?: string;
};

/** งานที่ประกอบจากห้องจริง + ความคืบหน้า */
export type LiveJob = {
  id: string;
  room: string;
  type: string;
  kind: string;
  priority?: string;
  minutes: number;
  status: JobStatus;
  checks: string[];
  photos: string[];
  defect?: string;
  doneAt?: string;
};

type State = {
  role: Role;
  view: StaffView;
  activeRoom: string | null;
  progress: Record<string, Progress>;
  /** จำนวนห้องที่หัวหน้ากดผ่านแล้วในกะนี้ */
  approved: number;
  online: boolean;
  pending: string[];
  activeWo: string | null;
  banner: string | null;
};

type Action =
  | { type: "ROLE"; role: Role }
  | { type: "VIEW"; view: StaffView }
  | { type: "OPEN"; room: string }
  | { type: "TOGGLE_CHECK"; room: string; check: string }
  | { type: "PHOTO"; room: string; angle: string }
  | { type: "SUBMIT"; room: string }
  | { type: "APPROVE"; room: string }
  | { type: "REJECT"; room: string; defect: string }
  | { type: "RAISE_ISSUE"; room: string; label: string }
  | { type: "SET_ONLINE"; online: boolean }
  | { type: "BANNER"; text: string | null }
  | { type: "WO_OPEN"; id: string | null }
  | { type: "WO_BANNER"; text: string };

const initial: State = {
  role: "hk",
  view: "list",
  activeRoom: null,
  progress: {},
  approved: 0,
  online: true,
  pending: [],
  activeWo: null,
  banner: null,
};

const blank = (): Progress => ({ status: "todo", checks: [], photos: [] });
const setP = (state: State, room: string, patch: Partial<Progress>): State => ({
  ...state,
  progress: {
    ...state.progress,
    [room]: { ...(state.progress[room] ?? blank()), ...patch },
  },
});

/** ระหว่างออฟไลน์ ให้ต่อคิวไว้ก่อนเพื่อสาธิตการซิงก์ทีหลัง */
const queue = (state: State, label: string) =>
  state.online ? state.pending : [...state.pending, label];

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ROLE":
      return {
        ...state,
        role: action.role,
        activeRoom: null,
        activeWo: null,
        view: action.role === "sup" ? "review" : action.role === "tech" ? "tech" : "list",
      };

    case "VIEW":
      return { ...state, view: action.view };

    case "OPEN": {
      const cur = state.progress[action.room] ?? blank();
      return setP(
        { ...state, activeRoom: action.room, view: "job" },
        action.room,
        cur.status === "todo" ? { status: "doing" } : {},
      );
    }

    case "TOGGLE_CHECK": {
      const cur = state.progress[action.room] ?? blank();
      return setP(state, action.room, {
        checks: cur.checks.includes(action.check)
          ? cur.checks.filter((c) => c !== action.check)
          : [...cur.checks, action.check],
      });
    }

    case "PHOTO": {
      const cur = state.progress[action.room] ?? blank();
      if (cur.photos.includes(action.angle)) return state;
      return setP(state, action.room, { photos: [...cur.photos, action.angle] });
    }

    case "SUBMIT":
      return setP(
        {
          ...state,
          view: "list",
          activeRoom: null,
          pending: queue(state, `ส่งตรวจห้อง ${action.room}`),
          banner: state.online
            ? `ส่งตรวจห้อง ${action.room} แล้ว — หัวหน้าเห็นรูปทันที`
            : `บันทึกไว้ในเครื่อง · ห้อง ${action.room} จะส่งเองเมื่อเน็ตกลับมา`,
        },
        action.room,
        { status: "review", defect: undefined, doneAt: "13:0" + (Object.keys(state.progress).length % 10) },
      );

    case "APPROVE": {
      // ห้องกลับไป "พร้อมขาย" ที่ hotelStore — ทำใน component ที่เรียก
      const rest = { ...state.progress };
      delete rest[action.room];
      return {
        ...state,
        progress: rest,
        approved: state.approved + 1,
        pending: queue(state, `อนุมัติห้อง ${action.room}`),
        banner: `ห้อง ${action.room} พร้อมขาย — เคาน์เตอร์เห็นใน 5 วินาที`,
      };
    }

    case "REJECT":
      return setP(
        {
          ...state,
          pending: queue(state, `ตีกลับห้อง ${action.room}`),
          banner: `ตีกลับห้อง ${action.room} — งานกลับไปที่สมศรีทันที พร้อมจุดที่ต้องแก้`,
        },
        action.room,
        { status: "rejected", defect: action.defect },
      );

    case "RAISE_ISSUE":
      return {
        ...state,
        pending: queue(state, `แจ้งช่าง ห้อง ${action.room}`),
        banner: `${action.label} — เป็นใบงานช่างแล้ว ห้องยังส่งตรวจต่อได้`,
      };

    case "SET_ONLINE":
      return {
        ...state,
        online: action.online,
        pending: action.online ? [] : state.pending,
        banner: action.online
          ? state.pending.length
            ? `เน็ตกลับมาแล้ว — ซิงก์ ${state.pending.length} รายการเรียบร้อย`
            : state.banner
          : "เน็ตหลุด — ทำงานต่อได้ปกติ จะซิงก์เองเมื่อเน็ตกลับ",
      };

    case "BANNER":
      return { ...state, banner: action.text };

    case "WO_OPEN":
      return { ...state, activeWo: action.id };

    case "WO_BANNER":
      return { ...state, banner: action.text };

    default:
      return state;
  }
}

/** ห้องสกปรก 1 ห้อง = งาน 1 ใบ — งานจึงเกิดจากห้องที่เช็กเอาท์จริงเสมอ */
function toJob(room: DeskRoom, p?: Progress): LiveJob {
  const moved = room.note?.includes("ย้ายห้อง");
  return {
    id: "HK-" + room.no,
    room: room.no,
    type: room.type,
    kind: moved ? "ทำความสะอาดหลังย้ายห้อง" : "ทำความสะอาดออก",
    priority: room.note,
    minutes: room.type === "ดีลักซ์" ? 35 : 25,
    status: p?.status ?? "todo",
    checks: p?.checks ?? [],
    photos: p?.photos ?? [],
    defect: p?.defect,
    doneAt: p?.doneAt,
  };
}

type Ctx = {
  state: State;
  dispatch: React.Dispatch<Action>;
  /** คิวของแม่บ้าน — ห้องสกปรกที่ยังไม่ได้ส่งตรวจ */
  jobs: LiveJob[];
  /** คิวของหัวหน้า — ห้องที่ส่งตรวจแล้ว */
  reviewQueue: LiveJob[];
  active: LiveJob | null;
  activeWo: WorkOrder | null;
  counts: { todo: number; review: number; done: number; wo: number };
};

const StaffContext = createContext<Ctx | null>(null);

export function StaffProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const hotel = useHotel();

  const value = useMemo<Ctx>(() => {
    const dirty = hotel.state.rooms.filter((r) => r.status === "dirty");
    const all = dirty.map((r) => toJob(r, state.progress[r.no]));
    const jobs = all.filter((j) => j.status !== "review");
    const reviewQueue = all.filter((j) => j.status === "review");
    const active = state.activeRoom
      ? (all.find((j) => j.room === state.activeRoom) ?? null)
      : null;

    return {
      state,
      dispatch,
      jobs,
      reviewQueue,
      active,
      activeWo: hotel.state.workOrders.find((w) => w.id === state.activeWo) ?? null,
      counts: {
        todo: jobs.length,
        review: reviewQueue.length,
        done: state.approved,
        wo: hotel.state.workOrders.filter((w) => w.status !== "done").length,
      },
    };
  }, [state, hotel.state.rooms, hotel.state.workOrders]);

  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaff must be used within StaffProvider");
  return ctx;
}

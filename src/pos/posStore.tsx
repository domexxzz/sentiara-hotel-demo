import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { MENU, STOCK, type Ingredient, type MenuItem } from "./posData";

export type PosView = "order" | "tables" | "kitchen" | "stock";

export type Line = { menuId: string; qty: number };

export type Ticket = {
  id: string;
  target: string; // label ที่คิดเงิน
  room?: string;
  lines: Line[];
  total: number;
  status: "cooking" | "served";
  at: string;
};

type State = {
  view: PosView;
  cart: Line[];
  targetId: string;
  tickets: Ticket[];
  stock: Ingredient[];
  targets: { id: string; label: string; room?: string }[];
  /** บิลโต๊ะที่เปิดค้างอยู่ — โต๊ะหน้าร้านไม่มีบิลห้องให้ยิงเข้า */
  tabs: Record<string, Line[]>;
  /** เงินที่รับแล้ววันนี้ (รวมบิลที่แยกจ่าย) */
  payments: { id: string; label: string; amount: number }[];
  purchaseOrders: string[]; // ใบสั่งซื้อที่ระบบสร้างรอไว้
  banner: string | null;
};

type Action =
  | { type: "VIEW"; view: PosView }
  | { type: "TARGET"; id: string }
  | { type: "SET_TARGETS"; ids: { id: string; label: string; room?: string }[] }
  | { type: "ADD"; menuId: string }
  | { type: "REMOVE"; menuId: string }
  | { type: "CLEAR" }
  | { type: "SEND"; lines?: Line[]; targetId?: string }
  | { type: "SERVE"; id: string }
  | { type: "MOVE_TABLE"; from: string; to: string }
  | { type: "SPLIT_PAY"; table: string; picked: Line[] }
  | { type: "CLOSE_TABLE"; table: string }
  | { type: "BANNER"; text: string | null };

let tSeq = 1182;
const clock = ["18:32", "18:36", "18:41", "18:47", "18:52", "18:58"];

const initial: State = {
  view: "order",
  cart: [],
  targetId: "t5",
  tickets: [],
  stock: STOCK,
  targets: [
    { id: "t5", label: "โต๊ะ 5" },
    { id: "t9", label: "โต๊ะ 9" },
    { id: "t12", label: "โต๊ะ 12" },
  ],
  tabs: {},
  payments: [],
  purchaseOrders: [],
  banner: null,
};

const menuOf = (id: string) => MENU.find((m) => m.id === id) as MenuItem;

const cartTotal = (cart: Line[]) =>
  cart.reduce((s, l) => s + menuOf(l.menuId).price * l.qty, 0);

/** เมนูขายไม่ได้เมื่อวัตถุดิบในสูตรตัวใดตัวหนึ่งไม่พอ */
export const isSoldOut = (m: MenuItem, stock: Ingredient[]) =>
  m.recipe.some((r) => {
    const ing = stock.find((s) => s.id === r.ing);
    return !ing || ing.qty < r.use;
  });

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "VIEW":
      return { ...state, view: action.view };

    case "TARGET":
      return { ...state, targetId: action.id };

    case "SET_TARGETS": {
      const targets = [
        { id: "t5", label: "โต๊ะ 5" },
        { id: "t9", label: "โต๊ะ 9" },
        { id: "t12", label: "โต๊ะ 12" },
        ...action.ids,
      ];
      const stillThere = targets.some((t) => t.id === state.targetId);
      return { ...state, targets, targetId: stillThere ? state.targetId : "t5" };
    }

    case "ADD": {
      const found = state.cart.find((l) => l.menuId === action.menuId);
      return {
        ...state,
        cart: found
          ? state.cart.map((l) =>
              l.menuId === action.menuId ? { ...l, qty: l.qty + 1 } : l,
            )
          : [...state.cart, { menuId: action.menuId, qty: 1 }],
      };
    }

    case "REMOVE": {
      const found = state.cart.find((l) => l.menuId === action.menuId);
      if (!found) return state;
      return {
        ...state,
        cart:
          found.qty > 1
            ? state.cart.map((l) =>
                l.menuId === action.menuId ? { ...l, qty: l.qty - 1 } : l,
              )
            : state.cart.filter((l) => l.menuId !== action.menuId),
      };
    }

    case "CLEAR":
      return { ...state, cart: [] };

    case "SEND": {
      const sent = action.lines ?? state.cart;
      if (sent.length === 0) return state;
      const target = state.targets.find((t) => t.id === (action.targetId ?? state.targetId));
      if (!target) return state;
      const total = cartTotal(sent);
      // ถ้าลงบิลได้เพียงบางรายการ เก็บรายการที่ล้มเหลวไว้ให้แก้ไข ไม่ส่งซ้ำรายการที่สำเร็จ
      const remaining = state.cart.map((l) => ({ ...l,
        qty: l.qty - (sent.find((s) => s.menuId === l.menuId)?.qty ?? 0),
      })).filter((l) => l.qty > 0);
      const id = "F-" + ++tSeq;
      const mergeTab = (lines: Line[]) => {
        const next = [...lines];
        for (const l of sent) {
          const hit = next.find((x) => x.menuId === l.menuId);
          if (hit) next[next.indexOf(hit)] = { ...hit, qty: hit.qty + l.qty };
          else next.push({ ...l });
        }
        return next;
      };

      return {
        ...state,
        cart: remaining,
        view: remaining.length ? "order" : "kitchen",
        tabs: target.room
          ? state.tabs
          : { ...state.tabs, [target.id]: mergeTab(state.tabs[target.id] ?? []) },
        tickets: [
          {
            id,
            target: target.label,
            room: target.room,
            lines: sent,
            total,
            status: "cooking",
            at: clock[state.tickets.length % clock.length],
          },
          ...state.tickets,
        ],
        banner: target.room
          ? `ยิงเข้าครัวแล้ว · ${id} เข้าบิลห้อง ${target.room} แล้ว — แขกเห็นในแชตทันที`
          : `ยิงเข้าครัวแล้ว · เปิดบิล${target.label}ไว้แล้ว — ปิดบิลได้ที่หน้าโต๊ะ & บิล`,
      };
    }

    case "SERVE": {
      const t = state.tickets.find((x) => x.id === action.id);
      if (!t) return state;

      // ตัดสต็อกตามสูตร — ไม่มีใครต้องคีย์
      let stock = state.stock;
      for (const line of t.lines) {
        for (const r of menuOf(line.menuId).recipe) {
          stock = stock.map((s) =>
            s.id === r.ing ? { ...s, qty: Math.max(0, s.qty - r.use * line.qty) } : s,
          );
        }
      }

      // ของที่เพิ่งตกต่ำกว่าจุดสั่งซื้อ → สร้างใบสั่งซื้อรอไว้
      const newlyLow = stock.filter(
        (s) =>
          s.qty <= s.reorder &&
          (state.stock.find((o) => o.id === s.id)?.qty ?? 0) > s.reorder,
      );
      // เมนูที่เพิ่งขายไม่ได้เพราะของหมด
      const nowOut = MENU.filter(
        (m) => isSoldOut(m, stock) && !isSoldOut(m, state.stock),
      );

      const notes = [
        ...nowOut.map(
          (m) => `${m.name} ปิดขายเองทุกช่องทาง (POS · เมนูรูมเซอร์วิสในแชตแขก)`,
        ),
        ...newlyLow.map((s) => `${s.label} ต่ำกว่าจุดสั่งซื้อ — สร้างใบสั่งซื้อรอไว้แล้ว`),
      ];

      return {
        ...state,
        stock,
        tickets: state.tickets.map((x) =>
          x.id === action.id ? { ...x, status: "served" } : x,
        ),
        purchaseOrders: [...state.purchaseOrders, ...newlyLow.map((s) => s.label)],
        banner:
          notes.length > 0
            ? `เสิร์ฟ ${t.id} · ตัดสต็อกตามสูตรแล้ว — ${notes.join(" · ")}`
            : `เสิร์ฟ ${t.id} · ตัดสต็อกตามสูตรแล้ว ไม่ต้องคีย์`,
      };
    }

    case "MOVE_TABLE": {
      const lines = state.tabs[action.from] ?? [];
      const tabs = { ...state.tabs };
      delete tabs[action.from];
      tabs[action.to] = [...(tabs[action.to] ?? []), ...lines];
      const name = (id: string) => state.targets.find((t) => t.id === id)?.label ?? id;
      return {
        ...state,
        tabs,
        banner: `ย้ายบิลจาก${name(action.from)}ไป${name(action.to)}เรียบร้อย — รายการตามไปทั้งใบ`,
      };
    }

    case "SPLIT_PAY": {
      const lines = state.tabs[action.table] ?? [];
      // หักเฉพาะจำนวนที่เลือกออกจากบิลเดิม ที่เหลือยังค้างอยู่
      const rest = lines
        .map((l) => {
          const p = action.picked.find((x) => x.menuId === l.menuId);
          return p ? { ...l, qty: l.qty - p.qty } : l;
        })
        .filter((l) => l.qty > 0);
      const amount = action.picked.reduce(
        (t, l) => t + menuOf(l.menuId).price * l.qty,
        0,
      );
      const label = state.targets.find((t) => t.id === action.table)?.label ?? action.table;
      const tabs = { ...state.tabs };
      if (rest.length) tabs[action.table] = rest;
      else delete tabs[action.table];
      return {
        ...state,
        tabs,
        payments: [
          ...state.payments,
          { id: "P" + (state.payments.length + 1), label: `${label} · แยกจ่าย`, amount },
        ],
        banner: `รับชำระส่วนที่แยก ฿${amount.toLocaleString("en-US")} จาก${label} — ที่เหลือยังเปิดบิลอยู่`,
      };
    }

    case "CLOSE_TABLE": {
      const lines = state.tabs[action.table] ?? [];
      const amount = lines.reduce((t, l) => t + menuOf(l.menuId).price * l.qty, 0);
      const label = state.targets.find((t) => t.id === action.table)?.label ?? action.table;
      const tabs = { ...state.tabs };
      delete tabs[action.table];
      return {
        ...state,
        tabs,
        payments: [
          ...state.payments,
          { id: "P" + (state.payments.length + 1), label, amount },
        ],
        banner: `ปิดบิล${label} · รับ ฿${amount.toLocaleString("en-US")} — ยอดเข้ารายงาน P&L ทันที`,
      };
    }

    case "BANNER":
      return { ...state, banner: action.text };

    default:
      return state;
  }
}

type Ctx = {
  state: State;
  dispatch: React.Dispatch<Action>;
  total: number;
  cooking: number;
  soldOut: (m: MenuItem) => boolean;
  /** โต๊ะที่มีบิลเปิดค้างอยู่ */
  openTabs: { id: string; label: string; lines: Line[]; total: number }[];
  tabTotal: (lines: Line[]) => number;
};

const PosContext = createContext<Ctx | null>(null);

export function PosProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      total: cartTotal(state.cart),
      cooking: state.tickets.filter((t) => t.status === "cooking").length,
      soldOut: (m: MenuItem) => isSoldOut(m, state.stock),
      openTabs: Object.entries(state.tabs).map(([id, lines]) => ({
        id,
        label: state.targets.find((t) => t.id === id)?.label ?? id,
        lines,
        total: cartTotal(lines),
      })),
      tabTotal: cartTotal,
    }),
    [state],
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be used within PosProvider");
  return ctx;
}

export { menuOf };

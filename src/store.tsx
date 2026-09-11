import {
  useCallback,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { GUEST, HOTEL, type PayMethod, type Room } from "./data";
import type { BillLine } from "./hotel/hotelStore";
import { BookingContext, useHotel } from "./contexts";
import { TODAY, addDays, nightsBetween } from "./lib/date";
import { stayTotal } from "./lib/rates";
import { allocate } from "./lib/allocate";

export type Step = "search" | "confirm" | "arrival" | "manage" | "stay" | "checkout";

export type ChatMsg = { id: string; from: "guest" | "desk"; text: string };
export type Job = { id: string; label: string };

type State = {
  step: Step;
  room: Room | null;
  /** ช่วงเข้าพักที่แขกเลือกเอง */
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  /** จำนวนห้องที่จอง — ครอบครัว 4 คนมักจอง 2 ห้อง ไม่ใช่ยัดห้องเดียว */
  rooms: number;
  bookingNo: string | null;
  /** ผลการจัดห้องของการจองหลายห้อง — บอกแขกตามจริงว่าติดกันไหม */
  allocation: string | null;
  /** ห้องที่ระบบจัดให้ตอนเช็กอิน — เป็นคีย์ของบิลใน state กลาง */
  assigned: string | null;
  payMethod: PayMethod;
  chat: ChatMsg[];
  jobs: Job[];
  /** ข้อความแจ้งผลหลังยกเลิก — โชว์ที่หน้าค้นหา */
  notice: string | null;
};

type Action =
  | { type: "SELECT_ROOM"; room: Room }
  | { type: "SET_DATES"; checkIn: string; checkOut: string }
  | { type: "SET_PAX"; adults: number; children: number }
  | { type: "SET_ROOMS"; rooms: number }
  | { type: "SET_PAY"; method: PayMethod }
  | { type: "GOTO"; step: Step }
  | { type: "BOOKED"; bookingNo: string; allocation?: string | null }
  | { type: "ARRIVED"; room: string }
  | { type: "PUSH_CHAT"; msg: ChatMsg }
  | { type: "ADD_JOB"; job: Job }
  | { type: "CANCELLED"; notice: string }
  | { type: "CLEAR_NOTICE" }
  | { type: "RESET" };

const initial: State = {
  step: "search",
  room: null,
  checkIn: TODAY,
  checkOut: addDays(TODAY, 2),
  adults: 2,
  children: 0,
  rooms: 1,
  bookingNo: null,
  allocation: null,
  assigned: null,
  payMethod: "qr",
  chat: [],
  jobs: [],
  notice: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SELECT_ROOM":
      return { ...state, room: action.room };
    case "SET_DATES":
      return { ...state, checkIn: action.checkIn, checkOut: action.checkOut };
    case "SET_PAX":
      return { ...state, adults: action.adults, children: action.children };
    case "SET_ROOMS":
      return { ...state, rooms: action.rooms };
    case "SET_PAY":
      return { ...state, payMethod: action.method };
    case "GOTO":
      return { ...state, step: action.step };
    case "BOOKED":
      return {
        ...state,
        bookingNo: action.bookingNo,
        allocation: action.allocation ?? null,
        step: "arrival",
      };
    case "ARRIVED":
      return { ...state, assigned: action.room, step: "stay" };
    case "PUSH_CHAT":
      return { ...state, chat: [...state.chat, action.msg] };
    case "ADD_JOB":
      return { ...state, jobs: [...state.jobs, action.job] };
    case "CANCELLED":
      return { ...initial, notice: action.notice };
    case "CLEAR_NOTICE":
      return { ...state, notice: null };
    case "RESET":
      return initial;
    default:
      return state;
  }
}

export type Ctx = {
  state: State;
  dispatch: React.Dispatch<Action>;
  nights: number;
  pax: number;
  nightsTotal: number;
  otaTotal: number;
  savings: number;
  depositAmount: number;
  /** บิลห้องจาก state กลาง — POS และแม่บ้านยิงเข้ามาที่เดียวกัน */
  bill: BillLine[];
  billTotal: number;
  balanceDue: number;
  confirm: () => void;
  arrive: () => void;
  changeDates: (checkIn: string, checkOut: string) => void;
  changePax: (adults: number, children: number) => void;
  changeRooms: (rooms: number) => void;
  cancelBooking: () => void;
  addCharge: (line: Omit<BillLine, "id" | "qty"> & { qty?: number }) => void;
  settle: () => void;
};

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const hotel = useHotel();

  const nights = Math.max(1, nightsBetween(state.checkIn, state.checkOut));
  const pax = state.adults + state.children;

  /** สร้างการจองจริงลง state กลาง — หน้าเคาน์เตอร์เห็นทันที */
  const confirm = useCallback(() => {
    if (!state.room) return;
    // กันห้องจริงให้ครบจำนวนที่จอง และพยายามจัดให้ติดกัน
    const free = hotel.availableRooms(state.checkIn, state.checkOut, state.room.name);
    if (free.length < state.rooms) return;
    const plan = allocate(free, state.rooms);
    const held = plan.rooms;
    const id = "B-" + (2500 + Math.floor(nights * 7 + pax * 13));
    const perRoomDeposit = Math.round(
      (stayTotal(state.room.price, state.checkIn, state.checkOut) * HOTEL.depositPct) / 100,
    );
    // หนึ่งห้อง = หนึ่งใบจอง ตามที่ PMS จริงทำ · ใบแรกใช้เลขหลัก ที่เหลือต่อท้าย -2, -3
    // เคาน์เตอร์จึงเช็กอินแยกห้องได้ และบิลของแต่ละห้องไม่ปนกัน
    held.forEach((r, i) => {
      const perAdults =
        i === 0
          ? state.adults - Math.floor(state.adults / state.rooms) * (state.rooms - 1)
          : Math.floor(state.adults / state.rooms);
      hotel.dispatch({
        type: "CREATE_BOOKING",
        booking: {
          id: i === 0 ? id : `${id}-${i + 1}`,
          guest: state.rooms > 1 ? `${GUEST.name} (ห้อง ${i + 1}/${state.rooms})` : GUEST.name,
          roomType: state.room!.name,
          room: r.no,
          checkIn: state.checkIn,
          checkOut: state.checkOut,
          adults: Math.max(1, perAdults),
          children: i === 0 ? state.children : 0,
          rate: state.room!.price,
          deposit: perRoomDeposit,
          source: "direct",
          note:
            state.rooms > 1
              ? `จองตรงผ่านเว็บ · จองพร้อมกัน ${state.rooms} ห้อง (${id}) · ${plan.note}`
              : "จองตรงผ่านเว็บ · มัดจำรับแล้ว",
        },
      });
    });
    dispatch({ type: "BOOKED", bookingNo: id, allocation: state.rooms > 1 ? plan.note : null });
  }, [state.room, state.rooms, state.checkIn, state.checkOut, state.adults, state.children, nights, pax, hotel]);

  /** แขกมาถึงและเช็กอิน — ระบบจัดห้องว่างของประเภทที่จองให้ */
  const arrive = useCallback(() => {
    if (!state.bookingNo || !state.room) return;
    // ห้องถูกกันไว้ตั้งแต่ตอนจองแล้ว — เช็กอินเข้าห้องเดิม ไม่สุ่มใหม่
    const booked = hotel.state.bookings.find((x) => x.id === state.bookingNo);
    const free =
      hotel.availableRooms(state.checkIn, state.checkOut, state.room.name, state.bookingNo)[0] ??
      hotel.readyRooms()[0];
    const no = booked?.room ?? free?.no ?? GUEST.room;
    hotel.dispatch({ type: "CHECK_IN", bookingId: state.bookingNo, room: no });
    dispatch({ type: "ARRIVED", room: no });
  }, [state.bookingNo, state.room, state.checkIn, state.checkOut, hotel]);

  /** แขกเปลี่ยนจำนวนห้อง — ราคาและการตรวจห้องว่างขยับตาม */
  const changeRooms = useCallback((rooms: number) => {
    dispatch({ type: "SET_ROOMS", rooms: Math.max(1, Math.min(5, rooms)) });
  }, []);

  /** แขกเลื่อนวันเอง — ปฏิทินและบิลฝั่งโรงแรมขยับตามทันที */
  const changeDates = useCallback(
    (checkIn: string, checkOut: string) => {
      dispatch({ type: "SET_DATES", checkIn, checkOut });
      if (state.bookingNo) {
        hotel.dispatch({ type: "CHANGE_DATES", bookingId: state.bookingNo, checkIn, checkOut });
      }
    },
    [state.bookingNo, hotel],
  );

  const changePax = useCallback(
    (adults: number, children: number) => {
      dispatch({ type: "SET_PAX", adults, children });
      if (state.bookingNo) {
        hotel.dispatch({
          type: "EDIT_BOOKING",
          bookingId: state.bookingNo,
          patch: { adults, children },
        });
      }
    },
    [state.bookingNo, hotel],
  );

  /** ยกเลิกเอง — คืนมัดจำเต็มเมื่อยังไม่เช็กอิน */
  const cancelBooking = useCallback(() => {
    if (!state.bookingNo) return;
    const b = hotel.state.bookings.find((x) => x.id === state.bookingNo);
    const refund = b?.deposit ?? 0;
    hotel.dispatch({ type: "CANCEL", bookingId: state.bookingNo, refund });
    dispatch({
      type: "CANCELLED",
      notice: `ยกเลิกการจอง #${state.bookingNo} แล้ว · คืนมัดจำ ฿${refund.toLocaleString("en-US")} เข้าบัญชีเดิมภายใน 3 วันทำการ`,
    });
  }, [state.bookingNo, hotel]);

  const addCharge = useCallback(
    (line: Omit<BillLine, "id" | "qty"> & { qty?: number }) => {
      if (!state.assigned) return;
      hotel.dispatch({ type: "ADD_CHARGE", room: state.assigned, line });
    },
    [state.assigned, hotel],
  );

  const settle = useCallback(() => {
    if (!state.assigned) return;
    hotel.dispatch({ type: "CHECK_OUT", room: state.assigned });
  }, [state.assigned, hotel]);

  const value = useMemo<Ctx>(() => {
    const rate = state.room?.price ?? 0;
    const ota = state.room?.ota ?? 0;
    // ราคาต่อห้องคูณจำนวนห้อง — จองสองห้องต้องจ่ายสองห้อง
    const perRoom = stayTotal(rate, state.checkIn, state.checkOut);
    const nightsTotal = perRoom * state.rooms;
    const otaTotal = stayTotal(ota, state.checkIn, state.checkOut) * state.rooms;
    const depositAmount = Math.round((nightsTotal * HOTEL.depositPct) / 100);
    const bill = state.assigned ? hotel.billOf(state.assigned) : [];
    const billTotal = bill.reduce((s, l) => s + l.price * l.qty, 0);
    return {
      state,
      dispatch,
      nights,
      pax,
      nightsTotal,
      otaTotal,
      savings: otaTotal - nightsTotal,
      depositAmount,
      bill,
      billTotal,
      balanceDue: billTotal - depositAmount,
      confirm,
      arrive,
      changeDates,
      changePax,
      changeRooms,
      cancelBooking,
      addCharge,
      settle,
    };
  }, [state, nights, pax, hotel, confirm, arrive, changeDates, changePax, changeRooms, cancelBooking, addCharge, settle]);

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

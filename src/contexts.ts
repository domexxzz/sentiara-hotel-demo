import { createContext, useContext } from "react";
import type { Ctx as BookingCtx } from "./store";
import type { Ctx as BackendCtx } from "./lib/backend";
import type { Ctx as HotelCtx } from "./hotel/hotelStore";
import type { Ctx as DeskCtx } from "./desk/deskStore";
import type { Ctx as StaffCtx } from "./staff/staffStore";
import type { Ctx as PosCtx } from "./pos/posStore";
import type { Ctx as OwnerCtx } from "./owner/ownerStore";

export const BookingContext = createContext<BookingCtx | null>(null);
export const BackendContext = createContext<BackendCtx | null>(null);
export const HotelContext = createContext<HotelCtx | null>(null);
export const DeskContext = createContext<DeskCtx | null>(null);
export const StaffContext = createContext<StaffCtx | null>(null);
export const PosContext = createContext<PosCtx | null>(null);
export const OwnerContext = createContext<OwnerCtx | null>(null);

const required = <T,>(value: T | null, name: string): T => {
  if (!value) throw new Error(`${name} must be used within its Provider`);
  return value;
};

export const useBooking = () => required(useContext(BookingContext), "useBooking");
export const useBackend = () => required(useContext(BackendContext), "useBackend");
export const useHotel = () => required(useContext(HotelContext), "useHotel");
export const useDesk = () => required(useContext(DeskContext), "useDesk");
export const useStaff = () => required(useContext(StaffContext), "useStaff");
export const usePos = () => required(useContext(PosContext), "usePos");
export const useOwner = () => required(useContext(OwnerContext), "useOwner");

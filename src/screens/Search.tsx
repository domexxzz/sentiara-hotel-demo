import { useState } from "react";
import { HOTEL, money } from "../data";
import { roomsFor } from "../lib/property";
import { useBooking, useHotel } from "../contexts";
import { Rail } from "../components/PhoneFrame";
import { Icon } from "../components/Icon";
import { RoomGallery } from "../components/RoomGallery";
import { DateRangePicker } from "../components/DateRangePicker";
import { fmtRange, fmtRangeShort } from "../lib/date";
import { WEEKEND_PCT, stayTotal, weekendNights } from "../lib/rates";

type Panel = "none" | "dates" | "pax";

export function Search() {
  const { state, dispatch, changeRooms, nights, pax } = useBooking();
  const hotel = useHotel();
  const [panel, setPanel] = useState<Panel>("none");

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? "none" : p));

  const pick = (roomId: string) => {
    const room = roomsFor(hotel.mode, hotel.settings).find((r) => r.id === roomId);
    if (!room) return;
    dispatch({ type: "SELECT_ROOM", room });
    dispatch({ type: "GOTO", step: "confirm" });
  };

  const stepPax = (which: "adults" | "children", delta: number) => {
    const adults = which === "adults" ? state.adults + delta : state.adults;
    const children = which === "children" ? state.children + delta : state.children;
    dispatch({ type: "SET_PAX", adults, children });
  };

  return (
    <>
      <header className="appbar">
        <div className="brand">
          <span className="k">จองตรงกับเรา</span>
          <strong>{HOTEL.name}</strong>
        </div>
        <button className="iconbtn" aria-label="โทร">
          <Icon name="phone" size={17} />
        </button>
      </header>
      <Rail active={0} />

      <div className="body fade">
        {state.notice && (
          <div className="jobcard">
            <Icon name="check" size={16} className="ic" />
            <span>{state.notice}</span>
            <button
              style={{ marginLeft: "auto", color: "inherit" }}
              aria-label="ปิดข้อความ"
              onClick={() => dispatch({ type: "CLEAR_NOTICE" })}
            >
              ✕
            </button>
          </div>
        )}
        <div className="tripbar">
          <button onClick={() => toggle("dates")} aria-expanded={panel === "dates"}>
            <Icon name="calendar" size={18} className="ic" />
            <span>
              <span className="sub">วันที่ · {nights} คืน</span>
              <span className="val">{fmtRangeShort(state.checkIn, state.checkOut)}</span>
            </span>
          </button>
          <button onClick={() => toggle("pax")} aria-expanded={panel === "pax"}>
            <Icon name="users" size={18} className="ic" />
            <span>
              <span className="sub">ผู้เข้าพัก</span>
              <span className="val">
                {state.adults} ผู้ใหญ่{state.children ? ` · ${state.children} เด็ก` : ""}
                {state.rooms > 1 ? ` · ${state.rooms} ห้อง` : ""}
              </span>
            </span>
          </button>
        </div>

        {panel === "dates" && (
          <DateRangePicker
            checkIn={state.checkIn}
            checkOut={state.checkOut}
            onChange={(checkIn, checkOut) => dispatch({ type: "SET_DATES", checkIn, checkOut })}
            onClose={() => setPanel("none")}
          />
        )}

        {panel === "pax" && (
          <div className="paxbox">
            <div className="paxrow">
              <span className="lbl">
                <strong>ผู้ใหญ่</strong>
                <span>อายุ 12 ปีขึ้นไป</span>
              </span>
              <button
                className="step"
                onClick={() => stepPax("adults", -1)}
                disabled={state.adults <= 1}
                aria-label="ลดผู้ใหญ่"
              >
                −
              </button>
              <span className="n">{state.adults}</span>
              <button
                className="step"
                onClick={() => stepPax("adults", 1)}
                disabled={state.adults >= 6}
                aria-label="เพิ่มผู้ใหญ่"
              >
                +
              </button>
            </div>
            <div className="paxrow">
              <span className="lbl">
                <strong>เด็ก</strong>
                <span>ต่ำกว่า 12 ปี · พักฟรีกับผู้ปกครอง</span>
              </span>
              <button
                className="step"
                onClick={() => stepPax("children", -1)}
                disabled={state.children <= 0}
                aria-label="ลดเด็ก"
              >
                −
              </button>
              <span className="n">{state.children}</span>
              <button
                className="step"
                onClick={() => stepPax("children", 1)}
                disabled={state.children >= 4}
                aria-label="เพิ่มเด็ก"
              >
                +
              </button>
            </div>
            <div className="paxrow">
              <span className="lbl">
                <strong>ห้องพัก</strong>
                <span>คนเยอะพักห้องเดียวไม่ไหว — เพิ่มห้องได้เลย</span>
              </span>
              <button
                className="step"
                onClick={() => changeRooms(state.rooms - 1)}
                disabled={state.rooms <= 1}
                aria-label="ลดจำนวนห้อง"
              >
                −
              </button>
              <span className="n">{state.rooms}</span>
              <button
                className="step"
                onClick={() => changeRooms(state.rooms + 1)}
                disabled={state.rooms >= 5}
                aria-label="เพิ่มจำนวนห้อง"
              >
                +
              </button>
            </div>
            <button className="btn dark block sm" onClick={() => setPanel("none")}>
              เสร็จ
            </button>
          </div>
        )}

        <div className="savings">
          <Icon name="tag" size={17} className="ic" />
          จองตรงกับเราถูกกว่า OTA {HOTEL.otaGapPct}% — ราคานี้มีแค่ที่นี่
        </div>

        <div className="seclabel k">
          ห้องว่าง · {fmtRange(state.checkIn, state.checkOut)} · {nights} คืน
        </div>

        {roomsFor(hotel.mode, hotel.settings).map((r) => {
          const free = hotel.availableRooms(state.checkIn, state.checkOut, r.name).length;
          const capacity = r.id === "dorm" ? 1 : r.id === "superior" ? 3 : 4;
          // ความจุคิดต่อห้อง — 4 คน 2 ห้องคือห้องละ 2 ไม่ใช่ยัดห้องเดียว
          const perRoom = Math.ceil(pax / state.rooms);
          const tooMany = perRoom > capacity;
          // ต้องมีห้องว่างครบตามจำนวนที่จอง ไม่ใช่แค่มีห้องเดียว
          const notEnough = free < state.rooms;
          const soldOut = free === 0;
          const wknd = weekendNights(state.checkIn, state.checkOut);
          const total = stayTotal(r.price, state.checkIn, state.checkOut) * state.rooms;
          // ถ้าคนเกินความจุ ให้บอกไปเลยว่าต้องกี่ห้อง แทนที่จะบอกแค่ว่าจองไม่ได้
          const needRooms = Math.ceil(pax / capacity);
          return (
            <article key={r.id} className="card room">
              <RoomGallery id={r.id} photos={r.photos} alt={`ห้อง${r.name}`}>
                {r.tag && <span className="tag">{r.tag}</span>}
                <span className="sqm">{r.sqm} ตร.ม.</span>
              </RoomGallery>
              <div className="info">
                <h3>{r.name}</h3>
                <div className="bed">
                  {r.bed} · รับได้ {capacity} ท่าน
                </div>
                <div className="amen">
                  {r.amenities.map((a) => (
                    <span key={a}>{a}</span>
                  ))}
                </div>
                <div className="priceRow">
                  <div className="price">
                    <span className="ota">{money(stayTotal(r.ota, state.checkIn, state.checkOut))} รวม {nights} คืน</span>
                    <span className="now">
                      {money(total)} <small>รวม {nights} คืน · ภาษีแล้ว</small>
                    </span>
                  </div>
                  <button
                    className="btn primary sm"
                    onClick={() => (tooMany ? changeRooms(needRooms) : pick(r.id))}
                    disabled={soldOut || notEnough || (tooMany && needRooms > free)}
                  >
                    {soldOut
                      ? "เต็มช่วงนี้"
                      : notEnough
                        ? `เหลือ ${free} ห้อง`
                        : tooMany
                          ? `เปลี่ยนเป็น ${needRooms} ห้อง`
                          : state.rooms > 1
                            ? `จอง ${state.rooms} ห้องนี้`
                            : "จองห้องนี้"}
                    {!tooMany && !soldOut && !notEnough && <Icon name="chevron" size={15} />}
                  </button>
                </div>
                <div
                  className="avail"
                  style={
                    tooMany || soldOut || notEnough ? { color: "var(--accent-700)" } : undefined
                  }
                >
                  {tooMany
                    ? needRooms <= free
                      ? `ห้องนี้รับได้ห้องละ ${capacity} ท่าน — ${pax} ท่านต้องใช้ ${needRooms} ห้อง กดปุ่มเพื่อเปลี่ยนให้`
                      : `ห้องนี้รับได้ห้องละ ${capacity} ท่าน · ${pax} ท่านต้องใช้ ${needRooms} ห้อง แต่ช่วงนี้เหลือ ${free} ห้อง`
                    : notEnough
                      ? `จองไว้ ${state.rooms} ห้อง แต่ช่วงนี้เหลือ ${free} ห้อง — ลดจำนวนห้องหรือเลื่อนวัน`
                      : soldOut
                        ? "ถูกจองหมดในช่วงวันที่เลือก — ลองเลื่อนวันหรือเลือกห้องแบบอื่น"
                        : wknd
                          ? `${money(r.price)} วันธรรมดา · ${money(Math.round((r.price * (100 + WEEKEND_PCT)) / 100))} คืนศุกร์–เสาร์ (${wknd} คืน) · ว่างช่วงนี้ ${free} ห้อง`
                          : `${money(r.price)} /คืน · ว่างช่วงนี้ ${free} ห้อง${state.rooms > 1 ? ` · จอง ${state.rooms} ห้อง` : ""}`}
                </div>
              </div>
            </article>
          );
        })}

        <p style={{ fontSize: 11, color: "var(--faint)", textAlign: "center", margin: "4px 0 0" }}>
          ยกเลิกฟรีก่อน 48 ชม. · มัดจำ {HOTEL.depositPct}% ตอนจอง
        </p>
      </div>
    </>
  );
}

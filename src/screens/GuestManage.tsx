import { useState } from "react";
import { HOTEL, money } from "../data";
import { useBooking } from "../store";
import { useHotel } from "../hotel/hotelStore";
import { Rail } from "../components/PhoneFrame";
import { Icon } from "../components/Icon";
import { DateRangePicker } from "../components/DateRangePicker";
import { fmtRange } from "../lib/date";

export function GuestManage() {
  const {
    state,
    dispatch,
    changeDates,
    changePax,
    cancelBooking,
    nights,
    nightsTotal,
    depositAmount,
  } = useBooking();
  const hotel = useHotel();
  const [showCal, setShowCal] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const room = state.room;
  if (!room) return null;

  // การจองอาจถูกเคาน์เตอร์แก้ไปแล้ว — อ่านค่าล่าสุดเสมอ
  const live = hotel.state.bookings.find((b) => b.id === state.bookingNo);
  const assignedRoom = live?.room;

  const stepPax = (which: "adults" | "children", delta: number) =>
    changePax(
      which === "adults" ? state.adults + delta : state.adults,
      which === "children" ? state.children + delta : state.children,
    );

  return (
    <>
      <header className="appbar">
        <button
          className="backbtn"
          onClick={() => dispatch({ type: "GOTO", step: "arrival" })}
          aria-label="ย้อนกลับ"
        >
          <Icon name="back" size={18} />
        </button>
        <div className="brand">
          <span className="k">จัดการการจอง · #{state.bookingNo}</span>
          <strong>{room.name}</strong>
        </div>
      </header>
      <Rail active={2} />

      <div className="body fade">
        <div className="card pad">
          <div className="sumline" style={{ paddingTop: 0 }}>
            <span className="lbl">เข้าพัก</span>
            <span className="v" style={{ fontFamily: "var(--th)" }}>
              {fmtRange(state.checkIn, state.checkOut)}
            </span>
          </div>
          <div className="sumline">
            <span className="lbl">รวม {nights} คืน</span>
            <span className="v">{money(nightsTotal)}</span>
          </div>
          {assignedRoom && (
            <div className="sumline">
              <span className="lbl">ห้องที่โรงแรมกันไว้ให้</span>
              <span className="v" style={{ fontFamily: "var(--th)" }}>
                ห้อง {assignedRoom}
              </span>
            </div>
          )}
        </div>

        <div className="seclabel k">เลื่อนวันเข้าพัก</div>
        {showCal ? (
          <DateRangePicker
            checkIn={state.checkIn}
            checkOut={state.checkOut}
            onChange={changeDates}
            onClose={() => setShowCal(false)}
          />
        ) : (
          <button className="btn block" onClick={() => setShowCal(true)}>
            <Icon name="calendar" size={16} />
            เปลี่ยนวัน — ตอนนี้ {fmtRange(state.checkIn, state.checkOut)}
          </button>
        )}

        <div className="seclabel k">จำนวนผู้เข้าพัก</div>
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
              disabled={state.adults >= 4}
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
              disabled={state.children >= 3}
              aria-label="เพิ่มเด็ก"
            >
              +
            </button>
          </div>
        </div>

        <div className="hairline" />

        <div className="seclabel k">ยกเลิกการจอง</div>
        <div className="card pad">
          <div className="sumline" style={{ paddingTop: 0 }}>
            <span className="lbl">มัดจำที่จ่ายไว้</span>
            <span className="v">{money(depositAmount)}</span>
          </div>
          <div className="sumline total">
            <span className="lbl">ได้คืนถ้ายกเลิกตอนนี้</span>
            <span className="v" style={{ color: "var(--ok)" }}>
              {money(depositAmount)}
            </span>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "8px 0 0" }}>
            ยกเลิกฟรีก่อนเข้าพัก 48 ชม. · ยกเลิกแล้วห้องกลับไปเปิดขายทันที
            และเคาน์เตอร์เห็นเองโดยคุณไม่ต้องโทรแจ้ง
          </p>
        </div>

        {confirmCancel ? (
          <>
            <div
              className="jobcard"
              style={{
                background: "var(--accent-100)",
                borderColor: "var(--accent-200)",
                color: "var(--accent-900)",
              }}
            >
              <Icon name="shield" size={16} className="ic" />
              <span>ยืนยันยกเลิกการจอง #{state.bookingNo} ใช่ไหม? ทำแล้วย้อนกลับไม่ได้</span>
            </div>
            <button className="btn primary block" onClick={cancelBooking}>
              <Icon name="check" size={16} />
              ยืนยันยกเลิก · รับคืน {money(depositAmount)}
            </button>
            <button className="btn ghost block" onClick={() => setConfirmCancel(false)}>
              ไม่ยกเลิกแล้ว
            </button>
          </>
        ) : (
          <button className="btn block" onClick={() => setConfirmCancel(true)}>
            ยกเลิกการจองนี้
          </button>
        )}

        <p style={{ fontSize: 11, color: "var(--faint)", textAlign: "center", margin: 0 }}>
          ต้องการความช่วยเหลือ? ตอบกลับในแชต LINE ได้เลย — คนจริงตอบ 07:00–22:00 ·{" "}
          {HOTEL.phone}
        </p>
      </div>
    </>
  );
}

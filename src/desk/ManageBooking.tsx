import { useState } from "react";
import { useDesk, useHotel } from "../contexts";
import { money } from "../lib/format";
import { DateRangePicker } from "../components/DateRangePicker";
import { fmtRange, nightsBetween } from "../lib/date";
import { stayTotal } from "../lib/rates";
import { Icon, type IconName } from "../components/Icon";

type Tab = "dates" | "room" | "cancel";

/** ยกเลิกก่อนเข้าพักยังอยู่ในเงื่อนไขคืนมัดจำเต็ม — เช็กอินแล้วคืนไม่ได้ */
const FREE_CANCEL_HOURS = 48;

export function ManageBooking() {
  const { state, dispatch } = useDesk();
  const hotel = useHotel();
  const b = state.managing;

  const [tab, setTab] = useState<Tab>("dates");
  const [showCal, setShowCal] = useState(false);
  const [moveTo, setMoveTo] = useState("");

  if (!b) return null;

  // อ่านค่าล่าสุดจาก state กลางเสมอ — การ์ดที่กดมาอาจเก่าไปแล้ว
  const live = hotel.state.bookings.find((x) => x.id === b.id) ?? b;
  const nights = Math.max(1, nightsBetween(live.checkIn, live.checkOut));
  const total = stayTotal(live.rate, live.checkIn, live.checkOut);
  const inHouse = live.status === "inhouse";
  const freeCancel = !inHouse;
  const refund = freeCancel ? live.deposit : 0;

  // ห้องปลายทางต้องพร้อมขายและว่างตลอดช่วงวันของการจองนี้
  const targets = hotel
    .availableRooms(live.checkIn, live.checkOut, undefined, live.id)
    .filter((r) => r.status === "ready" && r.no !== live.room);

  const close = () => dispatch({ type: "DONE" });

  const TABS: { id: Tab; label: string; icon: IconName; sub: string }[] = [
    {
      id: "dates",
      label: "เลื่อนวัน / แก้ไข",
      icon: "calendar",
      sub: fmtRange(live.checkIn, live.checkOut),
    },
    {
      id: "room",
      label: inHouse ? "ย้ายห้อง" : "กำหนดห้อง",
      icon: "bed",
      sub: live.room ? `ห้อง ${live.room}` : "ยังไม่ระบุ",
    },
    {
      id: "cancel",
      label: "ยกเลิก + คืนเงิน",
      icon: "back",
      sub: freeCancel ? "คืนมัดจำเต็ม" : "แขกเช็กอินแล้ว",
    },
  ];

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">
            จัดการการจอง · #{live.id} · {inHouse ? "กำลังพัก" : "รอเช็กอิน"}
          </span>
          <h2>{live.guest}</h2>
        </div>
        <div className="spacer" />
        <button className="btn ghost sm" onClick={close}>
          <Icon name="back" size={14} />
          กลับผังห้อง
        </button>
      </div>

      <div className="steps">
        {TABS.map((t) => (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            className={tab === t.id ? "on" : ""}
            style={{ cursor: "pointer" }}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => e.key === "Enter" && setTab(t.id)}
          >
            <span className="n">{t.label}</span>
            {t.sub}
          </div>
        ))}
      </div>

      <div className="panel">
        {tab === "dates" && (
          <>
            <h3>เลื่อนวันเข้าพัก</h3>
            <p className="lead">
              เปลี่ยนวันแล้วปฏิทินห้องขยับตาม — ถ้าแขกเช็กอินแล้ว จำนวนคืนในบิลปรับให้เอง
            </p>
            <div className="bill">
              <div className="r">
                <span>
                  ช่วงปัจจุบัน
                  <span className="sub">
                    {nights} คืน · {money(live.rate)} ต่อคืน
                  </span>
                </span>
                <span className="v">{fmtRange(live.checkIn, live.checkOut)}</span>
              </div>
              <div className="r total">
                <span>ค่าห้องรวม</span>
                <span className="v">{money(total)}</span>
              </div>
            </div>

            {showCal ? (
              <DateRangePicker
                checkIn={live.checkIn}
                checkOut={live.checkOut}
                onChange={(checkIn, checkOut) => {
                  // เลื่อนวันแล้วต้องไม่ไปทับการจองอื่นของห้องเดียวกัน
                  if (live.room && !hotel.isRoomFree(live.room, checkIn, checkOut, live.id)) {
                    const alt = hotel.availableRooms(checkIn, checkOut, live.roomType, live.id)[0];
                    dispatch({
                      type: "TOAST",
                      text: alt
                        ? `ห้อง ${live.room} มีคนจองไว้แล้วช่วง ${fmtRange(checkIn, checkOut)} — ย้ายไปห้อง ${alt.no} ได้`
                        : `ห้อง ${live.room} มีคนจองไว้แล้วช่วง ${fmtRange(checkIn, checkOut)} และห้องแบบเดียวกันเต็มหมด`,
                    });
                    return;
                  }
                  hotel.dispatch({
                    type: "CHANGE_DATES",
                    bookingId: live.id,
                    checkIn,
                    checkOut,
                  });
                  dispatch({
                    type: "TOAST",
                    text: `เลื่อนวัน #${live.id} เป็น ${fmtRange(checkIn, checkOut)} — ปฏิทินและบิลอัปเดตแล้ว`,
                  });
                }}
                onClose={() => setShowCal(false)}
              />
            ) : (
              <button
                className="btn dark"
                style={{ alignSelf: "flex-start" }}
                onClick={() => setShowCal(true)}
              >
                <Icon name="calendar" size={16} />
                เลือกวันใหม่
              </button>
            )}
          </>
        )}

        {tab === "room" && (
          <>
            <h3>
              {inHouse ? `ย้ายห้อง — ตอนนี้อยู่ห้อง ${live.room}` : "กำหนดห้องล่วงหน้า"}
            </h3>
            <p className="lead">
              {inHouse
                ? "ย้ายแล้วบิลทั้งใบตามไปห้องใหม่ · ห้องเดิมเข้าคิวแม่บ้านอัตโนมัติ"
                : "เลือกได้เฉพาะห้องที่พร้อมขาย — กันไว้ให้จนถึงวันเช็กอิน"}
            </p>
            {targets.length === 0 ? (
              <div className="ainote">
                <Icon name="shield" size={16} className="ic" />
                <span>ไม่มีห้องว่างพร้อมขายตอนนี้ — รอแม่บ้านกดผ่านก่อน</span>
              </div>
            ) : (
              <>
                <div className="pickgrid">
                  {targets.map((r) => (
                    <button
                      key={r.no}
                      className={`pick ${moveTo === r.no ? "on" : ""}`}
                      onClick={() => setMoveTo(r.no)}
                    >
                      <div className="no">{r.no}</div>
                      <div className="ty">{r.type}</div>
                      {r.type !== live.roomType && (
                        <div
                          style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 4 }}
                        >
                          คนละประเภท
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  className="btn primary"
                  disabled={!moveTo}
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => {
                    if (inHouse && live.room) {
                      hotel.dispatch({ type: "MOVE_ROOM", from: live.room, to: moveTo });
                      dispatch({
                        type: "TOAST",
                        text: `ย้าย ${live.guest} จากห้อง ${live.room} ไปห้อง ${moveTo} — บิลตามไปด้วย ห้องเดิมเข้าคิวแม่บ้าน`,
                      });
                    } else {
                      hotel.dispatch({
                        type: "SET_ROOM",
                        room: moveTo,
                        patch: { status: "arriving", guest: live.guest },
                      });
                      dispatch({
                        type: "TOAST",
                        text: `กันห้อง ${moveTo} ให้ ${live.guest} แล้ว — ห้องถูกปิดขายทันที`,
                      });
                    }
                    close();
                  }}
                >
                  <Icon name="check" size={15} />
                  {inHouse ? `ย้ายไปห้อง ${moveTo || "…"}` : `กันห้อง ${moveTo || "…"}`}
                </button>
              </>
            )}
          </>
        )}

        {tab === "cancel" && (
          <>
            <h3>ยกเลิกการจอง #{live.id}</h3>
            <p className="lead">
              ทุกการยกเลิกบันทึกชื่อผู้ทำ เวลา และเหตุผลถาวร — แก้เงียบ ๆ ไม่ได้
            </p>
            <div className="bill">
              <div className="r">
                <span>
                  มัดจำที่รับไว้
                  <span className="sub">{live.note}</span>
                </span>
                <span className="v">{money(live.deposit)}</span>
              </div>
              <div className="r">
                <span>
                  เงื่อนไข
                  <span className="sub">ยกเลิกฟรีก่อนเข้าพัก {FREE_CANCEL_HOURS} ชม.</span>
                </span>
                <span className="v" style={{ fontFamily: "var(--th)" }}>
                  {freeCancel ? "อยู่ในเงื่อนไขคืนเต็ม" : "เช็กอินแล้ว คืนไม่ได้"}
                </span>
              </div>
              <div className="r total">
                <span>คืนให้แขก</span>
                <span className="v">{money(refund)}</span>
              </div>
            </div>

            {inHouse ? (
              <div className="ainote">
                <Icon name="shield" size={16} className="ic" />
                <span>
                  แขกเช็กอินแล้ว — ยกเลิกไม่ได้ ให้ใช้ปุ่มปิดบิล เช็กเอาท์ จากผังห้องแทน
                </span>
              </div>
            ) : (
              <button
                className="btn primary"
                style={{ alignSelf: "flex-start" }}
                onClick={() => {
                  hotel.dispatch({ type: "CANCEL", bookingId: live.id, refund });
                  dispatch({
                    type: "TOAST",
                    text: `ยกเลิก #${live.id} · คืนเงิน ${money(refund)} — ห้องกลับมาขายได้ทันที`,
                  });
                  close();
                }}
              >
                <Icon name="check" size={15} />
                ยืนยันยกเลิก · คืน {money(refund)}
              </button>
            )}
          </>
        )}
      </div>

      {hotel.state.refunds.length > 0 && (
        <>
          <div className="k" style={{ color: "var(--muted)" }}>
            ประวัติการยกเลิก / คืนเงิน
          </div>
          <div className="bill">
            {hotel.state.refunds.map((r, i) => (
              <div key={r.id + i} className="r">
                <span>
                  {r.guest} · #{r.id}
                  <span className="sub">{r.reason}</span>
                </span>
                <span className="v">{money(r.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

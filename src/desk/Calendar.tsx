import { useState } from "react";
import { useDesk } from "./deskStore";
import { useHotel } from "../hotel/hotelStore";
import { TH_DOW, TODAY, addDays, fmtLong, fmtShort, parse } from "../lib/date";
import { Icon } from "../components/Icon";

const DAYS = 14;

export function Calendar() {
  const { dispatch } = useDesk();
  const hotel = useHotel();
  const [start, setStart] = useState(TODAY);

  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));

  // จำนวนห้องที่ยังขายได้ในแต่ละวัน — ใช้ตัวตรวจชนวันตัวเดียวกับตอนจอง
  const freeOn = (day: string) =>
    hotel.state.rooms.filter((r) => hotel.isRoomFree(r.no, day, addDays(day, 1))).length;

  const tightest = days.reduce(
    (worst, d) => (freeOn(d) < worst.n ? { d, n: freeOn(d) } : worst),
    { d: days[0], n: freeOn(days[0]) },
  );

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">ปฏิทินห้อง · {DAYS} วันข้างหน้า</span>
          <h2>
            {fmtLong(days[0])} — {fmtLong(days[DAYS - 1])}
          </h2>
        </div>
        <div className="spacer" />
        <button
          className="btn ghost"
          onClick={() => setStart(addDays(start, -7))}
          disabled={start <= TODAY}
        >
          <Icon name="back" size={15} />
          ย้อน 7 วัน
        </button>
        <button className="btn ghost" onClick={() => setStart(addDays(start, 7))}>
          ถัดไป 7 วัน
          <Icon name="chevron" size={15} />
        </button>
      </div>

      <p className="lead">
        ระบบกันห้องซ้ำให้ตั้งแต่ตอนจอง — ห้องที่มีคนจองไว้แล้วจะไม่ถูกเสนอให้เลือกอีกในช่วงวันที่ทับกัน
        ไม่ว่าจะจองจากฝั่งแขก จากเคาน์เตอร์ หรือ Walk-in
      </p>

      <div className="callegend">
        <span>
          <i className="sw confirmed" />
          จองแล้ว รอเช็กอิน
        </span>
        <span>
          <i className="sw inhouse" />
          แขกพักอยู่
        </span>
        <span>
          <i className="sw ooo" />
          ปิดซ่อม ขายไม่ได้
        </span>
        <span>
          <i className="sw out" />
          เช็กเอาท์เช้านี้ · ขายคืนนี้ต่อได้
        </span>
        <span>
          <i className="sw free" />
          ว่าง ขายได้
        </span>
      </div>

      <div className="calwrap">
        <table className="calgrid">
          <thead>
            <tr>
              <th scope="col" className="roomcol">
                ห้อง
              </th>
              {days.map((d) => {
                const dow = TH_DOW[parse(d).getDay()];
                const cls = [dow === "ศ" || dow === "ส" ? "we" : "", d === TODAY ? "now" : ""]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <th key={d} scope="col" className={cls}>
                    <span className="dow">{dow}</span>
                    <span className="dnum">{parse(d).getDate()}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {hotel.state.rooms.map((r) => (
              <tr key={r.no}>
                <th scope="row" className="roomcol">
                  <strong>{r.no}</strong>
                  <span>{r.type}</span>
                </th>
                {days.map((d) => {
                  if (r.status === "ooo") {
                    return (
                      <td
                        key={d}
                        className="cal-ooo"
                        title={`ห้อง ${r.no} · ${r.note ?? "ปิดซ่อม"}`}
                      />
                    );
                  }
                  const b = hotel.bookingOn(r.no, d);
                  if (!b) {
                    // วันเช็กเอาท์ยังขายได้ แต่ต้องอ่านออกว่าเช้านี้ยังมีคนอยู่
                    const out = hotel.state.bookings.find(
                      (x) => x.room === r.no && x.status !== "checkedout" && x.checkOut === d,
                    );
                    return (
                      <td
                        key={d}
                        className={out ? "cal-out" : "cal-free"}
                        title={
                          out
                            ? `ห้อง ${r.no} · ${out.guest} เช็กเอาท์เช้านี้ — ขายคืนนี้ต่อได้`
                            : `ห้อง ${r.no} · ${fmtShort(d)} · ว่าง ขายได้`
                        }
                      />
                    );
                  }
                  return (
                    <td
                      key={d}
                      className={`cal-book ${b.status}`}
                      title={`${b.guest} · ${b.id} · ${fmtShort(b.checkIn)}–${fmtShort(b.checkOut)}`}
                    >
                      {(d === b.checkIn || d === days[0]) && (
                        <button
                          className="cal-label"
                          onClick={() => dispatch({ type: "START_MANAGE", booking: b })}
                        >
                          {b.guest}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="calfoot">
              <th scope="row" className="roomcol">
                <strong>ว่าง</strong>
                <span>ขายได้</span>
              </th>
              {days.map((d) => {
                const n = freeOn(d);
                return (
                  <td key={d} className={n <= 3 ? "tight" : ""}>
                    {n}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="lead">
        กดชื่อแขกบนแถบเพื่อเลื่อนวัน ย้ายห้อง หรือยกเลิกได้ทันที · แถวล่างคือจำนวนห้องที่ยังขายได้ในแต่ละวัน —
        วันที่แน่นที่สุดคือ {fmtShort(tightest.d)} เหลือ {tightest.n} ห้อง
      </p>
    </>
  );
}

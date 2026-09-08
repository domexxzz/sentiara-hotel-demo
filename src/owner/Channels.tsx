import { useState } from "react";
import { useHotel } from "../hotel/hotelStore";
import { TODAY, addDays, fmtShort, parse } from "../lib/date";
import { WEEKEND_PCT, isWeekendNight, rateForNight, stayTotal } from "../lib/rates";
import { money } from "../lib/format";
import { Icon } from "../components/Icon";

const DAYS = 14;

/**
 * ค่าคอมฯ ตั้งต้น — ต้องแก้ให้ตรงสัญญาจริงของแต่ละโรงแรม
 * ตัวเลขชุดนี้ไม่ได้ดึงมาจากที่ไหน ใช้เป็นค่าเริ่มต้นให้ลองคำนวณดูเท่านั้น
 */
const CHANNELS = [
  { id: "direct", name: "เว็บจองตรง", note: "ฝั่งแขกในระบบนี้", comm: 0, live: true },
  { id: "booking", name: "Booking.com", note: "ต่อผ่าน channel manager", comm: 15, live: false },
  { id: "agoda", name: "Agoda", note: "ต่อผ่าน channel manager", comm: 15, live: false },
  { id: "airbnb", name: "Airbnb", note: "ต่อผ่าน channel manager", comm: 15, live: false },
  { id: "traveloka", name: "Traveloka", note: "ต่อผ่าน channel manager", comm: 15, live: false },
];

/** เรตฐานต่อประเภทห้อง — ชุดเดียวกับที่เคาน์เตอร์และฝั่งแขกใช้ */
const BASE: Record<string, number> = {
  ดีลักซ์: 1650,
  ซูพีเรียร์: 1350,
  "รายเตียง (ดอร์ม)": 450,
};

export function Channels() {
  const hotel = useHotel();
  const [showJson, setShowJson] = useState(false);

  const days = Array.from({ length: DAYS }, (_, i) => addDays(TODAY, i));
  const types = [...new Set(hotel.state.rooms.map((r) => r.type))];

  /** ชุดข้อมูลที่จะถูกส่งออก — คำนวณสดจากปฏิทินห้องจริง ไม่มีค่าคงที่ */
  const payload = days.flatMap((day) =>
    types.map((type) => ({
      date: day,
      roomType: type,
      available: hotel.availableRooms(day, addDays(day, 1), type).length,
      rate: rateForNight(BASE[type] ?? 1350, day),
      currency: "THB",
    })),
  );

  const closeouts = payload.filter((p) => p.available === 0);
  // ช่องที่เหลือน้อยที่สุด — ตัวที่ต้องเฝ้าก่อนจะกลายเป็นศูนย์
  const tight = [...payload].sort((a, b) => a.available - b.available).slice(0, 6);
  const minLeft = tight[0]?.available ?? 0;

  // ที่มาของการจองที่มีอยู่จริงในระบบ
  const live = hotel.state.bookings.filter((b) => b.status !== "checkedout");
  const directBookings = live.filter((b) => b.source === "direct" || b.source === "walkin");
  const otaBookings = live.filter((b) => b.source === "ota");
  const revenueOf = (list: typeof live) =>
    list.reduce((t, b) => t + stayTotal(b.rate, b.checkIn, b.checkOut), 0);
  const directRevenue = revenueOf(directBookings);
  const otaRevenue = revenueOf(otaBookings);
  const commRate = CHANNELS.find((c) => c.id === "booking")?.comm ?? 15;

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">ช่องทางขาย · Channel Manager</span>
          <h2>ห้องว่างและราคาที่จะส่งออก</h2>
        </div>
      </div>

      <div className="ch-status">
        <Icon name="wifi" size={17} className="ic" />
        <div>
          <strong>ยังไม่ได้เชื่อมต่อ OTA</strong>
          <span>
            หน้านี้แสดง<b>ชุดข้อมูลที่ระบบคำนวณเสร็จแล้วและพร้อมส่ง</b> — ยังไม่มีการซิงก์จริงเกิดขึ้น
            ตัวเลขทุกตัวข้างล่างคำนวณสดจากปฏิทินห้องและแผนราคาชุดเดียวกับที่เคาน์เตอร์ใช้
          </span>
        </div>
      </div>

      <div className="ch-list">
        {CHANNELS.map((c) => (
          <div key={c.id} className={`ch-row ${c.live ? "on" : ""}`}>
            <div className="nm">
              <strong>{c.name}</strong>
              <span>{c.note}</span>
            </div>
            <div className="comm">
              {c.comm === 0 ? "ไม่มีค่าคอมฯ" : `ค่าคอมฯ ${c.comm}%`}
              <span>{c.comm === 0 ? "เงินเข้าโรงแรมเต็ม" : "ค่าตั้งต้น — แก้ตามสัญญาจริง"}</span>
            </div>
            <span className={`ch-tag ${c.live ? "ok" : "wait"}`}>
              {c.live ? "ทำงานอยู่" : "รอเชื่อมต่อ"}
            </span>
          </div>
        ))}
      </div>

      <div className="ch-split">
        <div className="ch-card">
          <span className="k">การจองในระบบตอนนี้</span>
          <div className="ch-bars">
            <div>
              <span className="lbl">จองตรง + Walk-in</span>
              <span className="bar">
                <i
                  style={{ width: `${(directBookings.length / Math.max(1, live.length)) * 100}%` }}
                />
              </span>
              <span className="v">
                {directBookings.length} การจอง · {money(directRevenue)}
              </span>
            </div>
            <div>
              <span className="lbl">มาจาก OTA</span>
              <span className="bar ota">
                <i style={{ width: `${(otaBookings.length / Math.max(1, live.length)) * 100}%` }} />
              </span>
              <span className="v">
                {otaBookings.length} การจอง · {money(otaRevenue)}
              </span>
            </div>
          </div>
          <p className="ch-note">
            นับจากการจองจริงในระบบ ณ ตอนนี้ · ถ้าค่าคอมฯ {commRate}% การจองตรง{" "}
            {directBookings.length} รายการนี้ประหยัดค่าคอมฯ ได้{" "}
            <b>{money(Math.round((directRevenue * commRate) / 100))}</b>
          </p>
        </div>

        <div className="ch-card">
          <span className="k">ช่องที่ต้องเฝ้า</span>
          <div className="ch-big">{minLeft}</div>
          <p className="ch-note">
            ช่องที่เหลือน้อยที่สุดใน {DAYS} วันข้างหน้าเหลือ <b>{minLeft} ห้อง</b> ·
            ตอนนี้เต็มแล้ว <b>{closeouts.length}</b> ช่อง จากทั้งหมด {payload.length} ช่อง
            (วัน × ประเภทห้อง) เมื่อช่องไหนถึงศูนย์ ต้องปิดขายบนทุก OTA ให้ทัน
            ไม่งั้นจะรับจองซ้ำ — นี่คืองานที่ channel manager ทำให้อัตโนมัติเมื่อเชื่อมต่อแล้ว
          </p>
          <div className="ch-close">
            {tight.map((c) => (
              <span key={c.date + c.roomType} className={c.available === 0 ? "" : "more"}>
                {fmtShort(c.date)} · {c.roomType} · เหลือ {c.available}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="deskhead">
        <div>
          <span className="k">คำนวณสดจากปฏิทินห้องจริง</span>
          <h2>ชุดข้อมูลที่พร้อมส่ง · {payload.length} รายการ</h2>
        </div>
        <div className="spacer" />
        <button className="btn ghost" onClick={() => setShowJson((v) => !v)}>
          <Icon name="receipt" size={15} />
          {showJson ? "ดูเป็นตาราง" : "ดูเป็น JSON"}
        </button>
      </div>

      {showJson ? (
        <pre className="ch-json">
          {JSON.stringify(
            {
              property: "sentiara-hotel",
              generatedFor: `${days[0]} → ${days[DAYS - 1]}`,
              ratePlan: { weekendNights: ["ศุกร์", "เสาร์"], weekendUpliftPct: WEEKEND_PCT },
              inventory: payload.slice(0, 6),
              _note: `แสดง 6 จาก ${payload.length} รายการ · ยังไม่ได้ส่งไปที่ใด`,
            },
            null,
            2,
          )}
        </pre>
      ) : (
        <div className="calwrap">
          <table className="calgrid ch-grid">
            <thead>
              <tr>
                <th scope="col" className="roomcol">
                  ประเภทห้อง
                </th>
                {days.map((d) => (
                  <th key={d} scope="col" className={isWeekendNight(d) ? "we" : ""}>
                    <span className="dow">{isWeekendNight(d) ? "วันหยุด" : "ธรรมดา"}</span>
                    <span className="dnum">{parse(d).getDate()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t}>
                  <th scope="row" className="roomcol">
                    <strong>{t}</strong>
                    <span>ฐาน {money(BASE[t] ?? 1350)}</span>
                  </th>
                  {days.map((d) => {
                    const cell = payload.find((p) => p.date === d && p.roomType === t)!;
                    return (
                      <td
                        key={d}
                        className={cell.available === 0 ? "full" : ""}
                        title={`${fmtShort(d)} · ${t} · ว่าง ${cell.available} ห้อง · ส่งราคา ${money(cell.rate)}`}
                      >
                        <b>{cell.available}</b>
                        <i>{cell.rate.toLocaleString("en-US")}</i>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="ch-gap">
        <strong>สิ่งที่หน้านี้ยังทำไม่ได้ — พูดตรง ๆ</strong>
        <ul>
          <li>
            <b>ไม่มีการซิงก์อัตโนมัติ</b> — ตัวเลขข้างบนคือชุดข้อมูลที่พร้อมส่ง แต่ยังไม่ถูกส่งไปที่ใด
          </li>
          <li>
            <b>ยังรับการจองจาก OTA เข้ามาเองไม่ได้</b> — การจองที่ติดป้าย OTA ในระบบตอนนี้เป็นข้อมูลตัวอย่าง
            ไม่ได้ไหลเข้ามาจริง
          </li>
          <li>
            <b>ยังไม่ได้จับคู่ประเภทห้องกับรหัสห้องของแต่ละ OTA</b> — ต้องทำ mapping ทีละช่องทางตอนติดตั้ง
          </li>
        </ul>
        <p>
          สิ่งที่ต้องมีเพื่อเปิดใช้จริง: สัญญากับ channel manager (เช่น SiteMinder, STAAH, Cloudbeds)
          หรือต่อ API ของแต่ละ OTA เอง แล้วใส่คีย์เชื่อมต่อ — ฝั่งเราคำนวณห้องว่างและราคาเสร็จแล้ว
          เหลือแค่ต่อสายออก
        </p>
      </div>
    </>
  );
}

import { useHotel } from "../hotel/hotelStore";
import { money } from "../lib/format";
import { Icon } from "../components/Icon";
import {
  FIRE_DEVICES,
  FIRE_KIND,
  FIRE_TEST_DAYS,
  ZONE_OCCUPANCY,
} from "../lib/security";

/** มิเตอร์ไฟรายห้อง 16 จุด — หน่วยเป็น kWh ของเมื่อคืน */
const METERS: { room: string; kwh: number; nights?: number }[] = [
  { room: "202", kwh: 8.4 },
  { room: "203", kwh: 7.9 },
  { room: "207", kwh: 8.1 },
  { room: "208", kwh: 8.8 },
  { room: "209", kwh: 7.6 },
  { room: "210", kwh: 12.1, nights: 3 },
  { room: "301", kwh: 8.6 },
  { room: "303", kwh: 7.7 },
  { room: "305", kwh: 8.9 },
  { room: "306", kwh: 8.0 },
  { room: "307", kwh: 8.3 },
  { room: "309", kwh: 7.8 },
  { room: "401", kwh: 8.5 },
  { room: "403", kwh: 8.2 },
  { room: "407", kwh: 7.9 },
  { room: "410", kwh: 8.7 },
];

const RATE = 4.2; // บาทต่อหน่วย
const NORMAL = 8.4; // ค่าเฉลี่ยของห้องแบบเดียวกัน

export function Energy() {
  const hotel = useHotel();

  const worst = METERS.reduce((a, b) => (b.kwh > a.kwh ? b : a));
  const peak = worst.kwh;
  const total = METERS.reduce((t, m) => t + m.kwh, 0);
  const wasted = Math.max(0, worst.kwh - NORMAL);
  // เปอร์เซ็นต์คำนวณจากมิเตอร์จริง — ทุกที่บนหน้านี้ต้องอ้างตัวเดียวกัน
  const overPct = Math.round(((worst.kwh - NORMAL) / NORMAL) * 100);

  // ใบงานของห้องที่ผิดปกติ — ถ้าสั่งช่างไปแล้วจะโชว์สถานะจริงจากคิวช่าง
  const wo = hotel.state.workOrders.find((w) => w.room === worst.room);

  const orderTech = () =>
    hotel.dispatch({
      type: "ADD_WO",
      wo: {
        id: hotel.nextWoId(),
        room: worst.room,
        label: "แอร์กินไฟผิดปกติ · ตรวจคอมเพรสเซอร์",
        from: `เซ็นเซอร์มิเตอร์ไฟ (+${overPct}% ${worst.nights ?? 3} คืนติด)`,
        urgent: true,
        note: "สั่งจากจอเจ้าของ",
      },
    });

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">IoT · มิเตอร์ไฟรายห้อง {METERS.length} จุด</span>
          <h2>ค่าไฟ &amp; เซ็นเซอร์</h2>
        </div>
      </div>

      <p className="owner-note">
        บิลค่าไฟบอกได้แค่ยอดรวมตอนสิ้นเดือน — มิเตอร์รายห้องบอกได้ว่าห้องไหน และบอกได้ตั้งแต่คืนที่สอง
      </p>

      <div className="kpis">
        <div className="kpi" style={{ cursor: "default" }}>
          <span className="k">ใช้ไฟเมื่อคืน</span>
          <div className="n">{total.toFixed(1)}</div>
          <span className="sub">kWh · ประมาณ {money(total * RATE)}</span>
        </div>
        <div className="kpi" style={{ cursor: "default" }}>
          <span className="k">เฉลี่ยต่อห้อง</span>
          <div className="n">{(total / METERS.length).toFixed(1)}</div>
          <span className="sub">kWh · เกณฑ์ปกติ {NORMAL} kWh</span>
        </div>
        <div className="kpi accent" style={{ cursor: "default" }}>
          <span className="k">ห้องผิดปกติ</span>
          <div className="n">{worst.room}</div>
          <span className="sub">
            +{overPct}% จากเกณฑ์
          </span>
        </div>
        <div className="kpi" style={{ cursor: "default" }}>
          <span className="k">ถ้าปล่อยไว้ทั้งเดือน</span>
          <div className="n">{money(wasted * RATE * 30)}</div>
          <span className="sub">ส่วนเกินของห้องเดียว</span>
        </div>
      </div>

      <div className="chart">
        <div className="chart-head">
          <h4>ค่าไฟรายห้อง · เมื่อคืน</h4>
          <span className="chart-legend">
            <span>
              <i style={{ background: "var(--n700)" }} />
              ปกติ
            </span>
            <span>
              <i style={{ background: "var(--accent)" }} />
              เกินเกณฑ์
            </span>
          </span>
        </div>
        <div className="bars">
          {METERS.map((m) => {
            const over = m.kwh > NORMAL * 1.2;
            return (
              <div key={m.room} className="bar" title={`ห้อง ${m.room} · ${m.kwh} kWh`}>
                <span className="stack">
                  <span
                    className={over ? "seg-rooms" : "seg-fnb"}
                    style={{ height: `${(m.kwh / peak) * 100}%` }}
                  />
                </span>
                <span className="lbl">{m.room}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ainote">
        <Icon name="sparkle" size={16} className="ic" />
        <span>
          <strong>ห้อง {worst.room}</strong> — ใช้ไฟ {worst.kwh} kWh สูงกว่าห้องแบบเดียวกัน{" "}
          {overPct}% ต่อเนื่อง {worst.nights ?? 3} คืน · ระบบเอาไปรวมกับที่แม่บ้านแจ้งว่า
          “ลมไม่เย็น” แล้วสรุปว่าน่าจะเป็นแอร์ ไม่ใช่แขกเปิดทิ้ง
        </span>
      </div>

      {wo ? (
        <div className="audit">
          <div className="row">
            <strong style={{ fontFamily: "var(--font)" }}>{wo.id}</strong> · ห้อง {wo.room} —{" "}
            {wo.label}
            <span className="stamp">
              {wo.status === "done"
                ? `ช่างปิดงานแล้ว · ต้นทุนซ่อม ${money(wo.cost)} เข้ารายงานเดือน`
                : wo.status === "paused"
                  ? "ช่างพักงานรออะไหล่ — ห้องยังขายไม่ได้"
                  : wo.status === "doing"
                    ? "ช่างรับงานแล้ว กำลังซ่อม"
                    : "อยู่ในคิวช่างแล้ว รอรับงาน"}
              {" · แจ้งโดย "}
              {wo.from}
            </span>
          </div>
        </div>
      ) : (
        <button className="btn primary" style={{ alignSelf: "flex-start" }} onClick={orderTech}>
          <Icon name="shield" size={16} />
          สั่งช่างตรวจห้อง {worst.room}
        </button>
      )}

      <p className="owner-note">
        เซ็นเซอร์ไม่ได้แค่เตือน — กดปุ่มเดียวใบงานวิ่งเข้ามือถือช่างทันที ช่างถ่ายรูปก่อน–หลัง
        ปิดงานแล้วห้องเข้าคิวแม่บ้านเอง และต้นทุนซ่อมเข้ารายงานเดือนโดยไม่มีใครต้องจด
      </p>

      {/* ── ระบบแจ้งเหตุเพลิงไหม้ ──────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">Fire Alarm System · {FIRE_DEVICES.length} จุด</span>
        <h3>สถานะอุปกรณ์แจ้งเหตุทุกตัว</h3>

        {/* ข้อนี้ต้องพูดก่อนอย่างอื่น ไม่ใช่หมายเหตุท้ายจอ —
            ถ้าลูกค้าเข้าใจว่าชีวิตคนแขวนอยู่กับ PMS แล้วเราไม่แก้ ถือว่าเราผิด */}
        <div className="led-callout bad">
          <Icon name="shield" />
          <span>
            <b>ระบบแจ้งเหตุเพลิงไหม้ทำงานแยกจาก PMS โดยสิ้นเชิง</b> — เป็นระบบที่ผ่าน
            การรับรองและต้องดังได้แม้ไฟดับ เน็ตหลุด หรือ PMS ล่ม · จอนี้{" "}
            <b>อ่านสถานะมาแสดงเท่านั้น สั่งการอะไรไม่ได้</b> สิ่งที่เพิ่มเข้ามาคือ
            รู้ว่าโซนที่มีเหตุมีใครพักอยู่บ้าง ซึ่งเป็นตัวเลขที่ต้องรู้ทันทีตอนอพยพ
          </span>
        </div>

        <ul className="sec-devices">
          {FIRE_DEVICES.map((d) => {
            const occ = ZONE_OCCUPANCY[d.zone];
            const label =
              d.status === "ok" ? "ปกติ" : d.status === "fault" ? "ต้องแก้" : "เลยกำหนดทดสอบ";
            return (
              <li key={d.id} className={d.status === "ok" ? "ok" : "no"}>
                <div style={{ padding: "10px 14px", display: "grid",
                              gridTemplateColumns: "1fr auto", gap: "4px 12px",
                              alignItems: "center" }}>
                  <span className="sec-dev">
                    <b>{d.zone}</b>
                    <span className="sec-meta">
                      {FIRE_KIND[d.kind]} · {d.id}
                      {d.battery !== null && ` · แบตเตอรี่ ${d.battery}%`}
                      {" · ทดสอบล่าสุด "}
                      {d.testedOn}
                    </span>
                    {occ && (
                      <span className="sec-meta">
                        โซนนี้มีคนพัก <b>{occ.guests} คน</b> · ห้อง {occ.rooms.join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className={`led-badge ${d.status === "ok" ? "ok" : "bad"}`}>{label}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="owner-note">
          ต้องทดสอบอย่างน้อยทุก {FIRE_TEST_DAYS} วัน — จุดที่เลยกำหนดขึ้นเป็นสีแดง
          เหมือนอุปกรณ์เสีย เพราะ <b>เครื่องที่ไม่เคยถูกทดสอบ กับเครื่องที่เสีย
          เชื่อถือได้เท่ากันคือไม่ได้เลย</b>
        </p>
      </section>
    </>
  );
}

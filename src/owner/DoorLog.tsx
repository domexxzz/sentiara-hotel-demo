import { useHotel } from "../contexts";
import { Icon, type IconName } from "../components/Icon";

const KIND: Record<string, { label: string; cls: string; icon: IconName }> = {
  issue: { label: "ออกบัตรที่เคาน์เตอร์", cls: "wait", icon: "key" },
  enter: { label: "เข้าห้องสำเร็จ", cls: "ok", icon: "check" },
  denied: { label: "ปฏิเสธ · บัตรหมดอายุ", cls: "warn", icon: "shield" },
  expire: { label: "บัตรหมดอายุอัตโนมัติ", cls: "wait", icon: "back" },
  staff: { label: "บัตรพนักงาน", cls: "wait", icon: "users" },
};

export function DoorLog() {
  const hotel = useHotel();
  const events = hotel.state.cardEvents;

  // ห้องที่มีแขกพักอยู่ = แตะบัตรแล้วเข้าได้ · ห้องที่เพิ่งเช็กเอาท์ = บัตรหมดอายุแล้ว
  const occupied = hotel.state.rooms.filter((r) => r.status === "occupied").slice(0, 3);
  const justOut = hotel.state.rooms.filter((r) => r.status === "dirty").slice(0, 2);
  const denied = events.filter((e) => e.kind === "denied").length;

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">ประตู &amp; บัตร · ทุกการแตะมีบันทึก</span>
          <h2>บันทึกการเข้าห้อง</h2>
        </div>
      </div>

      <p className="owner-note">
        รหัสห้องอยู่ในบัตร ประตูอ่านเองได้แม้เน็ตล่ม — แต่ทุกครั้งที่แตะ ระบบเก็บบันทึกไว้
        ของหายเมื่อไรจึงย้อนดูได้ว่าใครเข้าเวลาไหน ไม่ต้องเถียงกัน
      </p>

      <div className="kpis">
        <div className="kpi" style={{ cursor: "default" }}>
          <span className="k">บันทึกวันนี้</span>
          <div className="n">{events.length}</div>
          <span className="sub">ครั้งที่มีการแตะบัตร</span>
        </div>
        <div className="kpi" style={{ cursor: "default" }}>
          <span className="k">ถูกปฏิเสธ</span>
          <div className="n">{denied}</div>
          <span className="sub">บัตรหมดอายุ / ไม่มีสิทธิ์</span>
        </div>
        <div className="kpi" style={{ cursor: "default" }}>
          <span className="k">ประตูที่เชื่อมอยู่</span>
          <div className="n">{hotel.state.rooms.length}</div>
          <span className="sub">อ่านบัตรได้เองแม้เน็ตล่ม</span>
        </div>
      </div>

      <div className="k" style={{ color: "var(--muted)" }}>
        ลองแตะบัตรดู — ห้องที่มีแขกจะเข้าได้ ห้องที่เช็กเอาท์ไปแล้วประตูจะปฏิเสธเอง
      </div>
      <div className="pickgrid">
        {occupied.map((r) => (
          <button
            key={r.no}
            className="pick"
            onClick={() =>
              hotel.dispatch({ type: "CARD_TAP", room: r.no, who: r.guest ?? "แขก" })
            }
          >
            <div className="no">{r.no}</div>
            <div className="ty">{r.guest}</div>
            <div style={{ fontSize: 10.5, color: "#1f7a4d", marginTop: 4 }}>บัตรยังใช้ได้</div>
          </button>
        ))}
        {justOut.map((r) => (
          <button
            key={r.no}
            className="pick"
            onClick={() =>
              hotel.dispatch({
                type: "CARD_TAP",
                room: r.no,
                who: "บัตรของแขกที่เช็กเอาท์แล้ว",
              })
            }
          >
            <div className="no">{r.no}</div>
            <div className="ty">เพิ่งเช็กเอาท์</div>
            <div style={{ fontSize: 10.5, color: "var(--accent-700)", marginTop: 4 }}>
              บัตรหมดอายุแล้ว
            </div>
          </button>
        ))}
        <button
          className="pick"
          onClick={() =>
            hotel.dispatch({
              type: "CARD_TAP",
              room: "—",
              who: "สมศรี (แม่บ้าน)",
              staff: true,
            })
          }
        >
          <div className="no">พนง.</div>
          <div className="ty">บัตรพนักงาน</div>
          <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 4 }}>
            ใบเดียวกับที่ใช้ลงเวลา
          </div>
        </button>
      </div>

      <div className="k" style={{ color: "var(--muted)" }}>รายการล่าสุดอยู่บนสุด</div>
      <div className="audit">
        {events.map((e) => {
          const k = KIND[e.kind];
          return (
            <div
              key={e.id}
              className="row"
              style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
            >
              <Icon
                name={k.icon}
                size={16}
                style={{
                  flex: "none",
                  marginTop: 2,
                  color: e.kind === "denied" ? "var(--accent)" : "var(--muted)",
                }}
              />
              <span style={{ flex: 1 }}>
                <strong style={{ fontFamily: "var(--font)" }}>
                  {e.room === "—" ? "พื้นที่พนักงาน" : `ห้อง ${e.room}`}
                </strong>{" "}
                · {e.who}
                <span className="stamp">
                  {e.at} · {k.label}
                  {e.note ? ` — ${e.note}` : ""}
                </span>
              </span>
              <span className={`st-tag ${k.cls}`} style={{ flex: "none" }}>
                {e.kind === "denied" ? "ปฏิเสธ" : e.kind === "issue" ? "ออกบัตร" : "ผ่าน"}
              </span>
            </div>
          );
        })}
      </div>

      <p className="owner-note">
        บัตรหมดอายุเองตอนเช็กเอาท์ — ไม่ต้องไล่เก็บกุญแจ · บัตรหาย ยกเลิกใบเดิมแล้วเขียนใบใหม่ที่เคาน์เตอร์ใน
        10 วินาที ไม่ต้องเปลี่ยนลูกบิด
      </p>
    </>
  );
}

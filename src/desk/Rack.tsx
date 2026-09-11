import { STATUS_LABEL, type RoomStatus } from "./deskData";
import { useDesk, useHotel } from "../contexts";
import { money } from "../lib/format";
import { fmtRangeShort, nightsBetween } from "../lib/date";
import { stayTotal } from "../lib/rates";
import { Icon } from "../components/Icon";

const LEGEND: { s: RoomStatus; color: string }[] = [
  { s: "ready", color: "#2f9e63" },
  { s: "arriving", color: "#ec3013" },
  { s: "occupied", color: "#201e1d" },
  { s: "dirty", color: "#d68a1e" },
  { s: "ooo", color: "#9b9797" },
];

const SOURCE_LABEL: Record<string, string> = {
  direct: "จองตรงผ่านเว็บ",
  walkin: "Walk-in",
  ota: "OTA",
  line: "LINE OA",
};

export function Rack() {
  const { state: desk, dispatch } = useDesk();
  const hotel = useHotel();
  const { state, arrivals, inHouse, stats, billTotal } = hotel;

  // ค้นหาได้ทั้งชื่อแขก เลขที่จอง และเลขห้อง
  const q = desk.query.trim().toLowerCase();
  const match = (...fields: (string | undefined)[]) =>
    !q || fields.some((f) => (f ?? "").toLowerCase().includes(q));
  const shownArrivals = arrivals.filter((a) => match(a.guest, a.id, a.room, a.roomType));
  const shownInHouse = inHouse.filter((b) => match(b.guest, b.id, b.room, b.roomType));
  const shownRooms = state.rooms.filter((r) => match(r.no, r.guest, r.type));

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">ผังห้องวันนี้ · 14 ส.ค. 2026</span>
          <h2>หน้าเคาน์เตอร์</h2>
        </div>
        <div className="spacer" />
        <label className="desk-search">
          <Icon name="qr" size={15} />
          <input
            value={desk.query}
            onChange={(e) => dispatch({ type: "QUERY", q: e.target.value })}
            placeholder="ค้นหาชื่อแขก · เลขที่จอง · เลขห้อง"
          />
          {desk.query && (
            <button onClick={() => dispatch({ type: "QUERY", q: "" })} aria-label="ล้างคำค้น">
              ✕
            </button>
          )}
        </label>
        <button className="btn dark" onClick={() => dispatch({ type: "VIEW", view: "walkin" })}>
          <Icon name="plus" size={16} />
          Walk-in · จองใหม่จบใน 6 ขั้น
        </button>
      </div>

      <div className="stats">
        <div className="accent">
          <span className="k">เข้าพักคืนนี้</span>
          <div className="n">{stats.occupancy}%</div>
          <span className="sub">ขายได้ {stats.sold} ห้อง</span>
        </div>
        <div>
          <span className="k">พร้อมขายทันที</span>
          <div className="n">{stats.ready}</div>
          <span className="sub">ห้องว่างสะอาดแล้ว</span>
        </div>
        <div>
          <span className="k">รอแม่บ้าน</span>
          <div className="n">{stats.dirty}</div>
          <span className="sub">คาดเสร็จทั้งหมด 13:45</span>
        </div>
        <div>
          <span className="k">รอเช็กอิน</span>
          <div className="n">{arrivals.length}</div>
          <span className="sub">แขกมาถึงวันนี้</span>
        </div>
      </div>

      {shownArrivals.length > 0 && (
        <>
          <div className="k" style={{ color: "var(--muted)" }}>
            แขกมาถึงวันนี้ · กดเพื่อเช็กอิน
          </div>
          <div>
            {shownArrivals.map((a) => {
              const nights = Math.max(1, nightsBetween(a.checkIn, a.checkOut));
              const total = stayTotal(a.rate, a.checkIn, a.checkOut);
              return (
                <div key={a.id} className="arr">
                  <div className="who">
                    <strong>{a.guest}</strong>
                    <div className="meta">
                      #{a.id} · {a.roomType} · {fmtRangeShort(a.checkIn, a.checkOut)} · {nights} คืน
                      · {a.adults + a.children} ท่าน
                      {a.room ? ` · ห้อง ${a.room}` : " · ยังไม่ระบุห้อง"}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span className="flag ok">
                        <Icon name="check" size={12} />
                        {SOURCE_LABEL[a.source] ?? a.source}
                      </span>
                      {a.foreign && (
                        <span className="flag">
                          <Icon name="shield" size={12} />
                          ตม.30
                        </span>
                      )}
                      {a.deposit > 0 && (
                        <span className="flag ok">
                          <Icon name="check" size={12} />
                          มัดจำรับแล้ว
                        </span>
                      )}
                      {a.note && (
                        <span style={{ fontSize: 11, color: "var(--faint)", alignSelf: "center" }}>
                          {a.note}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="amt">
                    <div className="n">{money(total)}</div>
                    <span className="sub">
                      {a.deposit > 0 ? `ค้าง ${money(total - a.deposit)}` : "ยังไม่ชำระ"}
                    </span>
                  </div>
                  <button
                    className="btn ghost sm"
                    onClick={() => dispatch({ type: "START_MANAGE", booking: a })}
                  >
                    จัดการ
                  </button>
                  <button
                    className="btn ghost sm"
                    onClick={() => dispatch({ type: "START_MANAGE", booking: a })}
                  >
                    จัดการ
                  </button>
                  <button
                    className="btn primary sm"
                    onClick={() => dispatch({ type: "START_CHECKIN", booking: a })}
                  >
                    เช็กอิน
                    <Icon name="chevron" size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {shownInHouse.length > 0 && (
        <>
          <div className="k" style={{ color: "var(--muted)" }}>
            แขกที่พักอยู่ · บิลเปิดค้างไว้
          </div>
          <div>
            {shownInHouse.map((b) => (
              <div key={b.id} className="arr">
                <div className="who">
                  <strong>{b.guest}</strong>
                  <div className="meta">
                    ห้อง {b.room} · {b.roomType} · ออก {fmtRangeShort(b.checkOut, b.checkOut).split("–").pop()}
                    {" "}· ทุกรายการวิ่งเข้าบิลเอง
                  </div>
                </div>
                <div className="amt">
                  <div className="n">{money(billTotal(b.room ?? ""))}</div>
                  <span className="sub">ยอดสะสม</span>
                </div>
                <button
                  className="btn ghost sm"
                  onClick={() => dispatch({ type: "START_MANAGE", booking: b })}
                >
                  จัดการ
                </button>
                <button
                  className="btn ghost sm"
                  onClick={() => dispatch({ type: "START_MANAGE", booking: b })}
                >
                  จัดการ
                </button>
                <button
                  className="btn dark sm"
                  onClick={() => dispatch({ type: "START_CHECKOUT", room: b.room ?? "" })}
                >
                  ปิดบิล · เช็กเอาท์
                  <Icon name="chevron" size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="k" style={{ color: "var(--muted)" }}>
        ผังห้องสด · อัปเดตเองจากงานแม่บ้านและช่าง
        {q && ` · ตรงกับคำค้น ${shownRooms.length} ห้อง`}
      </div>
      <div className="legend">
        {LEGEND.map((l) => (
          <span key={l.s}>
            <i style={{ background: l.color }} />
            {STATUS_LABEL[l.s]}
          </span>
        ))}
      </div>
      <div className="rack">
        {shownRooms.map((r) => (
          <div key={r.no} className={`rcell ${r.status}`}>
            <div className="no">{r.no}</div>
            <div className="ty">{r.type}</div>
            <div className="st">{STATUS_LABEL[r.status]}</div>
            <div className="gz">{r.guest ?? r.note ?? "—"}</div>
          </div>
        ))}
      </div>
    </>
  );
}

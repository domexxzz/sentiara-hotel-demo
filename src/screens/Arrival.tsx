import { GUEST, HOTEL, money } from "../data";
import { fmtRange } from "../lib/date";
import { useBooking } from "../store";
import { Rail } from "../components/PhoneFrame";
import { Icon } from "../components/Icon";

export function Arrival() {
  const { state, dispatch, arrive, nights, depositAmount, nightsTotal } = useBooking();
  const room = state.room;
  if (!room) return null;

  const steps = [
    {
      done: true,
      icon: "check" as const,
      title: "จองสำเร็จ · มัดจำรับแล้ว",
      body: `${money(depositAmount)} · ใบเสร็จส่งเข้า LINE แล้ว`,
    },
    {
      done: true,
      icon: "calendar" as const,
      title: "ระบบเปิดงานให้อัตโนมัติ",
      body: "ปฏิทินปิดห้อง · บิลห้องถูกเปิด · แม่บ้านได้คิวเตรียมห้อง — ไม่มีใครคีย์ซ้ำ",
    },
    {
      done: false,
      icon: "users" as const,
      title: "กรอกข้อมูลล่วงหน้า",
      body: "เช็กอินไวขึ้น ไม่ต้องกรอกที่เคาน์เตอร์",
    },
    {
      done: false,
      icon: "key" as const,
      title: "รับบัตร NFC วันเช็กอิน",
      body: "ระบบเขียนรหัสห้องลงบัตร 10 วินาที แตะเข้าห้องได้เลย",
    },
  ];

  return (
    <>
      <header className="appbar">
        <div className="brand">
          <span className="k">ยืนยันแล้ว</span>
          <strong>{HOTEL.name}</strong>
        </div>
      </header>
      <Rail active={2} />

      <div className="body fade" style={{ padding: 0 }}>
        <div className="hero-ok">
          <div className="badge">
            <Icon name="check" size={26} />
          </div>
          <h2>จองสำเร็จ ขอบคุณครับ</h2>
          <span className="no">เลขที่ #{state.bookingNo}</span>
          {state.allocation && (
            <div className={`alloc ${state.allocation.includes("คนละชั้น") ? "warn" : "ok"}`}>
              <Icon name={state.allocation.includes("คนละชั้น") ? "pin" : "check"} size={15} />
              <span>{state.allocation}</span>
            </div>
          )}
        </div>

        <div style={{ padding: "16px 16px 4px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card pad">
            <div className="sumline" style={{ paddingTop: 0 }}>
              <span className="lbl">ผู้เข้าพัก</span>
              <span className="v" style={{ fontFamily: "var(--th)" }}>
                {GUEST.name} · {state.adults + state.children} ท่าน
              </span>
            </div>
            <div className="sumline">
              <span className="lbl">ห้อง</span>
              <span className="v" style={{ fontFamily: "var(--th)" }}>
                {room.name}
              </span>
            </div>
            <div className="sumline">
              <span className="lbl">เข้าพัก</span>
              <span className="v" style={{ fontFamily: "var(--th)" }}>
                {fmtRange(state.checkIn, state.checkOut)} · {nights} คืน
              </span>
            </div>
          </div>

          <div className="seclabel k">สิ่งที่ระบบทำให้แล้ว</div>
          <div className="timeline card pad">
            {steps.map((s, i) => (
              <div key={i} className={`tl ${s.done ? "done" : ""}`}>
                <div className="rail2">
                  <span className="dot">
                    <Icon name={s.icon} size={14} />
                  </span>
                  <span className="line" />
                </div>
                <div className="content">
                  <strong>{s.title}</strong>
                  <p>{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="nfc">
            <Icon name="key" size={26} className="ic" />
            <div>
              <strong>บัตร NFC เตรียมไว้แล้ว</strong>
              <p>คืนบัตรที่กล่องหน้าเคาน์เตอร์ตอนออก — บัตรหมดอายุเอง 12:00</p>
            </div>
          </div>
        </div>
      </div>

      <div className="foot">
        <div className="row">
          <span className="lbl">เก็บวันเช็กเอาท์</span>
          <span className="amt">{money(nightsTotal - depositAmount)}</span>
        </div>
        <button
          className="btn ghost block"
          style={{ marginBottom: 9 }}
          onClick={() => dispatch({ type: "GOTO", step: "manage" })}
        >
          <Icon name="calendar" size={16} />
          จัดการการจอง — เลื่อนวัน · เปลี่ยนคน · ยกเลิก
        </button>
        <button className="btn line block" onClick={arrive}>
          <Icon name="chat" size={17} />
          เช็กอินและเข้าห้อง · แชตกับโรงแรม
        </button>
      </div>
    </>
  );
}

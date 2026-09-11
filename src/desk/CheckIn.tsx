import { useState } from "react";
import { useDesk, useHotel } from "../contexts";
import { IdScan, NfcWrite, type ScannedId } from "./steps";
import { money } from "../lib/format";
import { fmtRange, nightsBetween } from "../lib/date";
import { stayTotal } from "../lib/rates";
import { Icon } from "../components/Icon";

const STEPS = ["ยืนยันการจอง", "ยืนยันตัวตน", "ยืนยันห้อง", "ออกบัตร NFC"];

export function CheckIn() {
  const { state, dispatch } = useDesk();
  const hotel = useHotel();
  const guest = state.active;

  const [step, setStep] = useState(0);
  const [scanned, setScanned] = useState<ScannedId | null>(null);
  const [room, setRoom] = useState(guest?.room ?? "");
  const [carded, setCarded] = useState(false);

  if (!guest) return null;

  const nights = Math.max(1, nightsBetween(guest.checkIn, guest.checkOut));
  const total = stayTotal(guest.rate, guest.checkIn, guest.checkOut);
  const options = hotel
    .availableRooms(guest.checkIn, guest.checkOut, undefined, guest.id)
    .filter((r) => r.status === "ready" || r.no === guest.room);
  const canNext =
    step === 0 ||
    (step === 1 && !!scanned) ||
    (step === 2 && !!room) ||
    (step === 3 && carded);

  const next = () => {
    if (step < 3) return setStep(step + 1);
    hotel.dispatch({ type: "CHECK_IN", bookingId: guest.id, room });
    if (guest.foreign) dispatch({ type: "TM30", guest: guest.guest });
    dispatch({
      type: "TOAST",
      text: `เช็กอิน ${guest.guest} · ห้อง ${room} สำเร็จ — บัตร NFC ออกแล้ว บิลห้องเปิดอัตโนมัติ`,
    });
    if (guest.foreign) {
      dispatch({
        type: "TOAST",
        text: `ตม.30 ของ ${guest.guest} เตรียมแบบให้แล้ว · ยืนยันส่งภายใน 24 ชม.`,
      });
    }
    dispatch({ type: "DONE" });
  };

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">เช็กอิน · #{guest.id}</span>
          <h2>{guest.guest}</h2>
        </div>
        <div className="spacer" />
        <button className="btn ghost sm" onClick={() => dispatch({ type: "DONE" })}>
          <Icon name="back" size={14} />
          กลับผังห้อง
        </button>
      </div>

      <div className="steps">
        {STEPS.map((s, i) => (
          <div key={s} className={i === step ? "on" : i < step ? "past" : ""}>
            <span className="n">ขั้น {i + 1}</span>
            {s}
          </div>
        ))}
      </div>

      <div className="panel">
        {step === 0 && (
          <>
            <h3>ยืนยันรายละเอียดการจอง</h3>
            <p className="lead">
              ดึงจากปฏิทินสด — ข้อมูลชุดเดียวกับที่แขกจองมาเอง ไม่มีใครคีย์ซ้ำ
            </p>
            <div className="bill">
              <div className="r">
                <span>
                  ช่วงเข้าพัก
                  <span className="sub">
                    {nights} คืน · {guest.adults} ผู้ใหญ่
                    {guest.children ? ` · ${guest.children} เด็ก` : ""}
                  </span>
                </span>
                <span className="v">{fmtRange(guest.checkIn, guest.checkOut)}</span>
              </div>
              <div className="r">
                <span>
                  ประเภทห้อง
                  <span className="sub">{money(guest.rate)} /คืน</span>
                </span>
                <span className="v">{guest.roomType}</span>
              </div>
              <div className="r">
                <span>ยอดทั้งหมด</span>
                <span className="v">{money(total)}</span>
              </div>
              <div className="r credit">
                <span>
                  มัดจำรับแล้ว
                  <span className="sub">{guest.note}</span>
                </span>
                <span className="v">− {money(guest.deposit)}</span>
              </div>
              <div className="r total">
                <span>เก็บวันเช็กเอาท์</span>
                <span className="v">{money(total - guest.deposit)}</span>
              </div>
            </div>
            {guest.foreign && (
              <div className="flag" style={{ alignSelf: "flex-start" }}>
                <Icon name="shield" size={13} />
                แขกต่างชาติ — ระบบจะเตือนยื่น ตม.30 ภายใน 24 ชม.
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h3>ยืนยันตัวตนแขก</h3>
            <p className="lead">
              กฎหมายโรงแรมกำหนดให้บันทึกผู้เข้าพักทุกคน — ระบบเก็บให้ครบตั้งแต่ตอนสแกน
            </p>
            <IdScan foreign={guest.foreign} scanned={scanned} onScanned={setScanned} />
          </>
        )}

        {step === 2 && (
          <>
            <h3>เลือกห้องให้แขก</h3>
            <p className="lead">
              แสดงเฉพาะห้องที่แม่บ้านกดผ่านแล้ว — ห้องรอทำความสะอาดจะไม่โผล่ให้เลือก
            </p>
            <div className="pickgrid">
              {options.map((r) => (
                <button
                  key={r.no}
                  className={`pick ${room === r.no ? "on" : ""}`}
                  onClick={() => setRoom(r.no)}
                >
                  <div className="no">{r.no}</div>
                  <div className="ty">{r.type}</div>
                  {r.no === guest.room && (
                    <div style={{ fontSize: 10.5, color: "var(--accent-700)", marginTop: 4 }}>
                      ห้องที่จองไว้
                    </div>
                  )}
                  {r.type !== guest.roomType && r.no !== guest.room && (
                    <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 4 }}>
                      คนละประเภท
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3>ออกบัตรเข้าห้อง</h3>
            <p className="lead">
              บัตร NFC ใบเดียวใช้เข้าห้องและขึ้นลิฟต์ · ประตูอ่านบัตรได้เองแม้เน็ตล่ม
            </p>
            <NfcWrite room={room} done={carded} onDone={() => setCarded(true)} />
          </>
        )}

        <div className="wizfoot">
          {step > 0 && (
            <button className="btn ghost" onClick={() => setStep(step - 1)}>
              <Icon name="back" size={15} />
              ย้อนกลับ
            </button>
          )}
          <div className="spacer" />
          <button className="btn primary" onClick={next} disabled={!canNext}>
            {step === 3 ? "เช็กอินเสร็จสิ้น" : "ถัดไป"}
            <Icon name={step === 3 ? "check" : "chevron"} size={15} />
          </button>
        </div>
      </div>
    </>
  );
}

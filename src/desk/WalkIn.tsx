import { useState } from "react";
import { WALKIN_RATES, money } from "./deskData";
import { useDesk, useHotel } from "../contexts";
import { TODAY, addDays } from "../lib/date";
import { stayTotal, weekendNights } from "../lib/rates";
import { IdScan, NfcWrite, type ScannedId } from "./steps";
import { WALKIN_ID } from "./scannedIds";
import { Icon } from "../components/Icon";
import { QrCode } from "../components/QrCode";

const STEPS = [
  "วันที่ & ผู้เข้าพัก",
  "สแกนบัตร ปชช.",
  "เลือกห้อง",
  "ราคา",
  "รับชำระ",
  "ออกบัตร NFC",
];

export function WalkIn() {
  const { dispatch } = useDesk();
  const hotel = useHotel();
  const [step, setStep] = useState(0);
  const [nights, setNights] = useState(1);
  const [pax, setPax] = useState(2);
  const [scanned, setScanned] = useState<ScannedId | null>(null);
  const [rateId, setRateId] = useState("");
  const [room, setRoom] = useState("");
  const [paid, setPaid] = useState(false);
  const [carded, setCarded] = useState(false);

  const rate = WALKIN_RATES.find((r) => r.id === rateId);
  const total = rate ? stayTotal(rate.rate, TODAY, addDays(TODAY, nights)) : 0;
  const wknd = weekendNights(TODAY, addDays(TODAY, nights));
  // ต้องว่างตลอดช่วงที่จะพัก ไม่ใช่แค่ว่างคืนนี้ — กันจองชนกับคนที่จองล่วงหน้าไว้
  const readyRooms = hotel
    .availableRooms(TODAY, addDays(TODAY, nights), rate?.name)
    .filter((r) => r.status === "ready");

  const canNext =
    step === 0 ||
    (step === 1 && !!scanned) ||
    (step === 2 && !!room) ||
    (step === 3 && !!rate) ||
    (step === 4 && paid) ||
    (step === 5 && carded);

  const next = () => {
    if (step < 5) return setStep(step + 1);
    const id = "W-" + room + nights;
    const guest = scanned?.name ?? "แขก Walk-in";
    hotel.dispatch({
      type: "CREATE_BOOKING",
      booking: {
        id,
        guest,
        roomType: rate?.name ?? "",
        room,
        checkIn: TODAY,
        checkOut: addDays(TODAY, nights),
        adults: pax,
        children: 0,
        rate: rate?.rate ?? 0,
        deposit: total,
        source: "walkin",
        note: "Walk-in · รับชำระเต็มจำนวนแล้ว",
      },
    });
    hotel.dispatch({ type: "CHECK_IN", bookingId: id, room });
    dispatch({
      type: "TOAST",
      text: `Walk-in ${guest} · ห้อง ${room} — รับชำระและออกบัตรเรียบร้อย บิลห้องเปิดแล้ว`,
    });
    dispatch({ type: "DONE" });
  };

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">Walk-in · 6 ขั้น · ขั้นที่ {step + 1}</span>
          <h2>จองใหม่ที่เคาน์เตอร์</h2>
        </div>
        <div className="spacer" />
        <button
          className="btn ghost sm"
          onClick={() => dispatch({ type: "DONE" })}
        >
          <Icon name="back" size={14} />
          ยกเลิก
        </button>
      </div>

      <div className="steps">
        {STEPS.map((s, i) => (
          <div key={s} className={i === step ? "on" : i < step ? "past" : ""}>
            <span className="n">{i + 1}</span>
            {s}
          </div>
        ))}
      </div>

      <div className="panel">
        {step === 0 && (
          <>
            <h3>แขกจะพักกี่คืน กี่ท่าน</h3>
            <p className="lead">
              ทุกขั้นบันทึกอัตโนมัติ — เน็ตหลุดกลางทางก็กลับมาทำต่อจากเดิมได้
            </p>
            <div className="fieldrow">
              <div className="field">
                <label>เช็กอิน</label>
                <input value="14 ส.ค. 2026 (วันนี้)" disabled />
              </div>
              <div className="field">
                <label>จำนวนคืน</label>
                <select
                  value={nights}
                  onChange={(e) => setNights(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} คืน
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>ผู้เข้าพัก</label>
                <select value={pax} onChange={(e) => setPax(Number(e.target.value))}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} ท่าน
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h3>ยืนยันตัวตนแขก</h3>
            <p className="lead">ขั้นถัดไป · สแกนบัตร ปชช. — ข้อมูลเข้าระบบเองทั้งชุด</p>
            <IdScan identity={WALKIN_ID} scanned={scanned} onScanned={setScanned} />
          </>
        )}

        {step === 2 && (
          <>
            <h3>เลือกประเภทและห้อง</h3>
            <p className="lead">
              ดึงจากปฏิทินสด — ไม่ใช่รายการห้องทั้งหมด จึงขายห้องซ้ำไม่ได้
            </p>
            <div className="pickgrid">
              {WALKIN_RATES.map((r) => {
                // ต้องนับด้วยเกณฑ์เดียวกับลิสต์ห้องข้างล่าง ไม่งั้นตัวเลขจะขัดกันเอง
                const free = hotel
                  .availableRooms(TODAY, addDays(TODAY, nights), r.name)
                  .filter((x) => x.status === "ready").length;
                return (
                  <button
                    key={r.id}
                    className={`pick ${rateId === r.id ? "on" : ""}`}
                    disabled={free === 0}
                    onClick={() => {
                      setRateId(r.id);
                      setRoom("");
                    }}
                  >
                    <div className="no">{money(r.rate)}</div>
                    <div className="ty">
                      {r.name} · {r.bed}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: free ? "#1f7a4d" : "var(--faint)",
                        marginTop: 4,
                      }}
                    >
                      {free ? `ว่างพร้อมขาย ${free} ห้อง` : "เต็มแล้ว"}
                      {wknd > 0 && ` · รวมคืนวันหยุด ${wknd} คืน`}
                    </div>
                  </button>
                );
              })}
            </div>
            {rate && (
              <>
                <div className="k" style={{ color: "var(--muted)" }}>
                  ห้องที่พร้อมขายตอนนี้
                </div>
                <div className="pickgrid">
                  {readyRooms.map((r) => (
                    <button
                      key={r.no}
                      className={`pick ${room === r.no ? "on" : ""}`}
                      onClick={() => setRoom(r.no)}
                    >
                      <div className="no">{r.no}</div>
                      <div className="ty">{r.type}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {step === 3 && rate && (
          <>
            <h3>สรุปราคา</h3>
            <p className="lead">
              เรตหน้าเคาน์เตอร์ — Walk-in ไม่มีส่วนลดจองตรง กฎราคาระบบบังคับให้เอง
            </p>
            <div className="bill">
              <div className="r">
                <span>
                  {rate.name} · ห้อง {room}
                  <span className="sub">
                    {money(rate.rate)} × {nights} คืน · {pax} ท่าน
                  </span>
                </span>
                <span className="v">{money(total)}</span>
              </div>
              <div className="r">
                <span>
                  ส่วนลด
                  <span className="sub">Walk-in ไม่มีส่วนลด</span>
                </span>
                <span className="v">฿0</span>
              </div>
              <div className="r total">
                <span>รวมที่ต้องชำระ</span>
                <span className="v">{money(total)}</span>
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h3>รับชำระ {money(total)}</h3>
            <p className="lead">
              ตรวจสลิปอัตโนมัติ 2 ชั้น — ยืนยันภายใน 1 นาที · ใบเสร็จออกให้เอง
            </p>
            {paid ? (
              <div className="scanner done">
                <Icon name="check" size={30} style={{ color: "#1f7a4d" }} />
                <strong style={{ fontSize: 14 }}>รับชำระครบแล้ว {money(total)}</strong>
                <p>บิลห้อง {room} เปิดแล้ว · ออกใบกำกับภาษีเต็มรูปได้ตอนปิดบิล</p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 22,
                  alignItems: "center",
                }}
              >
                <QrCode className="code" />
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div className="k" style={{ color: "var(--faint)" }}>
                      QR พร้อมเพย์
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font)",
                        fontWeight: 800,
                        fontSize: 30,
                        marginTop: 4,
                      }}
                    >
                      {money(total)}
                    </div>
                  </div>
                  <button className="btn primary" onClick={() => setPaid(true)}>
                    <Icon name="check" size={16} />
                    ยืนยันรับชำระแล้ว
                  </button>
                  <button className="btn ghost sm" onClick={() => setPaid(true)}>
                    รับเป็นเงินสดแทน
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {step === 5 && (
          <>
            <h3>ออกบัตรเข้าห้อง</h3>
            <p className="lead">
              ขั้นสุดท้าย — เขียนบัตรเสร็จ ห้อง {room} เปลี่ยนเป็น “มีแขก” ทันทีในผังห้อง
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
            {step === 5 ? "เสร็จสิ้น · กลับผังห้อง" : "ถัดไป"}
            <Icon name={step === 5 ? "check" : "chevron"} size={15} />
          </button>
        </div>
      </div>
    </>
  );
}

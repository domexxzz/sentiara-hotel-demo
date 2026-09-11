import { useState } from "react";
import { HK, SUP, TECH } from "./staffData";
import { useHotel, useStaff } from "../contexts";
import { Icon } from "../components/Icon";

type Punch = { id: string; at: string; kind: "in" | "out"; how: "gps" | "nfc" };

const WHO: Record<string, string> = {
  hk: HK.name,
  sup: SUP.name,
  tech: "ช่าง" + TECH.name,
};

/** กะมาตรฐาน — ชั่วโมงเกินจากนี้คิดเป็นโอที */
const SHIFT_HOURS = 8;
const OT_RATE = 1.5;
const WAGE = 62; // บาทต่อชั่วโมง
const NOW = "15:40";

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

export function TimeClock({ onClose }: { onClose: () => void }) {
  const { state } = useStaff();
  const hotel = useHotel();

  /** จำลองตำแหน่ง: อยู่ในโรงแรม หรืออยู่ห่างออกไป 1.2 กม. */
  const [inside, setInside] = useState(true);
  const [punches, setPunches] = useState<Punch[]>([
    { id: "p0", at: "07:02", kind: "in", how: "nfc" },
  ]);

  const last = punches[punches.length - 1];
  const clockedIn = last?.kind === "in";
  const clock = ["12:04", "13:11", "16:02", "16:48", "17:20"];

  const punch = (how: "gps" | "nfc") => {
    const next: Punch = {
      id: "p" + (punches.length + 1),
      at: clock[(punches.length - 1) % clock.length],
      kind: clockedIn ? "out" : "in",
      how,
    };
    setPunches([...punches, next]);
    if (how === "nfc") {
      hotel.dispatch({
        type: "CARD_TAP",
        room: "—",
        who: `${WHO[state.role]} · ${clockedIn ? "ออกงาน" : "เข้างาน"}`,
        staff: true,
      });
    }
  };

  // ชั่วโมงทำงานสะสม — จับคู่ เข้า/ออก
  let minutes = 0;
  for (let i = 0; i < punches.length - 1; i += 2) {
    const a = punches[i];
    const b = punches[i + 1];
    if (!b) break;
    minutes += Math.max(0, toMin(b.at) - toMin(a.at));
  }
  if (clockedIn) minutes += Math.max(0, toMin(NOW) - toMin(last.at));

  const hours = minutes / 60;
  const ot = Math.max(0, hours - SHIFT_HOURS);
  const pay = Math.round((Math.min(hours, SHIFT_HOURS) + ot * OT_RATE) * WAGE);

  return (
    <div className="body fade">
      <div className="st-sum">
        <div>
          <span className="k">ชั่วโมงวันนี้</span>
          <div className="n">{hours.toFixed(1)}</div>
        </div>
        <div>
          <span className="k">โอที</span>
          <div className="n">{ot.toFixed(1)}</div>
        </div>
        <div>
          <span className="k">ค่าแรงวันนี้</span>
          <div className="n">฿{pay.toLocaleString("en-US")}</div>
        </div>
      </div>

      <p className="st-note" style={{ margin: 0 }}>
        {WHO[state.role]} · กะเช้า 07:00–16:00 — ชั่วโมงกับโอทีคำนวณเอง เงินเดือนจ่ายจากเวลาจริง
        ไม่ต้องมีใครจดสมุด
      </p>

      <div className={`st-net ${inside ? "" : "off"}`}>
        <Icon name="pin" size={15} />
        {inside ? (
          <span>GPS ✓ อยู่ในโรงแรม (คลาดเคลื่อน 8 ม.)</span>
        ) : (
          <span>คุณอยู่ห่างจากโรงแรม 1.2 กม. — ลงเวลาจากตำแหน่งนี้ไม่ได้</span>
        )}
        <button onClick={() => setInside(!inside)}>
          {inside ? "จำลองอยู่นอกโรงแรม" : "กลับเข้าโรงแรม"}
        </button>
      </div>

      <button
        className={`bigbtn ${clockedIn ? "" : "ok"}`}
        disabled={!inside}
        onClick={() => punch("gps")}
      >
        <Icon name="pin" size={18} />
        {inside
          ? clockedIn
            ? "ลงเวลาออกงานจากมือถือ"
            : "ลงเวลาเข้างานจากมือถือ"
          : "ลงเวลาไม่ได้จากตำแหน่งนี้"}
      </button>

      <button className="bigbtn dark" onClick={() => punch("nfc")}>
        <Icon name="key" size={18} />
        แตะบัตร NFC ที่เครื่องอ่านแทน
      </button>

      <p className="st-note" style={{ margin: 0 }}>
        ถ้ามาถึงแล้วแต่ GPS เพี้ยน ให้แตะบัตรใบเดียวกับที่ใช้เข้าห้องทำงาน — โกงเวลาแทนกันไม่ได้
        เพราะบัตรอยู่กับตัวคนเดียว และทุกการแตะเข้าบันทึกที่จอเจ้าของ
      </p>

      <div className="k" style={{ color: "var(--muted)" }}>
        การลงเวลาวันนี้
      </div>
      <div>
        {[...punches].reverse().map((p) => (
          <div key={p.id} className="wo" style={{ marginBottom: 6 }}>
            <Icon name={p.how === "nfc" ? "key" : "pin"} size={16} />
            <span>
              <strong>{p.at}</strong> · {p.kind === "in" ? "เข้างาน" : "ออกงาน"} —{" "}
              {p.how === "nfc" ? "แตะบัตร NFC" : "มือถือ + GPS"}
            </span>
          </div>
        ))}
      </div>

      <button className="bigbtn" style={{ minHeight: 44 }} onClick={onClose}>
        กลับหน้างาน
      </button>
    </div>
  );
}

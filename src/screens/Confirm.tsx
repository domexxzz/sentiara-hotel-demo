import { nightlyRates } from "../lib/rates";
import { HOTEL, money, type PayMethod } from "../data";
import { useBooking } from "../contexts";
import { Rail } from "../components/PhoneFrame";
import { Icon } from "../components/Icon";
import { QrCode } from "../components/QrCode";
import { fmtLong, fmtRange } from "../lib/date";

export function Confirm() {
  const { state, dispatch, confirm, nights, nightsTotal, otaTotal, savings, depositAmount } =
    useBooking();
  const room = state.room;
  if (!room) return null;

  return (
    <>
      <header className="appbar">
        <button
          className="backbtn"
          onClick={() => dispatch({ type: "GOTO", step: "search" })}
          aria-label="ย้อนกลับ"
        >
          <Icon name="back" size={18} />
        </button>
        <div className="brand">
          <span className="k">ยืนยันการจอง</span>
          <strong>{room.name}</strong>
        </div>
      </header>
      <Rail active={1} />

      <div className="body fade">
        <div className="card pad">
          <div className="sumline" style={{ paddingTop: 0 }}>
            <span className="lbl">เข้าพัก</span>
            <span className="v" style={{ fontFamily: "var(--th)" }}>
              {fmtRange(state.checkIn, state.checkOut)}
            </span>
          </div>
          <div className="sumline">
            <span className="lbl">ผู้เข้าพัก</span>
            <span className="v" style={{ fontFamily: "var(--th)" }}>
              {state.adults} ผู้ใหญ่{state.children ? ` · ${state.children} เด็ก` : ""}
              {state.rooms > 1 ? ` · ${state.rooms} ห้อง` : ""}
            </span>
          </div>
          <div className="sumline nights">
            <span className="lbl">
              ค่าห้อง · {nights} คืน{state.rooms > 1 ? ` × ${state.rooms} ห้อง` : ""}
            </span>
            <span className="v">{money(nightsTotal)}</span>
          </div>
          <div className="nightlist">
            {nightlyRates(room.price, state.checkIn, state.checkOut).map((n) => (
              <div key={n.day} className={n.weekend ? "wknd" : ""}>
                <span>
                  {fmtLong(n.day)}
                  {n.weekend && <i>เรตวันหยุด</i>}
                  {state.rooms > 1 && <i>× {state.rooms} ห้อง</i>}
                </span>
                <span className="v">{money(n.rate * state.rooms)}</span>
              </div>
            ))}
          </div>
          <div className="sumline muted">
            <span className="lbl">ราคา OTA ปกติ</span>
            <span className="v" style={{ textDecoration: "line-through" }}>
              {money(otaTotal)}
            </span>
          </div>
          <div className="sumline credit">
            <span className="lbl">ส่วนลดจองตรง (-{HOTEL.otaGapPct}%)</span>
            <span className="v">− {money(savings)}</span>
          </div>
          <div className="sumline total">
            <span className="lbl">รวมที่ต้องชำระ</span>
            <span className="v">{money(nightsTotal)}</span>
          </div>
        </div>

        <div className="depositbox">
          <span className="k">จ่ายตอนนี้ · มัดจำ {HOTEL.depositPct}%</span>
          <div className="big">{money(depositAmount)}</div>
          <p>
            ที่เหลือ {money(nightsTotal - depositAmount)} จ่ายวันเช็กเอาท์ ·
            ใบเสร็จมัดจำส่งเข้า LINE ทันที · ใบกำกับภาษีเต็มรูปออกให้ตอนเช็กเอาท์
          </p>
        </div>

        <div className="seclabel k">เลือกวิธีชำระมัดจำ</div>
        <div className="pays">
          <PayOption
            active={state.payMethod === "qr"}
            icon="qr"
            title="QR พร้อมเพย์"
            sub="ตรวจสลิปอัตโนมัติ 2 ชั้น — ยืนยันใน 1 นาที"
            onPick={() => dispatch({ type: "SET_PAY", method: "qr" })}
          />
          <PayOption
            active={state.payMethod === "cash"}
            icon="receipt"
            title="จ่ายเงินสดที่เคาน์เตอร์"
            sub="กันห้องไว้ให้ · จ่ายวันเช็กอิน"
            onPick={() => dispatch({ type: "SET_PAY", method: "cash" })}
          />
        </div>

        {state.payMethod === "qr" && (
          <div className="card qr fade">
            <QrCode />
            <span className="cap">สแกนด้วยแอปธนาคาร · มัดจำ {money(depositAmount)}</span>
          </div>
        )}
      </div>

      <div className="foot">
        <button className="btn primary block" onClick={confirm}>
          {state.payMethod === "qr"
            ? `ชำระมัดจำ ${money(depositAmount)}`
            : "ยืนยันการจอง (จ่ายที่เคาน์เตอร์)"}
          <Icon name="check" size={16} />
        </button>
      </div>
    </>
  );
}

function PayOption({
  active,
  icon,
  title,
  sub,
  onPick,
}: {
  active: boolean;
  icon: "qr" | "receipt";
  title: string;
  sub: string;
  onPick: () => void;
}) {
  return (
    <button className={`pay ${active ? "on" : ""}`} onClick={onPick}>
      <Icon name={icon} size={22} className="ic" />
      <span className="txt">
        <strong>{title}</strong>
        <span>{sub}</span>
      </span>
      <span className="radio" />
    </button>
  );
}
export type { PayMethod };

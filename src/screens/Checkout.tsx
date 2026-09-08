import { useState } from "react";
import { GUEST, HOTEL, money } from "../data";
import { useBooking } from "../store";
import { Rail } from "../components/PhoneFrame";
import { Icon } from "../components/Icon";

export function Checkout() {
  const { state, dispatch, settle, bill, billTotal, depositAmount, balanceDue } = useBooking();
  const [paid, setPaid] = useState(false);
  const [rating, setRating] = useState(0);
  const room = state.assigned ?? GUEST.room;

  const reviewNote =
    rating === 0
      ? "ให้คะแนนการเข้าพักครั้งนี้"
      : rating >= 4
        ? "ขอบคุณครับ 🙏 เราจะขออนุญาตส่งต่อรีวิวไปที่ Google Reviews"
        : "ขอบคุณสำหรับความเห็น — ผู้จัดการจะติดต่อกลับเองก่อนครับ";

  const pay = () => {
    settle();
    setPaid(true);
  };

  return (
    <>
      <header className="appbar">
        {!paid && (
          <button
            className="backbtn"
            onClick={() => dispatch({ type: "GOTO", step: "stay" })}
            aria-label="ย้อนกลับ"
          >
            <Icon name="back" size={18} />
          </button>
        )}
        <div className="brand">
          <span className="k">{paid ? "เช็กเอาท์เรียบร้อย" : "เช็กเอาท์"}</span>
          <strong>
            ห้อง {room} · {GUEST.name}
          </strong>
        </div>
      </header>
      <Rail active={3} />

      {!paid ? (
        <>
          <div className="body fade">
            <div className="seclabel k">สรุปบิลห้อง {room}</div>
            <div className="card pad">
              {bill.map((b) => (
                <div key={b.id} className="sumline" style={{ paddingTop: 0 }}>
                  <span className="lbl">
                    {b.label}
                    {b.qty > 1 ? ` ×${b.qty}` : ""}
                    {b.note ? (
                      <span style={{ color: "var(--faint)", fontSize: 11, display: "block" }}>
                        {b.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="v">{money(b.price * b.qty)}</span>
                </div>
              ))}
              <div className="sumline">
                <span className="lbl">รวมทั้งหมด</span>
                <span className="v">{money(billTotal)}</span>
              </div>
              <div className="sumline credit">
                <span className="lbl">มัดจำที่จ่ายแล้ว ({HOTEL.depositPct}%)</span>
                <span className="v">− {money(depositAmount)}</span>
              </div>
              <div className="sumline total">
                <span className="lbl">ยอดที่ต้องชำระ</span>
                <span className="v">{money(balanceDue)}</span>
              </div>
            </div>

            <div className="nfc">
              <Icon name="key" size={24} className="ic" />
              <div>
                <strong>คืนบัตร NFC ที่กล่องหน้าเคาน์เตอร์</strong>
                <p>บัตรหมดอายุเอง 12:00 · ใบกำกับภาษีเต็มรูปออกจากบิลนี้ ส่งเข้า LINE ได้เลย</p>
              </div>
            </div>
          </div>

          <div className="foot">
            <div className="row">
              <span className="lbl">ยอดที่ต้องชำระ</span>
              <span className="amt">{money(balanceDue)}</span>
            </div>
            <button className="btn primary block" onClick={pay}>
              <Icon name="qr" size={16} />
              ชำระด้วย QR พร้อมเพย์
            </button>
          </div>
        </>
      ) : (
        <div className="body fade">
          <div className="hero-ok" style={{ margin: "-16px -16px 0" }}>
            <div className="badge">
              <Icon name="check" size={26} />
            </div>
            <h2>ชำระเรียบร้อย ขอบคุณครับ</h2>
            <span className="no">บิล #{state.bookingNo} · ปิดแล้ว</span>
          </div>

          <div className="seclabel k">การเข้าพักครั้งนี้เป็นอย่างไรบ้าง?</div>
          <div className="card pad">
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={n <= rating ? "lit" : ""}
                  onClick={() => setRating(n)}
                  aria-label={`${n} ดาว`}
                >
                  <Icon name="star" size={30} stroke={1.5} />
                </button>
              ))}
            </div>
            <p className="reviewnote">{reviewNote}</p>
          </div>

          <div className="coupon">
            <Icon name="sparkle" size={22} style={{ color: "var(--accent)" }} />
            <div className="code">SEN-{state.bookingNo}</div>
            <p>คูปองลด 15% สำหรับครั้งหน้า · บันทึกไว้ใน LINE แล้ว</p>
          </div>

          <p style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center" }}>
            ห้อง {room} เข้าคิวแม่บ้านอัตโนมัติแล้ว · แล้วพบกันใหม่ครับ · {HOTEL.name}{" "}
            {HOTEL.city}
          </p>

          <div style={{ display: "grid", placeItems: "center", paddingTop: 4 }}>
            <button className="restart" onClick={() => dispatch({ type: "RESET" })}>
              <Icon name="back" size={14} />
              เริ่มสาธิตใหม่ตั้งแต่ต้น
            </button>
          </div>
        </div>
      )}
    </>
  );
}

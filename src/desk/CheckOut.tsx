import { useState } from "react";
import { useDesk } from "./deskStore";
import { useHotel } from "../hotel/hotelStore";
import { money } from "../lib/format";
import { Icon } from "../components/Icon";
import { QrCode } from "../components/QrCode";

export function CheckOut() {
  const { state, dispatch } = useDesk();
  const hotel = useHotel();
  const [paid, setPaid] = useState(false);

  const room = state.closingRoom ?? hotel.inHouse[0]?.room ?? "";
  const booking = hotel.state.bookings.find((b) => b.room === room && b.status === "inhouse");
  const lines = hotel.billOf(room);
  const total = hotel.billTotal(room);
  const deposit = booking?.deposit ?? 0;
  const due = total - deposit;

  if (!room || lines.length === 0) {
    return (
      <>
        <div className="deskhead">
          <div>
            <span className="k">เช็กเอาท์</span>
            <h2>ไม่มีบิลที่เปิดอยู่</h2>
          </div>
          <div className="spacer" />
          <button className="btn ghost sm" onClick={() => dispatch({ type: "DONE" })}>
            <Icon name="back" size={14} />
            กลับผังห้อง
          </button>
        </div>
        <div className="panel">
          <p className="lead" style={{ margin: 0 }}>
            เลือกแขกที่พักอยู่จากผังห้องเพื่อปิดบิล — หรือเช็กอินแขกเข้ามาก่อน
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">เช็กเอาท์ · ห้อง {room}</span>
          <h2>{booking?.guest ?? hotel.state.rooms.find((r) => r.no === room)?.guest}</h2>
        </div>
        <div className="spacer" />
        <button className="btn ghost sm" onClick={() => dispatch({ type: "DONE" })}>
          <Icon name="back" size={14} />
          กลับผังห้อง
        </button>
      </div>

      <div className="panel">
        <h3>บิลห้อง {room}</h3>
        <p className="lead">
          ทุกรายการวิ่งเข้าบิลเอง — แขกกดจากแชต แม่บ้านกดจากมือถือ ร้านอาหารยิงเข้าห้อง
          ไม่มีใครต้องรวมบิลด้วยมือ
        </p>

        <div className="bill">
          {lines.map((l) => (
            <div key={l.id} className="r">
              <span>
                {l.label}
                {l.qty > 1 ? ` ×${l.qty}` : ""}
                {l.note && <span className="sub">{l.note}</span>}
              </span>
              <span className="v">{money(l.price * l.qty)}</span>
            </div>
          ))}
          <div className="r">
            <span>รวมทั้งหมด</span>
            <span className="v">{money(total)}</span>
          </div>
          <div className="r credit">
            <span>
              มัดจำ/ชำระแล้ว
              <span className="sub">รับตอนจอง</span>
            </span>
            <span className="v">− {money(deposit)}</span>
          </div>
          <div className="r total">
            <span>ยอดค้างชำระ</span>
            <span className="v">{money(due)}</span>
          </div>
        </div>

        {paid ? (
          <div className="scanner done">
            <Icon name="check" size={30} style={{ color: "#1f7a4d" }} />
            <strong style={{ fontSize: 14 }}>ปิดบิลเรียบร้อย · รับครบ {money(due)}</strong>
            <p>
              บัตร NFC หมดอายุทันที · ห้อง {room} เข้าคิวแม่บ้านเองแล้ว ·
              บิลนี้พร้อมออกใบกำกับภาษีเต็มรูปแล้ว
            </p>
            <button
              className="btn dark sm"
              onClick={() => dispatch({ type: "VIEW", view: "invoice" })}
            >
              <Icon name="receipt" size={15} />
              ออกใบกำกับภาษีของบิลนี้
            </button>
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
                  QR พร้อมเพย์ · ยอดค้าง
                </div>
                <div
                  style={{
                    fontFamily: "var(--font)",
                    fontWeight: 800,
                    fontSize: 30,
                    marginTop: 4,
                  }}
                >
                  {money(due)}
                </div>
              </div>
              <button className="btn primary" onClick={() => setPaid(true)}>
                <Icon name="check" size={16} />
                ยืนยันรับชำระแล้ว
              </button>
              <button className="btn ghost sm" onClick={() => setPaid(true)}>
                รับเป็นเงินสด / บัตรเครดิต
              </button>
            </div>
          </div>
        )}

        <div className="wizfoot">
          <div className="spacer" />
          <button
            className="btn primary"
            disabled={!paid}
            onClick={() => {
              hotel.dispatch({ type: "CHECK_OUT", room });
              dispatch({
                type: "TOAST",
                text: `ปิดบิลห้อง ${room} · ${money(total)} — ห้องเข้าคิวแม่บ้านอัตโนมัติ`,
              });
              dispatch({ type: "DONE" });
            }}
          >
            ปิดบิล · คืนห้องเข้าคิวแม่บ้าน
            <Icon name="check" size={15} />
          </button>
        </div>
      </div>
    </>
  );
}

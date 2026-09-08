import { useState } from "react";
import { useOwner } from "./ownerStore";
import { useHotel } from "../hotel/hotelStore";
import { money } from "../lib/format";
import { TODAY, addDays, fmtShort } from "../lib/date";
import {
  CAT,
  CAT_ORDER,
  breakEvenRooms,
  daysOverdue,
  pnl,
  type ExpenseCat,
} from "../lib/finance";
import { Icon } from "../components/Icon";

/**
 * รายจ่าย · กำไรขาดทุน · เงินสด · ลูกหนี้
 *
 * จอเจ้าของเดิมตอบได้แค่ "ขายได้เท่าไร" ซึ่งเป็นครึ่งเดียวของคำถามที่เจ้าของถาม
 * อีกครึ่งคือ "แล้วเหลือเท่าไร" — ต้องมีฝั่งรายจ่ายถึงจะตอบได้
 *
 * ทุกตัวเลขบนหน้านี้อยู่บนฐานเดียวกับกราฟรายได้ 7 คืนในแท็บภาพรวม
 * ห้ามใช้คนละช่วงเวลาแล้วเอามาลบกัน — กำไรจะออกมาผิดโดยไม่มีใครจับได้
 */
export function Finance() {
  const { totals } = useOwner();
  const hotel = useHotel();
  const [openCat, setOpenCat] = useState<ExpenseCat | null>(null);
  const [adding, setAdding] = useState(false);

  const expenses = hotel.state.expenses;
  const P = pnl(totals.rooms, totals.fnb, expenses);
  const nights = 7;
  const be = breakEvenRooms(P.expense, nights, totals.adr);
  const sellablePerNight = Math.round(totals.availNights / nights);

  const receivables = [...hotel.state.receivables].sort(
    (a, b) => daysOverdue(b.since, TODAY) - daysOverdue(a.since, TODAY),
  );
  const owed = receivables.reduce((s, r) => s + r.amount, 0);

  const catRows = openCat ? expenses.filter((e) => e.cat === openCat) : [];

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">การเงิน · 7 คืนล่าสุด (อา 7 – ส 13 ส.ค. 2026)</span>
          <h2>รายจ่าย &amp; กำไรขาดทุน</h2>
        </div>
        <button className="btn" onClick={() => setAdding((v) => !v)}>
          <Icon name="plus" size={15} />
          {adding ? "ปิดฟอร์ม" : "บันทึกรายจ่าย"}
        </button>
      </div>

      <p className="lead">
        ใช้ช่วงเวลาเดียวกับกราฟรายได้ในแท็บภาพรวม — รายได้ {money(P.revenue)} ลบรายจ่าย{" "}
        {money(P.expense)} เหลือ <b>{money(P.profit)}</b> คิดเป็น {P.margin}% ของรายได้
      </p>

      {adding && <AddExpense onDone={() => setAdding(false)} />}

      {/* ── สามตัวเลขที่เจ้าของถามจริง ── */}
      <div className="fin-top">
        <div className="fin-card">
          <span className="k">รายได้</span>
          <strong>{money(P.revenue)}</strong>
          <span className="sub">
            ค่าห้อง {money(P.revenueRoom)} · ร้านอาหาร {money(P.revenueFnb)}
          </span>
        </div>
        <div className="fin-card out">
          <span className="k">รายจ่าย</span>
          <strong>{money(P.expense)}</strong>
          <span className="sub">
            จ่ายจริงแล้ว {money(P.cashOut)}
            {P.unpaid > 0 ? ` · ค้างจ่าย ${money(P.unpaid)}` : ""}
          </span>
        </div>
        <div className={`fin-card ${P.profit >= 0 ? "win" : "lose"}`}>
          <span className="k">{P.profit >= 0 ? "กำไร" : "ขาดทุน"}</span>
          <strong>{money(Math.abs(P.profit))}</strong>
          <span className="sub">
            {P.margin}% ของรายได้ · ยังไม่หักภาษีเงินได้และค่าเสื่อม
          </span>
        </div>
      </div>

      {/* ── จุดคุ้มทุน — ตัวเลขที่ใช้ตัดสินใจได้จริง ── */}
      {be !== null && (
        <div className="fin-be">
          <Icon name="shield" size={17} className="ic" />
          <div>
            <strong>
              ต้องขายให้ได้ {be} ห้องต่อคืน ถึงจะไม่ขาดทุน
            </strong>
            <span>
              รายจ่าย {money(P.expense)} ÷ {nights} คืน ÷ ADR {money(totals.adr)} ·
              จากห้องที่เปิดขายคืนละ ~{sellablePerNight} ห้อง คิดเป็นอัตราเข้าพัก{" "}
              {Math.round((be / sellablePerNight) * 100)}% ·
              ตอนนี้ทำได้ {totals.occAvg}%{" "}
              {totals.occAvg >= (be / sellablePerNight) * 100 ? "— อยู่เหนือจุดคุ้มทุน" : "— ต่ำกว่าจุดคุ้มทุน"}
            </span>
          </div>
        </div>
      )}

      {/* ── รายจ่ายแยกหมวด ── */}
      <div className="fin-split">
        <div className="fin-cats">
          <div className="fin-sec">
            <span className="k">รายจ่ายแยกหมวด</span>
            <span className="hint">กดหมวดเพื่อดูรายการที่คิดมาจากอะไร</span>
          </div>
          {P.byCat.map((c) => (
            <button
              key={c.cat}
              className={`fin-cat ${openCat === c.cat ? "on" : ""}`}
              onClick={() => setOpenCat(openCat === c.cat ? null : c.cat)}
            >
              <span className="nm">{CAT[c.cat].label}</span>
              <span className="amt">{money(c.amount)}</span>
              <span className="pct">{c.pct}%</span>
              <span className="track">
                <i style={{ width: `${c.pct}%` }} />
              </span>
            </button>
          ))}
          {P.byCat.length === 0 && (
            <p className="lead">ยังไม่มีรายจ่ายบันทึกไว้ — กดปุ่มบันทึกรายจ่ายด้านบน</p>
          )}
        </div>

        <div className="fin-detail">
          {openCat ? (
            <>
              <div className="fin-sec">
                <span className="k">{CAT[openCat].label}</span>
                <span className="hint">{CAT[openCat].hint}</span>
              </div>
              <ul className="fin-list">
                {catRows.map((e) => (
                  <li key={e.id}>
                    <div>
                      <strong>{e.label}</strong>
                      <span>
                        {fmtShort(e.at)}
                        {e.auto ? " · ระบบสร้างเอง" : ""}
                        {e.note ? ` · ${e.note}` : ""}
                      </span>
                    </div>
                    <div className="right">
                      <b>{money(e.amount)}</b>
                      {e.paid ? (
                        <span className="tag ok">จ่ายแล้ว</span>
                      ) : (
                        <button
                          className="tag wait"
                          onClick={() =>
                            hotel.dispatch({
                              type: "PATCH_EXPENSE",
                              id: e.id,
                              patch: { paid: true },
                            })
                          }
                        >
                          ค้างจ่าย{e.due ? ` ถึง ${fmtShort(e.due)}` : ""} · กดเพื่อบันทึกจ่าย
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="fin-empty">
              <Icon name="receipt" size={20} />
              <p>
                กดหมวดรายจ่ายทางซ้ายเพื่อดูว่าตัวเลขนั้นมาจากใบไหนบ้าง —
                ทุกยอดต้องกดดูที่มาได้ ไม่ใช่ตัวเลขที่พิมพ์ทิ้งไว้
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── เงินสดที่ยังไม่เข้ากระเป๋า ── */}
      <div className="fin-sec top">
        <span className="k">ลูกหนี้ · เงินที่ขายได้แล้วแต่ยังไม่ได้รับ</span>
        <span className="hint">
          กำไร {money(P.profit)} ไม่เท่ากับเงินในบัญชี — ค้างรับ {money(owed)} และค้างจ่าย{" "}
          {money(P.unpaid)}
        </span>
      </div>

      {receivables.length === 0 ? (
        <p className="lead">ไม่มีลูกหนี้ค้างชำระ</p>
      ) : (
        <div className="calwrap">
          <table className="calgrid fin-table">
            <thead>
              <tr>
                <th>ลูกหนี้</th>
                <th>ห้อง</th>
                <th>ค้างมา</th>
                <th>เหตุผล</th>
                <th className="n">ยอดค้าง</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {receivables.map((r) => {
                const days = daysOverdue(r.since, TODAY);
                return (
                  <tr key={r.id} className={days >= 30 ? "hot" : ""}>
                    <td className="nm">{r.guest}</td>
                    <td>{r.room}</td>
                    <td>
                      <b>{days} วัน</b>
                    </td>
                    <td className="why">{r.reason}</td>
                    <td className="n">
                      <b>{money(r.amount)}</b>
                    </td>
                    <td>
                      <button
                        className="btn ghost sm"
                        onClick={() =>
                          hotel.dispatch({ type: "SETTLE_RECEIVABLE", id: r.id })
                        }
                      >
                        รับเงินแล้ว
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="fin-note">
        <strong>สิ่งที่หน้านี้ยังไม่ทำ — พูดตรง ๆ</strong>
        <ul>
          <li>
            <b>ยังไม่ใช่ระบบบัญชี</b> — ไม่มีผังบัญชี ไม่มีสมุดรายวัน ไม่ออกงบการเงินตามมาตรฐาน
            ตัวเลขชุดนี้ใช้ตัดสินใจบริหารได้ แต่ยังต้องส่งให้ผู้ทำบัญชีอยู่ดี
          </li>
          <li>
            <b>ยังไม่หักค่าเสื่อมและภาษีเงินได้</b> — กำไรที่เห็นคือกำไรจากการดำเนินงาน
            ไม่ใช่กำไรสุทธิที่ยื่นสรรพากร
          </li>
          <li>
            <b>ค่าคอมมิชชัน OTA เป็นค่าตั้งต้น</b> — ต้องแก้ให้ตรงสัญญาจริงของแต่ละแพลตฟอร์ม
          </li>
        </ul>
      </div>
    </>
  );
}

/** ฟอร์มบันทึกรายจ่าย — สั้นที่สุดเท่าที่ยังได้ข้อมูลครบ */
function AddExpense({ onDone }: { onDone: () => void }) {
  const hotel = useHotel();
  const [cat, setCat] = useState<ExpenseCat>("supplies");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState(true);

  const value = Math.max(0, Number(amount) || 0);
  const ready = label.trim().length > 0 && value > 0;

  return (
    <div className="fin-form">
      <div className="row">
        <label>
          <span>หมวด</span>
          <select value={cat} onChange={(e) => setCat(e.target.value as ExpenseCat)}>
            {CAT_ORDER.map((c) => (
              <option key={c} value={c}>
                {CAT[c].label}
              </option>
            ))}
          </select>
        </label>
        <label className="grow">
          <span>รายการ</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="เช่น ค่าซักผ้าปูประจำสัปดาห์"
          />
        </label>
        <label>
          <span>จำนวนเงิน (บาท)</span>
          <input
            type="number"
            min="0"
            step="100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </label>
      </div>
      <div className="row foot">
        <label className="chk">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          จ่ายแล้ว
        </label>
        <span className="hint">
          {paid
            ? "ตัดเงินสดทันที"
            : `ขึ้นเป็นค้างจ่าย · กำหนดชำระ ${fmtShort(addDays(TODAY, 14))}`}
        </span>
        <button
          className="btn primary"
          disabled={!ready}
          onClick={() => {
            hotel.dispatch({
              type: "ADD_EXPENSE",
              expense: {
                at: TODAY,
                cat,
                label: label.trim(),
                amount: value,
                paid,
                due: paid ? undefined : addDays(TODAY, 14),
              },
            });
            setLabel("");
            setAmount("");
            onDone();
          }}
        >
          บันทึก
        </button>
      </div>
    </div>
  );
}

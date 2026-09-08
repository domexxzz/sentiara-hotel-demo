import { useOwner } from "./ownerStore";
import { useHotel } from "../hotel/hotelStore";
import { money } from "../lib/format";
import { Icon } from "../components/Icon";

export function Approvals() {
  const { state, dispatch } = useOwner();
  const hotel = useHotel();
  const deskRefunds = hotel.state.refunds;

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">รออนุมัติ {state.approvals.length} รายการ</span>
          <h2>คืนเงิน / ส่วนลด</h2>
        </div>
      </div>

      <p className="owner-note">
        ทุกการแก้ไขต้องมีเหตุผล + ชื่อผู้ทำ — อนุมัติแล้วบันทึกลงบิลถาวร แก้เงียบ ๆ ไม่ได้
      </p>

      {state.approvals.map((a) => (
        <div key={a.id} className="appr">
          <div className="top">
            <div>
              <strong>{a.title}</strong>
              <div className="meta">
                {a.id} · ขอโดย {a.by} · {a.at}
              </div>
              <div className="meta">เหตุผล: {a.reason}</div>
            </div>
            <span className="amt">{money(a.amount)}</span>
          </div>

          <div className="ainote">
            <Icon name="sparkle" size={16} className="ic" />
            <span>{a.aiNote}</span>
          </div>

          <div className="acts">
            <button
              className="btn primary"
              onClick={() => dispatch({ type: "DECIDE", id: a.id, approve: true })}
            >
              <Icon name="check" size={15} />
              อนุมัติ · {money(a.amount)}
            </button>
            <button
              className="btn ghost"
              onClick={() => dispatch({ type: "DECIDE", id: a.id, approve: false })}
            >
              ไม่อนุมัติ
            </button>
          </div>
        </div>
      ))}

      {state.approvals.length === 0 && (
        <div className="ainote">
          <Icon name="check" size={16} className="ic" />
          <span>ไม่มีรายการรออนุมัติแล้ว</span>
        </div>
      )}

      {deskRefunds.length > 0 && (
        <>
          <div className="k" style={{ color: "var(--muted)" }}>
            คืนเงินที่ทำจากหน้าเคาน์เตอร์ (เห็นอัตโนมัติ ไม่ต้องรายงาน)
          </div>
          <div className="audit">
            {deskRefunds.map((r, i) => (
              <div key={r.id + i} className="row">
                คืนเงิน {r.guest} · #{r.id} — {money(r.amount)}
                <span className="stamp">{r.reason} · บันทึกถาวรในบิล</span>
              </div>
            ))}
          </div>
        </>
      )}

      {state.audit.length > 0 && (
        <>
          <div className="k" style={{ color: "var(--muted)" }}>
            บันทึกการตัดสินใจ (ย้อนดูได้ตลอด · ส่งออกเป็นไฟล์ได้)
          </div>
          <div className="audit">
            {state.audit.map((e) => (
              <div key={e.id} className="row">
                {e.text}
                <span className="stamp">{e.stamp}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

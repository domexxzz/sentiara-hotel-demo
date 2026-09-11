import { ANGLES, CHECKLIST, ISSUES } from "./staffData";
import { useHotel, useStaff } from "../contexts";
import { Icon } from "../components/Icon";

export function JobDetail() {
  const { dispatch, active } = useStaff();
  const hotel = useHotel();
  if (!active) return null;

  const allChecked = active.checks.length === CHECKLIST.length;
  const allShots = active.photos.length === ANGLES.length;
  const canSubmit = allChecked && allShots;
  const raised = hotel.state.workOrders.filter((w) => w.room === active.room);

  return (
    <div className="body fade">
      {active.defect && (
        <div className="wo">
          <Icon name="back" size={16} />
          <span>
            หัวหน้าตีกลับ — <strong>{active.defect}</strong> · แก้แล้วถ่ายรูปใหม่แล้วส่งอีกครั้ง
          </span>
        </div>
      )}

      <div className="k" style={{ color: "var(--muted)" }}>
        1 · เช็กลิสต์ห้อง {active.room} ({active.checks.length}/{CHECKLIST.length})
      </div>
      <div>
        {CHECKLIST.map((c) => {
          const on = active.checks.includes(c.id);
          return (
            <button
              key={c.id}
              className={`ck ${on ? "on" : ""}`}
              onClick={() => dispatch({ type: "TOGGLE_CHECK", room: active.room, check: c.id })}
            >
              <span className="box">
                <Icon name="check" size={17} />
              </span>
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="k" style={{ color: "var(--muted)" }}>
        2 · ถ่ายรูปยืนยันความสะอาด 3 มุม (บังคับ)
      </div>
      <div className="shots">
        {ANGLES.map((a, idx) => {
          const taken = active.photos.includes(a.id);
          return (
            <button
              key={a.id}
              className={`st-shot ${taken ? "taken" : ""}`}
              onClick={() => dispatch({ type: "PHOTO", room: active.room, angle: a.id })}
            >
              {taken ? (
                <>
                  <span className="lbl">{a.label}</span>
                  <span className="stamp">ถ่ายแล้ว 13:0{idx + 2}</span>
                </>
              ) : (
                <>
                  <Icon name="qr" size={22} />
                  <span className="lbl">{a.label}</span>
                  <span className="hint">{a.hint}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <p className="st-note" style={{ margin: 0 }}>
        รูปแนบเข้าประวัติห้องอัตโนมัติ — เป็นหลักฐานการทำงาน ใครทำเมื่อไรมีบันทึกครบ
      </p>

      <div className="k" style={{ color: "var(--muted)" }}>
        3 · เจอของเสียระหว่างทำ? แจ้งช่างได้เลย
      </div>
      <div className="issues">
        {ISSUES.filter((i) => !raised.some((w) => w.label === i.label)).map((i) => (
          <button
            key={i.id}
            className="issue"
            onClick={() => {
              hotel.dispatch({
                type: "ADD_WO",
                wo: {
                  id: hotel.nextWoId(),
                  room: active.room,
                  label: i.label,
                  from: "แม่บ้านสมศรี",
                },
              });
              dispatch({ type: "RAISE_ISSUE", room: active.room, label: i.label });
            }}
          >
            + {i.label}
          </button>
        ))}
      </div>
      {raised.map((w) => (
        <div key={w.id} className="wo">
          <Icon name="check" size={16} />
          <span>
            <strong>{w.id}</strong> · {w.label} — ส่งเป็นใบงานช่างแล้ว ห้องยังส่งตรวจต่อได้
          </span>
        </div>
      ))}

      <button
        className="bigbtn primary"
        disabled={!canSubmit}
        onClick={() => dispatch({ type: "SUBMIT", room: active.room })}
      >
        <Icon name="send" size={18} />
        {canSubmit
          ? `ส่งตรวจห้อง ${active.room}`
          : !allChecked
            ? `ยังเหลือเช็กลิสต์ ${CHECKLIST.length - active.checks.length} ข้อ`
            : `ยังต้องถ่ายอีก ${ANGLES.length - active.photos.length} มุม`}
      </button>
    </div>
  );
}

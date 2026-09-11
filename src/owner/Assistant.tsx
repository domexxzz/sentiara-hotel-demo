import { AI_QNA, LAST_WEEK } from "./ownerData";
import { useOwner } from "../contexts";
import { money, delta } from "../lib/format";
import { Icon } from "../components/Icon";

export function Assistant() {
  const { state, dispatch, totals } = useOwner();
  const asked = state.chat.map((t) => t.q);
  const remaining = AI_QNA.filter((q) => !asked.includes(q.q));

  // Answers quote the same computed totals as the KPI cards — no drift.
  const fill = (s: string) =>
    s
      .replace("{revenue}", money(totals.revenue))
      .replace("{delta}", delta(totals.revenue, LAST_WEEK.revenue))
      .replace("{occ}", String(totals.occAvg))
      .replace("{lastOcc}", String(LAST_WEEK.occ));

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">AI ผู้ช่วย · ตอบจากข้อมูลจริงในระบบ</span>
          <h2>ถามเหมือนถามผู้จัดการ</h2>
        </div>
      </div>

      <p className="owner-note">
        ทุกคำตอบกดดูหลักฐานได้ — มาจากบิล มิเตอร์ และงานจริงในระบบ ไม่ใช่การเดา
      </p>

      {state.chat.map((t, i) => (
        <div key={i} className="turn">
          <div className="q">{t.q}</div>
          <div className="a">
            {t.a}
            <span className="evi">{t.evidence}</span>
            {t.action && !state.workOrder && (
              <button
                className="btn primary sm"
                style={{ marginTop: 11 }}
                onClick={() => dispatch({ type: "ORDER_TECH" })}
              >
                <Icon name="shield" size={14} />
                {t.action}
              </button>
            )}
          </div>
        </div>
      ))}

      {state.workOrder && (
        <div className="ainote">
          <Icon name="check" size={16} className="ic" />
          <span>{state.workOrder}</span>
        </div>
      )}

      {remaining.length > 0 && (
        <>
          <div className="k" style={{ color: "var(--muted)" }}>
            {state.chat.length ? "ถามต่อได้" : "ลองถามดู"}
          </div>
          <div className="ask-list">
            {remaining.map((q) => (
              <button
                key={q.q}
                className="ask"
                onClick={() =>
                  dispatch({
                    type: "ASK",
                    turn: { q: q.q, a: fill(q.a), evidence: q.evidence, action: q.action },
                  })
                }
              >
                <Icon name="sparkle" size={17} className="ic" />
                {q.q}
                <Icon name="chevron" size={15} className="go" />
              </button>
            ))}
          </div>
        </>
      )}

      {remaining.length === 0 && (
        <p className="owner-note">
          ถามได้ทุกเรื่องในระบบ — กฎหมายโรงแรม · ตม. · PDPA · ภาษี · แรงงาน
          และตัวเลขทุกตัวในรายงาน
        </p>
      )}
    </>
  );
}

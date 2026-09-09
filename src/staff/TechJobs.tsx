import { PARTS, TECH, TECH_ANGLES } from "./staffData";
import { useStaff } from "./staffStore";
import { useHotel } from "../hotel/hotelStore";
import { money } from "../lib/format";
import { Icon } from "../components/Icon";

const WO_TAG: Record<string, { cls: string; text: string }> = {
  open: { cls: "warn", text: "ยังไม่รับงาน" },
  doing: { cls: "warn", text: "กำลังซ่อม" },
  paused: { cls: "warn", text: "พักงาน · รออะไหล่" },
  done: { cls: "ok", text: "ปิดงานแล้ว" },
};

export function TechJobs() {
  const { dispatch, activeWo, counts } = useStaff();
  const hotel = useHotel();
  const workOrders = hotel.state.workOrders;
  const wp = (id: string, patch: Record<string, unknown>) =>
    hotel.dispatch({ type: "WO_PATCH", id, patch });

  // ── รายละเอียดใบงาน ───────────────────────────────────────────────
  if (activeWo) {
    const w = activeWo;
    const hasBefore = w.photos.includes("before");
    const canClose = w.photos.length === TECH_ANGLES.length;

    return (
      <div className="body fade">
        <div className="wo">
          <Icon name="shield" size={16} />
          <span>
            <strong>{w.id}</strong> · ห้อง {w.room} — {w.label}
            <br />
            แจ้งโดย {w.from}
          </span>
        </div>

        {w.status === "open" ? (
          <>
            <p className="st-note" style={{ margin: 0 }}>
              รับงานแล้วเคาน์เตอร์เห็นสถานะทันที — ไม่ต้องโทรตาม
            </p>
            <button
              className="bigbtn primary"
              onClick={() => {
                wp(w.id, { status: "doing" });
                dispatch({ type: "WO_BANNER", text: `รับงาน ${w.id} แล้ว 14:26 — เคาน์เตอร์เห็นสถานะทันที` });
              }}
            >
              <Icon name="check" size={18} />
              รับงาน {w.id}
            </button>
          </>
        ) : (
          <>
            <div className="k" style={{ color: "var(--muted)" }}>
              1 · รูปก่อน–หลังซ่อม (บังคับก่อนปิดงาน)
            </div>
            <div className="shots">
              {TECH_ANGLES.map((a) => {
                const taken = w.photos.includes(a.id);
                const locked = a.id === "after" && !hasBefore;
                return (
                  <button
                    key={a.id}
                    className={`st-shot ${taken ? "taken" : ""}`}
                    disabled={locked}
                    onClick={() => wp(w.id, { photos: [...w.photos, a.id] })}
                  >
                    {taken ? (
                      <>
                        <span className="lbl">{a.label}</span>
                        <span className="stamp">
                          {a.id === "before" ? "14:31" : "15:36"} · ช่าง{TECH.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <Icon name="qr" size={22} />
                        <span className="lbl">{a.label}</span>
                        {locked && <span className="hint">ถ่ายรูปก่อนซ่อมก่อน</span>}
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="k" style={{ color: "var(--muted)" }}>
              2 · เบิกอะไหล่จากคลัง — ต้นทุน {money(w.cost)}
            </div>
            <div className="issues">
              {PARTS.filter((p) => !w.parts.includes(p.id)).map((p) => (
                <button
                  key={p.id}
                  className="issue"
                  onClick={() =>
                    wp(w.id, { parts: [...w.parts, p.id], cost: w.cost + p.price })
                  }
                >
                  + {p.label} · {money(p.price)}
                </button>
              ))}
            </div>
            {w.parts.length > 0 && (
              <div className="bill">
                {w.parts.map((id) => {
                  const p = PARTS.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <div key={id} className="r">
                      <span>{p.label}</span>
                      <span className="v">{money(p.price)}</span>
                    </div>
                  );
                })}
                <div className="r total">
                  <span>ต้นทุนซ่อมรวม</span>
                  <span className="v">{money(w.cost)}</span>
                </div>
              </div>
            )}

            <button
              className="bigbtn ok"
              disabled={!canClose}
              onClick={() => {
                hotel.dispatch({
                  type: "SET_ROOM",
                  room: w.room,
                  patch: { status: "dirty", note: "ซ่อมเสร็จ · เข้าคิวแม่บ้าน" },
                });
                wp(w.id, {
                  status: "done",
                  note: `ปิดงานแล้ว · ต้นทุนซ่อม ฿${w.cost.toLocaleString("en-US")}`,
                });
                dispatch({ type: "WO_OPEN", id: null });
                dispatch({
                  type: "WO_BANNER",
                  text: `ปิดงาน ${w.id} — ห้อง ${w.room} กลับเข้าคิวแม่บ้าน · ปฏิทินเปิดขายคืนนี้ · ต้นทุนซ่อม ฿${w.cost.toLocaleString("en-US")} เข้ารายงานเดือน`,
                });
              }}
            >
              <Icon name="check" size={18} />
              {canClose
                ? `ปิดงาน — ห้อง ${w.room} กลับมาขายได้`
                : "ต้องมีรูปก่อนและหลังซ่อมก่อน"}
            </button>

            <button
              className="bigbtn"
              onClick={() => {
                wp(w.id, { status: "paused", note: "รออะไหล่ — คอมเพรสเซอร์สั่งร้านนอก คาดถึง 16 ส.ค." });
                dispatch({ type: "WO_OPEN", id: null });
                dispatch({ type: "WO_BANNER", text: `พักงาน ${w.id} — เคาน์เตอร์เห็นว่าห้อง ${w.room} ยังขายไม่ได้ถึง 16 ส.ค.` });
              }}
            >
              พักงาน · รออะไหล่
            </button>
          </>
        )}

        <button
          className="bigbtn"
          style={{ minHeight: 44 }}
          onClick={() => dispatch({ type: "WO_OPEN", id: null })}
        >
          กลับคิวใบงาน
        </button>
      </div>
    );
  }

  // ── คิวใบงาน ─────────────────────────────────────────────────────
  // ห้องที่ยังขายไม่ได้เพราะใบงานช่างยังไม่ปิด
  const blocked = hotel.state.rooms.filter((r) => r.status === "ooo").length;

  return (
    <div className="body fade">
      <div className="st-sum">
        <div>
          <span className="k">ใบงานค้าง</span>
          <div className="n">{counts.wo}</div>
        </div>
        <div>
          <span className="k">ปิดแล้ววันนี้</span>
          <div className="n">
            {workOrders.filter((w) => w.status === "done").length}
          </div>
        </div>
        <div>
          <span className="k">ห้องที่ยังขายไม่ได้</span>
          <div className="n">{blocked}</div>
        </div>
      </div>

      <p className="st-note" style={{ margin: 0 }}>
        ช่าง{TECH.name} · {TECH.role} — งานเด้งมาเองจากแม่บ้าน เคาน์เตอร์ และเซ็นเซอร์
      </p>

      {workOrders.length === 0 ? (
        <div className="wo">
          <Icon name="check" size={16} />
          <span>ยังไม่มีใบงาน — ลองไปกดแจ้งของเสียในจอแม่บ้านดู</span>
        </div>
      ) : (
        workOrders.map((w) => {
          const tag = WO_TAG[w.status];
          return (
            <button
              key={w.id}
              className={`jobcd ${
                w.status === "done" ? "done" : w.status === "open" ? "todo" : "doing"
              }`}
              disabled={w.status === "done"}
              onClick={() => dispatch({ type: "WO_OPEN", id: w.id })}
            >
              <span className="rm">{w.room}</span>
              <span className="meta">
                <strong>
                  {w.label}
                  {w.urgent && " · ด่วน"}
                </strong>
                <span className="sub">
                  {w.id} · แจ้งโดย {w.from}
                </span>
                {w.note && <span className="sub">{w.note}</span>}
                {w.cost > 0 && <span className="sub">ต้นทุนอะไหล่ {money(w.cost)}</span>}
                <span className={`st-tag ${tag.cls}`}>{tag.text}</span>
              </span>
              {w.status !== "done" && <Icon name="chevron" size={18} className="go" />}
            </button>
          );
        })
      )}
    </div>
  );
}

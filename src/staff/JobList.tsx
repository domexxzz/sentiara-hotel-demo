import { HK } from "./staffData";
import { useHotel, useStaff } from "../contexts";
import { Icon } from "../components/Icon";

const STATUS_TAG: Record<string, { cls: string; text: string }> = {
  todo: { cls: "warn", text: "ยังไม่เริ่ม" },
  doing: { cls: "warn", text: "กำลังทำ" },
  review: { cls: "wait", text: "รอหัวหน้าตรวจ" },
  rejected: { cls: "warn", text: "ตีกลับ · ต้องแก้" },
  done: { cls: "ok", text: "ผ่านแล้ว · พร้อมขาย" },
};

export function JobList() {
  const { dispatch, counts, jobs } = useStaff();
  const hotel = useHotel();

  return (
    <div className="body fade">
      <div className="st-sum">
        <div>
          <span className="k">งานคงเหลือ</span>
          <div className="n">{counts.todo}</div>
        </div>
        <div>
          <span className="k">รอตรวจ</span>
          <div className="n">{counts.review}</div>
        </div>
        <div>
          <span className="k">เสร็จแล้ว</span>
          <div className="n">{counts.done}</div>
        </div>
      </div>

      <p className="st-note" style={{ margin: 0 }}>
        งานเกิดเองจากห้องที่เช็กเอาท์จริง — เคาน์เตอร์ปิดบิลปุ๊บ ห้องเด้งเข้าคิวนี้ทันที
      </p>

      {jobs.length === 0 && (
        <div className="wo">
          <Icon name="check" size={16} />
          <span>ไม่มีห้องรอทำความสะอาด — ลองไปปิดบิลที่หน้าเคาน์เตอร์ดู</span>
        </div>
      )}

      {jobs.map((j) => {
        const tag = STATUS_TAG[j.status];
        return (
          <button
            key={j.id}
            className={`jobcd ${j.status}`}
            onClick={() => dispatch({ type: "OPEN", room: j.room })}
            disabled={j.status === "done"}
          >
            <span className="rm">{j.room}</span>
            <span className="meta">
              <strong>{j.kind}</strong>
              <span className="sub">
                {j.id} · {j.type} · ~{j.minutes} นาที
              </span>
              {j.defect && (
                <span className="sub" style={{ color: "var(--accent-700)", fontWeight: 600 }}>
                  จุดที่ต้องแก้: {j.defect}
                </span>
              )}
              {!j.defect && j.priority && <span className="sub">{j.priority}</span>}
              <span className={`st-tag ${tag.cls}`}>{tag.text}</span>
            </span>
            {j.status !== "done" && <Icon name="chevron" size={18} className="go" />}
          </button>
        );
      })}

      {hotel.state.workOrders.length > 0 && (
        <>
          <div className="k" style={{ color: "var(--muted)" }}>
            ใบงานช่างที่คุณแจ้งไว้
          </div>
          {hotel.state.workOrders.map((w) => (
            <div key={w.id} className="wo">
              <Icon name="shield" size={16} />
              <span>
                <strong>{w.id}</strong> · ห้อง {w.room} — {w.label}
              </span>
            </div>
          ))}
        </>
      )}

      <p className="st-note" style={{ margin: 0 }}>
        {HK.name} · {HK.shift} — เน็ตหลุดก็กดต่อได้ ระบบซิงก์ให้เองเมื่อกลับมา
      </p>
    </div>
  );
}

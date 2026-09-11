import { useState } from "react";
import { ANGLES, DEFECTS, HK, SUP } from "./staffData";
import { useHotel, useStaff } from "../contexts";
import { Icon } from "../components/Icon";

export function Review() {
  const { dispatch, counts, reviewQueue: queue } = useStaff();
  const hotel = useHotel();
  const [openId, setOpenId] = useState<string | null>(null);
  const [defect, setDefect] = useState<string | null>(null);

  const open = queue.find((j) => j.room === openId) ?? null;

  const close = () => {
    setOpenId(null);
    setDefect(null);
  };

  if (open) {
    return (
      <div className="body fade">
        <div className="k" style={{ color: "var(--muted)" }}>
          ห้อง {open.room} · ยืนยันงาน
        </div>
        <p className="st-note" style={{ margin: 0 }}>
          {HK.name} · เสร็จ {open.doneAt} — ตรวจจากรูปได้เลย ไม่ต้องเดินขึ้นไปดู
        </p>

        <div className="revshots">
          {ANGLES.map((a) => (
            <div key={a.id} className="revshot">
              {a.label}
            </div>
          ))}
        </div>

        <div className="k" style={{ color: "var(--muted)" }}>
          ถ้าไม่ผ่าน — ระบุจุดที่ต้องแก้ (บังคับ)
        </div>
        <div className="defects">
          {DEFECTS.map((d) => (
            <button
              key={d.id}
              className={`defect ${defect === d.label ? "on" : ""}`}
              onClick={() => setDefect(defect === d.label ? null : d.label)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <button
          className="bigbtn ok"
          disabled={!!defect}
          onClick={() => {
            hotel.dispatch({
              type: "SET_ROOM",
              room: open.room,
              patch: { status: "ready", guest: undefined, note: undefined },
            });
            dispatch({ type: "APPROVE", room: open.room });
            close();
          }}
        >
          <Icon name="check" size={19} />
          {defect ? "เลือกจุดที่ต้องแก้ไว้แล้ว" : `กดผ่าน — ห้อง ${open.room} พร้อมขาย`}
        </button>

        <button
          className="bigbtn"
          disabled={!defect}
          onClick={() => {
            if (!defect) return;
            dispatch({ type: "REJECT", room: open.room, defect });
            close();
          }}
        >
          <Icon name="back" size={18} />
          {defect ? `ตีกลับ — ${defect}` : "ตีกลับ (ต้องเลือกจุดที่ต้องแก้ก่อน)"}
        </button>

        <button className="bigbtn" style={{ minHeight: 44 }} onClick={close}>
          กลับไปคิวรอตรวจ
        </button>
      </div>
    );
  }

  return (
    <div className="body fade">
      <div className="st-sum">
        <div>
          <span className="k">รอตรวจ</span>
          <div className="n">{counts.review}</div>
        </div>
        <div>
          <span className="k">ผ่านแล้ววันนี้</span>
          <div className="n">{counts.done}</div>
        </div>
        <div>
          <span className="k">ยังทำอยู่</span>
          <div className="n">{counts.todo}</div>
        </div>
      </div>

      <p className="st-note" style={{ margin: 0 }}>
        {SUP.name} · {SUP.role} — กดผ่านแล้วเคาน์เตอร์เห็น “พร้อมขาย” ใน 5 วินาที
      </p>

      {queue.length === 0 ? (
        <div className="wo">
          <Icon name="check" size={16} />
          <span>ไม่มีห้องรอตรวจตอนนี้ — ให้แม่บ้านส่งงานเข้ามาก่อน</span>
        </div>
      ) : (
        queue.map((j) => (
          <button key={j.id} className="jobcd review" onClick={() => setOpenId(j.room)}>
            <span className="rm">{j.room}</span>
            <span className="meta">
              <strong>{j.kind}</strong>
              <span className="sub">
                {HK.name} · เสร็จ {j.doneAt} · แนบรูป {j.photos.length} มุม
              </span>
              <span className="st-tag wait">รอตรวจ</span>
            </span>
            <Icon name="chevron" size={18} className="go" />
          </button>
        ))
      )}
    </div>
  );
}

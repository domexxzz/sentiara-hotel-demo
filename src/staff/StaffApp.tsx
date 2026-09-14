import { useJump } from "../tour/useJump";
import "./staff.css";
import { HK, SUP, TECH } from "./staffData";
import { StaffProvider } from "./staffStore";
import { useStaff } from "../contexts";
import { JobList } from "./JobList";
import { JobBoard } from "./JobBoard";
import { JobDetail } from "./JobDetail";
import { Review } from "./Review";
import { TechJobs } from "./TechJobs";
import { TimeClock } from "./TimeClock";
import { useState } from "react";
import { PhoneFrame } from "../components/PhoneFrame";
import { Icon } from "../components/Icon";

function StaffShell() {
  const { state, dispatch, active, counts } = useStaff();
  useJump((t) => {
    if (t.flow !== "staff") return;
    if (t.role) dispatch({ type: "ROLE", role: t.role });
    if (t.staff) dispatch({ type: "VIEW", view: t.staff });
  });
  const [clock, setClock] = useState(false);
  // กระดาน/รายการ เก็บไว้ในคอมโพเนนต์ ไม่ใช่ใน store — มันเป็นความชอบของคนดู
  // ไม่ใช่สถานะของงาน · ใส่ใน store แล้วต้องพาไปทุกที่ที่อ่าน state โดยไม่ได้ใช้
  const [board, setBoard] = useState(true);
  const isHk = state.role === "hk";
  const isTech = state.role === "tech";
  const inJob = state.view === "job";

  const title = isHk
    ? `${HK.name} · ${HK.role}`
    : isTech
      ? `ช่าง${TECH.name} · ${TECH.role}`
      : `${SUP.name} · ${SUP.role}`;
  const kicker = isHk ? "งานวันนี้" : isTech ? "ใบงานช่าง" : "คิวรอตรวจ";

  return (
    <>
      <header className="st-bar">
        {inJob && (
          <button
            className="st-back"
            aria-label="กลับรายการงาน"
            onClick={() => dispatch({ type: "VIEW", view: "list" })}
          >
            <Icon name="back" size={19} />
          </button>
        )}
        <div className="who">
          <span className="k">
            {clock ? "ลงเวลาทำงาน" : inJob && active ? `${active.id} · ห้อง ${active.room}` : kicker}
          </span>
          <strong>{inJob && active && !clock ? active.kind : title}</strong>
        </div>
        <button
          className="st-clock"
          onClick={() => setClock((c) => !c)}
          aria-pressed={clock}
        >
          <Icon name="calendar" size={15} />
          {clock ? "ปิด" : "ลงเวลา"}
        </button>
      </header>

      <div className="st-roles">
        <button
          className={isHk ? "on" : ""}
          onClick={() => dispatch({ type: "ROLE", role: "hk" })}
        >
          <Icon name="sparkle" size={15} />
          แม่บ้าน
          {counts.todo > 0 && <span className="pill">{counts.todo}</span>}
        </button>
        <button
          className={state.role === "sup" ? "on" : ""}
          onClick={() => dispatch({ type: "ROLE", role: "sup" })}
        >
          <Icon name="shield" size={15} />
          หัวหน้า
          {counts.review > 0 && <span className="pill">{counts.review}</span>}
        </button>
        <button
          className={isTech ? "on" : ""}
          onClick={() => dispatch({ type: "ROLE", role: "tech" })}
        >
          <Icon name="key" size={15} />
          ช่าง
          {counts.wo > 0 && <span className="pill">{counts.wo}</span>}
        </button>
      </div>

      <div className={`st-net ${state.online ? "" : "off"}`}>
        <Icon name="wifi" size={15} />
        {state.online ? (
          <span>ออนไลน์ · เซิร์ฟเวอร์ในโรงแรม (LAN)</span>
        ) : (
          <span>
            ออฟไลน์ · ทำงานต่อได้
            {state.pending.length > 0 && ` · รอซิงก์ ${state.pending.length} รายการ`}
          </span>
        )}
        <button onClick={() => dispatch({ type: "SET_ONLINE", online: !state.online })}>
          {state.online ? "จำลองเน็ตหลุด" : "เน็ตกลับมา"}
        </button>
      </div>

      {state.banner && (
        <div className="st-banner">
          <Icon name="check" size={15} className="ic" />
          <span>{state.banner}</span>
          <button
            aria-label="ปิดข้อความ"
            onClick={() => dispatch({ type: "BANNER", text: null })}
          >
            ✕
          </button>
        </div>
      )}

      {/* สลับกระดาน/รายการ — ขึ้นเฉพาะจอคิวงานของแม่บ้าน
          จอหัวหน้ากับจอช่างมีโครงคนละแบบ ใส่ปุ่มนี้ไปก็ไม่มีอะไรให้สลับ */}
      {!clock && !inJob && isHk && (
        <div className="st-layout">
          <button className={board ? "on" : ""} onClick={() => setBoard(true)}>
            <Icon name="qr" size={14} />
            กระดาน
          </button>
          <button className={board ? "" : "on"} onClick={() => setBoard(false)}>
            <Icon name="receipt" size={14} />
            รายการ
          </button>
        </div>
      )}

      {clock ? (
        <TimeClock onClose={() => setClock(false)} />
      ) : inJob ? (
        <JobDetail />
      ) : isTech ? (
        <TechJobs />
      ) : isHk ? (
        board ? <JobBoard /> : <JobList />
      ) : (
        <Review />
      )}
    </>
  );
}

export function StaffApp() {
  return (
    <StaffProvider>
      <PhoneFrame>
        <StaffShell />
      </PhoneFrame>
    </StaffProvider>
  );
}

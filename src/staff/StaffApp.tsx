import "./staff.css";
import { HK, SUP, TECH } from "./staffData";
import { StaffProvider } from "./staffStore";
import { useStaff } from "../contexts";
import { JobList } from "./JobList";
import { JobDetail } from "./JobDetail";
import { Review } from "./Review";
import { TechJobs } from "./TechJobs";
import { TimeClock } from "./TimeClock";
import { useState } from "react";
import { PhoneFrame } from "../components/PhoneFrame";
import { Icon } from "../components/Icon";

function StaffShell() {
  const { state, dispatch, active, counts } = useStaff();
  const [clock, setClock] = useState(false);
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

      {clock ? (
        <TimeClock onClose={() => setClock(false)} />
      ) : inJob ? (
        <JobDetail />
      ) : isTech ? (
        <TechJobs />
      ) : isHk ? (
        <JobList />
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

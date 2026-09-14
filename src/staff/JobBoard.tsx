import { useStaff } from "../contexts";
import { Icon } from "../components/Icon";
import type { LiveJob } from "./staffStore";

/**
 * กระดานงานแม่บ้าน — คอลัมน์ตามสถานะจริงของงาน
 *
 * ทำไมต้องมีนอกจากรายการเรียงยาว
 * -------------------------------
 * กติกาของระบบคือ **ห้องกลับไปขายได้ตอนหัวหน้าตรวจผ่าน ไม่ใช่ตอนแม่บ้านกดเสร็จ**
 * แปลว่างานมีสี่สถานะที่เดินต่อกันเป็นสาย และจุดที่มักตันคือ "รอหัวหน้าตรวจ"
 *
 * รายการเรียงยาวบอกได้แค่ว่ามีงานกี่ใบ · กระดานบอกว่า **ตันตรงไหน**
 * ซึ่งเป็นคำถามที่หัวหน้ากับเจ้าของถามจริงทุกวัน
 *
 * ทำไมเลื่อนข้างบนมือถือ ไม่ตกบรรทัด
 * -----------------------------------
 * สี่คอลัมน์บนจอ 390px ได้ช่องละ 90px ซึ่งใส่เลขห้องยังไม่พอ · การเลื่อนข้าง
 * เป็นท่ามาตรฐานของกระดานบนมือถือ (คนใช้ Trello/Jira เป็นอยู่แล้ว) และ
 * `scroll-snap` ทำให้หยุดตรงหัวคอลัมน์พอดี ไม่ค้างครึ่ง ๆ กลาง ๆ
 * ตัวนับบนหัวคอลัมน์ยังเห็นครบทุกคอลัมน์จากแถบสรุปด้านบน จึงไม่มีใครพลาดว่า
 * มีคอลัมน์ที่มองไม่เห็นอยู่
 */

const PILL: Record<string, { cls: string; text: string }> = {
  todo: { cls: "wait", text: "ยังไม่เริ่ม" },
  doing: { cls: "now", text: "กำลังทำ" },
  review: { cls: "check", text: "รอตรวจ" },
  rejected: { cls: "bad", text: "ตีกลับ · ต้องแก้" },
  done: { cls: "done", text: "ผ่านแล้ว" },
};

function Card({ job, onOpen }: { job: LiveJob; onOpen: () => void }) {
  const pill = PILL[job.status];
  const done = job.status === "done";
  return (
    <button className={`bd-card ${job.status}`} onClick={onOpen} disabled={done}>
      {/* เลขห้องอยู่บรรทัดเดียวตามลำพัง — คนหาเลขห้องก่อนเสมอ
          เอาชื่องานมาต่อท้ายในคอลัมน์กว้าง 300px แล้วชื่อตัดเป็นสามบรรทัด
          ดันเลขห้องเบี้ยวและอ่านยากทั้งคู่ */}
      <span className="r1">
        <span className="no">{job.room}</span>
        {!done && <Icon name="chevron" size={15} className="go" />}
      </span>
      <b className="ttl">{job.kind}</b>
      <span className="meta">
        {job.type}
        {job.minutes > 0 && ` · ~${job.minutes} นาที`}
      </span>
      {job.defect ? (
        <span className="meta bad">จุดที่ต้องแก้: {job.defect}</span>
      ) : (
        job.priority && <span className="meta">{job.priority}</span>
      )}
      {job.doneAt && <span className="meta">หัวหน้าตรวจผ่าน {job.doneAt}</span>}
      <span className={`bd-pill ${pill.cls}`}>{pill.text}</span>
      {job.photos.length > 0 && (
        <span className="bd-foot">
          <Icon name="check" size={12} />
          แนบรูปแล้ว {job.photos.length} รูป
        </span>
      )}
    </button>
  );
}

export function JobBoard() {
  const { board, dispatch } = useStaff();

  return (
    <div className="body fade bd-body">
      <p className="st-note" style={{ margin: 0 }}>
        งานเกิดเองจากห้องที่เช็กเอาท์จริง — ห้องกลับไปขายได้ตอนหัวหน้าตรวจผ่าน
        ไม่ใช่ตอนแม่บ้านกดเสร็จ
      </p>

      {/* แถบสรุปนี้อยู่นอกแถบเลื่อน — คนจึงเห็นตัวเลขครบทั้งสี่คอลัมน์
          แม้จะเลื่อนไปดูทีละคอลัมน์ ไม่มีใครพลาดว่ามีงานกองอยู่ข้างหลัง */}
      <div className="bd-sum">
        {board.map((c) => (
          <div key={c.key} className={c.bottleneck ? "hot" : ""}>
            <span className="k">{c.short}</span>
            <b>{c.jobs.length}</b>
          </div>
        ))}
      </div>

      <div className="bd-scroll">
        {board.map((col) => (
          <section key={col.key} className={`bd-col ${col.bottleneck ? "hot" : ""}`}>
            <header className="bd-colh">
              <b>{col.title}</b>
              <span className="n">{col.jobs.length}</span>
            </header>
            <div className="bd-colb">
              {col.jobs.length === 0 ? (
                <p className="bd-empty">
                  {col.key === "done"
                    ? "ยังไม่มีห้องที่ตรวจผ่านในกะนี้"
                    : "ไม่มีงานในคอลัมน์นี้"}
                </p>
              ) : (
                col.jobs.map((j) => (
                  <Card
                    key={j.id + j.status}
                    job={j}
                    onOpen={() => {
                      // งานรอตรวจเป็นของหัวหน้า ไม่ใช่ของแม่บ้าน — พาไปจอที่ถูก
                      if (j.status === "review") {
                        dispatch({ type: "ROLE", role: "sup" });
                        dispatch({ type: "VIEW", view: "review" });
                      } else {
                        dispatch({ type: "OPEN", room: j.room });
                      }
                    }}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

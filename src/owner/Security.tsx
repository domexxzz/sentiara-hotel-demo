import { useState } from "react";
import { Icon } from "../components/Icon";
import {
  ask,
  audit,
  canJoinNetwork,
  CAM_EVENTS,
  CONTRACTS,
  daysToNotice,
  DEVICES,
  TRAIL,
  FIRMWARE_CUTOFF,
  type Answer,
  type CamEvent,
} from "../lib/security";

/**
 * ความปลอดภัยและงานกฎหมาย
 *
 * สามเรื่องที่ไม่มีใครนึกถึงจนกว่าจะมีปัญหา — และตอนนั้นย้อนกลับไปแก้ไม่ได้แล้ว
 *
 * จอนี้จงใจ **ไม่โชว์ภาพวิดีโอ** ทั้งที่กล้องเป็นหัวข้อแรก เพราะการดูภาพสด
 * มีขายทั่วไป คุณค่าอยู่ที่ตอนมีเรื่องแล้วถามว่า "คืนวันที่ 8 ห้อง 208
 * ใครเข้าออกบ้าง" แล้วตอบได้ทันทีโดยไม่ต้องไล่วิดีโอทีละชั่วโมง
 * — ซึ่งเป็นสิ่งที่ต้องมี PMS อยู่ข้างหลังถึงจะทำได้
 */

const TODAY = "2026-09-09";

const KIND_LABEL: Record<CamEvent["kind"], string> = {
  card: "บัตร",
  door: "ประตู",
  motion: "ความเคลื่อนไหว",
  face: "ใบหน้า",
};

const SAMPLE_QUESTIONS = [
  "ทะเบียนผู้พักต้องเก็บกี่ปี",
  "แขกต่างชาติต้องแจ้ง ตม.30 ภายในกี่ชั่วโมง",
  "มัดจำต้องเสีย VAT ตอนไหน",
  "เก็บภาพ CCTV ของแขกต้องทำอะไรตาม PDPA",
  "โรงแรมเปลี่ยนชื่อกิจการต้องทำยังไง",
];

export function Security() {
  const [openEvent, setOpenEvent] = useState<string | null>("EV-9012");
  const [openDevice, setOpenDevice] = useState<string | null>("D-02");
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);

  const blocked = DEVICES.filter((d) => !canJoinNetwork(d));
  const urgentEvents = CAM_EVENTS.filter((e) => e.level === "high");

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">Security &amp; Legal · เรื่องที่ย้อนกลับไปแก้ไม่ได้</span>
          <h2>ความปลอดภัยและงานกฎหมาย</h2>
        </div>
        <div className="led-state">
          <span className={`led-badge ${blocked.length ? "bad" : "ok"}`}>
            {blocked.length ? `${blocked.length} อุปกรณ์ยังต่อเน็ตไม่ได้` : "อุปกรณ์ผ่านครบ"}
          </span>
        </div>
      </div>

      {/* ── กล้องวงจรปิด ────────────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">Security Camera · {CAM_EVENTS.length} เหตุการณ์คืนวันที่ 8</span>
        <h3>เชื่อมเหตุการณ์เข้ากับห้องและเวลา</h3>
        <p className="led-note">
          จอดูภาพสดมีขายทั่วไป — คุณค่าอยู่ตอนมีเรื่องแล้วถามว่า{" "}
          <b>“คืนวันที่ 8 ห้อง 208 ใครเข้าออกบ้าง”</b> แล้วตอบได้ทันที
          โดยไม่ต้องไล่ดูวิดีโอทีละชั่วโมง ซึ่งทำได้เพราะเหตุการณ์ผูกกับการจองไว้แล้ว
        </p>

        <ul className="sec-events">
          {CAM_EVENTS.map((e) => (
            <li key={e.id} className={`${e.level} ${openEvent === e.id ? "on" : ""}`}>
              <button onClick={() => setOpenEvent(openEvent === e.id ? null : e.id)}>
                <span className="sec-time">{e.at.slice(11)}</span>
                <span className="sec-kind">{KIND_LABEL[e.kind]}</span>
                <span className="sec-what">{e.headline}</span>
                <span className="sec-where">
                  {e.camera} · {e.zone}
                </span>
              </button>
              {openEvent === e.id && (
                <div className="sec-detail">
                  <dl>
                    <dt>ช่วงคลิป</dt>
                    <dd>{e.clip}</dd>
                    {e.room ? (
                      <>
                        <dt>ห้อง</dt>
                        <dd>{e.room}</dd>
                        <dt>การจอง</dt>
                        <dd>
                          <code>{e.bookingRef}</code> · {e.guest}
                        </dd>
                      </>
                    ) : (
                      <>
                        <dt>ห้อง</dt>
                        <dd className="sec-none">ไม่ผูกกับห้องใด — เป็นพื้นที่ส่วนกลาง</dd>
                      </>
                    )}
                  </dl>
                  <p className="sec-novideo">
                    ภาพวิดีโอมาจาก <b>Cora</b> ที่รันแยกอยู่แล้ว — เดโมนี้แสดงเฉพาะ
                    ชั้นเหตุการณ์ที่ผูกกับ PMS ไม่ได้ฝังวิดีโอไว้
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="led-callout">
          <Icon name="shield" />
          <span>
            <b>{urgentEvents.length} เหตุการณ์ต้องมีคนดู</b> จากทั้งหมด {CAM_EVENTS.length} —
            ถ้าทุกอย่างเด้งเตือนเท่ากันหมด สุดท้ายไม่มีใครดูอะไรเลย
          </span>
        </div>
      </section>

      {/* ── ตรวจอุปกรณ์ ─────────────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">Firmware Analyze · ตรวจก่อนต่อเข้าเครือข่ายโรงแรม</span>
        <h3>อุปกรณ์ที่ยังเข้าเครือข่ายไม่ได้</h3>
        <p className="led-note">
          กล้องราคาถูกที่ยังใช้รหัสจากโรงงานคือประตูหลังเข้าเครือข่ายทั้งโรงแรม —
          รหัสของทุกรุ่นหาได้จากคู่มือบนเว็บ · เฟิร์มแวร์ที่ออกก่อน {FIRMWARE_CUTOFF}{" "}
          ถือว่าไม่ได้รับแพตช์แล้ว
        </p>

        <ul className="sec-devices">
          {DEVICES.map((d) => {
            const findings = audit(d);
            const ok = canJoinNetwork(d);
            return (
              <li key={d.id} className={ok ? "ok" : "no"}>
                <button onClick={() => setOpenDevice(openDevice === d.id ? null : d.id)}>
                  <span className="sec-dev">
                    <b>{d.name}</b>
                    <span className="sec-meta">
                      {d.vendor} · เฟิร์มแวร์ {d.firmware} · {d.releasedOn}
                    </span>
                  </span>
                  <span className={`led-badge ${ok ? "ok" : "bad"}`}>
                    {ok ? "ต่อเครือข่ายได้" : `ห้ามต่อ · ${findings.filter((f) => f.level === "block").length} ข้อ`}
                  </span>
                </button>
                {openDevice === d.id && (
                  <div className="sec-findings">
                    {findings.length === 0 ? (
                      <p className="sec-clean">ไม่พบข้อบกพร่อง · ตรวจแล้วผ่านทุกข้อ</p>
                    ) : (
                      findings.map((f, i) => (
                        <div key={i} className={`sec-find ${f.level}`}>
                          <span className="sec-lv">{f.level === "block" ? "ห้ามต่อ" : "เตือน"}</span>
                          <div>
                            <b>{f.what}</b>
                            <span>{f.why}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── ผู้ช่วยงานกฎหมาย ────────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">Lawyer · ตอบพร้อมอ้างมาตราให้ตรวจย้อนได้</span>
        <h3>ผู้ช่วยงานกฎหมาย</h3>
        <p className="led-note">
          <b>ถามนอกคลังแล้วมันจะบอกว่าไม่รู้</b> ไม่ใช่เดาให้ฟังดูมั่นใจ —
          คำตอบทางกฎหมายที่อ้างมาตราไม่ได้ อันตรายกว่าไม่ตอบ เพราะคนเอาไปทำตาม
          ลองถามข้อสุดท้ายในรายการดู
        </p>

        <div className="sec-ask">
          <input
            value={q}
            placeholder="พิมพ์คำถาม หรือกดตัวอย่างด้านล่าง"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setAnswer(ask(q))}
          />
          <button className="btn primary" onClick={() => setAnswer(ask(q))}>
            ถาม
          </button>
        </div>
        <div className="sec-samples">
          {SAMPLE_QUESTIONS.map((s) => (
            <button
              key={s}
              className="btn ghost"
              onClick={() => {
                setQ(s);
                setAnswer(ask(s));
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {answer && (
          <div className={`sec-answer ${answer.found ? "" : "none"}`}>
            {answer.found && answer.source ? (
              <>
                <span className="k">
                  {answer.source.law} · {answer.source.section}
                </span>
                <p>{answer.source.text}</p>
                <span className="sec-meta">{answer.note}</span>
              </>
            ) : (
              <>
                <span className="k">ไม่ตอบ</span>
                <p>{answer.note}</p>
              </>
            )}
          </div>
        )}

        <h3 style={{ marginTop: 22 }}>สัญญาที่ต้องบอกล่วงหน้า</h3>
        <table className="led-table">
          <thead>
            <tr>
              <th>คู่สัญญา</th>
              <th>ประเภท</th>
              <th>สิ้นสุด</th>
              <th className="n">ต้องบอกก่อน</th>
              <th className="n">เหลือ</th>
            </tr>
          </thead>
          <tbody>
            {CONTRACTS.map((c) => {
              const left = daysToNotice(c, TODAY);
              return (
                <tr key={c.party}>
                  <td>{c.party}</td>
                  <td>{c.kind}</td>
                  <td>{c.endsOn}</td>
                  <td className="n">{c.noticeDays} วัน</td>
                  <td className={`n ${left <= 30 ? "sec-hot" : ""}`}>
                    {left < 0 ? `เลยมาแล้ว ${-left} วัน` : `${left} วัน`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="led-note">
          สัญญาที่ไม่บอกล่วงหน้าตามกำหนดจะ <b>ต่ออายุอัตโนมัติอีกหนึ่งปี</b> —
          เป็นค่าใช้จ่ายที่หลุดไปโดยไม่มีใครตัดสินใจ
        </p>
      </section>

      {/* ── ร่องรอยการตรวจสอบ ───────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">Audit Trail · ม.35 พ.ร.บ.โรงแรม กำหนดให้ตรวจย้อนได้</span>
        <h3>ใครเปลี่ยนอะไร เมื่อไร และทำไม</h3>
        <p className="led-note">
          <b>“เหตุผล” เป็นช่องบังคับ</b> — รู้ว่าใครเปลี่ยนอะไรแต่ไม่รู้ว่าทำไม
          ยังตอบคำถามที่คนตรวจถามจริง ๆ ไม่ได้ · แถวในนี้{" "}
          <b>ไม่มีเส้นทางไหนลบหรือแก้ได้</b> ซึ่งเป็นทั้งหมดของเรื่อง
        </p>
        <ul className="sec-trail">
          {TRAIL.map((t, i) => (
            <li key={i}>
              <span className="sec-tr-when">{t.at}</span>
              <span className="sec-tr-what">
                <b>{t.action}</b>
                <span className="sec-meta">{t.target}</span>
              </span>
              <span className="sec-tr-diff">
                <s>{t.before}</s> → <b>{t.after}</b>
              </span>
              <span className="sec-tr-who">{t.actor}</span>
              <span className="sec-tr-why">{t.reason}</span>
            </li>
          ))}
        </ul>
        <div className="led-callout">
          <Icon name="shield" />
          <span>
            หลังบ้านตัวจริงเก็บลงตาราง <code>audit_log</code> ที่{" "}
            <b>ไม่มีเส้นทาง API ให้ลบหรือแก้</b> — เอกสารทางกฎหมายที่แก้ได้
            โดยไม่ทิ้งร่องรอย เท่ากับไม่มีค่าตอนถูกตรวจ
          </span>
        </div>
      </section>
    </>
  );
}

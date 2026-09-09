import { useState } from "react";
import { Icon } from "../components/Icon";
import { money } from "../lib/format";
import {
  ANGLES,
  askRule,
  CHECKS,
  draftOrders,
  ITEMS,
  KPIS,
  OT_MULTIPLIER,
  pay,
  readKpi,
  readyToReview,
  SHIFT_HOURS,
  SHIFTS,
  SOPS,
  STAFF,
  type Rule,
} from "../lib/team";

/**
 * ทีมงาน แม่บ้าน และคลังของใช้
 *
 * รวมสามเรื่องไว้จอเดียวเพราะมันคือสายงานเดียวกัน — คนเข้างาน ทำห้อง
 * แล้วของในห้องถูกใช้ไป · แยกเป็นสามจอจะทำให้ต้องเดินไปมาเวลานำเสนอ
 * และบังเอิญเป็นเหตุผลเดียวกับที่โรงแรมจริงอยากได้ระบบเดียว
 */

/** จำนวนการเข้าพักของวันนี้ — ใช้ประเมินอัตราการใช้ของ */
const STAYS_TODAY = 18;

const nameOf = (id: string) => STAFF.find((s) => s.id === id)?.name ?? id;

const SAMPLE_RULES = ["โอทีคิดยังไง", "ลาป่วยได้กี่วัน", "พักเที่ยงกี่ชั่วโมง", "เบิกค่าเดินทางได้ไหม"];

export function Team() {
  const [openSop, setOpenSop] = useState<string | null>("HK-01");
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState(false);
  const [rule, setRule] = useState<Rule | null>(null);

  const drafts = draftOrders(ITEMS, STAYS_TODAY);
  const waiting = CHECKS.filter((c) => c.status === "waiting");

  const ask = (text: string) => {
    setQ(text);
    setRule(askRule(text));
    setAsked(true);
  };

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">Manage Employee &amp; Housekeeper · บัตร NFC ใบเดียว</span>
          <h2>ทีมงาน &amp; คลังของใช้</h2>
        </div>
        <div className="led-state">
          <span className={`led-badge ${drafts.length ? "bad" : "ok"}`}>
            {drafts.length ? `${drafts.length} รายการถึงจุดสั่งซื้อ` : "ของใช้ครบทุกรายการ"}
          </span>
        </div>
      </div>

      {/* ── ลงเวลาและค่าแรง ─────────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">Clock In / Clock Out · วันที่ 8 ก.ย.</span>
        <h3>ลงเวลาด้วยบัตรใบเดิม</h3>
        <p className="led-note">
          บัตร NFC ใบเดียวเปิดประตู ล็อกอินเข้าระบบ และลงเวลา —{" "}
          <b>พนักงานไม่ต้องจำรหัสผ่าน</b> ซึ่งสำคัญกว่าที่คิด เพราะรหัสที่จำไม่ได้
          จะถูกจดไว้ข้างจอเสมอ · ค่าแรงคิดจากเวลาที่ทำจริงเป็นนาที ไม่ปัดเป็นชั่วโมง
        </p>
        <table className="led-table">
          <thead>
            <tr>
              <th>พนักงาน</th>
              <th>บัตร</th>
              <th>เข้า–ออก</th>
              <th className="n">ชั่วโมง</th>
              <th className="n">โอที</th>
              <th className="n">ค่าแรงวันนี้</th>
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map((s) => {
              const st = STAFF.find((x) => x.id === s.staffId)!;
              const p = pay(s, st.hourly);
              return (
                <tr key={s.staffId}>
                  <td>
                    {st.name}
                    <span className="led-note"> · {st.role}</span>
                  </td>
                  <td>
                    <code>{st.card}</code>
                  </td>
                  <td>
                    {s.inAt} – {s.outAt}
                  </td>
                  <td className="n">{p.hours.toFixed(2)}</td>
                  <td className="n">{p.ot ? `${p.ot.toFixed(2)}` : "—"}</td>
                  <td className="n">{money(p.wage)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="led-note">
          กะมาตรฐาน {SHIFT_HOURS} ชั่วโมง · เกินจากนั้นคิด {OT_MULTIPLIER} เท่า ตาม{" "}
          <b>ม.61 พ.ร.บ.คุ้มครองแรงงาน 2541</b> ซึ่งกำหนดว่าไม่น้อยกว่า 1.5 เท่า
        </p>
      </section>

      {/* ── ตัวชี้วัดรายคน ──────────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">KPI For Employee</span>
        <h3>ความเร็วต้องมีคุณภาพอยู่ข้าง ๆ เสมอ</h3>
        <p className="led-note">
          วัด “เวลาเฉลี่ยต่อห้อง” อย่างเดียวคือการสอนให้คนทำเร็วแล้วหยาบ —{" "}
          <b>คอลัมน์งานที่ถูกตีกลับจึงอยู่ติดกันเสมอ ห้ามแยกกันแสดง</b>
        </p>
        <ul className="tm-kpis">
          {KPIS.map((k) => {
            const r = readKpi(k);
            return (
              <li key={k.staffId} className={r.tone}>
                <div className="tm-kpi-who">
                  <b>{nameOf(k.staffId)}</b>
                  <span>{r.text}</span>
                </div>
                <div className="tm-kpi-nums">
                  <span>
                    <i>{k.done}</i> ห้องเสร็จ
                  </span>
                  <span>
                    <i>{k.avgMinutes}</i> นาที/ห้อง
                  </span>
                  <span className={k.bounced ? "hot" : ""}>
                    <i>{k.bounced}</i> ถูกตีกลับ
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── ตรวจมาตรฐานห้อง ─────────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">Image Standard · {waiting.length} ห้องรอหัวหน้าตรวจ</span>
        <h3>สามมุมมาตรฐาน ขาดมุมไหนส่งไม่ได้</h3>
        <ul className="tm-checks">
          {CHECKS.map((c) => {
            const r = readyToReview(c);
            return (
              <li key={c.room} className={c.status}>
                <b>ห้อง {c.room}</b>
                <span className="tm-angles">
                  {ANGLES.map((a) => (
                    <span key={a} className={c.photos.includes(a) ? "on" : ""}>
                      {c.photos.includes(a) ? "✓" : "✕"} {a}
                    </span>
                  ))}
                </span>
                <span className="tm-status">
                  {c.status === "passed" && <span className="led-badge ok">ผ่าน</span>}
                  {c.status === "bounced" && (
                    <>
                      <span className="led-badge bad">ตีกลับ</span>
                      <span className="tm-reason">{c.reason}</span>
                    </>
                  )}
                  {c.status === "waiting" &&
                    (r.ok ? (
                      <span className="led-badge">รอตรวจ</span>
                    ) : (
                      <>
                        <span className="led-badge bad">ส่งไม่ได้</span>
                        <span className="tm-reason">ยังไม่มีรูป {r.missing.join(" · ")}</span>
                      </>
                    ))}
                </span>
                <span className="tm-by">{nameOf(c.staffId)}</span>
              </li>
            );
          })}
        </ul>
        <p className="led-note">
          ตีกลับต้องมีเหตุผลเสมอ — <b>“ทำใหม่” เฉย ๆ ไม่ช่วยให้ครั้งหน้าดีขึ้น</b>
        </p>
      </section>

      {/* ── คลังของใช้และการสั่งซื้อ ────────────────────────────── */}
      <section className="led-sec">
        <span className="k">Examine Inventory &amp; Procurement · เข้าพักวันนี้ {STAYS_TODAY} ห้อง</span>
        <h3>ตัดสต็อกตามการใช้จริง</h3>
        <table className="led-table">
          <thead>
            <tr>
              <th>ของใช้</th>
              <th className="n">คงเหลือ</th>
              <th className="n">จุดสั่งซื้อ</th>
              <th className="n">ใช้/วัน</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((i) => {
              const low = i.onHand < i.reorderAt;
              return (
                <tr key={i.sku}>
                  <td>
                    {i.name}
                    <span className="led-note"> · {i.sku}</span>
                  </td>
                  <td className={`n ${low ? "sec-hot" : ""}`}>
                    {i.onHand} {i.unit}
                  </td>
                  <td className="n">{i.reorderAt}</td>
                  <td className="n">{i.perStay * STAYS_TODAY}</td>
                  <td>{low ? <span className="led-badge bad">ต่ำกว่าจุดสั่ง</span> : "พอ"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {drafts.length > 0 && (
          <>
            <div className="tm-drafts">
              <span className="k">ใบสั่งซื้อที่ระบบร่างรอไว้</span>
              {drafts.map((d) => (
                <div key={d.sku} className="tm-draft">
                  <div>
                    <b>
                      {d.name} × {d.qty}
                    </b>
                    <span>{d.why}</span>
                  </div>
                  <b className="tm-amt">{money(d.cost)}</b>
                </div>
              ))}
            </div>
            <div className="led-callout">
              <Icon name="shield" />
              <span>
                <b>ร่างไว้ให้ ไม่ได้สั่งเอง</b> — ระบบที่สั่งของเองโดยไม่มีคนกดยืนยัน
                วันหนึ่งจะสั่งผิดแล้วไม่มีใครรู้จนของมาถึง
              </span>
            </div>
          </>
        )}
      </section>

      {/* ── คู่มือและผู้ช่วยระเบียบ ──────────────────────────────── */}
      <section className="led-sec">
        <span className="k">SOP · คู่มือที่เปิดอ่านได้จากมือถือหน้างาน</span>
        <h3>คลังคู่มือการทำงาน</h3>
        <ul className="tm-sops">
          {SOPS.map((s) => (
            <li key={s.code}>
              <button onClick={() => setOpenSop(openSop === s.code ? null : s.code)}>
                <span>
                  <b>{s.title}</b>
                  <span className="sec-meta">
                    {s.code} · {s.steps.length} ขั้น · ราว {s.minutes} นาที
                  </span>
                </span>
                <span className="led-badge">{openSop === s.code ? "ปิด" : "เปิดอ่าน"}</span>
              </button>
              {openSop === s.code && (
                <ol className="tm-steps">
                  {s.steps.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>

        <h3 style={{ marginTop: 22 }}>ผู้ช่วยตอบเรื่องระเบียบและสวัสดิการ</h3>
        <p className="led-note">
          เหมือนผู้ช่วยกฎหมาย — <b>ไม่มีต้นทางก็ไม่ตอบ</b> เพราะเรื่องสิทธิของลูกจ้าง
          ตอบผิดแล้วกระทบเงินในกระเป๋าคนจริง ๆ ลองถามข้อสุดท้ายดู
        </p>
        <div className="sec-ask">
          <input
            value={q}
            placeholder="ถามเรื่องระเบียบหรือสวัสดิการ"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(q)}
          />
          <button className="btn primary" onClick={() => ask(q)}>
            ถาม
          </button>
        </div>
        <div className="sec-samples">
          {SAMPLE_RULES.map((s) => (
            <button key={s} className="btn ghost" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
        {asked && (
          <div className={`sec-answer ${rule ? "" : "none"}`}>
            {rule ? (
              <>
                <span className="k">{rule.source}</span>
                <p>{rule.answer}</p>
                <span className="sec-meta">ตอบจากตัวบท ไม่ใช่จากนโยบายที่จำมา</span>
              </>
            ) : (
              <>
                <span className="k">ไม่ตอบ</span>
                <p>
                  ไม่มีต้นทางในคลังสำหรับเรื่องนี้ — ต้องถามฝ่ายบุคคล
                  การเดาเรื่องสิทธิของลูกจ้างกระทบเงินในกระเป๋าคนจริง ๆ
                </p>
              </>
            )}
          </div>
        )}
      </section>

      {/* ── ทะเบียนพนักงาน ──────────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">Enrollment Employee</span>
        <h3>ทะเบียนพนักงาน {STAFF.filter((s) => s.active).length} คน</h3>
        <table className="led-table">
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>ตำแหน่ง</th>
              <th>บัตร NFC</th>
              <th className="n">ค่าแรง/ชม.</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {STAFF.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.role}</td>
                <td>
                  <code>{s.card}</code>
                </td>
                <td className="n">{money(s.hourly)}</td>
                <td>
                  {s.active ? (
                    "ทำงานอยู่"
                  ) : (
                    <span className="led-note">พ้นสภาพ · บัตรถูกยกเลิกแล้ว</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="led-note">
          พ้นสภาพแล้ว <b>ยกเลิกบัตรอย่างเดียว ไม่ลบประวัติ</b> — ลบทิ้งแล้วใบลงเวลา
          และค่าแรงย้อนหลังจะหายไปด้วย ซึ่งเป็นเอกสารที่ต้องเก็บไว้
        </p>
      </section>
    </>
  );
}

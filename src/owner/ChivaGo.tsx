import { useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import {
  canRedeem,
  checkGreen,
  GEOFENCE_M,
  issueStatement,
  PARTNERS,
  sponsorReport,
  verify,
  wallet,
  type Decision,
  type Statement,
  type Submission,
} from "../lib/chivago";

/**
 * ChivaGo — สิทธิพิเศษที่ตรวจสอบได้
 *
 * จอนี้มีไว้พิสูจน์ข้อเดียว — แต้มของที่นี่ **ตรวจย้อนได้** ต่างจากแต้มสะสมทั่วไป
 * ที่เป็นตัวเลขซึ่งใครก็แจกได้ ผู้สนับสนุนหรือหน่วยงานที่เอาไปอ้างจึงตรวจไม่ได้ว่า
 * มีคนมาจริงกี่คน
 *
 * ทุกกล่องในจอนี้กดได้ เพราะข้อโต้แย้งแบบนี้พูดเฉย ๆ ไม่มีน้ำหนัก —
 * ต้องให้ลูกค้ากดปฏิเสธเองแล้วเห็นว่าแต้มไม่ออก และกดแก้ตัวเลขในใบรับรอง
 * แล้วเห็นว่าระบบปฏิเสธการอ่าน
 */

const TODAY = "2026-09-09";

/** คิวรอตรวจ — จงใจใส่เคสที่ต้องปฏิเสธไว้ด้วย ไม่ใช่ผ่านหมดทุกใบ */
const QUEUE: Submission[] = [
  {
    id: "S-401",
    guest: "คุณอนันต์ ศรีสุข",
    guestId: "G-01",
    activity: "เก็บขยะชายหาด · กิจกรรมชุมชน",
    geo: { lat: 18.7883, lng: 98.9853 },
    metres: 40,
    at: "08:12",
    points: 150,
    photo: "🏖️",
  },
  {
    id: "S-402",
    guest: "คุณอนันต์ ศรีสุข",
    guestId: "G-01",
    activity: "ปลูกป่าชุมชนแม่ริม",
    geo: { lat: 18.9102, lng: 98.9007 },
    metres: 85,
    at: "10:30",
    points: 200,
    photo: "🌱",
  },
  {
    id: "S-403",
    guest: "คุณอนันต์ ศรีสุข",
    guestId: "G-01",
    activity: "เวิร์กช็อปแยกขยะ",
    geo: { lat: 18.7885, lng: 98.985 },
    metres: 25,
    at: "14:05",
    points: 100,
    photo: "♻️",
  },
  {
    id: "S-404",
    guest: "คุณมาลี ทองดี",
    guestId: "G-02",
    activity: "เก็บขยะชายหาด · กิจกรรมชุมชน",
    geo: { lat: 18.81, lng: 99.02 },
    metres: 4200,
    at: "09:40",
    points: 150,
    photo: "🏖️",
  },
  {
    id: "S-405",
    guest: "Kenji Tanaka",
    guestId: "G-03",
    activity: "ปั่นจักรยานเลี่ยงรถยนต์",
    geo: null,
    metres: null,
    at: "07:55",
    points: 80,
    photo: "🚲",
  },
];

const HOST = "คุณดวงพร · โฮสต์";

export function ChivaGo() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [stmt, setStmt] = useState<Statement | null>(null);
  const [tampered, setTampered] = useState(false);

  const decided = useMemo(
    () => new Map(decisions.map((d) => [d.submissionId, d])),
    [decisions],
  );
  const w = wallet(QUEUE, decisions);
  const report = sponsorReport(QUEUE, decisions);

  /** จ่ายผูกกับ id ของคำขอ ไม่ใช่กับการกดปุ่ม — กดซ้ำจึงไม่ทำให้แต้มออกสองเท่า */
  const decide = (s: Submission, approved: boolean) => {
    if (decided.has(s.id)) return;
    if (!approved && !reason[s.id]?.trim()) return;
    setDecisions((d) => [
      ...d,
      {
        submissionId: s.id,
        approved,
        reason: approved ? "พิกัดตรง" : reason[s.id].trim(),
        host: HOST,
        at: new Date().toLocaleTimeString("th-TH", { hour12: false }),
      },
    ]);
  };

  const shown = stmt && tampered ? { ...stmt, body: { ...stmt.body, people: 99 } } : stmt;
  const valid = shown ? verify(shown) : false;

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">ChivaGo · Verified Privilege — แอปของเราเอง ต่อ PMS โดยตรง</span>
          <h2>สิทธิพิเศษที่ตรวจสอบได้</h2>
        </div>
        <div className="led-state">
          <span className="led-badge">{QUEUE.length - decisions.length} ใบรอตรวจ</span>
        </div>
      </div>

      {/* ── กระเป๋าแต้ม ─────────────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">แต้มสองชนิด · คนละชั้นความน่าเชื่อถือ</span>
        <h3>กระเป๋าแต้มของ คุณอนันต์ ศรีสุข</h3>
        <div className="cg-wallet">
          <div className="cg-purse green">
            <span className="k">แต้มเขียว · โฮสต์ยืนยันแล้ว</span>
            <b>{w.green.toLocaleString()}</b>
            <span>ต้องอยู่ในพื้นที่จริง รูปมีพิกัดติดมา และโฮสต์ชื่อจริงกดอนุมัติ</span>
          </div>
          <div className="cg-purse trip">
            <span className="k">แต้มทริป · ยืนยันเอง</span>
            <b>{w.trip.toLocaleString()}</b>
            <span>ได้ง่ายกว่า แลกของรางวัลได้ แต่ไม่ผ่านการตรวจ</span>
          </div>
        </div>
        <div className="led-callout">
          <Icon name="shield" />
          <span>
            <b>ห้ามเอาสองยอดมารวมกันแสดงผล</b> — พอรวมแล้วชั้นที่ตรวจได้จะเสียความหมาย
            ทันที และผู้สนับสนุนที่เอาตัวเลขไปอ้างจะตรวจย้อนไม่ได้ว่าส่วนไหนมีคนมาจริง
          </span>
        </div>
      </section>

      {/* ── จอโฮสต์ ─────────────────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">Host Console · คิวงานรอตรวจบนมือถือโฮสต์</span>
        <h3>กดอนุมัติหรือปฏิเสธพร้อมเหตุผล</h3>
        <p className="led-note">
          ปฏิเสธต้องใส่เหตุผลเสมอ ไม่งั้นแขกรู้สึกว่าถูกปฏิเสธมั่ว ๆ แล้วเลิกใช้ ·
          จ่ายแต้มผูกกับเลขคำขอ <b>ไม่ใช่กับการกดปุ่ม</b> โฮสต์กดซ้ำเพราะเน็ตช้า
          แต้มก็ไม่ออกสองเท่า
        </p>

        <ul className="cg-queue">
          {QUEUE.map((s) => {
            const g = checkGreen(s);
            const d = decided.get(s.id);
            return (
              <li key={s.id} className={d ? (d.approved ? "ok" : "no") : ""}>
                <span className="cg-pic">{s.photo}</span>
                <div className="cg-what">
                  <b>{s.activity}</b>
                  <span className="cg-who">
                    {s.guest} · {s.at} · <code>{s.id}</code>
                  </span>
                  <span className={`cg-geo ${g.ok ? "ok" : "no"}`}>
                    {g.ok ? "✓" : "✕"} {g.why}
                  </span>
                </div>
                <div className="cg-act">
                  {d ? (
                    <>
                      <span className={`led-badge ${d.approved ? "ok" : "bad"}`}>
                        {d.approved ? `+${s.points} แต้มเขียว` : `+${Math.round(s.points / 2)} แต้มทริป`}
                      </span>
                      <span className="cg-why">
                        {d.approved ? "อนุมัติ" : "ปฏิเสธ"} · {d.reason} · {d.host}
                      </span>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn primary"
                        disabled={!g.ok}
                        title={g.ok ? "" : "พิกัดไม่ผ่าน — ให้แต้มเขียวไม่ได้"}
                        onClick={() => decide(s, true)}
                      >
                        อนุมัติ
                      </button>
                      <input
                        placeholder="เหตุผลที่ปฏิเสธ"
                        value={reason[s.id] ?? ""}
                        onChange={(e) => setReason((r) => ({ ...r, [s.id]: e.target.value }))}
                      />
                      <button
                        className="btn ghost"
                        disabled={!reason[s.id]?.trim()}
                        onClick={() => decide(s, false)}
                      >
                        ปฏิเสธ
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="led-note">
          รูปที่ไม่มีพิกัดติดมา และรูปที่ถ่ายห่างเกิน {GEOFENCE_M} เมตร{" "}
          <b>กดอนุมัติไม่ได้เลย</b> — ปุ่มปิดตาย ไม่ใช่เตือนแล้วปล่อยผ่าน
        </p>
      </section>

      {/* ── รายงานผู้สนับสนุน ───────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">ESG &amp; Sponsor Report</span>
        <h3>นับคนที่มาจริง ไม่นับการมองเห็น</h3>
        <div className="cg-stats">
          <div>
            <span className="k">คนที่มาจริง</span>
            <b>{report.people}</b>
            <span>นับหัวคนไม่ซ้ำ</span>
          </div>
          <div>
            <span className="k">กิจกรรมที่ผ่านการตรวจ</span>
            <b>{report.activities}</b>
            <span>คนหนึ่งทำสามกิจกรรม = หนึ่งคน</span>
          </div>
          <div>
            <span className="k">แต้มเขียวที่จ่ายไป</span>
            <b>{report.greenPoints.toLocaleString()}</b>
            <span>ทุกแต้มมีคนกดอนุมัติชื่อจริง</span>
          </div>
          <div>
            <span className="k">ปฏิเสธ</span>
            <b>{report.rejected}</b>
            <span>อยู่ในรายงานด้วย ไม่ได้ซ่อน</span>
          </div>
        </div>
        {report.activities > report.people && (
          <div className="led-callout ok">
            <Icon name="shield" />
            <span>
              รายงานนี้บอก <b>{report.people} คน</b> จาก {report.activities} กิจกรรม —
              รายงานที่นับกิจกรรมแล้วเรียกว่า “{report.activities} คน” คือที่มาของตัวเลข ESG
              ที่ตรวจแล้วไม่เหลืออะไร
            </span>
          </div>
        )}
      </section>

      {/* ── ใบรับรอง ────────────────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">Immutable Statement</span>
        <h3>ใบรับรองที่แก้แล้วรู้</h3>
        <div className="led-actions">
          <button
            className="btn primary"
            disabled={report.activities === 0}
            onClick={() => {
              setStmt(issueStatement("คุณอนันต์ ศรีสุข", report, TODAY));
              setTampered(false);
            }}
          >
            ออกใบรับรอง
          </button>
          <button className="btn ghost" disabled={!stmt} onClick={() => setTampered((t) => !t)}>
            {tampered ? "คืนค่าเดิม" : "ลองแก้ตัวเลขในไฟล์"}
          </button>
        </div>
        {report.activities === 0 && (
          <p className="led-note">อนุมัติอย่างน้อยหนึ่งใบก่อน ถึงจะออกใบรับรองได้</p>
        )}

        {shown && (
          <div className={`cg-stmt ${valid ? "" : "broken"}`}>
            <div className="cg-stmt-head">
              <span className="k">{shown.no}</span>
              <span className={`led-badge ${valid ? "ok" : "bad"}`}>
                {valid ? "รหัสตรงกัน · อ่านได้" : "รหัสไม่ตรง · ปฏิเสธการอ่าน"}
              </span>
            </div>
            <dl>
              <dt>ผู้ถือ</dt>
              <dd>{shown.guest}</dd>
              <dt>วันที่ออก</dt>
              <dd>{shown.issuedAt}</dd>
              <dt>คนที่มาจริง</dt>
              <dd>{shown.body.people} คน</dd>
              <dt>กิจกรรมที่ผ่านการตรวจ</dt>
              <dd>{shown.body.activities} กิจกรรม</dd>
              <dt>รหัสตรวจสอบ</dt>
              <dd>
                <code>{shown.seal}</code>
              </dd>
            </dl>
            {!valid && (
              <p className="cg-broken">
                เนื้อในถูกแก้หลังออกใบ รหัสที่คำนวณใหม่ไม่ตรงกับที่ผนึกไว้ —
                <b> ระบบปฏิเสธการอ่าน ไม่ใช่เตือนแล้วอ่านต่อ</b>
              </p>
            )}
          </div>
        )}
        <div className="led-callout">
          <Icon name="shield" />
          <span>
            <b>นี่คือรหัสตรวจสอบ ไม่ใช่ลายเซ็นดิจิทัล</b> — กันการแก้และพิสูจน์ว่าไฟล์
            ที่ถืออยู่ตรงกับตอนออก แต่คนที่ตั้งใจปลอมและคำนวณรหัสใหม่ได้ก็ยังทำได้
            ของจริงต้องเป็น SHA-256 พร้อมลายเซ็นของผู้ออก ซึ่งยังไม่ได้ทำ
          </span>
        </div>
      </section>

      {/* ── เครือข่ายพันธมิตร ──────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">B2B Partner Network</span>
        <h3>แลกสิทธิ์ข้ามธุรกิจในย่านเดียวกัน</h3>
        <p className="led-note">
          โรงแรม ร้านอาหาร และผู้ให้บริการในพื้นที่เดียวกันแลกสิทธิ์กันได้ —
          แขกของคุณกลายเป็นลูกค้าประจำของย่าน ไม่ใช่ของโรงแรมอย่างเดียว
        </p>
        <ul className="cg-partners">
          {PARTNERS.map((p) => {
            const r = canRedeem(p, w);
            return (
              <li key={p.name} className={r.ok ? "" : "off"}>
                <div>
                  <b>{p.perk}</b>
                  <span className="cg-who">
                    {p.name} · {p.kind}
                  </span>
                </div>
                <div className="cg-cost">
                  <span className={`led-badge ${p.greenOnly ? "ok" : ""}`}>
                    {p.greenOnly ? "แต้มเขียวเท่านั้น" : "ใช้ได้ทั้งสองชนิด"}
                  </span>
                  <b>{p.cost.toLocaleString()}</b>
                  <span className="cg-why">{r.why}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

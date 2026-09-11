import { useState } from "react";
import { useHotel } from "../contexts";
import { money } from "../lib/format";
import { TODAY, fmtShort } from "../lib/date";
import {
  REWARDS,
  avgScore,
  occasions,
  tierOf,
  type Guest,
  type Occasion,
} from "../lib/loyalty";
import { Icon } from "../components/Icon";

/**
 * ลูกค้าเดิม · แต้ม · โอกาสที่ควรทัก
 *
 * โรงแรมส่วนใหญ่รู้จักแขกเฉพาะตอนอยู่ในห้อง เช็กเอาต์แล้วก็ลืมกันไป
 * ทั้งที่ค่าเรียกลูกค้าเก่ากลับมาถูกกว่าค่าหาลูกค้าใหม่หลายเท่า
 *
 * ระบบไม่ส่งข้อความเอง — เตรียมข้อความให้แล้วคนกดส่ง
 * เพราะข้อความที่ส่งผิดคนหรือผิดจังหวะทำลายความสัมพันธ์เร็วกว่าที่ไม่ส่งเลย
 */
export function Guests() {
  const hotel = useHotel();
  const [within, setWithin] = useState(90);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Occasion | null>(null);

  const guests = [...hotel.state.guests].sort((a, b) => b.spend - a.spend);
  const score = avgScore(guests);
  const due = occasions(guests, TODAY, within);
  const repeat = guests.filter((g) => g.stays >= 2).length;
  const points = guests.reduce((s, g) => s + g.points, 0);
  const open = guests.find((g) => g.id === openId) ?? null;

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">ลูกค้าเดิม · {guests.length} คนในระบบ</span>
          <h2>ประวัติเข้าพัก แต้ม และรีวิว</h2>
        </div>
      </div>

      <p className="lead">
        ประวัติสร้างเองจากการเช็กเอาต์จริง — ปิดบิลที่หน้าเคาน์เตอร์แล้วจำนวนครั้งเข้าพัก
        ยอดใช้จ่าย และแต้ม ของคนนั้นขยับทันที ไม่ต้องมาคีย์ซ้ำ
      </p>

      <div className="fin-top">
        <div className="fin-card">
          <span className="k">ลูกค้าที่กลับมาซ้ำ</span>
          <strong>
            {repeat} / {guests.length}
          </strong>
          <span className="sub">
            คิดเป็น {guests.length ? Math.round((repeat / guests.length) * 100) : 0}% ของฐานลูกค้า
          </span>
        </div>
        <div className="fin-card">
          <span className="k">คะแนนความพอใจ</span>
          <strong>{score === null ? "—" : `${score} / 5`}</strong>
          <span className="sub">
            {score === null
              ? "ยังไม่มีรีวิว"
              : `จาก ${guests.reduce((s, g) => s + g.feedback.length, 0)} รีวิวที่แขกให้ตอนเช็กเอาต์`}
          </span>
        </div>
        <div className="fin-card">
          <span className="k">แต้มค้างในระบบ</span>
          <strong>{points.toLocaleString("en-US")}</strong>
          <span className="sub">
            เท่ากับภาระผูกพัน ~{money(Math.round(points * 0.5))} ถ้าแลกหมดพร้อมกัน
          </span>
        </div>
      </div>

      {/* ── โอกาสที่ควรทัก ── */}
      <div className="fin-sec top">
        <span className="k">โอกาสที่ควรทัก · อีก {within} วันข้างหน้า</span>
        <span className="hint">
          ระบบเตรียมข้อความให้ แต่ไม่ส่งเอง — คนอ่านแล้วกดส่งเสมอ
        </span>
        <span className="seg">
          {[30, 60, 90].map((d) => (
            <button key={d} className={within === d ? "on" : ""} onClick={() => setWithin(d)}>
              {d} วัน
            </button>
          ))}
        </span>
      </div>

      {due.length === 0 ? (
        <p className="lead">
          ไม่มีโอกาสที่ควรทักในช่วงนี้ — ลองขยายเป็น 90 วัน หรือรอให้มีแขกเช็กเอาต์เพิ่ม
        </p>
      ) : (
        <div className="occ-grid">
          {due.slice(0, 8).map((o, i) => (
            <button
              key={`${o.guest.id}-${o.kind}-${i}`}
              className={`occ ${o.kind}`}
              onClick={() => setDraft(o)}
            >
              <span className="tagline">{o.label}</span>
              <strong>{o.guest.name}</strong>
              <span className="why">{o.why}</span>
              <span className="cta">
                <Icon name="send" size={13} /> ดูข้อความที่เตรียมไว้
              </span>
            </button>
          ))}
        </div>
      )}

      {draft && <DraftBox occasion={draft} onClose={() => setDraft(null)} />}

      {/* ── ตารางลูกค้า ── */}
      <div className="fin-sec top">
        <span className="k">ลูกค้าทั้งหมด</span>
        <span className="hint">กดชื่อเพื่อดูประวัติ รีวิว และแลกของรางวัล</span>
      </div>

      <div className="calwrap">
        <table className="calgrid gu-table">
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>ระดับ</th>
              <th className="n">เข้าพัก</th>
              <th className="n">ใช้จ่ายสะสม</th>
              <th className="n">แต้ม</th>
              <th>ครั้งล่าสุด</th>
              <th className="n">รีวิว</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => {
              const last = g.feedback[0];
              return (
                <tr
                  key={g.id}
                  className={openId === g.id ? "on" : ""}
                  onClick={() => setOpenId(openId === g.id ? null : g.id)}
                >
                  <td className="nm">
                    <b>{g.name}</b>
                    {g.foreign && <span className="tag wait">ต่างชาติ</span>}
                  </td>
                  <td>{tierOf(g).label}</td>
                  <td className="n">{g.stays}</td>
                  <td className="n">{money(g.spend)}</td>
                  <td className="n">
                    <b>{g.points.toLocaleString("en-US")}</b>
                  </td>
                  <td>{g.lastStay ? fmtShort(g.lastStay) : "—"}</td>
                  <td className="n">
                    {last ? (
                      <span className={`stars s${last.score}`}>
                        {"★".repeat(last.score)}
                        {"☆".repeat(5 - last.score)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && <GuestCard guest={open} />}

      <div className="fin-note">
        <strong>สิ่งที่ยังไม่ทำ — พูดตรง ๆ</strong>
        <ul>
          <li>
            <b>ยังไม่ส่งข้อความออกจริง</b> — ระบบร่างให้และเปิดให้คัดลอก
            แต่การส่งเข้า LINE หรือ SMS ต้องต่อ API ของช่องทางนั้นก่อน
          </li>
          <li>
            <b>จับคู่ลูกค้าด้วยชื่อ</b> — ถ้าสะกดต่างกันจะกลายเป็นคนละคน
            ของจริงควรผูกกับเบอร์โทรหรือเลขบัตรประชาชน
          </li>
          <li>
            <b>แต้มยังไม่ผูกกับการจอง</b> — แลกของรางวัลแล้วแต้มถูกหัก
            แต่ต้องแจ้งเคาน์เตอร์เองว่าจะให้ของเมื่อไร
          </li>
        </ul>
      </div>
    </>
  );
}

/** ข้อความที่เตรียมไว้ — แก้ได้ก่อนคัดลอก ระบบไม่ส่งเอง */
function DraftBox({ occasion, onClose }: { occasion: Occasion; onClose: () => void }) {
  const [text, setText] = useState(occasion.draft);
  const [copied, setCopied] = useState(false);

  return (
    <div className="occ-draft">
      <div className="head">
        <div>
          <span className="k">ข้อความถึง {occasion.guest.name}</span>
          <strong>{occasion.label}</strong>
        </div>
        <button className="btn ghost sm" onClick={onClose}>
          ปิด
        </button>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      <div className="foot">
        <span className="hint">
          อ่านให้จบก่อนส่ง — ข้อความที่ผิดจังหวะทำลายความสัมพันธ์เร็วกว่าไม่ส่งเลย
        </span>
        <button
          className="btn primary"
          onClick={() => {
            navigator.clipboard?.writeText(text).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        >
          <Icon name="check" size={15} />
          {copied ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}
        </button>
      </div>
    </div>
  );
}

/** ประวัติรายคน + แลกของรางวัล */
function GuestCard({ guest }: { guest: Guest }) {
  const hotel = useHotel();
  const tier = tierOf(guest);

  return (
    <div className="gu-card">
      <div className="gu-head">
        <div>
          <span className="k">
            {tier.label} · เข้าพัก {guest.stays} ครั้ง
            {guest.since ? ` ตั้งแต่ ${fmtShort(guest.since)}` : ""}
          </span>
          <h3>{guest.name}</h3>
          <p>
            สิทธิ์ระดับนี้: {tier.perk}
            {guest.phone ? ` · ${guest.phone}` : ""}
            {guest.birthday ? ` · วันเกิด ${guest.birthday}` : ""}
          </p>
        </div>
        <div className="pts">
          <span>แต้มคงเหลือ</span>
          <strong>{guest.points.toLocaleString("en-US")}</strong>
        </div>
      </div>

      <div className="gu-split">
        <div>
          <span className="k">รีวิวที่เคยให้</span>
          {guest.feedback.length === 0 ? (
            <p className="lead">ยังไม่เคยให้รีวิว</p>
          ) : (
            <ul className="gu-fb">
              {guest.feedback.map((f, i) => (
                <li key={i}>
                  <span className={`stars s${f.score}`}>
                    {"★".repeat(f.score)}
                    {"☆".repeat(5 - f.score)}
                  </span>
                  <div>
                    {f.text && <p>{f.text}</p>}
                    <span>
                      {fmtShort(f.at)}
                      {f.room ? ` · ห้อง ${f.room}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <span className="k">แลกของรางวัล</span>
          <ul className="gu-rewards">
            {REWARDS.map((r) => {
              const can = guest.points >= r.cost;
              return (
                <li key={r.id} className={can ? "" : "off"}>
                  <div>
                    <strong>{r.label}</strong>
                    <span>{r.note}</span>
                  </div>
                  <button
                    className="btn ghost sm"
                    disabled={!can}
                    title={can ? undefined : `ต้องมีอีก ${r.cost - guest.points} แต้ม`}
                    onClick={() =>
                      hotel.dispatch({
                        type: "REDEEM",
                        guestId: guest.id,
                        rewardId: r.id,
                        cost: r.cost,
                        label: r.label,
                      })
                    }
                  >
                    {r.cost.toLocaleString("en-US")} แต้ม
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

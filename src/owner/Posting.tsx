import { useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { SAMPLES, TRAPS, withAmount, type Doc, type Sample } from "../lib/posting";
import { CHART, RULES, evaluate } from "../vendor/ledger-engine.mjs";

/**
 * เครื่องยนต์ลงบัญชี — กดยิงเอกสารจริงผ่านกฎจริง
 *
 * ต่างจากจอ “บัญชีคู่” ตรงไหน
 * ---------------------------
 * จอบัญชีคู่แสดงว่า *เราคิดว่า* บิลใบหนึ่งควรลงเป็นเดบิตเครดิตอะไร
 * จอนี้ไม่คิดอะไรเลย — มันส่งเอกสารที่ระบบส่งออกจริง เข้า **เครื่องยนต์กฎ
 * ตัวเดียวกับที่โปรแกรมบัญชี Ledger Bridge ใช้ลงจริง** แล้วเอาคำตอบมาแสดง
 *
 * ทำไมต้องแยกเป็นสองจอ ไม่รวมเป็นจออันเดียว
 * ------------------------------------------
 * เพราะคำตอบไม่เหมือนกันได้ และถ้าไม่เหมือน นั่นคือสิ่งที่ต้องเห็น ไม่ใช่สิ่งที่
 * ต้องกลบ · ถ้ารวมจอแล้วให้เครื่องยนต์เป็นคนตอบอย่างเดียว วันที่กฎเปลี่ยน
 * เราจะไม่รู้เลยว่าความเข้าใจของเราเพี้ยนไปตั้งแต่เมื่อไหร่
 *
 * ไฟล์เครื่องยนต์อยู่ที่ `src/vendor/ledger-engine.mjs` · ห้ามแก้ด้วยมือ
 * ดึงใหม่ด้วย `node tools/sync-ledger-engine.mjs`
 */
export function Posting() {
  const [pick, setPick] = useState<Sample>(SAMPLES[0]);
  const [amount, setAmount] = useState<string>(
    () => String(SAMPLES[0].doc[SAMPLES[0].tweak!.field] ?? ""),
  );
  const [trap, setTrap] = useState<string | null>(null);
  const [showDoc, setShowDoc] = useState(false);

  const choose = (s: Sample) => {
    setPick(s);
    setTrap(null);
    setAmount(s.tweak ? String(s.doc[s.tweak.field] ?? "") : "");
  };

  const doc: Doc = useMemo(() => {
    const base = pick.tweak ? withAmount(pick, amount) : pick.doc;
    const t = TRAPS.find((x) => x.key === trap);
    return t ? t.make(base) : base;
  }, [pick, amount, trap]);

  const result = useMemo(() => evaluate(pick.docType, doc), [pick, doc]);

  const used = useMemo(() => {
    if (!result.ok) return [];
    const codes = new Set(result.postings.map((p) => p.account));
    return CHART.filter((a) => codes.has(a.code));
  }, [result]);

  return (
    <div className="pg">
      <div className="deskhead">
        <div>
          <span className="k">บัญชี · เครื่องยนต์กฎของ Ledger Bridge</span>
          <h2>เอกสารใบนี้ ลงบัญชีเป็นอะไร — ถามของจริง ไม่ใช่เดาให้ดู</h2>
        </div>
        <span className="n">กฎ {RULES.length} ชนิด · ผัง {CHART.length} รหัส</span>
      </div>

      <p className="pg-why">
        ตัวเลขในจอนี้ไม่ได้คิดในเดโม · มันมาจากไฟล์กฎตัวเดียวกับที่โปรแกรมบัญชีใช้ลงจริง
        แก้กฎฝั่งโน้นเมื่อไหร่ จอนี้เปลี่ยนตามทันที ถ้าไม่ตรงกันแปลว่ามีอะไรผิด
        และนั่นคือสิ่งที่ควรเห็นตั้งแต่ตอนนี้ ไม่ใช่ตอนปิดงบ
      </p>

      {/* ══ เลือกเอกสาร ══════════════════════════════════════════ */}
      <section className="pg-sec">
        <h3>เลือกเหตุการณ์</h3>
        <div className="pg-pick">
          {SAMPLES.map((s) => (
            <button
              key={s.key}
              className={pick.key === s.key ? "on" : ""}
              onClick={() => choose(s)}
            >
              <b>{s.title}</b>
              <span className="dt">{s.docType}</span>
              <span className="when">{s.when}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ══ แก้ตัวเลข ════════════════════════════════════════════ */}
      <section className="pg-sec">
        <h3>ลองเปลี่ยนตัวเลขดู</h3>
        <p className="pg-why">
          เงินส่งเป็นข้อความเสมอ ไม่ใช่ตัวเลข — ทศนิยมฐานสองเก็บ 0.1 ไม่ตรงตั้งแต่แรก
          พอบวกกันหลายพันบรรทัดจะเพี้ยนเป็นสตางค์ แล้วงบไม่ลง
        </p>
        <div className="pg-in">
          {pick.tweak ? (
            <label>
              <span>{pick.tweak.label}</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                spellCheck={false}
              />
            </label>
          ) : (
            <span className="pg-nofix">
              เอกสารชนิดนี้มีหลายช่องที่ต้องตรงกัน แก้ช่องเดียวจะทำให้ไม่สมดุลเสมอ
              จึงล็อกไว้ทั้งใบ
            </span>
          )}
          <div className="pg-traps">
            {TRAPS.map((t) => (
              <button
                key={t.key}
                className={trap === t.key ? "on" : ""}
                onClick={() => setTrap(trap === t.key ? null : t.key)}
                title={t.why}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {trap && (
          <p className="pg-trapwhy">
            <Icon name="shield" size={14} className="ic" />
            {TRAPS.find((x) => x.key === trap)!.why}
          </p>
        )}
      </section>

      {/* ══ คำตอบจากเครื่องยนต์ ══════════════════════════════════ */}
      <section className="pg-sec">
        <h3>ใบสำคัญที่ได้</h3>
        {result.ok ? (
          <>
            <table className="pg-t">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อบัญชี</th>
                  <th className="r">เดบิต</th>
                  <th className="r">เครดิต</th>
                </tr>
              </thead>
              <tbody>
                {result.postings.map((p, i) => (
                  <tr key={i}>
                    <td className="code">{p.account}</td>
                    <td>{p.name}</td>
                    <td className="r">{p.side === "D" ? p.amount : ""}</td>
                    <td className="r">{p.side === "C" ? p.amount : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>รวม</td>
                  <td className="r">{result.debit}</td>
                  <td className="r">{result.credit}</td>
                </tr>
              </tfoot>
            </table>
            <p className="pg-ok">
              <Icon name="check" size={14} className="ic" />
              เดบิตเท่าเครดิตที่ {result.debit} — ปลายทางไม่รับใบสำคัญที่ไม่สมดุล
              ตรวจตั้งแต่ก่อนลง ไม่ใช่ไปเจอตอนกระทบยอด
            </p>
          </>
        ) : (
          <div className="pg-err">
            <span className="code">{result.code}</span>
            <p>{result.message}</p>
            <span className="hint">
              นี่คือข้อความจริงที่ระบบบัญชีตอบกลับ ไม่ใช่ข้อความที่เดโมแต่งขึ้น
              — ของจริงก็จะถูกปฏิเสธแบบนี้ ไม่ใช่ลงผิดแล้วเงียบ
            </span>
          </div>
        )}
      </section>

      {/* ══ ผังบัญชีที่ใบนี้แตะ ══════════════════════════════════ */}
      {used.length > 0 && (
        <section className="pg-sec">
          <h3>ผังบัญชีที่ใบนี้แตะ</h3>
          <div className="pg-chart">
            {used.map((a) => (
              <div key={a.code}>
                <b>{a.code}</b>
                <span>{a.name}</span>
                <span className={`sd ${a.side === "D" ? "d" : "c"}`}>
                  {a.side === "D" ? "ด้านเดบิต" : "ด้านเครดิต"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══ เอกสารดิบ ════════════════════════════════════════════ */}
      <section className="pg-sec">
        <h3>
          เอกสารที่ส่งออกจริง
          <button className="pg-toggle" onClick={() => setShowDoc(!showDoc)}>
            {showDoc ? "ซ่อน" : "ดูข้อมูลดิบ"}
          </button>
        </h3>
        <p className="pg-why">
          รูปร่างนี้ตรงกับที่ <code>server/pms/events.py</code> ส่งออกจริง ไม่ใช่รูปที่ทำให้เดโมดูสวย
        </p>
        {showDoc && <pre className="pg-json">{JSON.stringify(doc, null, 2)}</pre>}
      </section>

      {/* ══ กฎที่ตั้งไว้แล้ว ═════════════════════════════════════ */}
      <section className="pg-sec">
        <h3>กฎที่ตั้งไว้แล้ว</h3>
        <div className="pg-rules">
          {RULES.map((r) => (
            <div key={r.docType}>
              <b>{r.docType}</b>
              <span>{r.name}</span>
              <span className="v">{r.lineCount} บรรทัด · รุ่น {r.version}</span>
            </div>
          ))}
          <div className="none">
            <b>DEP</b>
            <span>รับมัดจำ — ยังไม่ได้ตั้งกฎ</span>
            <span className="v">
              รอคำตอบว่ามัดจำมี VAT ตั้งแต่รับหรือตอนเข้าพัก · เปลี่ยนคำตอบแล้วกฎเปลี่ยนทั้งชุด
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

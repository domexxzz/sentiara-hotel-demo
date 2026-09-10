import { useState } from "react";
import { Icon } from "../components/Icon";
import {
  baht2,
  creditTotal,
  debitTotal,
  eventPayload,
  expenseEntry,
  grossOf,
  isBalanced,
  moneyString,
  postingResult,
  reverse,
  satang,
  splitVatSatang,
  trialBalance,
  WHT,
  type Entry,
  type FolioInput,
} from "../lib/ledger";

/**
 * ระบบบัญชีคู่ — จากบิลถึงงบการเงิน
 *
 * จอนี้มีไว้ตอบคำถามเดียวที่เจ้าของกิจการถามเสมอ — *"แล้วมันเข้าโปรแกรมบัญชี
 * ของผมยังไง"* คำตอบที่เป็นสไลด์ไม่พอ เพราะสิ่งที่เขากลัวคือตัวเลขไม่ตรง
 * ต้องกดดูของจริงได้ว่าบิลใบหนึ่งกลายเป็นเดบิตเครดิตอะไร และกดส่งซ้ำแล้ว
 * เกิดอะไรขึ้น
 *
 * ตัวเลขทุกตัวคิดด้วยกติกาเดียวกับหลังบ้านตัวจริงที่ต่อกับ Ledger Bridge อยู่แล้ว
 * (`server/pms/`) ไม่ได้แต่งขึ้นเพื่อโชว์
 */

const VAT = 7;

/** บิลตัวอย่าง — เข้าพักจริงสองคืน มีทั้งอาหาร บริการ และส่วนลด */
const FOLIO: FolioInput = {
  ref: "BK-7C41A9",
  room: "301",
  guest: "คุณอนันต์ ศรีสุข",
  businessDate: "2026-09-08",
  room_: satang(3300),
  fnb: satang(130),
  service: satang(120),
  discount: satang(200),
  paid: satang(3000),
  vatPct: VAT,
};

const EXPENSE = {
  ref: "EX-2291",
  label: "จ้างช่างซ่อมแอร์ห้อง 301",
  businessDate: "2026-09-08",
  amount: satang(9800),
};

type Sent = { at: string; skipped: boolean };

export function Ledger() {
  const [sends, setSends] = useState<Sent[]>([]);
  const [reversed, setReversed] = useState(false);
  const [whtKind, setWhtKind] = useState("service");
  const [showJson, setShowJson] = useState(false);

  const gross = grossOf(FOLIO);
  const vat = splitVatSatang(gross, VAT);
  const stay = postingResult(FOLIO);
  const exp = expenseEntry({ ...EXPENSE, kind: whtKind });
  const rev = reversed ? reverse(stay, "2026-09-09") : null;

  const entries: Entry[] = [stay, exp, ...(rev ? [rev] : [])];
  const trial = trialBalance(entries);
  const trialDr = trial.reduce((s, r) => s + r.debit, 0);
  const trialCr = trial.reduce((s, r) => s + r.credit, 0);

  const send = () =>
    setSends((s) => [
      ...s,
      {
        at: new Date().toLocaleTimeString("th-TH", { hour12: false }),
        skipped: s.length > 0,   // ครั้งแรกเท่านั้นที่ปลายทางรับเข้าไปจริง
      },
    ]);

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">Double-Entry Accounting · ต่อกับโปรแกรมบัญชีจริง</span>
          <h2>ระบบบัญชีคู่</h2>
        </div>
        <div className="led-state">
          <span className={`led-badge ${sends.length ? "ok" : ""}`}>
            {sends.length ? "ต่อกับโปรแกรมบัญชีแล้ว" : "ยังไม่ได้ส่งวันนี้"}
          </span>
        </div>
      </div>

      {/* ── 1 · เราส่งอะไรออกไป ─────────────────────────────────── */}
      <section className="led-sec">
        <div className="led-head">
          <div>
            <span className="k">ขั้นที่ 1 · PMS ส่งเหตุการณ์ ไม่ได้ส่งรายการบัญชี</span>
            <h3>บิลใบนี้ออกไปหน้าตาแบบนี้</h3>
          </div>
          <button className="btn ghost" onClick={() => setShowJson((v) => !v)}>
            {showJson ? "ซ่อนข้อมูลดิบ" : "ดูข้อมูลดิบที่ส่งจริง"}
          </button>
        </div>

        <p className="led-note">
          โรงแรมรู้ว่าคืนนี้ขายห้องได้เท่าไร แต่ <b>ไม่รู้ว่าเงินก้อนนั้นลงบัญชีตัวไหน
          และไม่ควรต้องรู้</b> เพราะผังบัญชีของแต่ละที่ไม่เหมือนกัน และนักบัญชีย้ายบัญชี
          เมื่อไรก็ได้ การแปลงเป็นเดบิตเครดิตจึงเป็นหน้าที่ของกฎที่นักบัญชีเซ็นรับ
        </p>

        <table className="led-table">
          <tbody>
            <tr>
              <td>ค่าห้อง · 2 คืน</td>
              <td className="n">{baht2(FOLIO.room_)}</td>
            </tr>
            <tr>
              <td>อาหารและเครื่องดื่ม</td>
              <td className="n">{baht2(FOLIO.fnb)}</td>
            </tr>
            <tr>
              <td>บริการอื่น · ซักรีด</td>
              <td className="n">{baht2(FOLIO.service)}</td>
            </tr>
            <tr>
              <td>ส่วนลดลูกค้าเก่า</td>
              <td className="n">−{baht2(FOLIO.discount)}</td>
            </tr>
            <tr className="tot">
              <td>
                <b>ยอดรวมที่แขกจ่าย</b>
              </td>
              <td className="n">
                <b>{baht2(gross)}</b>
              </td>
            </tr>
          </tbody>
        </table>

        {showJson && (
          <pre className="led-json">{JSON.stringify(eventPayload(FOLIO), null, 2)}</pre>
        )}

        <div className="led-facts">
          <Fact
            title="เงินเป็นสตางค์จำนวนเต็ม"
            body={`ยอดนี้เก็บเป็น ${gross} สตางค์ ไม่ใช่ ${gross / 100} บาท · 0.1 + 0.2 ไม่เท่ากับ 0.3 ในเลขทศนิยม และความคลาดเคลื่อนสะสมจนงบไม่ลง`}
          />
          <Fact
            title="จำนวนเงินส่งเป็นสตริง"
            body={`ส่ง "${moneyString(gross)}" ไม่ใช่ ${gross / 100} · ตัวแปลง JSON ทำเลขเพี้ยนตั้งแต่ก่อนถึงโค้ดที่จะตรวจ`}
          />
          <Fact
            title="วันทำการ ไม่ใช่เวลาเครื่อง"
            body={`ส่งวันที่ ${FOLIO.businessDate} · งานปิดยอดที่รันตอนตีสองของวันที่ 9 เป็นรายการของวันที่ 8 ถ้าใช้เวลาเครื่องยอดทั้งคืนไปตกผิดวัน`}
          />
        </div>
      </section>

      {/* ── 2 · ปลายทางแปลงเป็นใบสำคัญ ───────────────────────────── */}
      <section className="led-sec">
        <span className="k">ขั้นที่ 2 · กฎลงบัญชีที่นักบัญชีเซ็นรับ แปลงให้เอง</span>
        <h3>ใบสำคัญที่ได้</h3>
        <p className="led-note">
          ราคาห้องที่ประกาศเป็นราคารวมภาษีแล้ว จึงต้อง <b>ถอด VAT ออก ไม่ใช่บวกเพิ่ม</b>{" "}
          ตาม ม.86/4 (6) ประมวลรัษฎากร — บวกเพิ่มจากยอดที่แขกเห็นคือเก็บเงินเกิน
        </p>
        <JournalTable entry={stay} />

        <div className="led-split">
          <div className="led-card">
            <span className="k">ตรวจก่อนออกจากบ้าน</span>
            <b className={isBalanced(stay) ? "ok" : "bad"}>
              {isBalanced(stay) ? "เดบิตเท่าเครดิต ✓" : "ไม่ลงตัว · ส่งไม่ได้"}
            </b>
            <span className="led-note">
              เดบิต {baht2(debitTotal(stay))} = เครดิต {baht2(creditTotal(stay))}{" "}
              · ไม่ลงตัวคือหยุด ไม่ใช่ส่งออกไปให้ฝ่ายบัญชีมาตามทีหลัง
            </span>
          </div>
          <div className="led-card">
            <span className="k">ภาษีขายตรงกับใบกำกับภาษี</span>
            <b>{baht2(vat.vat)}</b>
            <span className="led-note">
              ฐาน {baht2(vat.base)} + ภาษี {baht2(vat.vat)} ={" "}
              {baht2(vat.gross)} เป๊ะ · เอกสารที่ลูกค้าถือกับที่ลงบัญชี
              ต้องเป็นตัวเลขชุดเดียวกัน ต่างกันสตางค์เดียวก็กระทบยอดไม่ลง
            </span>
          </div>
        </div>
      </section>

      {/* ── 3 · ส่งจริง กดได้ ───────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">ขั้นที่ 3 · ส่งเข้าโปรแกรมบัญชี</span>
        <h3>ส่งซ้ำกี่ครั้งก็ไม่เกิดบัญชีซ้ำ</h3>
        <p className="led-note">
          เน็ตหลุดกลางคันแล้วไม่รู้ว่าถึงหรือเปล่า — กดส่งซ้ำได้เลย ทุกเหตุการณ์มี{" "}
          <code>eventId</code> ที่ผูกกับเลขบิล <b>ไม่ใช่เวลาที่ส่ง</b> ส่งกี่ครั้ง
          รหัสก็เท่าเดิม แล้วปลายทางลงบัญชีให้ครั้งเดียว
        </p>

        <div className="led-actions">
          <button className="btn primary" onClick={send}>
            {sends.length === 0 ? "ส่งเข้าโปรแกรมบัญชี" : "ลองส่งซ้ำอีกครั้ง"}
          </button>
          <button className="btn ghost" disabled title="ใบสำคัญที่ลงแล้วแก้ไม่ได้">
            แก้ใบสำคัญ · ทำไม่ได้
          </button>
          <button
            className="btn ghost"
            disabled={sends.length === 0 || reversed}
            onClick={() => setReversed(true)}
          >
            ลงผิด → ตั้งรายการกลับ
          </button>
        </div>

        {sends.length > 0 && (
          <ul className="led-sends">
            {sends.map((s, i) => (
              <li key={i} className="led-send">
                <span className="led-badge ok">{s.skipped ? "ข้าม" : "202 รับแล้ว"}</span>
                <span>
                  ครั้งที่ {i + 1} · {s.at} ·{" "}
                  <code>{eventPayload(FOLIO).eventId}</code>
                </span>
                <span className="led-callout">
                  {s.skipped
                    ? "รหัสเดิม ปลายทางลงบัญชีไปแล้ว ไม่ลงซ้ำ"
                    : "รับไว้แล้ว รอกฎลงบัญชีทำงาน"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="led-callout">
          <Icon name="shield" />{" "}
          <b>ตอบว่ารับแล้ว ไม่ได้แปลว่าลงบัญชีแล้ว</b> — เหตุการณ์ไปรอที่หน้า
          “งานค้างจาก PMS” จนกฎลงบัญชีทำงาน ซึ่งถูกต้องแล้ว ไม่ใช่ความผิดพลาด
        </div>

        {rev && (
          <>
            <p className="led-note">
              <b>ลงแล้วแก้ไม่ได้ ลบไม่ได้</b> — ใบสำคัญเป็นตารางเขียนอย่างเดียว
              บังคับด้วยทริกเกอร์ในฐานข้อมูล แม้เขียนคำสั่งตรง ๆ ก็ไม่ผ่าน
              ลงผิดต้องตั้งรายการกลับ ซึ่งเป็นวิธีที่ผู้สอบบัญชียอมรับ
            </p>
            <JournalTable entry={rev} />
          </>
        )}
      </section>

      {/* ── 4 · ภาษีหัก ณ ที่จ่าย ─────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">ภาษีหัก ณ ที่จ่าย · ท.ป.4/2528</span>
        <h3>{EXPENSE.label} · {baht2(EXPENSE.amount)}</h3>
        <p className="led-note">
          สองข้อที่ผิดกันบ่อยจนกลายเป็นค่าปรับ — <b>หักจากยอดรวม VAT</b> (ต้องหักจากฐาน
          ก่อนภาษี) และ <b>หักค่าสินค้า</b> (ใช้กับบริการเท่านั้น ซื้อผ้าปูไม่หัก
          จ้างซักผ้าหัก)
        </p>
        <div className="led-pick">
          <label className="field">
            <span>ประเภทเงินได้</span>
            <select value={whtKind} onChange={(e) => setWhtKind(e.target.value)}>
              {Object.entries(WHT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <JournalTable entry={exp} />
      </section>

      {/* ── 5 · งบทดลอง ──────────────────────────────────────────── */}
      <section className="led-sec">
        <span className="k">งบทดลอง · {entries.length} ใบสำคัญ</span>
        <h3>ยอดคงเหลือทุกบัญชี</h3>
        <table className="led-table">
          <thead>
            <tr>
              <th>บัญชี</th>
              <th className="n">เดบิต</th>
              <th className="n">เครดิต</th>
            </tr>
          </thead>
          <tbody>
            {trial.map((r) => (
              <tr key={r.account}>
                <td>{r.account}</td>
                <td className="n">{r.debit ? baht2(r.debit) : "—"}</td>
                <td className="n">{r.credit ? baht2(r.credit) : "—"}</td>
              </tr>
            ))}
            <tr className="tot">
              <td>
                <b>รวม</b>
              </td>
              <td className="n">
                <b>{baht2(trialDr)}</b>
              </td>
              <td className="n">
                <b>{baht2(trialCr)}</b>
              </td>
            </tr>
          </tbody>
        </table>
        <div className={`led-callout ${trialDr === trialCr ? "ok" : "bad"}`}>
          {trialDr === trialCr
            ? "เดบิตรวมเท่าเครดิตรวม — งบทดลองสมดุล"
            : "ไม่สมดุล — ห้ามปิดงวด"}
        </div>
      </section>
    </>
  );
}

/** แยกออกมาเพราะเรียกจากสี่ที่ · ตารางเดบิตเครดิตคือเอกสารบัญชี ไม่ใช่การ์ด */
function JournalTable({ entry }: { entry: Entry }) {
  return (
    <div className="led-jv">
      <div className="led-head">
        <span className="k">
          {entry.kind} · {entry.title}
        </span>
        <code>{entry.eventId}</code>
      </div>
      <table className="led-table">
        <thead>
          <tr>
            <th>บัญชี</th>
            <th className="n">เดบิต</th>
            <th className="n">เครดิต</th>
          </tr>
        </thead>
        <tbody>
          {entry.lines.map((l, i) => (
            <tr key={i}>
              <td>
                {l.account}
                {l.memo && <span className="led-note"> · {l.memo}</span>}
              </td>
              <td className="n">{l.debit ? baht2(l.debit) : "—"}</td>
              <td className="n">{l.credit ? baht2(l.credit) : "—"}</td>
            </tr>
          ))}
          <tr className="tot">
            <td>
              <b>รวม · วันทำการ {entry.businessDate}</b>
            </td>
            <td className="n">
              <b>{baht2(debitTotal(entry))}</b>
            </td>
            <td className="n">
              <b>{baht2(creditTotal(entry))}</b>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Fact({ title, body }: { title: string; body: string }) {
  return (
    <div className="led-fact">
      <b>{title}</b>
      <span className="led-note">{body}</span>
    </div>
  );
}

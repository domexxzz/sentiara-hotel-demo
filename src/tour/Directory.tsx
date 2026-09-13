/** สารบัญฟังก์ชัน — กดแล้วพาไปถึงจอจริง
 *
 * ลูกค้าที่เพิ่งอ่านหน้านำเสนอมา 83 ฟังก์ชัน แล้วเปิดเดโมเจอห้าแท็บ
 * จะไม่รู้ว่าของที่อ่านมาอยู่ตรงไหน — จอนี้แก้ตรงนั้น
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, WALK, TOTAL, type Spot } from "./catalog";
import { goTo } from "./target";
import { Icon } from "../components/Icon";

type Mode = "list" | "walk";

function match(s: Spot, q: string): boolean {
  if (!q) return true;
  const hay = `${s.en} ${s.th} ${s.hint ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

export function Directory({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<Mode>("list");
  const [step, setStep] = useState(0);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) box.current?.focus();
    else setQ("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [open, onClose]);

  const groups = useMemo(
    () =>
      CATALOG.map((g) => ({ ...g, spots: g.spots.filter((s) => match(s, q)) })).filter(
        (g) => g.spots.length > 0,
      ),
    [q],
  );
  const found = groups.reduce((n, g) => n + g.spots.length, 0);

  if (!open) return null;

  const jump = (s: Spot) => {
    goTo(s);
    onClose();
  };

  const walk = WALK[step];

  return (
    <div className="dir-wrap" role="dialog" aria-modal="true" aria-label="สารบัญฟังก์ชัน">
      <button className="dir-scrim" onClick={onClose} aria-label="ปิดสารบัญ" />
      <div className="dir">
        <header className="dir-head">
          <div className="dir-tabs" role="tablist" aria-label="โหมดสารบัญ">
            <button role="tab" aria-selected={mode === "list"} onClick={() => setMode("list")}>
              ทุกฟังก์ชัน <span>{TOTAL}</span>
            </button>
            <button role="tab" aria-selected={mode === "walk"} onClick={() => setMode("walk")}>
              เดินให้ดูหนึ่งรอบ <span>{WALK.length}</span>
            </button>
          </div>
          <button className="dir-x" onClick={onClose} aria-label="ปิด">
            <Icon name="plus" size={16} />
          </button>
        </header>

        {mode === "list" ? (
          <>
            <div className="dir-search">
              <input
                ref={box}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา เช่น ใบกำกับภาษี · ตม.30 · VAT · OTA"
                aria-label="ค้นหาฟังก์ชัน"
              />
              <span className="n">{found} รายการ</span>
            </div>
            <div className="dir-body">
              {groups.map((g) => (
                <section key={g.n}>
                  <h3>
                    <b>{g.n}</b> {g.th}
                    <em>{g.en}</em>
                  </h3>
                  <ul>
                    {g.spots.map((s) => (
                      <li key={g.n + s.en + s.th}>
                        <button onClick={() => jump(s)}>
                          <span className="th">{s.th}</span>
                          <span className="en">{s.en}</span>
                          {s.hint && <span className="hint">{s.hint}</span>}
                          {s.soon && <span className="soon">ยังไม่มีจอเฉพาะในเดโม</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {found === 0 && <p className="dir-none">ไม่เจอคำนี้ — ลองคำสั้นลง เช่น “ภาษี” หรือ “ห้อง”</p>}
            </div>
          </>
        ) : (
          <div className="dir-body walk">
            <ol className="walk-dots" aria-label="ขั้นตอน">
              {WALK.map((w, i) => (
                <li key={w.title}>
                  <button
                    className={i === step ? "on" : i < step ? "done" : ""}
                    onClick={() => setStep(i)}
                    aria-label={`ขั้นที่ ${i + 1} ${w.title}`}
                  >
                    {i + 1}
                  </button>
                </li>
              ))}
            </ol>
            <div className="walk-card">
              <span className="k">
                ขั้นที่ {step + 1} จาก {WALK.length}
              </span>
              <h3>{walk.title}</h3>
              <p>{walk.body}</p>
              <div className="walk-go">
                <button
                  className="go"
                  onClick={() => {
                    goTo(walk.go);
                    onClose();
                  }}
                >
                  ไปที่จอนี้
                </button>
                <button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                  ก่อนหน้า
                </button>
                <button
                  disabled={step === WALK.length - 1}
                  onClick={() => setStep((s) => s + 1)}
                >
                  ถัดไป
                </button>
              </div>
              <p className="walk-note">
                เดินครบรอบแล้วจะเห็นว่าทุกจอใช้ข้อมูลชุดเดียวกัน — สิ่งที่กดในจอหนึ่ง
                โผล่ในอีกจอทันที ไม่มีใครต้องคีย์ซ้ำ
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

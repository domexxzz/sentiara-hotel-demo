import { useState } from "react";
import { menuOf, usePos, type Line } from "./posStore";
import { money } from "../lib/format";
import { Icon } from "../components/Icon";

type Mode = "none" | "split" | "move";

export function Tables() {
  const { state, dispatch, openTabs, tabTotal } = usePos();
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("none");
  /** จำนวนของแต่ละเมนูที่จะแยกไปจ่ายก่อน */
  const [picked, setPicked] = useState<Record<string, number>>({});

  const tab = openTabs.find((t) => t.id === openId) ?? null;
  const pickedLines: Line[] = Object.entries(picked)
    .filter(([, q]) => q > 0)
    .map(([menuId, qty]) => ({ menuId, qty }));
  const pickedTotal = tabTotal(pickedLines);

  const reset = () => {
    setMode("none");
    setPicked({});
  };
  const close = () => {
    setOpenId(null);
    reset();
  };

  const bump = (menuId: string, max: number, delta: number) =>
    setPicked((p) => ({
      ...p,
      [menuId]: Math.max(0, Math.min(max, (p[menuId] ?? 0) + delta)),
    }));

  // ── บิลใบเดียว ────────────────────────────────────────────────────
  if (tab) {
    const moveTargets = state.targets.filter((t) => !t.room && t.id !== tab.id);

    return (
      <>
        <div className="deskhead">
          <div>
            <span className="k">บิลเปิดอยู่ · {tab.lines.length} รายการ</span>
            <h2>{tab.label}</h2>
          </div>
          <div className="spacer" />
          <button className="btn ghost sm" onClick={close}>
            <Icon name="back" size={14} />
            กลับรายการโต๊ะ
          </button>
        </div>

        <div className="pos-split">
          <div className="bill">
            {tab.lines.map((l) => {
              const m = menuOf(l.menuId);
              const take = picked[l.menuId] ?? 0;
              return (
                <div key={l.menuId} className="r">
                  <span>
                    {m.name} ×{l.qty}
                    {mode === "split" && take > 0 && (
                      <span className="sub" style={{ color: "var(--accent-700)" }}>
                        แยกไปจ่ายก่อน {take} ที่
                      </span>
                    )}
                  </span>
                  {mode === "split" && (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        className="qtybtn"
                        onClick={() => bump(l.menuId, l.qty, -1)}
                        aria-label="ลด"
                      >
                        −
                      </button>
                      <span className="q" style={{ minWidth: 18, textAlign: "center" }}>
                        {take}
                      </span>
                      <button
                        className="qtybtn"
                        onClick={() => bump(l.menuId, l.qty, 1)}
                        aria-label="เพิ่ม"
                      >
                        +
                      </button>
                    </span>
                  )}
                  <span className="v">{money(m.price * l.qty)}</span>
                </div>
              );
            })}
            <div className="r total">
              <span>{mode === "split" ? "ยอดทั้งบิล" : "รวมทั้งบิล"}</span>
              <span className="v">{money(tab.total)}</span>
            </div>
            {mode === "split" && (
              <>
                <div className="r credit">
                  <span>ส่วนที่แยกจ่ายตอนนี้</span>
                  <span className="v">{money(pickedTotal)}</span>
                </div>
                <div className="r total">
                  <span>เหลือค้างบิลเดิม</span>
                  <span className="v">{money(tab.total - pickedTotal)}</span>
                </div>
              </>
            )}
          </div>

          <aside className="ticket">
            <div className="head">
              <span className="k">จัดการบิล</span>
              <strong>{tab.label}</strong>
            </div>

            {mode === "none" && (
              <div className="tfoot">
                <button
                  className="btn primary block"
                  onClick={() => {
                    dispatch({ type: "CLOSE_TABLE", table: tab.id });
                    close();
                  }}
                >
                  <Icon name="check" size={16} />
                  เก็บเงิน {money(tab.total)}
                </button>
                <button className="btn block" onClick={() => setMode("split")}>
                  แยกบิล — จ่ายทีละคน
                </button>
                <button
                  className="btn block"
                  onClick={() => setMode("move")}
                  disabled={moveTargets.length === 0}
                >
                  ย้ายโต๊ะ
                </button>
              </div>
            )}

            {mode === "split" && (
              <div className="tfoot">
                <div className="sum">
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>ส่วนที่เลือก</span>
                  <span className="v">{money(pickedTotal)}</span>
                </div>
                <button
                  className="btn primary block"
                  disabled={pickedTotal === 0}
                  onClick={() => {
                    dispatch({ type: "SPLIT_PAY", table: tab.id, picked: pickedLines });
                    if (tab.total - pickedTotal === 0) close();
                    else reset();
                  }}
                >
                  <Icon name="check" size={16} />
                  รับชำระส่วนที่เลือก
                </button>
                <button className="btn ghost block sm" onClick={reset}>
                  ยกเลิกการแยกบิล
                </button>
              </div>
            )}

            {mode === "move" && (
              <>
                <div className="targets">
                  {moveTargets.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        dispatch({ type: "MOVE_TABLE", from: tab.id, to: t.id });
                        close();
                      }}
                    >
                      ย้ายไป {t.label}
                    </button>
                  ))}
                </div>
                <div className="tfoot">
                  <button className="btn ghost block sm" onClick={reset}>
                    ยกเลิกการย้าย
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>

        <p className="owner-note">
          แยกบิลได้ทีละรายการ — ที่เหลือยังเปิดบิลอยู่ ไม่ต้องคิดเลขในหัวหรือจดใส่กระดาษ
        </p>
      </>
    );
  }

  // ── รายการโต๊ะทั้งหมด ──────────────────────────────────────────────
  const takenToday = state.payments.reduce((t, p) => t + p.amount, 0);

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">โต๊ะหน้าร้าน · บิลที่เปิดอยู่ {openTabs.length}</span>
          <h2>โต๊ะ &amp; บิล</h2>
        </div>
      </div>

      {openTabs.length === 0 ? (
        <div
          className="wo"
          style={{
            background: "var(--surface)",
            borderColor: "var(--divider)",
            color: "var(--muted)",
          }}
        >
          <Icon name="coffee" size={16} />
          <span>ยังไม่มีบิลโต๊ะเปิดอยู่ — ไปหน้า “สั่งอาหาร” เลือกโต๊ะแล้วยิงเข้าครัวดู</span>
        </div>
      ) : (
        <div className="kds">
          {openTabs.map((t) => (
            <button
              key={t.id}
              className="kcard"
              style={{ textAlign: "left" }}
              onClick={() => setOpenId(t.id)}
            >
              <div className="top">
                <strong>{t.label}</strong>
                <span className="at">{t.lines.length} รายการ</span>
              </div>
              <ul>
                {t.lines.slice(0, 4).map((l) => (
                  <li key={l.menuId}>
                    <b>{l.qty}×</b>
                    {menuOf(l.menuId).name}
                  </li>
                ))}
                {t.lines.length > 4 && <li>…อีก {t.lines.length - 4} รายการ</li>}
              </ul>
              <div
                style={{
                  fontFamily: "var(--font)",
                  fontWeight: 800,
                  fontSize: 20,
                  marginTop: "auto",
                }}
              >
                {money(t.total)}
              </div>
              <span className="st-tag wait" style={{ alignSelf: "flex-start" }}>
                กดเพื่อเก็บเงิน · แยกบิล · ย้ายโต๊ะ
              </span>
            </button>
          ))}
        </div>
      )}

      {state.payments.length > 0 && (
        <>
          <div className="k" style={{ color: "var(--muted)" }}>
            รับเงินแล้ววันนี้ · {money(takenToday)}
          </div>
          <div className="bill">
            {state.payments.map((p) => (
              <div key={p.id} className="r">
                <span>{p.label}</span>
                <span className="v">{money(p.amount)}</span>
              </div>
            ))}
            <div className="r total">
              <span>รวมรับเงินหน้าร้าน</span>
              <span className="v">{money(takenToday)}</span>
            </div>
          </div>
        </>
      )}

      <p className="owner-note">
        บิลโต๊ะแยกจากบิลห้อง — ออร์เดอร์ที่ยิงเข้าห้องแขกจะไปโผล่ที่บิลห้องแทน
        และปิดพร้อมกันตอนเช็กเอาท์
      </p>
    </>
  );
}

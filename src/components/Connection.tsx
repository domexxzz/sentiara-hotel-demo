import { useState } from "react";
import { useBackend } from "../lib/backend";
import { Icon } from "./Icon";

/**
 * แถบบอกโหมด และหน้าจอแตะบัตรเข้าระบบ
 *
 * ทำไมต้องมีแถบบอกโหมดตลอดเวลา
 * ------------------------------
 * ระบบเดียวกันทำงานได้ทั้งกับข้อมูลสาธิตและข้อมูลจริงของโรงแรม สองอย่างนี้
 * หน้าตาเหมือนกันเป๊ะ ถ้าไม่บอกให้ชัดว่ากำลังดูอะไรอยู่ วันหนึ่งจะมีคนสั่งงาน
 * จากตัวเลขสาธิต หรือกลัวไม่กล้ากดอะไรเลยเพราะไม่แน่ใจว่าของจริงหรือเปล่า
 */
export function ConnectionBar() {
  const { mode, probing, online, health, session, signOut, retry } = useBackend();
  if (probing) {
    return (
      <div className="conn probing">
        <span className="dot" />
        กำลังตรวจการเชื่อมต่อหลังบ้าน…
      </div>
    );
  }

  if (mode === "demo") {
    return (
      <div className="conn demo">
        <Icon name="shield" size={14} className="ic" />
        <div className="txt">
          <b>โหมดสาธิต</b>
          <span>ข้อมูลอยู่ในเบราว์เซอร์เครื่องนี้ · กดได้ทุกปุ่มโดยไม่กระทบของจริง</span>
        </div>
      </div>
    );
  }

  if (mode === "locked") {
    return (
      <div className="conn locked">
        <Icon name="key" size={14} className="ic" />
        <div className="txt">
          <b>{online ? "ต่อหลังบ้านได้แล้ว — ยังไม่ได้แตะบัตร" : "ต่อหลังบ้านไม่ได้ — พักการทำรายการ"}</b>
          <span>{online ? `${health?.hotel} · แตะบัตรเข้าระบบเพื่อดูข้อมูลจริง` : "ตรวจว่าเซิร์ฟเวอร์เปิดอยู่ แล้วลองเชื่อมต่อใหม่"}</span>
        </div>
        {!online && <button type="button" className="out" onClick={() => void retry()}>ลองใหม่</button>}
      </div>
    );
  }

  return (
    <div className="conn live">
      <span className="dot" />
      <div className="txt">
        <b>{health?.hotel} · ข้อมูลจริง</b>
        <span>
          {session?.name} · {session?.title} · ทุกการแก้ไขมีร่องรอย
        </span>
      </div>
      <button type="button" className="out" onClick={() => void signOut()}>
        ออกจากระบบ
      </button>
    </div>
  );
}

/** บัตรสาธิตที่ seed สร้างไว้ · ในของจริงเจ้าของตั้งรหัสเองและไม่มีรายการนี้ */
const DEMO_CARDS = [
  { card: "OWN-01", pin: "480215", who: "คุณดวงพร · เจ้าของ" },
  { card: "MGR-07", pin: "715390", who: "คุณมาลี · ผู้จัดการ" },
  { card: "FD-14", pin: "203847", who: "สมชาย · เคาน์เตอร์" },
  { card: "PS-09", pin: "550729", who: "น้องแนน · ร้านอาหาร" },
];

export function SignIn() {
  const { signIn, error, busy, health } = useBackend();
  const [card, setCard] = useState("");
  const [pin, setPin] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card.trim() || pin.length < 4) return;
    await signIn(card.trim(), pin);
  };

  return (
    <div className="signin">
      <form className="card" onSubmit={submit}>
        <span className="k">{health?.hotel ?? "Sentiara"}</span>
        <h2>แตะบัตรเข้าระบบ</h2>
        <p className="lead">
          บัตรใบเดียวกับที่ใช้เปิดประตูและลงเวลา — ต้องใส่รหัสด้วย
          เพราะบัตรหล่นแล้วคนเก็บได้ต้องเปิดบิลของโรงแรมไม่ได้
        </p>

        <label>
          <span>รหัสบัตร</span>
          <input
            value={card}
            onChange={(e) => setCard(e.target.value.toUpperCase())}
            placeholder="เช่น FD-14"
            autoComplete="off"
            autoFocus
          />
        </label>

        <label>
          <span>รหัสผ่าน</span>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="ตัวเลข 6 หลัก"
            inputMode="numeric"
            autoComplete="current-password"
          />
        </label>

        {error && (
          <div className="err" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="go" disabled={busy || !card.trim() || pin.length < 4}>
          {busy ? "กำลังตรวจสอบ…" : "เข้าระบบ"}
        </button>

        <div className="cards">
          <span className="lbl">บัตรของชุดสาธิต — กดเพื่อกรอกให้</span>
          {DEMO_CARDS.map((d) => (
            <button
              key={d.card}
              type="button"
              className="chip"
              onClick={() => {
                setCard(d.card);
                setPin(d.pin);
              }}
            >
              <b>{d.card}</b>
              {d.who}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}

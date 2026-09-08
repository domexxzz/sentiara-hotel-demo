import { useState } from "react";
import { useHotel } from "../hotel/hotelStore";
import { ROLE_LABEL } from "../lib/roles";
import { PROPERTY, type PropertyMode } from "../lib/property";
import { Icon } from "./Icon";

/**
 * แถบระบุตัวตน — บอกว่าใครกำลังใช้ระบบอยู่ และเปลี่ยนคนได้ด้วยการแตะบัตร
 *
 * โหมดสาธิต (ยังไม่แตะบัตร) เปิดได้ทุกจอ เพื่อให้เดโมเดินได้ไม่สะดุด
 * พอแตะบัตรแล้วระบบจะบังคับสิทธิ์จริง — นี่คือสิ่งที่ลูกค้าอยากเห็น
 */
export function Identity() {
  const hotel = useHotel();
  const [open, setOpen] = useState(false);
  const me = hotel.session;

  return (
    <div className={`idbar ${me ? "on" : ""}`}>
      <button className="idwho" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Icon name={me ? "key" : "users"} size={15} />
        {me ? (
          <span>
            <strong>{me.name}</strong>
            <i>{me.title}</i>
          </span>
        ) : (
          <span>
            <strong>โหมดสาธิต</strong>
            <i>ยังไม่ได้แตะบัตร · เปิดได้ทุกจอ</i>
          </span>
        )}
        <Icon name="chevron" size={13} className="cv" />
      </button>

      <div className="idmode" role="group" aria-label="ประเภทธุรกิจ">
        {(["hotel", "condo"] as PropertyMode[]).map((m) => (
          <button
            key={m}
            className={hotel.mode === m ? "on" : ""}
            onClick={() => hotel.dispatch({ type: "SET_MODE", mode: m })}
            title={`สลับเป็น${PROPERTY[m].kind} — เริ่มเดโมใหม่`}
          >
            {PROPERTY[m].kind}
          </button>
        ))}
      </div>

      {me && (
        <button className="idout" onClick={() => hotel.dispatch({ type: "SIGN_OUT" })}>
          ออกจากระบบ
        </button>
      )}

      {open && (
        <div className="idpick">
          <span className="k">แตะบัตรพนักงานเพื่อเข้าใช้งาน</span>
          <p>
            บัตรใบเดียวกับที่ใช้เข้าห้องทำงานและลงเวลา — ไม่ต้องจำรหัส
            และทุกครั้งที่แตะจะมีบันทึกในจอเจ้าของ
          </p>
          <div className="idcards">
            {hotel.staffList.map((s) => (
              <button
                key={s.id}
                className={`idcard ${me?.id === s.id ? "on" : ""}`}
                onClick={() => {
                  hotel.dispatch({ type: "SIGN_IN", card: s.card });
                  setOpen(false);
                }}
              >
                <span className="nm">{s.name}</span>
                <span className="rl">{ROLE_LABEL[s.role]}</span>
                <span className="cd">{s.card}</span>
              </button>
            ))}
          </div>
          {me && (
            <button
              className="btn ghost sm"
              onClick={() => {
                hotel.dispatch({ type: "SIGN_OUT" });
                setOpen(false);
              }}
            >
              กลับไปโหมดสาธิต (เปิดได้ทุกจอ)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

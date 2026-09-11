import { useState } from "react";
import { useHotel } from "../contexts";
import { money } from "../lib/format";
import {
  DEFAULT_SETTINGS,
  otaGapPct,
  validate,
  type RoomTypeCfg,
  type Settings as Cfg,
} from "../lib/settings";
import { ROLE_LABEL, type Role } from "../lib/roles";
import { Icon } from "../components/Icon";

/**
 * ตั้งค่าระบบ
 *
 * เหตุผลที่หน้านี้สำคัญกว่าที่ตาเห็น: ก่อนมีหน้านี้ ราคาห้อง เรตวันหยุด VAT
 * และรายชื่อพนักงาน เป็นตัวเลขฝังอยู่ในโค้ด แปลว่าขายให้โรงแรมที่สอง
 * ต้องให้โปรแกรมเมอร์แก้ไฟล์ใหม่ทุกครั้ง — ซึ่งขายเป็นสินค้าไม่ได้
 *
 * แก้ที่นี่แล้วทุกจอเปลี่ยนตาม เพราะทุกที่อ่านราคาจากที่เดียวกัน
 */
export function Settings() {
  const hotel = useHotel();
  const [draft, setDraft] = useState<Cfg>(hotel.settings);
  const [saved, setSaved] = useState(false);

  const errors = validate(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(hotel.settings);

  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setSaved(false);
  };
  const setType = (i: number, patch: Partial<RoomTypeCfg>) =>
    set(
      "types",
      draft.types.map((t, x) => (x === i ? { ...t, ...patch } : t)),
    );

  // ประเภทห้องที่มีอยู่จริงในผังห้อง — เตือนถ้าตั้งราคาให้ประเภทที่ไม่มีห้องเลย
  const inRack = new Set(hotel.state.rooms.map((r) => r.type));

  const apply = async () => {
    if (errors.length) return;
    const ok = await hotel.dispatch({ type: "SET_SETTINGS", patch: draft });
    setSaved(ok);
  };

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">ตั้งค่าระบบ · เจ้าของและผู้จัดการเท่านั้น</span>
          <h2>ตั้งค่ากิจการ ราคา และพนักงาน</h2>
        </div>
        <button className="btn primary" disabled={!dirty || errors.length > 0 || hotel.syncing} onClick={apply}>
          <Icon name="check" size={15} />
          {saved && !dirty ? "บันทึกแล้ว" : "บันทึกการเปลี่ยนแปลง"}
        </button>
      </div>

      <p className="lead">
        ค่าทุกตัวในหน้านี้เคยฝังอยู่ในโค้ด — ย้ายออกมาให้แก้เองได้แล้ว
        แก้ราคาที่นี่ที่เดียว ฝั่งแขก ปฏิทิน บิล และใบกำกับภาษีเปลี่ยนตามทันที
      </p>

      {errors.length > 0 && (
        <div className="set-err">
          <Icon name="shield" size={16} />
          <div>
            <strong>ยังบันทึกไม่ได้</strong>
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="set-grid">
        {/* ── กิจการ ── */}
        <section className="set-box">
          <div className="fin-sec">
            <span className="k">ข้อมูลกิจการ</span>
            <span className="hint">ขึ้นบนหน้าจอแขก บิล และใบกำกับภาษี</span>
          </div>
          <div className="set-fields">
            <label className="wide">
              <span>ชื่อกิจการ</span>
              <input value={draft.hotelName} onChange={(e) => set("hotelName", e.target.value)} />
            </label>
            <label>
              <span>จังหวัด</span>
              <input value={draft.city} onChange={(e) => set("city", e.target.value)} />
            </label>
            <label>
              <span>โทรศัพท์</span>
              <input value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
            <label>
              <span>เวลาเช็กอิน</span>
              <input value={draft.checkInTime} onChange={(e) => set("checkInTime", e.target.value)} />
            </label>
            <label>
              <span>เวลาเช็กเอาต์</span>
              <input
                value={draft.checkOutTime}
                onChange={(e) => set("checkOutTime", e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* ── ราคาและภาษี ── */}
        <section className="set-box">
          <div className="fin-sec">
            <span className="k">ราคา ภาษี และมัดจำ</span>
            <span className="hint">กระทบทุกบิลที่ออกหลังจากนี้</span>
          </div>
          <div className="set-fields">
            <label>
              <span>ภาษีมูลค่าเพิ่ม (%)</span>
              <input
                type="number"
                min="0"
                max="30"
                value={draft.vatPct}
                onChange={(e) => set("vatPct", Number(e.target.value))}
              />
              <small>0 = ยังไม่จด VAT · ใบกำกับภาษีจะไม่แสดงบรรทัด VAT</small>
            </label>
            <label>
              <span>เรตวันหยุด (+%)</span>
              <input
                type="number"
                min="0"
                max="200"
                value={draft.weekendPct}
                onChange={(e) => set("weekendPct", Number(e.target.value))}
              />
              <small>บวกเพิ่มสำหรับคืนศุกร์และเสาร์</small>
            </label>
            <label>
              <span>มัดจำตอนจอง (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={draft.depositPct}
                onChange={(e) => set("depositPct", Number(e.target.value))}
              />
            </label>
            <label>
              <span>ค่าดูแลระบบรายปี (% ของค่าลิขสิทธิ์)</span>
              <input
                type="number"
                min="0"
                max="50"
                value={draft.maPct}
                onChange={(e) => set("maPct", Number(e.target.value))}
              />
            </label>
          </div>
        </section>
      </div>

      {/* ── ประเภทห้องและราคา ── */}
      <div className="fin-sec top">
        <span className="k">ประเภทห้องและราคา</span>
        <span className="hint">
          จองตรงถูกกว่าเว็บจองเฉลี่ย {otaGapPct(draft)}% — คำนวณจากราคาที่ตั้งไว้ข้างล่างนี้จริง
        </span>
      </div>

      <div className="calwrap">
        <table className="calgrid set-table">
          <thead>
            <tr>
              <th>ชื่อประเภท</th>
              <th className="n">ราคาจองตรง / คืน</th>
              <th className="n">ราคาบนเว็บจอง</th>
              <th className="n">คืนวันหยุด</th>
              <th>ห้องในผัง</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {draft.types.map((t, i) => {
              const count = hotel.state.rooms.filter((r) => r.type === t.name).length;
              return (
                <tr key={i}>
                  <td>
                    <input
                      className="cell"
                      value={t.name}
                      onChange={(e) => setType(i, { name: e.target.value })}
                    />
                  </td>
                  <td className="n">
                    <input
                      className="cell num"
                      type="number"
                      min="0"
                      step="50"
                      value={t.rate}
                      onChange={(e) => setType(i, { rate: Number(e.target.value) })}
                    />
                  </td>
                  <td className="n">
                    <input
                      className="cell num"
                      type="number"
                      min="0"
                      step="50"
                      value={t.ota}
                      onChange={(e) => setType(i, { ota: Number(e.target.value) })}
                    />
                  </td>
                  <td className="n">
                    <b>{money(Math.round(t.rate * (1 + draft.weekendPct / 100)))}</b>
                  </td>
                  <td>
                    {count > 0 ? (
                      <span className="tag ok">{count} ห้อง</span>
                    ) : inRack.size ? (
                      <span className="tag wait">ไม่มีห้องประเภทนี้ในผัง</span>
                    ) : null}
                  </td>
                  <td>
                    <button
                      className="btn ghost sm"
                      disabled={draft.types.length <= 1}
                      onClick={() =>
                        set(
                          "types",
                          draft.types.filter((_, x) => x !== i),
                        )
                      }
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="set-actions">
        <button
          className="btn ghost"
          onClick={() =>
            set("types", [...draft.types, { name: "ประเภทใหม่", rate: 1200, ota: 1380 }])
          }
        >
          <Icon name="plus" size={15} />
          เพิ่มประเภทห้อง
        </button>
        <button className="btn ghost" onClick={() => setDraft(DEFAULT_SETTINGS)}>
          คืนค่าเริ่มต้น
        </button>
      </div>

      <StaffAdmin />

      {/* ── การเก็บข้อมูล — ต้องพูดตรงว่าเก็บที่ไหน ── */}
      <div className="fin-note">
        <strong>ข้อมูลถูกเก็บที่ไหน — พูดตรง ๆ</strong>
        <ul>
          <li>
            {hotel.live ? (
              <>
                <b>บันทึกในฐานข้อมูลกลางแล้ว</b> — ทุกเครื่องที่เข้าสู่ระบบจะเห็นชื่อกิจการ
                นโยบายราคา และประเภทห้องชุดเดียวกัน
              </>
            ) : hotel.persisted ? (
              <>
                <b>ตอนนี้จำข้ามการรีเฟรชได้แล้ว</b> — บันทึกลงเบราว์เซอร์เครื่องนี้
                ปิดแล้วเปิดใหม่ข้อมูลยังอยู่
              </>
            ) : (
              <>
                <b>เบราว์เซอร์นี้บันทึกไม่ได้</b> (โหมดส่วนตัวหรือปิดการเก็บข้อมูลไว้) —
                รีเฟรชแล้วข้อมูลจะกลับไปตั้งต้น
              </>
            )}
          </li>
          {hotel.live ? (
            <li>ราคาที่แก้มีผลกับการจอง บิล ภาษี และข้อมูลที่หน้าจออื่นอ่านจากเซิร์ฟเวอร์</li>
          ) : (
            <>
              <li>
                <b>แต่นี่ยังไม่ใช่ฐานข้อมูล</b> — เปิดอีกเครื่องคือข้อมูลคนละชุด
                สองคนแก้พร้อมกันไม่เห็นกัน และไม่มีการสำรองข้อมูล
              </li>
              <li>โหมดติดตั้งจริงจะเก็บค่าเหล่านี้ในเซิร์ฟเวอร์และฐานข้อมูลกลาง</li>
            </>
          )}
        </ul>
        <button
          className="btn ghost sm"
          onClick={() => {
            if (confirm("ล้างข้อมูลทั้งหมดและเริ่มเดโมใหม่?")) {
              hotel.dispatch({ type: "RESET" });
              setDraft(DEFAULT_SETTINGS);
            }
          }}
        >
          ล้างข้อมูลและเริ่มเดโมใหม่
        </button>
      </div>
    </>
  );
}

const ROLES: Role[] = ["owner", "manager", "front", "hk", "tech", "pos"];

/** เพิ่ม ลบ แก้พนักงานได้จริง — เดิมเป็นรายชื่อ 6 คนที่ฝังอยู่ในโค้ด */
function StaffAdmin() {
  const hotel = useHotel();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [card, setCard] = useState("");
  const [role, setRole] = useState<Role>("front");

  const staff = hotel.state.staff;
  const dupCard = staff.some((s) => s.card.toLowerCase() === card.trim().toLowerCase());
  const ready = name.trim() && card.trim() && !dupCard;
  const owners = staff.filter((s) => s.role === "owner").length;

  return (
    <>
      <div className="fin-sec top">
        <span className="k">พนักงานและบัตร</span>
        <span className="hint">
          บัตรใบเดียวใช้ทั้งเปิดประตู ล็อกอินระบบ และลงเวลาทำงาน · {staff.length} คน
        </span>
      </div>

      <div className="calwrap">
        <table className="calgrid set-table">
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>ตำแหน่ง</th>
              <th>บทบาท / สิทธิ์</th>
              <th>รหัสบัตร</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={hotel.session?.id === s.id ? "on" : ""}>
                <td>
                  <input
                    className="cell"
                    value={s.name}
                    onChange={(e) =>
                      hotel.dispatch({
                        type: "PATCH_STAFF",
                        id: s.id,
                        patch: { name: e.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell"
                    value={s.title}
                    onChange={(e) =>
                      hotel.dispatch({
                        type: "PATCH_STAFF",
                        id: s.id,
                        patch: { title: e.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <select
                    className="cell"
                    value={s.role}
                    onChange={(e) =>
                      hotel.dispatch({
                        type: "PATCH_STAFF",
                        id: s.id,
                        patch: { role: e.target.value as Role },
                      })
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="cell"
                    value={s.card}
                    onChange={(e) =>
                      hotel.dispatch({
                        type: "PATCH_STAFF",
                        id: s.id,
                        patch: { card: e.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    className="btn ghost sm"
                    // กันลบเจ้าของคนสุดท้าย — ไม่งั้นไม่มีใครเปิดจอเจ้าของได้อีกเลย
                    disabled={s.role === "owner" && owners <= 1}
                    title={
                      s.role === "owner" && owners <= 1
                        ? "ลบไม่ได้ — ต้องเหลือเจ้าของอย่างน้อย 1 คน"
                        : undefined
                    }
                    onClick={() => hotel.dispatch({ type: "DEL_STAFF", id: s.id })}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fin-form">
        <div className="row">
          <label className="grow">
            <span>ชื่อพนักงานใหม่</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ปรีชา" />
          </label>
          <label className="grow">
            <span>ตำแหน่ง</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น พนักงานเคาน์เตอร์"
            />
          </label>
          <label>
            <span>บทบาท</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>รหัสบัตร</span>
            <input value={card} onChange={(e) => setCard(e.target.value)} placeholder="FD-21" />
          </label>
        </div>
        <div className="row foot">
          <span className="hint">
            {dupCard
              ? "รหัสบัตรนี้มีคนใช้แล้ว — บัตรซ้ำจะทำให้บันทึกการเข้าออกแยกคนไม่ออก"
              : "รหัสบัตรต้องไม่ซ้ำกับใคร เพราะใช้ระบุตัวคนในบันทึกการเข้าห้อง"}
          </span>
          <button
            className="btn primary"
            disabled={!ready}
            onClick={() => {
              hotel.dispatch({
                type: "ADD_STAFF",
                staff: {
                  name: name.trim(),
                  title: title.trim() || ROLE_LABEL[role],
                  role,
                  card: card.trim().toUpperCase(),
                },
              });
              setName("");
              setTitle("");
              setCard("");
            }}
          >
            เพิ่มพนักงาน
          </button>
        </div>
      </div>
    </>
  );
}

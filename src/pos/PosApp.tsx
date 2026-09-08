// Reuses the desktop window shell from the front desk (.deskwin / .desknav).
import "../desk/desk.css";
import "../owner/owner.css"; // .owner-note footnote style is shared
import "./pos.css";
import { MENU, SHIFT } from "./posData";
import { PosProvider, menuOf, usePos, type PosView } from "./posStore";
import { Tables } from "./Tables";
import { useHotel } from "../hotel/hotelStore";
import { useEffect } from "react";
import { money } from "../lib/format";
import { Icon, type IconName } from "../components/Icon";

const NAV: { view: PosView; label: string; icon: IconName }[] = [
  { view: "order", label: "สั่งอาหาร", icon: "coffee" },
  { view: "tables", label: "โต๊ะ & บิล", icon: "receipt" },
  { view: "kitchen", label: "จอครัว", icon: "sparkle" },
  { view: "stock", label: "สต็อกวัตถุดิบ", icon: "receipt" },
];

function Order() {
  const { state, dispatch, total, soldOut } = usePos();
  const hotel = useHotel();
  const target = state.targets.find((t) => t.id === state.targetId);

  // ห้องที่คิดเงินได้ = แขกที่เช็กอินอยู่จริงตอนนี้
  const inHouseKey = hotel.inHouse.map((b) => b.room).join(",");
  useEffect(() => {
    dispatch({
      type: "SET_TARGETS",
      ids: hotel.inHouse.map((b) => ({
        id: "r" + b.room,
        label: `ห้อง ${b.room} · ${b.guest}`,
        room: b.room,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inHouseKey]);

  const send = () => {
    if (target?.room) {
      for (const line of state.cart) {
        const m = menuOf(line.menuId);
        hotel.dispatch({
          type: "ADD_CHARGE",
          room: target.room,
          line: { label: m.name, note: "ร้านอาหาร · ยิงจาก POS", price: m.price, qty: line.qty, kind: "fnb" },
        });
      }
    }
    dispatch({ type: "SEND" });
  };

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">POS ร้านอาหาร · {SHIFT}</span>
          <h2>สั่งอาหาร</h2>
        </div>
      </div>

      <div className="pos-split">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(["อาหาร", "เครื่องดื่ม"] as const).map((cat) => (
            <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="k" style={{ color: "var(--muted)" }}>
                {cat}
              </div>
              <div className="menugrid">
                {MENU.filter((m) => m.cat === cat).map((m) => {
                  const out = soldOut(m);
                  return (
                    <button
                      key={m.id}
                      className={`mitem ${out ? "out" : ""}`}
                      disabled={out}
                      onClick={() => dispatch({ type: "ADD", menuId: m.id })}
                    >
                      <strong>{m.name}</strong>
                      {out && <span className="outtag">ของหมด · ปิดขายเอง</span>}
                      <span className="margin">
                        ต้นทุน {money(m.cost)} · กำไร{" "}
                        {Math.round(((m.price - m.cost) / m.price) * 100)}%
                      </span>
                      <span className="p">{money(m.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <aside className="ticket">
          <div className="head">
            <span className="k">ออร์เดอร์ปัจจุบัน</span>
            <strong>{target?.label}</strong>
          </div>

          <div className="targets">
            {state.targets.map((t) => (
              <button
                key={t.id}
                className={state.targetId === t.id ? "on" : ""}
                onClick={() => dispatch({ type: "TARGET", id: t.id })}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="tlines">
            {state.cart.length === 0 ? (
              <div className="tempty">แตะเมนูทางซ้ายเพื่อเพิ่มลงออร์เดอร์</div>
            ) : (
              state.cart.map((l) => {
                const m = menuOf(l.menuId);
                return (
                  <div key={l.menuId} className="tline">
                    <button
                      className="qtybtn"
                      aria-label="ลด"
                      onClick={() => dispatch({ type: "REMOVE", menuId: l.menuId })}
                    >
                      −
                    </button>
                    <span className="q">{l.qty}</span>
                    <button
                      className="qtybtn"
                      aria-label="เพิ่ม"
                      onClick={() => dispatch({ type: "ADD", menuId: l.menuId })}
                    >
                      +
                    </button>
                    <span className="nm">{m.name}</span>
                    <span className="v">{money(m.price * l.qty)}</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="tfoot">
            <div className="sum">
              <span style={{ fontSize: 12, color: "var(--muted)" }}>รวม</span>
              <span className="v">{money(total)}</span>
            </div>
            <button
              className="btn primary block"
              disabled={state.cart.length === 0}
              onClick={send}
            >
              <Icon name="send" size={16} />
              {target?.room ? `ยิงเข้าครัว + เข้าบิลห้อง ${target.room}` : "ยิงเข้าครัว"}
            </button>
            {state.cart.length > 0 && (
              <button className="btn ghost sm" onClick={() => dispatch({ type: "CLEAR" })}>
                ล้างออร์เดอร์
              </button>
            )}
          </div>
        </aside>
      </div>

      <p className="owner-note">
        ยิงเข้าครัวแล้วขึ้นจอครัวทันที · ยอดขายร้านอาหารเข้ารายงาน P&amp;L
        แยกจากค่าห้อง — รู้ว่าร้านเลี้ยงตัวเองได้จริงไหม
      </p>
    </>
  );
}

function Kitchen() {
  const { state, dispatch, cooking } = usePos();

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">KITCHEN DISPLAY · จอแขวนในครัว</span>
          <h2>กำลังทำ {cooking} ออร์เดอร์</h2>
        </div>
      </div>

      {state.tickets.length === 0 ? (
        <div
          className="wo"
          style={{
            background: "var(--surface)",
            borderColor: "var(--divider)",
            color: "var(--muted)",
          }}
        >
          <Icon name="coffee" size={16} />
          <span>ยังไม่มีออร์เดอร์ — ไปหน้า “สั่งอาหาร” แล้วยิงเข้าครัวดู</span>
        </div>
      ) : (
        <div className="kds">
          {state.tickets.map((t) => (
            <div key={t.id} className={`kcard ${t.status === "served" ? "served" : ""}`}>
              <div className="top">
                <strong>{t.id}</strong>
                <span className="at">{t.at}</span>
              </div>
              <div className="tgt">{t.target}</div>
              <ul>
                {t.lines.map((l) => (
                  <li key={l.menuId}>
                    <b>{l.qty}×</b>
                    {menuOf(l.menuId).name}
                  </li>
                ))}
              </ul>
              {t.status === "cooking" ? (
                <button
                  className="btn dark block sm"
                  onClick={() => dispatch({ type: "SERVE", id: t.id })}
                >
                  <Icon name="check" size={15} />
                  เสร็จแล้ว · เสิร์ฟ
                </button>
              ) : (
                <span className="st-tag ok" style={{ alignSelf: "flex-start" }}>
                  เสิร์ฟแล้ว · ตัดสต็อกเอง
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="owner-note">
        ครัวกด “เสร็จแล้ว” → ตัดสต็อกตามสูตร → ต่ำกว่าจุดสั่งซื้อ ระบบสร้างใบสั่งซื้อรอไว้ →
        ของหมดจริง ปิดเมนูทุกช่องทางเอง · ไม่มีใครต้องจดสมุด
      </p>
    </>
  );
}

function Stock() {
  const { state } = usePos();

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">สต็อกวัตถุดิบ · ตัดเองจากสูตร</span>
          <h2>คลังครัว</h2>
        </div>
      </div>

      <div className="stock">
        {state.stock.map((s) => {
          const out = s.qty === 0;
          const low = !out && s.qty <= s.reorder;
          const pct = Math.min(100, (s.qty / (s.reorder * 2.5)) * 100);
          return (
            <div key={s.id} className={`srow ${out ? "out" : low ? "low" : ""}`}>
              <span style={{ minWidth: 96 }}>{s.label}</span>
              <span className="bar">
                <i style={{ width: `${pct}%` }} />
              </span>
              {out && <span className="tag">หมดแล้ว</span>}
              {low && <span className="tag">ต่ำกว่าจุดสั่งซื้อ</span>}
              <span className="qty">
                {s.qty.toLocaleString("en-US")} {s.unit}
              </span>
            </div>
          );
        })}
      </div>

      {state.purchaseOrders.length > 0 && (
        <>
          <div className="k" style={{ color: "var(--muted)" }}>
            ใบสั่งซื้อที่ระบบสร้างรอไว้
          </div>
          <div className="stock">
            {state.purchaseOrders.map((p, i) => (
              <div key={i} className="srow">
                <Icon name="check" size={15} style={{ color: "#1f7a4d" }} />
                <span>{p} — รอผู้จัดการกดยืนยันสั่งซื้อ</span>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="owner-note">
        ต้นทุนคำนวณจากสูตรและราคาวัตถุดิบล่าสุด · ราคาวัตถุดิบขึ้น ระบบเตือนว่าเมนูไหน
        กำไรบางลงกว่าเป้า — ปรับราคาหรือปรับสูตรได้ทันเวลา
      </p>
    </>
  );
}

function PosShell() {
  const { state, dispatch, cooking, openTabs } = usePos();
  const { inHouse, billTotal } = useHotel();

  return (
    <div className="deskshell">
      <div className="deskwin">
        <div className="deskchrome">
          <span className="lights">
            <i />
            <i />
            <i />
          </span>
          <span className="url">
            sentiara.local · POS + จอครัว (LAN — เน็ตหลุดก็ขายต่อได้)
          </span>
        </div>

        <div className="deskbody">
          <nav className="desknav">
            <div className="logo">
              <span className="k">Restaurant</span>
              <strong>Sentiara POS</strong>
            </div>
            {NAV.map((n) => (
              <button
                key={n.view}
                className={`navitem ${state.view === n.view ? "on" : ""}`}
                onClick={() => dispatch({ type: "VIEW", view: n.view })}
              >
                <Icon name={n.icon} size={16} />
                {n.label}
                {n.view === "kitchen" && cooking > 0 && (
                  <span className="badge">{cooking}</span>
                )}
                {n.view === "tables" && openTabs.length > 0 && (
                  <span className="badge">{openTabs.length}</span>
                )}
              </button>
            ))}
            <div className="sync">
              <b>SERVER · LAN — ออนไลน์</b>
              {inHouse.length === 0
                ? "ยังไม่มีแขกเช็กอิน"
                : inHouse.map((b) => (
                    <span key={b.id} style={{ display: "block" }}>
                      บิลห้อง {b.room} · {money(billTotal(b.room ?? ""))}
                    </span>
                  ))}
            </div>
          </nav>

          <main className="deskmain">
            {state.banner && (
              <div className="pos-banner">
                <Icon name="check" size={15} className="ic" />
                <span>{state.banner}</span>
                <button
                  aria-label="ปิดข้อความ"
                  onClick={() => dispatch({ type: "BANNER", text: null })}
                >
                  ✕
                </button>
              </div>
            )}
            {state.view === "kitchen" ? (
              <Kitchen />
            ) : state.view === "tables" ? (
              <Tables />
            ) : state.view === "stock" ? (
              <Stock />
            ) : (
              <Order />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export function PosApp() {
  return (
    <PosProvider>
      <PosShell />
    </PosProvider>
  );
}

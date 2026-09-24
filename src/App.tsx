import { useEffect, useState } from "react";
import "./App.css";
import { BookingProvider } from "./store";
import { PhoneFrame } from "./components/PhoneFrame";
import { Search } from "./screens/Search";
import { Confirm } from "./screens/Confirm";
import { Arrival } from "./screens/Arrival";
import { GuestManage } from "./screens/GuestManage";
import { Stay } from "./screens/Stay";
import { Checkout } from "./screens/Checkout";
import { DeskApp } from "./desk/DeskApp";
import { StaffApp } from "./staff/StaffApp";
import { OwnerApp } from "./owner/OwnerApp";
import { PosApp } from "./pos/PosApp";
import { Icon, type IconName } from "./components/Icon";
import { HotelProvider } from "./hotel/hotelStore";
import { Identity } from "./components/Identity";
import { canOpen, denyReason } from "./lib/roles";
import { BackendProvider } from "./lib/backend";
import { useBackend, useBooking, useHotel } from "./contexts";
import { ConnectionBar, SignIn } from "./components/Connection";
import { Directory } from "./tour/Directory";
import { onTarget, type Flow } from "./tour/target";
import { Welcome, resetDemo } from "./tour/Welcome";
import { FLOW_THEME, FLOW_TITLE } from "./lib/flowTheme";
import { BigScreenTip } from "./components/BigScreenTip";

const FLOWS: { id: Flow; label: string; sub: string; icon: IconName }[] = [
  { id: "guest", label: "ฝั่งแขก", sub: "มือถือ", icon: "chat" },
  { id: "desk", label: "หน้าเคาน์เตอร์", sub: "เดสก์ท็อป", icon: "bed" },
  { id: "staff", label: "แม่บ้าน & หัวหน้า", sub: "มือถือ", icon: "sparkle" },
  { id: "owner", label: "จอเจ้าของ", sub: "เดสก์ท็อป", icon: "receipt" },
  { id: "pos", label: "POS ร้านอาหาร", sub: "เดสก์ท็อป", icon: "coffee" },
];

const HEADINGS: Record<Flow, { title: string; note: string }> = {
  guest: {
    title: "เส้นทางแขก — จองตรงถึงเช็กเอาท์",
    note: "กดทดลองได้ทุกปุ่ม · ข้อมูลทั้งหมดเป็นตัวอย่างสาธิต",
  },
  desk: {
    title: "หน้าเคาน์เตอร์ — เช็กอิน Walk-in ปิดบิล",
    note: "ผังห้องอัปเดตจริงตามที่คุณกด · ข้อมูลทั้งหมดเป็นตัวอย่างสาธิต",
  },
  staff: {
    title: "แม่บ้าน & หัวหน้า — ทำ ตรวจ แล้วห้องกลับมาขาย",
    note: "สลับบทบาทได้ในจอ · ลองกดจำลองเน็ตหลุดดูก็ได้",
  },
  owner: {
    title: "จอเจ้าของ — ตัวเลขทุกตัวกดดูที่มาได้",
    note: "ลองกดการ์ดตัวเลขดูว่ามาจากบิลใบไหน · ข้อมูลทั้งหมดเป็นตัวอย่างสาธิต",
  },
  pos: {
    title: "POS ร้านอาหาร — ยิงเข้าครัว เข้าบิลห้อง ตัดสต็อกเอง",
    note: "ลองสั่งต้มยำกุ้งหลาย ๆ จาน แล้วให้ครัวกดเสร็จดูว่าเกิดอะไรขึ้น",
  },
};

function GuestRouter() {
  const { state } = useBooking();
  switch (state.step) {
    case "confirm":
      return <Confirm />;
    case "arrival":
      return <Arrival />;
    case "manage":
      return <GuestManage />;
    case "stay":
      return <Stay />;
    case "checkout":
      return <Checkout />;
    case "search":
    default:
      return <Search />;
  }
}

function Stage() {
  const [flow, setFlow] = useState<Flow>("guest");
  const [dir, setDir] = useState(false);
  // ปุ่มล้างข้อมูลต้องกดสองครั้ง — ครั้งแรกแค่ "ง้าง" ไว้
  const [armed, setArmed] = useState(false);
  // ข้อความ "ไปถึงแล้วกดอะไรต่อ" ที่สารบัญส่งมาพร้อมกับการกระโดด
  const [hint, setHint] = useState<string | null>(null);

  // สารบัญสั่งเปลี่ยนมุมมองได้ ส่วนแท็บย่อยแต่ละแอปรับไปจัดการเอง
  useEffect(() => onTarget((t) => {
    setFlow(t.flow);
    setHint(t.hint ?? null);
  }), []);

  // เครื่องหมายทับเปิดสารบัญ — คีย์เดียวที่ไม่ชนกับการพิมพ์ภาษาไทย
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setDir(true);
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  const backend = useBackend();
  const head = HEADINGS[flow];
  const { session } = useHotel();
  // ยังไม่แตะบัตร = โหมดสาธิต เปิดได้ทุกจอ · แตะแล้วบังคับสิทธิ์จริง
  const allowed = (f: Flow) => !session || canOpen(session.role, f);
  const blocked = !allowed(flow);

  return (
    <div
      className={`stage ${flow !== "guest" && flow !== "staff" ? "wide" : ""}`}
      /* สีประจำมุมมองส่งลงไปเป็นตัวแปร CSS ตัวเดียว แล้วให้ทุกชิ้นหยิบไปใช้เอง
         ดีกว่าแปะคลาสรายมุมมอง เพราะเพิ่มมุมมองใหม่แล้วไม่ต้องไล่แก้ CSS */
      style={{
        "--hue": FLOW_THEME[flow].color,
        "--hue-on-dark": FLOW_THEME[flow].onDark,
      } as React.CSSProperties}
    >
      <div className="stage-inner">
        <header className="stage-head">
          <span className="k">Sentiara · Interactive Prototype</span>
          <h1>{head.title}</h1>
          <div className="stage-acts">
            <button className="dir-open" onClick={() => setDir(true)}>
              <Icon name="sparkle" size={14} />
              สารบัญฟังก์ชันทั้งหมด
              <kbd>/</kbd>
            </button>
            {/* ถามซ้ำก่อนล้าง — กดพลาดกลางพรีเซนต์แล้วข้อมูลหายคือฝันร้าย */}
            <button
              className={`resetbtn ${armed ? "armed" : ""}`}
              onClick={() => (armed ? resetDemo() : setArmed(true))}
              onBlur={() => setArmed(false)}
            >
              {armed ? "กดอีกครั้งเพื่อล้าง" : "เริ่มใหม่"}
            </button>
            {/* หน้าราคาเป็นไฟล์แยกนอกแอป ไม่ใช่เส้นทางใน React
                จึงต้องเป็น <a> ไม่ใช่ปุ่ม — ใช้ปุ่มแล้วต้องเขียนโค้ดพาไปเอง
                และคนคลิกขวาเปิดแท็บใหม่ไม่ได้ ซึ่งเป็นสิ่งที่คนทำจริงกับลิงก์ราคา */}
            <a className="pricelink" href="/packages.html">ดูราคา</a>
          </div>
          <p>{backend.mode === "demo" ? head.note : "เชื่อมต่อระบบโรงแรม · รายการที่ยังไม่รองรับจะแจ้งให้ทราบเมื่อทำรายการ"}</p>
        </header>

        {/* หัวจอของมือถือ · จอคอมซ่อนไว้เพราะที่นั่นมี stage-head อยู่แล้ว
            ขีดสีหนาบนขอบบนคือตัวบอกว่าอยู่มุมมองไหน — เห็นก่อนทันอ่าน */}
        <header className="mhead">
          <div className="mhead-txt">
            <span className="kk">
              {FLOW_THEME[flow].kicker}
              {backend.mode === "demo" && " · โหมดสาธิต"}
            </span>
            <b>{FLOW_TITLE[flow]}</b>
          </div>
          <a className="mhead-price" href="/packages.html">ราคา</a>
          <button className="mhead-dir" onClick={() => setDir(true)} aria-label="สารบัญฟังก์ชันทั้งหมด">
            <Icon name="sparkle" size={15} />
          </button>
          <button
            className={`mhead-reset ${armed ? "armed" : ""}`}
            onClick={() => (armed ? resetDemo() : setArmed(true))}
            onBlur={() => setArmed(false)}
          >
            {armed ? "กดอีกครั้ง" : "เริ่มใหม่"}
          </button>
        </header>

        <BigScreenTip flow={flow} />

        <ConnectionBar />
        <Identity />

        {hint && (
          <div className="jump-hint" role="status">
            <Icon name="sparkle" size={15} className="ic" />
            <span>{hint}</span>
            <button onClick={() => setHint(null)} aria-label="ปิดคำแนะนำ">ปิด</button>
          </div>
        )}

        {backend.mode === "locked" ? (
          <SignIn />
        ) : (
        <>
        <div className="flowpick" role="tablist" aria-label="เลือกเส้นทางสาธิต">
          {FLOWS.map((f) => {
            const ok = allowed(f.id);
            return (
              <button
                key={f.id}
                role="tab"
                aria-selected={flow === f.id}
                className={`${flow === f.id ? "on" : ""} ${ok ? "" : "locked"}`}
                onClick={() => setFlow(f.id)}
                title={ok ? undefined : session ? denyReason(session.role, f.id) : undefined}
              >
                <Icon name={ok ? f.icon : "shield"} size={15} />
                <span className="full">{f.label}</span>
                {/* มือถือใช้ชื่อสั้น · ชื่อเต็มยาวเกินช่องละหนึ่งในห้าของจอ */}
                <span className="tiny">{ok ? FLOW_THEME[f.id].short : "ล็อก"}</span>
                <span className="sub">{ok ? f.sub : "ไม่มีสิทธิ์"}</span>
              </button>
            );
          })}
        </div>

        {blocked && session ? (
          <div className="denied">
            <Icon name="shield" size={30} className="ic" />
            <strong>เข้าจอนี้ไม่ได้</strong>
            <p>{denyReason(session.role, flow)}</p>
            <span className="who">
              กำลังใช้งานในชื่อ <b>{session.name}</b> · {session.title}
            </span>
            <p className="hint">
              ในระบบจริงพนักงานจะเห็นเฉพาะจอที่ตัวเองต้องใช้ —
              และทุกครั้งที่แตะบัตรเข้าใช้งานมีบันทึกในจอเจ้าของ
            </p>
          </div>
        ) : (
          <>
            {flow === "guest" && (
              <PhoneFrame>
                <GuestRouter />
              </PhoneFrame>
            )}
            {flow === "desk" && <DeskApp />}
            {flow === "staff" && <StaffApp />}
            {flow === "owner" && <OwnerApp />}
            {flow === "pos" && <PosApp />}
          </>
        )}
        </>
        )}
      </div>
      <Directory open={dir} onClose={() => setDir(false)} />
      <Welcome />
    </div>
  );
}

export default function App() {
  return (
    <BackendProvider>
      <HotelProvider>
        <BookingProvider>
          <Stage />
        </BookingProvider>
      </HotelProvider>
    </BackendProvider>
  );
}

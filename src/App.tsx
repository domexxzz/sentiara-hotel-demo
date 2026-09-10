import { useState } from "react";
import "./App.css";
import { BookingProvider, useBooking } from "./store";
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
import { HotelProvider, useHotel } from "./hotel/hotelStore";
import { Identity } from "./components/Identity";
import { canOpen, denyReason } from "./lib/roles";
import { BackendProvider, useBackend } from "./lib/backend";
import { ConnectionBar, SignIn } from "./components/Connection";

type Flow = "guest" | "desk" | "staff" | "owner" | "pos";

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
  const backend = useBackend();
  const head = HEADINGS[flow];
  const { session } = useHotel();
  // ยังไม่แตะบัตร = โหมดสาธิต เปิดได้ทุกจอ · แตะแล้วบังคับสิทธิ์จริง
  const allowed = (f: Flow) => !session || canOpen(session.role, f);
  const blocked = !allowed(flow);

  return (
    <div className={`stage ${flow !== "guest" && flow !== "staff" ? "wide" : ""}`}>
      <div className="stage-inner">
        <header className="stage-head">
          <span className="k">Sentiara · Interactive Prototype</span>
          <h1>{head.title}</h1>
          <p>{backend.mode === "demo" ? head.note : "เชื่อมต่อระบบโรงแรม · รายการที่ยังไม่รองรับจะแจ้งให้ทราบเมื่อทำรายการ"}</p>
        </header>

        <ConnectionBar />
        <Identity />

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
                {f.label}
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

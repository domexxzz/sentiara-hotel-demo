import { useEffect } from "react";
import "./desk.css";
import { SHIFT } from "./deskData";
import { DeskProvider, type DeskView } from "./deskStore";
import { useDesk, useHotel } from "../contexts";
import { canOpenDesk } from "../lib/roles";
import { Rack } from "./Rack";
import { Calendar } from "./Calendar";
import { Inbox } from "./Inbox";
import { GuestRegister } from "./GuestRegister";
import { TaxInvoice } from "./TaxInvoice";
import { CheckIn } from "./CheckIn";
import { WalkIn } from "./WalkIn";
import { CheckOut } from "./CheckOut";
import { ManageBooking } from "./ManageBooking";
import { Icon, type IconName } from "../components/Icon";

const NAV: { view: DeskView; label: string; icon: IconName }[] = [
  { view: "rack", label: "ผังห้อง & วันนี้", icon: "bed" },
  { view: "calendar", label: "ปฏิทินห้องล่วงหน้า", icon: "calendar" },
  { view: "inbox", label: "กล่องข้อความรวม", icon: "chat" },
  { view: "walkin", label: "Walk-in / จองใหม่", icon: "plus" },
  { view: "checkout", label: "เช็กเอาท์ & บิล", icon: "receipt" },
  { view: "invoice", label: "ใบกำกับภาษี", icon: "tag" },
  { view: "register", label: "ทะเบียนผู้พัก ร.ร.3/4", icon: "shield" },
];

function Toasts() {
  const { state, dispatch } = useDesk();

  useEffect(() => {
    if (state.toasts.length === 0) return;
    const t = window.setTimeout(
      () => dispatch({ type: "DROP_TOAST", id: state.toasts[0].id }),
      4200,
    );
    return () => window.clearTimeout(t);
  }, [state.toasts, dispatch]);

  return (
    <div className="toasts">
      {state.toasts.map((t) => (
        <div key={t.id} className="toast">
          <Icon name="check" size={15} className="ic" />
          {t.text}
        </div>
      ))}
    </div>
  );
}

function DeskRouter() {
  const { state } = useDesk();
  switch (state.view) {
    case "calendar":
      return <Calendar />;
    case "inbox":
      return <Inbox />;
    case "register":
      return <GuestRegister />;
    case "invoice":
      return <TaxInvoice />;
    case "checkin":
      return <CheckIn />;
    case "walkin":
      return <WalkIn />;
    case "checkout":
      return <CheckOut />;
    case "manage":
      return <ManageBooking />;
    default:
      return <Rack />;
  }
}

function DeskShell() {
  const { state, dispatch } = useDesk();
  const { arrivals, unreadChats, session } = useHotel();
  // ยังไม่แตะบัตร = เห็นครบ · แตะแล้วเห็นเฉพาะที่มีสิทธิ์
  const nav = NAV.filter((n) => !session || canOpenDesk(session.role, n.view));

  return (
    <div className="deskshell">
      <div className="deskwin">
        <div className="deskchrome">
          <span className="lights">
            <i />
            <i />
            <i />
          </span>
          <span className="url">sentiara.local · เซิร์ฟเวอร์ในโรงแรม (LAN)</span>
        </div>

        <div className="deskbody">
          <nav className="desknav">
            <div className="logo">
              <span className="k">Front desk</span>
              <strong>Sentiara PMS</strong>
            </div>
            {nav.map((n) => (
              <button
                key={n.view}
                className={`navitem ${
                  state.view === n.view ||
                  (n.view === "rack" && state.view === "checkin")
                    ? "on"
                    : ""
                }`}
                onClick={() => dispatch({ type: "VIEW", view: n.view })}
              >
                <Icon name={n.icon} size={16} />
                {n.label}
                {n.view === "inbox" && unreadChats > 0 && (
                  <span className="badge">{unreadChats}</span>
                )}
                {n.view === "rack" && arrivals.length > 0 && (
                  <span className="badge">{arrivals.length}</span>
                )}
              </button>
            ))}
            <div className="sync">
              <b>SERVER · LAN — ออนไลน์</b>
              {SHIFT.sync}
              <br />
              {SHIFT.staff} · {SHIFT.window}
            </div>
          </nav>

          <main className="deskmain">
            <DeskRouter />
          </main>
        </div>
      </div>
      <Toasts />
    </div>
  );
}

export function DeskApp() {
  return (
    <DeskProvider>
      <DeskShell />
    </DeskProvider>
  );
}

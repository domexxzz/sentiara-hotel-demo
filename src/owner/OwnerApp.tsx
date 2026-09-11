// The desktop window shell (.deskwin / .desknav / .deskmain) is shared with
// the front desk, so this screen reuses desk.css rather than redefining it.
import "../desk/desk.css";
import "./owner.css";
import { OwnerProvider, type OwnerTab } from "./ownerStore";
import { useHotel, useOwner } from "../contexts";
import { canOpenOwnerTab } from "../lib/roles";
import { Overview } from "./Overview";
import { Channels } from "./Channels";
import { Finance } from "./Finance";
import { Ledger } from "./Ledger";
import { ChivaGo } from "./ChivaGo";
import { Security } from "./Security";
import { Team } from "./Team";
import { Guests } from "./Guests";
import { Settings } from "./Settings";
import { Assistant } from "./Assistant";
import { Approvals } from "./Approvals";
import { DoorLog } from "./DoorLog";
import { Energy } from "./Energy";
import { Icon, type IconName } from "../components/Icon";

const NAV: { tab: OwnerTab; label: string; icon: IconName }[] = [
  { tab: "overview", label: "ภาพรวม & รายได้", icon: "receipt" },
  { tab: "finance", label: "รายจ่าย & กำไรขาดทุน", icon: "tag" },
  { tab: "ledger", label: "บัญชีคู่ & ส่งเข้าโปรแกรมบัญชี", icon: "receipt" },
  { tab: "guests", label: "ลูกค้า & แต้ม", icon: "star" },
  { tab: "chivago", label: "ChivaGo · สิทธิพิเศษ", icon: "sparkle" },
  { tab: "channels", label: "ช่องทางขาย & OTA", icon: "tag" },
  { tab: "team", label: "ทีมงาน & คลังของใช้", icon: "star" },
  { tab: "door", label: "ประตู & บัตร", icon: "key" },
  { tab: "energy", label: "ค่าไฟ & IoT", icon: "wifi" },
  { tab: "security", label: "ความปลอดภัย & กฎหมาย", icon: "shield" },
  { tab: "ai", label: "ถาม AI ผู้ช่วย", icon: "sparkle" },
  { tab: "approvals", label: "รออนุมัติ", icon: "shield" },
  { tab: "settings", label: "ตั้งค่าระบบ", icon: "key" },
];

function OwnerRouter() {
  const { state } = useOwner();
  switch (state.tab) {
    case "finance":
      return <Finance />;
    case "ledger":
      return <Ledger />;
    case "chivago":
      return <ChivaGo />;
    case "security":
      return <Security />;
    case "team":
      return <Team />;
    case "guests":
      return <Guests />;
    case "settings":
      return <Settings />;
    case "channels":
      return <Channels />;
    case "ai":
      return <Assistant />;
    case "approvals":
      return <Approvals />;
    case "door":
      return <DoorLog />;
    case "energy":
      return <Energy />;
    default:
      return <Overview />;
  }
}

function OwnerShell() {
  const { state, dispatch } = useOwner();
  const { session } = useHotel();
  // ผู้จัดการเห็นครบ · บทบาทอื่นที่หลุดเข้ามาได้เห็นเฉพาะที่มีสิทธิ์
  const nav = NAV.filter((n) => !session || canOpenOwnerTab(session.role, n.tab));

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
            app.sentiara.co · บริหารจากที่ไหนก็ได้ (เข้ารหัสผ่านอินเทอร์เน็ต)
          </span>
        </div>

        <div className="deskbody">
          <nav className="desknav">
            <div className="logo">
              <span className="k">Owner</span>
              <strong>Sentiara</strong>
            </div>
            {nav.map((n) => (
              <button
                key={n.tab}
                className={`navitem ${state.tab === n.tab ? "on" : ""}`}
                onClick={() => dispatch({ type: "TAB", tab: n.tab })}
              >
                <Icon name={n.icon} size={16} />
                {n.label}
                {n.tab === "approvals" && state.approvals.length > 0 && (
                  <span className="badge">{state.approvals.length}</span>
                )}
              </button>
            ))}
            <div className="sync">
              <b>ปิดยอดอัตโนมัติ · ตี 2</b>
              คุณดวงพร · เจ้าของกิจการ
              <br />
              เห็นทุกตัวเลขถึงบิลรายใบ
            </div>
          </nav>

          <main className="deskmain">
            <OwnerRouter />
          </main>
        </div>
      </div>
    </div>
  );
}

export function OwnerApp() {
  return (
    <OwnerProvider>
      <OwnerShell />
    </OwnerProvider>
  );
}

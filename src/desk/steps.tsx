import { useState } from "react";
import { Icon } from "../components/Icon";

export type ScannedId = {
  name: string;
  idNo: string;
  nationality: string;
  birth: string;
  address: string;
};

// Demo identities returned by the "scanner" — masked like the real mockup.
const THAI_ID: ScannedId = {
  name: "อนันต์ ศรีสุข",
  idNo: "0-5055-•••••-••-•",
  nationality: "ไทย",
  birth: "12 มี.ค. 2532",
  address: "ต.สุเทพ อ.เมือง จ.เชียงใหม่",
};

const PASSPORT: ScannedId = {
  name: "Tanaka Hiroshi",
  idNo: "TK••••8321",
  nationality: "ญี่ปุ่น (JPN)",
  birth: "04 Nov 1986",
  address: "Shibuya-ku, Tokyo, Japan",
};

// A different person walks up to the counter — never the guest already
// checking in, or the demo shows one name holding two rooms.
export const WALKIN_ID: ScannedId = {
  name: "ณัฐพงษ์ ทองดี",
  idNo: "1-3299-•••••-••-•",
  nationality: "ไทย",
  birth: "27 ก.ค. 2537",
  address: "ต.ช้างเผือก อ.เมือง จ.เชียงใหม่",
};

/**
 * ID / passport scanner step. Simulates the counter scanner filling the
 * guest record so staff never retype it.
 */
export function IdScan({
  foreign = false,
  identity,
  onScanned,
  scanned,
}: {
  foreign?: boolean;
  /** Override the identity the reader returns (walk-ins are a new person). */
  identity?: ScannedId;
  scanned: ScannedId | null;
  onScanned: (data: ScannedId) => void;
}) {
  const [busy, setBusy] = useState(false);

  const scan = () => {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      onScanned(identity ?? (foreign ? PASSPORT : THAI_ID));
    }, 1400);
  };

  if (scanned) {
    return (
      <>
        <div className="scanner done">
          <Icon name="check" size={30} style={{ color: "#1f7a4d" }} />
          <strong style={{ fontSize: 14 }}>
            อ่านข้อมูลสำเร็จ — ไม่ต้องพิมพ์ซ้ำ
          </strong>
          <p>ข้อมูลครบจากการสแกน{foreign ? "พาสปอร์ต" : "บัตรประชาชน"} · เก็บเข้าโปรไฟล์แขกอัตโนมัติ</p>
        </div>
        <div className="fieldrow">
          <div className="field">
            <label>ชื่อ-สกุล</label>
            <input value={scanned.name} disabled />
          </div>
          <div className="field">
            <label>{foreign ? "เลขพาสปอร์ต" : "เลขบัตรประชาชน"}</label>
            <input value={scanned.idNo} disabled />
          </div>
          <div className="field">
            <label>สัญชาติ</label>
            <input value={scanned.nationality} disabled />
          </div>
          <div className="field">
            <label>วันเกิด</label>
            <input value={scanned.birth} disabled />
          </div>
        </div>
        {foreign && (
          <div className="flag" style={{ alignSelf: "flex-start" }}>
            <Icon name="shield" size={13} />
            แขกต่างชาติ · ระบบเตรียมแบบ ตม.30 ให้แล้ว
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`scanner ${busy ? "busy" : ""}`}>
      <Icon name="shield" size={34} className="big" />
      {busy ? (
        <>
          <strong style={{ fontSize: 14 }}>กำลังอ่านข้อมูล…</strong>
          <span className="scanbar">
            <i />
          </span>
        </>
      ) : (
        <>
          <strong style={{ fontSize: 14 }}>
            วาง{foreign ? "พาสปอร์ต" : "บัตรประชาชน"}บนเครื่องอ่าน
          </strong>
          <p>
            ระบบดึงชื่อ เลขบัตร สัญชาติ และที่อยู่เข้าโปรไฟล์แขกเอง —
            พนักงานไม่ต้องคีย์ ลดพิมพ์ผิดและงานซ้ำ
          </p>
          <button className="btn primary" onClick={scan}>
            <Icon name="qr" size={16} />
            สแกน{foreign ? "พาสปอร์ต" : "บัตรประชาชน"}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * NFC key-card writer step. Encodes the room code onto the card in ~10s.
 */
export function NfcWrite({
  room,
  done,
  onDone,
}: {
  room: string;
  done: boolean;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const write = () => {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      onDone();
    }, 1600);
  };

  return (
    <div className={`nfcwrite ${busy ? "busy" : ""}`}>
      <span className="disc">
        <Icon name={done ? "check" : "key"} size={30} />
      </span>
      {done ? (
        <>
          <strong style={{ fontSize: 15 }}>เขียนบัตรห้อง {room} เรียบร้อย</strong>
          <p>
            รหัสถูกเข้ารหัสอยู่ในบัตร · ประตูอ่านบัตรได้เองแม้เน็ตล่ม ·
            บัตรหมดอายุเองตอนเช็กเอาท์ — แขกเก่าย้อนเข้าไม่ได้
          </p>
        </>
      ) : busy ? (
        <>
          <strong style={{ fontSize: 15 }}>กำลังเขียนบัตร…</strong>
          <p>เขียนรหัสห้อง {room} ลงบัตร — ใช้เวลา 10 วินาที</p>
        </>
      ) : (
        <>
          <strong style={{ fontSize: 15 }}>แตะบัตรเปล่าที่เครื่องเขียนบัตร</strong>
          <p>
            ระบบเขียนรหัสห้อง {room} ลงบัตร NFC · บัตรหาย ยกเลิกทันทีแล้วออกใบใหม่ได้ใน 10 วินาที
          </p>
          <button className="btn primary" onClick={write}>
            <Icon name="key" size={16} />
            เขียนบัตรห้อง {room}
          </button>
        </>
      )}
    </div>
  );
}

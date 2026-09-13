import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { TOTAL, WALK } from "./catalog";
import { goTo } from "./target";

/**
 * หน้าต้อนรับ — ขึ้นครั้งแรกที่เปิดเท่านั้น
 *
 * ทำไมต้องมี
 * -----------
 * ลิงก์เดโมถูกส่งต่อไปถึงคนที่ไม่มีใครยืนอธิบายข้าง ๆ · เปิดมาเจอจอจองมือถือ
 * แล้วไม่รู้ว่ามีอีกสี่มุมมอง ไม่รู้ว่ากดสารบัญได้ ไม่รู้ว่ากดพังได้ไม่เป็นไร
 * สามอย่างนี้ต้องบอกใน 10 วินาทีแรก ไม่งั้นเขาปิดไปโดยเห็นแค่หนึ่งในห้าของระบบ
 *
 * ขึ้นครั้งเดียวแล้วจำไว้ — คนที่กลับมาดูซ้ำไม่ต้องมาปิดกล่องทุกครั้ง
 * แต่ถ้ากดรีเซ็ตข้อมูล กล่องนี้จะกลับมาด้วย เพราะนั่นคือการเริ่มรอบใหม่
 */
const SEEN = "sentiara:welcomed";

export function Welcome() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN)) setOpen(true);
    } catch {
      setOpen(true);        // โหมดส่วนตัวอ่านไม่ได้ ก็ให้เห็นไปเลยดีกว่าไม่เห็น
    }
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN, "1");
    } catch { /* เปิดในโหมดส่วนตัว จะขึ้นอีกรอบหน้าก็ไม่เป็นไร */ }
  };

  if (!open) return null;

  return (
    <div className="wel-wrap" role="dialog" aria-modal="true" aria-labelledby="wel-h">
      <button className="wel-scrim" onClick={close} aria-label="ปิด" />
      <div className="wel">
        <span className="k">Sentiara · ระบบจัดการโรงแรม</span>
        <h2 id="wel-h">นี่คือระบบจริง ที่กดเล่นได้ทุกปุ่ม</h2>
        <p className="lead">
          ข้อมูลทั้งหมดอยู่ในเบราว์เซอร์ของคุณเครื่องเดียว กดอะไรก็ได้
          ไม่กระทบใคร และไม่ต้องสมัครอะไรทั้งนั้น
        </p>

        <ul className="wel-list">
          <li>
            <Icon name="bed" size={17} className="ic" />
            <div>
              <b>ห้ามุมมองในระบบเดียว</b>
              <span>แขก · เคาน์เตอร์ · แม่บ้าน · เจ้าของ · ร้านอาหาร — สลับได้จากแถบด้านบน</span>
            </div>
          </li>
          <li>
            <Icon name="sparkle" size={17} className="ic" />
            <div>
              <b>หา {TOTAL} ฟังก์ชันเจอใน 3 วินาที</b>
              <span>
                กดปุ่ม “สารบัญฟังก์ชันทั้งหมด” (หรือปุ่ม <kbd>/</kbd>) แล้วกดชื่อฟังก์ชัน
                ระบบจะพาไปถึงจอนั้นให้เลย
              </span>
            </div>
          </li>
          <li>
            <Icon name="receipt" size={17} className="ic" />
            <div>
              <b>สิ่งที่กดในจอหนึ่ง โผล่ในอีกจอทันที</b>
              <span>ทุกมุมมองใช้ข้อมูลชุดเดียวกัน ไม่มีใครต้องคีย์ซ้ำ</span>
            </div>
          </li>
        </ul>

        <div className="wel-go">
          <button
            className="go"
            onClick={() => {
              close();
              goTo(WALK[0].go);
            }}
          >
            เดินให้ดูหนึ่งรอบ · {WALK.length} ขั้น
          </button>
          <button onClick={close}>เริ่มกดเองเลย</button>
        </div>
      </div>
    </div>
  );
}

/** ล้างข้อมูลที่เดโมเก็บไว้แล้วเริ่มใหม่
 *
 * ล้างเฉพาะคีย์ของเรา ไม่ใช่ `localStorage.clear()` — หน้าอื่นที่อยู่โดเมน
 * เดียวกันอาจเก็บของไว้ด้วย และเดโมไม่มีสิทธิ์ไปลบของคนอื่น
 */
export function resetDemo(): void {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("sentiara:")) localStorage.removeItem(k);
    }
    sessionStorage.removeItem("sentiara:token");
  } catch { /* อ่านเขียนไม่ได้ก็ไม่มีอะไรให้ล้างอยู่แล้ว */ }
  location.reload();
}

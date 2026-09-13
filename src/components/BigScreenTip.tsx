import { useState } from "react";
import { Icon } from "./Icon";
import type { Flow } from "../tour/target";

/**
 * แถบแนะนำให้เปิดบนจอใหญ่ — ขึ้นเฉพาะจอที่เป็นของคอมจริง ๆ
 *
 * ทำไมไม่ขึ้นทุกจอ
 * -----------------
 * ห้ามุมมองในเดโมไม่ได้ออกแบบมาเพื่ออุปกรณ์เดียวกัน · จอแขกกับจอแม่บ้าน
 * **ตั้งใจทำมาให้มือถือ** — แขกจองจากมือถือจริง แม่บ้านถือมือถือเดินตามห้อง
 * ถ้าขึ้นข้อความ "ควรเปิดบนคอม" ตอนคนกำลังดูสองจอนั้น มันขัดกับสิ่งที่เขา
 * เห็นอยู่ตรงหน้า และทำให้เขาคิดว่าระบบทำมาไม่ครบ ทั้งที่ตรงกันข้าม
 *
 * ทำไมเป็นแถบ ไม่ใช่กล่องเด้งทับจอ
 * ---------------------------------
 * กล่องที่เด้งมาทับจอทำให้คนกดปิดโดยไม่อ่าน แล้วเราเสียทั้งข้อความและ
 * ความรู้สึกดีของคนดู · แถบใต้หัวจออ่านได้โดยไม่ต้องหยุดสิ่งที่กำลังทำ
 *
 * ทำไมปุ่มคัดลอกลิงก์ถึงสำคัญกว่าที่คิด
 * --------------------------------------
 * คนที่อยากเปิดบนคอมจริง ๆ ติดตรงที่ไม่รู้จะส่งลิงก์ให้ตัวเองยังไง
 * ต้องพิมพ์ที่อยู่ใหม่ทั้งเส้นซึ่งไม่มีใครทำ · กดปุ่มเดียวแล้ววางในไลน์ตัวเอง
 * คือระยะทางที่สั้นพอให้เกิดขึ้นจริง
 */

/** จอที่พนักงานใช้บนคอมพิวเตอร์ · อีกสองจอตั้งใจทำมาให้มือถือ */
const DESKTOP_FLOWS: Flow[] = ["desk", "owner", "pos"];

const SEEN = "sentiara:bigscreen";

export function BigScreenTip({ flow }: { flow: Flow }) {
  const [gone, setGone] = useState(() => {
    try {
      return localStorage.getItem(SEEN) === "1";
    } catch {
      return false;    // อ่านไม่ได้ก็ให้เห็นไปเลย ดีกว่าซ่อนของที่ควรบอก
    }
  });
  const [copied, setCopied] = useState<"ok" | "manual" | null>(null);

  if (gone || !DESKTOP_FLOWS.includes(flow)) return null;

  const close = () => {
    setGone(true);
    try {
      localStorage.setItem(SEEN, "1");
    } catch { /* โหมดส่วนตัว จะขึ้นอีกรอบหน้าก็ไม่เป็นไร */ }
  };

  const copy = async () => {
    // navigator.clipboard ใช้ได้เฉพาะหน้าที่เสิร์ฟผ่าน https หรือ localhost
    // เปิดไฟล์ตรง ๆ หรือผ่าน http ธรรมดาจะโยน error · ตกลงมาที่การโชว์ลิงก์
    // ให้กดค้างคัดลอกเอง ดีกว่าปุ่มที่กดแล้วเงียบโดยไม่มีอะไรเกิดขึ้น
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied("ok");
    } catch {
      setCopied("manual");
    }
  };

  return (
    <aside className="bigtip" role="note">
      <Icon name="shield" size={16} className="ic" />
      <div className="txt">
        <b>เปิดบนจอใหญ่จะเห็นเต็มกว่า</b>
        <p>
          หน้าเคาน์เตอร์ จอเจ้าของ และ POS เป็นจอที่พนักงานใช้บนคอมพิวเตอร์
          ส่วนจอแขกกับจอแม่บ้านออกแบบมาให้ใช้บนมือถืออยู่แล้ว
        </p>
        {copied === "manual" && (
          <p className="manual">
            คัดลอกอัตโนมัติไม่ได้ในหน้านี้ — กดค้างที่ลิงก์นี้แล้วเลือกคัดลอก
            <code>{location.href}</code>
          </p>
        )}
        <div className="acts">
          <button type="button" onClick={() => void copy()}>
            {copied === "ok" ? "คัดลอกแล้ว" : "คัดลอกลิงก์ไว้เปิดทีหลัง"}
          </button>
          <button type="button" className="go" onClick={close}>
            ดูต่อเลย
          </button>
        </div>
      </div>
    </aside>
  );
}

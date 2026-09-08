import { useState } from "react";
import { Icon } from "./Icon";

/**
 * แกลเลอรีรูปห้อง
 *
 * แขกตัดสินใจจองจากรูป ไม่ใช่จากคำว่า "32 ตร.ม. เตียงใหญ่" — การ์ดห้องที่ไม่มีรูป
 * คือการ์ดที่ยังขายไม่ได้
 *
 * รูปมาจากไฟล์ที่โรงแรมอัปโหลดเอง (`/rooms/<id>-1.jpg` …) ถ้ายังไม่มีไฟล์
 * ตัวนี้จะถอยไปใช้พื้นหลังเดิมโดยไม่พังและไม่ขึ้นรูปแตก — ติดตั้งจริงค่อยวางรูปลง
 * โฟลเดอร์ แล้วมันขึ้นเอง ไม่ต้องแก้โค้ด
 */
export function RoomGallery({
  id,
  photos,
  alt,
  children,
}: {
  id: string;
  photos?: string[];
  alt: string;
  /** ป้ายที่ทับบนรูป เช่น แท็กโปรโมชันและขนาดห้อง */
  children?: React.ReactNode;
}) {
  const [at, setAt] = useState(0);
  // รูปที่โหลดไม่สำเร็จถูกตัดออก ไม่ปล่อยให้เป็นกรอบว่าง
  const [broken, setBroken] = useState<Record<number, boolean>>({});

  const list = (photos ?? []).filter((_, i) => !broken[i]);
  const hasPhoto = list.length > 0;
  const idx = Math.min(at, Math.max(0, list.length - 1));

  const go = (d: number) => setAt((v) => (v + d + list.length) % list.length);

  return (
    <div className={`gal ${id} ${hasPhoto ? "shot" : ""}`}>
      {(photos ?? []).map((src, i) =>
        broken[i] ? null : (
          <img
            key={src}
            src={src}
            alt={i === 0 ? alt : ""}
            loading="lazy"
            decoding="async"
            className={list.indexOf(src) === idx ? "on" : ""}
            onError={() => setBroken((b) => ({ ...b, [i]: true }))}
          />
        ),
      )}

      {children}

      {list.length > 1 && (
        <>
          <button className="galnav prev" onClick={() => go(-1)} aria-label="รูปก่อนหน้า">
            <Icon name="back" size={16} />
          </button>
          <button className="galnav next" onClick={() => go(1)} aria-label="รูปถัดไป">
            <Icon name="chevron" size={16} />
          </button>
          <div className="galdots" role="tablist" aria-label="เลือกรูป">
            {list.map((src, i) => (
              <button
                key={src}
                role="tab"
                aria-selected={i === idx}
                aria-label={`รูปที่ ${i + 1}`}
                className={i === idx ? "on" : ""}
                onClick={() => setAt(i)}
              />
            ))}
          </div>
          <span className="galcount">
            {idx + 1}/{list.length}
          </span>
        </>
      )}

      {!hasPhoto && (
        <span className="galnone">
          <Icon name="pin" size={13} />
          รูปห้องจริงของโรงแรมคุณจะขึ้นตรงนี้
        </span>
      )}
    </div>
  );
}

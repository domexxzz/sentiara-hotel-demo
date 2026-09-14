/**
 * กราฟจิ๋วสองแบบ วาดด้วย SVG ล้วน
 *
 * ทำไมไม่ลงไลบรารีกราฟ
 * ---------------------
 * ไลบรารีกราฟที่ใช้กันทั่วไปหนัก 40–120 KB หลังบีบอัด · บันเดิลทั้งเดโมตอนนี้
 * 173 KB — ใส่เข้าไปคือโตขึ้นเกือบเท่าตัวเพื่อเส้นสองแบบที่วาดเองได้ใน 60 บรรทัด
 * และเดโมนี้ถูกส่งเป็นลิงก์ให้คนเปิดจากมือถือ ขนาดไฟล์คือเวลาที่เขาต้องรอ
 *
 * ทั้งสองตัวไม่มี state ไม่มี effect — รับตัวเลขเข้า คืน SVG ออก
 */

/** เส้นกราฟจิ๋วในการ์ดตัวเลข — บอก "ทิศทาง" ไม่ได้บอก "ค่า"
 *
 * ตั้งใจไม่มีแกน ไม่มีตัวเลขกำกับ และไม่ให้กดได้ · หน้าที่มันคือตอบคำถาม
 * "ขึ้นมาตลอด หรือเพิ่งเด้งคืนเดียว" ซึ่งตัวเลขใหญ่กับป้าย +4% ตอบไม่ได้
 * ใครอยากได้ค่าจริงให้กดการ์ดดูที่มา ซึ่งมีอยู่แล้ว
 */
export function Sparkline({
  values,
  up,
  className = "",
}: {
  values: number[];
  /** ขึ้นหรือลง — คุมสีเส้น · ส่งเข้ามาแทนที่จะคำนวณเอง เพราะเจ้าของการ์ด
      รู้ดีกว่าว่า "ดี" แปลว่าอะไร (ต้นทุนลดลงคือดี แต่รายได้ลดลงคือไม่ดี) */
  up: boolean;
  className?: string;
}) {
  if (values.length < 2) return null;
  const W = 160;
  const H = 34;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  // เว้นขอบบนล่าง 3px ไม่ให้เส้นโดนตัดตอนค่าสูงสุด/ต่ำสุด
  const pt = (v: number, i: number) =>
    `${(i / (values.length - 1)) * W},${H - ((v - min) / span) * (H - 6) - 3}`;
  const line = values.map(pt).join(" ");

  return (
    <svg
      className={`spark ${up ? "up" : "down"} ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={line} />
    </svg>
  );
}

export interface Slice {
  label: string;
  value: number;
  /** สี CSS ตรง ๆ — ตั้งใจให้ผู้เรียกกำหนด เพราะสัดส่วนแต่ละจอมีความหมายต่างกัน */
  color: string;
}

/** วงแหวนสัดส่วน + คำอธิบายข้าง ๆ
 *
 * ใช้ `stroke-dasharray` บนวงกลมวงเดียวต่อหนึ่งส่วน แทนการคำนวณ path arc
 * เพราะ arc ต้องจับมุมกับทิศการวาด ซึ่งพลาดแล้วได้วงที่ดูถูกแต่เรียงผิดลำดับ
 * วิธีนี้ความยาวเส้น = สัดส่วนตรง ๆ ผิดแล้วเห็นทันที
 */
export function Donut({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: Slice[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = slices.reduce((t, s) => t + s.value, 0) || 1;
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="donutwrap">
      <svg viewBox="0 0 140 140" className="donut" role="img"
        aria-label={`${centerLabel} ${centerValue}`}>
        {slices.map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="20"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += len;
          return el;
        })}
        <text x="70" y="66" className="d-lbl">{centerLabel}</text>
        <text x="70" y="86" className="d-val">{centerValue}</text>
      </svg>
      <ul className="donut-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <b>{Math.round((s.value / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

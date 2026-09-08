import { useState } from "react";
import {
  TH_DOW,
  TH_MONTHS_FULL,
  TODAY,
  monthGrid,
  nightsBetween,
  parse,
} from "../lib/date";
import { Icon } from "./Icon";

/**
 * เลือกช่วงวันเข้าพัก — กดครั้งแรกได้วันเช็กอิน กดครั้งที่สองได้วันเช็กเอาท์
 * กดวันที่ก่อนวันเช็กอินเดิม = เริ่มเลือกใหม่จากวันนั้น
 */
export function DateRangePicker({
  checkIn,
  checkOut,
  onChange,
  onClose,
}: {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
  onClose: () => void;
}) {
  const start = parse(checkIn);
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() });
  /** ระหว่างเลือก: มีแค่วันเช็กอิน ยังไม่มีวันออก */
  const [pendingIn, setPendingIn] = useState<string | null>(null);

  const cells = monthGrid(view.y, view.m);
  const activeIn = pendingIn ?? checkIn;
  const activeOut = pendingIn ? null : checkOut;

  const shift = (n: number) => {
    const d = new Date(view.y, view.m + n, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const pick = (k: string) => {
    if (k < TODAY) return; // ไม่ให้เลือกวันที่ผ่านมาแล้ว
    if (!pendingIn) {
      setPendingIn(k);
      return;
    }
    if (k <= pendingIn) {
      setPendingIn(k); // กดย้อน = เริ่มเลือกใหม่
      return;
    }
    onChange(pendingIn, k);
    setPendingIn(null);
  };

  const viewKey = `${view.y}-${String(view.m + 1).padStart(2, "0")}`;
  const nights = activeOut ? nightsBetween(activeIn, activeOut) : 0;

  return (
    <div className="cal">
      <div className="cal-head">
        <button
          className="cal-nav"
          onClick={() => shift(-1)}
          aria-label="เดือนก่อนหน้า"
          disabled={viewKey <= TODAY.slice(0, 7)}
        >
          <Icon name="back" size={16} />
        </button>
        <strong>
          {TH_MONTHS_FULL[view.m]} {view.y}
        </strong>
        <button className="cal-nav" onClick={() => shift(1)} aria-label="เดือนถัดไป">
          <Icon name="chevron" size={16} />
        </button>
      </div>

      <div className="cal-dow">
        {TH_DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((c) => {
          const past = c.k < TODAY;
          const isIn = c.k === activeIn;
          const isOut = activeOut === c.k;
          const inRange = !!activeOut && c.k > activeIn && c.k < activeOut;
          return (
            <button
              key={c.k}
              className={[
                "cal-day",
                !c.inMonth && "muted",
                past && "past",
                isIn && "edge start",
                isOut && "edge end",
                inRange && "between",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={past}
              onClick={() => pick(c.k)}
            >
              {c.day}
            </button>
          );
        })}
      </div>

      <div className="cal-foot">
        <span>
          {pendingIn ? "เลือกวันเช็กเอาท์" : `${nights} คืน · เช็กอิน 14:00 · เช็กเอาท์ 12:00`}
        </span>
        <button className="btn dark sm" onClick={onClose} disabled={!!pendingIn}>
          เสร็จ
        </button>
      </div>
    </div>
  );
}

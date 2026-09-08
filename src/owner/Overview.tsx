import { LAST_WEEK, MONTH, WEEK, type Source } from "./ownerData";
import { useOwner } from "./ownerStore";
import { WEEKEND_PCT } from "../lib/rates";
import { useHotel } from "../hotel/hotelStore";
import { money, delta } from "../lib/format";
import { Icon } from "../components/Icon";

export function Overview() {
  const { state, dispatch, totals } = useOwner();
  const hotel = useHotel();

  // ── ยอดวันนี้: คิดจากบิลที่ "ปิดจริง" ในเซสชันนี้เท่านั้น ─────────────
  const closed = hotel.state.closed;
  const liveLines = closed.flatMap((c) => c.lines);
  const sum = (kinds: string[]) =>
    liveLines
      .filter((l) => kinds.includes(l.kind))
      .reduce((t, l) => t + l.price * l.qty, 0);
  const todayRooms = sum(["room"]);
  const todayFnb = sum(["fnb", "service"]);
  const todayTotal = todayRooms + todayFnb;

  // ต่อแท่ง "วันนี้" ท้ายกราฟเมื่อมีบิลปิดแล้ว
  const days = todayTotal
    ? [...WEEK, { label: "วันนี้", rooms: todayRooms, fnb: todayFnb, occ: hotel.stats.occupancy, sold: hotel.stats.sold, orders: liveLines.filter((l) => l.kind === "fnb").length }]
    : WEEK;
  const dayIdx = Math.min(state.dayIdx, days.length - 1);
  const day = days[dayIdx];
  const peak = Math.max(...days.map((d) => d.rooms + d.fnb));
  const last = WEEK[WEEK.length - 1];

  // Every KPI carries the bills it was computed from.
  // อัตราเข้าพักคืนนี้ — เทียบกับสัปดาห์ก่อนได้บนฐานเดียวกัน (คืนเต็ม vs คืนเต็ม)
  const tonightPct = Math.round((hotel.stats.soldTonight / hotel.stats.sellable) * 100);

  const KPIS: {
    id: string;
    k: string;
    n: string;
    sub: string;
    dl?: string;
    up?: boolean;
    title: string;
    lead: string;
    rows: Source[];
  }[] = [
    {
      id: "today",
      k: "ปิดบิลแล้ววันนี้",
      n: money(todayTotal),
      sub: closed.length
        ? `${closed.length} บิล · สด ณ ตอนนี้`
        : "ยังไม่มีบิลปิดวันนี้",
      dl: closed.length ? `${closed.length} ใบ` : undefined,
      up: true,
      title: todayTotal
        ? `ที่มาของ ${money(todayTotal)} — บิลที่ปิดวันนี้`
        : "ยังไม่มีบิลที่ปิดวันนี้",
      lead: "นับจากบิลที่ปิดแล้วเท่านั้น — ไปปิดบิลที่หน้าเคาน์เตอร์แล้วตัวเลขนี้ขยับทันที",
      rows: closed.length
        ? [
            ...closed.map((c) => ({
              label: `ห้อง ${c.room} · ${c.guest}`,
              note: `${c.lines.length} รายการในบิล`,
              amount: money(c.total),
            })),
            { label: "ค่าห้องรวม", amount: money(todayRooms) },
            { label: "ร้านอาหาร & บริการ", amount: money(todayFnb) },
            { label: "รวมวันนี้", amount: money(todayTotal) },
          ]
        : [
            {
              label: "ยังไม่มีบิลปิด",
              note: "ลองไปที่หน้าเคาน์เตอร์ แล้วกดปิดบิล · เช็กเอาท์",
              amount: "฿0",
            },
          ],
    },
    {
      id: "night",
      k: "รายได้เมื่อคืน",
      n: money(totals.lastNight),
      sub: `${last.label} · ขายได้ ${last.sold} ห้อง`,
      dl: delta(totals.lastNight, totals.prevNight),
      up: totals.lastNight >= totals.prevNight,
      title: `ที่มาของ ${money(totals.lastNight)} — คืน ${last.label}`,
      lead: "นับจากบิลที่ปิดแล้วเท่านั้น · ปิดยอดอัตโนมัติตี 2 ทุกคืน",
      rows: [
        { label: "ค่าห้อง", note: `${last.sold} ห้องที่ขายได้`, amount: money(last.rooms) },
        {
          label: "อาหาร & เครื่องดื่ม",
          note: `${last.orders} ออร์เดอร์จาก POS และจอครัว`,
          amount: money(last.fnb),
        },
        { label: "รวมคืนนั้น", amount: money(totals.lastNight) },
      ],
    },
    {
      id: "week",
      k: "รายได้สัปดาห์นี้",
      n: money(totals.revenue),
      sub: "7 คืนล่าสุด · อา 7 – ส 13 ส.ค.",
      dl: delta(totals.revenue, LAST_WEEK.revenue),
      up: totals.revenue >= LAST_WEEK.revenue,
      title: `ที่มาของ ${money(totals.revenue)} — 7 คืน`,
      lead: "ยอดร้านอาหารแยกบัญชีจากค่าห้อง — รู้ว่าร้านเลี้ยงตัวเองได้จริงไหม",
      rows: [
        { label: "ค่าห้องรวม", note: "จากบิลห้องที่ปิดแล้ว", amount: money(totals.rooms) },
        {
          label: "ร้านอาหาร & คาเฟ่",
          note: `คิดเป็น ${totals.fnbShare}% ของรายได้รวม`,
          amount: money(totals.fnb),
        },
        {
          label: "สัปดาห์ก่อน",
          note: "ช่วงเวลาเดียวกัน",
          amount: money(LAST_WEEK.revenue),
        },
      ],
    },
    {
      id: "occ",
      k: "เข้าพักคืนนี้",
      n: tonightPct + "%",
      sub: `แขกอยู่ในห้องแล้ว ${hotel.stats.inHouseRooms} ห้อง · เฉลี่ยสัปดาห์ ${totals.occAvg}%`,
      // percentages compare in points, not as a relative change
      dl: `${tonightPct >= LAST_WEEK.occ ? "+" : "−"}${Math.abs(tonightPct - LAST_WEEK.occ)} จุด`,
      up: tonightPct >= LAST_WEEK.occ,
      title: `ที่มาของ ${tonightPct}% — ห้องที่ขายแล้วสำหรับคืนนี้`,
      lead: "ห้องที่มีคนจองคืนนี้ หารด้วยห้องที่เปิดขาย (ไม่นับห้องปิดซ่อม) — รวมห้องที่แม่บ้านยังทำอยู่ เพราะแขกจองไว้แล้ว",
      rows: [
        { label: "ขายแล้วสำหรับคืนนี้", amount: hotel.stats.soldTonight + " ห้อง" },
        {
          label: "ในนั้นแขกเข้าห้องแล้ว",
          note: `ที่เหลือ ${hotel.stats.soldTonight - hotel.stats.inHouseRooms} ห้องยังไม่ถึง หรือรอแม่บ้านทำห้องเสร็จ`,
          amount: hotel.stats.inHouseRooms + " ห้อง",
        },
        { label: "ว่างพร้อมขาย", amount: hotel.stats.ready + " ห้อง" },
        { label: "รอแม่บ้าน", amount: hotel.stats.dirty + " ห้อง" },
        {
          label: "ปิดซ่อม (ไม่นับในสูตร)",
          amount: hotel.state.rooms.filter((r) => r.status === "ooo").length + " ห้อง",
        },
        { label: "เฉลี่ย 7 วันย้อนหลัง", note: "จากบิลที่ปิดแล้ว", amount: totals.occAvg + "%" },
      ],
    },
    {
      id: "adr",
      k: "ADR · ราคาห้องเฉลี่ย",
      n: money(totals.adr),
      sub: `7 คืน · ${totals.soldNights} ห้องที่ขายได้`,
      title: `ที่มาของ ${money(totals.adr)} — ADR 7 คืน`,
      lead: "ค่าห้องรวม หารด้วยจำนวนห้องที่ขายได้จริง — ไม่รวมรายได้ร้านอาหาร",
      rows: [
        { label: "ค่าห้องรวม 7 คืน", note: "ไม่รวม F&B", amount: money(totals.rooms) },
        { label: "ห้องที่ขายได้", amount: totals.soldNights + " ห้อง-คืน" },
        { label: "ADR = ค่าห้อง ÷ ห้องที่ขายได้", amount: money(totals.adr) },
        {
          label: "เรตวันหยุด (ศ–ส)",
          note: `บวก ${WEEKEND_PCT}% จากเรตวันธรรมดา — ตัวที่ดัน ADR ขึ้น`,
          amount: "+" + WEEKEND_PCT + "%",
        },
      ],
    },
    {
      id: "revpar",
      k: "RevPAR · รายได้ต่อห้องที่เปิดขาย",
      n: money(totals.revpar),
      sub: `ค่าห้อง 7 คืน ÷ ${totals.availNights} ห้อง-คืนที่เปิดขาย`,
      title: `ที่มาของ ${money(totals.revpar)} — RevPAR 7 คืน`,
      lead: "ค่าห้องรวม หารด้วยห้องที่เปิดขายทั้งหมด — ห้องที่ขายไม่ออกถูกนับด้วย จึงบอกได้ว่าเสียโอกาสไปเท่าไร",
      rows: [
        { label: "ค่าห้องรวม 7 คืน", amount: money(totals.rooms) },
        { label: "ห้องที่เปิดขายทั้งหมด", note: "7 คืนรวมกัน", amount: totals.availNights + " ห้อง-คืน" },
        { label: "RevPAR = ค่าห้อง ÷ ห้องที่เปิดขาย", amount: money(totals.revpar) },
        {
          label: "ถ้าเข้าพักขึ้นเป็น 90%",
          note: "ADR เท่าเดิม — รายได้ห้อง 7 คืนที่ควรได้",
          amount: money(Math.round(totals.adr * 0.9 * totals.availNights)),
        },
        {
          label: "ส่วนต่างที่ยังไม่ได้เก็บ",
          note: "เทียบกับที่ทำได้จริงสัปดาห์นี้",
          amount: money(Math.max(0, Math.round(totals.adr * 0.9 * totals.availNights) - totals.rooms)),
        },
      ],
    },
    {
      id: "direct",
      k: "จองตรง",
      n: MONTH.directShare + "%",
      sub: `ประหยัดค่าคอม ${money(MONTH.otaCommissionSaved)}`,
      dl: `+${MONTH.directShare - LAST_WEEK.direct} จุด`,
      up: true,
      title: "ที่มาของสัดส่วนจองตรง 26%",
      lead: "ทุกการจองผ่าน OTA คือกำไร 15–18% ที่หลุดมือ — หน้านี้พิสูจน์ด้วยตัวเลขว่าคุ้มจริงไหม",
      rows: [
        { label: "บิลทั้งเดือน", amount: MONTH.bills + " ใบ" },
        {
          label: "ค่าคอมที่ประหยัดได้",
          note: "เทียบอัตรา OTA 15–18%",
          amount: money(MONTH.otaCommissionSaved),
        },
        {
          label: "กำไรสุทธิจากการดันจองตรง",
          note: "หักต้นทุนส่วนลดแล้ว · ได้ LINE แขกไว้ขายซ้ำ",
          amount: money(MONTH.directDiscountProfit),
        },
      ],
    },
  ];

  const openKpi = KPIS.find((k) => k.id === state.openKpi);

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">Sentiara · รายงานเช้า · 14 ส.ค. 2026</span>
          <h2>จอเจ้าของ</h2>
        </div>
      </div>

      <p className="owner-note">
        ตัวเลขทุกบรรทัดกดดูที่มาได้ — มาจากบิลจริงในระบบ ไม่ใช่ตัวเลขที่ใครพิมพ์เข้ามา
      </p>

      <div className="kpis">
        {KPIS.map((kp) => (
          <button
            key={kp.id}
            className={`kpi ${state.openKpi === kp.id ? "on" : ""}`}
            onClick={() => dispatch({ type: "KPI", id: kp.id })}
          >
            <Icon name="chevron" size={13} className="trace" />
            <span className="k">{kp.k}</span>
            <div className="n">{kp.n}</div>
            <span className="sub">{kp.sub}</span>
            {kp.dl && <span className={`dl ${kp.up ? "up" : "down"}`}>{kp.dl}</span>}
          </button>
        ))}
      </div>

      {openKpi && (
        <div className="trace-panel fade">
          <h4>{openKpi.title}</h4>
          <p className="lead">{openKpi.lead}</p>
          {openKpi.rows.map((r, i) => (
            <div key={i} className="trace-row">
              <span>
                {r.label}
                {r.note && <span className="sub">{r.note}</span>}
              </span>
              <span className="v">{r.amount}</span>
            </div>
          ))}
          <button
            className="btn ghost sm"
            style={{ marginTop: 12, alignSelf: "flex-start" }}
            onClick={() => dispatch({ type: "KPI", id: null })}
          >
            ปิดที่มา
          </button>
        </div>
      )}

      <div className="chart">
        <div className="chart-head">
          <h4>รายได้ 7 คืนล่าสุด{todayTotal ? " + วันนี้ (สด)" : ""}</h4>
          <span className="chart-legend">
            <span>
              <i style={{ background: "var(--accent)" }} />
              ค่าห้อง
            </span>
            <span>
              <i style={{ background: "var(--n700)" }} />
              อาหาร &amp; เครื่องดื่ม
            </span>
          </span>
        </div>

        <div className="bars">
          {days.map((d, i) => {
            const total = d.rooms + d.fnb;
            const h = (total / peak) * 100;
            const roomsPart = (d.rooms / total) * h;
            const fnbPart = (d.fnb / total) * h;
            return (
              <button
                key={d.label}
                className={`bar ${dayIdx === i ? "on" : ""}`}
                onClick={() => dispatch({ type: "DAY", idx: i })}
                aria-label={`${d.label} · ${money(total)}`}
              >
                <span className="stack">
                  <span className="seg-fnb" style={{ height: `${fnbPart}%` }} />
                  <span className="seg-rooms" style={{ height: `${roomsPart}%` }} />
                </span>
                <span className="lbl">{d.label}</span>
              </button>
            );
          })}
        </div>

        <div className="daycard">
          <div>
            <span className="k">คืน {day.label}</span>
            <div className="n">{money(day.rooms + day.fnb)}</div>
          </div>
          <div>
            <span className="k">ค่าห้อง</span>
            <div className="n">{money(day.rooms)}</div>
          </div>
          <div>
            <span className="k">ร้านอาหาร</span>
            <div className="n">{money(day.fnb)}</div>
          </div>
          <div>
            <span className="k">เข้าพัก</span>
            <div className="n">
              {day.occ}% · {day.sold} ห้อง
            </div>
          </div>
          <div>
            <span className="k">ออร์เดอร์</span>
            <div className="n">{day.orders}</div>
          </div>
        </div>
      </div>

      <p className="owner-note">
        ปิดยอดตี 2 ทุกคืนโดยไม่ต้องรอใครกด · ปิดบัญชีสิ้นเดือนได้ใน &lt; 2 วัน ·
        ทุกรายการวิ่งเข้าบิลเอง ทั้งแม่บ้าน คาเฟ่ และมิเตอร์ไฟรายห้อง
      </p>
    </>
  );
}

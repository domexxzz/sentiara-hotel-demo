import { useState } from "react";
import { useDesk, useHotel } from "../contexts";
import { TODAY, fmtLong, fmtShort, nightsBetween } from "../lib/date";
import { Icon } from "../components/Icon";

/**
 * ทะเบียนผู้พักตาม **มาตรา 35 พ.ร.บ.โรงแรม พ.ศ. 2547**
 *   ร.ร.3  บัตรทะเบียนผู้พัก — ผู้พักลงลายมือชื่อ *ทันทีที่เข้าพัก*
 *   ร.ร.4  ทะเบียนผู้พัก — บันทึกให้เสร็จ *ภายใน 24 ชม.* เก็บไว้ไม่น้อยกว่า 1 ปี
 *          และส่งให้นายทะเบียน (กรมการปกครอง)
 * แขกต่างชาติมีหน้าที่เพิ่มอีกชั้นคือ ตม.30 ตาม พ.ร.บ.คนเข้าเมือง ภายใน 24 ชม.
 */
export function GuestRegister() {
  const { dispatch } = useDesk();
  const hotel = useHotel();
  const [sent, setSent] = useState(false);

  // ทะเบียนผู้พักนับเฉพาะคนที่เข้าพักจริง ไม่ใช่ทุกการจอง
  const rows = hotel.state.bookings
    .filter((b) => b.status === "inhouse" && b.room)
    .sort((a, b) => (a.room ?? "").localeCompare(b.room ?? ""));

  const foreign = rows.filter((b) => b.foreign);
  const [card, setCard] = useState<string | null>(rows[0]?.id ?? null);
  const active = rows.find((b) => b.id === card);

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">ทะเบียนผู้พัก · พ.ร.บ. โรงแรม พ.ศ. 2547 มาตรา 35</span>
          <h2>ร.ร.3 &amp; ร.ร.4</h2>
        </div>
      </div>

      <p className="lead">
        กฎหมายบังคับให้ผู้พักลงลายมือชื่อใน <b>ร.ร.3</b> ทันทีที่เข้าพัก แล้วบันทึกลง <b>ร.ร.4</b>{" "}
        ให้เสร็จภายใน 24 ชม. เก็บไว้อย่างน้อย 1 ปีให้กรมการปกครองตรวจ —
        ระบบดึงจากการเช็กอินที่ทำไปแล้ว ไม่ต้องเขียนสมุดซ้ำ
      </p>

      <div className="rr-grid">
        {/* ── ร.ร.4 ทะเบียนผู้พัก ── */}
        <div className="rr-book">
          <div className="rr-head">
            <div>
              <span className="k">แบบ ร.ร.4 · ทะเบียนผู้พัก</span>
              <strong>{fmtLong(TODAY)}</strong>
            </div>
            <div className="rr-tags">
              <span className={`rr-tag ${sent ? "ok" : "wait"}`}>
                {sent ? "ส่งนายทะเบียนแล้ว" : `ค้างส่ง ${rows.length} ราย`}
              </span>
              {foreign.length > 0 && (
                <span className="rr-tag wait">ต่างชาติ {foreign.length} ราย · ต้องยื่น ตม.30</span>
              )}
            </div>
          </div>
          <div className="calwrap">
            <table className="calgrid rr-table">
              <thead>
                <tr>
                  <th>ห้อง</th>
                  <th>ชื่อผู้พัก</th>
                  <th>สัญชาติ</th>
                  <th>เข้าพัก</th>
                  <th>ออก</th>
                  <th>คืน</th>
                  <th>ร.ร.3</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr
                    key={b.id}
                    className={b.id === card ? "on" : ""}
                    onClick={() => setCard(b.id)}
                  >
                    <td>
                      <b>{b.room}</b>
                    </td>
                    <td className="nm">{b.guest}</td>
                    <td>{b.foreign ? "ต่างชาติ" : "ไทย"}</td>
                    <td>{fmtShort(b.checkIn)}</td>
                    <td>{fmtShort(b.checkOut)}</td>
                    <td>{Math.max(1, nightsBetween(b.checkIn, b.checkOut))}</td>
                    <td>
                      <span className="rr-sign">ลงชื่อแล้ว</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rr-foot">
            <button
              className="btn primary"
              disabled={sent || rows.length === 0}
              onClick={() => {
                setSent(true);
                dispatch({
                  type: "TOAST",
                  text: `ส่ง ร.ร.4 จำนวน ${rows.length} ราย ให้นายทะเบียนแล้ว · เก็บสำเนาไว้ 1 ปี`,
                });
              }}
            >
              <Icon name="send" size={15} />
              {sent ? "ส่งแล้ววันนี้" : `ส่งนายทะเบียน ${rows.length} ราย`}
            </button>
            <span>
              เก็บย้อนหลังได้ 1 ปีตามกฎหมาย · กดชื่อในตารางเพื่อดูบัตร ร.ร.3 ของคนนั้น
            </span>
          </div>
        </div>

        {/* ── ร.ร.3 บัตรทะเบียนผู้พัก ── */}
        <div className="rr-card">
          <span className="k">แบบ ร.ร.3 · บัตรทะเบียนผู้พัก</span>
          {!active ? (
            <p className="lead">ยังไม่มีแขกเข้าพัก</p>
          ) : (
            <>
              <dl>
                <div>
                  <dt>ชื่อผู้พัก</dt>
                  <dd>{active.guest}</dd>
                </div>
                <div>
                  <dt>ห้องพัก</dt>
                  <dd>
                    {active.room} · {active.roomType}
                  </dd>
                </div>
                <div>
                  <dt>จำนวนผู้พักในห้อง</dt>
                  <dd>
                    {active.adults} ผู้ใหญ่
                    {active.children ? ` · ${active.children} เด็ก` : ""}
                  </dd>
                </div>
                <div>
                  <dt>สัญชาติ</dt>
                  <dd>{active.foreign ? "ต่างชาติ" : "ไทย"}</dd>
                </div>
                <div>
                  <dt>วันที่เข้าพัก</dt>
                  <dd>{fmtLong(active.checkIn)}</dd>
                </div>
                <div>
                  <dt>กำหนดออก</dt>
                  <dd>{fmtLong(active.checkOut)}</dd>
                </div>
                <div>
                  <dt>เลขที่การจอง</dt>
                  <dd>{active.id}</dd>
                </div>
              </dl>
              <div className="rr-signbox">
                <span>ลายมือชื่อผู้พัก</span>
                <i>{active.guest}</i>
                <small>เซ็นบนแท็บเล็ตตอนเช็กอิน · บันทึกเวลาไว้พร้อมบัตร</small>
              </div>
              {active.foreign && (
                <div className="rr-tm30">
                  <Icon name="shield" size={15} />
                  <span>
                    <b>ตม.30</b> — แขกต่างชาติต้องแจ้งที่พักภายใน 24 ชม.
                    ตาม พ.ร.บ.คนเข้าเมือง ระบบเตรียมแบบไว้แล้วจากข้อมูลชุดเดียวกัน
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="rr-note">
        <strong>สิ่งที่ระบบยังไม่ได้ทำ — พูดตรง ๆ</strong>
        <ul>
          <li>
            <b>ยังไม่ได้ต่อระบบของกรมการปกครองจริง</b> — ปุ่ม “ส่งนายทะเบียน” ในเดโมบันทึกสถานะในระบบ
            ยังไม่ได้ยิงไฟล์ออกไปที่ไหน
          </li>
          <li>
            <b>ตม.30 ยังไม่ได้ต่อระบบตรวจคนเข้าเมือง</b> — ข้อมูลครบพร้อมกรอก
            แต่การยื่นจริงต้องผ่านระบบของ ตม.
          </li>
          <li>
            <b>ลายมือชื่อเป็นภาพจำลอง</b> — ของจริงต้องเซ็นบนแท็บเล็ตหรือกระดาษแล้วสแกนเก็บ
          </li>
        </ul>
        <p>
          ที่ทำเสร็จแล้วคือ<b>โครงข้อมูลและแบบฟอร์มตรงตามที่กฎหมายกำหนด</b> —
          เชื่อมปลายทางเมื่อไรก็ส่งได้ทันที ไม่ต้องรื้อของเดิม
        </p>
      </div>
    </>
  );
}

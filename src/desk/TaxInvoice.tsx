import { useState } from "react";
import { useDesk, useHotel } from "../contexts";
import { money } from "../lib/format";
import { TODAY, fmtLong } from "../lib/date";
import { ISSUER, VAT_PCT, buildInvoice, nextInvoiceNo, splitVat, type Buyer } from "../lib/tax";
import { Icon } from "../components/Icon";

/** ที่อยู่ตั้งต้นของแขกทั่วไป — ม.86/4 (3) ต้องมีชื่อและที่อยู่ผู้รับบริการเสมอ */
const WALKIN_BUYER: Buyer = { name: "", address: "" };

export function TaxInvoice() {
  const { dispatch } = useDesk();
  const hotel = useHotel();
  const closed = hotel.state.closed;

  const [pick, setPick] = useState(0);
  const [corp, setCorp] = useState(false);
  const [buyer, setBuyer] = useState<Buyer>(WALKIN_BUYER);
  const [issued, setIssued] = useState<string | null>(null);

  const bill = closed[pick];

  if (closed.length === 0) {
    return (
      <>
        <div className="deskhead">
          <div>
            <span className="k">ใบกำกับภาษีเต็มรูป · มาตรา 86/4</span>
            <h2>ยังไม่มีบิลที่ปิดแล้ว</h2>
          </div>
        </div>
        <p className="lead">
          ใบกำกับภาษีออกจากบิลที่ปิดแล้วเท่านั้น — ไปที่ <b>เช็กเอาท์ &amp; บิล</b> ปิดบิลสักห้องก่อน
          แล้วกลับมาที่หน้านี้ ระบบจะดึงรายการจากบิลจริงมาให้เอง ไม่ต้องคีย์ซ้ำ
        </p>
      </>
    );
  }

  const inv = buildInvoice({
    no: issued ?? "— ยังไม่ออกเลขที่ —",
    date: TODAY,
    room: bill.room,
    buyer: corp ? buyer : { name: bill.guest, address: "ผู้รับบริการรายบุคคล" },
    lines: bill.lines.map((l) => ({
      label: l.label,
      note: l.note,
      qty: l.qty,
      price: l.price,
    })),
  });

  const canIssue = !corp || (buyer.name.trim() !== "" && buyer.taxId?.trim());

  const issue = () => {
    const no = nextInvoiceNo(TODAY);
    setIssued(no);
    dispatch({
      type: "TOAST",
      text: `ออกใบกำกับภาษี ${no} · ห้อง ${bill.room} · ภาษี ${money(inv.vat)} — ส่งเข้า LINE แขกแล้ว`,
    });
  };

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">ใบกำกับภาษีเต็มรูป · ประมวลรัษฎากร มาตรา 86/4</span>
          <h2>ออกจากบิลจริง ไม่ต้องคีย์ซ้ำ</h2>
        </div>
      </div>

      <p className="lead">
        ราคาที่แขกเห็นเป็นราคารวมภาษีแล้ว ใบกำกับภาษีจึง<b>ถอด VAT ออกจากยอดรวม</b> ไม่ใช่บวกเพิ่ม
        — ฐานภาษีบวกภาษีเท่ากับยอดที่แขกจ่ายเสมอ
      </p>

      <div className="ti-pick">
        <span className="k">เลือกบิลที่ปิดแล้ว</span>
        <div>
          {closed.map((b, i) => (
            <button
              key={b.room + i}
              className={`btn ghost sm ${i === pick ? "on" : ""}`}
              onClick={() => {
                setPick(i);
                setIssued(null);
              }}
            >
              ห้อง {b.room} · {b.guest} · {money(b.total)}
            </button>
          ))}
        </div>
      </div>

      <div className="ti-buyer">
        <label>
          <input
            type="checkbox"
            checked={corp}
            onChange={(e) => {
              setCorp(e.target.checked);
              setIssued(null);
            }}
          />
          ออกในนามบริษัท (ลูกค้าองค์กรขอไปลดหย่อนภาษี)
        </label>
        {corp && (
          <div className="ti-fields">
            <input
              placeholder="ชื่อบริษัท / นิติบุคคล"
              value={buyer.name}
              onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
            />
            <input
              placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก"
              value={buyer.taxId ?? ""}
              onChange={(e) => setBuyer({ ...buyer, taxId: e.target.value })}
            />
            <input
              placeholder="ที่อยู่ตามหนังสือรับรอง"
              value={buyer.address}
              onChange={(e) => setBuyer({ ...buyer, address: e.target.value })}
            />
            <input
              placeholder="สำนักงานใหญ่ / สาขาที่"
              value={buyer.branch ?? ""}
              onChange={(e) => setBuyer({ ...buyer, branch: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* เอกสารจริง — วางเรียงตามลำดับรายการที่ ม.86/4 บังคับ */}
      <div className={`ti-doc ${issued ? "issued" : "draft"}`}>
        <div className="ti-top">
          <div>
            {/* (1) คำว่า "ใบกำกับภาษี" ในที่ที่เห็นได้เด่นชัด */}
            <h3>ใบกำกับภาษี / ใบเสร็จรับเงิน</h3>
            <span className="en">TAX INVOICE / RECEIPT</span>
          </div>
          <div className="ti-no">
            {/* (4) เลขที่ · (7) วันที่ */}
            <span>เลขที่</span>
            <strong>{inv.no}</strong>
            <span>วันที่ {fmtLong(inv.date)}</span>
          </div>
        </div>

        <div className="ti-parties">
          {/* (2) ผู้ประกอบการจดทะเบียน */}
          <div>
            <span className="k">ผู้ขาย / ผู้ให้บริการ</span>
            <strong>{ISSUER.name}</strong>
            <p>{ISSUER.address}</p>
            <p>
              เลขประจำตัวผู้เสียภาษี <b>{ISSUER.taxId}</b> · {ISSUER.branch}
            </p>
          </div>
          {/* (3) ผู้ซื้อสินค้าหรือผู้รับบริการ */}
          <div>
            <span className="k">ผู้ซื้อ / ผู้รับบริการ</span>
            <strong>{inv.buyer.name || "— ยังไม่ได้กรอก —"}</strong>
            <p>{inv.buyer.address || "—"}</p>
            {corp && (
              <p>
                เลขประจำตัวผู้เสียภาษี <b>{inv.buyer.taxId || "—"}</b>
                {inv.buyer.branch ? ` · ${inv.buyer.branch}` : ""}
              </p>
            )}
            <p className="rm">ห้อง {inv.room}</p>
          </div>
        </div>

        {/* (5) ชื่อ ชนิด ประเภท ปริมาณ และมูลค่า */}
        <table className="ti-lines">
          <thead>
            <tr>
              <th>รายการ</th>
              <th className="n">จำนวน</th>
              <th className="n">หน่วยละ</th>
              <th className="n">รวม</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i}>
                <td>
                  {l.label}
                  {l.note && <span>{l.note}</span>}
                </td>
                <td className="n">{l.qty}</td>
                <td className="n">{money(l.price)}</td>
                <td className="n">{money(l.price * l.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* (6) จำนวนภาษีแยกออกจากมูลค่าให้ชัดแจ้ง */}
        <div className="ti-sum">
          <div>
            <span>มูลค่าสินค้า/บริการ (ก่อนภาษี)</span>
            <b>{money(inv.base)}</b>
          </div>
          <div>
            <span>ภาษีมูลค่าเพิ่ม {VAT_PCT}%</span>
            <b>{money(inv.vat)}</b>
          </div>
          <div className="total">
            <span>รวมทั้งสิ้น</span>
            <b>{money(inv.gross)}</b>
          </div>
        </div>

        {!issued && <span className="ti-watermark">ร่าง · ยังไม่ได้ออกเลขที่</span>}
      </div>

      <div className="ti-actions">
        <button className="btn primary" onClick={issue} disabled={!canIssue || !!issued}>
          <Icon name="receipt" size={16} />
          {issued ? `ออกแล้ว · ${issued}` : "ออกใบกำกับภาษี"}
        </button>
        {corp && !canIssue && (
          <span className="ti-warn">
            ต้องมีชื่อบริษัทและเลขประจำตัวผู้เสียภาษี — ขาดไปใบกำกับภาษีใช้ลดหย่อนไม่ได้
          </span>
        )}
      </div>

      <p className="lead">
        ตรวจยอดได้: ฐานภาษี {money(inv.base)} + ภาษี {money(inv.vat)} ={" "}
        <b>{money(splitVat(inv.gross).gross)}</b> ตรงกับยอดที่แขกจ่ายพอดี ·
        เลขที่ใบกำกับภาษีเรียงต่อเนื่องไม่ซ้ำ และออกซ้ำใบเดิมไม่ได้
      </p>
    </>
  );
}

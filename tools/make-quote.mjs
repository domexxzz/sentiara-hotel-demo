/* สร้างใบเสนอราคา Sentiara เป็นไฟล์ HTML ไฟล์เดียว เปิดและสั่งพิมพ์ได้เลย
 *
 *     node tools/make-quote.mjs
 *     node tools/make-quote.mjs --rooms 28 --to "โรงแรมบ้านสวน" --no 0042
 *
 * ทำไมเป็นตัวสร้าง ไม่ใช่ไฟล์ตายตัว
 * ----------------------------------
 * ลูกค้ารายหน้าไม่ได้มี 43 ห้อง · ถ้าเป็นไฟล์ตายตัว คนขายจะต้องเปิด HTML
 * ไปไล่แก้ตัวเลขทีละจุด ซึ่งมีวันที่ลืมแก้สักจุดแล้วส่งออกไป
 * ตัวเลขทุกตัวมาจาก `tools/quote-price.mjs` ตัวเดียว คำนวณครั้งเดียวต่อใบ
 *
 * ในไฟล์มีสองหน้าตามที่เจ้าของโปรเจกต์เลือก
 *   หน้า 1 · การ์ดสามใบ — ส่งให้ลูกค้าดูเลือกเอง
 *   หน้า 2 · ใบเสนอราคาทางการ — เอาเข้าประชุมขออนุมัติงบ
 * สั่งพิมพ์แล้วแยกเป็นคนละแผ่น A4 อัตโนมัติ
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baht, quote, LOCK_PER_ROOM } from './quote-price.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ── อ่านตัวเลือกจากบรรทัดคำสั่ง ─────────────────────────────────────
const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const rooms = Number(arg('rooms', 43))
const to = arg('to', '____________________')
const quoteNo = arg('no', '0041')
const out = arg('out', path.join(ROOT, 'docs', 'quote.html'))

let Q
try {
  Q = quote(rooms)
} catch (e) {
  console.error(`\n✗ ${e.message}\n`)
  process.exit(1)
}

// ── วันที่แบบไทย · ยืนราคา 30 วัน ───────────────────────────────────
// ใช้ปีพุทธศักราชเพราะเอกสารราชการและฝ่ายจัดซื้อไทยอ่านปีนี้
const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const thDate = (d) => `${d.getDate()} ${TH_MONTH[d.getMonth()]} ${d.getFullYear() + 543}`
const today = new Date()
const expiry = new Date(today.getTime() + 30 * 86400000)

const IC = {
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v4"/>',
  screen: '<rect x="3" y="4" width="18" height="13"/><path d="M8 21h8M12 17v4"/>',
  both: '<path d="M4 7h7v10H4zM13 7h7v10h-7z"/><path d="M11 12h2"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
}
const ic = (n, s = 16) =>
  `<svg class="ic" style="width:${s}px;height:${s}px" viewBox="0 0 24 24">${IC[n]}</svg>`

const PKGS = [
  {
    icon: 'key', name: 'ล็อกอย่างเดียว', sub: 'เปลี่ยนกุญแจเป็นสมาร์ทล็อคทั้งตึก',
    price: Q.lock, per: `${baht(LOCK_PER_ROOM)} × ${Q.rooms} ห้อง`,
    yes: [
      'สมาร์ทล็อคพร้อมติดตั้งครบทุกบาน',
      'ตั้งค่าเริ่มต้น + ทดสอบทีละห้อง',
      'อบรมผู้ดูแล 1 รอบ',
      'รับประกัน 1 ปี รวมแบตชุดแรก',
    ],
    no: ['ไม่มีระบบจัดการโรงแรม', 'ตั้งรหัสด้วยมือทีละห้อง'],
  },
  {
    icon: 'screen', name: 'โปรแกรมอย่างเดียว', sub: 'ระบบจัดการโรงแรมครบ 5 มุมมอง',
    price: Q.software, per: `สำหรับ ${Q.softwareTier}`,
    yes: [
      'จอง · ผังห้องสด · Walk-in จบใน 6 ขั้น',
      'ใบกำกับภาษี ม.86/4 · ใบลดหนี้ ม.86/10',
      'ทะเบียนผู้พัก ร.ร.3/4 ตาม ม.35',
      'งานแม่บ้าน · POS ร้านอาหาร · บัญชีคู่',
      'จอเจ้าของเปิดจากที่ไหนก็ได้',
      'อบรม 3 วัน + ซัพพอร์ต 1 ปี',
    ],
    no: ['ยังใช้กุญแจหรือบัตรแบบเดิม'],
  },
  {
    icon: 'both', name: 'ครบชุด', sub: 'ล็อกที่รู้จักการจอง', best: true,
    price: Q.bundle, was: Q.gross, per: `ประหยัด ${baht(Q.discount)}`,
    yes: [
      'ได้ทุกอย่างของสองแพ็กเกจแรก',
      'ออกรหัสเองตอนเช็กอิน ไม่ต้องมีใครกด',
      'ปิดรหัสเองตอนเช็กเอาต์ ไม่ต้องไล่เก็บบัตร',
      'รู้ว่าใครเปิดประตู โยงกับทะเบียนผู้พัก',
      'แม่บ้านเปิดได้เฉพาะห้องในคิวตัวเอง',
      'บัตรหาย เพิกถอนรหัสเดียว ไม่ต้องเปลี่ยนล็อก',
    ],
    no: [],
  },
]

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
 --bg:#f3f2f2; --paper:#fff; --ink:#201e1d; --mut:rgba(32,30,29,.58);
 --faint:rgba(32,30,29,.34);
 --ln:rgba(32,30,29,.14); --lns:rgba(32,30,29,.38);
 --acc:#ec3013; --acc7:#ae1800;
 --ok:#1f7a4d;
 --font:"Archivo",system-ui,sans-serif;
}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{background:#d2cdc8;padding:30px 24px 48px;color:var(--ink);
 font-family:"IBM Plex Sans Thai","Archivo",sans-serif}
.sheet{width:min(1100px,100%);margin:0 auto 26px;background:var(--bg);overflow:hidden;
 box-shadow:0 14px 36px rgba(40,30,25,.24)}
.ic{stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}
.baht{font-family:var(--font);font-variant-numeric:tabular-nums}

/* ── หน้า 1 · การ์ดสามใบ ──────────────────────────────────── */
.hd{padding:34px 40px 26px;background:var(--ink);color:var(--bg)}
.hd .k{font-family:var(--font);font-size:11px;font-weight:700;letter-spacing:.2em;
 text-transform:uppercase;color:#ff9783}
.hd h2{font-family:var(--font);font-size:31px;font-weight:800;margin-top:6px;letter-spacing:-.025em}
.hd p{font-size:13.5px;line-height:1.6;color:rgba(243,242,242,.72);margin-top:8px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--ln);
 border-top:1px solid var(--lns);border-bottom:1px solid var(--lns)}
.c{background:var(--paper);padding:24px 22px 26px;display:flex;flex-direction:column;
 position:relative;min-width:0}
.c.best{background:#fffdfc;box-shadow:inset 0 4px 0 var(--acc)}
.flag{position:absolute;top:0;right:0;font-family:var(--font);font-size:10px;font-weight:800;
 letter-spacing:.14em;padding:5px 11px;background:var(--acc);color:#fff}
.c .hi{display:flex;align-items:center;gap:9px;color:var(--acc7)}
.c h3{font-size:18px;font-weight:800;margin-top:9px}
.c .sub{font-size:12.5px;color:var(--mut);margin-top:3px;min-height:34px}
.pr{margin-top:16px;padding-top:15px;border-top:1px solid var(--ln)}
.pr .was{font-size:13px;color:var(--faint);text-decoration:line-through}
.pr b{display:block;font-family:var(--font);font-size:33px;font-weight:800;letter-spacing:-.035em}
.pr span{display:block;font-size:11.5px;color:var(--mut);margin-top:3px}
.c.best .pr span{color:var(--ok);font-weight:700}
.c ul{list-style:none;margin:17px 0 0;display:grid;gap:9px}
.c li{display:flex;gap:9px;font-size:12.5px;line-height:1.55}
.c li .ic{margin-top:2px;color:var(--ok)}
.c li.no,.c li.no .ic{color:var(--faint)}
.ft{padding:20px 40px 26px;display:flex;flex-wrap:wrap;gap:26px;align-items:flex-start}
.ft div{flex:1 1 300px;font-size:12px;line-height:1.65;color:var(--mut)}
.ft b{color:var(--ink)}

/* ── หน้า 2 · ใบเสนอราคาทางการ ────────────────────────────── */
.qh{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:24px;
 padding:34px 40px 22px;background:var(--paper);border-bottom:2px solid var(--ink)}
.qh .bd .k{font-family:var(--font);font-size:10.5px;font-weight:700;letter-spacing:.22em;
 text-transform:uppercase;color:var(--acc7)}
.qh .bd h2{font-family:var(--font);font-size:26px;font-weight:800;margin-top:3px;letter-spacing:-.02em}
.qh .bd p{font-size:11.5px;line-height:1.6;color:var(--mut);margin-top:7px}
.qh .meta{text-align:right;font-size:11.5px;line-height:1.85;color:var(--mut);flex:0 0 auto}
.qh .meta b{color:var(--ink);font-family:var(--font);font-variant-numeric:tabular-nums}
.who{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--ln);
 border-bottom:1px solid var(--lns)}
.who > div{background:var(--paper);padding:14px 20px;min-width:0}
.who .k{font-family:var(--font);font-size:9.5px;font-weight:800;letter-spacing:.16em;
 text-transform:uppercase;color:var(--mut)}
.who b{display:block;font-size:14px;font-weight:700;margin-top:4px;overflow-wrap:anywhere}
.who span{display:block;font-size:11.5px;color:var(--mut);margin-top:2px}
table{width:100%;border-collapse:collapse;background:var(--paper)}
thead th{font-family:var(--font);font-size:9.5px;font-weight:800;letter-spacing:.14em;
 text-transform:uppercase;color:var(--mut);padding:11px 14px;text-align:left;
 border-bottom:1px solid var(--lns);background:var(--bg)}
thead th.r{text-align:right}
td{padding:13px 14px;font-size:12.5px;border-bottom:1px solid var(--ln);vertical-align:top}
td.r{text-align:right;font-family:var(--font);font-variant-numeric:tabular-nums;font-weight:700;
 white-space:nowrap}
td .d{display:block;font-size:11px;color:var(--mut);margin-top:3px;line-height:1.55}
tr.opt td,tr.opt td.r{color:var(--faint)}
.sum{display:flex;justify-content:flex-end;background:var(--paper)}
.sumbox{width:min(360px,100%);padding:16px 14px 18px}
.sr{display:flex;justify-content:space-between;gap:16px;font-size:12.5px;padding:6px 0}
.sr.dis{color:var(--ok);font-weight:600}
.sr.tot{border-top:2px solid var(--ink);margin-top:8px;padding-top:12px;
 font-family:var(--font);font-size:22px;font-weight:800;letter-spacing:-.02em}
.terms{padding:18px 40px 20px;background:var(--bg);border-top:1px solid var(--lns);
 display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px;
 font-size:11.5px;line-height:1.75;color:var(--mut)}
.terms b{color:var(--ink);display:block;margin-bottom:3px;font-size:12px}
.sign{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:40px;
 padding:26px 40px 30px;background:var(--paper)}
.sign div{border-top:1px solid var(--lns);padding-top:8px;font-size:11.5px;color:var(--mut)}

@media (max-width:820px){
  body{padding:14px 10px 30px}
  .grid{grid-template-columns:1fr}
  .hd,.ft,.qh,.terms,.sign{padding-left:20px;padding-right:20px}
  .c{padding:20px}
}

/* สั่งพิมพ์ — สองหน้าแยกแผ่น A4 ไม่มีพื้นหลังเทาให้เปลืองหมึก */
@media print{
  @page{size:A4;margin:12mm}
  body{background:#fff;padding:0}
  .sheet{width:100%;margin:0;box-shadow:none;break-inside:avoid}
  .sheet + .sheet{break-before:page}
  .hd{background:#fff;color:var(--ink);border-bottom:2px solid var(--ink)}
  .hd .k{color:var(--acc7)}
  .hd p{color:var(--mut)}
  .noprint{display:none}
}
`

const cards = `
<section class="sheet">
  <div class="hd">
    <span class="k">Sentiara · ใบเสนอราคา</span>
    <h2>โรงแรม ${Q.rooms} ห้อง — เลือกได้ 3 แบบ</h2>
    <p>ราคานี้รวมติดตั้ง อบรม และซัพพอร์ตปีแรกแล้ว · ยืนราคาถึง ${thDate(expiry)}</p>
  </div>
  <div class="grid">
${PKGS.map((p) => `    <div class="c${p.best ? ' best' : ''}">
      ${p.best ? '<span class="flag">แนะนำ</span>' : ''}
      <span class="hi">${ic(p.icon, 20)}</span>
      <h3>${p.name}</h3>
      <span class="sub">${p.sub}</span>
      <div class="pr">
        ${p.was ? `<span class="was baht">${baht(p.was)}</span>` : ''}
        <b class="baht">${baht(p.price)}</b>
        <span>${p.per}</span>
      </div>
      <ul>
${p.yes.map((t) => `        <li>${ic('check', 15)}<span>${t}</span></li>`).join('\n')}
${p.no.map((t) => `        <li class="no">${ic('x', 15)}<span>${t}</span></li>`).join('\n')}
      </ul>
    </div>`).join('\n')}
  </div>
  <div class="ft">
    <div><b>ค่าดูแลรายปี</b> เริ่มปีที่ 2 — โปรแกรม ${baht(Q.careSoftware)}/ปี ·
      ล็อก ${baht(Q.careLock)}/ปี (แบต + ตรวจประจำปี) เลือกซื้อหรือไม่ก็ได้</div>
    <div><b>คืนทุนราว ${Q.roi.paybackShort}–${Q.roi.paybackLong} เดือน</b>
      ถ้าย้ายยอดจาก OTA มาจองตรงได้เพิ่ม 10% = ประหยัดค่าคอมเดือนละ
      ${baht(Q.roi.savedLow)}–${baht(Q.roi.savedHigh)} · เป็นการประมาณจากค่าเฉลี่ยในระบบ</div>
  </div>
</section>`

const formal = `
<section class="sheet">
  <div class="qh">
    <div class="bd">
      <span class="k">Sentiara</span>
      <h2>ใบเสนอราคา</h2>
      <p>ระบบจัดการโรงแรมและสมาร์ทล็อค · ${Q.rooms} ห้อง</p>
    </div>
    <div class="meta">
      เลขที่ <b>QT-${today.getFullYear() + 543}-${quoteNo}</b><br>
      วันที่ <b>${thDate(today)}</b><br>
      ยืนราคาถึง <b>${thDate(expiry)}</b>
    </div>
  </div>
  <div class="who">
    <div><span class="k">ผู้เสนอ</span><b>Sentiara</b>
      <span>ระบบจัดการโรงแรมและคอนโดรายวัน</span></div>
    <div><span class="k">เสนอต่อ</span><b>${to}</b>
      <span>โรงแรม ${Q.rooms} ห้อง</span></div>
  </div>
  <table>
    <thead><tr>
      <th>รายการ</th><th class="r">จำนวน</th><th class="r">ราคา/หน่วย</th><th class="r">รวม</th>
    </tr></thead>
    <tbody>
      <tr>
        <td>สมาร์ทล็อคพร้อมติดตั้ง
          <span class="d">รวมล็อก ติดตั้ง ตั้งค่า ทดสอบรายห้อง อบรมผู้ดูแล และรับประกัน 1 ปี</span></td>
        <td class="r">${Q.rooms} ห้อง</td>
        <td class="r">${baht(LOCK_PER_ROOM)}</td>
        <td class="r">${baht(Q.lock)}</td>
      </tr>
      <tr>
        <td>ลิขสิทธิ์โปรแกรม Sentiara PMS
          <span class="d">ครบ 5 มุมมอง · ใบกำกับภาษี ม.86/4 · ทะเบียนผู้พัก ม.35 · POS ·
            บัญชีคู่ · อบรม 3 วัน · ซัพพอร์ตปีแรก</span></td>
        <td class="r">1 ระบบ</td>
        <td class="r">${baht(Q.software)}</td>
        <td class="r">${baht(Q.software)}</td>
      </tr>
      <tr>
        <td>เชื่อมล็อกเข้ากับระบบจอง
          <span class="d">ออกรหัสตอนเช็กอิน · ปิดรหัสตอนเช็กเอาต์ · สิทธิ์แม่บ้านตามคิวงาน ·
            ประวัติเข้าออกโยงทะเบียนผู้พัก</span></td>
        <td class="r">1 ระบบ</td>
        <td class="r">รวมในชุด</td>
        <td class="r">—</td>
      </tr>
      <tr class="opt">
        <td>ค่าดูแลรายปี (เริ่มปีที่ 2 · เลือกได้)
          <span class="d">อัปเดตตามกฎหมาย · แก้บั๊ก · ตรวจสำรองข้อมูล · ซัพพอร์ต ·
            แบตเตอรี่และตรวจล็อกประจำปี</span></td>
        <td class="r">ต่อปี</td>
        <td class="r">—</td>
        <td class="r">${baht(Q.careTotal)}</td>
      </tr>
    </tbody>
  </table>
  <div class="sum"><div class="sumbox">
    <div class="sr"><span>รวมก่อนส่วนลด</span><span class="baht">${baht(Q.gross)}</span></div>
    <div class="sr dis"><span>ส่วนลดซื้อครบชุด</span><span class="baht">− ${baht(Q.discount)}</span></div>
    <div class="sr tot"><span>รวมทั้งสิ้น</span><span class="baht">${baht(Q.bundle)}</span></div>
  </div></div>
  <div class="terms">
    <div><b>เงื่อนไขการชำระเงิน</b>มัดจำ 50% เมื่อตกลง · 40% เมื่อติดตั้งเสร็จ ·
      10% เมื่อตรวจรับและอบรมครบ</div>
    <div><b>ระยะเวลาส่งมอบ</b>ติดตั้งล็อก 3–5 วันทำการ · ติดตั้งและอบรมระบบ 3 วัน ·
      เริ่มใช้งานจริงภายใน 2 สัปดาห์หลังตกลง</div>
  </div>
  <div class="sign">
    <div>ผู้เสนอราคา · วันที่</div>
    <div>ผู้อนุมัติ · วันที่</div>
  </div>
</section>`

const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ใบเสนอราคา Sentiara · ${Q.rooms} ห้อง</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
${cards}
${formal}
</body>
</html>
`

mkdirSync(path.dirname(out), { recursive: true })
writeFileSync(out, html, 'utf8')

console.log(`✓ ${path.relative(ROOT, out)}`)
console.log(`  ${Q.rooms} ห้อง · ${Q.softwareTier}`)
console.log(`  ล็อก ${baht(Q.lock)} + โปรแกรม ${baht(Q.software)} = ${baht(Q.gross)}`)
console.log(`  ลด ${baht(Q.discount)} → รวมทั้งสิ้น ${baht(Q.bundle)}`)
console.log(`  ค่าดูแลปีที่ 2 ${baht(Q.careTotal)}/ปี · คืนทุน ${Q.roi.paybackShort}–${Q.roi.paybackLong} เดือน`)
console.log('\n  เปิดไฟล์แล้วสั่งพิมพ์ได้เลย — แยกเป็นสองแผ่น A4 อัตโนมัติ')

/* สร้างหน้าราคาสาธารณะ `public/packages.html` ที่ไปอยู่บนเว็บพร้อมเดโม
 *
 *     node tools/make-packages-page.mjs
 *
 * ต่างจาก `make-quote.mjs` ยังไง
 * ------------------------------
 * `make-quote.mjs` สร้าง **ใบเสนอราคารายดีล** — มีชื่อลูกค้า เลขที่ใบ วันที่
 * ยืนราคา และช่องเซ็น · ของแบบนั้นไม่ควรอยู่บนเว็บสาธารณะ
 *
 * ไฟล์นี้สร้าง **หน้าราคาสาธารณะ** ที่ใครเปิดลิงก์เดโมก็เห็นได้ · ไม่มีชื่อลูกค้า
 * ไม่มีเลขที่ใบ และ **คำนวณตามจำนวนห้องของคนดูเอง** เพราะลูกค้าคอนโด 12 ห้อง
 * ที่เห็นราคาของโรงแรม 43 ห้องจะปิดหน้าไปทันทีโดยที่เราไม่มีโอกาสอธิบาย
 *
 * กติกาคิดราคาฝังลงหน้าเป็นสคริปต์เล็ก ๆ — ค่าคงที่ทุกตัวถูกฉีดมาจาก
 * `quote-price.mjs` ตอนสร้างไฟล์ ไม่ได้พิมพ์ซ้ำ · มีเทสยืนยันว่าค่าที่ฝังลงไป
 * ตรงกับโมดูลจริง (`tests/quote.test.cjs`)
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BUNDLE_DISCOUNT_RATE, CARE_RATE, LOCK_CARE_PER_ROOM, LOCK_PER_ROOM,
  ROI, SOFTWARE_TIERS, quote,
} from './quote-price.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'packages.html')
const DEFAULT_ROOMS = 43
const MAX = SOFTWARE_TIERS[SOFTWARE_TIERS.length - 1].upTo

const IC = {
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v4"/>',
  screen: '<rect x="3" y="4" width="18" height="13"/><path d="M8 21h8M12 17v4"/>',
  both: '<path d="M4 7h7v10H4zM13 7h7v10h-7z"/><path d="M11 12h2"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
}
const ic = (n, s = 16) =>
  `<svg class="ic" style="width:${s}px;height:${s}px" viewBox="0 0 24 24">${IC[n]}</svg>`

const PKGS = [
  {
    id: 'lock', icon: 'key', name: 'ล็อกอย่างเดียว',
    sub: 'เปลี่ยนกุญแจเป็นสมาร์ทล็อคทั้งตึก',
    yes: ['สมาร์ทล็อคพร้อมติดตั้งครบทุกบาน', 'ตั้งค่าเริ่มต้น + ทดสอบทีละห้อง',
      'อบรมผู้ดูแล 1 รอบ', 'รับประกัน 1 ปี รวมแบตชุดแรก'],
    no: ['ไม่มีระบบจัดการโรงแรม', 'ตั้งรหัสด้วยมือทีละห้อง'],
  },
  {
    id: 'sw', icon: 'screen', name: 'โปรแกรมอย่างเดียว',
    sub: 'ระบบจัดการโรงแรมครบ 5 มุมมอง',
    yes: ['จอง · ผังห้องสด · Walk-in จบใน 6 ขั้น',
      'ใบกำกับภาษี ม.86/4 · ใบลดหนี้ ม.86/10',
      'ทะเบียนผู้พัก ร.ร.3/4 ตาม ม.35',
      'งานแม่บ้าน · POS ร้านอาหาร · บัญชีคู่',
      'จอเจ้าของเปิดจากที่ไหนก็ได้', 'อบรม 3 วัน + ซัพพอร์ต 1 ปี'],
    no: ['ยังใช้กุญแจหรือบัตรแบบเดิม'],
  },
  {
    id: 'full', icon: 'both', name: 'ครบชุด', best: true,
    sub: 'ล็อกที่รู้จักการจอง',
    yes: ['ได้ทุกอย่างของสองแพ็กเกจแรก',
      'ออกรหัสเองตอนเช็กอิน ไม่ต้องมีใครกด',
      'ปิดรหัสเองตอนเช็กเอาต์ ไม่ต้องไล่เก็บบัตร',
      'รู้ว่าใครเปิดประตู โยงกับทะเบียนผู้พัก',
      'แม่บ้านเปิดได้เฉพาะห้องในคิวตัวเอง',
      'บัตรหาย เพิกถอนรหัสเดียว ไม่ต้องเปลี่ยนล็อก'],
    no: [],
  },
]

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
 --bg:#f3f2f2; --paper:#fff; --ink:#201e1d; --mut:rgba(32,30,29,.58);
 --faint:rgba(32,30,29,.34);
 --ln:rgba(32,30,29,.14); --lns:rgba(32,30,29,.38);
 --acc:#ec3013; --acc7:#ae1800; --acc1:#fff2ef;
 --ok:#1f7a4d;
 --font:"Archivo",system-ui,sans-serif;
}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{background:var(--bg);color:var(--ink);min-height:100dvh;
 font-family:"IBM Plex Sans Thai","Archivo",sans-serif}
.ic{stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}
.baht{font-family:var(--font);font-variant-numeric:tabular-nums}
.wrap{width:min(1100px,100%);margin:0 auto;padding:0 16px}

.top{background:var(--paper);border-bottom:1px solid var(--lns)}
.top .wrap{display:flex;align-items:center;gap:12px;padding-top:13px;padding-bottom:13px}
.top .bk{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;
 color:var(--mut);text-decoration:none;padding:9px 13px;border:1px solid var(--ln);
 min-height:42px}
.top .bk:hover{color:var(--ink);border-color:var(--lns)}
.top .nm{margin-left:auto;font-family:var(--font);font-size:12px;font-weight:800;
 letter-spacing:.19em;text-transform:uppercase;color:var(--acc7)}

.hd{background:var(--ink);color:var(--bg)}
.hd .wrap{padding-top:34px;padding-bottom:28px}
.hd .k{font-family:var(--font);font-size:11px;font-weight:700;letter-spacing:.2em;
 text-transform:uppercase;color:#ff9783}
.hd h1{font-family:var(--font);font-size:clamp(24px,5vw,33px);font-weight:800;
 margin-top:7px;letter-spacing:-.028em;line-height:1.2}
.hd p{font-size:13.5px;line-height:1.7;color:rgba(243,242,242,.72);margin-top:9px;max-width:62ch}

/* ── ตัวเลือกจำนวนห้อง ─────────────────────────────────────── */
.pick{background:var(--paper);border-bottom:1px solid var(--lns)}
.pick .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:14px 20px;
 padding-top:18px;padding-bottom:18px}
.pick label{font-size:13px;font-weight:700}
.pick .row{display:flex;align-items:center;gap:10px}
.pick button{font:inherit;font-size:19px;font-weight:700;width:44px;height:44px;
 cursor:pointer;background:var(--paper);border:1px solid var(--lns);color:var(--ink)}
.pick button:hover{background:var(--bg)}
.pick button:disabled{opacity:.35;cursor:default}
.pick input{font:inherit;font-family:var(--font);font-size:22px;font-weight:800;
 width:96px;height:44px;text-align:center;border:1px solid var(--lns);background:var(--bg);
 font-variant-numeric:tabular-nums;color:var(--ink)}
.pick input:focus{outline:2px solid var(--acc);outline-offset:-1px}
.pick .unit{font-size:13px;color:var(--mut)}
.pick .hint{font-size:12px;color:var(--mut);flex:1 1 260px}

/* ── การ์ดสามใบ ─────────────────────────────────────────────── */
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--ln);
 border-bottom:1px solid var(--lns)}
.c{background:var(--paper);padding:24px 22px 26px;display:flex;flex-direction:column;
 position:relative;min-width:0}
.c.best{background:#fffdfc;box-shadow:inset 0 4px 0 var(--acc)}
.flag{position:absolute;top:0;right:0;font-family:var(--font);font-size:10px;font-weight:800;
 letter-spacing:.14em;padding:5px 11px;background:var(--acc);color:#fff}
.c .hi{display:flex;align-items:center;gap:9px;color:var(--acc7)}
.c h3{font-size:18px;font-weight:800;margin-top:9px}
.c .sub{font-size:12.5px;color:var(--mut);margin-top:3px;min-height:34px}
.pr{margin-top:16px;padding-top:15px;border-top:1px solid var(--ln)}
.pr .was{display:block;font-size:13px;color:var(--faint);text-decoration:line-through;min-height:19px}
.pr b{display:block;font-family:var(--font);font-size:clamp(26px,4vw,33px);font-weight:800;
 letter-spacing:-.035em}
.pr span{display:block;font-size:11.5px;color:var(--mut);margin-top:3px}
.c.best .pr span{color:var(--ok);font-weight:700}
.c ul{list-style:none;margin:17px 0 0;display:grid;gap:9px}
.c li{display:flex;gap:9px;font-size:12.5px;line-height:1.55}
.c li .ic{margin-top:2px;color:var(--ok)}
.c li.no,.c li.no .ic{color:var(--faint)}

/* เกินขั้นสุดท้าย — ไม่โชว์ราคามั่ว */
.over{display:none;background:var(--acc1);border-bottom:1px solid var(--lns)}
.over .wrap{padding-top:26px;padding-bottom:26px}
.over b{display:block;font-size:17px;font-weight:800;color:var(--acc7)}
.over p{font-size:13px;line-height:1.7;color:var(--acc7);margin-top:7px;max-width:70ch}
body.over-max .grid,body.over-max .ft{display:none}
body.over-max .over{display:block}

.ft{background:var(--paper)}
.ft .wrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px;
 padding-top:22px;padding-bottom:26px}
.ft div{font-size:12.5px;line-height:1.7;color:var(--mut)}
.ft b{color:var(--ink)}
.note{border-top:1px solid var(--ln)}
.note .wrap{padding-top:18px;padding-bottom:40px;font-size:11.5px;line-height:1.75;color:var(--faint)}

@media (max-width:800px){
  .grid{grid-template-columns:1fr}
  .c .sub{min-height:0}
  .pr .was{min-height:0}
}
`

const SCRIPT = `
/* กติกาคิดราคา — ค่าคงที่ทุกตัวฉีดมาจาก tools/quote-price.mjs ตอนสร้างไฟล์
   ห้ามแก้ตัวเลขตรงนี้ ให้แก้ที่โมดูลแล้วสร้างหน้าใหม่ · เทสคุมไว้ว่าต้องตรงกัน */
var LOCK_PER_ROOM = ${LOCK_PER_ROOM};
var LOCK_CARE_PER_ROOM = ${LOCK_CARE_PER_ROOM};
var CARE_RATE = ${CARE_RATE};
var BUNDLE_DISCOUNT_RATE = ${BUNDLE_DISCOUNT_RATE};
var TIERS = ${JSON.stringify(SOFTWARE_TIERS)};
var ROI = ${JSON.stringify(ROI)};
var MAX = ${MAX};

function baht(n){ return '฿' + n.toLocaleString('en-US'); }

function calc(rooms){
  var tier = null;
  for (var i = 0; i < TIERS.length; i++) {
    if (rooms <= TIERS[i].upTo) { tier = TIERS[i]; break; }
  }
  if (!tier) return null;
  var lock = rooms * LOCK_PER_ROOM;
  var software = tier.price;
  var gross = lock + software;
  var discount = Math.floor(gross * BUNDLE_DISCOUNT_RATE / 1000) * 1000;
  var bundle = gross - discount;
  var monthly = Math.round(rooms * ROI.adr * ROI.occupancy * 30);
  var shifted = monthly * ROI.shiftToDirect;
  var lo = Math.round(shifted * ROI.otaCommission[0]);
  var hi = Math.round(shifted * ROI.otaCommission[1]);
  return {
    rooms: rooms, lock: lock, software: software, tier: tier.label,
    gross: gross, discount: discount, bundle: bundle,
    careSoftware: Math.round(software * CARE_RATE),
    careLock: rooms * LOCK_CARE_PER_ROOM,
    savedLow: lo, savedHigh: hi,
    paybackShort: Math.ceil(bundle / hi), paybackLong: Math.ceil(bundle / lo)
  };
}

var input = document.getElementById('rooms');
var minus = document.getElementById('minus');
var plus  = document.getElementById('plus');

function render(){
  var n = parseInt(input.value, 10);
  // ค่าที่พิมพ์เองอาจว่างหรือติดลบ — หนีบให้อยู่ในช่วงที่คิดราคาได้จริง
  if (!isFinite(n) || n < 1) n = 1;
  if (n > 999) n = 999;
  minus.disabled = n <= 1;

  var q = calc(n);
  if (!q) {
    document.body.classList.add('over-max');
    document.getElementById('over-n').textContent = n;
    return;
  }
  document.body.classList.remove('over-max');

  document.getElementById('p-lock').textContent   = baht(q.lock);
  document.getElementById('s-lock').textContent   = baht(LOCK_PER_ROOM) + ' × ' + n + ' ห้อง';
  document.getElementById('p-sw').textContent     = baht(q.software);
  document.getElementById('s-sw').textContent     = 'สำหรับ ' + q.tier;
  document.getElementById('w-full').textContent   = baht(q.gross);
  document.getElementById('p-full').textContent   = baht(q.bundle);
  document.getElementById('s-full').textContent   = 'ประหยัด ' + baht(q.discount);
  document.getElementById('care').textContent     =
    'โปรแกรม ' + baht(q.careSoftware) + '/ปี · ล็อก ' + baht(q.careLock) + '/ปี';
  document.getElementById('payback').textContent  =
    q.paybackShort + '–' + q.paybackLong + ' เดือน';
  document.getElementById('saved').textContent    =
    baht(q.savedLow) + '–' + baht(q.savedHigh);
}

function bump(d){
  var n = parseInt(input.value, 10);
  if (!isFinite(n)) n = 1;
  n += d;
  if (n < 1) n = 1;
  if (n > 999) n = 999;
  input.value = n;
  render();
}

input.addEventListener('input', render);
minus.addEventListener('click', function(){ bump(-1); });
plus.addEventListener('click',  function(){ bump(1); });
render();
`

const q0 = quote(DEFAULT_ROOMS)

const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#201e1d">
<title>ราคาและแพ็กเกจ · Sentiara</title>
<meta name="description" content="ราคาระบบจัดการโรงแรม Sentiara และสมาร์ทล็อค — ใส่จำนวนห้องของคุณแล้วดูราคาได้ทันที">
<meta property="og:type" content="website">
<meta property="og:title" content="ราคาและแพ็กเกจ · Sentiara">
<meta property="og:description" content="ใส่จำนวนห้องของคุณแล้วดูราคาได้ทันที">
<meta property="og:url" content="https://sentiara-demo.vercel.app/packages.html">
<meta property="og:image" content="https://sentiara-demo.vercel.app/og-cover.jpg">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>

<div class="top"><div class="wrap">
  <a class="bk" href="/">${ic('back', 15)} กลับไปลองใช้ระบบ</a>
  <span class="nm">Sentiara</span>
</div></div>

<header class="hd"><div class="wrap">
  <span class="k">ราคาและแพ็กเกจ</span>
  <h1>ใส่จำนวนห้องของคุณ แล้วดูราคาได้ทันที</h1>
  <p>ทุกราคารวมติดตั้ง อบรม และซัพพอร์ตปีแรกแล้ว · ไม่มีค่าแรกเข้าอื่นซ่อนอยู่</p>
</div></header>

<div class="pick"><div class="wrap">
  <label for="rooms">ที่พักของคุณมีกี่ห้อง</label>
  <div class="row">
    <button type="button" id="minus" aria-label="ลดจำนวนห้อง">−</button>
    <input id="rooms" type="number" inputmode="numeric" min="1" max="999"
      value="${DEFAULT_ROOMS}" aria-label="จำนวนห้อง">
    <button type="button" id="plus" aria-label="เพิ่มจำนวนห้อง">+</button>
    <span class="unit">ห้อง</span>
  </div>
  <span class="hint">ราคาข้างล่างเปลี่ยนตามทันที ไม่ต้องกดอะไรเพิ่ม</span>
</div></div>

<section class="over"><div class="wrap">
  <b>เกิน ${MAX} ห้อง — ขอตีราคาเป็นรายโครงการ</b>
  <p>ที่พักขนาด <span id="over-n">${MAX + 1}</span> ห้องขึ้นไป งานจริงไม่ได้อยู่ที่จำนวนห้อง
     แต่อยู่ที่การรวมรายงานข้ามสาขา ย้ายข้อมูลจากระบบเดิม และต่อกับระบบบัญชีที่ใช้อยู่แล้ว
     — สามอย่างนี้ประเมินจากตารางราคาไม่ได้ · ทักมาคุยกันได้เลย</p>
</div></section>

<main class="grid">
${PKGS.map((p) => `  <div class="c${p.best ? ' best' : ''}">
    ${p.best ? '<span class="flag">แนะนำ</span>' : ''}
    <span class="hi">${ic(p.icon, 20)}</span>
    <h3>${p.name}</h3>
    <span class="sub">${p.sub}</span>
    <div class="pr">
      ${p.best
        ? `<span class="was baht" id="w-full">${'฿' + q0.gross.toLocaleString('en-US')}</span>`
        : '<span class="was"></span>'}
      <b class="baht" id="p-${p.id}">${
        '฿' + (p.id === 'lock' ? q0.lock : p.id === 'sw' ? q0.software : q0.bundle)
          .toLocaleString('en-US')}</b>
      <span id="s-${p.id}">${
        p.id === 'lock' ? `฿${LOCK_PER_ROOM.toLocaleString('en-US')} × ${DEFAULT_ROOMS} ห้อง`
        : p.id === 'sw' ? `สำหรับ ${q0.softwareTier}`
        : `ประหยัด ฿${q0.discount.toLocaleString('en-US')}`}</span>
    </div>
    <ul>
${p.yes.map((t) => `      <li>${ic('check', 15)}<span>${t}</span></li>`).join('\n')}
${p.no.map((t) => `      <li class="no">${ic('x', 15)}<span>${t}</span></li>`).join('\n')}
    </ul>
  </div>`).join('\n')}
</main>

<section class="ft"><div class="wrap">
  <div><b>ค่าดูแลรายปี</b> เริ่มปีที่ 2 — <span id="care"></span><br>
    ครอบคลุมอัปเดตตามกฎหมาย แก้บั๊ก ตรวจสำรองข้อมูล และซัพพอร์ต ·
    ฝั่งล็อกเป็นแบตเตอรี่กับตรวจประจำปี เลือกซื้อหรือไม่ก็ได้</div>
  <div><b>คืนทุนราว <span id="payback"></span></b> ถ้าระบบช่วยย้ายยอดจาก OTA
    มาเป็นจองตรงได้เพิ่ม 10% = ประหยัดค่าคอมเดือนละ <span id="saved"></span></div>
</div></section>

<section class="note"><div class="wrap">
  ตัวเลขคืนทุนเป็นการประมาณจากค่าเฉลี่ยในระบบสาธิต (ราคาห้องเฉลี่ย
  ฿${ROI.adr.toLocaleString('en-US')} · อัตราเข้าพัก ${Math.round(ROI.occupancy * 100)}%)
  ยังไม่ใช่ผลจากที่พักของคุณ — ทักมาแล้วเราคำนวณจากตัวเลขจริงของคุณให้
</div></section>

<script>${SCRIPT}</script>
</body>
</html>
`

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, html, 'utf8')
console.log(`✓ ${path.relative(ROOT, OUT)}`)
console.log(`  ค่าเริ่มต้น ${DEFAULT_ROOMS} ห้อง · คำนวณสดได้ถึง ${MAX} ห้อง`)
console.log('  ไม่มีชื่อลูกค้าและเลขที่ใบเสนอราคา — ปลอดภัยที่จะอยู่บนเว็บสาธารณะ')

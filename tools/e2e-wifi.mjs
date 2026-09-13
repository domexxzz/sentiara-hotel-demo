/* จอ Wi-Fi ในเดโม — ตรวจว่าสารบัญพามาถึง และกติกาจริงทำงานบนจอ
   node tools/e2e-wifi.mjs        (ต้องมี npm run dev ที่ 5173)          */
import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', defaultViewport: { width: 1440, height: 1000 }, args: ['--hide-scrollbars'] })
const p = await b.newPage()
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text().slice(0,140)) })
await p.goto('http://localhost:5173', { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 900))

const openDir = async () => { await p.evaluate(() => document.querySelector('.dir-open').click()); await new Promise(r=>setTimeout(r,320)) }
const jump = async label => {
  await openDir()
  const ok = await p.evaluate(t => { const x=[...document.querySelectorAll('.dir-body li button')].find(b=>b.textContent.includes(t)); if(!x) return false; x.click(); return true }, label)
  await new Promise(r => setTimeout(r, 750))
  return ok
}
const hit = async t => { const ok = await p.evaluate(x => { const e=[...document.querySelectorAll('button')].filter(z=>z.offsetParent).find(z=>z.textContent.replace(/\s+/g,' ').includes(x)); if(!e||e.disabled) return false; e.click(); return true }, t); await new Promise(r=>setTimeout(r,400)); return ok }
const verdict = () => p.evaluate(() => { const v=document.querySelector('.wf-verdict'); return v ? { cls: v.className, text: v.innerText.replace(/\s+/g,' ').slice(0,110) } : null })

// ── 1 · ทั้งเจ็ดรายการพามาถึงจอ Wi-Fi ────────────────────────────
const seven = ['ออกรหัสตอนเช็กอินเอง','รหัสของใครของมัน','หมดอายุเองหลังเช็กเอาต์','จำกัดจำนวนเครื่องต่อห้อง','บันทึกทุกครั้งที่ต่อ','รายงานตัวตนตาม ม.26','ต่อกับอุปกรณ์ยี่ห้อไหนก็ได้']
const miss = []
for (const s of seven) {
  const ok = await jump(s)
  const on = await p.evaluate(() => !!document.querySelector('.wf') && document.body.innerText.includes('IP นี้คือใคร'))
  if (!ok || !on) miss.push(s)
}
console.log(`สารบัญ → จอ Wi-Fi : ${seven.length - miss.length}/${seven.length}` + (miss.length ? ` · ไม่ถึง: ${miss}` : ' ✓'))
console.log('ป้าย "ยังไม่มีจอ" ที่เหลือทั้งสารบัญ:', await p.evaluate(async () => {
  document.querySelector('.dir-open').click()
  await new Promise(r => setTimeout(r, 300))
  const n = document.querySelectorAll('.dir-body li .soon').length
  document.querySelector('.dir-x').click()
  return n
}))

// ── 2 · กติกาจริงบนจอ ────────────────────────────────────────────
await jump('จำกัดจำนวนเครื่องต่อห้อง')
await hit('เครื่องที่สามของห้อง 402');  console.log('เครื่องที่สาม :', JSON.stringify(await verdict()))
await hit('เครื่องที่สี่');              console.log('เครื่องที่สี่  :', JSON.stringify(await verdict()))
await hit('รหัสผิด');                    console.log('รหัสผิด       :', JSON.stringify(await verdict()))
await hit('แขกที่เช็กเอาต์ไปแล้ว');       console.log('หมดอายุ       :', JSON.stringify(await verdict()))

// ── 3 · รายงานตัวตน · แขกที่เช็กเอาต์ไป 39 วันต้องยังตอบได้ ──────
await p.evaluate(() => { const r=[...document.querySelectorAll('.wf-table tbody tr')].find(x=>x.innerText.includes('10.24.7.201')); r.querySelector('button').click() })
await new Promise(r => setTimeout(r, 450))
console.log('รายงาน ม.26  :', JSON.stringify(await p.evaluate(() => {
  const el = document.querySelector('.wf-id'); if (!el) return null
  return { occ: el.querySelectorAll('.occ').length, keep: document.querySelector('.wf-keep')?.innerText.slice(0,64), text: el.innerText.includes('E48127395') }
})))
// ห้อง 402 มีผู้พักสองคน ต้องคืนทั้งคู่
await p.evaluate(() => { const r=[...document.querySelectorAll('.wf-table tbody tr')].find(x=>x.innerText.includes('10.24.7.113')); r.querySelector('button').click() })
await new Promise(r => setTimeout(r, 400))
console.log('ห้องสองคน    :', await p.evaluate(() => document.querySelectorAll('.wf-id .occ').length), 'คน (ต้องได้ 2)')

// ── 4 · ตัวกัน 90 วัน ────────────────────────────────────────────
await p.evaluate(() => { const i=[...document.querySelectorAll('.wf-keeprow input')][0]; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(i,'30'); i.dispatchEvent(new Event('input',{bubbles:true})) })
await new Promise(r => setTimeout(r, 250))
await p.evaluate(() => [...document.querySelectorAll('.wf-keeprow button')].find(b=>b.textContent.includes('บันทึก')).click())
await new Promise(r => setTimeout(r, 350))
console.log('ตั้ง 30 วัน   :', JSON.stringify(await p.evaluate(() => { const v=[...document.querySelectorAll('.wf-verdict')].pop(); return v ? { cls: v.className, text: v.innerText.replace(/\s+/g,' ').slice(0,90) } : null })))

// ── 5 · ออกรหัสใหม่ แสดงครั้งเดียว ───────────────────────────────
await hit('ออกรหัสใหม่')
console.log('รหัสที่ออกมา  :', await p.evaluate(() => document.querySelector('.wf-secret code')?.textContent), '(6 ตัว จากชุดที่ไม่มี i l o s u z 0 1 5)')
await p.screenshot({ path: './tools/_wifi.jpg', type: 'jpeg', quality: 88 })
console.log('\nerror ในหน้า:', errs.length ? [...new Set(errs)].slice(0,4) : 'ไม่มี')
await b.close()

/* พิสูจน์ว่าสารบัญฟังก์ชันพาไปถึงจอจริงได้ทุกรายการ
   node tools/e2e-directory.mjs      (ต้องมี npm run dev ที่ 5173)        */
import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', defaultViewport: { width: 1440, height: 950 }, args: ['--hide-scrollbars'] })
const p = await b.newPage()
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text().slice(0, 140)) })
await p.goto('http://localhost:5173', { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 900))

const open = async () => { await p.evaluate(() => document.querySelector('.dir-open').click()); await new Promise(r=>setTimeout(r,350)) }
const shown = () => p.evaluate(() => ({
  flow: [...document.querySelectorAll('.flowpick button')].find(b=>b.getAttribute('aria-selected')==='true')?.textContent.trim().slice(0,14),
  hint: document.querySelector('.jump-hint span')?.textContent?.slice(0, 46) || null,
  body: document.body.innerText.replace(/\s+/g,' ').length,
}))

await open()
const count = await p.evaluate(() => document.querySelectorAll('.dir-body li button').length)
console.log(`เปิดสารบัญ: ${count} รายการ`)

// ค้นหา
await p.evaluate(() => { const i=document.querySelector('.dir-search input'); const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(i,'ตม.30'); i.dispatchEvent(new Event('input',{bubbles:true})) })
await new Promise(r => setTimeout(r, 350))
console.log('ค้นหา "ตม.30" เจอ:', await p.evaluate(() => document.querySelectorAll('.dir-body li button').length), 'รายการ')

// กดรายการแรกที่ค้นเจอ → ต้องไปจอเคาน์เตอร์ แท็บทะเบียนผู้พัก
await p.evaluate(() => document.querySelector('.dir-body li button').click())
await new Promise(r => setTimeout(r, 800))
const a = await shown()
const deskView = await p.evaluate(() => [...document.querySelectorAll('.desk-nav button, nav button')].find(b=>b.getAttribute('aria-current')||b.className.includes('on'))?.textContent.trim().slice(0,22))
console.log('หลังกด ตม.30 →', JSON.stringify({ ...a, แท็บที่เปิด: deskView }))

// สุ่มกระโดดหลายรายการข้ามมุมมอง แล้วดูว่าทุกจอมีเนื้อหา ไม่พัง
const picks = ['ผังบัญชีโรงแรมไทย', 'กลอนประตู NFC', 'POS ร้านอาหารเข้าบิลห้อง', 'ถ่ายรูปตรวจมาตรฐานห้อง', 'แชทรวมทุกช่องทาง', 'หน้าจองฝั่งแขก']
const bad = []
for (const label of picks) {
  await open()
  const ok = await p.evaluate(t => {
    const btn = [...document.querySelectorAll('.dir-body li button')].find(b => b.textContent.includes(t))
    if (!btn) return false
    btn.click(); return true
  }, label)
  await new Promise(r => setTimeout(r, 850))
  const st = await shown()
  const thin = st.body < 500
  if (!ok || thin) bad.push(`${label} (${ok ? 'จอบาง ' + st.body : 'ไม่เจอรายการ'})`)
  console.log(`  ${label.padEnd(26)} → ${st.flow} · ${st.body} ตัวอักษร ${thin ? '✗' : '✓'}`)
}
console.log('\nรายการที่มีปัญหา:', bad.length ? bad : 'ไม่มี')
console.log('error ในหน้า:', errs.length ? [...new Set(errs)].slice(0,4) : 'ไม่มี')
await b.close()

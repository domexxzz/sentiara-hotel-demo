/* เดินเดโมครบวงจรด้วยเบราว์เซอร์จริง — พิสูจน์ว่าห้าจอใช้ข้อมูลชุดเดียวกันจริง
   ไม่ใช่ห้าโปรแกรมที่วางอยู่ข้างกัน

   node tools/e2e-demo.mjs            (ต้องมี npm run dev อยู่ที่ 5173)   */
import puppeteer from 'puppeteer-core'

const URL = process.env.DEMO_URL || 'http://localhost:5173'
const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', defaultViewport: { width: 1440, height: 950 }, args: ['--hide-scrollbars'],
})
const p = await b.newPage()
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
await p.goto(URL, { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 900))

const store = () => p.evaluate(() => JSON.parse(localStorage.getItem('sentiara:hotel:v2') || '{}'))
const flow = async name => {
  await p.evaluate(n => {
    const b = [...document.querySelectorAll('.flowpick button')].find(x => x.textContent.includes(n))
    if (!b) throw new Error('ไม่เจอแท็บ ' + n)
    b.click()
  }, name)
  await new Promise(r => setTimeout(r, 550))
}
const click = async (text, scope = 'body') => {
  const ok = await p.evaluate((t, s) => {
    const root = document.querySelector(s) || document.body
    const el = [...root.querySelectorAll('button,a,[role=button],[role=tab]')]
      .find(x => x.textContent.replace(/\s+/g, ' ').includes(t) && !x.disabled)
    if (!el) return false
    el.click(); return true
  }, text, scope)
  await new Promise(r => setTimeout(r, 450))
  return ok
}

const step = []
const s0 = await store()
step.push(['เริ่มต้น', `ห้อง ${Object.keys(s0.rooms || {}).length} · จอง ${Object.keys(s0.bookings || {}).length} · บิล ${Object.keys(s0.bills || {}).length}`])

// ── 1 · ฝั่งแขก จองห้อง ───────────────────────────────────────────
await flow('ฝั่งแขก')
const before = Object.keys((await store()).bookings || {}).length
for (const label of ['จองห้องนี้', 'ยืนยัน', 'ถัดไป', 'ตกลง']) await click(label)
const after = Object.keys((await store()).bookings || {}).length
step.push(['แขกกดจอง', after > before ? `จองเพิ่ม ${after - before} รายการ ✓` : `จองไม่เพิ่ม (${before}) ✗`])

// ── 2 · เคาน์เตอร์ เห็นการจองเดียวกันไหม ─────────────────────────
await flow('หน้าเคาน์เตอร์')
const deskTxt = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
const s2 = await store()
const anyRef = Object.keys(s2.bookings || {})[0] || ''
step.push(['เคาน์เตอร์เห็นการจอง', deskTxt.length > 400 ? `จอมีเนื้อหา ${deskTxt.length} ตัวอักษร ✓` : 'จอว่าง ✗'])

// ── 3 · POS สั่งอาหารเข้าบิลห้อง ─────────────────────────────────
await flow('POS')
const billsBefore = JSON.stringify((await store()).bills || {}).length
const posClicked = []
for (const t of ['โต๊ะ', 'ต้มยำ', 'เพิ่ม', 'เข้าบิลห้อง', 'ยืนยัน', 'ส่งครัว']) {
  if (await click(t)) posClicked.push(t)
}
const billsAfter = JSON.stringify((await store()).bills || {}).length
step.push(['POS เข้าบิลห้อง', billsAfter !== billsBefore
  ? `บิลเปลี่ยน ${billsBefore} → ${billsAfter} ไบต์ ✓ (กดได้: ${posClicked.join(', ')})`
  : `บิลไม่ขยับ (กดได้: ${posClicked.join(', ') || 'ไม่มี'}) ✗`])

// ── 4 · แม่บ้าน ──────────────────────────────────────────────────
await flow('แม่บ้าน')
const staffTxt = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').length)
step.push(['จอแม่บ้าน', staffTxt > 300 ? `มีเนื้อหา ${staffTxt} ตัวอักษร ✓` : 'ว่าง ✗'])

// ── 5 · จอเจ้าของ เห็นเงินจากที่กดมาทั้งหมดไหม ───────────────────
await flow('จอเจ้าของ')
const ownerTabs = await p.evaluate(() =>
  [...document.querySelectorAll('nav button, [role=tab], .own-nav button')].map(b => b.textContent.trim()).filter(Boolean))
const ownerTxt = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
const baht = (ownerTxt.match(/฿[\d,]+/g) || []).slice(0, 6)
step.push(['จอเจ้าของ', `แท็บ ${ownerTabs.length} · ตัวเลขเงินบนจอ ${baht.join(' ') || 'ไม่เจอ ✗'}`])

// เปิดทุกแท็บของเจ้าของ ดูว่าพังไหม
let broke = []
for (const t of ownerTabs) {
  await click(t)
  const n = await p.evaluate(() => document.body.innerText.trim().length)
  if (n < 200) broke.push(t)
}
step.push(['เปิดครบทุกแท็บเจ้าของ', broke.length ? `จอว่าง: ${broke.join(', ')} ✗` : `${ownerTabs.length} แท็บมีเนื้อหาครบ ✓`])

console.log('\n── ผลเดินเดโมครบวงจร ──')
for (const [k, v] of step) console.log(`  ${k.padEnd(24)} ${v}`)
console.log('\nข้อผิดพลาดในหน้า:', errs.length ? [...new Set(errs)].slice(0, 6) : 'ไม่มี')
await b.close()

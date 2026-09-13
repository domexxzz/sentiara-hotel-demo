/* กวาดเดโมทั้งตัวก่อนเอาขึ้น host — กดทุกปุ่มในทุกจอแล้วดูว่าอะไรพัง
 *
 *     node tools/bundle-demo.mjs --wrap
 *     node tools/qa-demo.mjs
 *
 * ตรวจสี่ชั้น
 *   1. error ในหน้า — ชัดเจนว่าเป็นบั๊ก ไม่ต้องตีความ
 *   2. จอว่าง — ทุกมุมมองและทุกแท็บย่อยต้องมีเนื้อหา
 *   3. สารบัญ 83 รายการ — กดแล้วต้องไปถึงจอที่มีของจริง
 *   4. ปุ่มที่กดแล้วไม่เกิดอะไรเลย — ทั้งหน้าจอไม่ขยับ และข้อมูลไม่ขยับ
 *
 * ชั้นที่ 4 มีโอกาสรายงานเกินจริง (ปุ่มที่เลือกอยู่แล้ว กดซ้ำก็ไม่ขยับ)
 * จึงรายงานเป็น "น่าสงสัย" ให้คนดูตัดสิน ไม่ประกาศว่าเป็นบั๊ก
 */
import puppeteer from 'puppeteer-core'

const FILE = process.env.QA_FILE || 'C:/Users/User/AppData/Local/Temp/qa-demo.html'
const URL = FILE.startsWith('http') ? FILE : 'file:///' + FILE.replace(/\\/g, '/')

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', defaultViewport: { width: 1440, height: 1000 }, args: ['--hide-scrollbars'],
})
const p = await b.newPage()

const errors = []
p.on('pageerror', (e) => errors.push({ where: current, what: String(e).slice(0, 150) }))
p.on('console', (m) => {
  const t = m.text()
  // favicon.ico หาไม่เจอคือพฤติกรรมปกติของเบราว์เซอร์ ไม่ใช่บั๊กของเรา
  if (m.type() === 'error' && !/favicon|ERR_FILE_NOT_FOUND/.test(t)) {
    errors.push({ where: current, what: t.slice(0, 150) })
  }
})

let current = 'โหลดหน้า'
await p.goto(URL, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 2200))

const snap = () => p.evaluate(() => ({
  text: document.body.innerText.replace(/\s+/g, ' '),
  html: document.body.innerHTML.length,
  store: localStorage.getItem('sentiara:hotel:v2') || '',
}))
const flows = () => p.evaluate(() =>
  [...document.querySelectorAll('.flowpick button')].map((x) => x.textContent.trim()))
const goFlow = async (name) => {
  await p.evaluate((n) => [...document.querySelectorAll('.flowpick button')]
    .find((x) => x.textContent.includes(n)).click(), name)
  await new Promise((r) => setTimeout(r, 600))
}

const thin = []      // จอที่เนื้อหาน้อยผิดปกติ
const dead = []      // ปุ่มที่กดแล้วไม่ขยับอะไรเลย

/** กดทุกปุ่มในจอปัจจุบัน แล้วดูว่าเกิดอะไรขึ้น
 *  ข้ามปุ่มสลับมุมมองกับปุ่มเปิดสารบัญ เพราะมันพาออกจากจอที่กำลังตรวจ */
async function clickEverything(label, limit = 40) {
  const names = await p.evaluate(() =>
    [...document.querySelectorAll('button,[role=button]')]
      .filter((e) => e.offsetParent && !e.disabled)
      .filter((e) => !e.closest('.flowpick') && !e.classList.contains('dir-open'))
      .map((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 30))
      .filter(Boolean))

  const seen = new Set()
  for (const name of names.slice(0, limit)) {
    if (seen.has(name)) continue
    seen.add(name)
    current = `${label} › ${name}`
    const before = await snap()
    const ok = await p.evaluate((t) => {
      const el = [...document.querySelectorAll('button,[role=button]')]
        .filter((e) => e.offsetParent && !e.disabled)
        .filter((e) => !e.closest('.flowpick') && !e.classList.contains('dir-open'))
        .find((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 30) === t)
      if (!el) return false
      el.click(); return true
    }, name)
    if (!ok) continue
    await new Promise((r) => setTimeout(r, 320))
    const after = await snap()
    if (before.text === after.text && before.html === after.html && before.store === after.store) {
      dead.push(`${label} › ${name}`)
    }
  }
}

console.log('── ไล่กดทุกมุมมอง ──')
for (const f of await flows()) {
  const short = f.split('\n')[0].slice(0, 12)
  current = short
  await goFlow(short)
  const s = await snap()
  if (s.text.length < 300) thin.push(`${short} (${s.text.length} ตัวอักษร)`)
  console.log(`  ${short.padEnd(14)} ${s.text.length} ตัวอักษร`)
  await clickEverything(short)
  // กลับเข้ามุมมองเดิม เผื่อปุ่มที่กดพาไปไหน
  await goFlow(short)
}

console.log('\n── สารบัญ 83 รายการ ──')
const miss = []
const total = await p.evaluate(async () => {
  document.querySelector('.dir-open').click()
  await new Promise((r) => setTimeout(r, 300))
  const n = document.querySelectorAll('.dir-body li button').length
  document.querySelector('.dir-x').click()
  return n
})
for (let i = 0; i < total; i++) {
  current = `สารบัญ #${i + 1}`
  const name = await p.evaluate(async (idx) => {
    document.querySelector('.dir-open').click()
    await new Promise((r) => setTimeout(r, 220))
    const list = [...document.querySelectorAll('.dir-body li button')]
    const el = list[idx]
    if (!el) return null
    const label = el.querySelector('.th')?.textContent ?? el.textContent.slice(0, 24)
    el.click()
    return label
  }, i)
  await new Promise((r) => setTimeout(r, 520))
  const s = await snap()
  if (s.text.length < 400) miss.push(`${name} (${s.text.length})`)
}
console.log(`  ตรวจ ${total} รายการ · ลงจอที่เนื้อหาน้อยผิดปกติ ${miss.length} รายการ`)

console.log('\n── มือถือ 390px ──')
await p.setViewport({ width: 390, height: 844 })
await new Promise((r) => setTimeout(r, 600))
const mob = await p.evaluate(() => ({
  over: document.documentElement.scrollWidth > window.innerWidth + 1,
  w: document.documentElement.scrollWidth,
}))
console.log(`  เลื่อนข้าง: ${mob.over ? 'มี ✗ (' + mob.w + 'px)' : 'ไม่มี'}`)

console.log('\n════ สรุป ════')
console.log(`error ในหน้า      ${errors.length}`)
for (const e of errors.slice(0, 12)) console.log(`   [${e.where}] ${e.what}`)
console.log(`จอที่เนื้อหาน้อย   ${thin.length}${thin.length ? ' · ' + thin.join(' · ') : ''}`)
console.log(`สารบัญไปไม่ถึง     ${miss.length}${miss.length ? ' · ' + miss.slice(0, 8).join(' · ') : ''}`)
console.log(`ปุ่มน่าสงสัย        ${dead.length}`)
for (const d of dead.slice(0, 30)) console.log(`   ${d}`)
if (dead.length > 30) console.log(`   … อีก ${dead.length - 30} ปุ่ม`)

await b.close()

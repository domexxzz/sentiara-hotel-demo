/* กวาดทุกความกว้างจอ แล้วบอกว่า "ตัวไหน" ทำให้จอล้น
 *
 *     node tools/bundle-demo.mjs --wrap
 *     node tools/responsive-sweep.mjs
 *
 * ทำไมต้องมีเครื่องมือแยก ไม่รวมกับ qa-demo
 * -----------------------------------------
 * qa-demo บอกได้แค่ว่า "จอล้น 648px" ซึ่งใช้เวลาตามหาตัวการเป็นชั่วโมง
 * (เคยเดาผิดไปแก้ `.conn` ทั้งที่ตัวจริงคือ `.flowpick`) · สคริปต์นี้ไล่ทุก
 * element แล้วรายงานเฉพาะตัวที่ **ตัวมันเองยื่นเกินขอบ** ไม่ใช่ตัวที่แค่มีลูกล้น
 * จึงชี้ไปที่ selector ที่ต้องแก้จริง ๆ
 *
 * ตรวจสามอย่างต่อหนึ่งความกว้าง
 *   1. เลื่อนข้างได้ไหม (scrollWidth > innerWidth)
 *   2. ตัวไหนยื่นพ้นขอบขวา — รายงาน selector + ความกว้างจริง
 *   3. ปุ่มที่เล็กกว่านิ้วคน (< 40px) ในโหมดมือถือ
 */
import puppeteer from 'puppeteer-core'

const FILE = process.env.QA_FILE || 'C:/Users/User/AppData/Local/Temp/qa-demo.html'
const URL = FILE.startsWith('http') ? FILE : 'file:///' + FILE.replace(/\\/g, '/')

// ความกว้างที่เจอจริงในสนาม ไม่ใช่ breakpoint ที่เราตั้งเอง
// 320 = iPhone SE รุ่นเล็กสุดที่ยังมีคนใช้ · 1920 = จอประชุมที่เอาไปนำเสนอ
const WIDTHS = [
  [320, 568, 'iPhone SE (เล็กสุด)'],
  [360, 740, 'Android ทั่วไป'],
  [375, 667, 'iPhone 8'],
  [390, 844, 'iPhone 14'],
  [414, 896, 'iPhone Plus'],
  [430, 932, 'iPhone Pro Max'],
  [540, 720, 'จอพับ / หน้าต่างแคบ'],
  [600, 960, 'แท็บเล็ตเล็กแนวตั้ง'],
  [768, 1024, 'iPad แนวตั้ง'],
  [820, 1180, 'iPad Air'],
  [1024, 768, 'iPad แนวนอน'],
  [1180, 820, 'iPad Pro แนวนอน'],
  [1280, 800, 'โน้ตบุ๊กเล็ก'],
  [1440, 900, 'โน้ตบุ๊กทั่วไป'],
  [1920, 1080, 'จอประชุม'],
]

// มุมมองที่ต้องตรวจทุกอัน — จอเดียวผ่านไม่ได้แปลว่าทั้งระบบผ่าน
const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--hide-scrollbars'],
})
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 900 })
await p.goto(URL, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 2000))

// ปิดหน้าต้อนรับก่อน ไม่งั้นทุกความกว้างจะวัดแต่กล่องต้อนรับ
await p.evaluate(() => {
  const go = [...document.querySelectorAll('.wel-go button')].pop()
  if (go) go.click()
})
await new Promise((r) => setTimeout(r, 400))

const flowNames = await p.evaluate(() =>
  [...document.querySelectorAll('.flowpick button')].map((x) => x.textContent.trim().split('\n')[0].slice(0, 12)))

/** ตัวไหน "ตัวมันเอง" ยื่นพ้นขอบ — ไม่ใช่แค่มีลูกที่ล้น
 *  ตัดพ่อที่ล้นเพราะลูกออก ด้วยการดูว่ากล่องของตัวเองกว้างเกินจอหรือเปล่า */
const offenders = () => p.evaluate(() => {
  const W = window.innerWidth
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.right <= W + 1 && r.left >= -1) continue
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
      : ''
    // รายงานเฉพาะใบล่างสุดที่ยังล้น — พ่อที่ล้นตามลูกไม่ใช่ตัวที่ต้องแก้
    const kidAlsoOver = [...el.children].some((c) => {
      const k = c.getBoundingClientRect()
      return k.width > 0 && (k.right > W + 1 || k.left < -1)
    })
    if (kidAlsoOver) continue
    out.push({
      sel: el.tagName.toLowerCase() + cls,
      w: Math.round(r.width),
      right: Math.round(r.right),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 34),
    })
  }
  return out.slice(0, 6)
})

const tinyTaps = () => p.evaluate(() => {
  const small = []
  for (const el of document.querySelectorAll('button,[role=button],a')) {
    if (!el.offsetParent || el.disabled) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0) continue
    if (r.height < 40 && r.width < 40) {
      small.push((el.textContent || el.getAttribute('aria-label') || el.className || '?')
        .replace(/\s+/g, ' ').trim().slice(0, 22) + ` ${Math.round(r.width)}×${Math.round(r.height)}`)
    }
  }
  return [...new Set(small)].slice(0, 8)
})

let bad = 0
for (const [w, h, name] of WIDTHS) {
  await p.setViewport({ width: w, height: h })
  await new Promise((r) => setTimeout(r, 350))

  const problems = []
  for (const f of flowNames) {
    await p.evaluate((n) => {
      const el = [...document.querySelectorAll('.flowpick button')].find((x) => x.textContent.includes(n))
      if (el) el.click()
    }, f)
    await new Promise((r) => setTimeout(r, 260))
    const over = await p.evaluate(() =>
      document.documentElement.scrollWidth - window.innerWidth)
    if (over > 1) {
      const who = await offenders()
      problems.push({ flow: f, over, who })
    }
  }

  const taps = w <= 600 ? await tinyTaps() : []
  const ok = problems.length === 0 && taps.length === 0
  if (!ok) bad++
  console.log(`${ok ? '✓' : '✗'} ${String(w).padStart(4)}×${String(h).padEnd(4)} ${name}`)
  for (const pr of problems) {
    console.log(`     ${pr.flow} · ล้น ${pr.over}px`)
    for (const o of pr.who) console.log(`        ${o.sel}  กว้าง ${o.w}px  ขวาสุด ${o.right}px  "${o.text}"`)
  }
  if (taps.length) console.log(`     ปุ่มเล็กกว่านิ้ว: ${taps.join(' · ')}`)
}

console.log(`\n${bad === 0 ? '✓ ผ่านทุกความกว้าง' : `✗ มีปัญหา ${bad} ความกว้าง`}  (ตรวจ ${WIDTHS.length} ขนาด × ${flowNames.length} มุมมอง)`)
// ── รอบสอง · ลงลึกถึงแท็บย่อย ───────────────────────────────────────
// รอบแรกเห็นแค่จอแรกของแต่ละมุมมอง · จอที่ล้นจริงมักเป็นตารางหรือแถบตัวเลข
// ที่อยู่ในแท็บย่อย เช่น สมุดรายวันของเจ้าของ หรือใบเสร็จของร้านอาหาร
// ทำแค่ห้าความกว้างพอ เพราะรอบแรกยืนยันแล้วว่าโครงนอกไม่ล้นที่ความกว้างไหนเลย
console.log('\n── ลงลึกถึงแท็บย่อยทุกจอ ──')
const DEEP = [[320, 568], [390, 844], [768, 1024], [1024, 768], [1920, 1080]]
// ต้องตัด .flowpick ออก ไม่งั้นปุ่มสลับมุมมองถูกนับเป็นแท็บย่อยด้วย
// แล้วพอกดมันกลางลูป มุมมองเปลี่ยนไปเลย แท็บที่เหลือของมุมมองเดิมเลยไม่ถูกเปิด
const TAB_SEL = ':is(nav, .onav, .tabs, [role=tablist]):not(.flowpick) > button, ' +
  ':is(nav, .onav, .tabs, [role=tablist]):not(.flowpick) button:not(.flowpick button)'
let deepBad = 0
let screens = 0
for (const [w, h] of DEEP) {
  await p.setViewport({ width: w, height: h })
  await new Promise((r) => setTimeout(r, 350))
  const hits = []
  for (const f of flowNames) {
    await p.evaluate((n) => {
      const el = [...document.querySelectorAll('.flowpick button')].find((x) => x.textContent.includes(n))
      if (el) el.click()
    }, f)
    await new Promise((r) => setTimeout(r, 260))

    const tabs = await p.evaluate((sel) =>
      [...document.querySelectorAll(sel)].filter((e) => e.offsetParent)
        .map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean), TAB_SEL)

    for (const t of [...new Set(tabs)]) {
      const clicked = await p.evaluate((sel, n) => {
        const el = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent)
          .find((e) => e.textContent.replace(/\s+/g, ' ').trim() === n)
        if (!el) return false
        el.click(); return true
      }, TAB_SEL, t)
      if (!clicked) continue
      await new Promise((r) => setTimeout(r, 240))
      screens++
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      if (over > 1) hits.push({ where: `${f} › ${t}`, over, who: await offenders() })
    }
  }
  deepBad += hits.length
  console.log(`${hits.length ? '✗' : '✓'} ${w}px · ${hits.length} จอล้น`)
  for (const x of hits.slice(0, 6)) {
    console.log(`     ${x.where} · ล้น ${x.over}px`)
    for (const o of x.who) console.log(`        ${o.sel}  กว้าง ${o.w}px  "${o.text}"`)
  }
}
console.log(`\n${deepBad === 0 ? '✓ แท็บย่อยผ่านหมด' : `✗ แท็บย่อยล้น ${deepBad} จอ`}  (เปิดจอทั้งหมด ${screens} ครั้ง)`)

await b.close()
process.exit(bad === 0 && deepBad === 0 ? 0 : 1)

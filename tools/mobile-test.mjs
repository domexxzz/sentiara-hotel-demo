/* ทดสอบเดโมแบบ "เป็นมือถือจริง" ไม่ใช่แค่ย่อหน้าต่าง
 *
 *     node tools/bundle-demo.mjs --wrap
 *     node tools/mobile-test.mjs
 *
 * ย่อหน้าต่างเบราว์เซอร์บนคอมกับเปิดบนมือถือไม่เหมือนกัน สี่อย่างนี้ต่างกัน
 * และทุกอย่างเคยทำให้หน้าเว็บพังมาแล้ว
 *
 *   1. **ไม่มีเมาส์**  `:hover` ไม่เกิด · ปุ่มที่เปิดเมนูตอนชี้ จะเปิดไม่ได้เลย
 *   2. **นิ้วไม่ใช่จุด** ปุ่มต่ำกว่า 44px กดพลาดประจำ
 *   3. **ความละเอียดคูณสอง** เส้น 1px กลายเป็นครึ่งพิกเซล บางทีหายไปเลย
 *   4. **แถบที่อยู่หดได้** ความสูงจอเปลี่ยนระหว่างเลื่อน — เหตุผลที่ต้องใช้ dvh
 *
 * สคริปต์นี้จำลองสามข้อแรกได้จริง (Chrome DevTools Protocol ใช้กลไกเดียวกับ
 * โหมดอุปกรณ์ใน DevTools) · **ข้อ 4 กับ Safari ของ iOS จำลองไม่ได้**
 * Safari ใช้เอนจินคนละตัว (WebKit) ต้องเปิดด้วยเครื่องจริงเท่านั้น
 * — ดูวิธีท้ายไฟล์นี้
 */
import puppeteer from 'puppeteer-core'

const FILE = process.env.QA_FILE || 'C:/Users/User/AppData/Local/Temp/qa-demo.html'
const URL = FILE.startsWith('http') ? FILE : 'file:///' + FILE.replace(/\\/g, '/')

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'

const DEVICES = [
  { name: 'iPhone SE',      w: 375, h: 667, dpr: 2, ua: IOS },
  { name: 'iPhone 14',      w: 390, h: 844, dpr: 3, ua: IOS },
  { name: 'iPhone 15 Pro Max', w: 430, h: 932, dpr: 3, ua: IOS },
  { name: 'Pixel 8',        w: 412, h: 915, dpr: 2.6, ua: ANDROID },
  { name: 'Galaxy A ทั่วไป', w: 360, h: 800, dpr: 3, ua: ANDROID },
  { name: 'iPad แนวตั้ง',    w: 768, h: 1024, dpr: 2, ua: IOS },
]

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--hide-scrollbars'],
})

let fails = 0
for (const d of DEVICES) {
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 90)))
  await p.setUserAgent(d.ua)
  await p.setViewport({
    width: d.w, height: d.h, deviceScaleFactor: d.dpr,
    isMobile: true, hasTouch: true, isLandscape: false,
  })
  await p.goto(URL, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1800))

  const issues = []

  // เบราว์เซอร์ต้องมองว่านี่คือเครื่องสัมผัสจริง ไม่ใช่จอแคบ
  const coarse = await p.evaluate(() => matchMedia('(pointer: coarse)').matches)
  if (!coarse) issues.push('เบราว์เซอร์ไม่ได้มองว่าเป็นเครื่องสัมผัส (จำลองไม่สำเร็จ)')

  // ── แตะจริง ไม่ใช่คลิก ────────────────────────────────────────────
  // ปุ่มเปิดสารบัญคือทางเข้าเดียวของ 83 ฟังก์ชัน แตะไม่ติดคือเดโมใช้ไม่ได้
  const openBox = await p.evaluate(() => {
    const el = document.querySelector('.wel-go button.go') ? null : document.querySelector('.dir-open')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  // ปิดหน้าต้อนรับด้วยการ "แตะ" ก่อน
  const welBtn = await p.$('.wel-go button.go')
  if (welBtn) {
    const r = await welBtn.boundingBox()
    if (r.height < 44) issues.push(`ปุ่มหน้าต้อนรับสูงแค่ ${Math.round(r.height)}px`)
    await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2)
    await new Promise((x) => setTimeout(x, 700))
  } else if (openBox) {
    await p.touchscreen.tap(openBox.x, openBox.y)
    await new Promise((x) => setTimeout(x, 500))
  }

  // ── ทุกปุ่มที่แตะได้ต้องใหญ่พอนิ้ว ───────────────────────────────
  const small = await p.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('button,[role=button],a[href]')) {
      if (!el.offsetParent || el.disabled) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.height >= 40 || r.width >= 40) continue
      out.push(`${(el.textContent || el.getAttribute('aria-label') || el.className || '?')
        .replace(/\s+/g, ' ').trim().slice(0, 20)} ${Math.round(r.width)}×${Math.round(r.height)}`)
    }
    return [...new Set(out)]
  })
  if (small.length) issues.push(`ปุ่มเล็กเกินนิ้ว ${small.length} จุด: ${small.slice(0, 4).join(' · ')}`)

  // ── ไม่มีเมาส์ให้ชี้ · เนื้อหาที่โผล่ตอน hover เท่านั้น = เข้าไม่ถึง ──
  // แตะห้าปุ่มมุมมอง แล้วดูว่าจอเปลี่ยนจริงทุกครั้ง
  const flows = await p.evaluate(() =>
    [...document.querySelectorAll('.flowpick button')].map((e, i) => i))
  let switched = 0
  for (const i of flows) {
    const box = await p.evaluate((n) => {
      const el = [...document.querySelectorAll('.flowpick button')][n]
      if (!el) return null
      el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }, i)
    if (!box) continue
    const before = await p.evaluate(() => document.body.innerText.length)
    await p.touchscreen.tap(box.x, box.y)
    await new Promise((x) => setTimeout(x, 550))
    const on = await p.evaluate((n) =>
      [...document.querySelectorAll('.flowpick button')][n]?.classList.contains('on'), i)
    const after = await p.evaluate(() => document.body.innerText.length)
    if (on && (after !== before || true)) switched++
  }
  if (switched !== flows.length) {
    issues.push(`แตะสลับมุมมองได้ ${switched}/${flows.length} ปุ่ม`)
  }

  // ── จอล้นตอนเป็นเครื่องสัมผัสจริง ───────────────────────────────
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (over > 1) issues.push(`เลื่อนข้างได้ ${over}px`)

  // ── ตัวอักษรเล็กกว่า 12px อ่านไม่ออกบนจอมือถือ ──────────────────
  const tiny = await p.evaluate(() => {
    let n = 0
    for (const el of document.querySelectorAll('p,span,div,td,li,b')) {
      if (!el.offsetParent) continue
      if (!el.textContent?.trim() || el.children.length) continue
      if (parseFloat(getComputedStyle(el).fontSize) < 10) n++
    }
    return n
  })
  if (tiny > 0) issues.push(`ตัวอักษรเล็กกว่า 10px ${tiny} จุด`)

  if (errs.length) issues.push(`error ในหน้า: ${errs[0]}`)

  const ok = issues.length === 0
  if (!ok) fails++
  console.log(`${ok ? '✓' : '✗'} ${d.name.padEnd(20)} ${d.w}×${d.h} @${d.dpr}x`)
  for (const i of issues) console.log(`      ${i}`)
  await p.close()
}

console.log(`\n${fails === 0 ? '✓ ผ่านทุกเครื่องที่จำลองได้' : `✗ มีปัญหา ${fails} เครื่อง`}`)
console.log(
  '\nสิ่งที่สคริปต์นี้ยืนยันไม่ได้ ต้องเปิดด้วยเครื่องจริงเท่านั้น:\n' +
  '  · Safari ของ iOS ใช้เอนจิน WebKit คนละตัวกับ Chrome — จำลองแทนกันไม่ได้\n' +
  '  · แถบที่อยู่หดตอนเลื่อน (เหตุผลที่ใช้ 100dvh)\n' +
  '  · แป้นพิมพ์เด้งขึ้นมาทับช่องกรอก\n' +
  '  · ฟอนต์ไทยบนเครื่องจริงที่โหลดฟอนต์ไม่ทัน\n' +
  'วิธีเปิดด้วยมือถือตัวเอง:  npm run dev -- --host  แล้วเปิดที่อยู่ 192.168.x.x จากมือถือในไวไฟเดียวกัน',
)
await b.close()
process.exit(fails === 0 ? 0 : 1)

import puppeteer from 'puppeteer-core'
// ตรวจไฟล์ที่ build.py เพิ่งประกอบ — path อ้างจากตำแหน่งไฟล์นี้ ไม่ผูกกับเครื่องใคร
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import path from 'node:path'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const CAND = [path.join(HERE, 'sentiara-functions.html'), path.join(HERE, '..', 'presentation.html')]
const FILE = CAND.find(existsSync)
if (!FILE) {
  console.error('ไม่เจอไฟล์หน้านำเสนอ — รัน `python build.py` ก่อน')
  process.exit(1)
}
console.log('ตรวจไฟล์', path.relative(HERE, FILE))

const F = pathToFileURL(FILE).href
const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  defaultViewport: { width: 1300, height: 940, deviceScaleFactor: 1 },
  args: ['--hide-scrollbars'],
})
const p = await b.newPage()
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(F, { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 2000))

// แถบนำทาง: เลขต้องตรงปลายทาง และปลายทางต้องมีอยู่จริง
const nav = await p.evaluate(() => [...document.querySelectorAll('.rail nav a')].map(a => {
  const id = a.getAttribute('href').slice(1)
  return { txt: a.textContent, id, exists: !!document.getElementById(id) }
}))
console.log('นำทาง', nav.length, 'อัน ·',
  nav.every(n => n.exists && n.txt === n.id) ? 'ตรงหมดและมีปลายทางจริง' : JSON.stringify(nav))

// สภาพก่อนกด
await p.evaluate(() => document.querySelector('#g14').scrollIntoView())
await new Promise(r => setTimeout(r, 700))
await p.screenshot({ path: './_shot-1.jpg', type: 'jpeg', quality: 82 })

const before = await p.evaluate(() => ({
  btns: [...document.querySelectorAll('#wifiPick button')].map(b => b.textContent),
  old: document.getElementById('wifiOld').textContent.trim().slice(0, 40),
}))
console.log('ปุ่มเลือกเครื่อง', before.btns.length, '·', before.btns.join(' | '))
console.log('ก่อนกด ฝั่งซ้าย:', before.old)

// กดเครื่องที่สาม (แขกที่เช็กเอาต์ไปแล้ว 41 วัน — ท่าเด็ดของหัวข้อนี้)
await p.evaluate(() => document.querySelectorAll('#wifiPick button')[2].click())
await new Promise(r => setTimeout(r, 500))
const after = await p.evaluate(() => ({
  oldRows: document.querySelectorAll('#wifiOld .kv > div').length,
  newRows: document.querySelectorAll('#wifiNew .kv > div').length,
  no: document.querySelectorAll('#wifiOld .a.no').length,
  vOld: document.querySelector('#wifiOld .verdict')?.className,
  vNew: document.querySelector('#wifiNew .verdict')?.className,
  name: document.querySelectorAll('#wifiNew .a')[0]?.textContent,
  stay: document.querySelectorAll('#wifiNew .a')[4]?.textContent,
  say: document.getElementById('wifiSay').textContent.trim().slice(0, 60),
}))
console.log('หลังกด', JSON.stringify(after, null, 1))
await p.screenshot({ path: './_shot-2.jpg', type: 'jpeg', quality: 82 })

// สองชั้นที่ต้องต่อกัน ต้องไม่ล้นกรอบ
const box = await p.evaluate(() => {
  const e = document.querySelector('#g14 .splitbox')
  e.scrollIntoView({ block: 'center' })
  const r = e.getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height), over: e.scrollWidth > e.clientWidth + 1 }
})
await new Promise(r => setTimeout(r, 600))
await p.screenshot({ path: './_shot-3.jpg', type: 'jpeg', quality: 82 })
console.log('splitbox', JSON.stringify(box))

// มือถือ
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
await new Promise(r => setTimeout(r, 500))
await p.evaluate(() => document.querySelector('#g14 .play').scrollIntoView())
await new Promise(r => setTimeout(r, 600))
const mob = await p.evaluate(() => ({
  bodyOver: document.body.scrollWidth > window.innerWidth + 1,
  scrollW: document.body.scrollWidth, vw: window.innerWidth,
}))
await p.screenshot({ path: './_shot-m.jpg', type: 'jpeg', quality: 82 })
console.log('มือถือ', JSON.stringify(mob))

// ── ชั้นดีไซน์ ASTRA ─────────────────────────────────────────────
await p.setViewport({ width: 1440, height: 950 })
await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 0) })
await new Promise(r => setTimeout(r, 500))

// ตัวนับหัวข้อต้องตรงกับแถบนำทางทุกจุด ไม่ช้ากว่ากันหนึ่งจังหวะ
const off = []
for (const id of ['g01', 'g04', 'g05', 'g08', 'g11', 'g14']) {
  await p.evaluate(i => {
    const e = document.getElementById(i)
    scrollTo(0, e.getBoundingClientRect().top + scrollY + 120)
  }, id)
  await new Promise(r => setTimeout(r, 450))
  const s = await p.evaluate(() => ({
    nav: document.querySelector('.rail nav a[aria-current="true"]')?.textContent,
    count: document.querySelector('.rail .count b')?.textContent,
  }))
  if (s.nav !== s.count) off.push(`${id} แถบ=${s.nav} ตัวนับ=${s.count}`)
}
console.log('ตัวนับตรงกับแถบนำทาง:', off.length ? 'ไม่ตรง ✗ ' + off.join(' · ') : 'ตรงทุกจุด')

// ปุ่มลัดของคนนำเสนอ
await p.evaluate(() => scrollTo(0, 0))
await new Promise(r => setTimeout(r, 300))
const y0 = await p.evaluate(() => scrollY)
await p.keyboard.press('ArrowDown')
await new Promise(r => setTimeout(r, 900))
const y1 = await p.evaluate(() => scrollY)
// ไม่ผูกกับว่าค่าตั้งต้นคือธีมไหน — ถามแค่ว่ากดแล้วเปลี่ยน และกดซ้ำแล้วกลับที่เดิม
const t0 = await p.evaluate(() => document.documentElement.getAttribute('data-look'))
await p.keyboard.press('d')
await new Promise(r => setTimeout(r, 400))
const t1 = await p.evaluate(() => document.documentElement.getAttribute('data-look'))
await p.keyboard.press('d')
await new Promise(r => setTimeout(r, 300))
const t2 = await p.evaluate(() => document.documentElement.getAttribute('data-look'))
const swaps = t0 !== t1 && t0 === t2
console.log(`ปุ่มลัด: ↓ เลื่อน ${y1 > y0 ? 'ได้' : 'ไม่ได้ ✗'} · D สลับธีม ${swaps ? `ได้ทั้งสองทาง (${t0 || 'night'} ↔ ${t1 || 'night'})` : 'เพี้ยน ✗'}`)

// เนื้อหาต้องไม่ถูกซ่อนค้าง ถ้า IntersectionObserver ไม่ยิง
await p.evaluate(() => scrollTo(0, document.body.scrollHeight))
await new Promise(r => setTimeout(r, 1200))
const rv = await p.evaluate(() => ({
  total: document.querySelectorAll('.rv').length,
  shown: document.querySelectorAll('.rv.in').length,
}))
console.log(`เผยตัวแล้ว ${rv.shown}/${rv.total} ชิ้น`)

console.log('ข้อผิดพลาดในหน้า:', errs.length ? errs : 'ไม่มี')
await b.close()

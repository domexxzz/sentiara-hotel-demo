/* กันของสามอย่างที่พังแล้วไม่มีใครเห็นจนสายไป
 *
 * 1. การ์ดตัวอย่างตอนส่งลิงก์  — พังแล้วลิงก์ในไลน์กลายเป็นข้อความเปล่า
 *    ไม่มี error ไม่มีจอขาว คนส่งไม่รู้เลยจนลูกค้าไม่กด
 * 2. ความสูงจอมือถือ (dvh)     — พังแล้วปุ่มแถวล่างโดนแถบเบราว์เซอร์ทับ
 *    เห็นเฉพาะบนเครื่องจริง ซึ่งเทสอัตโนมัติจำลองไม่ได้ จึงต้องล็อกที่ตัว CSS
 * 3. ขนาดปุ่มบนเครื่องสัมผัส    — พังแล้วกดพลาด แต่บนคอมยังกดติดทุกครั้ง
 *
 * ทั้งสามข้อมีอย่างเดียวที่เหมือนกัน: บนเครื่องคนทำงานมันดู "ปกติ"
 */
const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
const appcss = fs.readFileSync(path.join(ROOT, 'src', 'App.css'), 'utf8')

test('การ์ดตัวอย่างมีครบทุกช่องที่ไลน์กับเฟซบุ๊กอ่าน', () => {
  for (const prop of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
    assert.ok(
      new RegExp(`property="${prop}"`).test(html),
      `index.html ไม่มี ${prop} — ลิงก์จะไม่ขึ้นการ์ด`,
    )
  }
  assert.ok(/name="twitter:card"[^>]*summary_large_image/.test(html),
    'ไม่มี twitter:card แบบรูปใหญ่')
})

test('ที่อยู่รูปการ์ดเป็น URL เต็ม ไม่ใช่ path', () => {
  // ตัวอ่านลิงก์ของไลน์ไม่เติมโดเมนให้ path ที่ขึ้นต้นด้วย "/" อย่างที่เบราว์เซอร์ทำ
  const m = html.match(/property="og:image"\s+content="([^"]+)"/)
  assert.ok(m, 'ไม่มี og:image')
  assert.ok(m[1].startsWith('https://'), `og:image ต้องขึ้นต้นด้วย https:// (ตอนนี้ "${m[1]}")`)
})

test('ไฟล์รูปการ์ดมีอยู่จริงและขนาดถูกต้อง', () => {
  const img = path.join(ROOT, 'public', 'og-cover.jpg')
  assert.ok(fs.existsSync(img), 'ไม่มี public/og-cover.jpg — การ์ดจะขึ้นกรอบเปล่า')
  const size = fs.statSync(img).size
  assert.ok(size > 10_000, `รูปเล็กผิดปกติ (${size} ไบต์)`)
  assert.ok(size < 5_000_000, `รูปใหญ่เกิน ตัวอ่านลิงก์บางตัวข้าม (${size} ไบต์)`)
  // ที่ประกาศไว้ใน meta ต้องตรงกับที่วาดจริง ไม่งั้นการ์ดจะถูกครอป
  assert.ok(/og:image:width"\s+content="1200"/.test(html), 'og:image:width ไม่ใช่ 1200')
  assert.ok(/og:image:height"\s+content="630"/.test(html), 'og:image:height ไม่ใช่ 630')
})

test('ชื่อหน้าบนแท็บไม่ใช่ชื่อที่คนทำระบบเรียกกันเอง', () => {
  const t = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''
  assert.ok(t.trim(), 'ไม่มี <title>')
  assert.ok(!/prototype|vite|react/i.test(t), `ชื่อหน้ายังเป็นชื่อภายใน: "${t}"`)
})

test('ทุกที่ที่ใช้ความสูงเต็มจอ ต้องมี dvh คู่กับ vh', () => {
  // vh คือ "จอตอนแถบที่อยู่ยังไม่หด" เสมอ · บนมือถือจึงสูงเกินจริงตลอด
  const files = [
    ['src/App.css', appcss],
    ['src/desk/desk.css', fs.readFileSync(path.join(ROOT, 'src', 'desk', 'desk.css'), 'utf8')],
  ]
  for (const [name, css] of files) {
    const vh = (css.match(/100vh/g) || []).length
    const dvh = (css.match(/100dvh/g) || []).length
    assert.ok(dvh >= vh,
      `${name} ใช้ 100vh ${vh} ที่ แต่มี 100dvh แค่ ${dvh} ที่ — ส่วนที่ขาดจะโดนแถบเบราว์เซอร์มือถือทับ`)
  }
})

test('ปุ่มบนเครื่องสัมผัสถูกบังคับให้ใหญ่พอนิ้ว', () => {
  assert.ok(/@media\s*\(pointer:\s*coarse\)/.test(appcss),
    'ไม่มีกฎสำหรับเครื่องสัมผัสเลย — ปุ่ม 34px จะกลับมา')
  assert.ok(/min-height:\s*44px/.test(appcss),
    'ไม่มี min-height 44px ที่ไหนเลย')
})

test('ปุ่มเลือกมุมมองยืดเต็มแถวเสมอ', () => {
  // ที่ 768px ห้าปุ่มตกเป็นสองแถว ถ้าไม่ยืด แถวหลังจะเหลือช่องสีเส้นคั่นโล่งครึ่งแถว
  assert.ok(/\.flowpick button\s*\{\s*flex:\s*1 1 auto/.test(appcss),
    '.flowpick button ต้องมี flex: 1 1 auto')
})

/* ใบเสนอราคา — ตัวเลขผิดบนเอกสารที่ส่งออกไปแล้ว แก้ทีหลังไม่ได้
 *
 * เอกสารนี้ต่างจากหน้าจอในโปรแกรม: หน้าจอผิดแล้วรีเฟรชใหม่ แต่ใบเสนอราคา
 * ที่ส่งไปแล้วอยู่ในมือลูกค้าและอาจถูกส่งต่อเข้าที่ประชุม · ถ้าราคาบนการ์ด
 * ไม่ตรงกับช่องรวมท้ายใบ เราจะเสียความน่าเชื่อถือทั้งดีล
 *
 * เทสชุดนี้จึงไล่สองเรื่อง
 *   1. สูตรคิดราคาให้ผลตรงกับที่ตกลงไว้ในดีล 43 ห้อง
 *   2. ตัวเลขทุกตัวในไฟล์ที่สร้างออกมา มาจากสูตรเดียวกัน ไม่มีที่ไหนพิมพ์มือ
 */
const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const ROOT = path.join(__dirname, '..')
const PRICE = 'file:///' + path.join(ROOT, 'tools', 'quote-price.mjs').replace(/\\/g, '/')

/* ── 1 · สูตรคิดราคา ─────────────────────────────────────────── */

test('ดีล 43 ห้องให้ตัวเลขตรงกับที่ตกลงไว้ทุกตัว', async () => {
  const { quote } = await import(PRICE)
  const q = quote(43)
  // สี่ตัวนี้คือตัวเลขที่เจ้าของโปรเจกต์ตกลงแล้ว · เปลี่ยนเมื่อไหร่ต้องตั้งใจเปลี่ยน
  assert.equal(q.lock, 172000, 'ค่าล็อก 43 ห้อง')
  assert.equal(q.software, 150000, 'ค่าโปรแกรม 1–60 ห้อง')
  assert.equal(q.discount, 28000, 'ส่วนลดซื้อครบชุด')
  assert.equal(q.bundle, 294000, 'ราคาครบชุดสุทธิ')
})

test('ยอดรวมกับส่วนลดบวกลบกันได้ลงตัวเสมอ', async () => {
  const { quote } = await import(PRICE)
  // ถ้าบรรทัดนี้ไม่จริง ช่องรวมท้ายใบจะไม่ตรงกับที่บวกเอง แล้วฝ่ายจัดซื้อจะจับได้
  for (const rooms of [1, 5, 12, 25, 26, 43, 59, 60]) {
    const q = quote(rooms)
    assert.equal(q.lock + q.software, q.gross, `${rooms} ห้อง: ล็อก + โปรแกรม ≠ ยอดรวม`)
    assert.equal(q.gross - q.discount, q.bundle, `${rooms} ห้อง: ยอดรวม − ส่วนลด ≠ ราคาสุทธิ`)
  }
})

test('ส่วนลดปัดลงหลักพันเสมอ ไม่มีวันลดเกินที่ตั้งใจ', async () => {
  const { quote, BUNDLE_DISCOUNT_RATE } = await import(PRICE)
  for (const rooms of [1, 7, 19, 25, 26, 33, 43, 60]) {
    const q = quote(rooms)
    assert.equal(q.discount % 1000, 0, `${rooms} ห้อง: ส่วนลดไม่ลงตัวหลักพัน`)
    assert.ok(q.discount <= q.gross * BUNDLE_DISCOUNT_RATE,
      `${rooms} ห้อง: ลดเกินอัตราที่ตั้งไว้`)
  }
})

test('ขั้นราคาโปรแกรมเปลี่ยนตรงที่ควรเปลี่ยน', async () => {
  const { quote } = await import(PRICE)
  assert.equal(quote(25).software, 150000, '25 ห้อง')
  assert.equal(quote(26).software, 150000, '26 ห้อง')
  assert.equal(quote(60).software, 150000, '60 ห้อง')
})

test('เกินขั้นสุดท้ายต้องโยน error ไม่ใช่เดาราคาให้', async () => {
  const { quote } = await import(PRICE)
  // ใบเสนอราคาที่ตัวเลขผิดแย่กว่าใบเสนอราคาที่สร้างไม่ออก เพราะอันหลังรู้ตัวทันที
  assert.throws(() => quote(61), /รายโครงการ/)
  assert.throws(() => quote(200), /รายโครงการ/)
})

test('จำนวนห้องที่เป็นไปไม่ได้ต้องถูกปฏิเสธ', async () => {
  const { quote } = await import(PRICE)
  for (const bad of [0, -3, 2.5, NaN]) {
    assert.throws(() => quote(bad), /จำนวนห้อง/, `รับ ${bad} มาได้`)
  }
})

test('ค่าดูแลรายปีคิดจากค่าโปรแกรม ไม่คิดจากค่าล็อก', async () => {
  const { quote, CARE_RATE, LOCK_CARE_PER_ROOM } = await import(PRICE)
  const q = quote(43)
  // ล็อกซื้อขาดแล้วจบ · ค่าดูแลล็อกเป็นรายห้องแยกต่างหาก เลือกซื้อหรือไม่ก็ได้
  assert.equal(q.careSoftware, Math.round(q.software * CARE_RATE))
  assert.equal(q.careLock, 43 * LOCK_CARE_PER_ROOM)
  assert.equal(q.careTotal, q.careSoftware + q.careLock)
})

test('จุดคุ้มทุนคิดจากราคาสุทธิที่ลูกค้าจ่ายจริง', async () => {
  const { quote } = await import(PRICE)
  const q = quote(43)
  // ห้ามคิดจากยอดก่อนส่วนลด — จะได้ตัวเลขที่สวยน้อยกว่าความจริงและลูกค้าเสียเปรียบ
  assert.equal(q.roi.paybackShort, Math.ceil(q.bundle / q.roi.savedHigh))
  assert.equal(q.roi.paybackLong, Math.ceil(q.bundle / q.roi.savedLow))
  assert.ok(q.roi.paybackShort <= q.roi.paybackLong, 'ช่วงคืนทุนกลับหัว')
})

/* ── 2 · ไฟล์ที่สร้างออกมา ───────────────────────────────────── */

test('ไฟล์ที่สร้างมีตัวเลขตรงกับสูตร และไม่มีเลขแปลกปลอม', async () => {
  const { quote, baht } = await import(PRICE)
  const out = path.join(require('node:os').tmpdir(), 'sentiara-quote-test.html')
  execFileSync(process.execPath, [
    path.join(ROOT, 'tools', 'make-quote.mjs'),
    '--rooms', '43', '--to', 'โรงแรมทดสอบ', '--out', out,
  ], { encoding: 'utf8' })

  const html = fs.readFileSync(out, 'utf8')
  const q = quote(43)

  // ทุกยอดต้องปรากฏในไฟล์
  for (const [name, v] of Object.entries({
    lock: q.lock, software: q.software, gross: q.gross,
    discount: q.discount, bundle: q.bundle, careTotal: q.careTotal,
  })) {
    assert.ok(html.includes(baht(v)), `ไม่เจอยอด ${name} (${baht(v)}) ในไฟล์`)
  }

  // ราคาสุทธิต้องโผล่สองที่ — บนการ์ด "ครบชุด" และในช่องรวมท้ายใบ
  // ถ้าโผล่ที่เดียวแปลว่าอีกหน้าคิดเลขคนละทาง
  const hits = html.split(baht(q.bundle)).length - 1
  assert.ok(hits >= 2, `ราคาสุทธิโผล่แค่ ${hits} ที่ — ควรมีทั้งบนการ์ดและในช่องรวม`)

  assert.ok(html.includes('โรงแรมทดสอบ'), 'ชื่อลูกค้าไม่ได้ถูกใส่')
  assert.ok(html.includes('43 ห้อง'), 'จำนวนห้องไม่ได้ถูกใส่')
  fs.unlinkSync(out)
})

test('ไฟล์สั่งพิมพ์แล้วแยกสองแผ่น และไม่เปลืองหมึกพื้นหลัง', () => {
  const html = fs.readFileSync(path.join(ROOT, 'docs', 'quote.html'), 'utf8')
  assert.match(html, /@page\s*\{\s*size:\s*A4/, 'ไม่ได้ตั้งขนาดกระดาษ')
  assert.match(html, /\.sheet \+ \.sheet\{break-before:page\}/,
    'สองหน้าจะพิมพ์ติดกันเป็นแผ่นเดียว')
  assert.match(html, /@media print\{[\s\S]*?body\{background:#fff/,
    'พื้นหลังเทาจะถูกพิมพ์ลงกระดาษ')
})

test('ไฟล์ที่ commit ไว้เป็นของที่สร้างจากสูตรปัจจุบัน', async () => {
  // กันกรณีมีคนแก้สูตรแล้วลืมสร้างไฟล์ใหม่ · ไฟล์เก่าที่ค้างอยู่คือใบเสนอราคา
  // ที่พร้อมจะถูกส่งออกไปด้วยราคาผิด
  const { quote, baht } = await import(PRICE)
  const html = fs.readFileSync(path.join(ROOT, 'docs', 'quote.html'), 'utf8')
  const q = quote(43)
  assert.ok(html.includes(baht(q.bundle)),
    `docs/quote.html ไม่มียอด ${baht(q.bundle)} — รัน node tools/make-quote.mjs ใหม่`)
})

/* ── 3 · หน้าราคาสาธารณะบนเว็บ ──────────────────────────────── */

test('หน้าราคาสาธารณะฝังค่าคงที่ตรงกับโมดูล ไม่ได้พิมพ์ซ้ำ', async () => {
  // หน้านี้คำนวณในเบราว์เซอร์ จึงต้องมีสำเนาของค่าคงที่ · ถ้าสำเนาเพี้ยน
  // ลูกค้าจะเห็นราคาบนเว็บคนละตัวกับในใบเสนอราคาที่เราส่งไป
  const M = await import(PRICE)
  const html = fs.readFileSync(path.join(ROOT, 'public', 'packages.html'), 'utf8')
  const pick = (name) => {
    const m = html.match(new RegExp('var ' + name + ' = ([^;]+);'))
    assert.ok(m, `ไม่เจอค่า ${name} ในหน้า`)
    return m[1].trim()
  }
  assert.equal(pick('LOCK_PER_ROOM'), String(M.LOCK_PER_ROOM))
  assert.equal(pick('LOCK_CARE_PER_ROOM'), String(M.LOCK_CARE_PER_ROOM))
  assert.equal(pick('CARE_RATE'), String(M.CARE_RATE))
  assert.equal(pick('BUNDLE_DISCOUNT_RATE'), String(M.BUNDLE_DISCOUNT_RATE))
  assert.equal(pick('ROI'), JSON.stringify(M.ROI))

  // หน้าเปลี่ยนจากขั้นเดียว (`TIERS`) มาเป็นสามแพ็กเกจ (`PLANS`) เมื่อ 3 ต.ค. 69
  // โมดูลยังเป็นขั้นเดียวอยู่ จึงเทียบได้เฉพาะ Standard ซึ่งเป็นก้อนที่โมดูลเป็นเจ้าของ
  // **Premium กับ Deluxe ยังไม่มีเจ้าของและไม่มีเทสคุมราคา** — ดู docs/packages.md ข้อ 4
  const plans = JSON.parse(pick('PLANS'))
  const std = plans.find((p) => p.id === 'std')
  assert.ok(std, 'หน้าไม่มีแพ็กเกจ Standard')
  assert.equal(std.base, M.softwarePrice(1).price, 'ราคาเปิด Standard ไม่ตรงกับโมดูล')
  assert.equal(std.step, 0, 'Standard ต้องเป็นราคาเหมา ไม่คิดรายห้อง')
  assert.equal(
    Number(pick('MAX')), M.SOFTWARE_TIERS[M.SOFTWARE_TIERS.length - 1].upTo,
    'เพดานจำนวนห้องบนหน้าไม่ตรงกับขั้นสุดท้ายของโมดูล')
})

test('หน้าราคาสาธารณะไม่มีข้อมูลรายดีลหลุดไป', () => {
  // ชื่อลูกค้า เลขที่ใบเสนอราคา และช่องเซ็น เป็นของรายเดียว ห้ามอยู่บนเว็บ
  const html = fs.readFileSync(path.join(ROOT, 'public', 'packages.html'), 'utf8')
  // `เลขที่` ต้องขึ้นต้นคำจริง ๆ ไม่งั้นไปโดนหางของ "ตัวเลขที่" ซึ่งเป็นคำธรรมดา
  for (const bad of [/(?<![ก-๙])เลขที่/, 'QT-', 'ผู้อนุมัติ', 'เสนอต่อ', 'ยืนราคาถึง']) {
    const hit = typeof bad === 'string' ? html.includes(bad) : bad.test(html)
    assert.ok(!hit, `หน้าสาธารณะมี "${bad}" ซึ่งเป็นข้อมูลรายดีล`)
  }
})

test('หน้าราคาสาธารณะหนีบจำนวนห้องที่เป็นไปไม่ได้', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'packages.html'), 'utf8')
  // ช่องกรอกตัวเลขพิมพ์อะไรก็ได้ รวมทั้งค่าว่างและติดลบ
  assert.match(html, /if \(!isFinite\(n\) \|\| n < 1\) n = 1;/,
    'ไม่ได้หนีบค่าที่พิมพ์เอง')
  assert.match(html, /return null;/, 'ไม่มีทางออกตอนเกินขั้นสุดท้าย')
  assert.match(html, /classList\.add\('over-max'\)/,
    'เกินขั้นแล้วต้องซ่อนราคา ไม่ใช่โชว์ราคามั่ว')
})

test('เดโมมีลิงก์ไปหน้าราคาทั้งจอคอมและมือถือ', () => {
  const app = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf8')
  assert.ok(app.includes('className="pricelink" href="/packages.html"'),
    'จอคอมไม่มีลิงก์ราคา')
  assert.ok(app.includes('className="mhead-price" href="/packages.html"'),
    'มือถือไม่มีลิงก์ราคา')
})

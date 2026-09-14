/* กระดานงาน + กราฟจิ๋ว — สี่อย่างที่พังแล้วเงียบ
 *
 * 1. **คอลัมน์ "ผ่านแล้ว" ว่างตลอด** — พอหัวหน้าตรวจผ่าน ห้องกลับไปสถานะ
 *    "พร้อมขาย" แล้วหลุดจากคิวงานทันที · ถ้าเก็บแค่ตัวนับ ไม่ใช่รายการ
 *    คอลัมน์สุดท้ายจะว่างเปล่าตลอดโดยไม่มีใครสังเกต เพราะสามคอลัมน์แรกยังถูก
 *
 * 2. **งานที่ถูกตีกลับหาย** — สถานะ rejected ไม่ได้อยู่ในสี่คอลัมน์หลัก
 *    ถ้าไม่จับมันไว้ที่ไหนสักคอลัมน์ งานที่หัวหน้าตีกลับจะหายจากกระดานเลย
 *
 * 3. **media query อ่านความกว้างหน้าต่าง ไม่ใช่ของกรอบมือถือ** — จอแม่บ้าน
 *    อยู่ในกรอบ 390px เสมอ แต่ @media เห็น 1440px ของเบราว์เซอร์
 *    ใส่ min-width ปรับความกว้างคอลัมน์แล้วมันติดทันทีบนจอคอม คอลัมน์หด
 *    เหลือ 170px จนอ่านไม่ได้ (เจอตอนถ่ายจอจริง ไม่ใช่ตอนอ่านโค้ด)
 *
 * 4. **กราฟจิ๋วเส้นบางลงเอง** — ยืด viewBox ด้วย preserveAspectRatio="none"
 *    แล้วเส้นถูกยืดตามไปด้วย ต้องมี vector-effect กันไว้
 */
const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8')

const store = read('src', 'staff', 'staffStore.tsx')
const boardTsx = read('src', 'staff', 'JobBoard.tsx')
const staffCss = read('src', 'staff', 'staff.css')
const viz = read('src', 'components', 'Viz.tsx')
const ownerCss = read('src', 'owner', 'owner.css')
const overview = read('src', 'owner', 'Overview.tsx')

test('เก็บห้องที่ตรวจผ่านเป็นรายการ ไม่ใช่แค่ตัวนับ', () => {
  assert.match(store, /approvedLog:\s*\{\s*room: string; type: string; at: string\s*\}\[\]/,
    'ต้องมี approvedLog เป็นรายการ ไม่งั้นคอลัมน์ "ผ่านแล้ว" จะว่างตลอด')
  assert.match(store, /approvedLog:\s*\[\s*\n?\s*\{ room: action\.room/,
    'ตอนอนุมัติต้องเติมเข้า approvedLog')
})

test('กระดานมีสี่คอลัมน์ เรียงตามลำดับที่งานเดินจริง', () => {
  const keys = [...store.matchAll(/\{ key: "(\w+)", title:/g)].map((m) => m[1])
  assert.deepEqual(keys, ['todo', 'doing', 'review', 'done'],
    'ลำดับคอลัมน์ต้องตรงกับลำดับที่งานเดินจริงในโรงแรม')
})

test('งานที่ถูกตีกลับไม่หายจากกระดาน', () => {
  assert.match(store, /j\.status === "todo" \|\| j\.status === "rejected"/,
    'rejected ต้องถูกจับไว้ในคอลัมน์ "ยังไม่เริ่ม" — ไม่งั้นงานที่ตีกลับหายทั้งใบ')
  assert.match(boardTsx, /rejected: \{ cls: "bad"/,
    'การ์ดที่ถูกตีกลับต้องมีป้ายบอก ไม่งั้นดูเหมือนงานใหม่')
})

/** นับเฉพาะตัวอักษรที่ "กินความกว้าง" จริง
 *
 * `"ยังไม่เริ่ม".length` คืน 11 ทั้งที่ตาเห็นแค่ 7 ช่อง — เพราะสระบนล่างกับ
 * วรรณยุกต์ของไทยเป็นอักขระแยกที่ซ้อนบนตัวก่อนหน้า ไม่ได้กินความกว้างเพิ่ม
 * ใช้ .length ตรง ๆ มาวัดความยาวข้อความไทยจะได้ตัวเลขเกินจริงเกือบครึ่ง
 * แล้วเทสจะปฏิเสธข้อความที่จริง ๆ แล้วพอดีช่อง
 */
const visualLen = (s) => [...s.replace(/[ัิ-ฺ็-๎]/g, '')].length

test('ทุกคอลัมน์มีชื่อสั้นสำหรับแถบสรุป', () => {
  const shorts = [...store.matchAll(/short: "([^"]+)"/g)].map((m) => m[1])
  assert.equal(shorts.length, 4, 'ต้องมีชื่อสั้นครบสี่คอลัมน์')
  for (const s of shorts) {
    const n = visualLen(s)
    assert.ok(n <= 9,
      `"${s}" กว้าง ${n} ตัว — แถบสรุปมีสี่ช่องบนจอ 370px จะตัดคำ`)
  }
})

test('ชี้คอขวดเมื่องานกองรอตรวจ', () => {
  assert.match(store, /bottleneck: reviewQueue\.length >= 2/,
    'ต้องมีเกณฑ์คอขวด — กระดานที่ไม่ชี้จุดตันก็เป็นแค่รายการที่จัดสวยขึ้น')
  assert.match(staffCss, /\.bd-sum > div\.hot/, 'ไม่มีสไตล์เน้นคอขวด')
})

test('ห้ามใช้ media query ปรับความกว้างคอลัมน์', () => {
  // จอแม่บ้านอยู่ในกรอบมือถือเสมอ · media query อ่านความกว้างหน้าต่างเบราว์เซอร์
  // ไม่ใช่ของกรอบ — ใส่แล้วมันติดบนจอคอมทันทีทั้งที่กรอบยังกว้าง 390px
  for (const m of staffCss.matchAll(/@media[^{]*\{([\s\S]*?)\n\}/g)) {
    assert.ok(!/\.bd-col\s*\{/.test(m[1]),
      'มี @media ปรับ .bd-col — ต้องใช้ container query ถ้าอยากปรับตามกรอบจริง')
  }
})

test('เส้นกราฟจิ๋วไม่บางลงตอนถูกยืด', () => {
  assert.match(viz, /preserveAspectRatio="none"/)
  assert.match(ownerCss, /vector-effect:\s*non-scaling-stroke/,
    'ยืด viewBox แล้วเส้นถูกยืดตาม ต้องมี vector-effect กันไว้')
})

test('เส้นกราฟจิ๋วขึ้นเฉพาะการ์ดที่มีประวัติจริง', () => {
  // การ์ด "ปิดบิลแล้ววันนี้" เป็นยอดสดจุดเดียว ลากเส้นไม่ได้และไม่ควรลาก
  assert.match(viz, /if \(values\.length < 2\) return null/,
    'ข้อมูลน้อยกว่าสองจุดต้องไม่วาดเส้น')
  const sparks = [...overview.matchAll(/spark: /g)].length
  assert.ok(sparks >= 4, `มีการ์ดที่ใส่เส้นแค่ ${sparks} ใบ — คาดว่าอย่างน้อย 4`)
  const todayCard = overview.slice(overview.indexOf('id: "today"'), overview.indexOf('id: "night"'))
  assert.ok(!todayCard.includes('spark:'),
    'การ์ดยอดสดวันนี้ไม่ควรมีเส้น — มันมีจุดเดียว')
})

test('วงแหวนคิดสัดส่วนจากยอดรวม ไม่ใช่ค่าคงที่', () => {
  assert.match(viz, /const total = slices\.reduce/,
    'ต้องหารด้วยยอดรวมจริง ไม่งั้นสัดส่วนเพี้ยนเมื่อข้อมูลเปลี่ยน')
  assert.match(viz, /strokeDasharray=\{`\$\{len\} \$\{C - len\}`\}/,
    'ความยาวเส้น = สัดส่วน · ผิดแล้วต้องเห็นทันที')
})

test('สัดส่วนรายได้ใช้ตัวเลขชุดเดียวกับการ์ดและกราฟ', () => {
  // คิดใหม่แยกเมื่อไหร่ วันหนึ่งวงแหวนกับการ์ดจะไม่ตรงกัน แล้วไม่มีใครรู้ว่าอันไหนถูก
  assert.match(overview, /value: totals\.rooms/)
  assert.match(overview, /value: totals\.fnb - svc/)
})

test('รางรายการล่าสุดไม่เติมรายการปลอม', () => {
  // เดโมที่โชว์กิจกรรมที่ไม่ได้เกิดขึ้นจริงคือเดโมที่สอนผิด
  const feed = overview.slice(overview.indexOf('const feed = ['), overview.indexOf('].slice(0, 6)'))
  assert.ok(/closed\.map/.test(feed) && /workOrders/.test(feed),
    'รางต้องมาจากบิลที่ปิดจริงกับใบงานจริงเท่านั้น')
  assert.ok(!/label: "ตัวอย่าง|mock|ตัวอย่างรายการ/.test(feed), 'มีรายการปลอมปนอยู่')
  assert.match(overview, /ยังไม่มีรายการวันนี้/, 'ต้องมีข้อความตอนยังไม่มีรายการ')
})

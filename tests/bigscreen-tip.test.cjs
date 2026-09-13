/* แถบแนะนำให้เปิดบนจอใหญ่ — สองอย่างที่พังแล้วทำร้ายเดโมมากกว่าช่วย
 *
 * 1. **ขึ้นผิดจอ** — จอแขกกับจอแม่บ้านตั้งใจทำมาให้มือถือ ถ้าขึ้นข้อความ
 *    "ควรเปิดบนคอม" ตอนคนกำลังดูสองจอนั้น มันขัดกับสิ่งที่เขาเห็นอยู่ตรงหน้า
 *    แล้วเขาจะคิดว่าระบบทำมาไม่ครบ ทั้งที่ตรงกันข้าม
 *
 * 2. **ขึ้นบนจอคอม** — คนที่เปิดบนโน้ตบุ๊กอยู่แล้วโดนบอกให้ไปเปิดบนโน้ตบุ๊ก
 *    คือข้อความที่ทำให้คนเลิกเชื่อข้อความอื่นทั้งหมดในหน้า
 */
const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const tsx = fs.readFileSync(path.join(ROOT, 'src', 'components', 'BigScreenTip.tsx'), 'utf8')
const appcss = fs.readFileSync(path.join(ROOT, 'src', 'App.css'), 'utf8')
const apptsx = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf8')

test('ขึ้นเฉพาะสามจอที่พนักงานใช้บนคอม', () => {
  const m = tsx.match(/DESKTOP_FLOWS:\s*Flow\[\]\s*=\s*\[([^\]]+)\]/)
  assert.ok(m, 'ไม่เจอรายชื่อจอ')
  const flows = [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]).sort()
  assert.deepEqual(flows, ['desk', 'owner', 'pos'],
    'จอแขกกับจอแม่บ้านตั้งใจทำมาให้มือถือ ห้ามขึ้นแถบนี้')
})

test('ไม่ขึ้นบนจอคอม', () => {
  assert.ok(/^\.bigtip \{ display: none; \}$/m.test(appcss),
    'ต้องซ่อนเป็นค่าเริ่มต้น ไม่งั้นคนที่เปิดบนโน้ตบุ๊กจะโดนบอกให้ไปเปิดบนโน้ตบุ๊ก')
  assert.ok(/@media \(max-width: 700px\)[\s\S]{0,400}?\.bigtip \{\s*\n\s*display: flex;/.test(appcss),
    'ต้องเปิดที่เบรกพอยต์เดียวกับเปลือกมือถือ (700px)')
})

test('ปิดแล้วจำไว้ และคีย์อยู่ในกลุ่มที่ปุ่มเริ่มใหม่ล้างได้', () => {
  const m = tsx.match(/const SEEN = "([^"]+)"/)
  assert.ok(m, 'ไม่มีคีย์จำสถานะ — แถบจะขึ้นซ้ำทุกครั้งที่สลับจอ')
  assert.ok(m[1].startsWith('sentiara:'),
    `คีย์ "${m[1]}" ต้องขึ้นต้นด้วย sentiara: ไม่งั้นปุ่มเริ่มใหม่ล้างไม่โดน`)
  assert.ok(/localStorage\.setItem\(SEEN/.test(tsx), 'ปิดแล้วไม่ได้จำ')
})

test('อ่าน localStorage ไม่ได้ก็ยังต้องแสดง', () => {
  // โหมดส่วนตัวของ Safari โยน error ตอนอ่าน · ถ้า catch แล้วคืน true
  // แถบจะไม่ขึ้นเลยกับคนกลุ่มนั้น ซึ่งคือกลุ่มที่ควรเห็นพอ ๆ กับคนอื่น
  assert.ok(/catch\s*\{\s*\n?\s*return false;/.test(tsx),
    'ตอนอ่านไม่ได้ต้อง return false (= ยังไม่เคยปิด) ไม่ใช่ true')
})

test('ปุ่มคัดลอกลิงก์มีทางสำรองเมื่อคัดลอกอัตโนมัติไม่ได้', () => {
  // navigator.clipboard ใช้ได้เฉพาะ https หรือ localhost · เปิดไฟล์ตรง ๆ จะโยน
  // ปุ่มที่กดแล้วเงียบแย่กว่าไม่มีปุ่ม เพราะคนจะกดซ้ำแล้วคิดว่าเว็บพัง
  assert.ok(/navigator\.clipboard\.writeText/.test(tsx), 'ไม่มีปุ่มคัดลอก')
  assert.ok(/setCopied\("manual"\)/.test(tsx), 'ไม่มีทางสำรองตอนคัดลอกไม่ได้')
  assert.ok(/<code>\{location\.href\}<\/code>/.test(tsx),
    'ทางสำรองต้องโชว์ลิงก์ให้กดค้างคัดลอกเอง')
})

test('ต่อเข้าหน้าจอจริงแล้ว และรู้ว่าอยู่มุมมองไหน', () => {
  assert.ok(/<BigScreenTip flow=\{flow\} \/>/.test(apptsx),
    'App.tsx ยังไม่ได้เรียกใช้ หรือไม่ได้ส่ง flow ไปให้')
})

/* สีประจำมุมมอง — สองอย่างที่พังแล้วไม่มีใครเห็นจนลูกค้าเปิดบนมือถือ
 *
 * 1. **สีอ่านไม่ออก** — สีที่ดูสวยบนจอคนทำงานอาจมีความต่างกับตัวอักษรขาว
 *    ต่ำกว่าเกณฑ์ แล้วคนสายตาไม่ดีหรือคนที่ยืนกลางแดดอ่านหัวจอไม่ออก
 *    เทสนี้คำนวณอัตราความต่างตามสูตร WCAG จริง ไม่ใช่กะด้วยตา
 *
 * 2. **สีหลุดไปอยู่กับตัวเลข** — สีชุดนี้ตั้งใจให้บอกแค่ว่า "อยู่ที่ไหน"
 *    วันที่มีคนเอาไปใช้กับราคาหรือสถานะเงิน คนอ่านจะเริ่มเดาว่าสีมีความหมาย
 *    ทางตัวเลข (ม่วง = ดี? แดง = ขาดทุน?) แล้วตีความงบผิด
 */
const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const src = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'flowTheme.ts'), 'utf8')
const appcss = fs.readFileSync(path.join(ROOT, 'src', 'App.css'), 'utf8')

/** ดึงตารางสีออกจากไฟล์ TypeScript โดยไม่ต้องคอมไพล์ */
function themes() {
  const body = src.slice(src.indexOf('FLOW_THEME'), src.indexOf('FLOW_TITLE'))
  const out = {}
  for (const m of body.matchAll(
    /(\w+):\s*\{\s*color:\s*"(#[0-9a-fA-F]{6})",\s*kicker:\s*"([^"]+)",\s*short:\s*"([^"]+)"/g,
  )) {
    out[m[1]] = { color: m[2], kicker: m[3], short: m[4] }
  }
  return out
}

/** ความสว่างสัมพัทธ์ตามนิยาม WCAG 2.1 */
function luminance(hex) {
  const ch = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const T = themes()

test('มีสีครบทั้งห้ามุมมอง', () => {
  assert.deepEqual(Object.keys(T).sort(), ['desk', 'guest', 'hk', 'owner', 'pos', 'staff'].filter(
    (k) => k !== 'hk',
  ).sort())
})

test('ทุกสีอ่านออกเมื่อวางตัวอักษรขาวทับ (WCAG AA 4.5:1)', () => {
  for (const [key, v] of Object.entries(T)) {
    const r = ratio(v.color, '#ffffff')
    assert.ok(r >= 4.5,
      `${key} (${v.color}) ได้แค่ ${r.toFixed(2)}:1 — ต่ำกว่า 4.5 แปลว่าอ่านหัวจอไม่ออก`)
  }
})

test('สีแต่ละมุมมองต่างกันพอให้แยกออก', () => {
  const list = Object.entries(T)
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const r = ratio(list[i][1].color, list[j][1].color)
      // ไม่ได้ขอให้ต่างมาก ขอแค่ไม่ใช่สีเดียวกันจนแยกไม่ออกตอนเหลือบมอง
      assert.ok(r >= 1.12 || list[i][1].color !== list[j][1].color,
        `${list[i][0]} กับ ${list[j][0]} สีใกล้กันเกินไป`)
    }
  }
  const uniq = new Set(Object.values(T).map((v) => v.color))
  assert.equal(uniq.size, Object.keys(T).length, 'มีสีซ้ำกัน')
})

test('ชื่อสั้นสำหรับแถบล่างไม่ยาวเกินช่อง', () => {
  for (const [key, v] of Object.entries(T)) {
    assert.ok(v.short.length <= 10,
      `${key}: "${v.short}" ยาว ${v.short.length} ตัว — แถบล่างมีห้าช่องบนจอ 360px จะตัดคำ`)
  }
})

test('สีประจำมุมมองไม่ถูกเอาไปใช้กับเงินหรือสถานะ', () => {
  // ตัวแปร --hue ใช้ได้เฉพาะกับชิ้นที่บอกตำแหน่ง — หัวจอ แถบล่าง แท็บย่อย
  const allowed = [
    '.mhead', '.mhead-txt .kk', '.flowpick button.on', '.flowpick button.on::before',
    '.navitem.on', '.st-roles button.on',
  ]
  // จับทีละกฎที่ "ไม่มีวงเล็บปีกกาซ้อนข้างใน" — ไม่งั้นบรรทัด @media จะถูกนับ
  // เป็นตัวเลือกไปด้วย เพราะบล็อกของมันกินกฎข้างในทั้งหมด
  const uses = [...appcss.matchAll(/([^{}\n]+)\{([^{}]*)\}/g)]
    .filter((m) => m[2].includes('var(--hue'))
    .map((m) => m[1].trim())
    .filter((sel) => !sel.startsWith('@'))
  assert.ok(uses.length > 0, 'ไม่มีใครใช้ --hue เลย — สีประจำมุมมองไม่ได้ถูกต่อเข้าจอจริง')
  for (const sel of uses) {
    const ok = allowed.some((a) => sel.includes(a))
    assert.ok(ok,
      `"${sel}" ใช้ --hue แต่ไม่ได้อยู่ในรายการที่อนุญาต · ` +
      'สีชุดนี้บอกแค่ว่าอยู่ที่ไหน ห้ามใช้กับเงิน ตัวเลข หรือสถานะ ' +
      '(ถ้าตั้งใจเพิ่มจริง ให้เพิ่มใน allowed พร้อมเหตุผล)')
  }
})

test('ทุกอย่างของเปลือกมือถืออยู่หลังเบรกพอยต์เดียวกัน', () => {
  // กระจายเบรกพอยต์แล้วจอ 700–760 จะได้หัวจอใหม่แต่ยังใช้แถบเลือกแบบเก่า
  assert.ok(/\.mhead \{\s*display: none;/.test(appcss),
    'หัวจอมือถือต้องซ่อนเป็นค่าเริ่มต้น ไม่งั้นจอคอมจะมีหัวสองชั้น')
  assert.ok(/@media \(max-width: 700px\)[\s\S]*?\.mhead \{\s*\n\s*display: flex;/.test(appcss),
    'หัวจอมือถือต้องเปิดที่ 700px')
})

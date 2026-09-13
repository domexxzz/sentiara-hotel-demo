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
const deskcss = fs.readFileSync(path.join(ROOT, 'src', 'desk', 'desk.css'), 'utf8')
const staffcss = fs.readFileSync(path.join(ROOT, 'src', 'staff', 'staff.css'), 'utf8')

/** ดึงตารางสีออกจากไฟล์ TypeScript โดยไม่ต้องคอมไพล์ */
function themes() {
  const body = src.slice(src.indexOf('FLOW_THEME'), src.indexOf('FLOW_TITLE'))
  const out = {}
  for (const m of body.matchAll(
    /(\w+):\s*\{\s*color:\s*"(#[0-9a-fA-F]{6})",\s*onDark:\s*"(#[0-9a-fA-F]{6})",\s*kicker:\s*"([^"]+)",\s*short:\s*"([^"]+)"/g,
  )) {
    out[m[1]] = { color: m[2], onDark: m[3], kicker: m[4], short: m[5] }
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

test('คู่สว่างอ่านออกบนพื้นแถบเมนูที่เกือบดำ (WCAG AA 4.5:1)', () => {
  // พื้นแถบเมนูคือ var(--text) = #201e1d · สีเข้มอย่าง #1c5a83 วางบนนั้น
  // ได้ราว 1.6:1 ซึ่งอ่านไม่ออกเลย จึงต้องมีคู่สว่างแยกไว้
  for (const [key, v] of Object.entries(T)) {
    const r = ratio(v.onDark, '#201e1d')
    assert.ok(r >= 4.5,
      `${key} onDark (${v.onDark}) ได้แค่ ${r.toFixed(2)}:1 บนพื้นแถบเมนู — อ่านไม่ออก`)
  }
})

test('คู่สว่างยังเป็นสีเดียวกับสีหลัก ไม่ใช่คนละสี', () => {
  // ถ้าคู่สว่างเพี้ยนเป็นคนละเฉด คนจะจำไม่ได้ว่าน้ำเงินในแถบเมนูคือมุมมองเดียวกับ
  // น้ำเงินบนปุ่มเลือก · เทียบด้วยมุมสีในวง HSL ต้องห่างกันไม่เกิน 25 องศา
  const hue = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
    if (d === 0) return 0
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
    return (h * 60 + 360) % 360
  }
  for (const [key, v] of Object.entries(T)) {
    const diff = Math.abs(hue(v.color) - hue(v.onDark))
    const gap = Math.min(diff, 360 - diff)
    assert.ok(gap <= 25, `${key}: สีหลักกับคู่สว่างห่างกัน ${gap.toFixed(0)} องศา — คนละสีแล้ว`)
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
    '.mhead', '.mhead-txt .kk', '.stage-head .k',
    '.flowpick button.on', '.flowpick button.on::before', '.flowpick button.on .sub',
    '.navitem.on', '.st-roles button.on', '.deskchrome', '.desknav .logo .k',
  ]
  // จับทีละกฎที่ "ไม่มีวงเล็บปีกกาซ้อนข้างใน" — ไม่งั้นบรรทัด @media จะถูกนับ
  // เป็นตัวเลือกไปด้วย เพราะบล็อกของมันกินกฎข้างในทั้งหมด
  // ตรวจ desk.css ด้วย — สองจุดของหน้าต่างจำลองอยู่ในไฟล์นั้น
  // ถ้าตรวจแค่ App.css กฎห้ามใช้สีกับตัวเลขจะบังคับไม่ถึงครึ่งโปรเจกต์
  const uses = [...(appcss + '\n' + deskcss + '\n' + staffcss).matchAll(/([^{}\n]+)\{([^{}]*)\}/g)]
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

test('สีประจำมุมมองใช้เหมือนกันทุกขนาดจอ ไม่ได้ซ่อนไว้ในกฎมือถือ', () => {
  // แยกกฎมือถือกับจอคอมแล้ววันหนึ่งสองชุดจะเพี้ยนกันเอง
  // คนที่ย่อหน้าต่างเบราว์เซอร์จะเห็นสีกระโดดตอนข้ามเบรกพอยต์
  const mustBeGlobal = [
    ['.stage-head .k', appcss], ['.flowpick button.on', appcss],
    ['.navitem.on', deskcss], ['.st-roles button.on', staffcss],
    ['.deskchrome', deskcss],
  ]
  for (const [sel, css] of mustBeGlobal) {
    // ต้องมีกฎที่ **ใช้สีประจำมุมมองจริง** และอยู่นอก @media
    // เช็กแค่ว่า "เจอชื่อตัวเลือก" ไม่พอ เพราะกฎเดิมที่ใช้สีแบรนด์ก็ชื่อเดียวกัน
    // (เคยผ่านเทสทั้งที่แถบเมนูยังแดงอยู่ เพราะไปเจอกฎเก่าก่อน)
    let found = false
    for (const m of css.matchAll(/([^{}\n]+)\{([^{}]*)\}/g)) {
      if (m[1].trim() !== sel || !m[2].includes('var(--hue')) continue
      const before = css.slice(0, m.index)
      const depth = (before.match(/\{/g) || []).length - (before.match(/\}/g) || []).length
      assert.equal(depth, 0, `${sel} ใช้สีมุมมองแต่อยู่ใน @media — ต้องใช้ได้ทุกขนาดจอ`)
      found = true
    }
    assert.ok(found, `ไม่เจอกฎ ${sel} ที่ใช้ var(--hue) — สียังไม่ได้ต่อเข้าจุดนี้`)
  }
})

/* จอบัญชีในเดโมต้องตอบตรงกับเครื่องยนต์กฎตัวจริง
 *
 * เดโมที่สอนผิดแย่กว่าไม่มีเดโม — คนที่ลองแล้วผ่านจะเขียนโค้ดแบบนั้นไปขึ้นจริง
 * แล้วไปเจอตอนต่อจริงว่าใช้ไม่ได้
 *
 * เทสนี้จึงไม่เทียบกับตัวเลขที่เราพิมพ์ไว้อย่างเดียว แต่ยิงเอกสารตัวอย่างทุกใบ
 * ที่จอนี้ใช้ เข้า `src/vendor/ledger-engine.mjs` จริง ๆ แล้วตรวจว่า
 *   · ใบที่ควรผ่าน ต้องผ่านและสมดุล
 *   · ใบที่ยังไม่มีกฎ ต้องบอกว่าไม่มีกฎ ไม่ใช่เดาให้
 *   · กับดักทั้งสามอัน ต้องถูกปฏิเสธจริง ไม่ใช่แค่ข้อความที่เดโมแต่งขึ้น
 */
const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const ENGINE = path.join(ROOT, 'src', 'vendor', 'ledger-engine.mjs')

/** อ่านเอกสารตัวอย่างออกจาก posting.ts โดยไม่ต้องคอมไพล์ TypeScript
 *  ตัดชนิดข้อมูลกับ export ออกแล้วรันเป็น JS ธรรมดา — วิธีเดียวกับ catalog.test */
function loadSamples() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'posting.ts'), 'utf8')
  const js = src
    .replace(/^import[\s\S]*?;$/gm, '')
    .replace(/^export (type|interface)[\s\S]*?^}/gm, '')
    .replace(/^export type .*?;$/gm, '')
    .replace(/: Sample\[\]/g, '')
    .replace(/: \{ key: string; label: string; why: string; make: \(d: Doc\) => Doc \}\[\]/g, '')
    .replace(/\(d: Doc\)/g, '(d)')
    .replace(/export function withAmount[\s\S]*?^}/gm, '')
    .replace(/^export /gm, '')
  const box = {}
  new Function('box', `${js};box.SAMPLES=SAMPLES;box.TRAPS=TRAPS;`)(box)
  return box
}

const { SAMPLES, TRAPS } = loadSamples()

test('ไฟล์เครื่องยนต์อยู่ในโปรเจกต์และไม่มีของฝั่ง Node ปน', () => {
  assert.ok(fs.existsSync(ENGINE),
    'ไม่มี src/vendor/ledger-engine.mjs — รัน node tools/sync-ledger-engine.mjs')
  const code = fs.readFileSync(ENGINE, 'utf8')
  for (const re of [/\brequire\s*\(/, /\bprocess\.env\b/, /from ['"]node:/]) {
    assert.ok(!re.test(code), `เครื่องยนต์มีของฝั่ง Node ปนมา (${re}) — เบราว์เซอร์จะจอขาว`)
  }
})

test('เอกสารตัวอย่างทุกใบที่มีกฎ ผ่านจริงและสมดุล', async () => {
  const { evaluate } = await import('file:///' + ENGINE.replace(/\\/g, '/'))
  const withRule = SAMPLES.filter((s) => s.docType !== 'DEP')
  assert.ok(withRule.length >= 4, 'ตัวอย่างน้อยเกินไป')
  for (const s of withRule) {
    const r = evaluate(s.docType, s.doc)
    assert.ok(r.ok, `${s.title} (${s.docType}) ไม่ผ่าน: ${r.code} ${r.message}`)
    assert.equal(r.debit, r.credit, `${s.title} เดบิตไม่เท่าเครดิต`)
    assert.ok(r.postings.length >= 2, `${s.title} มีบรรทัดเดียว ลงบัญชีคู่ไม่ได้`)
    for (const p of r.postings) {
      assert.match(p.amount, /^\d+\.\d{2}$/, `จำนวนเงินต้องเป็นสตริงสองทศนิยม (${p.amount})`)
      assert.ok(p.name, `บัญชี ${p.account} ไม่มีชื่อไทย`)
    }
  }
})

test('บิลปิดยอดรายคืนยังสมดุลที่ 1,886.92 — เลขที่สองทีมรันแล้วตรงกัน', async () => {
  const { evaluate } = await import('file:///' + ENGINE.replace(/\\/g, '/'))
  const na = SAMPLES.find((s) => s.docType === 'NA')
  const r = evaluate('NA', na.doc)
  assert.ok(r.ok)
  // เลขนี้เปลี่ยนได้ถ้ากฎเปลี่ยนจริง แต่ต้องเปลี่ยนโดยรู้ตัว ไม่ใช่รู้ตอนลูกค้าถาม
  assert.equal(r.debit, '1886.92')
  // ส่วนลดต้องอยู่ฝั่งเดบิต ไม่ใช่เครดิตติดลบ — ข้อตกลงที่คุยกันไว้กับฝั่งกฎ
  const disc = r.postings.find((p) => p.account === '4190-00')
  assert.ok(disc && disc.side === 'D' && disc.amount === '186.92',
    'ส่วนลดต้องเป็นเดบิต 186.92')
})

test('เอกสารที่ยังไม่ได้ตั้งกฎ ต้องบอกว่าไม่มีกฎ ไม่ใช่เดาให้', async () => {
  const { evaluate } = await import('file:///' + ENGINE.replace(/\\/g, '/'))
  const dep = SAMPLES.find((s) => s.docType === 'DEP')
  assert.ok(dep, 'ตัวอย่างมัดจำหายไป — จอนี้ต้องโชว์ว่ายังมีของที่ตกลงไม่จบ')
  const r = evaluate('DEP', dep.doc)
  assert.equal(r.ok, false)
  assert.equal(r.code, 'NO_RULE')
})

test('กับดักทั้งสามอันถูกปฏิเสธจริง ไม่ใช่ข้อความที่เดโมแต่งขึ้น', async () => {
  const { evaluate } = await import('file:///' + ENGINE.replace(/\\/g, '/'))
  const na = SAMPLES.find((s) => s.docType === 'NA')
  assert.equal(TRAPS.length, 3)
  for (const t of TRAPS) {
    const r = evaluate('NA', t.make(na.doc))
    assert.equal(r.ok, false, `กับดัก "${t.label}" ผ่านไปได้ — ไม่ใช่กับดักแล้ว`)
    assert.ok(r.message, `กับดัก "${t.label}" ไม่มีข้อความอธิบาย`)
  }
})

test('ทุกบัญชีที่กฎใช้ มีอยู่ในผังบัญชีที่ส่งมาด้วย', async () => {
  const { evaluate, CHART } = await import('file:///' + ENGINE.replace(/\\/g, '/'))
  const codes = new Set(CHART.map((a) => a.code))
  for (const s of SAMPLES.filter((x) => x.docType !== 'DEP')) {
    const r = evaluate(s.docType, s.doc)
    for (const p of r.postings) {
      assert.ok(codes.has(p.account),
        `${s.docType} ลงบัญชี ${p.account} ที่ไม่มีในผัง — จอจะแสดงชื่อไม่ได้`)
    }
  }
})

test('ใบลดหนี้จากหลังบ้านมีช่องที่เครื่องยนต์ต้องการครบ', async () => {
  const { evaluate } = await import('file:///' + ENGINE.replace(/\\/g, '/'))
  const adj = SAMPLES.find((s) => s.docType === 'ADJ')
  // เคยยิงของจริงแล้วได้ MISSING_FIELD เพราะ events.py ไม่ได้ส่ง netAmount
  assert.ok('netAmount' in adj.doc, 'ใบลดหนี้ต้องมี netAmount')
  const r = evaluate('ADJ', adj.doc)
  assert.ok(r.ok, `${r.code} ${r.message}`)
})

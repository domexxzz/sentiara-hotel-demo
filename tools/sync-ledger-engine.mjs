/* ดึงเครื่องยนต์กฎลงบัญชีตัวจริงจาก Ledger Bridge เข้ามาไว้ในโปรเจกต์
 *
 *     node tools/sync-ledger-engine.mjs
 *     node tools/sync-ledger-engine.mjs --from "D:/ที่อื่น/.dist/ledger-engine.mjs"
 *
 * ทำไมต้องก๊อปเข้ามา ไม่ใช่เขียนกฎเอง
 * -----------------------------------
 * จอบัญชีในเดโมเคยคิดเดบิต/เครดิตด้วยตรรกะที่เราเขียนเลียนแบบเอาเอง
 * (`src/lib/ledger.ts`) ซึ่งวันที่กฎฝั่ง Ledger Bridge เปลี่ยน เดโมจะโชว์ตัวเลข
 * คนละชุดกับของจริงโดยไม่มีใครรู้ · **เดโมที่สอนผิดแย่กว่าไม่มีเดโม**
 *
 * ไฟล์นี้จึงเป็นของที่ทีม Ledger Bridge ประกอบจากซอร์สจริงด้วย
 * `npm run build:engine` ของเขา ไม่ใช่ของที่เราเขียน · ห้ามแก้ด้วยมือ
 * กฎเปลี่ยนเมื่อไหร่ ขอไฟล์ใหม่แล้วรันสคริปต์นี้ซ้ำ
 *
 * ตรวจสี่ชั้นก่อนยอมเขียนทับ — ไฟล์ที่ import ไม่ได้จะทำให้ทั้งเดโมจอขาว
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEST = path.join(ROOT, 'src', 'vendor', 'ledger-engine.mjs')
const DEFAULT_SRC = 'C:/Users/User/OneDrive/Desktop/ac/ledger-bridge/.dist/ledger-engine.mjs'

const argAt = process.argv.indexOf('--from')
const SRC = argAt > -1 ? process.argv[argAt + 1] : DEFAULT_SRC

const die = (m) => { console.error(`\n✗ ${m}\n`); process.exit(1) }

if (!existsSync(SRC)) {
  die(`ไม่เจอไฟล์ต้นทาง: ${SRC}\n` +
      '  ขอไฟล์ใหม่จากทีม Ledger Bridge (เขาสร้างด้วย npm run build:engine)\n' +
      '  หรือชี้ที่อยู่เองด้วย --from')
}

const code = readFileSync(SRC, 'utf8')

// ── ชั้น 1 · ต้องไม่มีของฝั่ง Node ปนมา ────────────────────────────
// เบราว์เซอร์ไม่มี require/process/fs · หลุดมาบรรทัดเดียวจอขาวทั้งหน้า
const nodeish = [/\brequire\s*\(/, /\bprocess\.(env|argv|cwd)\b/, /from\s+['"]node:/, /\b__dirname\b/]
for (const re of nodeish) {
  if (re.test(code)) die(`ไฟล์มีของฝั่ง Node ปนมา (${re}) — ใช้ในเบราว์เซอร์ไม่ได้`)
}

// ── ชั้น 2 · import แล้วต้องมีสามอย่างที่จอบัญชีใช้ ─────────────────
const mod = await import(pathToFileURL(SRC).href)
for (const k of ['RULES', 'CHART', 'evaluate']) {
  if (!(k in mod)) die(`ไฟล์ไม่ได้ export ${k}`)
}
if (typeof mod.evaluate !== 'function') die('evaluate ไม่ใช่ฟังก์ชัน')
if (!Array.isArray(mod.RULES) || !mod.RULES.length) die('RULES ว่าง')
if (!Array.isArray(mod.CHART) || !mod.CHART.length) die('CHART ว่าง')

// ── ชั้น 3 · ยิง payload จริงแล้วต้องได้ตัวเลขที่ตกลงกันไว้ ────────
// 1,886.92 คือผลของบิลตัวอย่างใบเดียวกันที่สองทีมรันแล้วตรงกัน
// ถ้าเลขนี้เปลี่ยน แปลว่ากฎเปลี่ยน — ไม่ใช่เรื่องผิด แต่ต้องรู้ตัว ไม่ใช่รู้ตอนลูกค้าถาม
const NA = {
  eventId: 'NA-2026-09-13-BK-FE705B5F', docType: 'NA', businessDate: '2026-09-13',
  bookingRef: 'BK-FE705B5F', room: '108', guestName: 'คุณอนันต์ ศรีสุข', source: 'direct',
  lines: [
    { category: 'ROOM', grossAmount: '1650.00', netAmount: '1542.06' },
    { category: 'FNB', grossAmount: '130.00', netAmount: '121.50' },
    { category: 'SERVICE', grossAmount: '120.00', netAmount: '112.15' },
    { category: 'DISCOUNT', grossAmount: '200.00', netAmount: '186.92' },
  ],
  vatBase: '1588.79', vatAmount: '111.21', vatPct: 7, grandTotal: '1700.00',
}
const r = mod.evaluate('NA', NA)
if (!r.ok) die(`ยิงบิลตัวอย่างแล้วไม่ผ่าน: ${r.code} ${r.message}`)
if (r.debit !== r.credit) die(`เดบิตไม่เท่าเครดิต (${r.debit} / ${r.credit})`)
if (r.debit !== '1886.92') {
  console.warn(`\n⚠ ยอดเปลี่ยนจาก 1886.92 เป็น ${r.debit}`)
  console.warn('  ไม่ใช่เรื่องผิดถ้ากฎเปลี่ยนจริง แต่ต้องแก้เทสที่ล็อกเลขนี้ไว้ด้วย')
  console.warn('  ดู tests/posting-engine.test.cjs\n')
}

// ── ชั้น 4 · เงินต้องเป็นสตริง ตัวเลขต้องถูกปฏิเสธ ────────────────
// เดโมที่ยอมรับ 1700.0 จะสอนให้คนเขียนโค้ดแบบนั้นไปขึ้นจริง แล้วไปพังตอนต่อจริง
const numeric = mod.evaluate('NA', { ...NA, grandTotal: 1700.0 })
if (numeric.ok) die('เครื่องยนต์ยอมรับเงินที่เป็นตัวเลข — ต้องปฏิเสธ')

mkdirSync(path.dirname(DEST), { recursive: true })
copyFileSync(SRC, DEST)
const kb = (statSync(DEST).size / 1024).toFixed(1)
console.log(`✓ ${path.relative(ROOT, DEST)} · ${kb} KB`)
console.log(`  กฎ ${mod.RULES.length} ชนิด: ${mod.RULES.map((x) => x.docType).join(' ')}`)
console.log(`  ผังบัญชี ${mod.CHART.length} รหัส · บิลตัวอย่างสมดุลที่ ${r.debit}`)
console.log(`  ต้นทาง: ${SRC}`)

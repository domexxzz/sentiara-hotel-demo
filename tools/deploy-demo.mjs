/* ส่งเดโมขึ้นเว็บให้ลูกค้า
 *
 *     npx vercel login          (ครั้งเดียว · ต้องเป็นบัญชี domexxzz)
 *     node tools/deploy-demo.mjs
 *
 * ทำไมต้องมีสคริปต์ ไม่สั่ง `vercel --prod` ตรง ๆ
 * ------------------------------------------------
 * มีสองอย่างที่พลาดแล้วเสียหายและมองไม่เห็นจนลูกค้าเปิดลิงก์
 *
 * 1. **บัญชีผิด** — โปรเจกต์ sentiara-guest-demo เป็นของ domexxzz
 *    เคยมีครั้งที่ deploy จากอีกบัญชีแล้วโดน Blocked ทั้งหมดอยู่สิบชั่วโมง
 *    โดยที่ CLI ไม่ได้บอกว่าเพราะอะไร (ดู HANDOFF.md ข้อ 7.5)
 *
 * 2. **บิลด์ผิดโหมด** — สคริปต์แพ็ก .exe ตั้ง VITE_API_URL ไว้ ถ้าเผลอเอา
 *    dist ก้อนนั้นขึ้นเว็บ ลูกค้าจะได้เดโมที่พยายามต่อ 127.0.0.1 ของเครื่อง
 *    ตัวเอง แล้วพังทั้งหน้า · ค่าว่างเท่านั้นที่แปลว่า "โหมดสาธิต"
 *
 * สคริปต์นี้จึงตรวจทั้งสองข้อก่อน แล้วค่อยส่งขึ้น
 */
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OWNER = 'domexxzz'
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: true, ...opts })

const die = (msg) => { console.error(`\n✗ ${msg}\n`); process.exit(1) }

// ── 1 · บัญชีถูกตัวไหม ──────────────────────────────────────────────
let who = ''
try {
  who = run('npx', ['--yes', 'vercel@latest', 'whoami'], { stdio: ['ignore', 'pipe', 'ignore'] })
    .trim().split('\n').pop().trim()
} catch {
  die('เรียก vercel ไม่ได้ — ล็อกอินก่อนด้วย  npx vercel login')
}
console.log(`บัญชีที่ใช้อยู่: ${who}`)
if (who !== OWNER) {
  die(`ต้องเป็นบัญชี ${OWNER} เท่านั้น (ตอนนี้เป็น ${who})\n` +
      `  โปรเจกต์ sentiara-guest-demo อยู่กับบัญชีนั้น · deploy จากบัญชีอื่นจะโดน Blocked\n` +
      `  สลับด้วย:  npx vercel logout && npx vercel login`)
}

// ── 2 · บิลด์ใหม่ให้เป็นโหมดสาธิตแน่ ๆ ──────────────────────────────
console.log('\nกำลังบิลด์...')
rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true })
const env = { ...process.env }
delete env.VITE_API_URL          // ค่าว่าง = โหมดสาธิต ซึ่งคือสิ่งที่ลูกค้าควรได้
execSync('npm run build', { cwd: ROOT, env, stdio: 'inherit' })

const assets = path.join(ROOT, 'dist', 'assets')
if (!existsSync(assets)) die('บิลด์แล้วไม่เจอโฟลเดอร์ assets')
const leaked = readdirSync(assets)
  .filter((f) => f.endsWith('.js'))
  .filter((f) => /127\.0\.0\.1:8900|localhost:8900/.test(readFileSync(path.join(assets, f), 'utf8')))
if (leaked.length) {
  die(`มีที่อยู่หลังบ้านหลุดเข้าไปในบันเดิล: ${leaked.join(', ')}\n` +
      '  แปลว่า VITE_API_URL ยังถูกตั้งอยู่ที่ไหนสักแห่ง (.env หรือตัวแปรสภาพแวดล้อม)')
}
console.log('บันเดิลสะอาด — อยู่โหมดสาธิต ไม่พยายามต่อหลังบ้าน')

// ── 3 · ส่งขึ้น ─────────────────────────────────────────────────────
console.log('\nกำลังส่งขึ้น Vercel...\n')
execSync('npx --yes vercel@latest --prod', { cwd: ROOT, stdio: 'inherit' })
console.log('\n✓ เสร็จ — เปิดลิงก์เช็กว่าขึ้นของใหม่จริง แล้วกดปุ่ม “สารบัญฟังก์ชันทั้งหมด” ดู')

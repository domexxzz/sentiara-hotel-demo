/* รวมเดโมทั้งแอปเป็น HTML ไฟล์เดียว สำหรับเอาไปนำเสนอ
 *
 *     node tools/bundle-demo.mjs
 *
 * ได้ `docs/demo-standalone.html` — เปิดได้โดยไม่ต้องมีเซิร์ฟเวอร์ ไม่ต้องลง
 * อะไร ส่งไฟล์ให้ใครก็เปิดได้ และเอาขึ้นเป็นลิงก์ได้ทันทีโดยไม่ต้องรอ deploy
 *
 * ทำไมต้องรวมเป็นไฟล์เดียว
 * -------------------------
 * `npm run build` ได้ index.html ที่ไป <link> กับ <script> ไฟล์ใน /assets
 * ซึ่งแปลว่าต้องมีเซิร์ฟเวอร์หรือโฟลเดอร์ครบชุด · เปิดไฟล์เดี่ยว ๆ จะขาวเปล่า
 * ตอนยืนนำเสนอแล้วเน็ตล่ม การมีไฟล์เดียวในเครื่องคือแผนสำรองที่ใช้ได้จริง
 *
 * หมายเหตุรูปแบบไฟล์ที่ได้
 * ------------------------
 * ตัดกรอบ <!doctype>/<html>/<head>/<body> ออก เหลือแต่เนื้อใน เพราะไฟล์นี้ถูก
 * เอาไปห่อด้วยโครงของระบบเผยแพร่อีกที · ถ้าจะเปิดในเครื่องเฉย ๆ ให้ใช้
 * `--wrap` ซึ่งจะใส่กรอบให้ครบ
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const OUT = path.join(ROOT, 'docs', 'demo-standalone.html')
const WRAP = process.argv.includes('--wrap')

const die = (m) => { console.error(`\n✗ ${m}\n`); process.exit(1) }

// ── 1 · บิลด์ใหม่ให้เป็นโหมดสาธิตแน่ ๆ ──────────────────────────────
console.log('กำลังบิลด์...')
rmSync(DIST, { recursive: true, force: true })
const env = { ...process.env }
delete env.VITE_API_URL      // ค่าว่าง = โหมดสาธิต ซึ่งคือสิ่งที่คนดูควรได้
execSync('npm run build', { cwd: ROOT, env, stdio: 'inherit' })

// ── 2 · ฝังไฟล์ assets เข้าไปในหน้าเดียว ────────────────────────────
let html = readFileSync(path.join(DIST, 'index.html'), 'utf8')
const assets = path.join(DIST, 'assets')
const read = (f) => readFileSync(path.join(assets, f), 'utf8')

const css = readdirSync(assets).filter((f) => f.endsWith('.css'))
const js = readdirSync(assets).filter((f) => f.endsWith('.js'))
if (js.length !== 1) die(`คาดว่ามีไฟล์ .js ไฟล์เดียว แต่เจอ ${js.length}`)

for (const f of css) {
  const tag = new RegExp(`<link[^>]*href="[^"]*${f}"[^>]*>`)
  if (!tag.test(html)) die(`หา <link> ของ ${f} ในหน้าไม่เจอ`)
  // ใส่เป็นฟังก์ชัน ไม่ใช่สตริง — ดูเหตุผลที่ลูปของ .js ข้างล่าง
  html = html.replace(tag, () => `<style>\n${read(f)}\n</style>`)
}
for (const f of js) {
  const tag = new RegExp(`<script[^>]*src="[^"]*${f}"[^>]*></script>`)
  if (!tag.test(html)) die(`หา <script> ของ ${f} ในหน้าไม่เจอ`)
  // ถ้าในโค้ดมีข้อความ </script> อยู่ในสตริง เบราว์เซอร์จะตัดสคริปต์ตรงนั้น
  const code = read(f).replace(/<\/script/gi, '<\\/script')
  // **ต้องส่งเป็นฟังก์ชัน ไม่ใช่สตริง**
  // String.replace ตีความ $& $` $' ในสตริงแทนที่ว่าเป็นส่วนของข้อความที่แมตช์
  // โค้ดที่ย่อแล้วมีอักขระพวกนี้อยู่จริง ผลคือแท็ก <script src=...> เดิมถูกยัด
  // กลับเข้าไปกลางบันเดิล แล้วหน้าไปไล่โหลดไฟล์ที่ไม่มีอยู่
  html = html.replace(tag, () => `<script type="module">\n${code}\n</script>`)
}

if (/src="\/assets|href="\/assets/.test(html)) die('ยังเหลือไฟล์ที่ไม่ได้ฝัง')

// ชื่อบนแท็บต้องเป็นชื่อที่ลูกค้าอ่านรู้เรื่อง ไม่ใช่ชื่อที่คนทำระบบเรียกกันเอง
// เคยตั้งเป็น "Guest Prototype" แล้วหลุดไปขึ้นบนแท็บตอนนำเสนอจริง
// ตอนนี้ index.html ตั้งชื่อที่ถูกต้องไว้แล้ว ตรงนี้จึงเหลือหน้าที่แค่กันของเก่ากลับมา
const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ''
if (!title.trim()) die('หน้าไม่มี <title>')
if (/prototype|vite|react/i.test(title)) die(`ชื่อหน้ายังเป็นชื่อภายใน: "${title}"`)

// ── 3 · ตัดกรอบออก เหลือแต่เนื้อใน ──────────────────────────────────
const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? ''
const body = html.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? ''
if (!head || !body) die('อ่านโครงหน้าไม่ออก')

let out = `${head.trim()}\n\n${body.trim()}\n`
if (WRAP) {
  out = `<!doctype html>\n<html lang="th">\n<head>\n<meta charset="UTF-8">\n` +
        `<meta name="viewport" content="width=device-width, initial-scale=1.0">\n` +
        `${head.trim()}\n</head>\n<body>\n${body.trim()}\n</body>\n</html>\n`
}

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, out, 'utf8')

const mb = Buffer.byteLength(out, 'utf8') / 1024 / 1024
console.log(`\n✓ ${path.relative(ROOT, OUT)} · ${mb.toFixed(2)} MB` + (WRAP ? ' (มีกรอบ เปิดในเครื่องได้เลย)' : ''))
if (mb > 15) die('ไฟล์ใหญ่เกิน 15 MB อาจเผยแพร่ไม่ได้')
if (!existsSync(OUT)) die('เขียนไฟล์ไม่สำเร็จ')

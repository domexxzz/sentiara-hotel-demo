/* ส่งเดโมขึ้นเว็บให้ลูกค้า
 *
 *     npx vercel login          (ครั้งเดียว · ต้องเป็นบัญชี electiction)
 *     node tools/deploy-demo.mjs
 *
 * ทำไมต้องมีสคริปต์ ไม่สั่ง `vercel --prod` ตรง ๆ
 * ------------------------------------------------
 * มีสามอย่างที่พลาดแล้วเสียหายและมองไม่เห็นจนลูกค้าเปิดลิงก์
 *
 * 1. **บัญชีผิด** — เครื่องนี้เคยล็อกอินค้างสลับไปมาระหว่างสองบัญชี
 *    เคยมีครั้งที่ deploy จากอีกบัญชีแล้วโดน Blocked ทั้งหมดอยู่สิบชั่วโมง
 *    โดยที่ CLI ไม่ได้บอกว่าเพราะอะไร (ดู HANDOFF.md ข้อ 7.5)
 *
 * 2. **บิลด์ผิดโหมด** — สคริปต์แพ็ก .exe ตั้ง VITE_API_URL ไว้ ถ้าเผลอเอา
 *    dist ก้อนนั้นขึ้นเว็บ ลูกค้าจะได้เดโมที่พยายามต่อ 127.0.0.1 ของเครื่อง
 *    ตัวเอง แล้วพังทั้งหน้า · ค่าว่างเท่านั้นที่แปลว่า "โหมดสาธิต"
 *
 * 3. **การ์ดตัวอย่างชี้ผิดโดเมน** — `og:image` ต้องเป็น URL เต็ม จึงต้องเขียน
 *    โดเมนตายตัวไว้ใน index.html · วันที่ย้ายโปรเจกต์แล้วลืมแก้ ลิงก์ที่ส่ง
 *    ในไลน์จะขึ้นเป็นข้อความเปล่า ไม่มี error ไม่มีจอขาว ไม่มีใครรู้
 *    จนลูกค้าไม่กด
 *
 * ย้ายบัญชีมาเมื่อไหร่ แก้ `TARGET` ข้างล่างอย่างเดียว
 */
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** ที่อยู่ของเดโมลูกค้า — ที่เดียวที่ต้องแก้ถ้าย้ายบัญชีหรือเปลี่ยนชื่อโปรเจกต์
 *
 * เคยอยู่ที่ `sentiara-guest-demo` ของบัญชี `domexxzz` · ย้ายมาที่นี่เพราะ
 * `electiction` เข้าถึง scope ของ `domexxzz` ไม่ได้ (`vercel project ls
 * --scope domexxzz` ตอบว่า scope does not exist) — สิทธิ์ที่ให้กันไว้เป็น
 * ฝั่ง GitHub อย่างเดียว ไม่ข้ามมาฝั่ง Vercel
 */
const TARGET = {
  account: 'electiction',
  scope: 'bestimoves-projects',
  project: 'sentiara-demo',
  domain: 'https://sentiara-demo.vercel.app',
}

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
if (who !== TARGET.account) {
  die(`ต้องเป็นบัญชี ${TARGET.account} เท่านั้น (ตอนนี้เป็น ${who})\n` +
      `  โปรเจกต์ ${TARGET.project} อยู่ใน scope ${TARGET.scope} ของบัญชีนั้น\n` +
      `  สลับด้วย:  npx vercel logout && npx vercel login`)
}

// ── 2 · ผูกกับโปรเจกต์ถูกตัวไหม ─────────────────────────────────────
// ถ้า .vercel ชี้ผิดโปรเจกต์ จะไปทับเดโมของงานอื่นโดยไม่มีใครรู้
const linkFile = path.join(ROOT, '.vercel', 'project.json')
if (!existsSync(linkFile)) {
  die(`ยังไม่ได้ผูกโปรเจกต์ — รันก่อน:\n` +
      `  npx vercel link --yes --project ${TARGET.project} --scope ${TARGET.scope}`)
}
const link = JSON.parse(readFileSync(linkFile, 'utf8'))
if (link.projectName !== TARGET.project) {
  die(`.vercel ผูกอยู่กับโปรเจกต์ "${link.projectName}" ไม่ใช่ "${TARGET.project}"\n` +
      `  ผูกใหม่:  npx vercel link --yes --project ${TARGET.project} --scope ${TARGET.scope}`)
}

// ── 3 · การ์ดตัวอย่างชี้มาที่โดเมนนี้จริงไหม ─────────────────────────
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8')
const tags = [...html.matchAll(/(?:property|name)="(og:url|og:image|twitter:image)"\s+content="([^"]+)"/g)]
if (tags.length < 3) die('index.html ไม่มีแท็กการ์ดตัวอย่างครบ — ลิงก์ในไลน์จะขึ้นเป็นข้อความเปล่า')
for (const [, tag, url] of tags) {
  if (!url.startsWith(TARGET.domain)) {
    die(`${tag} ชี้ไปที่ ${url}\n` +
        `  แต่จะ deploy ขึ้น ${TARGET.domain}\n` +
        `  แก้ index.html ให้ตรงกันก่อน ไม่งั้นการ์ดในไลน์จะขึ้นรูปไม่ออก`)
  }
}
if (!existsSync(path.join(ROOT, 'public', 'og-cover.jpg'))) {
  die('ไม่มี public/og-cover.jpg — og:image จะ 404')
}
console.log('การ์ดตัวอย่างชี้ถูกโดเมน')

// ── 4 · บิลด์ใหม่ให้เป็นโหมดสาธิตแน่ ๆ ──────────────────────────────
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

// ── 5 · ส่งขึ้นแบบบิลด์เสร็จแล้ว ไม่ให้ Vercel บิลด์เอง ──────────────
//
// **ห้ามเปลี่ยนกลับไปใช้ `vercel --prod` เฉย ๆ**
//
// ปล่อยให้ Vercel บิลด์เองแล้ว deployment ค้างที่สถานะ UNKNOWN ไม่มี build log
// สักบรรทัด ไม่มี error ไม่มี timeout — CLI ขึ้น "Building…" แล้วค้างยาว
// ลองสามครั้งได้ผลเหมือนกันหมด (ครั้งแรกครั้งเดียวที่ผ่าน 18 วินาที)
// ส่วนของที่บิลด์มาแล้วขึ้นได้ทันทีทุกครั้ง
//
// ท่านี้ยังปลอดภัยกว่าด้วย เพราะบันเดิลที่ลูกค้าได้คือก้อนเดียวกับที่ข้อ 4
// เพิ่งตรวจว่าสะอาด ไม่ใช่ก้อนใหม่ที่เซิร์ฟเวอร์บิลด์ด้วยตัวแปรที่เรามองไม่เห็น
console.log('\nกำลังเตรียมก้อนที่จะส่ง...')
execSync('npx --yes vercel@latest build --prod --yes', { cwd: ROOT, stdio: 'inherit', env })

const built = path.join(ROOT, '.vercel', 'output', 'static', 'index.html')
if (!existsSync(built)) die('vercel build ไม่ได้สร้าง .vercel/output/static/index.html')
if (!readFileSync(built, 'utf8').includes(`${TARGET.domain}/og-cover.jpg`)) {
  die('ก้อนที่จะส่งมี og:image ชี้ไปโดเมนอื่น — หยุดก่อนส่ง')
}

console.log('\nกำลังส่งขึ้น Vercel...\n')
execSync(`npx --yes vercel@latest deploy --prebuilt --prod --yes --scope ${TARGET.scope}`, {
  cwd: ROOT, stdio: 'inherit',
})

// ── 6 · เปิดลิงก์จริงดูว่าขึ้นของใหม่ ───────────────────────────────
// `vercel` ตอบว่าสำเร็จตั้งแต่ deployment พร้อม แต่ยังไม่ได้แปลว่าโดเมน
// production ชี้มาที่ก้อนใหม่แล้ว · ต้องยิงโดเมนจริงถึงจะรู้
console.log('\nกำลังตรวจโดเมนจริง...')

// ยิงด้วย fetch ของ Node ไม่ใช่ curl — execSync บนวินโดวส์วิ่งผ่าน cmd.exe
// ซึ่งไม่รู้จัก /dev/null แล้ว curl คืน exit 23 ทั้งที่ได้ 200 มาแล้ว
// สคริปต์เลยล้มตอนตรวจ ทั้งที่ deploy สำเร็จไปแล้ว
const get = async (url) => {
  const r = await fetch(url, { redirect: 'follow' })
  return { code: r.status, body: r.ok ? await r.text() : '' }
}

for (const url of [TARGET.domain + '/', TARGET.domain + '/og-cover.jpg']) {
  const { code } = await get(url)
  console.log(`  ${url} → ${code}`)
  if (code !== 200) die(`${url} ตอบ ${code} ไม่ใช่ 200`)
}

// ── 7 · ของที่ขึ้นไปจริง ไม่ใช่ของที่บิลด์ในเครื่อง ─────────────────
// ข้อ 4 ตรวจก้อนในเครื่อง · ข้อนี้ตรวจก้อนที่ลูกค้าจะได้จริง ๆ
// ถึงจะส่งแบบ prebuilt แล้วก็ยังต้องตรวจ เพราะวันหนึ่งอาจมีใครกด redeploy
// จากหน้าเว็บ Vercel ซึ่งจะบิลด์ใหม่ด้วยตัวแปรฝั่งเซิร์ฟเวอร์ที่เรามองไม่เห็น
const { body: live } = await get(TARGET.domain + '/')
const jsFile = live.match(/src="(\/assets\/[^"]+\.js)"/)?.[1]
if (!jsFile) die('หน้าที่ขึ้นไปไม่มีแท็ก <script> ของบันเดิล')
if (!live.includes(`${TARGET.domain}/og-cover.jpg`)) {
  die('หน้าที่ขึ้นไปไม่มี og:image ชี้มาที่โดเมนนี้ — การ์ดในไลน์จะขึ้นรูปไม่ออก')
}
const { body: liveJs } = await get(TARGET.domain + jsFile)
if (/127\.0\.0\.1:8900|localhost:8900/.test(liveJs)) {
  die(`บันเดิลที่ขึ้นไปแล้วมีที่อยู่หลังบ้านอยู่ (${jsFile})\n` +
      `  ไปลบตัวแปร VITE_API_URL ออกจากหน้าตั้งค่าโปรเจกต์:\n` +
      `  npx vercel env rm VITE_API_URL --scope ${TARGET.scope}`)
}
console.log('  บันเดิลที่ขึ้นไปแล้วสะอาด และการ์ดตัวอย่างชี้ถูกโดเมน')

console.log(`\n✓ เสร็จ — ${TARGET.domain}`)
console.log('  เปิดลิงก์แล้วกดปุ่ม “สารบัญฟังก์ชันทั้งหมด” ดูว่าเป็นของใหม่จริง')

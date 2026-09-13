/* สารบัญฟังก์ชันเป็น "สัญญา" ระหว่างหน้านำเสนอกับตัวเดโม
 *
 * หน้านำเสนอโฆษณา 83 ฟังก์ชัน · สารบัญต้องพาไปถึงจอจริงได้ทุกอัน
 * ถ้าใครเพิ่มฟังก์ชันในหน้านำเสนอแล้วลืมใส่ในสารบัญ หรือใส่ชื่อแท็บที่
 * ไม่มีอยู่จริง เทสกลุ่มนี้ต้องพังก่อนลูกค้าจะกดแล้วเจอจอว่าง
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function load(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(() => ({}), mod, mod.exports);
  return mod.exports;
}

/** ชื่อแท็บที่มีอยู่จริง อ่านจากไฟล์ store โดยตรง ไม่ใช่คัดลอกมาวางไว้
 *  ถ้าใครลบแท็บทิ้ง เทสนี้ต้องรู้เอง */
function unionOf(file, typeName) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const m = new RegExp(`export type ${typeName} =([^;]+);`).exec(src);
  assert.ok(m, `หา type ${typeName} ใน ${file} ไม่เจอ`);
  return new Set([...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]));
}

const { CATALOG, WALK, ALL_SPOTS, TOTAL } = load('src/tour/catalog.ts');

const FLOWS = new Set(['guest', 'desk', 'staff', 'owner', 'pos']);
const OWNER = unionOf('src/owner/ownerStore.tsx', 'OwnerTab');
const DESK = unionOf('src/desk/deskStore.tsx', 'DeskView');
const POS = unionOf('src/pos/posStore.tsx', 'PosView');
const STAFF = unionOf('src/staff/staffStore.tsx', 'StaffView');
const ROLE = unionOf('src/staff/staffStore.tsx', 'Role');

test('สารบัญครอบคลุมครบ 14 กลุ่ม 83 ฟังก์ชัน เท่าที่หน้านำเสนอโฆษณาไว้', () => {
  assert.equal(CATALOG.length, 14);
  assert.equal(TOTAL, 83);
  assert.equal(ALL_SPOTS.length, 83);
});

test('ทุกรายการชี้ไปยังมุมมองที่มีอยู่จริง', () => {
  for (const s of ALL_SPOTS) {
    assert.ok(FLOWS.has(s.flow), `${s.en}: มุมมอง "${s.flow}" ไม่มีอยู่จริง`);
  }
});

test('ทุกแท็บย่อยที่อ้างถึง มีอยู่จริงใน store ของแอปนั้น', () => {
  const table = { owner: OWNER, desk: DESK, pos: POS, staff: STAFF };
  for (const s of ALL_SPOTS) {
    for (const [key, valid] of Object.entries(table)) {
      if (s[key] === undefined) continue;
      assert.ok(valid.has(s[key]), `${s.en}: ${key} "${s[key]}" ไม่มีใน store`);
      assert.equal(s.flow, key, `${s.en}: ระบุแท็บ ${key} แต่มุมมองเป็น ${s.flow}`);
    }
    if (s.role !== undefined) assert.ok(ROLE.has(s.role), `${s.en}: บทบาท "${s.role}" ไม่มีจริง`);
  }
});

test('ทุกรายการมีคำบอกว่าไปถึงแล้วกดอะไรต่อ', () => {
  // ไม่มีคำใบ้ = พาลูกค้าไปยืนกลางจอแล้วปล่อยทิ้ง ซึ่งแย่กว่าไม่พาไป
  const silent = ALL_SPOTS.filter((s) => !s.hint || s.hint.trim().length < 8);
  assert.deepEqual(silent.map((s) => s.en), []);
});

test('รายการที่ยังไม่มีจอเฉพาะ ต้องบอกตรง ๆ ไม่ใช่พาไปเงียบ ๆ', () => {
  // AGENTS.md ข้อ 7 — หน้านำเสนอพูดถึงทุกฟังก์ชันเป็นความสามารถได้
  // แต่ตัวซอฟต์แวร์ห้ามพาลูกค้าไปที่ที่ไม่มีอะไรโดยไม่บอก
  for (const s of ALL_SPOTS.filter((x) => x.soon)) {
    assert.match(s.hint, /ยังไม่ได้ทำ|ยังไม่มีจอ|หน้านำเสนอ/, `${s.en}: ติดธง soon แต่คำใบ้ไม่ได้บอกว่ายังไม่มีจอ`);
  }
});

test('ไม่มีฟังก์ชันชื่อซ้ำกันในกลุ่มเดียวกัน', () => {
  for (const g of CATALOG) {
    const seen = new Set();
    for (const s of g.spots) {
      const key = `${s.en}|${s.th}`;
      assert.ok(!seen.has(key), `กลุ่ม ${g.n}: "${s.en}" ซ้ำ`);
      seen.add(key);
    }
  }
});

test('เส้นทางเดินให้ดูหนึ่งรอบ ผ่านครบทั้งห้ามุมมอง', () => {
  const touched = new Set(WALK.map((w) => w.go.flow));
  assert.deepEqual([...FLOWS].filter((f) => !touched.has(f)), [],
    'เดินหนึ่งรอบแล้วต้องได้เห็นทุกมุมมอง ไม่งั้นพิสูจน์ไม่ได้ว่าข้อมูลเชื่อมกัน');
  assert.ok(WALK.length >= 8);
  for (const w of WALK) assert.ok(w.title && w.body && w.go, 'ขั้นตอนต้องมีหัวข้อ คำอธิบาย และปลายทาง');
});

/* กติกา Wi-Fi ฝั่งเดโมต้องตรงกับหลังบ้านจริง (server/pms/wifi.py)
 *
 * ถ้าสองฝั่งหลุดจากกัน ลูกค้าที่กดเล่นตอนตัดสินใจซื้อ จะได้ของคนละอย่างกับ
 * ที่ติดตั้งจริง — และจะรู้ตัวตอนใช้งานไปแล้ว
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

const W = load('src/lib/wifi.ts');
const fresh = () => structuredClone(W.DEMO);

/** ค่าคงที่ฝั่ง Python — อ่านจากไฟล์จริง ไม่ได้พิมพ์ตัวเลขซ้ำไว้ที่นี่
 *  ถ้าใครแก้ฝั่งหลังบ้านแล้วลืมแก้ฝั่งเดโม เทสนี้ต้องพังทันที */
function pyConst(name) {
  const src = fs.readFileSync(path.join(root, 'server/pms/wifi.py'), 'utf8');
  const m = new RegExp(`^${name} = (.+)$`, 'm').exec(src);
  assert.ok(m, `หา ${name} ใน server/pms/wifi.py ไม่เจอ`);
  return m[1].trim();
}

test('ตัวเลขกติกาตรงกับหลังบ้านทุกตัว', () => {
  assert.equal(W.GRACE_HOURS, Number(pyConst('GRACE_HOURS')));
  assert.equal(W.DEVICE_LIMIT, Number(pyConst('DEFAULT_DEVICE_LIMIT')));
  assert.equal(W.MIN_RETENTION_DAYS, Number(pyConst('MIN_RETENTION_DAYS')));
  assert.equal(`"${W.ALPHABET}"`, pyConst('_ALPHABET'));
});

test('รหัสที่ออกมาไม่มีตัวอักษรที่อ่านสับสน', () => {
  // i l o s z 0 1 5 ถูกตัดออกโดยตั้งใจ — อ่านผิดแล้วแขกโทรหาเคาน์เตอร์
  for (const bad of 'ilosz015') assert.ok(!W.ALPHABET.includes(bad), `${bad} ไม่ควรอยู่ในชุด`);
  for (let i = 0; i < 40; i++) {
    const s = W.makeSecret();
    assert.equal(s.length, 6);
    for (const ch of s) assert.ok(W.ALPHABET.includes(ch), `${s} มีตัวนอกชุด`);
  }
});

test('รหัสถูกต้องและยังไม่หมดอายุ ต่อได้', () => {
  const r = W.authorize(fresh(), { room: '402', secret: 'kq7n3x', mac: '9c:2f:4e:11:07:b3' });
  assert.equal(r.ok, true);
  assert.equal(r.room, '402');
  assert.equal(r.ref, 'BK-6F2A91');
});

test('รหัสผิด ห้องไม่มีจริง และหมดอายุ ตอบข้อความเดียวกันหมด', () => {
  // ใครยืนที่ล็อบบี้แล้วสุ่มเลขห้อง ต้องไม่ได้ข้อมูลว่าห้องไหนมีแขกอยู่จริง
  const s = fresh();
  const wrong = W.authorize(s, { room: '402', secret: 'zzzzzz', mac: 'aa:bb:cc:dd:ee:ff' });
  const nobody = W.authorize(s, { room: '999', secret: 'kq7n3x', mac: 'aa:bb:cc:dd:ee:ff' });
  const expired = W.authorize(s, { room: '508', secret: 't6bmxy', mac: 'aa:bb:cc:dd:ee:ff' });
  const revoked = W.authorize(s, { room: '305', secret: 'j9pr4d', mac: 'aa:bb:cc:dd:ee:ff' });
  for (const r of [wrong, nobody, expired, revoked]) assert.equal(r.ok, false);
  assert.equal(new Set([wrong, nobody, expired, revoked].map((r) => r.reason)).size, 1);
});

test('เครื่องเกินโควตาถูกปฏิเสธ แต่เครื่องเดิมกลับมาต่อใหม่ไม่นับเพิ่ม', () => {
  const s = fresh();
  // ห้อง 402 มีสองเครื่องต่ออยู่ · เครื่องที่สามยังได้
  assert.equal(W.authorize(s, { room: '402', secret: 'kq7n3x', mac: '11:11:11:11:11:11' }).ok, true);

  s.sessions.push({ id: 't', room: '402', mac: '11:11:11:11:11:11', ip: '10.24.7.120',
    nas: 'AP', startedAt: W.NOW, endedAt: null, mb: 0 });
  const fourth = W.authorize(s, { room: '402', secret: 'kq7n3x', mac: '22:22:22:22:22:22' });
  assert.equal(fourth.ok, false);
  assert.match(fourth.reason, /ต่อได้ 3 เครื่อง/);

  // เครื่องที่ต่ออยู่แล้วขอต่อใหม่ ต้องผ่าน ไม่ใช่โดนนับเป็นเครื่องที่สี่
  assert.equal(W.authorize(s, { room: '402', secret: 'kq7n3x', mac: '11-11-11-11-11-11' }).ok, true);
});

test('อุปกรณ์ที่ไม่ส่ง MAC มา ต่อไม่ได้', () => {
  // ไม่มี MAC = โยง session กลับไปหาคนไม่ได้ = เก็บไปก็ตอบเจ้าหน้าที่ไม่ได้
  const r = W.authorize(fresh(), { room: '402', secret: 'kq7n3x', mac: '' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /MAC/);
});

test('รายงานตัวตนคืนผู้พักทุกคนในห้อง ไม่ใช่คนแรกคนเดียว', () => {
  // รหัสผูกกับห้อง · ห้องที่มีผู้ใหญ่สองคนต้องตอบได้ทั้งคู่ (ม.35 พ.ร.บ.โรงแรม)
  const id = W.identityOf(fresh(), 's1');
  assert.equal(id.occupants.length, 2);
  assert.ok(id.occupants.every((o) => o.doc));
});

test('แขกที่เช็กเอาต์ไปเดือนกว่าแล้ว ยังตอบเจ้าหน้าที่ได้', () => {
  // นี่คือเหตุผลทั้งหมดของการเก็บ 90 วัน
  const id = W.identityOf(fresh(), 's5');
  assert.ok(id.daysKept > 30);
  assert.equal(id.withinRetention, true);
  assert.equal(id.occupants[0].doc, 'พาสปอร์ต E48127395');
});

test('ตั้งเวลาเก็บต่ำกว่าที่กฎหมายกำหนดไม่ได้', () => {
  assert.equal(W.setRetention(90).ok, true);
  assert.equal(W.setRetention(365).ok, true);
  for (const bad of [89, 30, 0, -1, NaN]) {
    const r = W.setRetention(bad);
    assert.equal(r.ok, false, `${bad} ไม่ควรผ่าน`);
    assert.match(r.reason, /90 วัน/);
  }
});

test('หมดอายุ = เวลาเช็กเอาต์ บวกผ่อนผัน', () => {
  const out = '2026-08-16T15:00:00+07:00';
  const gap = (new Date(W.expiryOf(out)) - new Date(out)) / 3_600_000;
  assert.equal(gap, W.GRACE_HOURS);
});

test('ข้อมูลตัวอย่างสมเหตุสมผล — ทุก session มีห้องที่ออกรหัสไว้จริง', () => {
  const s = fresh();
  const rooms = new Set(s.creds.map((c) => c.room));
  for (const x of s.sessions) assert.ok(rooms.has(x.room), `session ${x.id} อ้างห้อง ${x.room} ที่ไม่มีรหัส`);
  for (const c of s.creds) assert.ok(s.occupants[c.ref]?.length, `การจอง ${c.ref} ไม่มีทะเบียนผู้พัก`);
});

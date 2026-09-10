// ใช้ compiler ที่โปรเจกต์มีอยู่แล้ว เพื่อทดสอบสัญญาหน้าจอ/API โดยไม่เพิ่มแพ็กเกจ
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(file, mocks, extra = '') {
  const source = fs.readFileSync(path.join(root, file), 'utf8') + extra;
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  }, fileName: file }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)((id) => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}

class ApiError extends Error {}
const stay = { ref: 'B-real', room: '101', guest: 'Guest', status: 'inhouse',
  check_in: '2026-09-08', check_out: '2026-09-10', nights: 2,
  deposit: 900, source: 'direct', folio: { gross: 2000, paid: 500, balance: 1500 } };
const room = { no: '101', type: 'Deluxe', rate: 1000, out_of_order: false,
  housekeeping: 'clean', sellable: true };
const localStay = { id: stay.ref, room: stay.room, status: stay.status };
function fixture(overrides = {}) {
  const calls = [];
  const api = {
    rooms: async () => ({ rooms: [room] }),
    bookings: async (query) => ({ bookings: query.status ? [stay] : [] }),
    folio: async () => ({ charges: [
      { kind: 'room', label: 'Room', qty: 2, unit: 1000 },
      { kind: 'discount', label: 'Discount', qty: 1, unit: 100 },
    ], totals: { gross: 1900, paid: 500, balance: 1400 } }),
    addCharge: async (...args) => { calls.push(['charge', ...args]); },
    addPayment: async (...args) => { calls.push(['payment', ...args]); },
    closeFolio: async (...args) => { calls.push(['close', ...args]); },
    ...overrides,
  };
  const sync = load('src/hotel/sync.ts', {
    '../lib/api': { api, ApiError }, '../lib/date': { TODAY: '2026-09-10' },
  });
  return { ...sync, api, calls };
}

test('ห้องสกปรก/กำลังทำ/รอตรวจ ไม่กลายเป็นพร้อมขาย แม้มีแขกจะมาถึง', () => {
  const { toRooms } = fixture();
  for (const housekeeping of ['dirty', 'cleaning', 'inspect']) {
    const result = toRooms([{ ...room, housekeeping, sellable: false }],
      [{ ...stay, status: 'confirmed' }], '2026-09-10');
    assert.equal(result[0].status, 'dirty');
  }
  assert.equal(toRooms([room], [], '2026-09-10')[0].status, 'ready');
  assert.equal(toRooms([{ ...room, housekeeping: 'dirty', sellable: false }], [stay], '2026-09-10')[0].status, 'occupied');
  assert.equal(toRooms([{ ...room, out_of_order: true }], [stay], '2026-09-10')[0].status, 'ooo');
});

test('แขกครบวันเช็กเอาต์แล้วยังอยู่ ไม่หายไป และส่วนลดลดบิลจริง', async () => {
  const snapshot = await fixture().pull();
  assert.equal(snapshot.rooms[0].status, 'occupied');
  assert.equal(snapshot.bookings[0].paid, 500);
  assert.equal(snapshot.bills['101'].reduce((n, l) => n + l.qty * l.price, 0), 1900);
});

test('ข้อมูลแขกจากสอง query ไม่ซ้ำกัน', async () => {
  const { pull } = fixture({ bookings: async () => ({ bookings: [stay] }) });
  assert.equal((await pull()).bookings.length, 1);
});

test('โหลดบิลล้มเหลวต้องแจ้งปัญหา ไม่แทนบิลจริงด้วยบิลว่าง', async () => {
  const { pull } = fixture({ folio: async () => { throw new Error('offline'); } });
  await assert.rejects(pull(), /offline/);
});

test('POS ส่งค่าอาหารเข้า ref ของการเข้าพักจริงจากเลขห้อง', async () => {
  const { push, calls } = fixture();
  assert.equal(await push({ type: 'ADD_CHARGE', room: '101',
    line: { label: 'Food', kind: 'fnb', price: 75, qty: 2 } }, [localStay]), true);
  assert.deepEqual(calls, [['charge', 'B-real', { kind: 'fnb', label: 'Food', amount: 75, qty: 2 }]]);
});

test('หาห้องไม่พบหรือมีการเข้าพักซ้ำ ต้องไม่เงียบไปทำเฉพาะในเครื่อง', async () => {
  for (const bookings of [[], [localStay, { ...localStay, id: 'other' }]]) {
    const { push, calls } = fixture();
    await assert.rejects(push({ type: 'CHECK_OUT', room: '101' }, bookings), ApiError);
    assert.equal(calls.length, 0);
  }
});

test('ปิดบิลได้หลังรับครบเท่านั้น และส่ง ref ถูกใบ', async () => {
  const blocked = fixture();
  await assert.rejects(blocked.push({ type: 'CHECK_OUT', room: '101' }, [localStay]), ApiError);
  assert.equal(blocked.calls.length, 0);
  const ready = fixture({ folio: async () => ({ totals: { balance: 0 } }) });
  assert.equal(await ready.push({ type: 'CHECK_OUT', room: '101' }, [localStay]), true);
  assert.deepEqual(ready.calls, [['close', 'B-real']]);
});

test('การรับเงินบันทึกวิธีและยอดจริง แต่ปฏิเสธยอดเก่าหรือชำระซ้ำ', async () => {
  const { push, calls } = fixture();
  await push({ type: 'ADD_PAYMENT', room: '101', amount: 1400, method: 'card' }, [localStay]);
  assert.deepEqual(calls, [['payment', 'B-real', { amount: 1400, method: 'card' }]]);
  const paid = fixture({ folio: async () => ({ totals: { balance: 0 } }) });
  await assert.rejects(paid.push({ type: 'ADD_PAYMENT', room: '101', amount: 1400, method: 'card' }, [localStay]), ApiError);
  assert.equal(paid.calls.length, 0);
});

test('API ปฏิเสธค่าอาหาร ต้องส่งข้อผิดพลาดกลับไปให้หน้าจอรอแก้', async () => {
  const { push } = fixture({ addCharge: async () => { throw new Error('forbidden'); } });
  await assert.rejects(push({ type: 'ADD_CHARGE', room: '101',
    line: { label: 'Food', kind: 'fnb', price: 75 } }, [localStay]), /forbidden/);
});

test('POS สำเร็จบางรายการแล้วลองใหม่ ต้องไม่ลงรายการเดิมซ้ำ', () => {
  const menu = [{ id: 'a', price: 100 }, { id: 'b', price: 200 }];
  const { reducer } = load('src/pos/posStore.tsx', {
    react: { createContext: () => ({}) }, 'react/jsx-runtime': {},
    './posData': { MENU: menu, STOCK: [] },
  }, '\nexport { reducer };');
  const state = { cart: [{ menuId: 'a', qty: 2 }, { menuId: 'b', qty: 1 }],
    targetId: 'r101', targets: [{ id: 'r101', room: '101', label: 'Room 101' }],
    tickets: [], tabs: {} };
  const partial = reducer(state, { type: 'SEND', lines: [{ menuId: 'a', qty: 2 }], targetId: 'r101' });
  assert.deepEqual(partial.cart, [{ menuId: 'b', qty: 1 }]);
  assert.equal(partial.view, 'order');
  const done = reducer(partial, { type: 'SEND' });
  assert.equal(done.cart.length, 0);
  assert.equal(done.tickets.reduce((n, t) => n + t.total, 0), 400);
});

function checkoutFixture(dispatch, amountPaid = 2000) {
  const deskActions = [];
  const jsx = (type, props) => ({ type, props });
  const component = load('src/desk/CheckOut.tsx', {
    react: { useState: (initial) => [initial, () => {}], useRef: (value) => ({ current: value }) },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    './deskStore': { useDesk: () => ({ state: { closingRoom: '101' }, dispatch: (a) => deskActions.push(a) }) },
    '../hotel/hotelStore': { useHotel: () => ({ live: true, syncing: false,
      state: { bookings: [{ ...localStay, paid: amountPaid, balance: 2000 - amountPaid }], rooms: [] },
      inHouse: [localStay], billOf: () => [{ id: 'line', label: 'Room', price: 2000, qty: 1 }],
      billTotal: () => 2000, dispatch }) },
    '../lib/format': { money: (v) => String(v) },
    '../components/Icon': { Icon: 'icon' }, '../components/QrCode': { QrCode: 'qr' },
  });
  const nodes = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    nodes.push(node);
    walk(node.props?.children);
  };
  walk(component.CheckOut());
  const text = (n) => typeof n === 'string' ? n : Array.isArray(n)
    ? n.map(text).join('') : n?.props ? text(n.props.children) : '';
  return { deskActions, button: (label) => nodes.find((n) => n.type === 'button' && text(n).includes(label)) };
}

test('ตัวตน live ใช้ผู้ใช้เซิร์ฟเวอร์ ไม่มีบัตรเดโมให้เปลี่ยนสิทธิ์ และออกผ่าน API', () => {
  let logout = 0;
  const jsx = (type, props) => ({ type, props });
  const backend = { mode: 'live', session: { name: 'Actual Front', title: 'Front desk' },
    signOut: () => { logout++; } };
  const mocks = {
    react: { useState: () => [false, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '../hotel/hotelStore': { useHotel: () => ({ session: { name: 'Demo Owner' } }) },
    '../lib/backend': { useBackend: () => backend },
    '../lib/roles': { ROLE_LABEL: {} }, '../lib/property': { PROPERTY: {} },
    './Icon': { Icon: 'icon' },
  };
  const { Identity } = load('src/components/Identity.tsx', mocks);
  const tree = Identity();
  const serialized = JSON.stringify(tree);
  assert.match(serialized, /Actual Front/);
  assert.doesNotMatch(serialized, /Demo Owner|idcards|idmode/);
  tree.props.children[1].props.onClick();
  assert.equal(logout, 1);
  backend.mode = 'locked';
  backend.session = null;
  assert.equal(Identity(), null);
});

test('สิทธิ์ทุกบทบาทบนหน้าจอตรงกับขอบเขตที่กำหนด', () => {
  const roles = load('src/lib/roles.ts', {});
  const expected = {
    owner: { flows: ['guest', 'desk', 'staff', 'owner', 'pos'], owner: true, pos: true },
    manager: { flows: ['guest', 'desk', 'staff', 'owner', 'pos'], owner: true, pos: true },
    front: { flows: ['guest', 'desk'], owner: false, pos: false },
    hk: { flows: ['staff'], owner: false, pos: false },
    tech: { flows: ['staff'], owner: false, pos: false },
    pos: { flows: ['pos'], owner: false, pos: true },
  };
  for (const [role, rule] of Object.entries(expected)) {
    for (const flow of ['guest', 'desk', 'staff', 'owner', 'pos']) {
      assert.equal(roles.canOpen(role, flow), rule.flows.includes(flow), `${role}/${flow}`);
    }
    assert.equal(roles.canOpenOwnerTab(role, 'overview'), rule.owner, `${role}/owner overview`);
    assert.equal(roles.canOpenOwnerTab(role, 'settings'), rule.owner, `${role}/owner settings`);
    assert.equal(roles.canOpenDesk(role, 'invoice'), role === 'owner' || role === 'manager' || role === 'front');
    assert.equal(roles.canOpenDesk(role, 'register'), role === 'owner' || role === 'manager' || role === 'front');
  }
});

test('ปุ่มเช็กเอาต์รอ API ยืนยันก่อนแจ้งสำเร็จ และกันกดซ้ำระหว่างรอ', async () => {
  let resolve;
  let calls = 0;
  const pending = new Promise((r) => { resolve = r; });
  const ui = checkoutFixture(async () => { calls++; return pending; });
  const button = ui.button('ปิดบิล · คืนห้อง');
  const waiting = button.props.onClick();
  await button.props.onClick();
  assert.equal(calls, 1);
  assert.deepEqual(ui.deskActions, []);
  resolve(true);
  await waiting;
  assert.deepEqual(ui.deskActions.map((a) => a.type), ['TOAST', 'DONE']);
});

test('ปิดบิลล้มเหลวต้องอยู่หน้าเดิม ไม่มีข้อความสำเร็จ', async () => {
  const ui = checkoutFixture(async () => false);
  await ui.button('ปิดบิล · คืนห้อง').props.onClick();
  assert.deepEqual(ui.deskActions, []);
});

test('ปุ่มเงินสดใช้ยอดรับชำระจริง ไม่เอายอดมัดจำที่กำหนดมาแทนเงินรับแล้ว', async () => {
  const actions = [];
  const ui = checkoutFixture(async (a) => { actions.push(a); return true; }, 500);
  ui.button('รับเป็นเงินสด').props.onClick();
  assert.deepEqual(actions, [{ type: 'ADD_PAYMENT', room: '101', amount: 1500, method: 'cash' }]);
  assert.equal(ui.button('ปิดบิล · คืนห้อง').props.disabled, true);
});

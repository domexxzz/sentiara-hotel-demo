/*
 * ledger-engine.mjs — เครื่องยนต์กฎลงบัญชีของ Ledger Bridge
 *
 * ไฟล์นี้ถูกสร้างด้วย scripts/build-browser-engine.mjs
 * ห้ามแก้ด้วยมือ — แก้แล้วจะหายตอนประกอบรอบหน้า และจะเพี้ยนจากของจริง
 *
 * ถ้าต้องการให้กฎเปลี่ยน ให้แก้ที่ packages/posting/src/rules/
 * แล้วขอไฟล์ใหม่จากทีม Ledger Bridge
 */

// packages/ledger/src/money.ts
var UNIT = 100n;
var PARSE_RE = /^[+-]?\d{1,15}(\.\d{1,2})?$/;
function divHalfUp(a2, b) {
  if (b <= 0n) throw new RangeError("\u0E15\u0E31\u0E27\u0E2B\u0E32\u0E23\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32\u0E28\u0E39\u0E19\u0E22\u0E4C");
  const q = a2 / b;
  const r = a2 % b;
  const twice = r < 0n ? -r * 2n : r * 2n;
  if (twice >= b) return a2 < 0n ? q - 1n : q + 1n;
  return q;
}
var Money = class _Money {
  /** จำนวนสตางค์ — ค่าจริงเพียงค่าเดียวที่เก็บไว้ */
  satang;
  // ประกาศฟิลด์แยกจากพารามิเตอร์ เพราะ parameter property ของ TypeScript
  // สร้างโค้ดจริง จึงใช้กับโหมด strip-types ของ Node ไม่ได้
  constructor(satang) {
    this.satang = satang;
    Object.freeze(this);
  }
  static ZERO = new _Money(0n);
  /** สร้างจากสตริง เช่น '21608.65' · รับคอมมาได้ · ทศนิยมเกิน 2 ตำแหน่งจะโยน error */
  static of(v) {
    if (v instanceof _Money) return v;
    if (typeof v === "bigint") return new _Money(v * UNIT);
    const s = String(v).trim().replace(/,/g, "");
    if (!PARSE_RE.test(s)) {
      throw new TypeError(
        `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E07\u0E34\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: ${JSON.stringify(v)} (\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E17\u0E28\u0E19\u0E34\u0E22\u0E21\u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E19 2 \u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07 \u2014 \u0E16\u0E49\u0E32\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E1B\u0E31\u0E14\u0E40\u0E28\u0E29 \u0E43\u0E2B\u0E49\u0E40\u0E23\u0E35\u0E22\u0E01 Money.round \u0E01\u0E48\u0E2D\u0E19)`
      );
    }
    const neg = s.startsWith("-");
    const body = s.replace(/^[+-]/, "");
    const [int, frac = ""] = body.split(".");
    const satang = BigInt(int) * UNIT + BigInt(frac.padEnd(2, "0"));
    return new _Money(neg ? -satang : satang);
  }
  /** สร้างจากจำนวนสตางค์ตรง ๆ — ใช้ภายในโมดูลและตอนอ่านจากฐานข้อมูล */
  static fromSatang(n) {
    return new _Money(n);
  }
  /**
   * ปัดค่าที่มีทศนิยมเกิน 2 ตำแหน่งให้เป็นจำนวนเงิน (ปัดครึ่งออกจากศูนย์)
   * นี่คือจุดเดียวในระบบที่ยอมให้เกิดการปัดเศษจากสตริงดิบ
   */
  static round(v) {
    const s = String(v).trim().replace(/,/g, "");
    if (!/^[+-]?\d+(\.\d+)?$/.test(s)) {
      throw new TypeError(`\u0E1B\u0E31\u0E14\u0E40\u0E28\u0E29\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49: ${JSON.stringify(v)}`);
    }
    const neg = s.startsWith("-");
    const body = s.replace(/^[+-]/, "");
    const [int, frac = ""] = body.split(".");
    const scaled = BigInt(int + frac.padEnd(2, "0"));
    const divisor = 10n ** BigInt(Math.max(0, frac.length - 2));
    const satang = divHalfUp(scaled, divisor);
    return new _Money(neg ? -satang : satang);
  }
  static sum(xs) {
    let t = 0n;
    for (const m of xs) t += m.satang;
    return new _Money(t);
  }
  add(o) {
    return new _Money(this.satang + o.satang);
  }
  sub(o) {
    return new _Money(this.satang - o.satang);
  }
  neg() {
    return new _Money(-this.satang);
  }
  abs() {
    return new _Money(this.satang < 0n ? -this.satang : this.satang);
  }
  /** คูณด้วยจำนวนเต็ม เช่น จำนวนคืนที่เข้าพัก — ไม่มีการปัดเศษ */
  times(n) {
    return new _Money(this.satang * n);
  }
  /** คูณด้วยอัตรา แล้วปัดเป็นสตางค์ (ปัดครึ่งออกจากศูนย์) */
  rate(r) {
    return new _Money(divHalfUp(this.satang * r.num, r.den));
  }
  isZero() {
    return this.satang === 0n;
  }
  isNeg() {
    return this.satang < 0n;
  }
  isPos() {
    return this.satang > 0n;
  }
  sign() {
    return this.satang === 0n ? 0 : this.satang < 0n ? -1 : 1;
  }
  eq(o) {
    return this.satang === o.satang;
  }
  lt(o) {
    return this.satang < o.satang;
  }
  lte(o) {
    return this.satang <= o.satang;
  }
  gt(o) {
    return this.satang > o.satang;
  }
  gte(o) {
    return this.satang >= o.satang;
  }
  cmp(o) {
    return this.satang === o.satang ? 0 : this.satang < o.satang ? -1 : 1;
  }
  /** '21608.65' — รูปแบบเดียวที่ส่งเข้าคอลัมน์ numeric(18,2) */
  toString() {
    const neg = this.satang < 0n;
    const a2 = neg ? -this.satang : this.satang;
    const int = a2 / UNIT;
    const frac = (a2 % UNIT).toString().padStart(2, "0");
    return `${neg ? "-" : ""}${int}.${frac}`;
  }
  /** '21,608.65' — สำหรับแสดงผลเท่านั้น ห้ามส่งเข้าฐานข้อมูล */
  format() {
    const [int, frac] = this.toString().split(".");
    const sign = int.startsWith("-") ? "-" : "";
    const digits = int.replace("-", "");
    return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
  }
  toJSON() {
    return this.toString();
  }
  /**
   * ปิดทางไม่ให้ใช้ตัวดำเนินการเลขคณิตกับ Money
   * `a + b` และ `Number(a)` จะโยน error ทันทีแทนที่จะได้ผลลัพธ์เพี้ยนเงียบ ๆ
   */
  [Symbol.toPrimitive](hint) {
    if (hint === "string") return this.toString();
    throw new TypeError(
      "\u0E2B\u0E49\u0E32\u0E21\u0E43\u0E0A\u0E49\u0E15\u0E31\u0E27\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E40\u0E25\u0E02\u0E04\u0E13\u0E34\u0E15\u0E01\u0E31\u0E1A Money \u2014 \u0E43\u0E0A\u0E49 .add() .sub() .times() .rate() \u0E41\u0E17\u0E19"
    );
  }
};
var Rate = class _Rate {
  num;
  den;
  constructor(num, den) {
    if (den <= 0n) throw new RangeError("\u0E15\u0E31\u0E27\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32\u0E28\u0E39\u0E19\u0E22\u0E4C");
    this.num = num;
    this.den = den;
    Object.freeze(this);
  }
  /** Rate.percent('7') = 7% · Rate.percent('1.5') = 1.5% */
  static percent(v) {
    const s = String(v).trim();
    if (!/^\d+(\.\d+)?$/.test(s)) throw new TypeError(`\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: ${v}`);
    const [int, frac = ""] = s.split(".");
    return new _Rate(BigInt(int + frac), 100n * 10n ** BigInt(frac.length));
  }
  static ratio(num, den) {
    return new _Rate(num, den);
  }
  /** อัตราสำหรับถอด VAT ออกจากราคารวม: 7% → 7/107 */
  inclusiveShare() {
    return new _Rate(this.num, this.den + this.num);
  }
  toString() {
    return `${Number(this.num) / Number(this.den) * 100}%`;
  }
};
function allocateByLargestRemainder(total, weights) {
  const n = weights.length;
  if (n === 0) throw new RangeError("\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E15\u0E31\u0E27");
  const w = weights.map((x) => {
    if (x.isNeg()) throw new RangeError("\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E44\u0E21\u0E48\u0E15\u0E34\u0E14\u0E25\u0E1A");
    return x.satang;
  });
  const W = w.reduce((a2, b) => a2 + b, 0n);
  if (W === 0n) {
    if (total.isZero()) return weights.map(() => Money.ZERO);
    throw new RangeError(
      "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E23\u0E27\u0E21\u0E40\u0E1B\u0E47\u0E19\u0E28\u0E39\u0E19\u0E22\u0E4C\u0E41\u0E15\u0E48\u0E21\u0E35\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E07\u0E34\u0E19\u0E43\u0E2B\u0E49\u0E41\u0E08\u0E01 \u2014 \u0E01\u0E23\u0E13\u0E35\u0E19\u0E35\u0E49\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07 (\u0E21\u0E31\u0E01\u0E41\u0E1B\u0E25\u0E27\u0E48\u0E32\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23\u0E21\u0E35\u0E22\u0E2D\u0E14 VAT \u0E41\u0E15\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14\u0E17\u0E35\u0E48\u0E04\u0E34\u0E14 VAT)"
    );
  }
  const sign = total.isNeg() ? -1n : 1n;
  const T = total.isNeg() ? -total.satang : total.satang;
  const quota = new Array(n);
  const remainder = new Array(n);
  let given = 0n;
  for (let i = 0; i < n; i++) {
    const prod = T * w[i];
    quota[i] = prod / W;
    remainder[i] = prod % W;
    given += quota[i];
  }
  let leftover = T - given;
  const order = Array.from({ length: n }, (_, i) => i).sort((a2, b) => {
    if (remainder[a2] !== remainder[b]) return remainder[a2] > remainder[b] ? -1 : 1;
    return a2 - b;
  });
  for (let k = 0; leftover > 0n; k++, leftover--) quota[order[k]] += 1n;
  return quota.map((q) => Money.fromSatang(sign * q));
}

// packages/posting/src/evaluate.ts
var PostingError = class extends Error {
  code;
  ruleSeq;
  constructor(code, message, ruleSeq) {
    super(message);
    this.code = code;
    this.ruleSeq = ruleSeq;
  }
};
function readPath(path, scope, ruleSeq) {
  const dot = path.indexOf(".");
  const root = path.slice(0, dot);
  const key = path.slice(dot + 1);
  if (root === "line") {
    if (!scope.line) {
      throw new PostingError(
        "LINE_OUT_OF_SCOPE",
        `\u0E01\u0E0E\u0E2D\u0E49\u0E32\u0E07 ${path} \u0E41\u0E15\u0E48\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07 forEach: 'lines' \u0E08\u0E36\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14\u0E43\u0E2B\u0E49\u0E2D\u0E48\u0E32\u0E19`,
        ruleSeq
      );
    }
    const v2 = scope.line[key];
    if (v2 === void 0) {
      throw new PostingError("MISSING_FIELD", `\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1F\u0E34\u0E25\u0E14\u0E4C ${path} \u0E43\u0E19\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E02\u0E2D\u0E07\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23`, ruleSeq);
    }
    return v2;
  }
  const v = scope.doc[key];
  if (v === void 0) {
    throw new PostingError("MISSING_FIELD", `\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1F\u0E34\u0E25\u0E14\u0E4C ${path} \u0E43\u0E19\u0E2B\u0E31\u0E27\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23`, ruleSeq);
  }
  return v;
}
function readValue(ref, scope, ruleSeq) {
  return ref.kind === "const" ? ref.value : readPath(ref.path, scope, ruleSeq);
}
var MONEYISH = /^-?\d{1,15}(\.\d{1,2})?$/;
function compare(a2, b) {
  if (MONEYISH.test(a2) && MONEYISH.test(b)) {
    return Money.of(a2).cmp(Money.of(b));
  }
  return a2 < b ? -1 : a2 > b ? 1 : 0;
}
function test(cond, scope, ruleSeq) {
  if ("args" in cond) {
    return cond.op === "and" ? cond.args.every((c2) => test(c2, scope, ruleSeq)) : cond.args.some((c2) => test(c2, scope, ruleSeq));
  }
  if ("arg" in cond) return !test(cond.arg, scope, ruleSeq);
  const c = compare(readValue(cond.left, scope, ruleSeq), readValue(cond.right, scope, ruleSeq));
  switch (cond.op) {
    case "eq":
      return c === 0;
    case "ne":
      return c !== 0;
    case "gt":
      return c > 0;
    case "gte":
      return c >= 0;
    case "lt":
      return c < 0;
    case "lte":
      return c <= 0;
  }
}
function resolveAmount(ref, scope, event, ruleSeq, ctx) {
  switch (ref.kind) {
    case "const":
      return Money.of(ref.value);
    case "field":
      return Money.of(readPath(ref.path, scope, ruleSeq));
    case "sum": {
      let total = Money.ZERO;
      for (const line of event.lines) {
        const inner = { doc: scope.doc, line };
        if (ref.where && !test(ref.where, inner, ruleSeq)) continue;
        const v = line[ref.field];
        if (v === void 0) {
          throw new PostingError(
            "MISSING_FIELD",
            `\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1F\u0E34\u0E25\u0E14\u0E4C ${ref.field} \u0E43\u0E19\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E27\u0E21\u0E22\u0E2D\u0E14`,
            ruleSeq
          );
        }
        total = total.add(Money.of(v));
      }
      return total;
    }
    case "percent":
      return resolveAmount(ref.of, scope, event, ruleSeq, ctx).rate(Rate.percent(ref.rate));
    case "taxRate": {
      const rate = ctx?.taxRates?.[ref.taxCode];
      if (rate === void 0) {
        throw new PostingError(
          "MISSING_TAX_RATE",
          `\u0E01\u0E0E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E20\u0E32\u0E29\u0E35 ${ref.taxCode} \u0E41\u0E15\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E19\u0E31\u0E49\u0E19\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E1A\u0E31\u0E07\u0E04\u0E31\u0E1A \u0E13 \u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23 \u2014 \u0E15\u0E49\u0E2D\u0E07\u0E15\u0E31\u0E49\u0E07\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E23\u0E2D\u0E07\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E49\u0E32\u0E20\u0E32\u0E29\u0E35\u0E01\u0E48\u0E2D\u0E19`,
          ruleSeq
        );
      }
      return resolveAmount(ref.of, scope, event, ruleSeq, ctx).rate(Rate.percent(rate));
    }
  }
}
function resolveAccount(ref, scope, ctx, ruleSeq) {
  let code;
  switch (ref.kind) {
    case "literal":
      code = ref.code;
      break;
    case "config": {
      const c = ctx.config[ref.slot];
      if (!c) {
        throw new PostingError(
          "CONFIG_SLOT_EMPTY",
          `\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E0A\u0E48\u0E2D\u0E07 '${ref.slot}' \u2014 \u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E43\u0E19\u0E40\u0E21\u0E19\u0E39\u0E1C\u0E39\u0E01\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E01\u0E48\u0E2D\u0E19`,
          ruleSeq
        );
      }
      code = c;
      break;
    }
    case "mapping": {
      const table = ctx.mappings[ref.table];
      if (!table) {
        throw new PostingError("MAPPING_MISSING", `\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E15\u0E32\u0E23\u0E32\u0E07\u0E41\u0E1B\u0E25\u0E07\u0E04\u0E48\u0E32 '${ref.table}'`, ruleSeq);
      }
      const key = readPath(ref.keyFrom, scope, ruleSeq);
      const c = table[key];
      if (!c) {
        throw new PostingError(
          "MAPPING_KEY_MISSING",
          `\u0E15\u0E32\u0E23\u0E32\u0E07 '${ref.table}' \u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A '${key}' \u2014 \u0E40\u0E1E\u0E34\u0E48\u0E21\u0E01\u0E32\u0E23\u0E1C\u0E39\u0E01\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E01\u0E48\u0E2D\u0E19\u0E25\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23`,
          ruleSeq
        );
      }
      code = c;
      break;
    }
  }
  if (ctx.chart) {
    const a2 = ctx.chart.get(code);
    if (!a2) {
      throw new PostingError("ACCOUNT_NOT_FOUND", `\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1A\u0E31\u0E0D\u0E0A\u0E35 ${code} \u0E43\u0E19\u0E1C\u0E31\u0E07\u0E1A\u0E31\u0E0D\u0E0A\u0E35`, ruleSeq);
    }
    if (!a2.isPostable) {
      throw new PostingError(
        "ACCOUNT_NOT_POSTABLE",
        `\u0E1A\u0E31\u0E0D\u0E0A\u0E35 ${code} \u0E40\u0E1B\u0E47\u0E19\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E04\u0E38\u0E21 \u0E25\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49`,
        ruleSeq
      );
    }
  }
  return code;
}
function renderMemo(tpl, scope) {
  if (!tpl) return void 0;
  return tpl.replace(/\{(doc|line)\.([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, root, key) => {
    const src = root === "line" ? scope.line : scope.doc;
    return src?.[key] ?? m;
  });
}
function resolveTax(tax, event, scope, ctx) {
  const base = resolveAmount(tax.base, scope, event, void 0, ctx);
  const amount = resolveAmount(tax.amount, scope, event, void 0, ctx);
  let lines = [{ lineNo: 1, base, tax: amount }];
  if (tax.allocateToLines) {
    const field = tax.lineBaseField;
    if (!field) {
      throw new PostingError(
        "TAX_LINE_FIELD_MISSING",
        "\u0E15\u0E31\u0E49\u0E07 allocateToLines \u0E44\u0E27\u0E49\u0E41\u0E15\u0E48\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E30\u0E1A\u0E38 lineBaseField \u0E27\u0E48\u0E32\u0E08\u0E30\u0E43\u0E0A\u0E49\u0E1F\u0E34\u0E25\u0E14\u0E4C\u0E44\u0E2B\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E10\u0E32\u0E19\u0E01\u0E23\u0E30\u0E08\u0E32\u0E22"
      );
    }
    const bases = event.lines.map((l, i) => {
      const v = l[field];
      if (v === void 0) {
        throw new PostingError("MISSING_FIELD", `\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E17\u0E35\u0E48 ${i + 1} \u0E44\u0E21\u0E48\u0E21\u0E35\u0E1F\u0E34\u0E25\u0E14\u0E4C ${field}`);
      }
      return Money.of(v);
    });
    if (bases.length > 0 && !Money.sum(bases).isZero()) {
      const parts = allocateByLargestRemainder(amount, bases);
      lines = bases.map((b, i) => ({ lineNo: i + 1, base: b, tax: parts[i] }));
    }
  }
  return {
    kind: tax.kind,
    taxCode: tax.taxCode,
    formCode: tax.formCode,
    base,
    tax: amount,
    counterpartyName: tax.counterpartyName ? renderMemo(tax.counterpartyName, scope) : void 0,
    counterpartyTaxId: tax.counterpartyTaxId ? readPath(tax.counterpartyTaxId, scope) : void 0,
    lines
  };
}
function evaluate(event, ruleSet, ctx) {
  if (ruleSet.docType !== event.docType) {
    throw new PostingError(
      "DOCTYPE_MISMATCH",
      `\u0E0A\u0E38\u0E14\u0E01\u0E0E\u0E40\u0E1B\u0E47\u0E19\u0E02\u0E2D\u0E07\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23 ${ruleSet.docType} \u0E41\u0E15\u0E48\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E40\u0E1B\u0E47\u0E19 ${event.docType}`
    );
  }
  const lines = [];
  const rules = [...ruleSet.rules].sort((a2, b) => a2.seq - b.seq);
  for (const rule of rules) {
    const scopes = rule.forEach === "lines" ? event.lines : [null];
    for (const line of scopes) {
      const scope = { doc: event.fields, line };
      if (rule.when && !test(rule.when, scope, rule.seq)) continue;
      const amount = resolveAmount(rule.amount, scope, event, rule.seq, ctx);
      if (amount.isZero()) continue;
      if (amount.isNeg()) {
        throw new PostingError(
          "NEGATIVE_AMOUNT",
          `\u0E01\u0E0E\u0E02\u0E49\u0E2D ${rule.seq} \u0E04\u0E33\u0E19\u0E27\u0E13\u0E44\u0E14\u0E49\u0E22\u0E2D\u0E14\u0E15\u0E34\u0E14\u0E25\u0E1A ${amount} \u2014 \u0E16\u0E49\u0E32\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E01\u0E25\u0E31\u0E1A\u0E14\u0E49\u0E32\u0E19 \u0E43\u0E2B\u0E49\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19 side \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E43\u0E2B\u0E49\u0E22\u0E2D\u0E14\u0E15\u0E34\u0E14\u0E25\u0E1A`,
          rule.seq
        );
      }
      lines.push({
        side: rule.side,
        accountCode: resolveAccount(rule.account, scope, ctx, rule.seq),
        amount,
        memo: renderMemo(rule.memo, scope),
        ruleSeq: rule.seq
      });
    }
  }
  const debit = Money.sum(lines.filter((l) => l.side === "D").map((l) => l.amount));
  const credit = Money.sum(lines.filter((l) => l.side === "C").map((l) => l.amount));
  if (lines.length < 2) {
    throw new PostingError(
      "TOO_FEW_LINES",
      `\u0E01\u0E0E\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E14\u0E49 ${lines.length} \u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14 \u2014 \u0E43\u0E1A\u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22 2 \u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14 (\u0E21\u0E31\u0E01\u0E40\u0E01\u0E34\u0E14\u0E08\u0E32\u0E01\u0E40\u0E07\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E02 when \u0E01\u0E23\u0E2D\u0E07\u0E2D\u0E2D\u0E01\u0E2B\u0E21\u0E14 \u0E2B\u0E23\u0E37\u0E2D\u0E22\u0E2D\u0E14\u0E40\u0E1B\u0E47\u0E19\u0E28\u0E39\u0E19\u0E22\u0E4C)`
    );
  }
  if (!debit.eq(credit)) {
    throw new PostingError(
      "UNBALANCED",
      `\u0E01\u0E0E\u0E0A\u0E38\u0E14 ${ruleSet.name} v${ruleSet.version} \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E1A\u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E2A\u0E21\u0E14\u0E38\u0E25: \u0E40\u0E14\u0E1A\u0E34\u0E15 ${debit.format()} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 ${credit.format()} \u0E15\u0E48\u0E32\u0E07\u0E01\u0E31\u0E19 ${debit.sub(credit).abs().format()}`
    );
  }
  const taxScope = { doc: event.fields, line: null };
  const tax = ruleSet.tax ? resolveTax(ruleSet.tax, event, taxScope, ctx) : void 0;
  if (tax) {
    const sum = Money.sum(tax.lines.map((l) => l.tax));
    if (!sum.eq(tax.tax)) {
      throw new PostingError(
        "TAX_ALLOCATION_MISMATCH",
        `\u0E20\u0E32\u0E29\u0E35\u0E23\u0E32\u0E22\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14\u0E23\u0E27\u0E21\u0E44\u0E14\u0E49 ${sum.format()} \u0E41\u0E15\u0E48\u0E20\u0E32\u0E29\u0E35\u0E2B\u0E31\u0E27\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23\u0E04\u0E37\u0E2D ${tax.tax.format()}`
      );
    }
  }
  return {
    docType: event.docType,
    businessDate: event.businessDate,
    sourceEventId: event.eventId,
    ruleVersion: ruleSet.version,
    lines,
    debit,
    credit,
    tax
  };
}

// packages/ledger/src/moneyFields.ts
var MONEY_FIELDS = /* @__PURE__ */ new Set([
  "amount",
  "netamount",
  "grossamount",
  "grandtotal",
  "total",
  "subtotal",
  "vat",
  "servicecharge",
  "commission",
  "discount",
  "paidamount",
  "balance",
  "unitprice",
  "linetotal",
  "deposit",
  "refundamount"
]);
function findNumericMoney(value, path = "") {
  const out = [];
  const walk = (node, at) => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => {
        walk(item, `${at}[${i}]`);
      });
      return;
    }
    if (node === null || typeof node !== "object") return;
    for (const [key, v] of Object.entries(node)) {
      const here = at ? `${at}.${key}` : key;
      if (typeof v === "number" && MONEY_FIELDS.has(key.toLowerCase())) {
        out.push({ path: here, value: v });
        continue;
      }
      walk(v, here);
    }
  };
  walk(value, path);
  return out;
}

// packages/posting/src/rules/chart-th.ts
var CONTRA_ASSET = /* @__PURE__ */ new Set(["1221-00", "1231-00", "1241-00"]);
var CHART_TH = [
  // ═══ 1 สินทรัพย์ ═══════════════════════════════════════════════════════
  a("1000-00", "\u0E2A\u0E34\u0E19\u0E17\u0E23\u0E31\u0E1E\u0E22\u0E4C", "asset", "D", false, null),
  a("1100-00", "\u0E2A\u0E34\u0E19\u0E17\u0E23\u0E31\u0E1E\u0E22\u0E4C\u0E2B\u0E21\u0E38\u0E19\u0E40\u0E27\u0E35\u0E22\u0E19", "asset", "D", false, "1000-00"),
  a("1111-00", "\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E14", "asset", "D", true, "1100-00"),
  a("1112-00", "\u0E40\u0E07\u0E34\u0E19\u0E1D\u0E32\u0E01\u0E18\u0E19\u0E32\u0E04\u0E32\u0E23", "asset", "D", false, "1100-00"),
  a("1112-01", "\u0E40\u0E07\u0E34\u0E19\u0E1D\u0E32\u0E01\u0E01\u0E23\u0E30\u0E41\u0E2A\u0E23\u0E32\u0E22\u0E27\u0E31\u0E19", "asset", "D", true, "1112-00"),
  a("1112-02", "\u0E40\u0E07\u0E34\u0E19\u0E1D\u0E32\u0E01\u0E2D\u0E2D\u0E21\u0E17\u0E23\u0E31\u0E1E\u0E22\u0E4C", "asset", "D", true, "1112-00"),
  a("1130-00", "\u0E25\u0E39\u0E01\u0E2B\u0E19\u0E35\u0E49\u0E01\u0E32\u0E23\u0E04\u0E49\u0E32", "asset", "D", false, "1100-00"),
  a("1130-01", "\u0E25\u0E39\u0E01\u0E2B\u0E19\u0E35\u0E49\u0E01\u0E32\u0E23\u0E04\u0E49\u0E32 \u2014 \u0E17\u0E31\u0E48\u0E27\u0E44\u0E1B", "asset", "D", true, "1130-00"),
  a("1130-05", "\u0E25\u0E39\u0E01\u0E2B\u0E19\u0E35\u0E49\u0E1A\u0E31\u0E15\u0E23\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15", "asset", "D", true, "1130-00"),
  a("1130-06", "\u0E25\u0E39\u0E01\u0E2B\u0E19\u0E35\u0E49 OTA", "asset", "D", true, "1130-00"),
  a("1140-00", "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D", "asset", "D", true, "1100-00"),
  a("1150-00", "\u0E04\u0E48\u0E32\u0E43\u0E0A\u0E49\u0E08\u0E48\u0E32\u0E22\u0E08\u0E48\u0E32\u0E22\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32", "asset", "D", true, "1100-00"),
  a("1160-00", "\u0E20\u0E32\u0E29\u0E35\u0E0B\u0E37\u0E49\u0E2D", "asset", "D", true, "1100-00"),
  a("1161-00", "\u0E20\u0E32\u0E29\u0E35\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E16\u0E36\u0E07\u0E01\u0E33\u0E2B\u0E19\u0E14", "asset", "D", true, "1100-00"),
  a("1170-00", "\u0E40\u0E07\u0E34\u0E19\u0E17\u0E14\u0E23\u0E2D\u0E07\u0E08\u0E48\u0E32\u0E22", "asset", "D", true, "1100-00"),
  a("1200-00", "\u0E2A\u0E34\u0E19\u0E17\u0E23\u0E31\u0E1E\u0E22\u0E4C\u0E44\u0E21\u0E48\u0E2B\u0E21\u0E38\u0E19\u0E40\u0E27\u0E35\u0E22\u0E19", "asset", "D", false, "1000-00"),
  a("1210-00", "\u0E17\u0E35\u0E48\u0E14\u0E34\u0E19", "asset", "D", true, "1200-00"),
  a("1220-00", "\u0E2D\u0E32\u0E04\u0E32\u0E23\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E48\u0E07\u0E1B\u0E25\u0E39\u0E01\u0E2A\u0E23\u0E49\u0E32\u0E07", "asset", "D", true, "1200-00"),
  a("1221-00", "\u0E04\u0E48\u0E32\u0E40\u0E2A\u0E37\u0E48\u0E2D\u0E21\u0E23\u0E32\u0E04\u0E32\u0E2A\u0E30\u0E2A\u0E21 \u2014 \u0E2D\u0E32\u0E04\u0E32\u0E23", "asset", "C", true, "1200-00"),
  a("1230-00", "\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E15\u0E01\u0E41\u0E15\u0E48\u0E07\u0E41\u0E25\u0E30\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C", "asset", "D", true, "1200-00"),
  a("1231-00", "\u0E04\u0E48\u0E32\u0E40\u0E2A\u0E37\u0E48\u0E2D\u0E21\u0E23\u0E32\u0E04\u0E32\u0E2A\u0E30\u0E2A\u0E21 \u2014 \u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E15\u0E01\u0E41\u0E15\u0E48\u0E07", "asset", "C", true, "1200-00"),
  a("1240-00", "\u0E22\u0E32\u0E19\u0E1E\u0E32\u0E2B\u0E19\u0E30", "asset", "D", true, "1200-00"),
  a("1241-00", "\u0E04\u0E48\u0E32\u0E40\u0E2A\u0E37\u0E48\u0E2D\u0E21\u0E23\u0E32\u0E04\u0E32\u0E2A\u0E30\u0E2A\u0E21 \u2014 \u0E22\u0E32\u0E19\u0E1E\u0E32\u0E2B\u0E19\u0E30", "asset", "C", true, "1200-00"),
  // ═══ 2 หนี้สิน ═════════════════════════════════════════════════════════
  a("2000-00", "\u0E2B\u0E19\u0E35\u0E49\u0E2A\u0E34\u0E19", "liability", "C", false, null),
  a("2100-00", "\u0E2B\u0E19\u0E35\u0E49\u0E2A\u0E34\u0E19\u0E2B\u0E21\u0E38\u0E19\u0E40\u0E27\u0E35\u0E22\u0E19", "liability", "C", false, "2000-00"),
  a("2110-00", "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E35\u0E49\u0E01\u0E32\u0E23\u0E04\u0E49\u0E32", "liability", "C", false, "2100-00"),
  a("2110-01", "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E35\u0E49\u0E01\u0E32\u0E23\u0E04\u0E49\u0E32 \u2014 \u0E17\u0E31\u0E48\u0E27\u0E44\u0E1B", "liability", "C", true, "2110-00"),
  a("2110-05", "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E35\u0E49 OTA \u0E15\u0E48\u0E32\u0E07\u0E1B\u0E23\u0E30\u0E40\u0E17\u0E28", "liability", "C", true, "2110-00"),
  a("2130-00", "\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32", "liability", "C", false, "2100-00"),
  a("2130-01", "\u0E40\u0E07\u0E34\u0E19\u0E21\u0E31\u0E14\u0E08\u0E33\u0E23\u0E31\u0E1A\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32", "liability", "C", true, "2130-00"),
  a("2132-00", "\u0E20\u0E32\u0E29\u0E35\u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22\u0E04\u0E49\u0E32\u0E07\u0E19\u0E33\u0E2A\u0E48\u0E07", "liability", "C", false, "2100-00"),
  a("2132-03", "\u0E20\u0E32\u0E29\u0E35\u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22 \u2014 \u0E20.\u0E07.\u0E14.3", "liability", "C", true, "2132-00"),
  a("2132-04", "\u0E20\u0E32\u0E29\u0E35\u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22 \u2014 \u0E20.\u0E07.\u0E14.53", "liability", "C", true, "2132-00"),
  a("2132-54", "\u0E20\u0E32\u0E29\u0E35\u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22 \u2014 \u0E20.\u0E07.\u0E14.54", "liability", "C", true, "2132-00"),
  a("2135-00", "\u0E20\u0E32\u0E29\u0E35\u0E02\u0E32\u0E22", "liability", "C", true, "2100-00"),
  a("2136-00", "\u0E20\u0E32\u0E29\u0E35\u0E02\u0E32\u0E22\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E16\u0E36\u0E07\u0E01\u0E33\u0E2B\u0E19\u0E14", "liability", "C", true, "2100-00"),
  a("2140-00", "\u0E04\u0E48\u0E32\u0E43\u0E0A\u0E49\u0E08\u0E48\u0E32\u0E22\u0E04\u0E49\u0E32\u0E07\u0E08\u0E48\u0E32\u0E22", "liability", "C", true, "2100-00"),
  a("2150-00", "\u0E40\u0E07\u0E34\u0E19\u0E01\u0E39\u0E49\u0E22\u0E37\u0E21\u0E23\u0E30\u0E22\u0E30\u0E2A\u0E31\u0E49\u0E19", "liability", "C", true, "2100-00"),
  a("2200-00", "\u0E2B\u0E19\u0E35\u0E49\u0E2A\u0E34\u0E19\u0E44\u0E21\u0E48\u0E2B\u0E21\u0E38\u0E19\u0E40\u0E27\u0E35\u0E22\u0E19", "liability", "C", false, "2000-00"),
  a("2210-00", "\u0E40\u0E07\u0E34\u0E19\u0E01\u0E39\u0E49\u0E22\u0E37\u0E21\u0E23\u0E30\u0E22\u0E30\u0E22\u0E32\u0E27", "liability", "C", true, "2200-00"),
  // ═══ 3 ส่วนของเจ้าของ ══════════════════════════════════════════════════
  a("3000-00", "\u0E2A\u0E48\u0E27\u0E19\u0E02\u0E2D\u0E07\u0E40\u0E08\u0E49\u0E32\u0E02\u0E2D\u0E07", "equity", "C", false, null),
  a("3100-00", "\u0E17\u0E38\u0E19\u0E08\u0E14\u0E17\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E19\u0E41\u0E25\u0E30\u0E0A\u0E33\u0E23\u0E30\u0E41\u0E25\u0E49\u0E27", "equity", "C", true, "3000-00"),
  a("3200-00", "\u0E01\u0E33\u0E44\u0E23\u0E2A\u0E30\u0E2A\u0E21", "equity", "C", true, "3000-00"),
  a("3300-00", "\u0E40\u0E07\u0E34\u0E19\u0E16\u0E2D\u0E19\u0E02\u0E2D\u0E07\u0E40\u0E08\u0E49\u0E32\u0E02\u0E2D\u0E07", "equity", "D", true, "3000-00"),
  // ═══ 4 รายได้ ══════════════════════════════════════════════════════════
  a("4000-00", "\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49", "revenue", "C", false, null),
  a("4100-00", "\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49\u0E08\u0E32\u0E01\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22\u0E41\u0E25\u0E30\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23", "revenue", "C", false, "4000-00"),
  a("4100-01", "\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49\u0E04\u0E48\u0E32\u0E2B\u0E49\u0E2D\u0E07\u0E1E\u0E31\u0E01", "revenue", "C", true, "4100-00"),
  a("4100-02", "\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49\u0E2D\u0E32\u0E2B\u0E32\u0E23\u0E41\u0E25\u0E30\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E14\u0E37\u0E48\u0E21", "revenue", "C", true, "4100-00"),
  a("4100-03", "\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49\u0E21\u0E34\u0E19\u0E34\u0E1A\u0E32\u0E23\u0E4C", "revenue", "C", true, "4100-00"),
  a("4100-04", "\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49\u0E0B\u0E31\u0E01\u0E23\u0E35\u0E14", "revenue", "C", true, "4100-00"),
  a("4100-05", "\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49\u0E04\u0E48\u0E32\u0E40\u0E0A\u0E48\u0E32\u0E1E\u0E37\u0E49\u0E19\u0E17\u0E35\u0E48", "revenue", "C", true, "4100-00"),
  a("4100-09", "\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49\u0E04\u0E48\u0E32\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23 10%", "revenue", "C", true, "4100-00"),
  // ส่วนลดจ่ายเป็นรายได้ที่ด้านปกติเป็นเดบิต — มันหักออกจากรายได้
  a("4190-00", "\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14\u0E08\u0E48\u0E32\u0E22", "revenue", "D", true, "4000-00"),
  a("4200-00", "\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49\u0E2D\u0E37\u0E48\u0E19", "revenue", "C", true, "4000-00"),
  // ═══ 5 ค่าใช้จ่าย ══════════════════════════════════════════════════════
  a("5000-00", "\u0E04\u0E48\u0E32\u0E43\u0E0A\u0E49\u0E08\u0E48\u0E32\u0E22", "expense", "D", false, null),
  a("5100-00", "\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19\u0E02\u0E32\u0E22\u0E41\u0E25\u0E30\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23", "expense", "D", true, "5000-00"),
  a("5200-00", "\u0E04\u0E48\u0E32\u0E43\u0E0A\u0E49\u0E08\u0E48\u0E32\u0E22\u0E43\u0E19\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22\u0E41\u0E25\u0E30\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23", "expense", "D", false, "5000-00"),
  a("5200-01", "\u0E40\u0E07\u0E34\u0E19\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E41\u0E25\u0E30\u0E04\u0E48\u0E32\u0E41\u0E23\u0E07", "expense", "D", true, "5200-00"),
  a("5200-02", "\u0E04\u0E48\u0E32\u0E44\u0E1F\u0E1F\u0E49\u0E32", "expense", "D", true, "5200-00"),
  a("5200-03", "\u0E04\u0E48\u0E32\u0E19\u0E49\u0E33\u0E1B\u0E23\u0E30\u0E1B\u0E32", "expense", "D", true, "5200-00"),
  a("5200-04", "\u0E04\u0E48\u0E32\u0E42\u0E17\u0E23\u0E28\u0E31\u0E1E\u0E17\u0E4C\u0E41\u0E25\u0E30\u0E2D\u0E34\u0E19\u0E40\u0E17\u0E2D\u0E23\u0E4C\u0E40\u0E19\u0E47\u0E15", "expense", "D", true, "5200-00"),
  a("5200-05", "\u0E04\u0E48\u0E32\u0E40\u0E0A\u0E48\u0E32", "expense", "D", true, "5200-00"),
  a("5200-06", "\u0E04\u0E48\u0E32\u0E0B\u0E48\u0E2D\u0E21\u0E41\u0E0B\u0E21\u0E41\u0E25\u0E30\u0E1A\u0E33\u0E23\u0E38\u0E07\u0E23\u0E31\u0E01\u0E29\u0E32", "expense", "D", true, "5200-00"),
  a("5200-07", "\u0E04\u0E48\u0E32\u0E27\u0E31\u0E2A\u0E14\u0E38\u0E2A\u0E34\u0E49\u0E19\u0E40\u0E1B\u0E25\u0E37\u0E2D\u0E07", "expense", "D", true, "5200-00"),
  a("5200-08", "\u0E04\u0E48\u0E32\u0E40\u0E2A\u0E37\u0E48\u0E2D\u0E21\u0E23\u0E32\u0E04\u0E32", "expense", "D", true, "5200-00"),
  a("5200-09", "\u0E04\u0E48\u0E32\u0E18\u0E23\u0E23\u0E21\u0E40\u0E19\u0E35\u0E22\u0E21\u0E18\u0E19\u0E32\u0E04\u0E32\u0E23", "expense", "D", true, "5200-00"),
  a("5200-10", "\u0E04\u0E48\u0E32\u0E18\u0E23\u0E23\u0E21\u0E40\u0E19\u0E35\u0E22\u0E21\u0E1A\u0E31\u0E15\u0E23\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15", "expense", "D", true, "5200-00"),
  a("5200-11", "\u0E04\u0E48\u0E32\u0E04\u0E2D\u0E21\u0E21\u0E34\u0E0A\u0E0A\u0E31\u0E48\u0E19 OTA", "expense", "D", true, "5200-00"),
  a("5200-12", "\u0E04\u0E48\u0E32\u0E42\u0E06\u0E29\u0E13\u0E32\u0E41\u0E25\u0E30\u0E2A\u0E48\u0E07\u0E40\u0E2A\u0E23\u0E34\u0E21\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22", "expense", "D", true, "5200-00"),
  a("5200-13", "\u0E04\u0E48\u0E32\u0E18\u0E23\u0E23\u0E21\u0E40\u0E19\u0E35\u0E22\u0E21\u0E27\u0E34\u0E0A\u0E32\u0E0A\u0E35\u0E1E", "expense", "D", true, "5200-00"),
  a("5200-20", "\u0E04\u0E48\u0E32\u0E43\u0E0A\u0E49\u0E08\u0E48\u0E32\u0E22\u0E40\u0E1A\u0E47\u0E14\u0E40\u0E15\u0E25\u0E47\u0E14", "expense", "D", true, "5200-00"),
  a("5300-00", "\u0E14\u0E2D\u0E01\u0E40\u0E1A\u0E35\u0E49\u0E22\u0E08\u0E48\u0E32\u0E22", "expense", "D", true, "5000-00"),
  a("5400-00", "\u0E20\u0E32\u0E29\u0E35\u0E40\u0E07\u0E34\u0E19\u0E44\u0E14\u0E49\u0E19\u0E34\u0E15\u0E34\u0E1A\u0E38\u0E04\u0E04\u0E25", "expense", "D", true, "5000-00")
];
function a(code, nameTh, cls, normalSide, postable, parent) {
  return { code, nameTh, class: cls, normalSide, postable, parent };
}
var KNOWN_CONTRA = new Map([
  ...[...CONTRA_ASSET].map((c) => [c, "\u0E04\u0E48\u0E32\u0E40\u0E2A\u0E37\u0E48\u0E2D\u0E21\u0E23\u0E32\u0E04\u0E32\u0E2A\u0E30\u0E2A\u0E21 \u2014 \u0E2B\u0E31\u0E01\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E32\u0E04\u0E32\u0E17\u0E38\u0E19"]),
  ["3300-00", "\u0E40\u0E07\u0E34\u0E19\u0E16\u0E2D\u0E19\u0E02\u0E2D\u0E07\u0E40\u0E08\u0E49\u0E32\u0E02\u0E2D\u0E07 \u2014 \u0E2B\u0E31\u0E01\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E2A\u0E48\u0E27\u0E19\u0E02\u0E2D\u0E07\u0E40\u0E08\u0E49\u0E32\u0E02\u0E2D\u0E07"],
  ["4190-00", "\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14\u0E08\u0E48\u0E32\u0E22 \u2014 \u0E2B\u0E31\u0E01\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49"]
]);

// packages/posting/src/rules/sentiara.ts
var SENTIARA_NA = {
  version: 1,
  docType: "NA",
  name: "\u0E1B\u0E34\u0E14\u0E22\u0E2D\u0E14\u0E23\u0E32\u0E22\u0E04\u0E37\u0E19 (Sentiara)",
  approvedBy: null,
  rules: [
    {
      seq: 1,
      side: "D",
      account: { kind: "config", slot: "guest_ledger" },
      amount: { kind: "field", path: "doc.grandTotal" },
      memo: "\u0E1B\u0E34\u0E14\u0E22\u0E2D\u0E14\u0E23\u0E32\u0E22\u0E04\u0E37\u0E19 {doc.businessDate} \u0E2B\u0E49\u0E2D\u0E07 {doc.room}"
    },
    {
      seq: 2,
      forEach: "lines",
      when: {
        op: "eq",
        left: { kind: "field", path: "line.category" },
        right: { kind: "const", value: "DISCOUNT" }
      },
      side: "D",
      account: { kind: "config", slot: "sales_discount" },
      amount: { kind: "field", path: "line.netAmount" },
      memo: "\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14 \u0E2B\u0E49\u0E2D\u0E07 {doc.room}"
    },
    {
      // ทุกหมวดที่ไม่ใช่ส่วนลดเป็นรายได้ · รวม SERVICE ด้วย
      // ค่าบริการเดินทางเดียวกับ ROOM/FNB ไม่ต้องมีกลไกแยกที่หัวเอกสาร
      seq: 3,
      forEach: "lines",
      when: {
        op: "ne",
        left: { kind: "field", path: "line.category" },
        right: { kind: "const", value: "DISCOUNT" }
      },
      side: "C",
      account: { kind: "mapping", table: "revenue_center", keyFrom: "line.category" },
      amount: { kind: "field", path: "line.netAmount" },
      memo: "{line.category} \u0E2B\u0E49\u0E2D\u0E07 {doc.room}"
    },
    {
      seq: 4,
      when: {
        op: "gt",
        left: { kind: "field", path: "doc.vatAmount" },
        right: { kind: "const", value: "0" }
      },
      side: "C",
      account: { kind: "config", slot: "deferred_output_vat" },
      amount: { kind: "field", path: "doc.vatAmount" },
      memo: "\u0E20\u0E32\u0E29\u0E35\u0E02\u0E32\u0E22\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E16\u0E36\u0E07\u0E01\u0E33\u0E2B\u0E19\u0E14"
    }
  ],
  /*
   * ทะเบียนภาษีขายบันทึกตอนนี้ ทั้งที่ภาษียังไม่ถึงกำหนดชำระ
   *
   * เพราะทะเบียนเป็นบันทึกว่า "ให้บริการอะไรไปเมื่อไร" ซึ่งเกิดแล้วจริง
   * ส่วนกำหนดนำส่งเป็นคนละเรื่อง และดูจากบัญชี 2135-00 ที่โอนเข้าไปทีหลัง
   */
  tax: {
    kind: "vat_out",
    taxCode: "VAT_STD",
    formCode: "PP30",
    base: { kind: "field", path: "doc.vatBase" },
    amount: { kind: "field", path: "doc.vatAmount" },
    counterpartyName: "\u0E41\u0E02\u0E01\u0E2B\u0E49\u0E2D\u0E07 {doc.room}"
  }
};
var SENTIARA_STL = {
  version: 1,
  docType: "STL",
  name: "\u0E23\u0E31\u0E1A\u0E0A\u0E33\u0E23\u0E30\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E1E\u0E31\u0E01 (Sentiara)",
  approvedBy: null,
  rules: [
    {
      seq: 1,
      side: "D",
      account: { kind: "mapping", table: "payment_method", keyFrom: "doc.method" },
      amount: { kind: "field", path: "doc.amount" },
      memo: "\u0E23\u0E31\u0E1A\u0E0A\u0E33\u0E23\u0E30 {doc.method} \u0E2B\u0E49\u0E2D\u0E07 {doc.room}"
    },
    {
      seq: 2,
      side: "C",
      account: { kind: "config", slot: "guest_ledger" },
      amount: { kind: "field", path: "doc.amount" },
      memo: "\u0E15\u0E31\u0E14\u0E25\u0E39\u0E01\u0E2B\u0E19\u0E35\u0E49 {doc.bookingRef}"
    },
    {
      seq: 3,
      when: {
        op: "gt",
        left: { kind: "field", path: "doc.vatAmount" },
        right: { kind: "const", value: "0" }
      },
      side: "D",
      account: { kind: "config", slot: "deferred_output_vat" },
      amount: { kind: "field", path: "doc.vatAmount" },
      memo: "\u0E42\u0E2D\u0E19\u0E20\u0E32\u0E29\u0E35\u0E17\u0E35\u0E48\u0E16\u0E36\u0E07\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E41\u0E25\u0E49\u0E27"
    },
    {
      seq: 4,
      when: {
        op: "gt",
        left: { kind: "field", path: "doc.vatAmount" },
        right: { kind: "const", value: "0" }
      },
      side: "C",
      account: { kind: "config", slot: "output_vat" },
      amount: { kind: "field", path: "doc.vatAmount" },
      memo: "\u0E20\u0E32\u0E29\u0E35\u0E02\u0E32\u0E22\u0E16\u0E36\u0E07\u0E01\u0E33\u0E2B\u0E19\u0E14"
    }
  ]
};
var SENTIARA_EXP = {
  version: 1,
  docType: "EXP",
  name: "\u0E23\u0E32\u0E22\u0E08\u0E48\u0E32\u0E22 (Sentiara)",
  approvedBy: null,
  rules: [
    {
      seq: 1,
      side: "D",
      account: { kind: "mapping", table: "expense_category", keyFrom: "doc.category" },
      amount: { kind: "field", path: "doc.amount" },
      memo: "{doc.label}"
    },
    {
      seq: 2,
      when: {
        op: "gt",
        left: { kind: "field", path: "doc.withholdingTax" },
        right: { kind: "const", value: "0" }
      },
      side: "C",
      account: { kind: "config", slot: "wht_payable" },
      amount: { kind: "field", path: "doc.withholdingTax" },
      memo: "\u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22 {doc.withholdingKind}"
    },
    {
      seq: 3,
      side: "C",
      account: { kind: "mapping", table: "expense_credit", keyFrom: "doc.paid" },
      amount: { kind: "field", path: "doc.netPayable" },
      memo: "\u0E08\u0E48\u0E32\u0E22 {doc.label}"
    }
  ]
};
var SENTIARA_ADJ = {
  version: 1,
  docType: "ADJ",
  name: "\u0E43\u0E1A\u0E25\u0E14\u0E2B\u0E19\u0E35\u0E49 (Sentiara)",
  approvedBy: null,
  rules: [
    {
      seq: 1,
      side: "D",
      account: { kind: "config", slot: "sales_discount" },
      amount: { kind: "field", path: "doc.netAmount" },
      memo: "\u0E25\u0E14\u0E2B\u0E19\u0E35\u0E49 {doc.creditNoteNo}"
    },
    {
      seq: 2,
      when: {
        op: "gt",
        left: { kind: "field", path: "doc.vatAmount" },
        right: { kind: "const", value: "0" }
      },
      side: "D",
      account: { kind: "config", slot: "output_vat" },
      amount: { kind: "field", path: "doc.vatAmount" },
      memo: "\u0E01\u0E25\u0E31\u0E1A\u0E20\u0E32\u0E29\u0E35\u0E02\u0E32\u0E22\u0E15\u0E32\u0E21\u0E43\u0E1A\u0E25\u0E14\u0E2B\u0E19\u0E35\u0E49"
    },
    {
      seq: 3,
      side: "C",
      account: { kind: "config", slot: "guest_ledger" },
      amount: { kind: "field", path: "doc.amount" },
      memo: "{doc.memo}"
    }
  ]
};
var SENTIARA_CONFIG = {
  guest_ledger: "1130-01",
  output_vat: "2135-00",
  deferred_output_vat: "2136-00",
  sales_discount: "4190-00",
  wht_payable: "2132-04",
  unearned_revenue: "2130-01"
};
var SENTIARA_MAPPINGS = {
  revenue_center: {
    ROOM: "4100-01",
    FNB: "4100-02",
    MINIBAR: "4100-03",
    LAUNDRY: "4100-04",
    SERVICE: "4100-09"
  },
  payment_method: {
    cash: "1111-00",
    transfer: "1112-01",
    promptpay: "1112-01",
    card: "1130-05",
    deposit: "1112-01"
  },
  expense_category: {
    payroll: "5200-01",
    electricity: "5200-02",
    water: "5200-03",
    telecom: "5200-04",
    supplies: "5200-07",
    ota: "5200-11",
    maintenance: "5200-06",
    marketing: "5200-12",
    bankfee: "5200-09",
    interest: "5300-00",
    other: "5200-20"
  },
  /*
   * จ่ายแล้วหรือยัง — ตัดสินว่าเครดิตเงินสดหรือเครดิตเจ้าหนี้
   *
   * คีย์เป็นข้อความ 'true'/'false' เพราะ payload ส่ง boolean มา
   * แล้วตัวประเมินผลแปลงทุกค่าเป็นข้อความก่อนเทียบ
   */
  expense_credit: {
    true: "1112-01",
    false: "2110-01"
  }
};

// packages/posting/src/browser.ts
var RULE_SETS = [SENTIARA_NA, SENTIARA_STL, SENTIARA_EXP, SENTIARA_ADJ];
var RULES = RULE_SETS.map((r) => ({
  docType: r.docType,
  name: r.name,
  version: r.version,
  lineCount: r.rules.length
}));
var usedCodes = /* @__PURE__ */ new Set([
  ...Object.values(SENTIARA_CONFIG),
  ...Object.values(SENTIARA_MAPPINGS).flatMap((table) => Object.values(table))
]);
var CHART = CHART_TH.filter((a2) => usedCodes.has(a2.code)).map((a2) => ({ code: a2.code, name: a2.nameTh, side: a2.normalSide }));
var NAME_OF = new Map(CHART.map((a2) => [a2.code, a2.name]));
function toEvent(docType, doc) {
  const fields = {};
  let lines = [];
  for (const [key, value] of Object.entries(doc)) {
    if (key === "lines" && Array.isArray(value)) {
      lines = value.map((l) => {
        const out = {};
        for (const [k, v] of Object.entries(l)) {
          if (v !== null && v !== void 0) out[k] = String(v);
        }
        return out;
      });
      continue;
    }
    if (value !== null && value !== void 0 && typeof value !== "object") {
      fields[key] = String(value);
    }
  }
  return {
    eventId: String(doc["eventId"] ?? docType + "-\u0E40\u0E14\u0E42\u0E21"),
    docType,
    businessDate: String(doc["businessDate"] ?? ""),
    fields,
    lines
  };
}
var baht = (satang) => {
  const sign = satang < 0n ? "-" : "";
  const n = satang < 0n ? -satang : satang;
  return `${sign}${n / 100n}.${String(n % 100n).padStart(2, "0")}`;
};
function evaluate2(docType, doc) {
  const ruleSet = RULE_SETS.find((r) => r.docType === docType);
  if (!ruleSet) {
    return {
      ok: false,
      code: "NO_RULE",
      message: `\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E01\u0E0E\u0E25\u0E07\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23\u0E0A\u0E19\u0E34\u0E14 ${docType} \xB7 \u0E17\u0E35\u0E48\u0E21\u0E35\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49: ${RULE_SETS.map((r) => r.docType).join(" ")}`
    };
  }
  if (doc === null || typeof doc !== "object") {
    return { ok: false, code: "BAD_DOC", message: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E27\u0E31\u0E15\u0E16\u0E38" };
  }
  const badMoney = findNumericMoney(doc);
  if (badMoney.length > 0) {
    const first = badMoney[0];
    return {
      ok: false,
      code: "MONEY_MUST_BE_STRING",
      message: `\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E07\u0E34\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E2A\u0E48\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02 \xB7 ${first.path} = ${first.value} \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19 "${first.value.toFixed(2)}"` + (badMoney.length > 1 ? ` \u0E41\u0E25\u0E30\u0E2D\u0E35\u0E01 ${badMoney.length - 1} \u0E0A\u0E48\u0E2D\u0E07` : "")
    };
  }
  try {
    const draft = evaluate(toEvent(docType, doc), ruleSet, {
      config: SENTIARA_CONFIG,
      mappings: SENTIARA_MAPPINGS
    });
    let debit = 0n;
    let credit = 0n;
    const postings = draft.lines.map((l) => {
      if (l.side === "D") debit += l.amount.satang;
      else credit += l.amount.satang;
      return {
        side: l.side,
        account: l.accountCode,
        name: NAME_OF.get(l.accountCode) ?? l.accountCode,
        amount: baht(l.amount.satang)
      };
    });
    return { ok: true, postings, debit: baht(debit), credit: baht(credit) };
  } catch (e) {
    const err = e;
    return {
      ok: false,
      code: err.code ?? "ERROR",
      message: err.message ?? String(e)
    };
  }
}
export {
  CHART,
  RULES,
  evaluate2 as evaluate
};

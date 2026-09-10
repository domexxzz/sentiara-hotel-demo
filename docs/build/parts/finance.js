/* ตัวอย่างฝั่งการเงินและบัญชี
   ตัวเลขทุกตัวคิดเป็น "สตางค์จำนวนเต็ม" เหมือนระบบจริง ไม่แตะเลขทศนิยมเลย
   และเลขบัญชีที่ใช้เป็นผังบัญชีโรงแรมไทยจริง ไม่ใช่ชื่อสมมุติ           */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  /* หารแล้วปัดครึ่งขึ้น ด้วยจำนวนเต็มล้วน */
  var halfUp = function (n, d) { return Math.floor((n * 2 + d) / (2 * d)); };
  /* แสดงสตางค์เป็นบาท ทศนิยมสองตำแหน่งเสมอ แบบเอกสารบัญชี */
  var st = function (s) {
    var neg = s < 0, a = Math.abs(s);
    return (neg ? '-' : '') + Math.floor(a / 100).toLocaleString('en-US') + '.' + ('0' + (a % 100)).slice(-2);
  };
  var bt = function (b) { return '฿' + Math.round(b).toLocaleString('en-US'); };

  /* ══ เดินเงินจากบิลถึงสมุดบัญชี ═══════════════════════════ */
  (function () {
    var root = $('p-jv'); if (!root) return;

    var VAT = 7;
    /* ห้อง 301 · 2 คืน — พฤหัส ฿1,650 + ศุกร์เรตวันหยุด ฿1,980 */
    var N1 = 165000, N2 = 198000, FNB = 30000, MINI = 9000;
    var ROOM = N1 + N2;                       // 363000
    var GROSS = ROOM + FNB + MINI;            // 402000
    var DEP = halfUp(ROOM * 30, 100);         // มัดจำ 30% ของค่าห้อง = 108900

    /* ถอด VAT รายหมวด แล้วโยนเศษเข้าหมวดที่ยอดใหญ่ที่สุด
       เพื่อให้ผลรวมของฐานตรงกับฐานของยอดรวมเป๊ะ */
    var baseOf = function (g) { return halfUp(g * 100, 100 + VAT); };
    var BASE_ALL = baseOf(GROSS);
    var bRoom = baseOf(ROOM), bFnb = baseOf(FNB), bMini = baseOf(MINI);
    bRoom += BASE_ALL - (bRoom + bFnb + bMini);
    var VAT_ALL = GROSS - BASE_ALL;

    var A = {
      cash:  ['1111-00', 'เงินสด'],
      ar:    ['1130-01', 'ลูกหนี้การค้า — ทั่วไป'],
      dep:   ['2130-01', 'เงินมัดจำรับล่วงหน้า'],
      vat:   ['2135-00', 'ภาษีขาย'],
      room:  ['4100-01', 'รายได้ค่าห้องพัก'],
      fnb:   ['4100-02', 'รายได้อาหารและเครื่องดื่ม'],
      mini:  ['4100-03', 'รายได้มินิบาร์']
    };

    var STEPS = [
      {
        btn: 'รับมัดจำ 30%',
        say: 'แขกโอนมัดจำ ' + bt(DEP / 100) + ' ตอนกดจอง — <b>ยังไม่ใช่รายได้</b> ' +
             'เพราะโรงแรมยังไม่ได้ให้บริการ จึงลงเป็นหนี้สินไว้ก่อน',
        note: 'มัดจำมี VAT ตั้งแต่วันรับเงินหรือไม่ ขึ้นกับว่าถือเป็นค่าบริการล่วงหน้าหรือเงินประกันที่คืนได้ — ' +
              'ม.78/1(1) คนละผังบัญชีกัน ตัวอย่างนี้ถือเป็นเงินรับล่วงหน้าที่ยังไม่รับรู้ภาษี',
        jv: { kind: 'DEP', ttl: 'รับมัดจำ · ห้อง 301', ref: 'DEP-PY-8A31F0C2',
              lines: [[A.cash, DEP, 0], [A.dep, 0, DEP]] }
      },
      {
        btn: 'ปิดยอดรายคืน',
        say: 'ปิดยอดตอนตีสอง — <b>รายได้เกิดตอนนี้</b> ไม่ใช่ตอนแขกจ่ายเงิน ' +
             'ค่าห้องรับรู้ทีละคืนตามที่ให้บริการจริง',
        note: 'ค่าห้องอ่านจากตารางคืนของห้อง ไม่ได้อ่านจากบิล — จองวันนี้เข้าพักเดือนหน้า รายได้เป็นของเดือนหน้า',
        jv: { kind: 'NA', ttl: 'ปิดยอดรายคืน · 2 คืน', ref: 'NA-2026-08-14-BK-0464FE0F',
              lines: [[A.ar, GROSS, 0], [A.room, 0, bRoom], [A.fnb, 0, bFnb],
                      [A.mini, 0, bMini], [A.vat, 0, VAT_ALL]] }
      },
      {
        btn: 'เช็กเอาต์ รับเงินที่เหลือ',
        say: 'ตัดมัดจำที่ถือไว้ แล้วรับเงินสดส่วนที่เหลือ ' + bt((GROSS - DEP) / 100) +
             ' — <b>ลูกหนี้กลับเป็นศูนย์</b> บิลปิดสนิท',
        note: 'ถ้าจ่ายด้วยบัตร ยอดจะเข้า 1130-05 ลูกหนี้บัตรเครดิต ไม่ใช่เงินสด เพราะเงินยังไม่ถึงมือจนธนาคารโอน',
        jv: { kind: 'STL', ttl: 'รับชำระและปิดบิล · ห้อง 301', ref: 'STL-CLOSE-BK-0464FE0F',
              lines: [[A.dep, DEP, 0], [A.cash, GROSS - DEP, 0], [A.ar, 0, GROSS]] }
      },
      {
        btn: 'ออกใบกำกับภาษี',
        say: 'ออกใบกำกับภาษีเต็มรูป — <b>ตัวเลขภาษีในสมุดบัญชียึดจากใบนี้ ไม่คำนวณใหม่</b> ' +
             'ปัดเศษคนละจังหวะแล้วต่างกันสตางค์เดียว ฝ่ายบัญชีก็กระทบยอดไม่ลง',
        note: 'เลขที่เรียงต่อเนื่องรายปีพุทธศักราชและห้ามข้าม — สรรพากรตรวจข้อนี้',
        inv: true
      },
      {
        btn: 'ส่งเข้าโปรแกรมบัญชี',
        say: 'ส่งเข้าระบบบัญชีคู่แล้ว 3 ใบสำคัญ · ทุกใบเดบิตเท่ากับเครดิต ' +
             'ปลายทางตอบ <b>202 รับไว้แล้ว</b> ไม่ใช่ 200 — เพราะรับข้อมูลกับลงบัญชีแยกจังหวะกันโดยเจตนา',
        note: 'ลำดับการส่งมาจากคิวของเราเอง ไม่ได้สร้างใหม่ทุกครั้งที่ยิง เน็ตหลุดแล้วส่งต่อจากเดิมได้',
        sent: true
      },
      {
        btn: 'ลองส่งซ้ำอีกรอบ',
        say: '<b>ถูกปฏิเสธที่ฝั่งเราก่อนออกจากบ้านด้วยซ้ำ</b> — รหัสประจำตัวของทุกเหตุการณ์มาจาก' +
             'เลขบิล ไม่ใช่จากเวลา ส่งกี่ครั้งรหัสก็เท่าเดิม และคิวไม่ยอมส่งของที่ส่งสำเร็จไปแล้ว',
        note: 'ไม่ฝากความถูกต้องไว้กับปลายทางฝ่ายเดียว — นี่คือจุดที่งบพังบ่อยที่สุดเวลาต่อสองระบบเข้าด้วยกัน',
        dup: true
      }
    ];

    var at = -1, sent = false, invoiced = false;

    function folio() {
      var paid = at >= 2 ? GROSS : (at >= 0 ? DEP : 0);
      var rows =
        '<tr><td>ค่าห้อง 301 · คืนวันที่ 13 ส.ค.</td><td class="num">' + st(N1) + '</td></tr>' +
        '<tr><td>ค่าห้อง 301 · คืนวันที่ 14 ส.ค. <span class="we" style="color:var(--red);font-size:.78rem">เรตวันหยุด</span></td><td class="num">' + st(N2) + '</td></tr>' +
        '<tr><td>อาหารและเครื่องดื่ม</td><td class="num">' + st(FNB) + '</td></tr>' +
        '<tr><td>มินิบาร์</td><td class="num">' + st(MINI) + '</td></tr>' +
        '<tr class="tot"><td>ยอดรวม · ราคานี้รวมภาษีแล้ว</td><td class="num">' + st(GROSS) + '</td></tr>' +
        '<tr><td>รับชำระแล้ว</td><td class="num">' + st(paid) + '</td></tr>' +
        '<tr class="' + (GROSS - paid > 0 ? 'due' : '') + '"><td>คงเหลือ</td><td class="num">' + st(GROSS - paid) + '</td></tr>';
      $('jvFolio').innerHTML = '<span class="lab">บิลห้อง 301 · คุณสมชาย ใจดี · 2 คืน</span>' +
        '<table>' + rows + '</table>';
    }

    function jvHtml(j) {
      var d = 0, c = 0;
      var body = j.lines.map(function (l) {
        d += l[1]; c += l[2];
        return '<tr><td class="acc">' + l[0][0] + '<i>' + l[0][1] + '</i></td>' +
          '<td class="num">' + (l[1] ? st(l[1]) : '') + '</td>' +
          '<td class="num">' + (l[2] ? st(l[2]) : '') + '</td></tr>';
      }).join('');
      return '<div class="jv"><div class="hd"><span class="kind">' + j.kind + '</span>' +
        '<span class="ttl">' + j.ttl + '</span><span class="meta">' + j.ref + '</span></div>' +
        '<table><thead><tr><th>บัญชี</th><th class="num">เดบิต</th><th class="num">เครดิต</th></tr></thead>' +
        '<tbody>' + body +
        '<tr class="bal"><td>' + (d === c ? 'ลงตัว' : 'ไม่ลงตัว — ส่งออกไม่ได้') + '</td>' +
        '<td class="num ' + (d === c ? 'ok' : '') + '">' + st(d) + '</td>' +
        '<td class="num ' + (d === c ? 'ok' : '') + '">' + st(c) + '</td></tr>' +
        '</tbody></table></div>';
    }

    function invHtml() {
      return '<div class="jv"><div class="hd"><span class="kind">ใบกำกับภาษี</span>' +
        '<span class="ttl">เต็มรูปตาม ม.86/4</span><span class="meta">INV-2569-00001</span></div>' +
        '<table><tbody>' +
        '<tr><td>มูลค่าสินค้าหรือบริการ</td><td class="num">' + st(BASE_ALL) + '</td></tr>' +
        '<tr><td>ภาษีมูลค่าเพิ่ม ' + VAT + '%</td><td class="num">' + st(VAT_ALL) + '</td></tr>' +
        '<tr class="bal"><td>จำนวนเงินรวมทั้งสิ้น</td><td class="num ok">' + st(GROSS) + '</td></tr>' +
        '<tr><td colspan="2" style="color:var(--muted);font-size:.82rem">' +
        '(สี่พันยี่สิบบาทถ้วน) · ฐาน + ภาษี = ยอดรวม เป๊ะเสมอ เศษจากการปัดยกให้ภาษี</td></tr>' +
        '</tbody></table></div>';
    }

    function render() {
      folio();
      var out = '';
      for (var i = 0; i <= at && i < STEPS.length; i++) {
        if (STEPS[i].jv) out += jvHtml(STEPS[i].jv);
        if (STEPS[i].inv) out += invHtml();
      }
      if (sent) {
        out += '<div class="stmt"><span class="lab">ผลการส่งเข้าโปรแกรมบัญชี</span>' +
          'ลำดับ <code>1 · 2 · 3</code> → รับไว้แล้ว 3 รายการ · ล้มเหลว 0<br>' +
          'รหัสกันซ้ำ <code>DEP-PY-8A31F0C2 · NA-2026-08-14-BK-0464FE0F · STL-CLOSE-BK-0464FE0F</code></div>';
      }
      $('jvBook').innerHTML = out;

      var btns = root.querySelectorAll('#jvSteps button[data-step]');
      btns.forEach(function (b, i) {
        b.classList.toggle('done', i <= at);
        if (i === at) b.setAttribute('aria-pressed', 'true');
        else b.removeAttribute('aria-pressed');
        b.disabled = i > at + 1;
      });
    }

    function say(m, note, kind) {
      var e = $('jvSay');
      e.className = 'say' + (kind ? ' ' + kind : '');
      e.innerHTML = m + (note ? '<br><span style="color:var(--muted);font-size:.85rem">' + note + '</span>' : '');
    }

    root.querySelectorAll('#jvSteps button[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.getAttribute('data-step');
        if (i > at + 1) return;
        at = i;
        var s = STEPS[i];
        if (s.inv) invoiced = true;
        if (s.sent) sent = true;
        render();
        say(s.say, s.note, s.dup ? 'bad' : 'good');
      });
    });

    root.querySelector('[data-jvreset]').addEventListener('click', function () {
      at = -1; sent = false; invoiced = false; render();
      say('เริ่มใหม่แล้ว · กดปุ่ม 1 เพื่อเดินเงินอีกรอบ');
    });

    render();
  })();

  /* ══ งบกำไรขาดทุนและจุดคุ้มทุน ═══════════════════════════ */
  (function () {
    var root = $('p-pnl'); if (!root) return;
    var occ = 28, adr = 1343, direct = 26;
    var ROOMS = 43, NIGHTS = 30;
    /* รายจ่ายคงที่ต่อเดือน — ระดับโรงแรม 43 ห้องในต่างจังหวัด */
    var FIXED = 690000;                 // เงินเดือน ค่าเช่า ประกัน ดอกเบี้ย
    var PER_ROOM = 210;                 // ผ้า ของใช้ ทำความสะอาด ค่าน้ำค่าไฟผันแปร
    var OTA_FEE = 16;                   // ค่านายหน้าเฉลี่ยของส่วนที่ไม่ได้จองตรง

    function calc() {
      var sold = occ * NIGHTS;
      var revRoom = sold * adr;
      var revFnb = Math.round(revRoom * 0.21);
      var rev = revRoom + revFnb;
      var otaRooms = Math.round(sold * (100 - direct) / 100);
      var comm = Math.round(otaRooms * adr * OTA_FEE / 100);
      var varCost = sold * PER_ROOM;
      var exp = FIXED + varCost + comm;
      var profit = rev - exp;
      /* จุดคุ้มทุน — ต้องขายกี่ห้องต่อคืนถึงกลบรายจ่าย
         กำไรส่วนเกินต่อห้อง = ราคาห้อง + อาหารที่พ่วงมา − ต้นทุนผันแปร − ค่านายหน้า */
      var contrib = adr * 1.21 - PER_ROOM - (adr * OTA_FEE / 100) * (100 - direct) / 100;
      var be = contrib > 0 ? Math.ceil(FIXED / NIGHTS / contrib) : null;
      return {
        sold: sold, rev: rev, revRoom: revRoom, revFnb: revFnb, exp: exp, comm: comm,
        profit: profit, margin: rev ? Math.round(profit / rev * 100) : 0,
        revpar: Math.round(revRoom / (ROOMS * NIGHTS)), occPct: Math.round(occ / ROOMS * 100), be: be
      };
    }

    function render() {
      var r = calc();
      $('pnlCards').innerHTML =
        '<div><span class="k">รายได้รวม 30 คืน</span><b>' + bt(r.rev) + '</b><span class="sub">ห้อง ' + bt(r.revRoom) + ' · อาหาร ' + bt(r.revFnb) + '</span></div>' +
        '<div><span class="k">รายจ่ายรวม</span><b>' + bt(r.exp) + '</b><span class="sub">รวมค่านายหน้า ' + bt(r.comm) + '</span></div>' +
        '<div class="' + (r.profit >= 0 ? 'up' : 'down') + '"><span class="k">' + (r.profit >= 0 ? 'กำไร' : 'ขาดทุน') + '</span><b>' + bt(Math.abs(r.profit)) + '</b><span class="sub">' + r.margin + '% ของรายได้</span></div>' +
        '<div><span class="k">RevPAR</span><b>' + bt(r.revpar) + '</b><span class="sub">เข้าพัก ' + r.occPct + '% · ' + r.sold + ' ห้อง-คืน</span></div>';

      var total = r.exp + Math.max(r.profit, 0);
      var pc = total ? Math.round(r.exp / total * 100) : 100;
      $('pnlBar').innerHTML = '<i class="cost" style="width:' + Math.min(pc, 100) + '%"></i>' +
        '<i class="prof" style="width:' + Math.max(100 - pc, 0) + '%"></i>';

      var e = $('pnlSay');
      if (r.be === null) {
        e.className = 'say bad';
        e.innerHTML = '<b>ราคานี้ขายเท่าไรก็ไม่คุ้ม</b> — กำไรส่วนเกินต่อห้องติดลบหลังหักต้นทุนผันแปรและค่านายหน้า';
        return;
      }
      var ok = occ >= r.be;
      e.className = 'say ' + (ok ? 'good' : 'bad');
      /* ประโยคปิดท้ายต้องพูดตามสถานะที่กดอยู่จริง ไม่ใช่ชวนทำสิ่งที่ทำไปแล้ว */
      var tail = direct < 50
        ? ' · ลองดันจองตรงจาก ' + direct + '% เป็น 50% แล้วดูว่าจุดคุ้มทุนลดลงกี่ห้อง — นั่นคือค่านายหน้าที่ไม่ต้องจ่ายอีกต่อไป'
        : ' · ที่จองตรง 50% ค่านายหน้าเหลือ ' + bt(r.comm) + ' ต่อเดือน — ทุกจุดที่ดันจองตรงขึ้นได้ คือกำไรที่ไม่ต้องแบ่งใคร';
      e.innerHTML = '<b>ต้องขายให้ได้ ' + r.be + ' ห้องต่อคืน ถึงจะไม่ขาดทุน</b> — ' +
        'ตอนนี้ขายได้ ' + occ + ' ห้อง ' + (ok ? 'อยู่เหนือจุดคุ้มทุน ' + (occ - r.be) + ' ห้อง' : 'ยังขาดอีก ' + (r.be - occ) + ' ห้อง') +
        tail;
    }

    function group(attr, set) {
      var b = root.querySelectorAll('button[' + attr + ']');
      b.forEach(function (x) {
        x.addEventListener('click', function () {
          b.forEach(function (y) { y.removeAttribute('aria-pressed'); });
          x.setAttribute('aria-pressed', 'true');
          set(+x.getAttribute(attr)); render();
        });
      });
    }
    group('data-occ', function (v) { occ = v; });
    group('data-adr', function (v) { adr = v; });
    group('data-dir', function (v) { direct = v; });
    render();
  })();
})();

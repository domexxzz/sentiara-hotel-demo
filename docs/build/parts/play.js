/* ตัวอย่างที่กดเล่นได้ทั้งห้าอัน
   ตรรกะทุกตัวคัดมาจากระบบจริง ไม่ได้เขียนขึ้นใหม่ให้ดูดีในหน้านำเสนอ —
   เรตวันหยุด การถอด VAT การกันจองซ้ำ การจัดห้องติดกัน และด่านกรองสี่ชั้น
   คิดด้วยกติกาชุดเดียวกับที่ระบบใช้จริง                                    */
(function () {
  'use strict';
  var baht = function (n) { return '฿' + Math.round(n).toLocaleString('en-US'); };
  var $ = function (id) { return document.getElementById(id); };

  /* ── ตัวช่วยกลุ่มปุ่มเลือกค่า ─────────────────────────────── */
  function pickGroup(scope, attr, onPick) {
    var btns = scope.querySelectorAll('button[' + attr + ']');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.removeAttribute('aria-pressed'); });
        b.setAttribute('aria-pressed', 'true');
        onPick(b.getAttribute(attr));
      });
    });
  }

  /* ══ 1 · ปฏิทินกันจองซ้ำ ═════════════════════════════════ */
  (function () {
    var root = $('p-cal'); if (!root) return;
    var ROOMS = ['201', '202', '203', '204'];
    var N = 10;
    var START = new Date(2026, 7, 14);            // 14 ส.ค. 2026 = ศุกร์
    var DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    var taken, mine;

    function dateOf(i) { var d = new Date(START); d.setDate(d.getDate() + i); return d; }
    function isWeekend(i) { var g = dateOf(i).getDay(); return g === 5 || g === 6; }

    function seed() {
      taken = {}; mine = {};
      [['201', 1], ['201', 2], ['202', 0], ['202', 5], ['203', 3], ['203', 4],
       ['204', 6], ['204', 7], ['201', 8]].forEach(function (p) { taken[p[0] + ':' + p[1]] = true; });
    }

    function draw() {
      var head = $('calHead'), body = $('calBody');
      head.innerHTML = '<th scope="col">ห้อง</th>';
      for (var i = 0; i < N; i++) {
        var d = dateOf(i);
        head.insertAdjacentHTML('beforeend',
          '<th scope="col" class="' + (isWeekend(i) ? 'we' : '') + '">' +
          DOW[d.getDay()] + '<br>' + d.getDate() + '</th>');
      }
      body.innerHTML = '';
      ROOMS.forEach(function (r) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<th scope="row">' + r + '</th>';
        for (var i = 0; i < N; i++) {
          var k = r + ':' + i;
          var cls = taken[k] ? 'taken' : (mine[k] ? 'mine' : '');
          var label = taken[k] ? 'จองแล้ว' : (mine[k] ? 'ของคุณ' : '+');
          tr.insertAdjacentHTML('beforeend',
            '<td class="' + cls + '" data-k="' + k + '">' +
            '<button type="button" aria-label="ห้อง ' + r + ' คืนวันที่ ' + dateOf(i).getDate() + '">' +
            label + '</button></td>');
        }
        body.appendChild(tr);
      });
    }

    function say(msg, kind) {
      var el = $('calSay');
      el.className = 'say' + (kind ? ' ' + kind : '');
      el.innerHTML = msg;
    }

    $('calBody').addEventListener('click', function (e) {
      var btn = e.target.closest('button'); if (!btn) return;
      var td = btn.closest('td'), k = td.getAttribute('data-k');
      var parts = k.split(':'), room = parts[0], night = +parts[1];
      var d = dateOf(night);

      if (taken[k]) {
        td.classList.add('bump');
        setTimeout(function () { td.classList.remove('bump'); }, 340);
        var free = ROOMS.filter(function (r) { return !taken[r + ':' + night] && !mine[r + ':' + night]; });
        say('<b>จองไม่ได้</b> — ห้อง ' + room + ' คืนวันที่ ' + d.getDate() +
            ' มีคนจองแล้ว' + (free.length
              ? ' · คืนนั้นยังเหลือห้อง ' + free.join(' · ') + ' เสนอให้แขกแทนได้ทันที'
              : ' และคืนนั้นเต็มทุกห้องแล้ว'), 'bad');
        return;
      }
      if (mine[k]) { delete mine[k]; draw(); say('ยกเลิกการจองแล้ว · ห้องกลับไปขายได้ทันที'); return; }

      mine[k] = true; draw();
      var rate = isWeekend(night) ? 1980 : 1650;
      say('จองห้อง ' + room + ' คืนวันที่ ' + d.getDate() + ' แล้ว · ' +
          (isWeekend(night) ? '<b>คืนศุกร์–เสาร์ เรตวันหยุด ' + baht(rate) + '</b>'
                            : 'วันธรรมดา ' + baht(rate)) +
          ' · ห้องนี้หายจากทุกช่องทางขายทันที', 'good');
    });

    /* จัดห้องติดกัน — ลำดับเดียวกับระบบจริง
       ติดกันบนชั้นเดียว → ชั้นเดียวแต่ไม่ติด → คนละชั้น และบอกตามจริงเสมอ */
    root.querySelectorAll('button[data-adj]').forEach(function (b) {
      b.addEventListener('click', function () {
        var want = +b.getAttribute('data-adj');
        var night = 0;
        while (night < N) {
          var free = ROOMS.filter(function (r) { return !taken[r + ':' + night] && !mine[r + ':' + night]; });
          var run = [];
          for (var i = 0; i < free.length; i++) {
            if (run.length === 0 || +free[i] === +run[run.length - 1] + 1) run.push(free[i]);
            else run = [free[i]];
            if (run.length === want) break;
          }
          if (run.length === want) {
            run.forEach(function (r) { mine[r + ':' + night] = true; });
            draw();
            say('จัดห้องติดกันได้ <b>' + run.join(' · ') + '</b> คืนวันที่ ' + dateOf(night).getDate() +
                ' — ครอบครัวที่จองหลายห้องถามข้อนี้เป็นข้อแรกเสมอ', 'good');
            return;
          }
          night++;
        }
        say('<b>ช่วงนี้จัดห้องติดกัน ' + want + ' ห้องไม่ได้เลย</b> — ' +
            'ระบบบอกตามจริงตั้งแต่ตอนขาย ดีกว่าไปเซอร์ไพรส์แขกที่เคาน์เตอร์', 'bad');
      });
    });

    root.querySelector('[data-calreset]').addEventListener('click', function () {
      seed(); draw(); say('เริ่มใหม่แล้ว · ห้องที่มีสีคือมีคนจองอยู่ก่อน');
    });

    seed(); draw();
  })();

  /* ══ 2 · เรตรายคืนและการถอด VAT ══════════════════════════ */
  (function () {
    var root = $('p-rate'); if (!root) return;
    var rate = 1650, wk = 20, vat = 7;
    var START = new Date(2026, 7, 13);            // 13 ส.ค. = พฤหัส → ครอบศุกร์เสาร์
    var DOW = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    var NIGHTS = 4;

    /* หารแล้วปัดครึ่งขึ้นด้วยจำนวนเต็มล้วน — ไม่แตะเลขทศนิยมเลย
       เพราะ 0.1 + 0.2 ไม่เท่ากับ 0.3 และความคลาดเคลื่อนสะสมจนงบไม่ลง */
    function halfUp(n, d) { return Math.floor((n * 2 + d) / (2 * d)); }

    function render() {
      var body = $('rateBody'); body.innerHTML = '';
      var totalSatang = 0;
      for (var i = 0; i < NIGHTS; i++) {
        var d = new Date(START); d.setDate(d.getDate() + i);
        var we = d.getDay() === 5 || d.getDay() === 6;
        var r = we ? halfUp(rate * 100 * (100 + wk), 100) : rate * 100;
        totalSatang += r;
        body.insertAdjacentHTML('beforeend',
          '<tr><td>' + d.getDate() + ' ส.ค.</td><td>' + DOW[d.getDay()] +
          (we ? ' <span class="we">· เรตวันหยุด</span>' : '') + '</td>' +
          '<td class="num">' + baht(r / 100) + '</td></tr>');
      }
      body.insertAdjacentHTML('beforeend',
        '<tr class="sum"><td colspan="2">รวม ' + NIGHTS + ' คืน · ราคานี้รวมภาษีแล้ว</td>' +
        '<td class="num">' + baht(totalSatang / 100) + '</td></tr>');

      /* ถอด VAT ออกจากยอดรวม ไม่ใช่บวกเพิ่ม — ตาม ม.86/4 (6)
         ส่วนต่างจากการปัดยกให้ภาษีเสมอ ฐาน + ภาษี จึงเท่ากับยอดรวมเป๊ะ */
      var base = vat > 0 ? halfUp(totalSatang * 100, 100 + vat) : totalSatang;
      var tax = totalSatang - base;
      $('rateSay').innerHTML = vat === 0
        ? 'ยังไม่จด VAT — ใบเสร็จแสดงยอดเต็ม ' + baht(totalSatang / 100) + ' ไม่มีบรรทัดภาษี'
        : 'ใบกำกับภาษีจะแสดง <b>มูลค่าสินค้า ' + baht(base / 100) + '</b> + <b>ภาษี ' +
          vat + '% ' + baht(tax / 100) + '</b> = <b>' + baht(totalSatang / 100) + '</b>' +
          ' — ถอดออกจากยอด ไม่ใช่บวกเพิ่ม ถ้าบวกเพิ่มจะเก็บแขกเกิน ' + baht(tax / 100);
    }

    pickGroup(root, 'data-rate', function (v) { rate = +v; render(); });
    pickGroup(root, 'data-wk', function (v) { wk = +v; render(); });
    pickGroup(root, 'data-vat', function (v) { vat = +v; render(); });
    render();
  })();

  /* ══ 3 · ซิงก์ช่องทางขาย ═════════════════════════════════ */
  (function () {
    var root = $('p-chan'); if (!root) return;
    /* ค่านายหน้าเป็นช่วงที่พบจริงในตลาดไทย ใช้เป็นตัวอย่างสาธิต
       ของจริงตั้งตามสัญญาที่โรงแรมเซ็นกับแต่ละช่องทาง */
    var CH = [
      { n: 'จองตรงกับโรงแรม', fee: 0, direct: true },
      { n: 'Agoda', fee: 18 },
      { n: 'Booking.com', fee: 15 },
      { n: 'Traveloka', fee: 15 },
      { n: 'Expedia', fee: 18 },
      { n: 'Airbnb', fee: 14 },
      { n: 'Trip.com', fee: 15 }
    ];
    var price = 1650, rooms = 8, pushed = false;

    function render() {
      $('chanList').innerHTML = CH.map(function (c) {
        var net = Math.round(price * (100 - c.fee) / 100);
        return '<div class="' + (c.direct ? 'direct' : '') + '">' +
          '<span class="nm"><i class="dot' + (pushed ? ' on' : '') + '"></i>' + c.n + '</span>' +
          '<span class="fee">' + (c.fee ? 'ค่านายหน้า ' + c.fee + '%' : 'ไม่มีค่านายหน้า') + '</span>' +
          '<span class="amt">' + (pushed ? baht(net) : '—') + '</span></div>';
      }).join('');
    }

    function say(m, k) { var e = $('chanSay'); e.className = 'say' + (k ? ' ' + k : ''); e.innerHTML = m; }

    root.querySelector('[data-push]').addEventListener('click', function () {
      pushed = true; render();
      var lose = Math.round(price * 18 / 100);
      say('ส่งราคา ' + baht(price) + ' ออกไปครบทั้ง 7 ช่องทางในครั้งเดียว · ' +
          'ห้องเดียวกันขายผ่านช่องทางไหนก็ได้ แต่ขายซ้ำไม่ได้ · ' +
          '<b>ทุกห้องที่ขายผ่าน Agoda แทนที่จะจองตรง หายไป ' + baht(lose) + ' ต่อคืน</b>', 'good');
    });

    root.querySelector('[data-sell]').addEventListener('click', function () {
      if (rooms <= 0) { say('<b>ห้องหมดแล้ว</b> — ทุกช่องทางปิดขายพร้อมกันโดยไม่ต้องรอรอบซิงก์', 'bad'); return; }
      rooms--;
      say('มีคนจอง 1 ห้องผ่าน Agoda · เหลือ <b>' + rooms + ' ห้อง</b> — ' +
          'ระบบปิดขายห้องนั้นบนอีก 6 ช่องทางทันที และตั้งค่านายหน้า ' +
          baht(price * 18 / 100) + ' เข้าหมวดรายจ่ายให้เอง' +
          (rooms === 0 ? ' · <b>ตอนนี้เต็มแล้ว</b>' : ''), rooms === 0 ? 'bad' : 'good');
    });

    root.querySelector('[data-creset]').addEventListener('click', function () {
      pushed = false; rooms = 8; render(); say('เริ่มใหม่ · ห้องว่างคืนนี้ 8 ห้อง');
    });

    pickGroup(root, 'data-cprice', function (v) {
      price = +v;
      if (pushed) { render(); say('ราคาเปลี่ยนเป็น ' + baht(price) + ' แล้ว — กดส่งอีกครั้งเพื่อผลักออกไปทุกช่องทาง'); }
      else render();
    });

    render();
  })();

  /* ══ 4 · ด่านกรองสี่ชั้น ═════════════════════════════════ */
  (function () {
    var root = $('p-guard'); if (!root) return;

    var GATES = [
      { n: 'ด่าน 1 · เรื่องที่ต้องให้คนตอบ', d: 'ต่อรองราคา คืนเงิน ร้องเรียน จัดงาน — ตรวจก่อนเรียกโมเดลด้วยซ้ำ' },
      { n: 'ด่าน 2 · หน้าต่างเวลาของช่องทาง', d: 'แชตของ OTA ผูกกับการจอง จองจบแล้วสายปิด ต้องรู้ก่อนร่างคำตอบ' },
      { n: 'ด่าน 3 · ข้อเท็จจริงที่อ้างได้', d: 'ดึงปฏิทินและเรตจริงมาก่อน ดึงไม่สำเร็จคือห้ามพูดตัวเลขใด ๆ' },
      { n: 'ด่าน 4 · อ่านคำตอบกลับมาตรวจ', d: 'เทียบตัวเลขและคำว่าว่าง/เต็ม กับข้อมูลจริงก่อนถึงตาแขก' }
    ];

    var CASES = [
      { b: 'คืนนี้ยังมีห้องว่างไหมคะ', in: 'คืนนี้ยังมีห้องว่างไหมคะ',
        draft: 'คืนนี้ยังว่างอยู่ 4 ห้องครับ เริ่มต้น ฿1,650 ต่อคืน',
        fail: 0, ok: 'ผ่านครบสี่ด่าน — ส่งออกได้เลย ตัวเลข 4 ห้องกับ ฿1,650 มาจากปฏิทินและเรตจริงในระบบ' },
      { b: 'ลดราคาหน่อยได้ไหม', in: 'ลดราคาหน่อยได้ไหมครับ พอดีมากันหลายคน',
        draft: 'ได้ครับ เดี๋ยวจัดราคาพิเศษให้นะครับ',
        fail: 1, why: 'ลูกค้าพิมพ์เรื่อง “ต่อรองราคา” — เรื่องแบบนี้ให้คนตอบเสมอ ส่วนลดคือเงินของเจ้าของ' },
      { b: 'บอทแต่งราคาเอง', in: 'ห้องดีลักซ์คืนละเท่าไรครับ',
        draft: 'ได้เลยครับ คืนนี้ยังว่างอยู่ ราคาพิเศษ ฿990 ต่อคืนครับ',
        fail: 4, why: 'คำตอบพูดถึง ฿990 ซึ่งไม่มีในเรตจริง — ระบบมีแค่ ฿1,650 กับ ฿1,980 · ตอบราคาผิดคือข้อผูกพันที่โรงแรมต้องรับผิดชอบ' },
      { b: 'บอทรับปากแทนโรงแรม', in: 'ขอห้องวิวสระได้ไหมครับ',
        draft: 'ได้เลยครับ เดี๋ยวอัปเกรดให้เป็นห้องวิวสระว่ายน้ำนะครับ',
        fail: 4, why: 'คำตอบมีคำว่า “อัปเกรดให้” ซึ่งเป็นการรับปากที่ต้องให้พนักงานเป็นคนให้ ไม่ใช่บอท' },
      { b: 'บอทบอกเต็มทั้งที่ว่าง', in: 'พรุ่งนี้ยังมีห้องไหมครับ',
        draft: 'ขออภัยครับ คืนนี้ห้องเต็มแล้วครับ',
        fail: 4, why: 'คำตอบบอกว่าเต็ม แต่ปฏิทินยังเหลือ 4 ห้อง — เสียการขายฟรี ๆ โดยไม่มีใครรู้ว่าเสีย' },
      { b: 'แชต Agoda ที่ปิดไปแล้ว', in: 'ขอใบเสร็จย้อนหลังครับ (แชต Agoda · การจองจบแล้ว)',
        draft: 'ได้ครับ เดี๋ยวส่งใบเสร็จให้ทางนี้นะครับ',
        fail: 2, why: 'แชต agoda ผูกกับการจองที่ปิดไปแล้ว ส่งออกไม่ได้ — ถ้าไม่รู้ก่อน ข้อความจะหายเงียบ ๆ แล้วแขกคิดว่าโรงแรมไม่ตอบ' }
    ];

    $('msgPick').innerHTML = CASES.map(function (c, i) {
      return '<button type="button" data-c="' + i + '"' + (i === 0 ? ' aria-pressed="true"' : '') + '>' + c.b + '</button>';
    }).join('');

    function show(i) {
      var c = CASES[i];
      $('guardIn').innerHTML = '<span class="lab">ข้อความจากลูกค้า</span>' + c.in;
      $('guardDraft').innerHTML = '<span class="lab">คำตอบที่บอทร่างไว้</span>' + c.draft;

      $('guardGates').innerHTML = GATES.map(function (g, gi) {
        var n = gi + 1, cls, vd;
        if (c.fail === 0) { cls = 'pass'; vd = 'ผ่าน'; }
        else if (n < c.fail) { cls = 'pass'; vd = 'ผ่าน'; }
        else if (n === c.fail) { cls = 'fail'; vd = 'ไม่ผ่าน'; }
        else { cls = 'idle'; vd = 'ไม่ได้ตรวจ'; }
        return '<div class="' + cls + '"><span class="g">' + n + '</span>' +
          '<span><span class="nm">' + g.n.replace(/^ด่าน \d+ · /, '') + '</span>' +
          '<span class="why">' + (n === c.fail ? c.why : g.d) + '</span></span>' +
          '<span class="vd">' + vd + '</span></div>';
      }).join('');

      var s = $('guardSay');
      if (c.fail === 0) {
        s.className = 'say good';
        s.innerHTML = '<b>ส่งออกอัตโนมัติ</b> — ' + c.ok;
      } else {
        s.className = 'say bad';
        s.innerHTML = '<b>ไม่ส่ง · ส่งต่อให้พนักงานพร้อมเหตุผล</b> — ' +
          'การสั่งในคำสั่งระบบว่า “ห้ามแต่งราคา” เป็นการขอร้อง ด่านนี้คือคำตัดสิน';
      }
    }

    pickGroup(root, 'data-c', function (v) { show(+v); });
    show(0);
  })();

  /* ══ 5 · Green Points เทียบ Trip Points ══════════════════ */
  (function () {
    var root = $('p-chiva'); if (!root) return;
    var G0 = 1850, T0 = 790;
    var g = G0, t = T0, verified = 0;

    function paint() {
      $('wG').textContent = g.toLocaleString('en-US');
      $('wT').textContent = t.toLocaleString('en-US');
    }
    function say(m, k) { var e = $('chivaSay'); e.className = 'say' + (k ? ' ' + k : ''); e.innerHTML = m; }

    /* รหัสตรวจสอบจำลอง — ของจริงเป็นไดเจสต์ของเนื้อใบรับรอง
       แก้เนื้อเมื่อไรรหัสไม่ตรง แล้วระบบปฏิเสธการอ่านใบนั้น */
    function digest() {
      var s = 'chivago:' + g + ':' + t + ':' + verified, h = 0x811c9dc5;
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
      return ('00000000' + h.toString(16)).slice(-8) + ('00000000' + ((h ^ 0x5bf03635) >>> 0).toString(16)).slice(-8);
    }

    root.querySelectorAll('button[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-act');
        $('chivaStmt').hidden = true;

        if (a === 'self') {
          t += 80; paint();
          say('เช็กอินด้วยตัวเองที่หาดเฉวง · ได้ <b>+80 Trip</b> — ' +
              'โทรศัพท์เป็นคนวัดเอง <b>ไม่มีใครตรวจ</b> จึงเป็นแต้มสีเหลือง ' +
              'แลกของรางวัลได้ แต่เอาไปเป็นหลักฐานในรายงานไม่ได้');
        } else if (a === 'host') {
          g += 250; verified++; paint();
          say('ร่วมกิจกรรมฟื้นป่าชายเลนที่ท้องกรูด → เข้าพื้นที่จริงตามพิกัด → ถ่ายรูปที่มีพิกัดติดมา → ' +
              '<b>โฮสต์ชื่อจริงกดอนุมัติ</b> · ได้ <b>+250 Green</b> — ' +
              'ระบบจ่ายครั้งเดียวเสมอแม้โฮสต์กดซ้ำ และแต้มนี้ใช้เป็นหลักฐานได้', 'good');
        } else if (a === 'stmt') {
          if (verified === 0) {
            say('<b>ออกใบรับรองไม่ได้</b> — ยังไม่มีกิจกรรมที่โฮสต์ยืนยันเลยสักรายการ · ' +
                'ใบรับรองรายงานได้เฉพาะสิ่งที่ตรวจแล้วเท่านั้น ลองกดปุ่มแดงก่อน', 'bad');
            return;
          }
          var el = $('chivaStmt');
          el.hidden = false;
          el.innerHTML = '<span class="lab">ใบรับรองสำหรับแนบรายงานของโรงแรม</span>' +
            'กิจกรรมที่โฮสต์ยืนยันแล้ว <b>' + verified + ' รายการ</b> · ' +
            'ผู้เข้าร่วม <b>1 คน</b> (คนเดียวทำหลายกิจกรรมนับเป็นหนึ่งคน)<br>' +
            'รหัสใบ <code>ST-2569-' + digest().slice(0, 6).toUpperCase() + '</code> · ' +
            'ไดเจสต์ <code>' + digest() + '</code><br>' +
            'ไม่มีช่องสำหรับยอดการมองเห็นหรือมูลค่าประเมิน และไม่มีช่อง tCO₂e — ' +
            'ใบนี้รายงานเฉพาะสิ่งที่มีคนยืนยันว่าเกิดขึ้นจริง';
          say('ออกใบรับรองแล้ว · <b>แก้ไม่ได้</b> — แก้เนื้อเมื่อไร ไดเจสต์ไม่ตรง ระบบปฏิเสธการอ่านใบนั้นทันที ' +
              'นี่คือสิ่งที่ตัวเลขที่โรงแรมกรอกเองทำไม่ได้', 'good');
        } else {
          g = G0; t = T0; verified = 0; paint();
          say('เริ่มใหม่แล้ว · ลองกดสองปุ่มซ้ายเทียบกัน');
        }
      });
    });

    paint();
  })();
})();

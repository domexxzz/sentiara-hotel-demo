/* ตัวอย่างกดเล่นอันที่แปด — คำถามจากเจ้าหน้าที่ตาม ม.26
   ช่องคำตอบฝั่งขวาเรียงตามลำดับเดียวกับที่ /wifi/report คืนค่าจริง
   (ผู้ใช้งาน · เอกสารแสดงตน · สัญชาติ · การจอง · ช่วงพัก · เครื่อง · ปริมาณ)
   ฝั่งซ้ายไม่ได้เขียนให้แย่เกินจริง — โรงแรมที่ใช้รหัสรวมทั้งตึกตอบได้
   แค่ว่ามีคนต่อจริง เพราะอุปกรณ์เห็นแค่ MAC ไม่มีใครผูก MAC กับคน  */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var root = $('p-wifi'); if (!root) return;

  var DEVICES = [
    {
      id: 'a', ip: '10.24.7.113', when: '21 ส.ค. 2569 · 23:41',
      mac: 'a4:83:e7:1c:9f:20', ap: 'AP-ชั้น4-ทางเดิน', mb: 812,
      name: 'Mr. James Whitfield', doc: 'พาสปอร์ต 536214897',
      nat: 'สหราชอาณาจักร', room: 'ห้อง 402 · การจอง BK-6F2A91',
      stay: '19–24 ส.ค. 2569 (กำลังพักอยู่)',
      tail: 'แจ้ง ตม.30 แล้ว 19 ส.ค. 2569 14:02'
    },
    {
      id: 'b', ip: '10.24.7.58', when: '21 ส.ค. 2569 · 09:12',
      mac: '3c:22:fb:04:8a:d1', ap: 'AP-ชั้น2-ลิฟต์', mb: 145,
      name: 'นางสาวกัญญารัตน์ พงษ์ไพบูลย์', doc: 'บัตรประชาชน 1-1017-00207-25-1',
      nat: 'ไทย', room: 'ห้อง 207 · การจอง BK-71C0D4',
      stay: '20–22 ส.ค. 2569 (กำลังพักอยู่)',
      tail: 'คนไทย ไม่เข้าเงื่อนไข ตม.30'
    },
    {
      id: 'c', ip: '10.24.7.201', when: '12 ก.ค. 2569 · 02:07',
      mac: 'f0:18:98:77:12:6e', ap: 'AP-ชั้น5-ห้องพัก', mb: 2394,
      name: 'Mr. Chen Wei Lin', doc: 'พาสปอร์ต E48127395',
      nat: 'จีน', room: 'ห้อง 508 · การจอง BK-4B8E07',
      stay: '10–13 ก.ค. 2569 (เช็กเอาต์ไปแล้ว 41 วัน)',
      tail: 'ยังอยู่ในช่วงเก็บ 90 วัน · เหลืออีก 49 วันจึงลบได้'
    }
  ];

  var LABELS = ['ผู้ใช้งาน', 'เอกสารแสดงตน', 'สัญชาติ', 'การจอง', 'ช่วงเข้าพัก', 'เครื่อง', 'ปริมาณข้อมูล'];

  var CANT = [
    ['ผู้ใช้งาน', 'ตอบไม่ได้ — ทุกคนใช้รหัสเดียวกัน'],
    ['เอกสารแสดงตน', 'ตอบไม่ได้ — ไม่เคยผูกกับใคร'],
    ['สัญชาติ', 'ตอบไม่ได้'],
    ['การจอง', 'ตอบไม่ได้ — ไม่รู้ว่าห้องไหน'],
    ['ช่วงเข้าพัก', 'ตอบไม่ได้'],
    ['เครื่อง', null],
    ['ปริมาณข้อมูล', null]
  ];

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function mb(n) {
    return n >= 1024 ? (n / 1024).toFixed(1) + ' GB' : n + ' MB';
  }
  function rows(pairs) {
    return '<div class="kv">' + pairs.map(function (p) {
      return '<div><span class="q">' + esc(p[0]) + '</span>' +
        '<span class="a' + (p[2] ? ' no' : '') + '">' + p[1] + '</span></div>';
    }).join('') + '</div>';
  }

  function draw(d) {
    $('wifiOld').innerHTML = rows(CANT.map(function (p) {
      if (p[1] === null) {
        return p[0] === 'เครื่อง'
          ? [p[0], '<code>' + esc(d.mac) + '</code>', false]
          : [p[0], esc(mb(d.mb)) + ' — รู้ปริมาณ แต่ไม่รู้ว่าใครใช้', false];
      }
      return [p[0], esc(p[1]), true];
    })) +
      '<div class="verdict no">ส่งให้เจ้าหน้าที่ได้: ไม่มีอะไรที่โยงกลับไปหาคนได้' +
      '<span>เข้าข่ายไม่ปฏิบัติตาม ม.26 · ปรับไม่เกิน 500,000 บาท</span></div>';

    $('wifiNew').innerHTML = rows([
      [LABELS[0], esc(d.name), false],
      [LABELS[1], esc(d.doc), false],
      [LABELS[2], esc(d.nat), false],
      [LABELS[3], esc(d.room), false],
      [LABELS[4], esc(d.stay), false],
      [LABELS[5], '<code>' + esc(d.mac) + '</code> · ' + esc(d.ap), false],
      [LABELS[6], esc(mb(d.mb)), false]
    ]) +
      '<div class="verdict ok">ส่งให้เจ้าหน้าที่ได้: ครบทั้งชุด พร้อมเลขเอกสารแสดงตน' +
      '<span>' + esc(d.tail) + '</span></div>';

    var say = $('wifiSay');
    say.className = 'say good';
    say.innerHTML = '<b>' + esc(d.ip) + ' เมื่อ ' + esc(d.when) + '</b> — ' +
      (d.id === 'c'
        ? 'เครื่องนี้เช็กเอาต์ไปเดือนกว่าแล้ว ระบบยังตอบได้ เพราะกฎหมายกำหนดให้เก็บ 90 วัน ' +
          'และระบบจะปฏิเสธถ้าใครตั้งให้ลบเร็วกว่านั้น'
        : 'ระบบเดินย้อนจาก IP ไปหา session · จาก session ไปหาการจอง · ' +
          'จากการจองไปหาทะเบียนผู้พัก ทั้งหมดเป็นข้อมูลชุดเดียวกันที่ใช้เช็กอิน ไม่ต้องกรอกซ้ำที่ไหน');
  }

  function reset() {
    $('wifiOld').innerHTML = '<p class="idle">กดเลือกเครื่องด้านบน</p>';
    $('wifiNew').innerHTML = '<p class="idle">กดเลือกเครื่องด้านบน</p>';
    var say = $('wifiSay');
    say.className = 'say';
    say.innerHTML = 'สมมุติว่าเจ้าหน้าที่มีหมายมาถามถึงหมายเลข IP หนึ่งกับเวลาหนึ่ง — ' +
      'คำถามจริงมาแบบนี้ ไม่ได้มาเป็นชื่อคน';
  }

  var pick = $('wifiPick');
  pick.innerHTML = DEVICES.map(function (d) {
    return '<button type="button" data-dev="' + d.id + '">' + esc(d.ip) + ' · ' + esc(d.when) + '</button>';
  }).join('');

  var btns = pick.querySelectorAll('button[data-dev]');
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      btns.forEach(function (x) { x.removeAttribute('aria-pressed'); });
      b.setAttribute('aria-pressed', 'true');
      var id = b.getAttribute('data-dev');
      for (var i = 0; i < DEVICES.length; i++) if (DEVICES[i].id === id) return draw(DEVICES[i]);
    });
  });

  reset();
})();

/* ASTRA — พฤติกรรมของหน้า สำหรับคนที่ยืนนำเสนออยู่จริง

   สี่อย่าง ไม่มีอย่างที่ห้า
     1. แถบวัดความคืบหน้า + ตัวนับ "หัวข้อที่เท่าไรจาก 14"
     2. ปุ่มลัดคีย์บอร์ด — กดข้ามหัวข้อได้โดยไม่ต้องหาสกรอลล์กลางประโยค
     3. การเผยตัวเมื่อเลื่อนถึง ใส่คลาสด้วย JS ไม่ใช่เขียนใน HTML
        ถ้าไฟล์นี้พังหรือถูกบล็อก เนื้อหาต้องยังเห็นครบทั้งหน้า
     4. สลับกลางวัน/กลางคืน จำค่าไว้ในเครื่องคนนำเสนอ

   ของเดิมมีตัวเน้นเลขหัวข้อบนแถบอยู่แล้ว (IntersectionObserver ในเทมเพลต)
   ไฟล์นี้ไม่แตะ ทำงานคู่กันได้                                          */
(function () {
  'use strict';

  var groups = [].slice.call(document.querySelectorAll('section.grp'));
  var root = document.documentElement;

  /* ── 1 · แถบวัดและตัวนับ ─────────────────────────────────── */
  var meter = document.querySelector('.rail .meter');
  var count = document.querySelector('.rail .count b');

  function gauge() {
    if (!meter) return;
    var h = document.documentElement.scrollHeight - innerHeight;
    meter.style.width = (h > 0 ? Math.min(100, (scrollY / h) * 100) : 0) + '%';
  }
  addEventListener('scroll', gauge, { passive: true });
  addEventListener('resize', gauge);

  /* ตัวนับหัวข้อ — เกาะไปกับ aria-current ที่ตัวเน้นของเดิมตั้งไว้
     ไม่คิดเอง เพราะกฎสองชุดจะให้คำตอบต่างกันตรงรอยต่อหัวข้อ แล้วคนดู
     จะเห็นเลขสองตัวขัดกันอยู่ข้างกันบนจอ
     และไม่อ่านตอน scroll เพราะ handler ของ scroll วิ่ง **ก่อน**
     IntersectionObserver จะอัปเดตค่า — อ่านตอนนั้นได้ค่าของหัวข้อก่อนหน้า
     ตัวนับจึงช้ากว่าแถบหนึ่งจังหวะตลอด (เจอมาแล้ว) */
  function sync() {
    if (!count) return;
    var on = document.querySelector('.rail nav a[aria-current="true"]');
    count.textContent = on ? on.textContent : '——';
  }
  if (count && 'MutationObserver' in window) {
    new MutationObserver(sync).observe(document.querySelector('.rail nav'), {
      attributes: true, attributeFilter: ['aria-current'], subtree: true,
    });
  }

  /* ── 2 · ปุ่มลัด ─────────────────────────────────────────── */
  function jump(dir) {
    var y = scrollY, best = null;
    for (var i = 0; i < groups.length; i++) {
      var top = groups[i].getBoundingClientRect().top + y - 58;
      if (dir > 0 ? top > y + 8 : top < y - 8) {
        if (best === null || (dir > 0 ? top < best : top > best)) best = top;
      }
    }
    if (best === null) best = dir > 0 ? document.body.scrollHeight : 0;
    scrollTo({ top: Math.max(0, best), behavior: 'smooth' });
  }

  var hint = document.querySelector('.keys');
  var hintTimer;
  function flash() {
    if (!hint) return;
    hint.classList.add('on');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { hint.classList.remove('on'); }, 2600);
  }

  addEventListener('keydown', function (e) {
    // ในช่องกรอกข้อความหรือกำลังกดปุ่มในตัวอย่าง ปล่อยให้เป็นหน้าที่ของมัน
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.metaKey || e.ctrlKey) return;

    var k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowRight' || k === 'PageDown' || k === ' ') {
      e.preventDefault(); jump(1); flash();
    } else if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'PageUp') {
      e.preventDefault(); jump(-1); flash();
    } else if (k === 'Home') {
      e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' });
    } else if (k === 'End') {
      e.preventDefault(); scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } else if (k === 'd' || k === 'D') {
      look(root.getAttribute('data-look') === 'day' ? 'night' : 'day');
    }
  });
  addEventListener('mousemove', function once() { flash(); removeEventListener('mousemove', once); });

  /* ── 3 · เผยตัวเมื่อเลื่อนถึง ────────────────────────────── */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (rows) {
      rows.forEach(function (r) {
        if (r.isIntersecting) { r.target.classList.add('in'); io.unobserve(r.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .04 });

    groups.forEach(function (g) {
      // การ์ดในกลุ่มเดียวกันเผยตัวไล่กัน แต่หยุดหน่วงที่ใบที่แปด
      // ไม่งั้นกลุ่มที่มีสิบใบจะรอนานจนคนนำเสนอพูดข้ามไปแล้ว
      var items = [].slice.call(g.querySelectorAll(
        ':scope > .head, :scope > figure.shot, :scope > .play, :scope > .splitbox, ' +
        ':scope > .shots2, :scope > .withphone, :scope > ul.fn > li'));
      items.forEach(function (el, i) {
        el.classList.add('rv');
        el.style.setProperty('--d', Math.min(i, 8) * 45 + 'ms');
        io.observe(el);
      });
    });
  }

  /* ── 4 · กลางวัน / กลางคืน ───────────────────────────────── */
  var btn = document.querySelector('.rail .look');
  function look(mode) {
    if (mode === 'day') root.setAttribute('data-look', 'day');
    else root.removeAttribute('data-look');
    if (btn) btn.textContent = mode === 'day' ? 'กลางคืน' : 'กลางวัน';
    // บังคับให้เบราว์เซอร์วาดใหม่ทันที — Safari หน่วงการวาดบางชั้นไว้
    // จนกว่าจะมีอะไรมาอ่านค่าเลย์เอาต์ คนกดสลับกลางหน้าจะได้เห็นผลทันที
    void document.body.offsetHeight;
    try { localStorage.setItem('astra-look', mode); } catch { /* โหมดส่วนตัวก็ใช้ได้ */ }
  }
  try {
    // เวลานำเสนอต่อหน้าลูกค้าให้เริ่มด้วยธีมสว่างที่ดูเป็นงานบริการ
    // แต่ยังจำธีมกลางคืนไว้ ถ้าคนนำเสนอเลือกเองในเครื่องนี้
    look(localStorage.getItem('astra-look') === 'night' ? 'night' : 'day');
  } catch { look('day'); }
  if (btn) btn.addEventListener('click', function () {
    look(root.getAttribute('data-look') === 'day' ? 'night' : 'day');
  });

  gauge();
  sync();
})();

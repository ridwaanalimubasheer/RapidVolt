/* Rapid Volt — "Lusion" enhancement layer.
   Standalone (non-module). Adds atmosphere, pointer-reactive aurora/spotlight,
   a pinned horizontal "Featured in 3D" gallery, scroll-scrub reveals, animated
   counters, media parallax and 3D tilt cards. Every effect is feature-detected
   and disabled under prefers-reduced-motion. Safe to load alongside rv-site.js. */
(function () {
  'use strict';

  var doc = document;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var narrow = window.matchMedia('(max-width: 860px)').matches;

  function ready(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ------------------------------------------------------------------ */
  /* atmosphere: aurora + grain + spotlight                              */
  /* ------------------------------------------------------------------ */

  function initAtmosphere() {
    if (reduced) return;

    // Aurora lives inside the hero, above its background but below the type.
    var hero = doc.querySelector('.hero');
    var aurora = doc.createElement('div');
    aurora.className = 'rv-lx-aurora';
    aurora.setAttribute('aria-hidden', 'true');
    if (hero) hero.insertBefore(aurora, hero.firstChild);
    else { aurora.classList.add('rv-lx-aurora--fixed'); doc.body.appendChild(aurora); }

    var grain = doc.createElement('div');
    grain.className = 'rv-lx-grain';
    grain.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(grain);

    var spot = doc.createElement('div');
    spot.className = 'rv-lx-spot';
    spot.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(spot);

    if (!finePointer) return;

    var tx = window.innerWidth / 2;
    var ty = window.innerHeight * 0.4;
    var sx = tx;
    var sy = ty;
    var spotOn = false;

    window.addEventListener('pointermove', function (e) {
      tx = e.clientX;
      ty = e.clientY;
      var nx = (tx / window.innerWidth) * 100;
      var ny = (ty / window.innerHeight) * 100;
      aurora.style.setProperty('--lx', nx.toFixed(2) + '%');
      aurora.style.setProperty('--ly', ny.toFixed(2) + '%');
      if (!spotOn) { spot.classList.add('is-on'); spotOn = true; }
    }, { passive: true });

    doc.addEventListener('pointerleave', function () {
      spot.classList.remove('is-on');
      spotOn = false;
    });

    (function loop() {
      sx += (tx - sx) * 0.12;
      sy += (ty - sy) * 0.12;
      spot.style.transform = 'translate3d(' + sx + 'px,' + sy + 'px,0) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
  }

  /* ------------------------------------------------------------------ */
  /* scroll-scrub reveals + drawing rules                               */
  /* ------------------------------------------------------------------ */

  function initReveals() {
    var items = Array.prototype.slice.call(
      doc.querySelectorAll('[data-lx-reveal], .rv-lx-rule')
    );
    if (!items.length) return;

    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------ */
  /* animated counters                                                   */
  /* ------------------------------------------------------------------ */

  function initCounters() {
    var els = Array.prototype.slice.call(doc.querySelectorAll('[data-lx-count]'));
    if (!els.length) return;

    var run = function (el) {
      var target = parseFloat(el.getAttribute('data-lx-count'));
      if (isNaN(target)) return;
      var suffix = el.getAttribute('data-lx-suffix') || '';
      var pad = parseInt(el.getAttribute('data-lx-pad'), 10) || 0;
      var decimals = (String(target).split('.')[1] || '').length;
      var fmt = function (v) {
        var s = v.toFixed(decimals);
        while (pad && s.length < pad) s = '0' + s;
        return s + suffix;
      };
      if (reduced) { el.textContent = fmt(target); return; }
      var start = performance.now();
      var dur = 1500;
      var tick = function (now) {
        var t = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = fmt(target * eased);
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = fmt(target);
      };
      requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) { els.forEach(run); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    els.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------ */
  /* media parallax                                                      */
  /* ------------------------------------------------------------------ */

  function initParallax() {
    if (reduced) return;
    var els = Array.prototype.slice.call(doc.querySelectorAll('[data-lx-parallax]'));
    if (!els.length) return;

    var ticking = false;
    var update = function () {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        var speed = parseFloat(el.getAttribute('data-lx-parallax')) || 0.08;
        var mid = r.top + r.height / 2 - vh / 2;
        el.style.setProperty('--lx-py', (-mid * speed).toFixed(1) + 'px');
      });
      ticking = false;
    };
    var onScroll = function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ------------------------------------------------------------------ */
  /* 3D tilt + spotlight cards                                           */
  /* ------------------------------------------------------------------ */

  function initTilt() {
    if (reduced || !finePointer) return;
    var cards = Array.prototype.slice.call(doc.querySelectorAll('[data-lx-tilt]'));
    if (!cards.length) return;

    cards.forEach(function (card) {
      var max = parseFloat(card.getAttribute('data-lx-tilt')) || 7;

      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        var rx = (0.5 - py) * max * 2;
        var ry = (px - 0.5) * max * 2;
        card.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) +
          'deg) rotateY(' + ry.toFixed(2) + 'deg) translateZ(0)';
        card.style.setProperty('--lx-mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--lx-my', (py * 100).toFixed(1) + '%');
      });

      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* pinned horizontal "Featured in 3D" gallery                          */
  /* ------------------------------------------------------------------ */

  function initFeatured() {
    var section = doc.querySelector('.rv-lx-featured');
    if (!section) return;

    var pin = section.querySelector('.rv-lx-featured__pin');
    var track = section.querySelector('.rv-lx-featured__track');
    var rail = section.querySelector('.rv-lx-featured__rail i');
    var countEl = section.querySelector('.rv-lx-featured__count b');
    if (!pin || !track) return;

    // Native horizontal-scroll mode on small screens or reduced motion.
    if (reduced || narrow) {
      section.classList.add('is-native');
      if (countEl) {
        var panelsN = track.querySelectorAll('.rv-lx-fpanel');
        pin.addEventListener('scroll', function () {
          var i = Math.round(pin.scrollLeft / (panelsN[0].offsetWidth + 24));
          countEl.textContent = String(Math.min(panelsN.length, i + 1)).padStart(2, '0');
        }, { passive: true });
      }
      return;
    }

    // Pinned mode: tall wrapper scrolls, inner viewport stays sticky.
    var head = section.querySelector('.rv-lx-featured__head');
    var distance = 0; // horizontal pixels to travel
    var travel = 0;   // vertical scroll distance

    var measure = function () {
      distance = Math.max(0, track.scrollWidth - window.innerWidth);
      travel = distance; // 1:1 scroll mapping
      var headH = head ? head.offsetHeight : 0;
      section.style.height = (headH + pin.offsetHeight + travel) + 'px';
      pin.style.position = 'sticky';
      pin.style.top = '0';
    };

    var panels = track.querySelectorAll('.rv-lx-fpanel');

    var update = function () {
      var scrolled = -section.getBoundingClientRect().top;
      var p = travel > 0 ? Math.min(1, Math.max(0, scrolled / travel)) : 0;
      track.style.transform = 'translate3d(' + (-distance * p).toFixed(2) + 'px,0,0)';
      if (rail) rail.style.width = (p * 100).toFixed(2) + '%';
      if (countEl) {
        var idx = Math.min(panels.length, Math.floor(p * panels.length) + 1);
        countEl.textContent = String(idx).padStart(2, '0');
      }
    };

    var ticking = false;
    var onScroll = function () {
      if (!ticking) { ticking = true; requestAnimationFrame(function () { update(); ticking = false; }); }
    };

    measure();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { measure(); update(); });
  }

  /* ------------------------------------------------------------------ */
  /* lusion underline on footer + inline links                           */
  /* ------------------------------------------------------------------ */

  function initLinks() {
    var sel = '.site-foot a, .hero-lead a, .statement a, .manifesto-copy a, .intro-copy a';
    Array.prototype.forEach.call(doc.querySelectorAll(sel), function (a) {
      a.classList.add('rv-lx-link');
    });
  }

  /* ------------------------------------------------------------------ */

  ready(function () {
    initAtmosphere();
    initReveals();
    initCounters();
    initParallax();
    initTilt();
    initFeatured();
    initLinks();
  });
})();
/* Rapid Volt - home page: hero viewer and scroll-driven 3D showcase */
(function () {
  'use strict';

  var section = document.getElementById('showcase');
  if (!section) return;

  var RV3D = window.RV3D;
  var steps = Array.prototype.slice.call(section.querySelectorAll('.rv-step'));
  var dots = Array.prototype.slice.call(section.querySelectorAll('.rv-dots span'));
  var showcaseCanvas = document.getElementById('showcase-canvas');
  var showcaseIcon = document.getElementById('showcase-fallback-icon');
  var heroCanvas = document.getElementById('hero-canvas');
  var heroTitle = document.getElementById('hero-title');
  var heroIcon = document.getElementById('hero-fallback-icon');

  var showcase = null;
  var hero = null;
  var activeIndex = -1;
  var heroIndex = 0;

  function nameOf(i) { return steps[i].getAttribute('data-name'); }
  function iconOf(i) { return steps[i].getAttribute('data-icon'); }
  function titleOf(i) { return steps[i].querySelector('h3').textContent; }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ----- scroll showcase ----- */

  function setActive(i) {
    if (i === activeIndex) return;
    activeIndex = i;
    steps.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
    dots.forEach(function (d, j) { d.classList.toggle('is-on', j === i); });
    showcaseIcon.className = 'fas ' + iconOf(i);
    if (showcase) showcase.setProduct(nameOf(i));
  }

  function updateShowcase() {
    ticking = false;
    var rect = section.getBoundingClientRect();
    var range = section.offsetHeight - window.innerHeight;
    var progress = range > 0 ? clamp(-rect.top / range, 0, 1) : 0;
    setActive(Math.min(steps.length - 1, Math.floor(progress * steps.length)));
    if (showcase) showcase.setAngle(progress * Math.PI * 4);
  }

  var ticking = false;
  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateShowcase);
    }
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);

  /* ----- hero viewer (cycles through the featured products) ----- */

  function setHero(i) {
    heroIndex = i;
    heroTitle.textContent = titleOf(i);
    heroIcon.className = 'fas ' + iconOf(i);
    if (hero) hero.setProduct(nameOf(i));
  }

  function startHeroCycle() {
    window.setInterval(function () {
      if (document.hidden) return;
      setHero((heroIndex + 1) % steps.length);
    }, 4500);
  }

  /* ----- start ----- */

  setHero(0);
  updateShowcase();

  RV3D.ready().then(function () {
    showcase = RV3D.createViewer(showcaseCanvas, { autoSpin: false, draggable: false, startAngle: 0 });
    hero = RV3D.createViewer(heroCanvas, { autoSpin: true, draggable: true, startAngle: 0.6 });
    hero.setProduct(nameOf(heroIndex));
    activeIndex = -1; // force the showcase to load the current step's model
    updateShowcase();
    startHeroCycle();
  }).catch(function () {
    document.documentElement.classList.add('no-3d');
    updateShowcase();
  });
})();

/* Rapid Volt — homepage interactions.
   Lenis smooth scroll, preloader, kinetic type, cursor, magnetic buttons,
   hero + sticky showcase real-model viewers, and the shared cart/viewer UI. */

import { ProductViewer } from './rv-viewer.js';
import { openViewer, initViewer, initCartButtons } from './rv-modal.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

const products = window.RV_PRODUCTS || [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ------------------------------------------------------------------ */
/* smooth scroll                                                       */
/* ------------------------------------------------------------------ */

let lenis = null;

function initLenis() {
  if (typeof window.Lenis !== 'function') return null;
  const instance = new window.Lenis({
    lerp: reduced ? 1 : 0.085,
    wheelMultiplier: 0.95,
    touchMultiplier: 1.4,
    smoothWheel: !reduced,
    syncTouch: false
  });
  window.__lenis = instance;
  instance.stop();
  return instance;
}

function startLenis() {
  if (lenis) lenis.start();
}

function scrollToTarget(target) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) {
    lenis.scrollTo(el, { offset: -58, duration: reduced ? 0 : 1.25 });
  } else {
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
}

/* ------------------------------------------------------------------ */
/* preloader                                                           */
/* ------------------------------------------------------------------ */

function initPreloader() {
  const pre = $('#preloader');
  const num = $('#pre-num');
  const bar = $('#pre-bar');
  const skip = new URLSearchParams(window.location.search).has('nopreload');
  if (!pre) {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-loaded');
    startLenis();
    return;
  }

  if (skip) {
    if (num) num.textContent = '100';
    if (bar) bar.style.width = '100%';
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-loaded');
    pre.classList.add('is-done');
    pre.style.display = 'none';
    startLenis();
    return;
  }

  const duration = reduced ? 220 : 1350;
  const start = performance.now();

  const tick = (now) => {
    const t = clamp((now - start) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(eased * 100);
    if (num) num.textContent = String(value).padStart(2, '0');
    if (bar) bar.style.width = `${eased * 100}%`;
    if (t < 1) {
      requestAnimationFrame(tick);
      return;
    }
    finish();
  };

  const finish = () => {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-loaded');
    pre.classList.add('is-done');
    startLenis();
    if (lenis) lenis.resize();
    setTimeout(() => {
      pre.setAttribute('aria-hidden', 'true');
      pre.style.display = 'none';
    }, reduced ? 50 : 1200);
  };

  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ */
/* header + mobile menu + clock                                        */
/* ------------------------------------------------------------------ */

function initHeader() {
  const head = $('#site-head');
  const toggle = $('#menu-toggle');
  const menu = $('#mobile-menu');
  if (!head) return;

  let lastY = window.scrollY;
  let lastState = '';

  const onScroll = () => {
    const y = window.scrollY;
    const scrolled = y > 30;
    let hidden = false;
    if (y > 420 && y > lastY + 6) hidden = true;
    if (y < lastY - 6 || y < 320) hidden = false;

    const state = `${scrolled}|${hidden}`;
    if (state !== lastState) {
      head.classList.toggle('is-scrolled', scrolled);
      head.classList.toggle('is-hidden', hidden && !menu?.classList.contains('is-open'));
      lastState = state;
    }
    lastY = y;
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  if (toggle && menu) {
    const setMenu = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
      document.body.classList.toggle('is-locked', open);
      if (open) {
        if (lenis) lenis.stop();
      } else if (!document.body.classList.contains('is-loading')) {
        if (lenis) lenis.start();
      }
    };

    toggle.addEventListener('click', () => {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });

    $$('a', menu).forEach((a) => {
      a.addEventListener('click', () => setMenu(false));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false);
    });
  }

  const time = $('#head-time');
  if (time) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dubai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const update = () => { time.textContent = `DXB ${fmt.format(new Date())} GST`; };
    update();
    setInterval(update, 30000);
  }
}

/* ------------------------------------------------------------------ */
/* cursor + magnetic buttons                                           */
/* ------------------------------------------------------------------ */

function initCursor() {
  if (!finePointer || reduced) return;
  const cursor = $('#cursor');
  if (!cursor) return;

  document.body.classList.add('has-cursor');
  let x = -100;
  let y = -100;
  let cx = x;
  let cy = y;

  const move = (e) => { x = e.clientX; y = e.clientY; };
  window.addEventListener('pointermove', move, { passive: true });

  const loop = () => {
    cx += (x - cx) * 0.22;
    cy += (y - cy) * 0.22;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const hoverables = 'a, button, [data-viewer], .p-card, .featured-card, .chip';
  document.addEventListener('pointerover', (e) => {
    if (e.target.closest(hoverables)) cursor.classList.add('is-hover');
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest(hoverables) && !e.relatedTarget?.closest?.(hoverables)) {
      cursor.classList.remove('is-hover');
    }
  });
  window.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
  window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));

  $$('.pill, .cta-circle, [data-magnetic]').forEach((el) => {
    const strength = el.classList.contains('cta-circle') ? 0.32 : 0.2;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * strength;
      const dy = (e.clientY - (r.top + r.height / 2)) * strength;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* ------------------------------------------------------------------ */
/* type + reveal                                                       */
/* ------------------------------------------------------------------ */

function splitStatements() {
  $$('.statement').forEach((el) => {
    const html = el.innerHTML.trim();
    // keep explicit <em> accents by splitting on spaces while preserving tags
    const words = html.split(/\s+/).filter(Boolean);
    el.innerHTML = words.map((w) => `<span class="word"><span>${w}</span></span>`).join(' ');
  });
}

function initReveal() {
  const items = $$('.reveal, .reveal-img, .statement');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

  items.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------------ */
/* hero viewer                                                         */
/* ------------------------------------------------------------------ */

function initHero() {
  const wrap = $('#hero-wrap');
  const canvas = $('#hero-canvas');
  if (!wrap || !canvas) return;

  let viewer = null;
  try {
    viewer = new ProductViewer(canvas, {
      controls: false,
      drag: false,
      autoRotate: !reduced,
      spinSpeed: 0.2,
      environment: 0.9
    });
  } catch (err) {
    wrap.classList.remove('is-3d');
    return;
  }

  viewer.setProduct('cable').then(() => {
    canvas.classList.add('is-ready');
    wrap.classList.add('is-3d');
  }).catch(() => {});

  if (!reduced && finePointer) {
    window.addEventListener('pointermove', (e) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      viewer.setParallax(nx, ny);
    }, { passive: true });
  }

  // pause the hero render loop once it is well out of view
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      viewer.visible = entry.isIntersecting;
    }, { rootMargin: '150px' }).observe(canvas);
  }
}

/* ------------------------------------------------------------------ */
/* sticky showcase                                                     */
/* ------------------------------------------------------------------ */

function initShowcase() {
  const section = $('#showcase');
  const canvas = $('#sc-canvas');
  const copy = $('#sc-copy');
  if (!section || !canvas || !copy) return;

  const stage = $('#sc-stage');
  const poster = $('#sc-poster');
  const cat = $('#sc-cat');
  const title = $('#sc-title');
  const desc = $('#sc-desc');
  const specs = $('#sc-specs');
  const actions = $('#sc-actions');
  const indexNum = $('#sc-index-num');
  const count = $('#sc-count');
  const tris = $('#sc-tris');
  const progressBar = $('#sc-progress');

  let viewer = null;
  try {
    viewer = new ProductViewer(canvas, {
      controls: false,
      drag: true,
      autoRotate: !reduced,
      spinSpeed: 0.1,
      environment: 0.85
    });
  } catch (err) {
    return;
  }

  let current = -1;
  let pending = 0;

  const paint = (p) => {
    if (cat) cat.textContent = `${p.num} / ${p.cat}`;
    if (title) title.textContent = p.name;
    if (desc) desc.textContent = p.short;
    if (specs) {
      specs.innerHTML = p.specs.map(([k, v]) => `<li><span>${k}</span><strong>${v}</strong></li>`).join('');
    }
    if (actions) {
      actions.innerHTML = `
        <button class="pill" type="button" data-viewer="${p.key}">Open 3D viewer <span class="pill-arrow">&#8599;</span></button>
        <button class="sc-add" type="button" data-add="${p.key}">Add to order</button>`;
    }
    if (indexNum) indexNum.textContent = p.num;
    if (count) count.textContent = p.num;
    if (tris) tris.textContent = `${p.tris} tris`;
    if (poster) {
      poster.src = p.render;
      poster.alt = p.name;
    }
  };

  const select = (i) => {
    const p = products[i];
    if (!p || i === current) return;
    current = i;
    pending++;
    const token = pending;

    if (copy) copy.classList.add('is-swapping');
    setTimeout(() => {
      if (token !== pending) return;
      paint(p);
      copy.classList.remove('is-swapping');
    }, reduced ? 0 : 170);

    viewer.setProduct(p.key).then(() => {
      if (token !== pending) return;
      canvas.classList.add('is-ready');
      if (stage) stage.classList.add('is-3d');
    }).catch(() => {});
  };

  // first paint immediately so the panel is never empty
  if (products.length) {
    paint(products[0]);
    select(0);
  }

  const update = () => {
    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight;
    const travel = Math.max(1, rect.height - vh);
    const p = clamp(-rect.top / travel, 0, 1);
    const i = clamp(Math.floor(p * products.length), 0, products.length - 1);
    if (i !== current) select(i);

    const local = clamp(p * products.length - i, 0, 1);
    viewer.setProgress(local * 0.28);
    if (progressBar) progressBar.style.height = `${p * 100}%`;

    // small horizontal drift of the stage as you scroll through the range
    if (stage) stage.style.transform = `translate3d(${(p - 0.5) * 2.4}%, 0, 0)`;
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

/* ------------------------------------------------------------------ */
/* cards + anchors                                                     */
/* ------------------------------------------------------------------ */

function initCards() {
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-viewer]');
    if (!card) return;
    if (e.target.closest('#viewer')) return;
    if (e.target.closest('[data-add]')) return;
    e.preventDefault();
    openViewer(card.dataset.viewer);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('[data-viewer]');
    if (!card || card.tagName === 'BUTTON' || card.tagName === 'A') return;
    e.preventDefault();
    openViewer(card.dataset.viewer);
  });
}

function initAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (!id || id === '#') return;
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    scrollToTarget(target);
  });
}

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */

function boot() {
  lenis = initLenis();
  initViewer();
  initCartButtons();
  initHeader();
  initCursor();
  splitStatements();
  initReveal();
  initCards();
  initAnchors();
  initHero();
  initShowcase();
  initPreloader();

  const params = new URLSearchParams(window.location.search);
  const jump = params.get('scroll');
  if (jump) {
    const target = document.getElementById(jump);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: 'auto', block: 'start' }), 60);
  }

  // rAF loop for Lenis (our scroll listeners read window.scrollY directly)
  const raf = (time) => {
    if (lenis) lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

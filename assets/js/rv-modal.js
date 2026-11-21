/* Rapid Volt — full-screen real-model viewer + shared cart/toast helpers. */
import { ProductViewer } from './rv-viewer.js';

let viewer = null;
let currentKey = null;
let toastTimer = null;
let closeTimer = null;

const $ = (sel, root = document) => root.querySelector(sel);

export function toast(text) {
  let el = document.getElementById('rv-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rv-toast';
    el.className = 'rv-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

export function updateCartBadges() {
  const n = window.RV_CART ? window.RV_CART.count() : 0;
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = n;
    el.classList.toggle('is-empty', n === 0);
  });
}

export function addProduct(key, qty = 1) {
  const p = window.RV_BY_KEY[key];
  if (!p) return;
  window.RV_CART.add({ name: p.fullName, unitPrice: p.price, key: p.key }, qty);
  updateCartBadges();
  toast(p.price > 0
    ? `Added — AED ${Number(p.price).toFixed(2)} ${p.unit}`
    : 'Added — price confirmed on WhatsApp');
}

function priceLabel(p) {
  return p.price > 0 ? `Add to order — AED ${Number(p.price).toFixed(2)}` : 'Add to order — price on request';
}

function setField(sel, value) {
  const el = $(sel);
  if (el) el.textContent = value;
}

function fill(product) {
  setField('.viewer-cat', `${product.num} / ${product.cat}`);
  setField('.viewer-title', product.name);
  setField('.viewer-desc', product.desc);
  setField('.viewer-meta', `${product.tris} triangles · ${product.dims}`);

  const specs = $('#viewer-specs');
  if (specs) {
    specs.innerHTML = product.specs.map(([k, v]) =>
      `<li><span>${k}</span><strong>${v}</strong></li>`).join('');
  }

  ['stl', 'fbx', 'glb'].forEach((fmt) => {
    const a = $(`[data-dl="${fmt}"]`);
    if (!a) return;
    a.href = product[fmt];
    a.setAttribute('download', `${product.key}.${fmt}`);
    const size = $('.dl-size', a);
    if (size) size.textContent = product.size[fmt];
  });

  const add = $('#viewer-add');
  if (add) {
    add.dataset.add = product.key;
    add.textContent = priceLabel(product);
  }

  const poster = $('#viewer-poster');
  if (poster) {
    poster.src = product.render;
    poster.alt = product.name;
    poster.hidden = false;
  }
  const stage = $('#viewer-stage');
  if (stage) stage.classList.remove('is-ready');

  const loading = $('#viewer-loading');
  if (loading) loading.hidden = false;
}

export function openViewer(key) {
  const p = window.RV_BY_KEY[key];
  const root = document.getElementById('viewer');
  if (!p || !root) return;

  clearTimeout(closeTimer);
  currentKey = key;
  fill(p);

  root.classList.add('is-open');
  root.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-locked');
  if (window.__lenis) window.__lenis.stop();

  const close = document.getElementById('viewer-close');
  if (close) close.focus({ preventScroll: true });

  const canvas = document.getElementById('viewer-canvas');
  if (!canvas) return;

  try {
    if (viewer) { viewer.dispose(); viewer = null; }

    // A released WebGL context cannot be revived on the same canvas, so give
    // every open a fresh element (the old one is detached and disposed).
    const fresh = document.createElement('canvas');
    fresh.id = 'viewer-canvas';
    fresh.setAttribute('aria-label', 'Interactive 3D model');
    canvas.replaceWith(fresh);

    viewer = new ProductViewer(fresh, {
      controls: true,
      drag: false,
      autoRotate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      spinSpeed: 0.22,
      environment: 0.8
    });

    viewer.setProduct(key).then(() => {
      if (!viewer || currentKey !== key) return;
      const stage = $('#viewer-stage');
      if (stage) stage.classList.add('is-ready');
      const poster = $('#viewer-poster');
      if (poster) poster.hidden = true;
      const loading = $('#viewer-loading');
      if (loading) loading.hidden = true;
      const wire = $('[data-viewer="wire"]');
      if (wire) wire.classList.remove('is-on');
      const spin = $('[data-viewer="spin"]');
      if (spin) spin.classList.add('is-on');
    }).catch(() => {
      const loading = $('#viewer-loading');
      if (loading) loading.hidden = true;
    });
  } catch (err) {
    const loading = $('#viewer-loading');
    if (loading) loading.hidden = true;
  }
}

export function closeViewer() {
  const root = document.getElementById('viewer');
  if (!root || !root.classList.contains('is-open')) return;
  root.classList.remove('is-open');
  root.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('is-locked');
  if (window.__lenis) window.__lenis.start();
  currentKey = null;
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (viewer) { viewer.dispose(); viewer = null; }
  }, 650);
}

export function initViewer() {
  const root = document.getElementById('viewer');
  if (!root) return;

  const close = document.getElementById('viewer-close');
  if (close) close.addEventListener('click', closeViewer);

  root.addEventListener('click', (e) => {
    if (e.target === root) closeViewer();
    const dl = e.target.closest('[data-dl]');
    if (dl) toast(`Downloading ${dl.dataset.dl.toUpperCase()} model`);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeViewer();
  });

  const wire = $('[data-viewer="wire"]');
  if (wire) wire.addEventListener('click', () => {
    if (!viewer) return;
    const on = !wire.classList.contains('is-on');
    wire.classList.toggle('is-on', on);
    viewer.setWireframe(on);
  });

  const spin = $('[data-viewer="spin"]');
  if (spin) spin.addEventListener('click', () => {
    if (!viewer) return;
    const on = !spin.classList.contains('is-on');
    spin.classList.toggle('is-on', on);
    viewer.setAutoRotate(on);
  });

  const reset = $('[data-viewer="reset"]');
  if (reset) reset.addEventListener('click', () => {
    if (viewer) viewer.reset();
  });
}

export function initCartButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    addProduct(btn.dataset.add, 1);
  });
  updateCartBadges();
  window.addEventListener('rv:cart', updateCartBadges);
}

/* Rapid Volt — shop page.
   Reads products.txt, renders the catalogue with search + category chips,
   keeps the shared localStorage cart in sync, and posts the same order
   payload to the existing Cloudflare Worker. */

import { openViewer, initViewer, initCartButtons, toast, updateCartBadges } from './rv-modal.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const money = window.RV_MONEY || ((n) => Number(n).toFixed(2));
const cart = window.RV_CART;

const ORDER_SERVER_URL = 'https://shrill-leaf-26ee.ridwaanali147.workers.dev/orders';

const CAT_LABELS = {
  Lighting: 'Lighting',
  CablingAccessories: 'Cabling accessories',
  HardwareAndFixings: 'Hardware & fixings',
  Tools: 'Tools',
  Consumables: 'Consumables'
};

const THREE_D = {
  'nitalite led down light 15w': 'downlight',
  '63l cable gland bw': 'gland',
  'gi cable tray joint coupler': 'coupler',
  '20mm gi saddle': 'saddle',
  '1cx16 cu/xlpe/swa/pvc 1kv cable-ducab': 'cable'
};

const state = { q: '', cat: 'all' };
let catalogue = [];
let sending = false;

/* ------------------------------------------------------------------ */

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function normalise(name) {
  return String(name).toLowerCase().replace(/\s+/g, ' ').trim();
}

function keyFor(name) {
  return THREE_D[normalise(name)] || '';
}

function parseProducts(text) {
  const out = [];
  let category = 'Other';
  text.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('#')) {
      category = line.slice(1).trim() || 'Other';
      return;
    }
    const parts = line.split('|');
    const name = parts[0].trim();
    if (!name) return;
    const price = parseFloat((parts[1] || '0').replace(/[^0-9.]/g, ''));
    out.push({ name, price: Number.isFinite(price) ? price : 0, category });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* catalogue                                                           */
/* ------------------------------------------------------------------ */

function categoryOrder() {
  const seen = [];
  catalogue.forEach((p) => {
    if (!seen.includes(p.category)) seen.push(p.category);
  });
  return seen;
}

function renderChips() {
  const wrap = $('#catalog-chips');
  if (!wrap) return;
  const cats = categoryOrder();
  wrap.innerHTML = [
    `<button class="chip${state.cat === 'all' ? ' is-active' : ''}" type="button" data-cat="all">All</button>`,
    ...cats.map((c) => `<button class="chip${state.cat === c ? ' is-active' : ''}" type="button" data-cat="${esc(c)}">${esc(CAT_LABELS[c] || c)}</button>`)
  ].join('');
}

function priceHTML(p) {
  return p.price > 0
    ? `<span class="shop-price">AED ${money(p.price)}</span>`
    : '<span class="shop-price is-request">Price on request</span>';
}

function cardHTML(p) {
  const key = keyFor(p.name);
  return `
    <article class="shop-card" data-name="${esc(p.name)}">
      <div class="shop-card-top">
        <h4>${esc(p.name)}</h4>
        <span class="shop-cat">${esc(CAT_LABELS[p.category] || p.category)}</span>
      </div>
      ${priceHTML(p)}
      <div class="shop-card-actions">
        <div class="qty">
          <button type="button" data-q="dec" aria-label="Decrease quantity">&minus;</button>
          <input data-qty type="number" min="1" max="999" value="1" inputmode="numeric" aria-label="Quantity for ${esc(p.name)}">
          <button type="button" data-q="inc" aria-label="Increase quantity">+</button>
        </div>
        <button class="shop-add" type="button" data-add-shop="${esc(p.name)}">Add</button>
        ${key ? `<button class="shop-3d" type="button" data-viewer="${key}" aria-label="View ${esc(p.name)} in 3D">3D</button>` : ''}
      </div>
    </article>`;
}

function renderCatalogue() {
  const root = $('#catalog');
  if (!root) return;

  const q = state.q.trim().toLowerCase();
  const groups = [];
  catalogue.forEach((p) => {
    if (state.cat !== 'all' && p.category !== state.cat) return;
    if (q && !p.name.toLowerCase().includes(q)) return;
    let g = groups.find((x) => x.cat === p.category);
    if (!g) { g = { cat: p.category, items: [] }; groups.push(g); }
    g.items.push(p);
  });

  if (!groups.length) {
    root.innerHTML = '<p class="cart-empty">Nothing matches that search. Try a shorter word, or clear the filters.</p>';
    return;
  }

  root.innerHTML = groups.map((g) => `
    <div class="catalog-cat">
      <div class="catalog-cat-head">
        <h3>${esc(CAT_LABELS[g.cat] || g.cat)}</h3>
        <span>${g.items.length} line${g.items.length === 1 ? '' : 's'}</span>
      </div>
      <div class="catalog-grid">${g.items.map(cardHTML).join('')}</div>
    </div>`).join('');
}

async function loadCatalogue() {
  try {
    const res = await fetch('products.txt', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`products.txt ${res.status}`);
    catalogue = parseProducts(await res.text());
    renderChips();
    renderCatalogue();
  } catch (err) {
    const root = $('#catalog');
    if (root) {
      root.innerHTML = '<p class="cart-empty">The catalogue could not load. Please refresh, or message us on WhatsApp and we will send the list.</p>';
    }
  }
}

/* ------------------------------------------------------------------ */
/* cart                                                                */
/* ------------------------------------------------------------------ */

function renderCart() {
  const list = $('#cart-items');
  const totalEl = $('#cart-total-value');
  if (!list || !cart) return;

  const items = cart.read();
  if (!items.length) {
    list.innerHTML = '<p class="cart-empty">Your order is empty. Add something from the catalogue above — the five modelled products are at the top.</p>';
  } else {
    list.innerHTML = items.map((item, i) => `
      <div class="cart-item">
        <div class="cart-item-name">
          ${esc(item.name)}
          <small>${item.unitPrice > 0 ? `AED ${money(item.unitPrice)} each` : 'Price on request'}</small>
          <div class="qty" style="margin-top:9px;width:max-content">
            <button type="button" data-cart-act="dec" data-i="${i}" aria-label="Decrease quantity">&minus;</button>
            <input type="number" min="1" max="999" value="${item.qty}" data-cart-qty="${i}" inputmode="numeric" aria-label="Quantity for ${esc(item.name)}">
            <button type="button" data-cart-act="inc" data-i="${i}" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <div class="cart-line">${item.unitPrice > 0 ? `AED ${money(item.unitPrice * item.qty)}` : '&mdash;'}</div>
        <button class="cart-remove" type="button" data-cart-act="remove" data-i="${i}" aria-label="Remove ${esc(item.name)}">×</button>
      </div>`).join('');
  }

  if (totalEl) totalEl.textContent = `AED ${money(cart.total())}`;
  updateCartBadges();
}

function setQty(i, value) {
  const items = cart.read();
  if (!items[i]) return;
  items[i].qty = Math.max(1, Math.min(999, parseInt(value, 10) || 1));
  cart.write(items);
}

function bindCart() {
  const list = $('#cart-items');
  if (!list) return;

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cart-act]');
    if (!btn) return;
    const i = parseInt(btn.dataset.i, 10);
    const items = cart.read();
    if (!items[i]) return;
    if (btn.dataset.cartAct === 'remove') {
      items.splice(i, 1);
      cart.write(items);
    } else {
      setQty(i, items[i].qty + (btn.dataset.cartAct === 'inc' ? 1 : -1));
    }
  });

  list.addEventListener('change', (e) => {
    const input = e.target.closest('[data-cart-qty]');
    if (!input) return;
    setQty(parseInt(input.dataset.cartQty, 10), input.value);
  });

  window.addEventListener('rv:cart', renderCart);
  renderCart();
}

function bindCatalogue() {
  const root = $('#catalog');
  if (!root) return;

  root.addEventListener('click', (e) => {
    const qtyBtn = e.target.closest('[data-q]');
    if (qtyBtn) {
      const input = qtyBtn.closest('.qty')?.querySelector('[data-qty]');
      if (!input) return;
      const next = (parseInt(input.value, 10) || 1) + (qtyBtn.dataset.q === 'inc' ? 1 : -1);
      input.value = Math.max(1, Math.min(999, next));
      return;
    }

    const add = e.target.closest('[data-add-shop]');
    if (!add) return;
    const name = add.dataset.addShop;
    const p = catalogue.find((x) => x.name === name);
    if (!p) return;
    const input = add.closest('.shop-card')?.querySelector('[data-qty]');
    const qty = Math.max(1, Math.min(999, parseInt(input?.value, 10) || 1));
    cart.add({ name: p.name, unitPrice: p.price, key: keyFor(p.name) }, qty);
    updateCartBadges();
    toast(p.price > 0
      ? `Added ${qty} × ${p.name} — AED ${money(p.price)} each`
      : `Added ${qty} × ${p.name} — price confirmed on WhatsApp`);
  });

  const search = $('#catalog-search');
  if (search) {
    search.addEventListener('input', () => {
      state.q = search.value;
      renderCatalogue();
    });
  }

  const chips = $('#catalog-chips');
  if (chips) {
    chips.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-cat]');
      if (!chip) return;
      state.cat = chip.dataset.cat;
      renderChips();
      renderCatalogue();
    });
  }
}

/* ------------------------------------------------------------------ */
/* order                                                               */
/* ------------------------------------------------------------------ */

function showMessage(kind, html) {
  const el = $('#order-msg');
  if (!el) return;
  el.className = `order-msg ${kind === 'ok' ? 'is-ok' : 'is-bad'}`;
  el.innerHTML = html;
}

function bindOrder() {
  const form = $('#order-form');
  const button = $('#send-order-button');
  if (!form || !button) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;

    const items = cart.read();
    if (!items.length) {
      showMessage('bad', 'Your order is empty. Add at least one item first.');
      return;
    }

    const name = $('#customer-name').value.trim();
    const phone = $('#customer-phone').value.trim();
    const email = $('#customer-email').value.trim();
    const location = $('#delivery-location').value.trim();

    if (!name) { showMessage('bad', 'Please enter your name.'); return; }
    if (!phone) { showMessage('bad', 'Please enter your phone number.'); return; }
    if (!location) { showMessage('bad', 'Please enter your delivery location.'); return; }

    const order = {
      orderId: `RV-${Date.now()}`,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      deliveryLocation: location,
      items: items.map((item) => ({
        name: item.name,
        quantity: item.qty,
        unitPrice: Number(item.unitPrice.toFixed(2))
      })),
      total: Number(cart.total().toFixed(2)),
      createdAt: new Date().toISOString()
    };

    sending = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    showMessage('ok', '');

    try {
      const res = await fetch(ORDER_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      cart.write([]);
      form.reset();
      showMessage('ok', `<strong>Order sent.</strong><br>Order number: ${esc(order.orderId)}. We will confirm stock and delivery on WhatsApp.`);
    } catch (err) {
      showMessage('bad', '<strong>Order could not be sent.</strong><br>Please try again, or message us on WhatsApp.');
    } finally {
      sending = false;
      button.disabled = false;
      button.textContent = 'Send order';
    }
  });
}

/* ------------------------------------------------------------------ */
/* chrome                                                              */
/* ------------------------------------------------------------------ */

function initHeader() {
  const head = $('#site-head');
  const toggle = $('#menu-toggle');
  const menu = $('#mobile-menu');

  if (head) {
    const onScroll = () => head.classList.toggle('is-scrolled', window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if (toggle && menu) {
    const setMenu = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
      document.body.classList.toggle('is-locked', open);
    };
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false);
    });
  }

  const time = $('#head-time');
  if (time) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: false
    });
    const update = () => { time.textContent = `DXB ${fmt.format(new Date())} GST`; };
    update();
    setInterval(update, 30000);
  }
}

function initCards() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('#viewer')) return;
    if (e.target.closest('[data-add]')) return;
    const card = e.target.closest('[data-viewer]');
    if (!card) return;
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

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ------------------------------------------------------------------ */

function boot() {
  initViewer();
  initCartButtons();
  initHeader();
  initCards();
  bindCart();
  bindCatalogue();
  bindOrder();
  loadCatalogue();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

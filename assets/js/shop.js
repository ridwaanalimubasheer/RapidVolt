/* Rapid Volt - shop: catalogue, 3D previews, cart and order sending */
(function () {
  'use strict';

  // Unchanged endpoint: orders are posted to the same Cloudflare Worker as before.
  var ORDER_SERVER_URL = 'https://shrill-leaf-26ee.ridwaanali147.workers.dev/orders';
  var CART_KEY = 'rapidvolt-cart-v1';

  var CATEGORIES = {
    Lighting:           { label: 'Lighting',              icon: 'fa-lightbulb' },
    CablingAccessories: { label: 'Cabling & Accessories', icon: 'fa-plug' },
    HardwareAndFixings: { label: 'Hardware & Fixings',    icon: 'fa-tools' },
    Tools:              { label: 'Tools',                 icon: 'fa-wrench' },
    Consumables:        { label: 'Consumables',           icon: 'fa-flask' }
  };

  function catInfo(key) {
    return CATEGORIES[key] || { label: key, icon: 'fa-box' };
  }

  var $ = function (id) { return document.getElementById(id); };

  var products = [];
  var cart = loadCart();
  var activeCategory = 'All';
  var sending = false;
  var openToken = 0;
  var viewer = null;
  var toastTimer = null;

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function money(n) { return Number(n).toFixed(2); }

  function unique(list) {
    return list.filter(function (v, i, arr) { return arr.indexOf(v) === i; });
  }

  function parseQty(value) {
    var n = parseInt(value, 10);
    return isNaN(n) || n < 1 ? 1 : Math.min(n, 999);
  }

  function priceHTML(price) {
    return price > 0
      ? '<span class="rv-amount">AED ' + money(price) + '</span>'
      : '<span class="rv-price-req">Price on request</span>';
  }

  function toast(text) {
    var el = $('rv-toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  /* ------------------------------------------------------------------ *
   * Cart storage (survives page reloads)
   * ------------------------------------------------------------------ */

  function loadCart() {
    try {
      var parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (i) {
        return i && typeof i.name === 'string' && typeof i.unitPrice === 'number' && i.qty > 0;
      });
    } catch (e) {
      return [];
    }
  }

  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* storage full or blocked */ }
  }

  function cartTotal() {
    return cart.reduce(function (sum, i) { return sum + i.unitPrice * i.qty; }, 0);
  }

  /* ------------------------------------------------------------------ *
   * Catalogue
   * ------------------------------------------------------------------ */

  function parseProducts(text) {
    var list = [];
    var category = '';
    text.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      if (line.charAt(0) === '#') {
        category = line.slice(1).trim();
        return;
      }
      var parts = line.split('|');
      var name = parts[0].trim();
      if (!name) return;
      var price = parts.length > 1 ? parseFloat(parts[1]) : 0;
      list.push({
        id: list.length,
        name: name,
        category: category,
        price: isNaN(price) ? 0 : price
      });
    });
    return list;
  }

  function loadProducts() {
    return fetch('products.txt', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('products.txt returned ' + r.status);
        return r.text();
      })
      .then(function (text) { products = parseProducts(text); });
  }

  function buildCard(p) {
    var info = catInfo(p.category);
    var col = document.createElement('div');
    col.className = 'col-sm-6 col-lg-4 mb-4 product-card';
    col.setAttribute('data-id', p.id);
    col.setAttribute('data-name', p.name.toLowerCase());
    col.innerHTML = [
      '<article class="rv-product h-100 p-4 d-flex flex-column">',
        '<div class="d-flex align-items-start mb-3">',
          '<div class="rv-product-icon mr-3"><i class="fas ' + info.icon + '"></i></div>',
          '<div class="min-w-0">',
            '<h4 class="product-name">' + esc(p.name) + '</h4>',
            '<small class="text-muted">' + esc(info.label) + '</small>',
          '</div>',
        '</div>',
        '<p class="mb-3">' + priceHTML(p.price) + '</p>',
        '<div class="d-flex align-items-center mb-3">',
          '<span class="small text-muted mr-3">Quantity</span>',
          '<div class="rv-qty">',
            '<button type="button" class="rv-qty-btn" data-act="dec" aria-label="Decrease quantity">&minus;</button>',
            '<input type="number" class="product-quantity" value="1" min="1" max="999" step="1" inputmode="numeric" aria-label="Quantity">',
            '<button type="button" class="rv-qty-btn" data-act="inc" aria-label="Increase quantity">+</button>',
          '</div>',
        '</div>',
        '<div class="d-flex mt-auto">',
          '<button type="button" class="btn btn-primary flex-grow-1 add-cart-button"><i class="fas fa-plus"></i> Add to cart</button>',
          '<button type="button" class="btn btn-outline-primary ml-2 rv-3d-btn" aria-label="View ' + esc(p.name) + ' in 3D"><i class="fas fa-cube"></i> 3D</button>',
        '</div>',
      '</article>'
    ].join('');
    return col;
  }

  function renderChips() {
    var wrap = $('category-chips');
    wrap.innerHTML = '';
    ['All'].concat(unique(products.map(function (p) { return p.category; }))).forEach(function (key) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rv-chip' + (key === activeCategory ? ' active' : '');
      b.setAttribute('data-cat', key);
      b.textContent = key === 'All' ? 'All products' : catInfo(key).label;
      wrap.appendChild(b);
    });
  }

  function renderCatalog() {
    var grid = $('product-list');
    grid.innerHTML = '';
    unique(products.map(function (p) { return p.category; })).forEach(function (cat) {
      var info = catInfo(cat);
      var section = document.createElement('div');
      section.className = 'col-12 rv-cat';
      section.setAttribute('data-cat', cat);
      section.innerHTML =
        '<div class="rv-cat-head"><span class="rv-cat-icon"><i class="fas ' + info.icon + '"></i></span>' +
        '<h3>' + esc(info.label) + '</h3></div>' +
        '<div class="row rv-cat-row"></div>';
      var row = section.querySelector('.rv-cat-row');
      products.forEach(function (p) {
        if (p.category === cat) row.appendChild(buildCard(p));
      });
      grid.appendChild(section);
    });

    var empty = document.createElement('div');
    empty.id = 'no-results';
    empty.className = 'col-12 text-center text-muted py-5';
    empty.hidden = true;
    empty.textContent = 'No products match your search.';
    grid.appendChild(empty);
  }

  function applyFilters() {
    var q = $('search').value.trim().toLowerCase();
    var anyVisible = false;
    document.querySelectorAll('.rv-cat').forEach(function (sec) {
      var catOk = activeCategory === 'All' || sec.getAttribute('data-cat') === activeCategory;
      var shown = 0;
      sec.querySelectorAll('.product-card').forEach(function (card) {
        var ok = catOk && card.getAttribute('data-name').indexOf(q) !== -1;
        card.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      sec.style.display = shown ? '' : 'none';
      if (shown) anyVisible = true;
    });
    var empty = $('no-results');
    if (empty) empty.hidden = anyVisible;
  }

  /* ------------------------------------------------------------------ *
   * Cart
   * ------------------------------------------------------------------ */

  function addToCart(p, qty) {
    qty = parseQty(qty);
    var existing = cart.find(function (i) { return i.name === p.name; });
    if (existing) {
      existing.qty = Math.min(999, existing.qty + qty);
    } else {
      cart.push({ name: p.name, unitPrice: p.price, qty: qty });
    }
    saveCart();
    renderCart();
    toast('Added ' + qty + ' × ' + p.name);
  }

  function renderCart() {
    var list = $('cart-items');
    list.innerHTML = '';

    if (!cart.length) {
      list.innerHTML = '<li class="list-group-item text-center text-muted py-4">Your cart is empty. Add products from the catalogue above.</li>';
    }

    cart.forEach(function (item, i) {
      var li = document.createElement('li');
      li.className = 'list-group-item rv-cart-item';
      li.innerHTML = [
        '<div class="min-w-0 mr-2">',
          '<strong>' + esc(item.name) + '</strong>',
          '<div class="small text-muted">' + (item.unitPrice > 0 ? 'AED ' + money(item.unitPrice) + ' each' : 'Price on request') + '</div>',
        '</div>',
        '<div class="rv-cart-controls">',
          '<div class="rv-qty rv-qty-sm">',
            '<button type="button" data-cart="dec" data-i="' + i + '" class="rv-qty-btn" aria-label="Decrease quantity">&minus;</button>',
            '<span class="rv-qty-val">' + item.qty + '</span>',
            '<button type="button" data-cart="inc" data-i="' + i + '" class="rv-qty-btn" aria-label="Increase quantity">+</button>',
          '</div>',
          '<div class="rv-cart-line">' + (item.unitPrice > 0 ? 'AED ' + money(item.unitPrice * item.qty) : '&mdash;') + '</div>',
          '<button type="button" class="btn btn-sm btn-link text-danger" data-cart="remove" data-i="' + i + '" aria-label="Remove ' + esc(item.name) + '"><i class="fas fa-trash"></i></button>',
        '</div>'
      ].join('');
      list.appendChild(li);
    });

    var count = cart.reduce(function (s, i) { return s + i.qty; }, 0);
    var badge = $('cart-count');
    badge.textContent = count;
    badge.hidden = count === 0;

    $('total').textContent = money(cartTotal());

    var pending = cart.filter(function (i) { return !(i.unitPrice > 0); }).length;
    var note = $('total-note');
    note.hidden = pending === 0;
    note.textContent = pending
      ? pending + (pending === 1 ? ' item is' : ' items are') +
        ' priced on request and not included in this total. We will confirm those with you on WhatsApp.'
      : '';

    if (!sending) $('send-order-button').disabled = cart.length === 0;
  }

  function showOrderMessage(type, html) {
    $('order-message').innerHTML = '<div class="alert alert-' + type + '">' + html + '</div>';
  }

  function clearOrderMessage() {
    $('order-message').innerHTML = '';
  }

  async function sendOrder() {
    if (sending) return;
    if (!cart.length) {
      showOrderMessage('warning', 'Your cart is empty.');
      return;
    }

    var name = $('customer-name').value.trim();
    var phone = $('customer-phone').value.trim();
    var email = $('customer-email').value.trim();
    var location = $('location').value.trim();

    if (!name) { showOrderMessage('warning', 'Please enter your name.'); return; }
    if (!phone) { showOrderMessage('warning', 'Please enter your phone number.'); return; }
    if (!location) { showOrderMessage('warning', 'Please enter your delivery location.'); return; }

    var order = {
      orderId: 'RV-' + Date.now(),
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      deliveryLocation: location,
      items: cart.map(function (item) {
        return {
          name: item.name,
          quantity: item.qty,
          unitPrice: Number(item.unitPrice.toFixed(2))
        };
      }),
      total: Number(cartTotal().toFixed(2)),
      createdAt: new Date().toISOString()
    };

    var button = $('send-order-button');
    sending = true;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    clearOrderMessage();

    try {
      var response = await fetch(ORDER_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      if (!response.ok) throw new Error('Server error: ' + response.status);

      cart = [];
      saveCart();
      ['customer-name', 'customer-phone', 'customer-email', 'location'].forEach(function (id) {
        $(id).value = '';
      });
      showOrderMessage('success',
        '<strong>✓ Order sent successfully!</strong><br>Order number: ' + esc(order.orderId));
    } catch (err) {
      console.error('Order error:', err);
      showOrderMessage('danger', '<strong>Order could not be sent.</strong><br>Please try again.');
    } finally {
      sending = false;
      button.innerHTML = '<i class="fas fa-paper-plane"></i> Send order';
      renderCart();
    }
  }

  /* ------------------------------------------------------------------ *
   * 3D viewer modal
   * ------------------------------------------------------------------ */

  function clearViewerCanvas() {
    Array.prototype.slice.call($('viewer-stage').querySelectorAll('canvas')).forEach(function (c) {
      if (c.parentNode) c.parentNode.removeChild(c);
    });
  }

  function closeViewerEngine() {
    if (viewer) {
      viewer.dispose();
      viewer = null;
    }
    clearViewerCanvas();
  }

  function openViewer(p) {
    var token = ++openToken;
    closeViewerEngine();

    var modal = $('viewer-modal');
    var stage = $('viewer-stage');
    var fallback = $('viewer-fallback');

    $('viewer-cat').textContent = catInfo(p.category).label;
    $('viewer-title').textContent = p.name;
    $('viewer-price').innerHTML = priceHTML(p.price);
    $('viewer-add').onclick = function () { addToCart(p, 1); };

    fallback.hidden = true;
    modal.hidden = false;
    document.body.classList.add('rv-lock');
    $('viewer-close').focus();

    // A fresh canvas per open: a WebGL context cannot be reused once released.
    var canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', p.name + ': interactive 3D preview. Drag to rotate.');
    stage.insertBefore(canvas, stage.firstChild);

    RV3D.ready().then(function () {
      if (token !== openToken) return;
      viewer = RV3D.createViewer(canvas, { autoSpin: true, draggable: true, startAngle: 0.6 });
      viewer.setProduct(p.name);
    }).catch(function () {
      if (token !== openToken) return;
      clearViewerCanvas();
      fallback.hidden = false;
    });
  }

  function closeViewer() {
    openToken++;
    closeViewerEngine();
    $('viewer-modal').hidden = true;
    document.body.classList.remove('rv-lock');
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  $('product-list').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    var card = e.target.closest('.product-card');
    if (!btn || !card) return;

    var p = products[Number(card.getAttribute('data-id'))];
    if (!p) return;
    var qtyInput = card.querySelector('.product-quantity');

    if (btn.classList.contains('rv-qty-btn')) {
      var step = btn.getAttribute('data-act') === 'inc' ? 1 : -1;
      qtyInput.value = parseQty(parseQty(qtyInput.value) + step);
    } else if (btn.classList.contains('add-cart-button')) {
      addToCart(p, qtyInput.value);
    } else if (btn.classList.contains('rv-3d-btn')) {
      openViewer(p);
    }
  });

  $('category-chips').addEventListener('click', function (e) {
    var chip = e.target.closest('.rv-chip');
    if (!chip) return;
    activeCategory = chip.getAttribute('data-cat');
    document.querySelectorAll('.rv-chip').forEach(function (c) {
      c.classList.toggle('active', c === chip);
    });
    applyFilters();
  });

  $('search').addEventListener('input', applyFilters);

  $('cart-items').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var i = Number(btn.getAttribute('data-i'));
    var act = btn.getAttribute('data-cart');
    if (!cart[i]) return;

    if (act === 'inc') cart[i].qty = Math.min(999, cart[i].qty + 1);
    if (act === 'dec') {
      cart[i].qty -= 1;
      if (cart[i].qty < 1) cart.splice(i, 1);
    }
    if (act === 'remove') cart.splice(i, 1);

    saveCart();
    renderCart();
  });

  $('send-order-button').addEventListener('click', sendOrder);

  $('go-cart-button').addEventListener('click', function () {
    $('cart-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('viewer-close').addEventListener('click', closeViewer);
  $('viewer-modal').addEventListener('click', function (e) {
    if (e.target === e.currentTarget) closeViewer();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('viewer-modal').hidden) closeViewer();
  });

  /* ------------------------------------------------------------------ *
   * Start
   * ------------------------------------------------------------------ */

  renderCart();

  loadProducts()
    .then(function () {
      renderChips();
      renderCatalog();
      applyFilters();
    })
    .catch(function (err) {
      console.error(err);
      $('product-list').innerHTML =
        '<div class="col-12"><div class="alert alert-danger">Could not load the product list. ' +
        'Make sure products.txt is in the same folder as cart.html.</div></div>';
    });
})();

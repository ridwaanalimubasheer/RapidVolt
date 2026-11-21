/* Rapid Volt — shared product + cart data.
   Five real products, each backed by a downloadable GLB / STL / FBX model. */
(function (w) {
  'use strict';

  var P = [
    {
      key: 'cable',
      num: '01',
      name: '1CX16 Armoured Cable',
      fullName: '1CX16 CU/XLPE/SWA/PVC 1KV CABLE-ducab',
      cat: 'Cabling',
      price: 52.0,
      unit: 'per metre',
      kicker: 'Copper · XLPE · Steel · PVC',
      short: 'A 1 kV single-core armoured cable, cut open layer by layer.',
      desc: 'Built for the last metre and the hundred before it. Stranded copper conductor, XLPE insulation, galvanised steel wire armour and a black PVC oversheath. The model is a true cutaway — every layer is real geometry, not a texture.',
      specs: [
        ['Conductor', 'Stranded Cu · 16 mm²'],
        ['Voltage', '0.6 / 1 kV'],
        ['Build', 'Cu / XLPE / SWA / PVC'],
        ['Overall Ø', '13.4 mm']
      ],
      dims: '160.5 × 13.4 × 13.4 mm',
      tris: '19,496',
      photo: 'assets/img/products/cable-photo.png',
      render: 'assets/img/renders/cable.png',
      glb: 'assets/models/cable.glb',
      stl: 'assets/models/cable.stl',
      fbx: 'assets/models/cable.fbx',
      size: { stl: '952 KB', fbx: '616 KB', glb: '631 KB' },
      rot: [0.06, -0.55, 0.03],
      cam: 1.0
    },
    {
      key: 'coupler',
      num: '02',
      name: 'Cable Tray Joint Coupler',
      fullName: 'GI CABLE TRAY JOINT COUPLER',
      cat: 'Containment',
      price: 0,
      unit: 'price on request',
      kicker: 'Hot-dip galvanised',
      short: 'A twelve-slot joint plate for straight tray connections.',
      desc: 'Hot-dip galvanised steel joint plate for straight cable tray connections. Twelve slotted holes give the installer adjustment on site, while the 3 mm gauge keeps the run rigid.',
      specs: [
        ['Material', 'Hot-dip galvanised steel'],
        ['Size', '300 × 80 × 3 mm'],
        ['Holes', '12 slotted'],
        ['Use', 'Straight tray joint']
      ],
      dims: '300 × 80 × 3 mm',
      tris: '5,980',
      photo: 'assets/img/products/coupler-photo.png',
      render: 'assets/img/renders/coupler.png',
      glb: 'assets/models/coupler.glb',
      stl: 'assets/models/coupler.stl',
      fbx: 'assets/models/coupler.fbx',
      size: { stl: '292 KB', fbx: '89 KB', glb: '290 KB' },
      rot: [-1.08, 0.12, 0.0],
      cam: 0.96
    },
    {
      key: 'saddle',
      num: '03',
      name: '20 mm GI Saddle',
      fullName: '20MM GI SADDLE',
      cat: 'Fixings',
      price: 0,
      unit: 'price on request',
      kicker: 'Pressed steel · zinc passivated',
      short: 'A two-screw saddle that holds 20 mm conduit cleanly.',
      desc: 'A two-screw galvanised saddle that holds 20 mm conduit or cable cleanly against the surface. Pressed steel, zinc passivated, with a ribbed arch for grip and two M4 screws.',
      specs: [
        ['Size', '20 mm'],
        ['Material', 'GI steel'],
        ['Base', '52 × 24 mm'],
        ['Screws', '2 × M4']
      ],
      dims: '52 × 24 × 24 mm',
      tris: '3,888',
      photo: 'assets/img/products/saddle-photo.png',
      render: 'assets/img/renders/saddle.png',
      glb: 'assets/models/saddle.glb',
      stl: 'assets/models/saddle.stl',
      fbx: 'assets/models/saddle.fbx',
      size: { stl: '190 KB', fbx: '87 KB', glb: '89 KB' },
      rot: [-0.30, 0.62, 0.0],
      cam: 0.98
    },
    {
      key: 'gland',
      num: '04',
      name: '63L BW Cable Gland',
      fullName: '63L CABLE GLAND BW',
      cat: 'Cabling',
      price: 0,
      unit: 'price on request',
      kicker: 'Brass · IP68',
      short: 'A brass weatherproof gland, modelled part by part.',
      desc: 'A brass weatherproof gland for 63 mm cable. Hex body, knurled dome, rubber seal and earth tag — modelled as separate parts, ready for your own render or CAD check.',
      specs: [
        ['Type', 'BW 63L'],
        ['Material', 'Brass'],
        ['Entry', 'M63 × 1.5'],
        ['Seal', 'IP68']
      ],
      dims: '133.5 × 121.2 × 170 mm',
      tris: '7,316',
      photo: '',
      render: 'assets/img/renders/gland.png',
      glb: 'assets/models/gland.glb',
      stl: 'assets/models/gland.stl',
      fbx: 'assets/models/gland.fbx',
      size: { stl: '357 KB', fbx: '216 KB', glb: '245 KB' },
      rot: [0.10, 0.42, 0.0],
      cam: 1.0
    },
    {
      key: 'downlight',
      num: '05',
      name: 'Nitalite LED Downlight',
      fullName: 'nitalite led down light 15w',
      cat: 'Lighting',
      price: 0,
      unit: 'price on request',
      kicker: '15 W · die-cast aluminium',
      short: 'The real supplied CAD model, cleaned and re-materialled.',
      desc: 'A 15 W die-cast LED downlight with a deep finned heatsink and spring clips. The supplied CAD model, cleaned and re-materialled — 63,126 triangles of real product geometry, not a stand-in.',
      specs: [
        ['Power', '15 W'],
        ['Output', '1,200 lm'],
        ['CCT', '3000 / 4000 K'],
        ['Cut-out', 'Ø 120 mm']
      ],
      dims: '132.1 × 114.9 × 46.7 mm',
      tris: '63,126',
      photo: '',
      render: 'assets/img/renders/downlight.png',
      glb: 'assets/models/downlight.glb',
      stl: 'assets/models/downlight.stl',
      fbx: 'assets/models/downlight.fbx',
      size: { stl: '3.0 MB', fbx: '1.7 MB', glb: '1.8 MB' },
      rot: [-1.34, 0.34, 0.0],
      cam: 1.0
    }
  ];

  var byKey = {};
  P.forEach(function (p) { byKey[p.key] = p; });

  function money(n) { return Number(n).toFixed(2); }

  var CART_KEY = 'rapidvolt-cart-v1';

  var cart = {
    key: CART_KEY,
    read: function () {
      try {
        var v = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
        return Array.isArray(v) ? v.filter(function (i) {
          return i && typeof i.name === 'string' && typeof i.unitPrice === 'number' && i.qty > 0;
        }) : [];
      } catch (e) { return []; }
    },
    write: function (items) {
      try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) {}
      w.dispatchEvent(new CustomEvent('rv:cart'));
    },
    add: function (item, qty) {
      qty = Math.max(1, Math.min(999, parseInt(qty, 10) || 1));
      var items = cart.read();
      var found = null;
      for (var i = 0; i < items.length; i++) {
        if (items[i].name === item.name) { found = items[i]; break; }
      }
      if (found) found.qty = Math.min(999, found.qty + qty);
      else items.push({ name: item.name, unitPrice: Number(item.unitPrice) || 0, qty: qty, key: item.key || '' });
      cart.write(items);
      return items;
    },
    count: function () {
      return cart.read().reduce(function (s, i) { return s + i.qty; }, 0);
    },
    total: function () {
      return cart.read().reduce(function (s, i) { return s + i.unitPrice * i.qty; }, 0);
    }
  };

  w.RV_PRODUCTS = P;
  w.RV_BY_KEY = byKey;
  w.RV_CART = cart;
  w.RV_MONEY = money;
})(window);

/*!
 * Rapid Volt - 3D product viewer
 *
 * Products are modelled procedurally with Three.js, so no model files are
 * required. Three.js is loaded on demand the first time a 3D view is needed,
 * and every 3D feature falls back to a plain icon if WebGL or the CDN is
 * unavailable.
 *
 * window.RV3D
 *   ready()                    -> Promise<THREE>, resolves when WebGL and Three.js are usable
 *   createViewer(canvas, opts) -> { setProduct(name), setAngle(radians), dispose() }
 *   kindFor(name)              -> model family used for a product name
 */
(function (global) {
  'use strict';

  var THREE_SOURCES = [
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'
  ];

  var prefersReducedMotion = !!(global.matchMedia &&
    global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function nowMs() {
    return global.performance && global.performance.now
      ? global.performance.now()
      : Date.now();
  }

  /* ------------------------------------------------------------------ *
   * Loading
   * ------------------------------------------------------------------ */

  var threePromise = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        if (s.parentNode) s.parentNode.removeChild(s);
        reject(new Error('Could not load ' + src));
      };
      document.head.appendChild(s);
    });
  }

  function loadThree() {
    if (global.THREE) return Promise.resolve(global.THREE);
    if (!threePromise) {
      threePromise = THREE_SOURCES.reduce(function (chain, src) {
        return chain.catch(function () { return loadScript(src); });
      }, Promise.reject(new Error('start')))
        .then(function () { return global.THREE; });
    }
    return threePromise;
  }

  function supportsWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(global.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  function ready() {
    return loadThree().then(function (THREE) {
      if (!supportsWebGL()) throw new Error('WebGL is not available');
      return THREE;
    });
  }

  /* ------------------------------------------------------------------ *
   * Which model family a product uses (decided from its name)
   * ------------------------------------------------------------------ */

  function kindFor(name) {
    var n = String(name || '').toLowerCase();
    if (/\blight\b|\bled\b|downlight|lamp/.test(n)) return 'light';
    if (/hdmi|extender/.test(n)) return 'hdmi';
    if (/\bglue\b/.test(n)) return 'bottle';
    if (/gland/.test(n)) return 'gland';
    if (/\blugs?\b/.test(n)) return 'lug';
    if (/\bties?\b|clip/.test(n)) return 'tie';
    if (/saddle|adopter|coupler|\btray\b/.test(n)) return 'fitting';
    if (/hole saw/.test(n)) return 'holesaw';
    if (/\bbits?\b/.test(n)) return 'bit';
    if (/\bnut\b/.test(n)) return 'nut';
    if (/plug|screw|bolt/.test(n)) return 'fastener';
    if (/cable|ducab|cx/.test(n)) return 'cable';
    return 'box';
  }

  /* ------------------------------------------------------------------ *
   * Model building helpers
   * ------------------------------------------------------------------ */

  var helixCache = null;

  // A helix curve, used for coiled cable and drill-bit flutes.
  function helixClass(THREE) {
    if (!helixCache) {
      helixCache = class Helix extends THREE.Curve {
        constructor(radius, height, turns) {
          super();
          this.radius = radius;
          this.height = height;
          this.turns = turns;
        }
        getPoint(t, target) {
          var v = target || new THREE.Vector3();
          var a = t * this.turns * Math.PI * 2;
          return v.set(
            Math.cos(a) * this.radius,
            (t - 0.5) * this.height,
            Math.sin(a) * this.radius
          );
        }
      };
    }
    return helixCache;
  }

  function makeMaterialFactory(THREE) {
    return function (color, o) {
      o = o || {};
      return new THREE.MeshStandardMaterial({
        color: color,
        roughness: o.roughness !== undefined ? o.roughness : 0.5,
        metalness: o.metalness !== undefined ? o.metalness : 0.1,
        emissive: o.emissive !== undefined ? o.emissive : 0x000000,
        emissiveIntensity: o.emissiveIntensity !== undefined ? o.emissiveIntensity : 1,
        side: o.double ? THREE.DoubleSide : THREE.FrontSide
      });
    };
  }

  function Builder(THREE) {
    this.THREE = THREE;
    this.Helix = helixClass(THREE);
    this.group = new THREE.Group();
    this.mat = makeMaterialFactory(THREE);
  }

  Builder.prototype.add = function (geometry, material, x, y, z, rx, ry, rz) {
    var mesh = new this.THREE.Mesh(geometry, material);
    mesh.position.set(x || 0, y || 0, z || 0);
    if (rx || ry || rz) mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    this.group.add(mesh);
    return mesh;
  };

  // Threaded fastener profile (lathe points, top to bottom, then reversed).
  function threadProfile(THREE, cfg) {
    var V = function (x, y) { return new THREE.Vector2(x, y); };
    var top = 1.0;
    var pts = [
      V(0, top),
      V(cfg.headR * 0.85, top),
      V(cfg.headR, top - 0.1),
      V(cfg.headR, top - cfg.headH),
      V(cfg.shankR, top - cfg.headH - 0.02)
    ];
    var y = top - cfg.headH - 0.02;
    var step = cfg.length / (cfg.ribs * 2);
    for (var i = 0; i < cfg.ribs; i++) {
      y -= step;
      pts.push(V(cfg.ribR, y));
      y -= step;
      pts.push(V(cfg.shankR, y));
    }
    pts.push(V(0, y - step));
    pts.reverse();
    return pts;
  }

  /* ------------------------------------------------------------------ *
   * Models
   * ------------------------------------------------------------------ */

  var BUILDERS = {

    light: function (b) {
      b.group.rotation.x = -Math.PI / 2; // turn the lens toward the viewer
      var housing = b.mat(0xf3f5f8, { roughness: 0.35 });
      var chrome = b.mat(0xd7dde5, { roughness: 0.2, metalness: 0.9 });
      var fins = b.mat(0xc9d1db, { roughness: 0.4, metalness: 0.6 });
      var lens = b.mat(0xfff3d1, { emissive: 0xffe9b0, emissiveIntensity: 0.9, roughness: 0.6, double: true });
      b.add(new b.THREE.CylinderGeometry(0.95, 0.8, 0.7, 64), housing, 0, 0.35, 0);
      b.add(new b.THREE.CircleGeometry(0.8, 64), lens, 0, -0.01, 0, Math.PI / 2, 0, 0);
      b.add(new b.THREE.TorusGeometry(0.84, 0.05, 16, 64), chrome, 0, 0, 0, Math.PI / 2, 0, 0);
      for (var i = 0; i < 16; i++) {
        var a = (i / 16) * Math.PI * 2;
        b.add(new b.THREE.BoxGeometry(0.42, 0.5, 0.05), fins,
          Math.cos(a) * 1.13, 0.35, Math.sin(a) * 1.13, 0, -a, 0);
      }
    },

    cable: function (b, ctx) {
      var jacket = b.mat(ctx.yellow ? 0xc5d62c : 0x2b2f36, { roughness: 0.55 });
      var copper = b.mat(0xc27a3c, { metalness: 0.8, roughness: 0.3 });
      var curve = new b.Helix(0.9, 2.2, 4);
      b.add(new b.THREE.TubeGeometry(curve, 320, 0.2, 18, false), jacket, 0, 0, 0);
      var start = curve.getPoint(0);
      var end = curve.getPoint(1);
      b.add(new b.THREE.SphereGeometry(0.2, 18, 12), copper, start.x, start.y, start.z);
      b.add(new b.THREE.SphereGeometry(0.2, 18, 12), copper, end.x, end.y, end.z);
    },

    gland: function (b) {
      var metal = b.mat(0xc9ced6, { metalness: 0.85, roughness: 0.35 });
      var sleeve = b.mat(0x9aa2ac, { metalness: 0.7, roughness: 0.5 });
      var rubber = b.mat(0x1d1f23, { roughness: 0.9 });
      b.add(new b.THREE.CylinderGeometry(0.62, 0.62, 0.95, 6), metal, 0, 0.1, 0);
      b.add(new b.THREE.CylinderGeometry(0.62, 0.62, 0.18, 6), metal, 0, 0.66, 0);
      b.add(new b.THREE.SphereGeometry(0.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), metal, 0, 0.75, 0);
      b.add(new b.THREE.CylinderGeometry(0.34, 0.34, 0.8, 32), sleeve, 0, -0.8, 0);
      b.add(new b.THREE.TorusGeometry(0.34, 0.09, 16, 40), rubber, 0, -1.2, 0, Math.PI / 2, 0, 0);
      b.group.rotation.x = 0.25;
    },

    lug: function (b) {
      var copper = b.mat(0xc2773a, { metalness: 0.85, roughness: 0.3 });
      var sleeve = b.mat(0xd7262e, { roughness: 0.7 });
      var w = 0.55, h = 1.5, r = 0.22;
      var s = new b.THREE.Shape();
      s.moveTo(-w, 0);
      s.lineTo(w, 0);
      s.lineTo(w, h - r);
      s.quadraticCurveTo(w, h, w - r, h);
      s.lineTo(-w + r, h);
      s.quadraticCurveTo(-w, h, -w, h - r);
      s.lineTo(-w, 0);
      var hole = new b.THREE.Path();
      hole.absarc(0, h - 0.42, 0.2, 0, Math.PI * 2, true);
      s.holes.push(hole);
      var paddle = new b.THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 16 });
      paddle.translate(0, 0, -0.06);
      b.add(paddle, copper, 0, 0, 0);
      b.add(new b.THREE.CylinderGeometry(0.3, 0.3, 1.0, 32), copper, 0, -0.5, 0);
      b.add(new b.THREE.CylinderGeometry(0.36, 0.36, 0.6, 32), sleeve, 0, -1.3, 0);
      b.group.rotation.set(0.2, -0.5, 0);
    },

    tie: function (b, ctx) {
      var clip = /clip/i.test(ctx.name);
      var white = b.mat(0xf1f3f5, { roughness: 0.6 });
      var radius = clip ? 0.5 : 0.9;
      var arc = clip ? Math.PI * 1.45 : Math.PI * 1.7;
      b.add(new b.THREE.TorusGeometry(radius, clip ? 0.07 : 0.09, 16, 64, arc), white, 0, 0, 0);
      b.add(new b.THREE.BoxGeometry(0.32, 0.26, 0.2), white, radius, 0, 0);
      if (clip) {
        b.add(new b.THREE.BoxGeometry(0.9, 0.14, 0.5), b.mat(0xaab3bd, { metalness: 0.6 }), 0, -radius - 0.25, 0);
      }
      b.group.rotation.x = 0.5;
    },

    fitting: function (b) {
      var galv = b.mat(0xa9b4bf, { metalness: 0.7, roughness: 0.45 });
      var s = new b.THREE.Shape();
      s.moveTo(-1.1, 0.7);
      s.lineTo(-1.1, -0.4);
      s.lineTo(1.1, -0.4);
      s.lineTo(1.1, 0.7);
      s.lineTo(0.9, 0.7);
      s.lineTo(0.9, -0.2);
      s.lineTo(-0.9, -0.2);
      s.lineTo(-0.9, 0.7);
      s.lineTo(-1.1, 0.7);
      var channel = new b.THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: false });
      channel.translate(0, 0, -0.5);
      b.add(channel, galv, 0, 0, 0);
      b.group.rotation.set(-0.35, 0.5, 0);
    },

    holesaw: function (b) {
      var steel = b.mat(0xb4bcc6, { metalness: 0.9, roughness: 0.3, double: true });
      var teeth = b.mat(0x5b636e, { metalness: 0.8, roughness: 0.4 });
      var shank = b.mat(0x6d7681, { metalness: 0.8, roughness: 0.35 });
      b.add(new b.THREE.CylinderGeometry(0.85, 0.85, 0.9, 48, 1, true), steel, 0, 0, 0);
      b.add(new b.THREE.RingGeometry(0.3, 0.85, 48), steel, 0, -0.45, 0, Math.PI / 2, 0, 0);
      for (var i = 0; i < 24; i++) {
        var a = (i / 24) * Math.PI * 2;
        b.add(new b.THREE.BoxGeometry(0.14, 0.22, 0.14), teeth,
          Math.cos(a) * 0.87, 0.5, Math.sin(a) * 0.87, 0, -a, 0);
      }
      b.add(new b.THREE.CylinderGeometry(0.2, 0.2, 0.5, 24), shank, 0, 0.7, 0);
      b.group.rotation.x = 0.3;
    },

    bit: function (b, ctx) {
      var metal = b.mat(0xc7ccd3, { metalness: 0.9, roughness: 0.3 });
      var tip = b.mat(ctx.concrete ? 0x3a3f47 : 0x9aa3ad, { metalness: 0.85, roughness: 0.35 });
      var flute = b.mat(0x6b7480, { metalness: 0.8, roughness: 0.4 });
      b.add(new b.THREE.CylinderGeometry(0.14, 0.14, 2.4, 32), metal, 0, 0.2, 0);
      b.add(new b.THREE.CylinderGeometry(0.15, 0.15, 0.5, 6), metal, 0, 1.65, 0);
      b.add(new b.THREE.ConeGeometry(0.14, 0.42, 32), tip, 0, -1.21, 0, Math.PI, 0, 0);
      var spiral = new b.Helix(0.15, 2.0, 5);
      b.add(new b.THREE.TubeGeometry(spiral, 200, 0.035, 8, false), flute, 0, 0.2, 0);
      b.group.rotation.x = 0.3;
    },

    nut: function (b) {
      var metal = b.mat(0xc9ced6, { metalness: 0.85, roughness: 0.35, double: true });
      var s = new b.THREE.Shape();
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        var x = Math.cos(a) * 0.8;
        var y = Math.sin(a) * 0.8;
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
      }
      s.closePath();
      var hole = new b.THREE.Path();
      hole.absarc(0, 0, 0.38, 0, Math.PI * 2, true);
      s.holes.push(hole);
      var g = new b.THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false, curveSegments: 24 });
      g.translate(0, 0, -0.25);
      g.rotateX(Math.PI / 2);
      b.add(g, metal, 0, 0, 0);
      b.group.rotation.x = 0.3;
    },

    fastener: function (b, ctx) {
      var metal = b.mat(0xc3c9d1, { metalness: 0.85, roughness: 0.35, double: true });
      var cfg = /plug/i.test(ctx.name)
        ? { headR: 0.55, headH: 0.2, shankR: 0.3, ribR: 0.4, ribs: 6, length: 1.6 }
        : { headR: 0.55, headH: 0.25, shankR: 0.2, ribR: 0.3, ribs: 9, length: 2.0 };
      b.add(new b.THREE.LatheGeometry(threadProfile(b.THREE, cfg), 40), metal, 0, 0, 0);
      b.group.rotation.x = 0.35;
    },

    bottle: function (b) {
      var body = b.mat(0x2f6fd6, { roughness: 0.35, double: true });
      var label = b.mat(0xf5f7fa, { roughness: 0.5, double: true });
      var cap = b.mat(0xdfe3e8, { metalness: 0.3, roughness: 0.4 });
      var outline = [
        [0, -1.0], [0.72, -1.0], [0.76, -0.92], [0.76, 0.45],
        [0.55, 0.7], [0.32, 0.85], [0.32, 0.98], [0, 0.98]
      ].map(function (p) { return new b.THREE.Vector2(p[0], p[1]); });
      b.add(new b.THREE.LatheGeometry(outline, 48), body, 0, 0, 0);
      b.add(new b.THREE.CylinderGeometry(0.77, 0.77, 0.7, 48, 1, true), label, 0, -0.1, 0);
      b.add(new b.THREE.CylinderGeometry(0.3, 0.3, 0.3, 32), cap, 0, 1.12, 0);
      b.group.rotation.x = 0.2;
    },

    hdmi: function (b) {
      var body = b.mat(0x22262c, { roughness: 0.4, metalness: 0.3 });
      var port = b.mat(0x060607, { roughness: 0.8 });
      var led = b.mat(0x22ff88, { emissive: 0x22ff88, emissiveIntensity: 1.6 });
      b.add(new b.THREE.BoxGeometry(2.2, 0.5, 1.4), body, 0, 0, 0);
      b.add(new b.THREE.BoxGeometry(0.7, 0.2, 0.05), port, -0.55, 0, 0.72);
      b.add(new b.THREE.BoxGeometry(0.7, 0.2, 0.05), port, 0.55, 0, 0.72);
      b.add(new b.THREE.SphereGeometry(0.06, 16, 12), led, 0.95, 0.12, 0.74);
      for (var i = 0; i < 6; i++) {
        b.add(new b.THREE.BoxGeometry(0.1, 0.02, 1.0), port, -0.9 + i * 0.36, 0.26, 0);
      }
      b.group.rotation.set(0.2, 0.4, 0);
    },

    box: function (b) {
      var body = b.mat(0xb9c3cd, { metalness: 0.55, roughness: 0.45 });
      var knock = b.mat(0x8c96a2, { metalness: 0.6, roughness: 0.4 });
      b.add(new b.THREE.BoxGeometry(1.8, 1.2, 1.2), body, 0, 0, 0);
      [[-0.45, 0.2], [0.1, -0.25], [0.5, 0.25]].forEach(function (p) {
        b.add(new b.THREE.CylinderGeometry(0.2, 0.2, 0.04, 24), knock, p[0], 0.62, p[1]);
      });
      b.group.rotation.set(0.25, 0.5, 0);
    }
  };

  // Scale a model so it fits the frame and is centred on the pivot.
  function normalize(THREE, group) {
    group.position.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    group.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(group);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    var s = 2.6 / maxDim;
    group.scale.setScalar(s);
    group.position.copy(center).multiplyScalar(-s);
    return group;
  }

  function buildModel(THREE, name) {
    var kind = kindFor(name);
    var label = String(name || '');
    var b = new Builder(THREE);
    var ctx = {
      name: label,
      yellow: /\byg\b|yellow|green/i.test(label),
      concrete: /concrete/i.test(label)
    };
    (BUILDERS[kind] || BUILDERS.box)(b, ctx);
    b.group.userData.kind = kind;
    return normalize(THREE, b.group);
  }

  function disposeTree(root) {
    root.traverse(function (o) {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
          if (m.dispose) m.dispose();
        });
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Viewer
   * ------------------------------------------------------------------ */

  function createViewer(canvas, options) {
    var THREE = global.THREE;
    if (!THREE) throw new Error('Three.js is not loaded');
    options = options || {};

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3442, 0.9));
    var key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 5, 6);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x7fb8ff, 0.8);
    rim.position.set(-5, 2, -4);
    scene.add(rim);

    var pivot = new THREE.Group();
    scene.add(pivot);

    var model = null;
    var current = null;
    var angle = options.startAngle || 0;
    var targetAngle = angle;
    var spin = options.autoSpin !== false && !prefersReducedMotion;
    var draggable = options.draggable !== false;
    var dragging = false;
    var lastX = 0;
    var onScreen = true;
    var disposed = false;
    var enterStart = -1;
    var t0 = nowMs();
    var rafId = 0;

    function resize() {
      var w = canvas.clientWidth || 300;
      var h = canvas.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Pull the camera back on narrow screens so the product is never clipped.
      camera.position.set(0, 0.9, 7.2 * Math.max(1, 0.95 / camera.aspect));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    var resizeObserver = null;
    if (global.ResizeObserver) {
      resizeObserver = new global.ResizeObserver(resize);
      resizeObserver.observe(canvas);
    } else {
      global.addEventListener('resize', resize);
    }
    var intersection = null;
    if (global.IntersectionObserver) {
      intersection = new global.IntersectionObserver(function (entries) {
        onScreen = entries[entries.length - 1].isIntersecting;
      });
      intersection.observe(canvas);
    }
    resize();

    function onPointerDown(e) {
      dragging = true;
      lastX = e.clientX;
      canvas.classList.add('is-dragging');
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
      }
    }
    function onPointerMove(e) {
      if (!dragging) return;
      targetAngle += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    }
    function onPointerUp() {
      dragging = false;
      canvas.classList.remove('is-dragging');
    }
    if (draggable) {
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
    }

    function frame(now) {
      if (disposed) return;
      rafId = global.requestAnimationFrame(frame);
      if (!onScreen) return;

      var time = typeof now === 'number' ? now : nowMs();
      if (spin && !dragging) targetAngle += 0.008;
      angle += (targetAngle - angle) * 0.12;
      pivot.rotation.y = angle;
      pivot.position.y = Math.sin((time - t0) / 1100) * 0.05;

      if (enterStart >= 0) {
        var k = Math.min(1, (time - enterStart) / 550);
        var eased = 1 - Math.pow(1 - k, 3);
        pivot.scale.setScalar(Math.max(0.001, eased));
        if (k >= 1) enterStart = -1;
      }
      renderer.render(scene, camera);
    }
    rafId = global.requestAnimationFrame(frame);

    function setProduct(name) {
      if (disposed || name === current) return;
      if (model) {
        pivot.remove(model);
        disposeTree(model);
      }
      model = buildModel(THREE, name);
      pivot.add(model);
      current = name;
      enterStart = nowMs();
    }

    function setAngle(radians) {
      targetAngle = radians;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      global.cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      else global.removeEventListener('resize', resize);
      if (intersection) intersection.disconnect();
      if (draggable) {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
      }
      if (model) {
        pivot.remove(model);
        disposeTree(model);
        model = null;
      }
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    }

    return {
      setProduct: setProduct,
      setAngle: setAngle,
      dispose: dispose,
      get product() { return current; }
    };
  }

  global.RV3D = {
    ready: ready,
    supportsWebGL: supportsWebGL,
    createViewer: createViewer,
    kindFor: kindFor,
    _buildModel: buildModel // exposed for testing
  };
})(typeof window !== 'undefined' ? window : this);

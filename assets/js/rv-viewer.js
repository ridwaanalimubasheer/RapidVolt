/* Rapid Volt — real product 3D viewer.
   Loads the exported GLB files (real geometry), with a studio environment,
   orbit controls, wireframe mode and a soft contact glow. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const loader = new GLTFLoader();
const cache = new Map();
const TAU = Math.PI * 2;

function loadModel(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    }));
  }
  return cache.get(url);
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(200,255,61,0.34)');
  g.addColorStop(0.45, 'rgba(150,190,50,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const prefersReduced = window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class ProductViewer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.opts = Object.assign({
      controls: false,
      drag: true,
      autoRotate: true,
      spinSpeed: 0.28,
      environment: 0.7,
      startKey: null
    }, options);

    this.key = null;
    this.pendingKey = null;
    this.progress = 0;
    this.parallax = { x: 0, y: 0 };
    this.dragOffset = 0;
    this.spin = 0;
    this.entering = 1;
    this.visible = true;
    this.disposed = false;
    this.dragging = false;
    this.lastPointer = 0;
    this.resumeAt = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
    this.camera.position.set(0, 0.12, 2.45);
    this.camera.lookAt(0, 0, 0);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.045);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = this.opts.environment;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1d1a, 0.5);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff5e6, 2.6);
    key.position.set(3.2, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -2.2;
    key.shadow.camera.right = 2.2;
    key.shadow.camera.top = 2.2;
    key.shadow.camera.bottom = -2.2;
    key.shadow.bias = -0.0008;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0xc8ff3d, 1.1);
    rim.position.set(-3.5, 1.6, -3);
    this.scene.add(rim);

    const fill = new THREE.DirectionalLight(0xa9c6ff, 0.7);
    fill.position.set(-2, 1.2, 3);
    this.scene.add(fill);

    this.shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.34, transparent: true })
    );
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.position.y = -0.62;
    this.shadowPlane.receiveShadow = true;
    this.scene.add(this.shadowPlane);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.2),
      new THREE.MeshBasicMaterial({
        map: makeGlowTexture(),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.6;
    this.scene.add(glow);
    this.glow = glow;

    this.spinGroup = new THREE.Group();
    this.poseGroup = new THREE.Group();
    this.spinGroup.add(this.poseGroup);
    this.scene.add(this.spinGroup);

    if (this.opts.controls) {
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.07;
      this.controls.enablePan = false;
      this.controls.minDistance = 1.5;
      this.controls.maxDistance = 4.6;
      this.controls.rotateSpeed = 0.65;
      this.controls.zoomSpeed = 0.8;
      this.controls.autoRotate = !!this.opts.autoRotate && !prefersReduced;
      this.controls.autoRotateSpeed = 1.1;
      this.controls.target.set(0, 0, 0);
      this.controls.addEventListener('start', () => { this.resumeAt = Infinity; });
      this.controls.addEventListener('end', () => {
        this.resumeAt = performance.now() + 2400;
      });
    }

    if (this.opts.drag) this.bindDrag();
    this.bindResize();

    this.clock = new THREE.Clock();
    this.raf = requestAnimationFrame(this.tick);
  }

  bindResize() {
    const resize = () => {
      const w = this.canvas.clientWidth || 1;
      const h = this.canvas.clientHeight || 1;
      this.renderer.setSize(w, h, false);
      const aspect = w / h;
      this.camera.aspect = aspect;
      // Keep the whole product in frame on portrait screens.
      this.camera.position.z = 2.45 / Math.min(1, aspect * 1.08);
      this.camera.updateProjectionMatrix();
    };
    this.resize = resize;
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(resize);
      this.ro.observe(this.canvas);
    } else {
      window.addEventListener('resize', resize);
    }
    resize();

    if (window.IntersectionObserver) {
      this.io = new IntersectionObserver((entries) => {
        this.visible = entries[entries.length - 1].isIntersecting;
      }, { rootMargin: '120px' });
      this.io.observe(this.canvas);
    }
  }

  bindDrag() {
    const canvas = this.canvas;
    let startX = 0;
    let startY = 0;
    let baseX = 0;
    let baseY = 0;

    const down = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      this.dragging = true;
      this.resumeAt = Infinity;
      startX = e.clientX;
      startY = e.clientY;
      baseX = this.dragOffset;
      baseY = this.parallax.y;
      canvas.classList.add('is-dragging');
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      }
    };
    const move = (e) => {
      if (!this.dragging) return;
      this.dragOffset = baseX + (e.clientX - startX) * 0.0085;
      this.parallax.y = Math.max(-0.3, Math.min(0.3, baseY + (e.clientY - startY) * 0.0035));
    };
    const up = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.resumeAt = performance.now() + 1600;
      canvas.classList.remove('is-dragging');
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    this._dragOff = () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }

  async setProduct(key, opts = {}) {
    const data = (window.RV_BY_KEY || {})[key];
    if (!data) return;
    if (key === this.key && this.model) return;
    this.pendingKey = key;

    const gltf = await loadModel(data.glb);
    if (this.disposed || this.pendingKey !== key) return;

    // fresh materials so wireframe / disposal never touches the cache
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = Array.isArray(o.material)
        ? mats.map((m) => this.cloneMaterial(m))
        : this.cloneMaterial(mats[0]);
    });

    this.poseGroup.clear();
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = 1 / maxDim;
    root.position.set(-center.x * s, -center.y * s, -center.z * s);
    root.scale.setScalar(s);

    const rot = data.rot || [0, 0, 0];
    this.poseGroup.rotation.set(rot[0], rot[1], rot[2]);
    this.poseGroup.add(root);
    this.model = root;
    this.key = key;
    this.entering = 0;
    this.spin = 0;
    this.dragOffset = 0;
    this.parallax.y = 0;

    // place the soft shadow just under the posed model
    this.scene.updateMatrixWorld(true);
    const posed = new THREE.Box3().setFromObject(root);
    const floor = posed.min.y - 0.02;
    this.shadowPlane.position.y = floor;
    this.glow.position.y = floor - 0.005;

    if (this.controls) {
      this.controls.target.set(0, (posed.max.y + posed.min.y) / 2, 0);
      this.controls.update();
    }
    return root;
  }

  cloneMaterial(m) {
    if (!m) return m;
    const c = m.clone();
    if ('envMapIntensity' in c) c.envMapIntensity = 1.05;
    if (c.map) c.map.colorSpace = THREE.SRGBColorSpace;
    return c;
  }

  setProgress(p) {
    this.progress = Math.max(0, Math.min(1, p));
  }

  setParallax(x, y) {
    this.parallax.x = Math.max(-1, Math.min(1, x));
    this.parallax.y = Math.max(-0.35, Math.min(0.35, y));
  }

  setWireframe(on) {
    this.wireframe = !!on;
    if (!this.model) return;
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { if (m) m.wireframe = !!on; });
    });
  }

  setAutoRotate(on) {
    this.opts.autoRotate = !!on;
    if (this.controls) this.controls.autoRotate = !!on;
  }

  reset() {
    this.spin = 0;
    this.dragOffset = 0;
    this.progress = 0;
    this.parallax.x = 0;
    this.parallax.y = 0;
    if (this.controls) {
      this.camera.position.set(0, 0.12, 2.45);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  tick = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    if (!this.visible) return;

    const dt = Math.min(0.05, this.clock.getDelta());
    const now = performance.now();

    if (this.opts.autoRotate && !this.dragging && !prefersReduced && now > this.resumeAt) {
      this.spin += dt * this.opts.spinSpeed;
    }

    if (this.entering < 1) {
      this.entering = Math.min(1, this.entering + dt * 2.6);
    }
    const ease = 1 - Math.pow(1 - this.entering, 4);

    const targetY = this.spin + this.dragOffset + this.progress * TAU * 1.35;
    this.spinGroup.rotation.y += (targetY - this.spinGroup.rotation.y) * 0.09;
    this.spinGroup.rotation.x += ((this.parallax.y || 0) * 0.22 - this.spinGroup.rotation.x) * 0.06;

    const px = this.parallax.x || 0;
    this.spinGroup.position.x += (px * 0.06 - this.spinGroup.position.x) * 0.05;
    this.spinGroup.position.y = Math.sin(now * 0.00055) * 0.012;

    this.spinGroup.scale.setScalar(0.94 + 0.06 * ease);

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect();
    else window.removeEventListener('resize', this.resize);
    if (this.io) this.io.disconnect();
    if (this._dragOff) this._dragOff();
    if (this.controls) this.controls.dispose();
    if (this.model) {
      this.model.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m) m.dispose(); });
      });
    }
    if (this.envRT) this.envRT.dispose();
    this.renderer.dispose();
    if (this.renderer.forceContextLoss) this.renderer.forceContextLoss();
  }
}

export { loadModel };

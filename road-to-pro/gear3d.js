// Spinning 3D gear: a diamond padel racket (black/red) between a left and right court shoe (white/orange).
// Stylised models built from code with three.js; no product files or logos are used.
(function () {
  const host = document.querySelector('.gear3d');
  const canvas = host && host.querySelector('canvas');
  if (!canvas || !window.THREE) return;
  const T = THREE;
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch (e) { host.classList.add('no3d'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 15);
  scene.add(new T.HemisphereLight(0xffffff, 0x8a8a8a, 0.62));
  const key = new T.DirectionalLight(0xffffff, 0.78); key.position.set(4, 6, 7); scene.add(key);
  const rim = new T.DirectionalLight(0xffffff, 0.4); rim.position.set(-6, 3, -6); scene.add(rim);
  const low = new T.DirectionalLight(0xffffff, 0.18); low.position.set(0, -5, 4); scene.add(low);

  const mat = (color, rough, metal) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal || 0 });
  const BLACK = mat(0x121212, 0.42, 0.35), RED = mat(0xd81e2c, 0.4, 0.2), GRIP = mat(0x1c1c1c, 0.95),
        WHITE = mat(0xf6f6f4, 0.62), OFF = mat(0xdedede, 0.7), ORANGE = mat(0xff5a1f, 0.5), DARK = mat(0x1d1d1d, 0.9);

  // ---------- racket ----------
  function buildRacket() {
    const g = new T.Group();
    const s = new T.Shape();
    s.moveTo(-0.24, -1.15);
    s.bezierCurveTo(-0.55, -0.75, -1.32, -0.1, -1.32, 1.0);
    s.bezierCurveTo(-1.32, 1.85, -0.7, 2.3, 0, 2.3);
    s.bezierCurveTo(0.7, 2.3, 1.32, 1.85, 1.32, 1.0);
    s.bezierCurveTo(1.32, -0.1, 0.55, -0.75, 0.24, -1.15);
    s.lineTo(-0.24, -1.15);
    const heart = new T.Path();                       // open throat
    heart.moveTo(0, -0.98); heart.lineTo(0.5, -0.2);
    heart.quadraticCurveTo(0, -0.42, -0.5, -0.2); heart.lineTo(0, -0.98);
    s.holes.push(heart);
    for (let y = 0.02; y < 2.1; y += 0.26) {          // drilled face
      const row = Math.round(y / 0.26);
      for (let x = -1.04 + (row % 2 ? 0.13 : 0); x < 1.05; x += 0.26) {
        const dx = x / 0.98, dy = (y - 1.05) / 1.02;
        if (dx * dx + dy * dy > 0.9) continue;
        const h = new T.Path(); h.absarc(x, y, 0.062, 0, Math.PI * 2, true); s.holes.push(h);
      }
    }
    const body = new T.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 3, curveSegments: 28 });
    body.translate(0, 0, -0.15);
    g.add(new T.Mesh(body, BLACK));

    const pts = s.getPoints(40).filter((p) => p.y > -0.5).map((p) => new T.Vector3(p.x * 1.035, 1 + (p.y - 1) * 1.035, 0));
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 140, 0.055, 8, false), RED)); // red frame edge

    [[-0.62, -0.5], [-0.82, -0.2], [0.62, -0.5], [0.82, -0.2]].forEach(([x, y]) => {               // weight screws
      const c = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.44, 12), RED);
      c.rotation.x = Math.PI / 2; c.position.set(x, y, 0); g.add(c);
    });

    const handle = new T.Mesh(new T.CylinderGeometry(0.2, 0.19, 1.3, 8), GRIP);
    handle.position.y = -1.78; handle.scale.z = 0.82; g.add(handle);
    for (let i = 0; i < 9; i++) {                       // grip wrap ridges
      const r = new T.Mesh(new T.TorusGeometry(0.2, 0.014, 6, 16), DARK);
      r.rotation.x = Math.PI / 2 + 0.22; r.scale.set(1, 0.82, 1); r.position.y = -1.22 - i * 0.135; g.add(r);
    }
    const cap = new T.Mesh(new T.CylinderGeometry(0.235, 0.235, 0.12, 8), RED);
    cap.position.y = -2.48; cap.scale.z = 0.82; g.add(cap);
    return g;
  }

  // ---------- shoe ----------
  const WIDTH = [[0, 0.72], [0.12, 0.85], [0.38, 0.8], [0.68, 1], [0.88, 0.86], [1, 0.5]];
  function widthAt(u) {
    for (let i = 1; i < WIDTH.length; i++) {
      if (u <= WIDTH[i][0]) {
        const [u0, w0] = WIDTH[i - 1], [u1, w1] = WIDTH[i];
        const k = (1 - Math.cos(Math.PI * (u - u0) / (u1 - u0))) / 2;
        return w0 + (w1 - w0) * k;
      }
    }
    return 0.5;
  }
  // Side profile -> extrude across the foot -> pinch to a footprint and narrow towards the collar.
  function part(shape, depth, side, taper) {
    const geo = new T.ExtrudeGeometry(shape, { depth, steps: 14, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.07, bevelSegments: 4, curveSegments: 36 });
    geo.translate(0, 0, -depth / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), u = Math.min(1, Math.max(0, x / 3));
      let w = widthAt(u);
      if (taper) { const t = Math.min(1, Math.max(0, (y - 0.32) / 0.85)); w *= 1 - 0.42 * Math.pow(t, 1.4); }
      p.setZ(i, p.getZ(i) * w + side * 0.13 * Math.sin(Math.PI * u));
    }
    geo.computeVertexNormals();
    return geo;
  }
  function buildShoe(side) {
    const g = new T.Group();
    const upper = new T.Shape();
    upper.moveTo(0.05, 0.3);
    upper.bezierCurveTo(-0.06, 0.7, 0, 1.05, 0.2, 1.15);
    upper.quadraticCurveTo(0.6, 0.93, 1.02, 1.12);
    upper.bezierCurveTo(1.5, 1.0, 2.0, 0.66, 2.45, 0.56);
    upper.bezierCurveTo(2.85, 0.52, 3.0, 0.42, 2.98, 0.3);
    upper.lineTo(0.05, 0.3);
    g.add(new T.Mesh(part(upper, 0.92, side, true), WHITE));

    const sole = new T.Shape();
    sole.moveTo(-0.04, 0.12); sole.lineTo(-0.06, 0.38); sole.lineTo(3.02, 0.36); sole.lineTo(3.05, 0.24);
    sole.bezierCurveTo(2.6, 0.02, 1.2, -0.02, -0.04, 0.12);
    g.add(new T.Mesh(part(sole, 1.0, side, false), WHITE));
    const out = new T.Mesh(part(sole, 1.02, side, false), ORANGE);   // outsole
    out.scale.y = 0.3; out.position.y = -0.03; g.add(out);

    const heel = new T.Shape();                                       // heel counter
    heel.moveTo(0.02, 0.36); heel.bezierCurveTo(-0.06, 0.6, -0.02, 0.8, 0.1, 0.9);
    heel.quadraticCurveTo(0.45, 0.78, 0.62, 0.36); heel.lineTo(0.02, 0.36);
    g.add(new T.Mesh(part(heel, 0.98, side, true), ORANGE));

    const toe = new T.Shape();                                        // toe guard
    toe.moveTo(2.35, 0.36); toe.quadraticCurveTo(2.7, 0.56, 2.9, 0.5);
    toe.quadraticCurveTo(3.02, 0.44, 3.0, 0.36); toe.lineTo(2.35, 0.36);
    g.add(new T.Mesh(part(toe, 0.98, side, true), OFF));

    [1.18, 1.46].forEach((x) => {                                     // side flashes
      const f = new T.Shape();
      f.moveTo(x, 0.38); f.lineTo(x + 0.14, 0.38); f.lineTo(x + 0.5, 0.8); f.lineTo(x + 0.36, 0.84); f.lineTo(x, 0.38);
      g.add(new T.Mesh(part(f, 0.97, side, true), ORANGE));
    });

    const collar = new T.Mesh(new T.SphereGeometry(1, 24, 16), DARK); // opening
    collar.scale.set(0.42, 0.11, 0.24); collar.position.set(0.6, 1.03, side * 0.07); g.add(collar);
    for (let i = 0; i < 5; i++) {                                     // laces
      const k = i / 4, lace = new T.Mesh(new T.BoxGeometry(0.07, 0.035, 0.46 - k * 0.08), OFF);
      lace.position.set(1.22 + k * 0.82, 1.04 - k * 0.3, side * 0.11); lace.rotation.z = -0.36; g.add(lace);
    }
    g.children.forEach((m) => m.position.x -= 1.5);
    g.children.forEach((m) => m.position.y -= 0.55);
    return g;
  }

  const racket = buildRacket(), left = buildShoe(-1), right = buildShoe(1);
  racket.rotation.z = 0.18;
  scene.add(racket, left, right);

  function layout() {
    const w = host.clientWidth, h = host.clientHeight, a = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = a; camera.updateProjectionMatrix();
    if (a < 1.15) {                       // phones: racket on top, shoes underneath
      racket.position.set(0, 1.5, 0); racket.scale.setScalar(0.62);
      const x = Math.min(1.5, 3.3 * a * 0.48);
      left.position.set(-x, -1.25, 0); right.position.set(x, -1.25, 0);
      left.scale.setScalar(0.55 * Math.min(1, a / 0.6)); right.scale.copy(left.scale);
    } else {
      racket.position.set(0, 0.1, 0); racket.scale.setScalar(1.12);
      const x = Math.min(4.6, 3.74 * a * 0.62);
      left.position.set(-x, -0.2, 0); right.position.set(x, -0.2, 0);
      left.scale.setScalar(0.92); right.scale.setScalar(0.92);
    }
  }
  layout();
  window.addEventListener('resize', layout);

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = false, raf = 0, t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000;
    const r = host.getBoundingClientRect();
    const scroll = 1 - (r.top + r.height) / (window.innerHeight + r.height);   // 0..1 as the section passes
    const spin = still ? 0.6 : t * 0.7 + scroll * Math.PI * 2;
    racket.rotation.y = spin;
    racket.position.y += still ? 0 : Math.sin(t * 1.3) * 0.0015;
    left.rotation.set(0.28, -spin * 0.8 + 0.6, 0.06);
    right.rotation.set(0.28, spin * 0.8 + 2.5, -0.06);
    renderer.render(scene, camera);
    if (visible && !still) raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver((e) => {
    visible = e[0].isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) raf = requestAnimationFrame(frame);
  }, { rootMargin: '100px' }).observe(host);
  requestAnimationFrame(frame);
})();

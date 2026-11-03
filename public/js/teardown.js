// teardown.js: the Epicure case's dissection. B's robot, re-skinned white and ink, standing on the
// paper beside the booklet. Scroll pulls its five layers apart one at a time (screen, payments,
// fleet, link, machine). Renders on demand; labels are HTML and carry the same words as the page.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRobot, LAYER_IDS } from './robot.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t, s = 1.04) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2));
const NAMES = { screen: 'Screen', payments: 'Payments', fleet: 'Fleet', link: 'Link', machine: 'Machine' };
// label anchor on each layer (local space), from B's case stage
const ANCHOR = { screen: [0.0, 1.66, 0.36], payments: [0.3, 0.84, 0.36], fleet: [0.21, 1.52, 0.24], link: [0.2, 1.22, 0.16], machine: [0.3, 1.95, 0.2] };

export async function createTeardown({ canvas, tagsEl, mobile = false, onFirstFrame }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const maxDpr = mobile ? 1.5 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  const key = new THREE.SpotLight(0xfff6ea, 55, 0, 1.0, 1.0, 2);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
  key.position.set(-3.0, 5.6, 4.6);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xe8eeff, 1.4); rim.position.set(3.5, 3.2, -4.2);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d3c8, 0.6));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.18, color: 0x1e1c1a }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);

  const robot = createRobot({ quality: mobile ? 'low' : 'high' });
  robot.setPower({ screen: 1, payments: 1, fleet: 1, link: 1, machine: 1 });
  robot.setScreen('menu'); robot.setDoor(0); robot.tick(1.3);
  robot.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(robot.group);
  key.target.position.set(0, 0.9, 0.4);

  // tags
  const tagEls = {};
  LAYER_IDS.forEach((id, i) => {
    const el = document.createElement('div');
    el.className = 'td-tag';
    el.innerHTML = `<span class="bn">${i + 1}</span><span class="bt">${NAMES[id]}</span>`;
    tagsEl.appendChild(el);
    tagEls[id] = el;
  });

  // framing: assembled (front three-quarter) -> exploded (wider, from the right)
  const P0 = new THREE.Vector3(2.6, 1.5, 3.4), P1 = new THREE.Vector3(5.1, 2.4, 4.7);
  const T0 = new THREE.Vector3(0, 0.98, 0.15), T1 = new THREE.Vector3(-0.05, 0.98, 1.05), T = new THREE.Vector3();
  let W = 1, H = 1, p = 0, active = -1, dirty = true, visible = true, raf = 0, first = true;

  function layerT(i, pp) { return clamp(pp * LAYER_IDS.length - i); }
  function applyExplode(pp) {
    LAYER_IDS.forEach((id, i) => {
      const part = robot.parts[id];
      const e = backOut(ease(layerT(i, pp)));
      part.t = layerT(i, pp);
      part.group.position.copy(part.rest).addScaledVector(part.axis, part.distance * e);
    });
  }
  function resize() {
    W = canvas.clientWidth || 1; H = canvas.clientHeight || 1;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    dirty = true;
  }
  const v = new THREE.Vector3();
  function render() {
    applyExplode(p);
    const k = ease(clamp(p * 2.6));
    camera.position.lerpVectors(P0, P1, k);
    camera.fov = 30 * (W / H < 0.9 ? 1.3 : 1);
    T.lerpVectors(T0, T1, k);
    camera.lookAt(T);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    LAYER_IDS.forEach((id, i) => {
      const el = tagEls[id];
      const part = robot.parts[id];
      v.set(...ANCHOR[id]);
      part.group.localToWorld(v).project(camera);
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const shown = id === 'machine' ? p > 0.82 : part.t > 0.55;
      el.classList.toggle('on', shown);
      el.classList.toggle('is-active', i === active);
      el.classList.toggle('flip', x > W - 150);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    });
    if (first) { first = false; onFirstFrame && onFirstFrame(); }
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!dirty || !visible || canvas.offsetParent === null) return;
    dirty = false;
    render();
  }
  resize();
  loop();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) dirty = true; });
  io.observe(canvas);

  return {
    setProgress(val, act = -1) { val = clamp(val); if (Math.abs(val - p) > 0.0005 || act !== active) { p = val; active = act; dirty = true; } },
    setVisible(vis) { visible = vis; if (vis) dirty = true; },
    capture(type = 'image/webp', q = 0.86) { render(); return canvas.toDataURL(type, q); },
    smoke() {
      const keep = p;
      applyExplode(0); const a = LAYER_IDS.map((id) => robot.parts[id].group.position.toArray().map((n) => +n.toFixed(3)));
      applyExplode(1); const b = LAYER_IDS.map((id) => robot.parts[id].group.position.toArray().map((n) => +n.toFixed(3)));
      applyExplode(keep); dirty = true;
      return { layers: LAYER_IDS, assembled: a, exploded: b };
    },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); tagsEl.innerHTML = ''; },
  };
}

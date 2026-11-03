// robot.js: B's robot teardown (round 1, Concept B), re-skinned to R3's white and ink for the Epicure case.
// No readable words are baked into its textures: screen and boards carry abstract marks only.
// An ORIGINAL, generic drink-making robot built procedurally (no downloaded models).
// It is not Epicure's kiosk. Five named layers sit on one explode axis (front → back):
//   screen · payments · fleet · link · machine
// API
//   const robot = createRobot({ quality })
//   robot.group                      THREE.Group (floor at y = 0, front faces +z)
//   robot.parts[id]                  { id, fig, name, group, axis, distance, anchor, rest }
//   robot.setExplode(p)              0 = assembled, 1 = exploded (≈4% overshoot settle per layer)
//   robot.getAnchors(camera, w, h)   [{ id, x, y, visible }] — DOM label anchor points
//   robot.setAssemble(a)             dispense-bay parts fly in (0 = away, 1 = locked)
//   robot.setPower({ screen, ... })  0–1 per layer: emissive LEDs / screen glow
//   robot.setScreen('off'|'menu'|'night'), robot.setDoor(0–1), robot.tick(t)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const LAYER_IDS = ['screen', 'payments', 'fleet', 'link', 'machine'];
const FIG = {
  screen: ['Fig. 01', 'Screen'], payments: ['Fig. 02', 'Payments'], fleet: ['Fig. 03', 'Fleet'],
  link: ['Fig. 04', 'Link'], machine: ['Fig. 05', 'Machine'],
};

export const PALETTE = {
  graphite: 0x1c1b19, bone: 0xe9e4da, grey: 0x8a857c, orange: 0xff4a1f, ice: 0xcfe3e8,
};

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
// back-out with s≈1.04 peaks ~4% past the target, then settles
export const backOut = (t, s = 1.04) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2));
const smooth = (t) => t * t * (3 - 2 * t);

// ---------------------------------------------------------------- materials
let _mats = null;
export function materials() {
  if (_mats) return _mats;
  const M = (o) => new THREE.MeshPhysicalMaterial(o);
  _mats = {
    bone: M({ color: 0xf1eee8, roughness: 0.42, metalness: 0.0, clearcoat: 0.45, clearcoatRoughness: 0.28 }),
    boneMatte: M({ color: 0xe6e2da, roughness: 0.7, metalness: 0.0 }),
    graphite: M({ color: 0x2b2926, roughness: 0.5, metalness: 0.1, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    graphiteMatte: new THREE.MeshStandardMaterial({ color: 0x302e2b, roughness: 0.85, metalness: 0.0 }),
    anodized: new THREE.MeshStandardMaterial({ color: 0xcfccc6, roughness: 0.42, metalness: 0.55 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xdedbd5, roughness: 0.3, metalness: 0.9 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9b083, roughness: 0.32, metalness: 1.0 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.92, metalness: 0.0 }),
    glassBlack: M({ color: 0x0c0c0c, roughness: 0.06, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
    glassClear: M({ color: 0x2a2824, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.55, depthWrite: false, clearcoat: 1 }),
    plastic: M({ color: 0xf4f2ee, roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.78, metalness: 0.0, side: THREE.DoubleSide }),
    chip: new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.35, metalness: 0.2 }),
    tube: new THREE.MeshStandardMaterial({ color: 0xe6e1d7, roughness: 0.35, metalness: 0.0, transparent: true, opacity: 0.7 }),
    liquid: [0xf6c48c, 0xe9d8b4, 0xf3eee2].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25 })),
    ledOrange: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf59e4a).multiplyScalar(0.25), toneMapped: false }),
    ledIce: new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8fa5ff).multiplyScalar(0.25), toneMapped: false }),
    stripWarm: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe6c8).multiplyScalar(0.2), toneMapped: false }),
  };
  return _mats;
}

// ---------------------------------------------------------------- helpers
const rbox = (w, h, d, r = 0.012, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, Math.min(w, h, d) / 2 - 1e-4));
function add(parent, geo, mat, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  if (o.name) m.name = o.name;
  parent.add(m);
  return m;
}
function rrect(path, x, y, w, h, r) {
  // rounded rect (x, y = bottom-left) into a Shape/Path, counter-clockwise
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  return path;
}
function frameGeo(w, h, rail, depth, r = 0.02) {
  const s = rrect(new THREE.Shape(), -w / 2, -h / 2, w, h, r);
  s.holes.push(rrect(new THREE.Path(), -w / 2 + rail, -h / 2 + rail, w - rail * 2, h - rail * 2, r * 0.6));
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 6 });
}
function instanced(parent, geo, mat, list, o = {}) {
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const d = new THREE.Object3D();
  list.forEach((p, i) => {
    d.position.set(p[0], p[1], p[2]);
    d.rotation.set(p[3] || 0, p[4] || 0, p[5] || 0);
    d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
  });
  im.castShadow = o.cast ?? false;
  im.receiveShadow = true;
  parent.add(im);
  return im;
}
function tube(parent, pts, r, mat, seg = 48) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return add(parent, new THREE.TubeGeometry(curve, seg, r, 8, false), mat, 0, 0, 0, { cast: false });
}

// ---------------------------------------------------------------- canvas textures
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.redraw = (fn) => { fn(g, w, h); t.needsUpdate = true; };
  return t;
}

function drawScreen(g, w, h, mode) {
  g.clearRect(0, 0, w, h);
  if (mode === 'off') { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); return; }
  // An abstract ordering screen: a header bar, three drink tiles, a pay button. No words (Illustrative).
  g.fillStyle = '#F7F5F0'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1E1C1A'; g.beginPath(); g.roundRect(40, 60, 230, 26, 13); g.fill();
  g.fillStyle = 'rgba(30,28,26,0.25)'; g.beginPath(); g.roundRect(40, 104, 150, 16, 8); g.fill();
  const tones = ['#F59E4A', '#E9D8B4', '#D9D4CA'];
  for (let i = 0; i < 3; i++) {
    const y = 160 + i * 150;
    g.fillStyle = i === 0 ? 'rgba(245,158,74,0.14)' : 'rgba(30,28,26,0.04)';
    g.beginPath(); g.roundRect(30, y, w - 60, 128, 22); g.fill();
    if (i === 0) { g.strokeStyle = '#F59E4A'; g.lineWidth = 3; g.stroke(); }
    g.fillStyle = tones[i]; g.beginPath(); g.arc(98, y + 64, 38, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(30,28,26,0.8)'; g.beginPath(); g.roundRect(160, y + 40, 200, 20, 10); g.fill();
    g.fillStyle = 'rgba(30,28,26,0.3)'; g.beginPath(); g.roundRect(160, y + 74, 110, 14, 7); g.fill();
  }
  g.fillStyle = '#1E1C1A'; g.beginPath(); g.roundRect(30, h - 130, w - 60, 88, 44); g.fill();
  g.fillStyle = '#F59E4A'; g.beginPath(); g.arc(w - 90, h - 86, 18, 0, Math.PI * 2); g.fill();
}

function drawPcb(g, w, h) {
  // a white board with ink traces and pads; no silkscreen words
  g.fillStyle = '#EEEBE5'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#B9B4AB'; g.lineWidth = 3;
  let seed = 11;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 26; i++) {
    const y = 20 + rnd() * (h - 40);
    const x0 = rnd() * w * 0.4;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + 40 + rnd() * 120, y);
    g.lineTo(x0 + 80 + rnd() * 160, y + (rnd() - 0.5) * 80); g.lineTo(w - rnd() * 60, y + (rnd() - 0.5) * 60); g.stroke();
  }
  g.fillStyle = '#8A847A';
  for (let i = 0; i < 70; i++) g.fillRect(rnd() * w, rnd() * h, 5, 5);
  g.strokeStyle = 'rgba(30,28,26,0.5)'; g.lineWidth = 2; g.strokeRect(8, 8, w - 16, h - 16);
}

function drawQr(g, w, h) {
  g.fillStyle = '#F7F5F0'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1E1C1A';
  const n = 21, s = Math.floor((w - 16) / n), o = 8;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (rnd() > 0.55) g.fillRect(o + x * s, o + y * s, s, s);
  const finder = (fx, fy) => {
    g.fillStyle = '#F7F5F0'; g.fillRect(o + fx * s - s, o + fy * s - s, s * 9, s * 9);
    g.fillStyle = '#1E1C1A'; g.fillRect(o + fx * s, o + fy * s, s * 7, s * 7);
    g.fillStyle = '#F7F5F0'; g.fillRect(o + (fx + 1) * s, o + (fy + 1) * s, s * 5, s * 5);
    g.fillStyle = '#1E1C1A'; g.fillRect(o + (fx + 2) * s, o + (fy + 2) * s, s * 3, s * 3);
  };
  finder(0, 0); finder(14, 0); finder(0, 14);
}

// ---------------------------------------------------------------- Assembly (generic explode)
export class Assembly {
  constructor(group) { this.group = group; this.parts = {}; this.order = []; this.p = 0; this._v = new THREE.Vector3(); }
  add(id, group, o = {}) {
    const part = {
      id, group,
      axis: new THREE.Vector3(...(o.axis || [0, 0, 1])).normalize(),
      distance: o.distance ?? 1,
      delay: o.delay ?? 0,
      span: o.span ?? 1,
      anchor: new THREE.Vector3(...(o.anchor || [0, 0, 0])),
      rest: group.position.clone(),
      fig: o.fig, name: o.name,
      rot: o.rot ? new THREE.Euler(...o.rot) : null,
      restRot: group.rotation.clone(),
      t: 0,
    };
    this.parts[id] = part;
    this.order.push(id);
    return part;
  }
  setExplode(p) {
    this.p = clamp(p);
    for (const id of this.order) {
      const part = this.parts[id];
      const t = clamp((this.p - part.delay) / part.span);
      const e = backOut(t);
      part.t = t;
      part.group.position.copy(part.rest).addScaledVector(part.axis, part.distance * e);
      if (part.rot) {
        part.group.rotation.set(
          part.restRot.x + part.rot.x * e, part.restRot.y + part.rot.y * e, part.restRot.z + part.rot.z * e,
        );
      }
    }
  }
  worldAnchor(id, out = new THREE.Vector3()) {
    const part = this.parts[id];
    part.group.updateWorldMatrix(true, false);
    return part.group.localToWorld(out.copy(part.anchor));
  }
  getAnchors(camera, w, h) {
    const out = [];
    for (const id of this.order) {
      const v = this.worldAnchor(id, this._v).project(camera);
      out.push({ id, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1, t: this.parts[id].t });
    }
    return out;
  }
}

// ---------------------------------------------------------------- the robot
export function createRobot({ quality = 'high' } = {}) {
  const hi = quality !== 'low';
  const m = materials();
  const root = new THREE.Group();
  root.name = 'drink-robot';
  const asm = new Assembly(root);
  const L = {};
  for (const id of LAYER_IDS) { L[id] = new THREE.Group(); L[id].name = `L-${id}`; root.add(L[id]); }

  // -------------------------- L5 machine (chassis, crown, plinth, internals, dispense bay)
  const M5 = L.machine;
  add(M5, rbox(0.86, 0.09, 0.66, 0.02), m.graphite, 0, 0.045, -0.01);
  const under = add(M5, rbox(0.72, 0.008, 0.01, 0.003), m.stripWarm, 0, 0.012, 0.325, { cast: false });
  add(M5, rbox(0.035, 1.71, 0.7, 0.012), m.bone, -0.4325, 0.945, 0);
  add(M5, rbox(0.035, 1.71, 0.7, 0.012), m.bone, 0.4325, 0.945, 0);
  add(M5, rbox(0.9, 1.71, 0.03, 0.01), m.bone, 0, 0.945, -0.335);
  add(M5, rbox(0.86, 0.03, 0.66, 0.01), m.graphiteMatte, 0, 0.105, 0);
  // side seams + vents (right side faces the camera most of the film)
  for (const sx of [-1, 1]) {
    add(M5, rbox(0.004, 1.5, 0.004, 0.001), m.rubber, sx * 0.4515, 0.95, 0.12, { cast: false });
    if (hi) {
      const vents = [];
      for (let i = 0; i < 9; i++) vents.push([sx * 0.4505, 1.42 + i * 0.026, -0.08]);
      instanced(M5, rbox(0.006, 0.01, 0.22, 0.004, 2), m.rubber, vents);
    }
  }
  // crown
  add(M5, rbox(0.92, 0.15, 0.72, 0.045, 4), m.bone, 0, 1.876, 0);
  add(M5, rbox(0.86, 0.082, 0.012, 0.02, 3), m.glassBlack, 0, 1.872, 0.357, { cast: false });
  const crownStrip = add(M5, rbox(0.7, 0.008, 0.006, 0.003), m.stripWarm, -0.04, 1.872, 0.364, { cast: false });
  const statusLed = add(M5, new THREE.SphereGeometry(0.008, 12, 8), m.ledOrange.clone(), 0.37, 1.872, 0.364, { cast: false });
  add(M5, rbox(0.9, 0.012, 0.7, 0.004), m.graphiteMatte, 0, 1.797, 0, { cast: false });
  // vertical light slit on the front-right edge (product accent)
  const slit = add(M5, rbox(0.006, 1.42, 0.006, 0.002), m.stripWarm.clone(), 0.447, 1.02, 0.338, { cast: false });
  // internal frame posts and shelf
  for (const [x, z] of [[-0.39, -0.29], [0.39, -0.29], [-0.39, 0.3], [0.39, 0.3]]) add(M5, rbox(0.024, 1.64, 0.024, 0.004, 2), m.alu, x, 0.94, z, { cast: hi });
  add(M5, rbox(0.8, 0.012, 0.42, 0.004), m.alu, 0, 1.17, -0.1);
  // canisters (ingredients) on the shelf
  const canProfile = [[0, 0], [0.07, 0], [0.078, 0.01], [0.078, 0.33], [0.072, 0.345], [0.03, 0.35], [0, 0.35]].map((p) => new THREE.Vector2(p[0], p[1]));
  const canGeo = new THREE.LatheGeometry(canProfile, hi ? 40 : 20);
  [-0.24, 0, 0.24].forEach((x, i) => {
    add(M5, canGeo, m.plastic, x, 1.176, -0.13, { cast: false });
    const fill = [0.24, 0.17, 0.28][i];
    add(M5, new THREE.CylinderGeometry(0.068, 0.068, fill, hi ? 32 : 16), m.liquid[i], x, 1.18 + fill / 2, -0.13);
    add(M5, new THREE.CylinderGeometry(0.05, 0.05, 0.02, 24), m.alu, x, 1.535, -0.13);
    add(M5, new THREE.CylinderGeometry(0.018, 0.018, 0.08, 16), m.graphite, x, 1.13, -0.13); // pump
  });
  // cup stack
  add(M5, new THREE.CylinderGeometry(0.052, 0.052, 0.5, 24, 1, true), m.plastic, 0.24, 0.62, -0.12, { cast: false });
  const cupProfile = [[0.031, 0], [0.045, 0.12], [0.047, 0.122]].map((p) => new THREE.Vector2(p[0], p[1]));
  const cupGeo = new THREE.LatheGeometry(cupProfile, hi ? 32 : 16);
  for (let i = 0; i < (hi ? 9 : 5); i++) add(M5, cupGeo, m.paper, 0.24, 0.38 + i * 0.04, -0.12, { cast: false });
  // chiller unit
  add(M5, rbox(0.72, 0.2, 0.36, 0.012), m.graphite, 0, 0.225, -0.12);
  if (hi) {
    const fins = [];
    for (let i = 0; i < 22; i++) fins.push([-0.32 + i * 0.03, 0.225, 0.065]);
    instanced(M5, rbox(0.006, 0.17, 0.02, 0.002, 1), m.alu, fins);
  }
  // product lines from canisters to the nozzle
  [-0.24, 0, 0.24].forEach((x) => tube(M5, [[x, 1.09, -0.13], [x * 0.7, 1.0, -0.02], [-0.15 + x * 0.1, 0.93, 0.1], [-0.15 + x * 0.05, 0.875, 0.16]], 0.0055, m.tube));
  // dispense bay (open box, centre x -0.15, y 0.63, z 0..0.33)
  const bay = new THREE.Group(); bay.name = 'dispense-bay'; M5.add(bay);
  add(bay, rbox(0.36, 0.46, 0.012, 0.004), m.graphiteMatte, -0.15, 0.63, 0.006);
  add(bay, rbox(0.012, 0.46, 0.33, 0.004), m.graphiteMatte, -0.334, 0.63, 0.165);
  add(bay, rbox(0.012, 0.46, 0.33, 0.004), m.graphiteMatte, 0.034, 0.63, 0.165);
  add(bay, rbox(0.36, 0.012, 0.33, 0.004), m.graphiteMatte, -0.15, 0.856, 0.165);
  add(bay, rbox(0.36, 0.012, 0.33, 0.004), m.graphiteMatte, -0.15, 0.404, 0.165);
  const bayLight = add(bay, rbox(0.28, 0.006, 0.02, 0.002), m.stripWarm.clone(), -0.15, 0.848, 0.29, { cast: false });
  // bay sub-parts that fly in during the Assembly beat
  const nozzle = new THREE.Group(); nozzle.name = 'nozzle'; bay.add(nozzle);
  add(nozzle, new THREE.CylinderGeometry(0.046, 0.05, 0.05, 32), m.alu, 0, 0, 0);
  add(nozzle, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 24), m.graphite, 0, -0.033, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    add(nozzle, new THREE.CylinderGeometry(0.0045, 0.0035, 0.03, 10), m.alu, Math.cos(a) * 0.018, -0.055, Math.sin(a) * 0.018, { cast: false });
  }
  nozzle.position.set(-0.15, 0.82, 0.16);
  const tray = new THREE.Group(); tray.name = 'drip-tray'; bay.add(tray);
  add(tray, rbox(0.3, 0.014, 0.24, 0.004), m.alu, 0, 0, 0);
  const slots = [];
  for (let i = 0; i < 9; i++) slots.push([-0.12 + i * 0.03, 0.006, 0]);
  instanced(tray, rbox(0.012, 0.004, 0.2, 0.001, 1), m.rubber, slots);
  tray.position.set(-0.15, 0.418, 0.16);
  const cup = new THREE.Group(); cup.name = 'cup'; bay.add(cup);
  add(cup, cupGeo, m.paper, 0, 0, 0);
  add(cup, new THREE.CylinderGeometry(0.043, 0.043, 0.004, 32), m.liquid[0], 0, 0.1, 0, { cast: false });
  add(cup, new THREE.TorusGeometry(0.047, 0.0025, 6, 32), m.paper, 0, 0.122, 0, { rx: Math.PI / 2, cast: false });
  cup.position.set(-0.15, 0.427, 0.17);
  const bayParts = [
    { g: nozzle, from: new THREE.Vector3(0, 0.55, 0.15), rot: new THREE.Euler(0, 1.6, 0.3), at: 0.0 },
    { g: tray, from: new THREE.Vector3(0.0, -0.25, 0.9), rot: new THREE.Euler(0.5, 0, 0), at: 0.15 },
    { g: cup, from: new THREE.Vector3(0.35, 0.35, 1.1), rot: new THREE.Euler(0.9, 0.2, -0.6), at: 0.3 },
  ];
  bayParts.forEach((b) => { b.rest = b.g.position.clone(); b.restRot = b.g.rotation.clone(); });

  // -------------------------- L4 link (controller board, relays, harness)
  const M4 = L.link;
  add(M4, frameGeo(0.84, 1.62, 0.02, 0.008), m.anodized, 0, 0.93, 0.136, { cast: hi });
  const pcbTex = canvasTex(512, 320, (g, w, h) => drawPcb(g, w, h));
  const pcbMat = new THREE.MeshStandardMaterial({ map: pcbTex, roughness: 0.55, metalness: 0.1 });
  add(M4, rbox(0.46, 0.288, 0.006, 0.006, 2), m.anodized, 0, 1.1, 0.142, { cast: hi });
  add(M4, new THREE.PlaneGeometry(0.452, 0.282), pcbMat, 0, 1.1, 0.1456, { cast: false });
  add(M4, rbox(0.06, 0.06, 0.008, 0.003), m.chip, -0.14, 1.16, 0.149);
  add(M4, rbox(0.04, 0.03, 0.006, 0.002), m.chip, 0.02, 1.17, 0.149);
  add(M4, rbox(0.03, 0.03, 0.006, 0.002), m.chip, 0.1, 1.18, 0.149);
  const relays = [];
  for (let i = 0; i < 4; i++) relays.push(add(M4, rbox(0.044, 0.034, 0.03, 0.004), m.boneMatte, -0.165 + i * 0.105, 1.045, 0.161));
  const linkLeds = [];
  for (let i = 0; i < 4; i++) linkLeds.push(add(M4, rbox(0.01, 0.006, 0.006, 0.002), m.ledIce.clone(), -0.165 + i * 0.105, 1.09, 0.15, { cast: false }));
  const ackLed = add(M4, rbox(0.012, 0.008, 0.006, 0.002), m.ledOrange.clone(), 0.19, 1.2, 0.15, { cast: false });
  add(M4, rbox(0.16, 0.026, 0.024, 0.003), m.graphite, 0.12, 0.975, 0.155);
  [-0.06, -0.03, 0.0, 0.03].forEach((dx, i) => tube(M4, [[0.07 + dx * 0.6, 0.965, 0.158], [0.04 + dx, 0.9, 0.12], [-0.1 + dx, 0.88, 0.06], [-0.15 + dx * 0.4, 0.875, 0.02]], 0.004, i % 2 ? m.rubber : m.boneMatte, 32));

  // -------------------------- L3 fleet (compute tray, fan, modem, antennas)
  const M3 = L.fleet;
  add(M3, frameGeo(0.84, 1.62, 0.02, 0.008), m.anodized, 0, 0.93, 0.212, { cast: hi });
  add(M3, rbox(0.58, 0.36, 0.008, 0.008), m.alu, 0, 1.4, 0.22);
  const sbcTex = canvasTex(256, 180, (g, w, h) => drawPcb(g, w, h));
  add(M3, rbox(0.22, 0.15, 0.004, 0.003, 2), m.anodized, -0.15, 1.44, 0.226);
  add(M3, new THREE.PlaneGeometry(0.214, 0.144), new THREE.MeshStandardMaterial({ map: sbcTex, roughness: 0.55 }), -0.15, 1.44, 0.2282, { cast: false });
  add(M3, rbox(0.05, 0.05, 0.008, 0.002), m.chip, -0.15, 1.445, 0.232);
  if (hi) {
    const fins = [];
    for (let i = 0; i < 9; i++) fins.push([-0.19 + i * 0.01, 1.445, 0.25]);
    instanced(M3, rbox(0.003, 0.06, 0.03, 0.001, 1), m.alu, fins);
  }
  const fan = new THREE.Group(); fan.position.set(0.05, 1.46, 0.234); M3.add(fan);
  add(fan, new THREE.TorusGeometry(0.048, 0.006, 8, 40), m.graphite, 0, 0, 0);
  const blades = new THREE.Group(); fan.add(blades);
  for (let i = 0; i < 7; i++) {
    const b = add(blades, rbox(0.04, 0.012, 0.002, 0.001, 1), m.graphiteMatte, 0, 0, 0, { cast: false });
    b.geometry.translate(0.022, 0, 0);
    b.rotation.z = (i / 7) * Math.PI * 2; b.rotation.x = 0.3;
  }
  add(fan, new THREE.CylinderGeometry(0.014, 0.014, 0.01, 20), m.graphite, 0, 0, 0.003, { rx: Math.PI / 2 });
  add(M3, rbox(0.13, 0.07, 0.026, 0.006), m.graphite, 0.17, 1.285, 0.236);
  const fleetLeds = [];
  for (let i = 0; i < 3; i++) fleetLeds.push(add(M3, rbox(0.008, 0.008, 0.004, 0.002), m.ledIce.clone(), 0.13 + i * 0.022, 1.272, 0.25, { cast: false }));
  const antennas = [];
  [0.13, 0.21].forEach((x, i) => {
    antennas.push(add(M3, new THREE.CylinderGeometry(0.006, 0.008, 0.2, 12), m.rubber, x, 1.42, 0.24, { rz: i ? -0.12 : 0.12 }));
  });

  // -------------------------- L2 payments (terminal, bracket, cable)
  const M2 = L.payments;
  add(M2, frameGeo(0.84, 1.62, 0.02, 0.008), m.anodized, 0, 0.93, 0.288, { cast: hi });
  const term = new THREE.Group(); term.position.set(0.222, 0.73, 0.322); M2.add(term);
  add(term, rbox(0.22, 0.24, 0.07, 0.022, 4), m.graphite, 0, 0, 0);
  add(term, new THREE.CylinderGeometry(0.052, 0.052, 0.004, 40), m.glassBlack, 0, -0.035, 0.036, { rx: Math.PI / 2, cast: false });
  const arcs = [];
  for (let i = 0; i < 3; i++) arcs.push(add(term, new THREE.TorusGeometry(0.012 + i * 0.011, 0.0018, 6, 24, Math.PI * 0.6), m.ledIce.clone(), 0, -0.04, 0.0395, { rz: Math.PI * 0.2, cast: false }));
  const qrTex = canvasTex(160, 160, drawQr);
  const qrMat = new THREE.MeshBasicMaterial({ map: qrTex, toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) });
  add(term, new THREE.PlaneGeometry(0.06, 0.06), qrMat, -0.045, 0.07, 0.0362, { cast: false });
  add(term, rbox(0.1, 0.006, 0.02, 0.002), m.rubber, 0.03, -0.103, 0.03, { cast: false });
  const payLed = add(term, new THREE.SphereGeometry(0.0055, 10, 8), m.ledOrange.clone(), 0.08, 0.095, 0.036, { cast: false });
  add(M2, rbox(0.06, 0.3, 0.012, 0.004), m.alu, 0.375, 0.78, 0.292);
  add(M2, rbox(0.12, 0.02, 0.05, 0.004), m.alu, 0.33, 0.62, 0.3);
  tube(M2, [[0.2, 0.62, 0.29], [0.18, 0.5, 0.29], [0.3, 0.42, 0.292], [0.4, 0.38, 0.292]], 0.004, m.rubber, 24);

  // -------------------------- L1 screen (fascia, touchscreen, bay door, kick plate)
  const M1 = L.screen;
  const face = rrect(new THREE.Shape(), -0.45, 0.09, 0.9, 1.71, 0.03);
  face.holes.push(rrect(new THREE.Path(), -0.25, 0.96, 0.5, 0.7, 0.018));
  face.holes.push(rrect(new THREE.Path(), -0.33, 0.405, 0.36, 0.45, 0.022));
  face.holes.push(rrect(new THREE.Path(), 0.106, 0.605, 0.232, 0.25, 0.026));
  const faceGeo = new THREE.ExtrudeGeometry(face, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: hi ? 10 : 5 });
  add(M1, faceGeo, m.bone, 0, 0, 0.335);
  add(M1, rbox(0.52, 0.72, 0.014, 0.012), m.glassBlack, 0, 1.31, 0.343);
  const screenTex = canvasTex(600, 840, (g, w, h) => drawScreen(g, w, h, 'off'));
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.18, metalness: 0, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0 });
  screenMat.userData.isScreen = true;
  const screen = add(M1, new THREE.PlaneGeometry(0.49, 0.686), screenMat, 0, 1.31, 0.3505, { cast: false });
  const door = add(M1, rbox(0.37, 0.46, 0.008, 0.01), m.glassClear, -0.15, 0.63, 0.346, { cast: false });
  door.userData.rest = door.position.clone();
  add(M1, rbox(0.84, 0.2, 0.012, 0.006), m.graphite, 0, 0.2, 0.363);
  const holes = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) holes.push([0.135 + c * 0.022, 0.43 + r * 0.03, 0.3575, Math.PI / 2]);
  instanced(M1, new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 10), m.rubber, holes);
  const screws = [];
  for (const [x, y] of [[-0.42, 0.13], [0.42, 0.13], [-0.42, 1.76], [0.42, 1.76]]) screws.push([x, y, 0.3605, Math.PI / 2]);
  instanced(M1, new THREE.CylinderGeometry(0.007, 0.007, 0.003, 16), m.alu, screws);

  // -------------------------- explode axis (front → back); fig anchors at each layer's top-right corner
  asm.add('screen', M1, { axis: [0, 0, 1], distance: 2.05, delay: 0.0, span: 0.76, anchor: [0.45, 1.79, 0.36], fig: FIG.screen[0], name: FIG.screen[1] });
  asm.add('payments', M2, { axis: [0, 0, 1], distance: 1.55, delay: 0.06, span: 0.76, anchor: [0.42, 1.74, 0.296], fig: FIG.payments[0], name: FIG.payments[1] });
  asm.add('fleet', M3, { axis: [0, 0, 1], distance: 1.05, delay: 0.12, span: 0.76, anchor: [0.42, 1.74, 0.22], fig: FIG.fleet[0], name: FIG.fleet[1] });
  asm.add('link', M4, { axis: [0, 0, 1], distance: 0.55, delay: 0.18, span: 0.76, anchor: [0.42, 1.74, 0.144], fig: FIG.link[0], name: FIG.link[1] });
  asm.add('machine', M5, { axis: [0, 0, -1], distance: 0.25, delay: 0.24, span: 0.76, anchor: [0.46, 1.95, 0.36], fig: FIG.machine[0], name: FIG.machine[1] });

  // named points for camera framing / events
  const points = {
    bay: () => M5.localToWorld(new THREE.Vector3(-0.15, 0.62, 0.2)),
    screen: () => M1.localToWorld(new THREE.Vector3(0, 1.31, 0.36)),
    terminal: () => M2.localToWorld(new THREE.Vector3(0.22, 0.73, 0.36)),
    antenna: () => M3.localToWorld(new THREE.Vector3(0.17, 1.52, 0.24)),
    crown: () => M5.localToWorld(new THREE.Vector3(0, 1.96, 0)),
    door: () => M1.localToWorld(new THREE.Vector3(-0.15, 0.63, 0.36)),
  };

  // -------------------------- state
  const state = { assemble: 1, power: { screen: 0, payments: 0, fleet: 0, link: 0, machine: 0 }, screenMode: 'init', door: 0, night: 0 };
  const C = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

  function setAssemble(a) {
    state.assemble = clamp(a);
    for (const b of bayParts) {
      const t = clamp((state.assemble - b.at) / 0.64);
      const e = 1 - backOut(t);
      b.g.position.copy(b.rest).addScaledVector(b.from, e);
      b.g.rotation.set(b.restRot.x + b.rot.x * e, b.restRot.y + b.rot.y * e, b.restRot.z + b.rot.z * e);
      b.g.visible = t > 0.001;
    }
  }
  function setScreen(mode) {
    if (mode === state.screenMode) return;
    state.screenMode = mode;
    screenTex.userData.redraw((g, w, h) => drawScreen(g, w, h, mode));
  }
  function setDoor(v) {
    state.door = clamp(v);
    door.position.copy(door.userData.rest);
    door.position.y += 0.43 * smooth(state.door);
    door.position.z -= 0.012 * Math.min(1, state.door * 6);
  }
  function setPower(p) { Object.assign(state.power, p); }

  function tick(time) {
    const P = state.power;
    screenMat.emissiveIntensity = 0.92 * P.screen;
    qrMat.color.setScalar(0.9);
    arcs.forEach((a, i) => a.material.color.copy(C(0xcfe3e8, 0.12 + P.payments * (1.2 + 0.9 * Math.max(0, Math.sin(time * 3 - i * 0.9))))));
    payLed.material.color.copy(C(0xff4a1f, 0.2 + P.payments * 2.5));
    fleetLeds.forEach((l, i) => l.material.color.copy(C(0xcfe3e8, 0.15 + P.fleet * (Math.sin(time * 9 + i * 2.1) > 0.2 ? 3 : 0.5))));
    blades.rotation.z = time * 14 * P.fleet;
    const seq = Math.floor(time * 2.2) % 6;
    linkLeds.forEach((l, i) => l.material.color.copy(C(0xcfe3e8, 0.15 + P.link * (seq === i ? 3.2 : 0.35))));
    ackLed.material.color.copy(C(0xff4a1f, 0.15 + P.link * (seq >= 4 ? 3.2 : 0.4)));
    const mach = P.machine;
    bayLight.material.color.copy(C(0xffe6c8, 0.1 + mach * 2.4));
    crownStrip.material.color.copy(C(0xffe6c8, 0.15 + mach * 1.6));
    slit.material.color.copy(C(0xffe6c8, 0.25 + mach * 1.3));
    under.material.color.copy(C(0xffe6c8, 0.1 + mach * 1.2));
    statusLed.material.color.copy(C(0xff4a1f, 0.4 + mach * (2.2 + 1.6 * Math.sin(time * 2.4))));
  }

  setAssemble(1);
  setDoor(0);
  asm.setExplode(0);

  return {
    group: root,
    parts: asm.parts,
    layers: LAYER_IDS,
    points,
    lights: { bayLight, crownStrip, statusLed },
    setExplode: (p) => asm.setExplode(p),
    get explode() { return asm.p; },
    getAnchors: (cam, w, h) => asm.getAnchors(cam, w, h),
    worldAnchor: (id, v) => asm.worldAnchor(id, v),
    setAssemble, setScreen, setDoor, setPower, tick,
    state,
  };
}

// ---------------------------------------------------------------- fleet variants (three product lines, simplified)
export function createVariant(kind = 'tall') {
  const m = materials();
  const g = new THREE.Group();
  const scr = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xcfe3e8).multiplyScalar(0.05), toneMapped: false });
  const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe6c8).multiplyScalar(0.05), toneMapped: false });
  if (kind === 'tall') {
    add(g, rbox(0.9, 1.8, 0.7, 0.03), m.bone, 0, 0.9, 0);
    add(g, rbox(0.92, 0.15, 0.72, 0.045), m.graphite, 0, 1.87, 0);
    add(g, new THREE.PlaneGeometry(0.48, 0.66), scr, 0, 1.3, 0.352, { cast: false });
    add(g, new THREE.PlaneGeometry(0.34, 0.42), strip, -0.15, 0.63, 0.352, { cast: false });
  } else if (kind === 'counter') {
    add(g, rbox(1.5, 1.05, 0.7, 0.04), m.bone, 0, 0.525, 0);
    add(g, rbox(1.52, 0.1, 0.72, 0.04), m.graphite, 0, 1.08, 0);
    add(g, new THREE.PlaneGeometry(0.42, 0.3), scr, -0.42, 0.78, 0.352, { cast: false });
    add(g, new THREE.PlaneGeometry(0.42, 0.3), scr, 0.42, 0.78, 0.352, { cast: false });
    add(g, new THREE.PlaneGeometry(1.2, 0.02), strip, 0, 1.0, 0.352, { cast: false });
  } else {
    add(g, new THREE.CylinderGeometry(0.36, 0.38, 1.9, 40), m.bone, 0, 0.95, 0);
    add(g, new THREE.CylinderGeometry(0.39, 0.39, 0.12, 40), m.graphite, 0, 1.95, 0);
    add(g, new THREE.PlaneGeometry(0.34, 0.5), scr, 0, 1.3, 0.372, { cast: false });
    add(g, new THREE.PlaneGeometry(0.4, 0.02), strip, 0, 1.92, 0.395, { cast: false });
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  return {
    group: g,
    setLit(v, t = 0) {
      scr.color.copy(new THREE.Color(0xcfe3e8).multiplyScalar(0.04 + v * (1.4 + 0.15 * Math.sin(t * 1.3 + g.position.x))));
      strip.color.copy(new THREE.Color(0xffe6c8).multiplyScalar(0.04 + v * 1.5));
    },
  };
}

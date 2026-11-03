// thread.js: the line of light across the bench (C's line, laid on D's bench).
// One tube geometry per strand, built in code from timeline.THREAD; its head advances with scroll.
// It renders in the colour pass only and writes a mask into the alpha channel, so the ink-edge
// composite never draws outlines across the light.
import * as THREE from 'three';
import { THREAD, SPUR, STATIONS, SPUR_COLOR } from './timeline.js';

const LINE_VS = /* glsl */`
attribute vec3 aDir; attribute float aU; attribute float aRad; attribute vec3 aColor;
uniform float uHead; uniform float uTime; uniform float uCap; uniform float uRadMul; uniform float uWobble; uniform float uGhostMul; uniform float uSpark;
varying vec3 vN; varying vec3 vColor; varying float vTip; varying float vU;
void main(){
  float tip = uHead - aU;
  float c = clamp(tip / uCap, 0.0, 1.0);
  float r = aRad * sqrt(1.0 - (1.0 - c) * (1.0 - c));
  if (tip < 0.0) {
    float d = aU - uSpark;
    float sp = uSpark < 0.0 ? 0.0 : exp(-d * d / 0.00004) + (d < 0.0 ? 0.5 * exp(d / 0.02) : 0.0);
    r = aRad * uGhostMul * (1.0 + 0.9 * sp);
  }
  float nearHead = exp(-max(tip, 0.0) / (uCap * 1.8));
  r *= 1.0 + 0.22 * nearHead * uWobble * sin(uTime * 6.0 + aU * 900.0);
  r *= uRadMul;
  vec3 p = position + aDir * r;
  vN = normalize(normalMatrix * aDir);
  vColor = aColor; vTip = tip; vU = aU;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const LINE_FS = /* glsl */`
uniform float uTime; uniform float uGhost; uniform vec3 uPaper; uniform float uFlow; uniform float uSpark;
varying vec3 vN; varying vec3 vColor; varying float vTip; varying float vU;
void main(){
  vec3 N = normalize(vN);
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.35, 0.75, 0.6));
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  if (vTip < 0.0) {
    // ghost: the unlit fibre, a pale tint of what it will become
    vec3 g = mix(uPaper, vColor, 0.85);
    g = mix(g, uPaper, (1.0 - ndv) * 0.2);
    if (uGhost < 0.01) discard;
    float d = vU - uSpark;
    float sp = uSpark < 0.0 ? 0.0 : exp(-d * d / 0.00004) + (d < 0.0 ? 0.55 * exp(d / 0.02) : 0.0);
    // the planned path, drawn dashed until the light reaches it; a spark runs along it in the opening view
    if (sp < 0.25 && fract(vU * 240.0) > 0.66) discard;
    g = mix(g, min(vColor * 1.15 + 0.2, vec3(1.0)), clamp(sp, 0.0, 1.0));
    g += pow(max(dot(N, normalize(L + V)), 0.0), 40.0) * 0.5 * sp;
    gl_FragColor = vec4(g, uGhost);
    return;
  }
  vec3 base = vColor;
  vec3 deep = base * base * 0.85;
  vec3 c = mix(deep, base, 0.4 + 0.6 * ndv);
  float flow = smoothstep(0.72, 1.0, sin(vU * 260.0 - uTime * 2.4) * 0.5 + 0.5) * uFlow;
  c = mix(c, min(base * 1.25 + 0.12, vec3(1.0)), flow * 0.55 * ndv);
  vec3 H = normalize(L + V);
  c += pow(max(dot(N, H), 0.0), 60.0) * 0.9;
  float fr = pow(1.0 - ndv, 2.5);
  c = mix(c, min(base + 0.4, vec3(1.0)), fr * 0.5);
  float headGlow = exp(-vTip * 160.0);
  c = mix(c, vec3(1.0), headGlow * 0.55);
  gl_FragColor = vec4(c, 1.0);
}`;

const HALO_FS = /* glsl */`
uniform float uOpacity;
varying vec3 vN; varying vec3 vColor; varying float vTip; varying float vU;
void main(){
  if (vTip < 0.0) discard;
  float ndv = clamp(dot(normalize(vN), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
  float a = pow(ndv, 1.8) * 0.32 * uOpacity;
  gl_FragColor = vec4(vColor, a);
}`;

const GLOW_VS = /* glsl */`
attribute float aU; attribute float aSide; attribute vec3 aColor;
varying float vU; varying float vSide; varying vec3 vColor;
void main(){ vU = aU; vSide = aSide; vColor = aColor; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GLOW_FS = /* glsl */`
uniform float uHead; uniform float uOpacity; uniform float uTime; uniform float uFlow;
varying float vU; varying float vSide; varying vec3 vColor;
void main(){
  float tip = uHead - vU;
  if (tip < 0.0) discard;
  float fall = exp(-vSide * vSide * 3.2);
  float nearHead = 1.0 + 1.4 * exp(-tip * 60.0);
  float pulse = 1.0 + 0.25 * uFlow * sin(vU * 120.0 - uTime * 2.4);
  float a = fall * 0.2 * uOpacity * nearHead * pulse;
  gl_FragColor = vec4(vColor, min(a, 0.55));
}`;

const BEAD_VS = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAD_FS = /* glsl */`
uniform vec3 uColor; uniform float uOpacity; uniform float uTime; uniform float uFlow;
varying vec2 vUv;
void main(){
  float d = length(vUv);
  if (d > 1.0) discard;
  float core = 1.0 - smoothstep(0.12, 0.2, d);
  float glow = exp(-d * d * 5.0) * (0.85 + 0.15 * uFlow * sin(uTime * 3.0));
  vec3 c = mix(uColor, vec3(1.0), core);
  float a = max(core, glow * 0.75) * uOpacity;
  gl_FragColor = vec4(c, a);
}`;

// parallel transport frames along a polyline
function frames(pts) {
  const n = pts.length, T = [], N = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    T.push(new THREE.Vector3().subVectors(b, a).normalize());
  }
  let nrm = new THREE.Vector3(0, 1, 0);
  if (Math.abs(T[0].dot(nrm)) > 0.9) nrm.set(0, 0, 1);
  nrm.sub(T[0].clone().multiplyScalar(T[0].dot(nrm))).normalize();
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const axis = new THREE.Vector3().crossVectors(T[i - 1], T[i]);
      const len = axis.length();
      if (len > 1e-6) { axis.multiplyScalar(1 / len); nrm.applyAxisAngle(axis, Math.acos(Math.min(1, Math.max(-1, T[i - 1].dot(T[i]))))); }
      nrm.sub(T[i].clone().multiplyScalar(T[i].dot(nrm))).normalize();
    }
    N.push(nrm.clone());
    B.push(new THREE.Vector3().crossVectors(T[i], nrm).normalize());
  }
  return { T, N, B };
}

function tubeGeometry(pts, us, rad, colors, radial = 10) {
  const { N, B } = frames(pts);
  const pos = [], dir = [], uu = [], rr = [], cc = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const dx = Math.cos(a) * N[i].x + Math.sin(a) * B[i].x;
      const dy = Math.cos(a) * N[i].y + Math.sin(a) * B[i].y;
      const dz = Math.cos(a) * N[i].z + Math.sin(a) * B[i].z;
      pos.push(pts[i].x, pts[i].y, pts[i].z); dir.push(dx, dy, dz);
      uu.push(us[i]); rr.push(rad); cc.push(colors[i].r, colors[i].g, colors[i].b);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = a + radial, d = b + radial;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(uu, 1));
  g.setAttribute('aRad', new THREE.Float32BufferAttribute(rr, 1));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(cc, 3));
  g.setIndex(idx);
  return g;
}

// A soft ribbon lying on the surface under the thread: the light it throws on the bench.
function glowGeometry(pts, us, colors, width) {
  const pos = [], uu = [], side = [], cc = [], idx = [];
  const up = new THREE.Vector3(), t = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    t.subVectors(b, a).normalize();
    const onBoard = pts[i].z < -2.3 && pts[i].y > 0.12;
    up.set(0, onBoard ? 0 : 1, onBoard ? 1 : 0);
    s.crossVectors(t, up).normalize();
    for (const k of [-1, 1]) {
      const p = pts[i].clone().addScaledVector(s, k * width).addScaledVector(up, -0.036);
      pos.push(p.x, p.y, p.z); uu.push(us[i]); side.push(k * 1.6); cc.push(colors[i].r, colors[i].g, colors[i].b);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(uu, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(cc, 3));
  g.setIndex(idx);
  return g;
}

// Blending: colour is normal alpha blending; alpha channel accumulates a mask (src * 1 + dst * 1).
function maskBlend(m) {
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendEquationAlpha = THREE.AddEquation; m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneFactor;
  m.transparent = true;
  return m;
}

export function createThread({ paper, mobile = false }) {
  const group = new THREE.Group();
  group.name = 'thread';
  const curve = new THREE.CatmullRomCurve3(THREAD.map((p) => new THREE.Vector3(...p)), false, 'centripetal', 0.5);
  curve.arcLengthDivisions = 4000;
  const NS = 2400;
  const samples = Array.from({ length: NS + 1 }, (_, i) => curve.getPointAt(i / NS));
  const uOf = (x, z, y = null) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i <= NS; i++) {
      const s = samples[i];
      const d = (s.x - x) ** 2 + (s.z - z) ** 2 + (y === null ? 0 : (s.y - y) ** 2);
      if (d < bd) { bd = d; best = i; }
    }
    return best / NS;
  };
  const stationU = STATIONS.map((s) => (s.id === 'end' ? 1 : uOf(s.at[0], s.at[1], s.y ?? null)));

  // colour per u: the segment arriving at a station carries that station's colour
  const cols = STATIONS.map((s) => new THREE.Color(s.color));
  const colorAt = (u, out = new THREE.Color()) => {
    let k = 0;
    while (k < stationU.length - 1 && u > stationU[k]) k++;
    out.copy(cols[k]);
    if (k > 0) {
      const b = stationU[k - 1], w = 0.01;
      if (u < b + w) out.copy(cols[k - 1]).lerp(cols[k], (u - b) / w);
    }
    return out;
  };

  const NR = mobile ? 900 : 1500;
  const pts = [], us = [], cs = [];
  for (let i = 0; i <= NR; i++) { const u = i / NR; us.push(u); pts.push(curve.getPointAt(u)); cs.push(colorAt(u).clone()); }
  const RAD = 0.028;
  const tubeGeo = tubeGeometry(pts, us, RAD, cs, mobile ? 8 : 10);

  const spurCurve = new THREE.CatmullRomCurve3(SPUR.map((p) => new THREE.Vector3(...p)), false, 'centripetal', 0.5);
  const SR = 80;
  const spts = [], sus = [], scs = [];
  const sc = new THREE.Color(SPUR_COLOR);
  for (let i = 0; i <= SR; i++) { const u = i / SR; sus.push(u); spts.push(spurCurve.getPointAt(u)); scs.push(sc); }
  const spurGeo = tubeGeometry(spts, sus, RAD, scs, 8);

  const shared = { uTime: { value: 0 }, uFlow: { value: 1 }, uPaper: { value: new THREE.Color(paper) }, uWobble: { value: 1 }, uGhostMul: { value: 1 }, uSpark: { value: -1 } };
  const mkLine = (head, cap) => maskBlend(new THREE.ShaderMaterial({
    vertexShader: LINE_VS, fragmentShader: LINE_FS, depthWrite: true,
    uniforms: { ...shared, uHead: head, uCap: { value: cap }, uRadMul: { value: 1 }, uGhost: { value: 0.55 } },
  }));
  const mkHalo = (head, cap) => maskBlend(new THREE.ShaderMaterial({
    vertexShader: LINE_VS, fragmentShader: HALO_FS, depthWrite: false,
    uniforms: { ...shared, uHead: head, uCap: { value: cap }, uRadMul: { value: 3.4 }, uOpacity: { value: 1 } },
  }));
  const headMain = { value: 0.01 }, headSpur = { value: 0 };
  const lineMat = mkLine(headMain, 0.006);
  const spurMat = mkLine(headSpur, 0.08);
  const main = new THREE.Mesh(tubeGeo, lineMat); main.renderOrder = 10;
  const halo = new THREE.Mesh(tubeGeo, mkHalo(headMain, 0.006)); halo.renderOrder = 12;
  const spur = new THREE.Mesh(spurGeo, spurMat); spur.renderOrder = 10;
  const spurHalo = new THREE.Mesh(spurGeo, mkHalo(headSpur, 0.08)); spurHalo.renderOrder = 12;

  const glowMat = (head) => {
    const m = maskBlend(new THREE.ShaderMaterial({
      vertexShader: GLOW_VS, fragmentShader: GLOW_FS, depthWrite: false,
      uniforms: { ...shared, uHead: head, uOpacity: { value: 1 } },
    }));
    m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
    return m;
  };
  const glow = new THREE.Mesh(glowGeometry(pts, us, cs, 0.26), glowMat(headMain)); glow.renderOrder = 5;
  const spurGlow = new THREE.Mesh(glowGeometry(spts, sus, scs, 0.26), glowMat(headSpur)); spurGlow.renderOrder = 5;

  const beadMat = maskBlend(new THREE.ShaderMaterial({
    vertexShader: BEAD_VS, fragmentShader: BEAD_FS, depthWrite: false, depthTest: true,
    uniforms: { ...shared, uColor: { value: new THREE.Color('#8E949A') }, uOpacity: { value: 1 } },
  }));
  const bead = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), beadMat); bead.renderOrder = 14;

  for (const m of [main, halo, spur, spurHalo, glow, spurGlow, bead]) {
    m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.userData.thread = true;
    group.add(m);
  }

  const tmp = new THREE.Vector3(), tmpC = new THREE.Color();
  return {
    group, curve, stationU, colorAt,
    meshes: [main, halo, spur, spurHalo, glow, spurGlow, bead],
    pointAt: (u, out = new THREE.Vector3()) => out.copy(curve.getPointAt(Math.min(1, Math.max(0, u)))),
    update({ head, spurP, time, camera, halfH, ghost = 0.55, flow = 1, spark = -1 }) {
      headMain.value = head;
      headSpur.value = spurP;
      shared.uTime.value = time;
      shared.uFlow.value = flow;
      shared.uWobble.value = flow;
      shared.uSpark.value = spark;
      // the unlit line keeps a readable width at any zoom (thicker in the overview)
      shared.uGhostMul.value = Math.min(2.1, Math.max(0.95, halfH * 0.23));
      lineMat.uniforms.uGhost.value = ghost;
      spurMat.uniforms.uGhost.value = 0;
      // the bead rides the head of whichever strand is moving
      const onSpur = spurP > 0.001 && spurP < 0.999;
      if (onSpur) { tmp.copy(spurCurve.getPointAt(spurP)); tmpC.set(SPUR_COLOR); }
      else { tmp.copy(curve.getPointAt(Math.min(1, Math.max(0, head)))); colorAt(head, tmpC); }
      bead.position.copy(tmp);
      bead.quaternion.copy(camera.quaternion);
      bead.position.addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion), 0.3);
      const s = halfH * 0.085;
      bead.scale.set(s, s, s);
      beadMat.uniforms.uColor.value.copy(tmpC);
      // once the light has gone into the case, nothing is left glowing at the junction
      beadMat.uniforms.uOpacity.value = spurP >= 0.999 && Math.abs(head - stationU[7]) < 0.004 ? 0 : 1;
    },
    setVisible(v) { group.visible = v; },
  };
}

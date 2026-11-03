// scene.js: the live ink bench with its thread of light. Loaded only when Quick view is off, WebGL
// works and motion is OK.
//
// Look: engraved ink on white paper. Three passes per frame, rendered only when something changed
// (plus a slow idle shimmer along the lit thread):
//   1. colour pass: Lambert lighting turned into paper, wash and screen-anchored hatching; true
//      colour only inside the lamp's pool. The thread draws here and writes a mask into alpha.
//   2. normal/id pass: view normal + per-mesh id + an "ink code" per part (ink / faded / accent).
//   3. composite: edges from normals, ids and depth, wobbled slightly so they read as drawn, and
//      held off wherever the thread's light is.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createDissection, TONES } from './dissect.js';
import { PLACE, LIFT_H, PROPS, poseAt, BEATS, LETTER, NOTE, setStationU } from './timeline.js';
import { createThread } from './thread.js';
import { createRobot, LAYER_IDS } from './robot.js';

THREE.ColorManagement.enabled = false;

const PAPER = '#F6F4EF', INK = '#1E1C1A';
const AZ = 38 * Math.PI / 180, EL = 29 * Math.PI / 180;
const VIEW_DIR = new THREE.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL));
const KEY_DIR = new THREE.Vector3(-0.35, 0.85, 0.5).normalize();

// Labels drawn over the stage (aria-hidden: the same words are in the HTML cards).
const LABELS = {
  'tag:kiosk': { prop: 'kiosk', at: [0, 2.75, 0], text: 'F/01 · Epicure Robotics', href: '#case-epicure', dx: -60, dy: -60 },
  'tag:phone': { prop: 'phone', at: [0, 0.08, 0.3], text: 'F/02 · CareLine', href: '#case-careline', dx: 10, dy: 86 },
  'tag:rig': { prop: 'rig', at: [0.2, 0.6, 0.2], text: 'F/05 · MCPArena', href: '#case-mcparena', dx: -90, dy: 96 },
  'part:books:notebook': { asm: 'books', part: 'notebook', text: 'BITS Pilani × Scaler', dx: -110, dy: -56 },
  'part:books:textbook': { asm: 'books', part: 'textbook', text: '2023 – 2027 · B.Sc. (Hons.) CS', dx: -40, dy: 74 },
  'part:kiosk:screen': { asm: 'kiosk', part: 'screen', n: 1, text: 'Screen' },
  'part:kiosk:payments': { asm: 'kiosk', part: 'payments', n: 2, text: 'Payments' },
  'part:kiosk:fleet': { asm: 'kiosk', part: 'fleet', n: 3, text: 'Fleet' },
  'part:kiosk:link': { asm: 'kiosk', part: 'link', n: 4, text: 'Link' },
  'part:kiosk:machine': { asm: 'kiosk', part: 'machine', n: 5, text: 'Machine' },
  'part:phone:record': { asm: 'phone', part: 'record', n: 1, text: 'The record' },
  'part:phone:question': { asm: 'phone', part: 'question', n: 2, text: 'The question' },
  'part:phone:answer': { asm: 'phone', part: 'answer', n: 3, text: 'Answer' },
  'part:phone:ask': { asm: 'phone', part: 'ask', text: 'Ask' },
  'part:phone:handoff': { asm: 'phone', part: 'handoff', text: 'Hand off' },
  'part:drawers:d8': { asm: 'drawers', part: 'd8', text: 'F/08 · AudioBookAI', dx: -120, dy: -40 },
  'part:drawers:d9': { asm: 'drawers', part: 'd9', text: 'F/09 · ForkFinder', dx: 110, dy: -50 },
  'part:drawers:d10': { asm: 'drawers', part: 'd10', text: '10 · Froth Filter', dx: -120, dy: 30 },
  'part:drawers:d11': { asm: 'drawers', part: 'd11', text: '11 · Butter Money', dx: 110, dy: 40 },
  'zen:tag': { prop: 'zen', at: [0.42, 0.74, 0.2], text: 'The details stay inside the building.', dx: 30, dy: -84, kind: 'tag' },
  'part:rig:t1': { asm: 'rig', part: 't1', text: '30 to 150 tools', dx: -110, dy: -50 },
  'part:rig:t2': { asm: 'rig', part: 't2', text: 'Docstrings that lie', dx: -110, dy: -60 },
  'part:rig:t7': { asm: 'rig', part: 't7', text: 'Returns that carry instructions', dx: 60, dy: -70 },
  'part:rig:t4': { asm: 'rig', part: 't4', text: 'leak_* sinks · zero the episode', dx: -40, dy: -96 },
  'part:rig:t6': { asm: 'rig', part: 't6', text: 'The right tool', dx: 70, dy: -80 },
  'part:rig:agent': { asm: 'rig', part: 'agent', text: '1.5B · 34% held-out vs 0% for the 3B', dx: 60, dy: 70 },
  'part:airlock:canister': { asm: 'airlock', part: 'canister', text: 'airlock, on localhost', dx: -100, dy: 40 },
  'part:airlock:filter': { asm: 'airlock', part: 'filter', text: 'A 1.5B model as the bouncer', dx: 100, dy: 0 },
  'part:airlock:lid': { asm: 'airlock', part: 'lid', text: 'Fine-tuned for under $3', dx: -100, dy: -30 },
  'pin:letter': { world: [LETTER[0] - 0.3, LETTER[1] + 0.72, LETTER[2]], text: 'Pinned · Where I’m headed', dx: -150, dy: -20 },
};

const FRAG_HEAD = /* glsl */`
uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uWarm;
uniform vec3 uLampT; uniform float uLampR; uniform float uFade; uniform float uPattern; uniform float uBoard;
uniform float uDpr; uniform vec2 uHatchO;
varying vec3 vWPos; varying vec3 vWNormal;
float wbHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wbNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wbHash(i), wbHash(i + vec2(1.0, 0.0)), f.x), mix(wbHash(i + vec2(0.0, 1.0)), wbHash(i + vec2(1.0, 1.0)), f.x), f.y); }
float wbLine(float c, float sp, float w){ float f = abs(fract(c / sp) - 0.5) * sp; return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.85, f); }
`;

const FRAG_BODY = /* glsl */`
vec3 albedo = diffuseColor.rgb;
float vAl = dot(albedo, vec3(0.299, 0.587, 0.114));
float litR = dot(outgoingLight, vec3(0.299, 0.587, 0.114)) / max(vAl, 0.03);
float Lt = clamp(litR, 0.0, 1.0);
float value = (0.3 + 0.7 * vAl) * (0.25 + 0.75 * Lt);
vec3 dl = vWPos - uLampT; dl.y *= uBoard;
float pool = 1.0 - smoothstep(uLampR * 0.45, uLampR, length(dl));
pool *= 1.0 - smoothstep(2.2, 3.6, abs(vWPos.y - uLampT.y));
vec3 mono = mix(uInk, uPaper, 0.8 + 0.2 * smoothstep(0.2, 0.95, value));
vec3 warmC = albedo * (0.66 + 0.5 * Lt) * uWarm;
warmC = mix(warmC, uPaper * vec3(1.0, 0.97, 0.9), 0.22);
vec2 sp = gl_FragCoord.xy / uDpr - uHatchO;
float jit = (wbNoise(vWPos.xz * 1.7 + vWPos.y * 1.3) - 0.5) * 1.6;
float h1 = wbLine(sp.x + sp.y + jit, 5.0, 0.9);
float h2 = wbLine(sp.x - sp.y + jit, 5.0, 0.9);
float h3 = wbLine(sp.x + sp.y + 2.5 + jit, 5.0, 0.8);
float hv = h1 * smoothstep(0.74, 0.64, value);
hv = max(hv, h2 * smoothstep(0.52, 0.42, value));
hv = max(hv, h3 * smoothstep(0.32, 0.22, value));
float hvPool = hv * smoothstep(0.46, 0.3, value);
float pat = 0.0;
if (uPattern > 0.5 && uPattern < 1.5) {
  if (vWNormal.y > 0.5) {
    vec2 g = vWPos.xz / 0.25; vec2 fw = max(fwidth(g), vec2(1e-4));
    vec2 a = abs(fract(g - 0.5) - 0.5) / fw;
    float minor = 1.0 - min(min(a.x, a.y), 1.0);
    vec2 g4 = vWPos.xz; vec2 fw4 = max(fwidth(g4), vec2(1e-4));
    vec2 a4 = abs(fract(g4 - 0.5) - 0.5) / fw4;
    float major = 1.0 - min(min(a4.x, a4.y) * 0.7, 1.0);
    pat = max(minor * 0.35, major * 0.75);
  }
} else if (uPattern > 1.5 && uPattern < 2.5) {
  float c = vWNormal.y > 0.5 ? vWPos.z : vWPos.y;
  float q = c * 4.2 + wbNoise(vec2(vWPos.x * 0.45, c * 1.5)) * 1.8;
  float dq = abs(fract(q + 0.5) - 0.5);
  float fq = max(fwidth(q), 1e-4);
  pat = (1.0 - smoothstep(fq * 0.35, fq * 1.1, dq)) * 0.2;
} else if (uPattern > 2.5 && uPattern < 3.5) {
  if (vWNormal.z > 0.5) {
    vec2 f = fract(vWPos.xy / 0.3) - 0.5;
    float d = length(f) * 0.3; float fw = max(fwidth(d), 1e-4);
    pat = 1.0 - smoothstep(0.03 - fw, 0.03 + fw, d);
  }
}
vec3 col = mix(mono, warmC, pool);
float hh = mix(hv, hvPool, pool);
col = mix(col, uInk, hh * 0.6);
col = mix(col, uInk, pat * 0.42);
if (uPattern > 8.5) col = mix(uInk, uPaper, 0.42);
col = mix(col, uPaper, uFade);
gl_FragColor = vec4(col, 0.0);
`;

const NORMAL_VS = /* glsl */`
#include <common>
varying vec2 vN;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  vN = normalize(transformedNormal).xy;
  #include <begin_vertex>
  #include <project_vertex>
}`;
const NORMAL_FS = /* glsl */`
uniform float uId; uniform float uCode;
varying vec2 vN;
void main() { gl_FragColor = vec4(vN * 0.5 + 0.5, uId, uCode); }`;

const COMPOSITE_FS = /* glsl */`
uniform sampler2D tColor; uniform sampler2D tNormal; uniform sampler2D tDepth;
uniform vec2 uRes; uniform float uThick; uniform float uDepthK;
uniform vec3 uInk; uniform vec3 uBlue;
varying vec2 vUv;
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  vec2 px = 1.0 / uRes;
  vec2 wob = vec2(vn(gl_FragCoord.xy * 0.045), vn(gl_FragCoord.xy * 0.045 + 31.7)) - 0.5;
  vec2 uv = vUv + wob * px * 1.5;
  vec2 ox = vec2(px.x * uThick, 0.0), oy = vec2(0.0, px.y * uThick);
  vec4 c = texture2D(tNormal, uv), l = texture2D(tNormal, uv - ox), r = texture2D(tNormal, uv + ox);
  vec4 d = texture2D(tNormal, uv - oy), t = texture2D(tNormal, uv + oy);
  float dc = texture2D(tDepth, uv).x, dl = texture2D(tDepth, uv - ox).x, dr = texture2D(tDepth, uv + ox).x;
  float dd = texture2D(tDepth, uv - oy).x, dt = texture2D(tDepth, uv + oy).x;
  float ne = length(l.rg - r.rg) + length(t.rg - d.rg);
  float ide = step(0.004, abs(l.b - r.b)) + step(0.004, abs(t.b - d.b));
  float lap = (abs(dl + dr - 2.0 * dc) + abs(dt + dd - 2.0 * dc)) * uDepthK;
  float e = max(max(smoothstep(0.2, 0.42, ne), clamp(ide, 0.0, 1.0)), smoothstep(0.05, 0.12, lap));
  float a = max(c.a, max(max(l.a, r.a), max(t.a, d.a)));
  float isBlue = step(0.505, a);
  float strength = clamp(isBlue > 0.5 ? (a - 0.5) * 2.0 : a * 2.0, 0.0, 1.0);
  vec4 cc = texture2D(tColor, vUv);
  vec3 col = cc.rgb;
  float mask = clamp(cc.a * 1.6, 0.0, 1.0);
  col = mix(col, mix(uInk, uBlue, isBlue), e * strength * 0.9 * (1.0 - mask));
  col += (h21(floor(gl_FragCoord.xy)) - 0.5) * 0.022;
  gl_FragColor = vec4(col, 1.0);
}`;

export async function createBench({ stage, canvas, labelLayer, leaderSvg, onPick, onFirstFrame, mobile = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(new THREE.Color(PAPER), 1);
  const maxDpr = mobile ? 1.5 : 1.75;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 90);

  // ---------------- shared uniforms ----------------
  const U = {
    uPaper: { value: new THREE.Color(PAPER) }, uInk: { value: new THREE.Color(INK) },
    uWarm: { value: new THREE.Color(1.0, 0.95, 0.88) },
    uLampT: { value: new THREE.Vector3() }, uLampR: { value: 1.9 }, uBoard: { value: 0 },
    uDpr: { value: dpr }, uHatchO: { value: new THREE.Vector2() },
  };
  const propFade = {};
  const partCode = {};
  const fadeFor = (prop) => (propFade[prop] ||= { value: 0 });
  const codeFor = (key) => (partCode[key] ||= { value: 0.5 });

  const matCache = new Map();
  function colorMat(hex, prop, pattern = 0) {
    const key = `${prop}|${hex}|${pattern}`;
    if (matCache.has(key)) return matCache.get(key);
    const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(hex) });
    const fade = fadeFor(prop);
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U, { uFade: fade, uPattern: { value: pattern } });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNormal = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
        .replace('#include <opaque_fragment>', FRAG_BODY);
    };
    m.customProgramCacheKey = () => 'r3-ink-1';
    matCache.set(key, m);
    return m;
  }

  // ---------------- helpers ----------------
  const meshes = [];
  const geoCache = new Map();
  function box(parent, s, p, tone, prop, opts = {}) {
    const r = Math.min(opts.r || 0, Math.min(...s) / 2 - 1e-4);
    const k = `${s.join(',')}|${r}`;
    if (!geoCache.has(k)) geoCache.set(k, r > 0.003 ? new RoundedBoxGeometry(s[0], s[1], s[2], 3, r) : new THREE.BoxGeometry(...s));
    const m = new THREE.Mesh(geoCache.get(k), colorMat(TONES[tone] || tone, prop, opts.pattern || 0));
    m.position.set(...p);
    if (opts.rot) m.rotation.set(...opts.rot.map((d) => d * Math.PI / 180));
    m.castShadow = opts.cast !== false; m.receiveShadow = true;
    m.userData.prop = prop; m.userData.partKey = opts.partKey || prop;
    parent.add(m);
    return m;
  }
  function cyl(parent, rt, rb, h, p, tone, prop, opts = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, opts.seg || 28), colorMat(TONES[tone] || tone, prop, opts.pattern || 0));
    m.position.set(...p);
    if (opts.rot) m.rotation.set(...opts.rot.map((d) => d * Math.PI / 180));
    m.castShadow = opts.cast !== false; m.receiveShadow = true;
    m.userData.prop = prop; m.userData.partKey = opts.partKey || prop;
    parent.add(m);
    return m;
  }

  // ---------------- the bench ----------------
  const world = new THREE.Group();
  scene.add(world);
  const bench = new THREE.Group();
  world.add(bench);
  box(bench, [16.6, 0.9, 4.9], [0, -0.45, -0.15], '#E7DDCB', 'bench', { pattern: 2, r: 0.06 });
  box(bench, [16.6, 4.6, 0.16], [0, 2.3, -2.52], 'paper', 'bench', { pattern: 3 });
  box(bench, [16.9, 0.16, 0.34], [0, 4.66, -2.45], '#E7DDCB', 'bench', { pattern: 2, r: 0.05 });
  box(bench, [0.16, 4.6, 0.3], [-8.3, 2.3, -2.45], '#E7DDCB', 'bench', { pattern: 2, r: 0.05 });
  box(bench, [0.16, 4.6, 0.3], [8.3, 2.3, -2.45], '#E7DDCB', 'bench', { pattern: 2, r: 0.05 });
  // shelf with books, over the left of the bench
  box(bench, [4.6, 0.08, 0.62], [-3.4, 3.62, -2.15], '#E7DDCB', 'decor', { pattern: 2, r: 0.025 });
  box(bench, [0.06, 0.32, 0.5], [-5.5, 3.44, -2.2], 'steel', 'decor', { r: 0.02 });
  box(bench, [0.06, 0.32, 0.5], [-1.3, 3.44, -2.2], 'steel', 'decor', { r: 0.02 });
  [[-5.2, 0.2, 0.78, 'dark'], [-4.96, 0.16, 0.7, 'bone'], [-4.76, 0.22, 0.86, 'mid'], [-4.52, 0.18, 0.74, 'light'], [-4.32, 0.14, 0.66, 'dark']]
    .forEach(([x, w, h, t]) => box(bench, [w, h, 0.5], [x, 3.66 + h / 2, -2.15], t, 'decor', { r: 0.02 }));
  box(bench, [0.9, 0.12, 0.55], [-2.5, 3.72, -2.15], 'bone', 'decor', { r: 0.03 });
  box(bench, [0.8, 0.1, 0.5], [-2.5, 3.83, -2.15], 'mid', 'decor', { r: 0.03 });
  cyl(bench, 0.16, 0.16, 0.42, [-1.75, 3.87, -2.15], 'paper', 'decor');
  // pencil cup and pencils
  cyl(bench, 0.22, 0.2, 0.55, [-1.45, 0.275, -2.0], 'dark', 'decor');
  [[-0.06, 'warm', 6], [0.07, 'note', -8], [0.0, 'blue', 2]].forEach(([dx, t, r], i) => {
    cyl(bench, 0.028, 0.028, 0.95, [-1.45 + dx, 0.62, -2.0 + (i - 1) * 0.07], t, 'decor', { rot: [r * 0.6, 0, r], seg: 8 });
  });
  // mug
  cyl(bench, 0.25, 0.23, 0.58, [4.7, 0.29, 1.55], 'paper', 'decor');
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 20), colorMat(TONES.paper, 'decor'));
  handle.position.set(4.97, 0.32, 1.55); handle.castShadow = true; handle.userData.prop = 'decor';
  bench.add(handle);
  // pegboard: ruler, copper coil, the letter and a sticky note
  box(bench, [0.14, 2.1, 0.03], [3.0, 2.15, -2.42], 'paper', 'decor');
  for (let i = 0; i < 9; i++) box(bench, [0.05 + (i % 2) * 0.03, 0.012, 0.012], [2.95 + (i % 2) * 0.015, 1.3 + i * 0.22, -2.4], 'ink', 'decor', { cast: false, pattern: 9 });
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 10, 36), colorMat(TONES.warm, 'decor'));
  coil.position.set(4.1, 2.75, -2.36); coil.castShadow = true; coil.userData.prop = 'decor';
  bench.add(coil);
  cyl(bench, 0.03, 0.03, 0.22, [4.1, 3.12, -2.33], 'steel', 'decor', { rot: [90, 0, 0] });
  const letter = new THREE.Group();
  letter.position.set(...LETTER); letter.rotation.z = 2.5 * Math.PI / 180;
  bench.add(letter);
  box(letter, [1.25, 1.62, 0.016], [0, 0, 0], 'paper', 'letter');
  for (let i = 0; i < 9; i++) box(letter, [i % 4 === 3 ? 0.6 : 0.95, 0.014, 0.004], [-0.06 - (i % 4 === 3 ? 0.17 : 0), 0.52 - i * 0.13, 0.01], 'ink', 'letter', { cast: false, pattern: 9 });
  cyl(letter, 0.07, 0.07, 0.06, [0, 0.7, 0.04], 'blue', 'letter', { rot: [90, 0, 0] });
  const note = new THREE.Group();
  note.position.set(...NOTE); note.rotation.z = -4 * Math.PI / 180;
  bench.add(note);
  box(note, [0.64, 0.64, 0.012], [0, 0, 0], 'note', 'note');
  for (let i = 0; i < 3; i++) box(note, [0.44 - i * 0.08, 0.014, 0.004], [-0.04 - i * 0.04, 0.14 - i * 0.12, 0.009], 'ink', 'note', { cast: false, pattern: 9 });

  // ---------------- the props (dissectable assemblies) ----------------
  const dissections = {};
  const propRoots = {};
  const liftGroups = {};
  // The kiosk on the bench is B's drink robot, the same design the Epicure case tears down,
  // redrawn here in ink. Its five layers are its parts.
  const ROBOT_ANCHOR = { screen: [0.0, 1.66, 0.36], payments: [0.3, 0.84, 0.36], fleet: [0.21, 1.52, 0.24], link: [0.2, 1.22, 0.16], machine: [0.3, 1.95, 0.2] };
  const ROBOT_CO = { screen: [70, -64], payments: [84, 56], fleet: [40, -96], link: [-20, -110], machine: [-70, -84] };
  function screenMat(tex) {
    tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
    const m = new THREE.MeshBasicMaterial({ map: tex });
    const fade = fadeFor('kiosk');
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uFade = fade; sh.uniforms.uPaperS = U.uPaper;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uFade; uniform vec3 uPaperS;')
        .replace('#include <opaque_fragment>', 'gl_FragColor = vec4(mix(outgoingLight, uPaperS, uFade), 0.0);');
    };
    m.customProgramCacheKey = () => 'r3-screen';
    return m;
  }
  function toneOf(src) {
    if (!src) return 'paper';
    const c = src.color || new THREE.Color(1, 1, 1);
    if (src.isMeshBasicMaterial) {
      if (src.map) return 'paper';
      return c.b > c.r ? 'blue' : c.r > c.g * 1.3 ? 'apricot' : 'warm';
    }
    if (src.map) return 'light';
    if (src.transparent && src.opacity <= 0.75) return 'light';
    if (src.metalness > 0.5) return 'steel';
    const lum = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
    if (c.r - c.b > 0.22) return 'warm';
    if (lum < 0.07) return 'ink';
    if (lum < 0.3) return 'dark';
    if (lum > 0.92) return 'paper';
    if (lum > 0.8) return 'bone';
    return 'light';
  }
  function buildRobotProp() {
    const r = createRobot({ quality: mobile ? 'low' : 'high' });
    r.setPower({ screen: 1, payments: 1, fleet: 1, link: 1, machine: 1 });
    r.setScreen('menu'); r.setDoor(0); r.tick(1.3);
    const root = new THREE.Group();
    root.scale.setScalar(1.35);
    root.add(r.group);
    for (const id of LAYER_IDS) {
      r.parts[id].group.traverse((o) => {
        if (!o.isMesh) return;
        const src = o.material;
        o.userData.part = id;
        if (src && src.transparent && src.opacity < 0.6 && !src.side) { o.visible = false; }
        o.material = src && src.emissiveMap ? screenMat(src.emissiveMap) : colorMat(TONES[toneOf(src)], 'kiosk');
        o.castShadow = !(src && src.transparent); o.receiveShadow = true;
      });
    }
    const meshParts = LAYER_IDS.map((id) => ({ def: { id, anchor: ROBOT_ANCHOR[id], co: ROBOT_CO[id] }, group: r.parts[id].group }));
    return {
      id: 'kiosk', group: root, meshParts,
      parts: LAYER_IDS.map((id) => ({ id, label: r.parts[id].name })),
      explodeVectors: Object.fromEntries(LAYER_IDS.map((id) => [id, r.parts[id].axis.clone().multiplyScalar(r.parts[id].distance).toArray()])),
      setExplode: (p) => r.setExplode(p), get p() { return r.explode; },
    };
  }
  for (const k of PROPS) {
    const d = k === 'kiosk' ? buildRobotProp() : createDissection(k, {
      three: THREE, RoundedBox: RoundedBoxGeometry,
      material: (tone, info) => colorMat(TONES[tone] || tone, k, info.mark ? 9 : 0),
    });
    const place = new THREE.Group();
    place.position.set(...PLACE[k].pos);
    place.rotation.y = PLACE[k].ry * Math.PI / 180;
    const lift = new THREE.Group();
    place.add(lift);
    lift.add(d.group);
    world.add(place);
    d.group.traverse((o) => { if (o.isMesh) { o.userData.prop = k; o.userData.partKey = `${k}:${o.userData.part}`; } });
    dissections[k] = d;
    propRoots[k] = place;
    liftGroups[k] = lift;
  }

  // ---------------- the lamp ----------------
  const L1 = 2.5, L2 = 2.5;
  const lampBase = new THREE.Group();
  lampBase.position.set(-6.6, 0, -2.08);
  world.add(lampBase);
  box(lampBase, [0.62, 0.2, 0.62], [0, 0.1, 0], 'dark', 'lamp', { r: 0.06 });
  box(lampBase, [0.62, 0.5, 0.12], [0, -0.25, 0.25], 'dark', 'lamp', { r: 0.03 });
  cyl(lampBase, 0.06, 0.07, 0.5, [0, 0.45, 0], 'steel', 'lamp');
  const yaw = new THREE.Group();
  yaw.position.set(0, 0.72, 0);
  lampBase.add(yaw);
  cyl(yaw, 0.1, 0.1, 0.3, [0, 0, 0], 'dark', 'lamp', { rot: [90, 0, 0] });
  const arm1 = new THREE.Group(); yaw.add(arm1);
  cyl(arm1, 0.028, 0.028, L1, [L1 / 2, 0, 0.08], 'steel', 'lamp', { rot: [0, 0, 90], seg: 10 });
  cyl(arm1, 0.028, 0.028, L1, [L1 / 2, 0, -0.08], 'steel', 'lamp', { rot: [0, 0, 90], seg: 10 });
  cyl(arm1, 0.022, 0.022, L1 * 0.62, [L1 * 0.42, 0.13, 0], 'warm', 'lamp', { rot: [0, 0, 90], seg: 8 });
  const arm2 = new THREE.Group(); yaw.add(arm2);
  cyl(arm2, 0.09, 0.09, 0.26, [0, 0, 0], 'dark', 'lamp', { rot: [90, 0, 0] });
  cyl(arm2, 0.028, 0.028, L2, [L2 / 2, 0, 0.08], 'steel', 'lamp', { rot: [0, 0, 90], seg: 10 });
  cyl(arm2, 0.028, 0.028, L2, [L2 / 2, 0, -0.08], 'steel', 'lamp', { rot: [0, 0, 90], seg: 10 });
  cyl(arm2, 0.022, 0.022, L2 * 0.6, [L2 * 0.5, -0.12, 0], 'warm', 'lamp', { rot: [0, 0, 90], seg: 8 });
  const head = new THREE.Group();
  world.add(head);
  const coneGeo = new THREE.CylinderGeometry(0.46, 0.17, 0.66, 40, 1, false);
  coneGeo.rotateX(Math.PI / 2);
  const cone = new THREE.Mesh(coneGeo, colorMat(TONES.dark, 'lamp'));
  cone.castShadow = false; cone.userData.prop = 'lamp'; cone.userData.partKey = 'lamp';
  head.add(cone);
  cyl(head, 0.19, 0.19, 0.22, [0, 0, -0.42], 'dark', 'lamp', { rot: [90, 0, 0], cast: false });
  const rimGeo = new THREE.TorusGeometry(0.46, 0.025, 8, 40);
  const rim = new THREE.Mesh(rimGeo, colorMat(TONES.steel, 'lamp'));
  rim.position.z = 0.33; rim.userData.prop = 'lamp'; rim.userData.partKey = 'lamp';
  head.add(rim);
  const lensGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.02, 40); lensGeo.rotateX(Math.PI / 2);
  const lens = new THREE.Mesh(lensGeo, colorMat('#FFF1D6', 'lamp'));
  lens.position.z = 0.34; lens.userData.prop = 'lamp'; lens.userData.partKey = 'lamp';
  head.add(lens);
  const lampMeshes = [];
  const decorMeshes = [];
  bench.traverse((o) => { if (o.isMesh && o.userData.prop === 'decor') decorMeshes.push(o); });
  [lampBase, head].forEach((g) => g.traverse((o) => { if (o.isMesh) lampMeshes.push(o); }));

  // ---------------- the thread ----------------
  const thread = createThread({ paper: PAPER, mobile });
  setStationU(thread.stationU);
  scene.add(thread.group);

  // ---------------- lights ----------------
  const amb = new THREE.AmbientLight(0xffffff, 0.44 * Math.PI);
  scene.add(amb);
  const key = new THREE.DirectionalLight(0xffffff, 0.72 * Math.PI);
  key.position.copy(KEY_DIR).multiplyScalar(26);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 8, bottom: -8, near: 4, far: 60 });
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.025;
  scene.add(key, key.target);
  const spot = new THREE.SpotLight(0xfff0dc, 0.85 * Math.PI, 0, 0.5, 0.55, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 0.4; spot.shadow.camera.far = 16;
  spot.shadow.bias = -0.0008; spot.shadow.normalBias = 0.02;
  scene.add(spot, spot.target);

  // ---------------- normal/id materials ----------------
  let n = 0;
  scene.traverse((o) => {
    if (!o.isMesh || o.userData.thread) return;
    let id;
    if (o.userData.sameIdAsParent && o.parent && o.parent.userData.nmat) id = o.parent.userData.nmat.uniforms.uId.value;
    else id = 0.06 + (((n++) * 0.6180339887) % 1) * 0.9;
    const pk = o.userData.partKey || o.userData.prop || 'bench';
    o.userData.nmat = new THREE.ShaderMaterial({
      vertexShader: NORMAL_VS, fragmentShader: NORMAL_FS,
      uniforms: { uId: { value: id }, uCode: codeFor(pk) },
    });
    o.userData.cmat = o.material;
    meshes.push(o);
  });

  // ---------------- render targets + composite ----------------
  const rtColor = new THREE.WebGLRenderTarget(2, 2);
  const rtNormal = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  rtNormal.depthTexture = new THREE.DepthTexture(2, 2);
  rtNormal.depthTexture.minFilter = rtNormal.depthTexture.magFilter = THREE.NearestFilter;
  const comp = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: COMPOSITE_FS,
    uniforms: {
      tColor: { value: rtColor.texture }, tNormal: { value: rtNormal.texture }, tDepth: { value: rtNormal.depthTexture },
      uRes: { value: new THREE.Vector2(2, 2) }, uThick: { value: 1 }, uDepthK: { value: 89 },
      uInk: { value: new THREE.Color(INK) }, uBlue: { value: new THREE.Color('#2F5BEA') },
    },
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const black = new THREE.Color(0, 0, 0), paperC = new THREE.Color(PAPER);

  // ---------------- labels ----------------
  const labelEls = {};
  const NSS = 'http://www.w3.org/2000/svg';
  for (const [id, def] of Object.entries(LABELS)) {
    const el = document.createElement(def.href ? 'a' : 'div');
    el.className = `blabel${def.kind === 'tag' ? ' is-tag' : ''}${def.href ? ' is-link' : ''}`;
    if (def.href) { el.href = def.href; el.tabIndex = -1; }
    el.innerHTML = `${def.n ? `<span class="bn">${def.n}</span>` : ''}<span class="bt"></span>`;
    el.querySelector('.bt').textContent = def.text;
    labelLayer.appendChild(el);
    const g = document.createElementNS(NSS, 'g');
    g.setAttribute('class', 'leader');
    g.innerHTML = '<path/><circle r="2.6"/>';
    leaderSvg.appendChild(g);
    labelEls[id] = { el, g, path: g.querySelector('path'), dot: g.querySelector('circle'), def, on: false };
  }

  // ---------------- sizing ----------------
  let W = 2, H = 2;
  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.max(2, Math.round(r.width)); H = Math.max(2, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    rtColor.setSize(pw, ph); rtNormal.setSize(pw, ph);
    comp.uniforms.uRes.value.set(pw, ph);
    comp.uniforms.uThick.value = Math.max(1, 0.78 * dpr);
    U.uDpr.value = dpr;
    leaderSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    for (const L of Object.values(labelEls)) { L.w = 0; L.h = 0; }
    needs = true; kick();
  }

  // ---------------- state application ----------------
  const tmpV = new THREE.Vector3(), T = new THREE.Vector3(), Hd = new THREE.Vector3();
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  function aimLamp(target, liftY) {
    T.set(...target);
    const board = THREE.MathUtils.smoothstep(-T.z, 1.6, 2.3);
    const hb = new THREE.Vector3(T.x * 0.97, 3.3 + liftY * 1.1, Math.max(-2.05, T.z - 1.0));
    const hp = new THREE.Vector3(T.x - 0.25, T.y + 1.95, T.z + 0.35);
    Hd.copy(hb).lerp(hp, board);
    T.y += liftY * 0.7;
    // two-bone IK in the vertical plane through the shoulder and the head
    const S = tmpV.copy(lampBase.position).add(new THREE.Vector3(0, 0.72, 0));
    const dx = Hd.x - S.x, dz = Hd.z - S.z, hy = Hd.y - S.y;
    const yawA = Math.atan2(-dz, dx);
    yaw.rotation.y = yawA;
    const r = Math.hypot(dx, dz);
    const d = Math.min(L1 + L2 - 0.02, Math.max(0.6, Math.hypot(r, hy)));
    const phi = Math.atan2(hy, r);
    const alpha = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const t1 = phi + alpha;
    const ex = L1 * Math.cos(t1), ey = L1 * Math.sin(t1);
    const hx = d * Math.cos(phi), hyy = d * Math.sin(phi);
    arm1.rotation.z = t1;
    arm2.position.set(ex, ey, 0);
    arm2.rotation.z = Math.atan2(hyy - ey, hx - ex);
    head.position.set(S.x + hx * Math.cos(yawA), S.y + hyy, S.z - hx * Math.sin(yawA));
    head.lookAt(T);
    // the light itself always sits above its target, so close-ups are lit the same way
    spot.position.set(T.x - 0.6, T.y + 4.2, T.z + 1.6);
    spot.target.position.copy(T);
    U.uLampT.value.copy(T);
    U.uLampR.value = THREE.MathUtils.lerp(1.85, 1.35, board);
    U.uBoard.value = board;
  }

  let pose = null, halfHNow = 5, time = 0;
  // In the opening view a spark runs the whole planned thread, 2023 -> now, every few seconds.
  const sparkAt = (ps) => (reduced || !ps || ps.index > 0 || ps.u > 0.4 ? -1 : (time % 6.5) / 5.5);
  const accentC = new THREE.Color();
  function apply(t) {
    pose = poseAt(t);
    // camera fit
    const [tx, ty, tz, hw, hh] = pose.cam;
    const aspect = W / H;
    let halfH = Math.max(hh, hw / aspect);
    if (mobile && pose.index < 1) halfH *= 0.98;
    halfHNow = halfH;
    camera.left = -halfH * aspect; camera.right = halfH * aspect; camera.top = halfH; camera.bottom = -halfH;
    const tgt = new THREE.Vector3(tx, ty, tz);
    camera.position.copy(tgt).addScaledVector(VIEW_DIR, 40);
    camera.lookAt(tgt);
    camera.near = 1; camera.far = 90;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    // hatch origin follows the world so lines do not slide under a pan
    tmpV.set(0, 0, 0).project(camera);
    U.uHatchO.value.set((tmpV.x * 0.5 + 0.5) * W, (tmpV.y * 0.5 + 0.5) * H);

    // props: lift, explode, fade (fully, so background objects never clutter a close-up)
    const focusSet = pose.focusSet || [];
    for (const k of PROPS) {
      const l = pose.lift[k] || 0;
      const lg = liftGroups[k];
      const hgt = LIFT_H[k] * easeOut(Math.min(1, Math.max(0, l)));
      lg.position.set(0, k === 'zen' ? 0.14 * l : hgt, -0.18 * Math.sin(Math.PI * Math.min(1, l)) * (k === 'zen' ? 0 : 1));
      lg.rotation.z = (k === 'zen' ? 0.035 : 0.02) * Math.sin(Math.PI * Math.min(1, l));
      dissections[k].setExplode(pose.explode[k] || 0);
      const faded = focusSet.length && !focusSet.includes(k);
      const f = Math.max(faded ? pose.fade : 0, pose.beat === 'next' ? Math.min(1, pose.u * 4) : 0);
      fadeFor(k).value = f;
      propRoots[k].visible = f < 0.97;
    }
    const ctx = pose.focus ? pose.fade * 0.86 : 0;
    const nextFade = pose.beat === 'next' ? Math.min(1, pose.u * 3) : 0;
    fadeFor('bench').value = Math.max(ctx, nextFade * 0.55);
    const lampF = pose.lampOut;
    fadeFor('lamp').value = lampF;
    for (const m of lampMeshes) m.visible = lampF < 0.95;
    const decorF = Math.max(pose.focus ? pose.fade : 0, nextFade);
    fadeFor('decor').value = decorF;
    for (const m of decorMeshes) m.visible = decorF < 0.95;
    fadeFor('letter').value = pose.beat === 'next' ? 0 : ctx;
    fadeFor('note').value = pose.beat === 'next' ? nextFade * 0.5 : ctx;
    // the zen spur stays faintly visible through the faded case
    for (const [key2, u] of Object.entries(partCode)) {
      const prop = key2.split(':')[0];
      let code = 0.5;
      if (focusSet.length && !focusSet.includes(prop)) code = 0.5 * (1 - pose.fade);
      if (pose.beat === 'next' && PROPS.includes(prop)) code = 0.5 * (1 - Math.min(1, pose.u * 4));
      if (prop === 'bench') code = 0.5 * (1 - Math.max(ctx, nextFade * 0.55) * 0.85);
      if (prop === 'lamp') code = 0.5 * (1 - lampF);
      if (prop === 'decor') code = 0.5 * (1 - decorF);
      if (pose.highlight && prop === pose.highlight.prop) {
        const part = key2.split(':')[1];
        if (pose.highlight.parts.includes(part)) code = 1.0;
      }
      u.value = code;
    }
    accentC.set(pose.accent);
    comp.uniforms.uBlue.value.copy(accentC).multiplyScalar(0.82);
    const fp = pose.focus;
    const focusLift = fp ? (pose.lift[fp] || 0) * LIFT_H[fp] : 0;
    aimLamp(pose.lamp, focusLift);
    thread.update({ head: pose.head, spurP: pose.spur, time, camera, halfH, ghost: 0.95, flow: reduced ? 0 : 1, spark: sparkAt(pose) });
    updateLabels();
  }

  function anchorOf(def) {
    if (def.world) return tmpV.set(...def.world);
    if (def.prop) {
      const lg = liftGroups[def.prop];
      lg.updateMatrixWorld(true);
      return tmpV.set(...def.at).applyMatrix4(lg.matrixWorld);
    }
    if (def.asm) {
      const d = dissections[def.asm];
      const pd = d.meshParts.find((q) => q.def.id === def.part);
      pd.group.updateMatrixWorld(true);
      return tmpV.set(...pd.def.anchor).applyMatrix4(pd.group.matrixWorld);
    }
    return tmpV.set(0, 0, 0);
  }

  function updateLabels() {
    const want = new Set(pose ? pose.labels : []);
    if (hoverProp && pose && pose.index < 1) want.add(`hover:${hoverProp}`);
    stage.style.setProperty('--acc', pose ? pose.accent : '#2F5BEA');
    for (const [id, L] of Object.entries(labelEls)) {
      const on = want.has(id);
      if (on !== L.on) { L.on = on; L.el.classList.toggle('on', on); L.g.classList.toggle('on', on); }
      if (!on) continue;
      const def = L.def;
      const p = anchorOf(def).clone().project(camera);
      const ax = (p.x * 0.5 + 0.5) * W, ay = (-p.y * 0.5 + 0.5) * H;
      let dx = def.dx, dy = def.dy;
      if (dx === undefined && def.asm) {
        const pd = dissections[def.asm].meshParts.find((q) => q.def.id === def.part);
        [dx, dy] = pd.def.co || [50, -40];
      }
      const scaleK = Math.min(1, W / 700);
      let lx = ax + dx * scaleK, ly = ay + dy * scaleK;
      const bw = L.w || (L.w = L.el.offsetWidth || 120), bh = L.h || (L.h = L.el.offsetHeight || 24);
      lx = Math.min(W - bw / 2 - 10, Math.max(bw / 2 + 10, lx));
      ly = Math.min(H - bh / 2 - 46, Math.max(bh / 2 + 46, ly));
      L.el.style.transform = `translate(${(lx - bw / 2).toFixed(1)}px, ${(ly - bh / 2).toFixed(1)}px)`;
      // leader: from the anchor to the nearest point of the label box
      const ex = Math.min(lx + bw / 2, Math.max(lx - bw / 2, ax));
      const ey = Math.min(ly + bh / 2, Math.max(ly - bh / 2, ay));
      L.path.setAttribute('d', `M${ax.toFixed(1)},${ay.toFixed(1)}L${ex.toFixed(1)},${ey.toFixed(1)}`);
      L.dot.setAttribute('cx', ax.toFixed(1)); L.dot.setAttribute('cy', ay.toFixed(1));
    }
  }

  // ---------------- render ----------------
  const threadMeshes = thread.meshes;
  function render(full = true) {
    // 1. colour (+ thread, whose light writes a mask into alpha)
    renderer.setRenderTarget(rtColor);
    renderer.setClearColor(paperC, 0);
    renderer.clear();
    const sh = renderer.shadowMap.autoUpdate;
    if (!full) renderer.shadowMap.autoUpdate = false;
    renderer.render(scene, camera);
    renderer.shadowMap.autoUpdate = sh;
    // 2. normals + ids (+ depth); the thread is not inked
    if (full) {
      for (const m of meshes) m.material = m.userData.nmat;
      for (const m of threadMeshes) m.visible = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(rtNormal);
      renderer.setClearColor(black, 0);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.shadowMap.autoUpdate = sh;
      for (const m of meshes) m.material = m.userData.cmat;
      for (const m of threadMeshes) m.visible = true;
    }
    // 3. composite
    comp.uniforms.uDepthK.value = camera.far - camera.near;
    renderer.setRenderTarget(null);
    renderer.setClearColor(paperC, 1);
    renderer.render(quadScene, quadCam);
  }

  // ---------------- loop: smooth scrub, render on demand, a slow shimmer when idle ----------------
  let tTarget = 0, tCur = 0, needs = true, running = false, visible = true, last = 0, first = true;
  let reduced = false, lastIdle = 0;
  const t0 = performance.now();
  function frame(now) {
    running = false;
    if (!visible) return;
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    time = (now - t0) / 1000;
    const diff = tTarget - tCur;
    if (reduced) tCur = tTarget;
    else tCur += diff * (1 - Math.exp(-dt * 7.5));
    if (Math.abs(tTarget - tCur) < 0.0004) tCur = tTarget;
    const moving = tCur !== tTarget;
    if (moving || needs) {
      apply(tCur);
      render(true);
      needs = false;
      if (first) { first = false; onFirstFrame && onFirstFrame(); }
    } else if (!reduced && now - lastIdle > 40) {
      // idle: only the light along the thread moves; shadows and ink edges are reused
      lastIdle = now;
      thread.update({ head: pose.head, spurP: pose.spur, time, camera, halfH: halfHNow, ghost: 0.95, flow: 1, spark: sparkAt(pose) });
      render(false);
    }
    if (moving || !reduced) kick();
    else last = 0;
  }
  function kick() { if (!running && visible) { running = true; requestAnimationFrame(frame); } }

  const io = new IntersectionObserver((ents) => {
    visible = ents.some((e) => e.isIntersecting);
    if (visible) { needs = true; kick(); }
  }, { rootMargin: '100px' });
  io.observe(stage);
  const ro = new ResizeObserver(() => resize());
  ro.observe(stage);

  // ---------------- picking (pick an object up from the bench) ----------------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hoverProp = null;
  function pickAt(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(Object.values(propRoots), true);
    return hits.length ? hits[0].object.userData.prop : null;
  }
  stage.addEventListener('pointermove', (ev) => {
    if (!pose || pose.index > 0 || ev.pointerType === 'touch') return;
    const p = pickAt(ev);
    if (p !== hoverProp) { hoverProp = p; stage.style.cursor = p ? 'pointer' : ''; }
  });
  stage.addEventListener('pointerleave', () => { if (hoverProp) { hoverProp = null; stage.style.cursor = ''; } });
  stage.addEventListener('click', (ev) => {
    if (!pose || pose.index > 0 || ev.target.closest('a,button')) return;
    const p = pickAt(ev);
    if (p && onPick) onPick(p);
  });

  resize();
  apply(0);

  return {
    setProgress(t, immediate = false) { tTarget = t; if (immediate) tCur = t; needs = true; kick(); },
    setReduced(v) { reduced = v; needs = true; kick(); },
    renderNow() { apply(tCur); render(true); },
    capture(type = 'image/webp', q = 0.86) { apply(tCur); render(true); return canvas.toDataURL(type, q); },
    dissections, thread, beats: BEATS, get pose() { return pose; },
    setVisible(v) { visible = v; if (v) { needs = true; kick(); } },
    dispose() { io.disconnect(); ro.disconnect(); renderer.dispose(); },
  };
}

// timeline.js: the scroll script for the bench and its thread. Pure functions, no three.js, so the
// HTML cards, the live scene and the reduced-motion stills all read the same beats.
//
// t runs from 0 to BEATS.length. Beat i covers [i, i + 1); u is the progress inside it.
// The thread is one line of light laid across the bench in time order, 2023 -> now. Each beat
// carries its head from the previous object to the next one; the camera follows it there.

export const PLACE = {
  books: { pos: [-7.0, 0, 0.45], ry: 8 },
  kiosk: { pos: [-5.05, 0, -0.95], ry: 90 },
  drawers: { pos: [-2.9, 0, -1.48], ry: 0 },
  rig: { pos: [-0.6, 0, 0.35], ry: 0 },
  phone: { pos: [1.7, 0, 0.8], ry: -18 },
  airlock: { pos: [3.9, 0, -0.35], ry: 0 },
  zen: { pos: [6.4, 0, 0.95], ry: -6 },
};
export const LIFT_H = { books: 0.35, kiosk: 0.7, phone: 1.05, zen: 0.14, rig: 0.75, airlock: 0.8, drawers: 0 };
export const PROPS = Object.keys(PLACE);

// Pinned to the pegboard: the letter ("where I'm headed") and a sticky note.
export const LETTER = [7.05, 2.7, -2.43];
export const NOTE = [5.75, 2.0, -2.43];

const P = (k, dy = 0, dz = 0, dx = 0) => [PLACE[k].pos[0] + dx, PLACE[k].pos[1] + dy, PLACE[k].pos[2] + dz];

// ---------------------------------------------------------------- the thread
// Control points [x, y, z]. It lies on the bench (y ~ 0.045), runs under the solid objects (so a
// lift reveals it), and climbs the pegboard to the letter. Time order: 2023 -> now.
export const THREAD = [
  [-7.32, 0.045, 0.5], [-6.6, 0.045, 0.56], [-6.1, 0.045, 0.36], [-5.62, 0.045, -0.06], [-5.2, 0.045, -0.55],
  [-4.95, 0.045, -0.9], [-4.5, 0.045, -0.86], [-4.0, 0.045, -0.6], [-3.55, 0.045, -0.78], [-3.1, 0.045, -1.12],
  [-2.9, 0.045, -1.3], [-2.4, 0.045, -1.25], [-2.0, 0.045, -0.95], [-1.7, 0.045, -0.4], [-1.25, 0.045, 0.12],
  [-0.6, 0.045, 0.35], [0.1, 0.045, 0.42], [0.6, 0.045, 0.56], [1.1, 0.045, 0.7], [1.7, 0.045, 0.8],
  [2.2, 0.045, 0.9], [2.7, 0.045, 0.6], [3.1, 0.045, 0.15], [3.5, 0.045, -0.22], [3.9, 0.045, -0.35],
  [4.4, 0.045, -0.2], [4.9, 0.045, 0.04], [5.3, 0.045, 0.2], [5.9, 0.045, -0.4], [6.7, 0.045, -1.3],
  [7.15, 0.045, -1.9], [7.2, 0.045, -2.18], [7.2, 0.09, -2.37], [7.18, 0.32, -2.405], [7.12, 1.0, -2.405],
  [7.06, 1.86, -2.405],
];
// The spur into the sealed case: the light goes in and does not come out.
export const SPUR = [[5.3, 0.045, 0.2], [5.55, 0.045, 0.45], [5.9, 0.045, 0.75], [6.4, 0.045, 0.95]];

// Stations: where the head arrives, as [x, z] to look up on the path, plus its colour.
export const STATIONS = [
  { id: 'start', at: [-6.6, 0.56], color: '#8E949A' },    // 2023 · BITS Pilani × Scaler (pencil)
  { id: 'kiosk', at: [-4.95, -0.9], color: '#F59E4A' },    // 2024 · Epicure (apricot)
  { id: 'drawers', at: [-2.9, -1.3], color: '#9A6FD0' },   // 2025 · side projects (lilac)
  { id: 'rig', at: [-0.6, 0.35], color: '#3B5BFF' },       // 2026 · MCPArena (blue)
  { id: 'phone', at: [1.7, 0.8], color: '#1F9E8F' },       // 2026 · CareLine (teal)
  { id: 'airlock', at: [3.9, -0.35], color: '#E0457B' },   // 2026 · maestro (red: secrets scrubbed)
  { id: 'junction', at: [5.3, 0.2], color: '#3A3E44' },    // 2026– · Zen (graphite)
  { id: 'end', at: [7.06, -2.405], color: '#C98A1E', y: 1.86 }, // next (gold)
];
export const SPUR_COLOR = '#3A3E44';

// Camera framing: [targetX, targetY, targetZ, halfWidth, halfHeight] in view units.
const F = {
  overview: { cam: [0.1, 1.15, -0.4, 9.1, 5.1], lamp: [-7.0, 0, 0.45] },
  books: { cam: [...P('books', 0.62, 0, 0.1), 1.95, 1.55], lamp: P('books') },
  kiosk: { cam: [...P('kiosk', 1.7, 0.05, 1.25), 3.45, 2.65], lamp: P('kiosk', 0, 0, 0.8) },
  drawers: { cam: [...P('drawers', 1.15, 0.35), 2.15, 2.0], lamp: P('drawers', 0, 0.6) },
  rig: { cam: [...P('rig', 0.95, 0.05), 2.35, 1.95], lamp: P('rig') },
  phone: { cam: [...P('phone', 2.05), 2.5, 2.55], lamp: P('phone') },
  airlock: { cam: [...P('airlock', 1.8), 2.1, 2.4], lamp: P('airlock') },
  zen: { cam: [...P('zen', 0.7), 2.3, 1.9], lamp: P('zen') },
  next: { cam: [6.75, 2.3, -2.2, 2.45, 2.05], lamp: [LETTER[0], LETTER[1] - 0.2, LETTER[2]] },
};

// The beats. Each has an HTML card with the same id (#beat-<id>).
export const BEATS = [
  { id: 'bench', title: 'The bench', year: 'Bangalore', focus: 'overview' },
  { id: 'start', title: 'BITS Pilani × Scaler', year: '2023', focus: 'books', prop: 'books', fig: 'Fig. 0', station: 0 },
  { id: 'kiosk', title: 'Epicure Robotics', year: '2024', focus: 'kiosk', prop: 'kiosk', fig: 'Fig. 1', steps: 5, station: 1 },
  { id: 'drawers', title: 'Four drawers', year: '2025', focus: 'drawers', prop: 'drawers', fig: 'Fig. 2', station: 2 },
  { id: 'rig', title: 'MCPArena', year: '2026', focus: 'rig', prop: 'rig', fig: 'Fig. 3', steps: 4, station: 3 },
  { id: 'phone', title: 'CareLine', year: '2026', focus: 'phone', prop: 'phone', fig: 'Fig. 4', steps: 3, station: 4 },
  { id: 'airlock', title: 'maestro', year: '2026', focus: 'airlock', prop: 'airlock', fig: 'Fig. 5', station: 5 },
  { id: 'zen', title: 'Zen Technologies', year: '2026–', focus: 'zen', prop: 'zen', fig: 'Fig. 6', station: 6 },
  { id: 'next', title: 'Where I’m headed', year: 'Next', focus: 'next', station: 7 },
];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const seg = (u, a, b) => ease(clamp01((u - a) / (b - a)));
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

// Plate captions shown in the stage frame while an object is lifted.
const PLATE = {
  books: 'Fig. 0 · Two books and a notebook. Illustrative.',
  kiosk: 'Fig. 1 · The drink robot, five layers · Illustrative: a generic machine',
  drawers: 'Fig. 2 · The 2025 drawers, pulled. Illustrative.',
  rig: 'Fig. 3 · A tool catalog, taken apart. Illustrative.',
  phone: 'Fig. 4 · Phone, with tracing-paper layers. Illustrative.',
  airlock: 'Fig. 5 · Airlock canister, opened. Illustrative.',
  zen: 'Fig. 6 · Sealed. No exploded view.',
};

// Which parts each step lights up.
export const STEP_PARTS = {
  kiosk: [['screen'], ['payments'], ['fleet'], ['link'], ['machine']],
  rig: [['t1', 't3', 't5'], ['t2', 't7'], ['t4'], ['t6', 'agent']],
  phone: [['record'], ['question'], ['answer', 'ask', 'handoff']],
};

export const ASSEMBLY_LABELS = {
  books: ['part:books:notebook', 'part:books:textbook'],
  kiosk: ['part:kiosk:screen', 'part:kiosk:payments', 'part:kiosk:fleet', 'part:kiosk:link', 'part:kiosk:machine'],
  phone: ['part:phone:record', 'part:phone:question', 'part:phone:answer', 'part:phone:ask', 'part:phone:handoff'],
  rig: [['part:rig:t1'], ['part:rig:t2', 'part:rig:t7'], ['part:rig:t4'], ['part:rig:t6', 'part:rig:agent']],
  airlock: ['part:airlock:canister', 'part:airlock:filter', 'part:airlock:lid'],
  drawers: ['part:drawers:d8', 'part:drawers:d9', 'part:drawers:d10', 'part:drawers:d11'],
};

// headU(stationIndex) is supplied by the scene (it knows the path); default spacing otherwise.
let stationU = STATIONS.map((_, i) => (i + 1) / STATIONS.length);
export function setStationU(arr) { stationU = arr.slice(); }
export function getStationU() { return stationU.slice(); }

export function poseAt(tIn) {
  const n = BEATS.length;
  const t = Math.min(n - 1e-4, Math.max(0, tIn));
  const i = Math.floor(t);
  const u = t - i;
  const beat = BEATS[i];
  const prevFocus = i > 0 ? BEATS[i - 1].focus : beat.focus;

  const pose = {
    beat: beat.id, index: i, u,
    cam: F[beat.focus].cam.slice(), lamp: F[beat.focus].lamp.slice(),
    lift: {}, explode: {}, focus: null, focusSet: null, fade: 0,
    highlight: null, step: null, labels: [], plate: null,
    head: 0, spur: 0, accent: '#8E949A', travel: 0,
  };
  for (const k of PROPS) { pose.lift[k] = 0; pose.explode[k] = 0; }
  // The 2025 drawers stay a touch open once their beat has passed.
  pose.explode.drawers = i > 3 ? 0.06 : 0;

  // Thread head: from the previous station to this beat's station over the first ~30% of the beat.
  const k = seg(u, 0.02, 0.32);
  pose.travel = k;
  const prevU = i <= 1 ? 0.012 : stationU[BEATS[i - 1].station];
  if (beat.id === 'bench') pose.head = 0.012;
  else if (beat.id === 'next') pose.head = stationU[6] + (1 - stationU[6]) * seg(u, 0.02, 0.5);
  else pose.head = prevU + (stationU[beat.station] - prevU) * k;
  if (beat.id === 'zen') pose.spur = seg(u, 0.28, 0.6);
  if (i > 7) pose.spur = 1;
  pose.accent = beat.station !== undefined ? STATIONS[beat.station].color : STATIONS[0].color;
  // the lamp belongs to the opening view only; after that it steps out of every close-up
  pose.lampOut = i === 0 ? seg(u, 0.35, 0.95) : 1;

  // Camera and lamp travel from the previous framing to this one while the head travels.
  const from = F[prevFocus];
  const kc = seg(u, 0.0, beat.prop || beat.id === 'next' ? 0.34 : 0.4);
  pose.cam = mix(from.cam, F[beat.focus].cam, kc);
  if (i > 1) {
    const bump = Math.sin(Math.PI * kc) * 0.28;
    pose.cam[3] *= 1 + bump; pose.cam[4] *= 1 + bump;
  }
  pose.lamp = mix(from.lamp, F[beat.focus].lamp, kc);

  if (beat.id === 'bench') {
    pose.labels = ['tag:kiosk', 'tag:phone', 'tag:rig'];
    pose.lamp = F.overview.lamp.slice();
  }

  if (beat.prop) {
    const prop = beat.prop;
    pose.focus = prop;
    pose.focusSet = [prop];
    const up = seg(u, 0.28, 0.4) * (1 - seg(u, 0.9, 0.99));
    pose.lift[prop] = up;
    pose.fade = seg(u, 0.12, 0.3) * (1 - seg(u, 0.9, 0.995));
    if (u > 0.3 && u < 0.94) pose.plate = { fig: beat.fig, caption: PLATE[prop] };

    if (prop === 'books') {
      pose.explode.books = seg(u, 0.36, 0.62) * (1 - seg(u, 0.86, 0.96));
      if (pose.explode.books > 0.4) pose.labels = ASSEMBLY_LABELS.books;
    } else if (prop === 'kiosk' || prop === 'phone' || prop === 'rig') {
      const steps = STEP_PARTS[prop].length;
      pose.explode[prop] = seg(u, 0.36, prop === 'phone' ? 0.6 : 0.54) * (1 - seg(u, 0.86, 0.95));
      const s0 = 0.42, s1 = 0.86;
      let nn = 0;
      if (u >= s0 && u < s1) {
        nn = Math.min(steps, 1 + Math.floor(((u - s0) / (s1 - s0)) * steps));
        pose.step = { n: nn, of: steps };
        pose.highlight = { prop, parts: STEP_PARTS[prop][nn - 1] };
      }
      if (pose.explode[prop] > 0.45) {
        if (prop === 'rig') pose.labels = nn ? ASSEMBLY_LABELS.rig[nn - 1] : [];
        else pose.labels = ASSEMBLY_LABELS[prop];
      }
    } else if (prop === 'drawers') {
      pose.explode.drawers = 0.42 * seg(u, 0.32, 0.55) * (1 - seg(u, 0.88, 0.97)) + (i > 3 ? 0.06 : 0);
      pose.lift.drawers = 0;
      if (u > 0.46 && u < 0.92) pose.labels = ASSEMBLY_LABELS.drawers;
    } else if (prop === 'airlock') {
      pose.explode.airlock = seg(u, 0.36, 0.56) * (1 - seg(u, 0.88, 0.96));
      if (pose.explode.airlock > 0.45) pose.labels = ASSEMBLY_LABELS.airlock;
    } else if (prop === 'zen') {
      // It is lit, it is lifted a hair, and it stays shut.
      pose.lift.zen = Math.sin(Math.PI * clamp01((u - 0.62) / 0.22)) * (u > 0.62 && u < 0.84 ? 1 : 0);
      if (u > 0.36 && u < 0.94) pose.labels = ['zen:tag'];
    }
  }

  if (beat.id === 'next' && u > 0.5) pose.labels = ['pin:letter'];
  return pose;
}

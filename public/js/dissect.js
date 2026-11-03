// dissect.js: the "lift and explode" mechanic for R3, Bench & Thread.
//
// One data model describes every object on the bench as named parts built from bevelled boxes,
// cylinders and tori. The same model drives two renderers:
//   - three.js (the live ink diorama on the home page), and
//   - SVG (the instruction-manual plates: case pages, work drawers, reduced-motion stills).
//
// API
//   createDissection(id, { three: THREE, material, RoundedBox })  -> live 3D object
//   createDissection(id, { svg: true, accent, ... })               -> SVG plate
// Both return { id, parts, explodeVectors, setExplode(p), anchors(...), p }.
//   parts           [{ id, step, label, explode:[x,y,z] }] (named parts)
//   explodeVectors  { partId: [x,y,z] }
//   setExplode(p)   p = 0 (assembled) ... 1 (exploded). Each part moves inside its own window.
//   anchors()       DOM label anchor points, in CSS px relative to the canvas / SVG box.
// The SVG plate also has setHighlight(ids) for the case-page dissections.

const D2R = Math.PI / 180;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Albedo per tone for the live renderer. Outside the lamp's pool the shader turns these into paper
// and ink; inside it the true colours come through, softly.
export const TONES = {
  paper: '#F4F1EA', bone: '#E4DED2', light: '#D2CCC0', mid: '#A29B8F', steel: '#AEB3B8',
  dark: '#3A3835', ink: '#22201D', screen: '#2A2F36', warm: '#EDA868', blue: '#3B5BFF',
  wood: '#DCCDB4', note: '#F1D36A', lilac: '#9A6FD0', teal: '#1F9E8F', magenta: '#E0457B',
  apricot: '#F59E4A',
};

// Print fills for the SVG plates: [lit, mid, shade].
const SVGT = {
  paper: ['#FDFCF9', '#F1EEE7', '#E3DFD6'],
  bone: ['#F5F2EB', '#E7E2D8', '#D7D1C5'],
  light: ['#EAE6DE', '#DAD5CB', '#C9C3B8'],
  mid: ['#D3CEC5', '#BEB8AD', '#A8A196'],
  steel: ['#E1E4E7', '#CBCFD3', '#B3B8BD'],
  dark: ['#5A5753', '#46433F', '#36332F'],
  ink: ['#3B3834', '#2C2926', '#1E1C1A'],
  screen: ['#4A5260', '#3A414D', '#2C323B'],
  warm: ['#FBE9D6', '#F5D9BC', '#ECC6A0'],
  apricot: ['#FCE5CC', '#F8D3AC', '#F0BE8A'],
  blue: ['#E3E8FF', '#CED7FF', '#B8C5FF'],
  wood: ['#F0E7D9', '#E5D9C5', '#D8C9B0'],
  note: ['#FAF0C8', '#F3E4A8', '#E9D68B'],
  lilac: ['#EFE7FA', '#E0D3F4', '#CFBDEB'],
  teal: ['#DDF1EE', '#C4E6E1', '#A9D8D1'],
  magenta: ['#FBE1EA', '#F6CAD9', '#EFB0C6'],
};

// Primitive helpers. Positions are the primitive's centre, in bench units, relative to the
// assembly origin (centre of its footprint, on the bench surface). `r` = bevel radius (3D only).
const B = (w, h, d, x, y, z, tone, o = {}) => ({ t: 'b', s: [w, h, d], p: [x, y, z], tone, ...o });
const C = (rt, rb, h, x, y, z, tone, o = {}) => ({ t: 'c', r: [rt, rb], h, p: [x, y, z], tone, ...o });
const T = (R, tube, x, y, z, tone, o = {}) => ({ t: 't', R, tube, p: [x, y, z], tone, ...o });

// ---------------------------------------------------------------------------------------------
// The assemblies. Every visual is an original, generic object (Illustrative).
// ---------------------------------------------------------------------------------------------
export const ASSEMBLIES = {
  // 2023 · BITS Pilani × Scaler: a textbook, a second book and a spiral notebook with a pencil.
  books: {
    title: 'Books and a notebook',
    parts: [
      {
        id: 'textbook', label: 'B.Sc. (Hons.) CS', explode: [0, 0, 0], win: [0, 1],
        anchor: [-0.3, 0.1, 0.46], co: [-110, 40],
        prims: [
          B(1.24, 0.026, 0.92, 0, 0.013, 0, 'mid', { r: 0.009 }),
          B(1.16, 0.13, 0.86, 0.03, 0.091, 0, 'paper', { r: 0.004 }),
          B(1.24, 0.026, 0.92, 0, 0.169, 0, 'mid', { r: 0.009 }),
          B(0.05, 0.182, 0.92, -0.6, 0.091, 0, 'mid', { r: 0.02 }),
          B(0.054, 0.012, 0.92, -0.6, 0.13, 0, 'ink'),
          B(0.054, 0.012, 0.92, -0.6, 0.05, 0, 'ink'),
        ],
      },
      {
        id: 'second', label: 'Second book', explode: [0.0, 0.45, 0.05], win: [0.05, 0.6],
        anchor: [0.3, 0.26, 0.4], co: [90, 30],
        prims: [
          B(1.0, 0.022, 0.74, 0.06, 0.193, 0.04, 'bone', { r: 0.008 }),
          B(0.94, 0.1, 0.7, 0.08, 0.254, 0.04, 'paper', { r: 0.004 }),
          B(1.0, 0.022, 0.74, 0.06, 0.315, 0.04, 'bone', { r: 0.008 }),
          B(0.04, 0.144, 0.74, -0.42, 0.254, 0.04, 'bone', { r: 0.016 }),
          B(0.3, 0.004, 0.18, 0.2, 0.328, 0.1, 'light'),
        ],
      },
      {
        id: 'notebook', step: 1, label: 'BITS Pilani × Scaler', explode: [0.1, 1.05, 0.2], win: [0.12, 0.72],
        anchor: [0.1, 0.36, 0.0], co: [-120, -50],
        prims: [
          B(0.82, 0.03, 0.6, 0.12, 0.343, 0.06, 'paper', { r: 0.01, marks: 5 }),
          B(0.82, 0.006, 0.6, 0.12, 0.326, 0.06, 'light'),
          ...Array.from({ length: 7 }, (_, i) => T(0.034, 0.0055, -0.29, 0.345, 0.06 + (i - 3) * 0.075, 'steel')),
        ],
      },
      {
        id: 'pencil', step: 2, label: 'Pencil', explode: [0.25, 1.4, 0.45], win: [0.2, 0.8],
        anchor: [0.3, 0.39, 0.38], co: [100, -30],
        prims: [
          C(0.022, 0.022, 0.62, 0.12, 0.385, 0.38, 'note', { rot: [0, 0, 90], seg: 6 }),
          C(0.022, 0.0, 0.09, 0.475, 0.385, 0.38, 'wood', { rot: [0, 0, -90], seg: 6 }),
          C(0.023, 0.023, 0.05, -0.215, 0.385, 0.38, 'steel', { rot: [0, 0, 90], seg: 12 }),
          C(0.022, 0.022, 0.05, -0.26, 0.385, 0.38, 'magenta', { rot: [0, 0, 90], seg: 12 }),
        ],
      },
    ],
  },

  // 2026 · CareLine: a phone, with tracing-paper layers that rise out of the screen.
  phone: {
    title: 'Phone',
    parts: [
      {
        id: 'handset', label: 'Handset', explode: [0, 0, 0], win: [0, 1], anchor: [0.3, 0.07, 0.4], co: [60, 40],
        prims: [
          B(0.66, 0.07, 1.3, 0, 0.035, 0, 'dark', { r: 0.03 }),
          B(0.6, 0.006, 1.22, 0, 0.071, 0, 'screen', { z: 0.01 }),
          B(0.12, 0.004, 0.02, 0, 0.076, -0.56, 'ink', { z: 0.02 }),
          B(0.014, 0.026, 0.12, 0.334, 0.04, -0.28, 'dark', { r: 0.006 }),
          B(0.014, 0.026, 0.2, 0.334, 0.04, -0.04, 'dark', { r: 0.006 }),
          C(0.085, 0.085, 0.004, 0, 0.076, -0.3, 'mid', { z: 0.03 }),
          ...Array.from({ length: 7 }, (_, i) => B(0.024, 0.004, 0.05 + ((i * 37) % 5) * 0.035, -0.14 + i * 0.047, 0.076, 0.04, 'teal', { z: 0.03 })),
          C(0.055, 0.055, 0.004, -0.13, 0.076, 0.42, 'mid', { z: 0.03 }),
          C(0.055, 0.055, 0.004, 0.13, 0.076, 0.42, 'teal', { z: 0.03 }),
        ],
      },
      {
        id: 'record', step: 1, label: 'The record', explode: [0, 0.75, 0], win: [0.0, 0.38], emerge: true,
        anchor: [-0.47, 0.09, 0.2], co: [-120, 10],
        prims: [B(0.96, 0.014, 1.34, 0, 0.09, 0, 'paper', { marks: 7 })],
      },
      {
        id: 'question', step: 2, label: 'The question', explode: [0.12, 1.5, -0.08], win: [0.24, 0.62], emerge: true,
        anchor: [0.4, 0.09, 0.0], co: [120, -6],
        prims: [B(0.8, 0.014, 0.62, 0, 0.09, 0, 'paper', { marks: 3 })],
      },
      {
        id: 'answer', step: 3, label: 'Answer', explode: [-0.62, 2.3, 0.32], win: [0.48, 0.86], emerge: true,
        anchor: [-0.2, 0.09, 0.2], co: [-80, -40],
        prims: [B(0.44, 0.014, 0.44, 0, 0.09, 0, 'paper', { marks: 2 })],
      },
      {
        id: 'ask', label: 'Ask', explode: [0.0, 2.3, 0.32], win: [0.52, 0.9], emerge: true,
        anchor: [0, 0.09, -0.2], co: [0, -70],
        prims: [B(0.44, 0.014, 0.44, 0, 0.09, 0, 'paper', { marks: 2 })],
      },
      {
        id: 'handoff', label: 'Hand off', explode: [0.62, 2.3, 0.32], win: [0.56, 0.94], emerge: true,
        anchor: [0.2, 0.09, 0.0], co: [90, -30],
        prims: [B(0.44, 0.014, 0.44, 0, 0.09, 0, 'teal', { marks: 2 })],
      },
    ],
  },

  // 2026– · Zen Technologies: a sealed hard case. It never comes apart.
  zen: {
    title: 'Locked case',
    parts: [
      {
        id: 'case', label: 'Sealed', explode: [0, 0, 0], win: [0, 1], anchor: [0.42, 0.74, 0.2], co: [80, -60],
        prims: [
          ...[[-0.66, -0.4], [0.66, -0.4], [-0.66, 0.4], [0.66, 0.4]].map(([x, z]) => C(0.05, 0.05, 0.03, x, 0.015, z, 'ink')),
          B(1.6, 0.48, 1.04, 0, 0.27, 0, 'dark', { r: 0.07 }),
          B(1.62, 0.032, 1.06, 0, 0.52, 0, 'ink', { r: 0.014 }),
          B(1.6, 0.2, 1.04, 0, 0.635, 0, 'dark', { r: 0.07 }),
          ...[-0.3, 0, 0.3].map((z) => B(1.3, 0.03, 0.08, 0, 0.746, z, 'ink', { r: 0.014 })),
          B(0.18, 0.22, 0.06, -0.45, 0.5, 0.54, 'steel', { r: 0.02, z: 0.2 }),
          B(0.18, 0.22, 0.06, 0.45, 0.5, 0.54, 'steel', { r: 0.02, z: 0.2 }),
          B(0.12, 0.05, 0.03, -0.45, 0.59, 0.578, 'mid', { r: 0.012, z: 0.22 }),
          B(0.12, 0.05, 0.03, 0.45, 0.59, 0.578, 'mid', { r: 0.012, z: 0.22 }),
          B(0.08, 0.06, 0.1, -0.28, 0.78, 0.0, 'ink', { r: 0.02, z: 0.1 }),
          B(0.08, 0.06, 0.1, 0.28, 0.78, 0.0, 'ink', { r: 0.02, z: 0.1 }),
          B(0.64, 0.05, 0.08, 0, 0.835, 0.0, 'ink', { r: 0.024, z: 0.12 }),
          B(0.16, 0.15, 0.07, 0, 0.36, 0.565, 'steel', { r: 0.025, z: 0.3 }),
          T(0.05, 0.012, 0, 0.44, 0.565, 'steel', { arc: Math.PI, z: 0.31 }),
          B(0.34, 0.012, 0.22, 0.42, 0.745, 0.2, 'paper', { rot: [0, 18, 0], z: 0.4, marks: 2 }),
        ],
      },
    ],
  },

  // 2026 · MCPArena: a test rig with a rack of tool cartridges, some of which lie.
  rig: {
    title: 'Test rig',
    parts: [
      {
        id: 'bed', label: 'Test bed', explode: [0, 0, 0], win: [0, 1], anchor: [-0.5, 0.36, 0.45], co: [-90, 40],
        prims: [
          ...[[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]].map(([x, z]) => C(0.04, 0.05, 0.025, x, 0.012, z, 'ink')),
          B(1.8, 0.07, 1.2, 0, 0.06, 0, 'bone', { r: 0.03 }),
          B(1.6, 0.16, 0.4, 0, 0.175, -0.2, 'dark', { r: 0.03 }),
          B(0.08, 0.2, 0.06, -0.5, 0.19, 0.33, 'dark', { r: 0.02 }),
          B(0.58, 0.36, 0.05, -0.5, 0.44, 0.36, 'dark', { r: 0.02, rot: [-12, 0, 0] }),
          B(0.5, 0.28, 0.01, -0.5, 0.44, 0.39, 'screen', { rot: [-12, 0, 0], z: 0.05 }),
          ...[0.34, 0.2, 0.28, 0.12].map((h, i) => B(0.06, h * 0.6, 0.006, -0.66 + i * 0.1, 0.36 + h * 0.3, 0.405, i === 1 ? 'blue' : 'light', { rot: [-12, 0, 0], z: 0.07 })),
          C(0.035, 0.035, 0.62, 0.75, 0.4, 0.35, 'steel'),
          B(0.5, 0.04, 0.04, 0.53, 0.69, 0.35, 'steel', { r: 0.015 }),
          C(0.015, 0.004, 0.16, 0.3, 0.61, 0.35, 'ink'),
        ],
      },
      ...[
        ['t1', 'paper', 'Honest tool', 'light'], ['t2', 'mid', 'Docstring that lies', 'warm'], ['t3', 'paper', 'Honest tool', 'light'],
        ['t4', 'dark', 'leak_* sink', 'magenta'], ['t5', 'paper', 'Honest tool', 'light'], ['t6', 'blue', 'The right tool', 'blue'],
        ['t7', 'light', 'Return with an injected instruction', 'warm'],
      ].map(([id, tone, label, led], i) => ({
        id, label, call: { t1: 'a', t2: 'b', t7: 'c', t4: 'd', t6: 'e' }[id], explode: [(i - 3) * 0.16, 0.62 + (i % 2) * 0.22, 0.12], win: [0.06 * i, 0.06 * i + 0.58],
        anchor: [-0.6 + i * 0.2, 0.62, -0.2], co: [[-70, -60], [-40, -78], [0, 0], [-10, -86], [0, 0], [40, -80], [70, -58]][i],
        prims: [
          B(0.15, 0.36, 0.26, -0.6 + i * 0.2, 0.43, -0.2, tone, { r: 0.024 }),
          B(0.16, 0.03, 0.27, -0.6 + i * 0.2, 0.585, -0.2, 'mid', { r: 0.012 }),
          B(0.06, 0.022, 0.012, -0.6 + i * 0.2, 0.5, -0.066, led, { z: 0.05 }),
        ],
      })),
      {
        // the small model that learns to pick: a 1.5B module under the probe
        id: 'agent', call: 'm', label: 'A 1.5B model', explode: [0, 0.75, 0.25], win: [0.3, 0.9],
        anchor: [0.25, 0.17, 0.32], co: [80, -36],
        prims: [
          B(0.36, 0.05, 0.26, 0.25, 0.12, 0.32, 'dark', { r: 0.015 }),
          B(0.2, 0.012, 0.12, 0.25, 0.151, 0.32, 'blue', { z: 0.02 }),
          ...[-0.12, -0.04, 0.04, 0.12].map((dx) => B(0.03, 0.03, 0.02, 0.25 + dx, 0.1, 0.46, 'steel', { z: 0.03 })),
        ],
      },
    ],
  },

  // 2026 · maestro: an airlock canister. A small filter sits between localhost and the cloud.
  airlock: {
    title: 'Airlock',
    parts: [
      {
        id: 'canister', label: 'airlock, on localhost', explode: [0, 0, 0], win: [0, 1], anchor: [-0.62, 0.36, 0], co: [-90, 30],
        prims: [
          C(0.48, 0.5, 0.1, 0, 0.05, 0, 'dark'),
          C(0.4, 0.4, 0.86, 0, 0.53, 0, 'bone'),
          C(0.414, 0.414, 0.04, 0, 0.3, 0, 'mid', { z: 0.01 }),
          C(0.414, 0.414, 0.04, 0, 0.78, 0, 'mid', { z: 0.01 }),
          B(0.12, 0.34, 0.02, 0.0, 0.54, 0.4, 'screen', { r: 0.008, z: 0.3 }),
          B(0.34, 0.14, 0.14, -0.55, 0.36, 0, 'steel', { r: 0.04 }),
          B(0.04, 0.22, 0.22, -0.72, 0.36, 0, 'mid', { r: 0.016 }),
          B(0.34, 0.14, 0.14, 0.55, 0.76, 0, 'steel', { r: 0.04, z: 0.2 }),
          B(0.04, 0.22, 0.22, 0.72, 0.76, 0, 'mid', { r: 0.016, z: 0.21 }),
        ],
      },
      {
        id: 'filter', step: 1, label: 'Fine-tuned 1.5B', explode: [0, 0.95, 0], win: [0.18, 0.7],
        anchor: [0.32, 0.9, 0.1], co: [100, -10],
        prims: [
          C(0.32, 0.32, 0.36, 0, 0.8, 0, 'light'),
          C(0.335, 0.335, 0.03, 0, 0.68, 0, 'mid', { z: 0.01 }),
          C(0.335, 0.335, 0.03, 0, 0.8, 0, 'blue', { z: 0.02 }),
          C(0.335, 0.335, 0.03, 0, 0.92, 0, 'mid', { z: 0.03 }),
        ],
      },
      {
        id: 'lid', step: 2, label: 'Lid', explode: [0, 1.85, 0], win: [0.0, 0.55],
        anchor: [0.1, 1.17, 0], co: [-100, -30],
        prims: [
          C(0.43, 0.43, 0.1, 0, 1.01, 0, 'dark'),
          C(0.1, 0.12, 0.08, 0, 1.1, 0, 'steel'),
          B(0.3, 0.04, 0.05, 0, 1.16, 0, 'ink', { r: 0.02 }),
        ],
      },
    ],
  },

  // The index: a parts cabinet with a drawer per project. Its 2025 row holds the side projects.
  drawers: {
    title: 'Drawers',
    parts: [
      {
        id: 'cabinet', label: 'Cabinet', explode: [0, 0, 0], win: [0, 1], anchor: [0.75, 1.0, 0], co: [60, 0],
        prims: [
          B(1.5, 0.05, 0.86, 0, 0.025, 0, 'dark', { r: 0.02 }),
          B(1.56, 1.98, 0.92, 0, 1.04, 0, 'light', { r: 0.05 }),
          B(1.64, 0.06, 1.0, 0, 2.06, 0, 'mid', { r: 0.025 }),
        ],
      },
      ...Array.from({ length: 12 }, (_, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = -0.48 + col * 0.48, y = 1.72 - row * 0.46;
        const y25 = i >= 7 && i <= 10;
        return {
          id: `d${i + 1}`, label: i < 11 ? (i < 9 ? `F/0${i + 1}` : `${i + 1}`) : '',
          explode: [0, 0, y25 ? 0.5 : 0.32 + (i % 2) * 0.12],
          win: y25 ? [(i - 7) * 0.05, (i - 7) * 0.05 + 0.32] : [0.45 + (i % 7) * 0.03, 0.75 + (i % 7) * 0.035],
          anchor: [x, y + 0.08, 0.52], co: [0, -30],
          prims: [
            B(0.4, 0.36, 0.6, x, y, 0.15, 'bone'),
            B(0.44, 0.4, 0.05, x, y, 0.47, 'paper', { r: 0.02, z: 0.1 }),
            B(0.24, 0.1, 0.012, x, y + 0.08, 0.5, 'steel', { r: 0.006, z: 0.12 }),
            B(0.2, 0.07, 0.008, x, y + 0.08, 0.508, [0, 1, 4].includes(i) ? 'blue' : y25 ? 'lilac' : 'bone', { z: 0.13 }),
            B(0.15, 0.036, 0.045, x, y - 0.08, 0.51, 'dark', { r: 0.016, z: 0.12 }),
          ],
        };
      }),
    ],
  },

  // --- small plates for the work drawers (SVG only) -------------------------------------------
  // 2026 · PromptGuard: a system prompt card under a defence layer, with attacks lifted off it.
  promptguard: {
    title: 'Prompt and shield',
    parts: [
      { id: 'prompt', step: 1, label: 'System prompt', explode: [0, 0, 0], win: [0, 1], anchor: [-0.4, 0.03, 0.3], co: [-70, 30],
        prims: [B(1.1, 0.03, 0.76, 0, 0.015, 0, 'paper', { marks: 5 })] },
      { id: 'shield', step: 2, label: 'Defence', explode: [0, 0.42, 0], win: [0.05, 0.6], anchor: [0.5, 0.08, -0.2], co: [70, -30],
        prims: [B(1.14, 0.04, 0.8, 0, 0.07, 0, 'blue'), B(0.9, 0.006, 0.56, 0, 0.093, 0, 'paper')] },
      ...[[-0.3, 'magenta'], [0.05, 'dark'], [0.36, 'warm']].map(([x, tone], i) => ({
        id: `a${i + 1}`, step: i === 0 ? 3 : null, label: 'Attack', explode: [x * 0.6, 1.0 + i * 0.12, 0.1], win: [0.2 + i * 0.08, 0.8 + i * 0.06],
        anchor: [x, 0.28, 0], co: [-60, -40],
        prims: [B(0.2, 0.2, 0.2, x, 0.22, 0.0, tone)],
      })),
    ],
  },
  // 2025 · AudioBookAI: a novel, with one voice per character lifted out of it.
  audiobookai: {
    title: 'Book and voices',
    parts: [
      { id: 'book', step: 1, label: 'The novel', explode: [0, 0, 0], win: [0, 1], anchor: [-0.4, 0.12, 0.3], co: [-80, 30],
        prims: [B(1.0, 0.03, 0.7, 0, 0.015, 0, 'mid'), B(0.94, 0.14, 0.66, 0.02, 0.1, 0, 'paper'), B(1.0, 0.03, 0.7, 0, 0.185, 0, 'mid'), B(0.05, 0.2, 0.7, -0.49, 0.1, 0, 'mid')] },
      ...[[-0.28, 'lilac'], [0.02, 'warm'], [0.32, 'teal']].map(([x, tone], i) => ({
        id: `v${i + 1}`, step: i + 2, label: 'Voice', explode: [x * 0.4, 0.55 + i * 0.25, 0.05], win: [0.1 + i * 0.1, 0.7 + i * 0.1],
        anchor: [x, 0.28, 0.1], co: [60 - i * 40, -50],
        prims: [C(0.13, 0.13, 0.06, x, 0.24, 0.05, tone), C(0.05, 0.05, 0.065, x, 0.245, 0.05, 'paper', { z: 0.01 })],
      })),
    ],
  },
  // 2025 · ForkFinder: repo cards fanned out under a lens.
  forkfinder: {
    title: 'Cards and a lens',
    parts: [
      ...[0, 1, 2, 3].map((i) => ({
        id: `r${i + 1}`, step: i === 0 ? 1 : null, label: 'Repo', explode: [(i - 1.5) * 0.36, -0.0, (i % 2) * 0.12], rot: [0, (i - 1.5) * 10, 0], win: [0, 0.6],
        anchor: [-0.2, 0.02 + i * 0.016, 0.15], co: [-80, 30],
        prims: [B(0.62, 0.014, 0.42, 0, 0.008 + i * 0.016, 0, i === 2 ? 'blue' : 'paper', { marks: 3 })],
      })),
      { id: 'lens', step: 2, label: 'Lens', explode: [0.15, 0.9, 0.1], win: [0.15, 0.85], anchor: [0.2, 0.2, 0], co: [80, -40],
        prims: [C(0.26, 0.26, 0.04, 0.1, 0.14, 0.0, 'light'), C(0.21, 0.21, 0.045, 0.1, 0.14, 0, 'steel', { z: 0.01 }), B(0.42, 0.05, 0.08, 0.5, 0.14, 0.24, 'ink', { rot: [0, -35, 0] })] },
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------
function partProgress(part, p) {
  const [a, b] = part.win;
  return easeInOut(clamp01((p - a) / Math.max(1e-6, b - a)));
}

function publicParts(def) {
  return def.parts.map((pt) => ({ id: pt.id, step: pt.step || null, label: pt.label, explode: pt.explode.slice() }));
}

export function createDissection(id, opts = {}) {
  const def = ASSEMBLIES[id];
  if (!def) throw new Error(`dissect: unknown assembly "${id}"`);
  return opts.three ? buildThree(id, def, opts) : buildSVG(id, def, opts);
}

// ---------------------------------------------------------------------------------------------
// three.js renderer
// ---------------------------------------------------------------------------------------------
function buildThree(id, def, { three: THREE, material, RoundedBox }) {
  const root = new THREE.Group();
  root.name = id;
  const geoCache = new Map();
  const geo = (pr) => {
    let key;
    if (pr.t === 'b') key = `b${pr.s.join(',')}|${pr.r || 0}`;
    else if (pr.t === 'c') key = `c${pr.r.join(',')},${pr.h},${pr.seg || 32}`;
    else key = `t${pr.R},${pr.tube},${pr.arc || 6.2832}`;
    if (!geoCache.has(key)) {
      let g;
      if (pr.t === 'b') {
        const r = Math.min(pr.r || 0, Math.min(...pr.s) / 2 - 1e-4);
        g = RoundedBox && r > 0.003 ? new RoundedBox(pr.s[0], pr.s[1], pr.s[2], r > 0.03 ? 3 : 2, r) : new THREE.BoxGeometry(...pr.s);
      } else if (pr.t === 'c') {
        g = new THREE.CylinderGeometry(pr.r[0], pr.r[1], pr.h, pr.seg || 32);
      } else {
        g = new THREE.TorusGeometry(pr.R, pr.tube, 8, 28, pr.arc || Math.PI * 2);
      }
      geoCache.set(key, g);
    }
    return geoCache.get(key);
  };

  const parts = def.parts.map((pd) => {
    const g = new THREE.Group();
    g.name = `${id}:${pd.id}`;
    for (const pr of pd.prims) {
      const m = new THREE.Mesh(geo(pr), material(pr.tone, { assembly: id, part: pd.id, marks: pr.marks || 0 }));
      m.position.set(...pr.p);
      if (pr.rot) m.rotation.set(pr.rot[0] * D2R, pr.rot[1] * D2R, pr.rot[2] * D2R);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.assembly = id;
      m.userData.part = pd.id;
      if (pr.marks && pr.t === 'b') {
        // ruled "text" lines on a sheet, children of the sheet so they follow it
        const [w, h, d] = pr.s;
        for (let k = 1; k <= pr.marks; k++) {
          const t = k / (pr.marks + 1);
          const len = k % 3 === 0 ? 0.55 : 0.8;
          const lw = w * (len - 0.15);
          const lm = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.004, Math.min(0.018, d * 0.03)), material('ink', { assembly: id, part: pd.id, mark: true }));
          lm.position.set(w * ((0.15 + len) / 2 - 0.5), h / 2 + 0.002, d * (t - 0.5));
          lm.userData.sameIdAsParent = true;
          lm.userData.assembly = id;
          lm.userData.part = pd.id;
          lm.castShadow = false;
          m.add(lm);
        }
      }
      g.add(m);
    }
    root.add(g);
    return { def: pd, group: g, e: 0 };
  });

  let current = 0;
  function setExplode(p) {
    current = clamp01(p);
    for (const pt of parts) {
      const e = partProgress(pt.def, current);
      pt.e = e;
      const [ex, ey, ez] = pt.def.explode;
      pt.group.position.set(ex * e, ey * e, ez * e);
      const r = pt.def.rot || [0, 0, 0];
      pt.group.rotation.set(r[0] * e * D2R, r[1] * e * D2R, r[2] * e * D2R);
      if (pt.def.emerge) {
        const s = 0.35 + 0.65 * e;
        pt.group.scale.set(s, 1, s);
        pt.group.visible = e > 0.01;
      }
    }
  }

  const v = new THREE.Vector3();
  // Anchor points for DOM labels: CSS px relative to the canvas.
  function anchors(camera, width, height) {
    root.updateMatrixWorld(true);
    return parts.map((pt) => {
      v.set(...pt.def.anchor).applyMatrix4(pt.group.matrixWorld);
      const world = v.clone();
      v.project(camera);
      return {
        id: pt.def.id, step: pt.def.step || null, label: pt.def.label, world,
        x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, visible: pt.group.visible, e: pt.e,
      };
    });
  }

  setExplode(0);
  return {
    id, group: root, parts: publicParts(def), meshParts: parts,
    explodeVectors: Object.fromEntries(def.parts.map((pd) => [pd.id, pd.explode.slice()])),
    setExplode, anchors, get p() { return current; },
  };
}

// ---------------------------------------------------------------------------------------------
// SVG renderer: true-ish isometric, painter's algorithm, print fills, ink strokes, accent callouts.
// ---------------------------------------------------------------------------------------------
const NS = 'http://www.w3.org/2000/svg';
const INK = '#1E1C1A';
let svgUid = 0;

function rotEuler(v, r) {
  // XYZ euler (degrees), same order as three.js default: applies Z, then Y, then X.
  let [x, y, z] = v;
  const [ax, ay, az] = r.map((d) => d * D2R);
  let c = Math.cos(az), s = Math.sin(az);
  [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(ay); s = Math.sin(ay);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(ax); s = Math.sin(ax);
  [y, z] = [y * c - z * s, y * s + z * c];
  return [x, y, z];
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const isVertical = (pr) => !pr.rot || (Math.abs(pr.rot[0]) < 1e-3 && Math.abs(pr.rot[2]) < 1e-3);

function buildSVG(id, def, opts) {
  const {
    az = 40, el = 30, scale = 64, pad = 28, dim = false, callouts = true,
    title = '', numbers = true, minHeight = 0, accent = '#2F5BEA',
  } = opts;
  let highlight = opts.highlight || null;
  const uid = `dx${++svgUid}`;
  const R = [Math.cos(az * D2R), 0, -Math.sin(az * D2R)];
  const U = [-Math.sin(az * D2R) * Math.sin(el * D2R), Math.cos(el * D2R), -Math.cos(az * D2R) * Math.sin(el * D2R)];
  const V = [Math.sin(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R), Math.cos(az * D2R) * Math.cos(el * D2R)];
  const LIGHT = (() => { const l = [-0.35, 0.85, 0.5]; const n = Math.hypot(...l); return l.map((c) => c / n); })();
  const proj = (p) => [dot(p, R) * scale, -dot(p, U) * scale];
  const f2 = (n) => n.toFixed(2);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'iso-plate');
  svg.setAttribute('role', 'img');
  if (title) svg.setAttribute('aria-label', title);
  svg.innerHTML = `
    <defs>
      <pattern id="${uid}-h" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="4" stroke="${INK}" stroke-width="0.8" stroke-opacity="0.42"/>
      </pattern>
      <pattern id="${uid}-hb" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="4" stroke="${accent}" stroke-width="0.8" stroke-opacity="0.5"/>
      </pattern>
    </defs>
    <g class="geo"></g><g class="callouts"></g>`;
  const gGeo = svg.querySelector('.geo');
  const gCall = svg.querySelector('.callouts');

  function partState(pd, p) {
    const e = partProgress(pd, p);
    const off = pd.explode.map((c) => c * e);
    const rot = (pd.rot || [0, 0, 0]).map((c) => c * e);
    const sc = pd.emerge ? 0.35 + 0.65 * e : 1;
    const visible = pd.emerge ? e > 0.01 : true;
    return { e, off, rot, sc, visible };
  }
  const xf = (pt, st, prim) => {
    // primitive-local point -> assembly space
    let q = pt;
    if (prim && prim.rot) q = rotEuler(q, prim.rot);
    if (prim) q = add(q, prim.p);
    q = [q[0] * st.sc, q[1], q[2] * st.sc];
    q = rotEuler(q, st.rot);
    return add(q, st.off);
  };
  const torusPts = (pr, st, n = 26) => {
    const arc = pr.arc || Math.PI * 2;
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * arc;
      out.push(xf([pr.R * Math.cos(a), pr.R * Math.sin(a), 0], st, pr));
    }
    return out;
  };

  function boxFaces(pr, st) {
    const [w, h, d] = pr.s.map((c) => c / 2);
    const corners = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push([sx * w, sy * h, sz * d]);
    const idx = (sx, sy, sz) => ((sx > 0 ? 4 : 0) + (sy > 0 ? 2 : 0) + (sz > 0 ? 1 : 0));
    const faces = [
      { n: [1, 0, 0], c: [idx(1, -1, -1), idx(1, 1, -1), idx(1, 1, 1), idx(1, -1, 1)] },
      { n: [-1, 0, 0], c: [idx(-1, -1, -1), idx(-1, -1, 1), idx(-1, 1, 1), idx(-1, 1, -1)] },
      { n: [0, 1, 0], c: [idx(-1, 1, -1), idx(-1, 1, 1), idx(1, 1, 1), idx(1, 1, -1)] },
      { n: [0, -1, 0], c: [idx(-1, -1, -1), idx(1, -1, -1), idx(1, -1, 1), idx(-1, -1, 1)] },
      { n: [0, 0, 1], c: [idx(-1, -1, 1), idx(1, -1, 1), idx(1, 1, 1), idx(-1, 1, 1)] },
      { n: [0, 0, -1], c: [idx(-1, -1, -1), idx(-1, 1, -1), idx(1, 1, -1), idx(1, -1, -1)] },
    ];
    const W = corners.map((c) => xf(c, st, pr));
    const out = [];
    for (const f of faces) {
      let n = pr.rot ? rotEuler(f.n, pr.rot) : f.n;
      n = rotEuler(n, st.rot);
      if (dot(n, V) <= 1e-3) continue;
      const pts = f.c.map((i) => W[i]);
      const lam = dot(n, LIGHT);
      out.push({ pts2: pts.map(proj), depth: dot(pts.reduce((a, b) => add(a, b), [0, 0, 0]).map((c) => c / 4), V), lam, top: n[1] > 0.7, pts3: pts });
    }
    out.sort((a, b) => a.depth - b.depth);
    return out;
  }

  const isHiPart = (pd) => !!highlight && (Array.isArray(highlight) ? highlight.includes(pd.id) : highlight === pd.id);
  // highlighted parts are printed in a tint of the chapter's accent
  const tint = (k) => {
    const h = accent.replace('#', '');
    const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return `#${c.map((v) => Math.round(255 + (v - 255) * k).toString(16).padStart(2, '0')).join('')}`;
  };
  const HI = [tint(0.12), tint(0.22), tint(0.34)];
  function fillFor(tone, lam, isHi) {
    const t = isHi ? HI : (SVGT[tone] || SVGT.paper);
    if (lam > 0.7) return { fill: t[0], hatch: false };
    if (lam > 0.2) return { fill: t[1], hatch: false };
    return { fill: t[2], hatch: true };
  }

  function draw(p) {
    const items = [];
    for (const pd of def.parts) {
      const st = partState(pd, p);
      if (!st.visible) continue;
      const isHi = isHiPart(pd);
      const faded = dim && highlight && !isHi;
      for (const pr of pd.prims) {
        if (pr.noSvg) continue;
        const centre = xf([0, 0, 0], st, pr);
        items.push({ pd, pr, st, isHi, faded, depth: dot(centre, V) + (pr.z || 0) });
      }
    }
    items.sort((a, b) => a.depth - b.depth);
    let html = '';
    const stroke = (it) => (it.isHi ? accent : INK);
    for (const it of items) {
      const { pr, st, isHi, faded } = it;
      const op = faded ? ' opacity="0.4"' : '';
      const sw = isHi ? 1.35 : 1;
      if (pr.t === 'b') {
        let g = '';
        for (const f of boxFaces(pr, st)) {
          const { fill, hatch } = fillFor(pr.tone, f.lam, isHi);
          const d = `M${f.pts2.map((q) => `${f2(q[0])},${f2(q[1])}`).join('L')}Z`;
          g += `<path d="${d}" fill="${fill}" stroke="${stroke(it)}" stroke-width="${sw}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
          if (hatch) g += `<path d="${d}" fill="url(#${uid}-${isHi ? 'hb' : 'h'})" stroke="none"/>`;
          if (pr.marks && f.top) {
            const [a, b, c, dd] = f.pts3;
            for (let k = 1; k <= pr.marks; k++) {
              const tt = k / (pr.marks + 1);
              const s0 = add(a.map((v0) => v0 * (1 - tt)), b.map((v0) => v0 * tt));
              const s1 = add(dd.map((v0) => v0 * (1 - tt)), c.map((v0) => v0 * tt));
              const m0 = add(s0.map((v0) => v0 * 0.85), s1.map((v0) => v0 * 0.15));
              const len = k % 3 === 0 ? 0.55 : 0.8;
              const m1 = add(s0.map((v0) => v0 * (1 - len)), s1.map((v0) => v0 * len));
              const p0 = proj(m0), p1 = proj(m1);
              g += `<path d="M${f2(p0[0])},${f2(p0[1])}L${f2(p1[0])},${f2(p1[1])}" stroke="${isHi ? accent : INK}" stroke-opacity="0.42" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`;
            }
          }
        }
        html += `<g${op}>${g}</g>`;
      } else if (pr.t === 't') {
        const pts = torusPts(pr, st).map(proj);
        const d = `M${pts.map((q) => `${f2(q[0])},${f2(q[1])}`).join('L')}`;
        const w = Math.max(1.4, pr.tube * 2 * scale);
        const { fill } = fillFor(pr.tone, 0.8, isHi);
        html += `<g${op}><path d="${d}" fill="none" stroke="${stroke(it)}" stroke-width="${f2(w + 2)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${f2(w)}" stroke-linecap="round"/></g>`;
      } else if (!isVertical(pr)) {
        // a lying cylinder (pencil, pipe): a capsule along its projected axis
        const a = proj(xf([0, pr.h / 2, 0], st, pr));
        const b = proj(xf([0, -pr.h / 2, 0], st, pr));
        const w = Math.max(1.4, Math.max(...pr.r) * 2 * scale);
        const { fill } = fillFor(pr.tone, 0.8, isHi);
        const d = `M${f2(a[0])},${f2(a[1])}L${f2(b[0])},${f2(b[1])}`;
        html += `<g${op}><path d="${d}" stroke="${stroke(it)}" stroke-width="${f2(w + 2)}" stroke-linecap="butt"/><path d="${d}" stroke="${fill}" stroke-width="${f2(w)}" stroke-linecap="butt"/></g>`;
      } else {
        // vertical cylinder (or cone)
        const top = proj(xf([0, pr.h / 2, 0], st, pr));
        const bot = proj(xf([0, -pr.h / 2, 0], st, pr));
        const rt = pr.r[0] * scale * st.sc, rb = pr.r[1] * scale * st.sc;
        const s = Math.sin(el * D2R);
        const { fill } = fillFor(pr.tone, 0.5, isHi);
        const lit = fillFor(pr.tone, 0.9, isHi).fill;
        const sh = fillFor(pr.tone, 0, isHi).fill;
        const gid = `${uid}-g${Math.random().toString(36).slice(2, 7)}`;
        const body = `M${f2(top[0] - rt)},${f2(top[1])}L${f2(bot[0] - rb)},${f2(bot[1])}A${f2(rb)},${f2(rb * s)} 0 0 0 ${f2(bot[0] + rb)},${f2(bot[1])}L${f2(top[0] + rt)},${f2(top[1])}A${f2(rt)},${f2(rt * s)} 0 0 1 ${f2(top[0] - rt)},${f2(top[1])}Z`;
        html += `<g${op}><linearGradient id="${gid}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${fill}"/><stop offset="0.35" stop-color="${lit}"/><stop offset="1" stop-color="${sh}"/></linearGradient>`
          + `<path d="${body}" fill="url(#${gid})" stroke="${stroke(it)}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/>`
          + (rt > 0.01 ? `<ellipse cx="${f2(top[0])}" cy="${f2(top[1])}" rx="${f2(rt)}" ry="${f2(rt * s)}" fill="${lit}" stroke="${stroke(it)}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/>` : '')
          + '</g>';
      }
    }
    gGeo.innerHTML = html;

    // callouts
    let ch = '';
    if (callouts) {
      for (const pd of def.parts) {
        if (!pd.step && !pd.call) continue;
        const st = partState(pd, p);
        if (!st.visible) continue;
        if (pd.call && p < 0.15) continue;
        if (pd.step && p < 0.02) continue;
        const a = proj(xf(pd.anchor, st, null));
        const [dx, dy] = pd.co || [40, -40];
        const cx = a[0] + dx, cy = a[1] + dy;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const isHi = isHiPart(pd);
        const fade = dim && highlight && !isHi ? ' opacity="0.4"' : '';
        ch += `<g class="co"${fade}><circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="2.6" fill="${accent}"/>`
          + `<path d="M${a[0].toFixed(1)},${a[1].toFixed(1)}L${(cx - ux * 11).toFixed(1)},${(cy - uy * 11).toFixed(1)}" stroke="${accent}" stroke-width="1" vector-effect="non-scaling-stroke"/>`
          + `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="11" fill="${isHi ? accent : '#FDFCF9'}" stroke="${accent}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`
          + (numbers ? `<text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" class="co-n" fill="${isHi ? '#FDFCF9' : accent}">${pd.step || pd.call}</text>` : '')
          + '</g>';
      }
    }
    gCall.innerHTML = ch;
  }

  // Fixed viewBox: union of the drawing at p = 0, 0.5 and 1, plus callout circles.
  function bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (q, r = 0) => { x0 = Math.min(x0, q[0] - r); y0 = Math.min(y0, q[1] - r); x1 = Math.max(x1, q[0] + r); y1 = Math.max(y1, q[1] + r); };
    for (const p of [0, 0.5, 1]) {
      for (const pd of def.parts) {
        const st = partState(pd, p);
        if (!st.visible) continue;
        for (const pr of pd.prims) {
          if (pr.noSvg) continue;
          if (pr.t === 'b') {
            const [w, h, d] = pr.s.map((c) => c / 2);
            for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) grow(proj(xf([sx * w, sy * h, sz * d], st, pr)));
          } else if (pr.t === 't') {
            for (const q of torusPts(pr, st, 12)) grow(proj(q), pr.tube * scale);
          } else {
            const r = Math.max(...pr.r) * scale;
            grow(proj(xf([0, pr.h / 2, 0], st, pr)), r);
            grow(proj(xf([0, -pr.h / 2, 0], st, pr)), r);
          }
        }
        if (callouts && (pd.step || pd.call) && p === 1) {
          const a = proj(xf(pd.anchor, st, null));
          grow([a[0] + pd.co[0], a[1] + pd.co[1]], 14);
        }
      }
    }
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: Math.max(minHeight, y1 - y0 + pad * 2) };
  }
  const bb = bounds();
  svg.setAttribute('viewBox', `${bb.x.toFixed(1)} ${bb.y.toFixed(1)} ${bb.w.toFixed(1)} ${bb.h.toFixed(1)}`);
  svg.dataset.aspect = (bb.w / bb.h).toFixed(4);

  let current = 0;
  function setExplode(p) { current = clamp01(p); draw(current); }
  function setHighlight(h) {
    const key = JSON.stringify(h || null);
    if (key === JSON.stringify(highlight || null)) return;
    highlight = h || null;
    draw(current);
  }

  // Anchor points in CSS px relative to the rendered SVG box.
  function anchors() {
    const rect = svg.getBoundingClientRect();
    const k = Math.min(rect.width / bb.w, rect.height / bb.h) || 1;
    const ox = (rect.width - bb.w * k) / 2, oy = (rect.height - bb.h * k) / 2;
    return def.parts.map((pd) => {
      const st = partState(pd, current);
      const a = proj(xf(pd.anchor, st, null));
      return { id: pd.id, step: pd.step || null, label: pd.label, x: ox + (a[0] - bb.x) * k, y: oy + (a[1] - bb.y) * k, visible: st.visible, e: st.e };
    });
  }

  setExplode(opts.p ?? 1);
  return {
    id, el: svg, parts: publicParts(def),
    explodeVectors: Object.fromEntries(def.parts.map((pd) => [pd.id, pd.explode.slice()])),
    setExplode, setHighlight, anchors, get p() { return current; },
  };
}

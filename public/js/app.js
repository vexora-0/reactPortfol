// app.js: routes, Quick view, the scroll scrub (native scroll, never intercepted), plates, drawers,
// case-page dissections, copy-to-clipboard and the contact note. The 3D bench and the Epicure
// teardown are loaded lazily, only when they are wanted.

import { BEATS, poseAt } from './timeline.js';
import { createDissection, easeInOut } from './dissect.js';

const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
const MOBILE = window.matchMedia('(max-width: 820px)');
const hasGL = !html.classList.contains('no-webgl');
const EMAIL = 'vexora.m04@gmail.com';
const SITE_DESC = 'Bhargav Munigonda — engineer in Bangalore building where AI meets hardware: robot fleets at Epicure Robotics, self-hosted LLMs in defense at Zen Technologies, and small models that run where the cloud can’t.';
const ACCENT = { start: '#5F656B', kiosk: '#A3550F', drawers: '#7046B0', rig: '#2E4BE6', phone: '#137A6E', airlock: '#B8285E', zen: '#3A3E44', next: '#855A0E' };

// ------------------------------------------------------------------ routes
const ROUTES = {
  '': { view: 'home', title: 'Bhargav Munigonda — Small models, real machines.', desc: SITE_DESC },
  work: { view: 'work', title: 'The drawers — Bhargav.M', desc: 'Everything, in one room: all eleven projects, from Epicure Robotics to Butter Money.' },
  'case-epicure': { view: 'case-epicure', title: 'Epicure Robotics · the teardown — Bhargav.M', desc: 'Robots that make and sell drinks on their own — two years as one of the two engineers behind them.' },
  'case-careline': { view: 'case-careline', title: 'CareLine — Bhargav.M', desc: 'A phone call from your doctor’s clinic, the day after — in your own language.' },
  'case-mcparena': { view: 'case-mcparena', title: 'MCPArena — Bhargav.M', desc: 'An RL environment that teaches small models to survive a hostile tool catalog.' },
  about: { view: 'about', title: 'At the bench — Bhargav.M', desc: SITE_DESC },
  contact: { view: 'contact', title: 'Contact — Bhargav.M', desc: 'Write on the tag: vexora.m04@gmail.com.' },
};
const NOT_FOUND = { view: '404', title: 'Part not found — Bhargav.M', desc: 'The page you wanted ran off without watching.' };

let currentView = null;
let homeScroll = 0;

function route() {
  const key = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const r = ROUTES[key] || NOT_FOUND;
  const prev = currentView;
  if (prev === 'home') homeScroll = window.scrollY;
  for (const v of $$('.view')) v.hidden = v.dataset.view !== r.view;
  currentView = r.view;
  document.title = r.title;
  const md = $('meta[name="description"]');
  if (md) md.setAttribute('content', r.desc);
  for (const a of $$('[data-nav]')) {
    if (a.dataset.nav === r.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  for (const a of $$('#views-menu a')) {
    const k = a.getAttribute('href').replace(/^#/, '');
    if ((ROUTES[k] ? ROUTES[k].view : '404') === r.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  closeViews();
  const viewEl = $(`.view[data-view="${r.view}"]`);
  ensurePlates(viewEl);
  if (prev !== null) {
    window.scrollTo(0, r.view === 'home' ? homeScroll : 0);
    const h1 = viewEl && viewEl.querySelector('h1');
    if (h1) h1.focus({ preventScroll: true });
  }
  if (scene) scene.setVisible(r.view === 'home' && liveAllowed());
  if (r.view === 'home') { measure(); onScroll(); }
  if (r.view === 'case-epicure') ensureTeardown(); else if (teardown) teardown.setVisible(false);
  initDsecs(viewEl);
  onDsecScroll();
}
window.addEventListener('hashchange', route);

// ------------------------------------------------------------------ modes
const qvBtn = $('.qv-toggle');
const isQuick = () => html.classList.contains('quick');
const liveAllowed = () => hasGL && !RM.matches && !isQuick() && !html.classList.contains('no-webgl');

function setMode() {
  const live = liveAllowed();
  html.classList.toggle('js-live', live);
  html.classList.toggle('stills', !isQuick() && !live);
  qvBtn.setAttribute('aria-pressed', String(isQuick()));
  if (live) scheduleScene();
  if (html.classList.contains('stills')) ensureStills();
  if (scene) scene.setVisible(live && currentView === 'home');
  measure();
  onScroll();
}

qvBtn.addEventListener('click', () => {
  const q = !isQuick();
  html.classList.toggle('quick', q);
  try { localStorage.setItem('r3-quick', q ? '1' : '0'); } catch (e) { /* storage may be blocked */ }
  setMode();
  toast(q ? 'Quick view on · the thread as a plain list, no 3D' : 'Quick view off · back to the bench');
  if (currentView === 'case-epicure') ensureTeardown();
});
RM.addEventListener && RM.addEventListener('change', setMode);

// ------------------------------------------------------------------ the 3D bench (lazy)
const stage = $('#stage');
let scene = null, sceneLoading = false, sceneQueued = false;

function scheduleScene() {
  if (scene || sceneLoading || sceneQueued) return;
  sceneQueued = true;
  const go = () => { sceneQueued = false; loadScene(); };
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 900 }); else setTimeout(go, 200);
}

async function loadScene() {
  if (scene || sceneLoading || !liveAllowed()) return;
  sceneLoading = true;
  try {
    const mod = await import('./scene.js');
    scene = await mod.createBench({
      stage, canvas: $('.bench-canvas'), labelLayer: $('.labels', stage), leaderSvg: $('.leaders', stage),
      mobile: MOBILE.matches,
      onPick: (prop) => gotoBeat(prop, 0.3),
      onFirstFrame: () => stage.classList.add('is-live'),
    });
    window.__wb.scene = scene;
    scene.setReduced(RM.matches);
    scene.setProgress(tAt(window.scrollY), true);
    scene.setVisible(currentView === 'home' && liveAllowed());
  } catch (err) {
    // No 3D here (blocked CDN, lost context...). Fall back to the drawn stills.
    console.warn('Bench: live bench unavailable, showing drawings.', err && err.message);
    html.classList.add('no-webgl');
    setMode();
  } finally {
    sceneLoading = false;
  }
}

// ------------------------------------------------------------------ scroll scrub (native scroll only)
const beatEls = BEATS.map((b) => document.getElementById(`beat-${b.id}`));
let starts = [], ends = [];
function measure() {
  if (currentView !== 'home') return;
  const vh = window.innerHeight;
  const y = window.scrollY;
  const tops = beatEls.map((el) => el.getBoundingClientRect().top + y);
  const hs = beatEls.map((el) => el.offsetHeight);
  const lead = MOBILE.matches ? 0.7 : 0.55;
  starts = tops.map((t, i) => (i === 0 ? 0 : Math.max(0, t - vh * lead)));
  // centre each narrating card in the space under the bar while it is stuck
  if (!MOBILE.matches) {
    const bar = parseFloat(getComputedStyle(html).getPropertyValue('--bar-h')) || 56;
    for (const el of beatEls) {
      const card = el.querySelector('.card');
      if (!card) continue;
      const top = Math.max(bar + 20, bar + (vh - bar - card.offsetHeight) / 2);
      card.style.setProperty('--card-top', `${Math.round(top)}px`);
    }
  }
  ends = starts.map((s, i) => (i < starts.length - 1 ? starts[i + 1] : Math.max(s + 1, tops[i] + hs[i] - vh)));
}
function tAt(y) {
  if (!starts.length) return 0;
  for (let i = starts.length - 1; i >= 0; i--) {
    if (y >= starts[i]) return Math.min(i + 0.9999, i + (y - starts[i]) / Math.max(1, ends[i] - starts[i]));
  }
  return 0;
}
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    if (currentView !== 'home') return;
    const t = tAt(window.scrollY);
    if (scene) scene.setProgress(t);
    updateDom(t);
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { measure(); onScroll(); }, { passive: true });

const railBtns = $$('.rail button');
const railLis = $$('.rail li');
const railFill = $('.rail-fill');
const plateEl = $('.plate', stage);
const capEl = $('.stage-cap', stage);
let lastBeat = -1;
function updateDom(t) {
  const pose = poseAt(t);
  stage.classList.toggle('past-hero', t > 0.3);
  if (pose.index !== lastBeat) {
    lastBeat = pose.index;
    const beat = BEATS[pose.index];
    railLis.forEach((li, i) => { li.classList.toggle('is-active', i === pose.index - 1); li.classList.toggle('is-past', i < pose.index - 1); });
    capEl.innerHTML = pose.index === 0
      ? '<span class="sc-fig">Fig. 0</span>The bench · Bangalore'
      : `<span class="sc-fig">${beat.year}</span>${beat.title}`;
  }
  // the rail fills like the thread does
  const k = Math.max(0, pose.index - 1 + (pose.index > 0 ? pose.travel : 0)) / (railLis.length - 1);
  if (railFill) railFill.style.transform = `scaleX(${Math.min(1, k).toFixed(4)})`;
  // step highlighting in the narrating card
  const live = html.classList.contains('js-live');
  for (const id of ['kiosk', 'rig', 'phone']) {
    const card = document.getElementById(`beat-${id}`);
    const lis = $$('.steps li', card);
    let n = 0;
    if (pose.beat === id && live) {
      if (pose.step) n = pose.step.n;
      else if (pose.u >= 0.86) n = lis.length;
    }
    lis.forEach((li) => li.classList.toggle('is-on', +li.dataset.step === n));
    const cnt = $('.steps-count', card);
    cnt.classList.toggle('is-on', n > 0);
    if (n) $('.js-stepn', card).textContent = `${id === 'phone' ? 'Layer' : 'Step'} ${n}`;
  }
  // stills mode (reduced motion / no WebGL): the stage shows a composed drawing per beat
  if (html.classList.contains('stills') && !MOBILE.matches) showStill(pose);
  // the lightbox plate frame around a lifted object
  const on = live && !!pose.plate;
  plateEl.classList.toggle('on', on);
  stage.classList.toggle('plate-on', on);
  if (on) {
    $('.plate-fig', plateEl).textContent = pose.plate.caption;
    $('.plate-step', plateEl).textContent = pose.step ? `${pose.beat === 'phone' ? 'Layer' : 'Step'} ${pose.step.n} of ${pose.step.of}` : '';
  }
}

const stillBox = $('.stage-still', stage);
const stillCache = {};
let stillShown = null;
const STILL_P = { zen: 0, drawers: 0.42 };
// The drink robot is one design everywhere: on the bench, in the teardown and in every still.
function robotStill(alt) {
  const img = new Image();
  img.src = 'assets/robot-poster.webp'; img.width = 900; img.height = 1129; img.alt = alt || 'The drink robot, its five layers pulled apart. Illustrative.';
  img.className = 'robot-still'; img.decoding = 'async';
  return img;
}
function showStill(pose) {
  const beat = BEATS[pose.index];
  const id = beat.prop || null;
  if (id === stillShown) return;
  stillShown = id;
  stillBox.textContent = '';
  stillBox.classList.toggle('on', !!id);
  if (!id) return;
  const p = STILL_P[id] ?? 1;
  if (!stillCache[id]) stillCache[id] = id === 'kiosk' ? robotStill() : svgPlate(id, { p, title: beat.title, accent: ACCENT[beat.id] }).el;
  stillBox.appendChild(stillCache[id]);
}

function gotoBeat(id, frac = 0) {
  const i = BEATS.findIndex((b) => b.id === id || b.prop === id || b.also === id);
  if (i < 0) return;
  measure();
  const y = i === 0 ? 0 : starts[i] + (ends[i] - starts[i]) * frac + 2;
  window.scrollTo({ top: y, behavior: RM.matches ? 'auto' : 'smooth' });
}
railBtns.forEach((b) => b.addEventListener('click', () => gotoBeat(b.dataset.goto, b.dataset.goto === 'next' ? 0.6 : 0.5)));

// ------------------------------------------------------------------ drawings: stills + plates
function svgPlate(id, { p = 1, hi = null, small = false, title = '', accent = '#2F5BEA' } = {}) {
  return createDissection(id, {
    svg: true, p, highlight: hi, dim: !!hi, title, scale: small ? 54 : 64, pad: small ? 18 : 26, accent,
  });
}
function ensureStills() {
  for (const fig of $$('figure.still[data-still]')) {
    if (fig.querySelector('svg')) continue;
    const id = fig.dataset.still;
    const p = fig.dataset.p !== undefined ? +fig.dataset.p : 1;
    const cap = fig.querySelector('figcaption');
    const beat = fig.closest('.beat');
    if (id === 'kiosk') { fig.insertBefore(robotStill(cap ? cap.textContent : ''), cap); continue; }
    const d = svgPlate(id, { p, title: cap ? cap.textContent : '', accent: beat ? ACCENT[beat.dataset.beat] : undefined });
    fig.insertBefore(d.el, cap);
  }
}
function ensurePlates(root) {
  if (!root) return;
  for (const box of $$('.plate-svg[data-plate]', root)) {
    if (box.firstChild) continue;
    const id = box.dataset.plate;
    const target = box.dataset.p !== undefined ? +box.dataset.p : 1;
    const hi = box.dataset.hi ? box.dataset.hi.split(',') : null;
    const small = !!box.dataset.small;
    const fig = box.closest('figure');
    const cap = fig && fig.querySelector('figcaption');
    const d = svgPlate(id, { p: target, hi, small, title: cap ? cap.textContent : `${id} drawing`, accent: box.dataset.accent || '#2F5BEA' });
    box.appendChild(d.el);
    const isHeader = !small && box.closest('.case-plate');
    if (isHeader && !RM.matches) {
      // The header assembles itself once, then settles to a still.
      const from = id === 'tickets' ? 1 : 0;
      d.setExplode(from);
      const t0 = performance.now() + 250, dur = 1500;
      const step = (now) => {
        const k = Math.min(1, Math.max(0, (now - t0) / dur));
        d.setExplode(from + (target - from) * easeInOut(k));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }
}

// ------------------------------------------------------------------ case dissections (CareLine, ChallengeMOB)
// A sticky instruction-manual plate beside numbered steps. Whichever step sits at the reading line
// sets the plate's highlight and explode amount; the plate eases there.
const dsecs = [];
function initDsecs(root) {
  if (!root) return;
  for (const sec of $$('.dsec[data-plate]', root)) {
    if (sec.__d) continue;
    const box = $('.dsec-plate', sec);
    const accent = sec.dataset.accent || '#2F5BEA';
    const cap = $('figcaption', sec);
    const steps = $$('.dsec-step', sec);
    const first = steps[0];
    const p0 = 0;
    const d = svgPlate(sec.dataset.plate, { p: p0, title: cap ? cap.textContent : '', accent });
    box.appendChild(d.el);
    sec.__d = { d, steps, cur: p0, target: p0, active: -1, accent, raf: 0 };
    dsecs.push(sec);
    if (first) first.classList.add('is-on');
  }
}
function onDsecScroll() {
  const line = window.innerHeight * 0.48;
  for (const sec of dsecs) {
    if (sec.closest('.view').hidden) continue;
    const st = sec.__d;
    let active = -1;
    st.steps.forEach((li, i) => { if (li.getBoundingClientRect().top < line) active = i; });
    const r = sec.getBoundingClientRect();
    if (active === -1 && r.top < window.innerHeight) active = -2; // approaching: assembled
    if (active !== st.active) {
      st.active = active;
      st.steps.forEach((li, i) => li.classList.toggle('is-on', i === Math.max(0, active)));
      const li = st.steps[Math.max(0, active)];
      st.d.setHighlight(active >= 0 && li.dataset.hi ? li.dataset.hi.split(',') : null);
      st.target = active >= 0 ? +li.dataset.p : 0;
      if (RM.matches) { st.cur = st.target; st.d.setExplode(st.cur); continue; }
      cancelAnimationFrame(st.raf);
      const from = st.cur, t0 = performance.now(), dur = 900;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        st.cur = from + (st.target - from) * easeInOut(k);
        st.d.setExplode(st.cur);
        if (k < 1) st.raf = requestAnimationFrame(step);
      };
      st.raf = requestAnimationFrame(step);
    }
  }
}
let dsecTick = false;
window.addEventListener('scroll', () => {
  if (dsecTick || !dsecs.length) return;
  dsecTick = true;
  requestAnimationFrame(() => { dsecTick = false; onDsecScroll(); });
}, { passive: true });

// ------------------------------------------------------------------ the Epicure teardown (B's robot, re-skinned)
let teardown = null, tdLoading = false;
const tdSec = $('#ce-teardown');
const tdAllowed = () => liveAllowed();
async function ensureTeardown() {
  tdSec.classList.toggle('td-live', false);
  if (!tdAllowed()) { tdSec.classList.add('td-still'); if (teardown) teardown.setVisible(false); return; }
  tdSec.classList.remove('td-still');
  if (teardown) { teardown.setVisible(true); tdSec.classList.add('td-live'); onTdScroll(); return; }
  if (tdLoading) return;
  tdLoading = true;
  try {
    const mod = await import('./teardown.js');
    teardown = await mod.createTeardown({
      canvas: $('.td-canvas', tdSec), tagsEl: $('.td-tags', tdSec), mobile: MOBILE.matches,
      onFirstFrame: () => tdSec.classList.add('td-live'),
    });
    window.__wb.teardown = teardown;
    teardown.setVisible(currentView === 'case-epicure');
    onTdScroll();
  } catch (err) {
    console.warn('Teardown: live robot unavailable, showing the drawing.', err && err.message);
    tdSec.classList.add('td-still');
  } finally {
    tdLoading = false;
  }
}
const tdSteps = $$('.td-step', tdSec);
const tdCount = $('.js-tdn', tdSec);
function onTdScroll() {
  if (currentView !== 'case-epicure') return;
  // explode across the five layer steps: 0 before the first, 1 at the last
  const line = window.innerHeight * 0.55;
  const tops = tdSteps.map((li) => li.getBoundingClientRect().top);
  let p = 0, active = -1;
  for (let i = 0; i < tops.length; i++) {
    if (tops[i] < line) active = i;
  }
  if (active >= 0) {
    const nextTop = active < tops.length - 1 ? tops[active + 1] : tops[active] + tdSteps[active].offsetHeight;
    const frac = Math.min(1, Math.max(0, (line - tops[active]) / Math.max(1, nextTop - tops[active])));
    p = Math.min(1, (active + Math.min(1, frac * 1.6)) / tdSteps.length);
  }
  tdSteps.forEach((li, i) => li.classList.toggle('is-on', i === active));
  if (tdCount) tdCount.textContent = String(Math.min(5, Math.round(p * 5)));
  if (teardown) teardown.setProgress(p, active);
}
let tdTick = false;
window.addEventListener('scroll', () => {
  if (tdTick) return;
  tdTick = true;
  requestAnimationFrame(() => { tdTick = false; onTdScroll(); });
}, { passive: true });

// ------------------------------------------------------------------ booklet contents
for (const b of $$('[data-jump]')) {
  b.addEventListener('click', () => {
    const el = document.getElementById(b.dataset.jump);
    if (el) el.scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' });
  });
}

// ------------------------------------------------------------------ drawers
for (const front of $$('.drawer-front')) {
  front.addEventListener('click', () => {
    const open = front.getAttribute('aria-expanded') !== 'true';
    front.setAttribute('aria-expanded', String(open));
    const tray = document.getElementById(front.getAttribute('aria-controls'));
    if (tray) tray.hidden = !open;
  });
}

// ------------------------------------------------------------------ copy, toast, stamp
const toastEl = $('.toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2400);
}
async function copyText(text) {
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('no clipboard');
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}
document.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.js-copy');
  if (!btn) return;
  const text = btn.dataset.copy || EMAIL;
  const ok = await copyText(text);
  if (ok) {
    toast(`Copied ${text}`);
    if (btn.dataset.stamp) {
      const st = btn.parentElement.querySelector('.stamp');
      if (st) { st.classList.remove('on'); void st.offsetWidth; st.classList.add('on'); }
    }
  } else {
    toast(`Copy is blocked here. The address is ${text}`);
  }
});

// ------------------------------------------------------------------ contact note (never "sent")
const form = $('.note-form');
const composed = $('.composed');
form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  const email = String(fd.get('email') || '').trim();
  const msg = String(fd.get('message') || '').trim();
  const bad = [];
  form.elements.name.setAttribute('aria-invalid', String(!name)); if (!name) bad.push(form.elements.name);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  form.elements.email.setAttribute('aria-invalid', String(!emailOk)); if (!emailOk) bad.push(form.elements.email);
  form.elements.message.setAttribute('aria-invalid', String(!msg)); if (!msg) bad.push(form.elements.message);
  if (bad.length) { bad[0].focus(); toast('Add your name, a valid email and a message.'); return; }
  $('.composed-text', composed).textContent = `To: ${EMAIL}\nSubject: Hello from ${name}\n\nHi Bhargav,\n\n${msg}\n\n${name}\n${email}`;
  form.hidden = true;
  composed.hidden = false;
  composed.focus();
});
$('.js-copy-note').addEventListener('click', async () => {
  const ok = await copyText($('.composed-text').textContent);
  toast(ok ? 'Note copied · paste it into an email' : `Copy is blocked here. Select the note and copy it, then send it to ${EMAIL}`);
});
$('.js-edit-note').addEventListener('click', () => { composed.hidden = true; form.hidden = false; form.elements.message.focus(); });

// (review-only views chip removed in production)
function closeViews() {}

// ------------------------------------------------------------------ small things
const istFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
function tickClock() { const s = istFmt.format(new Date()); for (const el of $$('.js-ist')) el.textContent = s; }
tickClock();
setInterval(tickClock, 30000);
const toy = $('.toy');
toy.addEventListener('click', () => { toy.classList.remove('spin'); void toy.offsetWidth; toy.classList.add('spin'); });
toy.addEventListener('animationend', () => toy.classList.remove('spin'));

// ------------------------------------------------------------------ debug + smoke test hooks (used by .verify)
window.__wb = {
  scene: null, teardown: null, poseAt, BEATS,
  t: () => tAt(window.scrollY),
  scrollToT(t) { measure(); const i = Math.floor(t), u = t - i; window.scrollTo(0, (starts[i] || 0) + ((ends[i] || 0) - (starts[i] || 0)) * u); onScroll(); },
  smoke() {
    const out = { svg: {}, three: {}, robot: null };
    for (const id of ['books', 'phone', 'zen', 'rig', 'airlock', 'drawers', 'promptguard', 'audiobookai', 'forkfinder']) {
      const d = createDissection(id, { svg: true, p: 0 });
      d.el.style.cssText = 'position:fixed;left:-2000px;top:0;width:600px;height:600px';
      document.body.appendChild(d.el);
      d.setExplode(0); const a0 = d.anchors();
      d.setExplode(1); const a1 = d.anchors();
      out.svg[id] = { parts: d.parts.map((p) => p.id), explode: d.explodeVectors, movedPx: a0.map((a, i) => +Math.hypot(a1[i].x - a.x, a1[i].y - a.y).toFixed(1)) };
      d.el.remove();
    }
    if (this.scene) {
      for (const [id, d] of Object.entries(this.scene.dissections)) {
        const keep = d.p;
        d.setExplode(0); const p0 = d.meshParts.map((m) => m.group.position.toArray().map((v) => +v.toFixed(3)));
        d.setExplode(1); const p1 = d.meshParts.map((m) => m.group.position.toArray().map((v) => +v.toFixed(3)));
        d.setExplode(keep);
        out.three[id] = { parts: d.parts.map((p) => p.id), assembled: p0, exploded: p1 };
      }
      out.stationU = this.scene.thread.stationU.map((u) => +u.toFixed(4));
    }
    if (this.teardown) out.robot = this.teardown.smoke();
    return out;
  },
};

// ------------------------------------------------------------------ boot
route();
setMode();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); onScroll(); });

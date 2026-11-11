/* SkyWay shared components loader and interactions.
   Include this file with defer from pages located in the project root. */
(() => {
  "use strict";

  const scriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : new URL("js/shared.js", window.location.href).href;
  const projectRoot = new URL("../", scriptUrl);
  const componentUrl = (name) => new URL(`components/${name}.html`, projectRoot).href;

  // Theme is applied before components load so every page starts consistently.
  const THEME_KEY = "skyway-theme";
  const root = document.documentElement;
  const storedTheme = (() => {
    try { return localStorage.getItem(THEME_KEY); } catch (_) { return null; }
  })();
  const initialTheme = storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  root.dataset.theme = initialTheme;

  function applyTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch (_) { /* Storage may be blocked. */ }
    const toggle = document.querySelector("[data-sw-theme-toggle]");
    if (toggle) toggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#050c18" : "#f3f7ff");
  }

  async function inject(selector, name) {
    const target = document.querySelector(selector);
    if (!target) return;
    try {
      const response = await fetch(componentUrl(name), { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Could not load ${name}: ${response.status}`);
      target.innerHTML = await response.text();
    } catch (error) {
      console.error(`[SkyWay] ${error.message}`);
      target.innerHTML = `<p class="sw-component-error">The ${name} component could not be loaded.</p>`;
    }
  }

  function setActiveNav() {
    const current = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".sw-primary-nav a, .sw-mobile-nav a").forEach((link) => {
      const destination = new URL(link.href, window.location.href).pathname.split("/").pop();
      if (destination === current) link.setAttribute("aria-current", "page");
    });
  }

  function initInteractions() {
    const header = document.querySelector("[data-sw-header]");
    const menuButton = document.querySelector("[data-sw-menu-toggle]");
    const mobileMenu = document.querySelector("[data-sw-mobile-menu]");

    const updateScrollState = () => {
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });

    document.querySelector("[data-sw-theme-toggle]")?.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });

    function closeMenu() {
      if (!menuButton || !mobileMenu) return;
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open navigation menu");
      mobileMenu.hidden = true;
    }
    menuButton?.addEventListener("click", () => {
      const isOpen = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!isOpen));
      menuButton.setAttribute("aria-label", isOpen ? "Open navigation menu" : "Close navigation menu");
      mobileMenu.hidden = isOpen;
    });
    mobileMenu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 780) closeMenu();
    });

    const year = document.querySelector("[data-sw-year]");
    if (year) year.textContent = String(new Date().getFullYear());

    const form = document.querySelector("[data-sw-newsletter]");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const message = form.querySelector("[data-sw-newsletter-message]");
      if (!input || !message) return;
      message.classList.remove("is-success", "is-error");
      if (!input.value.trim() || !input.validity.valid) {
        message.textContent = "Please enter a valid email address.";
        message.classList.add("is-error");
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      input.removeAttribute("aria-invalid");
      message.textContent = "Thanks for subscribing! Your email has been validated.";
      message.classList.add("is-success");
      form.reset();
      // Connect this point to your newsletter API/backend to store subscriptions.
    });
  }

  async function start() {
    // The placeholders belong in each page; no page-specific sections are created here.
    await Promise.all([
      inject("#skyway-navbar", "navbar"),
      inject("#skyway-footer", "footer")
    ]);
    setActiveNav();
    initInteractions();
    applyTheme(root.dataset.theme || initialTheme);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();


// SkyTrack Flight Management — interactive dashboard
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const TAU = Math.PI * 2;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ==========================================================================
   Globe
   ========================================================================== */
const canvas = $("#earthCanvas");
const ctx = canvas.getContext("2d");
const globeArea = $("#globeArea");

let globeScale = 1, globeScaleTarget = 1;
let globeRotation = 0;
let flightActive = false;
let flightProgress = 0;
let lastFrame = performance.now();
const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  measureTags();
}
const tagSize = new Map();
function measureTags() {
  ["#tagStart", "#tagEnd", "#tagMid"].forEach(id => { const t = $(id); tagSize.set(t, { w: t.offsetWidth, h: t.offsetHeight }); });
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();
if (document.fonts) document.fonts.ready.then(measureTags);

// Pre-rendered glow sprite for city lights (much cheaper than shadowBlur per city).
const glowSprite = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const g = c.getContext("2d"), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,240,200,1)"); grad.addColorStop(.25, "rgba(255,224,145,.9)");
  grad.addColorStop(.6, "rgba(255,219,138,.25)"); grad.addColorStop(1, "rgba(255,219,138,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32); return c;
})();

// Continents as [longitude-ish, latitude-ish] outlines (front hemisphere) …
const baseLand = [
  [[-.88,-.34],[-.77,-.55],[-.62,-.58],[-.54,-.44],[-.48,-.3],[-.55,-.12],[-.62,.02],[-.7,.12],[-.77,.02],[-.9,-.08]],
  [[-.59,.08],[-.45,.1],[-.39,.25],[-.44,.45],[-.54,.72],[-.66,.52],[-.69,.29]],
  [[-.18,-.67],[.02,-.78],[.19,-.7],[.28,-.55],[.2,-.42],[.04,-.38],[-.12,-.48]],
  [[-.08,-.34],[.12,-.3],[.21,-.1],[.16,.18],[.04,.47],[-.13,.56],[-.22,.25],[-.2,-.05]],
  [[.14,-.43],[.35,-.55],[.61,-.48],[.81,-.32],[.83,-.08],[.65,.05],[.54,.24],[.36,.2],[.2,.04],[.1,-.2]],
  [[.47,.18],[.67,.14],[.75,.3],[.68,.55],[.51,.62],[.4,.4]],
  [[.82,.57],[.91,.52],[.96,.63],[.87,.72]]
];
// … mirrored onto the far side so the rotating globe never looks empty.
const landShapes = [
  ...baseLand.map(s => s.map(([x, y]) => [x * 1.3, y * 1.15])),
  ...baseLand.slice(0, 5).map(s => s.map(([x, y]) => [x * 1.2 + Math.PI, -y * .9 + .05]))
];
const cities = Array.from({ length: 220 }, (_, i) => ({
  lon: (Math.sin(i * 127.1) * .5 + .5) * TAU,
  lat: Math.cos(i * 71.7) * .95,
  r: .5 + (i % 4) * .28,
  pulse: Math.random() * TAU
}));
const stars = Array.from({ length: 140 }, (_, i) => ({
  x: Math.sin(i * 19.3) * .5 + .5, y: Math.cos(i * 11.7) * .5 + .5,
  a: .15 + Math.random() * .55, s: Math.random() * TAU, size: Math.random() < .12 ? 1.6 : 1
}));

// Yellow dotted orbits around the Earth — each one carries an aircraft exactly on its dots.
// a / b are radii relative to the globe radius, tilt is the on-screen rotation.
const orbits = [
  { a: 1.22, b: .30, tilt: -.20, period: 15000, phase: .00, dir:  1, size: 1.00 },
  { a: 1.36, b: .46, tilt:  .42, period: 21000, phase: .40, dir:  1, size: 1.05 },
  { a: 1.12, b: .60, tilt: -.98, period: 17500, phase: .72, dir: -1, size: .92 },
  { a: 1.50, b: .20, tilt:  .10, period: 26000, phase: .18, dir: -1, size: 1.10 }
];
$("#activeFlights").textContent = orbits.length + 1;

// Arc-length tables so aircraft move at a steady speed (plain angle steps race across
// the front of a flat ellipse and crawl at its ends).
const ORBIT_SPEED = .30;   // globe radii per second, shared by all orbiting aircraft
const ROUTE_DURATION = 12000; // ms for the DXB → SYD loop
function buildTable(pointAt, n = 360) {
  const len = [0]; let prev = pointAt(0), total = 0;
  for (let i = 1; i <= n; i++) {
    const t = i / n, p = pointAt(t);
    total += Math.hypot(p.x - prev.x, p.y - prev.y); len.push(total); prev = p;
  }
  return { len, total, n };
}
function paramAt(table, f) { // arc fraction (0..1) → curve parameter (0..1)
  const target = (((f % 1) + 1) % 1) * table.total, { len, n } = table;
  let lo = 0, hi = n;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; len[mid] < target ? (lo = mid) : (hi = mid); }
  const seg = len[hi] - len[lo] || 1;
  return (lo + (target - len[lo]) / seg) / n;
}
orbits.forEach(o => {
  o.table = buildTable(t => ({ x: Math.cos(t * TAU) * o.a, y: Math.sin(t * TAU) * o.b }));
  o.period = (o.table.total / ORBIT_SPEED) * 1000;
});

// DXB → SYD route drawn on the globe surface (relative to globe radius).
const ROUTE = { p0: { x: -.55, y: .08 }, p1: { x: -.02, y: -.78 }, p2: { x: .52, y: -.43 } };
const DXB = { lat: 25.2532, lon: 55.3657 }, SYD = { lat: -33.9399, lon: 151.1753 };

const routeTable = buildTable(u => {
  const { p0, p1, p2 } = ROUTE, m = 1 - u;
  return { x: m * m * p0.x + 2 * m * u * p1.x + u * u * p2.x, y: m * m * p0.y + 2 * m * u * p1.y + u * u * p2.y };
}, 200);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => t * t * (3 - 2 * t);

function project(lon, lat, R) {
  const l = lon + globeRotation;
  const z = Math.cos(lat) * Math.cos(l);
  let x = Math.cos(lat) * Math.sin(l);
  if (z < 0) x = Math.sign(x) * Math.cos(lat); // pin hidden points to the limb
  return { x: x * R, y: Math.sin(lat) * R, z };
}

function orbitPoint(o, theta, R) {
  const lx = Math.cos(theta) * o.a * R, ly = Math.sin(theta) * o.b * R;
  const c = Math.cos(o.tilt), s = Math.sin(o.tilt);
  const dx = -Math.sin(theta) * o.a * o.dir, dy = Math.cos(theta) * o.b * o.dir;
  return {
    x: lx * c - ly * s, y: lx * s + ly * c,
    angle: Math.atan2(dx * s + dy * c, dx * c - dy * s),
    front: Math.sin(theta) > 0, depth: Math.sin(theta)
  };
}

const PLANE = [[10,0],[7.5,-1.5],[2,-1.5],[-3,-8.6],[-5.8,-8.6],[-2.4,-1.5],[-7,-1.5],[-9.2,-4.4],[-10.8,-4.4],[-9.6,0],[-10.8,4.4],[-9.2,4.4],[-7,1.5],[-2.4,1.5],[-5.8,8.6],[-3,8.6],[2,1.5],[7.5,1.5]];
function drawPlane(x, y, angle, scale, alpha) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  PLANE.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.drawImage(glowSprite, -16, -16, 32, 32);
  ctx.fillStyle = "#ffe07a"; ctx.fill();
  ctx.lineWidth = .8; ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.stroke();
  ctx.restore();
}

function drawOrbitHalf(o, R, front, time) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, o.a * R, o.b * R, o.tilt, front ? 0 : Math.PI, front ? Math.PI : TAU);
  ctx.setLineDash([3, 6]);
  ctx.lineDashOffset = reduceMotion ? 0 : -(time / 60) * o.dir;
  ctx.lineCap = "round";
  ctx.lineWidth = front ? 1.6 : 1.1;
  ctx.strokeStyle = front ? "rgba(255,218,106,.85)" : "rgba(255,218,106,.28)";
  ctx.stroke();
  if (front) { ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,213,96,.12)"; ctx.stroke(); }
  ctx.restore();
}

function drawTrail(o, theta, R, front) {
  const steps = 18, span = .42;
  for (let i = 0; i < steps; i++) {
    const t0 = theta - o.dir * span * (i / steps), t1 = theta - o.dir * span * ((i + 1) / steps);
    if ((Math.sin((t0 + t1) / 2) > 0) !== front) continue;
    const a = orbitPoint(o, t0, R), b = orbitPoint(o, t1, R);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = `rgba(255,224,130,${(1 - i / steps) * (front ? .7 : .25)})`;
    ctx.lineWidth = (1 - i / steps) * 3 + .4;
    ctx.lineCap = "round"; ctx.stroke();
  }
}

function drawOrbitLayer(R, time, front) {
  orbits.forEach(o => {
    drawOrbitHalf(o, R, front, time);
    const f = o.phase + o.dir * (time / o.period);
    const theta = paramAt(o.table, f) * TAU;
    drawTrail(o, theta, R, front);
    const p = orbitPoint(o, theta, R);
    if (p.front === front) {
      const scale = o.size * (.82 + .22 * p.depth) * Math.max(.8, Math.min(1.2, R / 170));
      drawPlane(p.x, p.y, p.angle, scale, front ? 1 : .45);
    }
  });
}

function routePoint(u, R) {
  const { p0, p1, p2 } = ROUTE, m = 1 - u;
  return {
    x: (m * m * p0.x + 2 * m * u * p1.x + u * u * p2.x) * R,
    y: (m * m * p0.y + 2 * m * u * p1.y + u * u * p2.y) * R,
    angle: Math.atan2(2 * m * (p1.y - p0.y) + 2 * u * (p2.y - p1.y), 2 * m * (p1.x - p0.x) + 2 * u * (p2.x - p1.x))
  };
}

const tags = { start: $("#tagStart"), end: $("#tagEnd"), mid: $("#tagMid") };
function placeTag(el, x, y, mode) {
  const size = tagSize.get(el) || { w: 0, h: 0 }, w = size.w, h = size.h;
  let tx = x - w / 2, ty = y - h - 14;               // above
  if (mode === "left") { tx = x - w - 14; ty = y - h / 2; }
  if (mode === "follow") { tx = x + 14; ty = y + 10; } // trails below-right of the aircraft
  el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
  if (!el.classList.contains("ready")) el.classList.add("ready");
}

const ui = {
  fill: $("#progressFill"), plane: $("#progressPlane"), value: $("#progressValue"),
  lat: $("#latValue"), lon: $("#longValue")
};
let uiTick = 0;
function updateProgressUI(u) {
  if (uiTick++ % 6) return;
  const pct = Math.round(u * 100);
  ui.fill.style.width = pct + "%";
  ui.plane.style.left = pct + "%";
  ui.value.textContent = pct + "%";
  ui.lat.textContent = (DXB.lat + (SYD.lat - DXB.lat) * u).toFixed(7);
  ui.lon.textContent = (DXB.lon + (SYD.lon - DXB.lon) * u).toFixed(7);
}

let animTime = 0;
function drawGlobe(now) {
  const dt = clamp(now - lastFrame, 0, 50); lastFrame = now;
  animTime += dt;
  const time = animTime;
  const ease = k => 1 - Math.pow(1 - k, dt / 16.67);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  globeScale += (globeScaleTarget - globeScale) * ease(.08);
  parallax.x += (parallax.tx - parallax.x) * ease(.05);
  parallax.y += (parallax.ty - parallax.y) * ease(.05);

  // Twinkling stars with gentle parallax
  stars.forEach(s => {
    const tw = reduceMotion ? 1 : (Math.sin(time * .0015 + s.s) + 1.4) / 2.4;
    ctx.fillStyle = `rgba(170,222,255,${s.a * tw})`;
    ctx.fillRect(s.x * w - parallax.x * 6, s.y * h - parallax.y * 4, s.size, s.size);
  });

  const R = Math.min(h * .37, w * .27) * globeScale;
  const cx = w * .5 + parallax.x * 14, cy = h * .5 + parallax.y * 10;
  ctx.save();
  ctx.translate(cx, cy);

  // 1. Far side of the orbits (behind the Earth)
  drawOrbitLayer(R, time, false);

  // 2. Atmosphere glow + sphere
  const glow = ctx.createRadialGradient(0, 0, R * .9, 0, 0, R * 1.32);
  glow.addColorStop(0, "rgba(60,170,255,.32)"); glow.addColorStop(.35, "rgba(60,170,255,.12)"); glow.addColorStop(1, "rgba(60,170,255,0)");
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, R * 1.32, 0, TAU); ctx.fill();

  const sphere = ctx.createRadialGradient(-R * .38, -R * .42, R * .05, 0, 0, R * 1.05);
  sphere.addColorStop(0, "#4f86b8"); sphere.addColorStop(.45, "#164170"); sphere.addColorStop(.82, "#0a2747"); sphere.addColorStop(1, "#04132a");
  ctx.fillStyle = sphere; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();

  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();

  // Rotating latitude / longitude grid
  ctx.strokeStyle = "rgba(139,209,255,.12)"; ctx.lineWidth = .7;
  for (let i = -4; i <= 4; i++) {
    const lat = i * .32, y = Math.sin(lat) * R, hw = Math.cos(lat) * R;
    ctx.beginPath(); ctx.moveTo(-hw, y); ctx.lineTo(hw, y); ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const l = i * TAU / 12 + globeRotation;
    if (Math.cos(l) <= 0) continue;
    const sx = Math.sin(l);
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.abs(sx) * R, R, 0, sx >= 0 ? -Math.PI / 2 : Math.PI / 2, sx >= 0 ? Math.PI / 2 : Math.PI * 1.5);
    ctx.stroke();
  }

  // Continents on the sphere
  landShapes.forEach((shape, index) => {
    const pts = shape.map(([x, y]) => project(x, y, R));
    const avgZ = pts.reduce((s, p) => s + p.z, 0) / pts.length;
    if (pts.every(p => p.z < 0)) return;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    const fade = clamp(avgZ * 1.6 + .25, .08, 1);
    ctx.fillStyle = index % 2 ? `rgba(86,163,184,${.46 * fade})` : `rgba(108,186,190,${.4 * fade})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(150,225,230,${.42 * fade})`; ctx.lineWidth = 1.1; ctx.stroke();
  });

  // City lights
  cities.forEach(city => {
    const p = project(city.lon, city.lat, R);
    if (p.z < .12) return;
    const pulse = reduceMotion ? .6 : (Math.sin(time * .002 + city.pulse) + 1) * .5;
    const size = (city.r + pulse * .6) * (.6 + p.z * .4) * 5;
    ctx.globalAlpha = Math.min(1, (.25 + pulse * .6) * p.z);
    ctx.drawImage(glowSprite, p.x - size / 2, p.y - size / 2, size, size);
  });
  ctx.globalAlpha = 1;

  // Night-side shading + specular highlight for depth
  const shade = ctx.createRadialGradient(-R * .45, -R * .45, R * .2, 0, 0, R * 1.05);
  shade.addColorStop(0, "rgba(255,255,255,.07)"); shade.addColorStop(.55, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(2,8,20,.55)");
  ctx.fillStyle = shade; ctx.fillRect(-R, -R, R * 2, R * 2);

  // DXB → SYD dotted flight path on the surface
  const P0 = { x: ROUTE.p0.x * R, y: ROUTE.p0.y * R }, P2 = { x: ROUTE.p2.x * R, y: ROUTE.p2.y * R };
  ctx.beginPath(); ctx.moveTo(P0.x, P0.y); ctx.quadraticCurveTo(ROUTE.p1.x * R, ROUTE.p1.y * R, P2.x, P2.y);
  ctx.strokeStyle = "rgba(255,225,112,.9)"; ctx.lineWidth = 1.6; ctx.setLineDash([3, 6]); ctx.lineCap = "round";
  ctx.lineDashOffset = reduceMotion ? 0 : -time / 50;
  ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,225,112,.14)"; ctx.stroke(); ctx.setLineDash([]);
  [P0, P2].forEach((p, i) => {
    const ring = ((time / 1600) + i * .5) % 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3 + ring * 12, 0, TAU);
    ctx.strokeStyle = `rgba(255,227,106,${.6 * (1 - ring)})`; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, TAU);
    ctx.drawImage(glowSprite, p.x - 12, p.y - 12, 24, 24);
    ctx.fillStyle = "#ffe36a"; ctx.fill();
  });
  ctx.restore(); // end sphere clip

  // Atmosphere rim
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU);
  ctx.strokeStyle = "rgba(92,214,255,.10)"; ctx.lineWidth = 9; ctx.stroke();
  ctx.strokeStyle = "rgba(92,214,255,.16)"; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = "rgba(120,210,255,.5)"; ctx.lineWidth = 1.2; ctx.stroke();

  // Aircraft on the surface route (sits exactly on the dotted line)
  const u = flightActive ? flightProgress : (time % ROUTE_DURATION) / ROUTE_DURATION;
  const edgeFade = flightActive ? 1 : smooth(clamp(u / .06, 0, 1)) * smooth(clamp((1 - u) / .06, 0, 1));
  const rp = routePoint(paramAt(routeTable, Math.min(u, .9999)), R);
  drawPlane(rp.x, rp.y, rp.angle, (flightActive ? 1.55 : 1.15) * Math.max(.85, Math.min(1.2, R / 170)), edgeFade);

  // 3. Near side of the orbits (in front of the Earth)
  drawOrbitLayer(R, time, true);
  ctx.restore();

  // HTML labels pinned to canvas positions
  placeTag(tags.start, cx + P0.x, cy + P0.y, "left");
  placeTag(tags.end, cx + P2.x, cy + P2.y, "above");
  placeTag(tags.mid, cx + rp.x, cy + rp.y, "follow");
  tags.mid.style.opacity = edgeFade;
  updateProgressUI(u);

  if (!reduceMotion) globeRotation += dt * .00007;
  if (flightActive) { flightProgress += dt * .00022; if (flightProgress >= 1) { flightActive = false; flightProgress = 0; } }
  rafId = requestAnimationFrame(drawGlobe);
}

// Only animate while the globe is on screen and the tab is visible.
let rafId = 0, running = false, globeVisible = true;
function startGlobe() { if (running || !globeVisible || document.hidden) return; running = true; lastFrame = performance.now(); rafId = requestAnimationFrame(drawGlobe); }
function stopGlobe() { running = false; cancelAnimationFrame(rafId); }
new IntersectionObserver(entries => { globeVisible = entries[entries.length - 1].isIntersecting; globeVisible ? startGlobe() : stopGlobe(); }).observe(globeArea);
document.addEventListener("visibilitychange", () => (document.hidden ? stopGlobe() : startGlobe()));
startGlobe();

globeArea.addEventListener("pointermove", e => {
  if (scrolling) return;
  const r = globeArea.getBoundingClientRect();
  parallax.tx = ((e.clientX - r.left) / r.width - .5) * 2;
  parallax.ty = ((e.clientY - r.top) / r.height - .5) * 2;
});
globeArea.addEventListener("pointerleave", () => { if (scrolling) return; parallax.tx = 0; parallax.ty = 0; });

$("#zoomIn").addEventListener("click", () => { globeScaleTarget = Math.min(1.25, globeScaleTarget + .08); });
$("#zoomOut").addEventListener("click", () => { globeScaleTarget = Math.max(.78, globeScaleTarget - .08); });
$("#resetGlobe").addEventListener("click", () => { globeScaleTarget = 1; globeRotation = 0; });

/* ==========================================================================
   UI polish: spotlight cards + live clock
   ========================================================================== */
let scrolling = false, scrollTimer = 0;
window.addEventListener("scroll", () => {
  if (!scrolling) { scrolling = true; document.documentElement.classList.add("is-scrolling"); }
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => { scrolling = false; document.documentElement.classList.remove("is-scrolling"); }, 140);
}, { passive: true });
$$(".glass").forEach(card => {
  let pending = null;
  card.addEventListener("pointermove", e => {
    if (scrolling) return;
    if (!pending) requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${pending.x - r.left}px`);
      card.style.setProperty("--my", `${pending.y - r.top}px`);
      pending = null;
    });
    pending = { x: e.clientX, y: e.clientY };
  }, { passive: true });
});
const clock = $("#utcClock");
const tickClock = () => { clock.textContent = new Date().toISOString().slice(11, 19); };
tickClock(); setInterval(tickClock, 1000);

/* ==========================================================================
   Modals & booking
   ========================================================================== */
const bookingModal = $("#bookingModal"), ticketModal = $("#ticketModal");
function openModal(modal) { modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; }
function closeModal(modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); if (!$(".modal-backdrop.open")) document.body.style.overflow = ""; }
$("#openBooking").addEventListener("click", () => openModal(bookingModal));
$$("[data-close]").forEach(btn => btn.addEventListener("click", () => closeModal(btn.closest(".modal-backdrop"))));
[bookingModal, ticketModal].forEach(modal => modal.addEventListener("click", e => { if (e.target === modal) closeModal(modal); }));
document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".modal-backdrop.open").forEach(closeModal); });

const classPrices = { "Economy": 480, "Business": 1250, "First Class": 2890, "VIP": 4500 };
function selectedClass() { return $('input[name="travelClass"]:checked').value; }
function updatePrice() {
  const passengerCount = Number($("#passengers").value[0]);
  const el = $("#pricePreview");
  el.textContent = "$" + (classPrices[selectedClass()] * passengerCount).toLocaleString("en-US", { minimumFractionDigits: 2 });
  el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
}
$$('input[name="travelClass"]').forEach(el => el.addEventListener("change", updatePrice));
$("#passengers").addEventListener("change", updatePrice);
const dateInput = $("#travelDate");
dateInput.min = new Date().toISOString().slice(0, 10);
dateInput.value = dateInput.min;
updatePrice();

function airportCode(value) { const match = value.match(/\((.*?)\)/); return match ? match[1] : value.slice(0, 3).toUpperCase(); }
function airportName(value) { return value.replace(/\s*\(.*?\)/, ""); }
function showTicket(data) {
  $("#ticketFrom").textContent = airportCode(data.from); $("#ticketTo").textContent = airportCode(data.to);
  $("#ticketFromName").textContent = airportName(data.from); $("#ticketToName").textContent = airportName(data.to);
  $("#ticketClass").textContent = data.travelClass.toUpperCase() + " CLASS";
  $("#ticketDeparture").textContent = data.departure; $("#ticketArrival").textContent = data.arrival;
  $("#ticketDate").textContent = new Date(data.date + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
  $("#ticketPassengers").textContent = data.passengers; $("#ticketGate").textContent = "A" + (10 + Math.floor(Math.random() * 8));
  $("#ticketPrice").textContent = "$" + data.total.toLocaleString("en-US");
  openModal(ticketModal);
}
let orders = 3;
$("#bookingForm").addEventListener("submit", e => {
  e.preventDefault();
  const from = $("#fromCity").value, to = $("#toCity").value;
  if (airportCode(from) === airportCode(to)) { alert("Please choose two different airports."); return; }
  const travelClass = selectedClass(), passengers = Number($("#passengers").value[0]);
  const total = classPrices[travelClass] * passengers;
  const data = { from, to, travelClass, passengers, total, date: dateInput.value, departure: "20:35", arrival: "05:35" };
  closeModal(bookingModal);
  showTicket(data);
  const orderId = String(50000 + Math.floor(Math.random() * 49999));
  const row = document.createElement("tr"); row.dataset.status = "Successful";
  row.innerHTML = `<td>#${orderId}</td><td><b>${airportCode(from)}</b><span class="route-arrow">→</span><b>${airportCode(to)}</b></td><td>20:35</td><td>05:35</td><td><span class="payment success">● Successful</span></td><td><button class="view-ticket" data-order="${orderId}">View ticket</button></td>`;
  $("#orderRows").prepend(row); orders++; $("#orderCount").textContent = String(orders).padStart(2, "0");
  filterOrders();
});
$("#boardFlight").addEventListener("click", () => {
  closeModal(ticketModal); flightActive = true; flightProgress = 0;
  const toast = $("#takeoffToast"); toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 6500);
});
$("#dismissToast").addEventListener("click", () => $("#takeoffToast").classList.remove("show"));

function filterOrders() {
  const query = $("#searchInput").value.toLowerCase(), status = $("#statusFilter").value;
  let visible = 0;
  $$("#orderRows tr").forEach(row => {
    const matchesText = row.textContent.toLowerCase().includes(query);
    const matchesStatus = status === "all" || row.dataset.status === status;
    row.hidden = !(matchesText && matchesStatus); if (!row.hidden) visible++;
  });
  $("#emptyState").hidden = visible !== 0;
}
$("#searchInput").addEventListener("input", filterOrders);
$("#statusFilter").addEventListener("change", filterOrders);
$("#orderRows").addEventListener("click", e => {
  const btn = e.target.closest(".view-ticket"); if (!btn) return;
  const row = btn.closest("tr"), cells = row.children;
  const route = [...cells[1].querySelectorAll("b")].map(x => x.textContent);
  showTicket({ from: `${route[0]} (${route[0]})`, to: `${route[1]} (${route[1]})`, travelClass: "Business", passengers: 1, total: 1250, date: dateInput.value, departure: cells[2].textContent, arrival: cells[3].textContent });
});